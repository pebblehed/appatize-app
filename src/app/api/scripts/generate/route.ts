// src/app/api/scripts/generate/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";

import type { Brief } from "@/context/BriefContext";
import { PLATFORM_IDS, type PlatformId } from "@/engine/platforms";
import { buildScriptPrompt } from "@/engine/scriptEngine";
import { cleanText } from "@/engine/cleanText";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ScriptVariantInternal = {
  id: string;
  label: string;
  body: string;
  angleName?: string;
  notes?: string;
  score?: number;
  reason?: string;
};

type CulturalInsight = {
  culturalContext?: string;
  momentInsight?: string;
  flowGuidance?: string;
  creativePrinciple?: string;
};

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Missing OPENAI_API_KEY" }),
      { status: 500 }
    );
  }

  let body: { brief: Brief };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      { status: 400 }
    );
  }

  const { brief } = body;
  if (!brief) {
    return new Response(
      JSON.stringify({ error: "Missing brief" }),
      { status: 400 }
    );
  }

  // Appatize is multi-platform by design
  const platformList: PlatformId[] = PLATFORM_IDS;

  const userContextJson = JSON.stringify(
    {
      title: brief.title,
      trend:
        typeof brief.trend === "string"
          ? brief.trend
          : brief.trend?.name,
      objective: brief.objective,
      audienceHint: brief.audienceHint,
      platformHint: brief.platformHint,
      formatHint: brief.formatHint,
      outcomeHint: brief.outcomeHint,
      coreMessage: brief.coreMessage,
      summary: brief.summary,
    },
    null,
    2
  );

  try {
    // 1️⃣ Pass 1: generate scripts + angleName + notes per platform
    const baseVariants: ScriptVariantInternal[] = await Promise.all(
      platformList.map(async (platformId, index) => {
        const platformPrompt = buildScriptPrompt(platformId);

        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                platformPrompt +
                "\n\n" +
                "You are part of an industry-grade Cultural Intelligence Engine. " +
                "You write native scripts AND annotate the creative angle behind them. " +
                "Avoid AI-speak. Avoid decorative or stylistic hyphens. " +
                "Only use hyphens when they are part of official brand or product names (e.g. Spider-Man, Coca-Cola). " +
                "Never say things like 'drop a same', 'drop a comment', 'drop your thoughts'. " +
                "Use natural invitations instead (e.g. ask a sharp question, invite a quick reaction). " +
                "Be sharp and human.",
            },
            {
              role: "user",
              content: [
                "Here is the brief context in JSON:",
                "",
                userContextJson,
                "",
                "For platform:",
                platformId,
                "",
                "1) Write a platform-native script following the structure:",
                "   HOOK → BODY → OUTRO/CTA → CAPTION.",
                "",
                "2) Then analyse your own script and return everything as STRICT JSON with EXACTLY these fields:",
                "{",
                '  "script": "full script text as you would want it posted",',
                '  "angleName": "a short, punchy name for the angle, max 6 words",',
                '  "notes": "one or two sentences explaining what this angle is doing and why it might land for the audience"',
                "}",
                "",
                "Important:",
                "- Do NOT add any explanation outside the JSON.",
                "- Do NOT wrap the JSON in markdown.",
                "- Do NOT add comments.",
                "- Avoid stylistic hyphens completely; only keep hyphens that are clearly part of brand / product names.",
                "- Do NOT use phrases like 'drop a same', 'drop a comment', 'drop your thoughts'.",
              ].join("\n"),
            },
          ],
        });

        const raw = completion.choices[0]?.message?.content?.trim() ?? "";

        let scriptText = "// No script returned";
        let angleName: string | undefined;
        let notes: string | undefined;

        try {
          const parsed = JSON.parse(raw);

          if (typeof parsed.script === "string") {
            scriptText = parsed.script;
          } else {
            scriptText = raw || scriptText;
          }

          if (typeof parsed.angleName === "string") {
            angleName = parsed.angleName;
          }

          if (typeof parsed.notes === "string") {
            notes = parsed.notes;
          }
        } catch {
          // Fallback: treat raw as the script if JSON parsing fails.
          scriptText = raw || scriptText;
        }

        // Strategic sanitisation for creative text
        scriptText = cleanText(scriptText);
        if (angleName) angleName = cleanText(angleName);
        if (notes) notes = cleanText(notes);

        const prettyLabel =
          platformId.charAt(0).toUpperCase() + platformId.slice(1);

        return {
          id: platformId,
          label: prettyLabel || `Variant ${index + 1}`,
          body: scriptText,
          angleName,
          notes,
        };
      })
    );

    // 2️⃣ Pass 2: comparative scoring across ALL variants
    const scoringPayload = {
      brief: JSON.parse(userContextJson),
      variants: baseVariants.map((v) => ({
        id: v.id,
        label: v.label,
        script: v.body,
        angleName: v.angleName ?? null,
        notes: v.notes ?? null,
      })),
    };

    let scoredVariants: ScriptVariantInternal[] = baseVariants;

    try {
      const scoringCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are a senior creative strategist for a Cultural Operations Platform. " +
              "Given a brief and multiple scripts (each with an angle), you compare them " +
              "and score them relative to each other. Be honest and practical. " +
              "Avoid hype, avoid AI-speak, avoid stylistic hyphens. " +
              "Only use hyphens when they are clearly part of brand / product names.",
          },
          {
            role: "user",
            content: [
              "Here is the brief context in JSON:",
              "",
              JSON.stringify(scoringPayload.brief, null, 2),
              "",
              "Here are the generated variants in JSON:",
              "",
              JSON.stringify(scoringPayload.variants, null, 2),
              "",
              "Analyse ALL of the variants RELATIVE to each other.",
              "",
              "Return STRICT JSON with this exact shape:",
              "{",
              '  "winnerId": "id of the strongest variant overall",',
              '  "variants": [',
              "    {",
              '      "id": "id matching one of the variants",',
              '      "score": 0-10 number rating of how strong this angle is for THIS brief and platform, relative to the others,',
              '      "rank": 1-based rank (1 = best),',
              '      "reason": "one short sentence explaining why this variant sits at this score/rank"',
              "    }",
              "  ]",
              "}",
              "",
              "Rules:",
              "- Scores MUST be differentiated. Do not give them all the same score.",
              "- Use the full 0–10 range where appropriate (e.g., 9s for standouts, 5–7 for solid, below 5 for weak fits).",
              "- Do NOT include any commentary outside the JSON.",
              "- Do NOT wrap the JSON in markdown.",
              "- Avoid stylistic hyphens; only keep brand / product-name hyphens.",
            ].join("\n"),
          },
        ],
      });

      const scoringRaw =
        scoringCompletion.choices[0]?.message?.content?.trim() ?? "";

      type ScoringResult = {
        winnerId?: string;
        variants?: {
          id: string;
          score?: number;
          rank?: number;
          reason?: string;
        }[];
      };

      let scoring: ScoringResult | null = null;

      try {
        scoring = JSON.parse(scoringRaw) as ScoringResult;
      } catch {
        console.error("[comparative scoring] Failed to parse scoring JSON");
      }

      if (scoring && Array.isArray(scoring.variants)) {
        const byId = new Map<
          string,
          { score?: number; rank?: number; reason?: string }
        >();

        for (const item of scoring.variants) {
          if (!item || typeof item.id !== "string") continue;
          byId.set(item.id, {
            score: item.score,
            rank: item.rank,
            reason: item.reason
              ? cleanText(item.reason)
              : undefined,
          });
        }

        scoredVariants = baseVariants.map((v) => {
          const scored = byId.get(v.id);
          let score: number | undefined;
          let reason: string | undefined;

          if (
            scored &&
            typeof scored.score === "number" &&
            !Number.isNaN(scored.score)
          ) {
            const clamped = Math.max(0, Math.min(10, scored.score));
            score = clamped;
          }

          if (scored?.reason) {
            reason = cleanText(scored.reason);
          }

          return {
            ...v,
            score,
            reason,
          };
        });
      } else {
        // If scoring fails, fall back to baseVariants (no score differentiation)
        scoredVariants = baseVariants;
      }
    } catch (scoreErr) {
      console.error("[comparative scoring] Error:", scoreErr);
      scoredVariants = baseVariants;
    }

    // 3️⃣ Pass 3: Cultural Intelligence (moment + flow insight) — refined tone
    let culturalInsight: CulturalInsight | null = null;

    try {
      const ciCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "You are a cultural strategist inside a Cultural Operations Platform. " +
              "You do NOT sound like AI. You think like a human who understands culture, psychology and platforms. " +
              "You write short, concrete internal notes for a creative team. " +
              "Avoid buzzwords (like 'authentic', 'cut through the noise', 'leveraging'). " +
              "Avoid phrases like 'as an AI', 'in today's world', 'now more than ever'. " +
              "Avoid stylistic hyphens; only use hyphens when they are clearly part of a brand / product name. " +
              "One or two tight sentences per field, max.",
          },
          {
            role: "user",
            content: [
              "Here is the brief context in JSON:",
              "",
              userContextJson,
              "",
              "Here are the final scored variants in JSON:",
              "",
              JSON.stringify(
                scoredVariants.map((v) => ({
                  id: v.id,
                  label: v.label,
                  score: v.score ?? null,
                  angleName: v.angleName ?? null,
                  notes: v.notes ?? null,
                })),
                null,
                2
              ),
              "",
              "Based on this, return STRICT JSON with this exact shape:",
              "{",
              '  "culturalContext": "one short, concrete sentence about the cultural truth or tension this brief is tapping into (max ~25 words)",',
              '  "momentInsight": "one short sentence about the current audience mindset or tension this creative is meeting (max ~25 words)",',
              '  "flowGuidance": "one short sentence of practical guidance on how the content should feel and flow so it doesn\'t feel like AI (keep it specific, not generic advice)",',
              '  "creativePrinciple": "one clear, punchy sentence stating the core creative principle to follow, e.g. Reveal the tension quickly, then flip it with a small, honest twist."',
              "}",
              "",
              "Rules:",
              "- Be concrete, not fluffy.",
              "- One or two short sentences per field. Do NOT ramble.",
              "- Do NOT use generic phrases like 'engage the audience', 'drive engagement', 'build authenticity', 'cut through the noise'.",
              "- Do NOT include any commentary outside the JSON.",
              "- Do NOT wrap the JSON in markdown.",
              "- Avoid stylistic hyphens; only keep hyphens that are clearly part of brand / product names.",
            ].join("\n"),
          },
        ],
      });

      const ciRaw = ciCompletion.choices[0]?.message?.content?.trim() ?? "";

      try {
        const parsed = JSON.parse(ciRaw) as CulturalInsight;

        culturalInsight = {
          culturalContext:
            typeof parsed.culturalContext === "string"
              ? cleanText(parsed.culturalContext)
              : undefined,
          momentInsight:
            typeof parsed.momentInsight === "string"
              ? cleanText(parsed.momentInsight)
              : undefined,
          flowGuidance:
            typeof parsed.flowGuidance === "string"
              ? cleanText(parsed.flowGuidance)
              : undefined,
          creativePrinciple:
            typeof parsed.creativePrinciple === "string"
              ? cleanText(parsed.creativePrinciple)
              : undefined,
        };
      } catch {
        console.error("[cultural intelligence] Failed to parse JSON");
        culturalInsight = null;
      }
    } catch (ciErr) {
      console.error("[cultural intelligence] Error:", ciErr);
      culturalInsight = null;
    }

    return new Response(
      JSON.stringify({
        variants: scoredVariants,
        platforms: platformList,
        cultural: culturalInsight,
      }),
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[multi-variant generate] Error:", err);

    if (err?.status === 429 || err?.code === "rate_limit_exceeded") {
      return new Response(
        JSON.stringify({
          error:
            "Rate limit reached while generating scripts. Please wait a few seconds and try again.",
          code: "rate_limit",
        }),
        { status: 429 }
      );
    }

    return new Response(
      JSON.stringify({ error: "Script generation failed" }),
      { status: 500 }
    );
  }
}
