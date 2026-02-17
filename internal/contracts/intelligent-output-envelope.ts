import type { ContractVersion } from "./version";
import type { ISODateTime } from "./MSE_OUTPUT_SCHEMA";
import type { MSEOutput } from "./MSE_OUTPUT_SCHEMA";
import type { CIEOutput } from "./CIE_OUTPUT_SCHEMA";

/**
 * Stage D.4.1 — External API envelope (locked).
 * This is the ONLY allowed response shape for intelligence endpoints.
 *
 * Notes:
 * - Keeps MSE/CIE outputs as-is (no redesign).
 * - Adds governance version + minimal audit/provenance wrapper fields.
 */
export interface IntelligentOutputEnvelope {
  /** Stage D governance version */
  version: ContractVersion;

  /** When this envelope was emitted (ISO-8601) */
  generatedAt: ISODateTime;

  /**
   * MSE truth layer output (signal, evidence, scores, decision).
   * Must be the exact MSEOutput type from MSE_OUTPUT_SCHEMA.ts
   */
  mse: MSEOutput;

  /**
   * CIE creative layer output derived from MSE.
   * Must be the exact CIEOutput type from CIE_OUTPUT_SCHEMA.ts
   */
  cie: CIEOutput;

  /**
   * Minimal envelope-level audit notes.
   * (This does not replace MSE qualification; it records boundary status.)
   */
  audit: {
    contractVersion: ContractVersion;
    qualified: boolean;
    notes?: string[];
  };
}
