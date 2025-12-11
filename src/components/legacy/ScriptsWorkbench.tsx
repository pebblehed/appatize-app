// ============================================================================
//  DEPRECATED COMPONENT — DO NOT USE IN PRODUCTION
// ============================================================================
//
//  This component belonged to the OLD Appatize scripts engine (pre–Stage 4).
//  It is NO LONGER compatible with:
//    • BehaviourControlsPanel v4
//    • /api/scripts/intelligence (Stage 4 unified pipeline)
//    • Cultural Snapshot v2
//    • Moment-Signal Extraction (MSE)
//    • Angle grouping + variant scoring
//
//  The live engine is now fully handled by:
//
//      src/app/scripts/page.tsx
//
//  This file remains only for historical reference and must NOT be imported,
//  rendered, or resurrected. Keeping it prevents confusion but protects the 
//  system from accidental legacy behaviours.
//
// ============================================================================

"use client";

import React from "react";

/**
 * ⚠️ DeprecatedStub
 *
 * This safe stub replaces the old ScriptsWorkbench UI.
 * It ensures that even if this component is accidentally rendered,
 * it will NOT call old API routes or break the Stage 4 engine.
 */
export default function ScriptsWorkbench() {
  return (
    <div className="rounded-xl border border-red-700/60 bg-red-950/30 p-4 mt-4 space-y-2">
      <h2 className="text-sm font-semibold text-red-200">
        Deprecated Component: ScriptsWorkbench
      </h2>

      <p className="text-xs text-red-100/80 leading-relaxed">
        <strong>ScriptsWorkbench.tsx</strong> belonged to an older version of 
        the Appatize engine. It has been formally retired and should not be 
        used in any part of the application.
      </p>

      <p className="text-[11px] text-red-300/70">
        The active, fully wired Stage 4 system lives in:
        <br />
        <span className="font-mono text-red-200">
          /src/app/scripts/page.tsx
        </span>
      </p>
    </div>
  );
}

// ============================================================================
//  ARCHIVED LEGACY IMPLEMENTATION (READ-ONLY)
//  ---------------------------------------------------------------------------
//  This entire block is left here for historical reference only.
//  None of this code is executed, imported, or relied upon.
// ============================================================================
//
//  /*
//  import React, { useCallback, useState } from "react";
//  import { useBriefContext } from "@/context/BriefContext";
//  import BehaviourControlsPanel from "./BehaviourControlsPanel";
//  import type { BehaviourControlsInput } from "@/lib/intelligence/types";
//
//  type ScriptVariant = {
//    id: string;
//    label: string;
//    content: string;
//  };
//
//  const DEFAULT_BEHAVIOUR: BehaviourControlsInput = {
//    energy: "steady" as any,
//    tone: "clean" as any,
//    rhythm: "balanced" as any,
//    platform: "ugc-ad" as any,
//  };
//
//  export default function ScriptsWorkbench() {
//    ...
//  }
//  */
//
// ============================================================================

