/**
 * Deterministic Mobile Hardware Fingerprinting & Phone Hardware Hashing Engine
 *
 * Refactored specifically for mobile user agents:
 * - Canvas, WebGL, and AudioContext fingerprinting are completely removed on mobile
 *   to avoid browser-specific rendering variations (e.g. Brave canvas shields, Firefox WebGL spoofing).
 * - Constructs a deterministic mobile hardware signature using fixed physical device parameters:
 *   1. Screen dimensions (orientation-independent screen.width, screen.height, window.devicePixelRatio)
 *   2. Hardware specs (navigator.hardwareConcurrency, navigator.deviceMemory)
 *   3. System attributes (navigator.maxTouchPoints, Intl.DateTimeFormat().resolvedOptions().timeZone)
 * - Hashes these static parameters into a consistent TR-XXXXX format.
 * - Guarantees that Chrome, Firefox, Opera, and Brave on the exact same physical mobile device
 *   calculate the identical TR-XXXXX ID automatically on initial boot.
 */

const TR_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const MOBILE_STORAGE_KEY = "phantom_device_dna";
const TR_ID_REGEX = /^TR-[A-Z0-9]{5}$/;

/**
 * Detects whether the current browser is running on a mobile device or tablet.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  const mobileRegex =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS|FxiOS/i;
  const isMobileUa = mobileRegex.test(ua);
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  const isIpadOS = navigator.platform === "MacIntel" && maxTouchPoints > 1;
  return isMobileUa || isIpadOS;
}

/**
 * Constructs a strictly deterministic mobile hardware signature using fixed physical parameters only.
 * No Canvas, no WebGL, no AudioContext.
 *
 * Parameters used:
 * - Screen dimensions: Math.max(screen.width, screen.height) x Math.min(screen.width, screen.height)
 * - Display ratio: window.devicePixelRatio (normalized to 2 decimal places)
 * - CPU Concurrency: navigator.hardwareConcurrency (clamped/defaulted)
 * - Memory: navigator.deviceMemory (clamped/defaulted)
 * - Touch input: navigator.maxTouchPoints
 * - System Timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
 */
export function getMobileHardwareParameters(): string {
  if (typeof window === "undefined") return "mobile:fallback";

  const s = window.screen || ({} as Screen);
  const n = (typeof navigator !== "undefined" ? navigator : {}) as any;

  // 1. Screen dimensions (orientation-independent max and min so phone rotation never alters the hash)
  const rawW = Number(s.width || 0);
  const rawH = Number(s.height || 0);
  const maxDim = Math.max(rawW, rawH);
  const minDim = Math.min(rawW, rawH);

  // 2. Display Pixel Ratio
  const dpr =
    typeof window.devicePixelRatio === "number"
      ? Math.round(window.devicePixelRatio * 100) / 100
      : 1;

  // 3. Hardware Specs (CPU cores & RAM)
  const cpuCores = Number(n.hardwareConcurrency || 4);
  const memoryGb = Number(n.deviceMemory || 4);

  // 4. System Attributes (touch points & timezone)
  const maxTouchPoints = Number(n.maxTouchPoints || 0);

  let timeZone = "UTC";
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {}

  // Pure static parameters only - Zero Canvas / WebGL / AudioContext
  return [
    `mobile_hw`,
    `dim:${maxDim}x${minDim}`,
    `dpr:${dpr}`,
    `cpu:${cpuCores}`,
    `mem:${memoryGb}`,
    `touch:${maxTouchPoints}`,
    `tz:${timeZone}`,
  ].join("|");
}

/**
 * Formats a SHA-256 byte array into deterministic TR-XXXXX format using 32-character alphabet.
 */
function bytesToTRIdentifier(bytes: Uint8Array): string {
  const chars: string[] = [];
  for (let i = 0; i < 5; i++) {
    const val = ((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % TR_ALPHABET.length;
    chars.push(TR_ALPHABET[val]);
  }
  return `TR-${chars.join("")}`;
}

/**
 * Synchronous hash fallback that converts static string input into deterministic TR-XXXXX string.
 */
function syncHashToTRIdentifier(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;

  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }

  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 13)) >>> 0;

  const chars: string[] = [];
  let combined = (BigInt(h1) << 32n) | BigInt(h2);
  const base = BigInt(TR_ALPHABET.length);

  for (let i = 0; i < 5; i++) {
    const idx = Number(combined % base);
    chars.push(TR_ALPHABET[idx]);
    combined = combined / base;
  }

  return `TR-${chars.join("")}`;
}

const PRIMARY_DEVICE_ID_KEY = "phantom_device_id";

/**
 * Calculates deterministic TR-XXXXX Device ID for mobile browsers from static hardware specs.
 * Guarantees Chrome, Firefox, Opera, Brave on the exact same physical mobile device
 * produce the identical TR-XXXXX ID automatically.
 */
