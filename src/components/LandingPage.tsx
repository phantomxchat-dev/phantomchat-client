import React, { useState, useEffect, useRef } from "react";
import {
  Terminal,
  Clock,
  ShieldCheck,
  ArrowRight,
  Smartphone,
  Lock,
  Cpu,
  Flame,
  HelpCircle,
} from "lucide-react";
import { useSession } from "../context/SessionContext";
import { TextParticles } from "./TextParticles";

export interface LandingPageProps {
  onEnter: () => void;
  onNavigateToFaq?: () => void;
  onOpenSyncBrowser?: () => void;
  triggerPwaInstall?: () => void;
  isPwaInstalled?: boolean;
}

const DEMO_SCRIPT = [
  {
    sender: "Operator 1",
    text: "Are room records deleted after the countdown?",
    delay: 1200,
  },
  {
    sender: "Operator 2",
    text: "Yes. Once the timer reaches zero, the session closes and records are purged.",
    delay: 2000,
  },
  {
    sender: "Operator 1",
    text: "Got it. Fast and no signup needed.",
    delay: 1800,
  },
  {
    sender: "Operator 2",
    text: "Ready when you are.",
    delay: 1500,
  },
];

const FEATURE_CARDS = [
  {
    id: "sync-browser",
    icon: Smartphone,
    title: "Sync Browser",
    description:
      "Pair devices instantly across browsers with 6-digit codes—no accounts or tracking.",
  },
  {
    id: "in-memory-transit",
    icon: Cpu,
    title: "In-Memory Transit",
    description:
      "Chunked file transfers via WebSockets with zero persistent disk or database storage.",
  },
  {
    id: "self-destruct-rooms",
    icon: Flame,
    title: "Self-Destruct Rooms",
    description:
      "Volatile memory chat rooms automatically purged when the lifespan timer expires.",
  },
  {
    id: "zero-identity",
    icon: ShieldCheck,
    title: "Zero Identity",
    description:
      "No email, phone number, or persistent cookies required.",
  },
];

