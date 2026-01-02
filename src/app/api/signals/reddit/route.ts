// src/app/api/signals/reddit/route.ts
//
// Stage 2: Real-signal endpoint (Reddit).
// GET /api/signals/reddit?pack=fragrance&limit=25
// Also supports legacy query params:
//   - subs=socialmedia,marketing
//   - subreddits=socialmedia,marketing
//
// Returns Trend[] interpreted from live Reddit topics.
//
// Rules:
// - Never 500
// - Safe empty states
// - Backwards compatible params to prevent drift
//
// Stage 3.7 — Reddit resilience (soft cache, no drift)
//
// Anti-throttle hardening (deterministic, no fake intelligence):
// - Soft cache per (pack/subreddits + limit) to reduce Reddit hits
// - If live fetch fails, serve last-known-good payload (stale-allowed window)
// - Never mutate cached payloads (prevents drift)
//
// Telemetry (best-effort, deterministic):
// - We probe each subreddit once to report raw counts + availability.
// - We then call the engine to apply hygiene + mapping.
// - "dropped" is estimated as rawCount - keptCount (keptCount = trends.length).
//   This should be close because the adapter is 1-post → 1-trend after hygiene,
//   but counts can differ slightly because the probe + engine fetch are separate calls.

import { NextResponse } from "next/server";
import { fetchRedditTrends } from "@/engine/reddit";
import { getSoftCache, makeCacheKey } from "@/lib/cache/softCache";

export const dynamic = "force-dynamic";

const DEFAULT_SUBREDDITS = ["socialmedia", "marketing"];

/**
 * Curated subreddit packs (discovery lenses).
 * Deterministic input selection only — not intelligence.
 */
const PACKS: Record<string, string[]> = {
  // Core defaults
  social: ["socialmedia", "marketing"],
  entrepreneur: ["Entrepreneur"],

  // Market packs
  fragrance: ["fragrance", "perfumes", "Colognes", "FemFragLab"],

  // NEW
  beauty: ["SkincareAddiction", "MakeupAddiction", "AsianBeauty", "beauty"],

  // NEW
  fashion: ["fashion", "streetwear", "malefashionadvice", "femalefashionadvice"],
};

/**
 * Stage 3.7 soft-cache policy
 * - ttlMs: how long a value is considered "fresh"
 * - maxStaleMs: how long we will serve last-known-good if live fails
 */
const SOFT_CACHE_TTL_MS = 90_000; // 90s: calms bursts, still "live-ish"
const SOFT_CACHE_MAX_STALE_MS = 24 * 60 * 60 * 1000; // 24h: resilience fallback

// Namespace isolated for this route
const redditCache = getSoftCache<any>({
  namespace: "reddit-signals",
  ttlMs: SOFT_CACHE_TTL_MS,
  maxStaleMs: SOFT_CACHE_MAX_STALE_MS,
});

function parseLimit(raw: string | null, fallback: number) {
  const n = raw ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), 50); // keep sane
}

function parseSubList(raw: string | null) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

type SubredditHealth = {
  subreddit: string;
  status: "ok" | "unavailable";
  httpStatus?: number;
  rawCount: number; // best-effort count of hot.json children
  message?: string;
};

function buildUserAgent(purpose: "health-probe" | "route") {
  // Small jitter reduces fingerprint throttling; still honest UA string.
  const jitter = Math.random().toString(36).slice(2, 8);
  return `Appatize/0.1 (${purpose}) ${jitter}`;
}

async function probeSubredditHealth(
  subreddit: string,
  limit: number
): Promise<SubredditHealth> {
  const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;

  const controller = new AbortController();
  const timeoutMs = 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": buildUserAgent("health-probe"),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!res.ok) {
      return {
        subreddit,
        status: "unavailable",
        httpStatus: res.status,
        rawCount: 0,
        message: `${res.status} ${res.statusText}`,
      };
    }

    let json: any;
    try {
      json = await res.json();
    } catch {
      return {
        subreddit,
        status: "unavailable",
        httpStatus: 200,
        rawCount: 0,
        message: "JSON parse failed",
      };
    }

    const children: any[] = json?.data?.children ?? [];
    const rawCount = Array.isArray(children) ? children.length : 0;

    return {
      subreddit,
      status: "ok",
      httpStatus: 200,
      rawCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      subreddit,
      status: "unavailable",
      rawCount: 0,
      message: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

function withCacheHeaders(res: NextResponse) {
  // Soft CDN-style caching to reduce hammering; local soft-cache is still primary resilience.
  res.headers.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=60, stale-while-revalidate=600"
  );
  return res;
}

