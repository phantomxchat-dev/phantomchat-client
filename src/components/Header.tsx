import React, { useState } from "react";
import { Terminal, Smartphone, Copy, Check } from "lucide-react";

export interface HeaderProps {
  deviceId: string;
  isPro?: boolean;
  isVip?: boolean;
  route?: string;
  activeRoom?: any;
  navigateTo?: (route: any) => void;
  onOpenSyncBrowser?: () => void;
  onOpenMenu?: () => void;
  onCopySuccess?: (msg: string) => void;
}

export function DeviceIdBadge({
  deviceId,
  onCopySuccess,
  className = "",
}: {
  deviceId: string;
  onCopySuccess?: (msg: string) => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!deviceId) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(deviceId);
      } else {
        const ta = document.createElement("textarea");
        ta.value = deviceId;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      if (onCopySuccess) {
        onCopySuccess("Device ID copied to clipboard!");
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      if (onCopySuccess) {
        onCopySuccess("Device ID copied to clipboard!");
      }
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy Device ID"
      aria-label={`Copy Device ID ${deviceId}`}
      className={`px-2.5 py-1 bg-slate-900 hover:bg-slate-800/90 border border-slate-800 hover:border-cyan-500/50 rounded text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 group ${className}`}
    >
      <span className="text-slate-500">ID:</span>
      <span className="text-cyan-400 font-semibold">{deviceId}</span>
      {copied ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-500/40 px-1 py-0.2 rounded animate-pulse">
          <Check className="w-2.5 h-2.5 text-emerald-400" />
          <span>COPIED</span>
        </span>
      ) : (
        <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
      )}
    </button>
  );
}

export function Header({
  deviceId,
  isPro = false,
  isVip = false,
  route = "gate",
  activeRoom = null,
  navigateTo = () => {},
  onOpenSyncBrowser,
  onOpenMenu,
  onCopySuccess,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full h-14 bg-[#0F121A]/95 backdrop-blur-md border-b border-slate-800 px-6 sm:px-8 flex items-center justify-between font-sans shrink-0">
      {/* Brand Wordmark Left */}
      <div
        onClick={() => {
          if (activeRoom) {
            navigateTo("chat");
          } else {
            navigateTo("gate");
          }
        }}
        className="flex items-center gap-2.5 cursor-pointer group select-none"
      >
        <div className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 group-hover:border-cyan-500/60 transition-colors">
          <Terminal className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm text-white tracking-tight">Phantom Chat</span>
          <span className="text-[10px] text-slate-400 font-mono -mt-0.5">Ephemeral Terminal</span>
        </div>
      </div>

      {/* Navigation Links Center */}
      <nav className="flex items-center gap-1">
        <button
          onClick={() => navigateTo(activeRoom ? "chat" : "gate")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            route === "gate" || route === "chat"
              ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
              : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          Terminal
        </button>
        <button
          onClick={() => navigateTo("globallobby")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            route === "globallobby"
              ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
              : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          Global Lobby
        </button>
        <button
          onClick={() => navigateTo("faq")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            route === "faq"
              ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
              : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          FAQ
        </button>
      </nav>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigateTo("premium")}
          className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 cursor-pointer ${
            isPro
              ? "border-cyan-500 text-cyan-300 bg-cyan-950/30"
              : isVip
              ? "border-pink-500 text-pink-300 bg-pink-950/30"
              : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200 bg-slate-900"
          }`}
        >
          {isPro ? "Pro Clearance" : isVip ? "VIP Clearance" : "Clearance"}
        </button>

        {/* Interactive Device ID Badge */}
        <DeviceIdBadge deviceId={deviceId} onCopySuccess={onCopySuccess} />

        {onOpenSyncBrowser && route !== "chat" && (
          <button
            onClick={onOpenSyncBrowser}
            className="px-2.5 py-1 text-xs font-mono font-medium rounded-md border border-cyan-500/40 text-cyan-300 bg-cyan-950/30 hover:bg-cyan-900/40 hover:border-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sync Browser</span>
          </button>
        )}
      </div>
    </header>
  );
}

export default Header;
