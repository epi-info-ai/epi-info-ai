import type { EpiRecord, MapPoint, RecordValue } from "../contracts/core.ts";

export type PointLayerKindV01 = "spot-map" | "case-cluster";
export type PointLayerFilterOperatorV01 = "equals" | "not-equals" | "contains" | "greater-than" | "greater-or-equal" | "less-than" | "less-or-equal" | "is-empty" | "is-not-empty";

export interface PointLayerFilterV01 {
  field: string;
  operator: PointLayerFilterOperatorV01;
  value?: string;
}

export interface PointLayerPreviewOptionsV01 {
  latitudeField: string;
  longitudeField: string;
  labelField?: string;
  filter?: PointLayerFilterV01;
  maxPoints?: number;
}

export interface PointLayerDiagnosticV01 {
  recordIndex: number;
  code: "missing-coordinate" | "invalid-coordinate" | "filtered" | "limit-exceeded";
  message: string;
}

export interface PointLayerPreviewV01 {
  points: MapPoint[];
  diagnostics: PointLayerDiagnosticV01[];
  inputCount: number;
  validCount: number;
  skippedCount: number;
}

export interface PointLayerDiagnosticSummaryV01 {
  filtered: number;
  missingCoordinate: number;
  invalidCoordinate: number;
  limitExceeded: number;
  totalSkipped: number;
}

export interface DisplayPointClusterV01 {
  latitude: number;
  longitude: number;
  points: MapPoint[];
  isCluster: boolean;
}

export interface PointLayerRecordRefV01 {
  sourceFormId: string;
  recordIndex: number;
}

export function createPointLayerRecordRefV01(sourceFormId: string, recordIndex: number): PointLayerRecordRefV01 {
  if (!sourceFormId.trim()) throw new Error("Point-layer record references require a source form.");
  if (!Number.isSafeInteger(recordIndex) || recordIndex < 0) throw new Error("Point-layer record references require a non-negative row index.");
  return { sourceFormId, recordIndex };
}

const operators: readonly PointLayerFilterOperatorV01[] = [
  "equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal", "is-empty", "is-not-empty",
];

