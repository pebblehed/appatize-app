import { CONTRACT_VERSION } from "../contracts/version";

/**
 * Stage D.4.1 — Live trends API envelope enforcement.
 * We DO NOT redesign the /api/trends/live response shape.
 * We only enforce version stamping + minimal invariants at the boundary.
 */
export function enforceLiveApiResponse(payload: unknown): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("LiveApiContractError: payload must be an object");
  }

  const p = payload as {
    source?: unknown;
    status?: unknown;
    count?: unknown;
    trends?: unknown;
    debug?: unknown;
  };

  // Required top-level fields
  if (p.source !== "live") {
    throw new Error(`LiveApiContractError: source must be "live"`);
  }
  if (typeof p.status !== "string") {
    throw new Error("LiveApiContractError: status must be string");
  }
  if (typeof p.count !== "number" || Number.isNaN(p.count) || p.count < 0) {
    throw new Error("LiveApiContractError: count must be a non-negative number");
  }
  if (!Array.isArray(p.trends)) {
    throw new Error("LiveApiContractError: trends must be an array");
  }

  // D.4.1 rule: successful responses must carry contractVersion in debug
  // (we do not require debug in "unavailable" mode)
  if (p.status === "ok") {
    const d = p.debug as { contractVersion?: unknown } | undefined;
    if (!d || typeof d !== "object") {
      throw new Error("LiveApiContractError: debug must be present when status=ok");
    }
    if (d.contractVersion !== CONTRACT_VERSION) {
      throw new Error(
        `LiveApiContractError: debug.contractVersion mismatch expected=${CONTRACT_VERSION} got=${String(
          d.contractVersion
        )}`
      );
    }
  }

  // Optional sanity: count should match trends length when ok
  if (p.status === "ok" && p.count !== (p.trends as unknown[]).length) {
    throw new Error("LiveApiContractError: count must equal trends.length when status=ok");
  }
}
