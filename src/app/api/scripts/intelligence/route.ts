// src/app/api/scripts/intelligence/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Types used locally in this route --- //

// NOTE: This type is deliberately a superset so it can accept
// both the older behaviour shape and the new Stage 4 UI shape.
type BehaviourControlsInput = {
  // Old energy labels (if ever used) + new UI labels
  energy?:
    | "low-key"
    | "balanced"
    | "high-energy"
    | "low"
    | "steady"
    | "high";

  // Old field name, if something upstream sets it
  platformBias?: "tiktok" | "reels" | "shorts" | "ugc-ad";

  // New UI field name
  platform?: "tiktok" | "reels" | "shorts" | "ugc-ad";

  // Narrative shape hint (kept for future use / backwards compatibility)
  narrativePatternBias?:
    | "opinion"
    | "story"
    | "list"
    | "myth-busting"
    | "how-to"
    | "hot-take"
    | "mixed";

  // Old rhythm labels + new UI labels
  rhythm?: "short" | "medium" | "narrative" | "snappy" | "balanced" | "story";

  // New UI tone control
  tone?: "clean" | "warm" | "bold" | "playful";
};

type ScriptGenerationInput = {
  trendLabel: string;
  objective: string;
  audience: string;
  platform: string;
  briefText: string;
  behaviour?: BehaviourControlsInput;
};

type CulturalSnapshotPayload = {
  culturalDynamics?: string;
  contextInCulture?: string;
  audienceMoodSensitivity?: string;
  audienceMomentInsight?: string;
  platformStylePulse?: string;
  creativeLevers?: string;
  flowGuidance?: string;
  creativePrinciple?: string;
};

type MomentSignalPayload = {
  coreMoment?: string;
  whyThisMomentMatters?: string;
  roleOfContent?: string;
  culturalTension?: string;
  watchouts?: string[];
};

type VariantPayload = {
  id?: string;
  label?: string;
  angleName?: string;
  body?: string;
  notes?: string;
  score?: number;
};

// --- Helpers --- //

function buildInputFromBrief(
  brief: any,
  behaviour?: BehaviourControlsInput
): ScriptGenerationInput {
  const trendLabel: string =
    brief?.trendLabel ||
    brief?.trend ||
    brief?.title ||
    "Unnamed cultural moment";

  const objective: string =
    brief?.objective ||
    brief?.goal ||
    "Drive engagement with culturally-aware short-form content.";

  const audience: string =
    brief?.audience ||
    "People who already engage with this type of content.";

  const platform: string =
    brief?.platformOverride ||
    brief?.platformHint ||
    brief?.platform ||
    "TikTok / Reels";

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

function buildStage4Prompt(input: ScriptGenerationInput): string {
  const b = input.behaviour;

  const behaviourSummary = b
    ? `
Behaviour controls from UI (soft guidance, not hard rules):
- Energy preference: ${b.energy ?? "auto (engine decides)"}
- Tone: ${b.tone ?? "auto (engine decides)"}
- Rhythm: ${b.rhythm ?? "auto (engine decides)"}
- Platform bias: ${b.platformBias ?? b.platform ?? "auto (let the moment decide)"}
- Narrative pattern bias: ${b.narrativePatternBias ?? "mixed / auto"}
`
    : `
No explicit behaviour controls were set.
You must choose the most culturally effective behaviour pattern yourself
(based on the brief, cultural snapshot and moment signal).
`;

  return `
You are the **Appatize Cultural Intelligence Engine (CIE v2)**.

Your job: 
1. Read the brief and context.
2. Take a fast cultural read on the moment.
3. Decide dynamically how boldly or safely to play it.
4. Generate angles and script variants that *intelligently* respond to the cultural moment.

You ALWAYS respond with STRICT JSON only.

--------------------------------
BRIEF + CONTEXT
--------------------------------
Trend / moment label: ${input.trendLabel}
Objective: ${input.objective}
Audience: ${input.audience}
Primary platform(s): ${input.platform}

Extended brief text:
${input.briefText}

${behaviourSummary}

--------------------------------
STAGE 1 — CULTURAL SNAPSHOT
--------------------------------
Produce a short, structured snapshot of the cultural terrain this brief is stepping into.

Return it under "snapshot" with the following fields:

"snapshot": {
  "culturalDynamics": "...",
  "contextInCulture": "...",
  "audienceMoodSensitivity": "...",
  "audienceMomentInsight": "...",
  "platformStylePulse": "...",
  "creativeLevers": "...",
  "flowGuidance": "...",
  "creativePrinciple": "..."
}

Each field should be 1–2 concise sentences, practical and non-generic.

--------------------------------
STAGE 2 — MOMENT SIGNAL (MSE)
--------------------------------
From the snapshot + brief, derive a "moment signal": 
a compact view of how to play this moment smartly.

Return it under "momentSignal" with exactly these fields:

"momentSignal": {
  "coreMoment": "What is the real emotional / social moment here?",
  "whyThisMomentMatters": "Why this is resonant or risky now.",
  "roleOfContent": "What role the creator/brand's content should play.",
  "culturalTension": "The main tension / friction in culture this sits inside.",
  "watchouts": [
    "Specific, concrete watch-out 1",
    "Specific, concrete watch-out 2",
    "..."
  ]
}

This is a strategy object, not copy. It should clearly describe the playing field.

--------------------------------
STAGE 3 — DYNAMIC BEHAVIOUR MODE
--------------------------------
Based on the **momentSignal** and any behaviour controls:

- Decide whether to:
  - play **bold / high-contrast** (sharper humour, stronger POV, more pattern-breaking), or
  - play **balanced / empathetic** (safer, more universal, emotionally steady),
  - or mix modes across angles.

Use behaviour controls as soft guidance. For example:
- If tone is "warm", keep language supportive and human.
- If tone is "bold", allow a stronger POV and punchier phrasing.
- If rhythm is "snappy", prefer shorter beats and quicker cuts.
- If rhythm is "story" or "narrative", allow more build-up and pacing.
- If platform bias is set (TikTok, Reels, Shorts, UGC Ad), adapt pacing, framing and CTA style accordingly.

The **momentSignal** and cultural strategy remain the primary driver. 
Behaviour controls refine how you express that strategy.

--------------------------------
STAGE 4 — ANGLES + VARIANTS (MOMENT-DRIVEN)
--------------------------------
Generate 3–5 angles for this brief. 
For each angle, generate 2–4 script variants.

Angles must already reflect the **momentSignal** decisions. 
Think of them as different *ways to legitimately show up in this cultural moment*.

You do NOT need to return full angle objects.
Instead, each variant will reference its angle by name.

For each script variant, return:

- "id": a simple stable id (e.g. "variant-1A").
- "label": "Variant 1", "Variant 2", etc.
- "angleName": a human-readable angle title, e.g. "Angle A: Relatable Humor: Expectation vs Reality in Everyday Life".
- "body": the full script / idea text, ready to hand to a creator.
- "notes": 1–2 sentences explaining **why this variant works IN THIS MOMENT** and any key sensitivities.
- "score": a 0–10 score for how well this variant hits the brief + momentSignal 
           (9+ only when it is clearly strong and culturally smart).

Use the behaviour controls as soft guidance. 
The **momentSignal** and cultural strategy should always be the primary driver.

--------------------------------
OUTPUT SHAPE (STRICT JSON)
--------------------------------
Respond with **ONLY** JSON:

{
  "snapshot": { ... },
  "momentSignal": { ... },
  "variants": [
    {
      "id": "variant-1",
      "label": "Variant 1",
      "angleName": "Angle A: ...",
      "body": "...",
      "notes": "...",
      "score": 9.0
    },
    ...
  ]
}

No extra keys. No comments. No prose outside of JSON.
`;
}

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error("[/api/scripts/intelligence] JSON parse failed", err);
    return null;
  }
}

