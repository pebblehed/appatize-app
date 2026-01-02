"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullAnglesModal from "./FullAnglesModal";
import { useTrendContext } from "@/context/TrendContext";
import type {
  Trend as CoreTrend,
  TrendStatus as CoreTrendStatus,
} from "@/context/BriefContext";

/**
 * TrendsPage (Stage 3.4)
 * - Adds read-only evidence surfacing (decision + deterministic evidence primitives)
 * - Adds safe tooltips via `title` attributes (no new deps)
 * - Keeps all existing flow intact (source select, lens, angles modal, turn into brief)
 */

/**
 * UI trend status used for styling/labels on this page.
 * We map backend statuses (Emerging/Peaking/Stable/…) into these.
 */
type TrendStatus = "emerging" | "peaking" | "stable" | "declining";

type Evidence = {
  signalCount: number;
  sourceCount: number;
  firstSeenAt?: string;
  lastConfirmedAt?: string;
  ageHours?: number;
  recencyMins?: number;
  velocityPerHour?: number;
};

type UiTrend = {
  id: string;
  name: string;
  status: TrendStatus;
  movementLabel: string;
  description: string;
  category: string;
  exampleHook: string;

  // Engagement debug (already used in your UI)
  debugScore?: number;
  debugVolume?: number;

  // Stage 3.4: evidence surfacing (optional)
  decisionState?: "ACT" | "WAIT" | "REFRESH";
  confidenceTrajectory?: "ACCELERATING" | "STABLE" | "WEAKENING" | "VOLATILE";
  signalStrength?: "WEAK" | "MODERATE" | "STRONG";
  decisionRationale?: string;
  evidence?: Evidence;
};

/**
 * API response shapes – works with:
 * - /api/trends/mock
 * - /api/signals/reddit?...
 */
type ApiTrend = {
  id: string;
  status?: string;
  name: string;
  description: string;
  formatLabel?: string;
  momentumLabel?: string;
  category?: string;

  // Engagement debug
  debugScore?: number;
  debugVolume?: number;

  // Stage 3.4 decision + evidence (optional)
  decisionState?: "ACT" | "WAIT" | "REFRESH";
  confidenceTrajectory?: "ACCELERATING" | "STABLE" | "WEAKENING" | "VOLATILE";
  signalStrength?: "WEAK" | "MODERATE" | "STRONG";
  decisionRationale?: string;
  evidence?: Evidence;
};

type TrendsApiResponse = {
  source?: string;
  trends: ApiTrend[];
};

type TrendSourceId =
  | "mock-stage-1"
  | "reddit-social"
  | "reddit-fragrance"
  | "reddit-beauty"
  | "reddit-fitness";

const SOURCE_OPTIONS: {
  id: TrendSourceId;
  label: string;
  apiPath: string;
}[] = [
  { id: "mock-stage-1", label: "Stage 1 mock engine", apiPath: "/api/trends/mock" },
  {
    id: "reddit-social",
    label: "Reddit: Social / Marketing",
    apiPath: "/api/signals/reddit?subs=socialmedia,marketing",
  },
  { id: "reddit-fragrance", label: "Reddit: Fragrance", apiPath: "/api/signals/reddit?pack=fragrance" },
  { id: "reddit-beauty", label: "Reddit: Beauty / Skincare", apiPath: "/api/signals/reddit?pack=beauty" },
  { id: "reddit-fitness", label: "Reddit: Fitness / Wellness", apiPath: "/api/signals/reddit?pack=fitness" },
];

/**
 * Strategy lens (DISCOVERY FILTER).
 * IMPORTANT:
 * - This must NOT change what a "moment" is; it only narrows what the user is viewing.
 * - No qualification / ranking / decision semantics happen here.
 */
type StrategyLensId =
  | "all"
  | "fragrance"
  | "beauty"
  | "fashion"
  | "fitness"
  | "food"
  | "travel"
  | "tech"
  | "finance"
  | "gaming"
  | "creator"
  | "b2b";

