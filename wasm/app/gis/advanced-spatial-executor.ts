/** K09 corrective gate: candidate algorithms are not a public execution path. */

import { validateAdvancedSpatialPlanV01, type AdvancedSpatialPlanV01, type AdvancedSpatialResultV01 } from "./advanced-spatial-contracts.ts";
import type { AdvancedSpatialGateAuditV01 } from "./advanced-spatial-gates.ts";

export class AdvancedSpatialExecutionBlockedErrorV01 extends Error {
  constructor(message = "K09 advanced spatial execution is disabled until scientific, privacy, resource, browser, parity, and maintainer gates are complete.") {
    super(message);
    this.name = "AdvancedSpatialExecutionBlockedErrorV01";
  }
}

export function executeAdvancedSpatialPlanV01(planInput: AdvancedSpatialPlanV01, audit: AdvancedSpatialGateAuditV01): AdvancedSpatialResultV01 {
  const plan = validateAdvancedSpatialPlanV01(planInput);
  if (audit.operation !== plan.operation) throw new AdvancedSpatialExecutionBlockedErrorV01("The gate audit operation does not match the requested plan.");
  if (!audit.executionAllowed || (audit.validationStatus as string) !== "validated") throw new AdvancedSpatialExecutionBlockedErrorV01();
  throw new AdvancedSpatialExecutionBlockedErrorV01("No promoted K09 implementation is available.");
}
