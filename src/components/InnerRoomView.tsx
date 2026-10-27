import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Copy,
  Check,
  Link as LinkIcon,
  LogOut,
  ImageIcon,
  Mic,
  Square,
  Send,
  Radio,
  Trash2,
  AlertCircle,
  X,
  Volume2,
  VolumeX,
  Clock,
  Shield,
  Maximize2,
  Share2,
  Zap,
  Lock,
  EyeOff,
  Paperclip,
  Smartphone,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Message, RoomConfig } from "../types";
import { SwipeableMessage } from "./SwipeableMessage";
import { MediaMessage } from "./MediaMessage";

interface InnerRoomViewProps {
  activeRoom: RoomConfig;
  roomMessages: Message[];
  myDna: string;
  nickname: string;
  gender: "boy" | "girl";
  isPro: boolean;
  isVip: boolean;
  roomConnectionStatus: string;
  onRetryConnection: () => void;
  onExitRoom: () => void;
  messageText: string;
  setMessageText: (val: string) => void;
  onSendMessage: (type: "text" | "image" | "audio", customText?: string, resolvedFileUrl?: string) => Promise<void>;
  onUserTyping: () => void;
  activeRoomTypers: string[];
  mediaCounter: number;
  isUploadCapReached: boolean;
  isUploadingPhoto: boolean;
  uploadingThumbnail: string | null;
  uploadPhotoError: string | null;
  failedPhotoData: { base64: string; extension: string } | null;
  onRetryPhotoUpload: () => void;
  onDismissPhotoError: () => void;
  onPhotoSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRecording: boolean;
  recordingSeconds: number;
  startAudioRecording: () => void;
  stopAudioRecording: () => void;
  replyTo: { id: string; sender: string; text: string } | null;
  setReplyTo: (val: { id: string; sender: string; text: string } | null) => void;
  revealedMediaIds: Set<string>;
  toggleRevealMedia: (id: string) => void;
  onCopyMessage: (id: string, text: string) => void;
  copiedMessageId: string | null;
  onDeleteMessage: (id: string) => void;
  pusherWarning?: string | null;
  onDismissPusherWarning?: () => void;
  onP2PFileSelected?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  p2pTransferState?: {
    role: "sender" | "receiver";
    fileName: string;
    fileSize: number;
    progress: number;
    status?: "connecting" | "waiting" | "streaming" | "complete" | "error" | "declined";
    errorMessage?: string;
    isDirect?: boolean;
    canRetry?: boolean;
  } | null;
  incomingP2POffer?: {
    transferId: string;
    senderName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  } | null;
  onAcceptP2POffer?: (transferId: string) => void;
  onDeclineP2POffer?: (transferId: string) => void;
  onCancelP2P?: () => void;
  onRetryP2P?: () => void;
  isStegoMode?: boolean;
  onToggleStegoMode?: () => void;
  onTriggerPanic?: () => void;
}

function AudioPlayerNode({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [url]);

  const togglePlayback = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="flex items-center gap-2.5 py-1 px-2.5 bg-slate-950/60 border border-cyan-500/20 rounded-xl my-1">
      <button
        type="button"
        onClick={togglePlayback}
        className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        title={isPlaying ? "Pause voice message" : "Play voice message"}
      >
        {isPlaying ? <VolumeX className="w-4 h-4 text-cyan-300" /> : <Volume2 className="w-4 h-4 text-cyan-300" />}
      </button>
      <div className="flex flex-col gap-0.5 min-w-[120px]">
        <span className="text-[10px] font-mono font-semibold text-cyan-300">
          {isPlaying ? "PLAYING AUDIO NOTE" : "VOICE TRANSMISSION"}
        </span>
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-full">
          <div className={`h-full bg-cyan-400 rounded-full ${isPlaying ? "w-full animate-pulse" : "w-1/3"}`} />
        </div>
      </div>
    </div>
  );
}

