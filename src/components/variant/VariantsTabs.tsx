// components/variants/VariantTabs.tsx
"use client";

import React from "react";

export type ScriptVariant = {
  id: string;
  label: string;   // "Variant 1", "Variant 2", etc.
  body: string;
  angleName?: string;
  notes?: string;
};

type VariantTabsProps = {
  variants: ScriptVariant[];
  activeVariantId: string | null;
  onChange: (variantId: string) => void;
  isDisabled?: boolean;
};

export default function VariantTabs({
  variants,
  activeVariantId,
  onChange,
  isDisabled = false,
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
              "px-3 py-1.5 text-xs sm:text-sm rounded-lg border transition",
              "focus:outline-none focus:ring-2 focus:ring-purple-500/80 focus:ring-offset-2 focus:ring-offset-black",
              isDisabled
                ? "bg-neutral-900/60 text-neutral-500 border-neutral-800 cursor-not-allowed"
                : isActive
                ? "bg-purple-600 text-white border-purple-400 shadow-[0_0_24px_rgba(168,85,247,0.8)]"
                : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-purple-500/70 hover:text-white",
            ].join(" ")}
          >
            {variant.label}
          </button>
        );
      })}
    </div>
  );
}