export async function GET(request: Request) {
  // We never 500 — we always return a safe payload.
  try {
    const { searchParams } = new URL(request.url);

    // 1) limit
    const limit = parseLimit(searchParams.get("limit"), 10);

    // 2) pack (preferred)
    const packRaw = (searchParams.get("pack") || "").trim().toLowerCase();
    const pack = packRaw.length > 0 ? packRaw : null;

    // 3) legacy params
    const subsParam = searchParams.get("subs");
    const subredditsParam = searchParams.get("subreddits");

    let subreddits: string[] = [];

    if (pack && PACKS[pack]) {
      subreddits = PACKS[pack];
    } else {
      // Use whichever legacy param exists, otherwise fallback
      const fromSubs = parseSubList(subsParam);
      const fromSubreddits = parseSubList(subredditsParam);

      subreddits =
        fromSubs.length > 0
          ? fromSubs
          : fromSubreddits.length > 0
          ? fromSubreddits
          : DEFAULT_SUBREDDITS;
    }

    // --- Stage 3.7: stable cache key (deterministic) ---
    const cacheKey = makeCacheKey("reddit", {
      pack: pack ?? "none",
      subs: subreddits,
      limit,
    });

    // --- Stage 3.7: short-circuit if fresh cache exists (reduces Reddit hits) ---
    const fresh = redditCache.get(cacheKey);
    if (fresh?.meta?.isFresh) {
      const res = NextResponse.json(fresh.data);
      // Do NOT mutate the payload (no drift). Use headers for observability.
      res.headers.set("X-Soft-Cache", "HIT");
      res.headers.set("X-Soft-Cache-AgeMs", String(fresh.meta.ageMs));
      return withCacheHeaders(res);
    }

    // --- Best-effort telemetry probe (deterministic; never throws) ---
    const health = await Promise.all(
      subreddits.map((s) => probeSubredditHealth(s, limit))
    );

    const rawCount = health.reduce((sum, h) => sum + (h.rawCount || 0), 0);

    // Engine fetch (applies hygiene + market tagging + mapping)
    const trends = await fetchRedditTrends(subreddits, limit);

    const keptCount = trends.length;
    const estimatedDropped = Math.max(0, rawCount - keptCount);

    // Simple drop reason buckets (best-effort only).
    // We don't duplicate the engine's exact internal reasons in this route.
    const dropReasons = {
      structural_noise: null as number | null,
      meta_post: null as number | null,
      other: estimatedDropped,
      note:
        "Route reports best-effort drop counts. Exact per-reason counts live inside the adapter. If you want exact buckets, we can export adapter debug safely.",
    };

    const payload = {
      source: "reddit",
      mode: "live",
      status: "ok" as const,
      pack,
      subreddits,
      limit,

      // Telemetry
      telemetry: {
        rawCount,
        keptCount,
        estimatedDropped,
        dropReasons,
        subredditHealth: health,
        cache: {
          enabled: true,
          policy: "soft-cache" as const,
          ttlMs: SOFT_CACHE_TTL_MS,
          maxStaleMs: SOFT_CACHE_MAX_STALE_MS,
          key: cacheKey,
        },
      },

      count: trends.length,
      trends,
    };

    // Stage 3.7: cache only successful payloads (last-known-good)
    redditCache.set(cacheKey, payload);

    const res = NextResponse.json(payload);
    res.headers.set("X-Soft-Cache", "MISS");
    return withCacheHeaders(res);
  } catch (err) {
    console.error("[RedditRoute] Error fetching trends:", err);

    // Stage 3.7: if live fails, serve last-known-good (stale allowed)
    try {
      const { searchParams } = new URL(request.url);
      const limit = parseLimit(searchParams.get("limit"), 10);

      const packRaw = (searchParams.get("pack") || "").trim().toLowerCase();
      const pack = packRaw.length > 0 ? packRaw : null;

      const subsParam = searchParams.get("subs");
      const subredditsParam = searchParams.get("subreddits");

      let subreddits: string[] = [];
      if (pack && PACKS[pack]) {
        subreddits = PACKS[pack];
      } else {
        const fromSubs = parseSubList(subsParam);
        const fromSubreddits = parseSubList(subredditsParam);
        subreddits =
          fromSubs.length > 0
            ? fromSubs
            : fromSubreddits.length > 0
            ? fromSubreddits
            : DEFAULT_SUBREDDITS;
      }

      const cacheKey = makeCacheKey("reddit", {
        pack: pack ?? "none",
        subs: subreddits,
        limit,
      });

      const cached = redditCache.get(cacheKey);
      if (cached && (cached.meta.isFresh || cached.meta.isStale)) {
        const res = NextResponse.json(cached.data);
        res.headers.set("X-Soft-Cache", "STALE");
        res.headers.set("X-Soft-Cache-AgeMs", String(cached.meta.ageMs));
        return withCacheHeaders(res);
      }
    } catch {
      // ignore — fall through to safe empty payload
    }

    // Never 500 — safe empty state
    const payload = {
      source: "reddit",
      mode: "live",
      status: "unavailable" as const,
      pack: null,
      subreddits: [],
      limit: 0,
      telemetry: {
        rawCount: 0,
        keptCount: 0,
        estimatedDropped: 0,
        dropReasons: {
          structural_noise: null,
          meta_post: null,
          other: 0,
          note: "Unavailable.",
        },
        subredditHealth: [] as SubredditHealth[],
        cache: {
          enabled: true,
          policy: "soft-cache" as const,
          ttlMs: SOFT_CACHE_TTL_MS,
          maxStaleMs: SOFT_CACHE_MAX_STALE_MS,
        },
      },
      count: 0,
      trends: [],
      message: "Failed to fetch Reddit trends right now.",
    };

    const res = NextResponse.json(payload);
    res.headers.set("X-Soft-Cache", "MISS");
    return withCacheHeaders(res);
  }
}
