/** K09-S8: bounded, source-preserving geometry validation and repair. */

export type GeometryRepairPolicyV01 = "report-only" | "bounded-repair";
export interface GeometryRepairPlanV01 {
  schema: "epi-gis-geometry-repair/0.1";
  planId: string;
  policy: GeometryRepairPolicyV01;
  preserveSource: true;
  maxFeatures: number;
  maxCoordinates: number;
}
export type GeometryCoordinateV01 = readonly [longitude: number, latitude: number];
export type GeometryValueV01 = { type: "Point" | "MultiPoint" | "LineString" | "MultiLineString" | "Polygon" | "MultiPolygon"; coordinates: unknown };
export interface GeometryRepairFeatureV01 { id: string; geometry: GeometryValueV01 | null; }
export interface GeometryRepairFeatureResultV01 { id: string; original: GeometryValueV01 | null; repaired: GeometryValueV01 | null; changed: boolean; valid: boolean; }
export interface GeometryRepairResultV01 {
  schema: "epi-gis-geometry-repair-result/0.1";
  planId: string;
  policy: GeometryRepairPolicyV01;
  features: readonly GeometryRepairFeatureResultV01[];
  diagnostics: readonly { code: "missing-geometry" | "unsupported-geometry" | "invalid-coordinate" | "duplicate-vertex" | "ring-not-closed" | "ring-too-short"; featureId: string; message: string }[];
  validationStatus: "candidate";
}
export class GeometryRepairErrorV01 extends Error { constructor(message: string) { super(message); this.name = "GeometryRepairErrorV01"; } }

function validatePlan(plan: GeometryRepairPlanV01): void {
  if (plan.schema !== "epi-gis-geometry-repair/0.1") throw new GeometryRepairErrorV01("Unsupported geometry-repair schema.");
  if (!plan.planId.trim()) throw new GeometryRepairErrorV01("A geometry-repair plan id is required.");
  if (plan.policy !== "report-only" && plan.policy !== "bounded-repair") throw new GeometryRepairErrorV01("policy must be report-only or bounded-repair.");
  if (plan.preserveSource !== true) throw new GeometryRepairErrorV01("Geometry repair requires preserveSource=true.");
  if (!Number.isSafeInteger(plan.maxFeatures) || plan.maxFeatures < 1 || plan.maxFeatures > 100_000) throw new GeometryRepairErrorV01("maxFeatures must be an integer from 1 through 100000.");
  if (!Number.isSafeInteger(plan.maxCoordinates) || plan.maxCoordinates < 1 || plan.maxCoordinates > 10_000_000) throw new GeometryRepairErrorV01("maxCoordinates must be an integer from 1 through 10000000.");
}
export function createGeometryRepairPlanV01(input: Omit<GeometryRepairPlanV01, "schema">): GeometryRepairPlanV01 { const plan = { schema: "epi-gis-geometry-repair/0.1", ...input } as GeometryRepairPlanV01; validatePlan(plan); return plan; }

function coordinate(value: unknown): value is GeometryCoordinateV01 { return Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90; }
function same(left: GeometryCoordinateV01, right: GeometryCoordinateV01): boolean { return left[0] === right[0] && left[1] === right[1]; }
function countCoordinates(value: unknown): number { if (!Array.isArray(value)) return 0; if (coordinate(value)) return 1; return value.reduce((sum, child) => sum + countCoordinates(child), 0); }
function clone(value: unknown): unknown { return structuredClone(value); }
function inspectLine(value: unknown, featureId: string, diagnostics: Array<GeometryRepairResultV01["diagnostics"][number]>, ring: boolean): unknown {
  if (!Array.isArray(value)) { diagnostics.push({ code: "invalid-coordinate", featureId, message: "A line coordinate sequence is not an array." }); return value; }
  const points = value.filter(coordinate);
  if (points.length !== value.length) diagnostics.push({ code: "invalid-coordinate", featureId, message: "A geometry contains a non-finite or out-of-range WGS84 coordinate." });
  const unique: GeometryCoordinateV01[] = [];
  for (const point of points) if (!unique.at(-1) || !same(unique.at(-1)!, point)) unique.push(point);
  if (unique.length !== points.length) diagnostics.push({ code: "duplicate-vertex", featureId, message: "Consecutive duplicate vertices were found." });
  if (ring) {
    if (unique.length < 4) diagnostics.push({ code: "ring-too-short", featureId, message: "A polygon ring must contain at least four coordinates including closure." });
    if (unique.length > 0 && !same(unique[0]!, unique.at(-1)!)) diagnostics.push({ code: "ring-not-closed", featureId, message: "A polygon ring is not closed." });
  }
  if (ring && unique.length > 0 && !same(unique[0]!, unique.at(-1)!)) unique.push(unique[0]!);
  return unique;
}

