import React, { useState } from "react";
import { 
  ArrowLeft, Mail, Send, Trash2, Check, Copy, Radio, 
  Users, Shield, Lightbulb, Clock, AlertCircle, CheckCircle2 
} from "lucide-react";
import { db, doc, deleteDoc } from "../services/firestoreShim";
import { sendTransmission, removeTransmissionFromRtdb } from "../utils/realtimeDb";

interface InboxEntry {
  id: string;
  toDna: string;
  fromDna: string;
  roomCode: string;
  message?: string;
  isAdminMessage: boolean;
  timestamp: number;
  read: boolean;
  type?: "ROOM_INVITE" | "FRIEND_REQUEST" | "friend_request" | "GAME_INVITE" | "SYSTEM" | "PROPOSAL" | "COUNTER_PROPOSAL";
  friendRequestId?: string;
  lobbyId?: string;
  fromAlias?: string;
}

interface InboxViewProps {
  myDna: string;
  inboxEntries: InboxEntry[];
  establishedContacts?: any[];
  onRefreshInbox?: () => Promise<void> | void;
  onAcceptHandshake?: (entryId: string, friendRequestId?: string, fromDna?: string) => Promise<void> | void;
  onDeclineHandshake?: (entryId: string, friendRequestId?: string, fromDna?: string) => Promise<void> | void;
  onBack: () => void;
  navigateTo: (
    route: "landing" | "gate" | "chat" | "world-chat" | "globallobby" | "faq" | "premium" | "inbox" | "ideas" | "friends",
    optRoomCode?: string
  ) => void;
  prefilledNegotiation?: {
    recipientDna: string;
    ideaId: string;
    ideaTitle: string;
    subject: string;
    body: string;
    conversationType: "DISCUSS" | "CHALLENGE" | "COLLABORATE" | "NEGOTIATE";
  } | null;
  clearPrefilledNegotiation?: () => void;
  prefilledRecipientDna?: string | null;
  clearPrefilledRecipient?: () => void;
}

const isValidDeviceId = (id: string) => {
  if (!id || typeof id !== "string") return false;
  const trimmed = id.trim();
  return trimmed.length >= 4 && trimmed.length <= 32 && /^[A-Z0-9]{2,12}(-[A-Z0-9]{2,12}){0,2}$/i.test(trimmed);
};

