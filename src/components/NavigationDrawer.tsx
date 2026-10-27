import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  X, Radio, Mail, Globe, Lightbulb, Users, Crown, HelpCircle, 
  Volume2, VolumeX, Smartphone, ShieldCheck, ShieldAlert, Copy, Check, RefreshCw
} from "lucide-react";
import { checkForUpdates } from "../utils/pwaUpdate";

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute: string;
  navigateTo: (route: any) => void;
  activeRoom: any;
  inboxEntriesCount: number;
  isPingSoundEnabled: boolean;
  setIsPingSoundEnabled: (val: boolean) => void;
  playPingSound: () => void;
  isPwaInstalled: boolean;
  triggerPwaInstall?: () => void;
  isPro: boolean;
  isVip: boolean;
  myDna: string;
  onOpenPairingModal?: () => void;
  onTriggerUpdateModal?: () => void;
}

export function NavigationDrawer({
  isOpen,
  onClose,
  currentRoute,
  navigateTo,
  activeRoom,
  inboxEntriesCount,
  isPingSoundEnabled,
  setIsPingSoundEnabled,
  playPingSound,
  isPwaInstalled,
  triggerPwaInstall,
  isPro,
  isVip,
  myDna,
  onOpenPairingModal,
  onTriggerUpdateModal,
}: NavigationDrawerProps) {
  if (!isOpen) return null;

  const [copiedDna, setCopiedDna] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<{ text: string; type: "available" | "current" } | null>(null);

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    setUpdateFeedback(null);
    try {
      const res = await checkForUpdates(true);
      if (res.updateAvailable) {
        setUpdateFeedback({ text: "Update available! Loading prompt...", type: "available" });
        setTimeout(() => {
          onClose();
          if (onTriggerUpdateModal) {
            onTriggerUpdateModal();
          }
        }, 500);
      } else {
        setUpdateFeedback({ text: `Phantom Chat is up to date (${res.currentVersion})`, type: "current" });
        setTimeout(() => setUpdateFeedback(null), 4000);
      }
    } catch {
      setUpdateFeedback({ text: "Unable to check updates right now.", type: "current" });
      setTimeout(() => setUpdateFeedback(null), 3000);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

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
      setTimeout(() => setCopiedDna(false), 2000);
    } catch {
      setCopiedDna(true);
      setTimeout(() => setCopiedDna(false), 2000);
    }
  };

  const handleNav = (targetRoute: any) => {
    onClose();
    navigateTo(targetRoute);
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const navItems = [
    {
      id: "gate",
      label: "Terminal Setup",
      icon: Radio,
      active: currentRoute === "gate" || currentRoute === "chat",
      action: () => handleNav(activeRoom ? "chat" : "gate"),
    },
    {
      id: "inbox",
      label: "Transmission Inbox",
      icon: Mail,
      badge: inboxEntriesCount > 0 ? inboxEntriesCount : undefined,
      active: currentRoute === "inbox",
      action: () => handleNav("inbox"),
    },
    {
      id: "globallobby",
      label: "Global Lobby",
      icon: Globe,
      active: currentRoute === "globallobby" || (currentRoute as any) === "world-chat",
      action: () => handleNav("globallobby"),
    },
    {
      id: "ideas",
      label: "Ideas & Proposals",
      icon: Lightbulb,
      active: currentRoute === "ideas",
      action: () => handleNav("ideas"),
    },
    {
      id: "friends",
      label: "Verified Contacts",
      icon: Users,
      active: currentRoute === "friends",
      action: () => handleNav("friends"),
    },
    {
      id: "premium",
      label: "Clearance Upgrades",
      icon: Crown,
      active: currentRoute === "premium",
      action: () => handleNav("premium"),
    },
    {
      id: "faq",
      label: "Frequently Asked Questions",
      icon: HelpCircle,
      active: currentRoute === "faq",
      action: () => handleNav("faq"),
    },
  ];

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation drawer"
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[100]"
      />

      {/* Drawer Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative w-80 max-w-[85vw] h-[100dvh] bg-[#0D1017] border-l border-slate-800 flex flex-col font-sans z-[101] shadow-2xl overflow-hidden"
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Phantom Navigation
            </h3>
            <button
              type="button"
              onClick={handleCopyDna}
              title="Click to copy Device ID"
              className="text-[11px] text-slate-400 hover:text-slate-200 font-mono mt-1 flex items-center gap-1.5 cursor-pointer p-1 -ml-1 rounded hover:bg-slate-800 transition-colors group"
            >
              <span>ID: <strong className="text-cyan-400">{myDna}</strong> {isPro ? "· Pro" : isVip ? "· VIP" : ""}</span>
              {copiedDna ? (
                <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-500/40 px-1 rounded animate-pulse">
                  COPIED
                </span>
              ) : (
                <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              )}
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close navigation drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Navigation Options */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Main Links */}
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider px-3 mb-2 block font-semibold">
              Destinations
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all text-left cursor-pointer ${
                    item.active
                      ? "bg-cyan-950/40 text-cyan-300 border border-cyan-800/60 font-semibold"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/70 border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${item.active ? "text-cyan-400" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className="bg-pink-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* 6-Digit Browser Sync Button */}
            {onOpenPairingModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPairingModal();
                }}
                className="w-full mt-2 py-2.5 px-3 rounded-xl text-xs font-mono font-bold uppercase transition-all flex items-center justify-between border border-cyan-500/40 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 hover:text-white cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-4 h-4 text-cyan-400" />
                  <span>Sync Browser</span>
                </div>
                <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30 font-mono">
                  6-DIGIT SYNC
                </span>
              </button>
            )}
          </div>

          {/* Preferences Section */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider px-3 block font-semibold">
              Preferences
            </span>
            <div className="p-3 bg-[#141824] border border-slate-800 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                {isPingSoundEnabled ? (
                  <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                ) : (
                  <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span>Sound Alerts</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPingSoundEnabled(!isPingSoundEnabled)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer ${
                  isPingSoundEnabled
                    ? "bg-cyan-950/40 border-cyan-600 text-cyan-300 font-medium"
                    : "bg-slate-800 border-slate-700 text-slate-400"
                }`}
              >
                {isPingSoundEnabled ? "On" : "Off"}
              </button>
            </div>
            {isPingSoundEnabled && (
              <button
                type="button"
                onClick={playPingSound}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 px-3 cursor-pointer"
              >
                Test alert sound
              </button>
            )}
          </div>

          {/* Install PWA section */}
          {!isPwaInstalled && triggerPwaInstall && (
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  onClose();
                  triggerPwaInstall();
                }}
                className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <Smartphone className="w-4 h-4 text-cyan-400" />
                <span>Install Web App (PWA)</span>
              </button>
            </div>
          )}

          {/* App Updates Section */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <button
              type="button"
              onClick={handleCheckUpdates}
              disabled={isCheckingUpdates}
              className="w-full py-2.5 px-3 bg-[#141824] hover:bg-[#191f2e] text-slate-200 border border-slate-800 hover:border-cyan-500/50 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center justify-between group disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <RefreshCw className={`w-4 h-4 text-cyan-400 ${isCheckingUpdates ? "animate-spin" : "group-hover:rotate-45 transition-transform"}`} />
                <span>{isCheckingUpdates ? "Checking for updates..." : "Check for updates"}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                v2.4.0
              </span>
            </button>
            {updateFeedback && (
              <p className={`text-[11px] px-2 font-mono ${updateFeedback.type === 'available' ? 'text-cyan-400 font-bold' : 'text-emerald-400'}`}>
                {updateFeedback.text}
              </p>
            )}
          </div>

        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 bg-[#0A0C12] text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Zero Logs · Ephemeral Sessions</span>
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
