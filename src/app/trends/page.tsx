// src/app/trends/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FullAnglesModal from "./FullAnglesModal";
import { useBriefContext } from "@/context/BriefContext";
import type { Angle } from "@/context/BriefContext";
import { useTrendContext } from "@/context/TrendContext";
import type { Trend as CoreTrend, TrendStatus as CoreTrendStatus } from "@/context/BriefContext";

/**
 * TrendsPage (Stage 3.5)
 * - Adds decision chips (Decision / Strength / Trajectory) for fast scanning
 * - Keeps Stage 3.4 evidence drawer + tooltips (read-only, deterministic)
 * - UI now uses LIVE trends only (no mock sources in the build path)
 *
 * Stage 3.8 (#6):
 * - Renders `whyThisMatters` (truth-only) if provided by /api/trends/live
 *
 * Stage 3.9 (#7):
 * - Receives + can carry `actionHint` (one short deterministic sentence)
 *
 * Stage #8:
 * - Save / pin moment (localStorage-backed) via TrendContext
 *
 * Stage #8 (flow fix):
 * - "Turn into brief" now CREATES a deterministic Draft brief (like Saved) before routing to /briefs
 */

/**
 * UI trend status used for styling/labels on this page.
 * We map backend statuses (Emerging/Peaking/Stable/…) into these.
 */
type TrendStatus = "emerging" | "peaking" | "stable" | "declining";

type DecisionState = "ACT" | "WAIT" | "REFRESH";

// ✅ Contract trajectory (stable label from /api/trends/live)
type Trajectory = "FLAT" | "RISING" | "SURGING";

// ✅ Strength: contract is WEAK/MEDIUM/STRONG, but tolerate MODERATE to avoid gaps
type SignalStrength = "WEAK" | "MEDIUM" | "MODERATE" | "STRONG";

/**
 * Evidence (UI) — stable primitives only (NO now-derived fields).
 * Mirrors what /api/trends/live returns.
 */
type Evidence = {
  // stable counts
  signalCount: number;
  sourceCount: number;

  // stable timestamps (ISO)
  firstSeenAt?: string;
  lastConfirmedAt?: string;

  // stable provenance details
  platform?: string; // e.g. "reddit"
  subreddit?: string;
  permalink?: string;
  url?: string;

  // additional stable counts
  platformSourceCount?: number;
  subredditCount?: number;

  // ✅ stable label
  trajectory?: Trajectory | string;
};

type UiTrend = {
  id: string;
  name: string;
  status: TrendStatus;
  movementLabel: string;
  description: string;
  category: string;
  exampleHook: string;

  // Stage 3.8: truth-only, deterministic explanation from API
  whyThisMatters?: string;

  // Stage 3.9: minimal deterministic UI hint from API
  actionHint?: string;

  // Engagement debug (already used in your UI)
  debugScore?: number;
  debugVolume?: number;

  // Stage 3.4+ decision + evidence (optional)
  decisionState?: DecisionState;
  signalStrength?: SignalStrength;
  decisionRationale?: string;
  evidence?: Evidence;

  // ✅ contract trajectory (root preferred; evidence fallback)
  trajectory?: Trajectory | string;
};

/**
 * API response shapes – works with:
 * - /api/trends/live?pack=... (preferred)
 */
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

  // Stage 3.4+ decision + evidence (optional)
  decisionState?: DecisionState;
  signalStrength?: SignalStrength;
  decisionRationale?: string;
  evidence?: Evidence;

  // ✅ /api/trends/live includes this at root
  trajectory?: Trajectory | string;
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
  { id: "reddit-fashion", label: "Reddit: Fashion", apiPath: "/api/trends/live?pack=fashion" },
  {
    id: "reddit-fitness",
    label: "Reddit: Fitness / Wellness",
    apiPath: "/api/trends/live?pack=fitness",
  },
];

