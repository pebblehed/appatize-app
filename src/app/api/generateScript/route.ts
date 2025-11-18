import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { brief } = body;

    if (!brief) {
      return NextResponse.json({ error: "Missing brief" }, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const prompt = `
You are the Script Engine inside CultureOS.

Create a TikTok/Reels/Short-native SCRIPT based on this brief:

Brief:
${JSON.stringify(brief, null, 2)}

Return structure:
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
`;

    const completion = await client.responses.create({
      model: "gpt-4.1",
      input: prompt,
    });

    const resultText = completion.output_text;

    return NextResponse.json(JSON.parse(resultText));
  } catch (err) {
    console.error("Error generating script:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
