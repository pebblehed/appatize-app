// internal/cie/intelligenceEngine.ts

import OpenAI from "openai";
import type {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
  BehaviourPlatform,
  BehaviourRhythm,
  NarrativePattern,
  AngleEnergy,
} from "../../src/lib/intelligence/types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are the Cultural Intelligence Engine (CIE) + Moment-Signal Extraction (MSE) layer inside Appatize.

Non-negotiables:
- Output MUST be STRICT JSON (no markdown, no commentary).
- Do NOT output empty strings for any required script fields.
- Every variant MUST contain a real hook + body + structureNotes.
- If uncertain, make a reasonable creative choice rather than leaving blanks.

Quality rules:
- Scripts must feel human and creator-native.
- Be specific to platform + audience.
- Avoid generic content; show cultural awareness and specificity.
- Angles must differ in POV, energy, and narrative pattern.
`;

/**
 * Normalise behaviour labels from UI/back-compat values into the canonical
 * values the engine expects. This reduces model confusion and improves stability.
 */
function normaliseBehaviour(
  behaviour?: BehaviourControlsInput
): BehaviourControlsInput | undefined {
  if (!behaviour) return undefined;

  const next: BehaviourControlsInput = { ...behaviour };

  // Energy: allow older labels low/steady/high → low-key/balanced/high-energy
  if (next.energy === "low") next.energy = "low-key";
  if (next.energy === "steady") next.energy = "balanced";
  if (next.energy === "high") next.energy = "high-energy";

  // Rhythm: allow older labels snappy/balanced/story → short/medium/narrative
  if (next.rhythm === "snappy") next.rhythm = "short";
  if (next.rhythm === "balanced") next.rhythm = "medium";
  if (next.rhythm === "story") next.rhythm = "narrative";

  return next;
}

// Helper to describe behaviour controls to the model
function describeBehaviourInPrompt(behaviour?: BehaviourControlsInput): string {
  if (!behaviour) {
    return "Behaviour controls: default (balanced energy, medium pacing, no explicit platform bias).";
  }

  const parts: string[] = [];

  if (behaviour.energy) {
    const e = behaviour.energy as AngleEnergy;
    parts.push(`Energy: ${e} (low-key | balanced | high-energy).`);
  }

  if (behaviour.rhythm) {
    const r = behaviour.rhythm as BehaviourRhythm;
    parts.push(`Rhythm: ${r} (short | medium | narrative).`);
  }

  const platformBias: BehaviourPlatform | undefined =
    behaviour.platformBias ?? behaviour.platform;

  if (platformBias) {
    parts.push(`Platform bias: ${platformBias} (adapt pacing + framing).`);
  }

  if (behaviour.narrativePatternBias) {
    const np = behaviour.narrativePatternBias as NarrativePattern | "mixed";
    parts.push(`Narrative pattern bias: ${np}.`);
  }

  if (behaviour.tone) {
    parts.push(`Tone: ${behaviour.tone} (clean | warm | bold | playful).`);
  }

  return `Behaviour controls:\n${parts.join("\n")}`;
}

/**
 * Pro-grade contract enforcement:
 * - We allow the model to be creative
 * - But we DO NOT allow blank required script fields
 * - We fix ids + clamp confidence, then validate.
 */
function normaliseAndValidate(parsed: ScriptGenerationResult): ScriptGenerationResult {
  const angles = Array.isArray(parsed.angles) ? parsed.angles : [];

  const safeAngles = angles.map((a, ai) => {
    const angleId = a?.id || `angle-${ai + 1}`;
    const variants = Array.isArray(a?.variants) ? a.variants : [];

    const safeVariants = variants.map((v, vi) => {
      const id = v?.id || `${angleId}-variant-${vi + 1}`;
      const parentAngleId = v?.parentAngleId || angleId;

      const hook = typeof v?.hook === "string" ? v.hook : "";
      const body = typeof v?.body === "string" ? v.body : "";
      const structureNotes =
        typeof v?.structureNotes === "string" ? v.structureNotes : "";

      const confidence =
        typeof v?.confidence === "number" && !Number.isNaN(v.confidence)
          ? Math.max(0.5, Math.min(1.0, v.confidence))
          : 0.7;

      // HARD FAIL if required fields are blank/empty
      if (!hook.trim() || !body.trim() || !structureNotes.trim()) {
        throw new Error(
          `Engine contract violated: blank script fields returned (angle=${angleId}, variant=${id}).`
        );
      }

      return {
        ...v,
        id,
        parentAngleId,
        hook,
        body,
        cta: typeof v?.cta === "string" ? v.cta : undefined,
        outro: typeof v?.outro === "string" ? v.outro : undefined,
        structureNotes,
        confidence,
      };
    });

    return {
      ...a,
      id: angleId,
      variants: safeVariants,
    };
  });

  return {
    ...parsed,
    angles: safeAngles,
  };
}

export async function generateAnglesAndVariantsFromBrief(
  input: ScriptGenerationInput
): Promise<ScriptGenerationResult> {
  const { trendLabel, objective, audience, platform, briefText } = input;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[intelligenceEngine] Missing OPENAI_API_KEY");
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const behaviour = normaliseBehaviour(input.behaviour);
  const behaviourDescription = describeBehaviourInPrompt(behaviour);

  // IMPORTANT: show the model the exact output schema + ban empty strings.
  const userPrompt = `
