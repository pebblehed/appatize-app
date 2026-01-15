// src/app/api/signals/reddit/route.ts
//
// Stage 2 — Reddit Signals API (deterministic, never-hang, never-500)
//
// Purpose:
// - Fetch recent posts from selected subreddits per "pack" and return a tolerant
//   Trend[] list for upstream consumers (/api/trends/live).
//
// Rules:
// - Never 500
// - Never hang (hard timeouts)
// - Safe empty states
// - Truth-only: no invented facts, no creative claims
//
// Output envelope (tolerant, stable):
// {
//   source: "reddit",
//   status: "ok" | "unavailable",
//   count: number,
//   trends: unknown[],
//   message?: string,
//   telemetry?: unknown,
//   debug?: unknown
// }

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Status = "ok" | "unavailable";

type RedditChild = {
  kind?: string;
  data?: {
    id?: string;
    name?: string;
    title?: string;
    subreddit?: string;
    subreddit_name_prefixed?: string;
    permalink?: string;
    url?: string;
    created_utc?: number;
    num_comments?: number;
    score?: number;
    ups?: number;
    downs?: number;
    upvote_ratio?: number;
    over_18?: boolean;
    is_self?: boolean;
    selftext?: string;
    author?: string;
  };
};

type RedditListing = {
  kind?: string;
  data?: {
    children?: RedditChild[];
    after?: string | null;
    before?: string | null;
  };
};

type UpstreamTrendsResponse = {
  source: "reddit";
  status: Status;
  count: number;
  trends: unknown[];
  message?: string;
  telemetry?: unknown;
  debug?: unknown;
};

type SignalStrength = "WEAK" | "MEDIUM" | "STRONG";

/**
 * Trajectory is a stable categorical label.
 * IMPORTANT:
 * - This is NOT "velocity" and NOT time-now derived.
 * - It is a deterministic direction label aligned to strength thresholds.
 */
type Trajectory = "FLAT" | "RISING" | "SURGING";

type TrendCandidate = {
  id: string;
  name: string;
  description: string;

  evidence?: {
    signalCount?: number;
    sourceCount?: number;
    firstSeenAt?: string;
    lastConfirmedAt?: string;
    subredditCount?: number;
    platformSourceCount?: number;

    // ✅ stable categorical direction label
    trajectory?: Trajectory;
  };

  source?: "reddit";
  subreddit?: string;
  permalink?: string;
  url?: string;
  createdAt?: string;

  decisionState?: "WAIT" | "REFRESH" | "ACT";
  signalStrength?: SignalStrength;

  // (optional) allow trajectory to exist at root too (some UIs read it there)
  trajectory?: Trajectory;
};

function parseLimit(raw: string | null, fallback: number): number {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 50);
}

function packToSubreddits(pack: string): string[] {
  const p = pack.trim().toLowerCase();

  // fragrance: keep this conservative + likely-to-exist/public
  if (p === "fragrance") {
    return ["fragrance", "Perfumes", "Colognes", "FemaleFragrance"];
  }

  if (p === "marketing") return ["marketing", "advertising", "socialmedia", "branding"];
  if (p === "beauty") return ["beauty", "MakeupAddiction", "SkincareAddiction"];
  if (p === "fitness") return ["fitness", "loseit", "bodyweightfitness"];

  return ["marketing", "advertising", "trends", "socialmedia"];
}

