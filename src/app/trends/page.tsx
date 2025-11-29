// src/app/trends/page.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AngleCard from "@/components/AngleCard";
import {
  useBriefContext,  
  type Trend,
  type Angle,
} from "@/context/BriefContext";
import { useTrendContext } from "@/context/TrendContext";

/**
 * Local mock trends for the MVP.
 * These now use the shared Trend type from BriefContext.
 */
const mockTrends: Trend[] = [
  {
    id: "street-pov",
    status: "Emerging",
    name: "Street POV micro-vlogs",
    description: "Raw, handheld city footage with lo-fi sound and quick cuts.",
    formatLabel: "Short-form video",
    momentumLabel: "Momentum: ↑ Fast",
    category: "Short-form",
  },
  {
    id: "day-in-the-life",
    status: "Peaking",
    name: "Day-in-the-life work content",
    description:
      "Behind-the-scenes relatable workflows and real-world routines.",
    formatLabel: "Mixed formats",
    momentumLabel: "Momentum: ↔ Steady",
    category: "Mixed",
  },
  {
    id: "expectation-vs-reality",
    status: "Stable",
    name: "Expectation vs reality memes",
    description:
      "Remixable format contrasting expectation vs reality in funny ways.",
    formatLabel: "Meme / Video",
    momentumLabel: "Momentum: ▢ Soft",
    category: "Meme",
  },
];

