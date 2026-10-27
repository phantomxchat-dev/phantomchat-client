import {
  ref,
  push,
  set,
  remove,
  onValue,
  onChildAdded,
  get,
  DataSnapshot,
  Unsubscribe,
} from "firebase/database";
import { db } from "./firebaseConfig";

export { db };

function sanitizeRtdbPayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  if (!obj || typeof obj !== "object") return {};
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      cleaned[key] = sanitizeRtdbPayload(val);
    } else {
      cleaned[key] = val;
    }
  }
  return cleaned;
}

export function normalizeRoomCode(roomCode: string): string {
  const raw = String(roomCode || "").trim();
  if (!raw) return "GLOBAL";
  return raw.toLowerCase() === "global-lobby" ? "global-lobby" : raw.toUpperCase();
}

export function normalizeDeviceId(deviceId: string): string {
  return String(deviceId || "")
    .trim()
    .toUpperCase()
    .replace(/[.#$[\]/]/g, "_");
}

// Track active listeners per room to prevent duplicate listeners
const activeRoomListeners = new Map<string, Unsubscribe>();
const activeConfigListeners = new Map<string, Unsubscribe>();

// P2P signaling TTL: signals expire after 60 seconds if not processed
const SIGNAL_TTL_MS = 60 * 1000;

/**
 * Pushes a new message object to Firebase Realtime Database immediately
 * (for the RTDB real-time listener path), and writes to the server API
 * fire-and-forget (for the Cloudflare SSE path). The Firebase write is
 * never blocked on the API response, so RTDB listeners receive messages
 * within milliseconds regardless of API latency.
 */
export async function sendRoomMessage(
  roomCode: string,
  payload: Record<string, any>
): Promise<string | null> {
  const cleanRoom = normalizeRoomCode(roomCode);
  const msgId = payload.id || `msg_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const cleanPayload = {
    ...payload,
    id: msgId,
    roomCode: cleanRoom,
    timestamp: Number(payload.timestamp || Date.now()),
  };

  // 1. Fire-and-forget: server API (Cloudflare Pages Function → ROOM_KV/D1 → SSE stream)
  // Do NOT await — this must not block the Firebase write below.
  fetch(`/api/rooms/messages/${encodeURIComponent(cleanRoom)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleanPayload),
  }).catch((apiErr) => {
    console.warn("[RealtimeDB] sendRoomMessage API fire-and-forget error:", apiErr);
  });

  // 2. Immediate: Firebase Realtime Database (RTDB onValue listener path)
  // This write happens immediately, independently of the API call above.
  try {
    const messagesRef = ref(db, `rooms/${cleanRoom}/messages`);
    const newMsgRef = push(messagesRef);
    const rtdbPayload = sanitizeRtdbPayload({
      ...cleanPayload,
      rtdbKey: newMsgRef.key,
    });
    await set(newMsgRef, rtdbPayload);
    return msgId;
  } catch (err) {
    console.warn("[RealtimeDB] sendRoomMessage Firebase RTDB error:", err);
    return null;
  }
}

/**
 * Attaches an `onValue` listener to `rooms/${roomCode}/messages` and passes the
 * sorted array of deduplicated messages to `callback`. Cleans up any existing listener first.
 */
