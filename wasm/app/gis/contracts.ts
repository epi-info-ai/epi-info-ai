/**
 * Epi GIS kernel v0.1 contracts.
 *
 * This module is deliberately engine-free. A validated plan may be handed to
 * a Worker later, but no operation in this spike creates a GDAL handle or
 * reads a file. The boundary is intended to keep source bytes, UI state, and
 * upstream command arguments out of the kernel contract.
 */

export type GisOperationV01 =
  | "gis.dataset.inspect"
  | "gis.vector.normalize"
  | "gis.geometry.validate"
  | "gis.vector.spatialJoin";

export type GisInputRoleV01 = "records" | "reference-geography" | "context";
export type GisStatusV01 = "succeeded" | "cancelled" | "rejected" | "failed";
export type GisValidationStatusV01 = "unvalidated" | "candidate" | "validated";

export interface GisInputRefV01 {
  assetId: string;
  sha256: string;
  role: GisInputRoleV01;
  mediaType: string;
  byteLength: number;
  declaredCrs: string | "unknown";
}

export interface GisLimitsProfileV01 {
  maxInputBytes: number;
  maxOutputBytes: number;
  maxFeatures: number;
  maxCoordinates: number;
  maxNestingDepth: number;
  maxProperties: number;
  timeoutMilliseconds: number;
}

export interface GisOutputRequestV01 {
  id: string;
  mediaType: string;
  disclosure: "record-level" | "aggregate" | "renderer-only";
}

export interface InspectParamsV01 {
  layerName?: string;
}

export interface NormalizeParamsV01 {
  targetCrs: "CRS84";
  outputFormat: "GeoJSON";
  layerName?: string;
}

export interface ValidateGeometryParamsV01 {
  layerName?: string;
  reportCoordinates: boolean;
}

export interface SpatialJoinParamsV01 {
  pointLayer: string;
  boundaryLayer: string;
  pointIdField: string;
  boundaryKeyField: string;
  predicate: "point-in-polygon";
  boundaryPolicy: "include-boundary" | "exclude-boundary" | "report-ambiguous";
}

export type GisParamsV01 =
  | InspectParamsV01
  | NormalizeParamsV01
  | ValidateGeometryParamsV01
  | SpatialJoinParamsV01;

export interface GisPlanV01 {
  schema: "epi-gis-plan/0.1";
  id: string;
  operation: GisOperationV01;
  projectRevision: string;
  inputs: readonly GisInputRefV01[];
  parameters: GisParamsV01;
  limits: GisLimitsProfileV01;
  requestedOutputs: readonly GisOutputRequestV01[];
}

export interface GisDiagnosticV01 {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  path?: string;
}

export interface GisDerivedAssetV01 {
  assetId: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  lineage: readonly string[];
}

export interface GisReceiptV01 {
  schema: "epi-gis-receipt/0.1";
  planId: string;
  operation: GisOperationV01;
  implementationVersion: string;
  projectRevision: string;
  validationStatus: GisValidationStatusV01;
  terminalStatus: GisStatusV01;
  diagnostics: readonly GisDiagnosticV01[];
}

export interface GisResultV01 {
  schema: "epi-gis-result/0.1";
  planId: string;
  status: GisStatusV01;
  data?: unknown;
  outputs: readonly GisDerivedAssetV01[];
  diagnostics: readonly GisDiagnosticV01[];
  receipt: GisReceiptV01;
}

export interface GisDatasetInspectResultV01 {
  format: "GeoJSON" | "unknown";
  layerCount: number;
  featureCount: number;
  geometryTypes: readonly string[];
  fields: readonly string[];
  declaredCrs: string | "unknown";
  extent: readonly [number, number, number, number] | null;
  estimatedWork: { features: number; coordinates: number };
}

export interface GisValidationIssueV01 {
  code: "invalid-type" | "missing" | "unknown-property" | "invalid-value" | "unsafe-value";
  path: string;
  message: string;
}

export class GisContractError extends Error {
  readonly issues: readonly GisValidationIssueV01[];

  constructor(issues: readonly GisValidationIssueV01[]) {
    super(`Invalid Epi GIS contract: ${issues.map((issue) => `${issue.path} ${issue.message}`).join("; ")}`);
    this.name = "GisContractError";
    this.issues = issues;
  }
}

const operations: readonly GisOperationV01[] = [
  "gis.dataset.inspect",
  "gis.vector.normalize",
  "gis.geometry.validate",
  "gis.vector.spatialJoin",
];

const isObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const hasOwn = (value: Record<string, unknown>, key: string): boolean => Object.hasOwn(value, key);

