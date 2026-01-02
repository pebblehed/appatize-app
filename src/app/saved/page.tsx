// src/app/saved/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTrendContext } from "@/context/TrendContext";
import type { Trend as CoreTrend, TrendStatus as CoreTrendStatus } from "@/context/BriefContext";

/**
 * SavedPage (Stage #8 — Save / pin moment)
 *
 * Deterministic behaviour:
 * - Pinned trends are stored as IDs in TrendContext (localStorage-backed).
 * - This page resolves IDs → latest known trend objects by fetching live packs.
 * - Never-500: safe empty states and error handling.
 *
 * No new intelligence, no LLM.
 */

type DecisionState = "ACT" | "WAIT" | "REFRESH";
type ConfidenceTrajectory = "ACCELERATING" | "STABLE" | "WEAKENING" | "VOLATILE";
type SignalStrength = "WEAK" | "MODERATE" | "STRONG";

type Evidence = {
  signalCount: number;
  sourceCount: number;
  firstSeenAt?: string;
  lastConfirmedAt?: string;
  ageHours?: number;
  recencyMins?: number;
  velocityPerHour?: number;
};

type ApiTrend = {
  id: string;
  status?: string;
  name: string;
  description: string;
  formatLabel?: string;
  momentumLabel?: string;
  category?: string;

  // Stage 3.8
  whyThisMatters?: string;

  // Stage 3.9
  actionHint?: string;

  // Engagement debug
  debugScore?: number;
  debugVolume?: number;

  // Decision + evidence
  decisionState?: DecisionState;
  confidenceTrajectory?: ConfidenceTrajectory;
  signalStrength?: SignalStrength;
  decisionRationale?: string;
  evidence?: Evidence;
};

type TrendsApiResponse = {
  source?: string;
  status?: string;
  trends: ApiTrend[];
};

type TrendSourceId =
  | "reddit-social"
  | "reddit-fragrance"
  | "reddit-beauty"
  | "reddit-fashion"
  | "reddit-fitness";

const SOURCE_OPTIONS: {
  id: TrendSourceId;
  label: string;
  apiPath: string;
}[] = [
  {
    id: "reddit-social",
    label: "Reddit: Social / Marketing",
    apiPath: "/api/trends/live?pack=social",
  },
  {
    id: "reddit-fragrance",
    label: "Reddit: Fragrance",
    apiPath: "/api/trends/live?pack=fragrance",
  },
  {
    id: "reddit-beauty",
    label: "Reddit: Beauty / Skincare",
    apiPath: "/api/trends/live?pack=beauty",
  },
  {
    id: "reddit-fashion",
    label: "Reddit: Fashion",
    apiPath: "/api/trends/live?pack=fashion",
  },
  {
    id: "reddit-fitness",
    label: "Reddit: Fitness / Wellness",
    apiPath: "/api/trends/live?pack=fitness",
  },
];

function mapUiStatusToCoreStatus(raw?: string): CoreTrendStatus {
  const s = (raw || "").toLowerCase();
  if (s.includes("emerg")) return "Emerging";
  if (s.includes("peak")) return "Peaking";
  return "Stable";
}

function mapApiTrendToCoreTrend(api: ApiTrend): CoreTrend {
  const category = api.category || api.formatLabel || "Uncategorised";
  const movement = api.momentumLabel || "";

  return {
    id: api.id,
    status: mapUiStatusToCoreStatus(api.status),
    name: api.name,
    description: api.description,
    formatLabel: category,
    momentumLabel: movement,
    category,
    // Stage 3.9 (optional)
    actionHint: api.actionHint,
  };
}

async function safeFetchTrends(url: string): Promise<ApiTrend[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as TrendsApiResponse;
    if (!data || !Array.isArray(data.trends)) return [];
    return data.trends;
  } catch {
    return [];
  }
}

