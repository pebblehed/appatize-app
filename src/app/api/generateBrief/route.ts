import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { trend } = body;

    if (!trend) {
      return NextResponse.json({ error: "Missing trend" }, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const prompt = `
You are the Trendjacking Engine inside CultureOS.

Generate a CREATIVE BRIEF from this trend:

Title: ${trend.title}
Summary: ${trend.summary}
Format: ${trend.format}
State: ${trend.state}
Momentum: ${trend.momentum}

Return structure:

{
  "title": "...",
  "objective": "...",
  "insight": "...",
  "creativeDirection": "...",
  "hooks": ["...", "...", "..."],
  "cta": "...",
  "deliverables": ["...", "..."]
}
`;

    const completion = await client.responses.create({
      model: "gpt-4.1",
      input: prompt,
    });

    const resultText = completion.output_text;

    return NextResponse.json(JSON.parse(resultText));
  } catch (err) {
    console.error("Error generating brief:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
