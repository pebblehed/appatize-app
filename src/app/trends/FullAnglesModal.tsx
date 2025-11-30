// src/app/trends/FullAnglesModal.tsx
"use client";

type TrendStatus = "emerging" | "peaking" | "stable" | "declining";

type Trend = {
  id: string;
  name: string;
  status: TrendStatus;
  movementLabel: string;
  description: string;
  category: string;
  exampleHook: string;
};

type Angle = {
  id: string;
  label: string;
  description: string;
  hookPattern: string;
  bestFor: string;
};

const MOCK_ANGLES_BY_TREND: Record<string, Angle[]> = {
  "street-pov-micro-vlogs": [
    {
      id: "city-first-person",
      label: "City first-person confessional",
      description:
        "Use raw handheld footage of walking through your city while you talk honestly about a challenge, decision or lesson.",
      hookPattern:
        `"POV: You finally [emotional moment] after [shared pain your audience relates to]..."`,
      bestFor: "TikTok, Reels, YouTube Shorts",
    },
    {
      id: "silent-pov-text-overlay",
      label: "Silent POV with text overlay",
      description:
        "Let the visuals do the talking while using text-on-screen to tell the story in 2–3 beats.",
      hookPattern:
        "[Beat 1: setup text] → [Beat 2: twist] → [Beat 3: payoff or CTA].",
      bestFor: "TikTok, Reels",
    },
  ],
  "work-day-in-the-life": [
    {
      id: "honest-workday",
      label: "Honest workday breakdown",
      description:
        "Show the real, messy version of your workday instead of aspirational fantasy.",
      hookPattern:
        `"A realistic day in my life as a [role] (no 5am meditation, just the truth)."`,
      bestFor: "TikTok, Reels, YouTube Shorts",
    },
    {
      id: "before-after-workday",
      label: "Before vs after workday",
      description:
        "Contrast your energy or expectations at the start of the day with how it really ends.",
      hookPattern:
        `"Expectation vs reality of my day as a [role] in 10 seconds."`,
      bestFor: "TikTok, Reels",
    },
  ],
  "expectation-vs-reality-memes": [
    {
      id: "product-launch-expectation",
      label: "Product launch expectation vs reality",
      description:
        "Compare how brands imagine launches going vs the actual behind-the-scenes chaos.",
      hookPattern:
        `"Expectation: [perfect launch fantasy]. Reality: [chaotic, relatable truth]."`,
      bestFor: "TikTok, Reels, static memes on X / IG",
    },
    {
      id: "customer-journey-reality",
      label: "Customer journey reality check",
      description:
        "Highlight the gap between idealised customer journeys and what people actually experience.",
      hookPattern:
        `"Expectation: [frictionless journey]. Reality: [funny, painful reality your audience knows]."`,
      bestFor: "Multi-platform memes & shortform video",
    },
  ],
};

function getAnglesForTrend(trendId: string): Angle[] {
  return MOCK_ANGLES_BY_TREND[trendId] ?? [];
}

export default function FullAnglesModal({
  trend,
  onClose,
}: {
  trend: Trend;
  onClose: () => void;
}) {
  const angles = getAnglesForTrend(trend.id);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl border border-shell-border bg-shell-panel p-5 shadow-brand-glow">
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full border border-shell-border bg-black/40 px-2 py-1 text-[11px] text-neutral-300 transition-colors hover:border-brand-pink/40 hover:bg-black/70"
        >
          Close
        </button>

        {/* Header */}
        <div className="mb-4 space-y-1 pr-12">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
            Angles for
          </p>
          <h2 className="text-sm font-semibold text-neutral-50">
            {trend.name}
          </h2>
          <p className="text-[11px] text-neutral-400">{trend.description}</p>
        </div>

        {/* Angles list */}
        <div className="space-y-3 max-h-[22rem] overflow-y-auto pr-1">
          {angles.length === 0 && (
            <p className="text-xs text-neutral-500">
              No angle presets added yet for this trend in the MVP. In the live
              system, this view will be populated by the Appatize intelligence
              engine.
            </p>
          )}

          {angles.map((angle) => (
            <article
              key={angle.id}
              className="rounded-xl border border-shell-border bg-black/30 p-3 text-xs text-neutral-200"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <h3 className="text-[11px] font-semibold text-neutral-50">
                  {angle.label}
                </h3>
                <span className="rounded-pill bg-black/50 px-2 py-0.5 text-[10px] text-neutral-400">
                  Best for: {angle.bestFor}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-neutral-300">
                {angle.description}
              </p>
              <p className="text-[11px] text-neutral-400">
                Hook pattern:{" "}
                <span className="text-neutral-100">{angle.hookPattern}</span>
              </p>
            </article>
          ))}
        </div>

        {/* Footer hint */}
        <div className="mt-4 border-t border-shell-border/60 pt-3 text-[11px] text-neutral-500">
          Next step: choose an angle direction, then head to{" "}
          <span className="text-neutral-200">Briefs</span> to lock it into a
          creative brief and generate scripts.
        </div>
      </div>
    </div>
  );
}