export function InboxView({ 
  myDna, 
  inboxEntries, 
  establishedContacts = [],
  onRefreshInbox,
  onAcceptHandshake,
  onDeclineHandshake,
  onBack, 
  navigateTo, 
  prefilledNegotiation, 
  clearPrefilledNegotiation,
  prefilledRecipientDna,
  clearPrefilledRecipient
}: InboxViewProps) {
  const [activeTab, setActiveTab] = useState<"ALL" | "FRIENDS" | "IDEAS" | "ROOM" | "SYSTEM">("ALL");

  const handleSwitchTab = (tab: "ALL" | "FRIENDS" | "IDEAS" | "ROOM" | "SYSTEM") => {
    setActiveTab(tab);
    if (onRefreshInbox) {
      onRefreshInbox();
    }
  };

  // Dispatch states
  const [recipientDna, setRecipientDna] = useState(prefilledRecipientDna || "");
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    if (prefilledRecipientDna) {
      setRecipientDna(prefilledRecipientDna);
      setMessageInput("");
      if (clearPrefilledRecipient) {
        clearPrefilledRecipient();
      }
    }
  }, [prefilledRecipientDna, clearPrefilledRecipient]);

  // Prefilled Negotiation Composer states
  const [negRecipient, setNegRecipient] = useState(prefilledNegotiation?.recipientDna || "");
  const [negType, setNegType] = useState<"DISCUSS" | "CHALLENGE" | "COLLABORATE" | "NEGOTIATE">(
    prefilledNegotiation?.conversationType || "NEGOTIATE"
  );
  const [negSubject, setNegSubject] = useState(prefilledNegotiation?.subject || "");
  const [negIdeaTitle, setNegIdeaTitle] = useState(prefilledNegotiation?.ideaTitle || "");
  const [negBody, setNegBody] = useState(prefilledNegotiation?.body || "");

  React.useEffect(() => {
    if (prefilledNegotiation) {
      setNegRecipient(prefilledNegotiation.recipientDna);
      setNegType(prefilledNegotiation.conversationType);
      setNegSubject(prefilledNegotiation.subject);
      setNegIdeaTitle(prefilledNegotiation.ideaTitle);
      setNegBody(prefilledNegotiation.body);
    }
  }, [prefilledNegotiation]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCopy = (id: string, code: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
      }).catch(err => {
        console.error("Copy failed", err);
      });
    }
  };

  const [actingNegotiationId, setActingNegotiationId] = useState<string | null>(null);
  const [actingFriendId, setActingFriendId] = useState<string | null>(null);

  const handleNegotiationAction = async (entryId: string, action: "ACCEPT" | "DECLINE") => {
    setActingNegotiationId(entryId);
    try {
      const cleanDna = (myDna || "").toUpperCase();
      await fetch(`/api/negotiate/${entryId}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-DNA": cleanDna
        },
        body: JSON.stringify({
          action,
          recipientDna: cleanDna
        })
      });
      await fetch(`/api/inbox?id=${encodeURIComponent(entryId)}`, {
        method: "DELETE",
        headers: { "X-Device-DNA": cleanDna }
      });
      if (onRefreshInbox) {
        await onRefreshInbox();
      }
    } catch (e) {
      console.error("Failed to process action", e);
    } finally {
      setActingNegotiationId(null);
    }
  };

  const handleFriendRequestAction = async (
    entryId: string,
    action: "ACCEPT" | "DECLINE",
    friendRequestId?: string,
    fromDna?: string
  ) => {
    setActingFriendId(entryId);
    try {
      if (action === "ACCEPT" && onAcceptHandshake) {
        await onAcceptHandshake(entryId, friendRequestId, fromDna);
      } else if (action === "DECLINE" && onDeclineHandshake) {
        await onDeclineHandshake(entryId, friendRequestId, fromDna);
      } else {
        const cleanDna = (myDna || "").toUpperCase();
        const hsId = friendRequestId || entryId.replace(/^hs_/, "");
        await fetch("/api/contacts/handshake", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-DNA": cleanDna
          },
          body: JSON.stringify({
            action,
            status: action === "ACCEPT" ? "accepted" : "declined",
            handshakeId: hsId,
            friendRequestId: hsId,
            requesterDna: cleanDna,
            sender_dna: (fromDna || "").toUpperCase()
          })
        });
        await fetch(`/api/inbox?id=${encodeURIComponent(entryId)}`, {
          method: "DELETE",
          headers: { "X-Device-DNA": cleanDna }
        });
        if (onRefreshInbox) {
          await onRefreshInbox();
        }
      }
    } catch (e) {
      console.error("Failed to process friend request action", e);
    } finally {
      setActingFriendId(null);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = messageInput.trim();
    const trimmedRecipient = (recipientDna || "").trim().toUpperCase();
    if (!trimmedInput || !trimmedRecipient) return;

    if (!isValidDeviceId(trimmedRecipient)) {
      setSendResult({
        type: "error",
        text: "Invalid recipient Device ID format. Expected e.g. AB-123 or DNA-1A2B3C."
      });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const cleanDna = (myDna || "").toUpperCase();
      const isSixDigitRoom = /^\d{6}$/.test(trimmedInput);
      const txPayload = {
        recipient_dna: trimmedRecipient,
        toDna: trimmedRecipient,
        recipientDna: trimmedRecipient,
        sender_dna: cleanDna,
        fromDna: cleanDna,
        senderDna: cleanDna,
        fromAlias: `Operator ${cleanDna}`,
        roomCode: isSixDigitRoom ? trimmedInput : "",
        message: trimmedInput,
        type: isSixDigitRoom ? "ROOM_INVITE" : "DIRECT_MESSAGE",
        isAdminMessage: false,
        timestamp: Date.now(),
        read: false,
      };

      // Push transmission to Firebase Realtime Database transmissions/${targetDeviceId}
      sendTransmission(trimmedRecipient, txPayload).catch(() => {});

      const res = await fetch("/api/inbox/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Device-DNA": cleanDna
        },
        body: JSON.stringify(txPayload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to dispatch envelope.");
      }

      setSendResult({
        type: "success",
        text: isSixDigitRoom
          ? `Room invitation sent to ${trimmedRecipient}`
          : `Message sent to ${trimmedRecipient}`,
      });
      setMessageInput("");
      setRecipientDna("");
      if (onRefreshInbox) {
        await onRefreshInbox();
      }
    } catch (err: any) {
      console.error(err);
      setSendResult({ type: "error", text: err?.message || "Failed to dispatch envelope. Check network connection." });
    } finally {
      setIsSending(false);
    }
  };

  const handleSendNegotiation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!negRecipient.trim() || !negSubject.trim() || !negBody.trim()) return;

    setIsSending(true);
    setSendResult(null);

    try {
      const res = await fetch("/api/negotiate/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderDna: myDna,
          recipientDna: negRecipient,
          ideaTitle: negIdeaTitle,
          subject: negSubject,
          body: negBody,
          conversationType: negType
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to dispatch proposal.");
      }

      setSendResult({ type: "success", text: `Proposal dispatched to ${negRecipient}` });
      if (clearPrefilledNegotiation) {
        clearPrefilledNegotiation();
      }
    } catch (err: any) {
      console.error(err);
      setSendResult({ type: "error", text: err.message || "Failed to dispatch proposal." });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const cleanDna = (myDna || "").toUpperCase();
      await removeTransmissionFromRtdb(cleanDna, id);
      await fetch(`/api/inbox?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "X-Device-DNA": cleanDna }
      });
      await deleteDoc(doc(db, "inbox", id));
      if (onRefreshInbox) {
        await onRefreshInbox();
      }
    } catch (err) {
      console.error("Error deleting entry:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const classifiedEntries = inboxEntries.map(entry => {
    let category: "FRIENDS" | "IDEAS" | "ROOM" | "SYSTEM" = "ROOM";
    let title = "Room Invitation";

    if (entry.type === "FRIEND_REQUEST" || (entry as any).friendRequestId) {
      category = "FRIENDS";
      title = "Contact Handshake Request";
    } else if (entry.type === "PROPOSAL" || entry.type === "COUNTER_PROPOSAL") {
      category = "IDEAS";
      title = "Collaboration Proposal";
    } else if (entry.isAdminMessage || entry.type === "SYSTEM") {
      category = "SYSTEM";
      title = "System Announcement";
    } else if (entry.roomCode && /^\d{6}$/.test(entry.roomCode.trim())) {
      category = "ROOM";
      title = "Room Invitation";
    } else {
      category = "ROOM";
      title = "Direct Message";
    }

    return { ...entry, category, title };
  });

  const filteredEntries = classifiedEntries.filter(entry => {
    if (activeTab === "ALL") return true;
    return entry.category === activeTab;
  });

  const getCount = (cat: "FRIENDS" | "IDEAS" | "ROOM" | "SYSTEM") => {
    return classifiedEntries.filter(e => e.category === cat).length;
  };

  return (
    <div className="w-full flex-grow flex flex-col h-full bg-transparent text-slate-200 overflow-y-auto p-4 sm:p-6 font-sans">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Return to Previous Screen"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base font-semibold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              <span>Transmission Inbox</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Encrypted invitations, contact handshakes, and proposal memos.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-400 self-start sm:self-auto">
          <span>Device ID:</span>
          <span className="text-cyan-400 font-semibold">{(myDna || "").toUpperCase()}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Inbox List (8 columns) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
            <button
              onClick={() => handleSwitchTab("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                activeTab === "ALL"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({classifiedEntries.length})
            </button>
            <button
              onClick={() => handleSwitchTab("ROOM")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border flex items-center gap-1.5 ${
                activeTab === "ROOM"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Room Invites ({getCount("ROOM")})</span>
            </button>
            <button
              onClick={() => handleSwitchTab("FRIENDS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border flex items-center gap-1.5 ${
                activeTab === "FRIENDS"
                  ? "bg-amber-950/40 border-amber-500 text-amber-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Contacts ({getCount("FRIENDS")})</span>
            </button>
            <button
              onClick={() => handleSwitchTab("IDEAS")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border flex items-center gap-1.5 ${
                activeTab === "IDEAS"
                  ? "bg-yellow-950/40 border-yellow-500 text-yellow-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" />
              <span>Proposals ({getCount("IDEAS")})</span>
            </button>
            <button
              onClick={() => handleSwitchTab("SYSTEM")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border flex items-center gap-1.5 ${
                activeTab === "SYSTEM"
                  ? "bg-rose-950/40 border-rose-500 text-rose-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>System ({getCount("SYSTEM")})</span>
            </button>
          </div>

          {/* List or Empty State */}
          {filteredEntries.length === 0 ? (
            <div className="rounded-xl border border-slate-800/80 bg-[#0F121A] p-8 text-center">
              <Mail className="w-8 h-8 text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-300">No transmissions in this category</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Share your device ID with peers to receive direct room invitations or proposal responses.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <div 
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-[#0F121A] p-4 sm:p-5 transition-colors relative"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-white">{entry.title}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400 font-mono text-[11px]">From: {entry.fromAlias || entry.fromDna}</span>
                    </div>

                    <button
                      onClick={() => handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                      title="Delete transmission"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {entry.message ? (
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      {entry.message}
                    </p>
                  ) : entry.roomCode && !/^\d{6}$/.test(entry.roomCode.trim()) ? (
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      {entry.roomCode}
                    </p>
                  ) : null}

                  {/* Room code actions (when 6-digit room code is present) */}
                  {entry.roomCode && /^\d{6}$/.test(entry.roomCode.trim()) && (
                    <div className="flex items-center gap-3 pt-1">
                      <div className="px-3 py-1.5 bg-[#141824] border border-slate-800 rounded-lg text-xs font-mono text-cyan-400 font-semibold">
                        Room Code: {entry.roomCode}
                      </div>

                      <button
                        onClick={() => navigateTo("gate", entry.roomCode)}
                        className="py-1.5 px-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                      >
                        Join Room
                      </button>

                      <button
                        onClick={() => handleCopy(entry.id, entry.roomCode)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Copy Room Code"
                      >
                        {copiedId === entry.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}

                  {/* General message copy button if not a 6-digit code */}
                  {((entry.message && !entry.roomCode) || (entry.roomCode && !/^\d{6}$/.test(entry.roomCode.trim()))) && (
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => handleCopy(entry.id, entry.message || entry.roomCode || "")}
                        className="inline-flex items-center gap-1.5 py-1 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Copy text"
                      >
                        {copiedId === entry.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>Copy message</span>
                      </button>
                    </div>
                  )}

                  {/* Proposal Actions */}
                  {entry.type === "PROPOSAL" && (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleNegotiationAction(entry.id, "ACCEPT")}
                        disabled={actingNegotiationId === entry.id}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        ACCEPT
                      </button>
                      <button
                        onClick={() => handleNegotiationAction(entry.id, "DECLINE")}
                        disabled={actingNegotiationId === entry.id}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        DECLINE
                      </button>
                    </div>
                  )}

                  {/* Friend Request Actions */}
                  {(entry.type === "FRIEND_REQUEST" || entry.type === "friend_request" || entry.friendRequestId) && (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleFriendRequestAction(entry.id, "ACCEPT", entry.friendRequestId, entry.fromDna)}
                        disabled={actingFriendId === entry.id}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        ACCEPT
                      </button>
                      <button
                        onClick={() => handleFriendRequestAction(entry.id, "DECLINE", entry.friendRequestId, entry.fromDna)}
                        disabled={actingFriendId === entry.id}
                        className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-lg transition-colors cursor-pointer uppercase tracking-wider"
                      >
                        DECLINE
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Established Contacts summary inside Transmission Inbox */}
          {(activeTab === "ALL" || activeTab === "FRIENDS") && establishedContacts.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-800/80">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Established Contacts ({establishedContacts.length})</span>
                </h2>
                <button
                  type="button"
                  onClick={() => navigateTo("friends")}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-medium cursor-pointer"
                >
                  Manage Contacts →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {establishedContacts.map((f: any) => {
                  const cleanMyDna = (myDna || "").toUpperCase();
                  const partnerDna =
                    (f.dna1 || "").toUpperCase() === cleanMyDna
                      ? (f.dna2 || f.recipient_dna || "").toUpperCase()
                      : (f.dna1 || f.sender_dna || "").toUpperCase();
                  return (
                    <div
                      key={f.id || partnerDna}
                      className="rounded-xl border border-slate-800 bg-[#0F121A] p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-mono font-semibold text-white">
                          Operator {partnerDna}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientDna(partnerDna);
                        }}
                        className="px-2.5 py-1 bg-cyan-950/40 border border-cyan-600/60 text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Message
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Dispatch Code Form (4 columns) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {prefilledNegotiation ? (
            <div className="rounded-xl border border-yellow-500/30 bg-[#0F121A] p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-semibold text-yellow-400">Collaboration Proposal</span>
                <button
                  type="button"
                  onClick={clearPrefilledNegotiation}
                  className="text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleSendNegotiation} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Recipient Device ID</label>
                  <input
                    type="text"
                    value={negRecipient}
                    disabled
                    className="w-full bg-[#141824] border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Conversation Type</label>
                  <select
                    value={negType}
                    onChange={(e: any) => setNegType(e.target.value)}
                    className="w-full bg-[#141824] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="DISCUSS">Discuss</option>
                    <option value="CHALLENGE">Challenge</option>
                    <option value="COLLABORATE">Collaborate</option>
                    <option value="NEGOTIATE">Negotiate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Subject</label>
                  <input
                    type="text"
                    value={negSubject}
                    onChange={(e) => setNegSubject(e.target.value)}
                    className="w-full bg-[#141824] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Proposal Details</label>
                  <textarea
                    rows={4}
                    value={negBody}
                    onChange={(e) => setNegBody(e.target.value)}
                    className="w-full bg-[#141824] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white resize-none"
                    required
                  />
                </div>

                {sendResult && (
                  <div className={`p-2.5 rounded text-xs ${
                    sendResult.type === "success" ? "bg-emerald-950/40 text-emerald-300" : "bg-rose-950/40 text-rose-300"
                  }`}>
                    {sendResult.text}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSending}
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  {isSending ? "Dispatching..." : "Send Proposal"}
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#0F121A] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Send a message
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Type a message or paste a room code.
                </p>
              </div>

              <form onSubmit={handleSend} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Recipient Device ID</label>
                  <input
                    type="text"
                    placeholder="e.g. HW-12345678"
                    value={recipientDna}
                    onChange={(e) => setRecipientDna((e.target.value || "").toUpperCase())}
                    className="w-full bg-[#141824] border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder-slate-500 uppercase outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Message</label>
                  <input
                    type="text"
                    placeholder="Type a message or paste a room code..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    className="w-full bg-[#141824] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                    required
                  />
                </div>

                {sendResult && (
                  <div className={`p-2.5 rounded text-xs flex items-center gap-1.5 ${
                    sendResult.type === "success" ? "bg-emerald-950/40 text-emerald-300" : "bg-rose-950/40 text-rose-300"
                  }`}>
                    {sendResult.type === "success" ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                    <span>{sendResult.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSending || !messageInput.trim() || !recipientDna.trim()}
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSending ? "Dispatching..." : "Send Message"}</span>
                </button>
              </form>
            </div>
          )}

          <div className="p-4 bg-[#0F121A] border border-slate-800 rounded-xl text-xs text-slate-400 space-y-1">
            <span className="font-semibold text-white block">Ephemeral Inbox Note</span>
            <p>
              Inboxes are tied strictly to temporary hardware signatures. Deleting an envelope removes it permanently.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}
