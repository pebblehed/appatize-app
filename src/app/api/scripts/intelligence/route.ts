// src/app/api/scripts/intelligence/route.ts

import { NextResponse } from "next/server";
import {
  generateAnglesAndVariantsFromBrief,
} from "@/lib/intelligence/angleEngine"; // ← your real engine file
import type {
  ScriptGenerationInput,
  AngleWithVariants,
  BehaviourControlsInput,
  MomentSignal,
} from "@/lib/intelligence/types";
import type { ScriptVariant } from "@/components/variant/VariantsTabs";

/* -------------------------
   Helpers
--------------------------*/

function mapBriefToInput(
  brief: any,
  behaviour?: BehaviourControlsInput
): ScriptGenerationInput {
  const trendLabel =
    brief.trendLabel ||
    brief.trend ||
    brief.title ||
    "Untitled trend";

  const objective =
    brief.objective ||
    brief.goal ||
    "Drive meaningful engagement around this topic.";

  const audience =
    brief.audience ||
    brief.audienceDescription ||
    "Target audience not specified.";

  const platform =
    brief.platformOverride ||
    brief.platformHint ||
    brief.platform ||
    "tiktok";

  const briefText =
    brief.enhancedBrief ||
    brief.description ||
    brief.summary ||
    brief.content ||
    JSON.stringify(brief, null, 2);

  return {
    trendLabel,
    objective,
    audience,
    platform,
    briefText,
    behaviour,
  };
}

function flattenAnglesToScriptVariants(
  angles: AngleWithVariants[]
): (ScriptVariant & {
  hook?: string;
  mainBody?: string;
  cta?: string;
  outro?: string;
})[] {
  const result: (ScriptVariant & {
    hook?: string;
    mainBody?: string;
    cta?: string;
    outro?: string;
  })[] = [];

  angles.forEach((angle, angleIndex) => {
    angle.variants.forEach((variant, variantIndex) => {
      const score0to10 = Math.round(
        Math.max(0, Math.min(1, variant.confidence)) * 10
      );

      const combinedParts: string[] = [];

      if (variant.hook) combinedParts.push(variant.hook.trim());
      if (variant.body) combinedParts.push(variant.body.trim());
      if (variant.cta) combinedParts.push(`CTA: ${variant.cta.trim()}`);
      if (variant.outro) combinedParts.push(variant.outro.trim());

      const combinedBody = combinedParts.join("\n\n");

      result.push({
        id: variant.id || `${angle.id}-v${variantIndex + 1}`,
        label: `Variant ${variantIndex + 1}`,
        body: combinedBody,
        angleName: angle.title,
        notes: variant.structureNotes,
        score: score0to10,

        hook: variant.hook,
        mainBody: variant.body,
        cta: variant.cta,
        outro: variant.outro,
      });
    });
  });

  return result;
}

/* -----------------------------
   Cultural Snapshot v2 Builder
------------------------------*/
function buildCulturalSnapshotV2(
  angles: AngleWithVariants[],
  behaviour?: BehaviourControlsInput
) {
  if (!angles || angles.length === 0) return null;

  const primary = angles[0];

  return {
    culturalContext: primary.culturalTrigger,
    momentInsight: primary.audienceHook,

    flowGuidance: `Lean into a ${primary.narrativePattern} pattern at ${behaviour?.energy ?? primary.energy} energy on ${
      behaviour?.platformBias ?? primary.platform
    }.`,
    creativePrinciple: `Anchor the POV in: ${primary.pov}`,

    culturalDynamics: `This trend sits within the wider cultural story around ${primary.culturalTrigger}.`,
    audienceMood: `Audience sensitivity is shaped by: ${primary.audienceHook}.`,
    platformStylePulse: `Platform tilt: ${behaviour?.platformBias ?? primary.platform}.`,
    creativeLevers: `Use ${primary.narrativePattern} structure with ${
      behaviour?.rhythm ?? "medium"
    } pacing.`,
  };
}

/* -----------------------------
   POST Handler
------------------------------*/

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const brief = body.brief;
    const behaviour: BehaviourControlsInput | undefined = body.behaviour;

    if (!brief) {
      return NextResponse.json(
        { error: "Missing brief in request." },
        { status: 400 }
      );
    }

    const input = mapBriefToInput(brief, behaviour);

    // 🔥 The Intelligence Engine
    const result = await generateAnglesAndVariantsFromBrief(input);

    const variants = flattenAnglesToScriptVariants(result.angles);

    // Snapshot v2
    const cultural = buildCulturalSnapshotV2(result.angles, input.behaviour);

    // MSE — pass through from engine if available
    const momentSignal: MomentSignal | null =
      result.momentSignal ?? null;

    return NextResponse.json({
      variants,
      cultural,
      momentSignal,
    });
  } catch (err: any) {
    console.error("[api/scripts/intelligence] error", err);

    return NextResponse.json(
      {
        error:
          err?.message ||
          "Something went wrong while generating script variants.",
      },
      { status: 500 }
    );
  }
}
