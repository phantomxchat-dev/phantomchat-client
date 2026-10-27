const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");

/** Resolve same-origin /api routes against an optional external backend origin. */
export function resolveApiUrl(path: string): string {
  if (!API_BASE_URL) return path;
  try {
    const url = new URL(path, typeof window !== "undefined" ? window.location.origin : "https://client.invalid");
    if (url.pathname.startsWith("/api/")) {
      return `${API_BASE_URL}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Preserve the original path; fetch/EventSource will report any invalid URL.
  }
  return path;
}

export function initFetchInterceptor() {
  if (typeof window === "undefined" || !window.fetch) return;
  if ((window.fetch as any).__phantomInterceptorPatched) return;

  const originalFetch = window.fetch.bind(window);
  const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlString = "";
    if (typeof input === "string") {
      urlString = input;
    } else if (input instanceof URL) {
      urlString = input.toString();
    } else if (input && typeof input === "object" && "url" in input) {
      urlString = (input as Request).url;
    }

    const isApiRequest = urlString.includes("/api/");
    if (isApiRequest) {
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));

      if (!headers.has("X-Device-DNA")) {
        try {
          const deviceDna = localStorage.getItem("phantom_device_dna") || "GHOST-DNA-DEFAULT";
          headers.set("X-Device-DNA", deviceDna);
        } catch {
          headers.set("X-Device-DNA", "GHOST-DNA-DEFAULT");
        }
      }

      init = { ...init, headers };
    }

    if (API_BASE_URL && isApiRequest) {
      input = resolveApiUrl(urlString);
    }
    return originalFetch(input, init);
  };

  (patchedFetch as any).__phantomInterceptorPatched = true;
  window.fetch = patchedFetch;
}

export function connectRoomStream(
  roomCode: string,
  callbacks: {
    onMessage?: (message: any) => void;
    onParticipantJoined?: (data: any) => void;
    onRoomClosed?: (data: any) => void;
    onError?: (err: any) => void;
  }
) {
  if (!roomCode) return () => {};

  let eventSource: EventSource | null = null;
  let active = true;

  const connect = () => {
    if (!active) return;
    try {
      const deviceDna = localStorage.getItem("phantom_device_dna") || "GHOST-DNA-DEFAULT";
      const path = `/api/rooms/stream/${encodeURIComponent(roomCode)}?dna=${encodeURIComponent(deviceDna)}`;
      eventSource = new EventSource(resolveApiUrl(path));

      eventSource.onmessage = (event) => {
        try {
          if (!event.data || event.data.trim() === "") return;
          const data = JSON.parse(event.data);

          if (data.type === "new-message" && callbacks.onMessage) {
            callbacks.onMessage(data.message || data);
          } else if (data.type === "participant-joined" && callbacks.onParticipantJoined) {
            callbacks.onParticipantJoined(data);
          } else if (data.type === "room-closed" && callbacks.onRoomClosed) {
            callbacks.onRoomClosed(data);
          } else if (data.type === "history" && Array.isArray(data.data)) {
            for (const msg of data.data) callbacks.onMessage?.(msg);
          } else if (callbacks.onMessage && (data.id || data.text)) {
            callbacks.onMessage(data);
          }
        } catch {
          // Ignore non-JSON or ping comments.
        }
      };

      eventSource.onerror = (err) => {
        console.warn("[SSE] Stream connection error:", err);
        callbacks.onError?.(err);
        eventSource?.close();
        if (active) setTimeout(connect, 3000);
      };
    } catch (e) {
      console.error("[SSE] Failed to establish EventSource:", e);
    }
  };

  connect();
  return () => {
    active = false;
    eventSource?.close();
    eventSource = null;
  };
}
