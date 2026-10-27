export interface Message {
  id: string;
  roomCode: string;
  type: "text" | "image" | "audio";
  senderDna: string;
  nickname: string;
  gender?: "boy" | "girl";
  text?: string;
  mediaUrl?: string; // Firebase Storage download URL or Base64 fallback
  fileUrl?: string; // resolved server url
  timestamp: number;
  senderIsVip?: boolean;
  senderIsPro?: boolean;
  reactions?: { [emoji: string]: string[] };
  replyTo?: {
    id: string;
    sender: string;
    text: string;
  };
  isAiAnswer?: boolean;
  isGenerating?: boolean;
  isEncrypted?: boolean;
  ciphertext?: string;
  iv?: string;
}

export interface VipData {
  dna: string;
  grantedAt: number;
  expiresAt: number;
  durationLabel: string;
  remainingMs: number;
}

export interface VipCheckResponse {
  isVip: boolean;
  expiresAt?: number;
  expiryRemaining?: string;
  durationLabel?: string;
}

export interface RoomConfig {
  roomCode: string;
  creatorDna: string;
  timerSeconds: number;
  timerDuration?: number;
  createdByPro?: boolean;
  maxPeers?: number;
  createdAt: number;
  remainingSeconds: number;
  hasExpired: boolean;
  roomType?: string;
  participants?: string[];
  status?: string;
  connectingAt?: number;
  roomCreatedAt?: number;
  roomEndsAt?: number;
  duration?: number;
  serverTime?: number;
  clockOffset?: number;
  remainingMs?: number;
  appVersion?: string;
  firebaseProjectId?: string;
}

export interface OnlineUser {
  dna: string;
  roomCode: string | null;
  nickname: string;
  gender: "boy" | "girl";
  lastActiveAgoSeconds: number;
  isVip?: boolean;
  isPro?: boolean;
}

export interface DBStats {
  activeRoomsCount: number;
  totalRoomsEver: number;
  activeUsersCount: number;
  activeChattersCount: number;
  totalMessagesSent: number;
  onlineUsers?: OnlineUser[];
}

export interface ClipComment {
  id: string;
  senderAlias: string;
  text: string;
  timestamp: number;
}

export interface Clip {
  id: string;
  creatorAlias: string;
  fileUrl: string;
  caption: string;
  timestamp: number;
  likesCount: number;
  likedBy: string[]; // hashed DNA values of users who liked, to prevent multiple likes safely
  comments: ClipComment[];
  sharesCount: number;
}

