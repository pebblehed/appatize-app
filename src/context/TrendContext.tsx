// src/context/TrendContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import type { Trend } from "./BriefContext";

interface TrendContextValue {
  selectedTrend: Trend | null;
  setSelectedTrend: (t: Trend | null) => void;
}

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
