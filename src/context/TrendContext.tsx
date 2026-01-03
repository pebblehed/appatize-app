// src/context/TrendContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import type { Trend } from "./BriefContext";

interface TrendContextValue {
  // Existing
  selectedTrend: Trend | null;
  setSelectedTrend: (t: Trend | null) => void;

  // Stage #8 — Save / Pin moment (local-first)
  pinnedTrends: Trend[];
  isTrendPinned: (trendOrId: Trend | string) => boolean;
  togglePinTrend: (trend: Trend) => void;
  unpinTrend: (trendOrId: Trend | string) => void;
  clearPinnedTrends: () => void;
}

/**
 * TrendContext
 *
 * Holds the globally selected Trend that the user is working with.
 *
 * Stage #8 (Save / Pin):
 * - Local-first persistence via localStorage (deterministic)
 * - No network calls, no backend dependency
 * - Safe parsing + never-throw behaviour
 */
const TrendContext = createContext<TrendContextValue | undefined>(undefined);

// LocalStorage key (versioned so we can migrate later safely)
const PINNED_KEY = "appatize:pinnedTrends:v1";

function safeParsePinned(raw: string | null): Trend[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Minimal shape guard
    return parsed
      .filter((t) => t && typeof t === "object")
      .filter((t) => typeof t.id === "string" && typeof t.name === "string")
      .map((t) => t as Trend);
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
  const [pinnedTrends, setPinnedTrends] = useState<Trend[]>([]);

  // Load pinned trends once on mount (client-only)
  useEffect(() => {
    const initial = safeParsePinned(
      typeof window !== "undefined" ? window.localStorage.getItem(PINNED_KEY) : null
    );
    setPinnedTrends(uniqById(initial));
  }, []);

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
      if (exists) {
        return prev.filter((t) => t.id !== trend.id);
      }
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
