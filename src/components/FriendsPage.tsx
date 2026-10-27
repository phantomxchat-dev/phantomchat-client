import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Users, UserPlus, UserX, UserMinus, ShieldAlert, Heart, Radio, Send, Play, MessageSquare, Clock, ArrowLeft, ToggleLeft, ToggleRight, Search, Shield, Bell, Check, X
} from "lucide-react";
import { db, doc, getDoc, setDoc, updateDoc, deleteDoc } from "../services/firestoreShim";
import { sendTransmission, removeTransmissionFromRtdb } from "../utils/realtimeDb";

interface Friend {
  id: string; // friendship document ID
  dna1: string;
  dna2: string;
  status: "pending_1_to_2" | "pending_2_to_1" | "accepted" | "declined" | "blocked";
  requesterDna: string;
  updatedAt: number;
}

interface Presence {
  dna: string;
  alias: string;
  status: "ONLINE" | "IN ROOM" | "OFFLINE";
  showOnline: boolean;
  updatedAt: number;
}

interface FriendsPageProps {
  myDna: string;
  externalFriends?: Friend[];
  onRefreshContacts?: () => Promise<void> | void;
  onBack: () => void;
  navigateTo: (route: any, optRoomCode?: string) => void;
  playPingSound: () => void;
  onInviteToInbox?: (targetDna: string) => void;
}

