// src/app/trends/FullAnglesModal.tsx
"use client";

import React from "react";
import type { Angle } from "@/context/BriefContext";
import AngleCard from "@/components/AngleCard";

type UiTrend = {
  id: string;
  name: string;
  status: "emerging" | "peaking" | "stable" | "declining";
  movementLabel: string;
  description: string;
  category: string;
  exampleHook: string;
};

interface FullAnglesModalProps {
  trend: UiTrend;
  onClose: () => void;
}

/**
 * Very small Stage 1 angle library.
 * Later this will come from the real Angles Engine.
 */
function getAnglesForTrend(trend: UiTrend): Angle[] {
  const baseIdPrefix = trend.id;

  if (trend.id === "street-pov-micro-vlogs") {
    return [
      {
        id: `${baseIdPrefix}-angle-1`,
        label: "Founder street POV: building in public",
        hook: "You walk through the city talking honestly about what’s actually happening in the business.",
        format: "Short-form video",
        platform: "TikTok",
        audience: "Early-stage founders, indie hackers",
        outcome: "Drive saves and follows from people who relate to the journey.",
        notes:
          "Keep the footage raw and handheld. Think ‘confession walk’ rather than polished ad.",
      },
      {
        id: `${baseIdPrefix}-angle-2`,
        label: "POV: your future customer’s day",
        hook: "You narrate a day in the life of your ideal customer as if you’re them.",
        format: "Short-form video",
        platform: "Instagram Reels",
        audience: "Busy professionals who scroll on the commute",
        outcome: "Spark DMs and replies from people who see themselves in the POV.",
        notes:
          "Overlay text with ‘POV: [identity]’ and keep each beat visually distinct.",
      },
      {
        id: `${baseIdPrefix}-angle-3`,
        label: "POV: the tiny moment nobody shows",
        hook: "You zoom in on an unglamorous, honest moment from your world that creators normally cut out.",
        format: "Short-form video",
        platform: "YouTube Shorts",
        audience: "Creators, operators, people who are tired of fake productivity content",
        outcome: "Build trust and relatability, not just views.",
        notes:
          "Lean into imperfection. The power is in the ‘I can’t believe they showed that’ realism.",
      },
    ];
  }

  if (trend.id === "work-day-in-the-life") {
    return [
      {
        id: `${baseIdPrefix}-angle-1`,
        label: "Realistic day in the life (no 5am myth)",
        hook: "You explicitly promise a ‘no fake 5am’ version of your workday.",
        format: "Short-form video",
        platform: "TikTok",
        audience: "Ambitious people curious about your role or niche",
        outcome: "Drive saves + ‘I needed to hear this’ comments.",
        notes:
          "Show both the boring parts and the real wins. Make it feel like a friend’s voice note, not a recruitment ad.",
      },
      {
        id: `${baseIdPrefix}-angle-2`,
        label: "Behind-the-scenes of one key decision",
        hook: "You centre the day around one high-stakes decision, not a generic montage.",
        format: "Short-form vertical",
        platform: "LinkedIn",
        audience: "Operators, managers, ICs who make similar calls",
        outcome: "Spark thoughtful comments + reposts with people adding their take.",
        notes:
          "Narrate the context, the options you had, and the lesson. Keep it story-first, not self-congratulatory.",
      },
      {
        id: `${baseIdPrefix}-angle-3`,
        label: "Expectation vs reality of your role",
        hook: "You contrast what people think you do vs what you actually do all day.",
        format: "Short-form video",
        platform: "TikTok / Reels",
        audience: "People curious about switching into your field",
        outcome: "Inspire DMs + comments from people asking ‘how do I get into this?’",
        notes:
          "You can visualise this with on-screen text or quick cuts between expectation and reality.",
      },
    ];
  }

  if (trend.id === "expectation-vs-reality-memes") {
    return [
      {
        id: `${baseIdPrefix}-angle-1`,
        label: "Expectation vs reality of your product promise",
        hook: "You show the fantasy version of your promise vs the gritty reality of how it actually helps.",
        format: "Meme / short-form hybrid",
        platform: "X / Twitter",
        audience: "Sceptical buyers who’ve seen a million overhyped tools",
        outcome: "Build trust by being self-aware and honest.",
        notes:
          "Pair a meme image/text with one grounded, story-based example of real impact.",
      },
      {
        id: `${baseIdPrefix}-angle-2`,
        label: "Expectation vs reality: creator lifestyle",
        hook: "You puncture the myth of the glamorous creator day and show what it’s really like.",
        format: "Carousel / short-form clip",
        platform: "Instagram / TikTok",
        audience: "Aspiring creators and freelancers",
        outcome: "Attract the people who value realism over flexing.",
        notes:
          "You can turn each frame/beat into a different expectation vs reality pairing.",
      },
      {
        id: `${baseIdPrefix}-angle-3`,
        label: "Expectation vs reality of your customer’s journey",
        hook: "You show what customers *think* solving the problem will look like vs what it actually takes.",
        format: "Narrative short-form",
        platform: "YouTube Shorts / Reels",
        audience: "Problem-aware but solution-confused buyers",
        outcome: "Position your brand as the honest guide through the messy middle.",
        notes:
          "End with a grounded ‘here’s how we actually help’ rather than a pushy CTA.",
      },
    ];
  }

  // Generic fallback
  return [
    {
      id: `${baseIdPrefix}-angle-generic-1`,
      label: `Native angle for ${trend.name}`,
      hook: "Lean into one vivid, specific moment instead of summarising everything.",
      format: "Short-form vertical",
      platform: "TikTok / Reels",
      audience: "People who already engage with this type of content",
      outcome: "Spark saves, shares and ‘same’ comments.",
      notes:
        "Keep it focused on one slice of the trend rather than trying to explain the whole thing.",
    },
  ];
}

export default function FullAnglesModal({ trend, onClose }: FullAnglesModalProps) {
  const angles = getAnglesForTrend(trend);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl rounded-2xl border border-shell-border bg-shell-panel/95 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
              Angles for
            </p>
            <h2 className="text-lg font-semibold text-neutral-50">
              {trend.name}
            </h2>
            <p className="text-[11px] text-neutral-400">
              Use an angle to create a brief and jump straight into the Script
              Generator.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-shell-border bg-black/40 px-2 py-1 text-[11px] text-neutral-300 hover:border-brand-pink/50 hover:text-brand-pink"
          >
            Close
          </button>
        </div>

        {/* Angles grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {angles.map((angle) => (
            <AngleCard
              key={angle.id}
              angle={angle}
              trendName={trend.name}
            />
          ))}
        </div>

        <p className="mt-4 text-[11px] text-neutral-500">
          When you click <span className="font-semibold">“Use this angle”</span>
          , Appatize will build a brief from this trend + angle and open it in
          the Script Generator.
        </p>
      </div>
    </div>
  );
}
