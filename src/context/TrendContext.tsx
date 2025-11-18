// src/context/TrendContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

// Shape of a trend object as used on the Trends page
export interface Trend {
  state: string;
  stateClass: string;
  title: string;
  summary: string;
  format: string;
  momentum: string;
}

// Context value shape
interface TrendContextValue {
  selectedTrend: Trend | null;
  setSelectedTrend: (trend: Trend | null) => void;
}

// Create the context
const TrendContext = createContext<TrendContextValue | undefined>(undefined);

// Provider component to wrap the app
export function TrendProvider({ children }: { children: ReactNode }) {
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

  const value: TrendContextValue = {
    selectedTrend,
    setSelectedTrend,
  };

  return (
    <TrendContext.Provider value={value}>{children}</TrendContext.Provider>
  );
}

// Convenience hook for consuming the context
export function useTrendContext(): TrendContextValue {
  const ctx = useContext(TrendContext);
  if (!ctx) {
    throw new Error("useTrendContext must be used within a TrendProvider");
  }
  return ctx;
}
