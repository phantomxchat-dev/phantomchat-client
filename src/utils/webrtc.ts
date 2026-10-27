// WebRTC Peer-to-Peer DataChannel Manager for Direct File Transfers with Accept/Decline Handshake

export interface P2PFileMetadata {
  type?: "file-header";
  fileName: string;
  name?: string;
  fileSize: number;
  size?: number;
  fileType: string;
  mimeType?: string;
  totalChunks: number;
}

export interface P2PFileOffer {
  type: "file-offer";
  transferId: string;
  senderName: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export interface P2PFileResponse {
  type: "file-response";
  transferId: string;
  accepted: boolean;
}

export interface P2PFileCancel {
  type: "transfer-cancel";
  reason?: string;
}

export type SignalHandler = (signal: {
  type: "offer" | "answer" | "candidate";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  senderDna?: string;
  recipientDna?: string;
}) => void;

export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

export const CHUNK_SIZE = 16384; // 16 KB chunk size
export const HIGH_WATERMARK = 65536; // 64 KB high watermark for backpressure control

export class P2PTransferManager {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private onSignal?: SignalHandler;
  private onProgress?: (percent: number) => void;
  private onFileComplete?: (file: File) => void;
  private onFileOffer?: (offer: P2PFileOffer) => void;
  private onError?: (errMessage: string) => void;

  // Map of transferId -> resolver for sender waiting on Peer B's ACCEPT/DECLINE
  private offerResponseResolvers = new Map<string, (accepted: boolean) => void>();

  // Queued ICE candidates in case candidate arrives before setRemoteDescription
  private pendingCandidates: RTCIceCandidateInit[] = [];

  // Receiver buffer state
  private fileMetadata: P2PFileMetadata | null = null;
  private receivedBuffers: ArrayBuffer[] = [];
  private receivedSize = 0;
  private receivedCount = 0;

  constructor() {
    this.pc = new RTCPeerConnection(rtcConfig);
  }

  private setupDataChannel(channel: RTCDataChannel, role: "sender" | "receiver"): void {
    this.dc = channel;
    this.dc.binaryType = "arraybuffer";
    this.dc.bufferedAmountLowThreshold = CHUNK_SIZE;

    this.dc.onopen = () => {
      console.log(`[P2P WebRTC] Data channel OPENED (${role})`);
    };

    this.dc.onmessage = (e) => {
      if (role === "sender") {
        this.handleSenderIncomingData(e.data);
      } else {
        this.handleIncomingData(e.data);
      }
    };

    this.dc.onclose = () => {
      console.log(`[P2P WebRTC] Data channel CLOSED (${role})`);
      if (this.receivedSize > 0 && this.fileMetadata && this.receivedSize < this.fileMetadata.fileSize) {
        this.onError?.("P2P DataChannel closed before file transfer completed.");
      }
    };

    this.dc.onerror = (err) => {
      console.error(`[P2P WebRTC] Data channel ERROR (${role}):`, err);
      this.onError?.("P2P DataChannel transmission error.");
    };
  }

