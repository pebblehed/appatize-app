// src/app/api/trends/live/route.ts
//
// Live Trends API (deterministic, never-500, never-hang)
//
// Purpose:
// - Surface Trend[] for the UI from live signal sources.
// - Stage 3+ logic (decision surfacing etc.) may be embedded upstream.
//   This route only fills missing deterministic primitives needed by the UI.
//
// Current wiring (minimal):
// - Uses the existing Stage 2 Reddit endpoint as the live signal source:
//   GET /api/signals/reddit?pack=fragrance&limit=25
//
// Rules:
// - Never 500
// - Safe empty states
// - Do NOT fake intelligence: if upstream is unavailable, return [] with status=unavailable.
//
// IMPORTANT HOTFIX (loop prevention):
// - Do NOT return volatile "time-now" derived fields (ageHours, recencyMins, velocityPerHour).
//   Those change every request and can trigger client refetch loops.
// - Keep stable primitives only: counts + timestamps.
//
// CRITICAL HANG FIX:
// - Do NOT HTTP-fetch our own /api/signals/reddit route from within /api/trends/live.
//   In dev, this can hang. Instead call the route handler in-process.
// - Add a hard timeout so we never stall the server.
//
// ENTERPRISE AUDIT ADDITION (HCIS-aligned):
// - Every surfaced trend must carry a stable, auditable envelope:
//   - trendId (deterministic)
//   - contractVersion (stable)
//   - provenance (stable source + timestamps + links)
//   - audit (decision state + rationale + truth-guard notes)
//
// No scaffolding. No "we'll wire later" fields. Only stable primitives.

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { GET as redditGET } from "@/app/api/signals/reddit/route";

export const dynamic = "force-dynamic";

/**
 * LOCKED DATUM: This should only change when mainline contract-lock advances.
 * Must be stable (not derived from time-now).
 */
const CONTRACT_VERSION = "stage-3.9-contract-lock@ed08a88";

type Status = "ok" | "unavailable";

/** Shape we expect FROM the upstream /api/signals/reddit route (tolerant). */
type UpstreamTrendsResponse = {
  source?: string;
  mode?: string;

  // Stage 2 may omit status entirely.
  status?: Status;

  count?: number;
  trends?: unknown[];

  message?: string;
  telemetry?: unknown;
  debug?: unknown;
};

type EvidenceLike = {
  trajectoryLabel?: unknown;
  momentum?: unknown;
  signalCount?: unknown;
  sourceCount?: unknown;

  firstSeenAt?: unknown;
  lastConfirmedAt?: unknown;

  platformSourceCount?: unknown;
  subredditCount?: unknown;

  momentQualityScore?: unknown;

  // stable “direction” label (must NOT be derived from time-now here)
  trajectory?: unknown;

  // stable source details (for Evidence drawer)
  platform?: unknown;
  subreddit?: unknown;
  permalink?: unknown;
  url?: unknown;

  [k: string]: unknown;
};

type TrendLike = {
  evidence?: unknown;

  trajectoryLabel?: unknown;

  decisionState?: unknown;
  decisionRationale?: unknown;
  whyThisMatters?: unknown;
  actionHint?: unknown;
  signalStrength?: unknown;

  firstSeenAt?: unknown;
  lastConfirmedAt?: unknown;
  createdAt?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  lastSeenAt?: unknown;

  signalCount?: unknown;
  sourceCount?: unknown;
  debugSignalCount?: unknown;
  debugSourceCount?: unknown;

  // stable source fields commonly present on Stage 2 candidates
  source?: unknown;
  subreddit?: unknown;
  permalink?: unknown;
  url?: unknown;

  // sometimes upstream may put trajectory on the trend root
  trajectory?: unknown;

  // ✅ audit envelope additions (stable only)
  trendId?: string;
  contractVersion?: string;
  provenance?: {
    source: string;
    platform?: string;
    subreddit?: string;
    permalink?: string;
    url?: string;
    firstSeenAt?: string;
    lastConfirmedAt?: string;
    signalCount?: number;
    sourceCount?: number;
  };
  audit?: {
    decisionState?: string;
    decisionRationale?: string;
    multiSourceTruthGuard?: "PASS" | "DOWNGRADED_TO_WAIT";
  };

  [k: string]: unknown;
};

/** Shape we return FROM this /api/trends/live route (stable contract). */
type LiveApiResponse = {
  source: "live";
  status: Status;
  count: number;
  trends: TrendLike[];
  message?: string;
  debug?: unknown;
};

