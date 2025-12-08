// src/components/scripts/MultiVariantScriptPanel.tsx
"use client";

import { useState, useMemo } from "react";
import type { AngleWithVariants, Variant } from "@/lib/intelligence/types";

interface MultiVariantScriptPanelProps {
  // Full structured result from the engine
  angles: AngleWithVariants[];
}

// This component is a "smart viewer" for Stage D outputs.
// - Shows angle tabs (chips) at the top
// - Shows variant tabs for the active angle
// - Displays script + structure notes for the active variant
export default function MultiVariantScriptPanel({
  angles,
}: MultiVariantScriptPanelProps) {
  // Track which angle is selected
  const [activeAngleId, setActiveAngleId] = useState<string>(
    angles[0]?.id ?? ""
  );

  // Track which variant is selected for the active angle
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);

  // Derive the active angle from state
  const activeAngle: AngleWithVariants | undefined = useMemo(
    () => angles.find((a) => a.id === activeAngleId) ?? angles[0],
    [angles, activeAngleId]
  );

  // Derive the active variant from active angle + variant selection
  const activeVariant: Variant | undefined = useMemo(() => {
    if (!activeAngle) return undefined;

    if (activeVariantId) {
      return (
        activeAngle.variants.find((v) => v.id === activeVariantId) ??
        activeAngle.variants[0]
      );
    }

    return activeAngle.variants[0];
  }, [activeAngle, activeVariantId]);

  // Empty state guard: no angles yet
  if (!angles || angles.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 text-sm text-neutral-400">
        No scripts generated yet. Run the engine from a brief to see variants
        here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Angle Tabs (chips) */}
      <div className="flex flex-wrap gap-2">
        {angles.map((angle) => {
          const isActive = angle.id === activeAngleId;
          return (
            <button
              key={angle.id}
              onClick={() => {
                setActiveAngleId(angle.id);
                setActiveVariantId(null); // reset variant selection when angle changes
              }}
              className={`rounded-full px-4 py-1 text-xs font-medium transition ${
                isActive
                  ? "bg-violet-500 text-white shadow-sm"
                  : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {angle.title}
            </button>
          );
        })}
      </div>

      {/* Angle Meta Panel */}
      {activeAngle && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 text-xs text-neutral-300">
          {/* Angle tags */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-wide text-neutral-400">
            <span className="rounded-full border border-neutral-700 px-2 py-0.5">
              {activeAngle.platform}
            </span>
            <span className="rounded-full border border-neutral-700 px-2 py-0.5">
              {activeAngle.narrativePattern}
            </span>
            <span className="rounded-full border border-neutral-700 px-2 py-0.5">
              {activeAngle.energy}
            </span>
          </div>

          {/* Angle descriptive metadata */}
          <div className="mt-3 flex flex-col gap-2 text-xs">
            <div>
              <span className="font-semibold text-neutral-200">POV: </span>
              <span>{activeAngle.pov}</span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:gap-4">
              <div className="flex-1">
                <span className="font-semibold text-neutral-200">
                  Cultural Trigger:{" "}
                </span>
                <span>{activeAngle.culturalTrigger}</span>
              </div>
              <div className="flex-1">
                <span className="font-semibold text-neutral-200">
                  Audience Hook:{" "}
                </span>
                <span>{activeAngle.audienceHook}</span>
              </div>
            </div>

            {/* Optional guardrails / warnings */}
            {activeAngle.warnings && activeAngle.warnings.length > 0 && (
              <div className="mt-2 rounded-md border border-amber-600/50 bg-amber-950/40 px-3 py-2 text-[11px] text-amber-100">
                <span className="font-semibold">Guardrails: </span>
                {activeAngle.warnings.join(" • ")}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variant Tabs */}
      {activeAngle && (
        <div className="flex flex-wrap gap-2">
          {activeAngle.variants.map((variant, index) => {
            const isActive =
              variant.id === activeVariantId ||
              (!activeVariantId && index === 0);
            const confidence = Math.round(variant.confidence * 100);

            return (
              <button
                key={variant.id}
                onClick={() => setActiveVariantId(variant.id)}
                className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs transition ${
                  isActive
                    ? "bg-violet-500 text-white shadow-sm"
                    : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                }`}
              >
                <span>Variant {index + 1}</span>
                <span className="text-[10px] opacity-70">
                  {confidence}% fit
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active Script Body */}
      {activeVariant && (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-5 shadow-inner">
          <div className="mb-3 text-[11px] uppercase tracking-wide text-neutral-500">
            Script Output
          </div>
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-50">
            {activeVariant.script}
          </pre>
          <div className="mt-4 rounded-lg bg-neutral-900/80 p-3 text-[11px] text-neutral-300">
            <div className="mb-1 font-semibold text-neutral-200">
              Structure notes
            </div>
            <p>{activeVariant.structureNotes}</p>
          </div>
        </div>
      )}
    </div>
  );
}
