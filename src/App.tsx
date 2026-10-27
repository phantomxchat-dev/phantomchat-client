import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { 
  Menu, ShieldCheck, Zap, LogOut, Radio, Send, Image as ImageIcon, 
  Mic, Square, Sparkles, RefreshCw, AlertCircle, Trash2, Check, Copy, Download,
  ExternalLink, Phone, Database, Play, Pause, CircleStop, Clock,
  Crown, Shield, MessageSquare, Terminal, Film, Heart, MessageCircle, Share2, Upload, Volume2, VolumeX, Eye,
  Smile, Globe, HelpCircle, Plus, X, Smartphone, Monitor, ArrowLeft, Link, Reply, Mail, Users, Lightbulb, Lock
} from "lucide-react";
import { Message, RoomConfig, VipCheckResponse } from "./types";
import { getDeviceDNA, getStoredDeviceDNA } from "./utils/dna";
import {
  getPersistentDeviceId,
  generateSecondaryHardwareHashIdAsync,
  getSecondaryHardwareFingerprintString,
  getAudioContextLatencyAsync,
} from "./utils/deviceId";
import {
  computeDeviceFingerprint,
  getCrossBrowserDeviceId,
  getHardwareFingerprintDetails,
  generateDeterministicTRId,
} from "./utils/deviceFingerprint";
import {
  isMobileDevice,
  computeMobileHardwareDeviceId,
  getSynchronousMobileDeviceId,
} from "./utils/deviceHash";
import { uploadRoomMedia, compressImageFile, isValidMediaUrl } from "./utils/firebaseStorage";
import {
  getDailyMediaUploadCount,
  incrementDailyMediaUploadCount,
  checkMediaUploadQuota,
  FREE_TIER_DAILY_MEDIA_LIMIT,
  VIP_TIER_DAILY_MEDIA_LIMIT,
  FREE_TIER_ROOM_TIMER_SECONDS,
} from "./utils/usageTracker";
import {
  sendRoomMessage,
  subscribeToRoomMessages,
  sendTransmission,
  subscribeToTransmissions,
  removeTransmissionFromRtdb,
  deleteRoomMessageFromRtdb,
  clearRoomPayload,
  setRoomConfigInRtdb,
  subscribeToRoomConfig,
  getRoomConfigFromRtdb,
  sendP2PSignal,
  subscribeP2PSignals,
  clearP2PSignal,
  subscribeToProLicense,
} from "./utils/realtimeDb";
import { P2PTransferManager } from "./utils/webrtc";
import { ParticleBackground } from "./components/ParticleBackground";
import WorldChat from "./components/WorldChat";
import FaqPage from "./components/FaqPage";
import { LandingPage } from "./components/LandingPage";
import { SwipeableMessage } from "./components/SwipeableMessage";
import EntryAnimation from "./components/EntryAnimation";
import { InboxView } from "./components/InboxView";
import { IdeasBoard } from "./components/IdeasBoard";
import FriendsPage from "./components/FriendsPage";
import { TurnstileWidget } from "./components/TurnstileWidget";
import { TerminalGate } from "./components/TerminalGate";
import { NavigationDrawer } from "./components/NavigationDrawer";
import { ProModal } from "./components/ProModal";
import { UpdateModal } from "./components/UpdateModal";
import { initUpdateManager, subscribeToUpdates } from "./utils/pwaUpdate";
import { InnerRoomView } from "./components/InnerRoomView";
import { PremiumCaptchaGate } from "./components/PremiumCaptchaGate";
import { PairingModal } from "./components/PairingModal";
import { useSession } from "./context/SessionContext";
import { PanicCalculator, DecoyCalculator } from "./components/PanicCalculator";
import { triggerDecoyMode, exitDecoyMode, isDecoyModeActiveSession } from "./utils/panic";
import { deriveRoomKey, encryptPayload, decryptPayload } from "./utils/crypto";
import { embedTextInImage } from "./utils/steganography";
import { initFetchInterceptor, connectRoomStream } from "./utils/fetchInterceptor";

initFetchInterceptor();

const MOST_USED_EMOJIS = ["😂", "❤️", "👍", "🔥", "😍", "😭", "😊", "🙏", "🤔", "👏", "🎉", "✨", "😜", "🙌", "🤣", "💔", "😘", "🙄", "👀", "😎"];

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return localStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch (e) {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(key);
      }
    } catch (e) {}
  }
};

const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        return sessionStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem(key, value);
      }
    } catch (e) {}
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.removeItem(key);
      }
    } catch (e) {}
  }
};

// Setup deterministic TR-XXXXX Device DNA based on hardware canvas/WebGL + screen + CPU specs
function generateDeviceDna(): string {
  try {
    if (isMobileDevice()) {
      return getSynchronousMobileDeviceId();
    }
    return generateDeterministicTRId();
  } catch (e) {
    return "TR-7X89K";
  }
}

// Generate an extremely stable hardware-level, browser-agnostic fingerprint for the physical device
function getHardwareFingerprint(): string {
  try {
    const s = window.screen;
    const n = navigator;
    
    // Use orientation-independent width/height to avoid changes when rotating phone
    const screenMax = Math.max(s.width || 0, s.height || 0);
    const screenMin = Math.min(s.width || 0, s.height || 0);
    
    // Retrieve safe WebGL GPU information
    let gpuRenderer = "unknown-renderer";
    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as any;
      if (gl) {
        const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
        const unmaskedParam = debugInfo ? (debugInfo.UNMASKED_RENDERER_WEBGL || 0x9246) : 0x9246;
        gpuRenderer = gl.getParameter(unmaskedParam) || gl.getParameter(gl.RENDERER) || "unknown-renderer";
      }
    } catch (e) {
      // Safe fallback
    }

    // Stable, browser-agnostic hardware signals only
    const tz = Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || "unknown";
    const mem = (n as any).deviceMemory || 0;
    
    const rawFingerprint = [
      `screenMax:${screenMax}`,
      `screenMin:${screenMin}`,
      `dpr:${window.devicePixelRatio || 1}`,
      `cpu:${n.hardwareConcurrency || 0}`,
      `mem:${mem}`,
      `tz:${tz}`,
      `gpuRenderer:${gpuRenderer}`,
      `touch:${n.maxTouchPoints || 0}`
    ].join("|");

    // Hash the stable signals exactly as generateDeviceDna hashing logic does
    let hash = 0;
    for (let i = 0; i < rawFingerprint.length; i++) {
      hash = (hash << 5) - hash + rawFingerprint.charCodeAt(i);
      hash |= 0;
    }

    return `HW-${Math.abs(hash)}`;
  } catch (e) {
    return "fallback-fingerprint";
  }
}

async function safeFetchJson<T = any>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      throw new Error(`Server returned HTML instead of JSON (Status ${res.status}). Verify Firebase Hosting API rewrite configuration.`);
    }
    throw new Error(`Non-JSON response received (${contentType}): ${text.slice(0, 80)}`);
  }
  return res.json();
}

