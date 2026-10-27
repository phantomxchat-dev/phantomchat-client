import React, { useState, useEffect } from "react";
import { Maximize2, Shield, Eye, Lock, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { extractTextFromImage } from "../utils/steganography";

interface MediaMessageProps {
  id: string;
  mediaUrl: string;
  isRevealed: boolean;
  isNearDecay?: boolean;
  onToggleReveal: (id: string) => void;
  onOpenLightbox?: (url: string) => void;
  onImageLoad?: () => void;
}

export function MediaMessage({
  id,
  mediaUrl,
  isRevealed,
  isNearDecay = false,
  onToggleReveal,
  onOpenLightbox,
  onImageLoad,
}: MediaMessageProps) {
  const showRevealed = isRevealed && !isNearDecay;
  const [stegoPayload, setStegoPayload] = useState<string | null>(null);
  const [showStegoContent, setShowStegoContent] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (mediaUrl) {
      extractTextFromImage(mediaUrl).then((extracted) => {
        if (isMounted && extracted) {
          setStegoPayload(extracted);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [mediaUrl]);

  const handleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".stego-toggle-btn")) return;
    if (isNearDecay) return;
    if (!showRevealed) {
      onToggleReveal(id);
    } else if (onOpenLightbox) {
      onOpenLightbox(mediaUrl);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="relative max-w-[300px] sm:max-w-[380px] md:max-w-[420px] w-full rounded-xl overflow-hidden border border-cyan-500/30 bg-slate-900/90 p-1 cursor-pointer shadow-lg group select-none my-1 shrink-0 flex-shrink-0"
    >
      {/* Base Image with dynamic aspect ratio scaling & object-contain */}
      <img
        src={mediaUrl}
        alt="Secure Media Attachment"
        onLoad={onImageLoad}
        className={`w-full h-auto max-h-[380px] sm:max-h-[460px] object-contain block rounded-lg transition-all duration-500 ${
          showRevealed
            ? "opacity-95 group-hover:opacity-100 scale-100"
            : "blur-xl scale-105 pointer-events-none opacity-60"
        }`}
        draggable={false}
      />

      {/* Self-Destruct / Secure Media Badge Overlay */}
      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-black/80 border border-cyan-500/40 text-[9px] font-mono text-cyan-300 font-semibold backdrop-blur-md flex items-center gap-1 shadow-sm">
        <Shield className="w-2.5 h-2.5 text-cyan-400" />
        <span>SECURE MEDIA</span>
      </div>

      {/* STEGO PAYLOAD DETECTED BADGE Overlay */}
      {stegoPayload && (
        <div className="absolute top-2 right-2 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowStegoContent((prev) => !prev);
            }}
            className="stego-toggle-btn px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/80 text-[9px] font-mono text-emerald-300 font-bold backdrop-blur-md flex items-center gap-1 hover:bg-emerald-900 transition-all shadow-[0_0_10px_rgba(16,185,129,0.4)] animate-pulse"
          >
            <Lock className="w-2.5 h-2.5 text-emerald-400" />
            <span>[STEGO PAYLOAD DETECTED]</span>
            {showStegoContent ? (
              <ChevronUp className="w-2.5 h-2.5" />
            ) : (
              <ChevronDown className="w-2.5 h-2.5" />
            )}
          </button>
        </div>
      )}

      {/* STEGO HIDDEN PAYLOAD DRAWER / CONTENT */}
      {stegoPayload && showStegoContent && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="p-3 bg-[#080d16]/95 border-t border-emerald-500/50 font-mono text-xs text-emerald-300 space-y-1 animate-in slide-in-from-top-2 rounded-b-xl"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            <FileText className="w-3 h-3 text-emerald-400" />
            <span>HIDDEN STEGO CONTENT:</span>
          </div>
          <p className="bg-emerald-950/40 p-2 rounded border border-emerald-900/60 text-[11px] text-emerald-200 break-words select-text">
            {stegoPayload}
          </p>
        </div>
      )}

      {/* TAP TO REVEAL overlay when hidden */}
      {!showRevealed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-10 p-3 text-center transition-opacity rounded-xl">
          {isNearDecay ? (
            <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-wider animate-pulse">
              [RE-BLURRED FOR SAFETY]
            </span>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-cyan-950/60 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                <Eye className="w-4 h-4 animate-pulse" />
              </div>
              <span className="text-xs font-mono font-bold text-cyan-300 tracking-wider">
                TAP TO REVEAL
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                Self-destructs on zero
              </span>
            </div>
          )}
        </div>
      )}

      {/* Lightbox / Expand icon when revealed */}
      {showRevealed && (
        <div className="absolute bottom-2 right-2 z-10 p-1 rounded-md bg-black/80 border border-slate-700 text-slate-300 hover:text-cyan-300 backdrop-blur-sm transition-colors">
          <Maximize2 className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
