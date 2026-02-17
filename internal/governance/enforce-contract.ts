import { CONTRACT_VERSION } from "../contracts/version";
import type { IntelligentOutputEnvelope } from "../contracts/intelligent-output-envelope";

/**
 * Stage D.4.1 — Contract enforcement at API boundary.
 * No envelope leaves an intelligence endpoint without passing this.
 */
export function enforceContractVersion(envelope: IntelligentOutputEnvelope): void {
  if (envelope.version !== CONTRACT_VERSION) {
    throw new Error(
      `ContractVersionMismatch: expected=${CONTRACT_VERSION} got=${envelope.version}`
    );
  }
}

/**
 * Stage D.4.1 — Minimal structural validation (governance, not business logic).
 * We intentionally do NOT re-validate all nested MSE/CIE schemas here.
 * Those remain enforced by their own generators and types.
 */
export function validateEnvelopeBasics(envelope: IntelligentOutputEnvelope): void {
  if (!envelope.generatedAt) throw new Error("InvalidEnvelope: missing generatedAt");
  if (!envelope.mse) throw new Error("InvalidEnvelope: missing mse");
  if (!envelope.cie) throw new Error("InvalidEnvelope: missing cie");
  if (!envelope.audit) throw new Error("InvalidEnvelope: missing audit");

  // Ensure envelope audit aligns with contract version
  if (envelope.audit.contractVersion !== CONTRACT_VERSION) {
    throw new Error(
      `InvalidEnvelope: audit.contractVersion mismatch expected=${CONTRACT_VERSION} got=${envelope.audit.contractVersion}`
    );
  }

  // Qualified must mirror MSE qualification outcome (boolean check only here)
  if (typeof envelope.audit.qualified !== "boolean") {
    throw new Error("InvalidEnvelope: audit.qualified must be boolean");
  }
}
