// src/app/scripts/ScriptOutput.tsx
"use client";

import React from "react";
import type { ScriptVariant } from "@/components/variant/VariantsTabs";
import { cleanText } from "@/engine/cleanText";

type StructuredScriptVariant = ScriptVariant & {
  hook?: string;
  mainBody?: string;
  cta?: string;
  outro?: string;
};

type ScriptOutputProps = {
  variant: StructuredScriptVariant | null;
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

  const hookText = variant.hook ? cleanText(variant.hook) : "";
  const mainBodyText = variant.mainBody ? cleanText(variant.mainBody) : "";
  const ctaText = variant.cta ? cleanText(variant.cta) : "";
  const outroText = variant.outro ? cleanText(variant.outro) : "";

  const hasStructuredPieces =
    !!hookText || !!mainBodyText || !!ctaText || !!outroText;

  // Build a combined text for copying
  const combinedForCopy = (() => {
    // If we have structured pieces, copy those in order
    if (hasStructuredPieces) {
      const parts: string[] = [];
      if (hookText) parts.push(hookText);
      if (mainBodyText) parts.push(mainBodyText);
      if (ctaText) parts.push(`CTA: ${ctaText}`);
      if (outroText) parts.push(outroText);
      return parts.join("\n\n");
    }

    // Fallback: old behaviour, just body
    return bodyText;
  })();

  const handleCopy = () => {
    if (!combinedForCopy) return;
    navigator.clipboard.writeText(combinedForCopy).catch(() => {
      // quietly ignore clipboard errors
    });
  };

  // 🟣 Fallback view: no structured fields → behave exactly like your current version
  if (!hasStructuredPieces) {
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

  // 🧠 Structured view: Hook / Body / CTA / Outro clearly surfaced
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

      {/* Notes / “why this works” */}
      {notesText && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 mb-1">
            Why this works
          </p>
          <p className="text-xs text-neutral-300 whitespace-pre-wrap">
            {notesText}
          </p>
        </div>
      )}

      {/* Hook */}
      {hookText && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Hook
          </p>
          <p className="text-sm font-medium text-neutral-50">
            {hookText}
          </p>
        </div>
      )}

      {/* Body */}
      {mainBodyText && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Body
          </p>
          <p className="text-sm text-neutral-100 whitespace-pre-wrap leading-relaxed">
            {mainBodyText}
          </p>
        </div>
      )}

      {/* CTA */}
      {ctaText && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            CTA
          </p>
          <p className="text-sm text-neutral-100">
            {ctaText}
          </p>
        </div>
      )}

      {/* Outro */}
      {outroText && (
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Outro
          </p>
          <p className="text-sm text-neutral-100">
            {outroText}
          </p>
        </div>
      )}
    </div>
  );
}
