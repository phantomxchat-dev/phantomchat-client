import React, { useState, useEffect, useRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import {
  Send,
  Globe,
  ShieldAlert,
  Zap,
  Clock,
  Terminal,
  Copy,
  Check,
  X,
  ArrowLeft,
  Users,
  AlertCircle,
  ShieldCheck,
  Lock,
  UserCheck,
  RefreshCw,
} from "lucide-react";
import { SwipeableMessage } from "./SwipeableMessage";
import { sendRoomMessage, subscribeToRoomMessages } from "../utils/realtimeDb";

const HCAPTCHA_SITEKEY = import.meta.env.VITE_HCAPTCHA_SITE_KEY || "";
const LOBBY_VERIFIED_KEY = "phantom_lobby_verified";
const LOBBY_ALIAS_KEY = "phantom_lobby_alias";
const VERIFICATION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export interface GlobalLobbyProps {
  myDna: string;
  nickname: string;
  onOpenVip?: () => void;
  isVip: boolean;
  isPro: boolean;
  isPingSoundEnabled?: boolean;
  onAliasChange?: (newAlias: string) => void;
  onBack?: () => void;
}

interface WorldChatMessage {
  id: string;
  roomCode: string;
  type: string;
  senderDna: string;
  nickname: string;
  text: string;
  timestamp: number;
  senderIsVip?: boolean;
  senderIsPro?: boolean;
  appearedAt: number;
  replyTo?: {
    id: string;
    sender: string;
    text: string;
  };
}

function checkLobbySessionVerified(): { verified: boolean; alias: string } {
  try {
    const cachedTime =
      sessionStorage.getItem(LOBBY_VERIFIED_KEY) ||
      localStorage.getItem(LOBBY_VERIFIED_KEY);
    const cachedAlias =
      sessionStorage.getItem(LOBBY_ALIAS_KEY) ||
      localStorage.getItem(LOBBY_ALIAS_KEY) ||
      localStorage.getItem("phantom_nickname");

    if (!cachedTime || !cachedAlias || !cachedAlias.trim()) {
      return { verified: false, alias: (cachedAlias || "").trim().slice(0, 20) };
    }

    const timestamp = Number(cachedTime);
    if (isNaN(timestamp) || Date.now() - timestamp > VERIFICATION_TTL_MS) {
      return { verified: false, alias: cachedAlias.trim().slice(0, 20) };
    }

    return { verified: true, alias: cachedAlias.trim().slice(0, 20) };
  } catch {
    return { verified: false, alias: "" };
  }
}

export function GlobalLobby({
  myDna,
  nickname,
  onOpenVip,
  isVip,
  isPro,
  isPingSoundEnabled,
  onAliasChange,
  onBack,
}: GlobalLobbyProps) {
  // Session verification state
  const sessionCheck = checkLobbySessionVerified();
  const [isLobbyVerified, setIsLobbyVerified] = useState<boolean>(sessionCheck.verified);
  const [lobbyAlias, setLobbyAlias] = useState<string>(
    sessionCheck.alias || (nickname || "").trim().slice(0, 20)
  );

  // Gatekeeper Modal inputs
  const [aliasInput, setAliasInput] = useState<string>(
    sessionCheck.alias || (nickname || "").trim().slice(0, 20)
  );
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const gatekeeperCaptchaRef = useRef<HCaptcha | null>(null);

  // Chat Feed States
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [statusText, setStatusText] = useState("Lobby Active · Real-time Broadcast Ready");
  const [isSending, setIsSending] = useState(false);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(3);
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; text: string } | null>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const streamRef = useRef<EventSource | null>(null);
  const lastWorldMessageCountRef = useRef(0);
  const [copiedWorldMessageId, setCopiedWorldMessageId] = useState<string | null>(null);
  const [streamError, setStreamError] = useState(false);

  // Real-time typing status states & refs
  const [activeTypers, setActiveTypers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<any>(null);
  const isTypingRef = useRef<boolean>(false);

  // Keep aliasInput synced if external nickname arrives and user is not verified yet
  useEffect(() => {
    if (!isLobbyVerified && !aliasInput && nickname) {
      setAliasInput(nickname.trim().slice(0, 20));
    }
  }, [nickname, isLobbyVerified, aliasInput]);

  // Handle Entrance Gatekeeper submission
  const handleEnterLobby = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAlias = aliasInput.trim().slice(0, 20);
    if (!cleanAlias) {
      setCaptchaError("Please provide an operative display name (1 to 20 characters).");
      return;
    }
    if (!captchaToken) {
      setCaptchaError("Please complete the hCaptcha verification challenge.");
      return;
    }

    try {
      const nowStr = String(Date.now());
      sessionStorage.setItem(LOBBY_VERIFIED_KEY, nowStr);
      sessionStorage.setItem(LOBBY_ALIAS_KEY, cleanAlias);
      localStorage.setItem(LOBBY_VERIFIED_KEY, nowStr);
      localStorage.setItem(LOBBY_ALIAS_KEY, cleanAlias);
      localStorage.setItem("phantom_nickname", cleanAlias);
    } catch (e) {
      console.warn("Storage write error:", e);
    }

    setLobbyAlias(cleanAlias);
    setIsLobbyVerified(true);
    setCaptchaError(null);

    if (onAliasChange) {
      onAliasChange(cleanAlias);
    }
  };

  const handleResetVerification = () => {
    try {
      sessionStorage.removeItem(LOBBY_VERIFIED_KEY);
      localStorage.removeItem(LOBBY_VERIFIED_KEY);
    } catch {}
    setIsLobbyVerified(false);
    setCaptchaToken(null);
    if (gatekeeperCaptchaRef.current) {
      try {
        gatekeeperCaptchaRef.current.resetCaptcha();
      } catch {}
    }
  };

  const sendTypingStatus = async (isTyping: boolean) => {
    if (!isLobbyVerified) return;
    try {
      await fetch(`/api/rooms/typing/global-lobby`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderDna: myDna, isTyping }),
      });
    } catch (err) {
      console.error("Error sending typing status:", err);
    }
  };

  const handleUserTyping = () => {
    if (!isLobbyVerified) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTypingStatus(false);
    }, 3000);
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedWorldMessageId(msgId);
    setTimeout(() => setCopiedWorldMessageId(null), 2000);
  };

  // Sound alert for incoming messages
  useEffect(() => {
    if (!isLobbyVerified) return;
    if (messages.length > lastWorldMessageCountRef.current) {
      if (lastWorldMessageCountRef.current > 0 && isPingSoundEnabled) {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.senderDna !== myDna) {
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
              const ctx = new AudioContextClass();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.type = "sine";
              osc.frequency.setValueAtTime(1400, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);
              gain.gain.setValueAtTime(0.08, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);
              osc.start();
              osc.stop(ctx.currentTime + 0.18);
            }
          } catch (error) {
            console.warn("Audio feedback play blocked or unsupported:", error);
          }
        }
      }
    }
    lastWorldMessageCountRef.current = messages.length;
  }, [messages, isPingSoundEnabled, myDna, isLobbyVerified]);

  const handleFeedScroll = () => {
    if (feedContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = feedContainerRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight <= 60;
      isAtBottomRef.current = atBottom;
    }
  };

  // Initial historic messages loader
  const fetchHistory = async () => {
    try {
      setStatusText("Connecting to Global Lobby feed...");
      const res = await fetch("/api/rooms/messages/global-lobby");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data: any[] = await res.json();
        const enriched = data
          .map((msg) => ({
            ...msg,
            id: msg.id || `msg_${Date.now()}_${Math.random()}`,
            nickname: msg.nickname || msg.alias || "OPERATIVE",
            senderDna: msg.senderDna || "OPERATIVE",
            text: msg.text || "",
            appearedAt: Date.now() - Math.max(0, Date.now() - (msg.timestamp || Date.now())),
          }))
          .filter((msg) => Date.now() - (msg.timestamp || 0) < 60000);
        setMessages(enriched.slice(-50));
        setStatusText("Lobby Active · Real-time Broadcast Ready");
        setStreamError(false);
      }
    } catch (err) {
      console.error("Error fetching world lobby history:", err);
      setStatusText("Notice: Reconnecting to lobby matrix...");
    }
  };

  // SSE Stream listener setup - ONLY ACTIVE WHEN isLobbyVerified === true
  useEffect(() => {
    if (!isLobbyVerified) {
      return;
    }

    fetchHistory();

    const roomCode = "global-lobby";
    const unsubscribeRtdb = subscribeToRoomMessages(roomCode, (rtdbMessages) => {
      setStreamError(false);
      setStatusText("Connected to Global Lobby live matrix");
      setMessages((prev) => {
        const byId = new Map<string, WorldChatMessage>();
        for (const m of prev) if (m?.id) byId.set(m.id, m);
        for (const msg of rtdbMessages) {
          if (msg && msg.id && Date.now() - Number(msg.timestamp || 0) < 60000) {
            const existing = byId.get(msg.id);
            byId.set(msg.id, {
              ...msg,
              id: msg.id,
              roomCode: "global-lobby",
              nickname: msg.nickname || msg.alias || "OPERATIVE",
              senderDna: msg.senderDna || "OPERATIVE",
              text: msg.text || "",
              timestamp: Number(msg.timestamp || Date.now()),
              appearedAt: existing?.appearedAt || Date.now(),
            });
          }
        }
        return Array.from(byId.values())
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-50);
      });
    });

    const es = new EventSource(`/api/rooms/stream/${roomCode}`);
    streamRef.current = es;

    es.onopen = () => {
      setStreamError(false);
      setStatusText("Connected to Global Lobby live matrix");
    };

    es.onerror = () => {
      setStreamError(false);
    };

    es.onmessage = (event) => {
      try {
        if (!event.data || event.data.trim() === "") return;
        const payload = JSON.parse(event.data);
        if (!payload) return;

        if (payload.type === "ping" || payload.type === "connected") {
          return;
        }

        if (payload.type === "typing") {
          setActiveTypers(payload.typers || []);
        } else if (payload.type === "history") {
          const history = (payload.data || []) as any[];
          const enriched = history
            .map((msg) => ({
              ...msg,
              id: msg.id || `msg_${Date.now()}_${Math.random()}`,
              nickname: msg.nickname || msg.alias || "OPERATIVE",
              senderDna: msg.senderDna || "OPERATIVE",
              text: msg.text || "",
              appearedAt: Date.now(),
            }))
            .filter((msg) => Date.now() - (msg.timestamp || 0) < 60000);
          setMessages(enriched.sort((a, b) => a.timestamp - b.timestamp).slice(-50));
        } else if (payload.type === "delete") {
          setMessages((prev) => prev.filter((m) => m.id !== payload.id));
        } else if (payload.type === "update") {
          const msgUpdate = payload.message || payload;
          setMessages((prev) =>
            prev.map((m) => (m.id === msgUpdate.id ? { ...m, ...msgUpdate } : m))
          );
        } else {
          const rawMsg = payload.message || payload;
          if (!rawMsg || (!rawMsg.id && !rawMsg.text)) return;
          const newMsg: WorldChatMessage = {
            ...rawMsg,
            id: rawMsg.id || `msg_${Date.now()}_${Math.random()}`,
            nickname: rawMsg.nickname || rawMsg.alias || "OPERATIVE",
            senderDna: rawMsg.senderDna || "OPERATIVE",
            text: rawMsg.text || "",
            appearedAt: Date.now(),
          };
          setMessages((prev) => {
            const blended = [...prev.filter((m) => m.id !== newMsg.id), newMsg];
            return blended.sort((a, b) => a.timestamp - b.timestamp).slice(-50);
          });
        }
      } catch (err) {
        console.error("Error parsing global codespace packet:", err);
      }
    };

    const metricsInterval = setInterval(() => {
      fetch("/api/database/stats")
        .then((res) => {
          if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
            return res.json();
          }
        })
        .then((stats) => {
          if (stats && typeof stats.activeUsersCount === "number") {
            setActiveUsersCount(stats.activeUsersCount);
          }
        })
        .catch(() => {});
    }, 12000);

    return () => {
      unsubscribeRtdb();
      if (streamRef.current) {
        streamRef.current.close();
      }
      clearInterval(metricsInterval);
    };
  }, [isLobbyVerified]);

  // Automated DOM-shredder utility: dissolves messages >60s old
  useEffect(() => {
    if (!isLobbyVerified) return;
    const shredderInterval = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => {
        return prev.filter((m) => {
          const ageMs = now - m.appearedAt;
          return ageMs < 60000;
        });
      });
    }, 250);

    return () => clearInterval(shredderInterval);
  }, [isLobbyVerified]);

  // Auto scroll to bottom
  useEffect(() => {
    if (!isLobbyVerified) return;
    if (isAtBottomRef.current && feedContainerRef.current) {
      setTimeout(() => {
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
        }
      }, 10);
    }
  }, [messages, isLobbyVerified]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    if (!isLobbyVerified) {
      setIsLobbyVerified(false);
      return;
    }

    const currentAuthorAlias = (lobbyAlias || nickname || "").trim().slice(0, 20);
    if (!currentAuthorAlias) {
      setIsLobbyVerified(false);
      return;
    }

    const safeText = inputText.trim();
    if (safeText.startsWith("data:") || safeText.startsWith("blob:") || /<script/i.test(safeText)) {
      alert("Text-only messages are permitted in Global Lobby.");
      return;
    }

    setIsSending(true);
    setStatusText("Broadcasting message...");

    try {
      const payload = {
        id: `global_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        roomCode: "global-lobby",
        type: "text",
        senderDna: myDna,
        nickname: currentAuthorAlias,
        text: safeText,
        fileUrl: "",
        timestamp: Date.now(),
        replyTo: replyTo || undefined,
        captchaToken: captchaToken || "session_verified",
      };

      // Push message to Firebase Realtime Database
      sendRoomMessage("global-lobby", payload).catch(() => {});

      const res = await fetch("/api/rooms/messages/global-lobby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const savedMsg = await res.json().catch(() => payload);
        const optimisticMsg: WorldChatMessage = {
          ...savedMsg,
          nickname: currentAuthorAlias,
          appearedAt: Date.now(),
        };
        setMessages((prev) => {
          const blended = [...prev.filter((m) => m.id !== optimisticMsg.id), optimisticMsg];
          return blended.sort((a, b) => a.timestamp - b.timestamp).slice(-50);
        });

        setInputText("");
        setReplyTo(null);

        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        isTypingRef.current = false;
        sendTypingStatus(false);

        setStatusText("Broadcast sent · Visible to all lobby participants");
        isAtBottomRef.current = true;
        if (feedContainerRef.current) {
          feedContainerRef.current.scrollTop = feedContainerRef.current.scrollHeight;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setStatusText(`Broadcast blocked: ${errJson.error || "Failed to transmit"}`);
        if (errJson.error && String(errJson.error).toLowerCase().includes("captcha")) {
          setIsLobbyVerified(false);
          setCaptchaToken(null);
          try {
            sessionStorage.removeItem(LOBBY_VERIFIED_KEY);
            localStorage.removeItem(LOBBY_VERIFIED_KEY);
          } catch {}
        }
      }
    } catch (err) {
      console.error("Error broadcasting live global log:", err);
      setStatusText("Communication error: please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const isFormValid =
    aliasInput.trim().length >= 1 &&
    aliasInput.trim().length <= 20 &&
    Boolean(captchaToken);

  return (
    <div
      className="relative flex flex-col h-full w-full bg-transparent text-slate-200 font-sans border border-slate-800 rounded-xl overflow-hidden shadow-2xl shrink-0"
      id="global-lobby-container"
    >
      {/* ========================================================== */}
      {/* 1. ENTRANCE GATEKEEPER MODAL OVERLAY (IF !isLobbyVerified) */}
      {/* ========================================================== */}
      {!isLobbyVerified && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gatekeeper-title"
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-md bg-[#0a0f1a] border border-cyan-500/40 rounded-2xl p-6 sm:p-7 shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col space-y-5 text-left my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2
                    id="gatekeeper-title"
                    className="text-sm sm:text-base font-mono font-bold text-white tracking-wider uppercase flex items-center gap-2"
                  >
                    <span>LOBBY GATEKEEPER</span>
                  </h2>
                  <p className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wide">
                    HUMAN VERIFICATION REQUIRED
                  </p>
                </div>
              </div>

              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Return to Terminal"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Instruction description */}
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Global Lobby is an open public matrix. To prevent bot spam and establish message attribution,
              please choose your operative display name and complete human verification before entering.
            </p>

            <form onSubmit={handleEnterLobby} className="space-y-4">
              {/* Mandatory Field 1: Display Name / Alias Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="lobby-display-name-input"
                    className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Display Name / Alias</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-mono ${
                      aliasInput.trim().length > 20
                        ? "text-rose-400 font-bold"
                        : aliasInput.trim().length >= 1
                        ? "text-cyan-400"
                        : "text-slate-500"
                    }`}
                  >
                    {aliasInput.trim().length}/20 chars
                  </span>
                </div>

                <input
                  id="lobby-display-name-input"
                  type="text"
                  placeholder="e.g. Cipher_99 or Raven"
                  value={aliasInput}
                  onChange={(e) => setAliasInput(e.target.value.slice(0, 20))}
                  maxLength={20}
                  required
                  autoFocus
                  className="w-full bg-[#121724] border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500/30 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 outline-none transition-all font-mono"
                />

                {aliasInput.trim().length === 0 && (
                  <p className="text-[10px] text-amber-400/90 font-mono">
                    * Name is required (1 to 20 characters).
                  </p>
                )}
              </div>

              {/* Mandatory Field 2: hCaptcha Verification Widget */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Human Verification</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  {captchaToken ? (
                    <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> VERIFIED
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono text-amber-400">
                      Pending challenge
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#070b14] p-3 flex flex-col items-center justify-center min-h-[82px] overflow-hidden">
                  {HCAPTCHA_SITEKEY ? (
                    <HCaptcha
                      sitekey={HCAPTCHA_SITEKEY}
                      theme="dark"
                      ref={gatekeeperCaptchaRef}
                      onVerify={(token) => {
                        setCaptchaToken(token);
                        setCaptchaError(null);
                      }}
                      onExpire={() => {
                        setCaptchaToken(null);
                      }}
                      onError={() => {
                        setCaptchaToken(null);
                        setCaptchaError("Captcha verification error. Please retry.");
                      }}
                    />
                  ) : (
                    <p className="text-xs text-amber-300 text-center">Set VITE_HCAPTCHA_SITE_KEY to enable this verification.</p>
                  )}
                </div>

                {captchaError && (
                  <p className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{captchaError}</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  type="submit"
                  disabled={!isFormValid}
                  id="gatekeeper-enter-button"
                  className={`w-full py-3 px-4 rounded-xl font-mono font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all ${
                    isFormValid
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer active:scale-[0.99]"
                      : "bg-slate-800/80 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>ENTER GLOBAL LOBBY</span>
                </button>

                {!isFormValid && (
                  <p className="text-[10px] text-center text-slate-500 font-mono">
                    Provide an alias and complete the hCaptcha to unlock entrance.
                  </p>
                )}

                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 text-xs font-mono transition-colors cursor-pointer"
                  >
                    Cancel & Return to Terminal
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 2. CHAT INTERFACE HEADER                                   */}
      {/* ========================================================== */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 bg-[#0F121A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400">
            <Globe className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs sm:text-sm text-white tracking-wider">
                GLOBAL CODESPACE LOBBY
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 font-bold animate-pulse">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>Author:</span>
              <span className="text-cyan-300 font-bold">{lobbyAlias || "Verified Operative"}</span>
              <span className="text-slate-600">//</span>
              <button
                type="button"
                onClick={handleResetVerification}
                className="text-slate-500 hover:text-cyan-400 transition-colors underline cursor-pointer"
                title="Change operative display name"
              >
                Change Alias
              </button>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Active Users Counter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>{activeUsersCount} online</span>
          </div>

          {/* Upgrade Button */}
          {onOpenVip && !isPro && (
            <button
              onClick={onOpenVip}
              className="px-2.5 py-1 rounded-lg bg-pink-950/40 border border-pink-500/40 text-pink-300 hover:bg-pink-900/40 text-[11px] font-mono font-bold transition-colors cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-3 h-3" />
              <span>PRO ACCESS</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================== */}
      {/* 3. MESSAGE FEED LIST                                       */}
      {/* ========================================================== */}
      <div
        ref={feedContainerRef}
        onScroll={handleFeedScroll}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-[#080b12] flex flex-col relative"
      >
        <div className="flex-grow" />

        {/* 60s Shredder Notification Pill */}
        <div className="w-full flex justify-center py-1 shrink-0">
          <div className="px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-1.5 shadow-sm">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>VOLATILE FEED // MESSAGES AUTO-SHRED AFTER 60 SECONDS</span>
          </div>
        </div>

        {/* Empty state */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto my-auto space-y-2 rounded-2xl border border-dashed border-slate-800 bg-[#0e1320]/40 shrink-0">
            <Globe className="w-8 h-8 text-cyan-500/40 animate-pulse" />
            <h3 className="text-xs font-mono font-bold text-slate-300">GLOBAL FREQUENCY OPEN</h3>
            <p className="text-[11px] text-slate-400 font-mono">
              Be the first to broadcast a live operative transmission.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine =
              (msg.senderDna || "").toUpperCase() === (myDna || "").toUpperCase();

            return (
              <SwipeableMessage
                key={msg.id}
                onSwipeReply={() =>
                  setReplyTo({
                    id: msg.id,
                    sender: msg.nickname || "OPERATIVE",
                    text: msg.text || "",
                  })
                }
              >
                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${
                    isMine ? "self-end items-end ml-auto" : "self-start items-start mr-auto"
                  } relative group shrink-0 flex-shrink-0 animate-in fade-in duration-150`}
                >
                  {/* Sender Metadata */}
                  <div className="flex items-center gap-1.5 px-1 mb-1 text-[11px] font-mono text-slate-400">
                    <span className={isMine ? "text-cyan-300 font-bold" : "text-slate-300 font-bold"}>
                      {msg.nickname || "OPERATIVE"}
                    </span>
                    {msg.senderIsVip && (
                      <span className="px-1 py-0.2 bg-pink-950/60 border border-pink-500/50 text-pink-300 text-[9px] font-bold rounded">
                        VIP
                      </span>
                    )}
                    {msg.senderIsPro && (
                      <span className="text-xs" title="Phantom Pro Elite">
                        👑
                      </span>
                    )}
                    <span className="text-slate-600 text-[10px]">[{msg.senderDna || "OP"}]</span>
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`rounded-2xl p-3 sm:p-3.5 text-xs sm:text-sm font-sans relative backdrop-blur-md transition-all shadow-md ${
                      isMine
                        ? "bg-cyan-950/30 border border-cyan-500/40 text-cyan-50 shadow-[0_2px_14px_rgba(6,182,212,0.12)]"
                        : "bg-[#111624]/90 border border-slate-800/90 text-slate-100 shadow-[0_2px_14px_rgba(0,0,0,0.4)]"
                    }`}
                  >
                    {/* Reply quote snippet */}
                    {msg.replyTo && (
                      <div className="mb-2 p-1.5 bg-slate-950/70 border-l-2 border-cyan-400 rounded-r-lg font-mono text-[11px] text-slate-400 truncate">
                        <span className="text-cyan-300 font-bold">&gt;&gt; &lt;{msg.replyTo.sender}&gt;: </span>
                        <span className="text-slate-300">{msg.replyTo.text}</span>
                      </div>
                    )}

                    <p className="break-all whitespace-pre-wrap leading-relaxed font-mono text-xs sm:text-sm">
                      {msg.text}
                    </p>
                  </div>

                  {/* Message actions / Timestamp */}
                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] font-mono text-slate-500">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg.id, msg.text || "")}
                      className="hover:text-cyan-400 transition-colors p-0.5 rounded cursor-pointer flex items-center gap-0.5"
                      title="Copy message"
                    >
                      {copiedWorldMessageId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              </SwipeableMessage>
            );
          })
        )}

        {/* Real-time typing indicators */}
        {activeTypers.filter((dna) => dna !== myDna).length > 0 && (
          <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-slate-900/50 border border-slate-800 text-xs font-mono text-slate-400 animate-pulse w-fit shrink-0 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              {activeTypers.filter((dna) => dna !== myDna).length === 1
                ? "OPERATOR BROADCASTING..."
                : "MULTIPLE OPERATORS BROADCASTING..."}
            </span>
          </div>
        )}

        <div ref={feedEndRef} />
      </div>

      {/* ========================================================== */}
      {/* 4. MESSAGE COMPOSER FOOTER                                 */}
      {/* ========================================================== */}
      <div className="p-3 border-t border-slate-800 bg-[#0F121A] shrink-0">
        {/* Reply Quote Banner */}
        {replyTo && (
          <div className="mb-2 px-3 py-1.5 bg-slate-900 border border-cyan-500/30 rounded-lg flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2 truncate">
              <span className="text-cyan-400 font-bold">REPLY &lt;{replyTo.sender}&gt;:</span>
              <span className="text-slate-300 truncate max-w-xs">{replyTo.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="text-slate-400 hover:text-rose-400 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="space-y-2">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                handleUserTyping();
              }}
              placeholder={`Broadcast as ${lobbyAlias || "Operative"}...`}
              maxLength={350}
              disabled={isSending || !isLobbyVerified}
              required
              aria-label="Broadcast message to Global Lobby"
              className="w-full bg-[#141824] text-xs sm:text-sm text-white placeholder-slate-500 border border-slate-700 focus:border-cyan-500 rounded-xl py-3 pl-4 pr-24 outline-none transition-colors font-sans"
              id="global-lobby-text-input"
              autoComplete="off"
            />

            <div className="absolute right-3 flex items-center z-10">
              <span className="text-[10px] font-mono text-slate-500">
                {inputText.length}/350
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
            <span className="text-[11px] text-slate-500 font-mono truncate max-w-[240px] sm:max-w-md">
              {statusText}
            </span>

            <button
              type="submit"
              disabled={!inputText.trim() || isSending || !isLobbyVerified}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              id="global-lobby-send-button"
            >
              <span>{isSending ? "BROADCASTING..." : "BROADCAST"}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GlobalLobby;
