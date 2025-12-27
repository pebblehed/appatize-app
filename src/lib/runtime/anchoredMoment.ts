// src/lib/runtime/anchoredMoment.ts
//
// Stage D.6.x — Anchored Moment (zero-friction loop)
// Server-memory store for the currently selected momentId.
// NOTE: This is per-server-process memory (fine for local/dev).
// Later we can persist to DB/redis if needed.

let anchoredMomentId: string | null = null;
let anchoredAtIso: string | null = null;

export function setAnchoredMomentId(momentId: string) {
  anchoredMomentId = momentId;
  anchoredAtIso = new Date().toISOString();
}

export function getAnchoredMomentId() {
  return {
    momentId: anchoredMomentId,
    anchoredAt: anchoredAtIso,
  };
}

export function clearAnchoredMomentId() {
  anchoredMomentId = null;
  anchoredAtIso = null;
}