function repairGeometry(feature: GeometryRepairFeatureV01, plan: GeometryRepairPlanV01, diagnostics: Array<GeometryRepairResultV01["diagnostics"][number]>): GeometryRepairFeatureResultV01 {
  if (feature.geometry === null) { diagnostics.push({ code: "missing-geometry", featureId: feature.id, message: "The feature has no geometry." }); return { id: feature.id, original: null, repaired: null, changed: false, valid: false }; }
  const geometry = feature.geometry;
  if (!["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"].includes(geometry.type)) { diagnostics.push({ code: "unsupported-geometry", featureId: feature.id, message: `Geometry type ${geometry.type} is not supported by bounded repair.` }); return { id: feature.id, original: clone(geometry) as GeometryValueV01, repaired: clone(geometry) as GeometryValueV01, changed: false, valid: false }; }
  if (countCoordinates(geometry.coordinates) > plan.maxCoordinates) throw new GeometryRepairErrorV01(`Feature ${feature.id} exceeds maxCoordinates.`);
  let repairedCoordinates: unknown = clone(geometry.coordinates);
  if (geometry.type === "LineString") repairedCoordinates = inspectLine(geometry.coordinates, feature.id, diagnostics, false);
  if (geometry.type === "MultiLineString") repairedCoordinates = (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).map((line) => inspectLine(line, feature.id, diagnostics, false));
  if (geometry.type === "Polygon") repairedCoordinates = (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).map((ring) => inspectLine(ring, feature.id, diagnostics, true));
  if (geometry.type === "MultiPolygon") repairedCoordinates = (Array.isArray(geometry.coordinates) ? geometry.coordinates : []).map((polygon) => (Array.isArray(polygon) ? polygon : []).map((ring) => inspectLine(ring, feature.id, diagnostics, true)));
  const repaired = { ...geometry, coordinates: plan.policy === "bounded-repair" ? repairedCoordinates : clone(geometry.coordinates) } as GeometryValueV01;
  const changed = JSON.stringify(repaired) !== JSON.stringify(geometry);
  const featureDiagnostics = diagnostics.filter((diagnostic) => diagnostic.featureId === feature.id);
  return { id: feature.id, original: clone(geometry) as GeometryValueV01, repaired, changed, valid: featureDiagnostics.every((diagnostic) => diagnostic.code !== "invalid-coordinate" && diagnostic.code !== "ring-too-short") };
}

export function repairGeometryV01(plan: GeometryRepairPlanV01, featuresInput: readonly GeometryRepairFeatureV01[]): GeometryRepairResultV01 {
  validatePlan(plan);
  if (featuresInput.length > plan.maxFeatures) throw new GeometryRepairErrorV01("The feature count exceeds maxFeatures.");
  const diagnostics: Array<GeometryRepairResultV01["diagnostics"][number]> = [];
  const seen = new Set<string>();
  const features = [...featuresInput].sort((left, right) => left.id.localeCompare(right.id)).map((feature) => { if (!feature.id.trim()) throw new GeometryRepairErrorV01("Feature ids must be non-empty."); if (seen.has(feature.id)) throw new GeometryRepairErrorV01(`Feature id is duplicated: ${feature.id}.`); seen.add(feature.id); return repairGeometry(feature, plan, diagnostics); });
  return { schema: "epi-gis-geometry-repair-result/0.1", planId: plan.planId, policy: plan.policy, features, diagnostics, validationStatus: "candidate" };
}
