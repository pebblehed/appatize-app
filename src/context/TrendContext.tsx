// src/context/TrendContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import type { Trend } from "@/engine/trends";
;

interface TrendContextValue {
  selectedTrend: Trend | null;
  setSelectedTrend: (t: Trend | null) => void;
}

/**
 * TrendContext
 *
 * Holds the globally selected Trend that the user is working with.
 * Flow:
 *   TrendsPage       → setSelectedTrend(trend)
 *   AngleCard        → reads selectedTrend + angle → generateBriefFromAngle(...)
 *   BriefContext     → stores activeBrief
 *   ScriptsPage      → generates scripts from activeBrief
 */
const TrendContext = createContext<TrendContextValue | undefined>(undefined);

export function TrendProvider({ children }: { children: ReactNode }) {
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

  return (
    <TrendContext.Provider value={{ selectedTrend, setSelectedTrend }}>
      {children}
    </TrendContext.Provider>
  );
}

export function useTrendContext(): TrendContextValue {
  const ctx = useContext(TrendContext);
  if (!ctx) {
    throw new Error("useTrendContext must be used inside TrendProvider");
  }
  return ctx;
}