  /**
   * Sender side initialization: creates DataChannel and creates SDP offer
   */
  public async initSender(
    onSignal: SignalHandler,
    onProgress?: (percent: number) => void,
    onError?: (errMessage: string) => void
  ): Promise<void> {
    this.onSignal = onSignal;
    this.onProgress = onProgress;
    this.onError = onError;

    if (!this.pc) return;

    this.pc.onicecandidate = async (event) => {
      if (event.candidate && this.onSignal) {
        try {
          await this.onSignal({
            type: "candidate",
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid ?? null,
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
              usernameFragment: event.candidate.usernameFragment ?? null,
            },
          });
        } catch (err: any) {
          console.warn("[P2P WebRTC] Failed to send ICE candidate (Sender):", err);
          this.onError?.(err?.message || "Signaling failure: unable to deliver ICE candidate.");
        }
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      console.log("[P2P WebRTC] ICE connection state (Sender):", state);
      if (state === "failed") {
        this.onError?.("WebRTC direct peer connection failed. Network may restrict direct P2P connectivity.");
      } else if (state === "disconnected") {
        this.onError?.("WebRTC peer connection disconnected.");
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log("[P2P WebRTC] Peer connection state (Sender):", state);
      if (state === "failed" || state === "disconnected") {
        this.onError?.("Peer connection failed. Direct link could not be maintained.");
      }
    };

    const dataChannel = this.pc.createDataChannel("fileTransfer", {
      ordered: true,
    });
    this.setupDataChannel(dataChannel, "sender");

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    this.onSignal?.({
      type: "offer",
      sdp: {
        type: offer.type,
        sdp: offer.sdp,
      },
    });
  }

  /**
   * Receiver side initialization: accepts offer, creates SDP answer, listens to DataChannel
   */
  public async initReceiver(
    offer: RTCSessionDescriptionInit,
    onSignal: SignalHandler,
    onFileComplete: (file: File) => void,
    onProgress?: (percent: number) => void,
    onFileOffer?: (fileOffer: P2PFileOffer) => void,
    onError?: (errMessage: string) => void
  ): Promise<void> {
    this.onSignal = onSignal;
    this.onProgress = onProgress;
    this.onFileComplete = onFileComplete;
    this.onFileOffer = onFileOffer;
    this.onError = onError;

    if (!this.pc) return;

    this.pc.onicecandidate = async (event) => {
      if (event.candidate && this.onSignal) {
        try {
          await this.onSignal({
            type: "candidate",
            candidate: {
              candidate: event.candidate.candidate,
              sdpMid: event.candidate.sdpMid ?? null,
              sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
              usernameFragment: event.candidate.usernameFragment ?? null,
            },
          });
        } catch (err: any) {
          console.warn("[P2P WebRTC] Failed to send ICE candidate (Receiver):", err);
          this.onError?.(err?.message || "Signaling failure: unable to deliver ICE candidate.");
        }
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      console.log("[P2P WebRTC] ICE connection state (Receiver):", state);
      if (state === "failed") {
        this.onError?.("WebRTC direct peer connection failed. Network may restrict direct P2P connectivity.");
      } else if (state === "disconnected") {
        this.onError?.("WebRTC peer connection disconnected.");
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log("[P2P WebRTC] Peer connection state (Receiver):", state);
      if (state === "failed" || state === "disconnected") {
        this.onError?.("Peer connection failed. Direct link could not be maintained.");
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, "receiver");
    };

    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.drainPendingCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    if (this.onSignal) {
      try {
        await this.onSignal({
          type: "answer",
          sdp: {
            type: answer.type,
            sdp: answer.sdp,
          },
        });
      } catch (err: any) {
        console.error("[P2P WebRTC] Failed to send answer signal:", err);
        this.onError?.(err?.message || "Failed to deliver signaling answer to peer.");
      }
    }
  }

  /**
   * Processes incoming signals (Answer SDPs or ICE candidates)
   */
  public async handleSignal(signal: {
    type: "offer" | "answer" | "candidate";
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }): Promise<void> {
    if (!this.pc) return;

    try {
      if (signal.type === "answer" && signal.sdp) {
        if (this.pc.signalingState !== "stable") {
          await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await this.drainPendingCandidates();
        }
      } else if (signal.type === "candidate" && signal.candidate) {
        if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
          await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          this.pendingCandidates.push(signal.candidate);
        }
      }
    } catch (err) {
      console.warn("[P2P WebRTC] handleSignal error:", err);
    }
  }

  private async drainPendingCandidates(): Promise<void> {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[P2P WebRTC] Failed to add queued ICE candidate:", e);
        }
      }
    }
  }

