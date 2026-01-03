// src/app/saved/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTrendContext } from "@/context/TrendContext";
import { useBriefContext, type Angle } from "@/context/BriefContext";
import type { Trend as CoreTrend, TrendStatus as CoreTrendStatus } from "@/context/BriefContext";

/**
 * SavedPage (Stage #8 — Save / pin moment)
 *
 * Deterministic behaviour:
 * - Uses TrendContext pinnedTrends (localStorage-backed).
 * - No network calls.
 * - Never-500: safe empty states.
 *
 * Stage #8 fix:
 * - "Turn into brief" MUST actually create a brief (via BriefContext)
 * - Then route to /scripts (where the active brief is consumed)
 *
 * No new intelligence, no LLM.
 */

function mapStatusToLabel(status?: CoreTrendStatus) {
  switch (status) {
    case "Emerging":
      return { label: "Emerging", className: "text-trend-emerging" };
    case "Peaking":
      return { label: "Peaking", className: "text-trend-peaking" };
    case "Stable":
    default:
      return { label: "Stable", className: "text-trend-stable" };
  }
}

export default function SavedPage() {
  const router = useRouter();

  const { pinnedTrends, unpinTrend, clearPinnedTrends, setSelectedTrend } = useTrendContext();
  const { generateBriefFromAngle } = useBriefContext();

  const turnIntoBrief = (trend: CoreTrend) => {
    // 1) Make this the globally selected trend (consistent with the rest of the app)
    setSelectedTrend(trend);

    // 2) Deterministic "Direct brief" angle (no AI, no guessing)
    const directAngle: Angle = {
      id: `direct:${trend.id}`,
      label: "Direct brief",
      hook: "Turn this trend into a clear, usable brief.",
      platform: "Multi",
      format: "Brief",
      audience: "",
      outcome: "",
      notes: "Auto-generated from a saved moment (Stage #8).",
    };

    // 3) Create the active brief in BriefContext
    generateBriefFromAngle(trend, directAngle);

    // 4) Go straight to Scripts (Briefs page is a library view, not the generator)
    router.push("/scripts");
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
        <p className="text-sm text-neutral-400">Your pinned moments (Stage #8). Local-first storage on this device.</p>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-neutral-400">
          Pinned: <span className="font-medium text-neutral-200">{pinnedTrends.length}</span>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/trends")}
            className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
          >
            Back to Trends
          </button>

          <button
            type="button"
            onClick={clearPinnedTrends}
            disabled={pinnedTrends.length === 0}
            className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40 disabled:opacity-40"
            title="Clear all saved moments (local-only)"
          >
            Clear saved
          </button>
        </div>
      </div>

      {/* Empty state */}
      {pinnedTrends.length === 0 && (
        <section className="rounded-2xl border border-shell-border bg-shell-panel p-6 text-xs text-neutral-300 shadow-ring-soft">
          <p className="text-neutral-400">No saved moments yet.</p>
          <p className="mt-2 text-neutral-500">
            Go to Trends and hit <span className="text-neutral-200">Pin ☆</span> on any moment you want to keep.
          </p>
        </section>
      )}

      {/* Saved list */}
      {pinnedTrends.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {pinnedTrends.map((t) => {
            const ui = mapStatusToLabel(t.status);

            return (
              <article
                key={t.id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-shell-border bg-shell-panel/90 p-4 shadow-ring-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-brand-glow/40"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className={`text-[11px] font-medium uppercase tracking-[0.16em] ${ui.className}`}>
                        {ui.label}
                      </p>
                      <h2 className="text-sm font-semibold text-neutral-50">{t.name}</h2>
                      {t.momentumLabel && <p className="text-[11px] text-neutral-500">{t.momentumLabel}</p>}
                    </div>

                    <span className="rounded-pill bg-black/40 px-2 py-0.5 text-[10px] text-neutral-300">
                      {t.category || t.formatLabel || "Uncategorised"}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300">{t.description}</p>

                  {/* Stage 3.9 (optional): show if present on stored trend object */}
                  {"actionHint" in t && typeof (t as any).actionHint === "string" && (t as any).actionHint.trim() && (
                    <p className="text-[11px] text-neutral-400">
                      <span className="text-neutral-500">Next:</span>{" "}
                      <span className="text-neutral-200">{(t as any).actionHint}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => unpinTrend(t.id)}
                    className="inline-flex items-center gap-1 rounded-pill border border-brand-pink/50 bg-brand-pink/15 px-3 py-1 text-[11px] font-medium text-brand-pink transition-colors hover:bg-brand-pink/20"
                    title="Unpin"
                  >
                    Saved <span aria-hidden>📌</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => turnIntoBrief(t)}
                    className="inline-flex items-center gap-1 rounded-pill bg-brand-pink px-3 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-brand-pink-soft"
                  >
                    Turn into brief <span className="text-xs">↗</span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
