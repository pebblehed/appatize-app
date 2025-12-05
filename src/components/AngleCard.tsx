// src/components/AngleCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { useTrendContext } from "@/context/TrendContext";
import { useBriefContext, type Angle } from "@/context/BriefContext";
import { cleanText } from "@/engine/cleanText";

type AngleCardProps = {
  angle: Angle;
  trendName?: string;
};

/**
 * AngleCard
 *
 * Uses the globally selected Trend from TrendContext
 * + this Angle to generate a Brief via BriefContext,
 * then routes the user to /scripts where the engine activates.
 */
export default function AngleCard({ angle, trendName }: AngleCardProps) {
  const router = useRouter();
  const { selectedTrend } = useTrendContext();
  const { generateBriefFromAngle } = useBriefContext();

  const handleUseThisAngle = () => {
    if (!selectedTrend) {
      console.warn("[AngleCard] No selectedTrend in TrendContext");
      return;
    }

    // Engine step: Trend + Angle → Brief
    generateBriefFromAngle(selectedTrend, angle);

    // Move into script generation view
    router.push("/scripts");
  };

  const labelText = cleanText(angle.label);
  const hookText = cleanText(angle.hook);
  const audienceText = angle.audience ? cleanText(angle.audience) : null;
  const outcomeText = angle.outcome ? cleanText(angle.outcome) : null;
  const notesText = angle.notes ? cleanText(angle.notes) : null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-shell-border bg-shell-panel/90 p-4 shadow-ring-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-pink/40 hover:shadow-brand-glow/40">
      {/* Angle label + platform/format pill row */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-neutral-100">
            {labelText}
          </h3>

          <p className="text-xs text-neutral-400">{hookText}</p>

          {trendName && (
            <p className="text-[10px] text-neutral-500">
              From trend:{" "}
              <span className="font-medium text-neutral-200">
                {trendName}
              </span>
            </p>
          )}
        </div>

        <span className="inline-flex items-center rounded-full border border-shell-border bg-black/40 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
          {angle.platform} · {angle.format}
        </span>
      </div>

      {/* Outcome / notes */}
      <div className="space-y-1">
        {audienceText && (
          <p className="text-[11px] text-neutral-300">
            Audience:{" "}
            <span className="font-medium text-neutral-100">
              {audienceText}
            </span>
          </p>
        )}

        {outcomeText && (
          <p className="text-[11px] text-neutral-300">
            Outcome:{" "}
            <span className="font-medium text-neutral-100">
              {outcomeText}
            </span>
          </p>
        )}

        {notesText && (
          <p className="text-[11px] text-neutral-400">{notesText}</p>
        )}
      </div>

      {/* Primary CTA */}
      <div className="flex justify-end pt-1">
        <button
          onClick={handleUseThisAngle}
          className="inline-flex items-center gap-1 rounded-pill bg-brand-pink px-3 py-1 text-[11px] font-semibold text-black transition-colors hover:bg-brand-pink-soft"
        >
          Use this angle <span className="text-xs">↗</span>
        </button>
      </div>
    </div>
  );
}
