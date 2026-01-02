// src/app/api/trends/live/route.ts
//
// Live Trends API (deterministic, never-500)
//
// Purpose:
// - Surface Trend[] for the UI from live signal sources.
// - Stage 3+ logic (decision surfacing etc.) is already embedded in the engine output.
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
// Stage 3.5+ UI NOTE:
// - The UI Evidence drawer expects `trend.evidence` fields.
// - Upstream Trend objects currently do NOT include evidence primitives,
//   so we attach a minimal deterministic evidence object here (no extra calls).
//
// Stage 3.8 (#6) — Why this matters (deterministic, truth-only)
// - Attach `whyThisMatters` (1–2 sentences) derived ONLY from existing evidence + decision fields.
// - No new intelligence, no extra network calls, no LLM, no guessing.
//
// Stage 3.9 (#7) — Minimal action hint (deterministic, truth-only)
// - Attach `actionHint` (one short sentence) derived ONLY from existing decision fields.
// - No new intelligence, no extra network calls, no LLM, no marketing language.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type LiveTrendsResponse = {
  source: string;
  mode?: string;
  status: "ok" | "unavailable";
  count: number;
  trends: any[];
  message?: string;
  telemetry?: any;
};

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

/**
 * Attach minimal evidence primitives to a Trend object if missing.
 *
 * We do NOT add any new intelligence or make any additional network calls here.
 * We only provide deterministic primitives so the UI Evidence drawer can render:
 * - Density (signalCount)
 * - Breadth (sourceCount)
 *
 * Until upstream includes timestamps, we leave freshness/age/velocity undefined.
 */
function ensureEvidence(trend: any) {
  if (!trend || typeof trend !== "object") return trend;

  // If upstream already provides evidence, do not touch it.
  if (trend.evidence && typeof trend.evidence === "object") return trend;

  // Minimal deterministic defaults:
  // Current Reddit adapter is effectively 1-post → 1-trend, so:
  // - density = 1
  // - breadth = 1
  const evidence = {
    signalCount: 1,
    sourceCount: 1,
    firstSeenAt: undefined as string | undefined,
    lastConfirmedAt: undefined as string | undefined,
    ageHours: undefined as number | undefined,
    recencyMins: undefined as number | undefined,
    velocityPerHour: undefined as number | undefined,
  };

  return {
    ...trend,
    evidence,
  };
}

function toFixedSafe(n: unknown, digits: number): string | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return n.toFixed(digits);
}

function toIntSafe(n: unknown): number | null {
  if (typeof n !== "number" || !Number.isFinite(n)) return null;
  return Math.round(n);
}

/**
 * Stage 3.8 — Deterministic "Why this matters"
 * Truth-only text derived from existing evidence + decision fields.
 *
 * Rules:
 * - Never overwrite if upstream already provides whyThisMatters
 * - Never guess missing values: only include what we can prove from fields present
 * - Keep to 1–2 sentences max
 */
function ensureWhyThisMatters(trend: any) {
  if (!trend || typeof trend !== "object") return trend;

  if (
    typeof trend.whyThisMatters === "string" &&
    trend.whyThisMatters.trim().length > 0
  ) {
    return trend;
  }

  const evidence =
    trend.evidence && typeof trend.evidence === "object" ? trend.evidence : null;

  const signalCount =
    typeof evidence?.signalCount === "number" && Number.isFinite(evidence.signalCount)
      ? evidence.signalCount
      : null;

  const sourceCount =
    typeof evidence?.sourceCount === "number" && Number.isFinite(evidence.sourceCount)
      ? evidence.sourceCount
      : null;

  const ageHours = toFixedSafe(evidence?.ageHours, 1);
  const recencyMins = toIntSafe(evidence?.recencyMins);
  const velocityPerHour = toFixedSafe(evidence?.velocityPerHour, 2);

  // Sentence 1: evidence facts (only what is known)
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
    // If we truly have nothing, don't invent.
    parts.push("Evidence available");
  }

  const timingBits: string[] = [];
  if (ageHours != null) timingBits.push(`last ${ageHours}h`);
  if (recencyMins != null) timingBits.push(`last confirmed ${recencyMins}m ago`);
  if (velocityPerHour != null) timingBits.push(`~${velocityPerHour}/hr`);

  const sentence1 =
    timingBits.length > 0
      ? `${parts.join(" ")} (${timingBits.join("; ")}).`
      : `${parts.join(" ")}.`;

  // Sentence 2: guidance derived ONLY from decision fields already present
  const decisionState =
    typeof trend.decisionState === "string" ? trend.decisionState.toUpperCase() : null;
  const signalStrength =
    typeof trend.signalStrength === "string" ? trend.signalStrength.toUpperCase() : null;
  const trajectory =
    typeof trend.confidenceTrajectory === "string"
      ? trend.confidenceTrajectory.toUpperCase()
      : null;

  let sentence2: string | null = null;

  if (decisionState === "ACT") {
    sentence2 = "Strong enough to act — consider publishing/briefing now.";
  } else if (decisionState === "WAIT") {
    // Stay strictly within known labels; don’t invent reasons beyond “density/breadth”
    if (signalStrength === "WEAK") {
      sentence2 = "Stable but weak — wait for more density/breadth before acting.";
    } else {
      sentence2 = "Hold for confirmation — wait for stronger convergence.";
    }
  } else if (decisionState === "REFRESH") {
    sentence2 = "Insufficient convergence — refresh soon for confirmation.";
  } else if (signalStrength === "WEAK" && trajectory === "WEAKENING") {
    // Extra guard: still deterministic, but only if both labels exist
    sentence2 = "Weakening signal — deprioritise unless it rebounds.";
  }

  const whyThisMatters = sentence2 ? `${sentence1} ${sentence2}` : sentence1;

  return {
    ...trend,
    whyThisMatters,
  };
}

