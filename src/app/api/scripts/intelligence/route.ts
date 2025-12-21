// src/app/api/scripts/intelligence/route.ts
//
// Stage D — Intelligence Hardening & Signal Stability
//
// Stage D.4 — Provenance Enforcement (wired)
// - Require momentId (from body or brief)
// - Load D.4 memory record
// - Enforce provenance: momentId + behaviourVersion + qualificationHash
// - Return BOTH: legacy shape + envelope { provenance, payload } (UI-safe)
//
// Stage D.4.2 — Runtime-safe memory priming (fix)
// - In-memory store cannot be trusted across serverless instances.
// - If memory is missing, pull provenance from /api/trends/live and
//   write the record LOCALLY inside this route instance, then retry.

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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

type IntelligenceErrorCode =
  | "BAD_REQUEST"
  | "MOMENT_NOT_QUALIFIED"
  | "SIGNALS_UNAVAILABLE"
  | "SIGNALS_EMPTY"
  | "ENGINE_EMPTY_SCRIPTS"
  | "ENGINE_ERROR";

type IntelligenceFail = {
  ok: false;
  error: {
    code: IntelligenceErrorCode;
    message: string;
    meta?: Record<string, unknown>;
  };
};

type IntelligenceOkPayload = {
  ok: true;
  cultural: any;
  momentSignal: any;
  variants: any[];
  result: ScriptGenerationResult;
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

function fail(
  code: IntelligenceErrorCode,
  message: string,
  meta?: Record<string, unknown>
) {
  const payload: IntelligenceFail = { ok: false, error: { code, message, meta } };
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
    brief?.objective ||
    brief?.goal ||
    "Drive engagement with culturally-aware short-form content.";

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

/**
 * Hard guard: if the engine returns blank scripts, treat it as a failure.
 */
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

/**
 * Flatten canonical angles[] → UI variants[]
 * ScriptOutput expects hook/mainBody/cta/outro.
 */
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
/* D.4.2 — Memory priming                                              */
/* ------------------------------------------------------------------ */

/**
 * Prime local moment memory from /api/trends/live (governed surface).
 * Hard rule: only prime if live returns behaviourVersion + qualificationHash.
 *
 * IMPORTANT:
 * - We do NOT "invent" provenance.
 * - We only accept moments that the live governed surface emits.
 */
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

  const nowIso = new Date().toISOString();

  // Build as plain object first (prevents TS squiggles if contract differs slightly)
  const recordObj = {
    momentId,
    name:
      typeof t?.name === "string" && t.name.trim() ? t.name.trim() : "Cultural moment",
    sources: [{ source: "live-surface", clusterId: momentId }],
    qualifiedAt: nowIso,
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
  };

  const record = recordObj as unknown as MomentMemoryRecord;
  (record as any).__writeOnce = true;

  try {
    // Some implementations return void; treat “no throw” as success
    await Promise.resolve(writeMomentMemory(record) as any);
    return Boolean(getMomentMemory(momentId));
  } catch {
    return false;
  }
}

/**
 * Build provenance from D.4 moment memory.
 * If missing, attempt to prime memory locally from /api/trends/live once.
 */
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
        { momentId }
      ),
    };
  }

  const provenance: IntelligenceProvenance = {
    momentId: rec.momentId,
    behaviourVersion: rec.behaviourVersion,
    qualificationHash: rec.qualificationHash,
  };

  // Hard enforcement
  assertProvenance(provenance);

  return { ok: true as const, provenance };
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

    // Strict momentId only (never fall back to brief.id)
    const momentId: string | null =
      (typeof body?.momentId === "string" && body.momentId.trim()
        ? body.momentId.trim()
        : null) ??
      (typeof brief?.momentId === "string" && brief.momentId.trim()
        ? brief.momentId.trim()
        : null);

    if (!momentId) {
      return fail(
        "BAD_REQUEST",
        "Missing 'momentId'. Stage D.4 requires body.momentId (preferred) or brief.momentId. Do not use brief.id."
      );
    }

    const prov = await getProvenanceOrFail(momentId, origin);
    if (!prov.ok) return prov.response;

    // Stage D gate: intelligence only runs if signals are available + non-empty.
    const signals = await safeFetchJson(`${origin}/api/signals`);
    const available = Boolean(signals?.available);
    const items = Array.isArray(signals?.items) ? signals.items : [];
    const sources = Array.isArray(signals?.sources) ? signals.sources : [];

    if (!signals || !available) {
      return fail(
        "SIGNALS_UNAVAILABLE",
        "Signals unavailable: no healthy upstream sources.",
        { sources }
      );
    }

    if (items.length === 0) {
      return fail(
        "SIGNALS_EMPTY",
        "Signals available but empty: no usable signal items returned.",
        { sources }
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
        { sources }
      );
    }

    try {
      assertNoEmptyScripts(engineResult);
    } catch (e: any) {
      console.warn("[/api/scripts/intelligence] Empty script guard hit:", e);
      return fail(
        "ENGINE_EMPTY_SCRIPTS",
        e?.message ?? "Engine returned empty script content.",
        { sources }
      );
    }

    const variants = flattenVariants(engineResult);

    const okPayload: IntelligenceOkPayload = {
      ok: true,
      cultural: (engineResult as any)?.snapshot ?? null,
      momentSignal: (engineResult as any)?.momentSignal ?? null,
      variants,
      result: engineResult,
    };

    // Some envelope contracts are strict; cast once to keep TS clean.
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
      err?.message ??
        "Unexpected error while generating script variants. Please try again."
    );
  }
}
