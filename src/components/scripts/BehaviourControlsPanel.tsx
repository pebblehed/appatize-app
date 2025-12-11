// src/components/scripts/BehaviourControlsPanel.tsx
"use client";

import React, { useEffect, useState } from "react";
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
  const [local, setLocal] = useState<BehaviourControlsInput>(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  function setField(field: keyof BehaviourControlsInput, val: any) {
    const next = { ...(local as any), [field]: val } as BehaviourControlsInput;
    setLocal(next);
    onChange(next);
  }

  const disabled = !!isGenerating;

  return (
    <section className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-950/80 p-4">
      {/* Header */}
      <div className="text-xs font-semibold uppercase tracking-wide text-neutral-300">
        Behaviour Controls
      </div>

      {/* ------------------------------------------------ */}
      {/* ENERGY — match tone/rhythm style (emerald accent) */}
      {/* ------------------------------------------------ */}
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-neutral-300">
          <span>Energy</span>
          <span className="text-[10px] text-neutral-500">
            How hard this piece hits
          </span>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "low", label: "Low" },
            { id: "steady", label: "Steady" },
            { id: "high", label: "High" },
          ].map((opt) => {
            const isActive = (local as any).energy === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setField("energy" as any, opt.id)}
                disabled={disabled}
                className={clsx(
                  "text-xs rounded-lg border px-2 py-1.5 transition bg-neutral-900/60 text-neutral-300 hover:bg-neutral-900 hover:border-neutral-600",
                  disabled && "cursor-not-allowed opacity-60",
                  isActive &&
                    "border-emerald-400/80 bg-emerald-500/10 text-emerald-200"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ */}
      {/* TONE — unchanged                                */}
      {/* ------------------------------------------------ */}
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-neutral-300">
          <span>Tone</span>
          <span className="text-[10px] text-neutral-500">Emotional feel</span>
        </label>

        <div className="grid grid-cols-4 gap-2">
          {[
            { id: "clean", label: "Clean" },
            { id: "warm", label: "Warm" },
            { id: "bold", label: "Bold" },
            { id: "playful", label: "Playful" },
          ].map((opt) => {
            const isActive = (local as any).tone === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setField("tone" as any, opt.id)}
                disabled={disabled}
                className={clsx(
                  "text-xs rounded-lg border px-2 py-1.5 transition bg-neutral-900/60 text-neutral-300 hover:bg-neutral-900 hover:border-neutral-600",
                  disabled && "cursor-not-allowed opacity-60",
                  isActive &&
                    "border-sky-400/80 bg-sky-500/10 text-sky-200"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ */}
      {/* RHYTHM — unchanged                              */}
      {/* ------------------------------------------------ */}
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-neutral-300">
          <span>Rhythm</span>
          <span className="text-[10px] text-neutral-500">Beat timing</span>
        </label>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "snappy", label: "Snappy" },
            { id: "balanced", label: "Balanced" },
            { id: "story", label: "Story-led" },
          ].map((opt) => {
            const isActive = (local as any).rhythm === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setField("rhythm" as any, opt.id)}
                disabled={disabled}
                className={clsx(
                  "text-xs rounded-lg border px-2 py-1.5 transition bg-neutral-900/60 text-neutral-300 hover:bg-neutral-900 hover:border-neutral-600",
                  disabled && "cursor-not-allowed opacity-60",
                  isActive &&
                    "border-violet-400/80 bg-violet-500/10 text-violet-200"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------ */}
      {/* PLATFORM — match tone/rhythm style (amber accent) */}
      {/* ------------------------------------------------ */}
      <div className="space-y-1">
        <label className="flex items-center justify-between text-xs text-neutral-300">
          <span>Platform</span>
          <span className="text-[10px] text-neutral-500">Context</span>
        </label>

        <div className="grid grid-cols-4 gap-2">
          {[
            { id: "tiktok", label: "TikTok" },
            { id: "reels", label: "Reels" },
            { id: "shorts", label: "Shorts" },
            { id: "ugc-ad", label: "UGC Ad" },
          ].map((opt) => {
            const isActive = (local as any).platform === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setField("platform" as any, opt.id)}
                disabled={disabled}
                className={clsx(
                  "text-xs rounded-lg border px-2 py-1.5 transition bg-neutral-900/60 text-neutral-300 hover:bg-neutral-900 hover:border-neutral-600",
                  disabled && "cursor-not-allowed opacity-60",
                  isActive &&
                    "border-amber-400/80 bg-amber-500/10 text-amber-200"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
