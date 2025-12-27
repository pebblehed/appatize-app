// src/app/api/signals/route.ts
//
// Stage D — Signal Router
// Rules:
// - Never 500
// - Explicit health per source
// - Safe empty states
//
// Stage 6.4:
// - Multi-Source Convergence Logic (agreement-based promotion)
//
// NOTE (non-regression):
// - We ONLY add safety layers here: dedupe + stable sorting.
// - We do NOT remove any existing behaviour.

import { NextResponse, type NextRequest } from "next/server";
import {
  convergeSignals,
  type ConvergenceSignalItem,
} from "@internal/mse/convergence/convergeSignals";

export const dynamic = "force-dynamic";

type SourceHealth = {
  source: string;
  mode: "live" | "fallback" | "disabled";
  status: "ok" | "unavailable";
  count: number;

  // Debug (API-only)
  attemptedUrl?: string;
  httpStatus?: number;
  error?: string;
};

type SignalItem = {
  id: string;

  // IMPORTANT:
  // Must remain the granular source key used for convergence:
  // - "hn" for Hacker News
  // - "wired", "guardian_business", etc for RSS outlets
  source: string;

  title: string;
  summary?: string;
  url?: string;
  author?: string;
  score?: number;
  createdAtISO?: string;
};

type SignalsEnvelope = {
  status: "ok";
  sources: SourceHealth[];
  items: SignalItem[];
  message?: string;
  convergence?: {
    status: "ok";
    candidates: ReturnType<typeof convergeSignals>["candidates"];
    debug: ReturnType<typeof convergeSignals>["debug"];
    config: {
      minAgreeingSources: number;
      minCorroborationScore: number;
      similarityThreshold: number;
      sourceWeights: Record<string, number>;
      defaultSourceWeight: number;
    };
  };

  // Router-level debug
  debug?: {
    origin: string;
    enabledSourceCount: number;
    totalItemsRaw: number;
    totalItemsDeduped: number;
  };
};

type FetchResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status?: number; error: string };

async function safeFetchDetailed<T>(url: string): Promise<FetchResult<T>> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const status = res.status;

    if (!res.ok) {
      let body = "";
      try {
        body = (await res.text()).slice(0, 240);
      } catch {
        body = "";
      }
      return {
        ok: false,
        status,
        error: `HTTP ${status}${body ? ` — ${body}` : ""}`,
      };
    }

    const json = (await res.json()) as T;
    return { ok: true, status, data: json };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return { ok: false, error: msg };
  }
}

/**
 * Deterministic ID policy (Stage D):
 * - Never use Math.random()
 * - Prefer upstream id; else derive from source + url/title.
 */
function stableId(args: { source: string; id?: unknown; url?: unknown; title?: unknown }) {
  const source = String(args.source || "src");
  const upstreamId = typeof args.id === "string" && args.id.trim() ? args.id.trim() : "";
  if (upstreamId) return upstreamId;

  const url = typeof args.url === "string" && args.url.trim() ? args.url.trim() : "";
  if (url) return `${source}:${url}`;

  const title =
    typeof args.title === "string" && args.title.trim()
      ? args.title.trim()
      : "untitled";

  return `${source}:title:${title.toLowerCase().slice(0, 120)}`;
}

function normalizeItems(input: any, sourceKey: string): SignalItem[] {
  const list = Array.isArray(input?.items)
    ? input.items
    : Array.isArray(input)
      ? input
      : [];

  const out: SignalItem[] = [];

  for (const x of list) {
    if (!x) continue;

    const title = String(x.title ?? x.name ?? "").trim();
    if (!title) continue;

    const id = stableId({
      source: sourceKey,
      id: x.id,
      url: x.url,
      title,
    });

    // CRITICAL:
    // - For RSS, x.source should already be an outlet key (wired, guardian_business, etc).
    // - We NEVER overwrite a valid granular key.
    const src =
      typeof x.source === "string" && x.source.trim()
        ? x.source.trim()
        : sourceKey;

    out.push({
      id,
      source: src,
      title,
      summary: typeof x.summary === "string" ? x.summary : undefined,
      url: typeof x.url === "string" ? x.url : undefined,
      author: typeof x.author === "string" ? x.author : undefined,
      score: typeof x.score === "number" ? x.score : undefined,
      createdAtISO: typeof x.createdAtISO === "string" ? x.createdAtISO : undefined,
    });
  }

  return out;
}

