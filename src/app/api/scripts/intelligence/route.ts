// src/app/api/scripts/intelligence/route.ts

import { NextResponse } from "next/server";
import { generateAnglesAndVariantsFromBrief } from "@/lib/intelligence/intelligenceEngine";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
} from "@/lib/intelligence/types";

/**
 * NOTE (Stage D):
 * This route is a delegator.
 * - It does NOT talk to OpenAI directly.
 * - It calls the internal CIE/MSE engine via the public wrapper.
 * This keeps one canonical brain and prevents fragile parsing failures.
 */

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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const brief = body?.brief ?? null;
    const behaviour: BehaviourControlsInput | undefined =
      body?.behaviour ?? undefined;

    if (!brief) {
      return NextResponse.json(
        { error: "Missing 'brief' in request body." },
        { status: 400 }
      );
    }

    const input = buildInputFromBrief(brief, behaviour);
    const engineResult = await generateAnglesAndVariantsFromBrief(input);

    // Pro guard: never silently ship empty scripts.
    assertNoEmptyScripts(engineResult);

    // Flatten for current UI, while keeping canonical result available.
    const variants = flattenVariants(engineResult);

    return NextResponse.json(
      {
        // Compatibility (current UI)
        cultural: engineResult.snapshot ?? null,
        momentSignal: engineResult.momentSignal ?? null,
        variants,

        // Canonical Stage D output (for new UI surfaces / future work)
        result: engineResult,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/scripts/intelligence] Unhandled error", err);
    return NextResponse.json(
      {
        error:
          err?.message ??
          "Unexpected error while generating script variants. Please try again.",
      },
      { status: 500 }
    );
  }
}
