import React from "react";
import { createPortal } from "react-dom";
import { ArrowDownCircle, RefreshCw, X, ShieldCheck } from "lucide-react";
import { applyUpdate, deferUpdate } from "../utils/pwaUpdate";

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  isInActiveRoom?: boolean;
  latestVersion?: string;
}

export function UpdateModal({
  isOpen,
  onClose,
  isInActiveRoom = false,
  latestVersion = "2.4.0",
}: UpdateModalProps) {
  if (!isOpen) return null;

  const handleUpdateNow = () => {
    applyUpdate();
  };

  const handleLater = () => {
    deferUpdate();
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 font-mono animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleLater();
        }
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#0F121A] border border-cyan-500/50 rounded-2xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.25)] text-left space-y-4 my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <ArrowDownCircle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h3
                id="pwa-update-title"
                className="text-sm sm:text-base font-bold text-white uppercase tracking-wider"
              >
                Update Available
              </h3>
              <p className="text-[11px] text-cyan-400 font-semibold">
                Phantom Chat · Build {latestVersion}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLater}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close update notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed font-sans">
          <p>
            A new version of Phantom Chat is ready to install. Updating applies the latest performance improvements and security patches.
          </p>

          <div className="bg-[#141824] border border-slate-800 rounded-xl p-3 text-xs font-mono space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Data & Identity Preserved</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Your saved Device ID, Pro access, paired devices, and local preferences remain intact. No browser storage or keys are erased.
            </p>
          </div>

          {isInActiveRoom && (
            <p className="text-[11px] text-amber-400 font-mono bg-amber-950/40 border border-amber-500/30 p-2.5 rounded-lg">
              Notice: You are currently inside an active chat room. You can choose &ldquo;Later&rdquo; to stay in your room and update whenever you are ready.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleUpdateNow}
            className="w-full sm:flex-1 py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-xs rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Update now</span>
          </button>
          <button
            type="button"
            onClick={handleLater}
            className="w-full sm:w-auto py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-xs rounded-xl border border-slate-700 transition-colors cursor-pointer"
          >
            Later
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
