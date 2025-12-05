// src/engine/angles.ts
import type { Angle } from "@/context/BriefContext";

type TrendRef = {
  id: string;
  name: string;
};

/**
 * Very small Stage 1 angle library.
 * This will grow into the real Angles Engine.
 */
export function getAnglesForTrend(trend: TrendRef): Angle[] {
  const baseIdPrefix = trend.id;

  if (trend.id === "street-pov-micro-vlogs") {
    return [
      {
        id: `${baseIdPrefix}-angle-1`,
        label: "Founder street POV: building in public",
        hook: "You walk through the city talking honestly about what’s actually happening in the business.",
        format: "Short form video",
        platform: "TikTok",
        audience: "Early stage founders, indie hackers",
        outcome:
          "Help other founders quietly recognise their own day to day in your reality, so they follow along for the real story, not the highlight reel.",
        notes:
          "Keep it handheld and unpolished, like a voice note to a friend between meetings rather than a polished brand spot.",
      },
      {
        id: `${baseIdPrefix}-angle-2`,
        label: "POV: your future customer’s day",
        hook: "You narrate a day in the life of your ideal customer as if you’re them.",
        format: "Short form video",
        platform: "Instagram Reels",
        audience: "Busy professionals who scroll on the commute",
        outcome:
          "Make people see their own day in your POV so they feel like you’ve been sat next to them all week.",
        notes:
          "Use clear beats in the day and pair each with a specific tension or small moment they’ll instantly recognise.",
      },
      {
        id: `${baseIdPrefix}-angle-3`,
        label: "POV: the tiny moment nobody shows",
        hook: "You zoom in on an unglamorous, honest moment from your world that creators normally cut out.",
        format: "Short form video",
        platform: "YouTube Shorts",
        audience: "Creators, operators, people tired of productivity theatre",
        outcome:
          "Build quiet trust with people who are exhausted by perfect desk setups and want to see how it really feels.",
        notes:
          "Choose a moment that would normally live on the cutting room floor and let that be the centre of the story.",
      },
    ];
  }

  if (trend.id === "work-day-in-the-life") {
    return [
      {
        id: `${baseIdPrefix}-angle-1`,
        label: "Realistic day in the life (no 5am myth)",
        hook: "You explicitly promise a ‘no fake 5am’ version of your workday.",
        format: "Short form video",
        platform: "TikTok",
        audience: "Ambitious people curious about your role or niche",
        outcome:
          "Give people a grounded picture of what the job actually feels like so they can decide if it’s really for them.",
        notes:
          "Show the wins and the boring bits side by side. Let the rhythm feel like a real day, not a highlight montage.",
      },
      {
        id: `${baseIdPrefix}-angle-2`,
        label: "Behind the scenes of one key decision",
        hook: "You centre the day around one high stakes decision, not a generic montage.",
        format: "Short form vertical",
        platform: "LinkedIn",
        audience: "Operators, managers and ICs who make similar calls",
        outcome:
          "Help people compare how they would handle the same situation and quietly benchmark themselves against your thinking.",
        notes:
          "Walk through the context, options and trade offs, then share the honest lesson rather than a hero story.",
      },
      {
        id: `${baseIdPrefix}-angle-3`,
        label: "Expectation vs reality of your role",
        hook: "You contrast what people think you do vs what you actually do all day.",
        format: "Short form video",
        platform: "TikTok / Reels",
        audience: "People considering moving into your field",
        outcome:
          "Show the real trade offs so people who are serious lean in and people chasing a fantasy quietly opt out.",
        notes:
          "Use quick visual contrasts or on screen text to move between expectation and reality without over explaining.",
      },
    ];
  }

  if (trend.id === "expectation-vs-reality-memes") {
    return [
      {
        id: `${baseIdPrefix}-angle-1`,
        label: "Expectation vs reality of your product promise",
        hook: "You show the fantasy version of your promise vs the grounded reality of how it actually helps.",
        format: "Meme / short form hybrid",
        platform: "X / Twitter",
        audience: "Sceptical buyers who have seen a lot of overhyped tools",
        outcome:
          "Position your product as the honest option by gently puncturing the fantasy and showing the real gain.",
        notes:
          "Pair a meme format with one specific story of how things actually improved for a real person.",
      },
      {
        id: `${baseIdPrefix}-angle-2`,
        label: "Expectation vs reality: creator lifestyle",
        hook: "You puncture the myth of the glamorous creator day and show what it’s really like.",
        format: "Carousel / short form clip",
        platform: "Instagram / TikTok",
        audience: "Aspiring creators and freelancers",
        outcome:
          "Attract people who care more about sustainable reality than flexing and quick wins.",
        notes:
          "Use each frame or beat to contrast a common fantasy moment with the actual behind the scenes version.",
      },
      {
        id: `${baseIdPrefix}-angle-3`,
        label: "Expectation vs reality of your customer’s journey",
        hook: "You show what customers think solving the problem will look like vs what it actually takes.",
        format: "Narrative short form",
        platform: "YouTube Shorts / Reels",
        audience: "People who know they have the problem but are unsure what will truly solve it",
        outcome:
          "Make your brand feel like the honest guide through the messy middle rather than the source of another shiny promise.",
        notes:
          "End with a simple, grounded ‘here’s the next small step’ instead of a heavy handed sales pitch.",
      },
    ];
  }

  // Generic fallback
  return [
    {
      id: `${baseIdPrefix}-angle-generic-1`,
      label: `Native angle for ${trend.name}`,
      hook: "Lean into one vivid, specific moment instead of trying to summarise everything.",
      format: "Short form vertical",
      platform: "TikTok / Reels",
      audience: "People who already engage with this type of content",
      outcome:
        "Prompt quick ‘this is me’ recognitions without leaning on meme phrases or forced comment asks.",
      notes:
        "Stay with one clear slice of the trend and let the detail do the work instead of explaining the whole landscape.",
    },
  ];
}