export default function App() {
  const [showIntro, setShowIntro] = useState(() => {
    try {
      const introSeen = safeSessionStorage.getItem("phantom_intro_seen") === "true";
      const prefersReduced = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      return !introSeen && !prefersReduced;
    } catch (e) {
      return false;
    }
  });

  const [introRevealed, setIntroRevealed] = useState(() => {
    try {
      const introSeen = safeSessionStorage.getItem("phantom_intro_seen") === "true";
      return introSeen;
    } catch (e) {
      return true;
    }
  });

  // Navigation / Routing
  const [route, setRoute] = useState<"landing" | "gate" | "chat" | "world-chat" | "globallobby" | "faq" | "premium" | "inbox" | "ideas" | "friends">(() => {
    try {
      if (typeof window !== "undefined" && window.location) {
        
        
        if (window.location.pathname === "/inbox") return "inbox";
        if (window.location.pathname === "/friends") return "friends";
        if (window.location.pathname === "/contacts") {
          window.history.replaceState({}, "", "/friends");
          return "friends";
        }
        if (window.location.pathname === "/globallobby") return "globallobby";
        if (window.location.pathname === "/world-chat") {
          window.history.replaceState({}, "", "/globallobby");
          return "globallobby";
        }
        if (window.location.pathname.toLowerCase() === "/faq") return "faq";
        if (window.location.pathname === "/premium") return "premium";
        if (window.location.pathname === "/clearance") {
          window.history.replaceState({}, "", "/premium");
          return "premium";
        }
        if (window.location.pathname === "/games") {
          window.history.replaceState({}, "", "/ideas");
          return "ideas";
        }
        if (window.location.pathname === "/ideas") return "ideas";
        if (window.location.pathname === "/terminal") return "gate";
        if (window.location.pathname.startsWith("/room/")) return "gate";
      }
    } catch (e) {}
    return "landing";
  });

  // 6-Digit Browser Identity Sync Context
  const {
    deviceId: sessionDeviceId,
    updateDeviceId,
    isPairingModalOpen,
    pairingMode,
    openPairingModal,
    closePairingModal,
  } = useSession();

  // Client DNA & Identity Engine (Wipe-Resistant Local ID Resolution)
  const [myDna, setMyDna] = useState<string>(() => {
    return getPersistentDeviceId();
  });

  // Automatically keep myDna in sync when deviceId is updated via browser sync
  useEffect(() => {
    if (sessionDeviceId && sessionDeviceId !== myDna) {
      setMyDna(sessionDeviceId);
      safeStorage.setItem("phantom_device_id", sessionDeviceId);
      safeStorage.setItem("deviceId", sessionDeviceId);
      safeStorage.setItem("phantom_device_dna", sessionDeviceId);
    }
  }, [sessionDeviceId, myDna]);

  // Listen to global device sync events for instant UI synchronization without hard refresh
  useEffect(() => {
    const handleDeviceSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ deviceId?: string; isDeviceIdLocked?: boolean }>;
      if (customEvent.detail?.deviceId) {
        const newId = customEvent.detail.deviceId.trim().toUpperCase();
        setMyDna(newId);
        safeStorage.setItem("phantom_device_id", newId);
        safeStorage.setItem("deviceId", newId);
        safeStorage.setItem("phantom_device_dna", newId);
      }
    };
    window.addEventListener("phantom_device_synced", handleDeviceSync);
    window.addEventListener("phantom_device_updated", handleDeviceSync);
    return () => {
      window.removeEventListener("phantom_device_synced", handleDeviceSync);
      window.removeEventListener("phantom_device_updated", handleDeviceSync);
    };
  }, []);

  // Dynamic GEO & SEO Title & Description Updater per Route
  useEffect(() => {
    let title = "Phantom Chat // Identity-Less Ephemeral Messaging Terminal";
    let desc = "Phantom Chat is a free anonymous ephemeral messaging terminal. No accounts, no phone numbers, no email, and zero logs. Rooms self-destruct automatically.";

    if (route === "landing") {
      title = "Phantom Chat // Identity-Less Ephemeral Messaging Terminal";
      desc = "Phantom Chat is a free anonymous ephemeral messaging terminal. No accounts, no phone numbers, no email, and zero logs. Rooms self-destruct automatically.";
    } else if (route === "gate" || route === "chat") {
      title = "Secure Terminal Room // Phantom Chat";
      desc = "Create or join encrypted temporary chat rooms with zero logs, auto-destruct timers, and complete anonymity on Phantom Chat.";
    } else if (route === "globallobby" || (route as any) === "world-chat") {
      title = "Global Lobby // Phantom Chat";
      desc = "Join the live public Global Lobby on Phantom Chat. Ephemeral real-time messaging with self-destructing text.";
    } else if (route === "faq") {
      title = "Frequently Asked Questions // Phantom Chat";
      desc = "Learn how Phantom Chat provides zero-log ephemeral messaging, self-destructing rooms, and complete anonymity without accounts.";
    } else if (route === "premium") {
      title = "Phantom Elite / PRO Clearance // Phantom Chat";
      desc = "Upgrade your clearance for extended ephemeral chat sessions and VIP priority features.";
    } else if (route === "inbox") {
      title = "Secure Transmission Inbox // Phantom Chat";
      desc = "Encrypted peer-to-peer transmission inbox and handshake requests.";
    } else if (route === "ideas") {
      title = "Ideas Board & Protocol Council // Phantom Chat";
      desc = "Anonymous community proposal board and feature-priority voting council.";
    } else if (route === "friends") {
      title = "Secure Contacts & Peer Handshakes // Phantom Chat";
      desc = "Manage verified peer handshakes and direct secure room connections.";
    }

    document.title = title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.setAttribute("content", desc);
    }
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute("content", title);
    }
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute("content", desc);
    }
    const twitterTitle = document.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) {
      twitterTitle.setAttribute("content", title);
    }
    const twitterDesc = document.querySelector('meta[name="twitter:description"]');
    if (twitterDesc) {
      twitterDesc.setAttribute("content", desc);
    }
  }, [route]);

  // PWA & Web App Safe Update System
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [latestUpdateVersion, setLatestUpdateVersion] = useState("2.4.0");

  useEffect(() => {
    initUpdateManager();
    const unsubscribe = subscribeToUpdates((status) => {
      if (status.updateAvailable) {
        setShowUpdateModal(true);
        if (status.latestVersion) {
          setLatestUpdateVersion(status.latestVersion);
        }
      }
    });
    return unsubscribe;
  }, []);

  // Real-time secure inbox & contacts data layer
  const [inboxEntries, setInboxEntries] = useState<any[]>([]);
  const [contactsList, setContactsList] = useState<any[]>([]);
  const [activeLobbyId, setActiveLobbyId] = useState<string | null>(null);

  const fetchInbox = React.useCallback(async () => {
    if (!myDna) return;
    try {
      const cleanDna = (myDna || "").toUpperCase();
      const res = await fetch(`/api/inbox?dna=${encodeURIComponent(cleanDna)}`, {
        headers: { "X-Device-DNA": cleanDna }
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          setInboxEntries(data);
        }
      }
    } catch (err) {
      // silent catch
    }
  }, [myDna]);

  const fetchContacts = React.useCallback(async () => {
    if (!myDna) return;
    try {
      const cleanDna = (myDna || "").toUpperCase();
      const res = await fetch(`/api/contacts/handshake?dna=${encodeURIComponent(cleanDna)}`, {
        headers: { "X-Device-DNA": cleanDna }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.friends) ? data.friends : [];
        setContactsList(list);
      }
    } catch (err) {
      // silent catch
    }
  }, [myDna]);

  const refreshInboxAndContacts = React.useCallback(async () => {
    await Promise.all([fetchInbox(), fetchContacts()]);
  }, [fetchInbox, fetchContacts]);

  const handleAcceptHandshakeFromInbox = React.useCallback(
    async (entryId: string, friendRequestId?: string, fromDna?: string) => {
      const cleanMyDna = (myDna || "").toUpperCase();
      const cleanFromDna = (fromDna || "").toUpperCase();
      const hsId =
        friendRequestId ||
        entryId.replace(/^hs_/, "") ||
        (cleanMyDna && cleanFromDna
          ? cleanMyDna < cleanFromDna
            ? `${cleanMyDna}_${cleanFromDna}`
            : `${cleanFromDna}_${cleanMyDna}`
          : "");

      // Optimistically remove from pending inbox and move peer to Established Contacts
      setInboxEntries((prev) => prev.filter((item) => item.id !== entryId && item.friendRequestId !== hsId));
      if (cleanMyDna && cleanFromDna) {
        const dna1 = cleanMyDna < cleanFromDna ? cleanMyDna : cleanFromDna;
        const dna2 = cleanMyDna < cleanFromDna ? cleanFromDna : cleanMyDna;
        setContactsList((prev) => {
          const exists = prev.some((f) => f.id === hsId || (f.dna1 === dna1 && f.dna2 === dna2));
          if (exists) {
            return prev.map((f) =>
              f.id === hsId || (f.dna1 === dna1 && f.dna2 === dna2)
                ? { ...f, status: "accepted", updatedAt: Date.now() }
                : f
            );
          }
          return [
            {
              id: hsId,
              dna1,
              dna2,
              sender_dna: cleanFromDna,
              recipient_dna: cleanMyDna,
              status: "accepted",
              requesterDna: cleanFromDna,
              updatedAt: Date.now()
            },
            ...prev
          ];
        });
      }

      try {
        await removeTransmissionFromRtdb(cleanMyDna, entryId);
        if (hsId) {
          await removeTransmissionFromRtdb(cleanMyDna, hsId);
        }
        await fetch("/api/contacts/handshake", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-DNA": cleanMyDna
          },
          body: JSON.stringify({
            action: "ACCEPT",
            status: "accepted",
            handshakeId: hsId,
            friendRequestId: hsId,
            requesterDna: cleanMyDna,
            sender_dna: cleanFromDna
          })
        });
        await fetch(`/api/inbox?id=${encodeURIComponent(entryId)}`, {
          method: "DELETE",
          headers: { "X-Device-DNA": cleanMyDna }
        });
      } catch (e) {
        console.error("Failed to accept handshake", e);
      } finally {
        await refreshInboxAndContacts();
      }
    },
    [myDna, refreshInboxAndContacts]
  );

  const handleDeclineHandshakeFromInbox = React.useCallback(
    async (entryId: string, friendRequestId?: string, fromDna?: string) => {
      const cleanMyDna = (myDna || "").toUpperCase();
      const cleanFromDna = (fromDna || "").toUpperCase();
      const hsId = friendRequestId || entryId.replace(/^hs_/, "");

      setInboxEntries((prev) => prev.filter((item) => item.id !== entryId && item.friendRequestId !== hsId));
      setContactsList((prev) => prev.filter((f) => f.id !== hsId));

      try {
        await removeTransmissionFromRtdb(cleanMyDna, entryId);
        if (hsId) {
          await removeTransmissionFromRtdb(cleanMyDna, hsId);
        }
        await fetch("/api/contacts/handshake", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-DNA": cleanMyDna
          },
          body: JSON.stringify({
            action: "DECLINE",
            status: "declined",
            handshakeId: hsId,
            friendRequestId: hsId,
            requesterDna: cleanMyDna,
            sender_dna: cleanFromDna
          })
        });
        await fetch(`/api/inbox?id=${encodeURIComponent(entryId)}`, {
          method: "DELETE",
          headers: { "X-Device-DNA": cleanMyDna }
        });
      } catch (e) {
        console.error("Failed to decline handshake", e);
      } finally {
        await refreshInboxAndContacts();
      }
    },
    [myDna, refreshInboxAndContacts]
  );

  // Automatically fetch /api/inbox and contacts on page load, subscribe to Realtime DB transmissions, and refresh when switching tabs
  useEffect(() => {
    if (!myDna) return;
    refreshInboxAndContacts();

    const unsubscribeTx = subscribeToTransmissions(myDna, (rtdbItems) => {
      if (!Array.isArray(rtdbItems)) return;
      setInboxEntries((prev) => {
        const mergedMap = new Map<string, any>();
        for (const item of prev) {
          if (item && item.id) mergedMap.set(item.id, item);
        }
        for (const tx of rtdbItems) {
          if (tx && tx.id) {
            mergedMap.set(tx.id, tx);
          }
        }
        return Array.from(mergedMap.values()).sort(
          (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0)
        );
      });
    });

    const interval = setInterval(refreshInboxAndContacts, 5000);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        refreshInboxAndContacts();
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    return () => {
      unsubscribeTx();
      clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [myDna, route, refreshInboxAndContacts]);

  const establishedContacts = contactsList.filter((f) => f.status === "accepted");

  // Handle Deterministic Hardware Fingerprinting & Cloudflare/Backend Device Sync with Collision Protocol
  useEffect(() => {
    async function performHandshake() {
      try {
        // 1. Wipe-Resistant Local ID Resolution:
        // Check localStorage.getItem('phantom_device_id'). If present, use saved ID.
        // If missing (browser data wiped), recalculate primary hardware fingerprint to recover exact same TR-XXXXX ID.
        let activeDna = getPersistentDeviceId();
        setMyDna(activeDna);
        updateDeviceId(activeDna);
        safeStorage.setItem("phantom_device_id", activeDna);
        safeStorage.setItem("deviceId", activeDna);
        safeStorage.setItem("phantom_device_dna", activeDna);

        const fpDetails = await getHardwareFingerprintDetails();

        // 2. Backend Collision Protocol:
        // Register or check Device ID against backend database.
        // If collision occurs from an unrelated device session, instruct client to use secondary TR-XXXXX hash variant.
        try {
          const syncRes = await fetch("/api/device/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Device-DNA": activeDna,
            },
            body: JSON.stringify({
              fingerprint: activeDna,
              deviceId: activeDna,
              hardwareSignature: fpDetails.hardwareSignature,
              hardwareMetrics: fpDetails.metrics,
              isSecondary: false,
            }),
          });

          const syncData = await syncRes.json().catch(() => null);

          // Backend instructed client to use secondary TR-XXXXX hash variant due to collision
          if (
            syncRes.status === 409 ||
            (syncData &&
              (syncData.collision === true ||
                syncData.status === "COLLISION_DETECTED" ||
                syncData.instruction === "USE_SECONDARY_VARIANT"))
          ) {
            console.warn(
              `[BACKEND COLLISION PROTOCOL] Collision detected on ${activeDna}. Switching to secondary TR-XXXXX hash variant.`
            );
            const secondaryId = (await generateSecondaryHardwareHashIdAsync())
              .trim()
              .toUpperCase();
            activeDna = secondaryId;
            setMyDna(activeDna);
            updateDeviceId(activeDna);
            safeStorage.setItem("phantom_device_id", activeDna);
            safeStorage.setItem("deviceId", activeDna);
            safeStorage.setItem("phantom_device_dna", activeDna);

            // Re-register secondary variant with backend
            const audioLatencyMetric = await getAudioContextLatencyAsync();
            const secondarySignature = getSecondaryHardwareFingerprintString(audioLatencyMetric);
            await fetch("/api/device/sync", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Device-DNA": activeDna,
              },
              body: JSON.stringify({
                fingerprint: activeDna,
                deviceId: activeDna,
                hardwareSignature: secondarySignature,
                isSecondary: true,
              }),
            }).catch(() => {});
          } else if (syncRes.ok && syncData) {
            const returnedDeviceId = (
              syncData?.deviceId ||
              syncData?.dna ||
              syncData?.clientDna ||
              ""
            )
              .trim()
              .toUpperCase();
            if (
              returnedDeviceId &&
              !safeStorage.getItem("pairedAt") &&
              safeStorage.getItem("isDeviceIdLocked") !== "true"
            ) {
              activeDna = returnedDeviceId;
              setMyDna(activeDna);
              safeStorage.setItem("phantom_device_id", activeDna);
              safeStorage.setItem("deviceId", activeDna);
              safeStorage.setItem("phantom_device_dna", activeDna);
            }
          }
        } catch (syncErr) {
          console.warn("Cross-browser device sync fallback to local TR ID:", syncErr);
        }

        // 3. Register / Validate with backend Cloudflare D1 DNA record endpoint
        const response = await fetch("/api/dna", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-DNA": activeDna,
          },
          body: JSON.stringify({
            clientDna: activeDna,
            hardwareMetrics: {
              screen: fpDetails.metrics.screenDims,
              dpr: fpDetails.metrics.dpr,
              hc: fpDetails.metrics.cpuCores,
              gpu: fpDetails.metrics.gpuRenderer,
            },
          }),
        });

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (
            data &&
            data.clientDna &&
            !safeStorage.getItem("pairedAt") &&
            safeStorage.getItem("isDeviceIdLocked") !== "true"
          ) {
            const confirmedDna = String(data.clientDna).toUpperCase();
            setMyDna(confirmedDna);
            safeStorage.setItem("phantom_device_id", confirmedDna);
            safeStorage.setItem("deviceId", confirmedDna);
            safeStorage.setItem("phantom_device_dna", confirmedDna);
          }
        }
      } catch (err) {
        console.error("Hybrid Device DNA registration error:", err);
      }
    }
    performHandshake();
  }, []);
  const [nickname, setNickname] = useState(() => safeStorage.getItem("phantom_nickname") || "");
  const [gender, setGender] = useState<"boy" | "girl">(() => {
    return (safeStorage.getItem("phantom_gender") as "boy" | "girl") || "boy";
  });
  const [isVip, setIsVip] = useState<boolean>(() => {
    return safeStorage.getItem("phantom_is_vip") === "true";
  });
  const [vipDetails, setVipDetails] = useState<VipCheckResponse | null>(() => {
    try {
      const cached = safeStorage.getItem("phantom_vip_details");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [isPro, setIsPro] = useState<boolean>(() => {
    return safeStorage.getItem("phantom_is_pro") === "true";
  });
  const [proDetails, setProDetails] = useState<any>(() => {
    try {
      const cached = safeStorage.getItem("phantom_pro_details");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });
  const [roomType, setRoomType] = useState<"private" | "group">("private");
  const [showProWarningModal, setShowProWarningModal] = useState(false);
  const [showNowPaymentsWidgetModal, setShowNowPaymentsWidgetModal] = useState(false);
  const [widgetInvoiceId, setWidgetInvoiceId] = useState<string | null>(null);
  const [paymentSuccessNotice, setPaymentSuccessNotice] = useState(false);
  const [pusherWarning, setPusherWarning] = useState<string | null>(null);
  const [proOpInput, setProOpInput] = useState("");

  // Initialize NOWPaymentsWidget object if widget script is loaded
  useEffect(() => {
    if (!showNowPaymentsWidgetModal || !widgetInvoiceId) return;
    const invId = widgetInvoiceId;
    try {
      if (typeof (window as any).NOWPaymentsWidget === "function") {
        new (window as any).NOWPaymentsWidget({
          invoiceId: invId,
          containerId: "nowpayments-widget-container"
        });
      }
    } catch (e) {
      console.warn("NOWPaymentsWidget JS init error:", e);
    }
  }, [showNowPaymentsWidgetModal, widgetInvoiceId]);

  // Polling for NOWPayments Pro status update from Cloudflare D1 while widget modal is open
  useEffect(() => {
    if (!showNowPaymentsWidgetModal || !myDna) return;
    let isCancelled = false;

    const checkProStatus = async () => {
      try {
        const res = await fetch(`/api/database/pro/check/${myDna}`);
        const data = await res.json();
        if (!isCancelled && data && data.isPro) {
          requestAnimationFrame(() => {
            setIsPro(true);
            setProDetails(data);
            safeStorage.setItem("phantom_is_pro", "true");
            safeStorage.setItem("phantom_pro_details", JSON.stringify(data));
            setShowNowPaymentsWidgetModal(false);
            setPaymentSuccessNotice(true);
          });
        }
      } catch (err) {
        console.warn("Pro status polling check error:", err);
      }
    };

    checkProStatus();
    const interval = setInterval(checkProStatus, 5000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [showNowPaymentsWidgetModal, myDna]);

  // Listen for postMessage events from NOWPayments widget iframe
  useEffect(() => {
    const handleWidgetMessage = (e: MessageEvent) => {
      if (
        (e.origin && e.origin.includes("nowpayments.io")) ||
        e.data?.payment_status === "finished" ||
        e.data?.status === "success"
      ) {
        fetch(`/api/database/pro/check/${myDna}`)
          .then((res) => res.json())
          .then((data) => {
            if (data && data.isPro) {
              setIsPro(true);
              setProDetails(data);
              safeStorage.setItem("phantom_is_pro", "true");
              safeStorage.setItem("phantom_pro_details", JSON.stringify(data));
              setShowNowPaymentsWidgetModal(false);
              setPaymentSuccessNotice(true);
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener("message", handleWidgetMessage);
    return () => window.removeEventListener("message", handleWidgetMessage);
  }, [myDna]);

  // Listen for custom phantom_pro_updated events to trigger server-authoritative status refresh
  useEffect(() => {
    const handleProUpdate = (e?: Event) => {
      const customEvt = e as CustomEvent<{ deviceId?: string }>;
      const targetDna =
        customEvt?.detail?.deviceId ||
        safeStorage.getItem("phantom_device_id") ||
        safeStorage.getItem("deviceId") ||
        myDna;

      if (targetDna) {
        const cleanDna = targetDna.trim().toUpperCase();

        // Edge KV check
        fetch(`/api/check-pro?dna=${encodeURIComponent(cleanDna)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.isPro) {
              setIsPro(true);
              setProDetails(data);
              safeStorage.setItem("phantom_is_pro", "true");
              safeStorage.setItem("phantom_pro_whitelisted", "true");
              if (data.expiry) safeStorage.setItem("phantom_pro_expiry", String(data.expiry));
              safeStorage.setItem("phantom_pro_details", JSON.stringify(data));
            }
          })
          .catch(() => {});

        // Authoritative D1 check
        fetch(`/api/database/pro/check/${encodeURIComponent(cleanDna)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            const serverPro = Boolean(data && data.isPro);
            setIsPro(serverPro);
            setProDetails(serverPro ? data : null);
            if (serverPro) {
              safeStorage.setItem("phantom_is_pro", "true");
              safeStorage.setItem("phantom_pro_whitelisted", "true");
              if (data.expiry) safeStorage.setItem("phantom_pro_expiry", String(data.expiry));
              safeStorage.setItem("phantom_pro_details", JSON.stringify(data));
            } else {
              if (safeStorage.getItem("phantom_is_pro") !== "true") {
                safeStorage.removeItem("phantom_is_pro");
                safeStorage.removeItem("phantom_pro_details");
                safeStorage.removeItem("phantom_pro_whitelisted");
                safeStorage.removeItem("phantom_pro_expiry");
              }
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener("phantom_pro_updated", handleProUpdate);
    return () => window.removeEventListener("phantom_pro_updated", handleProUpdate);
  }, [myDna]);

  useEffect(() => {
    safeStorage.setItem("phantom_gender", gender);
  }, [gender]);

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [captchaError, setCaptchaError] = useState("");

  // Turnstile widget handled by TurnstileWidget component

  // Room states
  const [timerSeconds, setTimerSeconds] = useState(FREE_TIER_ROOM_TIMER_SECONDS); // Default 120s (2m) for free tier
  const [copiedDeviceId, setCopiedDeviceId] = useState(false);
  const [copiedDeviceIdToast, setCopiedDeviceIdToast] = useState(false);
  const [inputRoomCode, setInputRoomCode] = useState("");
  const [activeRoom, setActiveRoom] = useState<RoomConfig | null>(null);
  const [roomMessages, setRoomMessages] = useState<Message[]>([]);
  const [isStegoMode, setIsStegoMode] = useState(false);
  const [roomKey, setRoomKey] = useState<CryptoKey | null>(null);

  // Realtime Firebase RTDB Pro License listener for instant cross-device sync
  useEffect(() => {
    const targetDna = safeStorage.getItem("phantom_device_id") || myDna;
    if (!targetDna) return;
    const cleanDna = targetDna.trim().toUpperCase();
    const unsubPro = subscribeToProLicense(cleanDna, (proData) => {
      if (proData && proData.isPro) {
        setIsPro(true);
        setProDetails(proData);
        safeStorage.setItem("phantom_is_pro", "true");
        safeStorage.setItem("phantom_pro_whitelisted", "true");
        if (proData.expiry) {
          safeStorage.setItem("phantom_pro_expiry", String(proData.expiry));
        }
        safeStorage.setItem("phantom_pro_details", JSON.stringify(proData));
      }
    });

    return () => {
      unsubPro();
    };
  }, [myDna]);

  // Global Clearance Verification API Sync with Cloudflare Edge on startup & room entry
  useEffect(() => {
    let isCancelled = false;

    const verifyProWithEdge = async () => {
      try {
        const targetDna =
          safeStorage.getItem("phantom_device_id") ||
          safeStorage.getItem("deviceId") ||
          myDna;
        if (!targetDna) return;
        const cleanDna = targetDna.trim().toUpperCase();

        // 1. Query Cloudflare KV endpoint
        const res = await fetch(`/api/check-pro?dna=${encodeURIComponent(cleanDna)}`);
        if (res.ok) {
          const data = await res.json();
          if (isCancelled) return;
          if (data && data.isPro) {
            setIsPro(true);
            setProDetails(data);
            safeStorage.setItem("phantom_is_pro", "true");
            safeStorage.setItem("phantom_pro_whitelisted", "true");
            if (data.expiry) {
              safeStorage.setItem("phantom_pro_expiry", String(data.expiry));
            }
            safeStorage.setItem("phantom_pro_details", JSON.stringify(data));
            return;
          }
        }

        // 2. Query authoritative D1 Pro check endpoint
        const d1Res = await fetch(`/api/database/pro/check/${encodeURIComponent(cleanDna)}`);
        if (d1Res.ok) {
          const d1Data = await d1Res.json();
          if (isCancelled) return;
          if (d1Data && d1Data.isPro) {
            setIsPro(true);
            setProDetails(d1Data);
            safeStorage.setItem("phantom_is_pro", "true");
            safeStorage.setItem("phantom_pro_whitelisted", "true");
            if (d1Data.expiry) {
              safeStorage.setItem("phantom_pro_expiry", String(d1Data.expiry));
            }
            safeStorage.setItem("phantom_pro_details", JSON.stringify(d1Data));
          }
        }
      } catch (err) {
        console.warn("[Global Pro Sync] Error checking edge clearance:", err);
      }
    };

    verifyProWithEdge();
  }, [myDna, activeRoom]);
  const roomKeyRef = useRef<CryptoKey | null>(null);
  roomKeyRef.current = roomKey;

  // Derive in-memory CryptoKey whenever activeRoom changes
  useEffect(() => {
    let isMounted = true;
    if (activeRoom?.roomCode) {
      deriveRoomKey(activeRoom.roomCode)
        .then((key) => {
          if (isMounted) {
            setRoomKey(key);
            roomKeyRef.current = key;
          }
        })
        .catch((err) => {
          console.error("Key derivation error:", err);
          if (isMounted) {
            setRoomKey(null);
            roomKeyRef.current = null;
          }
        });
    } else {
      setRoomKey(null);
      roomKeyRef.current = null;
    }
    return () => {
      isMounted = false;
    };
  }, [activeRoom?.roomCode]);

  const decryptIncomingMessage = async (msg: Message, key: CryptoKey | null): Promise<Message> => {
    if (!msg) return msg;
    if (!msg.isEncrypted || !msg.ciphertext || !msg.iv) {
      return msg;
    }
    const activeKey = key || roomKeyRef.current;
    if (!activeKey) {
      return {
        ...msg,
        text: msg.text || "[Decryption Key Pending]",
      };
    }
    try {
      const decrypted = await decryptPayload(msg.ciphertext, msg.iv, activeKey);
      if (msg.type === "image" || msg.type === "audio") {
        return {
          ...msg,
          mediaUrl: decrypted,
          fileUrl: decrypted,
        };
      }
      return {
        ...msg,
        text: decrypted,
      };
    } catch (err) {
      console.warn("E2EE Decryption error for message:", msg.id, err);
      return {
        ...msg,
        text: "[Decryption Error / Unreadable Payload]",
      };
    }
  };

  const decryptMessageList = async (list: Message[], key: CryptoKey | null): Promise<Message[]> => {
    return Promise.all(list.map((m) => decryptIncomingMessage(m, key)));
  };

  // Re-decrypt any encrypted messages when roomKey becomes available
  useEffect(() => {
    if (roomKey && roomMessages.some((m) => m.isEncrypted && (m.ciphertext || m.iv))) {
      decryptMessageList(roomMessages, roomKey).then((decryptedList) => {
        setRoomMessages(decryptedList);
      });
    }
  }, [roomKey]);

  // WebRTC P2P Transfer State
  const [p2pTransferState, setP2pTransferState] = useState<{
    role: "sender" | "receiver";
    fileName: string;
    fileSize: number;
    progress: number;
    status: "connecting" | "waiting" | "streaming" | "complete" | "error" | "declined";
    errorMessage?: string;
    isDirect?: boolean;
    canRetry?: boolean;
  } | null>(null);

  const [incomingP2POffer, setIncomingP2POffer] = useState<{
    transferId: string;
    senderName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  } | null>(null);

  const p2pManagerRef = useRef<P2PTransferManager | null>(null);
  const processedP2PSignalsRef = useRef<Set<string>>(new Set());
  const lastP2PFileRef = useRef<File | null>(null);

  // Subscribe to WebRTC P2P signals when activeRoom changes (Strictly 1-to-1 Private Rooms Only)
  useEffect(() => {
    if (!activeRoom?.roomCode || !myDna) return;

    // Fail closed: Do NOT subscribe to or accept P2P signals in group rooms or Global Lobby
    const isOneToOne =
      activeRoom.roomType !== "group" &&
      activeRoom.roomCode !== "global-lobby" &&
      (!activeRoom.maxPeers || activeRoom.maxPeers <= 2);

    if (!isOneToOne) {
      return;
    }

    processedP2PSignalsRef.current.clear();

    const unsubscribeSignals = subscribeP2PSignals(
      activeRoom.roomCode,
      myDna,
      async (signals) => {
        for (const signal of signals) {
          if (!signal || !signal.id) continue;
          if (processedP2PSignalsRef.current.has(signal.id)) continue;

          // Validate sender is a verified participant of this 1-on-1 room
          const validPeers = (activeRoom.participants || [])
            .filter((p) => p && p.toUpperCase() !== myDna.toUpperCase())
            .map((p) => p.toUpperCase());
          if (activeRoom.creatorDna && activeRoom.creatorDna.toUpperCase() !== myDna.toUpperCase()) {
            validPeers.push(activeRoom.creatorDna.toUpperCase());
          }
          const senderUpper = (signal.senderDna || "").toUpperCase();
          if (!validPeers.includes(senderUpper)) {
            console.warn("[P2P Receiver] Ignored signal from non-participant:", signal.senderDna);
            continue;
          }

          // If incoming offer
          if (signal.type === "offer" && signal.sdp) {
            processedP2PSignalsRef.current.add(signal.id);
            clearP2PSignal(activeRoom.roomCode, myDna, signal.id);

            // Permit only one active transfer per room/session
            if (p2pTransferState && ["connecting", "waiting", "streaming"].includes(p2pTransferState.status)) {
              console.warn("[P2P Receiver] Another transfer is already active; rejecting new offer");
              continue;
            }

            if (p2pManagerRef.current) {
              p2pManagerRef.current.close();
            }

            const receiver = new P2PTransferManager();
            p2pManagerRef.current = receiver;
            const senderDna = signal.senderDna || "PEER";

            setP2pTransferState({
              role: "receiver",
              fileName: "incoming_file",
              fileSize: 0,
              progress: 0,
              status: "connecting",
              isDirect: false,
            });

            await receiver.initReceiver(
              signal.sdp,
              async (outSignal) => {
                const sigRes = await sendP2PSignal(activeRoom.roomCode, senderDna, {
                  ...outSignal,
                  senderDna: myDna,
                });
                if (!sigRes.success) {
                  console.warn("[P2P Receiver] Signal write failed:", sigRes.error);
                }
              },
              (file) => {
                // File transfer complete!
                const fileUrl = URL.createObjectURL(file);
                const isImg = file.type.startsWith("image/");
                const p2pMsg: Message = {
                  id: `p2p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                  roomCode: activeRoom.roomCode,
                  type: isImg ? "image" : "text",
                  senderDna,
                  nickname: "P2P PEER",
                  text: `[P2P FILE RECEIVED: ${file.name}]`,
                  mediaUrl: fileUrl,
                  fileUrl: fileUrl,
                  timestamp: Date.now(),
                };

                setRoomMessages((prev) => [...prev, p2pMsg]);
                setP2pTransferState({
                  role: "receiver",
                  fileName: file.name,
                  fileSize: file.size,
                  progress: 100,
                  status: "complete",
                });

                // Automatically trigger browser download for non-image files with valid size
                if (!isImg && file.size > 0) {
                  try {
                    const a = document.createElement("a");
                    a.href = fileUrl;
                    a.download = file.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  } catch {}
                }

                                setTimeout(() => {
                  receiver.close();
                  p2pManagerRef.current = null;
                  setP2pTransferState(null);
                  setIncomingP2POffer(null);
                }, 2500);
              },
              (progress) => {
                setP2pTransferState((prev) => (prev ? { ...prev, progress, status: "streaming" } : null));
              },
              (fileOffer) => {
                // Show Receiver Confirmation Modal (Peer B)
                setP2pTransferState((prev) =>
                  prev
                    ? {
                        ...prev,
                        fileName: fileOffer.fileName,
                        fileSize: fileOffer.fileSize,
                        status: "waiting",
                        isDirect: true,
                      }
                    : null
                );
                setIncomingP2POffer(fileOffer);
              },
              (errMsg) => {
                setP2pTransferState({
                  role: "receiver",
                  fileName: incomingP2POffer?.fileName || "incoming_file",
                  fileSize: incomingP2POffer?.fileSize || 0,
                  progress: 0,
                  status: "error",
                  errorMessage: errMsg,
                  canRetry: false,
                });
                receiver.close();
                p2pManagerRef.current = null;
              }
            );
          } else if (signal.type === "answer" || signal.type === "candidate") {
            if (!p2pManagerRef.current) {
              continue;
            }
            processedP2PSignalsRef.current.add(signal.id);
            clearP2PSignal(activeRoom.roomCode, myDna, signal.id);
            await p2pManagerRef.current.handleSignal(signal);
          }
        }
      }
    );

    return () => {
      unsubscribeSignals();
      if (p2pManagerRef.current) {
        p2pManagerRef.current.close();
        p2pManagerRef.current = null;
      }
    };
  }, [activeRoom?.roomCode, activeRoom?.roomType, myDna]);

  // Peer B accepts incoming P2P file offer
  const handleAcceptP2POffer = (transferId: string) => {
    if (!p2pManagerRef.current || !incomingP2POffer) return;
    p2pManagerRef.current.sendFileResponse(transferId, true);
    setP2pTransferState({
      role: "receiver",
      fileName: incomingP2POffer.fileName,
      fileSize: incomingP2POffer.fileSize,
      progress: 0,
      status: "streaming",
      isDirect: true,
    });
    setIncomingP2POffer(null);
      };

  // Peer B declines incoming P2P file offer
  const handleDeclineP2POffer = (transferId: string) => {
    if (p2pManagerRef.current) {
      p2pManagerRef.current.sendFileResponse(transferId, false);
      const mgr = p2pManagerRef.current;
      setTimeout(() => {
        mgr.close();
        if (p2pManagerRef.current === mgr) {
          p2pManagerRef.current = null;
        }
      }, 300);
    }
    setIncomingP2POffer(null);
    setP2pTransferState(null);
      };

  // Handle P2P File Selection (Sender side - Peer A)
  const handleP2PFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !activeRoom) return;

    // Reset input value so same file can be selected again
    e.target.value = "";
    lastP2PFileRef.current = rawFile;

    // Enforce 1-on-1 private rooms only (fail closed)
    const isOneToOne =
      activeRoom.roomType !== "group" &&
      activeRoom.roomCode !== "global-lobby" &&
      (!activeRoom.maxPeers || activeRoom.maxPeers <= 2);

    if (!isOneToOne) {
            return;
    }

    // Permit only one active transfer per room/session
    if (p2pTransferState && ["connecting", "waiting", "streaming"].includes(p2pTransferState.status)) {
            return;
    }

    // Determine target recipient DNA from other room participants
    const otherParticipants = (activeRoom.participants || []).filter(
      (p) => p && p.toUpperCase() !== myDna.toUpperCase()
    );
    let recipientDna = otherParticipants[0];
    if (!recipientDna && activeRoom.creatorDna && activeRoom.creatorDna.toUpperCase() !== myDna.toUpperCase()) {
      recipientDna = activeRoom.creatorDna;
    }

    if (!recipientDna) {
      setP2pTransferState({
        role: "sender",
        fileName: rawFile.name,
        fileSize: rawFile.size,
        progress: 0,
        status: "waiting",
        errorMessage: "Waiting for the other person to join this room.",
        canRetry: true,
      });
            return;
    }

    if (p2pManagerRef.current) {
      p2pManagerRef.current.close();
    }

    const sender = new P2PTransferManager();
    p2pManagerRef.current = sender;
    const transferId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    setP2pTransferState({
      role: "sender",
      fileName: rawFile.name,
      fileSize: rawFile.size,
      progress: 0,
      status: "connecting",
      isDirect: false,
      canRetry: false,
    });

        try {
      await sender.initSender(
        async (outSignal) => {
          const sigRes = await sendP2PSignal(activeRoom.roomCode, recipientDna, {
            ...outSignal,
            senderDna: myDna,
            transferId,
          });
          if (!sigRes.success) {
            throw new Error(sigRes.error || "Failed to deliver signaling offer to peer");
          }
        },
        (progress) => {
          setP2pTransferState((prev) => (prev ? { ...prev, progress } : null));
        },
        (errMsg) => {
          setP2pTransferState({
            role: "sender",
            fileName: rawFile.name,
            fileSize: rawFile.size,
            progress: 0,
            status: "error",
            errorMessage: errMsg,
            canRetry: true,
          });
          sender.close();
          p2pManagerRef.current = null;
        }
      );

      // Wait for DataChannel to open and confirm direct connectivity
      await sender.waitForOpen(20000);
      const directCheck = await sender.verifyDirectConnectivity();
      if (!directCheck.isDirect) {
        throw new Error(directCheck.details || "Direct P2P link could not be established (relayed connections disallowed).");
      }

      setP2pTransferState((prev) => (prev ? { ...prev, status: "waiting", isDirect: true } : null));
            // Step 1: Request permission from Peer B via file-offer
      const accepted = await sender.requestFilePermission({
        transferId,
        senderName: nickname || "OPERATIVE",
        fileName: rawFile.name,
        fileSize: rawFile.size,
        fileType: rawFile.type || "application/octet-stream",
      });

      if (!accepted) {
                setP2pTransferState({
          role: "sender",
          fileName: rawFile.name,
          fileSize: rawFile.size,
          progress: 0,
          status: "declined",
          errorMessage: "Peer declined the incoming file transfer.",
          canRetry: true,
        });
        sender.close();
        p2pManagerRef.current = null;
        return;
      }

      // Step 2: Peer B accepted — stream file slices directly from File object over RTCDataChannel
      setP2pTransferState((prev) => (prev ? { ...prev, status: "streaming", progress: 0 } : null));

      await sender.sendFile(rawFile, (progress) => {
        setP2pTransferState((prev) => (prev ? { ...prev, status: "streaming", progress } : null));
      });

      // Step 3: Transfer complete
      setP2pTransferState((prev) => (prev ? { ...prev, status: "complete", progress: 100 } : null));
            // Post sender's optimistic confirmation message in room
      const fileUrl = URL.createObjectURL(rawFile);
      const isImg = rawFile.type.startsWith("image/");
      const p2pMsg: Message = {
        id: `p2p_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        roomCode: activeRoom.roomCode,
        type: isImg ? "image" : "text",
        senderDna: myDna,
        nickname: nickname || "OPERATIVE",
        text: `[P2P FILE SENT: ${rawFile.name}]`,
        mediaUrl: fileUrl,
        fileUrl: fileUrl,
        timestamp: Date.now(),
      };
      setRoomMessages((prev) => [...prev, p2pMsg]);

      setTimeout(() => {
        sender.close();
        p2pManagerRef.current = null;
        setP2pTransferState(null);
      }, 2500);
    } catch (err: any) {
      const errMsg = err?.message || "P2P transfer failed";
      console.error("P2P File Transfer failed:", err);
            sender.close();
      p2pManagerRef.current = null;
      setP2pTransferState({
        role: "sender",
        fileName: rawFile.name,
        fileSize: rawFile.size,
        progress: 0,
        status: "error",
        errorMessage: errMsg,
        canRetry: true,
      });
    }
  };

  const handleRetryP2P = () => {
    if (lastP2PFileRef.current) {
      const fakeEvent = {
        target: {
          files: [lastP2PFileRef.current],
          value: "",
        },
      } as any;
      handleP2PFileSelected(fakeEvent);
    }
  };

  const handleCancelP2P = () => {
    if (p2pManagerRef.current) {
      p2pManagerRef.current.close();
      p2pManagerRef.current = null;
    }
    setP2pTransferState(null);
    setIncomingP2POffer(null);
  };

  const [isDecoyActive, setIsDecoyActive] = useState<boolean>(() => isDecoyModeActiveSession());

  const handleTriggerPanic = () => {
    triggerDecoyMode({
      onCloseConnections: () => {
        if (streamEventSourceRef.current) {
          streamEventSourceRef.current.close();
          streamEventSourceRef.current = null;
        }
        if (unsubscribeRtdbMessagesRef.current) {
          try {
            unsubscribeRtdbMessagesRef.current();
            unsubscribeRtdbMessagesRef.current = null;
          } catch {}
        }
        if (p2pManagerRef.current) {
          p2pManagerRef.current.close();
          p2pManagerRef.current = null;
        }
      },
      onClearKeys: () => {
        setRoomKey(null);
        roomKeyRef.current = null;
      },
      onSetDecoyActive: (active) => {
        setIsDecoyActive(active);
      },
    });
      };

  const handleExitPanic = () => {
    exitDecoyMode({
      onSetDecoyActive: (active) => {
        setIsDecoyActive(active);
      },
    });
      };


  // Check shareable room links on app load / navigation
  useEffect(() => {
    const checkRoom = async (code: string) => {
      setIsCheckingLinkRoom(true);
      try {
        const res = await fetch(`/api/database/room/${code}?requesterDna=${myDna}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          const isFull = res.status === 403 && (errData?.status === "ROOM_FULL" || errData?.error?.toLowerCase().includes("full"));
          if (isFull) {
            setLinkRoomFull(true);
            setLinkRoomExpired(false);
          } else {
            setLinkRoomExpired(true);
            setLinkRoomFull(false);
          }
          setRoute("gate");
        } else {
          const data: any = await res.json();
          const roomData: RoomConfig = data.room || data;
          if (roomData.hasExpired || (roomData.remainingSeconds !== undefined && roomData.remainingSeconds <= 0)) {
            setLinkRoomExpired(true);
            setLinkRoomFull(false);
            setRoute("gate");
          } else {
            setLinkRoomExpired(false);
            setLinkRoomFull(false);
            setRoute("gate");
          }
        }
      } catch (err) {
        console.error("Failed to check shareable room link:", err);
        setLinkRoomExpired(true);
        setLinkRoomFull(false);
        setRoute("gate");
      } finally {
        setIsCheckingLinkRoom(false);
      }
    };

    const runCheck = () => {
      let code = "";
      const pathMatch = window.location.pathname.match(/^\/room\/([0-9a-zA-Z]+)/);
      if (pathMatch) {
        code = pathMatch[1];
      } else {
        const hashMatch = window.location.hash.match(/^#room=([0-9a-zA-Z]+)/);
        if (hashMatch) {
          code = hashMatch[1];
        } else {
          const searchParams = new URLSearchParams(window.location.search);
          const qCode = searchParams.get("room");
          if (qCode) code = qCode;
        }
      }
      if (code) {
        setInputRoomCode(code);
        checkRoom(code);
      }
    };

    runCheck();

    window.addEventListener("popstate", runCheck);
    window.addEventListener("hashchange", runCheck);
    return () => {
      window.removeEventListener("popstate", runCheck);
      window.removeEventListener("hashchange", runCheck);
    };
  }, [myDna]);

  const handleResetExpiredRoom = () => {
    setLinkRoomExpired(false);
    setLinkRoomFull(false);
    setInputRoomCode("");
    window.history.pushState({}, "", "/terminal");
    setRoute("gate");
  };
  const [isPingSoundEnabled, setIsPingSoundEnabled] = useState<boolean>(() => {
    const saved = safeStorage.getItem("phantom_ping_sound");
    return saved !== "false";
  });

  useEffect(() => {
    safeStorage.setItem("phantom_ping_sound", String(isPingSoundEnabled));
  }, [isPingSoundEnabled]);

  const playPingSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
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
    } catch (err) {
      console.warn("Audio blocked/unsupported:", err);
    }
  };
  const [dissolveActive, setDissolveActive] = useState(false);

  // Chat panel inputs
  const [messageText, setMessageText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState<string | null>(null);
  const [uploadPhotoError, setUploadPhotoError] = useState<string | null>(null);
  const [failedPhotoData, setFailedPhotoData] = useState<{ base64: string; extension: string } | null>(null);
  const [mediaCounter, setMediaCounter] = useState(() => getDailyMediaUploadCount());
  const isUploadCapReached = !isPro && (isVip ? mediaCounter >= VIP_TIER_DAILY_MEDIA_LIMIT : mediaCounter >= FREE_TIER_DAILY_MEDIA_LIMIT);
  const [isPremiumVerified, setIsPremiumVerified] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined" && window.sessionStorage) {
        return sessionStorage.getItem("phantom_premium_verified") === "true";
      }
    } catch {}
    return false;
  });

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const downloadImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      const filename = url.split("/").pop()?.split("?")[0] || "phantom_secure_image.jpg";
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Direct download failed, opening in new window:", error);
      window.open(url, "_blank");
    }
  };

  const copyMessageText = (msgId: string, text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedMessageId(msgId);
    setCopiedText(true);
    setTimeout(() => {
      setCopiedMessageId(null);
      setCopiedText(false);
    }, 2000);
  };

  // Feature States: Blur reveal, Streak and Typing
  const [revealedMediaIds, setRevealedMediaIds] = useState<Set<string>>(new Set());
  const toggleRevealMedia = (msgId: string) => {
    setRevealedMediaIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  };

  const [streakDays, setStreakDays] = useState<number>(1);
  const [activeRoomTypers, setActiveRoomTypers] = useState<string[]>([]);
  const roomTypingTimeoutRef = useRef<any>(null);
  const isRoomTypingRef = useRef<boolean>(false);

  const sendRoomTypingStatus = async (isTyping: boolean) => {
    if (!activeRoom) return;
    try {
      await fetch(`/api/rooms/typing/${activeRoom.roomCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senderDna: myDna, isTyping }),
      });
    } catch (err) {
      console.error("Error sending room typing status:", err);
    }
  };

  const handleRoomUserTyping = () => {
    if (!activeRoom) return;
    if (!isRoomTypingRef.current) {
      isRoomTypingRef.current = true;
      sendRoomTypingStatus(true);
    }

    if (roomTypingTimeoutRef.current) {
      clearTimeout(roomTypingTimeoutRef.current);
    }

    roomTypingTimeoutRef.current = setTimeout(() => {
      isRoomTypingRef.current = false;
      sendRoomTypingStatus(false);
    }, 3000);
  };

  // PWA Support Prompt State & Schema.org Structured Data
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => (window as any).deferredPrompt || null);
  const [showPwaGuide, setShowPwaGuide] = useState(false);
  const [pwaGuideTab, setPwaGuideTab] = useState<"ios" | "android">("ios");
  const [isPwaInstalled, setIsPwaInstalled] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined" && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    // Burn streak calculation
    const lastOpenStr = safeStorage.getItem("phantom_last_open_time");
    const streakStr = safeStorage.getItem("phantom_streak_count");
    const now = Date.now();
    
    let currentStreak = 1;
    if (streakStr) {
      currentStreak = parseInt(streakStr, 10);
    }

    if (lastOpenStr) {
      const lastOpen = parseInt(lastOpenStr, 10);
      const lastDate = new Date(lastOpen);
      const nowDate = new Date(now);

      const lastDateStr = `${lastDate.getFullYear()}-${lastDate.getMonth()}-${lastDate.getDate()}`;
      const nowDateStr = `${nowDate.getFullYear()}-${nowDate.getMonth()}-${nowDate.getDate()}`;

      if (lastDateStr !== nowDateStr) {
        const oneDayMs = 24 * 60 * 60 * 1000;
        const diffMs = now - lastOpen;

        if (diffMs < oneDayMs * 2) {
          currentStreak += 1;
        } else {
          currentStreak = 1;
        }
        safeStorage.setItem("phantom_streak_count", currentStreak.toString());
      }
    } else {
      safeStorage.setItem("phantom_streak_count", "1");
    }

    safeStorage.setItem("phantom_last_open_time", now.toString());
    setStreakDays(currentStreak);

    // Sync early captured prompt if available
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).deferredPrompt = e;
      console.log("PWA install prompt deferred inside React.");
    };

    // Callback for early capture script in index.html
    (window as any).onDeferredPromptReceived = (e: any) => {
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsPwaInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredPrompt = null;
      console.log("PWA successfully installed.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Ingress Structured Data injection dynamically (SEO AI indexers)
    const schemaScriptId = "phantom-struct-data";
    let existingScript = document.getElementById(schemaScriptId);
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = schemaScriptId;
      script.type = "application/ld+json";
      script.text = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "SoftwareApplication",
            "name": "Phantom Chat",
            "operatingSystem": "All",
            "applicationCategory": "CommunicationApplication",
            "description": "Lightning-fast, anonymous, ephemeral 1-on-1 and group chat terminal with true identity-less communication. Zero account logs or trace registries.",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            }
          },
          {
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How do I maintain absolute anonymity on Phantom Chat?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Phantom Chat requires zero registered credentials—no emails, no phone numbers, and no profiles. Joining generates a temporary cryptographic DNA signature on-device, offering a complete anonymous chat experience."
                }
              },
              {
                "@type": "Question",
                "name": "Are chat logs persisted or stored?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "No. All messages, files, and channels crumble permanently when the room's self-destruct countdown values expire, purged securely from transient memory storage."
                }
              }
            ]
          }
        ]
      });
      document.head.appendChild(script);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if ('onDeferredPromptReceived' in window) {
        delete (window as any).onDeferredPromptReceived;
      }
    };
  }, []);

  const triggerPwaInstall = async () => {
    const activePrompt = deferredPrompt || (window as any).deferredPrompt;
    if (!activePrompt) {
      // Auto-detect if user is on iOS to pre-select correct instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setPwaGuideTab(isIOS ? "ios" : "android");
      setShowPwaGuide(true);
      return;
    }
    try {
      activePrompt.prompt();
      const { outcome } = await activePrompt.userChoice;
      if (outcome === "accepted") {
        setIsPwaInstalled(true);
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
      }
    } catch (err) {
      console.error("Direct PWA prompt error, falling back to guide:", err);
      setShowPwaGuide(true);
    }
  };

  // Side Navigation Drawer (Subscription Hamburger Menu)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAboutUpgrade, setShowAboutUpgrade] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; sender: string; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [linkRoomExpired, setLinkRoomExpired] = useState(false);
  const [linkRoomFull, setLinkRoomFull] = useState(false);
  const [isCheckingLinkRoom, setIsCheckingLinkRoom] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [saleRegion, setSaleRegion] = useState<"INR" | "USD">("INR");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [selectedSubCard, setSelectedSubCard] = useState<number | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [roomLifecycleStatus, setRoomLifecycleStatus] = useState<"CREATING" | "READY" | "CONNECTING" | "ACTIVE" | "CREATE_FAILED" | "CONNECTION_FAILED" | "ROOM_NOT_FOUND" | "ROOM_EXPIRED">("ACTIVE");
  const [roomConnectionStatus, setRoomConnectionStatus] = useState<"CONNECTING" | "CONNECTED" | "CONNECTION_ERROR">("CONNECTED");
  const [connectionRetryTrigger, setConnectionRetryTrigger] = useState(0);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Accessible keyboard Escape handling for drawer and modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (sidebarOpen) setSidebarOpen(false);
        if (showProWarningModal) setShowProWarningModal(false);
        if (showPwaGuide) setShowPwaGuide(false);
        if (showPaymentModal) setShowPaymentModal(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, showProWarningModal, showPwaGuide, showPaymentModal]);
  
  // Negotiation Envelope composer state
  const [prefilledNegotiation, setPrefilledNegotiation] = useState<{
    recipientDna: string;
    ideaId: string;
    ideaTitle: string;
    subject: string;
    body: string;
    conversationType: "DISCUSS" | "CHALLENGE" | "COLLABORATE" | "NEGOTIATE";
  } | null>(() => {
    try {
      const stored = sessionStorage.getItem("phantom_prefilled_negotiation");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const handleOpenNegotiation = (data: {
    recipientDna: string;
    ideaId: string;
    ideaTitle: string;
    subject: string;
    body: string;
    conversationType: "DISCUSS" | "CHALLENGE" | "COLLABORATE" | "NEGOTIATE";
  }) => {
    setPrefilledNegotiation(data);
    try {
      sessionStorage.setItem("phantom_prefilled_negotiation", JSON.stringify(data));
    } catch {}
    navigateTo("inbox");
  };

  const handleClearPrefilledNegotiation = () => {
    setPrefilledNegotiation(null);
    try {
      sessionStorage.removeItem("phantom_prefilled_negotiation");
    } catch {}
  };

  const [prefilledInboxRecipient, setPrefilledInboxRecipient] = useState<string | null>(null);

  const handleInviteToInbox = (targetDna: string) => {
    setPrefilledInboxRecipient(targetDna);
    setPrefilledNegotiation(null);
    try {
      sessionStorage.removeItem("phantom_prefilled_negotiation");
    } catch {}
    navigateTo("inbox");
  };

  // Audio and File refs
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
  const desktopFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mobileChatEndRef = useRef<HTMLDivElement>(null);
  const desktopChatEndRef = useRef<HTMLDivElement>(null);
  const mobileChatContainerRef = useRef<HTMLDivElement>(null);
  const desktopChatContainerRef = useRef<HTMLDivElement>(null);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);

  const handleChatScroll = () => {
    const activeContainer = window.innerWidth < 1024 ? mobileChatContainerRef.current : desktopChatContainerRef.current;
    if (activeContainer) {
      const { scrollTop, scrollHeight, clientHeight } = activeContainer;
      // Use 50px buffer to prevent subpixel issues while keeping scroll lock tight
      const atBottom = scrollHeight - scrollTop - clientHeight <= 50;
      isAtBottomRef.current = atBottom;
      setIsScrolledToBottom(atBottom);
    }
  };
  const recordingTimerRef = useRef<any>(null);
  const streamEventSourceRef = useRef<EventSource | null>(null);
  const roomCreatedAtRef = useRef<number | null>(null);
  const roomDurationRef = useRef<number>(FREE_TIER_ROOM_TIMER_SECONDS);
  const unsubscribeRtdbMessagesRef = useRef<(() => void) | null>(null);
  const unsubscribeRtdbConfigRef = useRef<(() => void) | null>(null);

  // Keep checking location hash / path in case of browser navigation
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname === "/inbox") {
        setRoute("inbox");
      } else if (window.location.pathname === "/friends") {
        setRoute("friends");
      } else if (window.location.pathname === "/contacts") {
        window.history.replaceState({}, "", "/friends");
        setRoute("friends");
      } else if (window.location.pathname === "/ideas") {
        setRoute("ideas");
      } else if (window.location.pathname === "/globallobby") {
        setRoute("globallobby");
      } else if (window.location.pathname === "/world-chat") {
        window.history.replaceState({}, "", "/globallobby");
        setRoute("globallobby");
      } else if (window.location.pathname.toLowerCase() === "/faq") {
        setRoute("faq");
      } else if (window.location.pathname === "/premium") {
        setRoute("premium");
      } else if (window.location.pathname === "/clearance") {
        window.history.replaceState({}, "", "/premium");
        setRoute("premium");
      } else if (window.location.pathname === "/terminal") {
        setActiveRoom(null);
        setRoute("gate");
      } else if (window.location.pathname.startsWith("/room/")) {
        const match = window.location.pathname.match(/^\/room\/([0-9a-zA-Z]+)/);
        if (match) {
          const code = match[1];
          setInputRoomCode(code);
          if (!activeRoom || activeRoom.roomCode !== code) {
            setRoute("gate");
          } else {
            setRoute("chat");
          }
        } else {
          setRoute("gate");
        }
      } else {
        setActiveRoom(null);
        setRoute("landing");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [activeRoom]);

  // Keep global media upload counter synced across all rooms without resets
  useEffect(() => {
    setMediaCounter(getDailyMediaUploadCount());
  }, [activeRoom?.roomCode]);

  // Handle centralized state heartbeat ping
  useEffect(() => {
    const pingServer = async () => {
      try {
        await fetch("/api/database/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            dna: myDna, 
            roomCode: activeRoom?.roomCode || null,
            nickname: nickname || "Anonymous",
            gender: gender
          })
        });
      } catch (err) {
        // ignore
      }
    };

    pingServer();
    const interval = setInterval(pingServer, 10000); // heartbeat every 10s
    return () => clearInterval(interval);
  }, [myDna, activeRoom]);

  // Sync VIP status with DB and remove flicker on init
  const checkVipStatus = async () => {
    try {
      const res = await fetch(`/api/database/vip/check/${myDna}`);
      if (res.ok) {
        const data: VipCheckResponse = await safeFetchJson(res);
        setIsVip(data.isVip);
        setVipDetails(data);
        safeStorage.setItem("phantom_is_vip", data.isVip ? "true" : "false");
        safeStorage.setItem("phantom_vip_details", JSON.stringify(data));
        // Cap slider if user is standard (and not pro)
        if (!data.isVip && !isPro && timerSeconds > FREE_TIER_ROOM_TIMER_SECONDS) {
          setTimerSeconds(FREE_TIER_ROOM_TIMER_SECONDS);
        }
      }
    } catch (err) {
      // fallback to offline limits
    }
  };

  // Sync PRO status with DB
  const checkProStatus = async () => {
    try {
      const res = await fetch(`/api/database/pro/check/${myDna}`);
      if (res.ok) {
        const data = await safeFetchJson(res);
        const serverPro = Boolean(data && data.isPro);
        setIsPro(serverPro);
        setProDetails(serverPro ? data : null);
        if (serverPro) {
          safeStorage.setItem("phantom_is_pro", "true");
          safeStorage.setItem("phantom_pro_details", JSON.stringify(data));
        } else {
          safeStorage.removeItem("phantom_is_pro");
          safeStorage.removeItem("phantom_pro_details");
          safeStorage.removeItem("phantom_pro_whitelisted");
          safeStorage.removeItem("phantom_pro_expiry");
        }
      }
    } catch (err) {
      // fallback
    }
  };

  // Sync global upload count with DB & daily local storage
  const fetchGlobalUploadCount = async () => {
    try {
      const localCount = getDailyMediaUploadCount();
      setMediaCounter(localCount);
      const res = await fetch(`/api/upload/count/${myDna}`);
      if (res.ok) {
        const data = await safeFetchJson(res);
        if (data && typeof data.count === "number") {
          const synced = Math.max(localCount, data.count);
          setMediaCounter(synced);
        }
      }
    } catch (err) {
      // fallback
    }
  };

  useEffect(() => {
    checkVipStatus();
    checkProStatus();
    fetchGlobalUploadCount();
    const interval = setInterval(() => {
      checkVipStatus();
      checkProStatus();
      fetchGlobalUploadCount();
    }, 8000);
    return () => clearInterval(interval);
  }, [myDna]);

  // Constrain room timer based on current active clearance level
  useEffect(() => {
    const maxAllowed = isPro ? 21600 : (isVip ? 3600 : FREE_TIER_ROOM_TIMER_SECONDS);
    if (timerSeconds > maxAllowed) {
      setTimerSeconds(maxAllowed);
    }
  }, [isVip, isPro, timerSeconds]);

  useEffect(() => {
    if (route === "premium") {
      setCheckoutStep(1);
      setSelectedPlanId(null);
      setSelectedPaymentMethod(null);
    }
  }, [route]);

  // Turnstile reset helper
  const resetTurnstile = () => {
    setTurnstileToken("");
    setTurnstileResetSignal((prev) => prev + 1);
    try {
      if ((window as any).turnstile) {
        (window as any).turnstile.reset();
      }
    } catch (e) {}
  };

  // Global scroll listener to pause animations during scroll to reduce paint area
  useEffect(() => {
    let scrollTimeout: any;
    const handleScroll = () => {
      document.body.classList.add("is-scrolling");
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        document.body.classList.remove("is-scrolling");
      }, 150);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.removeEventListener("scroll", handleScroll, { capture: true });
      clearTimeout(scrollTimeout);
    };
  }, []);

  // Clear stale Turnstile verification error as soon as token is verified
  useEffect(() => {
    if (turnstileToken && captchaError.includes("Turnstile")) {
      setCaptchaError("");
    }
  }, [turnstileToken, captchaError]);

  // Auto-scroll messaging thread on incoming messages conditionally
  useEffect(() => {
    if (isAtBottomRef.current) {
      const activeContainer = window.innerWidth < 1024 ? mobileChatContainerRef.current : desktopChatContainerRef.current;
      if (activeContainer) {
        setTimeout(() => {
          if (activeContainer) {
            activeContainer.scrollTop = activeContainer.scrollHeight;
          }
        }, 10);
      }
    }
  }, [roomMessages]);

  useEffect(() => {
    if (roomMessages.length > lastMessageCountRef.current) {
      if (lastMessageCountRef.current > 0 && isPingSoundEnabled) {
        const lastMsg = roomMessages[roomMessages.length - 1];
        if (lastMsg && lastMsg.senderDna !== myDna) {
          playPingSound();
        }
      }
    }
    lastMessageCountRef.current = roomMessages.length;
  }, [roomMessages, isPingSoundEnabled, myDna]);

  useEffect(() => {
    isAtBottomRef.current = true;
    setIsScrolledToBottom(true);
  }, [route]);

  // Active room countdown listener calculated strictly from room.createdAt (RTDB / server authoritative)
  useEffect(() => {
    let interval: any = null;
    let syncInterval: any = null;

    if (activeRoom && route === "chat") {
      const initialCreatedAt = Number(activeRoom.roomCreatedAt || activeRoom.createdAt || Date.now());
      const initialDuration = Number(activeRoom.timerDuration || activeRoom.duration || activeRoom.timerSeconds || FREE_TIER_ROOM_TIMER_SECONDS);
      roomCreatedAtRef.current = initialCreatedAt;
      roomDurationRef.current = initialDuration;

      // Subscribe to Realtime Database room config for live authoritative updates
      const unsubscribeConfig = subscribeToRoomConfig(activeRoom.roomCode, (config) => {
        if (config) {
          if (config.createdAt || config.roomCreatedAt) {
            roomCreatedAtRef.current = Number(config.roomCreatedAt || config.createdAt);
          }
          const configDuration = Number(config.timerDuration || config.duration || config.timerSeconds);
          if (configDuration) {
            roomDurationRef.current = configDuration;
          }
        }
      });
      unsubscribeRtdbConfigRef.current = unsubscribeConfig;

      interval = setInterval(() => {
        const baseCreatedAt = roomCreatedAtRef.current || initialCreatedAt;
        const totalDurationSecs = roomDurationRef.current || initialDuration;
        const totalDurationMs = totalDurationSecs * 1000;
        const now = Date.now();
        // Strict countdown calculation globally synchronized from room.createdAt:
        const remainingSeconds = Math.max(0, Math.floor((baseCreatedAt + totalDurationMs - now) / 1000));
        const remainingMs = remainingSeconds * 1000;

        setActiveRoom((prev) => {
          if (!prev) return null;
          if (prev.remainingSeconds === remainingSeconds) return prev;
          return {
            ...prev,
            createdAt: baseCreatedAt,
            roomCreatedAt: baseCreatedAt,
            timerSeconds: totalDurationSecs,
            timerDuration: totalDurationSecs,
            duration: totalDurationSecs,
            remainingMs,
            remainingSeconds,
          };
        });

        if (remainingSeconds <= 0 && !dissolveActive) {
          triggerDissolveSelfDestruct();
        }
      }, 500);

      syncInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/database/room/${activeRoom.roomCode}?requesterDna=${myDna}`);
          if (res.ok) {
            const data = await res.json();
            const r = data.room || data;
            const serverCreatedAt = r.roomCreatedAt || r.createdAt;
            if (serverCreatedAt) {
              roomCreatedAtRef.current = Number(serverCreatedAt);
            }
            const duration = Number(r.timerDuration || r.duration || r.timerSeconds || roomDurationRef.current);
            if (duration) {
              roomDurationRef.current = duration;
            }
            // Keep participants in sync so P2P file transfer knows the other person has joined
            if (Array.isArray(r.participants) && r.participants.length > 0) {
              setActiveRoom((prev) => ({ ...prev, participants: r.participants }));
            }
          }
        } catch (err) {
          // ignore
        }
      }, 8000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (syncInterval) clearInterval(syncInterval);
      if (unsubscribeRtdbConfigRef.current) {
        try {
          unsubscribeRtdbConfigRef.current();
          unsubscribeRtdbConfigRef.current = null;
        } catch {}
      }
    };
  }, [activeRoom?.roomCode, route, dissolveActive, myDna]);

  const handleRetryConnection = () => {
    setRoomConnectionStatus("CONNECTING");
    setConnectionRetryTrigger((prev) => prev + 1);
  };

  // Handle Firebase Realtime Database + Event Stream connection for messages (latency-free syncing!)
  useEffect(() => {
    if (activeRoom && route === "chat") {
      setRoomConnectionStatus("CONNECTED");
      setPusherWarning(null);

      // Clean up any previous RTDB message listener
      if (unsubscribeRtdbMessagesRef.current) {
        try {
          unsubscribeRtdbMessagesRef.current();
          unsubscribeRtdbMessagesRef.current = null;
        } catch {}
      }

      // 1. Subscribe to Firebase Realtime Database `rooms/${roomCode}/messages`
      const unsubscribeRtdb = subscribeToRoomMessages(activeRoom.roomCode, async (rtdbMessages) => {
        setRoomConnectionStatus("CONNECTED");
        setPusherWarning(null);
        const decryptedList = await decryptMessageList(rtdbMessages, roomKeyRef.current);
        setRoomMessages((prev) => {
          if (decryptedList.length === 0 && prev.length > 0) {
            return prev;
          }
          const byId = new Map<string, Message>();
          for (const existing of prev) {
            if (existing && existing.id) byId.set(existing.id, existing);
          }
          for (const msg of decryptedList) {
            if (msg && msg.id) {
              byId.set(msg.id, {
                ...msg,
                id: msg.id,
                roomCode: activeRoom.roomCode,
                nickname: msg.nickname || "GHOST",
                senderDna: msg.senderDna || "OPERATIVE",
                type: msg.type || "text",
                text: msg.text || "",
                mediaUrl: msg.mediaUrl || msg.fileUrl || "",
                fileUrl: msg.fileUrl || msg.mediaUrl || "",
                timestamp: Number(msg.timestamp || Date.now()),
              });
            }
          }
          return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
        });
      });
      unsubscribeRtdbMessagesRef.current = unsubscribeRtdb;

      // 2. Connect to fallback SSE event stream
      const eventSource = new EventSource(`/api/rooms/stream/${activeRoom.roomCode}?requesterDna=${myDna}`);
      streamEventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setRoomConnectionStatus("CONNECTED");
      };

      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.trim() === "") return;
          const data = JSON.parse(event.data);
          if (!data) return;
          if (data.type === "ping" || data.type === "connected") return;

          if (data.type === "typing") {
            setActiveRoomTypers(data.typers || []);
          } else if (data.type === "history") {
            const rawHistory = (data.data || []) as any[];
            const sanitizedHistory: Message[] = rawHistory.map((m: any) => ({
              ...m,
              id: m.id || `msg_${Date.now()}_${Math.random()}`,
              nickname: m.nickname || "GHOST",
              senderDna: m.senderDna || "OPERATIVE",
              type: m.type || "text",
              text: m.text || "",
              mediaUrl: m.mediaUrl || m.fileUrl || "",
              fileUrl: m.fileUrl || m.mediaUrl || "",
            }));
            decryptMessageList(sanitizedHistory, roomKeyRef.current).then((decryptedHistory) => {
              setRoomMessages((prev) => {
                const byId = new Map<string, Message>();
                for (const m of prev) if (m?.id) byId.set(m.id, m);
                for (const m of decryptedHistory) if (m?.id) byId.set(m.id, m);
                return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
              });
            });
            setRoomConnectionStatus("CONNECTED");
          } else if (data.type === "delete") {
            setRoomMessages((prev) => prev.filter((m) => m.id !== data.id));
          } else if (data.type === "update" && data.message) {
            const upd = data.message;
            const sanitizedUpdate: Message = {
              ...upd,
              id: upd.id,
              nickname: upd.nickname || "GHOST",
              senderDna: upd.senderDna || "OPERATIVE",
              type: upd.type || "text",
              text: upd.text || "",
              mediaUrl: upd.mediaUrl || upd.fileUrl || "",
              fileUrl: upd.fileUrl || upd.mediaUrl || "",
            };
            decryptIncomingMessage(sanitizedUpdate, roomKeyRef.current).then((decryptedUpd) => {
              setRoomMessages((prev) => prev.map((m) => m.id === decryptedUpd.id ? decryptedUpd : m));
            });
          } else {
            // It is a single new message
            const rawMsg = data.message || data;
            if (!rawMsg || (!rawMsg.id && !rawMsg.text && !rawMsg.mediaUrl && !rawMsg.fileUrl)) return;
            const sanitizedMsg: Message = {
              ...rawMsg,
              id: rawMsg.id || `msg_${Date.now()}_${Math.random()}`,
              nickname: rawMsg.nickname || "GHOST",
              senderDna: rawMsg.senderDna || "OPERATIVE",
              type: rawMsg.type || "text",
              text: rawMsg.text || "",
              mediaUrl: rawMsg.mediaUrl || rawMsg.fileUrl || "",
              fileUrl: rawMsg.fileUrl || rawMsg.mediaUrl || "",
            };
            decryptIncomingMessage(sanitizedMsg, roomKeyRef.current).then((decryptedMsg) => {
              setRoomMessages((prev) => {
                if (prev.some((m) => m.id === decryptedMsg.id)) return prev;
                                return [...prev, decryptedMsg];
              });
            });
          }
        } catch (err) {
          console.error("SSE stream parsing error", err);
        }
      };

      eventSource.onerror = () => {
        // Keep status connected because Firebase Realtime Database is active
        setRoomConnectionStatus("CONNECTED");
      };

      const disconnectStream = connectRoomStream(activeRoom.roomCode, {
        onMessage: (message: Message) => {
          if (!message) return;
          const sanitizedMsg: Message = {
            ...message,
            id: message.id || `msg_${Date.now()}_${Math.random()}`,
            nickname: message.nickname || (message as any).alias || "GHOST",
            senderDna: message.senderDna || "OPERATIVE",
            type: message.type || "text",
            text: message.text || "",
            mediaUrl: message.mediaUrl || message.fileUrl || "",
            fileUrl: message.fileUrl || message.mediaUrl || "",
          };
          decryptIncomingMessage(sanitizedMsg, roomKeyRef.current).then((decryptedMsg) => {
            setRoomMessages((prev) => {
              if (prev.some((m) => m.id === decryptedMsg.id)) return prev;
                            return [...prev, decryptedMsg];
            });
          });
          setRoomConnectionStatus("CONNECTED");
          setPusherWarning(null);
        },
        onParticipantJoined: (data: any) => {
                  },
        onRoomClosed: () => {
                    if (activeRoom?.roomCode) {
            clearRoomPayload(activeRoom.roomCode);
          }
          setActiveRoom(null);
          setRoute("gate");
        },
        onError: () => {
          // Firebase Realtime DB handles primary message syncing
          setRoomConnectionStatus("CONNECTED");
        }
      });

      return () => {
        if (unsubscribeRtdbMessagesRef.current) {
          try {
            unsubscribeRtdbMessagesRef.current();
            unsubscribeRtdbMessagesRef.current = null;
          } catch {}
        }
        eventSource.close();
        disconnectStream();
      };
    }
  }, [activeRoom?.roomCode, route, connectionRetryTrigger, myDna]);

  // Self-destruct logic kick back to lobby & clear room payload from Realtime Database
  const triggerDissolveSelfDestruct = () => {
    const expiredRoomCode = activeRoom?.roomCode;
    if (expiredRoomCode) {
      clearRoomPayload(expiredRoomCode);
    }
    setDissolveActive(true);
    // Beep / alert locally or sound
    setTimeout(() => {
      // Clear out states
      setActiveRoom(null);
      setRoomMessages([]);
      setDissolveActive(false);
      setRoute("gate");
    }, 1500);
  };

  // Best-effort screenshot detection
  useEffect(() => {
    const sendScreenshotAlertMessage = async (roomCode: string) => {
      try {
        const payload = {
          id: `sys_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          roomCode,
          type: "text",
          senderDna: myDna,
          nickname: "[SYSTEM ALERT]",
          text: `[SECURITY ALERT] OPERATOR ${myDna} TRANSMISSION CAPTURED`,
          fileUrl: "",
          timestamp: Date.now(),
        };

        await fetch(`/api/rooms/messages/${roomCode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error("Error sending security screenshot alert:", err);
      }
    };

    const triggerScreenshotAlert = () => {
      // 1. Dispatch custom window event
      const event = new CustomEvent("phantom-screenshot-alert");
      window.dispatchEvent(event);

      // 2. If in active room, transmit the security alert message
      if (activeRoom) {
        sendScreenshotAlertMessage(activeRoom.roomCode);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const isScreenshotKeys = 
        e.key === "PrintScreen" || 
        (e.metaKey && e.shiftKey && (e.key === "3" || e.key === "4" || e.key === "5" || e.key === "s" || e.key === "S")) ||
        (e.ctrlKey && e.key === "p") || 
        (e.metaKey && e.key === "p");

      if (isScreenshotKeys) {
        triggerScreenshotAlert();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeRoom, myDna]);

  // Route URL paths cleanly
  const navigateTo = (
    newRoute: "landing" | "gate" | "chat" | "world-chat" | "globallobby" | "faq" | "premium" | "inbox" | "ideas" | "friends",
    optRoomCode?: string
  ) => {
    const targetRoute = newRoute === "world-chat" ? "globallobby" : newRoute;
    if (targetRoute === "inbox") {
      window.history.pushState({}, "", "/inbox");
    } else if (targetRoute === "friends") {
      window.history.pushState({}, "", "/friends");
    } else if (targetRoute === "globallobby") {
      window.history.pushState({}, "", "/globallobby");
    } else if (targetRoute === "faq") {
      window.history.pushState({}, "", "/faq");
    } else if (newRoute === "premium") {
      window.history.pushState({}, "", "/premium");
    } else if (newRoute === "ideas") {
      window.history.pushState({}, "", "/ideas");
    } else if (newRoute === "landing") {
      window.history.pushState({}, "", "/");
    } else if (newRoute === "gate") {
      window.history.pushState({}, "", "/terminal");
    } else if (newRoute === "chat") {
      const code = optRoomCode || activeRoom?.roomCode;
      if (code) {
        window.history.pushState({}, "", `/room/${code}`);
      } else {
        window.history.pushState({}, "", "/terminal");
      }
    } else {
      window.history.pushState({}, "", "/terminal");
    }
    setRoute(newRoute);
  };

  const copyRoomCode = () => {
    if (activeRoom?.roomCode) {
      navigator.clipboard.writeText(activeRoom.roomCode).then(() => {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }).catch(err => {
        console.error("Failed to copy!", err);
      });
    }
  };

  const copyRoomLink = () => {
    if (activeRoom?.roomCode) {
      const shareableUrl = `${window.location.origin}/room/${activeRoom.roomCode}`;
      navigator.clipboard.writeText(shareableUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }).catch(err => {
        console.error("Failed to copy link!", err);
      });
    }
  };

  const handleCopyDeviceId = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetId = myDna || "TR-LOCAL";
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(targetId);
      } else {
        const ta = document.createElement("textarea");
        ta.value = targetId;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedDeviceId(true);
      setCopiedDeviceIdToast(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
      setTimeout(() => setCopiedDeviceIdToast(false), 2500);
    } catch {
      setCopiedDeviceId(true);
      setCopiedDeviceIdToast(true);
      setTimeout(() => setCopiedDeviceId(false), 2000);
      setTimeout(() => setCopiedDeviceIdToast(false), 2500);
    }
  };

  // Gracefully and reliably dissolve the active session and return to lobby
  const handleExitRoom = () => {
    if (streamEventSourceRef.current) {
      streamEventSourceRef.current.close();
      streamEventSourceRef.current = null;
    }
    setActiveRoom(null);
    setRoomMessages([]);
    navigateTo("gate");
  };

  // Create room flow
  const handleCreateRoom = async () => {
    if (!nickname.trim()) {
      setCaptchaError("Please enter your operator alias first.");
      return;
    }
    if (!turnstileToken || !turnstileToken.trim()) {
      setCaptchaError("Please complete the security verification challenge before creating a room.");
      return;
    }
    const effectiveToken = turnstileToken.trim();

    if (roomType === "group" && !isPro) {
      setShowProWarningModal(true);
      return;
    }

    // Save nickname Locally
    safeStorage.setItem("phantom_nickname", nickname);

    // Limit timer based on creator clearance
    const capSeconds = isPro ? 21600 : (isVip ? 3600 : FREE_TIER_ROOM_TIMER_SECONDS);
    const finalTimer = Math.min(timerSeconds, capSeconds);
    const maxPeers = isPro ? (roomType === "group" ? 999999 : 2) : 2;

    // Prevent duplicate room creation requests
    if (isCreatingRoom) return;
    setIsCreatingRoom(true);

    // Generate random 6-digit code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    const creationTime = Date.now();

    try {
      const response = await fetch("/api/database/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: generatedCode,
          creatorDna: myDna,
          timerSeconds: finalTimer,
          timerDuration: finalTimer,
          duration: finalTimer,
          roomType: roomType,
          createdByPro: isPro,
          maxPeers,
          createdAt: creationTime,
          roomConfig: {
            createdByPro: isPro,
            timerDuration: finalTimer,
            timerSeconds: finalTimer,
            maxPeers,
            createdAt: creationTime,
            roomType: roomType,
            creatorDna: myDna,
          },
          turnstileToken: effectiveToken,
          "cf-turnstile-response": effectiveToken
        })
      });

      if (response.ok) {
        const data = await response.json();
        const serverTime = data.room?.serverTime || Date.now();
        const clientNow = Date.now();
        const clockOffset = serverTime - clientNow;
        const roomCreatedAt = Number(data.room?.roomCreatedAt || data.room?.createdAt || clientNow);
        const duration = Number(data.room?.timerDuration || data.room?.duration || data.room?.timerSeconds || finalTimer);
        const roomEndsAt = Number(data.room?.roomEndsAt || (roomCreatedAt + duration * 1000));
        const correctedNow = clientNow + clockOffset;
        const remainingMs = Math.max(0, roomEndsAt - correctedNow);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        // Write room configuration to Firebase Realtime Database
        setRoomConfigInRtdb(generatedCode, {
          createdAt: roomCreatedAt,
          roomCreatedAt,
          timerSeconds: finalTimer,
          timerDuration: finalTimer,
          duration: finalTimer,
          creatorDna: myDna,
          createdByPro: isPro,
          maxPeers,
          roomType: roomType,
          status: "ACTIVE",
        }).catch(() => {});

        roomCreatedAtRef.current = roomCreatedAt;
        roomDurationRef.current = finalTimer;

        // Fire Pusher signaling event for room creation
        fetch("/api/room/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: generatedCode,
            creatorDna: myDna,
            timerSeconds: finalTimer,
            timerDuration: finalTimer,
            duration: finalTimer,
            roomType: roomType,
            createdByPro: isPro,
            maxPeers,
            createdAt: roomCreatedAt,
            roomConfig: {
              createdByPro: isPro,
              timerDuration: finalTimer,
              timerSeconds: finalTimer,
              maxPeers,
              createdAt: roomCreatedAt,
              roomType: roomType,
              creatorDna: myDna,
            }
          })
        }).catch(() => {});

        setActiveRoom({
          roomCode: generatedCode,
          creatorDna: myDna,
          timerSeconds: finalTimer,
          timerDuration: finalTimer,
          duration,
          createdByPro: isPro,
          maxPeers,
          createdAt: roomCreatedAt,
          roomCreatedAt,
          roomEndsAt,
          serverTime,
          clockOffset,
          remainingMs,
          remainingSeconds,
          hasExpired: false,
          roomType: roomType,
          status: "ACTIVE",
          participants: [myDna],
          appVersion: data.room?.appVersion || "v2.4.0-prod-space",
          firebaseProjectId: data.room?.firebaseProjectId || "ai-studio-174ad183-7451-4ab5-9a6e-3cfe844bbc0a"
        });
        setRoomLifecycleStatus("ACTIVE");
        setRoomConnectionStatus("CONNECTING");
        setRoomMessages([]);
        navigateTo("chat", generatedCode);
      } else {
        const errJson = await response.json().catch(() => null);
        const errMessage = errJson?.error || "Room initialization rejected. Please re-verify.";
        console.error("Create room HTTP error:", response.status, errMessage);
        setCaptchaError(errMessage);
        resetTurnstile();
      }
    } catch (err) {
      console.error("Create room network/parsing error:", err);
      setCaptchaError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
      resetTurnstile();
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Join existing room
  const handleJoinRoom = async () => {
    if (!nickname.trim()) {
      setCaptchaError("Please enter your operator alias first.");
      return;
    }
    if (!turnstileToken || !turnstileToken.trim()) {
      setCaptchaError("Please complete the security verification challenge before joining a room.");
      return;
    }
    const effectiveToken = turnstileToken.trim();
    if (!inputRoomCode.trim()) {
      setCaptchaError("Room code is required.");
      return;
    }

    safeStorage.setItem("phantom_nickname", nickname);

    try {
      const res = await fetch(`/api/database/room/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: inputRoomCode.trim(),
          requesterDna: myDna,
          turnstileToken: effectiveToken,
          "cf-turnstile-response": effectiveToken
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        const isFull = res.status === 403 && (errData?.status === "ROOM_FULL" || errData?.error?.toLowerCase().includes("full"));
        if (isFull) {
          setLinkRoomFull(true);
        }
        const errMessage = errData?.error || (isFull ? "Room full: 1-on-1 rooms are limited to 2 people." : "Connection rejected (Room code not found, full, or expired).");
        setCaptchaError(errMessage);
        resetTurnstile();
        return;
      }

      const data: any = await res.json();
      const roomData: RoomConfig = data.room || data;
      if (roomData.hasExpired || (roomData.remainingSeconds !== undefined && roomData.remainingSeconds <= 0)) {
        setCaptchaError("Target terminal has dissolved completely.");
        resetTurnstile();
        return;
      }

      const serverTime = roomData.serverTime || Date.now();
      const clientNow = Date.now();
      const clockOffset = serverTime - clientNow;
      const roomCreatedAt = Number(roomData.roomCreatedAt || roomData.createdAt || clientNow);
      // Inherit host's configured duration strictly - DO NOT downgrade based on joiner's isPro status
      const duration = Number(roomData.timerDuration || roomData.duration || roomData.timerSeconds || FREE_TIER_ROOM_TIMER_SECONDS);
      const roomEndsAt = Number(roomData.roomEndsAt || (roomCreatedAt + duration * 1000));
      const correctedNow = clientNow + clockOffset;
      const remainingMs = Math.max(0, roomEndsAt - correctedNow);
      const remainingSeconds = Math.ceil(remainingMs / 1000);

      if (remainingSeconds <= 0) {
        setCaptchaError("Target terminal has dissolved completely.");
        resetTurnstile();
        return;
      }

      roomCreatedAtRef.current = roomCreatedAt;
      roomDurationRef.current = duration;

      setActiveRoom({
        ...roomData,
        roomCode: roomData.roomCode || inputRoomCode.trim(),
        roomCreatedAt,
        createdAt: roomCreatedAt,
        roomEndsAt,
        duration,
        timerDuration: duration,
        timerSeconds: duration,
        createdByPro: Boolean(roomData.createdByPro),
        maxPeers: Number(roomData.maxPeers) || (roomData.roomType === "group" ? 999999 : 2),
        serverTime,
        clockOffset,
        remainingMs,
        remainingSeconds,
        hasExpired: remainingSeconds <= 0,
        status: roomData.status || "ACTIVE",
        appVersion: roomData.appVersion || "v2.4.0-prod-space",
        firebaseProjectId: roomData.firebaseProjectId || "ai-studio-174ad183-7451-4ab5-9a6e-3cfe844bbc0a"
      });
      setRoomLifecycleStatus("ACTIVE");
      setRoomConnectionStatus("CONNECTING");
      setRoomMessages([]);
      navigateTo("chat", roomData.roomCode || inputRoomCode.trim());
    } catch (err) {
      console.error("Join room network/parsing error:", err);
      setCaptchaError(`Gateway failed to handshake with designated room: ${err instanceof Error ? err.message : String(err)}`);
      resetTurnstile();
    }
  };

  // Directly join room after 6-digit session pairing redirect
  const joinRoomDirectly = useCallback(async (roomCodeToJoin: string) => {
    const cleanCode = String(roomCodeToJoin || "").trim();
    if (!cleanCode) return;
    setInputRoomCode(cleanCode);

    try {
      const res = await fetch(`/api/database/room/${cleanCode}?requesterDna=${myDna}`);
      if (res.ok) {
        const data: any = await res.json();
        const roomData: RoomConfig = data.room || data;
        const serverTime = roomData.serverTime || Date.now();
        const clientNow = Date.now();
        const clockOffset = serverTime - clientNow;
        const roomCreatedAt = Number(roomData.roomCreatedAt || roomData.createdAt || clientNow);
        const duration = Number(roomData.timerDuration || roomData.duration || roomData.timerSeconds || FREE_TIER_ROOM_TIMER_SECONDS);
        const roomEndsAt = Number(roomData.roomEndsAt || (roomCreatedAt + duration * 1000));
        const correctedNow = clientNow + clockOffset;
        const remainingMs = Math.max(0, roomEndsAt - correctedNow);
        const remainingSeconds = Math.ceil(remainingMs / 1000);

        roomCreatedAtRef.current = roomCreatedAt;
        roomDurationRef.current = duration;

        fetch(`/api/database/room/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomCode: cleanCode,
            requesterDna: myDna,
            nickname: nickname || "SYNCED_OPERATIVE",
          }),
        }).catch(() => {});

        setActiveRoom({
          ...roomData,
          roomCode: roomData.roomCode || cleanCode,
          roomCreatedAt,
          createdAt: roomCreatedAt,
          roomEndsAt,
          duration,
          timerDuration: duration,
          timerSeconds: duration,
          createdByPro: Boolean(roomData.createdByPro),
          maxPeers: Number(roomData.maxPeers) || (roomData.roomType === "group" ? 999999 : 2),
          serverTime,
          clockOffset,
          remainingMs,
          remainingSeconds,
          hasExpired: remainingSeconds <= 0,
          status: roomData.status || "ACTIVE",
          appVersion: roomData.appVersion || "v2.4.0-prod-space",
          firebaseProjectId: roomData.firebaseProjectId || "ai-studio-174ad183-7451-4ab5-9a6e-3cfe844bbc0a",
        });
        setRoomLifecycleStatus("ACTIVE");
        setRoomConnectionStatus("CONNECTING");
        setRoomMessages([]);
        navigateTo("chat", cleanCode);
      } else {
        navigateTo("chat", cleanCode);
      }
    } catch (err) {
      console.error("Direct room joining error:", err);
      navigateTo("chat", cleanCode);
    }
  }, [myDna, nickname]);

  // Base64 / Firebase Storage media uploader logic (images, audios)
  const uploadAndSend = async (
    base64Data: string,
    extension: string,
    messageType: "image" | "audio",
    rawFile?: File
  ) => {
    // Recheck daily quota limit validation before uploading
    const quota = checkMediaUploadQuota(isPro, isVip);
    if (!quota.allowed) {
      alert(quota.message || "Daily free media limit reached (2/2)");
      return;
    }

    if (messageType === "image") {
      setIsUploadingPhoto(true);
      setUploadingThumbnail(base64Data);
      setUploadPhotoError(null);
      setFailedPhotoData({ base64: base64Data, extension });

      let mediaUrl = base64Data;
      try {
        if (rawFile && !base64Data.startsWith("data:image/webp")) {
          // Instant client-side WebP canvas compression (max 1600px, 0.80 quality)
          const { dataUrl } = await compressImageFile(rawFile, 1600, 0.80);
          if (isValidMediaUrl(dataUrl)) {
            mediaUrl = dataUrl;
          }
        }
      } catch (compressErr) {
        console.warn("Canvas image compression fallback to base64Data:", compressErr);
      }

      if (!isValidMediaUrl(mediaUrl)) {
        setIsUploadingPhoto(false);
        setUploadPhotoError("Invalid media payload. Tap retry.");
        return;
      }

      incrementDailyMediaUploadCount();
      setMediaCounter(getDailyMediaUploadCount());

      // Non-blocking upload count refresh so image dispatches immediately
      fetchGlobalUploadCount().catch(() => {});

      setIsUploadingPhoto(false);
      setUploadingThumbnail(null);
      setUploadPhotoError(null);
      setFailedPhotoData(null);

      await sendMessagePacket("image", undefined, mediaUrl);
      return;
    }

    try {
      // Audio upload path
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64: base64Data, extension, creatorDna: myDna })
      });

      if (!uploadRes.ok) {
        throw new Error("Transceiver rejected payload packet.");
      }

      const { url } = await uploadRes.json();
      incrementDailyMediaUploadCount();
      setMediaCounter(getDailyMediaUploadCount());
      await fetchGlobalUploadCount();
      await sendMessagePacket(messageType, undefined, url);
    } catch (err) {
      console.error(err);
      incrementDailyMediaUploadCount();
      setMediaCounter(getDailyMediaUploadCount());
      // Fallback to local Base64 Data URL if network upload fails
      await sendMessagePacket(messageType, undefined, base64Data);
    }
  };

  // Trigger input photo upload via Firebase Storage + Canvas compression helper
  const handlePhotoUploadPress = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const quota = checkMediaUploadQuota(isPro, isVip);
    if (!quota.allowed) {
      alert(quota.message || "Daily free media limit reached (2/2)");
      if (e.target) e.target.value = "";
      return;
    }
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      e.target.value = "";

      if (isStegoMode) {
        const promptText = window.prompt(
          "STEGO COVER MODE: Enter secret payload to conceal in image pixels LSBs:",
          messageText || "OPERATIVE CLASSIFIED INTELLIGENCE"
        );
        const secretText = promptText !== null ? promptText : messageText;

        if (secretText) {
          try {
                        const stegoBlob = await embedTextInImage(file, secretText);
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              uploadAndSend(base64, "png", "image");
            };
            reader.readAsDataURL(stegoBlob);
            setIsStegoMode(false);
            return;
          } catch (stegoErr) {
            console.error("Steganography embedding error:", stegoErr);
            alert("Failed to embed steganographic payload. Image may be too small.");
          }
        }
      }

      try {
        const { dataUrl } = await compressImageFile(file, 1600, 0.80);
        await uploadAndSend(dataUrl, "webp", "image");
      } catch (err) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          const ext = file.name.split(".").pop() || "jpg";
          uploadAndSend(base64, ext, "image", file);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Launch audio voice capturing
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          uploadAndSend(base64, "webm", "audio");
        };
        reader.readAsDataURL(audioBlob);
        
        // release stream tracks
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      alert("Microphone capture permission rejected. Check device settings.");
    }
  };

  // Cancel recording and teardown hooks
  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  // General text/media send package dispatch
  const sendMessagePacket = async (type: "text" | "image" | "audio", customText?: string, resolvedFileUrl?: string) => {
    const payloadText = customText !== undefined ? customText : messageText;
    if (type === "text" && (payloadText.trim() === "9999" || payloadText.trim() === "/panic")) {
      setMessageText("");
      handleTriggerPanic();
      return;
    }
    if (type === "text" && !payloadText.trim()) return;
    if ((type === "image" || type === "audio") && !isValidMediaUrl(resolvedFileUrl)) {
      console.warn("Blocked media message with invalid URL:", resolvedFileUrl);
      return;
    }
    if (!activeRoom) return;

    const validMediaUrl = (type === "image" || type === "audio") && resolvedFileUrl ? resolvedFileUrl.trim() : "";
    const rawContentToEncrypt = type === "text" ? payloadText : validMediaUrl;

    let encryptedFields: { ciphertext?: string; iv?: string; isEncrypted?: boolean } = {};
    const activeKey = roomKey || roomKeyRef.current;
    if (activeKey && rawContentToEncrypt) {
      try {
        const { ciphertext, iv } = await encryptPayload(rawContentToEncrypt, activeKey);
        encryptedFields = {
          ciphertext,
          iv,
          isEncrypted: true,
        };
      } catch (encryptErr) {
        console.error("Payload encryption error:", encryptErr);
      }
    }

    const bodyData: Message = {
      id: `msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      roomCode: activeRoom.roomCode,
      type,
      senderDna: myDna,
      nickname: nickname || "OPERATIVE",
      gender,
      text: type === "text" ? payloadText : "",
      mediaUrl: validMediaUrl,
      fileUrl: validMediaUrl,
      timestamp: Date.now(),
      replyTo: replyTo || undefined,
      ...encryptedFields,
    };

    // Optimistically add to local room messages so media/text renders immediately
    setRoomMessages((prev) => (prev.some((m) => m.id === bodyData.id) ? prev : [...prev, bodyData]));

    if (type === "text") {
      setMessageText("");
    }
    setReplyTo(null);

    // 1. Push message object to Firebase Realtime Database `rooms/${roomCode}/messages`
    // Firebase write is immediate (not blocked on API), so RTDB listeners get messages within ms.
    sendRoomMessage(activeRoom.roomCode, bodyData).catch((rtdbErr) => {
      console.warn("Realtime DB sendRoomMessage error:", rtdbErr);
    });

    // 2. Server API (Cloudflare Pages Function → ROOM_KV/D1 → SSE stream)
    // Fire-and-forget: do NOT await, so UI is never blocked by API cold starts.
    fetch(`/api/rooms/messages/${encodeURIComponent(activeRoom.roomCode)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData)
    }).then((response) => {
            if (roomTypingTimeoutRef.current) {
        clearTimeout(roomTypingTimeoutRef.current);
      }
      isRoomTypingRef.current = false;
      sendRoomTypingStatus(false);
      setIsScrolledToBottom(true);
      isAtBottomRef.current = true;
      const activeContainer = window.innerWidth < 1024 ? mobileChatContainerRef.current : desktopChatContainerRef.current;
      if (activeContainer) {
        activeContainer.scrollTop = activeContainer.scrollHeight;
      }
      window.triggerParticleRipple?.(null);
      if (response.ok) {
        fetch("/api/database/message", { method: "POST" }).catch(() => {});
      }
    }).catch((err) => {
      console.error("Message API fire-and-forget error:", err);
    });
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeRoom) return;
    setRoomMessages((prev) => prev.filter((m) => m.id !== messageId));
    deleteRoomMessageFromRtdb(activeRoom.roomCode, messageId).catch(() => {});
    try {
      await fetch(`/api/rooms/messages/${activeRoom.roomCode}/${messageId}?senderDna=${encodeURIComponent(myDna)}`, {
        method: "DELETE"
      });
    } catch (e) {
      console.error("Error communicating message delete request", e);
    }
  };

  // Helper to render remaining audio voice notes beautifully
  const AudioPlayerNode = ({ url }: { url: string }) => {
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
      if (!audioRef.current) {
        audioRef.current = new Audio(url);
        audioRef.current.onended = () => setPlaying(false);
      }
      
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        const p = audioRef.current.play();
        if (p !== undefined) {
          p.then(() => setPlaying(true)).catch((e) => {
            console.warn("Audio playback prevented:", e);
            setPlaying(false);
          });
        } else {
          setPlaying(true);
        }
      }
    };

    return (
      <div className="flex items-center space-x-3 bg-black/40 border border-[#00BFFF]/20 rounded-lg p-3 max-w-[240px]">
        <button 
          onClick={togglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-[#00BFFF]/10 border border-[#00BFFF] hover:bg-[#00BFFF] hover:text-black transition-colors"
        >
          {playing ? <CircleStop className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        <div className="flex-1">
          <p className="text-xs font-mono text-[#00BFFF] font-bold tracking-wider">SECURE_VOICE.RAW</p>
          <div className="h-2 bg-black/60 rounded overflow-hidden mt-1 flex items-center space-x-0.5 px-0.5">
            {[...Array(12)].map((_, i) => (
              <span 
                key={i} 
                className={`h-full w-1 rounded-full ${playing ? "animate-pulse" : ""}`} 
                style={{ 
                  backgroundColor: playing ? "#FF00BD" : "#00BFFF",
                  opacity: playing ? 0.3 + 0.7 * Math.sin(i) : 0.4,
                  animationDelay: `${i * 100}ms`
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (isDecoyActive) {
    return <PanicCalculator onUnlock={handleExitPanic} />;
  }

  return (
    <>
      {showIntro && (
        <EntryAnimation 
          onComplete={() => setShowIntro(false)} 
          onReveal={() => setIntroRevealed(true)} 
        />
      )}
      <div className={`relative ${route === "chat" ? "h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden" : "min-h-[100dvh]"} bg-transparent text-white w-full flex flex-col font-sans select-none overflow-x-hidden ${!introRevealed ? "opacity-0 translate-y-2 pointer-events-none" : "transition-all duration-[400ms] ease-out opacity-100 translate-y-0"}`}>

      {/* Ambient WebGL Particle System Backdrop */}
      <ParticleBackground />

      {/* Subtle ambient glow (restrained cyan/teal, low-contrast) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-60 select-none">
        <div className="absolute top-[10%] left-[12%] w-[420px] h-[420px] rounded-full bg-gradient-to-br from-[#0b6e7a]/18 to-transparent blur-[170px] animate-pulse pointer-events-none select-none animate-duration-[10s]" />
      </div>

      {/* RENDER VIEW ROUTE */}

      {isCheckingLinkRoom && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050505] font-mono space-y-4 p-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-t-transparent border-[#00BFFF] animate-spin" />
            <div className="absolute inset-2 rounded-full border-4 border-b-transparent border-[#FF00BD] animate-spin" />
          </div>
          <div className="text-center space-y-1.5 px-6">
            <p className="text-sm font-black text-[#00BFFF] tracking-[0.2em] text-glow-blue uppercase">
              VERIFYING ENCRYPTED LINK...
            </p>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest animate-pulse">
              Connecting to secure port gateway
            </p>
          </div>
        </div>,
        document.body
      )}
          {/* Floating Hamburger / Mobile Nav Menu (Globally accessible on all main pages) */}
      {route === "gate" && (
        <div className="absolute top-4 right-4 z-50 lg:hidden">
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 bg-[#0F121A] border border-slate-800 rounded-lg text-cyan-400 hover:text-white transition-colors cursor-pointer shadow-lg"
            id="global-drawer-trigger"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      )}

      {route === "landing" && (
        <LandingPage 
          onEnter={() => navigateTo("gate")} 
          onNavigateToFaq={() => navigateTo("faq")}
          onOpenSyncBrowser={() => openPairingModal("host")}
          triggerPwaInstall={triggerPwaInstall}
          isPwaInstalled={isPwaInstalled}
        />
      )}

      {/* ======================= GATE/HOME PAGE MOBILE RENDER SPLIT ======================= */}
      {/* WRAPPED MOBILE UI (lg:hidden) */}
      {route !== "landing" && route !== "premium" && (
        <div className={`relative flex flex-col ${route === "chat" ? "h-[100dvh] max-h-[100dvh] min-h-0 overflow-hidden flex-1" : "flex-grow min-h-0"} w-full lg:hidden z-10 ${dissolveActive ? "ghost-dissolve" : ""}`}>
          
          {/* 2. GATE / GATEWAY CONTROLLER SYSTEM (Mobile) */}
          {route === "gate" && (
            <div className="w-full flex-grow flex flex-col justify-start">
              <TerminalGate
                nickname={nickname}
                setNickname={setNickname}
                gender={gender}
                setGender={setGender}
                timerSeconds={timerSeconds}
                setTimerSeconds={setTimerSeconds}
                roomType={roomType}
                setRoomType={setRoomType}
                isPro={isPro}
                isVip={isVip}
                setShowProWarningModal={setShowProWarningModal}
                turnstileToken={turnstileToken}
                setTurnstileToken={setTurnstileToken}
                turnstileResetSignal={turnstileResetSignal}
                onResetTurnstile={resetTurnstile}
                captchaError={captchaError}
                setCaptchaError={setCaptchaError}
                isCreatingRoom={isCreatingRoom}
                handleCreateRoom={handleCreateRoom}
                inputRoomCode={inputRoomCode}
                setInputRoomCode={setInputRoomCode}
                handleJoinRoom={handleJoinRoom}
                linkRoomFull={linkRoomFull}
                linkRoomExpired={linkRoomExpired}
                handleResetExpiredRoom={handleResetExpiredRoom}
                myDna={myDna}
                navigateTo={navigateTo}
              />
            </div>
          )}

        {/* 3. SECURE GHOST CHATROOM TERMINAL (Mobile) */}
        {route === "chat" && activeRoom && (
          <InnerRoomView
            activeRoom={activeRoom}
            roomMessages={roomMessages}
            myDna={myDna}
            nickname={nickname}
            gender={gender}
            isPro={isPro}
            isVip={isVip}
            roomConnectionStatus={roomConnectionStatus}
            onRetryConnection={handleRetryConnection}
            onExitRoom={handleExitRoom}
            messageText={messageText}
            setMessageText={setMessageText}
            onSendMessage={sendMessagePacket}
            onUserTyping={handleRoomUserTyping}
            activeRoomTypers={activeRoomTypers}
            mediaCounter={mediaCounter}
            isUploadCapReached={isUploadCapReached}
            isUploadingPhoto={isUploadingPhoto}
            uploadingThumbnail={uploadingThumbnail}
            uploadPhotoError={uploadPhotoError}
            failedPhotoData={failedPhotoData}
            onRetryPhotoUpload={() => {
              if (failedPhotoData) {
                uploadAndSend(failedPhotoData.base64, failedPhotoData.extension, "image");
              }
            }}
            onDismissPhotoError={() => {
              setUploadPhotoError(null);
              setFailedPhotoData(null);
              setUploadingThumbnail(null);
            }}
            onPhotoSelected={handlePhotoUploadPress}
            isRecording={isRecording}
            recordingSeconds={recordingSeconds}
            startAudioRecording={startAudioRecording}
            stopAudioRecording={stopAudioRecording}
            replyTo={replyTo}
            setReplyTo={setReplyTo}
            revealedMediaIds={revealedMediaIds}
            toggleRevealMedia={toggleRevealMedia}
            onCopyMessage={copyMessageText}
            copiedMessageId={copiedMessageId}
            onDeleteMessage={deleteMessage}
            pusherWarning={pusherWarning}
            onDismissPusherWarning={() => setPusherWarning(null)}
            onP2PFileSelected={handleP2PFileSelected}
            p2pTransferState={p2pTransferState}
            incomingP2POffer={incomingP2POffer}
            onAcceptP2POffer={handleAcceptP2POffer}
            onDeclineP2POffer={handleDeclineP2POffer}
            onCancelP2P={handleCancelP2P}
            isStegoMode={isStegoMode}
            onToggleStegoMode={() => setIsStegoMode((prev) => !prev)}
            onTriggerPanic={handleTriggerPanic}
          />
        )}
        {
}
        

          {(route === "globallobby" || (route as any) === "world-chat") && (
            <div className="flex-grow flex flex-col h-full bg-transparent overflow-hidden">
              <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0F121A]/95 backdrop-blur-md sticky top-0 z-50">
                <button 
                  onClick={() => {
                    if (activeRoom) {
                      navigateTo("chat");
                    } else {
                      navigateTo("gate");
                    }
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition-colors cursor-pointer"
                  id="mobile-world-chat-back-button"
                  title="Back to Terminal"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <div className="text-xs font-semibold text-white flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Global Lobby</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </header>
              <div className="flex-grow flex flex-col p-3 bg-transparent overflow-hidden h-[calc(100dvh-70px)]">
                <WorldChat 
                  myDna={myDna}
                  nickname={nickname}
                  onOpenVip={() => navigateTo("premium")}
                  isVip={isVip}
                  isPro={isPro}
                  isPingSoundEnabled={isPingSoundEnabled}
                  onAliasChange={(newAlias) => {
                    setNickname(newAlias);
                    safeStorage.setItem("phantom_nickname", newAlias);
                  }}
                  onBack={() => {
                    if (activeRoom) {
                      navigateTo("chat");
                    } else {
                      navigateTo("gate");
                    }
                  }}
                />
              </div>
            </div>
          )}

          {route === "inbox" && (
            <div className="flex-grow flex flex-col h-full bg-transparent overflow-hidden p-3 h-[calc(100dvh-20px)]">
              <InboxView 
                myDna={myDna}
                inboxEntries={inboxEntries}
                establishedContacts={establishedContacts}
                onRefreshInbox={refreshInboxAndContacts}
                onAcceptHandshake={handleAcceptHandshakeFromInbox}
                onDeclineHandshake={handleDeclineHandshakeFromInbox}
                prefilledNegotiation={prefilledNegotiation}
                clearPrefilledNegotiation={handleClearPrefilledNegotiation}
                prefilledRecipientDna={prefilledInboxRecipient}
                clearPrefilledRecipient={() => setPrefilledInboxRecipient(null)}
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                navigateTo={navigateTo}
              />
            </div>
          )}

          {route === "friends" && (
            <div className="flex-grow flex flex-col h-full bg-transparent overflow-hidden p-3 h-[calc(100dvh-20px)]">
              <FriendsPage 
                myDna={myDna}
                externalFriends={contactsList}
                onRefreshContacts={refreshInboxAndContacts}
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                navigateTo={navigateTo}
                playPingSound={playPingSound}
                onInviteToInbox={handleInviteToInbox}
              />
            </div>
          )}

          {route === "faq" && (
            <div className="flex-grow flex flex-col h-full bg-transparent overflow-hidden p-3 h-[calc(100dvh-20px)]">
              <FaqPage 
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                myDna={myDna}
              />
            </div>
          )}

          {route === "ideas" && (
            <div className="flex-grow flex flex-col bg-transparent p-3">
              <IdeasBoard 
                myDna={myDna}
                myAlias={nickname || "ANONYMOUS"}
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                navigateTo={navigateTo}
                onNegotiate={handleOpenNegotiation}
              />
            </div>
          )}
        
        </div>
      )}

      {/* ======================= DESKTOP CYBER_TERMINAL FULL SCREEN SINGLE COLUMN ======================= */}
      {/* WRAPPED DESKTOP SCREEN (hidden lg:flex) */}
      {route !== "landing" && route !== "premium" && (
        <div className={`hidden lg:flex flex-col h-[100dvh] w-full bg-transparent overflow-hidden main-layout ${dissolveActive ? "ghost-dissolve" : ""}`}>
        
        {/* DESKTOP TOP NAVIGATION BAR */}
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
              onClick={() => {
                if (activeRoom) {
                  navigateTo("chat");
                } else {
                  navigateTo("gate");
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                route === "gate" || route === "chat"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              Terminal
            </button>

            <button
              onClick={() => navigateTo("inbox")}
              className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer border ${
                route === "inbox"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <span>Inbox</span>
              {inboxEntries.length > 0 && (
                <span className="bg-pink-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                  {inboxEntries.length}
                </span>
              )}
            </button>

            <button
              onClick={() => navigateTo("globallobby")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                route === "globallobby" || (route as any) === "world-chat"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              Global Lobby
            </button>

            <button
              onClick={() => navigateTo("ideas")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                route === "ideas"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              Ideas
            </button>

            <button
              onClick={() => navigateTo("friends")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                route === "friends"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              Contacts
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

          {/* Right Status & DNA */}
          <div className="flex items-center gap-3">
            {!isPwaInstalled && triggerPwaInstall && (
              <button
                onClick={triggerPwaInstall}
                className="hidden xl:inline-flex px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-md transition-colors cursor-pointer"
              >
                Install App
              </button>
            )}
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
              {isPro ? <span>Pro Clearance</span> : isVip ? <span>VIP Clearance</span> : <span>Clearance</span>}
            </button>
            <button
              type="button"
              onClick={handleCopyDeviceId}
              title="Click to copy Device ID"
              aria-label={`Copy Device ID ${myDna}`}
              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/50 rounded text-xs text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1.5 shrink-0 cursor-pointer transition-all active:scale-95 group"
            >
              <span className="text-slate-500">ID:</span> <span className="text-cyan-400 font-semibold">{myDna}</span>
              {copiedDeviceId ? (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-bold bg-emerald-950/70 border border-emerald-500/40 px-1 py-0.2 rounded animate-pulse">
                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                  <span>COPIED</span>
                </span>
              ) : (
                <Copy className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors" />
              )}
            </button>
            {route !== "chat" && (
              <button
                onClick={() => openPairingModal("host")}
                className="px-2.5 py-1 text-xs font-mono font-medium rounded-md border border-cyan-500/40 text-cyan-300 bg-cyan-950/30 hover:bg-cyan-900/40 hover:border-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                title="Sync Browser identity using a 6-digit code"
              >
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sync Browser</span>
              </button>
            )}
            {route !== "chat" && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Navigation Menu"
                aria-label="Open navigation menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* MAIN CENTER FLEXIBLE WORKSPACE DISPLAY */}
        <main className="flex-1 min-h-0 w-full overflow-hidden flex flex-col items-center bg-[#020202]/30 backdrop-blur-sm">
          
          {/* Gateways form on PC - Single Centered Column */}
          {route === "gate" && (
            <div className="w-full flex-1 overflow-y-auto px-4 sm:px-6 py-8 flex flex-col items-center">
              <TerminalGate
                nickname={nickname}
                setNickname={setNickname}
                gender={gender}
                setGender={setGender}
                timerSeconds={timerSeconds}
                setTimerSeconds={setTimerSeconds}
                roomType={roomType}
                setRoomType={setRoomType}
                isPro={isPro}
                isVip={isVip}
                setShowProWarningModal={setShowProWarningModal}
                turnstileToken={turnstileToken}
                setTurnstileToken={setTurnstileToken}
                turnstileResetSignal={turnstileResetSignal}
                onResetTurnstile={resetTurnstile}
                captchaError={captchaError}
                setCaptchaError={setCaptchaError}
                isCreatingRoom={isCreatingRoom}
                handleCreateRoom={handleCreateRoom}
                inputRoomCode={inputRoomCode}
                setInputRoomCode={setInputRoomCode}
                handleJoinRoom={handleJoinRoom}
                linkRoomFull={linkRoomFull}
                linkRoomExpired={linkRoomExpired}
                handleResetExpiredRoom={handleResetExpiredRoom}
                myDna={myDna}
                navigateTo={navigateTo}
              />
            </div>
          )}

          {/* PC Chat Terminal Interface layout */}
          {route === "chat" && activeRoom && (
            <div className="w-full max-w-5xl h-[calc(100dvh-4.5rem)] max-h-[calc(100dvh-4.5rem)] min-h-0 p-2 sm:p-4 flex flex-col flex-1 overflow-hidden">
              <div className="flex flex-col flex-1 min-h-0 h-full max-h-full w-full bg-[#0b0f19] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <InnerRoomView
                  activeRoom={activeRoom}
                  roomMessages={roomMessages}
                  myDna={myDna}
                  nickname={nickname}
                  gender={gender}
                  isPro={isPro}
                  isVip={isVip}
                  roomConnectionStatus={roomConnectionStatus}
                  onRetryConnection={handleRetryConnection}
                  onExitRoom={handleExitRoom}
                  messageText={messageText}
                  setMessageText={setMessageText}
                  onSendMessage={sendMessagePacket}
                  onUserTyping={handleRoomUserTyping}
                  activeRoomTypers={activeRoomTypers}
                  mediaCounter={mediaCounter}
                  isUploadCapReached={isUploadCapReached}
                  isUploadingPhoto={isUploadingPhoto}
                  uploadingThumbnail={uploadingThumbnail}
                  uploadPhotoError={uploadPhotoError}
                  failedPhotoData={failedPhotoData}
                  onRetryPhotoUpload={() => {
                    if (failedPhotoData) {
                      uploadAndSend(failedPhotoData.base64, failedPhotoData.extension, "image");
                    }
                  }}
                  onDismissPhotoError={() => {
                    setUploadPhotoError(null);
                    setFailedPhotoData(null);
                    setUploadingThumbnail(null);
                  }}
                  onPhotoSelected={handlePhotoUploadPress}
                  isRecording={isRecording}
                  recordingSeconds={recordingSeconds}
                  startAudioRecording={startAudioRecording}
                  stopAudioRecording={stopAudioRecording}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  revealedMediaIds={revealedMediaIds}
                  toggleRevealMedia={toggleRevealMedia}
                  onCopyMessage={copyMessageText}
                  copiedMessageId={copiedMessageId}
                  onDeleteMessage={deleteMessage}
                  pusherWarning={pusherWarning}
                  onDismissPusherWarning={() => setPusherWarning(null)}
                  onP2PFileSelected={handleP2PFileSelected}
                  p2pTransferState={p2pTransferState}
                  incomingP2POffer={incomingP2POffer}
                  onAcceptP2POffer={handleAcceptP2POffer}
                  onDeclineP2POffer={handleDeclineP2POffer}
                  onCancelP2P={handleCancelP2P}
                  isStegoMode={isStegoMode}
                  onToggleStegoMode={() => setIsStegoMode((prev) => !prev)}
                  onTriggerPanic={handleTriggerPanic}
                />
              </div>
            </div>
          )}

          {
}
          

          {(route === "globallobby" || (route as any) === "world-chat") && (
            <div className="w-full max-w-5xl h-[calc(100dvh-4.5rem)] p-2 sm:p-4 flex flex-col overflow-hidden">
              <WorldChat 
                myDna={myDna}
                nickname={nickname}
                onOpenVip={() => navigateTo("premium")}
                isVip={isVip}
                isPro={isPro}
                isPingSoundEnabled={isPingSoundEnabled}
                onAliasChange={(newAlias) => {
                  setNickname(newAlias);
                  safeStorage.setItem("phantom_nickname", newAlias);
                }}
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
              />
            </div>
          )}

          {route === "inbox" && (
            <div className="w-full max-w-5xl h-[calc(100dvh-4.5rem)] p-2 sm:p-4 flex flex-col overflow-hidden">
              <InboxView 
                myDna={myDna}
                inboxEntries={inboxEntries}
                establishedContacts={establishedContacts}
                onRefreshInbox={refreshInboxAndContacts}
                onAcceptHandshake={handleAcceptHandshakeFromInbox}
                onDeclineHandshake={handleDeclineHandshakeFromInbox}
                prefilledNegotiation={prefilledNegotiation}
                clearPrefilledNegotiation={handleClearPrefilledNegotiation}
                prefilledRecipientDna={prefilledInboxRecipient}
                clearPrefilledRecipient={() => setPrefilledInboxRecipient(null)}
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                navigateTo={navigateTo}
              />
            </div>
          )}

          {route === "friends" && (
            <div className="w-full max-w-5xl h-[calc(100dvh-4.5rem)] p-2 sm:p-4 flex flex-col overflow-hidden">
              <FriendsPage 
                myDna={myDna}
                externalFriends={contactsList}
                onRefreshContacts={refreshInboxAndContacts}
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                navigateTo={navigateTo}
                playPingSound={playPingSound}
                onInviteToInbox={handleInviteToInbox}
              />
            </div>
          )}

          {route === "faq" && (
            <div className="w-full max-w-5xl h-[calc(100dvh-4.5rem)] p-2 sm:p-4 flex flex-col overflow-hidden">
              <FaqPage 
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                myDna={myDna}
              />
            </div>
          )}

          {route === "ideas" && (
            <div className="w-full max-w-5xl h-[calc(100dvh-4.5rem)] p-2 sm:p-4 flex flex-col overflow-y-auto">
              <IdeasBoard 
                myDna={myDna}
                myAlias={nickname || "ANONYMOUS"}
                onBack={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                navigateTo={navigateTo}
                onNegotiate={handleOpenNegotiation}
              />
            </div>
          )}

        </main>
      </div>
      )}

      {/* ========================================================== */}
      {/* GLOBAL HUD SLIDEOUT OVERLAY DRAWER */}
      <NavigationDrawer
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRoute={route}
        navigateTo={navigateTo}
        activeRoom={activeRoom}
        inboxEntriesCount={inboxEntries.filter(e => !e.read).length}
        isPingSoundEnabled={isPingSoundEnabled}
        setIsPingSoundEnabled={setIsPingSoundEnabled}
        playPingSound={playPingSound}
        isPwaInstalled={isPwaInstalled}
        triggerPwaInstall={triggerPwaInstall}
        isPro={isPro}
        isVip={isVip}
        myDna={myDna}
        onOpenPairingModal={route !== "chat" ? () => openPairingModal("host") : undefined}
        onTriggerUpdateModal={() => setShowUpdateModal(true)}
      />

      {/* ========================================================== */}
      {/* PWA / WEB APP SAFE UPDATE MODAL                           */}
      {/* ========================================================== */}
      <UpdateModal
        isOpen={showUpdateModal}
        onClose={() => setShowUpdateModal(false)}
        isInActiveRoom={Boolean(activeRoom)}
        latestVersion={latestUpdateVersion}
      />

      {/* ========================================================== */}
      {/* PWA CUSTOM INSTALLATION GUIDE MODAL                        */}
      {/* ========================================================== */}
      {showPwaGuide && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPwaGuide(false);
            }
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#0F121A] border border-slate-800 rounded-xl p-6 sm:p-7 shadow-2xl font-sans text-left space-y-5 my-auto transform transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-cyan-400" />
                <h3 id="pwa-guide-title" className="text-base font-semibold text-white">
                  Install Phantom Chat
                </h3>
              </div>
              <button 
                onClick={() => setShowPwaGuide(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Install Phantom Chat as a progressive web app (PWA) on your home screen or desktop for fast, standalone access.
            </p>

            {/* Platform Selector Tabs */}
            <div className="flex bg-[#141824] border border-slate-800 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setPwaGuideTab("ios")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  pwaGuideTab === "ios"
                    ? "bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Apple iOS (Safari)</span>
              </button>
              <button
                type="button"
                onClick={() => setPwaGuideTab("android")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  pwaGuideTab === "android"
                    ? "bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Android / Desktop</span>
              </button>
            </div>

            {/* Instructions */}
            <div className="space-y-3 text-xs text-slate-300">
              {pwaGuideTab === "ios" ? (
                <div className="space-y-2.5">
                  <div className="bg-[#141824] p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs">
                      1
                    </span>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Tap the <strong className="text-white">Share</strong> icon (square with an arrow pointing up) in Safari&#39;s bottom toolbar.
                    </p>
                  </div>

                  <div className="bg-[#141824] p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs">
                      2
                    </span>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Scroll down the sharing options and select <strong className="text-white">Add to Home Screen</strong>.
                    </p>
                  </div>

                  <div className="bg-[#141824] p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs">
                      3
                    </span>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Tap <strong className="text-white">Add</strong> in the top-right corner. The Phantom Chat icon will appear on your home screen.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="bg-[#141824] p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs">
                      1
                    </span>
                    <p className="text-xs leading-relaxed text-slate-300">
                      In Chrome, Edge, or Brave, look for the <strong className="text-white">Install</strong> icon in the right side of the address bar.
                    </p>
                  </div>

                  <div className="bg-[#141824] p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs">
                      2
                    </span>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Alternatively, click the browser&#39;s <strong className="text-white">3-dot menu</strong> and select <strong className="text-white">Install Phantom Chat</strong> or <strong className="text-white">Add to Home screen</strong>.
                    </p>
                  </div>

                  <div className="bg-[#141824] p-3 rounded-lg border border-slate-800 flex items-start gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-cyan-950 text-cyan-400 font-bold text-xs">
                      3
                    </span>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Confirm installation to launch Phantom Chat in an isolated, distraction-free app window.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-[11px] text-slate-400 leading-relaxed">
                <span className="font-semibold text-slate-300 block mb-0.5">Sandbox note:</span>
                If viewing inside an embedded preview frame or web sandbox, browsers block direct installation dialogs. Please visit <strong className="text-slate-200">phantomchat.space</strong> directly in your browser.
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPwaGuide(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Close Guide
              </button>
          </div>
        </div>
      </div>,
      document.body
    )}

      {/* ========================================================== */}
      {/* NOWPAYMENTS PRO SUBSCRIPTION INTERFACE - $9.99 / 30 DAYS */}
      {/* ========================================================== */}
      {route === "premium" && (
        <>
          {/* Human Verification Gate for /premium */}
          {!isPremiumVerified && (
            <PremiumCaptchaGate
              onVerified={() => setIsPremiumVerified(true)}
              onCancel={() => {
                if (activeRoom) {
                  navigateTo("chat");
                } else {
                  navigateTo("gate");
                }
              }}
            />
          )}

          <div className="min-h-screen w-full bg-transparent flex flex-col items-center justify-center p-4 font-mono select-none overflow-y-auto relative z-40">
          {/* Subtle Cyber Grid Background & Glows */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#151515_1px,transparent_1px),linear-gradient(to_bottom,#151515_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
          
          <div className="absolute top-[20%] right-[10%] w-[350px] h-[350px] rounded-full bg-[#00BFFF] opacity-[0.08] blur-[100px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-[20%] left-[10%] w-[350px] h-[350px] rounded-full bg-[#00E5FF] opacity-[0.08] blur-[100px] pointer-events-none animate-pulse" />

          {/* Page Container */}
          <div className="relative w-full max-w-xl border-2 border-[#00BFFF]/40 rounded-xl p-5 sm:p-7 md:p-8 z-10 space-y-6 shadow-[0_0_30px_rgba(0,191,255,0.15)] bg-black/90 backdrop-blur-xl">
            
            {/* CLOSE BUTTON */}
            <div className="absolute top-4 right-4 z-50">
              <button 
                onClick={() => {
                  if (activeRoom) {
                    navigateTo("chat");
                  } else {
                    navigateTo("gate");
                  }
                }}
                className="p-1.5 bg-black border border-gray-800 rounded-md text-gray-400 hover:text-[#00BFFF] hover:border-[#00BFFF] hover:bg-[#00BFFF]/10 transition-colors cursor-pointer flex items-center space-x-1"
                title="Return to Main Terminal"
                id="premium-close-button"
              >
                <X className="w-4 h-4" />
                <span className="text-[9px] uppercase font-bold tracking-wider px-1">Close</span>
              </button>
            </div>

            {/* HEADER */}
            <div className="text-center space-y-2">
              <Crown className="w-10 h-10 mx-auto text-[#00BFFF] fill-[#00BFFF]/20 animate-bounce" />
              <h3 className="text-xl font-black tracking-widest text-[#00BFFF] text-glow-blue uppercase">
                PHANTOM PRO CLEARANCE
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">// HOSTED NOWPAYMENTS CHECKOUT PROTOCOL //</p>
            </div>

            {/* RETURN NOTIFICATIONS (SUCCESS & CANCEL) */}
            {(window.location.search.includes("payment=success") || paymentSuccessNotice) && (
              <div className="p-4 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-lg text-emerald-400 space-y-1.5 text-center shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-in fade-in">
                <div className="flex justify-center items-center space-x-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-black uppercase tracking-wider">PAYMENT CONFIRMED</h4>
                </div>
                <p className="text-[11px] text-emerald-300 font-mono">
                  Your payment was successfully processed! Pro Clearance activated for 30 days for Device DNA: <strong className="text-white">{myDna}</strong>.
                </p>
              </div>
            )}

            {window.location.search.includes("payment=cancel") && (
              <div className="p-4 bg-amber-950/40 border-2 border-amber-500/60 rounded-lg text-amber-400 space-y-1.5 text-center shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-in fade-in">
                <div className="flex justify-center items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <h4 className="text-sm font-black uppercase tracking-wider">CHECKOUT CANCELED</h4>
                </div>
                <p className="text-[11px] text-amber-300 font-mono">
                  The payment session was canceled. You can try again whenever you are ready.
                </p>
              </div>
            )}

            {/* ERROR STATE */}
            {payError && (
              <div className="p-3 bg-red-950/50 border border-red-500/50 rounded-lg text-red-400 text-xs text-center flex items-center justify-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{payError}</span>
              </div>
            )}

            {/* PRO CLEARANCE SYNC DISCLAIMER */}
            <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-start gap-3 shadow-[0_0_20px_rgba(245,158,11,0.15)] leading-relaxed">
              <span className="shrink-0 text-amber-400 font-bold select-none text-base">⚠️</span>
              <p className="text-[11px] sm:text-xs font-sans leading-relaxed text-amber-200/90">
                <strong className="font-semibold text-amber-300 font-mono">PRO CLEARANCE NOTICE:</strong> Your Pro status is cryptographically tied to your specific Device ID (TR-XXXXX). When opening Phantom Chat on a new browser or secondary device, always use Sync Browser to pair it with your Pro Device ID. Generating a new unlinked Device ID will not inherit your Pro clearance.
              </p>
            </div>

            {/* SINGLE PRO OFFER CARD */}
            <div className="border border-[#00BFFF]/30 bg-black/80 rounded-xl p-5 space-y-5 shadow-[0_0_20px_rgba(0,191,255,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-[#00BFFF]/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-[#00BFFF]" />
                    <span className="text-sm font-black text-[#00BFFF] tracking-widest uppercase">PRO CLEARANCE</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono uppercase">Full Unrestricted Matrix Access</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-[#00BFFF] text-glow-blue">$2.50 <span className="text-xs font-bold text-gray-400">USD</span></p>
                  <p className="text-[9px] text-gray-500 font-mono uppercase">30 Days Duration</p>
                </div>
              </div>

              {/* FEATURES LIST */}
              <ul className="text-xs text-gray-300 space-y-2.5 font-mono">
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#00BFFF] flex-shrink-0" />
                  <span>30 Days Full Pro Access & Priority Bandwidth</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#00BFFF] flex-shrink-0" />
                  <span>Extended Session Timers (Up to 60 minutes)</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#00BFFF] flex-shrink-0" />
                  <span>Unlimited High-Res Image Transmissions & Voice Clips</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#00BFFF] flex-shrink-0" />
                  <span>Full Group Room Protocol Access</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Check className="w-4 h-4 text-[#00BFFF] flex-shrink-0" />
                  <span>Persistent Device DNA Memory Binding</span>
                </li>
              </ul>

              {/* ACTION CTA BUTTON WITH EMBEDDED OVERLAY TRIGGER */}
              <div className="pt-2">
                <button
                  type="button"
                  id="get-pro-button"
                  disabled={payLoading}
                  onClick={async () => {
                    setPayLoading(true);
                    setPayError(null);
                    try {
                      const endpoint = import.meta.env.VITE_WORKER_URL
                        ? `${import.meta.env.VITE_WORKER_URL.replace(/\/$/, "")}/api/payment/create-pro`
                        : "/api/payment/create-pro";

                      const res = await fetch(endpoint, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ dna: myDna })
                      });
                      const invoiceData = await res.json().catch(() => ({}));
                      const fetchedInvoiceId = invoiceData.id || invoiceData.invoice_id || "5459323091";
                      setWidgetInvoiceId(fetchedInvoiceId);
                      setShowNowPaymentsWidgetModal(true);
                    } catch (err) {
                      console.error("Error creating NOWPayments invoice:", err);
                      setWidgetInvoiceId("5459323091");
                      setShowNowPaymentsWidgetModal(true);
                    } finally {
                      setPayLoading(false);
                    }
                  }}
                  className="w-full py-3.5 bg-[#00BFFF] hover:bg-cyan-300 text-black font-black text-xs tracking-widest rounded-lg transition-all uppercase cursor-pointer shadow-[0_0_20px_rgba(0,191,255,0.4)] flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {payLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>INITIALIZING SECURE CHECKOUT...</span>
                    </>
                  ) : (
                    <>
                      <Crown className="w-4 h-4 text-black fill-black" />
                      <span>GET PRO — $2.50</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* BASE INFO FOOTER */}
            <div className="flex justify-between items-center text-[10px] text-gray-500 font-bold border-t border-gray-800 pt-4">
              <p className="uppercase">DEVICE DNA: <span className="text-[#00BFFF]">{myDna}</span></p>
              <button 
                type="button"
                onClick={() => setShowAboutUpgrade(!showAboutUpgrade)}
                className="text-[#00BFFF] hover:text-white underline transition uppercase cursor-pointer"
              >
                ABOUT UPGRADE
              </button>
            </div>

            {/* ABOUT UPGRADE EXTENDED PARAGRAPH */}
            {showAboutUpgrade && (
              <div className="p-4 bg-black/60 border border-gray-800 rounded-lg text-xs text-gray-400 leading-relaxed font-mono animate-in fade-in duration-200">
                <p>
                  <strong className="text-gray-200">Phantom Pro Clearance:</strong> Unlocks extended room timers, group messaging protocols, unlimited file & voice clip transmissions, and priority bandwidth across all nodes. Each payment is permanently bound to your physical device DNA ({myDna}).
                </p>
              </div>
            )}

          </div>

          {/* NOWPAYMENTS EMBEDDED WIDGET OVERLAY MODAL */}
          <ProModal
            showModal={showNowPaymentsWidgetModal}
            onClose={() => setShowNowPaymentsWidgetModal(false)}
            myDna={myDna}
            widgetInvoiceId={widgetInvoiceId}
          />
        </div>
        </>
      )}

      {/* ========================================================== */}
      {/* ALIAS REQUIRED MODAL POPUP */}
      {/* ========================================================== */}
      {/* PRO WARNING MODAL POPUP */}
      {/* ========================================================== */}
      {showProWarningModal && createPortal(
        <div 
          role="dialog"
          aria-modal="true"
          aria-labelledby="pro-modal-title"
          className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowProWarningModal(false);
            }
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-[#0F121A] border border-slate-800 rounded-xl p-6 sm:p-7 shadow-2xl space-y-4 text-left my-auto transform transition-all"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 id="pro-modal-title" className="text-base font-semibold text-white">
                  Pro Clearance Required
                </h3>
              </div>
              <button
                onClick={() => setShowProWarningModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Group chat channels allow multi-participant sessions and require an active Pro clearance upgrade. Standard 1-on-1 private rooms are always free.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => {
                  setShowProWarningModal(false);
                  navigateTo("premium");
                }}
                className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer text-center"
              >
                View Pro Clearance
              </button>
              <button
                onClick={() => setShowProWarningModal(false)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 6-Digit Browser Sync Modal */}
      {isPairingModalOpen && (
        <PairingModal
          isOpen={isPairingModalOpen}
          onClose={closePairingModal}
          initialMode={pairingMode}
          onPairSuccess={(syncedDeviceId) => {
            safeStorage.setItem("phantom_device_id", syncedDeviceId);
            safeStorage.setItem("phantom_is_synced", "true");
            safeStorage.setItem("phantom_synced_device_id", syncedDeviceId);
            safeStorage.setItem("deviceId", syncedDeviceId);
            safeStorage.setItem("phantom_device_dna", syncedDeviceId);
            safeStorage.setItem("isDeviceIdLocked", "true");
            setMyDna(syncedDeviceId);
            updateDeviceId(syncedDeviceId);

            // Trigger a re-fetch of the Pro status from Firebase/Cloudflare KV to immediately reflect active Pro clearance
            window.dispatchEvent(
              new CustomEvent("phantom_pro_updated", {
                detail: { deviceId: syncedDeviceId, isProRefresh: true },
              })
            );

            // Trigger a global state refresh so the active device ID updates across the UI without requiring a hard refresh
            window.dispatchEvent(
              new CustomEvent("phantom_device_synced", {
                detail: { deviceId: syncedDeviceId, isDeviceIdLocked: true },
              })
            );
            window.dispatchEvent(
              new CustomEvent("phantom_device_updated", {
                detail: { deviceId: syncedDeviceId },
              })
            );
          }}
        />
      )}

      {/* Smooth Floating Cyberpunk Toasts */}
      {copiedDeviceIdToast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 cyber-toast px-6 py-3 border-2 border-[#00FFFF] bg-black text-[#00FFFF] font-mono font-black text-xs sm:text-sm tracking-[0.2em] rounded-md shadow-[0_0_25px_rgba(0,255,255,0.6)] flex items-center space-x-2 animate-in fade-in select-none">
          <span className="shrink-0 text-[#00FFFF]">⚡</span>
          <span>DEVICE ID COPIED TO CLIPBOARD!</span>
        </div>
      )}
      {copiedCode && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 cyber-toast px-6 py-3 border-2 border-dashed border-[#00FFFF] bg-black text-[#00FFFF] font-mono font-black text-xs sm:text-sm tracking-[0.2em] rounded-md shadow-[0_0_25px_rgba(0,255,255,0.6)] flex items-center space-x-2">
          <span className="shrink-0 text-[#00FFFF]">⚡</span>
          <span>PORT CODE COPIED</span>
        </div>
      )}
      {copiedLink && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 cyber-toast px-6 py-3 border-2 border-dashed border-[#FF00FF] bg-black text-[#FF00FF] font-mono font-black text-xs sm:text-sm tracking-[0.2em] rounded-md shadow-[0_0_25px_rgba(255,0,255,0.6)] flex items-center space-x-2">
          <span className="shrink-0 text-[#FF00FF]">✨</span>
          <span>LINK COPIED</span>
        </div>
      )}
      {copiedText && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 cyber-toast px-6 py-3 border-2 border-[#00FFFF] bg-black text-[#00FFFF] font-mono font-black text-xs sm:text-sm tracking-[0.2em] rounded-md shadow-[0_0_25px_rgba(0,255,255,0.6)] flex items-center space-x-2">
          <span className="shrink-0 text-[#00FFFF]">⚡</span>
          <span>TEXT COPIED</span>
        </div>
      )}
    </div>
    </>
  );
}

// Exportable trigger for external or custom integration
export function triggerParticleRipple(event?: any) {
  window.triggerParticleRipple?.(event);
}
