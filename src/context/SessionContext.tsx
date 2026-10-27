import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  getOrInitDeviceId,
  isDeviceIdPermanentlyLocked,
} from "../services/pairing";
import { getPersistentDeviceId } from "../utils/deviceId";

export interface SessionContextType {
  deviceId: string;
  isDeviceIdLocked: boolean;
  setDeviceId: (newDeviceId: string) => void;
  updateDeviceId: (newDeviceId: string) => void;
  unlockDeviceId: () => void;
  isPairingModalOpen: boolean;
  pairingMode: "host" | "joiner";
  openPairingModal: (mode?: "host" | "joiner") => void;
  closePairingModal: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const DEVICE_SYNC_EVENT = "phantom_device_synced";

export function SessionProvider({ children }: { children: ReactNode }) {
  // Read deviceId and lock status from localStorage on initial boot
  const [deviceId, setDeviceIdState] = useState<string>(() => {
    return getPersistentDeviceId();
  });
  const [isDeviceIdLocked, setIsDeviceIdLocked] = useState<boolean>(() =>
    isDeviceIdPermanentlyLocked()
  );
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingMode, setPairingMode] = useState<"host" | "joiner">("host");

  // Update and lock device ID across React state and persistent storage
  const updateDeviceId = useCallback((newDeviceId: string) => {
    const cleanId = String(newDeviceId || "").trim().toUpperCase();
    if (!cleanId) return;

    try {
      setDeviceIdState(cleanId);
      setIsDeviceIdLocked(true);

      localStorage.setItem("phantom_device_id", cleanId);
      localStorage.setItem("phantom_is_synced", "true");
      localStorage.setItem("phantom_synced_device_id", cleanId);
      localStorage.setItem("deviceId", cleanId);
      localStorage.setItem("isDeviceIdLocked", "true");
      localStorage.setItem("phantom_device_dna", cleanId);
      localStorage.setItem("pairedAt", Date.now().toString());

      // Trigger a re-fetch of the Pro status from Firebase/Cloudflare KV to immediately reflect active Pro clearance
      window.dispatchEvent(
        new CustomEvent("phantom_pro_updated", {
          detail: { deviceId: cleanId, isProRefresh: true },
        })
      );

      // Dispatch custom event for cross-component synchrony
      window.dispatchEvent(
        new CustomEvent(DEVICE_SYNC_EVENT, {
          detail: { deviceId: cleanId, isDeviceIdLocked: true },
        })
      );
    } catch (e) {
      console.warn("Error persisting updated deviceId:", e);
    }
  }, []);

  // Unlock device ID and clear sync flags
  const unlockDeviceId = useCallback(() => {
    try {
      setIsDeviceIdLocked(false);
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem("isDeviceIdLocked");
        localStorage.removeItem("phantom_is_synced");
        localStorage.removeItem("phantom_synced_device_id");
      }
      window.dispatchEvent(
        new CustomEvent(DEVICE_SYNC_EVENT, {
          detail: { deviceId, isDeviceIdLocked: false },
        })
      );
    } catch (e) {
      console.warn("Error unlocking deviceId:", e);
    }
  }, [deviceId]);

  // Enforce lock integrity on boot and across storage / custom sync events
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        const locked =
          localStorage.getItem("isDeviceIdLocked") === "true" ||
          localStorage.getItem("phantom_is_synced") === "true" ||
          Boolean(localStorage.getItem("phantom_synced_device_id"));
        const storedId = (
          localStorage.getItem("phantom_device_id") ||
          localStorage.getItem("deviceId") ||
          localStorage.getItem("phantom_device_dna") ||
          ""
        )
          .trim()
          .toUpperCase();
        if (locked && storedId) {
          setIsDeviceIdLocked(true);
          if (deviceId !== storedId) {
            setDeviceIdState(storedId);
          }
          localStorage.setItem("phantom_device_id", storedId);
          localStorage.setItem("deviceId", storedId);
          localStorage.setItem("phantom_device_dna", storedId);
        }
      }
    } catch {}
  }, [deviceId]);

  useEffect(() => {
    const handleCustomSync = (e: Event) => {
      const customEvent = e as CustomEvent<{
        deviceId?: string;
        isDeviceIdLocked?: boolean;
      }>;
      if (customEvent.detail?.isDeviceIdLocked !== undefined) {
        setIsDeviceIdLocked(Boolean(customEvent.detail.isDeviceIdLocked));
      }
      if (
        customEvent.detail?.deviceId &&
        customEvent.detail.deviceId !== deviceId
      ) {
        setDeviceIdState(customEvent.detail.deviceId);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "isDeviceIdLocked" || e.key === "phantom_is_synced") {
        setIsDeviceIdLocked(
          localStorage.getItem("isDeviceIdLocked") === "true" ||
            localStorage.getItem("phantom_is_synced") === "true" ||
            Boolean(localStorage.getItem("phantom_synced_device_id"))
        );
      }
      if (
        (e.key === "phantom_device_id" ||
          e.key === "deviceId" ||
          e.key === "phantom_device_dna") &&
        e.newValue
      ) {
        setDeviceIdState(e.newValue.trim().toUpperCase());
      }
    };

    window.addEventListener(DEVICE_SYNC_EVENT, handleCustomSync);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(DEVICE_SYNC_EVENT, handleCustomSync);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [deviceId]);

  const openPairingModal = useCallback((mode: "host" | "joiner" = "host") => {
    setPairingMode(mode);
    setIsPairingModalOpen(true);
  }, []);

  const closePairingModal = useCallback(() => {
    setIsPairingModalOpen(false);
  }, []);

  return (
    <SessionContext.Provider
      value={{
        deviceId,
        isDeviceIdLocked,
        setDeviceId: updateDeviceId,
        updateDeviceId,
        unlockDeviceId,
        isPairingModalOpen,
        pairingMode,
        openPairingModal,
        closePairingModal,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
