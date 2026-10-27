import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Mail,
  HelpCircle,
  Search,
} from "lucide-react";
import { faqCategories, FaqItem, FaqCategory } from "../data/faq";

export { faqCategories };
export type { FaqItem, FaqCategory };

export interface FAQProps {
  onBack?: () => void;
  myDna?: string;
}

export function FAQ({ onBack, myDna }: FAQProps) {
  useEffect(() => {
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = "https://phantomchat.space/faq";
  }, []);

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<
    "all" | "terminal" | "inboxes" | "controls" | "pro" | "legal"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Category filtering
  const categoryFiltered =
    activeTab === "all"
      ? faqCategories
      : faqCategories.filter((cat) => cat.id === activeTab);

  // Search filtering
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredData = categoryFiltered
    .map((cat) => {
      if (!normalizedQuery) return cat;
      const matchedItems = cat.items.filter(
        (item) =>
          item.question.toLowerCase().includes(normalizedQuery) ||
          item.answer.toLowerCase().includes(normalizedQuery)
      );
      return {
        ...cat,
        items: matchedItems,
      };
    })
    .filter((cat) => cat.items.length > 0);

  const toggleItem = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const allIds: Record<string, boolean> = {};
    filteredData.forEach((cat) => {
      cat.items.forEach((item) => {
        allIds[item.id] = true;
      });
    });
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    const allIds: Record<string, boolean> = {};
    filteredData.forEach((cat) => {
      cat.items.forEach((item) => {
        allIds[item.id] = false;
      });
    });
    setExpandedIds(allIds);
  };

  const totalQuestions = faqCategories.reduce(
    (acc, cat) => acc + cat.items.length,
    0
  );
  const terminalCount =
    faqCategories.find((c) => c.id === "terminal")?.items.length || 7;
  const inboxesCount =
    faqCategories.find((c) => c.id === "inboxes")?.items.length || 6;
  const controlsCount =
    faqCategories.find((c) => c.id === "controls")?.items.length || 6;
  const proCount = faqCategories.find((c) => c.id === "pro")?.items.length || 4;
  const legalCount =
    faqCategories.find((c) => c.id === "legal")?.items.length || 8;

  return (
    <div
      className="flex flex-col h-full bg-transparent text-slate-200 overflow-y-auto font-sans w-full"
      id="faq-view"
    >
      {/* Header Bar */}
      <div className="sticky top-0 bg-[#0F121A]/95 backdrop-blur-md border-b border-slate-800 p-4 sm:p-5 z-20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
              title="Return to Previous Screen"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-base font-semibold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span>Frequently Asked Questions</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive guidance on Device IDs, Sync Browser pairing, terminal tools, privacy controls, and Pro Clearance.
            </p>
          </div>
        </div>

        {myDna && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-slate-400">
            <span>Device ID:</span>
            <span className="text-cyan-400 font-semibold">{myDna}</span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 flex-grow space-y-5 max-w-4xl w-full mx-auto">
        {/* Search & Topic Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                activeTab === "all"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              All Topics ({totalQuestions})
            </button>
            <button
              onClick={() => setActiveTab("terminal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                activeTab === "terminal"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Terminal & Setup ({terminalCount})
            </button>
            <button
              onClick={() => setActiveTab("inboxes")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                activeTab === "inboxes"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Inboxes & Lobbies ({inboxesCount})
            </button>
            <button
              onClick={() => setActiveTab("controls")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                activeTab === "controls"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              In-Room Controls ({controlsCount})
            </button>
            <button
              onClick={() => setActiveTab("pro")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                activeTab === "pro"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Pro Clearance ({proCount})
            </button>
            <button
              onClick={() => setActiveTab("legal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
                activeTab === "legal"
                  ? "bg-cyan-950/40 border-cyan-500 text-cyan-300 font-semibold"
                  : "bg-[#0F121A] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              Legal & Safety ({legalCount})
            </button>
          </div>

          {/* Quick toggle controls */}
          <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400 shrink-0">
            <button
              onClick={expandAll}
              className="text-slate-400 hover:text-cyan-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Expand all
            </button>
            <span>·</span>
            <button
              onClick={collapseAll}
              className="text-slate-400 hover:text-cyan-400 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Collapse all
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <label htmlFor="faq-search-input" className="sr-only">
            Search FAQ questions and answers
          </label>
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="faq-search-input"
            type="text"
            placeholder="Search questions or keywords (e.g. Sync Browser, stego, panic, inbox, device ID, clearance)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0F121A] border border-slate-800 focus:border-cyan-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs cursor-pointer"
              aria-label="Clear search query"
            >
              Clear
            </button>
          )}
        </div>

        {/* Accordion Categories & Items */}
        {filteredData.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0F121A] p-8 text-center text-slate-400 space-y-3">
            <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              No questions matched your search
            </p>
            <p className="text-xs text-slate-500">
              Try different search terms or select All Topics.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveTab("all");
              }}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer inline-block"
            >
              Clear Search & Reset View
            </button>
          </div>
        ) : (
          filteredData.map((category) => {
            const Icon = category.icon;
            return (
              <div key={category.id} className="space-y-3 pt-2">
                <div className="flex items-center gap-2 border-l-2 border-cyan-500 pl-3 py-0.5">
                  <Icon className="w-4 h-4 text-cyan-400 shrink-0" />
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {category.title}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {category.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {category.items.map((item) => {
                    const isExpanded = !!expandedIds[item.id];

                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-slate-800 bg-[#0F121A] overflow-hidden transition-all duration-150"
                      >
                        <button
                          type="button"
                          onClick={() => toggleItem(item.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`faq-answer-${item.id}`}
                          id={`faq-btn-${item.id}`}
                          className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-900/50 transition-colors cursor-pointer select-none"
                        >
                          <span className="font-medium text-slate-200 text-xs sm:text-sm pr-4">
                            {item.question}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 text-cyan-400" : ""
                            }`}
                          />
                        </button>

                        {isExpanded && (
                          <div
                            id={`faq-answer-${item.id}`}
                            role="region"
                            aria-labelledby={`faq-btn-${item.id}`}
                            className="px-4 pb-4 pt-3 border-t border-slate-800/80 bg-[#121622]/95 text-xs sm:text-sm text-slate-300 leading-relaxed"
                          >
                            <p className="text-cyan-300 font-mono mb-1 text-[11px] uppercase tracking-wider">
                              Answer:
                            </p>
                            <p>{item.answer}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}

        {/* Footer Support Contact */}
        <div className="p-6 bg-[#0F121A] border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3 text-center mt-8">
          <div>
            <h3 className="text-xs font-semibold text-white">
              Have a question not listed here?
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Feel free to reach out to our team via email for technical questions or bug reports.
            </p>
          </div>

          <a
            href="mailto:support@phantomchat.space"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
          >
            <Mail className="w-4 h-4 text-cyan-400" />
            <span>support@phantomchat.space</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export default FAQ;
