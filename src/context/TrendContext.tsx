// src/context/TrendContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Trend } from "./BriefContext";

interface TrendContextValue {
  selectedTrend: Trend | null;
  setSelectedTrend: (t: Trend | null) => void;

  // Stage #8 — Save / Pin moment (local-first)
  pinnedTrends: Trend[];
  isTrendPinned: (trendOrId: Trend | string) => boolean;
  togglePinTrend: (trend: Trend) => void;
  unpinTrend: (trendOrId: Trend | string) => void;
  clearPinnedTrends: () => void;
}

const TrendContext = createContext<TrendContextValue | undefined>(undefined);

// LocalStorage key (versioned so we can migrate later safely)
const PINNED_KEY = "appatize:pinnedTrends:v1";

function isTrendObject(x: unknown): x is Trend {
  if (!x || typeof x !== "object") return false;

  const r = x as Record<string, unknown>;

  return (
    typeof r.id === "string" &&
    typeof r.status === "string" &&
    typeof r.name === "string" &&
    typeof r.description === "string" &&
    typeof r.formatLabel === "string" &&
    typeof r.momentumLabel === "string"
  );
}

function safeParsePinned(raw: string | null): Trend[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTrendObject);
  } catch {
    return [];
  }
}

function uniqById(trends: Trend[]): Trend[] {
  const seen = new Set<string>();
  const out: Trend[] = [];
  for (const t of trends) {
    if (!t?.id) continue;
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

export function TrendProvider({ children }: { children: ReactNode }) {
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

  // Stage #8 pinned state (local-first)
  // Lazy init: reads localStorage once during initial client render; no setState-in-effect needed.
  const [pinnedTrends, setPinnedTrends] = useState<Trend[]>(() => {
    if (typeof window === "undefined") return [];
    return uniqById(safeParsePinned(window.localStorage.getItem(PINNED_KEY)));
  });

  // Persist whenever pinned changes
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(PINNED_KEY, JSON.stringify(uniqById(pinnedTrends)));
    } catch {
      // Never throw — storage can fail (quota, privacy mode)
    }
  }, [pinnedTrends]);

  const pinnedIdSet = useMemo(() => new Set(pinnedTrends.map((t) => t.id)), [pinnedTrends]);

  const isTrendPinned = (trendOrId: Trend | string) => {
    const id = typeof trendOrId === "string" ? trendOrId : trendOrId?.id;
    if (!id) return false;
    return pinnedIdSet.has(id);
  };

  const togglePinTrend = (trend: Trend) => {
    if (!trend?.id) return;

    setPinnedTrends((prev) => {
      const exists = prev.some((t) => t.id === trend.id);
      if (exists) return prev.filter((t) => t.id !== trend.id);
      return uniqById([trend, ...prev]);
    });
  };

  const unpinTrend = (trendOrId: Trend | string) => {
    const id = typeof trendOrId === "string" ? trendOrId : trendOrId?.id;
    if (!id) return;
    setPinnedTrends((prev) => prev.filter((t) => t.id !== id));
  };

  const clearPinnedTrends = () => setPinnedTrends([]);

  return (
    <TrendContext.Provider
      value={{
        selectedTrend,
        setSelectedTrend,
        pinnedTrends,
        isTrendPinned,
        togglePinTrend,
        unpinTrend,
        clearPinnedTrends,
      }}
    >
      {children}
    </TrendContext.Provider>
  );
}

export function useTrendContext(): TrendContextValue {
  const ctx = useContext(TrendContext);
  if (!ctx) throw new Error("useTrendContext must be used inside TrendProvider");
  return ctx;
}
