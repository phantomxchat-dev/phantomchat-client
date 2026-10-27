import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, AlertCircle, RefreshCw } from "lucide-react";

interface TurnstileWidgetProps {
  token?: string;
  resetSignal?: number;
  onVerify: (token: string) => void;
  onError: (errorMsg?: string) => void;
  onExpire: () => void;
}

export function TurnstileWidget({
  token,
  resetSignal = 0,
  onVerify,
  onError,
  onExpire,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  const [widgetStatus, setWidgetStatus] = useState<"loading" | "ready" | "verified" | "error" | "expired">("loading");
  const [statusMessage, setStatusMessage] = useState<string>("Initializing security verification...");
  const [retryCount, setRetryCount] = useState(0);

  // Keep callbacks in refs to avoid re-triggering effect on callback changes
  const callbacksRef = useRef({ onVerify, onError, onExpire });
  useEffect(() => {
    callbacksRef.current = { onVerify, onError, onExpire };
  });

  // Synchronize widgetStatus with the external token state
  useEffect(() => {
    if (!token && widgetStatus === "verified") {
      setWidgetStatus("ready");
      setStatusMessage("Please complete the verification check.");
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.reset(widgetIdRef.current);
        } catch (e) {}
      }
    } else if (token && widgetStatus !== "verified") {
      setWidgetStatus("verified");
      setStatusMessage("Security verification complete.");
    }
  }, [token, widgetStatus]);

  // Reset widget on resetSignal change
  useEffect(() => {
    if (resetSignal > 0) {
      if (widgetIdRef.current && (window as any).turnstile) {
        try {
          (window as any).turnstile.reset(widgetIdRef.current);
          setWidgetStatus("ready");
          setStatusMessage("Please complete the verification check.");
          return;
        } catch (e) {}
      }
      setRetryCount((prev) => prev + 1);
    }
  }, [resetSignal]);

  useEffect(() => {
    let isMounted = true;
    const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";
    const win = window as any;

    if (!siteKey) {
      setWidgetStatus("error");
      setStatusMessage("Turnstile is not configured. Set VITE_TURNSTILE_SITE_KEY in the client build environment.");
      callbacksRef.current.onError?.("Turnstile site key is not configured.");
      return () => {
        isMounted = false;
      };
    }

    setWidgetStatus("loading");
    setStatusMessage("Loading security verification...");

    const renderWidget = () => {
      if (!isMounted || !containerRef.current) return;
      
      // If widget is already rendered in this container, just reset it
      if (widgetIdRef.current && win.turnstile) {
        try {
          win.turnstile.reset(widgetIdRef.current);
          setWidgetStatus("ready");
          setStatusMessage("Please complete the verification check.");
          return;
        } catch (e) {
          // If reset failed, clear and re-render
          widgetIdRef.current = null;
        }
      }

      if (win.turnstile && containerRef.current && !widgetIdRef.current) {
        try {
          containerRef.current.innerHTML = "";
          widgetIdRef.current = win.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            action: "room-create",
            theme: "dark",
            size: "normal",
            callback: (newToken: string) => {
              if (isMounted) {
                setWidgetStatus("verified");
                setStatusMessage("Security verification complete.");
                if (callbacksRef.current.onVerify) {
                  callbacksRef.current.onVerify(newToken);
                }
              }
            },
            "error-callback": (errCode?: string) => {
              if (isMounted) {
                setWidgetStatus("error");
                setStatusMessage("Verification encountered an issue. Automatically resetting...");
                if (widgetIdRef.current && win.turnstile) {
                  try {
                    win.turnstile.reset(widgetIdRef.current);
                    setWidgetStatus("ready");
                    setStatusMessage("Please complete the verification check.");
                  } catch (e) {}
                }
                setRetryCount((prev) => prev + 1);
                if (callbacksRef.current.onError) {
                  callbacksRef.current.onError(errCode ? `Verification challenge error: ${errCode}` : "Verification failed");
                }
              }
            },
            "expired-callback": () => {
              if (isMounted) {
                setWidgetStatus("expired");
                setStatusMessage("Verification expired. Automatically refreshing...");
                if (widgetIdRef.current && win.turnstile) {
                  try {
                    win.turnstile.reset(widgetIdRef.current);
                    setWidgetStatus("ready");
                    setStatusMessage("Please complete the verification check.");
                  } catch (e) {}
                }
                if (callbacksRef.current.onExpire) {
                  callbacksRef.current.onExpire();
                }
              }
            },
          });
          setWidgetStatus("ready");
          setStatusMessage("Please complete the verification check.");
        } catch (e: any) {
          console.error("Turnstile render error:", e);
          if (isMounted) {
            setWidgetStatus("error");
            setStatusMessage("Unable to render verification challenge. Check network connection.");
          }
        }
      }
    };

    if (win.turnstile) {
      renderWidget();
    } else {
      let attempts = 0;
      const maxAttempts = 60; // 6 seconds max
      const timer = setInterval(() => {
        attempts++;
        if (win.turnstile) {
          clearInterval(timer);
          renderWidget();
        } else if (attempts >= maxAttempts) {
          clearInterval(timer);
          if (isMounted) {
            setWidgetStatus("error");
            setStatusMessage("Security verification script failed to load. Check your network or ad blocker.");
            if (callbacksRef.current.onError) {
              callbacksRef.current.onError("Security verification challenge failed to load. Please disable ad blockers and refresh.");
            }
          }
        }
      }, 100);

      return () => {
        isMounted = false;
        clearInterval(timer);
      };
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && win.turnstile) {
        try {
          win.turnstile.remove(widgetIdRef.current);
        } catch (e) {}
        widgetIdRef.current = null;
      }
    };
  }, [retryCount]);

  const handleManualRetry = () => {
    if (widgetIdRef.current && (window as any).turnstile) {
      try {
        (window as any).turnstile.reset(widgetIdRef.current);
        setWidgetStatus("ready");
        setStatusMessage("Please complete the verification check.");
        return;
      } catch (e) {}
    }
    setRetryCount((prev) => prev + 1);
  };

  const isActuallyVerified = widgetStatus === "verified" && !!token;

  return (
    <div className="w-full flex flex-col items-center">
      {/* Accessible live announcement for screen readers */}
      <div className="sr-only" aria-live="polite">
        {statusMessage}
      </div>

      {/* Main turnstile container */}
      <div
        className="turnstile-wrapper relative min-h-[65px] flex items-center justify-center"
        ref={containerRef}
      />

      {/* State feedback indicators */}
      {widgetStatus === "loading" && (
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
          <span>Loading human verification...</span>
        </div>
      )}

      {isActuallyVerified && (
        <div className="flex items-center gap-2 text-xs text-emerald-400 mt-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Human verification verified</span>
        </div>
      )}

      {(widgetStatus === "error" || widgetStatus === "expired" || (!token && widgetStatus === "verified")) && (
        <div className="flex flex-col items-center gap-2 text-xs text-rose-400 mt-2 text-center px-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{widgetStatus === "expired" ? "Verification token expired. Please re-verify." : statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={handleManualRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md transition-colors cursor-pointer text-xs font-medium mt-1"
          >
            <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Retry Verification</span>
          </button>
        </div>
      )}
    </div>
  );
}