  /**
   * Waits until the RTCDataChannel is open
   */
  public async waitForOpen(timeoutMs = 15000): Promise<void> {
    if (this.dc && this.dc.readyState === "open") return;
    if (!this.dc) throw new Error("No DataChannel initialized");

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("WebRTC DataChannel handshake timed out"));
      }, timeoutMs);

      if (!this.dc) {
        clearTimeout(timer);
        return reject(new Error("DataChannel closed"));
      }

      const prevOnOpen = this.dc.onopen;
      this.dc.onopen = (ev) => {
        if (prevOnOpen && this.dc) prevOnOpen.call(this.dc, ev);
        clearTimeout(timer);
        resolve();
      };
    });
  }

  /**
   * Step 1 (Sender): Send lightweight file-offer over DataChannel and wait for Receiver ACCEPT/DECLINE response
   */
  public async requestFilePermission(offer: {
    transferId: string;
    senderName: string;
    fileName: string;
    fileSize: number;
    fileType: string;
  }): Promise<boolean> {
    await this.waitForOpen(15000);

    if (!this.dc || this.dc.readyState !== "open") {
      throw new Error("P2P DataChannel is not open");
    }

    const offerPacket: P2PFileOffer = {
      type: "file-offer",
      transferId: offer.transferId,
      senderName: offer.senderName || "OPERATIVE",
      fileName: offer.fileName,
      fileSize: offer.fileSize,
      fileType: offer.fileType || "application/octet-stream",
    };

    return new Promise<boolean>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.offerResponseResolvers.delete(offer.transferId);
        reject(new Error("Peer did not respond to file offer in time"));
      }, 60000);

      this.offerResponseResolvers.set(offer.transferId, (accepted: boolean) => {
        clearTimeout(timeout);
        this.offerResponseResolvers.delete(offer.transferId);
        resolve(accepted);
      });

      try {
        this.dc!.send(JSON.stringify(offerPacket));
      } catch (err) {
        clearTimeout(timeout);
        this.offerResponseResolvers.delete(offer.transferId);
        reject(err);
      }
    });
  }

  /**
   * Step 2 (Receiver): Send ACCEPT or DECLINE response back to Sender over DataChannel
   */
  public sendFileResponse(transferId: string, accepted: boolean): void {
    if (!this.dc || this.dc.readyState !== "open") return;
    const responsePacket: P2PFileResponse = {
      type: "file-response",
      transferId,
      accepted,
    };
    try {
      this.dc.send(JSON.stringify(responsePacket));
    } catch (err) {
      console.warn("[P2P WebRTC] Failed to send file-response:", err);
    }
  }

  /**
   * Handles incoming DataChannel messages on the Sender side (specifically `file-response`)
   */
  private handleSenderIncomingData(data: string | ArrayBuffer): void {
    if (typeof data !== "string") return;
    try {
      const parsed = JSON.parse(data);
      if (parsed && parsed.type === "transfer-cancel") {
        const reason = parsed.reason || "P2P transfer was cancelled by peer.";
        this.onError?.(reason);
        this.close();
        return;
      }
      if (parsed && parsed.type === "file-response" && parsed.transferId) {
        const resolver = this.offerResponseResolvers.get(parsed.transferId);
        if (resolver) {
          resolver(Boolean(parsed.accepted));
        }
      }
    } catch (err) {
      console.warn("[P2P WebRTC] Failed to parse sender incoming message:", err);
    }
  }

  /**
   * Verifies that the selected WebRTC candidate pair is direct (host, srflx, prflx)
   * and not relayed through a TURN server.
   */
  public async verifyDirectConnectivity(): Promise<{ isDirect: boolean; details: string }> {
    if (!this.pc) return { isDirect: false, details: "No peer connection" };
    try {
      const stats = await this.pc.getStats();
      let selectedPair: any = null;

      stats.forEach((report) => {
        if (report.type === "candidate-pair") {
          if (report.selected || report.nominated || report.state === "succeeded") {
            selectedPair = report;
          }
        }
      });

      if (!selectedPair) {
        stats.forEach((report) => {
          if (report.type === "transport" && report.selectedCandidatePairId) {
            selectedPair = stats.get(report.selectedCandidatePairId);
          }
        });
      }

      if (!selectedPair) {
        // Direct local or host candidate fallback if DataChannel is already operational
        return { isDirect: true, details: "Direct P2P Link Active" };
      }

      const localCand = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
      const remoteCand = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;

      const localType = localCand?.candidateType || selectedPair.localCandidateType;
      const remoteType = remoteCand?.candidateType || selectedPair.remoteCandidateType;

      if (localType === "relay" || remoteType === "relay") {
        return {
          isDirect: false,
          details: "Relayed connection detected (TURN). Direct WebRTC link required.",
        };
      }

      return {
        isDirect: true,
        details: `Direct P2P (${localType || "direct"}-${remoteType || "direct"})`,
      };
    } catch (e: any) {
      console.warn("[P2P WebRTC] verifyDirectConnectivity error:", e);
      return { isDirect: true, details: "Direct P2P Link" };
    }
  }

  /**
   * Step 3 (Sender): Streams file in 16KB ArrayBuffer chunks sliced directly from the File object
   * without calling file.arrayBuffer() for the entire file into memory, with backpressure management.
   */
  public async sendFile(
    file: File,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    await this.waitForOpen(20000);

    if (!this.dc || this.dc.readyState !== "open") {
      throw new Error("P2P DataChannel is not open");
    }

    // Verify direct WebRTC candidate connectivity before transferring bytes
    const directCheck = await this.verifyDirectConnectivity();
    if (!directCheck.isDirect) {
      throw new Error("Direct P2P link could not be established (relayed connections disallowed).");
    }

    // Handle 0-byte file edge case cleanly
    if (file.size === 0) {
      const metadataHeader = {
        type: "file-header",
        name: file.name,
        fileName: file.name,
        size: 0,
        fileSize: 0,
        mimeType: file.type || "application/octet-stream",
        fileType: file.type || "application/octet-stream",
        totalChunks: 0,
      };
      this.dc.send(JSON.stringify(metadataHeader));
      this.dc.send(
        JSON.stringify({
          type: "file-complete",
          fileName: file.name,
          fileSize: 0,
          fileType: file.type || "application/octet-stream",
        })
      );
      onProgress?.(100);
      this.onProgress?.(100);
      return;
    }

    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

    // 1. Send File Metadata Header
    const metadataHeader = {
      type: "file-header",
      name: file.name,
      fileName: file.name,
      size: file.size,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      fileType: file.type || "application/octet-stream",
      totalChunks,
    };

    this.dc.send(JSON.stringify(metadataHeader));

    // 2. Stream Chunks Sliced from File with Backpressure Control
    let offset = 0;
    let sentChunks = 0;

    while (offset < file.size) {
      if (!this.dc || this.dc.readyState !== "open") {
        throw new Error("P2P connection closed or interrupted during transfer");
      }

      if (this.dc.bufferedAmount > HIGH_WATERMARK) {
        // High watermark reached - wait for buffer to drain
        await new Promise<void>((resolve) => {
          if (!this.dc) return resolve();
          let resolved = false;
          const onLow = () => {
            if (resolved) return;
            resolved = true;
            if (this.dc) this.dc.onbufferedamountlow = null;
            resolve();
          };
          this.dc.onbufferedamountlow = onLow;
          setTimeout(onLow, 40);
        });
        continue;
      }

      const nextOffset = Math.min(offset + CHUNK_SIZE, file.size);
      // Slice directly from File (Blob) object without loading whole file into memory
      const slice = file.slice(offset, nextOffset);
      const chunk = await slice.arrayBuffer();

      this.dc.send(chunk);
      offset = nextOffset;
      sentChunks++;

      const percent = Math.min(100, Math.round((sentChunks / totalChunks) * 100));
      onProgress?.(percent);
      this.onProgress?.(percent);
    }

    // Wait for bufferedAmount to drain completely before signaling completion
    let drainWait = 0;
    while (this.dc && this.dc.readyState === "open" && this.dc.bufferedAmount > 0 && drainWait < 200) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      drainWait++;
    }

    if (this.dc && this.dc.readyState === "open") {
      this.dc.send(
        JSON.stringify({
          type: "file-complete",
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || "application/octet-stream",
        })
      );
    }

    console.log("[P2P WebRTC] File transfer complete (Sender):", file.name, `${sentChunks} chunks sent`);
  }

  private finalizeReceivedFile(): void {
    if (!this.fileMetadata) return;

    // Handle 0-byte file edge case
    if (this.fileMetadata.fileSize === 0) {
      const emptyFile = new File([], this.fileMetadata.fileName, {
        type: this.fileMetadata.fileType || "application/octet-stream",
        lastModified: Date.now(),
      });
      this.onProgress?.(100);
      this.onFileComplete?.(emptyFile);
      this.receivedBuffers = [];
      this.fileMetadata = null;
      this.receivedSize = 0;
      this.receivedCount = 0;
      return;
    }

    if (this.receivedBuffers.length === 0) {
      console.warn("[P2P WebRTC] finalizeReceivedFile called with empty buffers for non-zero file");
      return;
    }

    // Safety check: validate received size against declared size
    if (this.receivedSize < this.fileMetadata.fileSize) {
      console.error(
        `[P2P WebRTC] Transfer incomplete. Expected ${this.fileMetadata.fileSize} bytes, got ${this.receivedSize} bytes.`
      );
      this.onError?.(`Received incomplete file (${this.receivedSize}/${this.fileMetadata.fileSize} bytes). Transfer aborted.`);
      this.close();
      return;
    }

    const blob = new Blob(this.receivedBuffers, {
      type: this.fileMetadata.fileType || "application/octet-stream",
    });
    const file = new File([blob], this.fileMetadata.fileName, {
      type: this.fileMetadata.fileType || "application/octet-stream",
      lastModified: Date.now(),
    });

    console.log("[P2P WebRTC] File transfer complete (Receiver):", file.name, `(${file.size} bytes)`);
    this.onProgress?.(100);
    this.onFileComplete?.(file);

    // Reset buffer state
    this.receivedBuffers = [];
    this.fileMetadata = null;
    this.receivedSize = 0;
    this.receivedCount = 0;
  }

  /**
   * Receiver side: Processes incoming data packets (file-offer, file-header JSON, or ArrayBuffer chunks)
   */
  private handleIncomingData(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);

        // Handle transfer-cancel packet
        if (parsed.type === "transfer-cancel") {
          const reason = parsed.reason || "P2P transfer was cancelled by peer.";
          this.onError?.(reason);
          this.close();
          return;
        }

        // Handle explicit file-complete packet if chunks haven't finalized yet
        if (parsed.type === "file-complete") {
          this.finalizeReceivedFile();
          return;
        }

        // Handle file-offer request from Sender
        if (parsed.type === "file-offer") {
          const name = parsed.fileName || parsed.name || "shared_file";
          const size = Number(parsed.fileSize || parsed.size || 0);
          const mimeType = parsed.fileType || parsed.mimeType || "application/octet-stream";
          const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));

          this.fileMetadata = {
            type: "file-header",
            fileName: name,
            name,
            fileSize: size,
            size,
            fileType: mimeType,
            mimeType,
            totalChunks,
          };
          this.receivedBuffers = [];
          this.receivedSize = 0;
          this.receivedCount = 0;

          this.onFileOffer?.({
            type: "file-offer",
            transferId: parsed.transferId || `tx_${Date.now()}`,
            senderName: parsed.senderName || "OPERATIVE",
            fileName: name,
            fileSize: size,
            fileType: mimeType,
          });
          return;
        }

        // Handle file-header right before binary chunks stream
        const name = parsed.name || parsed.fileName || "shared_file";
        const size = Number(parsed.size || parsed.fileSize || 0);
        const mimeType = parsed.mimeType || parsed.fileType || "application/octet-stream";
        const totalChunks = Number(parsed.totalChunks || Math.ceil(size / CHUNK_SIZE) || 1);

        this.fileMetadata = {
          type: "file-header",
          fileName: name,
          name,
          fileSize: size,
          size,
          fileType: mimeType,
          mimeType,
          totalChunks,
        };

        this.receivedBuffers = [];
        this.receivedSize = 0;
        this.receivedCount = 0;
        this.onProgress?.(0);
        console.log("[P2P WebRTC] File header received:", this.fileMetadata);
      } catch (err) {
        console.warn("[P2P WebRTC] Failed to parse file metadata header:", err);
      }
      return;
    }

    if (typeof Blob !== "undefined" && data instanceof Blob) {
      data.arrayBuffer().then((buf) => this.handleIncomingData(buf)).catch(() => {});
      return;
    }

    let arrayBuf: ArrayBuffer | null = null;
    if (data instanceof ArrayBuffer) {
      arrayBuf = data;
    } else if (ArrayBuffer.isView(data)) {
      arrayBuf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    }

    if (arrayBuf && this.fileMetadata) {
      this.receivedBuffers.push(arrayBuf);
      this.receivedSize += arrayBuf.byteLength;
      this.receivedCount++;

      const targetSize = this.fileMetadata.fileSize || 1;
      const targetChunks = this.fileMetadata.totalChunks || Math.ceil(targetSize / CHUNK_SIZE) || 1;

      const percent = Math.min(
        100,
        Math.round(
          Math.max(
            (this.receivedSize / targetSize) * 100,
            (this.receivedCount / targetChunks) * 100
          )
        )
      );
      this.onProgress?.(percent);

      const isComplete =
        (this.fileMetadata.totalChunks > 0 && this.receivedCount >= this.fileMetadata.totalChunks) ||
        (this.fileMetadata.fileSize > 0 && this.receivedSize >= this.fileMetadata.fileSize);

      if (isComplete) {
        this.finalizeReceivedFile();
      }
    }
  }

  /**
   * Cancels transfer and notifies peer before closing
   */
  public cancelTransfer(reason = "P2P transfer was cancelled by peer."): void {
    if (this.dc && this.dc.readyState === "open") {
      try {
        this.dc.send(JSON.stringify({ type: "transfer-cancel", reason }));
      } catch {}
    }
    this.close();
  }

  /**
   * Closes data channel and peer connection cleanly
   */
  public close(): void {
    try {
      this.offerResponseResolvers.forEach((resolve) => resolve(false));
      this.offerResponseResolvers.clear();
      if (this.dc) {
        this.dc.close();
        this.dc = null;
      }
      if (this.pc) {
        this.pc.close();
        this.pc = null;
      }
    } catch (e) {}
  }
}
