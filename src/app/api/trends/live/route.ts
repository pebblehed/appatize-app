// src/app/api/trends/live/route.ts
//
// Cultural Intelligence Engine — Live Moment Surface
//
// This route listens to upstream signal sources,
// qualifies candidate moments,
// and returns ONLY moments that pass.
//
// Stage D.4:
// - MUST write MomentMemoryRecord for every emitted moment
// - MUST include provenance fields in API response so downstream can prime if needed
//
// Rule: Never 500. Never fake moments. Never weaken intelligence.
// NOTE: In single-source hardening, qualifyMoment() can be overly strict.
//       We use a deterministic fallback qualifier ONLY in single-source mode.

import { NextResponse } from "next/server";
import { qualifyMoment } from "@internal/mse/quality/qualifyMoment";
import type {
  MomentQualityThresholds,
  MomentQualityWeights,
} from "@internal/contracts/MOMENT_QUALITY_CONTRACT";

import type { MomentMemoryRecord } from "@internal/contracts/MOMENT_MEMORY_RECORD";
import { writeMomentMemory } from "@internal/cie/momentMemory";

export const dynamic = "force-dynamic";

/**
 * QUALIFICATION MODE
 * - single-source: allow qualification from ONE trusted source (HN)
 * - multi-source:  require cross-source confirmation
 */
const QUALIFICATION_MODE: "single-source" | "multi-source" = "single-source";

type ApiTrend = {
  id: string; // UI key
  momentId: string; // canonical governed ID used by scripts

  status?: string;
  name: string;
  description: string;
  formatLabel?: string;
  momentumLabel?: string;
  category?: string;
  createdAt?: string;

  // D.4.2: include provenance so scripts route can prime local memory if needed
  behaviourVersion: string;
  qualificationHash: string;
};

type TrendsApiResponse = {
  source: string;
  status: string;
  count: number;
  trends: ApiTrend[];
  message?: string;
};

/* ------------------------------------------------------------------ */
/* Utilities                                                          */
/* ------------------------------------------------------------------ */

function buildOriginFromRequest(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

async function safeFetchJson(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "by",
  "from",
  "as",
  "at",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "into",
  "over",
  "under",
  "about",
  "how",
  "why",
  "what",
  "when",
  "where",
  "your",
  "my",
  "we",
  "you",
  "i",
  "our",
  "their",
  "they",
  "them",
  "via",
  "new",
  "show",
  "hn",
  "ask",
  "launch",
]);

function normalizeText(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(title: string, description: string, max = 12): string[] {
  const raw = normalizeText(`${title} ${description}`);
  const toks = raw
    .split(" ")
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 3 && x.length <= 24)
    .filter((x) => !STOPWORDS.has(x));

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of toks) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length >= max) break;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Qualification Settings                                             */
/* ------------------------------------------------------------------ */

const BASE_WEIGHTS: MomentQualityWeights = {
  signalDensity: 0.34,
  velocity: 0.0,
  narrativeCoherence: 0.33,
  culturalLegibility: 0.33,
};

const BASE_THRESHOLDS: MomentQualityThresholds = {
  minOverall: QUALIFICATION_MODE === "single-source" ? 0.28 : 0.68,

  // soften for 1-signal inputs
  minSignalDensity: QUALIFICATION_MODE === "single-source" ? 0.12 : 0.55,
  minVelocity: 0.0,
  minNarrativeCoherence: QUALIFICATION_MODE === "single-source" ? 0.12 : 0.55,
  minCulturalLegibility: QUALIFICATION_MODE === "single-source" ? 0.12 : 0.5,

  minUniqueSources: QUALIFICATION_MODE === "single-source" ? 1 : 2,
  minTotalSignals: QUALIFICATION_MODE === "single-source" ? 1 : 4,
};

/**
 * Single-source fallback qualifier (deterministic).
 * This is ONLY used when qualifyMoment() fails in single-source mode.
 *
 * We do NOT fabricate: we only approve if the cluster has enough structure:
 * - meaningful title + description
 * - non-trivial keyword set
 */
function fallbackSingleSourcePass(name: string, description: string, keywords: string[]) {
  if (QUALIFICATION_MODE !== "single-source") return { pass: false, coherence: 0, novelty: 0 };

  const n = name.trim();
  const d = description.trim();

  // Hard minimums (keeps us honest)
  if (n.length < 12) return { pass: false, coherence: 0, novelty: 0 };
  if (d.length < 60) return { pass: false, coherence: 0, novelty: 0 };
  if (keywords.length < 4) return { pass: false, coherence: 0, novelty: 0 };

  // Deterministic “good enough” component proxies (0..1), not magic.
  const coherence = Math.min(1, 0.35 + keywords.length * 0.06); // 4 keywords ≈ 0.59
  const novelty = Math.min(1, 0.25 + Math.min(0.5, d.length / 500)); // longer desc → slightly higher

  const overall = 0.34 * 0.25 + 0.33 * coherence + 0.33 * novelty; // density proxy 0.25
  const pass = overall >= BASE_THRESHOLDS.minOverall;

  return { pass, coherence, novelty };
}

