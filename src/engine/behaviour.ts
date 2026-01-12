// src/engine/behaviour.ts
//
// Stage 11 — Behaviour Confirmation Layer (BCL v1)
//
// Purpose:
// Deterministically detect whether a trend shows
// evidence of REAL behaviour change.
//
// No AI. No scoring. No tuning. No opinions.

export type BehaviourResult = {
  behaviourDetected: boolean;
  matchedPhrases: string[];
};

// Canonical v1 behaviour verbs (locked)
const BEHAVIOUR_PATTERNS = [
  // Change / adoption
  "started using",
  "switched to",
  "moved to",
  "replaced",
  "stopped using",
  "now using",
  "adopted",

  // Action
  "bought",
  "cancelled",
  "installed",
  "built",
  "launched",
  "rolled out",

  // Constraint-driven behaviour
  "had to",
  "forced to",
  "can’t anymore",
  "can't anymore",
  "no longer possible",
  "required to",
];

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

export function detectBehaviour(texts: string[]): BehaviourResult {
  const haystack = normalize(texts.join(" "));
  const matched: string[] = [];

  for (const phrase of BEHAVIOUR_PATTERNS) {
    if (haystack.includes(phrase)) {
      matched.push(phrase);
    }
  }

  return {
    behaviourDetected: matched.length > 0,
    matchedPhrases: matched,
  };
}
