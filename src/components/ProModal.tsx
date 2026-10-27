import React from "react";
import { createPortal } from "react-dom";
import { Crown, X, RefreshCw } from "lucide-react";

interface ProModalProps {
  showModal: boolean;
  onClose: () => void;
  myDna: string;
  widgetInvoiceId: string | null;
}

export const ProModal: React.FC<ProModalProps> = ({
  showModal,
  onClose,
  myDna,
  widgetInvoiceId
}) => {
  if (!showModal) return null;

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="NowPayments Pro Checkout"
      className="fixed inset-0 z-[99999] flex items-center justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 font-mono animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] bg-black border-2 border-[#00BFFF]/60 rounded-2xl p-3 sm:p-5 shadow-[0_0_50px_rgba(0,191,255,0.3)] flex flex-col items-center space-y-3 max-h-[90vh] my-auto overflow-y-auto transform transition-all text-left"
        style={{
          maxHeight: "90vh",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          flex: "1 1 auto"
        }}
      >
          
          {/* Modal Header */}
          <div className="w-full flex items-center justify-between border-b border-gray-800 pb-2 shrink-0">
            <div className="flex items-center space-x-2">
              <Crown className="w-4 h-4 sm:w-5 sm:h-5 text-[#00BFFF] fill-[#00BFFF]/20 animate-pulse" />
              <span className="text-xs sm:text-sm font-black text-[#00BFFF] tracking-widest uppercase text-glow-blue">NOWPAYMENTS PRO CHECKOUT</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-[#00BFFF] hover:bg-gray-900 rounded-lg transition-colors cursor-pointer"
              title="Close Payment Modal"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Info Notice */}
          <div className="w-full p-2 bg-[#00BFFF]/10 border border-[#00BFFF]/30 rounded-lg text-center space-y-0.5 shrink-0">
            <p className="text-[10px] sm:text-[11px] text-gray-200">BOUND DEVICE DNA: <strong className="text-[#00BFFF] text-glow-blue">{myDna}</strong></p>
            <p className="text-gray-400 text-[8px] sm:text-[9px] uppercase tracking-wider">Complete payment inside this widget. Pro status activates automatically in real-time.</p>
          </div>

          {/* PRO CLEARANCE SYNC DISCLAIMER */}
          <div className="w-full p-2.5 sm:p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs font-mono flex items-start gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)] leading-relaxed shrink-0">
            <span className="shrink-0 text-amber-400 font-bold select-none text-xs sm:text-sm">⚠️</span>
            <p className="text-[10px] sm:text-[11px] font-sans leading-relaxed text-amber-200/90 text-left">
              <strong className="font-semibold text-amber-300 font-mono">PRO CLEARANCE NOTICE:</strong> Your Pro status is cryptographically tied to your specific Device ID (TR-XXXXX). When opening Phantom Chat on a new browser or secondary device, always use Sync Browser to pair it with your Pro Device ID. Generating a new unlinked Device ID will not inherit your Pro clearance.
            </p>
          </div>

          {/* Embedded NOWPayments Widget Container */}
          <div
            id="nowpayments-widget-container"
            className="w-full flex justify-center items-center shrink-0"
            style={{ width: "100%" }}
          >
            <iframe
              src={`https://nowpayments.io/embeds/payment-widget?iid=${widgetInvoiceId || "5180318708"}&device_dna=${encodeURIComponent(myDna)}&order_description=${encodeURIComponent(`Device DNA: ${myDna}`)}`}
              width="410"
              height="696"
              frameBorder="0"
              scrolling="no"
              style={{
                width: "410px",
                height: "696px",
                overflowY: "hidden",
                border: "none",
                borderRadius: "12px",
                display: "block",
                margin: "0 auto"
              }}
              title="NOWPayments Pro Subscription"
            >
              Can't load widget
            </iframe>
          </div>

          {/* Polling / Helper footer */}
          <div className="w-full text-center text-[9px] text-gray-400 uppercase flex items-center justify-center space-x-2 pt-2 border-t border-gray-800/80 shrink-0">
            <RefreshCw className="w-3.5 h-3.5 text-[#00BFFF] animate-spin" />
            <span>Awaiting payment verification from Cloudflare D1...</span>
          </div>

        </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalElement, document.body)
    : modalElement;
};
