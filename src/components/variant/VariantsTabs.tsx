// components/variant/VariantsTabs.tsx
"use client";

import React from "react";

export type ScriptVariant = {
  id: string;
  label: string;
  body: string;
  angleName?: string;
  notes?: string;
  score?: number;        // 0–10 Appatize score
  isRecommended?: boolean;
};

type VariantTabsProps = {
  variants: ScriptVariant[];
  activeVariantId: string | null;
  onChange: (variantId: string) => void;
  isDisabled?: boolean;
  recommendedVariantId?: string | null;
};

export default function VariantTabs({
  variants,
  activeVariantId,
  onChange,
  isDisabled = false,
  recommendedVariantId,
}: VariantTabsProps) {
  if (!variants || variants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-3">
        <p className="text-xs text-neutral-500">
          When your brief is ready, Appatize will generate multiple script
          variants and they’ll appear here as tabs.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-xl bg-neutral-950/80 p-2 border border-neutral-800">
      {variants.map((variant) => {
        const isActive = variant.id === activeVariantId;
        const isRecommended = variant.id === recommendedVariantId;

        return (
          <button
            key={variant.id}
            type="button"
            onClick={() => {
              if (isDisabled) return;
              onChange(variant.id);
            }}
            disabled={isDisabled}
            className={[
              "px-3 py-1.5 text-xs sm:text-sm rounded-lg border transition flex items-center gap-1.5",
              "focus:outline-none focus:ring-2 focus:ring-purple-500/80 focus:ring-offset-2 focus:ring-offset-black",
              isDisabled
                ? "bg-neutral-900/60 text-neutral-500 border-neutral-800 cursor-not-allowed"
                : isActive
                ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.8)]"
                : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-purple-500/70 hover:text-white",
            ].join(" ")}
          >
            <span>{variant.label}</span>
            {typeof variant.score === "number" && (
              <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-neutral-900/80 border border-neutral-700 text-neutral-300">
                {variant.score.toFixed(1)}
              </span>
            )}
            {isRecommended && (
              <span className="text-[9px] uppercase tracking-wide rounded-full px-1.5 py-0.5 bg-emerald-500/20 border border-emerald-400/70 text-emerald-200">
                Pick
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
