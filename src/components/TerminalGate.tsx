import React, { useState } from "react";
import { Terminal, Clock, Users, ArrowRight, AlertCircle, RefreshCw, Crown, Shield, Copy, Check } from "lucide-react";
import { TurnstileWidget } from "./TurnstileWidget";

interface TerminalGateProps {
  nickname: string;
  setNickname: (val: string) => void;
  gender: "boy" | "girl";
  setGender: (val: "boy" | "girl") => void;
  timerSeconds: number;
  setTimerSeconds: (val: number) => void;
  roomType: "private" | "group";
  setRoomType: (val: "private" | "group") => void;
  isPro: boolean;
  isVip: boolean;
  setShowProWarningModal: (val: boolean) => void;
  turnstileToken: string;
  setTurnstileToken: (val: string) => void;
  turnstileResetSignal?: number;
  onResetTurnstile?: () => void;
  captchaError: string;
  setCaptchaError: (val: string) => void;
  isCreatingRoom: boolean;
  handleCreateRoom: () => void;
  inputRoomCode: string;
  setInputRoomCode: (val: string) => void;
  handleJoinRoom: () => void;
  linkRoomFull: boolean;
  linkRoomExpired: boolean;
  handleResetExpiredRoom: () => void;
  myDna: string;
  navigateTo: (route: any) => void;
}

// Step arrays for each clearance tier (Standard/free max is 2 minutes / 120 seconds)
const FREE_TIMER_STEPS = [5, 15, 30, 45, 60, 90, 120];
const VIP_TIMER_STEPS = [5, 15, 30, 45, 60, 120, 180, 240, 300, 600, 900, 1200, 1800, 2400, 3000, 3600];
const PRO_TIMER_STEPS = [
  5, 15, 30, 45, 60, 120, 180, 240, 300,
  600, 900, 1200, 1800, 2400, 3000, 3600,
  5400, 7200, 9000, 10800, 12600, 14400, 16200, 18000, 19800, 21600
];