TREND:
${trendLabel}

OBJECTIVE:
${objective}

AUDIENCE:
${audience}

PLATFORM:
${platform}

BRIEF:
${briefText}

${behaviourDescription}

Return STRICT JSON ONLY with this exact shape:

{
  "angles": [
    {
      "id": "angle-1",
      "title": "Angle title",
      "pov": "chosen POV",
      "platform": "${platform}",
      "culturalTrigger": "cultural hook/tension",
      "audienceHook": "why it lands",
      "narrativePattern": "opinion|story|list|myth-busting|how-to|hot-take",
      "energy": "low-key|balanced|high-energy",
      "warnings": ["optional"],
      "variants": [
        {
          "id": "angle-1-variant-1",
          "parentAngleId": "angle-1",
          "hook": "REQUIRED — NOT EMPTY",
          "body": "REQUIRED — NOT EMPTY",
          "cta": "optional",
          "outro": "optional",
          "structureNotes": "REQUIRED — NOT EMPTY",
          "confidence": 0.5
        }
      ]
    }
  ],
  "snapshot": {
    "culturalContext": "optional",
    "momentInsight": "optional",
    "flowGuidance": "optional",
    "creativePrinciple": "optional",
    "culturalDynamics": "optional",
    "audienceMood": "optional",
    "platformStylePulse": "optional",
    "creativeLevers": "optional"
  },
  "momentSignal": {
    "coreMoment": "optional",
    "culturalTension": "optional",
    "stakes": "optional",
    "contentRole": "optional",
    "watchouts": ["optional"],
    "freshness": "evergreen|timely|flash-trend"
  }
}

Rules:
- 3–5 angles.
- 4–6 variants per angle.
- No empty strings for hook/body/structureNotes.
- JSON only, nothing else.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    // Slightly lower temp improves compliance with "no blanks"
    temperature: 0.55,
  });

  const raw = completion.choices[0]?.message?.content;

  if (!raw) {
    console.error("[intelligenceEngine] Empty content from OpenAI", completion);
    throw new Error("No content returned from OpenAI");
  }

  let parsed: ScriptGenerationResult;
  try {
    parsed = JSON.parse(raw) as ScriptGenerationResult;
  } catch (err) {
    console.error("[intelligenceEngine] Failed to parse JSON", err, raw);
    throw new Error("Failed to parse script generation JSON");
  }

  if (!parsed.angles || !Array.isArray(parsed.angles)) {
    console.error("[intelligenceEngine] Parsed JSON missing angles[]", parsed);
    throw new Error("Invalid script generation response shape (no angles)");
  }

  // Normalise ids + validate required fields (fails fast if model cheats)
  return normaliseAndValidate(parsed);
}