export function subscribeToRoomMessages(
  roomCode: string,
  callback: (messages: any[]) => void
): () => void {
  const cleanRoom = normalizeRoomCode(roomCode);
  
  // Clean up any existing listener on this roomCode to prevent duplicate listeners
  if (activeRoomListeners.has(cleanRoom)) {
    try {
      activeRoomListeners.get(cleanRoom)?.();
      activeRoomListeners.delete(cleanRoom);
    } catch {}
  }

  const messagesRef = ref(db, `rooms/${cleanRoom}/messages`);

  const unsubscribe = onValue(
    messagesRef,
    (snapshot: DataSnapshot) => {
      const val = snapshot.val();
      if (!val || typeof val !== "object") {
        callback([]);
        return;
      }

      // Deduplicate by message id
      const byId = new Map<string, any>();
      for (const [key, item] of Object.entries(val) as [string, any][]) {
        if (!item) continue;
        const msgId = item.id || key;
        byId.set(msgId, {
          ...item,
          id: msgId,
          rtdbKey: key,
          roomCode: cleanRoom,
          nickname: item.nickname || item.alias || "GHOST",
          senderDna: item.senderDna || "OPERATIVE",
          type: item.type || "text",
          text: item.text || "",
          mediaUrl: item.mediaUrl || item.fileUrl || "",
          fileUrl: item.fileUrl || item.mediaUrl || "",
          timestamp: Number(item.timestamp || Date.now()),
        });
      }

      const list = Array.from(byId.values());
      list.sort((a, b) => a.timestamp - b.timestamp);
      callback(list);
    },
    (err) => {
      console.warn("[RealtimeDB] subscribeToRoomMessages listener error:", err);
    }
  );

  activeRoomListeners.set(cleanRoom, unsubscribe);

  // Fallback poll: fetch messages from the canonical server API every 3s.
  // This ensures messages written via the server API (ROOM_KV/D1 in production)
  // are delivered even if the Firebase RTDB listener is delayed or silent.
  let isUnsubscribed = false;
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const res = await fetch(`/api/rooms/messages/${encodeURIComponent(cleanRoom)}`);
      if (res.ok) {
        const apiMessages = await res.json();
        if (Array.isArray(apiMessages) && apiMessages.length > 0) {
          const normalized = apiMessages.map((m: any) => ({
            ...m,
            id: m.id || `msg_${Date.now()}_${Math.random()}`,
            roomCode: cleanRoom,
            nickname: m.nickname || "GHOST",
            senderDna: m.senderDna || "OPERATIVE",
            type: m.type || "text",
            text: m.text || "",
            mediaUrl: m.mediaUrl || m.fileUrl || "",
            fileUrl: m.fileUrl || m.mediaUrl || "",
            timestamp: Number(m.timestamp || Date.now()),
          }));
          callback(normalized);
        }
      }
    } catch {
      // silent: Firebase RTDB listener is the primary path
    }
  }, 500);

  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    try {
      unsubscribe();
      activeRoomListeners.delete(cleanRoom);
    } catch {}
  };
}

export interface RtdbRoomConfig {
  createdAt: number;
  timerSeconds: number;
  timerDuration?: number;
  duration?: number;
  createdByPro?: boolean;
  maxPeers?: number;
  creatorDna?: string;
  roomType?: string;
  status?: string;
  roomCode?: string;
  roomCreatedAt?: number;
  roomEndsAt?: number;
}

/**
 * Saves or updates room configuration metadata in `rooms/${roomCode}/config`.
 */
export async function setRoomConfigInRtdb(
  roomCode: string,
  config: RtdbRoomConfig
): Promise<void> {
  try {
    const cleanRoom = normalizeRoomCode(roomCode);
    const configRef = ref(db, `rooms/${cleanRoom}/config`);
    const duration = Number(config.timerDuration || config.duration || config.timerSeconds || 120);
    const createdAt = Number(config.createdAt || config.roomCreatedAt || Date.now());
    await set(configRef, sanitizeRtdbPayload({
      ...config,
      roomCode: cleanRoom,
      createdAt,
      roomCreatedAt: createdAt,
      timerSeconds: duration,
      timerDuration: duration,
      duration,
      createdByPro: Boolean(config.createdByPro),
      maxPeers: Number(config.maxPeers) || (config.roomType === "group" ? 999999 : 2),
      creatorDna: config.creatorDna || "OPERATIVE",
      roomType: config.roomType || "private",
      status: config.status || "ACTIVE",
      roomEndsAt: createdAt + duration * 1000,
      updatedAt: Date.now(),
    }));
  } catch (err) {
    console.warn("[RealtimeDB] setRoomConfigInRtdb error:", err);
  }
}

