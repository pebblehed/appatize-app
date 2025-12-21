// src/app/api/scripts/intelligence/route.ts
//
// Stage D — Intelligence Hardening & Signal Stability
//
// Stage D.4 — Provenance Enforcement (wired)
// Stage D.4.2 — Runtime-safe memory priming (fix)
// Stage D.5 — Moment Lifecycle, Decay & Drift Control (wired here)

import { NextResponse } from "next/server";
import { generateAnglesAndVariantsFromBrief } from "@/lib/intelligence/intelligenceEngine";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
} from "@/lib/intelligence/types";

import { getMomentMemory, writeMomentMemory } from "@internal/cie/momentMemory";
import type { MomentMemoryRecord } from "@internal/contracts/MOMENT_MEMORY_RECORD";
import { assertProvenance } from "@internal/cie/assertProvenance";
import type {
  IntelligenceProvenance,
  IntelligentOutputEnvelope,
} from "@internal/contracts/INTELLIGENT_OUTPUT_ENVELOPE";

import {
  evaluateMomentLifecycle,
  DEFAULT_MOMENT_LIFECYCLE_THRESHOLDS,
  type MomentSignalContext,
  type SignalItem,
} from "@internal/mse/lifecycle/evaluateMomentLifecycle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type IntelligenceErrorCode =
  | "BAD_REQUEST"
  | "MOMENT_NOT_QUALIFIED"
  | "MOMENT_INVALID"
  | "MOMENT_DRIFTED"
  | "MOMENT_CANONICAL_MISSING"
  | "SIGNALS_UNAVAILABLE"
  | "SIGNALS_EMPTY"
  | "ENGINE_EMPTY_SCRIPTS"
  | "ENGINE_ERROR";

type UiExplainBlock = {
  title?: string;
  label?: string;
  kind?: string;
  message?: string;
  text?: string;
  bullets?: string[];
  details?: Record<string, unknown>;
};

type UiMomentHealth = {
  isValid?: boolean;
  lifecycleState?: string; // UI shows this raw (e.g. "WEAK")
  lastEvaluatedAt?: string;
  nextCheckpointAt?: string;
  sis?: number;
  ics?: number;
  thresholds?: { sisPass?: number; icsPass?: number };
  explain?: UiExplainBlock[];
  provenance?: {
    sources?: Array<{ source?: string; ts?: string; id?: string }>;
    sourceNames?: string[];
    lastSeenAt?: string;
  };
};

type IntelligenceFail = {
  ok: false;
  error: {
    code: IntelligenceErrorCode;
    message: string;
    meta?: Record<string, unknown>;
  };
  momentHealth?: UiMomentHealth | null;
};

