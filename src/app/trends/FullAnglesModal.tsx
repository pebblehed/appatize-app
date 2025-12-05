// src/app/trends/FullAnglesModal.tsx
"use client";

import React from "react";
import AngleCard from "@/components/AngleCard";
import { getAnglesForTrend } from "@/engine/angles";

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

export default function FullAnglesModal({
  trend,
  onClose,
}: FullAnglesModalProps) {
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
            <AngleCard key={angle.id} angle={angle} trendName={trend.name} />
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
