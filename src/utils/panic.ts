// Panic Mode / Decoy System Utility

export const DECOY_SESSION_KEY = "phantom_decoy_active";
// This code is bundled into client builds and must never be treated as a secret.
export const UNLOCK_SECRET_CODE = import.meta.env.VITE_DECOY_UNLOCK_CODE || "";

export interface PanicOptions {
  onClearKeys?: () => void;
  onCloseConnections?: () => void;
  onSetDecoyActive?: (active: boolean) => void;
}

/**
 * Triggers Panic / Decoy Mode while strictly preserving the persistent device code (myDna/TR-XXXXX) in localStorage.
 */
export function triggerDecoyMode(options?: PanicOptions): void {
  // 1. Unmount active listeners and close WebRTC peer connections
  try {
    options?.onCloseConnections?.();
  } catch (err) {
    console.warn("[Panic System] Error closing active connections:", err);
  }

  // 2. Clear in-memory room keys (CryptoKey)
  try {
    options?.onClearKeys?.();
  } catch (err) {
    console.warn("[Panic System] Error clearing room keys:", err);
  }

  // 3. Mark decoy active in sessionStorage so page reload stays in decoy calculator mode
  try {
    sessionStorage.setItem(DECOY_SESSION_KEY, "true");
  } catch (e) {}

  // 4. Trigger state update
  options?.onSetDecoyActive?.(true);
}

/**
 * Unlocks Decoy Mode and restores regular application flow using preserved device code
 */
export function exitDecoyMode(options?: PanicOptions): void {
  try {
    sessionStorage.removeItem(DECOY_SESSION_KEY);
  } catch (e) {}

  options?.onSetDecoyActive?.(false);
}

/**
 * Checks if decoy mode was previously active in session
 */
export function isDecoyModeActiveSession(): boolean {
  try {
    return sessionStorage.getItem(DECOY_SESSION_KEY) === "true";
  } catch (e) {
    return false;
  }
}
