import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ShieldAlert, X } from "lucide-react";
import { UNLOCK_SECRET_CODE } from "../utils/panic";

export interface PanicCalculatorProps {
  onUnlock: () => void;
}

export function PanicCalculator({ onUnlock }: PanicCalculatorProps) {
  const [displayValue, setDisplayValue] = useState("0");
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [inputSequence, setInputSequence] = useState("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Intercept Hardware / Browser Back Button Navigation
  useEffect(() => {
    // Push state so back button navigation can be intercepted without leaving page
    try {
      window.history.pushState({ phantomPanic: true }, "", window.location.href);
    } catch {}

    const handlePopState = (e: PopStateEvent) => {
      // Re-push state immediately to keep user on page
      try {
        window.history.pushState({ phantomPanic: true }, "", window.location.href);
      } catch {}
      // Open the centered confirmation modal
      setShowExitConfirm(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Request exit triggers modal confirmation instead of instant hide
  const handleRequestExit = useCallback(() => {
    setShowExitConfirm(true);
  }, []);

  const handleConfirmExit = useCallback(() => {
    setShowExitConfirm(false);
    onUnlock();
  }, [onUnlock]);

  const handleCancelExit = useCallback(() => {
    setShowExitConfirm(false);
  }, []);

  // Backdrop click handler outside the calculator card
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleRequestExit();
    }
  };

  const handleDigit = (digit: string) => {
    const newSequence = inputSequence + digit;
    setInputSequence(newSequence);

    if (waitingForOperand) {
      setDisplayValue(digit);
      setWaitingForOperand(false);
    } else {
      setDisplayValue(displayValue === "0" ? digit : displayValue + digit);
    }
  };

  const handleDecimal = () => {
    setInputSequence((prev) => prev + ".");
    if (waitingForOperand) {
      setDisplayValue("0.");
      setWaitingForOperand(false);
    } else if (!displayValue.includes(".")) {
      setDisplayValue(displayValue + ".");
    }
  };

  const handleClear = () => {
    setDisplayValue("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setInputSequence("");
  };

  const handleToggleSign = () => {
    const num = parseFloat(displayValue);
    setDisplayValue(String(-num));
  };

  const handlePercent = () => {
    const num = parseFloat(displayValue);
    setDisplayValue(String(num / 100));
  };

  const handlePerformOperation = (nextOperator: string) => {
    const inputValue = parseFloat(displayValue);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const currentValue = previousValue || 0;
      let newValue = currentValue;

      if (operator === "+") newValue = currentValue + inputValue;
      else if (operator === "-") newValue = currentValue - inputValue;
      else if (operator === "×") newValue = currentValue * inputValue;
      else if (operator === "÷") newValue = inputValue !== 0 ? currentValue / inputValue : 0;

      setPreviousValue(newValue);
      setDisplayValue(String(newValue));
    }

    setWaitingForOperand(true);
    setOperator(nextOperator);
  };

  const handleEquals = () => {
    // Secret unlock passcode check
    if (
      displayValue === UNLOCK_SECRET_CODE ||
      displayValue === "9999" ||
      inputSequence.endsWith(UNLOCK_SECRET_CODE) ||
      inputSequence.endsWith("9999")
    ) {
      onUnlock();
      return;
    }

    const inputValue = parseFloat(displayValue);

    if (operator && previousValue !== null) {
      let newValue = previousValue;
      if (operator === "+") newValue = previousValue + inputValue;
      else if (operator === "-") newValue = previousValue - inputValue;
      else if (operator === "×") newValue = previousValue * inputValue;
      else if (operator === "÷") newValue = inputValue !== 0 ? previousValue / inputValue : 0;

      setDisplayValue(String(newValue));
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(true);
      setInputSequence("");
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[99999] bg-[#0c0e14] flex flex-col items-center justify-center p-4 font-sans select-none overflow-y-auto"
      role="region"
      aria-label="Stealth Calculator Overlay"
    >
      {/* Top Action Header inside the Panic Calculator overlay */}
      <div className="w-full max-w-sm mb-3 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={handleRequestExit}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
          title="Exit Stealth Mode and return to active room"
          aria-label="Exit Stealth Mode"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
          <span>Exit Stealth Mode</span>
        </button>

        <span className="text-[10px] font-mono text-slate-600 select-none">
          Click background or back to exit
        </span>
      </div>

      {/* Calculator Card Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-[#121620] border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 shrink-0"
      >
        {/* Title Bar */}
        <div className="flex items-center justify-between text-xs text-slate-400 font-mono border-b border-slate-800/80 pb-3">
          <span className="font-semibold tracking-wider text-slate-300">Calculator</span>
          <span className="text-[10px] text-slate-500">v2.4</span>
        </div>

        {/* Display Screen */}
        <div className="bg-[#080a0f] border border-slate-800/90 rounded-2xl p-4 flex flex-col items-end justify-end h-28 overflow-hidden">
          <div className="text-xs font-mono text-slate-500 h-5 truncate max-w-full">
            {previousValue !== null ? `${previousValue} ${operator || ""}` : ""}
          </div>
          <div className="text-3xl sm:text-4xl font-mono font-light text-white tracking-tight truncate max-w-full">
            {displayValue}
          </div>
        </div>

        {/* Keypad Grid */}
        <div className="grid grid-cols-4 gap-3">
          {/* Row 1 */}
          <button
            type="button"
            onClick={handleClear}
            className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-rose-400 font-mono font-bold text-lg transition-all cursor-pointer"
          >
            AC
          </button>
          <button
            type="button"
            onClick={handleToggleSign}
            className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-lg transition-all cursor-pointer"
          >
            ±
          </button>
          <button
            type="button"
            onClick={handlePercent}
            className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 font-mono text-lg transition-all cursor-pointer"
          >
            %
          </button>
          <button
            type="button"
            onClick={() => handlePerformOperation("÷")}
            className={`h-14 rounded-2xl font-mono text-xl transition-all active:scale-95 cursor-pointer ${
              operator === "÷"
                ? "bg-amber-500 text-white"
                : "bg-amber-600/80 hover:bg-amber-500 text-white"
            }`}
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            type="button"
            onClick={() => handleDigit("7")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleDigit("8")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleDigit("9")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handlePerformOperation("×")}
            className={`h-14 rounded-2xl font-mono text-xl transition-all active:scale-95 cursor-pointer ${
              operator === "×"
                ? "bg-amber-500 text-white"
                : "bg-amber-600/80 hover:bg-amber-500 text-white"
            }`}
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            type="button"
            onClick={() => handleDigit("4")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleDigit("5")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleDigit("6")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handlePerformOperation("-")}
            className={`h-14 rounded-2xl font-mono text-xl transition-all active:scale-95 cursor-pointer ${
              operator === "-"
                ? "bg-amber-500 text-white"
                : "bg-amber-600/80 hover:bg-amber-500 text-white"
            }`}
          >
            -
          </button>

          {/* Row 4 */}
          <button
            type="button"
            onClick={() => handleDigit("1")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleDigit("2")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleDigit("3")}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handlePerformOperation("+")}
            className={`h-14 rounded-2xl font-mono text-xl transition-all active:scale-95 cursor-pointer ${
              operator === "+"
                ? "bg-amber-500 text-white"
                : "bg-amber-600/80 hover:bg-amber-500 text-white"
            }`}
          >
            +
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="col-span-2 h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all pl-6 text-left cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDecimal}
            className="h-14 rounded-2xl bg-slate-900/90 hover:bg-slate-800 active:scale-95 text-white font-mono text-xl transition-all cursor-pointer"
          >
            .
          </button>
          <button
            type="button"
            onClick={handleEquals}
            className="h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-mono text-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
          >
            =
          </button>
        </div>
      </div>

      {/* Standardized Centered Confirmation Modal */}
      {showExitConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="panic-exit-heading"
          className="fixed inset-0 flex items-center justify-center overflow-y-auto z-50 bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCancelExit();
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm sm:max-w-md bg-[#0F121A] border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl text-left space-y-4 my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <h3 id="panic-exit-heading" className="text-base font-semibold text-white">
                  Leave Panic Mode?
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelExit}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              Are you sure you want to return to the active terminal room?
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2 justify-end">
              <button
                type="button"
                onClick={handleCancelExit}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="py-2.5 px-5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs tracking-wider uppercase rounded-lg transition-colors cursor-pointer text-center shadow-lg shadow-cyan-950/40"
              >
                Return to Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export as DecoyCalculator for backward-compatibility
export { PanicCalculator as DecoyCalculator };
export default PanicCalculator;