export default function SavedPage() {
  const router = useRouter();
  const { pinnedIds, togglePin, clearPins, setSelectedTrend } = useTrendContext();

  const [sourceId, setSourceId] = useState<TrendSourceId>("reddit-fragrance");
  const [loading, setLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // id → resolved trend object (from fetched live packs)
  const [resolvedById, setResolvedById] = useState<Record<string, ApiTrend>>({});

  // Resolve pins using live packs. Deterministic: fetch current selected pack + optionally others for better hit-rate.
  useEffect(() => {
    let cancelled = false;

    async function resolvePinned() {
      setResolveError(null);

      if (!pinnedIds || pinnedIds.length === 0) {
        setResolvedById({});
        return;
      }

      setLoading(true);

      // Fetch the selected pack first, then the others in parallel.
      const primary = SOURCE_OPTIONS.find((s) => s.id === sourceId)?.apiPath;
      const others = SOURCE_OPTIONS.filter((s) => s.id !== sourceId).map((s) => s.apiPath);

      const urls = [primary, ...others].filter(Boolean) as string[];

      try {
        const results = await Promise.all(urls.map((u) => safeFetchTrends(u)));

        const merged: Record<string, ApiTrend> = {};
        for (const list of results) {
          for (const t of list) {
            if (t && typeof t.id === "string" && t.id.trim().length > 0) {
              // first win is fine; IDs are stable keys
              if (!merged[t.id]) merged[t.id] = t;
            }
          }
        }

        if (!cancelled) setResolvedById(merged);
      } catch {
        if (!cancelled) setResolveError("Unable to resolve saved moments right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    resolvePinned();

    return () => {
      cancelled = true;
    };
  }, [pinnedIds, sourceId]);

  const resolvedPinned = useMemo(() => {
    return pinnedIds
      .map((id) => ({ id, trend: resolvedById[id] || null }))
      .filter((x) => typeof x.id === "string" && x.id.trim().length > 0);
  }, [pinnedIds, resolvedById]);

  const openBriefs = (api: ApiTrend) => {
    const core = mapApiTrendToCoreTrend(api);
    setSelectedTrend(core);
    const params = new URLSearchParams({ trend: api.name });
    router.push(`/briefs?${params.toString()}`);
  };

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
        <p className="text-sm text-neutral-400">
          Your pinned moments (Stage #8). Deterministic recall — no AI, no guessing.
        </p>
      </header>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-neutral-400">
          <span className="text-neutral-500">Resolve from:</span>
          <select
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value as TrendSourceId)}
            className="rounded-pill border border-shell-border bg-black/40 px-3 py-1 text-[11px] text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-pink/60"
          >
            {SOURCE_OPTIONS.map((src) => (
              <option key={src.id} value={src.id}>
                {src.label}
              </option>
            ))}
          </select>

          {loading && <span className="text-[11px] text-neutral-500">Resolving…</span>}
          {resolveError && <span className="text-[11px] text-red-200">{resolveError}</span>}
        </div>

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
            onClick={clearPins}
            disabled={pinnedIds.length === 0}
            className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40 disabled:opacity-40"
            title="Clear all saved moments"
          >
            Clear saved
          </button>
        </div>
      </div>

      {/* Empty state */}
      {pinnedIds.length === 0 && (
        <section className="rounded-2xl border border-shell-border bg-shell-panel p-6 text-xs text-neutral-300 shadow-ring-soft">
          <p className="text-neutral-400">No saved moments yet.</p>
          <p className="mt-2 text-neutral-500">
            Go to Trends and hit <span className="text-neutral-200">Save 📌</span> on any moment you want to keep.
          </p>
        </section>
      )}

      {/* Saved list */}
      {pinnedIds.length > 0 && (
        <section className="grid gap-4 md:grid-cols-2">
          {resolvedPinned.map(({ id, trend }) => {
            const isResolved = !!trend;

            if (!isResolved) {
              return (
                <article
                  key={id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-shell-border bg-shell-panel/90 p-4 shadow-ring-soft"
                >
                  <div className="space-y-2">
                    <h2 className="text-sm font-semibold text-neutral-50">Saved moment</h2>
                    <p className="text-[11px] text-neutral-500">
                      ID: <span className="text-neutral-300">{id}</span>
                    </p>
                    <p className="text-xs text-neutral-400">
                      Not found in the current live packs. It may have fallen out of the live window.
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => togglePin(id)}
                      className="inline-flex items-center gap-1 rounded-pill border border-brand-pink/50 bg-brand-pink/15 px-3 py-1 text-[11px] font-medium text-brand-pink transition-colors hover:bg-brand-pink/20"
                      title="Unsave"
                    >
                      Saved <span aria-hidden>📌</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push("/trends")}
                      className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
                    >
                      Find again
                    </button>
                  </div>
                </article>
              );
            }

            const category = trend.category || trend.formatLabel || "Uncategorised";
            const momentum = trend.momentumLabel || "";
            const hint = typeof trend.actionHint === "string" ? trend.actionHint : null;

            return (
              <article
                key={id}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-shell-border bg-shell-panel/90 p-4 shadow-ring-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-brand-glow/40"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold text-neutral-50">{trend.name}</h2>
                      {momentum && <p className="text-[11px] text-neutral-500">{momentum}</p>}
                    </div>

                    <span className="rounded-pill bg-black/40 px-2 py-0.5 text-[10px] text-neutral-300">
                      {category}
                    </span>
                  </div>

                  {hint && hint.trim().length > 0 && (
                    <p className="text-[11px] text-neutral-400">
                      <span className="text-neutral-500">Next:</span>{" "}
                      <span className="text-neutral-200">{hint}</span>
                    </p>
                  )}

                  <p className="text-xs text-neutral-300">{trend.description}</p>

                  {trend.whyThisMatters && trend.whyThisMatters.trim().length > 0 && (
                    <p className="text-[11px] text-neutral-400">
                      <span className="text-neutral-500">Why this matters:</span>{" "}
                      <span className="text-neutral-200">{trend.whyThisMatters}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => togglePin(id)}
                    className="inline-flex items-center gap-1 rounded-pill border border-brand-pink/50 bg-brand-pink/15 px-3 py-1 text-[11px] font-medium text-brand-pink transition-colors hover:bg-brand-pink/20"
                    title="Unsave"
                  >
                    Saved <span aria-hidden>📌</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => openBriefs(trend)}
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