type IntelligenceOkPayload = {
  ok: true;
  cultural: any;
  momentSignal: any;
  variants: any[];
  result: ScriptGenerationResult;
  momentHealth: UiMomentHealth;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

async function safeFetchJson(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildOriginFromRequest(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function nowIso() {
  return new Date().toISOString();
}

function asFiniteNumber(x: any): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

function clamp01(x: number) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function normalizeExplainBlocks(x: unknown): UiExplainBlock[] {
  if (!x) return [];
  return Array.isArray(x) ? (x as UiExplainBlock[]) : [];
}

/**
 * IMPORTANT D.5/D.6 DEFENSIVE FIX:
 * Some lifecycle evaluators will treat missing timestamps as 0/NaN and immediately EXPIRE.
 * We never mutate persisted memory here; we only ensure the evaluator sees stable fields.
 */
function ensureLifecycleTimestamps(rec: MomentMemoryRecord, createdAt?: string) {
  const qAt =
    typeof (rec as any)?.qualifiedAt === "string" && (rec as any).qualifiedAt
      ? (rec as any).qualifiedAt
      : nowIso();

  const firstSeen =
    typeof (rec as any)?.firstSeenAt === "string" && (rec as any).firstSeenAt
      ? (rec as any).firstSeenAt
      : typeof createdAt === "string" && createdAt
        ? createdAt
        : qAt;

  const lastConf =
    typeof (rec as any)?.lastConfirmedAt === "string" && (rec as any).lastConfirmedAt
      ? (rec as any).lastConfirmedAt
      : qAt;

  // Clone only for evaluation safety
  return {
    ...(rec as any),
    qualifiedAt: qAt,
    firstSeenAt: firstSeen,
    lastConfirmedAt: lastConf,
  } as MomentMemoryRecord;
}

/**
 * Pull matchedSignals count with correct precedence:
 * - Prefer evaluator-derived counts if available (even if 0).
 * - Fall back to signalContext length only if evaluator provided nothing.
 *
 * This prevents contradictions like:
 * "Found 5 live signals..." while evaluator says IDENTITY_DRIFT.
 */
function pickMatchedSignalsCount(args: {
  matchedSignals?: SignalItem[];
  explain?: UiExplainBlock[];
}): number {
  const explain = normalizeExplainBlocks(args.explain);

  // ✅ Prefer engine truth if provided
  for (const b of explain) {
    const n = (b?.details as any)?.matchedSignals;
    if (typeof n === "number" && Number.isFinite(n)) return n; // can be 0
  }

  // Fallback to our derived context list
  const ms = Array.isArray(args.matchedSignals) ? args.matchedSignals.length : 0;
  return ms;
}

/**
 * Deterministic D.5 scoring adapter (no theatre):
 * - SIS (0–100): evidence coverage in this window (saturates at 5 matches)
 * - ICS (0–100): continuity proxy based on canonical presence + any bound evidence
 */
function computeSisIcs(args: {
  rec: MomentMemoryRecord;
  matchedSignalsCount: number;
}): { sis: number; ics: number } {
  const sis = Math.round(clamp01(args.matchedSignalsCount / 5) * 1000) / 10;

  const sig =
    Array.isArray((args.rec as any)?.canonical?.signatureKeywords) &&
    (args.rec as any).canonical.signatureKeywords.length > 0;

  const ent =
    Array.isArray((args.rec as any)?.canonical?.anchorEntities) &&
    (args.rec as any).canonical.anchorEntities.length > 0;

  const hasCanonical = sig || ent;
  const ics = !hasCanonical ? 0 : args.matchedSignalsCount > 0 ? 85 : 25;

  return { sis, ics };
}

/**
 * Convert evaluator output (engine-defined) into UI contract.
 *
 * D.5 FIX:
 * - Never show "evidence binding pass" if evaluator declared drift/invalid.
 * - Prefer evaluator matchedSignals if available.
 */
function toUiMomentHealth(args: {
  momentId: string;
  evalResult: any;
  thresholds: any;
  matchedSignals: SignalItem[];
  allSources: any[];
  rec: MomentMemoryRecord;
}): UiMomentHealth {
  const ts = nowIso();

  const evalExplain = normalizeExplainBlocks(args.evalResult?.explain);
  const evalLifecycle =
    typeof args.evalResult?.lifecycleState === "string" && args.evalResult.lifecycleState.trim()
      ? args.evalResult.lifecycleState.trim()
      : undefined;

  const stateRaw =
    typeof args.evalResult?.state === "string" && args.evalResult.state.trim()
      ? args.evalResult.state.trim()
      : "";

  const stateUpper = stateRaw.toUpperCase();

  const invalidReason =
    typeof args.evalResult?.invalidReason === "string" ? args.evalResult.invalidReason : null;

  const isValid =
    typeof args.evalResult?.isValid === "boolean"
      ? args.evalResult.isValid
      : stateUpper !== "INVALID";

  const lifecycleState =
    evalLifecycle ??
    (stateUpper === "VALID"
      ? "VALID"
      : stateUpper === "WEAK" || stateUpper === "WEAKENING"
        ? "WEAK"
        : stateUpper === "DRIFTING"
          ? "DRIFT-RISK"
          : stateUpper === "INVALID"
            ? "EXPIRED"
            : stateRaw || "—");

  const sisPass =
    asFiniteNumber(args.thresholds?.sisPass) ??
    asFiniteNumber(args.thresholds?.SIS_PASS) ??
    40;

  const icsPass =
    asFiniteNumber(args.thresholds?.icsPass) ??
    asFiniteNumber(args.thresholds?.ICS_PASS) ??
    60;

  // Matched signals count with correct precedence (engine first)
  let matchedSignalsCount = pickMatchedSignalsCount({
    matchedSignals: args.matchedSignals,
    explain: evalExplain,
  });

  // If evaluator explicitly declared drift, we must not report binding as pass.
  if (invalidReason === "IDENTITY_DRIFT") {
    matchedSignalsCount = 0;
  }

  const evalSis =
    asFiniteNumber(args.evalResult?.sis) ??
    asFiniteNumber(args.evalResult?.scores?.sis) ??
    asFiniteNumber(args.evalResult?.metrics?.sis);

  const evalIcs =
    asFiniteNumber(args.evalResult?.ics) ??
    asFiniteNumber(args.evalResult?.scores?.ics) ??
    asFiniteNumber(args.evalResult?.metrics?.ics);

  const computed = computeSisIcs({ rec: args.rec, matchedSignalsCount });
  const sis = typeof evalSis === "number" ? evalSis : computed.sis;
  const ics = typeof evalIcs === "number" ? evalIcs : computed.ics;

  // Explainability: keep evaluator blocks if present; otherwise build minimal truthful blocks
  const explain: UiExplainBlock[] =
    evalExplain.length > 0
      ? evalExplain
      : [
          {
            kind: isValid ? (lifecycleState === "VALID" ? "pass" : "warn") : "fail",
            title: `Lifecycle: ${lifecycleState || "UNKNOWN"}`,
            message: isValid
              ? lifecycleState === "VALID"
                ? "Moment passed lifecycle gating for script generation."
                : "Moment is still usable, but shows weakening/drift risk signals."
              : "Moment failed lifecycle gating for script generation.",
            details: invalidReason ? { invalidReason } : undefined,
          },
        ];

  // Ensure Evidence binding block exists (and is consistent with invalidReason)
  const hasEvidenceBlock = explain.some(
    (b) => (b.title || b.label || "").toLowerCase().includes("evidence")
  );
  if (!hasEvidenceBlock) {
    explain.push({
      kind: matchedSignalsCount > 0 ? "pass" : "fail",
      title: "Evidence binding",
      message:
        matchedSignalsCount > 0
          ? `Found ${matchedSignalsCount} live signal(s) that match the moment’s canonical identity.`
          : invalidReason === "IDENTITY_DRIFT"
            ? "Canonical binding failed: live signals no longer align with this moment’s governed identity."
            : "No live signals matched the moment’s canonical identity.",
      details: { matchedSignals: matchedSignalsCount },
    });
  }

  // Drift hint (only when drift actually applies)
  if (invalidReason === "IDENTITY_DRIFT") {
    const hasDriftHint = explain.some((b) =>
      (b.title || b.label || "").toLowerCase().includes("drift")
    );
    if (!hasDriftHint) {
      explain.push({
        kind: "warn",
        title: "Identity drift detected",
        message:
          "Live signals no longer align with the canonical identity for this moment. Refresh Live moments and choose a currently governed momentId.",
      });
    }
  }

  // Provenance sources (best effort)
  const sourceList = Array.isArray(args.allSources) ? args.allSources : [];
  const sources =
    sourceList.length > 0
      ? sourceList.map((s, i) => ({
          source: typeof s?.source === "string" ? s.source : typeof s === "string" ? s : "source",
          ts,
          id: typeof s?.id === "string" ? s.id : `src-${i + 1}`,
        }))
      : [];

  return {
    isValid,
    lifecycleState,
    lastEvaluatedAt:
      typeof args.evalResult?.lastEvaluatedAt === "string" ? args.evalResult.lastEvaluatedAt : ts,
    nextCheckpointAt:
      typeof args.evalResult?.nextCheckpointAt === "string"
        ? args.evalResult.nextCheckpointAt
        : undefined,
    thresholds: { sisPass, icsPass },
    sis,
    ics,
    explain,
    provenance: {
      sources,
      sourceNames:
        sources.length === 0 && sourceList.length
          ? sourceList.filter((x) => typeof x === "string")
          : undefined,
      lastSeenAt: ts,
    },
  };
}

function fail(
  code: IntelligenceErrorCode,
  message: string,
  meta?: Record<string, unknown>,
  momentHealth?: UiMomentHealth | null
) {
  const payload: IntelligenceFail = {
    ok: false,
    error: { code, message, meta },
    momentHealth: typeof momentHealth === "undefined" ? undefined : momentHealth,
  };

  // Stage D: never 500
  return NextResponse.json(payload, { status: 200 });
}

function buildInputFromBrief(
  brief: any,
  behaviour?: BehaviourControlsInput
): ScriptGenerationInput {
  const trendLabel: string =
    brief?.trendLabel || brief?.trend || brief?.title || "Unnamed cultural moment";

  const objective: string =
    brief?.objective || brief?.goal || "Drive engagement with culturally-aware short-form content.";

  const audience: string =
    brief?.audience || "People who already engage with this type of content.";

  const platform: string =
    brief?.platformOverride || brief?.platformHint || brief?.platform || "tiktok";

  const briefText: string =
    brief?.enhancedBrief ||
    brief?.description ||
    brief?.summary ||
    "No extended description provided; infer from trendLabel and objective.";

  return { trendLabel, objective, audience, platform, briefText, behaviour };
}

function assertNoEmptyScripts(result: ScriptGenerationResult) {
  const failures: Array<{ angleId: string; variantId: string }> = [];

  for (const angle of result.angles ?? []) {
    const angleId = angle?.id ?? "unknown-angle";
    for (const v of angle.variants ?? []) {
      const variantId = v?.id ?? "unknown-variant";
      const hook = typeof v?.hook === "string" ? v.hook.trim() : "";
      const body = typeof v?.body === "string" ? v.body.trim() : "";
      if (!hook && !body) failures.push({ angleId, variantId });
    }
  }

  if (failures.length > 0) {
    const sample = failures.slice(0, 5);
    throw new Error(
      `Engine returned empty script content for ${failures.length} variant(s). Example(s): ${sample
        .map((f) => `${f.angleId}/${f.variantId}`)
        .join(", ")}`
    );
  }
}

function flattenVariants(result: ScriptGenerationResult) {
  const variants: Array<{
    id: string;
    label: string;
    angleName: string;
    body: string;
    notes: string;
    score?: number;
    hook?: string;
    mainBody?: string;
    cta?: string;
    outro?: string;
  }> = [];

  let i = 0;

  for (const angle of result.angles ?? []) {
    const angleName =
      typeof angle?.title === "string" && angle.title.trim()
        ? angle.title.trim()
        : "Angle";

    for (const v of angle.variants ?? []) {
      i += 1;

      const hook = typeof v?.hook === "string" ? v.hook.trim() : "";
      const mainBody = typeof v?.body === "string" ? v.body.trim() : "";
      const cta = typeof v?.cta === "string" ? v.cta.trim() : "";
      const outro = typeof v?.outro === "string" ? v.outro.trim() : "";

      const combined = [hook, mainBody, cta ? `CTA: ${cta}` : "", outro]
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .join("\n\n");

      variants.push({
        id: v?.id || `variant-${i}`,
        label: `Variant ${i}`,
        angleName,
        body: combined,
        notes: typeof v?.structureNotes === "string" ? v.structureNotes : "",
        score:
          typeof v?.confidence === "number" && !Number.isNaN(v.confidence)
            ? Math.max(0, Math.min(10, Math.round(v.confidence * 100) / 10))
            : undefined,
        hook: hook || undefined,
        mainBody: mainBody || undefined,
        cta: cta || undefined,
        outro: outro || undefined,
      });
    }
  }

  return variants;
}

/* ------------------------------------------------------------------ */
/* D.5 identity helpers + priming (unchanged except timestamp safety)  */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  "the","a","an","and","or","of","to","in","on","for","with","by","from","as","at",
  "is","are","was","were","be","been","being","this","that","these","those","it",
  "its","into","over","under","about","how","why","what","when","where","your","my",
  "we","you","i","our","their","they","them","via","new","show","hn","ask","launch",
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

function extractAnchorEntities(
  title: string,
  description: string,
  keywords: string[],
  max = 8
): string[] {
  const text = `${title} ${description}`.replace(/https?:\/\/\S+/g, " ");
  const matches =
    text.match(/\b[A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,3}\b/g) || [];

  const cleaned = matches
    .map((m) => m.trim())
    .filter(Boolean)
    .filter((m) => m.length >= 3)
    .map((m) => m.toLowerCase());

  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of cleaned) {
    if (STOPWORDS.has(e)) continue;
    if (!seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
    if (out.length >= max) break;
  }

  if (out.length === 0) return keywords.slice(0, Math.min(max, keywords.length));
  return out;
}

function buildMomentSignalContext(args: {
  rec: MomentMemoryRecord;
  signalItems: any[];
  windowLabel: string;
}): MomentSignalContext {
  const keywords = Array.isArray((args.rec as any)?.canonical?.signatureKeywords)
    ? (args.rec as any).canonical.signatureKeywords
    : [];
  const entities = Array.isArray((args.rec as any)?.canonical?.anchorEntities)
    ? (args.rec as any).canonical.anchorEntities
    : [];

  const canon = [...keywords, ...entities]
    .map((s) => (typeof s === "string" ? s.trim().toLowerCase() : ""))
    .filter(Boolean);

  const matched: SignalItem[] = [];

  for (const it of args.signalItems ?? []) {
    const srcRaw = typeof it?.source === "string" ? it.source.toLowerCase() : "";
    const source: "hackernews" | "reddit" | "fusion" =
      srcRaw.includes("reddit")
        ? "reddit"
        : srcRaw.includes("hn") || srcRaw.includes("hackernews")
          ? "hackernews"
          : "fusion";

    const title = typeof it?.title === "string" ? it.title : "";
    const summary = typeof it?.summary === "string" ? it.summary : "";
    const text = `${title} ${summary}`.trim();
    if (!text) continue;
    if (canon.length === 0) continue;

    const norm = normalizeText(text);
    const hit = canon.some((term) => term && norm.includes(term));
    if (!hit) continue;

    const evKeywords = extractKeywords(title, summary, 12);
    const evEntities = extractAnchorEntities(title, summary, evKeywords, 8);

    matched.push({ source, text, keywords: evKeywords, entities: evEntities });
    if (matched.length >= 25) break;
  }

  return { windowLabel: args.windowLabel, signals: matched };
}

async function primeMomentMemoryFromLive(origin: string, momentId: string): Promise<boolean> {
  const live = await safeFetchJson(`${origin}/api/trends/live`);
  const trends = Array.isArray(live?.trends) ? live.trends : [];

  const t = trends.find(
    (x: any) =>
      (typeof x?.momentId === "string" && x.momentId === momentId) ||
      (typeof x?.id === "string" && x.id === momentId)
  );

  if (!t) return false;

  const behaviourVersion =
    typeof t?.behaviourVersion === "string" && t.behaviourVersion.trim()
      ? t.behaviourVersion.trim()
      : "";

  const qualificationHash =
    typeof t?.qualificationHash === "string" && t.qualificationHash.trim()
      ? t.qualificationHash.trim()
      : "";

  if (!behaviourVersion || !qualificationHash) return false;

  const name =
    typeof t?.name === "string" && t.name.trim() ? t.name.trim() : "Cultural moment";
  const description =
    typeof t?.description === "string" && t.description.trim() ? t.description.trim() : "";

  const createdAt =
    typeof t?.createdAt === "string" && t.createdAt.trim() ? t.createdAt.trim() : nowIso();

  const sigKeywords = extractKeywords(name, description, 12);
  const anchorEntities = extractAnchorEntities(name, description, sigKeywords, 8);

  const now = nowIso();

  const recordObj = {
    momentId,
    name,
    sources: [{ source: "fusion", clusterId: momentId }],

    // Governance
    qualifiedAt: now,

    // Lifecycle stability (prevents instant EXPIRED)
    firstSeenAt: createdAt,
    lastConfirmedAt: now,

    decayHorizonHours: 72,
    lifecycleStatus: "active",
    qualification: {
      velocityScore: 0,
      coherenceScore: 0,
      noveltyScore: 0,
      qualificationThreshold: 0,
    },
    behaviourVersion,
    qualificationHash,
    canonical: { signatureKeywords: sigKeywords, anchorEntities },
  };

  const record = recordObj as unknown as MomentMemoryRecord;
  (record as any).__writeOnce = true;

  try {
    await Promise.resolve(writeMomentMemory(record) as any);
    return Boolean(getMomentMemory(momentId));
  } catch {
    return false;
  }
}

async function getProvenanceOrFail(momentId: string, origin: string) {
  let rec = getMomentMemory(momentId);

  if (!rec) {
    await primeMomentMemoryFromLive(origin, momentId);
    rec = getMomentMemory(momentId);
  }

  if (!rec) {
    return {
      ok: false as const,
      response: fail(
        "MOMENT_NOT_QUALIFIED",
        "Selected moment is not governed (no Moment Memory record). Go to Trends → refresh Live moments → select a qualified moment → re-create/activate the brief → then generate scripts again.",
        { momentId },
        {
          isValid: false,
          lifecycleState: "ungoverned",
          lastEvaluatedAt: nowIso(),
          thresholds: { sisPass: 40, icsPass: 60 },
          sis: 0,
          ics: 0,
          explain: [
            {
              kind: "fail",
              title: "Moment not governed",
              message: "No Moment Memory record exists for this momentId in this instance.",
              details: { momentId },
            },
          ],
        }
      ),
    };
  }

  const provenance: IntelligenceProvenance = {
    momentId: rec.momentId,
    behaviourVersion: (rec as any).behaviourVersion,
    qualificationHash: (rec as any).qualificationHash,
  };

  assertProvenance(provenance);

  return { ok: true as const, provenance, rec };
}

/* ------------------------------------------------------------------ */
/* Route                                                               */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const brief = body?.brief ?? null;
    const behaviour: BehaviourControlsInput | undefined = body?.behaviour ?? undefined;

    if (!brief) return fail("BAD_REQUEST", "Missing 'brief' in request body.");

    const origin = buildOriginFromRequest(req);

    const momentId: string | null =
      (typeof body?.momentId === "string" && body.momentId.trim() ? body.momentId.trim() : null) ??
      (typeof brief?.momentId === "string" && brief.momentId.trim() ? brief.momentId.trim() : null);

    if (!momentId) {
      return fail(
        "BAD_REQUEST",
        "Missing 'momentId'. Stage D.4 requires body.momentId (preferred) or brief.momentId. Do not use brief.id."
      );
    }

    const prov = await getProvenanceOrFail(momentId, origin);
    if (!prov.ok) return prov.response;

    const signals = await safeFetchJson(`${origin}/api/signals`);
    const available = Boolean(signals?.available);
    const items = Array.isArray(signals?.items) ? signals.items : [];
    const sources = Array.isArray(signals?.sources) ? signals.sources : [];

    if (!signals || !available) {
      return fail(
        "SIGNALS_UNAVAILABLE",
        "Signals unavailable: no healthy upstream sources.",
        { sources },
        {
          isValid: false,
          lifecycleState: "signals-unavailable",
          lastEvaluatedAt: nowIso(),
          thresholds: { sisPass: 40, icsPass: 60 },
          sis: 0,
          ics: 0,
          explain: [
            {
              kind: "fail",
              title: "Signals unavailable",
              message: "No healthy upstream sources.",
              details: { sources },
            },
          ],
          provenance: { sourceNames: sources, lastSeenAt: nowIso() },
        }
      );
    }

    if (items.length === 0) {
      return fail(
        "SIGNALS_EMPTY",
        "Signals available but empty: no usable signal items returned.",
        { sources },
        {
          isValid: false,
          lifecycleState: "signals-empty",
          lastEvaluatedAt: nowIso(),
          thresholds: { sisPass: 40, icsPass: 60 },
          sis: 0,
          ics: 0,
          explain: [
            {
              kind: "fail",
              title: "Signals empty",
              message: "Upstream sources returned zero usable items.",
              details: { sources },
            },
          ],
          provenance: { sourceNames: sources, lastSeenAt: nowIso() },
        }
      );
    }

    if (!prov.rec?.canonical) {
      return fail(
        "MOMENT_CANONICAL_MISSING",
        "Moment canonical identity is missing. Refresh Live moments (to rewrite memory) and select a qualified moment again.",
        { momentId },
        {
          isValid: false,
          lifecycleState: "canonical-missing",
          lastEvaluatedAt: nowIso(),
          thresholds: { sisPass: 40, icsPass: 60 },
          sis: 0,
          ics: 0,
          explain: [
            {
              kind: "fail",
              title: "Canonical identity missing",
              message: "No canonical.signatureKeywords / anchorEntities on memory record.",
              details: { momentId },
            },
          ],
          provenance: { sourceNames: sources, lastSeenAt: nowIso() },
        }
      );
    }

    const momentSignalContext = buildMomentSignalContext({
      rec: prov.rec,
      signalItems: items,
      windowLabel: "latest_signals",
    });

    // ✅ Lifecycle evaluator must receive stable timestamps (prevents instant EXPIRED)
    const recForEval = ensureLifecycleTimestamps(prov.rec);

    const evalHealth = evaluateMomentLifecycle({
      memory: recForEval,
      signalContext: momentSignalContext,
      thresholds: DEFAULT_MOMENT_LIFECYCLE_THRESHOLDS,
    });

    const uiMomentHealth = toUiMomentHealth({
      momentId,
      evalResult: evalHealth,
      thresholds: DEFAULT_MOMENT_LIFECYCLE_THRESHOLDS,
      matchedSignals: momentSignalContext.signals ?? [],
      allSources: sources,
      rec: recForEval,
    });

    if (evalHealth?.state === "INVALID" || uiMomentHealth.isValid === false) {
      const reason = evalHealth?.invalidReason;

      if (reason === "IDENTITY_DRIFT") {
        return fail(
          "MOMENT_DRIFTED",
          "Moment identity drifted. Regenerate Live moments and select a currently valid momentId.",
          { momentId },
          uiMomentHealth
        );
      }

      return fail(
        "MOMENT_INVALID",
        "Moment is no longer valid for script generation (insufficient matching live signals). Refresh Live moments and select a currently valid momentId.",
        { momentId },
        uiMomentHealth
      );
    }

    const input = buildInputFromBrief(brief, behaviour);

    let engineResult: ScriptGenerationResult;
    try {
      engineResult = await generateAnglesAndVariantsFromBrief(input);
    } catch (e: any) {
      console.error("[/api/scripts/intelligence] Engine error:", e);
      return fail(
        "ENGINE_ERROR",
        e?.message ?? "Engine failed while generating scripts. Please try again.",
        { sources },
        uiMomentHealth
      );
    }

    try {
      assertNoEmptyScripts(engineResult);
    } catch (e: any) {
      console.warn("[/api/scripts/intelligence] Empty script guard hit:", e);
      return fail(
        "ENGINE_EMPTY_SCRIPTS",
        e?.message ?? "Engine returned empty script content.",
        { sources },
        uiMomentHealth
      );
    }

    const variants = flattenVariants(engineResult);

    const okPayload: IntelligenceOkPayload = {
      ok: true,
      cultural: (engineResult as any)?.snapshot ?? null,
      momentSignal: (engineResult as any)?.momentSignal ?? null,
      variants,
      result: engineResult,
      momentHealth: uiMomentHealth,
    };

    const envelope = {
      provenance: prov.provenance,
      payload: okPayload,
    } as unknown as IntelligentOutputEnvelope<IntelligenceOkPayload>;

    return NextResponse.json(
      { ...okPayload, provenance: prov.provenance, envelope },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/scripts/intelligence] Unhandled error", err);
    return fail(
      "ENGINE_ERROR",
      err?.message ?? "Unexpected error while generating script variants. Please try again."
    );
  }
}
