// src/app/trends/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTrendContext, Trend } from "@/context/TrendContext";

const mockTrends: Trend[] = [
  {
    state: "Emerging",
    stateClass: "text-trend-emerging",
    title: "Street POV micro-vlogs",
    summary: "Raw, handheld city footage with lo-fi sound and quick cuts.",
    format: "Short-form video",
    momentum: "↑ Fast",
  },
  {
    state: "Peaking",
    stateClass: "text-trend-peaking",
    title: "Day-in-the-life work content",
    summary: "Relatable behind-the-scenes content from real workflows.",
    format: "Short-form video / carousels",
    momentum: "↔ Steady",
  },
  {
    state: "Stable",
    stateClass: "text-trend-stable",
    title: "“What I ordered vs what I got”",
    summary: "Expectation vs reality remixable meme format.",
    format: "Mixed: video + stills",
    momentum: "↘ Soft",
  },
];

export default function TrendsPage() {
  const router = useRouter();
  const { setSelectedTrend } = useTrendContext();

  // When user clicks "Turn into brief", store trend and go to /briefs
  const handleTurnIntoBrief = (trend: Trend) => {
    setSelectedTrend(trend);
    router.push("/briefs");
  };

  // Optional: when jumping straight to scripts, we still keep the trend
  const handleJumpToScript = (trend: Trend) => {
    setSelectedTrend(trend);
    router.push("/scripts");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="text-sm text-neutral-400">
          Browse active cultural signals and pick one to turn into a brief or
          script.
        </p>
      </header>

      {/* Controls */}
      <section className="space-y-3 rounded-2xl border border-shell-border bg-shell-panel p-4 shadow-ring-soft">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search trends, formats, or keywords..."
              className="w-full rounded-pill border border-shell-border bg-black/40 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-brand-pink/60"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <button className="rounded-pill border border-shell-border bg-black/40 px-3 py-1 font-medium text-neutral-100 transition-all hover:border-brand-pink/50 hover:bg-black/70">
              All
            </button>
            <button className="rounded-pill border border-shell-border bg-black/20 px-3 py-1 font-medium text-trend-emerging transition-all hover:border-brand-pink/50 hover:bg-black/60">
              Emerging
            </button>
            <button className="rounded-pill border border-shell-border bg-black/20 px-3 py-1 font-medium text-trend-peaking transition-all hover:border-brand-pink/50 hover:bg-black/60">
              Peaking
            </button>
            <button className="rounded-pill border border-shell-border bg-black/20 px-3 py-1 font-medium text-trend-stable transition-all hover:border-brand-pink/50 hover:bg-black/60">
              Stable
            </button>
          </div>
        </div>
      </section>

      {/* Trend list */}
      <section className="space-y-3">
        {mockTrends.map((trend) => (
          <article
            key={trend.title}
            className="flex flex-col gap-3 rounded-2xl border border-shell-border bg-shell-panel px-4 py-4 text-xs shadow-ring-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/45 hover:shadow-brand-glow"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p
                  className={`text-[11px] font-medium uppercase tracking-[0.16em] ${trend.stateClass}`}
                >
                  {trend.state}
                </p>
                <h2 className="text-sm font-semibold text-neutral-50">
                  {trend.title}
                </h2>
                <p className="text-neutral-400">{trend.summary}</p>
              </div>
              <div className="text-right text-[11px] text-neutral-400">
                <div className="font-medium text-neutral-200">
                  {trend.format}
                </div>
                <div className="mt-1 text-xs text-emerald-300/80">
                  Momentum: {trend.momentum}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => handleTurnIntoBrief(trend)}
                className="rounded-pill bg-brand-pink px-3 py-1 font-semibold text-white shadow-brand-glow transition-all hover:-translate-y-0.5 hover:bg-brand-pink-soft"
              >
                Turn into brief
              </button>
              <button
                type="button"
                onClick={() => handleJumpToScript(trend)}
                className="rounded-pill border border-shell-border bg-black/40 px-3 py-1 font-medium text-neutral-100 transition-all hover:-translate-y-0.5 hover:border-brand-pink/45"
              >
                Jump straight to script
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