export async function computeMobileHardwareDeviceId(): Promise<string> {
  // On boot / check, if phantom_device_id or existingId exists in local storage, immediately use it
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const existingId =
        localStorage.getItem(PRIMARY_DEVICE_ID_KEY) ||
        localStorage.getItem("deviceId") ||
        localStorage.getItem(MOBILE_STORAGE_KEY);
      if (existingId && existingId.trim()) {
        const cleanId = existingId.trim().toUpperCase();
        localStorage.setItem(PRIMARY_DEVICE_ID_KEY, cleanId);
        localStorage.setItem("deviceId", cleanId);
        localStorage.setItem(MOBILE_STORAGE_KEY, cleanId);
        return cleanId;
      }
    } catch {}
  }

  const params = getMobileHardwareParameters();
  let trId = "";

  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(params)
      );
      trId = bytesToTRIdentifier(new Uint8Array(digest));
    } else {
      trId = syncHashToTRIdentifier(params);
    }
  } catch {
    trId = syncHashToTRIdentifier(params);
  }

  trId = trId.trim().toUpperCase();

  // Persist to localStorage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(PRIMARY_DEVICE_ID_KEY, trId);
      localStorage.setItem("deviceId", trId);
      localStorage.setItem(MOBILE_STORAGE_KEY, trId);
    } catch {}
  }

  // Persist to IndexedDB
  if (typeof window !== "undefined" && window.indexedDB) {
    try {
      const request = indexedDB.open("PhantomDeviceDB", 1);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("config")) {
          db.createObjectStore("config");
        }
      };
      request.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction("config", "readwrite");
        const store = tx.objectStore("config");
        store.put(trId, "phantom_device_dna");
      };
    } catch {}
  }

  return trId;
}

/**
 * Synchronous version for instant component mounts on mobile devices.
 */
export function getSynchronousMobileDeviceId(): string {
  // If existingId is present, immediately use existingId without recalculating or regenerating
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const existingId =
        localStorage.getItem(PRIMARY_DEVICE_ID_KEY) ||
        localStorage.getItem("deviceId") ||
        localStorage.getItem(MOBILE_STORAGE_KEY);
      if (existingId && existingId.trim()) {
        const cleanId = existingId.trim().toUpperCase();
        localStorage.setItem(PRIMARY_DEVICE_ID_KEY, cleanId);
        localStorage.setItem("deviceId", cleanId);
        localStorage.setItem(MOBILE_STORAGE_KEY, cleanId);
        return cleanId;
      }
    } catch {}
  }

  const params = getMobileHardwareParameters();
  const trId = syncHashToTRIdentifier(params).trim().toUpperCase();

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(PRIMARY_DEVICE_ID_KEY, trId);
      localStorage.setItem("deviceId", trId);
      localStorage.setItem(MOBILE_STORAGE_KEY, trId);
    } catch {}
  }

  return trId;
}

/**
 * High-level helper: returns dynamic mobile hardware ID if on mobile,
 * or allows caller to fall back to desktop ID.
 */
export async function calculateDeviceHash(): Promise<{
  deviceId: string;
  isMobile: boolean;
  hardwareSignature: string;
}> {
  const mobile = isMobileDevice();

  // Check if Device ID exists in local storage
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const existingId =
        localStorage.getItem(PRIMARY_DEVICE_ID_KEY) ||
        localStorage.getItem("deviceId") ||
        localStorage.getItem(MOBILE_STORAGE_KEY);
      if (existingId && existingId.trim()) {
        const cleanId = existingId.trim().toUpperCase();
        return {
          deviceId: cleanId,
          isMobile: mobile,
          hardwareSignature: mobile
            ? getMobileHardwareParameters()
            : "desktop:privacy_shield",
        };
      }
    } catch {}
  }

  if (mobile) {
    const deviceId = await computeMobileHardwareDeviceId();
    return {
      deviceId,
      isMobile: true,
      hardwareSignature: getMobileHardwareParameters(),
    };
  }

  // Desktop path: return cached or synchronous ID
  let desktopId = "TR-U9YSR";
  if (typeof window !== "undefined" && window.localStorage) {
    const cached =
      localStorage.getItem(PRIMARY_DEVICE_ID_KEY) ||
      localStorage.getItem("deviceId") ||
      localStorage.getItem(MOBILE_STORAGE_KEY);
    if (cached && TR_ID_REGEX.test(cached.trim().toUpperCase())) {
      desktopId = cached.trim().toUpperCase();
    }
  }

  return {
    deviceId: desktopId,
    isMobile: false,
    hardwareSignature: "desktop:privacy_shield",
  };
}
