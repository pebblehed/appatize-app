import { CONTRACT_VERSION } from "../contracts/version";

/**
 * Stage D.4.1 — /api/scripts/generate boundary enforcement.
 * We do NOT redesign the response shape; we only:
 * - require a contractVersion stamp
 * - validate minimal invariants for success + error responses
 */
export function enforceGenerateApiResponse(payload: unknown): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("GenerateApiContractError: payload must be an object");
  }

  const p = payload as Record<string, unknown>;

  // All responses must carry contractVersion (additive field; stable governance stamp)
  if (p.contractVersion !== CONTRACT_VERSION) {
    throw new Error(
      `GenerateApiContractError: contractVersion mismatch expected=${CONTRACT_VERSION} got=${String(
        p.contractVersion
      )}`
    );
  }

  const isSuccess = "variants" in p || "platforms" in p || "cultural" in p;
  const isError = "error" in p;

  if (!isSuccess && !isError) {
    throw new Error("GenerateApiContractError: payload must be success or error shape");
  }

  // Success shape: variants[], platforms[], cultural (null or object)
  if (isSuccess && !isError) {
    if (!Array.isArray(p.variants)) {
      throw new Error("GenerateApiContractError: variants must be an array");
    }
    if (!Array.isArray(p.platforms)) {
      throw new Error("GenerateApiContractError: platforms must be an array");
    }

    const cultural = p.cultural;
    if (!(cultural === null || typeof cultural === "object")) {
      throw new Error("GenerateApiContractError: cultural must be null or object");
    }
  }

  // Error shape: error string, optional code string
  if (isError) {
    if (typeof p.error !== "string" || p.error.trim().length === 0) {
      throw new Error("GenerateApiContractError: error must be a non-empty string");
    }
    if ("code" in p && p.code !== undefined && typeof p.code !== "string") {
      throw new Error("GenerateApiContractError: code must be a string when present");
    }
  }
}