function parseLimit(raw: string | null, fallback: number) {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 50);
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v;
}

function toIntOrNull(v: unknown): number | null {
  const n = toNumberOrNull(v);
  if (n == null) return null;
  return Math.round(n);
}

function toISOIfValidDateString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function toStringOrUndef(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

/**
 * Deterministic ID based on stable evidence primitives (no time-now).
 * Purpose: auditability + de-dupe + continuity.
 */
function stableTrendId(input: {
  platform?: string;
  subreddit?: string;
  permalink?: string;
  url?: string;
  firstSeenAt?: string;
}) {
  const parts = [
    input.platform ?? "",
    input.subreddit ?? "",
    input.permalink ?? "",
    input.url ?? "",
    input.firstSeenAt ?? "",
  ];
  const raw = parts.join("|");
  return createHash("sha1").update(raw).digest("hex");
}

/**
 * Remove volatile fields that drift with "now".
 * Keep only stable primitives that the UI can safely use.
 */
function stripVolatileEvidence(e: EvidenceLike): EvidenceLike {
  if (!e || typeof e !== "object") return e;

  const stable: EvidenceLike = {};

  // stable counts
  if (typeof e.signalCount === "number") stable.signalCount = e.signalCount;
  if (typeof e.sourceCount === "number") stable.sourceCount = e.sourceCount;

  // stable timestamps (raw ISO)
  if (typeof e.firstSeenAt === "string") stable.firstSeenAt = e.firstSeenAt;
  if (typeof e.lastConfirmedAt === "string") stable.lastConfirmedAt = e.lastConfirmedAt;

  // keep other stable “counts” (non-time-derived)
  if (typeof e.platformSourceCount === "number") stable.platformSourceCount = e.platformSourceCount;
  if (typeof e.subredditCount === "number") stable.subredditCount = e.subredditCount;

  // quality score is stable within the upstream call; keep if present
  if (typeof e.momentQualityScore === "number") stable.momentQualityScore = e.momentQualityScore;

  // ✅ keep stable trajectory label if upstream provides it (string only)
  if (typeof e.trajectory === "string") stable.trajectory = e.trajectory;

  // preserve stable, non-time evidence fields (for Evidence drawer)
  if (typeof e.platform === "string") stable.platform = e.platform;
  if (typeof e.subreddit === "string") stable.subreddit = e.subreddit;
  if (typeof e.permalink === "string") stable.permalink = e.permalink;
  if (typeof e.url === "string") stable.url = e.url;

  return stable;
}

/**
 * Attach minimal evidence primitives to a Trend object if missing.
 * Also inject stable source details into evidence so the Evidence drawer has content.
 */
function ensureEvidence(trend: unknown): TrendLike {
  if (!trend || typeof trend !== "object") return trend as TrendLike;

  const t = trend as TrendLike;

  const existingEvidence =
    t.evidence && typeof t.evidence === "object" ? (t.evidence as EvidenceLike) : null;

  const firstSeenAtRaw =
    toISOIfValidDateString(existingEvidence?.firstSeenAt) ??
    toISOIfValidDateString(t.firstSeenAt) ??
    toISOIfValidDateString(t.createdAt) ??
    toISOIfValidDateString(t.publishedAt) ??
    undefined;

  const lastConfirmedAtRaw =
    toISOIfValidDateString(existingEvidence?.lastConfirmedAt) ??
    toISOIfValidDateString(t.lastConfirmedAt) ??
    toISOIfValidDateString(t.updatedAt) ??
    toISOIfValidDateString(t.lastSeenAt) ??
    firstSeenAtRaw;

  const signalCountUpstream =
    toIntOrNull(existingEvidence?.signalCount) ??
    toIntOrNull(t.signalCount) ??
    toIntOrNull(t.debugSignalCount) ??
    null;

  const sourceCountUpstream =
    toIntOrNull(existingEvidence?.sourceCount) ??
    toIntOrNull(t.sourceCount) ??
    toIntOrNull(t.debugSourceCount) ??
    null;

  // stable source details (prefer evidence if present, else trend fields)
  const platformRaw =
    toStringOrUndef(existingEvidence?.platform) ?? toStringOrUndef(t.source) ?? undefined;
  const subredditRaw =
    toStringOrUndef(existingEvidence?.subreddit) ?? toStringOrUndef(t.subreddit) ?? undefined;
  const permalinkRaw =
    toStringOrUndef(existingEvidence?.permalink) ?? toStringOrUndef(t.permalink) ?? undefined;
  const urlRaw = toStringOrUndef(existingEvidence?.url) ?? toStringOrUndef(t.url) ?? undefined;

  // ✅ stable trajectory label (only pass-through, never computed here)
  const trajectoryRaw =
    toStringOrUndef(existingEvidence?.trajectory) ?? toStringOrUndef(t.trajectory) ?? undefined;

  if (existingEvidence) {
    const merged: EvidenceLike = {
      ...existingEvidence,
      signalCount: signalCountUpstream ?? existingEvidence.signalCount ?? 1,
      sourceCount: sourceCountUpstream ?? existingEvidence.sourceCount ?? 1,
      firstSeenAt:
        (typeof existingEvidence.firstSeenAt === "string"
          ? existingEvidence.firstSeenAt
          : undefined) ?? firstSeenAtRaw,
      lastConfirmedAt:
        (typeof existingEvidence.lastConfirmedAt === "string"
          ? existingEvidence.lastConfirmedAt
          : undefined) ?? lastConfirmedAtRaw,

      // inject stable source details into evidence for UI rendering
      platform: platformRaw ?? existingEvidence.platform,
      subreddit: subredditRaw ?? existingEvidence.subreddit,
      permalink: permalinkRaw ?? existingEvidence.permalink,
      url: urlRaw ?? existingEvidence.url,

      // ✅ keep upstream trajectory if present
      trajectory: trajectoryRaw ?? existingEvidence.trajectory,

      // ✅ UI-compat aliases (same value, no new computation)
      trajectoryLabel: trajectoryRaw ?? existingEvidence.trajectory,
      momentum: trajectoryRaw ?? existingEvidence.trajectory,
    };

    return { ...t, evidence: stripVolatileEvidence(merged) };
  }

  const created: EvidenceLike = {
    signalCount: signalCountUpstream ?? 1,
    sourceCount: sourceCountUpstream ?? 1,
    firstSeenAt: firstSeenAtRaw,
    lastConfirmedAt: lastConfirmedAtRaw,

    // stable source details for Evidence drawer
    platform: platformRaw,
    subreddit: subredditRaw,
    permalink: permalinkRaw,
    url: urlRaw,

    // ✅ stable trajectory if upstream provided it
    trajectory: trajectoryRaw,
    trajectoryLabel: trajectoryRaw,
    momentum: trajectoryRaw,
  };

  return { ...t, evidence: stripVolatileEvidence(created) };
}

/**
 * Stage 3.x — Multi-source truth guard (deterministic)
 */
function enforceMultiSourceTruth(trend: TrendLike): TrendLike {
  if (!trend || typeof trend !== "object") return trend;

  const t = trend as TrendLike;

  const decisionState = typeof t.decisionState === "string" ? t.decisionState.toUpperCase() : null;

  if (decisionState !== "ACT") {
    // audit: guard not applied (only relevant when ACT)
    return {
      ...t,
      audit: {
        ...(typeof t.audit === "object" && t.audit ? (t.audit as TrendLike["audit"]) : {}),
        decisionState: typeof t.decisionState === "string" ? t.decisionState : undefined,
        decisionRationale:
          typeof t.decisionRationale === "string" ? t.decisionRationale : undefined,
        multiSourceTruthGuard: "PASS",
      },
    };
  }

  const evidence =
    t.evidence && typeof t.evidence === "object" ? (t.evidence as EvidenceLike) : null;

  const sourceCount =
    typeof evidence?.sourceCount === "number" && Number.isFinite(evidence.sourceCount)
      ? evidence.sourceCount
      : null;

  if (sourceCount == null || sourceCount < 2) {
    return {
      ...t,
      decisionState: "WAIT",
      decisionRationale:
        "Stop-rule: corroboration not yet proven (single-source live feed). Hold for multi-source confirmation before acting.",
      audit: {
        ...(typeof t.audit === "object" && t.audit ? (t.audit as TrendLike["audit"]) : {}),
        decisionState: "WAIT",
        decisionRationale:
          "Stop-rule: corroboration not yet proven (single-source live feed). Hold for multi-source confirmation before acting.",
        multiSourceTruthGuard: "DOWNGRADED_TO_WAIT",
      },
    };
  }

  return {
    ...t,
    audit: {
      ...(typeof t.audit === "object" && t.audit ? (t.audit as TrendLike["audit"]) : {}),
      decisionState: typeof t.decisionState === "string" ? t.decisionState : "ACT",
      decisionRationale: typeof t.decisionRationale === "string" ? t.decisionRationale : undefined,
      multiSourceTruthGuard: "PASS",
    },
  };
}

/**
 * Stage 3.8 — Deterministic "Why this matters" (no time-derived values)
 */
function ensureWhyThisMatters(trend: TrendLike): TrendLike {
  if (!trend || typeof trend !== "object") return trend;

  const t = trend as TrendLike;

  if (typeof t.whyThisMatters === "string" && t.whyThisMatters.trim().length > 0) {
    return t;
  }

  const evidence =
    t.evidence && typeof t.evidence === "object" ? (t.evidence as EvidenceLike) : null;

  const signalCount =
    typeof evidence?.signalCount === "number" && Number.isFinite(evidence.signalCount)
      ? evidence.signalCount
      : null;

  const sourceCount =
    typeof evidence?.sourceCount === "number" && Number.isFinite(evidence.sourceCount)
      ? evidence.sourceCount
      : null;

  const parts: string[] = [];

  if (signalCount != null && sourceCount != null) {
    parts.push(
      `${signalCount} signal${signalCount === 1 ? "" : "s"} from ${sourceCount} source${
        sourceCount === 1 ? "" : "s"
      }`
    );
  } else if (signalCount != null) {
    parts.push(`${signalCount} signal${signalCount === 1 ? "" : "s"}`);
  } else if (sourceCount != null) {
    parts.push(`${sourceCount} source${sourceCount === 1 ? "" : "s"}`);
  } else {
    parts.push("Evidence available");
  }

  const sentence1 = `${parts.join(" ")}.`;

  const decisionState = typeof t.decisionState === "string" ? t.decisionState.toUpperCase() : null;
  const signalStrength =
    typeof t.signalStrength === "string" ? t.signalStrength.toUpperCase() : null;

  let sentence2: string | null = null;

  if (decisionState === "ACT") sentence2 = "Enough evidence to responsibly move now.";
  else if (decisionState === "WAIT") {
    sentence2 =
      signalStrength === "WEAK"
        ? "Not enough density/breadth yet to act responsibly."
        : "Hold for confirmation before acting.";
  } else if (decisionState === "REFRESH") {
    sentence2 = "Not enough confirmed evidence yet — refresh for confirmation.";
  }

  return { ...t, whyThisMatters: sentence2 ? `${sentence1} ${sentence2}` : sentence1 };
}

/**
 * Stage 3.9 — Deterministic "Minimal action hint"
 */
function ensureActionHint(trend: TrendLike): TrendLike {
  if (!trend || typeof trend !== "object") return trend;

  const t = trend as TrendLike;

  if (typeof t.actionHint === "string" && t.actionHint.trim().length > 0) {
    return t;
  }

  const decisionState = typeof t.decisionState === "string" ? t.decisionState.toUpperCase() : null;

  let actionHint = "Track for another signal cycle.";
  if (decisionState === "ACT") actionHint = "Worth turning into a brief now.";
  if (decisionState === "REFRESH") actionHint = "Recheck shortly for movement.";

  return { ...t, actionHint };
}

/**
 * Add HCIS-aligned audit envelope (stable-only).
 * No time-now, no volatile values.
 */
function attachAuditEnvelope(trend: TrendLike, upstreamSourceLabel: string): TrendLike {
  const evidence =
    trend.evidence && typeof trend.evidence === "object" ? (trend.evidence as EvidenceLike) : null;

  const platform = toStringOrUndef(evidence?.platform) ?? toStringOrUndef(trend.source);
  const subreddit = toStringOrUndef(evidence?.subreddit) ?? toStringOrUndef(trend.subreddit);
  const permalink = toStringOrUndef(evidence?.permalink) ?? toStringOrUndef(trend.permalink);
  const url = toStringOrUndef(evidence?.url) ?? toStringOrUndef(trend.url);

  const firstSeenAt =
    toISOIfValidDateString(evidence?.firstSeenAt) ??
    toISOIfValidDateString(trend.firstSeenAt) ??
    undefined;

  const lastConfirmedAt =
    toISOIfValidDateString(evidence?.lastConfirmedAt) ??
    toISOIfValidDateString(trend.lastConfirmedAt) ??
    undefined;

  const signalCount =
    typeof evidence?.signalCount === "number" && Number.isFinite(evidence.signalCount)
      ? evidence.signalCount
      : undefined;

  const sourceCount =
    typeof evidence?.sourceCount === "number" && Number.isFinite(evidence.sourceCount)
      ? evidence.sourceCount
      : undefined;

  const trendId = stableTrendId({ platform, subreddit, permalink, url, firstSeenAt });

  const decisionState = typeof trend.decisionState === "string" ? trend.decisionState : undefined;
  const decisionRationale =
    typeof trend.decisionRationale === "string" ? trend.decisionRationale : undefined;

  return {
    ...trend,
    trendId,
    contractVersion: CONTRACT_VERSION,
    provenance: {
      source: upstreamSourceLabel,
      platform,
      subreddit,
      permalink,
      url,
      firstSeenAt,
      lastConfirmedAt,
      signalCount,
      sourceCount,
    },
    audit: {
      ...(typeof trend.audit === "object" && trend.audit
        ? (trend.audit as TrendLike["audit"])
        : {}),
      decisionState,
      decisionRationale,
    },
  };
}

/**
 * Hard timeout wrapper to prevent route hangs.
 */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout_after_${ms}ms`)), ms)),
  ]);
}

/**
 * In-process upstream call (no HTTP self-fetch).
 * Calls the existing /api/signals/reddit route handler directly.
 */
async function getUpstreamFromRedditRoute(
  request: Request,
  pack: string,
  limit: number
): Promise<UpstreamTrendsResponse | null> {
  try {
    const url = new URL(request.url);
    url.pathname = "/api/signals/reddit";
    url.searchParams.set("pack", pack);
    url.searchParams.set("limit", String(limit));

    const upstreamReq = new Request(url.toString(), {
      method: "GET",
      headers: request.headers,
    });

    // Never hang: cap at 3.5s (tune later if needed)
    const res = await withTimeout(redditGET(upstreamReq), 3500);

    if (!res || !(res as Response).ok) return null;

    const json = await (res as Response).json().catch(() => null);
    return (json as UpstreamTrendsResponse) ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const pack = (searchParams.get("pack") || "fragrance").trim().toLowerCase();
    const limit = parseLimit(searchParams.get("limit"), 25);

    // Critical fix: no HTTP self-fetch; call route handler directly
    const upstream = await getUpstreamFromRedditRoute(request, pack, limit);

    if (!upstream) {
      const payload: LiveApiResponse = {
        source: "live",
        status: "unavailable",
        count: 0,
        trends: [],
        message: "Live source unavailable right now (reddit).",
        debug: { pack, limit, upstream: null, note: "in-process route call + timeout" },
      };
      return NextResponse.json(payload, { status: 200 });
    }

    if (upstream.status && upstream.status !== "ok") {
      const payload: LiveApiResponse = {
        source: "live",
        status: "unavailable",
        count: 0,
        trends: [],
        message: upstream.message ?? "Live source unavailable right now (reddit).",
        debug: {
          pack,
          limit,
          upstream: { source: upstream.source ?? "unknown", status: upstream.status },
          note: "in-process route call + timeout",
        },
      };
      return NextResponse.json(payload, { status: 200 });
    }

    if (!Array.isArray(upstream.trends)) {
      const payload: LiveApiResponse = {
        source: "live",
        status: "unavailable",
        count: 0,
        trends: [],
        message: upstream.message ?? "Live source returned no trends.",
        debug: {
          pack,
          limit,
          upstream: { source: upstream.source ?? "unknown", status: upstream.status },
          note: "in-process route call + timeout",
        },
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const rawTrends = upstream.trends;

    const upstreamSourceLabel = `reddit:${pack}`;

    const trends = rawTrends
      .map(ensureEvidence)
      .map(enforceMultiSourceTruth)
      .map(ensureWhyThisMatters)
      .map(ensureActionHint)
      .map((t) => attachAuditEnvelope(t, upstreamSourceLabel));

    const okPayload: LiveApiResponse = {
      source: "live",
      status: "ok",
      count: trends.length,
      trends,
      debug: {
        pack,
        limit,
        upstreamSource: upstream.source ?? "unknown",
        telemetry: upstream.telemetry ?? null,
        corroborationMode: "single-source (reddit-only)",
        contractVersion: CONTRACT_VERSION,
        note: "Volatile time-derived fields stripped; per-trend audit envelope added (trendId, provenance, contractVersion). Upstream fetched via in-process call w/ timeout.",
        upstreamStatus: upstream.status, // possibly undefined; truth-only
      },
    };

    return NextResponse.json(okPayload, { status: 200 });
  } catch (err) {
    console.error("[/api/trends/live] error:", err);

    const payload: LiveApiResponse = {
      source: "live",
      status: "unavailable",
      count: 0,
      trends: [],
      message: "Unable to build live trends right now.",
    };

    return NextResponse.json(payload, { status: 200 });
  }
}