export default function TrendsPage() {
  const router = useRouter();

  const { setActiveBrief, briefs, setBriefs } = useBriefContext();
  const { selectedTrend, setSelectedTrend } = useTrendContext();

  const [angles, setAngles] = useState<Angle[]>([]);
  const [isLoadingAngles, setIsLoadingAngles] = useState(false);
  const [anglesError, setAnglesError] = useState<string | null>(null);

  /**
   * Call backend to generate angles for a given trend.
   */
  const fetchAnglesForTrend = async (trend: Trend) => {
    try {
      setIsLoadingAngles(true);
      setAnglesError(null);
      setAngles([]);

      const res = await fetch("/api/generateTrendAngles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trendTitle: trend.name,
          momentum: trend.status,
          format: trend.formatLabel,
          category: trend.category,
        }),
      });

      if (!res.ok) {
        throw new Error(`API responded with ${res.status}`);
      }

      const data = (await res.json()) as { angles?: Angle[] };
      setAngles(data.angles || []);
    } catch (error) {
      console.error("Failed to fetch angles:", error);
      setAnglesError("Could not generate angles. Try again in a moment.");
    } finally {
      setIsLoadingAngles(false);
    }
  };

  /**
   * Explore angles for a trend:
   * - write trend into global TrendContext
   * - call backend to generate angles
   */
  const handleExploreAngles = (trend: Trend) => {
    setSelectedTrend(trend);
    fetchAnglesForTrend(trend);
  };

  /**
   * Convert a trend into a basic brief and route to /briefs.
   * (Optional path, but useful for people who want to brief first.)
   */
  const handleTurnIntoBrief = (trend: Trend) => {
    const now = new Date().toISOString();

    const brief = {
      id: `trend-brief-${trend.id}-${Date.now()}`,
      title: trend.name,
      trend,
      status: "Draft" as const,
      summary: trend.description,
      coreMessage: "Turn this cultural signal into creator-native content.",
      objective: "Define the specific brand outcome in the Briefs view.",
      audienceHint: "TBD",
      platformHint: "Any",
      formatHint: trend.formatLabel,
      outcomeHint: "TBD",
      createdAt: now,
      updatedAt: now,
    };

    setActiveBrief(brief);
    setBriefs([...briefs, brief]);
    router.push("/briefs");
  };

  /**
   * Jump straight to Scripts from a trend without choosing an angle.
   */
  const handleJumpStraightToScript = (trend: Trend) => {
    const now = new Date().toISOString();

    const brief = {
      id: `trend-script-${trend.id}-${Date.now()}`,
      title: `${trend.name} • Direct-to-script`,
      trend,
      status: "Draft" as const,
      summary: trend.description,
      coreMessage: "Directly translate this trend into scripts.",
      objective: "Generate ready-to-film scripts from this cultural signal.",
      audienceHint: "TBD",
      platformHint: "Any",
      formatHint: trend.formatLabel,
      outcomeHint: "TBD",
      createdAt: now,
      updatedAt: now,
    };

    setActiveBrief(brief);
    setBriefs([...briefs, brief]);
    router.push("/scripts");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
        <p className="text-sm text-neutral-400 mt-1">
          Browse cultural signals and turn them into angles, briefs, and
          creator-native scripts.
        </p>
      </div>

      {/* Search + filters (static for now) */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search trends, formats, keywords..."
            className="w-full rounded-full bg-neutral-900/80 px-4 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 border border-neutral-800 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button className="rounded-full border border-neutral-700 bg-neutral-900/80 px-3 py-1 text-neutral-200">
            All
          </button>
          <button className="rounded-full border border-amber-500/70 bg-amber-500/10 px-3 py-1 text-amber-300">
            Emerging
          </button>
          <button className="rounded-full border border-emerald-500/60 bg-emerald-500/5 px-3 py-1 text-emerald-300">
            Peaking
          </button>
          <button className="rounded-full border border-sky-500/60 bg-sky-500/5 px-3 py-1 text-sky-300">
            Stable
          </button>
        </div>
      </div>

      {/* Trend cards */}
      <div className="space-y-4">
        {mockTrends.map((trend) => (
          <div
            key={trend.id}
            className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-900/60 to-neutral-950 p-5 flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold tracking-wide uppercase text-amber-300">
                  {trend.status}
                </span>
                <h2 className="text-base font-semibold text-neutral-100">
                  {trend.name}
                </h2>
                <p className="text-xs text-neutral-400">{trend.description}</p>
              </div>

              <div className="text-right space-y-1 text-xs">
                <p className="text-neutral-300">{trend.formatLabel}</p>
                <p className="text-emerald-300">{trend.momentumLabel}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExploreAngles(trend)}
                className="rounded-full border border-neutral-700 bg-neutral-900/90 px-3 py-1 text-[11px] font-medium text-neutral-100 hover:border-emerald-500 hover:text-emerald-200 transition-colors"
              >
                Explore angles
              </button>
              <button
                onClick={() => handleTurnIntoBrief(trend)}
                className="rounded-full bg-pink-500 px-3 py-1 text-[11px] font-semibold text-black hover:bg-pink-400 transition-colors"
              >
                Turn into brief
              </button>
              <button
                onClick={() => handleJumpStraightToScript(trend)}
                className="rounded-full bg-neutral-800 px-3 py-1 text-[11px] font-medium text-neutral-100 hover:bg-neutral-700 transition-colors"
              >
                Jump straight to script
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Angles panel for selected trend */}
      {selectedTrend && (
        <div className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Angles for:{" "}
                <span className="text-emerald-400">{selectedTrend.name}</span>
              </h2>
              <p className="text-[11px] text-neutral-400 mt-1">
                Pick an angle to turn this trend into an angle-powered brief and
                scripts.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedTrend(null);
                setAngles([]);
                setAnglesError(null);
              }}
              className="text-[11px] text-neutral-400 hover:text-neutral-200"
            >
              Close
            </button>
          </div>

          {/* Loading / error / angles states */}
          {isLoadingAngles && (
            <div className="text-[11px] text-neutral-400">
              Generating angles…
            </div>
          )}

          {anglesError && (
            <div className="text-[11px] text-rose-300">{anglesError}</div>
          )}

          {!isLoadingAngles && !anglesError && angles.length === 0 && (
            <div className="text-[11px] text-neutral-400">
              No angles available yet. Try generating again or pick another
              trend.
            </div>
          )}

          {angles.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {angles.map((angle) => (
                <AngleCard
                  key={angle.id}
                  angle={angle}
                  trendName={selectedTrend.name}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