/**
 * Stage 3.9 — Deterministic "Minimal action hint"
 * One short UI hint sentence derived ONLY from decision fields (read-only).
 *
 * Rules:
 * - Never overwrite if upstream already provides actionHint
 * - One sentence max
 * - No LLM
 * - No marketing language
 * - No behaviour steering beyond evidence (UI hint only)
 */
function ensureActionHint(trend: any) {
  if (!trend || typeof trend !== "object") return trend;

  if (typeof trend.actionHint === "string" && trend.actionHint.trim().length > 0) {
    return trend;
  }

  const decisionState =
    typeof trend.decisionState === "string" ? trend.decisionState.toUpperCase() : null;

  const signalStrength =
    typeof trend.signalStrength === "string" ? trend.signalStrength.toUpperCase() : null;

  const trajectory =
    typeof trend.confidenceTrajectory === "string"
      ? trend.confidenceTrajectory.toUpperCase()
      : null;

  // Deterministic defaults (safe + non-persuasive)
  let actionHint = "Track for another signal cycle.";

  if (decisionState === "ACT") {
    actionHint = "Worth turning into a brief now.";
  } else if (decisionState === "WAIT") {
    actionHint = "Track for another signal cycle.";
  } else if (decisionState === "REFRESH") {
    actionHint = "Recheck shortly for movement.";
  } else {
    // If decisionState is missing, fall back only to the other labels (still deterministic)
    if (signalStrength === "WEAK" && trajectory === "WEAKENING") {
      actionHint = "Track for another signal cycle.";
    }
  }

  return {
    ...trend,
    actionHint,
  };
}

export async function GET(request: Request) {
  const origin = getOrigin(request);

  try {
    const { searchParams } = new URL(request.url);

    // preferred params for live
    const pack = (searchParams.get("pack") || "fragrance").trim().toLowerCase();
    const limit = parseLimit(searchParams.get("limit"), 25);

    // Call the already-working live endpoint.
    const url = origin
      ? `${origin}/api/signals/reddit?pack=${encodeURIComponent(pack)}&limit=${limit}`
      : `/api/signals/reddit?pack=${encodeURIComponent(pack)}&limit=${limit}`;

    const upstream = await safeFetchJSON<LiveTrendsResponse>(url);

    // If upstream is missing or reports unavailable, return safe empty (never-500).
    if (!upstream || upstream.status !== "ok") {
      return NextResponse.json(
        {
          source: "live",
          status: "unavailable",
          count: 0,
          trends: [],
          message: upstream?.message || "Live source unavailable right now (reddit).",
          debug: {
            pack,
            limit,
            upstream: upstream ? { source: upstream.source, status: upstream.status } : null,
          },
        },
        { status: 200 }
      );
    }

    const rawTrends = Array.isArray(upstream.trends) ? upstream.trends : [];

    // Attach evidence primitives (UI-only support; deterministic)
    // Then attach whyThisMatters (truth-only; deterministic)
    // Then attach actionHint (minimal UI hint; deterministic)
    const trends = rawTrends
      .map(ensureEvidence)
      .map(ensureWhyThisMatters)
      .map(ensureActionHint);

    // Return stable contract expected by UI.
    return NextResponse.json({
      source: "live",
      status: "ok",
      count: trends.length,
      trends,
      // keep useful upstream telemetry for debugging but don’t change the Trend[] shape beyond evidence + whyThisMatters + actionHint
      debug: {
        pack,
        limit,
        upstreamSource: upstream.source,
        telemetry: upstream.telemetry ?? null,
      },
    });
  } catch (err) {
    console.error("[/api/trends/live] error:", err);

    return NextResponse.json(
      {
        source: "live",
        status: "unavailable",
        count: 0,
        trends: [],
        message: "Unable to build live trends right now.",
      },
      { status: 200 } // never-500 rule
    );
  }
}