const STRATEGY_LENS_OPTIONS: { id: StrategyLensId; label: string }[] = [
  { id: "all", label: "All lenses" },
  { id: "fragrance", label: "Fragrance" },
  { id: "beauty", label: "Beauty / Skincare" },
  { id: "fashion", label: "Fashion" },
  { id: "fitness", label: "Fitness / Wellness" },
  { id: "food", label: "Food / Drink" },
  { id: "travel", label: "Travel" },
  { id: "tech", label: "Tech" },
  { id: "finance", label: "Finance" },
  { id: "gaming", label: "Gaming" },
  { id: "creator", label: "Creator / UGC" },
  { id: "b2b", label: "B2B / SaaS" },
];

const LENS_KEYWORDS: Record<StrategyLensId, string[]> = {
  all: [],
  fragrance: ["fragrance", "perfume", "parfum", "eau de", "scent", "cologne", "notes", "oud", "amber", "vanilla", "musk"],
  beauty: ["beauty", "skincare", "skin care", "makeup", "cosmetic", "foundation", "serum", "spf", "retinol", "acne", "glow"],
  fashion: ["fashion", "outfit", "style", "streetwear", "runway", "wardrobe", "clothing", "trend", "aesthetic"],
  fitness: ["fitness", "workout", "gym", "running", "strength", "protein", "wellness", "health", "sleep", "nutrition"],
  food: ["food", "drink", "recipe", "cooking", "restaurant", "coffee", "tea", "cocktail", "wine", "beer"],
  travel: ["travel", "trip", "holiday", "vacation", "city break", "hotel", "airbnb", "itinerary", "tour", "flight"],
  tech: ["tech", "ai", "app", "software", "device", "gadget", "startup", "open source", "product"],
  finance: ["finance", "invest", "stocks", "crypto", "bitcoin", "trading", "savings", "interest rates", "inflation"],
  gaming: ["gaming", "game", "xbox", "playstation", "nintendo", "steam", "esports", "streaming"],
  creator: ["creator", "ugc", "tiktok", "reels", "shorts", "content", "influencer", "editing", "storytelling", "vlog"],
  b2b: ["b2b", "saas", "enterprise", "sales", "marketing", "pipeline", "crm", "lead", "productivity", "teams"],
};

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

    // Engagement debug passthrough
    debugScore: api.debugScore,
    debugVolume: api.debugVolume,

    // Stage 3.4 passthrough (optional)
    decisionState: api.decisionState,
    confidenceTrajectory: api.confidenceTrajectory,
    signalStrength: api.signalStrength,
    decisionRationale: api.decisionRationale,
    evidence: api.evidence,
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

function normalize(s: string) {
  return (s || "").toLowerCase().trim();
}

function matchesStrategyLens(trend: UiTrend, lens: StrategyLensId) {
  if (lens === "all") return true;

  const haystack = normalize(`${trend.category} ${trend.name} ${trend.description}`);
  const keywords = LENS_KEYWORDS[lens] || [];
  if (keywords.some((k) => haystack.includes(normalize(k)))) return true;

  // Also allow direct category contains (in case category is "Work-life" etc later)
  const cat = normalize(trend.category);
  if (cat.includes(lens)) return true;

  return false;
}

function formatRecency(recencyMins?: number) {
  if (recencyMins == null) return "—";
  const mins = Math.round(recencyMins);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}

function formatAge(ageHours?: number) {
  if (ageHours == null) return "—";
  if (ageHours < 24) return `${ageHours.toFixed(1)}h`;
  const days = ageHours / 24;
  return `${days.toFixed(1)}d`;
}

function formatVelocity(v?: number) {
  if (v == null) return "—";
  // Keep stable + readable, avoid noisy decimals.
  const rounded = Math.round(v * 10) / 10;
  return `${rounded}/h`;
}

function tooltipForDecision(trend: UiTrend): string {
  // Stage 3.4 tooltips must be read-only and honest.
  const bits: string[] = [];

  if (trend.decisionState) bits.push(`Decision: ${trend.decisionState}`);
  if (trend.signalStrength) bits.push(`Strength: ${trend.signalStrength}`);
  if (trend.confidenceTrajectory) bits.push(`Trajectory: ${trend.confidenceTrajectory}`);

  const e = trend.evidence;
  if (e) {
    bits.push(`Density (signals): ${e.signalCount}`);
    bits.push(`Breadth (sources): ${e.sourceCount}`);
    if (e.recencyMins != null) bits.push(`Freshness: ${formatRecency(e.recencyMins)}`);
    if (e.ageHours != null) bits.push(`Age: ${formatAge(e.ageHours)}`);
    if (e.velocityPerHour != null) bits.push(`Velocity: ${formatVelocity(e.velocityPerHour)}`);
  }

  if (trend.decisionRationale) bits.push(`Rationale: ${trend.decisionRationale}`);

  return bits.length > 0 ? bits.join(" • ") : "No evidence available for this trend yet.";
}

