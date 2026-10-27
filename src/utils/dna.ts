import {
  getCrossBrowserDeviceId,
  generateDeterministicTRId,
} from "./deviceFingerprint";

// Helper utility for generating a hybrid hardware fingerprint (Device DNA)
export async function getDeviceDNA(): Promise<string> {
  return getCrossBrowserDeviceId();
}

// Synchronous helper for stored DNA string lookup
export function getStoredDeviceDNA(): string {
  return generateDeterministicTRId();
}