/**
 * Fetches room configuration once from Firebase Realtime Database.
 */
export async function getRoomConfigFromRtdb(
  roomCode: string
): Promise<RtdbRoomConfig | null> {
  try {
    const cleanRoom = normalizeRoomCode(roomCode);
    const configRef = ref(db, `rooms/${cleanRoom}/config`);
    const snap = await get(configRef);
    const val = snap.val();
    if (!val || typeof val !== "object") return null;
    const duration = Number(val.timerDuration || val.duration || val.timerSeconds || 120);
    const createdAt = Number(val.createdAt || val.roomCreatedAt || Date.now());
    return {
      createdAt,
      roomCreatedAt: createdAt,
      timerSeconds: duration,
      timerDuration: duration,
      duration,
      createdByPro: Boolean(val.createdByPro),
      maxPeers: Number(val.maxPeers) || (val.roomType === "group" ? 999999 : 2),
      creatorDna: val.creatorDna,
      roomType: val.roomType,
      status: val.status,
      roomEndsAt: val.roomEndsAt || (createdAt + duration * 1000),
    };
  } catch (err) {
    console.warn("[RealtimeDB] getRoomConfigFromRtdb error:", err);
    return null;
  }
}

/**
 * Subscribes to room configuration changes in real time.
 */
export function subscribeToRoomConfig(
  roomCode: string,
  callback: (config: RtdbRoomConfig | null) => void
): () => void {
  const cleanRoom = normalizeRoomCode(roomCode);

  if (activeConfigListeners.has(cleanRoom)) {
    try {
      activeConfigListeners.get(cleanRoom)?.();
      activeConfigListeners.delete(cleanRoom);
    } catch {}
  }

  const configRef = ref(db, `rooms/${cleanRoom}/config`);
  const unsubscribe = onValue(
    configRef,
    (snapshot: DataSnapshot) => {
      const val = snapshot.val();
      if (!val || typeof val !== "object") {
        callback(null);
        return;
      }
      const duration = Number(val.timerDuration || val.duration || val.timerSeconds || 120);
      const createdAt = Number(val.createdAt || val.roomCreatedAt || Date.now());
      callback({
        createdAt,
        roomCreatedAt: createdAt,
        timerSeconds: duration,
        timerDuration: duration,
        duration,
        createdByPro: Boolean(val.createdByPro),
        maxPeers: Number(val.maxPeers) || (val.roomType === "group" ? 999999 : 2),
        creatorDna: val.creatorDna,
        roomType: val.roomType,
        status: val.status,
        roomEndsAt: val.roomEndsAt || (createdAt + duration * 1000),
      });
    },
    (err) => {
      console.warn("[RealtimeDB] subscribeToRoomConfig error:", err);
    }
  );

  activeConfigListeners.set(cleanRoom, unsubscribe);

  return () => {
    try {
      unsubscribe();
      activeConfigListeners.delete(cleanRoom);
    } catch {}
  };
}

/**
 * Deletes a single message from `rooms/${roomCode}/messages`.
 */
export async function deleteRoomMessageFromRtdb(
  roomCode: string,
  messageId: string
): Promise<void> {
  try {
    const cleanRoom = normalizeRoomCode(roomCode);
    const messagesRef = ref(db, `rooms/${cleanRoom}/messages`);
    const snap = await get(messagesRef);
    const val = snap.val();
    if (!val || typeof val !== "object") return;

    for (const [key, item] of Object.entries(val) as [string, any][]) {
      if (key === messageId || item?.id === messageId) {
        await remove(ref(db, `rooms/${cleanRoom}/messages/${key}`));
      }
    }
  } catch (err) {
    console.warn("[RealtimeDB] deleteRoomMessageFromRtdb error:", err);
  }
}