export function LandingPage({
  onEnter,
  onNavigateToFaq,
  onOpenSyncBrowser,
  triggerPwaInstall,
  isPwaInstalled,
}: LandingPageProps) {
  const { openPairingModal } = useSession();
  const [visibleMessages, setVisibleMessages] = useState<typeof DEMO_SCRIPT>([]);
  const [demoPhase, setDemoPhase] = useState<"playing" | "wiping" | "idle">(
    "playing"
  );
  const [demoCountdown, setDemoCountdown] = useState(15);
  const demoChatContainerRef = useRef<HTMLDivElement>(null);

  const handleSyncBrowserClick = () => {
    if (onOpenSyncBrowser) {
      onOpenSyncBrowser();
    } else {
      openPairingModal("host");
    }
  };

  const handleFaqNavigation = () => {
    if (onNavigateToFaq) {
      onNavigateToFaq();
    } else if (typeof window !== "undefined") {
      window.history.pushState({}, "", "/faq");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  // Auto-scroll demo message container to the bottom as each message arrives
  useEffect(() => {
    if (demoChatContainerRef.current) {
      demoChatContainerRef.current.scrollTop =
        demoChatContainerRef.current.scrollHeight;
    }
  }, [visibleMessages]);

  useEffect(() => {
    let isCancelled = false;
    let timeoutIds: ReturnType<typeof setTimeout>[] = [];

    function runLoop() {
      if (isCancelled) return;
      setVisibleMessages([]);
      setDemoPhase("playing");
      setDemoCountdown(15);

      let cumulativeDelay = 0;
      DEMO_SCRIPT.forEach((msg) => {
        cumulativeDelay += msg.delay;
        const id = setTimeout(() => {
          if (isCancelled) return;
          setVisibleMessages((prev) => [...prev, msg]);
        }, cumulativeDelay);
        timeoutIds.push(id);
      });

      const countdownInterval = setInterval(() => {
        if (isCancelled) return;
        setDemoCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const wipeId = setTimeout(() => {
        if (isCancelled) return;
        clearInterval(countdownInterval);
        setDemoPhase("wiping");
        const clearId = setTimeout(() => {
          if (isCancelled) return;
          setVisibleMessages([]);
          setDemoPhase("idle");
          const restartId = setTimeout(() => {
            if (isCancelled) return;
            runLoop();
          }, 2500);
          timeoutIds.push(restartId);
        }, 1200);
        timeoutIds.push(clearId);
      }, 15000);
      timeoutIds.push(wipeId);
    }

    runLoop();

    return () => {
      isCancelled = true;
      timeoutIds.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="w-full min-h-[100dvh] bg-transparent text-slate-100 font-sans overflow-y-auto selection:bg-cyan-500/20 selection:text-cyan-200 relative">
      {/* Top subtle accent line */}
      <div className="w-full h-[2px] top-0 fixed z-50 bg-cyan-500" />

      {/* STICKY TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-40 w-full glass-header">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo & Title */}
          <button
            type="button"
            onClick={onEnter}
            className="flex items-center gap-2.5 text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-lg"
          >
            <div className="w-9 h-9 rounded-lg bg-cyan-950/50 border border-cyan-800/50 flex items-center justify-center text-cyan-400 group-hover:border-cyan-400/60 transition-colors">
              <Terminal className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="font-mono font-bold text-sm sm:text-base tracking-wider text-white">
              PHANTOM CHAT
            </span>
          </button>

          {/* Navigation Actions */}
          <nav
            aria-label="Landing Navigation"
            className="flex items-center gap-2 sm:gap-4"
          >
            <button
              type="button"
              onClick={handleFaqNavigation}
              className="px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-300 hover:text-cyan-400 hover:underline underline-offset-4 transition-colors cursor-pointer"
            >
              /FAQ
            </button>

            <button
              type="button"
              onClick={handleSyncBrowserClick}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40 hover:border-cyan-400 text-cyan-300 text-xs font-mono font-medium transition-colors cursor-pointer"
              title="Open 6-digit Sync Browser modal"
            >
              <Smartphone className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Sync Browser</span>
            </button>

            <button
              type="button"
              onClick={onEnter}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-sm"
            >
              <span>Enter Terminal</span>
              <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 pb-28">
        {/* HERO SECTION */}
        <section className="flex flex-col items-center text-center mt-4 mb-20 sm:mb-24 max-w-3xl mx-auto">
          {/* Brand icon */}
          <div className="mb-5 flex justify-center text-cyan-400">
            <div className="w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center">
              <Terminal className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          {/* Unboxed Typographic Kicker */}
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-widest mb-4">
            <span>Instant · Anonymous</span>
            <span aria-hidden="true">·</span>
            <span>No Login Required</span>
          </div>

          <div className="relative max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 text-balance z-10 relative">
              Instant anonymous chat rooms that self-destruct.
            </h1>
            <TextParticles
              text="Instant anonymous chat rooms that self-destruct."
              color="#00b4d4"
            />
          </div>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mb-10 leading-relaxed font-normal">
            Phantom Chat is lightning-fast with no login, no account, and no signup.
            No phone number, no email, just anonymous rooms that vanish when the
            timer hits zero.
          </p>

          {/* Primary & Secondary Action Group */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md justify-center mb-6">
            <button
              id="enter-terminal-cta"
              onClick={onEnter}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-sm transition-all cursor-pointer shadow-lg shadow-cyan-950/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>Create Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onEnter}
              className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 font-medium text-sm transition-all cursor-pointer active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>Join with Code</span>
            </button>
          </div>

          {/* Optional PWA Install Path */}
          {!isPwaInstalled && triggerPwaInstall && (
            <button
              id="install-pwa-cta"
              onClick={triggerPwaInstall}
              className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors py-2 px-3 rounded-md hover:bg-slate-900/60 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Install as progressive web app for quick home screen access
              </span>
            </button>
          )}
        </section>

        {/* COMPACT PRODUCT PREVIEW */}
        <section
          id="hero-chat-demo"
          aria-label="Simulated Room Preview"
          className="mb-20 sm:mb-24 max-w-3xl mx-auto w-full"
        >
          <div className="rounded-xl border border-slate-800 glass-card-border overflow-hidden shadow-2xl">
            {/* Window Top Bar */}
            <div className="h-11 bg-transparent border-b border-slate-800 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                <span className="ml-2 text-xs font-mono text-slate-300">
                  SIMULATED EPHEMERAL CHAT
                </span>
                <span className="text-slate-600 hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-cyan-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Live Demo</span>
                </span>
              </div>
              <div className="text-xs font-mono text-cyan-400 font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Timer: 00:
                  {demoCountdown < 10 ? `0${demoCountdown}` : demoCountdown}
                </span>
              </div>
            </div>

            {/* Simulated Chat Feed */}
            <div className="p-4 sm:p-6 flex flex-col justify-between bg-transparent glass-card-border">
              <div
                ref={demoChatContainerRef}
                className="h-[300px] lg:h-[340px] overflow-y-hidden flex flex-col justify-end space-y-3.5"
              >
                {visibleMessages.map((msg, index) => {
                  const isFirst = msg.sender === "Operator 1";
                  return (
                    <div
                      key={index}
                      className={`flex ${
                        isFirst ? "justify-start" : "justify-end"
                      } transition-all duration-200`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 text-xs sm:text-sm leading-relaxed ${
                          isFirst
                            ? "bg-[#181D2B] text-slate-200 border border-slate-800"
                            : "bg-cyan-950/40 text-cyan-100 border border-cyan-800/40"
                        }`}
                      >
                        <div className="text-[11px] font-mono text-slate-400 mb-1">
                          {msg.sender}
                        </div>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Status / Wipe Ticker */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
                {demoPhase === "wiping" ? (
                  <span className="text-rose-400 font-medium">
                    Session ended · Purging active memory...
                  </span>
                ) : (
                  <span>Auto-destruct countdown active · Closes at 00:00</span>
                )}
                <span className="text-slate-500">2 participants</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4-CARD DARK TERMINAL FEATURE GRID */}
        <section
          aria-label="Core Terminal Architecture"
          className="mb-20 sm:mb-28 max-w-4xl mx-auto"
        >
          <div className="text-center mb-10">
            <p className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-widest mb-2">
              Core Architecture
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Engineered for volatile privacy
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURE_CARDS.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.id}
                  className="rounded-xl border border-slate-800/90 glass-card p-6 flex flex-col justify-between hover:border-cyan-500/40 transition-colors"
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 mb-4">
                      <Icon className="w-5 h-5 text-cyan-400" />
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3-STEP WORKFLOW SEQUENCE */}
        <section className="mb-20 sm:mb-28 max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xs font-mono font-semibold text-cyan-400 uppercase tracking-widest mb-2">
              Three-step workflow
            </h2>
            <p className="text-2xl sm:text-3xl font-bold text-white">
              How temporary chat works
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-xl border border-slate-800/90 glass-card p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-semibold mb-2 block">
                  01. Choose alias & lifespan
                </span>
                <h3 className="text-base font-semibold text-white mb-2">
                  Configure room parameters
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  Select a temporary alias and set your preferred self-destruct
                  timer. Complete the quick bot verification challenge to open
                  your room.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-slate-800/90 glass-card p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-semibold mb-2 block">
                  02. Exchange messages
                </span>
                <h3 className="text-base font-semibold text-white mb-2">
                  Real-time volatile transit
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  Share your 6-digit room code with your peer. Send real-time
                  text and chunked files over WebSocket connections without
                  registering an account.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-slate-800/90 glass-card p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-semibold mb-2 block">
                  03. Automatic expiration
                </span>
                <h3 className="text-base font-semibold text-white mb-2">
                  Zero-trace purge
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                  When the countdown expires, the room shuts down immediately.
                  Server memory references and room entries are cleared,
                  preventing message retrieval.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CONCISE DARK FAQ CTA CARD */}
        <section className="mb-16 max-w-3xl mx-auto">
          <div className="rounded-xl border border-slate-800 glass-card-border p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-cyan-950/40 border border-cyan-800/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-semibold text-white">
                  Have questions about our zero-log architecture?
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Explore how Device IDs, 6-digit Sync Browser pairing, and
                  in-memory rooms work.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleFaqNavigation}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-700 text-xs sm:text-sm font-mono font-semibold transition-colors cursor-pointer shrink-0"
            >
              <span>Read the Full FAQ -&gt;</span>
            </button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="text-center max-w-3xl mx-auto border-t border-slate-900 pt-8">
          <div className="flex items-center justify-center gap-2 mb-4 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5 text-cyan-400/80" />
            <span>Ephemeral messaging terminal · No account required</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 mb-4">
            <button
              type="button"
              onClick={handleFaqNavigation}
              className="hover:text-cyan-400 transition-colors underline underline-offset-4 cursor-pointer"
            >
              Frequently Asked Questions
            </button>
            <span className="text-slate-700" aria-hidden="true">
              ·
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <span>● All Services Nominal</span>
            </span>
          </div>

          <p className="text-[11px] text-slate-500 font-mono">
            © {new Date().getFullYear()} Phantom Chat. Built for ephemeral
            privacy.
          </p>
        </footer>
      </div>
    </div>
  );
}

export default LandingPage;
