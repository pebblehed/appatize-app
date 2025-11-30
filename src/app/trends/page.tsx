// src/app/trends/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullAnglesModal from "./FullAnglesModal";

type TrendStatus = "emerging" | "peaking" | "stable" | "declining";

type Trend = {
  id: string;
  name: string;
  status: TrendStatus;
  movementLabel: string;
  description: string;
  category: string;
  exampleHook: string;
};

const MOCK_TRENDS: Trend[] = [
  {
    id: "street-pov-micro-vlogs",
    name: "Street POV micro-vlogs",
    status: "emerging",
    movementLabel: "↑ +34% week-on-week",
    description:
      "Raw, handheld city POVs with minimal polish, often paired with storytime or inner monologue.",
    category: "Video format · TikTok / Reels",
    exampleHook: `"POV: You finally move to the city you've been dreaming about..."`,
  },
  {
    id: "work-day-in-the-life",
    name: "Day-in-the-life work content",
    status: "peaking",
    movementLabel: "↔ Holding strong",
    description:
      "Relatable behind-the-scenes workday content: creators show their real workflows, tools, and routines.",
    category: "Narrative format · Multi-platform",
    exampleHook: `"A realistic day in my life as a [role] (no fake 5am gym, I promise).”`,
  },
  {
    id: "expectation-vs-reality-memes",
    name: "Expectation vs reality memes",
    status: "stable",
    movementLabel: "▢ Evergreen cultural presence",
    description:
      "Highly remixable meme templates comparing fantasy vs reality in a punchy, visual way.",
    category: "Meme format · Multi-platform",
    exampleHook: `"Expectation: launching the perfect product. Reality: fixing bugs at 2am."`,
  },
];

function statusClass(status: TrendStatus) {
  switch (status) {
    case "emerging":
      return "text-trend-emerging";
    case "peaking":
      return "text-trend-peaking";
    case "stable":
      return "text-trend-stable";
    case "declining":
      return "text-trend-declining";
    default:
      return "text-neutral-400";
  }
}

function statusLabel(status: TrendStatus) {
  switch (status) {
    case "emerging":
      return "Emerging";
    case "peaking":
      return "Peaking";
    case "stable":
      return "Stable";
    case "declining":
      return "Declining";
  }
}

export default function TrendsPage() {
  const router = useRouter();
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

  const openAngles = (trend: Trend) => {
    setSelectedTrend(trend);
  };

  const closeAngles = () => {
    setSelectedTrend(null);
  };

  const goToBriefsWithTrend = (trend: Trend) => {
    // MVP behaviour: just pass the trend name via query.
    // Later, we’ll wire this into BriefContext + real brief creation.
    const params = new URLSearchParams({ trend: trend.name });
    router.push(`/briefs?${params.toString()}`);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
          <p className="text-sm text-neutral-400">
            Appatize&apos;s cultural radar. In the MVP, this is curated mock
            data that shows how the live system will feel.
          </p>
        </header>

        {/* Helper bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
          <p>
            Step 1 in the flow: pick a trend → turn it into a brief → generate
            scripts.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
          >
            Back to Cultural Radar
          </Link>
        </div>

        {/* Trends grid */}
        <section className="grid gap-4 md:grid-cols-2">
          {MOCK_TRENDS.map((trend) => (
            <article
              key={trend.id}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-shell-border bg-shell-panel/90 p-4 shadow-ring-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-brand-glow/40"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p
                      className={`mb-1 text-[11px] font-medium uppercase tracking-[0.16em] ${statusClass(
                        trend.status
                      )}`}
                    >
                      {statusLabel(trend.status)}
                    </p>
                    <h2 className="text-sm font-semibold text-neutral-50">
                      {trend.name}
                    </h2>
                    <p className="text-[11px] text-neutral-500">
                      {trend.movementLabel}
                    </p>
                  </div>
                  <span className="rounded-pill bg-black/40 px-2 py-0.5 text-[10px] text-neutral-300">
                    {trend.category}
                  </span>
                </div>

                <p className="text-xs text-neutral-300">{trend.description}</p>

                <p className="text-[11px] text-neutral-400">
                  Example hook:{" "}
                  <span className="text-neutral-200">{trend.exampleHook}</span>
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="text-[11px] text-neutral-500">
                  Step into this trend with Appatize to generate
                  creator-native angles and scripts.
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openAngles(trend)}
                    className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
                  >
                    View angles
                  </button>
                  <button
                    type="button"
                    onClick={() => goToBriefsWithTrend(trend)}
                    className="inline-flex items-center gap-1 rounded-pill bg-brand-pink px-3 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-brand-pink-soft"
                  >
                    Turn into brief
                    <span className="text-xs">↗</span>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      </div>

      {/* Angles modal */}
      {selectedTrend && (
        <FullAnglesModal trend={selectedTrend} onClose={closeAngles} />
      )}
    </>
  );
}