function checkKeys(value: Record<string, unknown>, allowed: readonly string[], path: string, issues: GisValidationIssueV01[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) issues.push({ code: "unknown-property", path: `${path}.${key}`, message: "is not permitted" });
  }
}

function requiredString(value: Record<string, unknown>, key: string, path: string, issues: GisValidationIssueV01[]): string | undefined {
  if (!hasOwn(value, key)) {
    issues.push({ code: "missing", path: `${path}.${key}`, message: "is required" });
    return undefined;
  }
  if (typeof value[key] !== "string" || value[key].trim() === "") {
    issues.push({ code: "invalid-type", path: `${path}.${key}`, message: "must be a non-empty string" });
    return undefined;
  }
  return value[key];
}

function nonNegativeInteger(value: Record<string, unknown>, key: string, path: string, issues: GisValidationIssueV01[]): number | undefined {
  if (!hasOwn(value, key)) {
    issues.push({ code: "missing", path: `${path}.${key}`, message: "is required" });
    return undefined;
  }
  const candidate = value[key];
  if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate < 0) {
    issues.push({ code: "invalid-value", path: `${path}.${key}`, message: "must be a non-negative safe integer" });
    return undefined;
  }
  return candidate;
}

function validateInput(value: unknown, index: number, issues: GisValidationIssueV01[]): value is GisInputRefV01 {
  const path = `inputs[${index}]`;
  if (!isObject(value)) {
    issues.push({ code: "invalid-type", path, message: "must be an object" });
    return false;
  }
  checkKeys(value, ["assetId", "sha256", "role", "mediaType", "byteLength", "declaredCrs"], path, issues);
  requiredString(value, "assetId", path, issues);
  const digest = requiredString(value, "sha256", path, issues);
  if (digest !== undefined && !/^[a-f0-9]{64}$/i.test(digest)) issues.push({ code: "invalid-value", path: `${path}.sha256`, message: "must be a SHA-256 hex digest" });
  requiredString(value, "mediaType", path, issues);
  nonNegativeInteger(value, "byteLength", path, issues);
  if (value.role !== "records" && value.role !== "reference-geography" && value.role !== "context") issues.push({ code: "invalid-value", path: `${path}.role`, message: "is not a supported input role" });
  if (typeof value.declaredCrs !== "string" || value.declaredCrs.trim() === "") issues.push({ code: "invalid-value", path: `${path}.declaredCrs`, message: "must be a CRS string or 'unknown'" });
  return true;
}

function validateParameters(operation: GisOperationV01, value: unknown, issues: GisValidationIssueV01[]): value is GisParamsV01 {
  const path = "parameters";
  if (!isObject(value)) {
    issues.push({ code: "invalid-type", path, message: "must be an object" });
    return false;
  }
  if (operation === "gis.dataset.inspect") {
    checkKeys(value, ["layerName"], path, issues);
    if (hasOwn(value, "layerName") && (typeof value.layerName !== "string" || value.layerName.trim() === "")) issues.push({ code: "invalid-value", path: `${path}.layerName`, message: "must be a non-empty string when provided" });
    return true;
  }
  if (operation === "gis.vector.normalize") {
    checkKeys(value, ["targetCrs", "outputFormat", "layerName"], path, issues);
    if (value.targetCrs !== "CRS84") issues.push({ code: "invalid-value", path: `${path}.targetCrs`, message: "must be CRS84 in v0.1" });
    if (value.outputFormat !== "GeoJSON") issues.push({ code: "invalid-value", path: `${path}.outputFormat`, message: "must be GeoJSON in v0.1" });
    if (hasOwn(value, "layerName") && (typeof value.layerName !== "string" || value.layerName.trim() === "")) issues.push({ code: "invalid-value", path: `${path}.layerName`, message: "must be a non-empty string when provided" });
    return true;
  }
  if (operation === "gis.geometry.validate") {
    checkKeys(value, ["layerName", "reportCoordinates"], path, issues);
    if (hasOwn(value, "layerName") && (typeof value.layerName !== "string" || value.layerName.trim() === "")) issues.push({ code: "invalid-value", path: `${path}.layerName`, message: "must be a non-empty string when provided" });
    if (typeof value.reportCoordinates !== "boolean") issues.push({ code: "invalid-value", path: `${path}.reportCoordinates`, message: "must be boolean" });
    return true;
  }
  checkKeys(value, ["pointLayer", "boundaryLayer", "pointIdField", "boundaryKeyField", "predicate", "boundaryPolicy"], path, issues);
  for (const key of ["pointLayer", "boundaryLayer", "pointIdField", "boundaryKeyField"]) requiredString(value, key, path, issues);
  if (value.predicate !== "point-in-polygon") issues.push({ code: "invalid-value", path: `${path}.predicate`, message: "must be point-in-polygon in v0.1" });
  if (value.boundaryPolicy !== "include-boundary" && value.boundaryPolicy !== "exclude-boundary" && value.boundaryPolicy !== "report-ambiguous") issues.push({ code: "invalid-value", path: `${path}.boundaryPolicy`, message: "is not supported" });
  return true;
}

