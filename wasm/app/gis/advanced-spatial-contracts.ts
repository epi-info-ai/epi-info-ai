/** K09-S1: governed advanced spatial-operation contracts.
 *
 * This is a plan/receipt boundary only. It does not execute an operation,
 * open a dataset, or grant a Worker access to a filesystem path or network.
 */

export type AdvancedSpatialOperationV01 =
  | "gis.spatial.weights"
  | "gis.spatial.moran"
  | "gis.spatial.lisa"
  | "gis.spatial.getisOrd"
  | "gis.spatial.h3Aggregate"
  | "gis.spatial.density"
  | "gis.spatial.cluster"
  | "gis.geometry.repair"
  | "gis.raster.zonalStatistics";

export type AdvancedSpatialInputRoleV01 = "observations" | "geometry" | "raster" | "weights";
export type AdvancedSpatialDisclosureV01 = "aggregate" | "record-level" | "renderer-only";
export type AdvancedSpatialStatusV01 = "planned" | "succeeded" | "cancelled" | "rejected" | "failed";

export interface AdvancedSpatialInputV01 {
  assetId: string;
  sha256: string;
  role: AdvancedSpatialInputRoleV01;
  mediaType: string;
  byteLength: number;
  declaredCrs: string | "unknown";
}

export interface AdvancedSpatialLimitsV01 {
  maxInputBytes: number;
  maxOutputBytes: number;
  maxFeatures: number;
  maxCoordinates: number;
  maxCells: number;
  maxPermutations: number;
  timeoutMilliseconds: number;
}

export interface AdvancedSpatialPrivacyV01 {
  recordValuesStayLocal: true;
  outputDisclosure: AdvancedSpatialDisclosureV01;
  allowRecordLevelExport: boolean;
}

export type AdvancedSpatialParametersV01 =
  | { operation: "weights"; method: "queen" | "rook" | "distance-band" | "k-nearest"; thresholdMeters?: number; neighborCount?: number }
  | { operation: "moran" | "lisa" | "getisOrd"; valueField: string; weightsPlanId: string; permutations: number; seed: number; missingPolicy: "exclude" | "fail" }
  | { operation: "h3Aggregate"; latitudeField: string; longitudeField: string; resolution: number; aggregation: "count" | "sum" | "mean"; valueField?: string }
  | { operation: "density"; latitudeField: string; longitudeField: string; bandwidthMeters: number; maxCells: number }
  | { operation: "cluster"; method: "dbscan" | "exploratory-circle"; latitudeField: string; longitudeField: string; radiusMeters: number; minPoints: number }
  | { operation: "repair"; policy: "report-only" | "bounded-repair"; preserveSource: true }
  | { operation: "zonalStatistics"; statistic: "count" | "sum" | "mean" | "minimum" | "maximum"; noDataPolicy: "exclude" | "fail"; zoneField: string };

export interface AdvancedSpatialPlanV01 {
  schema: "epi-gis-advanced-plan/0.1";
  id: string;
  operation: AdvancedSpatialOperationV01;
  projectRevision: string;
  inputs: readonly AdvancedSpatialInputV01[];
  parameters: AdvancedSpatialParametersV01;
  limits: AdvancedSpatialLimitsV01;
  privacy: AdvancedSpatialPrivacyV01;
  requestedOutputs: readonly { id: string; mediaType: string; disclosure: AdvancedSpatialDisclosureV01 }[];
}

export interface AdvancedSpatialDiagnosticV01 { code: string; severity: "info" | "warning" | "error"; message: string; path?: string; }

export interface AdvancedSpatialReceiptV01 {
  schema: "epi-gis-advanced-receipt/0.1";
  planId: string;
  operation: AdvancedSpatialOperationV01;
  implementationVersion: string;
  terminalStatus: AdvancedSpatialStatusV01;
  validationStatus: "unvalidated" | "candidate" | "validated";
  diagnostics: readonly AdvancedSpatialDiagnosticV01[];
}

