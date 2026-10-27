// Browser-Engine Agnostic Device ID Generator & Deterministic Hardware Fingerprint Engine
import {
  isMobileDevice,
  computeMobileHardwareDeviceId,
  getSynchronousMobileDeviceId,
} from "./deviceHash";

export const PHANTOM_DEVICE_ID_KEY = "phantom_device_id";
export const PHANTOM_SECONDARY_ID_KEY = "phantom_secondary_device_id";
export const PHANTOM_COLLISION_KEY = "phantom_collision_detected";
const LEGACY_STORAGE_KEY = "phantom_device_dna";
const TR_ID_REGEX = /^TR-[A-Z0-9]{5}$/;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/**
 * Retrieves the WebGL unmasked renderer string using WEBGL_debug_renderer_info.
 * Gracefully falls back if unavailable, blocked by browser privacy shields, or on SSR.
 */
export function getWebGLUnmaskedRenderer(): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "webgl_unknown";
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl") ||
      canvas.getContext("webgl2")) as WebGLRenderingContext | null;
    if (!gl) return "webgl_none";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) {
      const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
      return `${vendor || ""}_${renderer || ""}`.trim() || "webgl_default";
    }
    return String(gl.getParameter(gl.RENDERER) || "webgl_standard");
  } catch {
    return "webgl_error";
  }
}

/**
 * Generates Canvas 2D data hash for the secondary deterministic variant.
 */
export function getCanvas2DDataHash(): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "canvas_none";
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "canvas_no_ctx";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial', sans-serif";
    ctx.fillStyle = "#f60";
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("PhantomHardware2D:7.1", 2, 15);
    ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
    ctx.fillText("PhantomHardware2D:7.1", 4, 17);
    return canvas.toDataURL();
  } catch {
    return "canvas_error";
  }
}

/**
 * Measures AudioContext rendering latency asynchronously using OfflineAudioContext.
 */
export async function getAudioContextLatencyAsync(): Promise<string> {
  if (typeof window === "undefined") return "audio_none";
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return "audio_unsupported";
    const ctx = new AudioCtx();
    const baseLatency = (ctx as any).baseLatency ?? 0;
    const outputLatency = (ctx as any).outputLatency ?? 0;
    const sampleRate = ctx.sampleRate || 44100;

    let bufferSum = 0;
    try {
      const OfflineCtx =
        window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      if (OfflineCtx) {
        const offline = new OfflineCtx(1, 44100, 44100);
        const osc = offline.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(10000, offline.currentTime);
        const comp = offline.createDynamicsCompressor();
        osc.connect(comp);
        comp.connect(offline.destination);
        osc.start(0);
        const rendered = await offline.startRendering();
        const chData = rendered.getChannelData(0);
        for (let i = 4500; i < 5000; i++) {
          bufferSum += Math.abs(chData[i] || 0);
        }
      }
    } catch {}

    try {
      await ctx.close();
    } catch {}

    return `audioLatency:base=${baseLatency}:out=${outputLatency}:sr=${sampleRate}:sum=${bufferSum.toFixed(4)}`;
  } catch {
    return "audio_error";
  }
}

/**
 * Synchronous AudioContext latency metrics approximation.
 */
export function getAudioContextLatencySync(): string {
  if (typeof window === "undefined") return "audio_none";
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return "audio_unsupported";
    return `audioLatency:sr=44100:proto=${typeof AudioCtx.prototype.createOscillator}`;
  } catch {
    return "audio_sync_default";
  }
}

/**
 * 1. Primary Deterministic Hardware Fingerprint String:
 * Combines screen.width x screen.height, screen.colorDepth,
 * navigator.hardwareConcurrency, WebGL unmasked renderer string, and timezone offset.
 */
export function getPrimaryHardwareFingerprintString(): string {
  const s =
    typeof window !== "undefined" && window.screen
      ? window.screen
      : ({} as Screen);
  const n = typeof navigator !== "undefined" ? (navigator as any) : {};

  const width = Number(s.width || 1920);
  const height = Number(s.height || 1080);
  const colorDepth = Number(s.colorDepth || 24);
  const hardwareConcurrency = Number(n.hardwareConcurrency || 4);
  const webglRenderer = getWebGLUnmaskedRenderer();

  let timezoneOffset = 0;
  try {
    timezoneOffset = new Date().getTimezoneOffset();
  } catch {}

  return [
    `res:${width}x${height}`,
    `depth:${colorDepth}`,
    `cores:${hardwareConcurrency}`,
    `webgl:${webglRenderer}`,
    `tzOffset:${timezoneOffset}`,
  ].join("|");
}

