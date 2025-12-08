// src/lib/intelligence/intelligenceEngine.ts

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

Your job for each brief:
- Understand the trend, objective, audience, platform, and optional behaviour controls.
- Generate 3–5 DISTINCT angles for short-form vertical content.
- For each angle, generate 4–6 structured variants (scripts).
- Also produce:
  - A compact cultural snapshot object.
  - A compact moment-signal object (MSE).

Output:
- STRICTLY VALID JSON that matches the TypeScript types provided.
- No intros, no explanations, no markdown. JSON ONLY.
`;

function describeBehaviourForModel(behaviour?: BehaviourControlsInput): string {
  if (!behaviour) return "No explicit behaviour controls provided; use a natural, on-brief style.";

  const parts: string[] = [];

  if (behaviour.energy) {
    const e: AngleEnergy = behaviour.energy;
    if (e === "low-key") {
      parts.push("Energy: low-key, calm, grounded.");
    } else if (e === "high-energy") {
      parts.push("Energy: high-energy, punchy, animated.");
    } else {
      parts.push("Energy: balanced, natural social tone.");
    }
  }

  if (behaviour.rhythm) {
    if (behaviour.rhythm === "short") {
      parts.push("Rhythm: very short, punchy beats for fast scroll-stopping hooks.");
    } else if (behaviour.rhythm === "medium") {
      parts.push("Rhythm: standard social pacing.");
    } else if (behaviour.rhythm === "narrative") {
      parts.push("Rhythm: more narrative arc, slightly longer beats.");
    }
  }

  if (behaviour.platformBias) {
    if (behaviour.platformBias === "tiktok") {
      parts.push("Platform bias: nudge style toward TikTok culture and pacing.");
    } else if (behaviour.platformBias === "reels") {
      parts.push("Platform bias: nudge style toward Instagram Reels.");
    } else if (behaviour.platformBias === "shorts") {
      parts.push("Platform bias: nudge style toward YouTube Shorts.");
    } else if (behaviour.platformBias === "ugc-ad") {
      parts.push("Platform bias: nudge style toward native-feeling UGC ads.");
    }
  }

  if (parts.length === 0) {
    return "Behaviour controls provided but very light; default to a natural, platform-native style.";
  }

  return parts.join(" ");
}

export async function generateAnglesAndVariantsFromBrief(
  input: ScriptGenerationInput
): Promise<ScriptGenerationResult> {
  const { trendLabel, objective, audience, platform, briefText, behaviour } = input;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[intelligenceEngine] Missing OPENAI_API_KEY");
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const behaviourSummary = describeBehaviourForModel(behaviour);

  const userPrompt = `
TREND:
${trendLabel}

OBJECTIVE:
${objective}

AUDIENCE:
${audience}

PLATFORM:
${platform}

BEHAVIOUR CONTROLS (soft guidance only):
${behaviourSummary}

BRIEF:
${briefText}

You are generating *short-form vertical* content scripts by default (TikTok / Reels / Shorts / UGC),
unless the brief clearly demands otherwise.

Return JSON of this exact shape (TypeScript-like), no extra keys:

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

interface CulturalSnapshotPayload {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;

  culturalDynamics?: string;
  audienceMood?: string;
  platformStylePulse?: string;
  creativeLevers?: string;
}

interface MomentSignal {
  coreMoment: string;
  culturalTension: string;
  stakes: string;
  contentRole: string;
  watchouts?: string;
}

interface ScriptGenerationResult {
  angles: AngleWithVariants[];
  snapshot?: CulturalSnapshotPayload;
  momentSignal?: MomentSignal;
}

Rules:
- Generate 3–5 angles.
- For each angle, generate 4–6 variants.
- IDs should be short stable strings (e.g. "angle-1", "angle-1-variant-1").
- confidence MUST be between 0.5 and 1.0.
- hook must be a thumb-stopping opening line (short).
- body is the core idea / flow, concise, not a full essay.
- cta is optional; when present, tie it to the OBJECTIVE, not generic "follow for more".
- outro is optional; when present, make it a natural closing for the PLATFORM.
- Script language must be natural, human, and platform-aware.

For snapshot:
- culturalContext: 1–2 sentences on what’s happening culturally around this trend.
- momentInsight: what moment in the audience’s day / life this really plugs into.
- flowGuidance: how the content should flow (reference energy + rhythm).
- creativePrinciple: the core POV or principle to stay anchored to.
- culturalDynamics: the underlying cultural or social dynamics at play.
- audienceMood: how the audience probably feels in that moment.
- platformStylePulse: how the platform’s current style/format norms affect this content.
- creativeLevers: the 2–4 strongest levers to pull creatively.

For momentSignal:
- coreMoment: the precise moment you want to intercept.
- culturalTension: the friction / tension around that moment.
- stakes: what’s at stake for the audience if they act / don’t act.
- contentRole: the role this content should play (e.g. “myth-buster”, “coach”, “permission slip”).
- watchouts: any cultural / platform sensitivities.

DO NOT wrap the JSON in markdown.
DO NOT add commentary or explanation.
JSON ONLY.
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
    throw new Error("Invalid script generation response shape");
  }

  return parsed;
}