// --- Route handler --- //

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
    const prompt = buildStage4Prompt(input);

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Appatize, a high-precision cultural intelligence engine. Always respond with STRICT JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    const raw = completion.choices[0]?.message?.content || "";
    const parsed = safeJsonParse(raw);

    if (!parsed || typeof parsed !== "object") {
      console.error(
        "[/api/scripts/intelligence] Parsed output was null or not an object",
        raw
      );
      return NextResponse.json(
        {
          error:
            "The intelligence engine returned an unexpected format. Please try again.",
        },
        { status: 500 }
      );
    }

    // --- Cultural Snapshot payload — ensure object or null --- //
    const snapshot: CulturalSnapshotPayload | null = parsed.snapshot
      ? {
          culturalDynamics: parsed.snapshot.culturalDynamics,
          contextInCulture: parsed.snapshot.contextInCulture,
          audienceMoodSensitivity: parsed.snapshot.audienceMoodSensitivity,
          audienceMomentInsight: parsed.snapshot.audienceMomentInsight,
          platformStylePulse: parsed.snapshot.platformStylePulse,
          creativeLevers: parsed.snapshot.creativeLevers,
          flowGuidance: parsed.snapshot.flowGuidance,
          creativePrinciple: parsed.snapshot.creativePrinciple,
        }
      : null;

    // --- Moment Signal payload — ensure object or null --- //
    const momentSignal: MomentSignalPayload | null = parsed.momentSignal
      ? {
          coreMoment: parsed.momentSignal.coreMoment,
          whyThisMomentMatters: parsed.momentSignal.whyThisMomentMatters,
          roleOfContent: parsed.momentSignal.roleOfContent,
          culturalTension: parsed.momentSignal.culturalTension,
          watchouts: Array.isArray(parsed.momentSignal.watchouts)
            ? parsed.momentSignal.watchouts
            : parsed.momentSignal.watchouts
            ? [String(parsed.momentSignal.watchouts)]
            : [],
        }
      : null;

    // --- Variants --- //
    const rawVariants: VariantPayload[] = Array.isArray(parsed.variants)
      ? parsed.variants
      : [];

    const variants = rawVariants.map((v, index) => ({
      id: v.id ?? `variant-${index + 1}`,
      label: v.label ?? `Variant ${index + 1}`,
      angleName: v.angleName ?? `Angle ${index + 1}`,
      body: v.body ?? "",
      notes: v.notes ?? "",
      score:
        typeof v.score === "number" && !Number.isNaN(v.score)
          ? Math.max(0, Math.min(10, v.score))
          : undefined,
    }));

    return NextResponse.json(
      {
        cultural: snapshot,
        momentSignal,
        variants,
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
