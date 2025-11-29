import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { brief, platform = "TikTok", angles = 1 } = body;

    if (!brief) {
      return NextResponse.json({ error: "Missing brief" }, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Platform-specific guidance
    const platformGuidance = {
      TikTok: `
- Fast hook within 0-2 seconds
- High-energy edits
- Text overlays recommended
- POV-style moments encouraged
- Ending CTA should be short + punchy
`,
      "Instagram Reels": `
- Aesthetic visuals + smoother pacing
- Use elegant text overlays
- Hooks should be curiosity-based
- Allow for slightly more storytelling
- Ending CTA can be softer
`,
      "YouTube Shorts": `
- Story-driven approach
- Clear beats, linear flow
- Strong explanatory voiceover or captions
- Ending CTA should be direct
`,
    };

    const prompt = `
You are the CultureOS Script Engine.

Your goal: turn this brief into a ${platform}-native video script.

Platform rules:
${platformGuidance[platform] || platformGuidance["TikTok"]}

Brief:
${JSON.stringify(brief, null, 2)}

OUTPUT FORMAT (strict JSON):

If "angles" = 1:
{
  "script": {
    "hook": "...",
    "beat1": "...",
    "beat2": "...",
    "beat3": "...",
    "ending": "...",
    "captions": ["...", "..."]
  }
}

If "angles" > 1:
{
  "angles": [
    {
      "hook": "...",
      "beat1": "...",
      "beat2": "...",
      "beat3": "...",
      "ending": "..."
    },
    { ... },
    { ... }
  ]
}
`;

    const completion = await client.responses.create({
      model: "gpt-4.1",
      input: prompt,
    });

    const raw = completion.output_text;

    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error("AI returned invalid JSON:", raw);
      return NextResponse.json(
        { error: "Invalid JSON from AI", raw },
        { status: 500 }
      );
    }

    return NextResponse.json(json);
  } catch (error) {
    console.error("Script Engine error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