export default function FriendsPage({
  myDna,
  externalFriends,
  onRefreshContacts,
  onBack,
  navigateTo,
  playPingSound,
  onInviteToInbox,
}: FriendsPageProps) {
  const [friends, setFriends] = useState<Friend[]>(externalFriends || []);
  const [presences, setPresences] = useState<Record<string, Presence>>({});

  useEffect(() => {
    if (Array.isArray(externalFriends)) {
      setFriends(externalFriends);
    }
  }, [externalFriends]);
  const [showOnlinePrivacy, setShowOnlinePrivacy] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("phantom_privacy_show_online");
      return saved !== "false";
    } catch {
      return true;
    }
  });

  // Rate limiting & inputs
  const [friendCodeInput, setFriendCodeInput] = useState("");
  const [lastRequestTime, setLastRequestTime] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sound play wrapper
  const triggerPing = () => {
    playPingSound();
  };

  // Local storage effect for privacy toggle
  useEffect(() => {
    localStorage.setItem("phantom_privacy_show_online", String(showOnlinePrivacy));
  }, [showOnlinePrivacy]);

  // Presence Heartbeat
  useEffect(() => {
    if (!myDna) return;
    const updateMyPresence = async () => {
      try {
        await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dna: myDna.toUpperCase(),
            alias: `OPERATOR ${myDna.toUpperCase()}`,
            status: showOnlinePrivacy ? "ONLINE" : "OFFLINE",
            showOnline: showOnlinePrivacy,
            updatedAt: Date.now()
          })
        });
      } catch (err) {
        // silent
      }
    };
    updateMyPresence();
    const interval = setInterval(updateMyPresence, 20000);
    return () => clearInterval(interval);
  }, [myDna, showOnlinePrivacy]);

  const getFriendshipId = (dnaA: string, dnaB: string) => {
    const a = (dnaA || "").toUpperCase();
    const b = (dnaB || "").toUpperCase();
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  };

  const isValidDeviceId = (id: string) => {
    if (!id || typeof id !== "string") return false;
    const trimmed = id.trim();
    return trimmed.length >= 4 && trimmed.length <= 32 && /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){0,2}$/i.test(trimmed);
  };

  const fetchFriendsList = React.useCallback(async () => {
    if (!myDna) return;
    try {
      const cleanDna = (myDna || "").toUpperCase();
      const res = await fetch(`/api/contacts/handshake?dna=${encodeURIComponent(cleanDna)}`, {
        headers: { "X-Device-DNA": cleanDna }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : Array.isArray(data?.friends) ? data.friends : [];
        setFriends(list);
      }
    } catch {}
  }, [myDna]);

  // Load friends relationships
  useEffect(() => {
    if (!myDna) return;
    fetchFriendsList();
    const interval = setInterval(fetchFriendsList, 4000);
    const onFocus = () => fetchFriendsList();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [myDna, fetchFriendsList]);

  // Load online presences
  useEffect(() => {
    let isCancelled = false;
    const fetchPresences = async () => {
      try {
        const res = await fetch("/api/presence");
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data && typeof data === "object") {
            setPresences(data);
          }
        }
      } catch {}
    };
    fetchPresences();
    const interval = setInterval(fetchPresences, 5000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Friend Request Dispatch via /api/contacts/handshake
  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = (friendCodeInput || "").trim().toUpperCase();
    if (!target) return;

    // Validate Device ID format before submitting
    if (!isValidDeviceId(target)) {
      setStatusMessage({
        type: "error",
        text: "INVALID DEVICE ID FORMAT: EXPECTED E.G. AB-123 OR DNA-1A2B3C"
      });
      triggerPing();
      return;
    }

    // Prevention checks
    const dnaA = (myDna || "").toUpperCase();
    if (target === dnaA) {
      setStatusMessage({ type: "error", text: "SYSTEM BLOCK: SELF-REQUEST DETECTED" });
      triggerPing();
      return;
    }

    // Basic Rate Limiting: 3 seconds between request actions
    const now = Date.now();
    if (now - lastRequestTime < 3000) {
      setStatusMessage({ type: "error", text: "SYSTEM THREAD BLOCKED: RATE LIMIT EXCEEDED" });
      triggerPing();
      return;
    }
    setLastRequestTime(now);

    try {
      const hsId = getFriendshipId(dnaA, target);
      // Push handshake request to Firebase Realtime Database transmissions/${target}
      sendTransmission(target, {
        id: `hs_${hsId}`,
        sender_dna: dnaA,
        fromDna: dnaA,
        recipient_dna: target,
        toDna: target,
        type: "FRIEND_REQUEST",
        friendRequestId: hsId,
        fromAlias: `OPERATOR ${dnaA}`,
        message: `INCOMING VERIFIED CONTACT HANDSHAKE REQUEST FROM OPERATOR ${dnaA}`,
        status: "pending",
        timestamp: now,
        created_at: now,
      }).catch(() => {});

      const res = await fetch("/api/contacts/handshake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-DNA": dnaA
        },
        body: JSON.stringify({
          sender_dna: dnaA,
          recipient_dna: target,
          status: "pending",
          created_at: now
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusMessage({
          type: "error",
          text: data.error || "HANDSHAKE REQUEST REJECTED"
        });
        triggerPing();
        return;
      }

      setStatusMessage({
        type: "success",
        text: data.message || `FRIEND HANDSHAKE DISPATCHED TO: ${target}`
      });
      setFriendCodeInput("");
      triggerPing();
      await fetchFriendsList();
      if (onRefreshContacts) await onRefreshContacts();
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: "error", text: "COMMUNICATION ENVELOPE ROUTING FAILURE" });
    }
  };

  // Accept Friend Request helper
  const handleAcceptRequest = async (friendId: string, inboxEntryId?: string) => {
    try {
      const cleanDna = (myDna || "").toUpperCase();
      setFriends((prev) =>
        prev.map((f) => (f.id === friendId ? { ...f, status: "accepted", updatedAt: Date.now() } : f))
      );
      const res = await fetch("/api/contacts/handshake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-DNA": cleanDna
        },
        body: JSON.stringify({
          action: "ACCEPT",
          status: "accepted",
          handshakeId: friendId,
          requesterDna: cleanDna
        })
      });
      if (inboxEntryId) {
        await fetch(`/api/inbox?id=${encodeURIComponent(inboxEntryId)}`, {
          method: "DELETE",
          headers: { "X-Device-DNA": cleanDna }
        });
      }
      if (res.ok) {
        setStatusMessage({ type: "success", text: "HANDSHAKE APPROVED: NETWORK CHANNEL ESTABLISHED" });
        triggerPing();
        await fetchFriendsList();
        if (onRefreshContacts) await onRefreshContacts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Decline/Remove Friend Request helper
  const handleDeclineRequest = async (friendId: string, inboxEntryId?: string) => {
    try {
      const cleanDna = (myDna || "").toUpperCase();
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      await fetch("/api/contacts/handshake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-DNA": cleanDna
        },
        body: JSON.stringify({
          action: "DECLINE",
          status: "declined",
          handshakeId: friendId,
          requesterDna: cleanDna
        })
      });
      if (inboxEntryId) {
        await fetch(`/api/inbox?id=${encodeURIComponent(inboxEntryId)}`, {
          method: "DELETE",
          headers: { "X-Device-DNA": cleanDna }
        });
      }
      setStatusMessage({ type: "success", text: "HANDSHAKE DECLINED" });
      triggerPing();
      await fetchFriendsList();
      if (onRefreshContacts) await onRefreshContacts();
    } catch (err) {
      console.error(err);
    }
  };

  // Block a user completely
  const handleBlockUser = async (targetDna: string, friendshipId?: string, inboxEntryId?: string) => {
    try {
      const cleanDna = (myDna || "").toUpperCase();
      const docId = friendshipId || getFriendshipId(cleanDna, targetDna);
      await fetch("/api/contacts/handshake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-DNA": cleanDna
        },
        body: JSON.stringify({
          action: "BLOCK",
          status: "blocked",
          handshakeId: docId,
          requesterDna: cleanDna,
          targetDna: (targetDna || "").toUpperCase()
        })
      });
      if (inboxEntryId) {
        await fetch(`/api/inbox?id=${encodeURIComponent(inboxEntryId)}`, {
          method: "DELETE",
          headers: { "X-Device-DNA": cleanDna }
        });
      }
      setStatusMessage({ type: "success", text: "OPERATOR SHIELDED: TARGET PERMANENTLY BLOCKED" });
      triggerPing();
      await fetchFriendsList();
    } catch (err) {
      console.error(err);
    }
  };

  // Room Invite Dispatcher
  const handleSendRoomInvite = async (targetDna: string) => {
    try {
      const cleanDna = (myDna || "").toUpperCase();
      const cleanTarget = (targetDna || "").toUpperCase();
      const tempRoomCode = `${Math.floor(100000 + Math.random() * 900000)}`;
      const invitePayload = {
        recipient_dna: cleanTarget,
        toDna: cleanTarget,
        sender_dna: cleanDna,
        fromDna: cleanDna,
        type: "ROOM_INVITE",
        roomCode: tempRoomCode,
        message: tempRoomCode,
        fromAlias: `OPERATOR ${cleanDna}`,
        timestamp: Date.now(),
      };

      // Push room invite to Firebase Realtime Database transmissions/${targetDeviceId}
      sendTransmission(cleanTarget, invitePayload).catch(() => {});

      await fetch("/api/inbox/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-DNA": cleanDna
        },
        body: JSON.stringify(invitePayload)
      });

      setStatusMessage({ type: "success", text: `SECURE ROOM CALL HANDSHAKE ROUTED TO: ${cleanTarget}` });
      triggerPing();
    } catch (err) {
      console.error(err);
    }
  };

  // Partition Friends List for beautiful categorization
  const acceptedFriends = friends.filter(f => f.status === "accepted");
  const pendingIncoming = friends.filter(f => 
    (f.status === "pending_1_to_2" && f.dna2 === (myDna || "").toUpperCase()) ||
    (f.status === "pending_2_to_1" && f.dna1 === (myDna || "").toUpperCase())
  );
  const pendingOutgoing = friends.filter(f => 
    (f.status === "pending_1_to_2" && f.dna1 === (myDna || "").toUpperCase()) ||
    (f.status === "pending_2_to_1" && f.dna2 === (myDna || "").toUpperCase())
  );
  const blockedList = friends.filter(f => f.status === "blocked" && f.requesterDna === (myDna || "").toUpperCase());

  // Determine friendship partner profile helper
  const getPartnerDna = (f: Friend) => {
    return f.dna1 === (myDna || "").toUpperCase() ? f.dna2 : f.dna1;
  };

  // Determine detailed status with privacy considerations
  const getFriendStatusDisplay = (friendDna: string) => {
    const targetPresence = presences[(friendDna || "").toUpperCase()];
    if (!showOnlinePrivacy) return { text: "OFFLINE", color: "text-gray-500", raw: "OFFLINE" };
    if (!targetPresence || !targetPresence.showOnline) return { text: "OFFLINE", color: "text-gray-500", raw: "OFFLINE" };
    
    switch (targetPresence.status) {
      case "ONLINE": return { text: "ONLINE // DOCKED", color: "text-emerald-400 animate-pulse", raw: "ONLINE" };
      case "IN ROOM": return { text: "CONNECTED // CHAT", color: "text-[#00BFFF]", raw: "IN ROOM" };
      default: return { text: "OFFLINE", color: "text-gray-500", raw: "OFFLINE" };
    }
  };

  return (
    <div className="w-full flex-grow flex flex-col h-full bg-[#090A0F] text-slate-200 overflow-y-auto p-4 sm:p-6 font-sans">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            title="Return to Gateway"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              <span>Verified Contacts</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Direct peer-to-peer correspondence using temporary device IDs.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-400">
            <span>Your ID:</span>
            <span className="text-cyan-400 font-semibold">{(myDna || "").toUpperCase()}</span>
          </div>

          {/* Privacy Toggle: Show Me Online */}
          <button 
            type="button"
            onClick={() => setShowOnlinePrivacy(!showOnlinePrivacy)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
              showOnlinePrivacy
                ? "bg-cyan-950/40 border-cyan-500/50 text-cyan-300"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${showOnlinePrivacy ? "bg-emerald-400" : "bg-slate-500"}`} />
            <span>Presence: {showOnlinePrivacy ? "Visible (Online)" : "Hidden (Offline)"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left column: Add Contact (5 columns) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-[#0F121A] p-5 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Add Contact</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Send a handshake request by entering your peer's device ID. Handshakes are sent only when you click send.
              </p>
            </div>

            <form onSubmit={handleSendRequest} className="space-y-3">
              <div>
                <label htmlFor="friend-code-input" className="block text-[11px] text-slate-400 mb-1">
                  Recipient Device ID
                </label>
                <input 
                  id="friend-code-input"
                  type="text"
                  placeholder="e.g. HW-12345678"
                  value={friendCodeInput}
                  onChange={(e) => setFriendCodeInput((e.target.value || "").toUpperCase())}
                  className="w-full bg-[#141824] border border-slate-700/80 focus:border-cyan-400 rounded-lg px-3.5 py-2.5 text-xs font-mono text-white placeholder-slate-500 uppercase tracking-wider outline-none transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                  required
                />
              </div>

              {statusMessage && (
                <div className={`p-3 rounded-lg text-xs leading-relaxed flex items-center gap-2 ${
                  statusMessage.type === "success" 
                    ? "bg-emerald-950/40 border border-emerald-500/30 text-emerald-300" 
                    : "bg-rose-950/40 border border-rose-500/30 text-rose-300"
                }`}>
                  {statusMessage.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={!friendCodeInput.trim()}
                className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Send Handshake Request</span>
              </button>
            </form>
          </div>

          {/* Privacy and Anonymity Scoped Model */}
          <div className="rounded-xl border border-slate-800 bg-[#0F121A] p-5 text-xs text-slate-400 leading-relaxed space-y-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-cyan-400" />
              <span>Contact Privacy Model</span>
            </span>
            <p>
              Phantom Chat does not maintain user profile directories or searchable databases. Contacts are linked strictly by ephemeral device IDs that expire or reset with your browser session.
            </p>
            <p className="text-slate-500">
              You can toggle your online visibility status above or block unwanted peers at any time.
            </p>
          </div>
        </div>

        {/* Right column: Friends Directory (7 columns) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Contacts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">
                Established Contacts ({acceptedFriends.length})
              </h2>
            </div>

            {acceptedFriends.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center bg-[#0F121A]">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-medium text-slate-300">No established contacts yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Enter a peer's device ID on the left to initiate a handshake. Once approved, you can launch direct chat rooms together.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {acceptedFriends.map(f => {
                  const partner = getPartnerDna(f);
                  const status = getFriendStatusDisplay(partner);
                  return (
                    <div 
                      key={f.id} 
                      className="rounded-xl border border-slate-800 hover:border-slate-700 bg-[#0F121A] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${status.raw === "ONLINE" ? "bg-emerald-400" : "bg-slate-500"}`} />
                          <span className="text-xs font-mono font-semibold text-white">Operator {partner}</span>
                        </div>
                        <div className={`text-[11px] font-medium ${status.color}`}>
                          {status.text}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Call / Room Invite */}
                        {status.raw !== "OFFLINE" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (onInviteToInbox) {
                                onInviteToInbox(partner);
                              } else {
                                navigateTo("inbox");
                              }
                            }}
                            className="px-3 py-1.5 bg-cyan-950/40 border border-cyan-600 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                            title="Open inbox with recipient device ID prefilled"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Invite to Room</span>
                          </button>
                        )}

                        {/* Block */}
                        <button
                          type="button"
                          onClick={() => handleBlockUser(partner, f.id)}
                          className="p-1.5 border border-slate-800 hover:border-rose-700 bg-slate-900 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Block this contact"
                        >
                          <ShieldAlert className="w-4 h-4" />
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          onClick={() => handleDeclineRequest(f.id)}
                          className="p-1.5 border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Remove contact"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Requests */}
          {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h2 className="text-sm font-semibold text-white">
                Pending Handshakes
              </h2>

              <div className="space-y-2.5">
                {/* Incoming Requests */}
                {pendingIncoming.map(f => (
                  <div key={f.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] text-amber-400 font-medium flex items-center gap-1">
                        <Bell className="w-3.5 h-3.5" />
                        <span>Incoming handshake request</span>
                      </span>
                      <span className="text-xs font-mono font-semibold text-white block">Operator {getPartnerDna(f)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAcceptRequest(f.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        ACCEPT
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeclineRequest(f.id)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        DECLINE
                      </button>
                    </div>
                  </div>
                ))}

                {/* Outgoing Requests */}
                {pendingOutgoing.map(f => (
                  <div key={f.id} className="rounded-xl border border-slate-800 bg-[#0F121A] p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Outgoing request sent to:</span>
                      <span className="text-xs font-mono font-medium text-slate-300">Operator {getPartnerDna(f)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeclineRequest(f.id)}
                      className="px-2.5 py-1 border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-400 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Blocked Operators */}
          {blockedList.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h2 className="text-sm font-semibold text-rose-400">
                Blocked Operators
              </h2>

              <div className="space-y-2">
                {blockedList.map(f => (
                  <div key={f.id} className="rounded-xl border border-rose-900/40 bg-rose-950/20 p-3 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-300">Blocked: Operator {getPartnerDna(f)}</span>
                    <button
                      type="button"
                      onClick={() => handleDeclineRequest(f.id)}
                      className="px-2.5 py-1 border border-rose-800 hover:bg-rose-900/40 text-rose-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
