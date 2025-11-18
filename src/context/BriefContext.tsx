// src/context/BriefContext.tsx
"use client";

import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
} from "react";

export interface Brief {
  title: string;
  trend: string;
  objective: string;
  status: string;

  // Optional AI-generated fields
  summary?: string;
  insight?: string;
  creativeDirection?: string;
  hooks?: string[];
  cta?: string;
  deliverables?: string[];

  // Full raw AI brief object
  fullBrief?: any;
}

interface BriefContextValue {
  selectedBrief: Brief | null;
  setSelectedBrief: (brief: Brief | null) => void;
}

const BriefContext = createContext<BriefContextValue | undefined>(undefined);

export function BriefProvider({ children }: { children: ReactNode }) {
  const [selectedBrief, setSelectedBrief] = useState<Brief | null>(null);

  return (
    <BriefContext.Provider value={{ selectedBrief, setSelectedBrief }}>
      {children}
    </BriefContext.Provider>
  );
}

export function useBriefContext(): BriefContextValue {
  const ctx = useContext(BriefContext);
  if (!ctx) throw new Error("useBriefContext must be used inside BriefProvider");
  return ctx;
}
