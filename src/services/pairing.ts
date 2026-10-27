import { ref, set, get, remove } from "firebase/database";
import { db } from "../utils/firebaseConfig";
import { getPersistentDeviceId } from "../utils/deviceId";
import {
  isMobileDevice,
  getSynchronousMobileDeviceId,
} from "../utils/deviceHash";

export interface PairingCodePayload {
  hostDeviceId: string;
  createdAt: number;
  expiresAt: number;
}

export interface GeneratePairingResult {
  code: string;
  expiresAt: number;
  hostDeviceId: string;
}

const LOCAL_PAIRING_CACHE_KEY = "phantom_pairing_codes_cache";
const memoryPairingCache = new Map<string, PairingCodePayload>();

export function saveLocalPairingCache(
  rawCode: string,
  payload: PairingCodePayload
): void {
  const cleanCode = String(rawCode || "").replace(/\D/g, "");
  if (cleanCode.length !== 6) return;

  memoryPairingCache.set(cleanCode, payload);
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const raw = localStorage.getItem(LOCAL_PAIRING_CACHE_KEY);
    const parsed: Record<string, PairingCodePayload> = raw
      ? JSON.parse(raw)
      : {};
    const now = Date.now();
    for (const k of Object.keys(parsed)) {
      if (parsed[k] && parsed[k].expiresAt <= now) {
        delete parsed[k];
      }
    }
    parsed[cleanCode] = payload;
    localStorage.setItem(LOCAL_PAIRING_CACHE_KEY, JSON.stringify(parsed));
  } catch {}
}

function getAndRemoveLocalPairingCache(
  rawCode: string
): PairingCodePayload | null {
  const cleanCode = String(rawCode || "").replace(/\D/g, "");
  const mem = memoryPairingCache.get(cleanCode);
  if (mem) {
    memoryPairingCache.delete(cleanCode);
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = localStorage.getItem(LOCAL_PAIRING_CACHE_KEY);
      if (raw) {
        const parsed: Record<string, PairingCodePayload> = JSON.parse(raw);
        const found = parsed[cleanCode];
        if (found) {
          delete parsed[cleanCode];
          localStorage.setItem(LOCAL_PAIRING_CACHE_KEY, JSON.stringify(parsed));
          return found;
        }
      }
    } catch {}
  }
  return mem || null;
}

/**
 * Checks whether the current browser's Device ID has been permanently locked via Sync Browser.
 */
export function isDeviceIdPermanentlyLocked(): boolean {
  if (typeof window === "undefined" || !window.localStorage) {
    return false;
  }
  try {
    return (
      localStorage.getItem("phantom_is_synced") === "true" ||
      Boolean(localStorage.getItem("phantom_synced_device_id")) ||
      localStorage.getItem("isDeviceIdLocked") === "true"
    );
  } catch {
    return false;
  }
}


/**
 * Returns the active device ID from localStorage, or initializes a deterministic TR-XXXXX ID.
 * If isDeviceIdLocked is "true", strictly returns the locked deviceId without ever regenerating or overwriting it.
 */
export function getOrInitDeviceId(): string {
  return getPersistentDeviceId();
}

/**
 * Generates a random 6-digit code string synchronously in memory
 * and stores { hostDeviceId, createdAt, expiresAt } under /pairingCodes/{code} in Firebase Realtime Database.
 */
export function generatePairingCode(
  providedCode?: string
): GeneratePairingResult {
  const rawCode =
    providedCode || Math.floor(100000 + Math.random() * 900000).toString();
  // Storage Path: strictly numeric /pairingCodes/162577 stripped of whitespace & dashes
  const cleanCode = String(rawCode || "").replace(/\D/g, "");

  const hostDeviceId =
    (typeof window !== "undefined" &&
      window.localStorage &&
      (localStorage.getItem("phantom_device_id") ||
        localStorage.getItem("deviceId") ||
        localStorage.getItem("phantom_device_dna"))) ||
    getOrInitDeviceId() ||
    "TR-U9YSR";
  const createdAt = Date.now();
  const expiresAt = createdAt + 5 * 60 * 1000;

  const payload: PairingCodePayload = {
    hostDeviceId,
    createdAt,
    expiresAt,
  };

  // Cache locally in memory / localStorage
  saveLocalPairingCache(cleanCode, payload);

  // Non-blocking background sync to Firebase Realtime DB
  try {
    const codeRef = ref(db, `pairingCodes/${cleanCode}`);
    set(codeRef, {
      hostDeviceId,
      createdAt,
      expiresAt,
    }).catch((err) => {
      console.error("Firebase background write failed:", err);
    });
  } catch (err) {
    console.error("Firebase background write failed:", err);
  }

  // Non-blocking background sync to server / Cloudflare KV+D1 relay for cross-browser reliability
  if (typeof fetch !== "undefined") {
    fetch("/api/pairing/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: cleanCode,
        hostDeviceId,
        createdAt,
        expiresAt,
      }),
    }).catch((err) => {
      console.warn("Server pairing relay sync warning:", err);
    });
  }

  return {
    code: cleanCode,
    expiresAt,
    hostDeviceId,
  };
}

/**
 * Consumes a 6-digit pairing code from Firebase Realtime Database:
 * 1. Strictly sanitizes 6-digit input (stripped of whitespace/dashes: code.replace(/\D/g, ''))
 * 2. Queries /pairingCodes/{cleanCode} in Firebase Realtime Database
 * 3. Logs trace in DevTools: console.log("Searching Firebase for code:", cleanCode)
 * 4. Throws error if code is expired or invalid
 * 5. Deletes the consumed code immediately from Firebase to prevent replay attacks
 * 6. Overwrites localStorage 'deviceId', 'phantom_device_dna', sets 'isDeviceIdLocked', and sets 'pairedAt'
 * 7. Triggers optional onDeviceSynced(hostDeviceId) callback and returns hostDeviceId (NO room navigation)
 */