/**
 * Alias for getPrimaryHardwareFingerprintString to maintain legacy compatibility.
 */
export function getPureHardwareParameters(): string {
  return getPrimaryHardwareFingerprintString();
}

/**
 * 1. Secondary Deterministic Variant String:
 * Combines the primary fingerprint string with AudioContext rendering latency,
 * canvas 2D data hash, and navigator.deviceMemory.
 */
export function getSecondaryHardwareFingerprintString(
  audioLatencyMetric?: string
): string {
  const primaryString = getPrimaryHardwareFingerprintString();
  const n = typeof navigator !== "undefined" ? (navigator as any) : {};
  const deviceMemory = Number(n.deviceMemory || 8);
  const canvasHash = getCanvas2DDataHash();
  const audioLatency = audioLatencyMetric || getAudioContextLatencySync();

  return [
    `primary:[${primaryString}]`,
    `audioLatency:${audioLatency}`,
    `canvas2D:${canvasHash}`,
    `mem:${deviceMemory}`,
    `variant:secondary_deterministic`,
  ].join("|");
}

/**
 * Formats a SHA-256 byte array into standard TR-XXXXX format
 * (5 uppercase alphanumeric characters after "TR-").
 */
export function bytesToTRIdentifier(bytes: Uint8Array): string {
  const chars: string[] = [];
  for (let i = 0; i < 5; i++) {
    const val = ((bytes[i * 2] << 8) | bytes[i * 2 + 1]) % ALPHABET.length;
    chars.push(ALPHABET[val]);
  }
  return `TR-${chars.join("")}`;
}

/**
 * Synchronous hash fallback into standard TR-XXXXX format.
 */
export function syncHashToTRIdentifier(input: string): string {
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
  const base = BigInt(ALPHABET.length);

  for (let i = 0; i < 5; i++) {
    const idx = Number(combined % base);
    chars.push(ALPHABET[idx]);
    combined = combined / base;
  }

  return `TR-${chars.join("")}`;
}

export const hashToTRIdentifier = syncHashToTRIdentifier;

/**
 * Asynchronous SHA-256 hash fallback into standard TR-XXXXX format.
 */
export async function hashToTRFormatAsync(input: string): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const encoder = new TextEncoder();
      const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
      return bytesToTRIdentifier(new Uint8Array(digest));
    }
  } catch {}
  return syncHashToTRIdentifier(input);
}

/**
 * Generates the Primary Deterministic Hardware Fingerprint ID (TR-XXXXX).
 */
export function generatePrimaryHardwareFingerprint(): string {
  const payload = getPrimaryHardwareFingerprintString();
  return syncHashToTRIdentifier(payload);
}

export async function generatePrimaryHardwareFingerprintAsync(): Promise<string> {
  const payload = getPrimaryHardwareFingerprintString();
  return hashToTRFormatAsync(payload);
}

/**
 * Generates the Secondary Deterministic Variant ID (standard TR-XXXXX format without -1 or extra characters).
 */
export function generateSecondaryHardwareHashId(audioMetric?: string): string {
  const payload = getSecondaryHardwareFingerprintString(audioMetric);
  return syncHashToTRIdentifier(payload);
}

export async function generateSecondaryHardwareHashIdAsync(): Promise<string> {
  const audioMetric = await getAudioContextLatencyAsync();
  const payload = getSecondaryHardwareFingerprintString(audioMetric);
  return hashToTRFormatAsync(payload);
}

/**
 * Legacy aliases for backwards-compatibility
 */
export function generateHardwareHashId(): string {
  if (isMobileDevice()) {
    return getSynchronousMobileDeviceId();
  }
  return generatePrimaryHardwareFingerprint();
}