export interface AdvancedSpatialResultV01 {
  schema: "epi-gis-advanced-result/0.1";
  planId: string;
  status: AdvancedSpatialStatusV01;
  outputs: readonly { id: string; mediaType: string; byteLength: number; sha256: string }[];
  diagnostics: readonly AdvancedSpatialDiagnosticV01[];
  receipt: AdvancedSpatialReceiptV01;
}

export class AdvancedSpatialContractErrorV01 extends Error {
  readonly issues: readonly { path: string; message: string }[];
  constructor(issues: readonly { path: string; message: string }[]) {
    super(`Invalid K09 advanced spatial contract: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
    this.name = "AdvancedSpatialContractErrorV01";
    this.issues = issues;
  }
}

const operations: readonly AdvancedSpatialOperationV01[] = [
  "gis.spatial.weights", "gis.spatial.moran", "gis.spatial.lisa", "gis.spatial.getisOrd",
  "gis.spatial.h3Aggregate", "gis.spatial.density", "gis.spatial.cluster",
  "gis.geometry.repair", "gis.raster.zonalStatistics",
];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const has = (value: Record<string, unknown>, key: string): boolean => Object.hasOwn(value, key);
const integer = (value: unknown, path: string, minimum: number, maximum: number, issues: { path: string; message: string }[]) => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) issues.push({ path, message: `must be an integer from ${minimum} through ${maximum}` });
};
const positiveNumber = (value: unknown, path: string, maximum: number, issues: { path: string; message: string }[]) => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > maximum) issues.push({ path, message: `must be a finite number greater than zero and no greater than ${maximum}` });
};
const nonEmpty = (value: unknown, path: string, issues: { path: string; message: string }[]) => { if (typeof value !== "string" || value.trim() === "") issues.push({ path, message: "must be a non-empty string" }); };
const exactKeys = (value: Record<string, unknown>, keys: readonly string[], path: string, issues: { path: string; message: string }[]) => Object.keys(value).filter((key) => !keys.includes(key)).forEach((key) => issues.push({ path: `${path}.${key}`, message: "is not permitted" }));

function validateParameters(value: unknown, issues: { path: string; message: string }[]): void {
  if (!isObject(value) || typeof value.operation !== "string") { issues.push({ path: "parameters", message: "must identify an operation" }); return; }
  const path = "parameters";
  if (value.operation === "weights") {
    exactKeys(value, ["operation", "method", "thresholdMeters", "neighborCount"], path, issues);
    if (!["queen", "rook", "distance-band", "k-nearest"].includes(String(value.method))) issues.push({ path: `${path}.method`, message: "is not supported" });
    if (value.method === "distance-band") positiveNumber(value.thresholdMeters, `${path}.thresholdMeters`, 1_000_000, issues);
    if (value.method === "k-nearest") integer(value.neighborCount, `${path}.neighborCount`, 1, 10_000, issues);
    return;
  }
  if (["moran", "lisa", "getisOrd"].includes(value.operation)) {
    exactKeys(value, ["operation", "valueField", "weightsPlanId", "permutations", "seed", "missingPolicy"], path, issues);
    nonEmpty(value.valueField, `${path}.valueField`, issues); nonEmpty(value.weightsPlanId, `${path}.weightsPlanId`, issues);
    integer(value.permutations, `${path}.permutations`, 0, 10_000, issues); integer(value.seed, `${path}.seed`, 0, 2_147_483_647, issues);
    if (!["exclude", "fail"].includes(String(value.missingPolicy))) issues.push({ path: `${path}.missingPolicy`, message: "must be exclude or fail" });
    return;
  }
  if (value.operation === "h3Aggregate") {
    exactKeys(value, ["operation", "latitudeField", "longitudeField", "resolution", "aggregation", "valueField"], path, issues);
    nonEmpty(value.latitudeField, `${path}.latitudeField`, issues); nonEmpty(value.longitudeField, `${path}.longitudeField`, issues); integer(value.resolution, `${path}.resolution`, 0, 15, issues);
    if (!["count", "sum", "mean"].includes(String(value.aggregation))) issues.push({ path: `${path}.aggregation`, message: "is not supported" });
    if (value.aggregation !== "count") nonEmpty(value.valueField, `${path}.valueField`, issues);
    return;
  }
  if (value.operation === "density") {
    exactKeys(value, ["operation", "latitudeField", "longitudeField", "bandwidthMeters", "maxCells"], path, issues);
    nonEmpty(value.latitudeField, `${path}.latitudeField`, issues); nonEmpty(value.longitudeField, `${path}.longitudeField`, issues); positiveNumber(value.bandwidthMeters, `${path}.bandwidthMeters`, 1_000_000, issues); integer(value.maxCells, `${path}.maxCells`, 1, 100_000, issues); return;
  }
  if (value.operation === "cluster") {
    exactKeys(value, ["operation", "method", "latitudeField", "longitudeField", "radiusMeters", "minPoints"], path, issues);
    if (!["dbscan", "exploratory-circle"].includes(String(value.method))) issues.push({ path: `${path}.method`, message: "is not supported; use dbscan or exploratory-circle" }); nonEmpty(value.latitudeField, `${path}.latitudeField`, issues); nonEmpty(value.longitudeField, `${path}.longitudeField`, issues); positiveNumber(value.radiusMeters, `${path}.radiusMeters`, 1_000_000, issues); integer(value.minPoints, `${path}.minPoints`, 1, 5_000, issues); return;
  }
  if (value.operation === "repair") { exactKeys(value, ["operation", "policy", "preserveSource"], path, issues); if (!["report-only", "bounded-repair"].includes(String(value.policy))) issues.push({ path: `${path}.policy`, message: "is not supported" }); if (value.preserveSource !== true) issues.push({ path: `${path}.preserveSource`, message: "must be true" }); return; }
  if (value.operation === "zonalStatistics") { exactKeys(value, ["operation", "statistic", "noDataPolicy", "zoneField"], path, issues); if (!["count", "sum", "mean", "minimum", "maximum"].includes(String(value.statistic))) issues.push({ path: `${path}.statistic`, message: "is not supported" }); if (!["exclude", "fail"].includes(String(value.noDataPolicy))) issues.push({ path: `${path}.noDataPolicy`, message: "must be exclude or fail" }); nonEmpty(value.zoneField, `${path}.zoneField`, issues); return; }
  issues.push({ path: `${path}.operation`, message: "does not match the selected registered operation" });
}

export function validateAdvancedSpatialPlanV01(value: unknown): AdvancedSpatialPlanV01 {
  const issues: { path: string; message: string }[] = [];
  if (!isObject(value)) throw new AdvancedSpatialContractErrorV01([{ path: "$", message: "must be an object" }]);
  exactKeys(value, ["schema", "id", "operation", "projectRevision", "inputs", "parameters", "limits", "privacy", "requestedOutputs"], "$", issues);
  if (value.schema !== "epi-gis-advanced-plan/0.1") issues.push({ path: "schema", message: "must be epi-gis-advanced-plan/0.1" });
  nonEmpty(value.id, "id", issues); nonEmpty(value.projectRevision, "projectRevision", issues);
  if (!operations.includes(value.operation as AdvancedSpatialOperationV01)) issues.push({ path: "operation", message: "is not registered" });
  if (!Array.isArray(value.inputs) || value.inputs.length < 1) issues.push({ path: "inputs", message: "must contain at least one input" });
  else value.inputs.forEach((input, index) => { const path = `inputs[${index}]`; if (!isObject(input)) { issues.push({ path, message: "must be an object" }); return; } exactKeys(input, ["assetId", "sha256", "role", "mediaType", "byteLength", "declaredCrs"], path, issues); nonEmpty(input.assetId, `${path}.assetId`, issues); if (typeof input.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(input.sha256)) issues.push({ path: `${path}.sha256`, message: "must be a SHA-256 hex digest" }); nonEmpty(input.mediaType, `${path}.mediaType`, issues); integer(input.byteLength, `${path}.byteLength`, 0, Number.MAX_SAFE_INTEGER, issues); if (!["observations", "geometry", "raster", "weights"].includes(String(input.role))) issues.push({ path: `${path}.role`, message: "is not supported" }); nonEmpty(input.declaredCrs, `${path}.declaredCrs`, issues); });
  validateParameters(value.parameters, issues);
  if (!isObject(value.limits)) issues.push({ path: "limits", message: "must be an object" }); else {
    exactKeys(value.limits, ["maxInputBytes", "maxOutputBytes", "maxFeatures", "maxCoordinates", "maxCells", "maxPermutations", "timeoutMilliseconds"], "limits", issues);
    integer(value.limits.maxInputBytes, "limits.maxInputBytes", 1, 100_000_000, issues);
    integer(value.limits.maxOutputBytes, "limits.maxOutputBytes", 1, 100_000_000, issues);
    integer(value.limits.maxFeatures, "limits.maxFeatures", 1, 10_000, issues);
    integer(value.limits.maxCoordinates, "limits.maxCoordinates", 1, 1_000_000, issues);
    integer(value.limits.maxCells, "limits.maxCells", 1, 100_000, issues);
    integer(value.limits.maxPermutations, "limits.maxPermutations", 0, 10_000, issues);
    integer(value.limits.timeoutMilliseconds, "limits.timeoutMilliseconds", 1, 120_000, issues);
    const parameters = value.parameters as Record<string, unknown>;
    const limits = value.limits;
    if (["moran", "lisa", "getisOrd"].includes(String(parameters.operation)) && typeof limits.maxPermutations === "number" && typeof limits.maxFeatures === "number" && limits.maxPermutations * limits.maxFeatures > 5_000_000) issues.push({ path: "limits", message: "permutation work exceeds the bounded 5,000,000 observation-permutation budget" });
    if (parameters.operation === "density" && typeof limits.maxCells === "number" && typeof limits.maxFeatures === "number" && limits.maxCells * limits.maxFeatures > 5_000_000) issues.push({ path: "limits", message: "density work exceeds the bounded 5,000,000 cell-observation budget" });
  }
  if (!isObject(value.privacy)) issues.push({ path: "privacy", message: "must be an object" }); else { exactKeys(value.privacy, ["recordValuesStayLocal", "outputDisclosure", "allowRecordLevelExport"], "privacy", issues); if (value.privacy.recordValuesStayLocal !== true) issues.push({ path: "privacy.recordValuesStayLocal", message: "must be true" }); if (!["aggregate", "record-level", "renderer-only"].includes(String(value.privacy.outputDisclosure))) issues.push({ path: "privacy.outputDisclosure", message: "is not supported" }); if (typeof value.privacy.allowRecordLevelExport !== "boolean") issues.push({ path: "privacy.allowRecordLevelExport", message: "must be boolean" }); if (value.privacy.outputDisclosure === "record-level" && value.privacy.allowRecordLevelExport !== true) issues.push({ path: "privacy.allowRecordLevelExport", message: "must be true for record-level output" }); }
  if (!Array.isArray(value.requestedOutputs)) issues.push({ path: "requestedOutputs", message: "must be an array" }); else { const ids = new Set<string>(); value.requestedOutputs.forEach((output, index) => { const path = `requestedOutputs[${index}]`; if (!isObject(output)) { issues.push({ path, message: "must be an object" }); return; } exactKeys(output, ["id", "mediaType", "disclosure"], path, issues); nonEmpty(output.id, `${path}.id`, issues); if (ids.has(String(output.id))) issues.push({ path: `${path}.id`, message: "must be unique" }); ids.add(String(output.id)); nonEmpty(output.mediaType, `${path}.mediaType`, issues); if (!["aggregate", "record-level", "renderer-only"].includes(String(output.disclosure))) issues.push({ path: `${path}.disclosure`, message: "is not supported" }); }); }
  if (issues.length > 0) throw new AdvancedSpatialContractErrorV01(issues);
  return value as unknown as AdvancedSpatialPlanV01;
}

export function createAdvancedSpatialPlanV01(input: Omit<AdvancedSpatialPlanV01, "schema">): AdvancedSpatialPlanV01 { const plan = { schema: "epi-gis-advanced-plan/0.1", ...input } as AdvancedSpatialPlanV01; return validateAdvancedSpatialPlanV01(plan); }
