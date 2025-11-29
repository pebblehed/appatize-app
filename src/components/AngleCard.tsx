// src/components/AngleCard.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTrendContext } from "@/context/TrendContext";
import { useBriefContext, type Angle } from "@/context/BriefContext";

type AngleCardProps = {
  angle: Angle;
  trendName?: string;
};

/**
 * AngleCard
 *
 * Uses the globally selected Trend from TrendContext
 * + this Angle to generate a Platinum+ Brief via BriefContext,
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

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 flex flex-col gap-3">
      {/* Angle label + platform/format pill row */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="text-sm font-medium text-neutral-100">
            {angle.label}
          </h3>

          <p className="text-xs text-neutral-400">{angle.hook}</p>

          {trendName && (
            <p className="text-[10px] text-neutral-500">
              From trend: <span className="font-medium">{trendName}</span>
            </p>
          )}
        </div>

        <span className="inline-flex items-center rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] font-medium text-neutral-300">
          {angle.platform} · {angle.format}
        </span>
      </div>

      {/* Outcome / notes */}
      <div className="space-y-1">
        {angle.audience && (
          <p className="text-[11px] text-neutral-300">
            Audience:{" "}
            <span className="font-medium text-neutral-100">
              {angle.audience}
            </span>
          </p>
        )}

        {angle.outcome && (
          <p className="text-[11px] text-neutral-300">
            Outcome:{" "}
            <span className="font-medium text-neutral-100">
              {angle.outcome}
            </span>
          </p>
        )}

        {angle.notes && (
          <p className="text-[11px] text-neutral-400">{angle.notes}</p>
        )}
      </div>

      {/* Primary CTA */}
      <div className="flex justify-end pt-1">
        <button
          onClick={handleUseThisAngle}
          className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-black hover:bg-emerald-400 transition-colors"
        >
          Use this angle <span className="text-xs">↗</span>
        </button>
      </div>
    </div>
  );
}