/**
 * Category lens (DISCOVERY FILTER).
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
  fragrance: [
    "fragrance",
    "perfume",
    "parfum",
    "eau de",
    "scent",
    "cologne",
    "notes",
    "oud",
    "amber",
    "vanilla",
    "musk",
  ],
  beauty: [
    "beauty",
    "skincare",
    "skin care",
    "makeup",
    "cosmetic",
    "foundation",
    "serum",
    "spf",
    "retinol",
    "acne",
    "glow",
  ],
  fashion: [
    "fashion",
    "outfit",
    "style",
    "streetwear",
    "runway",
    "wardrobe",
    "clothing",
    "trend",
    "aesthetic",
  ],
  fitness: [
    "fitness",
    "workout",
    "gym",
    "running",
    "strength",
    "protein",
    "wellness",
    "health",
    "sleep",
    "nutrition",
  ],
  food: [
    "food",
    "drink",
    "recipe",
    "cooking",
    "restaurant",
    "coffee",
    "tea",
    "cocktail",
    "wine",
    "beer",
  ],
  travel: [
    "travel",
    "trip",
    "holiday",
    "vacation",
    "city break",
    "hotel",
    "airbnb",
    "itinerary",
    "tour",
    "flight",
  ],
  tech: ["tech", "ai", "app", "software", "device", "gadget", "startup", "open source", "product"],
  finance: [
    "finance",
    "invest",
    "stocks",
    "crypto",
    "bitcoin",
    "trading",
    "savings",
    "interest rates",
    "inflation",
  ],
  gaming: ["gaming", "game", "xbox", "playstation", "nintendo", "steam", "esports", "streaming"],
  creator: [
    "creator",
    "ugc",
    "tiktok",
    "reels",
    "shorts",
    "content",
    "influencer",
    "editing",
    "storytelling",
    "vlog",
  ],
  b2b: [
    "b2b",
    "saas",
    "enterprise",
    "sales",
    "marketing",
    "pipeline",
    "crm",
    "lead",
    "productivity",
    "teams",
  ],
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

function deriveUiTrajectory(api: ApiTrend): string {
  const root = typeof api.trajectory === "string" ? api.trajectory.trim() : "";
  if (root) return root;

  const ev = typeof api.evidence?.trajectory === "string" ? api.evidence.trajectory.trim() : "";
  if (ev) return ev;

  const m = typeof api.momentumLabel === "string" ? api.momentumLabel.trim() : "";
  if (m) return m;

  return "—";
}

function mapApiTrendToUiTrend(api: ApiTrend): UiTrend {
  const status = mapStatus(api.status);
  const category = api.category || api.formatLabel || "Uncategorised";
  const movementLabel = api.momentumLabel || "";
  const trajectory = deriveUiTrajectory(api);

  return {
    id: api.id,
    name: api.name,
    status,
    movementLabel,
    description: api.description,
    category,
    exampleHook: deriveExampleHook(api),

    whyThisMatters: api.whyThisMatters,
    actionHint: api.actionHint,

    debugScore: api.debugScore,
    debugVolume: api.debugVolume,

    decisionState: api.decisionState,
    signalStrength: api.signalStrength,
    decisionRationale: api.decisionRationale,
    evidence: api.evidence,

    trajectory,
  };
}

/**
 * Map UI trend → core Trend used by the engine/BriefContext.
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

type StopRule = {
  active: boolean;
  code: string;
  reason: string;
};

// Keep this locally without changing the upstream Trend type.
// Structural typing means it can still be passed to functions expecting CoreTrend.
type CoreTrendExtended = CoreTrend & {
  actionHint?: string;
  stopRule?: StopRule;
};

function mapUiTrendToCoreTrend(ui: UiTrend): CoreTrendExtended {
  return {
    id: ui.id,
    status: mapUiStatusToCoreStatus(ui.status),
    name: ui.name,
    description: ui.description,
    formatLabel: ui.category,
    momentumLabel: ui.movementLabel,
    category: ui.category,

    // Stage 3.9 (optional): carry through for downstream UI
    actionHint: ui.actionHint,

    // Stage 10 — Stop rule (deterministic; UI discipline)
    stopRule: {
      active: ui.decisionState !== "ACT",
      code: ui.decisionState === "ACT" ? "STOP_UNKNOWN" : "STOP_NOT_ACT",
      reason:
        ui.decisionState === "ACT"
          ? "No stop rule."
          : `Stop rule: decision is ${ui.decisionState ?? "—"} — do not act yet.`,
    },
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

  const cat = normalize(trend.category);
  if (cat.includes(lens)) return true;

  return false;
}

/**
 * Format ISO timestamp to UK format: dd/mm/yyyy, hh:mm:ss
 */
function formatUkDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");

  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
}

// ---------- Stage 3.5: Chips + clarity mapping (UI-only) ----------

function pillBaseClass() {
  return "inline-flex items-center rounded-pill border px-2 py-0.5 text-[10px] font-medium leading-none";
}

function chipClassForDecision(decision?: DecisionState) {
  switch (decision) {
    case "ACT":
      return `${pillBaseClass()} border-brand-pink/50 bg-brand-pink/15 text-brand-pink`;
    case "REFRESH":
      return `${pillBaseClass()} border-neutral-500/50 bg-black/20 text-neutral-200`;
    case "WAIT":
      return `${pillBaseClass()} border-neutral-600/50 bg-black/10 text-neutral-300`;
    default:
      return `${pillBaseClass()} border-shell-border bg-black/10 text-neutral-500`;
  }
}

function chipClassForStrength(strength?: SignalStrength) {
  switch (strength) {
    case "STRONG":
      return `${pillBaseClass()} border-brand-pink/50 bg-brand-pink/10 text-neutral-100`;
    case "MEDIUM":
    case "MODERATE":
      return `${pillBaseClass()} border-neutral-500/50 bg-black/15 text-neutral-200`;
    case "WEAK":
      return `${pillBaseClass()} border-neutral-700/50 bg-black/10 text-neutral-400`;
    default:
      return `${pillBaseClass()} border-shell-border bg-black/10 text-neutral-500`;
  }
}

function chipClassForTrajectory(traj?: string) {
  const t = (traj || "").toUpperCase();
  switch (t) {
    case "SURGING":
      return `${pillBaseClass()} border-brand-pink/40 bg-brand-pink/10 text-neutral-100`;
    case "RISING":
      return `${pillBaseClass()} border-neutral-500/50 bg-black/15 text-neutral-200`;
    case "FLAT":
      return `${pillBaseClass()} border-neutral-700/50 bg-black/10 text-neutral-400`;
    default:
      return `${pillBaseClass()} border-shell-border bg-black/10 text-neutral-500`;
  }
}

function decisionTooltip(t: UiTrend) {
  const d = t.decisionState ?? "—";
  const r = t.decisionRationale ? `\n\nRationale: ${t.decisionRationale}` : "";
  return `Decision (read-only): ${d}\nDerived deterministically from evidence primitives.${r}`;
}

function strengthTooltip(t: UiTrend) {
  const s = t.signalStrength ?? "—";
  return `Signal strength (read-only): ${s}\nDeterministic proxy using density + breadth + engagement.`;
}

function trajectoryTooltip(t: UiTrend) {
  const tr = t.trajectory ?? t.evidence?.trajectory ?? "—";
  return `Trajectory (read-only): ${tr}\nStable categorical label from the live signal feed (no time-now maths).`;
}