function text(value: RecordValue | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function compare(left: RecordValue | undefined, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (text(left) !== "" && Number.isFinite(leftNumber) && right.trim() !== "" && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return text(left).localeCompare(right, undefined, { sensitivity: "base" });
}

export function validatePointLayerFilterV01(filter: PointLayerFilterV01): void {
  if (!filter.field.trim()) throw new Error("Point-layer filters require a field.");
  if (!operators.includes(filter.operator)) throw new Error(`Unsupported point-layer filter operator: ${filter.operator}`);
  if (!["is-empty", "is-not-empty"].includes(filter.operator) && typeof filter.value !== "string") throw new Error("This point-layer filter requires a comparison value.");
}

export function matchesPointLayerFilterV01(record: EpiRecord, filter: PointLayerFilterV01): boolean {
  validatePointLayerFilterV01(filter);
  const value = record[filter.field];
  const candidate = filter.value ?? "";
  switch (filter.operator) {
    case "equals": return compare(value, candidate) === 0;
    case "not-equals": return compare(value, candidate) !== 0;
    case "contains": return text(value).toLocaleLowerCase().includes(candidate.toLocaleLowerCase());
    case "greater-than": return compare(value, candidate) > 0;
    case "greater-or-equal": return compare(value, candidate) >= 0;
    case "less-than": return compare(value, candidate) < 0;
    case "less-or-equal": return compare(value, candidate) <= 0;
    case "is-empty": return text(value) === "";
    case "is-not-empty": return text(value) !== "";
  }
}

export function buildPointLayerPreviewV01(records: EpiRecord[], options: PointLayerPreviewOptionsV01): PointLayerPreviewV01 {
  if (!options.latitudeField.trim() || !options.longitudeField.trim()) throw new Error("Point layers require latitude and longitude fields.");
  if (options.filter) validatePointLayerFilterV01(options.filter);
  const maxPoints = options.maxPoints ?? 100_000;
  if (!Number.isSafeInteger(maxPoints) || maxPoints < 1) throw new Error("Point-layer maximum must be a positive safe integer.");
  const points: MapPoint[] = [];
  const diagnostics: PointLayerDiagnosticV01[] = [];
  records.forEach((record, recordIndex) => {
    if (options.filter && !matchesPointLayerFilterV01(record, options.filter)) {
      diagnostics.push({ recordIndex, code: "filtered", message: "Row excluded by the layer filter." });
      return;
    }
    const latitudeValue = text(record[options.latitudeField]);
    const longitudeValue = text(record[options.longitudeField]);
    if (!latitudeValue || !longitudeValue) {
      diagnostics.push({ recordIndex, code: "missing-coordinate", message: "Latitude and longitude are both required." });
      return;
    }
    const latitude = Number(latitudeValue);
    const longitude = Number(longitudeValue);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      diagnostics.push({ recordIndex, code: "invalid-coordinate", message: "Coordinates must be finite signed WGS 84 decimal degrees." });
      return;
    }
    if (points.length >= maxPoints) {
      diagnostics.push({ recordIndex, code: "limit-exceeded", message: `The point-layer limit of ${maxPoints.toLocaleString()} valid rows was reached.` });
      return;
    }
    points.push({ record, recordIndex, latitude, longitude });
  });
  return { points, diagnostics, inputCount: records.length, validCount: points.length, skippedCount: records.length - points.length };
}

export function summarizePointLayerDiagnosticsV01(diagnostics: readonly PointLayerDiagnosticV01[]): PointLayerDiagnosticSummaryV01 {
  const summary = { filtered: 0, missingCoordinate: 0, invalidCoordinate: 0, limitExceeded: 0, totalSkipped: diagnostics.length };
  for (const diagnostic of diagnostics) {
    if (diagnostic.code === "filtered") summary.filtered += 1;
    else if (diagnostic.code === "missing-coordinate") summary.missingCoordinate += 1;
    else if (diagnostic.code === "invalid-coordinate") summary.invalidCoordinate += 1;
    else if (diagnostic.code === "limit-exceeded") summary.limitExceeded += 1;
  }
  return summary;
}

function screenPoint(point: MapPoint, zoom: number): [number, number] {
  const scale = 256 * 2 ** zoom;
  const longitude = (point.longitude + 180) / 360 * scale;
  const latitude = (1 - Math.log(Math.tan(point.latitude * Math.PI / 180) + 1 / Math.cos(point.latitude * Math.PI / 180)) / Math.PI) / 2 * scale;
  return [longitude, latitude];
}

export function clusterPointLayerV01(points: MapPoint[], zoom: number, radiusPixels = 15): DisplayPointClusterV01[] {
  if (!Number.isFinite(zoom) || zoom < 0 || zoom > 24) throw new Error("Point-layer zoom must be between 0 and 24.");
  if (!Number.isFinite(radiusPixels) || radiusPixels <= 0 || radiusPixels > 256) throw new Error("Point-layer cluster radius must be between 0 and 256 pixels.");
  const remaining = points.map((point, index) => ({ point, index, screen: screenPoint(point, zoom) }));
  const output: DisplayPointClusterV01[] = [];
  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const members = [seed.point];
    const [x, y] = seed.screen;
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      const candidate = remaining[index]!;
      const dx = candidate.screen[0] - x;
      const dy = candidate.screen[1] - y;
      if (Math.hypot(dx, dy) <= radiusPixels) {
        members.push(candidate.point);
        remaining.splice(index, 1);
      }
    }
    output.push({
      latitude: members.reduce((sum, point) => sum + point.latitude, 0) / members.length,
      longitude: members.reduce((sum, point) => sum + point.longitude, 0) / members.length,
      points: members,
      isCluster: members.length > 1,
    });
  }
  return output;
}
