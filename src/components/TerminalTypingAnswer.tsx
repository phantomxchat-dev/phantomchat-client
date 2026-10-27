import React, { useState, useEffect, useRef } from "react";

interface TerminalTypingAnswerProps {
  itemId: string;
  fullText: string;
  isExpanded: boolean;
  accentColorClass?: string; // e.g., "text-[#00BFFF]" or "text-cyan-400"
  onComplete?: () => void;
}

export const TerminalTypingAnswer = React.memo(function TerminalTypingAnswer({
  itemId,
  fullText,
  isExpanded,
  accentColorClass = "text-cyan-400",
  onComplete,
}: TerminalTypingAnswerProps) {
  const [displayedText, setDisplayedText] = useState(fullText);
  const [isTyping, setIsTyping] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", listener);
    return () => {
      mediaQuery.removeEventListener("change", listener);
    };
  }, []);

  const handleInstantSkip = () => {
    if (!isTyping) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setDisplayedText(fullText);
    setIsTyping(false);
    if (onComplete) {
      onComplete();
    }
  };

  useEffect(() => {
    let isCancelled = false;

    // Clear any active timer immediately
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // If answer is closed/collapsed, stop animation
    if (!isExpanded) {
      setDisplayedText("");
      setIsTyping(false);
      return;
    }

    if (prefersReducedMotion) {
      setDisplayedText(fullText);
      setIsTyping(false);
      if (onComplete) {
        onComplete();
      }
      return;
    }

    // Start cinematic typing animation
    setDisplayedText("");
    setIsTyping(true);
    let currentIndex = 0;
    const speed = 10; // ms per character

    const typeNextChar = () => {
      if (isCancelled) return;
      currentIndex++;
      if (currentIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex));
        timerRef.current = setTimeout(typeNextChar, speed);
      } else {
        setIsTyping(false);
        if (onComplete) {
          onComplete();
        }
      }
    };

    timerRef.current = setTimeout(typeNextChar, speed);

    return () => {
      isCancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isExpanded, fullText, itemId, prefersReducedMotion]);

  // Allow user to press any key to skip typing animation
  useEffect(() => {
    if (!isTyping || prefersReducedMotion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["Shift", "Control", "Alt", "Meta", "Tab"].includes(e.key)) return;
      handleInstantSkip();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isTyping, prefersReducedMotion]);

  return (
    <div 
      className="cursor-pointer select-text outline-none relative w-full"
      onClick={(e) => {
        // Allow selection of finished text without triggering skip logic if already complete
        if (isTyping) {
          e.preventDefault();
          e.stopPropagation();
          handleInstantSkip();
        }
      }}
      tabIndex={0}
      title={isTyping ? "Click or press any key to reveal full answer immediately" : undefined}
    >
      {/* Screen reader accessible full content */}
      <div className="sr-only" aria-live="polite">
        {fullText}
      </div>

      {/* Cinematic visual terminal display */}
      <div 
        aria-hidden="true" 
        className={`font-mono text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap flex items-start w-full ${
          prefersReducedMotion ? "animate-fade-in duration-200" : ""
        }`}
      >
        <span className={`font-bold mr-2 select-none shrink-0 ${accentColorClass}`}>&gt;</span>
        <div className="flex-grow min-w-0 break-words font-mono">
          <span>{displayedText}</span>
          {isTyping && (
            <span 
              className={`inline-block w-2 h-3.5 ml-1 bg-current animate-pulse ${accentColorClass}`}
              style={{ verticalAlign: "-1.5px" }}
            />
          )}
          {!isTyping && !prefersReducedMotion && (
            <span 
              className={`inline-block w-2 h-3.5 ml-1 bg-current opacity-30 ${accentColorClass}`}
              style={{ verticalAlign: "-1.5px" }}
            />
          )}
        </div>
      </div>
    </div>
  );
});
