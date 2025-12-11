// src/lib/intelligence/angleEngine.ts

import OpenAI from "openai";
import {
  ScriptGenerationInput,
  ScriptGenerationResult,
  BehaviourControlsInput,
  AngleEnergy,
} from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are the Cultural Intelligence Engine (CIE) inside Appatize, a Cultural Operations Platform.

Your job (Stage D):
- Take a trend + brief (+ soft behaviour controls).
- Generate 3–5 DISTINCT angles.
- For each angle, generate 4–6 structured variants (scripts).
- Also generate a top-level Moment-Signal extraction (MSE) that explains how to play this moment.
- Return STRICTLY VALID JSON that matches the provided TypeScript types.
- No intros, no explanations, no markdown. JSON ONLY.

Requirements:
- Angles must differ in POV, energy, and narrative pattern.
- Variants must all be on-brief AND clearly descendants of their parent angle.
- Scripts should be naturally human, not robotic, not verbose.
- Assume short-form vertical content (TikTok, Reels, Shorts) unless otherwise stated.
- Each variant must be STRUCTURED into hook, body, cta, outro (outro/cta can be omitted if they are not natural for the platform).
- The MomentSignal should describe the tension, stakes, and opportunity around the moment, not generic social media advice.
`;

/**
 * Turn the behaviour controls object into a short textual guide
 * the model can use as soft instructions.
 */
function describeBehaviourControls(
  behaviour?: BehaviourControlsInput
): string {
  if (!behaviour) return "No explicit behaviour controls were set.";

  const parts: string[] = [];

  if (behaviour.energy) {
    const e: AngleEnergy = behaviour.energy;
    if (e === "low-key") {
      parts.push("Energy: low-key (grounded, calm, conversational).");
    } else if (e === "high-energy") {
      parts.push("Energy: high-energy (punchy, animated).");
    } else {
      parts.push("Energy: balanced.");
    }
  }

  if (behaviour.rhythm) {
    if (behaviour.rhythm === "short") {
      parts.push("Rhythm: short — fast beats, minimal build-up.");
    } else if (behaviour.rhythm === "narrative") {
      parts.push("Rhythm: narrative — story arc with room to build.");
    } else {
      parts.push("Rhythm: medium — standard social pacing.");
    }
  }

  if (behaviour.platformBias) {
    const p = behaviour.platformBias;
    if (p === "tiktok") {
      parts.push("Platform bias: TikTok — native trends, POV styles.");
    } else if (p === "reels") {
      parts.push(
        "Platform bias: Instagram Reels — slightly more polished visual tone."
      );
    } else if (p === "shorts") {
      parts.push(
        "Platform bias: YouTube Shorts — hook-driven, can tolerate slightly more explanatory beats."
      );
    } else if (p === "ugc-ad") {
      parts.push(
        "Platform bias: UGC-style ad — native social feel but clearly linked to a product, service, or offer."
      );
    }
  }

  return parts.join("\n");
}

export async function generateAnglesAndVariantsFromBrief(
  input: ScriptGenerationInput
): Promise<ScriptGenerationResult> {
  const {
    trendLabel,
    objective,
    audience,
    platform,
    briefText,
    behaviour,
  } = input;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[angleEngine] Missing OPENAI_API_KEY");
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const behaviourDescription = describeBehaviourControls(behaviour);

  const userPrompt = `
TREND:
${trendLabel}

OBJECTIVE:
${objective}

AUDIENCE:
${audience}

PLATFORM:
${platform}

BEHAVIOUR CONTROLS (soft guidance):
${behaviourDescription}

BRIEF (full text / context):
${briefText}

Return JSON of this exact shape (TypeScript):

type AngleEnergy = "low-key" | "balanced" | "high-energy";

type NarrativePattern =
  | "opinion"
  | "story"
  | "list"
  | "myth-busting"
  | "how-to"
  | "hot-take";

interface Angle {
  id: string;
  title: string;
  pov: string;
  platform: string;
  culturalTrigger: string;
  audienceHook: string;
  narrativePattern: NarrativePattern;
  energy: AngleEnergy;
  warnings?: string[];
}

interface StructuredVariant {
  id: string;
  parentAngleId: string;
  hook: string;
  body: string;
  cta?: string;
  outro?: string;
  structureNotes: string;
  confidence: number; // 0–1
}

interface AngleWithVariants extends Angle {
  variants: StructuredVariant[];
}

/**
 * Moment-Signal Extraction (MSE)
 * High-level read on the cultural moment and how to play it.
 */
interface MomentSignal {
  coreTension: string;      // What’s actually at stake / in conflict?
  audienceSpark: string;    // Why this hits emotionally for the audience
  culturalFrame: string;    // The bigger cultural story this sits inside
  opportunity: string;      // How the brand/creator can legitimately show up
  riskFlags: string[];      // Watchouts / lines not to cross
  freshness: "evergreen" | "timely" | "flash-trend";
}

interface ScriptGenerationResult {
  angles: AngleWithVariants[];
  momentSignal?: MomentSignal;
}

Rules:
- Generate 3–5 angles.
- For each angle, generate 4–6 variants.
- IDs should be short stable strings (e.g. "angle-1", "angle-1-variant-1").
- confidence should be between 0.5 and 1.0.
- hook must be a thumb-stopping opening line (short).
- body is the core idea / flow, can be bullet-like or paragraph, but concise.
- cta is optional; when present, tie it to the stated OBJECTIVE, not generic "follow for more".
- outro is optional; when present, use a natural ending line suitable for the PLATFORM.
- Script language must be natural and human, specific to the platform.
- The MomentSignal should reference the cultural and emotional reality behind the brief, not generic marketing tips.
- DO NOT wrap the JSON in markdown.
- DO NOT add commentary.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const raw = completion.choices[0].message.content;

  if (!raw) {
    console.error("[angleEngine] Empty content from OpenAI", completion);
    throw new Error("No content returned from OpenAI");
  }

  let parsed: ScriptGenerationResult;
  try {
    parsed = JSON.parse(raw) as ScriptGenerationResult;
  } catch (err) {
    console.error("[angleEngine] Failed to parse JSON", err, raw);
    throw new Error("Failed to parse script generation JSON");
  }

  if (!parsed.angles || !Array.isArray(parsed.angles)) {
    console.error("[angleEngine] Parsed JSON missing angles[]", parsed);
    throw new Error("Invalid script generation response shape");
  }

  // momentSignal is optional; no hard validation needed here.
  return parsed;
}
