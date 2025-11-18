// src/app/briefs/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTrendContext } from "@/context/TrendContext";
import { useBriefContext } from "@/context/BriefContext";

// Mock fallback briefs (unchanged)
const mockBriefs = [
  {
    title: "Street POV micro-vlogs for urban fashion brand",
    trend: "Street POV micro-vlogs",
    objective: "Launch capsule collection with raw, city-centric storytelling.",
    status: "Draft",
  },
  {
    title: "Day-in-the-life content for SaaS founder",
    trend: "Day-in-the-life work content",
    objective:
      "Humanise the product by showing real workflows and routines.",
    status: "In review",
  },
  {
    title: "Expectation vs reality remix for food delivery",
    trend: "“What I ordered vs what I got”",
    objective: "Lean into memes to highlight reliability and quality.",
    status: "Approved",
  },
];

export default function BriefsPage() {
  const router = useRouter();
  const { selectedTrend } = useTrendContext();
  const { setSelectedBrief } = useBriefContext();
  const [loading, setLoading] = useState(false);

  /**
   * ------------------------------------------------------------------
   * 1. Generate Script from a Mock Brief (simple passthrough)
   * ------------------------------------------------------------------
   */
  const generateScriptFromBrief = (brief: any) => {
    setSelectedBrief({
      ...brief,
      fullBrief: brief,
    });
    router.push("/scripts");
  };

  /**
   * ------------------------------------------------------------------
   * 2. AI GENERATION: Create a REAL brief from a selectedTrend
   * ------------------------------------------------------------------
   */
  const generateScriptFromGeneratedTrendBrief = async () => {
    if (!selectedTrend) return;

    try {
      setLoading(true);

      // Step 1 — Call backend to generate a brief using AI
      const response = await fetch("/api/generateBrief", {
        method: "POST",
        body: JSON.stringify({ trend: selectedTrend }),
      });

      const aiBrief = await response.json();

      // Step 2 — Store AI-generated brief in context
      setSelectedBrief({
        title: aiBrief.title,
        trend: selectedTrend.title,
        objective: aiBrief.objective,
        insight: aiBrief.insight,
        creativeDirection: aiBrief.creativeDirection,
        hooks: aiBrief.hooks,
        cta: aiBrief.cta,
        deliverables: aiBrief.deliverables,
        status: "AI-generated",
        fullBrief: aiBrief, // for the script generator
      });

      // Step 3 — Navigate to script page
      router.push("/scripts");
    } catch (err) {
      console.error("Brief generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Briefs</h1>
        <p className="text-sm text-neutral-400">
          Turn trends into clear creative directions your team or clients can
          act on.
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Loading State for AI generation */}
      {/* ------------------------------------------------------------------ */}
      {loading && (
        <section className="rounded-2xl border border-brand-pink/60 bg-shell-panel p-4 text-xs shadow-brand-glow">
          <p className="text-neutral-200">Generating brief…</p>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* AI-generated brief card (from selected trend) */}
      {/* ------------------------------------------------------------------ */}
      {!loading && selectedTrend ? (
        <section className="space-y-3">
          <article className="rounded-2xl border border-brand-pink/60 bg-shell-panel p-4 text-xs shadow-brand-glow">
            <div className="flex flex-col gap-2 md:flex-row md:justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-trend-peaking">
                  Generated from trend
                </p>
                <h2 className="text-sm font-semibold text-neutral-50">
                  {selectedTrend.title}
                </h2>
                <p className="text-neutral-300">{selectedTrend.summary}</p>
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <button
                  onClick={generateScriptFromGeneratedTrendBrief}
                  className="rounded-pill bg-brand-pink px-3 py-1 font-semibold text-white shadow-brand-glow transition-all hover:-translate-y-0.5 hover:bg-brand-pink-soft"
                >
                  Generate script
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {/* Existing mock brief list */}
      {/* ------------------------------------------------------------------ */}
      <section className="space-y-3">
        {mockBriefs.map((brief) => (
          <article
            key={brief.title}
            className="rounded-2xl border border-shell-border bg-shell-panel p-4 text-xs shadow-ring-soft transition-all hover:-translate-y-0.5 hover:border-brand-pink/45 hover:shadow-brand-glow"
          >
            <div className="flex flex-col gap-2 md:flex-row md:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-neutral-50">
                  {brief.title}
                </h2>
                <p className="text-neutral-400">{brief.objective}</p>
              </div>
              <div className="flex flex-col items-start gap-2 md:items-end">
                <button
                  onClick={() => generateScriptFromBrief(brief)}
                  className="rounded-pill bg-brand-pink px-3 py-1 font-semibold text-white shadow-brand-glow transition-all hover:-translate-y-0.5 hover:bg-brand-pink-soft"
                >
                  Generate script
                </button>
                <button className="rounded-pill border border-shell-border bg-black/30 px-3 py-1 font-medium text-neutral-100 transition-all hover:-translate-y-0.5 hover:border-brand-pink/45">
                  Open brief
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