export default function TrendsPage() {
  const router = useRouter();

  // ✅ Brief creation (deterministic) for "Turn into brief"
  const { generateBriefFromAngle } = useBriefContext();

  // ✅ Stage #8 wiring: use TrendContext's canonical pin API
  const {
    setSelectedTrend: setCoreSelectedTrend,
    isTrendPinned,
    togglePinTrend,
  } = useTrendContext();

  // Live-only default (no mock option)
  const [sourceId, setSourceId] = useState<TrendSourceId>("reddit-fragrance");
  const [strategyLens, setStrategyLens] = useState<StrategyLensId>("all");

  const [trends, setTrends] = useState<UiTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedTrend, setSelectedTrend] = useState<UiTrend | null>(null);

  // Evidence panel expanded state (per trend id)
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);

  // ✅ Deterministic brief creation (same behaviour as Saved)
  const turnIntoBrief = (uiTrend: UiTrend) => {
    const coreTrend = mapUiTrendToCoreTrend(uiTrend);

    // 1) ensure global selection is set (keeps app consistent)
    setCoreSelectedTrend(coreTrend);

    // 2) deterministic "Direct brief" angle (no AI)
    const directAngle: Angle = {
      id: `direct:${coreTrend.id}`,
      label: "Direct brief",
      hook: "Turn this trend into a clear, usable brief.",
      platform: "Multi",
      format: "Brief",
      audience: "",
      outcome: "",
      notes: "Auto-generated from Trends (Stage #8).",
    };

    // 3) create brief
    generateBriefFromAngle(coreTrend, directAngle);

    // 4) route to briefs library
    const params = new URLSearchParams({ trend: coreTrend.name });
    router.push(`/briefs?${params.toString()}`);
  };

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
          throw new Error(`Failed to fetch trends: ${res.status} ${res.statusText}`);
        }

        const data = (await res.json()) as TrendsApiResponse;
        const uiTrends = (data.trends || []).map(mapApiTrendToUiTrend);

        if (!cancelled) {
          setTrends(uiTrends);
          setExpandedEvidenceId(null);
        }
      } catch (err) {
        console.error("[TrendsPage] fetch error:", err);
        if (!cancelled) {
          setError("Unable to load live trends right now.");
          setTrends([]);
          setExpandedEvidenceId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
    const coreTrend = mapUiTrendToCoreTrend(trend);
    setCoreSelectedTrend(coreTrend);
    setSelectedTrend(trend);
  };

  const closeAngles = () => setSelectedTrend(null);

  const toggleEvidence = (id: string) => {
    setExpandedEvidenceId((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Trends</h1>
          <p className="text-sm text-neutral-400">
            Appatize&apos;s cultural radar. Live signal-backed topics (Reddit for now), shaped into
            a stable Trend[] contract for briefs and script generation.
          </p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-neutral-400">
          <p>Step 1 in the flow: pick a trend → turn it into a brief → generate scripts.</p>

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

            <span className="ml-1 text-neutral-500">Category lens:</span>
            <select
              value={strategyLens}
              onChange={(e) => setStrategyLens(e.target.value as StrategyLensId)}
              className="rounded-pill border border-shell-border bg-black/40 px-3 py-1 text-[11px] text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-pink/60"
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
            >
              Back to Cultural Radar
            </Link>
          </div>
        </div>

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

        {!loading && !error && filteredTrends.length > 0 && (
          <section className="grid gap-4 md:grid-cols-2">
            {filteredTrends.map((trend) => {
              const isEvidenceOpen = expandedEvidenceId === trend.id;
              const saved = isTrendPinned(trend.id);

              const trajectory = trend.trajectory ?? trend.evidence?.trajectory ?? "—";

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
                        >
                          {statusLabel(trend.status)}
                        </p>
                        <h2 className="text-sm font-semibold text-neutral-50">{trend.name}</h2>
                        {trend.movementLabel && (
                          <p className="text-[11px] text-neutral-500">{trend.movementLabel}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-pill bg-black/40 px-2 py-0.5 text-[10px] text-neutral-300">
                          {trend.category}
                        </span>

                        <button
                          type="button"
                          onClick={() => togglePinTrend(mapUiTrendToCoreTrend(trend))}
                          className={`inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                            saved
                              ? "border-brand-pink/50 bg-brand-pink/15 text-brand-pink hover:bg-brand-pink/20"
                              : "border-shell-border bg-black/20 text-neutral-200 hover:border-brand-pink/40 hover:bg-black/40"
                          }`}
                          title={saved ? "Saved (click to unsave)" : "Save this moment"}
                        >
                          {saved ? "Saved" : "Save"} <span aria-hidden>📌</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleEvidence(trend.id)}
                          className="inline-flex items-center gap-1 rounded-pill border border-shell-border bg-black/20 px-2 py-0.5 text-[10px] text-neutral-200 transition-colors hover:border-brand-pink/40 hover:bg-black/40"
                          title="Show deterministic evidence (no AI guessing)"
                        >
                          Evidence {isEvidenceOpen ? "▴" : "▾"}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      <span
                        className={chipClassForDecision(trend.decisionState)}
                        title={decisionTooltip(trend)}
                      >
                        {trend.decisionState ?? "—"}
                      </span>

                      <span
                        className={chipClassForStrength(trend.signalStrength)}
                        title={strengthTooltip(trend)}
                      >
                        Strength: {trend.signalStrength ?? "—"}
                      </span>

                      <span
                        className={chipClassForTrajectory(trajectory)}
                        title={trajectoryTooltip(trend)}
                      >
                        Trajectory: {trajectory}
                      </span>
                    </div>

                    {trend.actionHint && trend.actionHint.trim().length > 0 && (
                      <p className="text-[11px] text-neutral-400">
                        <span className="text-neutral-500">Next:</span>{" "}
                        <span className="text-neutral-200">{trend.actionHint}</span>
                      </p>
                    )}

                    <p className="text-xs text-neutral-300">{trend.description}</p>

                    {trend.whyThisMatters && trend.whyThisMatters.trim().length > 0 && (
                      <p className="text-[11px] text-neutral-400">
                        <span className="text-neutral-500">Why this matters:</span>{" "}
                        <span className="text-neutral-200">{trend.whyThisMatters}</span>
                      </p>
                    )}

                    {(trend.debugScore != null || trend.debugVolume != null) && (
                      <p className="text-[11px] text-neutral-500">
                        Engagement: ups={trend.debugScore ?? "—"} • comments=
                        {trend.debugVolume ?? "—"}
                      </p>
                    )}

                    {isEvidenceOpen && (
                      <div className="rounded-xl border border-shell-border bg-black/20 p-3 text-[11px] text-neutral-300">
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                          <div>
                            <span className="text-neutral-500">Decision:</span>{" "}
                            <span className="text-neutral-100">{trend.decisionState ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Trajectory:</span>{" "}
                            <span className="text-neutral-100">{trajectory}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Strength:</span>{" "}
                            <span className="text-neutral-100">{trend.signalStrength ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Density:</span>{" "}
                            <span className="text-neutral-100">
                              {trend.evidence?.signalCount ?? "—"}
                            </span>
                          </div>
                          <div>
                            <span className="text-neutral-500">Breadth:</span>{" "}
                            <span className="text-neutral-100">
                              {trend.evidence?.sourceCount ?? "—"}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500">First seen:</span>{" "}
                            <span className="text-neutral-100">
                              {formatUkDateTime(trend.evidence?.firstSeenAt)}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500">Last confirmed:</span>{" "}
                            <span className="text-neutral-100">
                              {formatUkDateTime(trend.evidence?.lastConfirmedAt)}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500">Platform:</span>{" "}
                            <span className="text-neutral-100">
                              {trend.evidence?.platform ?? "—"}
                            </span>
                          </div>

                          <div>
                            <span className="text-neutral-500">Subreddit:</span>{" "}
                            <span className="text-neutral-100">
                              {trend.evidence?.subreddit ?? "—"}
                            </span>
                          </div>

                          <div className="w-full">
                            <span className="text-neutral-500">Link:</span>{" "}
                            {trend.evidence?.permalink ? (
                              <a
                                href={trend.evidence.permalink}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-pink hover:underline"
                              >
                                Open source ↗
                              </a>
                            ) : trend.evidence?.url ? (
                              <a
                                href={trend.evidence.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brand-pink hover:underline"
                              >
                                Open source ↗
                              </a>
                            ) : (
                              <span className="text-neutral-100">—</span>
                            )}
                          </div>
                        </div>

                        {trend.decisionRationale && (
                          <p className="mt-2 text-neutral-400">
                            <span className="text-neutral-500">Rationale:</span>{" "}
                            {trend.decisionRationale}
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
                      Step into this trend with Appatize to generate creator-native angles and
                      scripts.
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
                        onClick={() => turnIntoBrief(trend)}
                        className="inline-flex items-center gap-1 rounded-pill bg-brand-pink px-3 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-brand-pink-soft"
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

      {selectedTrend && (
        <FullAnglesModal trend={selectedTrend} onClose={() => setSelectedTrend(null)} />
      )}
    </>
  );
}
