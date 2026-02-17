/**
 * Stage D.4.1 — Canonical governance version for API contract surfaces.
 * This does NOT replace MSE/CIE schema versions (e.g., "D.1").
 * It governs the external envelope + enforcement.
 */

// Stage D.4.1 frozen baseline maps to this existing contract lock identifier.

export const CONTRACT_VERSION = "stage-3.9-contract-lock@ed08a88" as const;
export type ContractVersion = typeof CONTRACT_VERSION;