export function TerminalGate({
  nickname,
  setNickname,
  gender,
  setGender,
  timerSeconds,
  setTimerSeconds,
  roomType,
  setRoomType,
  isPro,
  isVip,
  setShowProWarningModal,
  turnstileToken,
  setTurnstileToken,
  turnstileResetSignal,
  onResetTurnstile,
  captchaError,
  setCaptchaError,
  isCreatingRoom,
  handleCreateRoom,
  inputRoomCode,
  setInputRoomCode,
  handleJoinRoom,
  linkRoomFull,
  linkRoomExpired,
  handleResetExpiredRoom,
  myDna,
  navigateTo,
}: TerminalGateProps) {
  const [copiedDna, setCopiedDna] = useState(false);
  const [dnaToast, setDnaToast] = useState(false);

  const handleCopyDna = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!myDna) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(myDna);
      } else {
        const ta = document.createElement("textarea");
        ta.value = myDna;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedDna(true);
      setDnaToast(true);
      setTimeout(() => setCopiedDna(false), 2000);
      setTimeout(() => setDnaToast(false), 2500);
    } catch {
      setCopiedDna(true);
      setDnaToast(true);
      setTimeout(() => setCopiedDna(false), 2000);
      setTimeout(() => setDnaToast(false), 2500);
    }
  };
  // Format timer display
  const formatTimerLabel = (seconds: number) => {
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      const remainingMinutes = Math.round((seconds % 3600) / 60);
      return `${hours} hour${hours > 1 ? "s" : ""}${remainingMinutes > 0 ? ` ${remainingMinutes} min` : ""}`;
    }
    if (seconds >= 60) {
      const minutes = Math.round(seconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""}`;
    }
    return `${seconds} seconds`;
  };

  const currentSteps = isPro ? PRO_TIMER_STEPS : isVip ? VIP_TIMER_STEPS : FREE_TIMER_STEPS;
  
  const getStepIndex = (val: number, steps: number[]) => {
    let closest = 0;
    let minDiff = Math.abs(val - steps[0]);
    for (let i = 1; i < steps.length; i++) {
      const diff = Math.abs(val - steps[i]);
      if (diff < minDiff) {
        minDiff = diff;
        closest = i;
      }
    }
    return closest;
  };

  const currentStepIdx = getStepIndex(timerSeconds, currentSteps);

  const presets = isPro
    ? [
        { label: "5m", seconds: 300 },
        { label: "30m", seconds: 1800 },
        { label: "1h", seconds: 3600 },
        { label: "3h", seconds: 10800 },
        { label: "6h Max", seconds: 21600 },
      ]
    : isVip
    ? [
        { label: "1m", seconds: 60 },
        { label: "5m", seconds: 300 },
        { label: "15m", seconds: 900 },
        { label: "30m", seconds: 1800 },
        { label: "1h Max", seconds: 3600 },
      ]
    : [
        { label: "15s", seconds: 15 },
        { label: "30s", seconds: 30 },
        { label: "1m", seconds: 60 },
        { label: "2m Max", seconds: 120 },
      ];

  // Handle room expired or full error states
  if (linkRoomFull) {
    return (
      <div className="w-full max-w-xl mx-auto p-6 sm:p-8">
        <div className="rounded-xl border border-rose-800/80 glass-card p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-rose-950/50 border border-rose-800 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-rose-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Room full</h2>
            <p className="text-xs text-slate-400">
              Only 2 people can join a 1-on-1 room. A third person cannot join.
            </p>
          </div>
          <button
            onClick={handleResetExpiredRoom}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Return to Terminal
          </button>
        </div>
      </div>
    );
  }

  if (linkRoomExpired) {
    return (
      <div className="w-full max-w-xl mx-auto p-6 sm:p-8">
        <div className="rounded-xl border border-slate-800 glass-card p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center">
            <Clock className="w-6 h-6 text-cyan-400" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white">Room expired or closed</h2>
            <p className="text-xs text-slate-400">
              The requested chat room reached its duration limit and has self-destructed. Active memory was cleared.
            </p>
          </div>
          <button
            onClick={handleResetExpiredRoom}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Return to Terminal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 font-sans">
      
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <button
          type="button"
          onClick={handleCopyDna}
          title="Click to copy Device ID"
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 text-xs font-mono text-slate-400 mb-2 cursor-pointer transition-all active:scale-95 group"
        >
          <span>Device ID:</span>
          <span className="text-cyan-400 font-semibold">{myDna}</span>
          {copiedDna ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-500/40 px-1.5 py-0.2 rounded animate-pulse">
              <Check className="w-2.5 h-2.5 text-emerald-400" />
              <span>COPIED</span>
            </span>
          ) : (
            <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
          )}
          {isPro && <span className="text-cyan-400 font-bold">· PRO</span>}
          {isVip && !isPro && <span className="text-pink-400 font-bold">· VIP</span>}
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Terminal Setup
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
          Configure a temporary chat room or join an existing room with a 6-digit code.
        </p>
      </div>

      {/* Main Guided Form: Launch New Room */}
      <div className="rounded-xl border border-slate-800/90 glass-card p-6 sm:p-8 space-y-8 shadow-2xl">
        <div className="border-b border-slate-800 pb-4">
          <h2 className="text-base font-semibold text-white">
            Create a New Room
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Follow the guided steps below to start an ephemeral session.
          </p>
        </div>

        {/* STEP 1: Alias & Profile */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="operative-alias-input" className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Step 1: Choose an alias
            </label>
            <span className="text-[11px] text-slate-500 font-mono">Max 12 chars</span>
          </div>

          <div className="relative">
            <input
              id="operative-alias-input"
              type="text"
              maxLength={12}
              placeholder="e.g. shadow_42"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              className="w-full glass-input border border-slate-700/80 focus:border-cyan-400 rounded-lg px-4 py-3 text-sm text-slate-100 placeholder-slate-500 font-mono outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Letters, numbers, and dashes only. Visible to your chat peer during this room session.
          </p>

          {/* Avatar badge selector */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setGender("boy")}
              className={`py-2.5 px-4 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                gender === "boy"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm"
                  : "bg-[#141824] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span className="text-sm">👦</span>
              <span>Boy Avatar</span>
            </button>
            <button
              type="button"
              onClick={() => setGender("girl")}
              className={`py-2.5 px-4 rounded-lg border text-xs font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                gender === "girl"
                  ? "bg-pink-950/40 border-pink-500 text-pink-200 shadow-sm"
                  : "bg-[#141824] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span className="text-sm">👩</span>
              <span>Girl Avatar</span>
            </button>
          </div>
        </div>

        {/* STEP 2: Human Verification */}
        <div className="space-y-3 border-t border-slate-800/80 pt-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Step 2: Security verification
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Anti-bot</span>
          </div>

          <div className="glass-input border border-slate-800 rounded-lg p-4">
            <TurnstileWidget
              token={turnstileToken}
              resetSignal={turnstileResetSignal}
              onVerify={(token) => {
                setTurnstileToken(token);
                setCaptchaError("");
              }}
              onError={(err) => {
                setTurnstileToken("");
                setCaptchaError(err || "Verification encountered an issue. Please click retry.");
                if (onResetTurnstile) onResetTurnstile();
              }}
              onExpire={() => {
                setTurnstileToken("");
                setCaptchaError("Verification expired. Please re-verify.");
                if (onResetTurnstile) onResetTurnstile();
              }}
            />
          </div>

          {captchaError && !(turnstileToken && captchaError.includes("Turnstile")) && (
            <p className="text-xs text-rose-400 flex items-center gap-1.5" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{captchaError}</span>
            </p>
          )}
        </div>

        {/* STEP 3: Retention Window (Self-Destruct Timer) */}
        <div className="space-y-3 border-t border-slate-800/80 pt-6">
          <div className="flex items-center justify-between">
            <label htmlFor="retention-timer-slider" className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono">
              Step 3: Room lifespan
            </label>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {formatTimerLabel(timerSeconds)}
            </span>
          </div>

          <input
            id="retention-timer-slider"
            type="range"
            min={0}
            max={currentSteps.length - 1}
            step={1}
            value={currentStepIdx}
            onChange={(e) => {
              const idx = parseInt(e.target.value, 10);
              const targetVal = currentSteps[idx] !== undefined ? currentSteps[idx] : 120;
              setTimerSeconds(targetVal);
            }}
            className="cyber-range w-full cursor-pointer"
          />

          {/* Quick Presets for 1-click selection */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase mr-1">Presets:</span>
            {presets.map((p) => {
              const isSelected = timerSeconds === p.seconds;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setTimerSeconds(p.seconds)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-500 text-slate-950 shadow-sm font-bold"
                      : "bg-[#141824] text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800/80"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
            <span>Minimum: 5 seconds</span>
            <span className={isPro ? "text-cyan-300 font-semibold" : ""}>
              {isPro ? "Pro limit: 6 hours (Max)" : isVip ? "VIP limit: 1 hour" : "Standard limit: 2 minutes"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            When the timer hits 00:00, the room shuts down and all message references are purged automatically.
          </p>
        </div>

        {/* STEP 4: Room Format */}
        <div className="space-y-3 border-t border-slate-800/80 pt-6">
          <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono block">
            Step 4: Room format
          </span>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRoomType("private")}
              className={`p-3 rounded-lg border text-xs font-medium text-left transition-all cursor-pointer ${
                roomType === "private"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-100 shadow-sm"
                  : "bg-[#141824] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <div className="font-semibold text-slate-200">1-on-1 Direct Chat</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Strict 2-person private channel</div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isPro) {
                  setShowProWarningModal(true);
                } else {
                  setRoomType("group");
                }
              }}
              className={`p-3 rounded-lg border text-xs font-medium text-left transition-all cursor-pointer relative ${
                roomType === "group"
                  ? "bg-pink-950/40 border-pink-500 text-pink-100 shadow-sm"
                  : "bg-[#141824] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">Group Room</span>
                {!isPro && <Crown className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Infinite participants (Requires Pro)</div>
            </button>
          </div>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2">
          <button
            onClick={handleCreateRoom}
            disabled={isCreatingRoom || !turnstileToken || !turnstileToken.trim()}
            className="w-full py-3.5 px-6 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {isCreatingRoom ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                <span>Initializing Room...</span>
              </>
            ) : !turnstileToken || !turnstileToken.trim() ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950 opacity-70" />
                <span>Waiting for Security Verification...</span>
              </>
            ) : (
              <>
                <span>Launch Temporary Room</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* PART 2: Distinct Join Room Card */}
      <div className="rounded-xl border border-slate-800/90 glass-card p-6 sm:p-8 space-y-4 shadow-2xl">
        <div>
          <h2 className="text-base font-semibold text-white">
            Join an Existing Room
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Enter the 6-digit room code shared with you by another operator.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <input
            type="text"
            maxLength={6}
            placeholder="e.g. 123456"
            value={inputRoomCode}
            onChange={(e) => setInputRoomCode(e.target.value.replace(/[^0-9]/g, ""))}
            aria-label="6-digit room code"
            className="flex-1 glass-input border border-slate-700/80 focus:border-cyan-400 rounded-lg px-4 py-3 text-center text-base font-mono tracking-widest text-slate-100 placeholder-slate-500 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          />
          <button
            onClick={handleJoinRoom}
            className="py-3 px-6 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            Connect to Room
          </button>
        </div>

        {captchaError && (
          <p className="text-xs text-rose-400 flex items-center gap-1.5 pt-1" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{captchaError}</span>
          </p>
        )}
      </div>

      {/* Trust & Safe Practice Disclosure */}
      <div className="text-center text-xs text-slate-500 space-y-1">
        <p>No account logs · Transient memory · Automatic expiration</p>
        <p>
          Need assistance or want to learn how it works?{" "}
          <button
            onClick={() => navigateTo("faq")}
            className="text-slate-400 hover:text-cyan-400 underline underline-offset-2 transition-colors cursor-pointer"
          >
            Read the FAQ
          </button>
        </p>
      </div>

      {/* Centered Device ID Copied Toast */}
      {dnaToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900 border border-cyan-500/60 text-cyan-300 text-xs font-mono font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 animate-in fade-in select-none">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Device ID copied to clipboard!</span>
        </div>
      )}

    </div>
  );
}
