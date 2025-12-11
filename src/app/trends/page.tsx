"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullAnglesModal from "./FullAnglesModal";
import { useTrendContext } from "@/context/TrendContext";
import type {
  Trend as CoreTrend,
  TrendStatus as CoreTrendStatus,
} from "@/engine/trends";

/**
 * UI trend status used for styling/labels on this page.
 * We map backend statuses (Emerging/Peaking/Stable/…) into these.
 */
type TrendStatus = "emerging" | "peaking" | "stable" | "declining";

type UiTrend = {
  id: string;
  name: string;
  status: TrendStatus;
  movementLabel: string;
  description: string;
  category: string;
  exampleHook: string;
};

/**
 * API response shapes – works with:
 * - /api/trends/mock
 * - /api/signals/reddit?subreddits=...
 */
type ApiTrend = {
  id: string;
  status?: string;
  name: string;
  description: string;
  formatLabel?: string;
  momentumLabel?: string;
  category?: string;
};

type TrendsApiResponse = {
  source?: string;
  trends: ApiTrend[];
};

type TrendSourceId =
  | "mock-stage-1"
  | "reddit-entrepreneur"
  | "reddit-socialmedia-marketing";

const SOURCE_OPTIONS: {
  id: TrendSourceId;
  label: string;
  apiPath: string;
}[] = [
  {
    id: "mock-stage-1",
    label: "Internal test engine (Stage 1 mock)",
    apiPath: "/api/trends/mock",
  },
  {
    id: "reddit-entrepreneur",
    label: "Reddit: r/Entrepreneur only",
    apiPath: "/api/signals/reddit?subreddits=Entrepreneur",
  },
  {
    id: "reddit-socialmedia-marketing",
    label: "Reddit: r/socialmedia + r/marketing",
    apiPath: "/api/signals/reddit?subreddits=socialmedia,marketing",
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

function mapStatus(raw?: string): TrendStatus {
  const s = (raw || "").toLowerCase();
  if (s.includes("emerg")) return "emerging";
  if (s.includes("peak")) return "peaking";
  if (s.includes("declin")) return "declining";
  return "stable";
}

/**
 * Very lightweight example hook for now.
 * This will later come from the angles engine.
 */
function deriveExampleHook(api: ApiTrend): string {
  return `"${api.name}" but told as a first-person, creator-native story speaking directly to the audience.`;
}

function mapApiTrendToUiTrend(api: ApiTrend): UiTrend {
  const status = mapStatus(api.status);
  const category = api.category || api.formatLabel || "Uncategorised";
  const movementLabel = api.momentumLabel || "";

  return {
    id: api.id,
    name: api.name,
    status,
    movementLabel,
    description: api.description,
    category,
    exampleHook: deriveExampleHook(api),
  };
}

/**
 * Map UI trend → core Trend used by the engine/BriefContext.
 * This is what AngleCard expects via TrendContext.
 */
function mapUiStatusToCoreStatus(status: TrendStatus): CoreTrendStatus {
  switch (status) {
    case "emerging":
      return "Emerging";
    case "peaking":
      return "Peaking";
    // For now, treat stable/declining as Stable
    case "stable":
    case "declining":
    default:
      return "Stable";
  }
}

function mapUiTrendToCoreTrend(ui: UiTrend): CoreTrend {
  return {
    id: ui.id,
    status: mapUiStatusToCoreStatus(ui.status),
    name: ui.name,
    description: ui.description,
    formatLabel: ui.category,
    momentumLabel: ui.movementLabel,
    category: ui.category,
  };
}

export default function TrendsPage() {
  const router = useRouter();
  const { setSelectedTrend: setCoreSelectedTrend } = useTrendContext();

  // 🔹 Default to LIVE Reddit source for MVP
  const [sourceId, setSourceId] = useState<TrendSourceId>(
    "reddit-socialmedia-marketing"
  );
  const [trends, setTrends] = useState<UiTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTrend, setSelectedTrend] = useState<UiTrend | null>(null);

  // Fetch trends whenever the source changes
  useEffect(() => {
    let cancelled = false;

    async function fetchTrends() {
      setLoading(true);
      setError(null);

      const src = SOURCE_OPTIONS.find((s) => s.id === sourceId);

      if (!src) {
        console.error("[TrendsPage] Invalid sourceId:", sourceId);
        if (!cancelled) {
          setError("Invalid trend source selected.");
          setTrends([]);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(src.apiPath);
        if (!res.ok) {
          throw new Error(
            `Failed to fetch trends: ${res.status} ${res.statusText}`
          );
        }

        const data = (await res.json()) as TrendsApiResponse;
        const uiTrends = (data.trends || []).map(mapApiTrendToUiTrend);

        if (!cancelled) {
          setTrends(uiTrends);
        }
      } catch (err) {
        console.error("[TrendsPage] fetch error:", err);
        if (!cancelled) {
          setError("Unable to load trends from this source right now.");
          setTrends([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchTrends();

    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const openAngles = (trend: UiTrend) => {
    // 1) Tell the engine which *core* trend is active
    const coreTrend = mapUiTrendToCoreTrend(trend);
    setCoreSelectedTrend(coreTrend);

    // 2) Open the modal with the UI trend
    setSelectedTrend(trend);
  };

  const closeAngles = () => {
    setSelectedTrend(null);
  };

  const goToBriefsWithTrend = (trend: UiTrend) => {
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
            Appatize&apos;s cultural radar surface. This page runs on interpreted
            trends from our internal mock engine and live Reddit topics, using
            the same shape we&apos;ll plug future signals into.
          </p>
        </header>

        {/* Helper bar: step + source selector + back link */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-400">
          <p>
            Step 1 in the flow: pick a trend → turn it into a brief → generate
            scripts.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-500">Source:</span>
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

            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
            >
              Back to Cultural Radar
            </Link>
          </div>
        </div>

        {/* Loading / error states */}
        {loading && (
          <div className="rounded-2xl border border-shell-border bg-shell-panel/80 p-4 text-xs text-neutral-400">
            Loading trends…
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* Trends grid */}
        {!loading && !error && trends.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2">
            {trends.map((trend) => (
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
                      {trend.movementLabel && (
                        <p className="text-[11px] text-neutral-500">
                          {trend.movementLabel}
                        </p>
                      )}
                    </div>
                    <span className="rounded-pill bg-black/40 px-2 py-0.5 text-[10px] text-neutral-300">
                      {trend.category}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300">
                    {trend.description}
                  </p>

                  <p className="text-[11px] text-neutral-400">
                    Example hook:{" "}
                    <span className="text-neutral-200">
                      {trend.exampleHook}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-[11px] text-neutral-500">
                    Step into this trend with Appatize to generate creator-native
                    angles and scripts.
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
        )}

        {!loading && !error && trends.length === 0 && (
          <div className="rounded-2xl border border-shell-border bg-shell-panel/80 p-4 text-xs text-neutral-400">
            No trends available from this source right now.
          </div>
        )}
      </div>

      {/* Angles modal */}
      {selectedTrend && (
        <FullAnglesModal trend={selectedTrend} onClose={closeAngles} />
      )}
    </>
  );
}
