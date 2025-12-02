// src/app/api/scripts/generate/route.ts
import { NextRequest } from "next/server";
import OpenAI from "openai";

import type { Brief } from "@/context/BriefContext";
import { PLATFORM_IDS, type PlatformId } from "@/engine/platforms";
import { buildScriptPrompt } from "@/engine/scriptEngine";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

  const platformList: PlatformId[] = PLATFORM_IDS;

  const userContextJson = JSON.stringify(
    {
      title: brief.title,
      trend: typeof brief.trend === "string" ? brief.trend : brief.trend?.name,
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
    const completions = await Promise.all(
      platformList.map(async (platformId) => {
        const prompt = buildScriptPrompt(platformId);

        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-mini",
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content: prompt,
            },
            {
              role: "user",
              content: [
                "Here is the brief context in JSON:",
                "",
                userContextJson,
                "",
                "Write a platform-native script following the structure HOOK → BODY → OUTRO/CTA → CAPTION.",
                "Strictly avoid hyphens used for emphasis and avoid AI-sounding phrases.",
              ].join("\n"),
            },
          ],
        });

        const text =
          completion.choices[0]?.message?.content?.trim() ??
          "// No script returned";

        return { platformId, scriptText: text };
      })
    );

    // 🔁 Build array of ScriptVariant objects compatible with ScriptsPage
    const variants = completions.map((c, index) => {
      const id = c.platformId;
      const prettyLabel =
        c.platformId.charAt(0).toUpperCase() + c.platformId.slice(1);

      return {
        id: id,                         // e.g. "tiktok"
        label: prettyLabel || `Variant ${index + 1}`, // e.g. "Tiktok"
        body: c.scriptText,
        // angleName / notes can be wired later in Stage D if needed
      };
    });

    return new Response(
      JSON.stringify({
        variants,       // 👈 what /scripts/page.tsx expects
        platforms: platformList, // kept for potential future use
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("[multi-variant generate] Error:", err);
    return new Response(
      JSON.stringify({ error: "Script generation failed" }),
      { status: 500 }
    );
  }
}
