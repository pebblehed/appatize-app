// src/lib/intelligence/intelligenceEngine.ts

import OpenAI from "openai";
import {
  ScriptGenerationInput,
  ScriptGenerationResult,
} from "./types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are the Cultural Intelligence Engine (CIE) + Moment-Signal Extraction (MSE) layer inside Appatize, a Cultural Operations Platform.

Your responsibilities:
- Read a trend + brief + soft behaviour controls.
- Generate 3–5 DISTINCT cultural angles.
- For each angle, generate 4–6 structured script variants.
- Extract a Cultural Snapshot (v2) for this brief.
- Extract a Moment Signal (MSE) describing how to play this moment.

Return STRICTLY VALID JSON that matches the provided TypeScript types.
No intros, no explanations, no markdown. JSON ONLY.

Tone & quality rules:
- Scripts must feel naturally human, not robotic.
- They must be specific to the stated platform and audience.
- Avoid generic content; show cultural awareness and specificity.
- Assume short-form vertical (TikTok / Reels / Shorts) unless told otherwise.
- Angles should differ in POV, energy, and narrative pattern.
- Variants must all be on-brief AND clearly descendants of their parent angle.
`;

// Helper to describe behaviour controls to the model
function describeBehaviourInPrompt(input: ScriptGenerationInput): string {
  const { behaviour } = input;
  if (!behaviour) return "Behaviour controls: default (balanced, standard pacing, no explicit platform bias).";

  const parts: string[] = [];

  if (behaviour.energy) {
    parts.push(`Energy: ${behaviour.energy} (low-key / balanced / high-energy).`);
  }
  if (behaviour.rhythm) {
    parts.push(`Rhythm: ${behaviour.rhythm} (short / medium / narrative pacing).`);
  }
  if (behaviour.platformBias) {
    parts.push(`Platform bias: ${behaviour.platformBias} (nudge style toward this environment).`);
  }
  if (behaviour.narrativePatternBias) {
    parts.push(`Narrative pattern bias: ${behaviour.narrativePatternBias} (or "mixed").`);
  }

  if (parts.length === 0) {
    return "Behaviour controls: default (balanced, standard pacing, no explicit platform bias).";
  }

  return `Behaviour controls:\n${parts.join("\n")}`;
}

export async function generateAnglesAndVariantsFromBrief(
  input: ScriptGenerationInput
): Promise<ScriptGenerationResult> {
  const { trendLabel, objective, audience, platform, briefText } = input;

  if (!process.env.OPENAI_API_KEY) {
    console.error("[intelligenceEngine] Missing OPENAI_API_KEY");
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const behaviourDescription = describeBehaviourInPrompt(input);

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

You must return JSON shaped exactly like this TypeScript model:

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
  [key: string]: any;
}

interface MomentSignal {
  coreMoment?: string;
  culturalTension?: string;
  stakes?: string;
  contentRole?: string;
  watchouts?: string;
  freshness?: "evergreen" | "timely" | "flash-trend";
  [key: string]: any;
}

interface ScriptGenerationResult {
  angles: AngleWithVariants[];
  snapshot?: CulturalSnapshotPayload;
  momentSignal?: MomentSignal;
}

Rules for ANGLES:
- Generate 3–5 angles.
- Angles must differ clearly in POV, energy, and narrative pattern.
- Each angle should feel like a distinct way to show up in culture.
- culturalTrigger: focus on the cultural hook or tension being tapped.
- audienceHook: how this specifically lands with the target audience.

Rules for VARIANTS:
- For each angle, generate 4–6 variants.
- IDs should be concise but stable (e.g. "angle-1-variant-1").
- confidence should be between 0.5 and 1.0.
- hook: a thumb-stopping opening line (short).
- body: the core idea / flow, concise but complete enough to shoot.
- cta: optional; when present, tie it to the OBJECTIVE (not generic "follow for more").
- outro: optional; when present, use a natural closing line for the platform.
- Scripts should be platform-aware (cuts, beats, pacing) but text-only.

Rules for Cultural Snapshot (snapshot):
- culturalContext: one tight paragraph on the broader cultural context.
- momentInsight: one tight paragraph on why this moment matters *now* for this audience.
- flowGuidance: guidance on narrative pattern + energy, reflecting behaviour controls where relevant.
- creativePrinciple: a simple core principle to keep in mind ("stay anchored to...").
- Additional fields (culturalDynamics, audienceMood, platformStylePulse, creativeLevers) are optional amplifiers. Use them only when they genuinely add clarity.

Rules for Moment Signal (momentSignal / MSE):
- coreMoment: what this moment is actually about underneath the surface.
- culturalTension: the key friction, tension, or contradiction in culture here.
- stakes: why this matters (to the audience, brands, and culture).
- contentRole: what role this specific piece of content should play in the moment.
- watchouts: concise list-style text on pitfalls (tone, ethics, trivialising serious topics, etc.).
- freshness: choose "evergreen", "timely", or "flash-trend" and justify implicitly in the text.

Critical constraints:
- Scripts, snapshot, and momentSignal must all be consistent with each other.
- They must reflect the trend, objective, audience, platform, and behaviour controls.
- DO NOT wrap the JSON in markdown.
- DO NOT add commentary before or after the JSON.
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
    throw new Error("Invalid script generation response shape (no angles)");
  }

  return parsed;
}