export default function TrendsPage() {
  const router = useRouter();
  const { setSelectedTrend: setCoreSelectedTrend } = useTrendContext();

  const [sourceId, setSourceId] = useState<TrendSourceId>("mock-stage-1");
  const [strategyLens, setStrategyLens] = useState<StrategyLensId>("all");

  const [trends, setTrends] = useState<UiTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTrend, setSelectedTrend] = useState<UiTrend | null>(null);

  // Evidence panel expanded state (per trend id)
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

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
          setExpandedEvidenceId(null);
        }
        return;
      }

      try {
        const res = await fetch(src.apiPath);
        if (!res.ok) {
          throw new Error(`Failed to fetch trends: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as TrendsApiResponse;
        const uiTrends = (data.trends || []).map(mapApiTrendToUiTrend);

        if (!cancelled) {
          setTrends(uiTrends);
          setExpandedEvidenceId(null); // reset when source changes
        }
      } catch (err) {
        console.error("[TrendsPage] fetch error:", err);
        if (!cancelled) {
          setError("Unable to load trends from this source right now.");
          setTrends([]);
          setExpandedEvidenceId(null);
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

  const filteredTrends = useMemo(() => {
    return trends.filter((t) => matchesStrategyLens(t, strategyLens));
  }, [trends, strategyLens]);

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

  const toggleEvidence = (id: string) => {
    setExpandedEvidenceId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
          <p className="text-sm text-neutral-400">
            Appatize&apos;s cultural radar. Powered by interpreted trends from the mock engine
            and live Reddit topics, in the same shape we&apos;ll use for future signals.
          </p>
        </header>

        {/* Helper bar: step + selectors + back link */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-400">
          <p>Step 1 in the flow: pick a trend → turn it into a brief → generate scripts.</p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-500">Source:</span>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value as TrendSourceId)}
              className="rounded-pill border border-shell-border bg-black/40 px-3 py-1 text-[11px] text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-pink/60"
              title="Pick which signal source powers the Trends list."
            >
              {SOURCE_OPTIONS.map((src) => (
                <option key={src.id} value={src.id}>
                  {src.label}
                </option>
              ))}
            </select>

            <span className="ml-1 text-neutral-500">Strategy lens:</span>
            <select
              value={strategyLens}
              onChange={(e) => setStrategyLens(e.target.value as StrategyLensId)}
              className="rounded-pill border border-shell-border bg-black/40 px-3 py-1 text-[11px] text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-pink/60"
              title="Filters what you’re viewing — it does not change the moment."
            >
              {STRATEGY_LENS_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>

            <span className="text-[10px] text-neutral-600">
              Filters what you&apos;re viewing — it doesn&apos;t change the moment.
            </span>

            <Link
              href="/"
              className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
              title="Return to the main radar page."
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
        {!loading && !error && filteredTrends.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2">
            {filteredTrends.map((trend) => {
              const isEvidenceOpen = expandedEvidenceId === trend.id;
              const decisionTooltip = tooltipForDecision(trend);

              return (
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
                          title="Stage label derived from current scoring/heuristics (not a value judgment)."
                        >
                          {statusLabel(trend.status)}
                        </p>
                        <h2 className="text-sm font-semibold text-neutral-50">{trend.name}</h2>
                        {trend.movementLabel && (
                          <p className="text-[11px] text-neutral-500">{trend.movementLabel}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-pill bg-black/40 px-2 py-0.5 text-[10px] text-neutral-300"
                          title="Category is a viewing hint — not a change to the underlying moment."
                        >
                          {trend.category}
                        </span>

                        {/* Evidence toggle (Stage 3.4) */}
                        <button
                          type="button"
                          onClick={() => toggleEvidence(trend.id)}
                          className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-2 py-0.5 text-[10px] text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
                          title={decisionTooltip}
                        >
                          Evidence {isEvidenceOpen ? "▴" : "▾"}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-300">{trend.description}</p>

                    {(trend.debugScore != null || trend.debugVolume != null) && (
                      <p
                        className="text-[11px] text-neutral-500"
                        title="Debug engagement aggregates coming from signals (best-effort)."
                      >
                        Engagement: ups={trend.debugScore ?? "—"} • comments={trend.debugVolume ?? "—"}
                      </p>
                    )}

                    {/* Stage 3.4 Evidence Panel (read-only, optional) */}
                    {isEvidenceOpen && (
                      <div
                        className="rounded-xl border border-shell-border bg-black/20 p-3 text-[11px] text-neutral-300"
                        title="This panel is read-only. It surfaces deterministic evidence primitives and guardrailed decision labels."
                      >
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          <div title="ACT / WAIT / REFRESH (guardrailed; never ACT with WEAK or WEAKENING).">
                            <span className="text-neutral-500">Decision:</span>{" "}
                            <span className="text-neutral-100">{trend.decisionState ?? "—"}</span>
                          </div>

                          <div title="ACCELERATING / STABLE / WEAKENING / VOLATILE (timestamp + count heuristics).">
                            <span className="text-neutral-500">Trajectory:</span>{" "}
                            <span className="text-neutral-100">{trend.confidenceTrajectory ?? "—"}</span>
                          </div>

                          <div title="WEAK / MODERATE / STRONG (density + breadth + freshness heuristics).">
                            <span className="text-neutral-500">Strength:</span>{" "}
                            <span className="text-neutral-100">{trend.signalStrength ?? "—"}</span>
                          </div>

                          <div title="Signal count (density proxy).">
                            <span className="text-neutral-500">Density:</span>{" "}
                            <span className="text-neutral-100">{trend.evidence?.signalCount ?? "—"}</span>
                          </div>

                          <div title="Distinct sources (breadth proxy).">
                            <span className="text-neutral-500">Breadth:</span>{" "}
                            <span className="text-neutral-100">{trend.evidence?.sourceCount ?? "—"}</span>
                          </div>

                          <div title="How recently the moment was confirmed (derived from lastConfirmedAt).">
                            <span className="text-neutral-500">Freshness:</span>{" "}
                            <span className="text-neutral-100">{formatRecency(trend.evidence?.recencyMins)}</span>
                          </div>

                          <div title="How long the moment has been around (derived from firstSeenAt).">
                            <span className="text-neutral-500">Age:</span>{" "}
                            <span className="text-neutral-100">{formatAge(trend.evidence?.ageHours)}</span>
                          </div>

                          <div title="Velocity proxy (signals per hour; deterministic).">
                            <span className="text-neutral-500">Velocity:</span>{" "}
                            <span className="text-neutral-100">{formatVelocity(trend.evidence?.velocityPerHour)}</span>
                          </div>
                        </div>

                        {trend.decisionRationale && (
                          <p className="mt-2 text-neutral-400" title="Short explanation of why the decision label was chosen.">
                            <span className="text-neutral-500">Rationale:</span> {trend.decisionRationale}
                          </p>
                        )}
                      </div>
                    )}

                    <p className="text-[11px] text-neutral-400">
                      Example hook: <span className="text-neutral-200">{trend.exampleHook}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="text-[11px] text-neutral-500">
                      Step into this trend with Appatize to generate creator-native angles and scripts.
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openAngles(trend)}
                        className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-3 py-1 text-[11px] font-medium text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
                        title="Open angles for this trend (does not change the moment)."
                      >
                        View angles
                      </button>

                      <button
                        type="button"
                        onClick={() => goToBriefsWithTrend(trend)}
                        className="inline-flex items-center gap-1 rounded-pill bg-brand-pink px-3 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-brand-pink-soft"
                        title="Create a brief seeded with this trend."
                      >
                        Turn into brief <span className="text-xs">↗</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {!loading && !error && filteredTrends.length === 0 && (
          <div className="rounded-2xl border border-shell-border bg-shell-panel/80 p-4 text-xs text-neutral-400">
            No trends match this Strategy lens right now.
          </div>
        )}
      </div>

      {/* Angles modal */}
      {selectedTrend && <FullAnglesModal trend={selectedTrend} onClose={closeAngles} />}
    </>
  );
}
