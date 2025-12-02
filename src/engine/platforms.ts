// src/engine/platforms.ts
export type PlatformId =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "x"
  | "linkedin"
  | "snapchat";

export const PLATFORM_IDS: PlatformId[] = [
  "tiktok",
  "instagram_reels",
  "youtube_shorts",
  "x",
  "linkedin",
  "snapchat",
];

// Add your patterns (unchanged)…
export const PLATFORM_PATTERNS = {
  tiktok: { shortLabel: "TikTok", label: "TikTok", description: "Fast raw POV" },
  instagram_reels: { shortLabel: "Reels", label: "Instagram Reels", description: "Aesthetic microbeats" },
  youtube_shorts: { shortLabel: "Shorts", label: "YouTube Shorts", description: "Structured short-form" },
  x: { shortLabel: "X", label: "X / Twitter", description: "Opinion-led video" },
  linkedin: { shortLabel: "LinkedIn", label: "LinkedIn Video", description: "Credible, story-led" },
  snapchat: { shortLabel: "Snapchat", label: "Snapchat", description: "Raw slice-of-life snaps" },
};