/**
 * Clears the entire room payload at `rooms/${roomCode}` when countdown timer reaches zero.
 */
export async function clearRoomPayload(roomCode: string): Promise<void> {
  try {
    const cleanRoom = normalizeRoomCode(roomCode);
    if (!cleanRoom || cleanRoom === "global-lobby") return;
    await remove(ref(db, `rooms/${cleanRoom}`));
  } catch (err) {
    console.warn("[RealtimeDB] clearRoomPayload error:", err);
  }
}

/**
 * Pushes a transmission message, room invite, or handshake request to `transmissions/${targetDeviceId}`.
 */
export async function sendTransmission(
  targetDeviceId: string,
  payload: Record<string, any>
): Promise<string | null> {
  try {
    const cleanTarget = normalizeDeviceId(targetDeviceId);
    if (!cleanTarget) return null;

    const transmissionsRef = ref(db, `transmissions/${cleanTarget}`);
    const newTxRef = push(transmissionsRef);
    const txId = payload.id || newTxRef.key || `msg_${Date.now()}`;
    const cleanPayload = sanitizeRtdbPayload({
      ...payload,
      id: txId,
      rtdbKey: newTxRef.key,
      recipient_dna: cleanTarget,
      toDna: cleanTarget,
      timestamp: payload.timestamp || payload.created_at || Date.now(),
      created_at: payload.created_at || payload.timestamp || Date.now(),
    });

    await set(newTxRef, cleanPayload);
    return newTxRef.key;
  } catch (err) {
    console.warn("[RealtimeDB] sendTransmission error:", err);
    return null;
  }
}

/**
 * Subscribes in real time to `transmissions/${deviceId}` and passes the list of transmissions to `callback`.
 */
