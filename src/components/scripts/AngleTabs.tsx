// src/components/scripts/AngleTabs.tsx
"use client";

import React from "react";

type AngleTab = {
  id: string;
  label: string;
};

interface AngleTabsProps {
  angles: AngleTab[];
  activeAngleId: string | null;
  onChange: (id: string) => void;
}

export default function AngleTabs({
  angles,
  activeAngleId,
  onChange,
}: AngleTabsProps) {
  if (!angles || angles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {angles.map((angle) => {
        const isActive = angle.id === activeAngleId;
        return (
          <button
            key={angle.id}
            type="button"
            onClick={() => onChange(angle.id)}
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
              "border",
              isActive
                ? "border-purple-400/80 bg-purple-700/60 text-neutral-50 shadow-[0_0_0_1px_rgba(244,114,255,0.5)]"
                : "border-neutral-700 bg-neutral-900/70 text-neutral-300 hover:border-purple-400/60 hover:bg-neutral-900",
            ].join(" ")}
          >
            <span className="truncate max-w-[13rem]">{angle.label}</span>
          </button>
        );
      })}
    </div>
  );
}
