import React, { useState, useEffect, useRef } from "react";

interface EntryAnimationProps {
  onComplete: () => void;
  onReveal?: () => void;
}

type Phase = "cursor" | "typing" | "sliding-in" | "locked-pause" | "release" | "sliding-out" | "done";

export default function EntryAnimation({ onComplete, onReveal }: EntryAnimationProps) {
  const [phase, setPhase] = useState<Phase>(() => {
    try {
      const seen = typeof window !== "undefined" && sessionStorage.getItem("phantom_vault_seen") === "true";
      return seen ? "done" : "cursor";
    } catch (e) {
      return "done";
    }
  });
  const [typedText, setTypedText] = useState("");
  const [useFallbackFade, setUseFallbackFade] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  // FX trigger states
  const [lockFlash, setLockFlash] = useState(false);
  const [edgeGlowBoost, setEdgeGlowBoost] = useState(false);
  const [seamSweepActive, setSeamSweepActive] = useState(false);
  const [seamSweepKey, setSeamSweepKey] = useState(0);
  const [screenShake, setScreenShake] = useState<"none" | "weak" | "strong">("none");
  const [scaleBounce, setScaleBounce] = useState(false);
  const [radialGlowOpacity, setRadialGlowOpacity] = useState(0);
  const [whiteFlashActive, setWhiteFlashActive] = useState(false);

  const timeoutsRef = useRef<number[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onRevealRef = useRef(onReveal);

  // Keep refs in sync
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onRevealRef.current = onReveal;
  }, [onComplete, onReveal]);

  const registerTimeout = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timeoutsRef.current.push(id);
    return id;
  };

  useEffect(() => {
    // Lock body overflow during entry animation to prevent desktop scrollbars
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    console.log('[EntryAnimation] Phase: cursor (0ms)');
    
    // Helper to safely access sessionStorage
    const isSeenInStorage = () => {
      try {
        return typeof window !== "undefined" && sessionStorage.getItem("phantom_vault_seen") === "true";
      } catch (e) {
        return false;
      }
    };

    const markSeenInStorage = () => {
      try {
        sessionStorage.setItem("phantom_vault_seen", "true");
      } catch (e) {
        // Ignore storage restrictions in sandboxed iframes
      }
    };

    // 1. Session Storage Skip Check
    if (isSeenInStorage()) {
      console.log('[EntryAnimation] Phase: done (already seen)');
      setPhase("done");
      document.body.style.overflow = originalOverflow;
      onCompleteRef.current();
      if (onRevealRef.current) onRevealRef.current();
      return;
    }

    // 2. Prefers-Reduced-Motion Check
    let prefersReduced = false;
    try {
      prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}

    if (prefersReduced) {
      setUseFallbackFade(true);
      registerTimeout(() => {
        markSeenInStorage();
        if (onRevealRef.current) onRevealRef.current();
        setIsFadingOut(true);
        registerTimeout(() => {
          document.body.style.overflow = originalOverflow;
          onCompleteRef.current();
        }, 400);
      }, 100);
      return;
    }

    // Safety Fallback Timer (5200ms) - guarantees reveal even if timers or rendering stall
    const safetyTimerId = window.setTimeout(() => {
      console.log('[EntryAnimation] Safety fallback triggered');
      markSeenInStorage();
      if (onRevealRef.current) onRevealRef.current();
      onCompleteRef.current();
      setPhase("done");
      document.body.style.overflow = originalOverflow;
    }, 5200);

    // 3. PHASE: 'cursor' (0ms - 500ms)
    // Controlled by default state.

    // 4. PHASE: 'typing' (500ms - 1000ms)
    registerTimeout(() => {
      console.log('[EntryAnimation] Phase: typing (500ms)');
      setPhase("typing");
      const textToType = "> BREACH DETECTED";
      let charIndex = 0;
      
      const typeNextChar = () => {
        if (charIndex <= textToType.length) {
          setTypedText(textToType.slice(0, charIndex));
          charIndex++;
          // ~23ms per char to comfortably type 17 characters in 400ms
          registerTimeout(typeNextChar, 23);
        }
      };
      typeNextChar();
    }, 500);

    // 5. PHASE: 'sliding-in' (1000ms - 2200ms)
    registerTimeout(() => {
      console.log('[EntryAnimation] Phase: sliding-in (1000ms)');
      setPhase("sliding-in");

      // scale bounce at 2100ms total (1100ms into sliding-in)
      registerTimeout(() => {
        setScaleBounce(true);
      }, 1100);

      // Doors meet at 2200ms total (1200ms into sliding-in)
      registerTimeout(() => {
        console.log('[EntryAnimation] Phase: locked-pause (2200ms)');
        setPhase("locked-pause");

        // Flash lock bright white-cyan for 100ms
        setLockFlash(true);
        registerTimeout(() => setLockFlash(false), 100);

        // Seam sweep light beam (removed automatically after 300ms)
        setSeamSweepActive(true);
        setSeamSweepKey((prev) => prev + 1);
        registerTimeout(() => setSeamSweepActive(false), 300);

        // Screen shake (weak) for 200ms
        setScreenShake("weak");
        registerTimeout(() => setScreenShake("none"), 200);

        // Boost edge glow lines for 100ms
        setEdgeGlowBoost(true);
        registerTimeout(() => setEdgeGlowBoost(false), 100);
      }, 1200);
    }, 1000);

    // 6. PHASE: 'locked-pause' (2200ms - 2700ms) - trimmed from 800ms to 500ms duration

    // 7. PHASE: 'release' (2700ms - 3100ms)
    registerTimeout(() => {
      console.log('[EntryAnimation] Phase: release (2700ms)');
      setPhase("release");

      // White flash for 80ms
      setWhiteFlashActive(true);
      registerTimeout(() => setWhiteFlashActive(false), 80);

      // Edge glow lines flash bright (100ms)
      setEdgeGlowBoost(true);
      registerTimeout(() => setEdgeGlowBoost(false), 100);

      // Stronger screen shake (200ms)
      setScreenShake("strong");
      registerTimeout(() => setScreenShake("none"), 200);
    }, 1700); // 1000ms sliding-in + 1200ms doors slide = 2200ms + 500ms pause = 2700ms

    // 8. PHASE: 'sliding-out' (3100ms - 4700ms) - extended from 1300ms to 1600ms
    registerTimeout(() => {
      console.log('[EntryAnimation] Phase: sliding-out (3100ms)');
      setPhase("sliding-out");

      // Radial glow fades in
      setRadialGlowOpacity(1);

      // Radial glow fades out as terminal becomes visible
      registerTimeout(() => {
        setRadialGlowOpacity(0);
      }, 500);

      // Trigger underlying terminal page fade-in (opacity 0 -> 1 & translate settle) delayed 200ms after door starts separating
      registerTimeout(() => {
        console.log('[EntryAnimation] Calling onReveal (3300ms)');
        if (onRevealRef.current) onRevealRef.current();
      }, 200);
    }, 2100); // 1000ms sliding-in + 1200ms doors slide + 500ms pause + 400ms release = 3100ms

    // 9. PHASE: 'done' (4700ms - 5000ms)
    registerTimeout(() => {
      console.log('[EntryAnimation] Phase: done (4700ms)');
      setPhase("done");
      markSeenInStorage();
      document.body.style.overflow = originalOverflow;
      onCompleteRef.current();
      window.clearTimeout(safetyTimerId);
    }, 3700); // 1000ms sliding-in + 1200ms doors slide + 500ms pause + 400ms release + 1600ms sliding-out = 4700ms

    return () => {
      window.clearTimeout(safetyTimerId);
      document.body.style.overflow = originalOverflow;
      timeoutsRef.current.forEach((id) => clearTimeout(id));
    };
  }, []);

  if (phase === "done") {
    return null;
  }

  if (useFallbackFade) {
    return (
      <div
        id="entry-fallback"
        className="fixed inset-0 w-full h-full bg-black z-[99999] pointer-events-none transition-opacity duration-[400ms] ease-out"
        style={{ opacity: isFadingOut ? 0 : 1 }}
      />
    );
  }

  // Animation classes
  const isClosedState = ["sliding-in", "locked-pause", "release"].includes(phase);
  const topTransform = isClosedState ? "translateY(0) translateZ(0)" : "translateY(-100%) translateZ(0)";
  const bottomTransform = isClosedState ? "translateY(0) translateZ(0)" : "translateY(100%) translateZ(0)";

  const getDoorTransition = () => {
    if (phase === "sliding-in") {
      return "transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)";
    }
    if (phase === "sliding-out") {
      try {
        if (typeof window !== "undefined" && window.innerWidth >= 1024) {
          return "transform 1600ms cubic-bezier(0.65, 0, 0.35, 1)";
        }
      } catch (e) {}
      return "transform 1300ms cubic-bezier(0.16, 1, 0.3, 1)";
    }
    return "transform 1200ms cubic-bezier(0.16, 1, 0.3, 1)";
  };

  const getLockClass = () => {
    if (phase === "locked-pause") {
      return "lock-pulsing";
    }
    if (phase === "release") {
      return "lock-releasing";
    }
    return "";
  };

  const getLockStyle = (): React.CSSProperties => {
    const isVisible = ["sliding-in", "locked-pause", "release", "sliding-out"].includes(phase);
    const isFadingOutEnd = phase === "sliding-out";
    return {
      opacity: isFadingOutEnd ? 0 : isVisible ? 1 : 0,
      transition: isFadingOutEnd ? "opacity 200ms ease-in" : isVisible ? "opacity 200ms ease-out" : "opacity 0ms",
      willChange: "transform, opacity",
      transform: "translateZ(0)",
    };
  };

  const getOverlayClass = () => {
    if (screenShake === "weak") return "shake-weak-active";
    if (screenShake === "strong") return "shake-strong-active";
    return "";
  };

  const isTextVisible = ["cursor", "typing"].includes(phase);

  return (
    <>
      <style>{`
        :root {
          --vault-outer-size: 180px;
          --vault-second-outer-size: 150px;
          --vault-middle-size: 120px;
          --vault-diamond-size: 102px;
          --vault-diamond-translate: -51px;
          --vault-inner-size: 85px;
          --vault-tick-translate: -42.5px;
          --vault-core-size: 34px;
          --vault-orbit-size: 190px;
          --vault-orbit-translate: -95px;
          --vault-bloom-size: 350px;
        }

        @media (min-width: 1024px) {
          :root {
            --vault-outer-size: clamp(180px, 18vw, 260px);
            --vault-second-outer-size: clamp(150px, 15vw, 220px);
            --vault-middle-size: clamp(120px, 12.5vw, 180px);
            --vault-inner-size: clamp(85px, 9vw, 130px);
            --vault-core-size: clamp(34px, 3.5vw, 50px);
            --vault-diamond-size: clamp(102px, 10.6vw, 153px);
            --vault-diamond-translate: calc(var(--vault-diamond-size) / -2);
            --vault-tick-translate: calc(var(--vault-inner-size) / -2);
            --vault-orbit-size: clamp(190px, 19vw, 274px);
            --vault-orbit-translate: calc(var(--vault-orbit-size) / -2);
            --vault-bloom-size: clamp(350px, 35vw, 500px);
          }

          .lock-scale-breathe-slow {
            animation: lock-scale-breathe-slow-anim 4s ease-in-out infinite alternate;
          }
          .lock-scale-breathe-fast {
            animation: lock-scale-breathe-fast-anim 3.3s ease-in-out infinite alternate;
          }
          .lock-rotate-desktop-cw {
            animation: lock-rotate-slow-desktop-cw 24s linear infinite;
          }
          .lock-rotate-desktop-ccw {
            animation: lock-rotate-slow-desktop-ccw 20s linear infinite;
          }
        }

        @keyframes lock-rotate-slow-desktop-cw {
          0% { transform: rotate(0deg) translateZ(0); }
          100% { transform: rotate(360deg) translateZ(0); }
        }

        @keyframes lock-rotate-slow-desktop-ccw {
          0% { transform: rotate(360deg) translateZ(0); }
          100% { transform: rotate(0deg) translateZ(0); }
        }

        @keyframes overexpose-bloom-line {
          0% {
            transform: scaleY(0.1) translateZ(0);
            opacity: 0.2;
            filter: blur(4px);
          }
          20% {
            transform: scaleY(1.8) translateZ(0);
            opacity: 1;
            filter: blur(12px);
          }
          100% {
            transform: scaleY(0) translateZ(0);
            opacity: 0;
            filter: blur(20px);
          }
        }

        @keyframes overexpose-bloom-circle {
          0% {
            transform: scale(0.4) translateZ(0);
            opacity: 0.4;
            filter: blur(10px);
          }
          25% {
            transform: scale(1.6) translateZ(0);
            opacity: 1.0;
            filter: blur(25px);
          }
          100% {
            transform: scale(2.2) translateZ(0);
            opacity: 0;
            filter: blur(40px);
          }
        }

        @keyframes lock-scale-breathe-slow-anim {
          0% { transform: scale(0.99) translateZ(0); }
          100% { transform: scale(1.01) translateZ(0); }
        }

        @keyframes lock-scale-breathe-fast-anim {
          0% { transform: scale(1.01) translateZ(0); }
          100% { transform: scale(0.99) translateZ(0); }
        }

        @keyframes bloom-breathe {
          0% { opacity: 0.1; }
          100% { opacity: 0.2; }
        }
        .bloom-pulsing {
          animation: bloom-breathe 2s ease-in-out infinite alternate;
        }

        @keyframes lock-afterglow-anim {
          0% { opacity: 0; }
          25% { opacity: 0.3; }
          75% { opacity: 0; }
          100% { opacity: 0; }
        }
        .lock-afterglow-animation {
          animation: lock-afterglow-anim 350ms ease-out forwards;
        }

        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .cursor-blinker {
          animation: cursor-blink 1.06s step-end infinite;
        }

        @keyframes scanline-sweep {
          0% { transform: translateY(0) translateZ(0); }
          100% { transform: translateY(50vh) translateZ(0); }
        }

        @keyframes scale-bounce-keyframes {
          0% { transform: scaleY(1); }
          50% { transform: scaleY(1.002); }
          100% { transform: scaleY(1); }
        }
        .scale-bounce-active {
          animation: scale-bounce-keyframes 100ms ease-out forwards;
        }

        @keyframes shake-weak {
          0% { transform: translateX(0) translateZ(0); }
          20% { transform: translateX(-2px) translateZ(0); }
          40% { transform: translateX(2px) translateZ(0); }
          60% { transform: translateX(-2px) translateZ(0); }
          80% { transform: translateX(2px) translateZ(0); }
          100% { transform: translateX(0) translateZ(0); }
        }
        .shake-weak-active {
          animation: shake-weak 200ms ease-in-out forwards;
        }

        @keyframes shake-strong {
          0% { transform: translateX(0) translateZ(0); }
          15% { transform: translateX(-3px) translateZ(0); }
          30% { transform: translateX(3px) translateZ(0); }
          45% { transform: translateX(-3px) translateZ(0); }
          60% { transform: translateX(3px) translateZ(0); }
          75% { transform: translateX(-2px) translateZ(0); }
          90% { transform: translateX(2px) translateZ(0); }
          100% { transform: translateX(0) translateZ(0); }
        }
        .shake-strong-active {
          animation: shake-strong 200ms ease-in-out forwards;
        }

        @keyframes lock-gentle-pulse {
          0% { transform: scale(0.97) translateZ(0); }
          100% { transform: scale(1.03) translateZ(0); }
        }
        .lock-pulsing {
          animation: lock-gentle-pulse 2s ease-in-out infinite alternate;
        }

        @keyframes lock-release-pulse {
          0% { transform: scale(1) translateZ(0); }
          50% { transform: scale(1.15) translateZ(0); }
          100% { transform: scale(1) translateZ(0); }
        }
        .lock-releasing {
          animation: lock-release-pulse 100ms cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        @keyframes light-sweep-keyframes {
          0% { transform: translateX(-100%) translateZ(0); }
          100% { transform: translateX(100%) translateZ(0); }
        }
        .light-sweep-active {
          animation: light-sweep-keyframes 300ms linear forwards;
        }

        @keyframes lock-rotate-clockwise {
          0% { transform: rotate(0deg) translateZ(0); }
          100% { transform: rotate(360deg) translateZ(0); }
        }
        .lock-rotate-slow {
          animation: lock-rotate-clockwise 8s linear infinite;
        }

        @keyframes lock-rotate-counter-clockwise {
          0% { transform: rotate(360deg) translateZ(0); }
          100% { transform: rotate(0deg) translateZ(0); }
        }
        .lock-rotate-counter-slow {
          animation: lock-rotate-counter-clockwise 12s linear infinite;
        }

        @keyframes lock-orbit-counter-clockwise {
          0% { transform: rotate(360deg) translateZ(0); }
          100% { transform: rotate(0deg) translateZ(0); }
        }
        .lock-orbit-active {
          animation: lock-orbit-counter-clockwise 10s linear infinite;
        }
      `}</style>

      {/* Cinematic Full-Screen Stage Overlay */}
      <div
        id="entry-animation-overlay"
        className={`fixed inset-0 w-full h-full z-[99999] bg-[#000000] overflow-hidden select-none pointer-events-none ${
          phase === "sliding-out" ? "transition-opacity duration-[1300ms] lg:duration-[1600ms] opacity-0" : "opacity-100"
        } ${getOverlayClass()}`}
      >
        {/* TOP HALF OF THE DOOR */}
        <div
          id="door-half-top"
          className="absolute top-0 left-0 w-full h-[50vh] overflow-hidden will-change-transform z-20"
          style={{
            transform: topTransform,
            transition: getDoorTransition(),
          }}
        >
          <div
            className={`w-full h-full relative ${scaleBounce ? "scale-bounce-active" : ""}`}
            style={{
              background: "#050505",
            }}
          >
            {/* Edge details / Diagonal accents (static, sparse, elegant) */}
            <div
              className="absolute bg-[#FF00FF] h-[1px] rotate-[35deg] origin-center opacity-25"
              style={{ width: "60px", top: "30%", left: "12%", transform: "rotate(35deg) translateZ(0)" }}
            />
            <div
              className="absolute bg-[#FF00FF] h-[1px] rotate-[-35deg] origin-center opacity-25"
              style={{ width: "45px", top: "45%", left: "78%", transform: "rotate(-35deg) translateZ(0)" }}
            />
            <div
              className="absolute bg-[#FF00FF] h-[1px] rotate-[20deg] origin-center opacity-20"
              style={{ width: "50px", top: "20%", left: "68%", transform: "rotate(20deg) translateZ(0)" }}
            />

            {/* Pre-rendered edge glow line */}
            <div
              className="absolute bottom-0 left-0 w-full h-[2px] bg-[#00FFFF]"
              style={{
                boxShadow: "0 0 12px #00FFFF, 0 0 4px #00FFFF",
                transform: "translateZ(0)",
              }}
            />
            {/* Flash overlay for edge glow */}
            <div
              className="absolute bottom-0 left-0 w-full h-[2px] bg-[#FFFFFF] transition-opacity duration-100"
              style={{
                boxShadow: "0 0 24px #00FFFF, 0 0 8px #00FFFF",
                opacity: edgeGlowBoost ? 1 : 0,
                transform: "translateZ(0)",
              }}
            />

            {/* Scanline Element */}
            <div
              className="absolute left-0 w-full h-[1px] bg-[#00FFFF] opacity-10 will-change-transform"
              style={{
                transform: "translateZ(0)",
                animation: "scanline-sweep 3s linear infinite",
                animationPlayState: ["sliding-in", "locked-pause", "release", "sliding-out"].includes(phase)
                  ? "running"
                  : "paused",
              }}
            />
          </div>
        </div>

        {/* BOTTOM HALF OF THE DOOR */}
        <div
          id="door-half-bottom"
          className="absolute bottom-0 left-0 w-full h-[50vh] overflow-hidden will-change-transform z-20"
          style={{
            transform: bottomTransform,
            transition: getDoorTransition(),
          }}
        >
          <div
            className={`w-full h-full relative ${scaleBounce ? "scale-bounce-active" : ""}`}
            style={{
              background: "#050505",
            }}
          >
            {/* Edge details / Diagonal accents */}
            <div
              className="absolute bg-[#FF00FF] h-[1px] rotate-[-35deg] origin-center opacity-25"
              style={{ width: "60px", bottom: "30%", left: "12%", transform: "rotate(-35deg) translateZ(0)" }}
            />
            <div
              className="absolute bg-[#FF00FF] h-[1px] rotate-[35deg] origin-center opacity-25"
              style={{ width: "45px", bottom: "45%", left: "78%", transform: "rotate(35deg) translateZ(0)" }}
            />
            <div
              className="absolute bg-[#FF00FF] h-[1px] rotate-[-20deg] origin-center opacity-20"
              style={{ width: "50px", bottom: "20%", left: "68%", transform: "rotate(-20deg) translateZ(0)" }}
            />

            {/* Pre-rendered edge glow line */}
            <div
              className="absolute top-0 left-0 w-full h-[2px] bg-[#00FFFF]"
              style={{
                boxShadow: "0 0 12px #00FFFF, 0 0 4px #00FFFF",
                transform: "translateZ(0)",
              }}
            />
            {/* Flash overlay for edge glow */}
            <div
              className="absolute top-0 left-0 w-full h-[2px] bg-[#FFFFFF] transition-opacity duration-100"
              style={{
                boxShadow: "0 0 24px #00FFFF, 0 0 8px #00FFFF",
                opacity: edgeGlowBoost ? 1 : 0,
                transform: "translateZ(0)",
              }}
            />

            {/* Scanline Element */}
            <div
              className="absolute left-0 w-full h-[1px] bg-[#00FFFF] opacity-10 will-change-transform"
              style={{
                transform: "translateZ(0)",
                animation: "scanline-sweep 3s linear infinite",
                animationPlayState: ["sliding-in", "locked-pause", "release", "sliding-out"].includes(phase)
                  ? "running"
                  : "paused",
              }}
            />
          </div>
        </div>

        {/* LIGHT BLEED SEAM FLARE */}
        {phase === "sliding-out" && (
          <div
            className="absolute left-0 w-full pointer-events-none z-10 flex items-center justify-center hidden lg:flex"
            style={{
              top: "50%",
              transform: "translateY(-50%) translateZ(0)",
              height: "100vh",
            }}
          >
            {/* Horizontal bright flare line */}
            <div
              className="absolute left-0 w-full h-[120px] bg-gradient-to-r from-transparent via-[#00FFFF] to-transparent"
              style={{
                filter: "blur(8px)",
                opacity: 0.9,
                animation: "overexpose-bloom-line 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards",
              }}
            />
            {/* Center intense circular/elliptical white-cyan overexposed bloom */}
            <div
              className="absolute rounded-full"
              style={{
                width: "500px",
                height: "500px",
                background: "radial-gradient(circle, #FFFFFF 0%, rgba(0, 255, 255, 0.8) 20%, rgba(255, 0, 255, 0.4) 50%, rgba(0, 0, 0, 0) 70%)",
                filter: "blur(20px)",
                opacity: 1,
                animation: "overexpose-bloom-circle 1.6s cubic-bezier(0.65, 0, 0.35, 1) forwards",
              }}
            />
          </div>
        )}

        {/* CENTER LOCK ELEMENT */}
        <div
          id="center-lock-element"
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center ${getLockClass()}`}
          style={getLockStyle()}
        >
          {/* Soft Outer Bloom/Haze */}
          <div
            className={`absolute rounded-full pointer-events-none transition-opacity duration-300 ${
              phase === "locked-pause" ? "bloom-pulsing" : ""
            }`}
            style={{
              width: "var(--vault-bloom-size)",
              height: "var(--vault-bloom-size)",
              background: "radial-gradient(circle, rgba(0, 255, 255, 0.4) 0%, rgba(255, 0, 255, 0.3) 60%, rgba(0, 0, 0, 0) 100%)",
              filter: "blur(40px)",
              opacity: phase === "release" ? 0.35 : phase === "locked-pause" ? undefined : 0.15,
              transform: "translateZ(0)",
              willChange: "opacity",
            }}
          />

          {/* Outer Ring */}
          <div
            className="absolute rounded-full border-2 border-dashed border-[#00FFFF] transition-opacity duration-100 lock-rotate-desktop-cw"
            style={{
              width: "var(--vault-outer-size)",
              height: "var(--vault-outer-size)",
              opacity: lockFlash ? 1 : 0.6,
              transform: "translateZ(0)",
            }}
          />
          {/* Chromatic Separation Outer Ring Duplicate (faint offset, desktop only) */}
          <div
            className="absolute rounded-full border-2 border-dashed border-[#FF00FF] transition-opacity duration-100 hidden lg:hidden"
            style={{
              width: "var(--vault-outer-size)",
              height: "var(--vault-outer-size)",
              opacity: lockFlash ? 0.4 : 0.18,
              transform: "translate(1.5px, 1.5px) translateZ(0)",
              willChange: "transform, opacity",
            }}
          />

          {/* Second Outer Ring (counter-rotating slowly with breathing scale on desktop) */}
          <div
            className="absolute rounded-full lock-rotate-counter-slow transition-opacity duration-100 lg:hidden"
            style={{
              width: "var(--vault-second-outer-size)",
              height: "var(--vault-second-outer-size)",
              opacity: lockFlash ? 0.8 : 0.4,
              transform: "translateZ(0)",
              willChange: "transform",
            }}
          >
            <div
              className="w-full h-full rounded-full border border-[#FF00FF] lock-scale-breathe-slow"
              style={{ transform: "translateZ(0)", willChange: "transform" }}
            />
          </div>

          {/* Middle Ring (rotating slowly with breathing scale on desktop) */}
          <div
            className="absolute rounded-full lock-rotate-slow transition-opacity duration-100 lg:hidden"
            style={{
              width: "var(--vault-middle-size)",
              height: "var(--vault-middle-size)",
              opacity: lockFlash ? 0.9 : 0.5,
              transform: "translateZ(0)",
              willChange: "transform",
            }}
          >
            <div
              className="w-full h-full rounded-full border border-[#FF00FF] lock-scale-breathe-fast"
              style={{ transform: "translateZ(0)", willChange: "transform" }}
            />
          </div>

          {/* Thin ring of 12 small diamond segments between middle and inner ring */}
          <div 
            className="absolute pointer-events-none lg:hidden"
            style={{
              width: "var(--vault-diamond-size)",
              height: "var(--vault-diamond-size)",
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-[3px] h-[3px] bg-[#FF00FF] opacity-[0.35] left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%, -50%) rotate(${i * 30}deg) translateY(var(--vault-diamond-translate)) rotate(45deg)`,
                }}
              />
            ))}
          </div>

          {/* Inner Ring */}
          <div
            className="absolute rounded-full border-2 border-[#00FFFF] lg:border-[#FF00FF] transition-opacity duration-100 lock-rotate-desktop-ccw"
            style={{
              width: "var(--vault-inner-size)",
              height: "var(--vault-inner-size)",
              opacity: lockFlash ? 1 : 0.75,
              transform: "translateZ(0)",
            }}
          />

          {/* Tick Marks around Inner Ring (16 ticks, alternating height/opacity) */}
          <div 
            className="absolute pointer-events-none lg:hidden"
            style={{
              width: "var(--vault-inner-size)",
              height: "var(--vault-inner-size)",
            }}
          >
            {Array.from({ length: 16 }).map((_, i) => {
              const isEven = i % 2 === 0;
              const tickHeight = isEven ? "6px" : "4px";
              const tickOpacity = isEven ? 0.5 : 0.3;
              return (
                <div
                  key={i}
                  className="absolute w-[1.5px] bg-[#00FFFF] left-1/2 top-1/2"
                  style={{
                    height: tickHeight,
                    opacity: tickOpacity,
                    transform: `translate(-50%, -50%) rotate(${i * 22.5}deg) translateY(var(--vault-tick-translate))`,
                  }}
                />
              );
            })}
          </div>

          {/* Static Center Core with radial-gradient fill & strong layered glow */}
          <div
            className="absolute rounded-full"
            style={{
              width: "var(--vault-core-size)",
              height: "var(--vault-core-size)",
              background: "radial-gradient(circle, #FFFFFF 0%, #00FFFF 40%, #FF00FF 100%)",
              boxShadow: "0 0 24px #00FFFF, 0 0 40px #FF00FF, 0 0 60px rgba(0, 255, 255, 0.3)",
              transform: "translateZ(0)",
            }}
          />
          {/* White-cyan center core flash */}
          <div
            className="absolute rounded-full bg-[#FFFFFF] transition-opacity duration-100"
            style={{
              width: "var(--vault-core-size)",
              height: "var(--vault-core-size)",
              boxShadow: "0 0 36px #FFFFFF, 0 0 18px #00FFFF",
              opacity: lockFlash ? 1 : 0,
              transform: "translateZ(0)",
            }}
          />

          {/* Orbiting Dots Wrapper */}
          <div
            className="absolute pointer-events-none lock-orbit-active lg:hidden"
            style={{ 
              width: "var(--vault-orbit-size)",
              height: "var(--vault-orbit-size)",
              transform: "translateZ(0)", 
              willChange: "transform" 
            }}
          >
            {Array.from({ length: 6 }).map((_, i) => {
              const isEven = i % 2 === 0;
              const dotSize = isEven ? "4px" : "2.5px";
              return (
                <div
                  key={i}
                  className="absolute rounded-full bg-[#FF00FF] left-1/2 top-1/2"
                  style={{
                    width: dotSize,
                    height: dotSize,
                    boxShadow: "0 0 8px #FF00FF",
                    transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(var(--vault-orbit-translate))`,
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* SEAM SWEEP LIGHT BEAM */}
        {seamSweepActive && (
          <div
            key={seamSweepKey}
            className="absolute left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00FFFF] to-transparent pointer-events-none z-30 light-sweep-active"
            style={{
              top: "50%",
              transform: "translateY(-50%) translateZ(0)",
              willChange: "transform",
            }}
          />
        )}

        {/* RADIAL GLOW BLEED THROUGH */}
        <div
          className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center transition-opacity"
          style={{
            opacity: radialGlowOpacity,
            transition: "opacity 400ms ease-in-out",
          }}
        >
          <div
            className="w-[500px] h-[500px] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(0, 255, 255, 0.4) 0%, rgba(0, 255, 255, 0) 70%)",
            }}
          />
        </div>

        {/* TYPING & CURSOR TEXT OVERLAY */}
        <div
          id="typing-text-overlay"
          className="absolute inset-0 flex items-center justify-center bg-black z-50 pointer-events-none transition-opacity duration-150"
          style={{
            opacity: isTextVisible ? 1 : 0,
          }}
        >
          <div className="text-center font-mono text-2xl sm:text-4xl font-black text-[#00FFFF] tracking-widest uppercase">
            {phase === "cursor" ? (
              <span className="text-[3rem] cursor-blinker">_</span>
            ) : (
              <>
                <span>{typedText}</span>
                <span className="cursor-blinker">_</span>
              </>
            )}
          </div>
        </div>

        {/* EXTREME WHITE FLASH */}
        <div
          className="absolute inset-0 bg-white pointer-events-none transition-opacity duration-75 z-40"
          style={{ opacity: whiteFlashActive ? 0.9 : 0 }}
        />

        {/* SOFT CYAN AFTERGLOW */}
        {phase === "release" && (
          <div
            className="absolute inset-0 bg-[#00FFFF] pointer-events-none z-40 lock-afterglow-animation"
            style={{
              transform: "translateZ(0)",
            }}
          />
        )}
      </div>
    </>
  );
}
