import { generateAgnosticDeviceId, getSynchronousDeviceId, getPureHardwareParameters } from "./deviceId";

export interface HardwareMetrics {
  gpuVendor: string;
  gpuRenderer: string;
  webglParams: string;
  canvasSignature: string;
  screenDims: string;
  colorDepth: number;
  dpr: number;
  cpuCores: number;
  maxTouchPoints: number;
  timezone: string;
}

export interface HardwareFingerprintResult {
  deviceId: string; // Deterministic TR-XXXXX string
  fingerprint: string; // Deterministic TR-XXXXX string
  hardwareSignature: string;
  metrics: HardwareMetrics;
}

const STORAGE_KEY = "phantom_device_dna";
const TR_ID_REGEX = /^TR-[A-Z0-9]{5}$/;

/**
 * Collects all hardware metrics from the current device.
 */
export function collectHardwareMetrics(): HardwareMetrics {
  const s = typeof window !== "undefined" && window.screen ? window.screen : ({} as Screen);
  const n = typeof navigator !== "undefined" ? navigator : ({} as Navigator);

  const rawW = Number(s.width || 1920);
  const rawH = Number(s.height || 1080);
  const screenDims = `${rawW}x${rawH}`;
  const colorDepth = Number(s.colorDepth || 24);
  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio
      ? Math.round(window.devicePixelRatio * 100) / 100
      : 1;
  const cpuCores = Number(n.hardwareConcurrency || 4);
  const maxTouchPoints = Number(n.maxTouchPoints || 0);

  let timezone = "UTC";
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {}

  return {
    gpuVendor: "hardware",
    gpuRenderer: "hardware",
    webglParams: "hardware",
    canvasSignature: "hardware",
    screenDims,
    colorDepth,
    dpr,
    cpuCores,
    maxTouchPoints,
    timezone,
  };
}

/**
 * Deterministic hash converting pure hardware parameters into a clean `TR-XXXXX` identifier string.
 */
export function hashToTRIdentifier(input: string): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
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
  const base = BigInt(alphabet.length);

  for (let i = 0; i < 5; i++) {
    const idx = Number(combined % base);
    chars.push(alphabet[idx]);
    combined = combined / base;
  }

  return `TR-${chars.join("")}`;
}

/**
 * Synchronously generates and saves the browser-engine agnostic `TR-XXXXX` string in localStorage (`phantom_device_dna`).
 */
export function generateDeterministicTRId(): string {
  return getSynchronousDeviceId();
}

/**
 * Computes full browser-engine agnostic hardware fingerprint details using SHA-256 and saves `TR-XXXXX` in `localStorage` (`phantom_device_dna`).
 */
export async function getHardwareFingerprintDetails(): Promise<HardwareFingerprintResult> {
  const trDeviceId = await generateAgnosticDeviceId();
  const metrics = collectHardwareMetrics();
  const hardwareSignature = getPureHardwareParameters();

  return {
    deviceId: trDeviceId,
    fingerprint: trDeviceId,
    hardwareSignature,
    metrics,
  };
}

/**
 * Computes the browser-engine agnostic `TR-XXXXX` fingerprint string and saves it to `localStorage` (`phantom_device_dna`).
 */
export async function computeDeviceFingerprint(): Promise<string> {
  return generateAgnosticDeviceId();
}

/**
 * Returns the browser-engine agnostic cross-browser `TR-XXXXX` Device ID for the physical device.
 */
export async function getCrossBrowserDeviceId(): Promise<string> {
  return generateAgnosticDeviceId();
}
