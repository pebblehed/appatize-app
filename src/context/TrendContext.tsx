// src/context/TrendContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import type { Trend } from "./BriefContext";

const PINNED_TRENDS_STORAGE_KEY = "app:pinnedTrends:v1";

interface TrendContextValue {
  selectedTrend: Trend | null;
  setSelectedTrend: (t: Trend | null) => void;

  // Stage #8 — Save / pin moment (deterministic)
  pinnedIds: string[];
  isPinned: (id: string) => boolean;
  togglePin: (id: string) => void;
  clearPins: () => void;
}

/**
 * TrendContext
 *
 * Holds the globally selected Trend that the user is working with.
 * Also holds pinned/saved trends (by id) for quick recall.
 *
 * Flow:
 *   TrendsPage       → setSelectedTrend(trend)
 *   Trend cards      → togglePin(trend.id)
 *   AngleCard        → reads selectedTrend + angle → generateBriefFromAngle(...)
 *   BriefContext     → stores activeBrief
 *   ScriptsPage      → generates scripts from activeBrief
 */
const TrendContext = createContext<TrendContextValue | undefined>(undefined);

function safeReadPinnedIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_TRENDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // keep only strings, unique, non-empty
    const cleaned = parsed
      .filter((x) => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(cleaned));
  } catch {
    return [];
  }
}

function safeWritePinnedIds(ids: string[]) {
  try {
    localStorage.setItem(PINNED_TRENDS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage write failures (private mode, quota, etc.)
  }
}

export function TrendProvider({ children }: { children: ReactNode }) {
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);

  // Pinned trends are stored as IDs only (stable + small)
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Load pins once on mount (client-only)
  useEffect(() => {
    setPinnedIds(safeReadPinnedIds());
  }, []);

  // Persist pins whenever they change
  useEffect(() => {
    safeWritePinnedIds(pinnedIds);
  }, [pinnedIds]);

  const isPinned = useMemo(() => {
    const set = new Set(pinnedIds);
    return (id: string) => set.has(id);
  }, [pinnedIds]);

  const togglePin = (id: string) => {
    const tid = typeof id === "string" ? id.trim() : "";
    if (!tid) return;

    setPinnedIds((prev) => {
      const has = prev.includes(tid);
      if (has) return prev.filter((x) => x !== tid);
      return [...prev, tid];
    });
  };

  const clearPins = () => {
    setPinnedIds([]);
  };

  return (
    <TrendContext.Provider
      value={{
        selectedTrend,
        setSelectedTrend,
        pinnedIds,
        isPinned,
        togglePin,
        clearPins,
      }}
    >
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
