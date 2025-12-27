export type TriadGuardResult = {
  ok: boolean;
  reason?: string;
  triadCount: number;
};

function countBulletTriads(text: string): number {
  const lines = text.split("\n").map((l) => l.trim());

  let triads = 0;
  let run = 0;

  const isBullet = (l: string) =>
    /^(-|\*|•)\s+/.test(l) || /^\d+\.\s+/.test(l);

  for (const l of lines) {
    if (isBullet(l)) run++;
    else {
      if (run === 3) triads++;
      run = 0;
    }
  }
  if (run === 3) triads++;

  return triads;
}

function countOrdinalTriads(text: string): number {
  const t = (text || "").toLowerCase();
  const pattern = /\bfirst\b[\s\S]{0,260}\bsecond\b[\s\S]{0,260}\bthird\b/g;
  const matches = t.match(pattern);
  return matches ? matches.length : 0;
}

function countThreeCadence(text: string): number {
  const t = (text || "").toLowerCase();
  const pattern =
    /\bthree\s+\w+[\s\S]{0,180}\bthree\s+\w+[\s\S]{0,180}\bthree\s+\w+/g;
  const matches = t.match(pattern);
  return matches ? matches.length : 0;
}

function countTriads(text: string): number {
  const bullet = countBulletTriads(text);
  const ordinal = countOrdinalTriads(text);
  const threeCadence = countThreeCadence(text);
  return bullet + ordinal + threeCadence;
}

export function checkTriadGuard(text: string): TriadGuardResult {
  const triadCount = countTriads(text);

  // ProDev tightening: per-variant limit (prevents “AI cadence”)
  // Max 1 triad cadence per variant text.
  if (triadCount > 1) {
    return {
      ok: false,
      reason: `Triad cadence overuse detected (${triadCount}). Max is 1 per variant.`,
      triadCount,
    };
  }

  return { ok: true, triadCount };
}

export function triadRewriteInstruction(reason: string) {
  return [
    "Rewrite the following text to reduce AI cadence caused by rule-of-three constructions.",
    "Constraints:",
    "- Preserve meaning, facts, and intent exactly.",
    "- Do not add new claims. Do not remove important details.",
    "- Keep canonical triads ONLY if they are system semantics (e.g., ACT/WAIT/REFRESH).",
    "- Otherwise, avoid repeated triads: convert to prose, 2 points + nuance, or uneven structures.",
    "- Avoid 'First/Second/Third' and repeated 'three X, three Y, three Z' patterns.",
    `Failure reason: ${reason}`,
  ].join("\n");
}
