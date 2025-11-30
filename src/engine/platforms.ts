// src/engine/platforms.ts
import type { Brief } from "@/context/BriefContext";

export type PlatformId =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "x"
  | "linkedin"
  | "generic";

export interface PlatformNarrativePattern {
  id: PlatformId;
  label: string;
  shortLabel: string;
  description: string;
  idealLengthSeconds?: { min: number; max: number };
  idealCadence?: string;
  hookStyle: string;
  bodyStyle: string;
  ctaStyle: string;
  voiceTraits: string[];
}

export const PLATFORM_PATTERNS: Record<
  PlatformId,
  PlatformNarrativePattern
> = {
  tiktok: {
    id: "tiktok",
    label: "TikTok Short-Form",
    shortLabel: "TikTok",
    description:
      "Fast, pattern-interrupt hooks and emotionally honest POV-style content.",
    idealLengthSeconds: { min: 10, max: 30 },
    idealCadence: "fast, chaotic, visual",
    hookStyle:
      "Raw pattern interrupt within first 0–2 seconds.",
    bodyStyle:
      "3–5 high-retention beats showing tension -> twist -> payoff.",
    ctaStyle:
      "Soft CTA built into the emotional payoff.",
    voiceTraits: ["direct", "pov", "emotional", "unpolished"],
  },

  instagram_reels: {
    id: "instagram_reels",
    label: "Instagram Reels",
    shortLabel: "IG Reels",
    description:
      "Polished, visual-first content driven by transitions and text overlays.",
    idealCadence: "punchy, aesthetic",
    hookStyle: "Text overlay hook front-loaded on frame 1.",
    bodyStyle: "2–4 visual story beats.",
    ctaStyle: "‘Save this’, ‘Share this’, or DM-based CTA.",
    voiceTraits: ["visual", "aspirational", "concise"],
  },

  youtube_shorts: {
    id: "youtube_shorts",
    label: "YouTube Shorts",
    shortLabel: "Shorts",
    description:
      "Narrative-driven, replay-friendly, clarity-focused content.",
    hookStyle: "Clear promise or curiosity gap in one sentence.",
    bodyStyle: "Step-by-step payoff sequence.",
    ctaStyle: "Value-first CTA: subscribe or watch full video.",
    voiceTraits: ["educational", "story-led", "clear"],
  },

  x: {
    id: "x",
    label: "X / Twitter",
    shortLabel: "X",
    description:
      "Opinion-driven, punchy insights with a strong POV.",
    hookStyle: "One-line tension or contrarian take.",
    bodyStyle:
      "3–8 tight lines breaking down the point.",
    ctaStyle: "Invite replies, quotes, or follows.",
    voiceTraits: ["sharp", "insightful", "direct"],
  },

  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    shortLabel: "LinkedIn",
    description:
      "Credible, story-rich professional insights.",
    hookStyle: "A tension or realisation that hits professional identity.",
    bodyStyle:
      "2–4 short paragraphs with an example and lesson.",
    ctaStyle: "Invite reflection or connection.",
    voiceTraits: ["empathetic", "credible", "practical"],
  },

  generic: {
    id: "generic",
    label: "Multi-Platform",
    shortLabel: "Generic",
    description: "Flexible fallback template.",
    hookStyle: "Direct problem or desire statement.",
    bodyStyle: "Mini story -> framework -> shift.",
    ctaStyle: "Flexible CTA.",
    voiceTraits: ["clear", "neutral"],
  },
};

export function resolvePlatformIdFromBrief(brief: Brief): PlatformId {
  const raw = (brief.platformHint || brief.formatHint || "").toLowerCase();

  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("instagram") || raw.includes("reels"))
    return "instagram_reels";
  if (raw.includes("shorts") || raw.includes("youtube"))
    return "youtube_shorts";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("x") || raw.includes("twitter")) return "x";

  return "generic";
}

export function describePlatformPatternForBrief(brief: Brief): string[] {
  const id = resolvePlatformIdFromBrief(brief);
  const pattern = PLATFORM_PATTERNS[id];

  const lines: string[] = [];

  lines.push(`Platform Pattern: ${pattern.label}`);
  lines.push(`Description: ${pattern.description}`);
  lines.push("");

  if (pattern.idealCadence) {
    lines.push(`Cadence: ${pattern.idealCadence}`);
  }

  if (pattern.idealLengthSeconds) {
    const { min, max } = pattern.idealLengthSeconds;
    lines.push(`Ideal length: ${min}–${max} seconds`);
  }

  lines.push("");
  lines.push(`Hook style: ${pattern.hookStyle}`);
  lines.push("");
  lines.push(`Body style: ${pattern.bodyStyle}`);
  lines.push("");
  lines.push(`CTA style: ${pattern.ctaStyle}`);
  lines.push("");
  lines.push(
    `Voice traits: ${pattern.voiceTraits.join(", ")}`
  );

  return lines;
}