export async function consumePairingCode(
  rawCode: string,
  onDeviceSynced?: (hostDeviceId: string) => void
): Promise<string> {
  // Prevent entering additional pairing codes if device is permanently locked
  if (isDeviceIdPermanentlyLocked()) {
    const lockedId = getOrInitDeviceId();
    throw new Error(
      `Device Permanently Synced (${lockedId}). Additional pairing codes are locked out.`
    );
  }

  // Storage Path: strictly numeric /pairingCodes/162577 (whitespace/dashes stripped)
  const cleanCode = String(rawCode || "").replace(/\D/g, "");
  console.log("Searching Firebase for code:", cleanCode);

  if (cleanCode.length !== 6) {
    throw new Error("Pairing code must be exactly 6 digits.");
  }

  const codeRef = ref(db, `pairingCodes/${cleanCode}`);
  let data: PairingCodePayload | null = null;

  // Query Firebase Realtime Database with robust timeout
  try {
    const snapshot = await Promise.race([
      get(codeRef),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (snapshot && snapshot.exists()) {
      console.log(
        "Firebase snapshot found for code:",
        cleanCode,
        snapshot.val()
      );
      data = snapshot.val() as PairingCodePayload;
    } else {
      console.log(
        "No Firebase RTDB snapshot at path pairingCodes/" +
          cleanCode +
          ", checking cross-browser relay..."
      );
    }
  } catch (err) {
    console.warn("Firebase read fallback triggered:", err);
  }

  // Always check cross-browser server/Cloudflare relay if Firebase didn't return data
  if (!data && typeof fetch !== "undefined") {
    try {
      const res = await fetch("/api/pairing/consume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleanCode }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.hostDeviceId) {
          console.log(
            "Cross-browser relay matched pairing code:",
            cleanCode,
            json
          );
          data = json as PairingCodePayload;
        }
      }
    } catch (relayErr) {
      console.warn("Relay lookup failed:", relayErr);
    }
  } else if (data && typeof fetch !== "undefined") {
    // Also consume from server relay in background so it cannot be replayed
    fetch("/api/pairing/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: cleanCode }),
    }).catch(() => {});
  }

  if (!data) {
    data = getAndRemoveLocalPairingCache(cleanCode);
  } else {
    getAndRemoveLocalPairingCache(cleanCode);
  }

  if (!data) {
    throw new Error(
      "Invalid or non-existent pairing code. Please check and try again."
    );
  }

  if (!data.hostDeviceId) {
    throw new Error(
      "Malformed pairing session record. Please request a new code."
    );
  }

  const now = Date.now();
  if (data.expiresAt && now > data.expiresAt) {
    remove(codeRef).catch(() => {});
    throw new Error(
      "This pairing code has expired (5-minute window passed). Please request a new code."
    );
  }

  // 1. Delete code immediately in background to prevent replay attacks
  remove(codeRef).catch((delErr) => {
    console.warn("Could not delete pairing code after retrieval:", delErr);
  });

  // 2. OVERWRITE local deviceId to adopt host identity and lock it (NO room navigation)
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem("phantom_device_id", data.hostDeviceId);
      localStorage.setItem("phantom_is_synced", "true");
      localStorage.setItem("phantom_synced_device_id", data.hostDeviceId);
      localStorage.setItem("deviceId", data.hostDeviceId);
      localStorage.setItem("isDeviceIdLocked", "true");
      localStorage.setItem("phantom_device_dna", data.hostDeviceId);
      localStorage.setItem("pairedAt", Date.now().toString());

      // Trigger a re-fetch of the Pro status from Firebase/Cloudflare KV to immediately reflect active Pro clearance
      window.dispatchEvent(
        new CustomEvent("phantom_pro_updated", {
          detail: { deviceId: data.hostDeviceId, isProRefresh: true },
        })
      );

      // Trigger a global state refresh so the active device ID updates across the UI without requiring a hard refresh
      window.dispatchEvent(
        new CustomEvent("phantom_device_synced", {
          detail: { deviceId: data.hostDeviceId, isDeviceIdLocked: true },
        })
      );
      window.dispatchEvent(
        new CustomEvent("phantom_device_updated", {
          detail: { deviceId: data.hostDeviceId },
        })
      );
    } catch (storageErr) {
      console.warn(
        "Could not write synced deviceId to localStorage:",
        storageErr
      );
    }
  }

  // 3. Trigger optional onDeviceSynced callback (identity update only)
  if (typeof onDeviceSynced === "function") {
    try {
      onDeviceSynced(data.hostDeviceId);
    } catch (cbErr) {
      console.error("Error executing onDeviceSynced callback:", cbErr);
    }
  }

  return data.hostDeviceId;
}

/**
 * Cancels/removes an active pairing code when explicitly requested.
 */
export function cancelPairingCode(rawCode: string): void {
  const cleanCode = String(rawCode || "").replace(/\D/g, "");
  if (cleanCode.length === 6) {
    getAndRemoveLocalPairingCache(cleanCode);
    try {
      const codeRef = ref(db, `pairingCodes/${cleanCode}`);
      remove(codeRef).catch(() => {});
    } catch {}
  }
}
