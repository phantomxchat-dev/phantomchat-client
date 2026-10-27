import React, { useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { Lock, AlertTriangle, X } from "lucide-react";

interface PremiumCaptchaGateProps {
  onVerified: () => void;
  onCancel: () => void;
}

export function PremiumCaptchaGate({ onVerified, onCancel }: PremiumCaptchaGateProps) {
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";

  const handleCaptchaChange = async (token: string | null) => {
    if (!token) return;
    setIsVerifying(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/verify-captcha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json().catch(() => ({ success: false }));

      if (res.ok && data.success) {
        try {
          if (typeof window !== "undefined" && window.sessionStorage) {
            sessionStorage.setItem("phantom_premium_verified", "true");
          }
        } catch {}
        onVerified();
      } else {
        recaptchaRef.current?.reset();
        setErrorMessage(data.error || "Verification Failed. Access Denied.");
      }
    } catch (err: any) {
      recaptchaRef.current?.reset();
      setErrorMessage("Verification Failed. Access Denied.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-y-auto z-50 bg-black/80 backdrop-blur-sm p-4 sm:p-6 font-mono animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-[#07090E]/95 border border-cyan-500/50 rounded-2xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] space-y-6 overflow-hidden my-auto">
        {/* Subtle cyber scan glow header line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />

        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          title="Return to Main Terminal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-base sm:text-lg font-black text-white tracking-widest uppercase">
            HUMAN VERIFICATION REQUIRED
          </h2>
          <p className="text-[10px] text-cyan-300 font-mono tracking-wider uppercase font-semibold">
            VERIFY HUMAN SIGNATURE TO ACCESS PREMIUM ROUTE
          </p>
        </div>

        {/* ReCAPTCHA Box Container */}
        <div className="flex flex-col items-center justify-center pt-2">
          <div className="p-2 bg-black/80 rounded-xl border border-slate-800 shadow-inner">
            {recaptchaSiteKey ? (
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey={recaptchaSiteKey}
                theme="dark"
                onChange={handleCaptchaChange}
              />
            ) : (
              <p className="max-w-xs text-center text-xs text-amber-300">Set VITE_RECAPTCHA_SITE_KEY to enable this verification.</p>
            )}
          </div>
        </div>

        {/* Status / Error Notifications */}
        {isVerifying && (
          <div className="text-center text-xs text-cyan-300 animate-pulse font-mono font-semibold">
            VERIFYING SIGNATURE WITH SECURITY GATEWAY...
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/50 rounded-lg text-rose-300 text-xs text-center font-bold flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Cancel button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            ← CANCEL &amp; RETURN
          </button>
        </div>
      </div>
    </div>
  );
}