export function InnerRoomView({
  activeRoom,
  roomMessages,
  myDna,
  nickname,
  gender,
  isPro,
  isVip,
  roomConnectionStatus,
  onRetryConnection,
  onExitRoom,
  messageText,
  setMessageText,
  onSendMessage,
  onUserTyping,
  activeRoomTypers,
  mediaCounter,
  isUploadCapReached,
  isUploadingPhoto,
  uploadingThumbnail,
  uploadPhotoError,
  failedPhotoData,
  onRetryPhotoUpload,
  onDismissPhotoError,
  onPhotoSelected,
  isRecording,
  recordingSeconds,
  startAudioRecording,
  stopAudioRecording,
  replyTo,
  setReplyTo,
  revealedMediaIds,
  toggleRevealMedia,
  onCopyMessage,
  copiedMessageId,
  onDeleteMessage,
  pusherWarning,
  onDismissPusherWarning,
  onP2PFileSelected,
  p2pTransferState,
  incomingP2POffer,
  onAcceptP2POffer,
  onDeclineP2POffer,
  onCancelP2P,
  onRetryP2P,
  isStegoMode = false,
  onToggleStegoMode,
  onTriggerPanic,
}: InnerRoomViewProps) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isAttachmentDrawerOpen, setIsAttachmentDrawerOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showP2PConfirm, setShowP2PConfirm] = useState(false);

  const isOneToOne = Boolean(
    activeRoom &&
      activeRoom.roomType !== "group" &&
      activeRoom.roomCode !== "global-lobby" &&
      (!activeRoom.maxPeers || activeRoom.maxPeers <= 2)
  );

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const p2pFileInputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);
  const prevMsgCountRef = useRef(roomMessages.length);

  // Scroll management helper
  const scrollToBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      if (smooth) {
        chatContainerRef.current.scrollTo({
          top: chatContainerRef.current.scrollHeight,
          behavior: "smooth",
        });
      } else {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" });
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight <= 100;
    }
  };

  // Auto-scroll when new messages arrive or when sending
  useEffect(() => {
    const isNewMsg = roomMessages.length > prevMsgCountRef.current;
    prevMsgCountRef.current = roomMessages.length;

    if (isNewMsg) {
      const lastMsg = roomMessages[roomMessages.length - 1];
      const isMine = lastMsg && (lastMsg.senderDna || "").toUpperCase() === (myDna || "").toUpperCase();

      if (isMine) {
        isAtBottomRef.current = true;
        requestAnimationFrame(() => scrollToBottom(true));
        setTimeout(() => scrollToBottom(true), 50);
      } else if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom(true));
        setTimeout(() => scrollToBottom(true), 50);
      }
    }
  }, [roomMessages, myDna]);

  // Auto-scroll when photo upload preview is shown
  useEffect(() => {
    if (isUploadingPhoto) {
      isAtBottomRef.current = true;
      requestAnimationFrame(() => scrollToBottom(true));
      setTimeout(() => scrollToBottom(true), 50);
    }
  }, [isUploadingPhoto]);

  // Initial scroll on mount
  useEffect(() => {
    scrollToBottom(false);
    const timer = setTimeout(() => scrollToBottom(false), 100);
    return () => clearTimeout(timer);
  }, []);

  // Recalculate scroll position when an image finishes loading if user is at bottom
  const handleImageLoad = () => {
    if (isAtBottomRef.current) {
      scrollToBottom(false);
      setTimeout(() => scrollToBottom(false), 50);
    }
  };

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (msg: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(msg);
    setCopiedLink(true);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      setCopiedLink(false);
    }, 2500);
  };

  // Copy Room Code
  const handleCopyCode = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(activeRoom.roomCode);
      }
      setCopiedCode(true);
      showToast("Room code copied to clipboard!");
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(true);
      showToast("Room code copied to clipboard!");
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyToClipboardWithToast = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    }
    // Replace alert() with UI Toast notification
    if (typeof showToast === "function") {
      showToast("Room link copied to clipboard!");
    }
  };

  const handleShareLink = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const shareUrl = window.location.href.includes("#room=")
      ? window.location.href
      : `${window.location.origin}/#room=${activeRoom.roomCode}`;

    // Direct native share invocation on click
    if (typeof navigator !== "undefined" && navigator.share) {
      navigator
        .share({
          title: "Phantom Chat",
          text: "Join my encrypted ephemeral chat room:",
          url: shareUrl,
        })
        .then(() => {
          // Successfully shared
        })
        .catch((err) => {
          // If user cancels, do nothing. If error, fallback to clipboard toast.
          if (err && err.name !== "AbortError") {
            copyToClipboardWithToast(shareUrl);
          }
        });
    } else {
      copyToClipboardWithToast(shareUrl);
    }
  };

  const handleNativeShare = (e?: React.MouseEvent) => handleShareLink(e);

  // Format countdown
  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    return `${secs}s`;
  };

  const totalTimerSeconds = activeRoom.timerSeconds || 120;
  const remainingSecs = Math.max(0, activeRoom.remainingSeconds ?? totalTimerSeconds);
  const progressPercent = Math.max(0, Math.min(100, (remainingSecs / totalTimerSeconds) * 100));
  const circleRadius = 18;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeOffset = circleCircumference - (progressPercent / 100) * circleCircumference;

  const isNearDecay = remainingSecs <= 10 && remainingSecs > 0;

  const maxMediaLimit = isPro ? "UNLIMITED" : isVip ? "15" : "2";

  return (
    <div className="flex flex-col h-[100dvh] lg:h-full max-h-[100dvh] lg:max-h-full min-h-0 w-full overflow-hidden bg-slate-950 text-slate-100 font-sans select-none relative">
      
      {/* Lightbox Modal */}
      {lightboxUrl && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center my-auto">
            <img
              src={lightboxUrl}
              alt="Media Fullscreen"
              className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl border border-cyan-500/40"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="mt-4 px-5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold rounded-xl border border-slate-700 transition-colors cursor-pointer"
            >
              CLOSE PREVIEW
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Floating In-App Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-full bg-slate-900/95 border border-cyan-500/60 text-cyan-300 text-xs font-mono font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-2 animate-in fade-in slide-in-from-top-2 select-none">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Pusher/Realtime Warning Banner */}
      {pusherWarning && (
        <div className="w-full bg-amber-950/80 border-b border-amber-500/40 py-2 px-4 text-xs font-mono text-amber-300 flex items-center justify-between z-50">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>{pusherWarning}</span>
          </div>
          {onDismissPusherWarning && (
            <button
              onClick={onDismissPusherWarning}
              className="text-amber-400 hover:text-white p-1"
              aria-label="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* TOP HEADER & ACTION BAR */}
      <header className="flex-none z-20 px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        
        {/* Left Section: Live Pulse Indicator & Room Info */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
          <div className="flex flex-col min-w-0">
            
            {/* Live Pulse Indicator */}
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    roomConnectionStatus === "CONNECTED" ? "bg-emerald-400" :
                    roomConnectionStatus === "CONNECTION_ERROR" ? "bg-rose-500" : "bg-amber-400"
                  }`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${
                    roomConnectionStatus === "CONNECTED" ? "bg-emerald-500" :
                    roomConnectionStatus === "CONNECTION_ERROR" ? "bg-rose-500" : "bg-amber-400"
                  }`} />
                </span>
                <span className={`font-semibold tracking-wider ${
                  roomConnectionStatus === "CONNECTED" ? "text-emerald-400" :
                  roomConnectionStatus === "CONNECTION_ERROR" ? "text-rose-400" : "text-amber-400"
                }`}>
                  {roomConnectionStatus === "CONNECTED" ? "ONLINE" :
                   roomConnectionStatus === "CONNECTION_ERROR" ? "OFFLINE" : "CONNECTING"}
                </span>
              </span>
              <span className="text-slate-600 font-bold" aria-hidden="true">//</span>
              <span className="text-cyan-400 font-semibold tracking-wider truncate text-[11px] sm:text-xs">
                [E2EE ACTIVE // AES-256-GCM]
              </span>
            </div>

            {/* Room ID & Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
              <span className="text-xs sm:text-sm font-mono font-bold text-white tracking-widest shrink-0">
                ROOM: <span className="text-cyan-400">{activeRoom.roomCode}</span>
              </span>

              {/* Single-tap 'COPY ROOM' Button */}
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copy 6-digit Room Code"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                  copiedCode
                    ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300"
                    : "bg-slate-900/80 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50"
                }`}
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>COPY ROOM</span>
                  </>
                )}
              </button>

              {/* Single-tap 'SHARE LINK' Button */}
              <button
                type="button"
                onClick={handleNativeShare}
                title="Share Room Link via Native Share or Clipboard"
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono font-medium transition-colors cursor-pointer ${
                  copiedLink
                    ? "bg-emerald-950/60 border-emerald-500/60 text-emerald-300"
                    : "bg-slate-900/80 border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50"
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>LINK COPIED</span>
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-3 h-3" />
                    <span>SHARE LINK</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right Section: Modernized Circular Countdown Timer & Exit Button */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          
          {/* Circular Countdown Timer */}
          <div
            className={`flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border bg-slate-900/70 backdrop-blur-md transition-colors ${
              isNearDecay ? "border-rose-500/60 bg-rose-950/30" : "border-slate-800"
            }`}
            title="Room self-destruct countdown timer"
          >
            <div className="relative w-8 h-8 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 44 44">
                <circle
                  cx="22"
                  cy="22"
                  r={circleRadius}
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeWidth="3"
                  fill="transparent"
                />
                <circle
                  cx="22"
                  cy="22"
                  r={circleRadius}
                  stroke={isNearDecay ? "#f43f5e" : "#00bfff"}
                  strokeWidth="3"
                  fill="transparent"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={strokeOffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <Clock
                className={`w-3.5 h-3.5 absolute ${
                  isNearDecay ? "text-rose-400 animate-pulse" : "text-cyan-400"
                }`}
              />
            </div>
            
            <div className="flex flex-col text-left">
              <span className="text-[9px] font-mono text-slate-500 font-semibold uppercase tracking-wider leading-none">
                TIMER
              </span>
              <span
                className={`text-xs sm:text-sm font-mono font-bold tracking-wider leading-tight ${
                  isNearDecay ? "text-rose-400 animate-pulse" : "text-cyan-300"
                }`}
              >
                {formatCountdown(remainingSecs)}
              </span>
            </div>
          </div>

          {/* Panic / Decoy Mode Trigger Button */}
          {onTriggerPanic && (
            <button
              type="button"
              onClick={onTriggerPanic}
              title="PANIC MODE: Instantly switch to decoy calculator & hide room session"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-300 hover:bg-rose-900 hover:text-white transition-all cursor-pointer text-xs font-mono font-bold shadow-[0_0_10px_rgba(244,63,94,0.3)] animate-pulse"
            >
              <Shield className="w-4 h-4 text-rose-400" />
              <span className="hidden sm:inline">PANIC</span>
            </button>
          )}

          {/* Exit / Leave Room Button */}
          <button
            type="button"
            onClick={() => setShowLeaveConfirm(true)}
            title="Exit and terminate active session"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-500/50 transition-all cursor-pointer text-xs font-mono font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">LEAVE</span>
          </button>
        </div>
      </header>

      {/* Connection recovery banner */}
      {roomConnectionStatus === "CONNECTION_ERROR" && (
        <div className="px-4 py-2 bg-rose-950/80 border-b border-rose-800/80 flex items-center justify-between text-xs font-mono text-rose-200 z-30">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Connection dropped. Reconnecting to live stream...</span>
          </div>
          <button
            onClick={onRetryConnection}
            className="px-3 py-1 bg-rose-900/80 hover:bg-rose-800 border border-rose-600 rounded-lg text-xs font-bold text-white uppercase tracking-wider transition-colors cursor-pointer"
          >
            RETRY
          </button>
        </div>
      )}

      {/* MESSAGE FEED CONTAINER */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scroll-smooth flex flex-col bg-slate-950 relative"
      >
        <div className="flex-grow" />

        {/* Empty State / Terminal Initialization */}
        {roomMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center max-w-md mx-auto my-auto space-y-3 rounded-2xl border border-dashed border-cyan-500/25 bg-[#0e1320]/60 backdrop-blur-md shrink-0 flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Radio className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-mono font-bold text-cyan-300 tracking-wider">
                TERMINAL SECURED
              </h3>
              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Standard countdown of 2m has activated. Send pictures, audio notes, and text. Everything purges on timer expiry.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 pt-1">
              <Shield className="w-3.5 h-3.5 text-cyan-500" />
              <span>Identity-less · Zero logs · End-to-end memory</span>
            </div>
          </div>
        ) : (
          roomMessages.map((msg) => {
            if (msg.text && msg.text.startsWith("[SECURITY ALERT]")) {
              return (
                <div key={msg.id} className="w-full flex justify-center py-2 animate-pulse shrink-0 flex-shrink-0">
                  <div className="bg-rose-950/40 border border-rose-800/80 px-4 py-2 rounded-xl font-mono text-xs text-rose-300 font-bold text-center shadow-lg">
                    🚨 {msg.text} 🚨
                  </div>
                </div>
              );
            }

            const isMine = (msg.senderDna || "").toUpperCase() === (myDna || "").toUpperCase();

            return (
              <SwipeableMessage
                key={msg.id}
                onSwipeReply={() =>
                  setReplyTo({
                    id: msg.id,
                    sender: msg.nickname || "OPERATIVE",
                    text: msg.type === "text" ? msg.text || "" : `[${(msg.type || "MEDIA").toUpperCase()}]`,
                  })
                }
              >
                <div
                  className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${
                    isMine ? "self-end items-end ml-auto" : "self-start items-start mr-auto"
                  } relative group animate-in fade-in duration-200 shrink-0 flex-shrink-0`}
                >
                  {/* Sender Metadata Tag */}
                  <div className="flex items-center gap-1.5 px-1 mb-1 text-[11px] font-mono text-slate-400">
                    <span className="text-xs">{msg.gender === "girl" ? "👩" : "👦"}</span>
                    <span className={isMine ? "text-cyan-300 font-semibold" : "text-slate-300 font-semibold"}>
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
                    className={`rounded-2xl p-3.5 sm:p-4 text-sm font-sans relative backdrop-blur-md transition-all shadow-md ${
                      isMine
                        ? "bg-cyan-950/30 border border-cyan-500/40 text-cyan-50 shadow-[0_2px_14px_rgba(6,182,212,0.12)]"
                        : "bg-[#111624]/90 border border-slate-800/90 text-slate-100 shadow-[0_2px_14px_rgba(0,0,0,0.4)]"
                    }`}
                  >
                    {/* Reply quote snippet */}
                    {msg.replyTo && (
                      <div className="mb-2 p-2 bg-slate-950/70 border-l-2 border-cyan-400 rounded-r-lg font-mono text-xs text-slate-400 truncate">
                        <span className="text-cyan-300 font-bold">&gt;&gt; &lt;{msg.replyTo.sender}&gt;: </span>
                        <span className="text-slate-300">{msg.replyTo.text}</span>
                      </div>
                    )}

                    {/* Text content */}
                    {msg.type === "text" && (
                      <p className="break-all whitespace-pre-wrap leading-relaxed font-mono text-xs sm:text-sm">
                        {msg.text}
                      </p>
                    )}

                    {/* Inline Image Preview via MediaMessage */}
                    {msg.type === "image" && (msg.mediaUrl || msg.fileUrl) && (
                      <MediaMessage
                        id={msg.id}
                        mediaUrl={msg.mediaUrl || msg.fileUrl || ""}
                        isRevealed={revealedMediaIds.has(msg.id)}
                        isNearDecay={isNearDecay}
                        onToggleReveal={toggleRevealMedia}
                        onOpenLightbox={(url) => setLightboxUrl(url)}
                        onImageLoad={handleImageLoad}
                      />
                    )}

                    {/* Audio Note */}
                    {msg.type === "audio" && msg.fileUrl && <AudioPlayerNode url={msg.fileUrl} />}
                  </div>

                  {/* Timestamp & Message Action Buttons */}
                  <div className="flex items-center gap-2 mt-1 px-1 text-[10px] font-mono text-slate-500 font-medium">
                    <span>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>

                    {msg.type === "text" && (
                      <button
                        type="button"
                        onClick={() => onCopyMessage(msg.id, msg.text || "")}
                        className="hover:text-cyan-400 transition-colors p-0.5 rounded cursor-pointer flex items-center gap-0.5"
                        title="Copy message text"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400 font-bold text-[9px]">COPIED</span>
                          </>
                        ) : (
                          <Copy className="w-3 h-3 text-slate-500 hover:text-slate-300" />
                        )}
                      </button>
                    )}

                    {isMine && (
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(msg.id)}
                        title="Delete message from room"
                        className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </SwipeableMessage>
            );
          })
        )}

        {/* Real-time typing indicators */}
        {activeRoomTypers.filter((dna) => dna !== myDna).length > 0 && (
          <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-slate-900/50 border border-slate-800 text-xs font-mono text-slate-400 animate-pulse w-fit shrink-0 flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              {activeRoomTypers.filter((dna) => dna !== myDna).length === 1
                ? "OPERATOR TYPING..."
                : "MULTIPLE OPERATORS TYPING..."}
            </span>
          </div>
        )}

        {/* Active Uploading Photo Progress */}
        {isUploadingPhoto && uploadingThumbnail && (
          <div className="flex flex-col self-end items-end animate-in fade-in my-2 shrink-0 flex-shrink-0">
            <span className="text-[10px] font-mono text-cyan-400 font-bold mb-1 px-1">
              [UPLOADING MEDIA...]
            </span>
            <div className="relative rounded-xl overflow-hidden max-w-[200px] border border-cyan-500/50 bg-black/70 p-2">
              <img src={uploadingThumbnail} alt="Uploading preview" className="w-full h-auto opacity-40 blur-sm" />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-mono text-cyan-300 font-semibold tracking-wider">
                  SENDING...
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Failed Photo Upload Card */}
        {uploadPhotoError && failedPhotoData && !isUploadingPhoto && (
          <div className="flex flex-col self-end items-end animate-in fade-in my-2 shrink-0 flex-shrink-0">
            <div className="rounded-xl border border-rose-500/60 bg-rose-950/40 p-3 flex flex-col items-center gap-2 max-w-[220px]">
              <span className="text-[10px] font-mono text-rose-300 font-bold text-center">
                {uploadPhotoError}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRetryPhotoUpload}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-mono font-bold rounded-lg cursor-pointer transition-colors"
                >
                  RETRY
                </button>
                <button
                  type="button"
                  onClick={onDismissPhotoError}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  DISMISS
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Reply-to floating pill banner */}
      {replyTo && (
        <div className="mx-4 sm:mx-6 mb-2 px-3 py-2 bg-[#0e1320] border border-cyan-500/30 rounded-xl flex items-center justify-between text-xs font-mono select-none z-30 shadow-lg">
          <div className="flex items-center gap-2 truncate">
            <span className="px-1.5 py-0.5 bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold rounded">
              REPLY
            </span>
            <span className="text-slate-400 font-bold">&lt;{replyTo.sender}&gt;:</span>
            <span className="text-slate-300 truncate max-w-[220px] sm:max-w-md">{replyTo.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
            title="Cancel Reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* LIVE USAGE STATUS BAR */}
      <div className="px-4 sm:px-6 py-1.5 bg-[#080c14] border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400 font-medium shrink-0">
        <span>ACTIVE EPHEMERAL SESSION · ZERO LOGS</span>
        <span className="text-cyan-400 font-semibold tracking-wider">
          MEDIA: {mediaCounter} / {maxMediaLimit} • TIMER: {formatCountdown(remainingSecs)}
        </span>
      </div>

      {/* RECEIVER CONFIRMATION MODAL FOR P2P FILE OFFER */}
      {incomingP2POffer && (
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto z-50 bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#0a0f1a] border-2 border-cyan-500/80 rounded-2xl p-6 shadow-[0_0_40px_rgba(6,182,212,0.35)] font-mono space-y-5 my-auto">
            <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shrink-0">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                  INCOMING P2P FILE REQUEST
                </h3>
                <p className="text-[10px] text-slate-400">
                  Direct Encrypted WebRTC DataChannel
                </p>
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 leading-relaxed break-all">
              <span className="text-cyan-400 font-bold">{incomingP2POffer.senderName || "OPERATIVE"}</span>{" "}
              wants to share{" "}
              <span className="text-emerald-300 font-bold">{incomingP2POffer.fileName}</span>{" "}
              <span className="text-slate-400">
                ({Math.max(0.01, incomingP2POffer.fileSize / (1024 * 1024)).toFixed(2)} MB)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => onDeclineP2POffer?.(incomingP2POffer.transferId)}
                className="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/60 text-rose-300 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                [DECLINE]
              </button>
              <button
                type="button"
                onClick={() => onAcceptP2POffer?.(incomingP2POffer.transferId)}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(16,185,129,0.5)] cursor-pointer"
              >
                [ACCEPT]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HIGH-TECH P2P LIVE PROGRESS & STATUS OVERLAY */}
      {p2pTransferState && (
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-md bg-[#07090e]/95 border rounded-xl p-4 shadow-[0_0_30px_rgba(6,182,212,0.4)] font-mono animate-in fade-in ${
            p2pTransferState.status === "error"
              ? "border-rose-500/80 shadow-[0_0_30px_rgba(244,63,94,0.4)]"
              : p2pTransferState.status === "complete"
              ? "border-emerald-500/80 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
              : "border-cyan-500/80"
          }`}
        >
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className="flex items-center gap-1.5 min-w-0">
              {p2pTransferState.status === "connecting" && (
                <>
                  <Share2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />
                  <span className="text-cyan-400 truncate">[P2P LINK: CONNECTING DIRECT TUNNEL...]</span>
                </>
              )}
              {p2pTransferState.status === "waiting" && (
                <>
                  <Share2 className="w-4 h-4 text-cyan-300 animate-pulse shrink-0" />
                  <span className="text-cyan-300 truncate">
                    {p2pTransferState.errorMessage?.includes("join")
                      ? "[P2P WAITING: WAITING FOR THE OTHER PERSON TO JOIN...]"
                      : "[P2P HANDSHAKE: WAITING FOR PEER TO ACCEPT...]"}
                  </span>
                </>
              )}
              {p2pTransferState.status === "streaming" && (
                <>
                  <Share2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
                  <span className="text-emerald-400 truncate">
                    [P2P {p2pTransferState.role === "sender" ? "SENDING" : "RECEIVING"}: {p2pTransferState.progress}% // DIRECT LINK ACTIVE]
                  </span>
                </>
              )}
              {p2pTransferState.status === "complete" && (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 truncate">[P2P COMPLETE: 100% // DIRECT STREAM VERIFIED]</span>
                </>
              )}
              {p2pTransferState.status === "declined" && (
                <>
                  <X className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-amber-400 truncate">[P2P STREAM DECLINED BY PEER]</span>
                </>
              )}
              {p2pTransferState.status === "error" && (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="text-rose-400 truncate">[P2P STREAM FAILED]</span>
                </>
              )}
            </span>

            {onCancelP2P && (
              <button
                type="button"
                onClick={onCancelP2P}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-2"
                title="Dismiss or Cancel P2P Stream"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-300 truncate mb-2">
            <span className="text-cyan-300 font-semibold">
              {p2pTransferState.role === "sender" ? "FILE" : "INCOMING"}:{" "}
            </span>
            <span>{p2pTransferState.fileName}</span>
            {p2pTransferState.fileSize > 0 && (
              <span className="text-slate-500 text-[10px] ml-2">
                ({(p2pTransferState.fileSize / 1024).toFixed(1)} KB)
              </span>
            )}
          </div>

          {/* Error Message Details and Retry Action */}
          {p2pTransferState.status === "error" || (p2pTransferState.status === "waiting" && p2pTransferState.errorMessage?.includes("join")) ? (
            <div className="space-y-2.5 pt-1">
              <p className={`text-[11px] p-2 rounded-lg leading-relaxed ${p2pTransferState.status === "error" ? "text-rose-300 bg-rose-950/40 border border-rose-500/30" : "text-cyan-300 bg-cyan-950/40 border border-cyan-500/30"}`}>
                {p2pTransferState.errorMessage || "Waiting for peer..."}
              </p>
              <div className="flex items-center justify-end gap-2">
                {p2pTransferState.canRetry && onRetryP2P && (
                  <button
                    type="button"
                    onClick={onRetryP2P}
                    className="py-1 px-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{p2pTransferState.status === "waiting" ? "Check Again" : "Retry Transfer"}</span>
                  </button>
                )}
                {onCancelP2P && (
                  <button
                    type="button"
                    onClick={onCancelP2P}
                    className="py-1 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full h-2.5 bg-slate-900 border border-slate-700 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  p2pTransferState.status === "complete"
                    ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                    : p2pTransferState.status === "waiting" || p2pTransferState.status === "connecting"
                    ? "bg-cyan-500 animate-pulse w-full"
                    : "bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                }`}
                style={
                  p2pTransferState.status === "streaming"
                    ? { width: `${p2pTransferState.progress}%` }
                    : p2pTransferState.status === "complete"
                    ? { width: "100%" }
                    : undefined
                }
              />
            </div>
          )}
        </div>
      )}

      {/* WHATSAPP-STYLE SINGLE PILL INPUT BAR */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          isAtBottomRef.current = true;
          scrollToBottom(true);
          onSendMessage("text");
        }}
        className="flex-none p-3 z-20 bg-slate-900/90 backdrop-blur border-t border-slate-800/80 flex items-center gap-2"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onPhotoSelected}
          className="hidden"
        />

        <input
          type="file"
          ref={p2pFileInputRef}
          onChange={onP2PFileSelected}
          accept="*"
          className="hidden"
        />

        {/* WhatsApp-Style Solid Single Pill Container */}
        <div className="flex-1 rounded-full bg-slate-900/95 border border-cyan-500/30 px-3 py-1.5 flex items-center gap-2 shadow-inner focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-500/30 transition-all">
          {/* Left Side: Paperclip Attachment Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsAttachmentDrawerOpen((prev) => !prev)}
            title="Open Attachments Menu"
            className="p-1.5 text-slate-400 hover:text-cyan-300 rounded-full hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Paperclip className={`w-5 h-5 transition-transform duration-200 ${isAttachmentDrawerOpen ? "rotate-45 text-cyan-400" : ""}`} />
          </button>

          {/* Middle: Recording Status or Transparent Text Input Field */}
          {isRecording ? (
            <div className="flex-1 flex items-center justify-between px-2 text-xs font-mono text-rose-400 animate-pulse">
              <span className="font-semibold">RECORDING VOICE NOTE...</span>
              <span className="font-bold bg-rose-950/80 px-2 py-0.5 rounded-full text-rose-300 border border-rose-500/40">
                {recordingSeconds}s
              </span>
            </div>
          ) : (
            <input
              type="text"
              id="phantom-inner-room-input"
              placeholder="Send an encrypted message..."
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                onUserTyping();
              }}
              className="bg-transparent border-none focus:outline-none flex-1 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 font-sans outline-none"
              autoComplete="off"
            />
          )}

          {/* Right Side: Circular Mic / Send Action */}
          {isRecording ? (
            <button
              type="button"
              onClick={stopAudioRecording}
              title="Stop Recording"
              className="p-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shrink-0 animate-pulse shadow-md"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!messageText.trim() && !isUploadingPhoto}
              className="p-2.5 rounded-full bg-cyan-400 hover:bg-cyan-300 active:scale-95 text-slate-950 font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.4)] flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              title="Send Message"
            >
              <Send className="w-4 h-4 text-slate-950 fill-slate-950" />
            </button>
          )}
        </div>
      </form>

      {/* ATTACHMENT DRAWER SLIDE-UP BOTTOM SHEET */}
      {isAttachmentDrawerOpen && (
        <>
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in"
            onClick={() => setIsAttachmentDrawerOpen(false)}
          />

          {/* Slide-Up Bottom Sheet */}
          <div className="fixed bottom-0 left-0 right-0 rounded-t-3xl bg-[#0f172a] border-t border-cyan-500/30 p-6 z-50 shadow-2xl animate-in slide-in-from-bottom-5 duration-200">
            <div className="max-w-md mx-auto space-y-4">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                    Attachment Options
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAttachmentDrawerOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 2x2 Action Pills Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* 1. Gallery / Image Share */}
                <button
                  type="button"
                  disabled={isUploadCapReached}
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsAttachmentDrawerOpen(false);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-blue-500/60 hover:bg-blue-950/20 text-left transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-mono font-bold text-white group-hover:text-blue-300">
                      Gallery
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      Share Image
                    </span>
                  </div>
                </button>

                {/* 2. Stego Cover Mode */}
                <button
                  type="button"
                  onClick={() => {
                    onToggleStegoMode?.();
                    setIsAttachmentDrawerOpen(false);
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all cursor-pointer group ${
                    isStegoMode
                      ? "bg-purple-950/60 border-purple-500 text-purple-300"
                      : "bg-slate-900/90 border-slate-800 hover:border-purple-500/60 hover:bg-purple-950/20"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-mono font-bold text-white group-hover:text-cyan-300">
                      Stego Mode
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {isStegoMode ? "ACTIVE" : "Embed Text"}
                    </span>
                  </div>
                </button>

                {/* 3. Voice Note / Audio */}
                <button
                  type="button"
                  disabled={isUploadCapReached}
                  onClick={() => {
                    if (isRecording) {
                      stopAudioRecording();
                    } else {
                      startAudioRecording();
                    }
                    setIsAttachmentDrawerOpen(false);
                  }}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-purple-500/60 hover:bg-purple-950/20 text-left transition-all cursor-pointer group disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mic className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-mono font-bold text-white group-hover:text-purple-300">
                      Voice Note
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {isRecording ? "Recording..." : "Record Audio"}
                    </span>
                  </div>
                </button>

                {/* 4. P2P Direct Share (Strictly 1-on-1 Private Rooms Only) */}
                {isOneToOne && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowP2PConfirm(true);
                      setIsAttachmentDrawerOpen(false);
                    }}
                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-emerald-500/60 hover:bg-emerald-950/20 text-left transition-all cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono font-bold text-white group-hover:text-emerald-300">
                          P2P Direct
                        </span>
                        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded">
                          EXPERIMENTAL
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 truncate">
                        Stream File
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Centered Leave Room Confirmation Modal */}
      {showLeaveConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="leave-room-heading"
          className="fixed inset-0 flex items-center justify-center overflow-y-auto z-50 bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLeaveConfirm(false);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md glass-card-border border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl text-left space-y-4 my-auto font-sans"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <LogOut className="w-5 h-5 text-rose-400" />
                <h3 id="leave-room-heading" className="text-base font-semibold text-white">
                  Leave Active Room?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              Are you sure you want to disconnect? All temporary keys and unread messages in memory will dissolve.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setShowLeaveConfirm(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  onExitRoom();
                }}
                className="py-2.5 px-5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer text-center shadow-lg shadow-rose-950/40"
              >
                Leave Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* P2P Direct Experimental Confirmation Modal */}
      {showP2PConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="p2p-experimental-heading"
          className="fixed inset-0 flex items-center justify-center overflow-y-auto z-50 bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowP2PConfirm(false);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md glass-card-border border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl text-left space-y-4 my-auto font-sans"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-emerald-400" />
                <h3 id="p2p-experimental-heading" className="text-base font-semibold text-white">
                  Experimental P2P Transfer
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowP2PConfirm(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              P2P Direct File Transfer is experimental and may fail to connect or
              complete. Don&rsquo;t use it for important files. If it fails, try
              standard media sharing instead.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 justify-end">
              <button
                type="button"
                onClick={() => setShowP2PConfirm(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowP2PConfirm(false);
                  p2pFileInputRef.current?.click();
                }}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer text-center shadow-lg shadow-emerald-950/40"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
