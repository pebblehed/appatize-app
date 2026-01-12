// src/app/api/trends/live/route.ts
//
// Live Trends API (deterministic, never-500)
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

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

/** Shape we return FROM this /api/trends/live route (stable contract). */
type LiveApiResponse = {
  source: "live";
  status: Status;
  count: number;
  trends: unknown[];
  message?: string;
  debug?: unknown;
};

type JsonRecord = Record<string, unknown>;
type EvidenceLike = JsonRecord;
type TrendLike = JsonRecord;

function parseLimit(raw: string | null, fallback: number) {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 50);
}

function getOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "";
  }
}

async function safeFetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
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

  return stable;
}

/**
 * Attach minimal evidence primitives to a Trend object if missing.
 */
function ensureEvidence(trend: unknown): unknown {
  if (!trend || typeof trend !== "object") return trend;

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

  if (existingEvidence) {
    const merged = {
      ...existingEvidence,
      signalCount: signalCountUpstream ?? existingEvidence.signalCount ?? 1,
      sourceCount: sourceCountUpstream ?? existingEvidence.sourceCount ?? 1,
      firstSeenAt: existingEvidence.firstSeenAt ?? firstSeenAtRaw,
      lastConfirmedAt: existingEvidence.lastConfirmedAt ?? lastConfirmedAtRaw,
    };

    return { ...t, evidence: stripVolatileEvidence(merged) };
  }

  const created = {
    signalCount: signalCountUpstream ?? 1,
    sourceCount: sourceCountUpstream ?? 1,
    firstSeenAt: firstSeenAtRaw,
    lastConfirmedAt: lastConfirmedAtRaw,
  };

  return { ...t, evidence: stripVolatileEvidence(created) };
}

/**
 * Stage 3.x — Multi-source truth guard (deterministic)
 */
function enforceMultiSourceTruth(trend: unknown): unknown {
  if (!trend || typeof trend !== "object") return trend;

  const t = trend as TrendLike;

  const decisionState = typeof t.decisionState === "string" ? t.decisionState.toUpperCase() : null;

  if (decisionState !== "ACT") return t;

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
        "Corroboration not yet proven (single-source live feed); hold for multi-source confirmation before acting.",
    };
  }

  return t;
}

/**
 * Stage 3.8 — Deterministic "Why this matters" (no time-derived values)
 */
function ensureWhyThisMatters(trend: unknown): unknown {
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
function ensureActionHint(trend: unknown): unknown {
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

export async function GET(request: Request) {
  const origin = getOrigin(request);

  try {
    const { searchParams } = new URL(request.url);

    const pack = (searchParams.get("pack") || "fragrance").trim().toLowerCase();
    const limit = parseLimit(searchParams.get("limit"), 25);

    const url = origin
      ? `${origin}/api/signals/reddit?pack=${encodeURIComponent(pack)}&limit=${limit}`
      : `/api/signals/reddit?pack=${encodeURIComponent(pack)}&limit=${limit}`;

    const upstream = await safeFetchJSON<UpstreamTrendsResponse>(url);

    // --- Explicit narrowing (kills "possibly null" squiggles) ---
    if (!upstream) {
      const payload: LiveApiResponse = {
        source: "live",
        status: "unavailable",
        count: 0,
        trends: [],
        message: "Live source unavailable right now (reddit).",
        debug: { pack, limit, upstream: null },
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
        },
      };
      return NextResponse.json(payload, { status: 200 });
    }

    // From here on: upstream is non-null AND has trends array.
    const rawTrends = upstream.trends;

    const trends = rawTrends
      .map(ensureEvidence)
      .map(enforceMultiSourceTruth)
      .map(ensureWhyThisMatters)
      .map(ensureActionHint);

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
        note: "Volatile time-derived fields stripped to prevent client refetch loops.",
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