async function fetchWithTimeout(
  url: string,
  ms: number
): Promise<{ res: Response | null; elapsedMs: number }> {
  const ac = new AbortController();
  const started = Date.now();
  const t = setTimeout(() => ac.abort(), ms);

  try {
    const res = await fetch(url, {
      signal: ac.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "appatize-dev/1.0",
        Accept: "application/json",
      },
    });
    return { res, elapsedMs: Date.now() - started };
  } catch {
    return { res: null, elapsedMs: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

function isoFromUtcSeconds(v: unknown): string | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  const d = new Date(v * 1000);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function safeString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

/**
 * Fix classic mojibake artifacts (e.g. â€™, â€œ, Ã…) caused by a bad decode step upstream.
 * Deterministic + conservative: only attempts repair when markers are present.
 */
function fixMojibake(s: string): string {
  if (!/(Ã|â€™|â€œ|â€|â€¦|â¦|\uFFFD)/.test(s)) return s;
  try {
    return Buffer.from(s, "latin1").toString("utf8");
  } catch {
    return s;
  }
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Deterministic trajectory from strength thresholds.
 * No time-now logic; no “velocity” claims.
 */
function trajectoryFromStrength(strength: SignalStrength): Trajectory {
  if (strength === "STRONG") return "SURGING";
  if (strength === "MEDIUM") return "RISING";
  return "FLAT";
}

function buildCandidatesFromListing(listing: RedditListing, subreddit: string): TrendCandidate[] {
  const children = listing?.data?.children;
  if (!Array.isArray(children) || children.length === 0) return [];

  const out: TrendCandidate[] = [];

  for (const child of children) {
    const d = child?.data;
    if (!d) continue;

    const titleRaw = safeString(d.title);
    if (!titleRaw) continue;

    if (d.over_18 === true) continue;

    const id = safeString(d.id) ?? safeString(d.name);
    if (!id) continue;

    const createdAt = isoFromUtcSeconds(d.created_utc);

    const permalink = safeString(d.permalink) ? `https://www.reddit.com${d.permalink}` : undefined;

    const url = safeString(d.url);

    const score = typeof d.score === "number" ? d.score : 0;
    const comments = typeof d.num_comments === "number" ? d.num_comments : 0;

    let signalStrength: SignalStrength = "WEAK";
    if (score >= 50 || comments >= 25) signalStrength = "MEDIUM";
    if (score >= 200 || comments >= 80) signalStrength = "STRONG";

    let decisionState: TrendCandidate["decisionState"] = "WAIT";
    if (signalStrength === "STRONG") decisionState = "ACT";
    else if (signalStrength === "MEDIUM") decisionState = "REFRESH";

    // ✅ trajectory is a stable categorical label aligned to strength
    const trajectory = trajectoryFromStrength(signalStrength);

    // Fix encoding artifacts before normalizing
    const title = normalizeText(fixMojibake(titleRaw));

    out.push({
      id: `reddit:${subreddit}:${id}`,
      name: title,
      description: "Reddit signal (title-derived).",
      source: "reddit",
      subreddit,
      permalink,
      url,
      createdAt,
      signalStrength,
      decisionState,

      // ✅ emit trajectory (root + evidence) so downstream/UI has it regardless of where it reads
      trajectory,
      evidence: {
        signalCount: 1,
        sourceCount: 1,
        firstSeenAt: createdAt,
        lastConfirmedAt: createdAt,
        subredditCount: 1,
        platformSourceCount: 1,
        trajectory,
      },
    });
  }

  return out;
}

function dedupeByName(items: TrendCandidate[]): TrendCandidate[] {
  const seen = new Set<string>();
  const out: TrendCandidate[] = [];

  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const pack = (searchParams.get("pack") || "fragrance").trim().toLowerCase();
    const limit = parseLimit(searchParams.get("limit"), 25);

    const subs = packToSubreddits(pack);

    // Keep it light to avoid rate limits / slow dev hangs.
    const perSubBase = Math.max(3, Math.min(10, Math.ceil(limit / Math.max(subs.length, 1))));
    const perSub = pack === "fragrance" ? Math.min(perSubBase, 5) : perSubBase;

    const startedAt = Date.now();

    const results: TrendCandidate[] = [];

    // Debug counters (truth-only) so we can see which subs fail.
    const subDebug: Array<{
      sub: string;
      feed: "hot" | "new";
      ok: boolean;
      status: number | null;
      elapsedMs: number;
      items: number;
    }> = [];

    const feed: "hot" | "new" = pack === "fragrance" ? "new" : "hot";

    for (const sub of subs) {
      const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${feed}.json?limit=${perSub}`;

      const { res, elapsedMs } = await fetchWithTimeout(url, 3000);
      if (!res || !res.ok) {
        subDebug.push({
          sub,
          feed,
          ok: false,
          status: res ? res.status : null,
          elapsedMs,
          items: 0,
        });
        continue;
      }

      const json = (await res.json().catch(() => null)) as RedditListing | null;
      if (!json) {
        subDebug.push({
          sub,
          feed,
          ok: false,
          status: res.status,
          elapsedMs,
          items: 0,
        });
        continue;
      }

      const built = buildCandidatesFromListing(json, sub);
      results.push(...built);

      subDebug.push({
        sub,
        feed,
        ok: true,
        status: res.status,
        elapsedMs,
        items: built.length,
      });
    }

    const deduped = dedupeByName(results).slice(0, limit);

    const elapsedMs = Date.now() - startedAt;

    if (deduped.length === 0) {
      const payload: UpstreamTrendsResponse = {
        source: "reddit",
        status: "unavailable",
        count: 0,
        trends: [],
        message: "No usable Reddit signals returned for this pack.",
        telemetry: { elapsedMs, subsTried: subs.length },
        debug: { pack, limit, subs, feed, perSub, subDebug },
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const payload: UpstreamTrendsResponse = {
      source: "reddit",
      status: "ok",
      count: deduped.length,
      trends: deduped,
      telemetry: { elapsedMs, subsTried: subs.length },
      debug: { pack, limit, subs, feed, perSub, subDebug },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    const payload: UpstreamTrendsResponse = {
      source: "reddit",
      status: "unavailable",
      count: 0,
      trends: [],
      message: "Reddit signals unavailable (unexpected error).",
      debug: { error: String(err) },
    };

    return NextResponse.json(payload, { status: 200 });
  }
}
