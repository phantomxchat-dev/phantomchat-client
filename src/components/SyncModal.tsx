import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ref, set } from "firebase/database";
import {
  Smartphone,
  Share2,
  Copy,
  Check,
  Clock,
  AlertCircle,
  X,
  Loader2,
  RefreshCw,
  Shield,
  ArrowRight,
  Radio,
  Monitor,
  Info,
  Lock,
  Unlink,
} from "lucide-react";
import { db } from "../utils/firebaseConfig";
import {
  consumePairingCode,
  saveLocalPairingCache,
  getOrInitDeviceId,
} from "../services/pairing";
import { isMobileDevice } from "../utils/deviceHash";
import { useSession, DEVICE_SYNC_EVENT } from "../context/SessionContext";

export interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: "host" | "joiner";
  onPairSuccess?: (syncedDeviceId: string) => void;
}

export type PairingModalProps = SyncModalProps;

export function SyncModal({
  isOpen,
  onClose,
  initialMode = "host",
  onPairSuccess,
}: SyncModalProps) {
  const {
    deviceId,
    setDeviceId,
    updateDeviceId,
    isDeviceIdLocked: contextLocked,
  } = useSession();

  // Synced identity tracking in local state
  const [isPermanentlySynced, setIsPermanentlySynced] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.localStorage) return false;
    return (
      localStorage.getItem("phantom_is_synced") === "true" ||
      Boolean(localStorage.getItem("phantom_synced_device_id"))
    );
  });

  const [syncedDeviceId, setSyncedDeviceId] = useState<string | null>(() => {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return (
      localStorage.getItem("phantom_synced_device_id") ||
      (localStorage.getItem("phantom_is_synced") === "true"
        ? localStorage.getItem("phantom_device_id")
        : null) ||
      null
    );
  });

  // Determine if device identity is currently locked
  const isLocked = isPermanentlySynced || Boolean(syncedDeviceId);

  // Mobile vs Desktop detection
  const isMobile = isMobileDevice();

  // Mode switcher: "host" or "joiner"
  const [mode, setMode] = useState<"host" | "joiner">(initialMode);

  // Host Mode states (optimistically initialized)
  const [pairingCode, setPairingCode] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<number>(
    () => Date.now() + 5 * 60 * 1000
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Joiner Mode state: single active 6-digit input array
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isConsuming, setIsConsuming] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState<boolean>(false);

  // References & Ref Guards
  const digitInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const timerIntervalRef = useRef<any>(null);
  const hasAutoSubmittedRef = useRef<string>("");
  const hasInitializedRef = useRef<boolean>(false);

  // Unlink / Change Host handler to reset locked state and reactivate PIN inputs
  const handleUnlink = useCallback(() => {
    // 1. Clear sync flags from localStorage
    if (typeof window !== "undefined" && window.localStorage) {
      try {
        localStorage.removeItem("phantom_synced_device_id");
        localStorage.removeItem("phantom_is_synced");
        localStorage.removeItem("isDeviceIdLocked");
      } catch (storageErr) {
        console.warn("Storage error while clearing sync flags:", storageErr);
      }
    }

    // 2. Reset local state so the 6-digit PIN input fields become active again
    setIsPermanentlySynced(false);
    setSyncedDeviceId(null);
    setDigits(["", "", "", "", "", ""]);
    setJoinError(null);
    setJoinSuccess(false);
    hasAutoSubmittedRef.current = "";

    // 3. Notify global listeners that the device identity lock is released
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(DEVICE_SYNC_EVENT, {
          detail: { isDeviceIdLocked: false },
        })
      );
    }

    // Auto-focus first PIN box after unlock
    setTimeout(() => {
      digitInputRefs.current[0]?.focus();
    }, 60);
  }, []);

  // Helper to issue and sync a 6-digit code optimistically
  const issueOptimisticCode = useCallback(() => {
    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const cleanCode = rawCode.replace(/\D/g, "");
    const now = Date.now();
    const targetExpiresAt = now + 5 * 60 * 1000;

    setPairingCode(cleanCode);
    setExpiresAt(targetExpiresAt);
    setRemainingSeconds(300);
    setCopiedCode(false);

    const hostDeviceId =
      (typeof window !== "undefined" &&
        window.localStorage &&
        (localStorage.getItem("phantom_device_id") ||
          localStorage.getItem("deviceId") ||
          localStorage.getItem("phantom_device_dna"))) ||
      deviceId ||
      getOrInitDeviceId() ||
      "TR-U9YSR";

    const payload = {
      hostDeviceId,
      createdAt: now,
      expiresAt: targetExpiresAt,
    };

    saveLocalPairingCache(cleanCode, payload);

    try {
      const codeRef = ref(db, `pairingCodes/${cleanCode}`);
      set(codeRef, payload).catch((err) => {
        console.error("Firebase background write failed:", err);
      });
    } catch (err) {
      console.error("Firebase background write failed:", err);
    }

    fetch("/api/pairing/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: cleanCode,
        ...payload,
      }),
    }).catch(() => {});
  }, [deviceId]);

  // Strictly run ONCE on component mount
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    const rawCode = Math.floor(100000 + Math.random() * 900000).toString();
    const cleanCode = rawCode.replace(/\D/g, "");
    const now = Date.now();
    const targetExpiresAt = now + 5 * 60 * 1000;

    setPairingCode(cleanCode);
    setExpiresAt(targetExpiresAt);
    setRemainingSeconds(300);

    const hostDeviceId =
      (typeof window !== "undefined" &&
        window.localStorage &&
        (localStorage.getItem("phantom_device_id") ||
          localStorage.getItem("deviceId") ||
          localStorage.getItem("phantom_device_dna"))) ||
      deviceId ||
      getOrInitDeviceId() ||
      "TR-U9YSR";

    const payload = {
      hostDeviceId,
      createdAt: now,
      expiresAt: targetExpiresAt,
    };

    saveLocalPairingCache(cleanCode, payload);

    try {
      const codeRef = ref(db, `pairingCodes/${cleanCode}`);
      set(codeRef, payload).catch((err) => {
        console.error("Firebase background write failed:", err);
      });
    } catch (err) {
      console.error("Firebase background write failed:", err);
    }

    fetch("/api/pairing/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: cleanCode,
        ...payload,
      }),
    }).catch(() => {});
  }, [deviceId]);

  // Sync mode and reload persistent sync flags when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setDigits(["", "", "", "", "", ""]);
      setJoinError(null);
      setJoinSuccess(false);
      hasAutoSubmittedRef.current = "";

      if (typeof window !== "undefined" && window.localStorage) {
        const isSynced =
          localStorage.getItem("phantom_is_synced") === "true" ||
          Boolean(localStorage.getItem("phantom_synced_device_id"));
        const hostId =
          localStorage.getItem("phantom_synced_device_id") ||
          (localStorage.getItem("phantom_is_synced") === "true"
            ? localStorage.getItem("phantom_device_id")
            : null);
        setIsPermanentlySynced(isSynced);
        setSyncedDeviceId(hostId);
      }
    }
  }, [isOpen, initialMode]);

  // Focus auto-capture on first digit box for Joiner Mode if not locked
  useEffect(() => {
    if (isOpen && mode === "joiner" && !isLocked) {
      const timer = setTimeout(() => {
        digitInputRefs.current[0]?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen, mode, isLocked]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Live 5-minute countdown timer; auto-close modal when timer expires
  useEffect(() => {
    if (!isOpen || mode !== "host" || !expiresAt) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        clearInterval(timerIntervalRef.current);
        onClose();
      }
    }, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isOpen, mode, expiresAt, onClose]);

  // Copy code helper
  const handleCopyCode = () => {
    if (!pairingCode) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pairingCode).then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      });
    }
  };

  // Format code display: "592 - 814"
  const formattedCode =
    pairingCode.length === 6
      ? `${pairingCode.slice(0, 3)} - ${pairingCode.slice(3)}`
      : pairingCode || "--- - ---";

  // Format countdown: mm:ss
  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  // =========================================================================
  // JOINER MODE: Auto-consume on 6 digits (Sync Browser Identity Only)
  // Strips all whitespace and dashes: code.replace(/\D/g, '')
  // Overwrites target browser's local state and triggers global state refresh
  // =========================================================================
  const joinedCode = digits.join("");

  const handleConsume = useCallback(
    async (rawCodeToConsume: string) => {
      // Guard against code consumption when device is permanently locked
      if (isLocked) return;

      const cleanCode = String(rawCodeToConsume || "").replace(/\D/g, "");
      if (cleanCode.length !== 6 || isConsuming) return;

      setIsConsuming(true);
      setJoinError(null);
      hasAutoSubmittedRef.current = cleanCode;

      try {
        const hostDeviceId = await consumePairingCode(
          cleanCode,
          (syncedId) => {
            updateDeviceId(syncedId);
          }
        );

        // When a valid 6-digit host code is entered, explicitly overwrite the target browser's local state:
        if (typeof window !== "undefined" && window.localStorage) {
          try {
            localStorage.setItem("phantom_device_id", hostDeviceId);
            localStorage.setItem("phantom_is_synced", "true");
            localStorage.setItem("phantom_synced_device_id", hostDeviceId);
            localStorage.setItem("deviceId", hostDeviceId);
            localStorage.setItem("phantom_device_dna", hostDeviceId);
            localStorage.setItem("isDeviceIdLocked", "true");
            localStorage.setItem("pairedAt", Date.now().toString());

            // Trigger a re-fetch of the Pro status from Firebase/Cloudflare KV to immediately reflect active Pro clearance
            window.dispatchEvent(
              new CustomEvent("phantom_pro_updated", {
                detail: { deviceId: hostDeviceId, isProRefresh: true },
              })
            );

            // Trigger a global state refresh so the active device ID updates across the UI without requiring a hard refresh
            window.dispatchEvent(
              new CustomEvent(DEVICE_SYNC_EVENT, {
                detail: { deviceId: hostDeviceId, isDeviceIdLocked: true },
              })
            );
            window.dispatchEvent(
              new CustomEvent("phantom_device_updated", {
                detail: { deviceId: hostDeviceId },
              })
            );
          } catch (storageErr) {
            console.warn("Storage write error during pairing:", storageErr);
          }
        }

        // Update local modal state to reflect active locked sync
        setIsPermanentlySynced(true);
        setSyncedDeviceId(hostDeviceId);

        // Instantly update the React SessionContext state
        if (setDeviceId) {
          setDeviceId(hostDeviceId);
        }
        if (updateDeviceId) {
          updateDeviceId(hostDeviceId);
        }

        if (onPairSuccess) {
          onPairSuccess(hostDeviceId);
        }

        // Show brief "Browser Synced Successfully!" checkmark and close modal
        setJoinSuccess(true);
        setTimeout(() => {
          onClose();
        }, 900);
      } catch (err) {
        console.error("Browser sync failed:", err);
        setJoinError(
          err instanceof Error
            ? err.message
            : "Invalid or non-existent pairing code. Please check and try again."
        );
        hasAutoSubmittedRef.current = "";
      } finally {
        setIsConsuming(false);
      }
    },
    [isLocked, isConsuming, updateDeviceId, setDeviceId, onPairSuccess, onClose]
  );

  // Handle typing into any of the 6 individual digit boxes
  const handleBoxChange = (index: number, rawValue: string) => {
    if (isLocked) return;
    const cleanDigits = rawValue.replace(/\D/g, "");
    setJoinError(null);

    if (!cleanDigits) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }

    if (cleanDigits.length > 1) {
      const next = [...digits];
      const startIdx = cleanDigits.length === 6 ? 0 : index;
      for (let i = 0; i < cleanDigits.length && startIdx + i < 6; i++) {
        next[startIdx + i] = cleanDigits[i];
      }
      setDigits(next);

      const focusIdx = Math.min(5, startIdx + cleanDigits.length);
      digitInputRefs.current[focusIdx]?.focus();

      const fullCode = next.join("");
      if (
        fullCode.length === 6 &&
        !next.includes("") &&
        hasAutoSubmittedRef.current !== fullCode
      ) {
        handleConsume(fullCode);
      }
      return;
    }

    const char = cleanDigits.slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (index < 5) {
      digitInputRefs.current[index + 1]?.focus();
    }

    const fullCode = next.join("");
    if (
      fullCode.length === 6 &&
      !next.includes("") &&
      hasAutoSubmittedRef.current !== fullCode
    ) {
      handleConsume(fullCode);
    }
  };

  // Handle Backspace and Arrow navigation across the 6 boxes
  const handleBoxKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (isLocked) return;
    if (e.key === "Backspace") {
      setJoinError(null);
      if (digits[index]) {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        digitInputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === "ArrowLeft" && index > 0) {
      digitInputRefs.current[index - 1]?.focus();
      e.preventDefault();
    } else if (e.key === "ArrowRight" && index < 5) {
      digitInputRefs.current[index + 1]?.focus();
      e.preventDefault();
    } else if (e.key === "Enter" && joinedCode.length === 6) {
      handleConsume(joinedCode);
    }
  };

  // Handle Paste directly into any of the 6 digit boxes
  const handleBoxPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (isLocked) return;
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text") || "";
    const cleanPasted = pastedText.replace(/\D/g, "").slice(0, 6);
    if (!cleanPasted) return;

    setJoinError(null);
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < 6; i++) {
      next[i] = cleanPasted[i] || "";
    }
    setDigits(next);

    const focusIdx = Math.min(5, cleanPasted.length);
    digitInputRefs.current[focusIdx]?.focus();

    if (cleanPasted.length === 6 && hasAutoSubmittedRef.current !== cleanPasted) {
      handleConsume(cleanPasted);
    }
  };

  if (!isOpen) return null;

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#0a0f1a] border border-cyan-500/40 rounded-2xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col space-y-5 text-left transform transition-all my-auto"
      >
        {/* Header Bar */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              {isMobile ? (
                <Smartphone className="w-5 h-5" />
              ) : (
                <Monitor className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2
                id="sync-modal-title"
                className="text-sm sm:text-base font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2"
              >
                <span>SYNC BROWSER</span>
              </h2>
              <p className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wide flex items-center gap-1.5">
                <span>6-DIGIT MANUAL OVERRIDE & SYNC</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Sync Browser Modal"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mobile Device Auto-Sync Notice Banner */}
        {isMobile && (
          <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-start gap-2.5 text-xs font-mono text-cyan-300">
            <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-cyan-200">Mobile Auto-Sync Active</span>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Fixed hardware parameters generate the exact same Device ID (<span className="text-cyan-300 font-mono font-bold">{deviceId}</span>)
                automatically across standard browsers on this phone. Use 6-digit Sync Browser below as a secondary manual override to link an isolated session or transfer identity between devices.
              </p>
            </div>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 p-1 bg-[#060a12] border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setMode("host");
              setJoinError(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "host"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Host Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("joiner");
            }}
            className={`py-2 px-3 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === "joiner"
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                : "text-slate-400 hover:text-white hover:bg-slate-800/50"
            }`}
          >
            {isLocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Radio className="w-3.5 h-3.5" />
            )}
            <span>Sync Browser</span>
            {isLocked && (
              <span className="text-[9px] bg-slate-900 text-cyan-300 px-1 py-0.5 rounded border border-cyan-500/30">
                LOCKED
              </span>
            )}
          </button>
        </div>

        {/* =============================================================== */}
        {/* HOST MODE VIEW                                                  */}
        {/* =============================================================== */}
        {mode === "host" && (
          <div className="space-y-4">
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Share this one-time 6-digit code with your other browser or device. Entering
              it will manually link and synchronize your Device ID.
            </p>

            {/* Prominent Code Card */}
            <div className="relative rounded-2xl bg-[#060911] border-2 border-cyan-500/50 p-5 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.15)] space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                ACTIVE 6-DIGIT CODE
              </span>

              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 select-all">
                  {formattedCode}
                </span>
                {pairingCode && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-2 rounded-lg bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/50 hover:text-white transition-all cursor-pointer active:scale-95"
                    title="Copy Sync Code"
                    aria-label="Copy Sync Code"
                  >
                    {copiedCode ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>

              {copiedCode && (
                <span className="text-[10px] font-mono text-emerald-400 font-semibold animate-pulse">
                  Copied to clipboard
                </span>
              )}
            </div>

            {/* Countdown Timer */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e1424] border border-slate-800 text-xs font-mono">
              <div className="flex items-center gap-2 text-slate-300">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>EXPIRES IN:</span>
                <span
                  className={`font-bold ${
                    remainingSeconds < 60
                      ? "text-rose-400 animate-pulse"
                      : "text-cyan-400"
                  }`}
                >
                  {formatTimer(remainingSeconds)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => issueOptimisticCode()}
                className="text-[11px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
                title="Regenerate Sync Code"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Code</span>
              </button>
            </div>

            {/* Host Identity Tag */}
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-400">Host Device ID:</span>
              <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                {deviceId}
                {isLocked && (
                  <span className="text-[9px] bg-cyan-950 text-cyan-400 border border-cyan-500/40 px-1.5 py-0.5 rounded font-bold">
                    PERMANENT
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* JOINER MODE VIEW (MANUAL 6-DIGIT PAIRING & UNLINK VIEW)          */}
        {/* =============================================================== */}
        {mode === "joiner" && (
          <div className="space-y-4">
            {/* Locked State: Renders when isPermanentlySynced or syncedDeviceId is present */}
            {isPermanentlySynced || syncedDeviceId ? (
              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/50 flex flex-col gap-3 text-xs font-mono text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                <div className="flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <span className="font-bold text-cyan-200">
                      Device Permanently Synced ({syncedDeviceId || deviceId})
                    </span>
                    <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                      This browser identity is currently synchronized and locked to the host device.
                      To pair with a different host or clear this link, click below.
                    </p>
                  </div>
                </div>

                {/* "Unlink / Change Host" Button in Locked View */}
                <button
                  type="button"
                  onClick={handleUnlink}
                  className="w-full py-2.5 px-3 rounded-lg font-mono font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-500/50 hover:border-rose-400 transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.3)] active:scale-[0.99]"
                  title="Unlink / Change Host"
                  aria-label="Unlink / Sync Different Device"
                >
                  <Unlink className="w-3.5 h-3.5 text-rose-400" />
                  <span>Unlink / Sync Different Device</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-300 font-sans leading-relaxed">
                Enter the 6-digit sync code displayed on your primary browser to
                adopt its Device ID as a manual override or cross-device transfer.
              </p>
            )}

            {/* COMPACT PRO CLEARANCE SYNC DISCLAIMER */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-start gap-2.5 shadow-[0_0_15px_rgba(245,158,11,0.15)] leading-relaxed">
              <span className="shrink-0 text-amber-400 font-bold select-none text-base">⚠️</span>
              <div className="space-y-1">
                <p className="text-[11px] font-sans leading-relaxed text-amber-200/90">
                  <strong className="font-semibold text-amber-300 font-mono">PRO NOTICE:</strong> Pro status is locked to your main Device ID. Sync your new browser with your Pro device code to keep your tier active across sessions.
                </p>
                <p className="text-[10px] font-sans leading-relaxed text-amber-300/80">
                  <strong className="font-semibold text-amber-300 font-mono">PRO CLEARANCE NOTICE:</strong> Your Pro status is cryptographically tied to your specific Device ID (TR-XXXXX). When opening Phantom Chat on a new browser or secondary device, always use Sync Browser to pair it with your Pro Device ID. Generating a new unlinked Device ID will not inherit your Pro clearance.
                </p>
              </div>
            </div>

            {/* Single 6-Box Digit Input Array */}
            <div className="space-y-2.5">
              <label
                htmlFor="sync-digit-0"
                className="block text-[11px] font-mono font-bold uppercase text-slate-300 tracking-wider text-center"
              >
                {isLocked ? "Identity Locked (Codes Disabled - Click Unlink to Edit)" : "Enter 6-Digit Code"}
              </label>

              <div className="flex justify-center gap-2 sm:gap-2.5 py-1">
                {digits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`sync-digit-${idx}`}
                    ref={(el) => {
                      digitInputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={idx === 0 ? "one-time-code" : "off"}
                    maxLength={6}
                    value={isLocked ? "" : digit}
                    onChange={(e) => handleBoxChange(idx, e.target.value)}
                    onKeyDown={(e) => handleBoxKeyDown(idx, e)}
                    onPaste={handleBoxPaste}
                    disabled={isLocked || isConsuming || joinSuccess}
                    aria-label={`Sync code digit ${idx + 1}`}
                    className={`w-11 h-13 sm:w-12 sm:h-14 rounded-xl border-2 text-center font-mono text-xl sm:text-2xl font-bold outline-none transition-all ${
                      isLocked
                        ? "border-slate-800 bg-[#060911]/60 text-slate-600 cursor-not-allowed opacity-50 select-none"
                        : digit
                        ? "border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                        : "border-slate-700 bg-[#060911] text-white focus:border-cyan-400 focus:bg-slate-900 focus:ring-2 focus:ring-cyan-500/30"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Loading / Status State */}
            {isConsuming && (
              <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/40 flex items-center gap-2.5 text-xs font-mono text-cyan-300">
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Searching Firebase & synchronizing browser identity...</span>
              </div>
            )}

            {/* Success State */}
            {joinSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-center gap-2.5 text-xs font-mono text-emerald-300 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Browser Synced Successfully!</span>
              </div>
            )}

            {/* Inline Error Message */}
            {joinError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 flex items-start gap-2 text-xs font-mono text-rose-300 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{joinError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDigits(["", "", "", "", "", ""]);
                      setJoinError(null);
                      digitInputRefs.current[0]?.focus();
                    }}
                    className="mt-1 text-[11px] text-cyan-400 underline hover:text-cyan-300 cursor-pointer"
                  >
                    Clear and try another code
                  </button>
                </div>
              </div>
            )}

            {/* Manual Submit Button or Unlink Action */}
            {isLocked ? (
              <button
                type="button"
                onClick={handleUnlink}
                className="w-full py-3 px-4 rounded-xl font-mono font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/50 transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.25)] active:scale-[0.99]"
                title="Unlink / Change Host"
              >
                <Unlink className="w-4 h-4 text-rose-400" />
                <span>Unlink / Change Host</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={joinedCode.length !== 6 || isConsuming || joinSuccess}
                onClick={() => handleConsume(joinedCode)}
                className={`w-full py-3 px-4 rounded-xl font-mono font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all ${
                  joinedCode.length === 6 && !isConsuming && !joinSuccess
                    ? "bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer active:scale-[0.99]"
                    : "bg-slate-800/80 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60"
                }`}
              >
                <span>SYNC BROWSER</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Security Zero-Log Footer */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-cyan-400" />
            <span>Zero-Knowledge Browser Sync</span>
          </div>
          <span>Auto-Destruct 5m</span>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalElement, document.body)
    : modalElement;
}

export const PairingModal = SyncModal;
export default SyncModal;