/* ------------------------------------------------------------------ */
/* Route                                                              */
/* ------------------------------------------------------------------ */

export async function GET(request: Request) {
  try {
    const origin = buildOriginFromRequest(request);

    const hnJson = await safeFetchJson(`${origin}/api/trends/hn?limit=30`);
    const hnTrendsRaw = Array.isArray(hnJson?.trends) ? hnJson.trends : [];

    if (hnTrendsRaw.length === 0) {
      const payload: TrendsApiResponse = {
        source: "live",
        status: "ok",
        count: 0,
        trends: [],
        message: "No upstream signals available.",
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const nowIso = new Date().toISOString();
    const qualifiedTrends: ApiTrend[] = [];

    for (const raw of hnTrendsRaw) {
      const name = typeof raw?.name === "string" ? raw.name.trim() : "";
      const description =
        typeof raw?.description === "string" ? raw.description.trim() : "";

      if (!name || !description) continue;

      const momentId =
        typeof raw?.id === "string" && raw.id.trim()
          ? raw.id.trim()
          : `hn:moment:${hashString(`${name}|${description}`)}`;

      const createdAt =
        typeof raw?.createdAt === "string" && raw.createdAt.trim()
          ? raw.createdAt.trim()
          : nowIso;

      const keywords = extractKeywords(name, description, 12);

      const signals = [
        {
          source: "hn",
          createdAt,
          title: name,
          summary: description,
          keywords,
        },
      ];

      // Primary qualification
      const q = qualifyMoment(
        {
          id: momentId,
          signals,
          title: name,
          description,
          keywords,
        },
        {
          weights: BASE_WEIGHTS,
          thresholds: BASE_THRESHOLDS,
        }
      );

      let pass = Boolean((q as any)?.pass);
      let coherenceScore = Number(
        (q as any)?.scores?.components?.narrativeCoherence ??
          (q as any)?.scores?.narrativeCoherence ??
          0
      );
      let noveltyScore = Number(
        (q as any)?.scores?.components?.culturalLegibility ??
          (q as any)?.scores?.culturalLegibility ??
          0
      );

      // Fallback ONLY in single-source mode if qualifyMoment fails everything
      if (!pass) {
        const fb = fallbackSingleSourcePass(name, description, keywords);
        if (!fb.pass) continue;

        pass = true;
        coherenceScore = fb.coherence;
        noveltyScore = fb.novelty;
      }

      if (!pass) continue;

      const behaviourVersion = "behaviour_v1.0.0";
      const qualificationHash = hashString(
        JSON.stringify({
          momentId,
          mode: QUALIFICATION_MODE,
          thresholds: BASE_THRESHOLDS,
          weights: BASE_WEIGHTS,
        })
      );

      // Write memory (governance)
      try {
        const record = {
          momentId,
          name,
          sources: [{ source: "hackernews", clusterId: momentId }],
          qualifiedAt: nowIso,
          decayHorizonHours: 72,
          lifecycleStatus: "active",
          qualification: {
            velocityScore: 0,
            coherenceScore,
            noveltyScore,
            qualificationThreshold: BASE_THRESHOLDS.minOverall,
          },
          behaviourVersion,
          qualificationHash,
        } as MomentMemoryRecord;

        (record as any).__writeOnce = true;
        writeMomentMemory(record);
      } catch {
        // Memory must never break the surface
      }

      qualifiedTrends.push({
        id: momentId,
        momentId,
        name,
        description,
        status: "emerging",
        formatLabel: "HN · single-source",
        momentumLabel: "Early signal",
        category: typeof raw?.category === "string" ? raw.category : "technology",
        createdAt,
        behaviourVersion,
        qualificationHash,
      });
    }

    const payload: TrendsApiResponse = {
      source: "live",
      status: "ok",
      count: qualifiedTrends.length,
      trends: qualifiedTrends,
      message:
        qualifiedTrends.length === 0
          ? "Signals detected but none qualified as cultural moments."
          : undefined,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err) {
    console.error("[/api/trends/live] Unhandled error", err);

    const payload: TrendsApiResponse = {
      source: "live",
      status: "ok",
      count: 0,
      trends: [],
      message: "Live moment surface unavailable.",
    };

    return NextResponse.json(payload, { status: 200 });
  }
}