function dedupeById(items: SignalItem[]): SignalItem[] {
  const seen = new Set<string>();
  const out: SignalItem[] = [];
  for (const it of items) {
    const id = String(it?.id || "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }
  return out;
}

function sortNewestFirst(items: SignalItem[]): SignalItem[] {
  return [...items].sort((a, b) => {
    const ta = a.createdAtISO ? Date.parse(a.createdAtISO) : 0;
    const tb = b.createdAtISO ? Date.parse(b.createdAtISO) : 0;
    return tb - ta;
  });
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;

  const SOURCES: Array<{
    key: string;
    mode: "live" | "fallback" | "disabled";
    path?: string;
  }> = [
    { key: "hn", mode: "live", path: "/api/signals/hn" },
    { key: "reddit", mode: "disabled" },
    { key: "rss", mode: "live", path: "/api/signals/rss" },
  ];

  try {
    const sourcesHealth: SourceHealth[] = [];
    const allItemsRaw: SignalItem[] = [];

    const enabledCount = SOURCES.filter((s) => s.mode !== "disabled" && s.path).length;

    for (const s of SOURCES) {
      if (s.mode === "disabled" || !s.path) {
        sourcesHealth.push({
          source: s.key,
          mode: s.mode,
          status: "unavailable",
          count: 0,
        });
        continue;
      }

      const attemptedUrl = new URL(s.path, origin).toString();
      const result = await safeFetchDetailed<any>(attemptedUrl);

      if (!result.ok) {
        sourcesHealth.push({
          source: s.key,
          mode: s.mode,
          status: "unavailable",
          count: 0,
          attemptedUrl,
          httpStatus: result.status,
          error: result.error,
        });
        continue;
      }

      const items = normalizeItems(result.data, s.key);
      allItemsRaw.push(...items);

      sourcesHealth.push({
        source: s.key,
        mode: s.mode,
        status: "ok",
        count: items.length,
        attemptedUrl,
        httpStatus: result.status,
      });
    }

    // ✅ Added safety layer (non-regressive):
    // Dedupe + stable sort before convergence
    const allItemsDeduped = sortNewestFirst(dedupeById(allItemsRaw));

    // Stage 6.4 config: agreement-first
    const convergenceConfig = {
      minAgreeingSources: 2,
      minCorroborationScore: 0.58,
      similarityThreshold: 0.38,
      sourceWeights: {
        hn: 0.70,
        rss: 0.55, // rss group weight (applied to rss outlets by convergeSignals)
        reddit: 0.60,
      },
      defaultSourceWeight: 0.60,
    };

    const conv = convergeSignals(allItemsDeduped as ConvergenceSignalItem[], {
      minAgreeingSources: convergenceConfig.minAgreeingSources,
      minCorroborationScore: convergenceConfig.minCorroborationScore,
      similarityThreshold: convergenceConfig.similarityThreshold,
      maxCandidates: 30,
      sourceWeights: convergenceConfig.sourceWeights,
      defaultSourceWeight: convergenceConfig.defaultSourceWeight,
    });

    const envelope: SignalsEnvelope = {
      status: "ok",
      sources: sourcesHealth,
      items: allItemsDeduped,
      message:
        allItemsDeduped.length === 0
          ? "No signals available from enabled sources."
          : undefined,
      convergence: {
        status: "ok",
        candidates: conv.candidates,
        debug: conv.debug,
        config: convergenceConfig,
      },
      debug: {
        origin,
        enabledSourceCount: enabledCount,
        totalItemsRaw: allItemsRaw.length,
        totalItemsDeduped: allItemsDeduped.length,
      },
    };

    return NextResponse.json(envelope, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Signal router failed";
    const empty: SignalsEnvelope = {
      status: "ok",
      sources: [],
      items: [],
      message: "Signal router unavailable; returning safe empty state.",
      convergence: {
        status: "ok",
        candidates: [],
        debug: {
          totalItems: 0,
          clustered: 0,
          totalClusters: 0,
          promotedClusters: 0,
          blockedSingleSourceClusters: 0,
          avgSigLen: 0,
          avgClusterSize: 0,
        },
        config: {
          minAgreeingSources: 2,
          minCorroborationScore: 0.58,
          similarityThreshold: 0.38,
          sourceWeights: { hn: 0.7, rss: 0.55, reddit: 0.6 },
          defaultSourceWeight: 0.6,
        },
      },
      debug: {
        origin: request.nextUrl.origin,
        enabledSourceCount: 0,
        totalItemsRaw: 0,
        totalItemsDeduped: 0,
      },
    };

    // Never 500
    console.log("[/api/signals] error:", msg);
    return NextResponse.json(empty, { status: 200 });
  }
}
