/** K09-S10: integration and release-gate audit for advanced GIS candidates. */

import type { AdvancedSpatialOperationV01 } from "./advanced-spatial-contracts.ts";
import { listAdvancedSpatialOperationsV01 } from "./advanced-spatial-registry.ts";

export type AdvancedSpatialGateKeyV01 = "scientificEvidence" | "privacyReview" | "resourceValidation" | "browserValidation" | "rustWasmParity";
export type AdvancedSpatialGateStatusV01 = "open" | "passed";
export interface AdvancedSpatialGateV01 { key: AdvancedSpatialGateKeyV01; status: AdvancedSpatialGateStatusV01; evidenceId: string | null; }
export interface AdvancedSpatialGateAuditV01 {
  schema: "epi-gis-advanced-gate-audit/0.1";
  operation: AdvancedSpatialOperationV01;
  executionAllowed: false;
  validationStatus: "unvalidated";
  gates: readonly AdvancedSpatialGateV01[];
  openGateKeys: readonly AdvancedSpatialGateKeyV01[];
  diagnostics: readonly string[];
}
export class AdvancedSpatialGateErrorV01 extends Error { constructor(message: string) { super(message); this.name = "AdvancedSpatialGateErrorV01"; } }

const requiredGates: readonly AdvancedSpatialGateKeyV01[] = ["scientificEvidence", "privacyReview", "resourceValidation", "browserValidation", "rustWasmParity"];
const operations = new Set(listAdvancedSpatialOperationsV01().map(({ operation }) => operation));

export function auditAdvancedSpatialGatesV01(operation: AdvancedSpatialOperationV01, evidence: Partial<Record<AdvancedSpatialGateKeyV01, string>> = {}): AdvancedSpatialGateAuditV01 {
  if (!operations.has(operation)) throw new AdvancedSpatialGateErrorV01(`Unregistered advanced spatial operation: ${operation}`);
  const gates = requiredGates.map((key) => ({ key, status: typeof evidence[key] === "string" && evidence[key]!.trim() ? "passed" as const : "open" as const, evidenceId: typeof evidence[key] === "string" && evidence[key]!.trim() ? evidence[key]!.trim() : null }));
  const openGateKeys = gates.filter(({ status }) => status === "open").map(({ key }) => key);
  return {
    schema: "epi-gis-advanced-gate-audit/0.1",
    operation,
    executionAllowed: false,
    validationStatus: "unvalidated",
    gates,
    openGateKeys,
    diagnostics: openGateKeys.length === 0 ? ["All evidence references are recorded, but execution remains disabled until maintainer review promotes the operation."] : [`${openGateKeys.length} release gate(s) remain open; advanced GIS execution is disabled.`],
  };
}

export function listAdvancedSpatialGateKeysV01(): readonly AdvancedSpatialGateKeyV01[] { return requiredGates; }
