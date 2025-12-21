// src/app/api/scripts/legacy/route.ts
//
// Stage D.4 — Legacy Scripts Route (Governed + Non-breaking)
//
// This route exists ONLY for older UI paths / historical compatibility.
// It must NEVER weaken platform stability if called.
//
// Rules enforced here:
// - Never return 500 (always 200 with typed payload)
// - Require qualified moment provenance (D.4): momentId must exist in memory
// - Return a governed envelope { provenance, payload }
// - Avoid localhost hard-coding (works in Vercel)

import { NextRequest, NextResponse } from "next/server";
import { generateAnglesAndVariantsFromBrief } from "@/lib/intelligence/intelligenceEngine";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
} from "@/lib/intelligence/types";

// D.4 provenance enforcement
import { getMomentMemory } from "@internal/cie/momentMemory";
import { assertProvenance } from "@internal/cie/assertProvenance";
import type {
  IntelligenceProvenance,
  IntelligentOutputEnvelope,
} from "@internal/contracts/INTELLIGENT_OUTPUT_ENVELOPE";

export const dynamic = "force-dynamic";

/**
 * Stage D: typed failure codes for UI-safe, loud failures.
 */
type LegacyErrorCode =
  | "BAD_REQUEST"
  | "MOMENT_NOT_QUALIFIED"
  | "SIGNALS_UNAVAILABLE"
  | "SIGNALS_EMPTY"
  | "ENGINE_EMPTY_SCRIPTS"
  | "ENGINE_ERROR";

type LegacyFail = {
  ok: false;
  deprecated: true;
  error: {
    code: LegacyErrorCode;
    message: string;
    meta?: Record<string, unknown>;
  };
};

type LegacyOk = {
  ok: true;
  deprecated: true;
  message: string;

  // Keep a compatible top-level `variants` for older consumers (even if unused now).
  variants: any[];

  // Optional compat fields (safe to include if present)
  cultural?: any;
  momentSignal?: any;

  // Canonical output (future-safe)
  result: ScriptGenerationResult;
};

function fail(code: LegacyErrorCode, message: string, meta?: Record<string, unknown>) {
  const payload: LegacyFail = {
    ok: false,
    deprecated: true,
    error: { code, message, meta },
  };
  // Stage D: never 500 — always 200 with typed payload
  return NextResponse.json(payload, { status: 200 });
}

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

/**
 * Convert whatever the UI sends as `brief` into the canonical ScriptGenerationInput.
 * Small + forgiving; deeper validation belongs elsewhere later.
 */
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
    brief?.platformOverride ||
    brief?.platformHint ||
    brief?.platform ||
    "tiktok";

  const briefText: string =
    brief?.enhancedBrief ||
    brief?.description ||
    brief?.summary ||
    "No extended description provided; infer from trendLabel and objective.";

  return {
    trendLabel,
    objective,
    audience,
    platform,
    briefText,
    behaviour,
  };
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
 * Compatibility layer: flatten canonical angles[] → variants[] (legacy consumers)
 */
function flattenVariants(result: ScriptGenerationResult) {
  const variants: any[] = [];
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

/**
 * D.4 provenance enforcement.
 * If the moment isn't in memory, it isn't a qualified/governed moment.
 */
function getProvenanceOrFail(momentId: string) {
  const rec = getMomentMemory(momentId);

  if (!rec) {
    return {
      ok: false as const,
      response: fail(
        "MOMENT_NOT_QUALIFIED",
        "Moment is not qualified (no memory record). Use /api/trends/live to generate qualified moments first, then pass a valid momentId.",
        { momentId }
      ),
    };
  }

  const provenance: IntelligenceProvenance = {
    momentId: rec.momentId,
    behaviourVersion: rec.behaviourVersion,
    qualificationHash: rec.qualificationHash,
  };

  // Throws if malformed (we want this to be caught + returned as typed fail)
  assertProvenance(provenance);

  return { ok: true as const, provenance };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const brief = body?.brief ?? null;
    const behaviour: BehaviourControlsInput | undefined = body?.behaviour ?? undefined;

    if (!brief) {
      return fail("BAD_REQUEST", "Missing 'brief' in request body.");
    }

    // Stage D.4: require momentId for governed output.
    // Accept body.momentId OR brief.momentId OR brief.id as a practical bridge.
    const momentId: string | null =
      (typeof body?.momentId === "string" && body.momentId.trim()
        ? body.momentId.trim()
        : null) ??
      (typeof brief?.momentId === "string" && String(brief.momentId).trim()
        ? String(brief.momentId).trim()
        : null) ??
      (typeof brief?.id === "string" && String(brief.id).trim()
        ? String(brief.id).trim()
        : null);

    if (!momentId) {
      return fail(
        "BAD_REQUEST",
        "Missing momentId. Provide body.momentId (preferred) or brief.momentId / brief.id."
      );
    }

    const prov = getProvenanceOrFail(momentId);
    if (!prov.ok) return prov.response;

    // Stage D stability gate: require /api/signals healthy + non-empty.
    // Use same-origin (works in Vercel).
    const origin = buildOriginFromRequest(req);
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
      console.error("[/api/scripts/legacy] Engine error:", e);
      return fail(
        "ENGINE_ERROR",
        e?.message ?? "Engine failed while generating scripts. Please try again.",
        { sources }
      );
    }

    try {
      assertNoEmptyScripts(engineResult);
    } catch (e: any) {
      console.warn("[/api/scripts/legacy] Empty script guard hit:", e);
      return fail(
        "ENGINE_EMPTY_SCRIPTS",
        e?.message ?? "Engine returned empty script content.",
        { sources }
      );
    }

    const okPayload: LegacyOk = {
      ok: true,
      deprecated: true,
      message:
        "Legacy route. Prefer /api/scripts/intelligence for the active Stage D pipeline. This endpoint is retained for legacy/testing only.",
      variants: flattenVariants(engineResult),
      cultural: engineResult.snapshot ?? null,
      momentSignal: engineResult.momentSignal ?? null,
      result: engineResult,
    };

    const envelope: IntelligentOutputEnvelope<LegacyOk> = {
      provenance: prov.provenance,
      payload: okPayload,
    };

    return NextResponse.json(
      {
        ...okPayload,
        provenance: prov.provenance,
        envelope,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/scripts/legacy] Unhandled error", err);
    return fail(
      "ENGINE_ERROR",
      err?.message ?? "Unexpected error while generating scripts. Please try again."
    );
  }
}