function validateLimits(value: unknown, issues: GisValidationIssueV01[]): value is GisLimitsProfileV01 {
  const path = "limits";
  if (!isObject(value)) {
    issues.push({ code: "invalid-type", path, message: "must be an object" });
    return false;
  }
  checkKeys(value, ["maxInputBytes", "maxOutputBytes", "maxFeatures", "maxCoordinates", "maxNestingDepth", "maxProperties", "timeoutMilliseconds"], path, issues);
  for (const key of ["maxInputBytes", "maxOutputBytes", "maxFeatures", "maxCoordinates", "maxNestingDepth", "maxProperties", "timeoutMilliseconds"]) nonNegativeInteger(value, key, path, issues);
  return true;
}

function validateOutputs(value: unknown, issues: GisValidationIssueV01[]): value is readonly GisOutputRequestV01[] {
  if (!Array.isArray(value)) {
    issues.push({ code: "invalid-type", path: "requestedOutputs", message: "must be an array" });
    return false;
  }
  const ids = new Set<string>();
  value.forEach((candidate, index) => {
    const path = `requestedOutputs[${index}]`;
    if (!isObject(candidate)) {
      issues.push({ code: "invalid-type", path, message: "must be an object" });
      return;
    }
    checkKeys(candidate, ["id", "mediaType", "disclosure"], path, issues);
    const id = requiredString(candidate, "id", path, issues);
    requiredString(candidate, "mediaType", path, issues);
    if (id !== undefined && !ids.add(id)) issues.push({ code: "invalid-value", path: `${path}.id`, message: "must be unique" });
    if (candidate.disclosure !== "record-level" && candidate.disclosure !== "aggregate" && candidate.disclosure !== "renderer-only") issues.push({ code: "invalid-value", path: `${path}.disclosure`, message: "is not supported" });
  });
  return true;
}

export function validateGisPlanV01(value: unknown): GisPlanV01 {
  const issues: GisValidationIssueV01[] = [];
  if (!isObject(value)) throw new GisContractError([{ code: "invalid-type", path: "$", message: "must be an object" }]);
  checkKeys(value, ["schema", "id", "operation", "projectRevision", "inputs", "parameters", "limits", "requestedOutputs"], "$", issues);
  if (value.schema !== "epi-gis-plan/0.1") issues.push({ code: "invalid-value", path: "schema", message: "must be epi-gis-plan/0.1" });
  requiredString(value, "id", "$", issues);
  const operation = value.operation;
  if (!operations.includes(operation as GisOperationV01)) issues.push({ code: "invalid-value", path: "operation", message: "is not registered" });
  requiredString(value, "projectRevision", "$", issues);
  if (!Array.isArray(value.inputs)) issues.push({ code: "invalid-type", path: "inputs", message: "must be an array" });
  else value.inputs.forEach((input, index) => validateInput(input, index, issues));
  if (operations.includes(operation as GisOperationV01)) validateParameters(operation as GisOperationV01, value.parameters, issues);
  validateLimits(value.limits, issues);
  validateOutputs(value.requestedOutputs, issues);

  if (Array.isArray(value.inputs)) {
    const expectedInputs = operation === "gis.vector.spatialJoin" ? 2 : 1;
    if (value.inputs.length !== expectedInputs) issues.push({ code: "invalid-value", path: "inputs", message: `${operation} requires exactly ${expectedInputs} input${expectedInputs === 1 ? "" : "s"}` });
  }
  if (issues.length) throw new GisContractError(issues);
  return value as unknown as GisPlanV01;
}

/** Stable JSON for plan digests and cache keys. Runtime hashing remains host-owned. */
export function canonicalizeGisValue(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("GIS canonical JSON does not support non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalizeGisValue).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeGisValue(value[key])}`).join(",")}}`;
  throw new TypeError("GIS canonical JSON does not support this value");
}

export function canonicalizeGisPlanV01(plan: GisPlanV01): string {
  return canonicalizeGisValue(validateGisPlanV01(plan));
}
