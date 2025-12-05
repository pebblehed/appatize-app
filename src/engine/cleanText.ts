// src/engine/cleanText.ts
//
// Strategic text sanitiser for Appatize.
// - Removes AI-style stylistic hyphens (scroll-stopping → scroll stopping)
// - Preserves brand / proper-noun hyphens (Spider-Man, X-Men, Coca-Cola, Fenty-Skin)
// - Preserves URLs, handles, hashtags, numeric ranges
// - Applies hybrid spacing: joins or spaces segments for most natural reading
// - Normalises a few overused CTA phrases (e.g. "drop a same")

const BRAND_ALLOWLIST = new Set<string>([
  "Spider-Man",
  "X-Men",
  "Coca-Cola",
  "Fenty-Skin",
  "Lo-Fi",
]);

function isUrlLike(token: string): boolean {
  const lower = token.toLowerCase();
  return (
    lower.startsWith("http://") ||
    lower.startsWith("https://") ||
    lower.startsWith("www.") ||
    lower.includes(".com") ||
    lower.includes(".io") ||
    lower.includes(".co/") ||
    lower.includes(".net") ||
    lower.includes(".ai")
  );
}

function isHandleOrHashtag(token: string): boolean {
  return token.startsWith("@") || token.startsWith("#");
}

function isNumericHyphen(token: string): boolean {
  const parts = token.split("-");
  if (parts.length !== 2) return false;
  return /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]);
}

/**
 * Very lightweight brand / proper-noun detector for hyphenated tokens.
 * We preserve:
 * - Known allowlisted tokens
 * - Tokens with both sides starting uppercase (Mid-Year, Fenty-Skin, X-Men)
 */
function isBrandLike(token: string): boolean {
  if (BRAND_ALLOWLIST.has(token)) return true;

  const coreMatch = token.match(/^([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)$/);
  if (!coreMatch) return false;

  const core = coreMatch[1];
  const parts = core.split("-");
  if (parts.length < 2) return false;

  const [left, right] = parts;
  if (!left || !right) return false;

  const leftInitial = left[0];
  const rightInitial = right[0];

  if (
    leftInitial === leftInitial.toUpperCase() &&
    rightInitial === rightInitial.toUpperCase()
  ) {
    return true;
  }

  return false;
}

/**
 * Clean a single token that may contain hyphens.
 * Applies hybrid spacing and preserves brand / URL / handle cases.
 */
function cleanHyphenatedToken(rawToken: string): string {
  if (!rawToken.includes("-")) return rawToken;

  // Preserve URLs, handles, numeric ranges and clear brand-like tokens
  if (
    isUrlLike(rawToken) ||
    isHandleOrHashtag(rawToken) ||
    isNumericHyphen(rawToken) ||
    isBrandLike(rawToken)
  ) {
    return rawToken;
  }

  // Separate trailing punctuation from the core token, e.g. "scroll-stopping," → "scroll-stopping" + ","
  const match = rawToken.match(/^(.+?)([.,!?;:]+)$/);
  let core = rawToken;
  let trailing = "";
  if (match) {
    core = match[1];
    trailing = match[2];
  }

  if (!core.includes("-")) {
    return core + trailing;
  }

  const segments = core.split("-").filter(Boolean);
  if (segments.length === 0) {
    return core.replace(/-/g, "") + trailing;
  }

  // Rebuild with hybrid rule: decide per boundary whether to space or join
  let rebuilt = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const part = segments[i];

    const prevLen = prev.length;
    const partLen = part.length;

    // Heuristic:
    // - If both look like "full" words → space (scroll stopping)
    // - If one side is very short (re-frame) → join (reframe)
    // - If unsure → space (more natural)
    const joinWithSpace =
      (prevLen >= 3 && partLen >= 3) &&
      !/^\d+$/.test(prev) &&
      !/^\d+$/.test(part);

    rebuilt += joinWithSpace ? ` ${part}` : part;
  }

  return rebuilt + trailing;
}

/**
 * Main sanitiser for all engine-visible text.
 * - Normalises CTAs (e.g. removes "drop a same")
 * - Enforces Strategic Hyphen Governance across all creative outputs.
 */
export function cleanText(input: string | undefined | null): string {
  if (!input) return "";

  let text = input;

  // Normalise / remove specific overused CTA phrasing.
  // We don't want "drop a 'same'" or similar.
  text = text.replace(
    /\bdrop (a|the)?\s*['"]?same['"]?\b/gi,
    "say this hits if it resonates"
  );

  // Quick exit if no hyphens at all
  if (!text.includes("-")) {
    return text;
  }

  const tokens = text.split(/\s+/);
  const cleanedTokens = tokens.map((token) => cleanHyphenatedToken(token));
  return cleanedTokens.join(" ");
}
