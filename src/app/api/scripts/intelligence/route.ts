// src/app/api/scripts/intelligence/route.ts
//
// Stage D — Intelligence Hardening & Signal Stability
//
// Rules enforced here:
// - Never return 500 (no platform can break the app)
// - Gate intelligence on /api/signals availability
// - Never silently return empty scripts
// - Response shape stays compatible with current UI

import { NextResponse } from "next/server";
import { generateAnglesAndVariantsFromBrief } from "@/lib/intelligence/intelligenceEngine";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
} from "@/lib/intelligence/types";

export const dynamic = "force-dynamic";

/**
 * Stage D: typed failure codes for UI-safe, loud failures.
 */
type IntelligenceErrorCode =
  | "BAD_REQUEST"
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

type IntelligenceOk = {
  ok: true;
  cultural: any;
  momentSignal: any;
  variants: any[];
  result: ScriptGenerationResult;
};

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
 * Keep this small and forgiving; deeper validation belongs elsewhere later.
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
 * Hard guard: if the engine returns blank scripts, we treat it as a failure.
 * This prevents “variants exist but no scripts” regressions from silently shipping.
 */
function assertNoEmptyScripts(result: ScriptGenerationResult) {
  const failures: Array<{ angleId: string; variantId: string }> = [];

  for (const angle of result.angles ?? []) {
    const angleId = angle?.id ?? "unknown-angle";

    for (const v of angle.variants ?? []) {
      const variantId = v?.id ?? "unknown-variant";

      const hook = typeof v?.hook === "string" ? v.hook.trim() : "";
      const body = typeof v?.body === "string" ? v.body.trim() : "";

      // At minimum we need *some* script content (hook and/or body).
      if (!hook && !body) {
        failures.push({ angleId, variantId });
      }
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
 * Compatibility layer:
 * - Current UI expects a flat `variants[]` list.
 * - Canonical engine returns `angles[]` with nested `variants[]`.
 *
 * IMPORTANT:
 * ScriptOutput’s “structured view” expects `hook`, `mainBody`, `cta`, `outro`.
 * So we provide those fields here (and still keep the combined `body` string).
 */
function flattenVariants(result: ScriptGenerationResult) {
  const variants: Array<{
    id: string;
    label: string;
    angleName: string;

    // Back-compat (used by older UI paths + copy)
    body: string;
    notes: string;
    score?: number;

    // Structured fields (used by ScriptOutput structured renderer)
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

      // Trim to avoid “whitespace-only” content counting as real script text
      const hook = typeof v?.hook === "string" ? v.hook.trim() : "";
      const mainBody = typeof v?.body === "string" ? v.body.trim() : "";
      const cta = typeof v?.cta === "string" ? v.cta.trim() : "";
      const outro = typeof v?.outro === "string" ? v.outro.trim() : "";

      // Combined fallback text (safe for copy + legacy renderers)
      const combined = [hook, mainBody, cta ? `CTA: ${cta}` : "", outro]
        .filter((s) => typeof s === "string" && s.trim().length > 0)
        .join("\n\n");

      variants.push({
        id: v?.id || `variant-${i}`,
        label: `Variant ${i}`,
        angleName,

        body: combined,
        notes: typeof v?.structureNotes === "string" ? v.structureNotes : "",

        // confidence is 0–1 → map to 0–10 (1 decimal place)
        score:
          typeof v?.confidence === "number" && !Number.isNaN(v.confidence)
            ? Math.max(0, Math.min(10, Math.round(v.confidence * 100) / 10))
            : undefined,

        // Structured pieces for ScriptOutput
        hook: hook || undefined,
        mainBody: mainBody || undefined,
        cta: cta || undefined,
        outro: outro || undefined,
      });
    }
  }

  return variants;
}

function fail(
  code: IntelligenceErrorCode,
  message: string,
  meta?: Record<string, unknown>
) {
  const payload: IntelligenceFail = {
    ok: false,
    error: { code, message, meta },
  };
  // Stage D: never 500. We fail loudly via typed payload.
  return NextResponse.json(payload, { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const brief = body?.brief ?? null;
    const behaviour: BehaviourControlsInput | undefined =
      body?.behaviour ?? undefined;

    if (!brief) {
      return fail("BAD_REQUEST", "Missing 'brief' in request body.");
    }

    // Stage D gate: intelligence only runs if signals are available + non-empty.
    // IMPORTANT: Use absolute URL only in local dev. For deployment we’ll switch to relative.
    const signals = await safeFetchJson("http://localhost:3000/api/signals");

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

    // Build input from brief (UI data). Signals are currently used for upstream stability gating.
    // We will pass normalized signals into the engine in the next step (without refactoring the UI).
    const input = buildInputFromBrief(brief, behaviour);

    let engineResult: ScriptGenerationResult;
    try {
      engineResult = await generateAnglesAndVariantsFromBrief(input);
    } catch (e: any) {
      console.error("[/api/scripts/intelligence] Engine error:", e);
      return fail(
        "ENGINE_ERROR",
        e?.message ??
          "Engine failed while generating scripts. Please try again.",
        { sources }
      );
    }

    // Pro guard: never silently ship empty scripts.
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

    // Flatten for current UI, while keeping canonical result available.
    const variants = flattenVariants(engineResult);

    const okPayload: IntelligenceOk = {
      ok: true,

      // Compatibility (current UI)
      cultural: engineResult.snapshot ?? null,
      momentSignal: engineResult.momentSignal ?? null,
      variants,

      // Canonical Stage D output (for new UI surfaces / future work)
      result: engineResult,
    };

    return NextResponse.json(okPayload, { status: 200 });
  } catch (err: any) {
    console.error("[/api/scripts/intelligence] Unhandled error", err);
    return fail(
      "ENGINE_ERROR",
      err?.message ??
        "Unexpected error while generating script variants. Please try again."
    );
  }
}
