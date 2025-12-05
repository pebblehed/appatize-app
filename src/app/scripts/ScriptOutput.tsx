// src/app/scripts/ScriptOutput.tsx
"use client";

import React from "react";
import type { ScriptVariant } from "@/components/variant/VariantsTabs";
import { cleanText } from "@/engine/cleanText";

type ScriptOutputProps = {
  variant: ScriptVariant | null;
  isLoading?: boolean;
};

export default function ScriptOutput({
  variant,
  isLoading = false,
}: ScriptOutputProps) {
  if (isLoading) {
    return (
      <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
          <p className="text-sm text-neutral-300">
            Generating script variants from your brief…
          </p>
        </div>
      </div>
    );
  }

  if (!variant) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-neutral-800 bg-neutral-950/70 p-4">
        <p className="text-sm text-neutral-500">
          Select a variant tab above to see the full script. Once generated,
          you’ll be able to compare angles and pick the one that hits.
        </p>
      </div>
    );
  }

  const labelText = cleanText(variant.label);
  const angleNameText = variant.angleName
    ? cleanText(variant.angleName)
    : null;
  const notesText = variant.notes ? cleanText(variant.notes) : null;
  const bodyText = cleanText(variant.body ?? "");

  const handleCopy = () => {
    if (!bodyText) return;
    navigator.clipboard.writeText(bodyText).catch(() => {
      // quietly ignore clipboard errors
    });
  };

  return (
    <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950/90 p-4 space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-neutral-100">
            {labelText}
          </h2>

          <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
            {angleNameText && (
              <span>
                Angle:{" "}
                <span className="text-neutral-200">{angleNameText}</span>
              </span>
            )}
            {typeof variant.score === "number" && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/60 bg-purple-500/10 px-2 py-0.5 text-[11px] text-purple-100">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                Appatize score: {variant.score.toFixed(1)}/10
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs rounded-lg border border-neutral-700 bg-neutral-900/90 text-neutral-200 hover:text-white hover:border-purple-500/80 hover:bg-neutral-900 transition"
        >
          Copy script
        </button>
      </div>

      {/* Notes */}
      {notesText && (
        <p className="text-xs text-neutral-400 italic">{notesText}</p>
      )}

      {/* Body */}
      <pre className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-100">
        {bodyText}
      </pre>
    </div>
  );
}