export async function generateHardwareHashIdAsync(): Promise<string> {
  if (isMobileDevice()) {
    return computeMobileHardwareDeviceId();
  }
  return generatePrimaryHardwareFingerprintAsync();
}

/**
 * 2. Wipe-Resistant Local ID Resolution:
 * - On app startup, check localStorage.getItem('phantom_device_id')
 * - If present, use the saved ID
 * - If missing (e.g. browser data wiped), recalculate the primary hardware fingerprint
 *   to recover the exact same TR-XXXXX ID automatically
 * - Save the recovered ID back to localStorage.setItem('phantom_device_id', deviceId)
 */
export function getPersistentDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return generatePrimaryHardwareFingerprint();
  }

  try {
    // 1. Check localStorage.getItem('phantom_device_id')
    let deviceId = localStorage.getItem(PHANTOM_DEVICE_ID_KEY);
    if (deviceId && deviceId.trim() && TR_ID_REGEX.test(deviceId.trim().toUpperCase())) {
      const cleanId = deviceId.trim().toUpperCase();
      // Mirror to legacy keys for seamless backwards compatibility
      localStorage.setItem("deviceId", cleanId);
      localStorage.setItem(LEGACY_STORAGE_KEY, cleanId);
      return cleanId;
    }

    // Check legacy storage keys before recalculation
    const legacyId =
      localStorage.getItem("deviceId") ||
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyId && legacyId.trim() && TR_ID_REGEX.test(legacyId.trim().toUpperCase())) {
      const cleanId = legacyId.trim().toUpperCase();
      localStorage.setItem(PHANTOM_DEVICE_ID_KEY, cleanId);
      localStorage.setItem("deviceId", cleanId);
      localStorage.setItem(LEGACY_STORAGE_KEY, cleanId);
      return cleanId;
    }

    // 2. If missing (e.g., browser data wiped), recalculate primary hardware fingerprint
    // to recover the exact same TR-XXXXX ID automatically.
    const recoveredId = generatePrimaryHardwareFingerprint().trim().toUpperCase();

    // 3. Save the recovered ID back to localStorage.setItem('phantom_device_id', deviceId)
    localStorage.setItem(PHANTOM_DEVICE_ID_KEY, recoveredId);
    localStorage.setItem("deviceId", recoveredId);
    localStorage.setItem(LEGACY_STORAGE_KEY, recoveredId);

    return recoveredId;
  } catch (err) {
    console.warn("Could not read/write phantom_device_id:", err);
    return generatePrimaryHardwareFingerprint();
  }
}

/**
 * Asynchronous wipe-resistant ID resolver using Web Crypto SHA-256 digest.
 */
export async function getPersistentDeviceIdAsync(): Promise<string> {
  if (typeof window === "undefined" || !window.localStorage) {
    return generatePrimaryHardwareFingerprintAsync();
  }

  try {
    let deviceId = localStorage.getItem(PHANTOM_DEVICE_ID_KEY);
    if (deviceId && deviceId.trim() && TR_ID_REGEX.test(deviceId.trim().toUpperCase())) {
      const cleanId = deviceId.trim().toUpperCase();
      localStorage.setItem("deviceId", cleanId);
      localStorage.setItem(LEGACY_STORAGE_KEY, cleanId);
      return cleanId;
    }

    const legacyId =
      localStorage.getItem("deviceId") ||
      localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyId && legacyId.trim() && TR_ID_REGEX.test(legacyId.trim().toUpperCase())) {
      const cleanId = legacyId.trim().toUpperCase();
      localStorage.setItem(PHANTOM_DEVICE_ID_KEY, cleanId);
      localStorage.setItem("deviceId", cleanId);
      localStorage.setItem(LEGACY_STORAGE_KEY, cleanId);
      return cleanId;
    }

    const recoveredId = (await generatePrimaryHardwareFingerprintAsync())
      .trim()
      .toUpperCase();

    localStorage.setItem(PHANTOM_DEVICE_ID_KEY, recoveredId);
    localStorage.setItem("deviceId", recoveredId);
    localStorage.setItem(LEGACY_STORAGE_KEY, recoveredId);

    return recoveredId;
  } catch {
    return generatePrimaryHardwareFingerprint();
  }
}