export function subscribeToTransmissions(
  deviceId: string,
  callback: (items: any[]) => void
): () => void {
  const cleanDevice = normalizeDeviceId(deviceId);
  if (!cleanDevice) return () => {};

  const txRef = ref(db, `transmissions/${cleanDevice}`);
  const unsubscribe = onValue(
    txRef,
    (snapshot: DataSnapshot) => {
      const val = snapshot.val();
      if (!val || typeof val !== "object") {
        callback([]);
        return;
      }

      const items = Object.entries(val).map(([key, item]: [string, any]) => ({
        ...item,
        id: item?.id || key,
        rtdbKey: key,
        fromDna: (item?.fromDna || item?.sender_dna || "UNKNOWN").toUpperCase(),
        sender_dna: (item?.sender_dna || item?.fromDna || "UNKNOWN").toUpperCase(),
        toDna: cleanDevice,
        recipient_dna: cleanDevice,
        timestamp: Number(item?.timestamp || item?.created_at || Date.now()),
      }));

      items.sort((a, b) => b.timestamp - a.timestamp);
      callback(items);
    },
    (err) => {
      console.warn("[RealtimeDB] subscribeToTransmissions error:", err);
    }
  );

  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

/**
 * Removes a transmission item from `transmissions/${deviceId}`.
 */
export async function removeTransmissionFromRtdb(
  deviceId: string,
  itemId: string
): Promise<void> {
  try {
    const cleanDevice = normalizeDeviceId(deviceId);
    if (!cleanDevice || !itemId) return;

    const txRef = ref(db, `transmissions/${cleanDevice}`);
    const snap = await get(txRef);
    const val = snap.val();
    if (!val || typeof val !== "object") return;

    for (const [key, item] of Object.entries(val) as [string, any][]) {
      if (
        key === itemId ||
        item?.id === itemId ||
        item?.friendRequestId === itemId ||
        `hs_${item?.friendRequestId}` === itemId
      ) {
        await remove(ref(db, `transmissions/${cleanDevice}/${key}`));
      }
    }
  } catch (err) {
    console.warn("[RealtimeDB] removeTransmissionFromRtdb error:", err);
  }
}

/**
 * Pushes a WebRTC P2P signaling message (offer, answer, or candidate) to
 * Firebase Realtime Database at `rooms/{roomCode}/p2pSignals/{signalId}`.
 * Strictly validates payload shape. Does NOT validate room membership server-side
 * here — that is enforced by the Cloudflare Pages Function route used for room
 * creation/join, and by client-side participant checks in App.tsx.
 * Returns { success: boolean, id?: string, error?: string }.
 */
export async function sendP2PSignal(
  roomCode: string,
  recipientId: string,
  signalPayload: Record<string, any>
): Promise<{ success: boolean; id?: string; error?: string }> {
  const cleanRoom = normalizeRoomCode(roomCode);
  const cleanRecipient = normalizeDeviceId(recipientId || "PEER");
  const cleanSender = normalizeDeviceId(signalPayload.senderDna || "");
  if (!cleanRoom) {
    return { success: false, error: "Invalid room code" };
  }

  const signalType = signalPayload.type || signalPayload.signalType || "";
  const isOffer = signalType === "offer" && signalPayload.sdp;
  const isAnswer = signalType === "answer" && signalPayload.sdp;
  const isCandidate = signalType === "candidate" && signalPayload.candidate;

  if (!isOffer && !isAnswer && !isCandidate) {
    return { success: false, error: "Invalid signaling payload: must include offer/answer/candidate with SDP or ICE candidate." };
  }

  // Reject file bytes or media URLs in signaling channel
  const bodyStr = JSON.stringify(signalPayload).toLowerCase();
  if (
    bodyStr.includes("filebytes") ||
    bodyStr.includes("fileurl") ||
    bodyStr.includes("mediaurl") ||
    bodyStr.includes("data:")
  ) {
    return { success: false, error: "File contents and media URLs are disallowed in P2P signaling channel." };
  }

  const transferId = signalPayload.transferId || signalPayload.sessionId || `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const signalId = `sig_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = Date.now();
  const expiresAt = now + SIGNAL_TTL_MS;

  const signalData = {
    id: signalId,
    roomCode: cleanRoom,
    transferId,
    senderDna: cleanSender,
    recipientDna: cleanRecipient,
    signalType,
    payload: signalType === "candidate" ? { candidate: signalPayload.candidate } : { sdp: signalPayload.sdp },
    createdAt: now,
    expiresAt,
    processed: false,
  };

  try {
    const signalsRef = ref(db, `rooms/${cleanRoom}/p2pSignals`);
    const newSignalRef = push(signalsRef);
    await set(newSignalRef, signalData);
    return { success: true, id: signalId };
  } catch (err: any) {
    const errorMsg = err?.message || "Failed to store signaling message.";
    console.warn("[P2P Signaling] sendP2PSignal Firebase error:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Subscribes in real time to incoming WebRTC signals for the calling peer in a 1-to-1 private room.
 * Uses Firebase Realtime Database `onChildAdded` listener at
 * `rooms/{roomCode}/p2pSignals` for instant delivery with zero polling delay.
 * Deduplicates by signal ID and transfer/session ID. Only signals addressed to
 * this peer are delivered.
 */
export function subscribeP2PSignals(
  roomCode: string,
  myId: string,
  callback: (signals: any[]) => void
): () => void {
  const cleanRoom = normalizeRoomCode(roomCode);
  const cleanMyId = normalizeDeviceId(myId);
  if (!cleanRoom || !cleanMyId) return () => {};

  let isActive = true;
  const processedSignalIds = new Set<string>();
  const processedTransferIds = new Set<string>();

  const signalsRef = ref(db, `rooms/${cleanRoom}/p2pSignals`);

  const unsubscribe = onChildAdded(
    signalsRef,
    (snapshot: DataSnapshot) => {
      if (!isActive) return;
      const val = snapshot.val();
      if (!val || typeof val !== "object") return;

      // Skip expired signals
      if (val.expiresAt && Date.now() > val.expiresAt) return;

      // Skip already processed signals
      if (val.processed === true) return;

      // Skip signals not addressed to this peer
      if (
        val.recipientDna &&
        val.recipientDna !== "PEER" &&
        val.recipientDna !== "ALL" &&
        val.recipientDna !== cleanMyId
      ) {
        return;
      }

      const signalId = val.id || snapshot.key;
      if (!signalId) return;
      if (processedSignalIds.has(signalId)) return;
      if (val.transferId && processedTransferIds.has(val.transferId)) return;

      processedSignalIds.add(signalId);
      if (val.transferId) processedTransferIds.add(val.transferId);

      let parsedPayload: any = {};
      try {
        parsedPayload = JSON.parse(val.payload || "{}");
      } catch {}

      callback([{
        id: signalId,
        transferId: val.transferId,
        senderDna: val.senderDna,
        recipientDna: val.recipientDna,
        type: val.signalType,
        payload: parsedPayload,
        sdp: parsedPayload.sdp || null,
        candidate: parsedPayload.candidate || null,
        createdAt: val.createdAt,
      }]);
    },
    (err) => {
      console.warn("[P2P Signaling] Firebase listener error:", err?.message || err);
    }
  );

  return () => {
    isActive = false;
    try {
      unsubscribe();
    } catch {}
    processedSignalIds.clear();
    processedTransferIds.clear();
  };
}

/**
 * Acknowledges (marks processed) a P2P signal only after successful client-side handling.
 * Removes the signal record from Firebase Realtime Database at
 * `rooms/{roomCode}/p2pSignals/{signalId}`.
 */
export async function clearP2PSignal(
  roomCode: string,
  myId: string,
  signalId: string
): Promise<void> {
  try {
    const cleanRoom = normalizeRoomCode(roomCode);
    const cleanMyId = normalizeDeviceId(myId);
    if (!cleanRoom || !signalId || !cleanMyId) return;

    const signalRef = ref(db, `rooms/${cleanRoom}/p2pSignals/${signalId}`);
    const snap = await get(signalRef);
    if (!snap.exists()) return;

    const val = snap.val();
    if (
      val.recipientDna &&
      val.recipientDna !== "PEER" &&
      val.recipientDna !== "ALL" &&
      val.recipientDna !== cleanMyId
    ) {
      return; // Not authorized to acknowledge this signal
    }

    await remove(signalRef);
  } catch (err) {
    console.warn("[P2P Signaling] clearP2PSignal Firebase error:", err);
  }
}

/**
 * Subscribes in real time to the PRO license of a specific device DNA.
 */
export function subscribeToProLicense(
  targetDna: string,
  callback: (proData: { isPro: boolean; expiry?: number; expiresAt?: number; clearanceRank?: string } | null) => void
): () => void {
  const cleanDna = normalizeDeviceId(targetDna);
  if (!cleanDna) return () => {};

  const proRef = ref(db, `licenses/pro/${cleanDna}`);
  const unsubscribe = onValue(
    proRef,
    (snapshot: DataSnapshot) => {
      const val = snapshot.val();
      if (!val || typeof val !== "object") {
        callback(null);
        return;
      }

      const now = Date.now();
      const expiry = Number(val.expiry || val.expiresAt || 0);
      const isUnexpired = expiry === 0 || expiry > now;

      if (val.isPro && isUnexpired) {
        callback({
          isPro: true,
          expiry,
          expiresAt: expiry,
          clearanceRank: val.clearanceRank || "PHANTOM PRO ELITE",
        });
      } else {
        callback({ isPro: false });
      }
    },
    (err) => {
      console.warn("[RealtimeDB] subscribeToProLicense listener error:", err);
    }
  );

  return () => {
    try {
      unsubscribe();
    } catch {}
  };
}

