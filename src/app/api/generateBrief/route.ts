// src/app/api/generateBrief/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { trend } = body;

    if (!trend) {
      return NextResponse.json({ error: "Missing trend" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY is not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
You are the Cultural Intelligence Engine inside Appatize.

Your job is to generate a clear, sharp CREATIVE BRIEF from this trend.

Trend details:
Title: ${trend.title}
Summary: ${trend.summary}
Format: ${trend.format}
State: ${trend.state}
Momentum: ${trend.momentum}

Return ONLY valid JSON in the following structure:

{
  "title": "string",
  "objective": "string",
  "insight": "string",
  "creativeDirection": "string",
  "hooks": ["string", "string", "string"],
  "cta": "string",
  "deliverables": ["string", "string"]
}
`;

    const completion = await client.responses.create({
      model: "gpt-4.1",
      input: prompt,
    });

    const resultText = completion.output_text;

    let parsed;
    try {
      parsed = JSON.parse(resultText);
    } catch (e) {
      console.error("Failed to parse brief JSON:", resultText);
      return NextResponse.json(
        { error: "Model returned invalid JSON" },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Error generating brief:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
