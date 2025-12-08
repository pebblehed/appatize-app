// src/components/scripts/BehaviourControlsPanel.tsx
"use client";

import React from "react";
import clsx from "clsx";
import type { BehaviourControlsInput } from "@/lib/intelligence/types";

type Props = {
  value: BehaviourControlsInput;
  onChange: (next: BehaviourControlsInput) => void;
  isGenerating?: boolean;
};

export default function BehaviourControlsPanel({
  value,
  onChange,
  isGenerating,
}: Props) {
  function update<K extends keyof BehaviourControlsInput>(
    key: K,
    newVal: BehaviourControlsInput[K]
  ) {
    onChange({
      ...value,
      [key]: newVal,
    });
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 p-4 space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
        Behaviour Controls
      </div>

      {/* ENERGY */}
      <div className="space-y-1">
        <p className="text-xs text-neutral-400">Energy</p>
        <div className="flex flex-wrap gap-2">
          {(["low-key", "balanced", "high-energy"] as const).map((opt) => (
            <button
              key={opt}
              disabled={isGenerating}
              onClick={() => update("energy", opt)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs border transition",
                value.energy === opt
                  ? "bg-purple-600/30 border-purple-500 text-purple-100"
                  : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              )}
            >
              {opt.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* TONE */}
      <div className="space-y-1">
        <p className="text-xs text-neutral-400">Tone</p>
        <div className="flex flex-wrap gap-2">
          {(["authentic", "cinematic", "educational", "opinionated", "humorous"] as const).map(
            (opt) => (
              <button
                key={opt}
                disabled={isGenerating}
                onClick={() => update("tone", opt)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-xs border transition",
                  value.tone === opt
                    ? "bg-purple-600/30 border-purple-500 text-purple-100"
                    : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
                )}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* RHYTHM */}
      <div className="space-y-1">
        <p className="text-xs text-neutral-400">Rhythm</p>
        <div className="flex gap-2 flex-wrap">
          {(["short", "medium", "narrative"] as const).map((opt) => (
            <button
              key={opt}
              disabled={isGenerating}
              onClick={() => update("rhythm", opt)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs border transition",
                value.rhythm === opt
                  ? "bg-purple-600/30 border-purple-500 text-purple-100"
                  : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              )}
            >
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* PLATFORM BIAS */}
      <div className="space-y-1">
        <p className="text-xs text-neutral-400">Platform</p>
        <div className="flex gap-2 flex-wrap">
          {(["tiktok", "reels", "shorts", "ugc-ad"] as const).map((opt) => (
            <button
              key={opt}
              disabled={isGenerating}
              onClick={() => update("platformBias", opt)}
              className={clsx(
                "px-3 py-1.5 rounded-full text-xs border transition",
                value.platformBias === opt
                  ? "bg-purple-600/30 border-purple-500 text-purple-100"
                  : "bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800"
              )}
            >
              {opt.toUpperCase().replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* ❌ NO BUTTON HERE ANYMORE */}
    </div>
  );
}
