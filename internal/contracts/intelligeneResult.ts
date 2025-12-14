// src/internal/contracts/intelligenceResult.ts
//
// Stage D — Intelligence Contract
// Intelligence must NEVER silently return empty outputs.
// Failures are typed and explicit.

export type IntelligenceErrorCode =
  | "SIGNALS_UNAVAILABLE"
  | "SIGNALS_EMPTY"
  | "INTELLIGENCE_MALFORMED"
  | "INTELLIGENCE_EMPTY"
  | "UPSTREAM_ERROR";

export type IntelligenceOk<T> = {
  ok: true;
  data: T;
};

export type IntelligenceFail = {
  ok: false;
  error: {
    code: IntelligenceErrorCode;
    message: string;
    meta?: Record<string, unknown>;
  };
};

export type IntelligenceResult<T> = IntelligenceOk<T> | IntelligenceFail;

/**
 * Guard: signals must be available AND contain at least one usable item.
 */
export function requireSignals(
  payload: any
): IntelligenceResult<{ items: any[]; sources?: any[] }> {
  const available = Boolean(payload?.available);
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (!available) {
    return {
      ok: false,
      error: {
        code: "SIGNALS_UNAVAILABLE",
        message: "Signals unavailable (no upstream source is healthy).",
        meta: { sources: payload?.sources ?? [] },
      },
    };
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: {
        code: "SIGNALS_EMPTY",
        message: "Signals available but empty (no usable items returned).",
        meta: { sources: payload?.sources ?? [] },
      },
    };
  }

  return { ok: true, data: { items, sources: payload?.sources } };
}

/**
 * Guard: scripts must exist and be non-empty.
 * Adjust the shape here to your actual output (scripts/angles/variants).
 */
export function requireNonEmptyScripts(payload: any): IntelligenceResult<any> {
  const scripts = payload?.scripts;

  if (!Array.isArray(scripts)) {
    return {
      ok: false,
      error: {
        code: "INTELLIGENCE_MALFORMED",
        message: "Intelligence output malformed: scripts is not an array.",
      },
    };
  }

  if (scripts.length === 0) {
    return {
      ok: false,
      error: {
        code: "INTELLIGENCE_EMPTY",
        message: "Intelligence returned zero scripts (blocked by contract).",
      },
    };
  }

  return { ok: true, data: payload };
}