export const resolveWipeResistantDeviceId = getPersistentDeviceId;
export const resolveWipeResistantDeviceIdAsync = getPersistentDeviceIdAsync;

/**
 * Generates browser-engine agnostic TR-XXXXX device ID using pure hardware parameters.
 * Checks localStorage FIRST for 'phantom_device_id' to strictly prevent re-hashing on app updates.
 */
export async function generateAgnosticDeviceId(): Promise<string> {
  return getPersistentDeviceIdAsync();
}

/**
 * Synchronous version that returns locked device ID or recovers primary hardware fingerprint on wiped storage.
 */
export function getSynchronousDeviceId(): string {
  return getPersistentDeviceId();
}

/**
 * 3. Backend Collision Protocol:
 * When registering or checking a Device ID against the backend database,
 * if a collision occurs from an unrelated device session, switch to and persist the secondary TR-XXXXX hash variant.
 */
export async function syncDeviceWithCollisionProtocol(
  providedDeviceId?: string
): Promise<{
  deviceId: string;
  wasCollision: boolean;
  isSecondary: boolean;
}> {
  let activeId = providedDeviceId || getPersistentDeviceId();
  let wasCollision = false;
  let isSecondary = false;

  // Check if we previously had a collision flagged
  if (
    typeof window !== "undefined" &&
    window.localStorage &&
    localStorage.getItem(PHANTOM_COLLISION_KEY) === "true"
  ) {
    const savedSecondary = localStorage.getItem(PHANTOM_SECONDARY_ID_KEY);
    if (savedSecondary && TR_ID_REGEX.test(savedSecondary)) {
      activeId = savedSecondary;
      isSecondary = true;
    }
  }

  const primarySignature = getPrimaryHardwareFingerprintString();

  try {
    const response = await fetch("/api/device/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Device-DNA": activeId,
      },
      body: JSON.stringify({
        deviceId: activeId,
        fingerprint: activeId,
        hardwareSignature: primarySignature,
        isSecondary,
      }),
    });

    const data = await response.json().catch(() => null);

    // Collision instruction from backend
    if (
      response.status === 409 ||
      (data && (data.collision === true || data.status === "COLLISION_DETECTED" || data.instruction === "USE_SECONDARY_VARIANT"))
    ) {
      console.warn(
        `[COLLISION PROTOCOL] Unrelated device collision on ${activeId}. Switching to secondary TR-XXXXX variant...`
      );
      wasCollision = true;
      isSecondary = true;

      // Calculate secondary deterministic variant
      const secondaryId = (await generateSecondaryHardwareHashIdAsync())
        .trim()
        .toUpperCase();

      // Persist secondary variant into localStorage as active device ID
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(PHANTOM_DEVICE_ID_KEY, secondaryId);
        localStorage.setItem("deviceId", secondaryId);
        localStorage.setItem(LEGACY_STORAGE_KEY, secondaryId);
        localStorage.setItem(PHANTOM_SECONDARY_ID_KEY, secondaryId);
        localStorage.setItem(PHANTOM_COLLISION_KEY, "true");
      }

      // Re-register secondary variant with backend
      try {
        const secondaryAudioMetric = await getAudioContextLatencyAsync();
        const secondarySignature = getSecondaryHardwareFingerprintString(secondaryAudioMetric);
        await fetch("/api/device/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-DNA": secondaryId,
          },
          body: JSON.stringify({
            deviceId: secondaryId,
            fingerprint: secondaryId,
            hardwareSignature: secondarySignature,
            isSecondary: true,
          }),
        });
      } catch (err2) {
        console.warn("Secondary registration warning:", err2);
      }

      return {
        deviceId: secondaryId,
        wasCollision: true,
        isSecondary: true,
      };
    }

    if (data && data.deviceId && TR_ID_REGEX.test(data.deviceId)) {
      activeId = data.deviceId.toUpperCase();
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(PHANTOM_DEVICE_ID_KEY, activeId);
        localStorage.setItem("deviceId", activeId);
        localStorage.setItem(LEGACY_STORAGE_KEY, activeId);
      }
    }
  } catch (err) {
    console.warn("Device sync with collision protocol fallback:", err);
  }

  return {
    deviceId: activeId,
    wasCollision,
    isSecondary,
  };
}
