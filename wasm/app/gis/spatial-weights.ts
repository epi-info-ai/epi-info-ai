/** K09-S2: deterministic, source-preserving spatial weights. */

export type SpatialWeightMethodV01 = "queen" | "rook" | "distance-band" | "k-nearest";
export type SpatialCoordinateV01 = readonly [longitude: number, latitude: number];

export interface SpatialWeightFeatureV01 {
  id: string;
  centroid: SpatialCoordinateV01;
  boundary?: readonly SpatialCoordinateV01[];
}

export interface SpatialWeightsPlanV01 {
  schema: "epi-gis-spatial-weights/0.1";
  planId: string;
  method: SpatialWeightMethodV01;
  thresholdMeters?: number;
  neighborCount?: number;
  rowStandardize: true;
  maxFeatures: number;
}

export interface SpatialWeightNeighborV01 { id: string; weight: number; distanceMeters?: number; }
export interface SpatialWeightRowV01 { id: string; neighbors: readonly SpatialWeightNeighborV01[]; isolated: boolean; }
export interface SpatialWeightsResultV01 {
  schema: "epi-gis-spatial-weights/0.1";
  planId: string;
  method: SpatialWeightMethodV01;
  rows: readonly SpatialWeightRowV01[];
  diagnostics: readonly { code: "isolated-feature" | "duplicate-id"; featureId?: string; message: string }[];
}

export class SpatialWeightsErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "SpatialWeightsErrorV01"; }
}

const EARTH_RADIUS_METERS = 6_371_008.8;
const COORDINATE_PRECISION = 1e8;

function finiteCoordinate(value: SpatialCoordinateV01, label: string): void {
  if (!Array.isArray(value) || value.length !== 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1]) || value[0] < -180 || value[0] > 180 || value[1] < -90 || value[1] > 90) {
    throw new SpatialWeightsErrorV01(`${label} must be a finite WGS84 [longitude, latitude] coordinate.`);
  }
}

function coordinateKey(coordinate: SpatialCoordinateV01): string {
  return `${Math.round(coordinate[0] * COORDINATE_PRECISION)},${Math.round(coordinate[1] * COORDINATE_PRECISION)}`;
}

function edgeKey(left: SpatialCoordinateV01, right: SpatialCoordinateV01): string {
  const a = coordinateKey(left);
  const b = coordinateKey(right);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function haversineMeters(left: SpatialCoordinateV01, right: SpatialCoordinateV01): number {
  const radians = Math.PI / 180;
  const lat1 = left[1] * radians;
  const lat2 = right[1] * radians;
  const deltaLat = (right[1] - left[1]) * radians;
  const deltaLon = (right[0] - left[0]) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(Math.min(1, a)));
}

function sharedBoundary(left: SpatialWeightFeatureV01, right: SpatialWeightFeatureV01, method: "queen" | "rook"): boolean {
  const first = left.boundary ?? [];
  const second = right.boundary ?? [];
  if (first.length < 2 || second.length < 2) return false;
  const secondVertices = new Set(second.map(coordinateKey));
  if (method === "queen" && first.some((coordinate) => secondVertices.has(coordinateKey(coordinate)))) return true;
  if (method === "rook") {
    const secondEdges = new Set(second.slice(1).map((coordinate, index) => edgeKey(second[index]!, coordinate)));
    for (let index = 1; index < first.length; index += 1) if (secondEdges.has(edgeKey(first[index - 1]!, first[index]!))) return true;
  }
  return false;
}

function validatePlan(plan: SpatialWeightsPlanV01): void {
  if (plan.schema !== "epi-gis-spatial-weights/0.1") throw new SpatialWeightsErrorV01("Unsupported spatial-weights schema.");
  if (!plan.planId.trim()) throw new SpatialWeightsErrorV01("A spatial-weights plan id is required.");
  if (!["queen", "rook", "distance-band", "k-nearest"].includes(plan.method)) throw new SpatialWeightsErrorV01("Unsupported spatial-weights method.");
  if (!Number.isSafeInteger(plan.maxFeatures) || plan.maxFeatures < 1 || plan.maxFeatures > 100_000) throw new SpatialWeightsErrorV01("maxFeatures must be an integer from 1 through 100000.");
  if (plan.method === "distance-band" && (!Number.isFinite(plan.thresholdMeters) || plan.thresholdMeters! <= 0 || plan.thresholdMeters! > 1_000_000)) throw new SpatialWeightsErrorV01("distance-band requires thresholdMeters from greater than zero through 1000000.");
  if (plan.method === "k-nearest" && (!Number.isSafeInteger(plan.neighborCount) || plan.neighborCount! < 1 || plan.neighborCount! > 10_000)) throw new SpatialWeightsErrorV01("k-nearest requires neighborCount from 1 through 10000.");
  if (plan.rowStandardize !== true) throw new SpatialWeightsErrorV01("Spatial weights must use rowStandardize=true in v0.1.");
}

export function createSpatialWeightsPlanV01(input: Omit<SpatialWeightsPlanV01, "schema" | "rowStandardize"> & Partial<Pick<SpatialWeightsPlanV01, "rowStandardize">>): SpatialWeightsPlanV01 {
  const plan: SpatialWeightsPlanV01 = { schema: "epi-gis-spatial-weights/0.1", rowStandardize: true, ...input } as SpatialWeightsPlanV01;
  validatePlan(plan);
  return plan;
}

export function buildSpatialWeightsV01(planInput: SpatialWeightsPlanV01, featuresInput: readonly SpatialWeightFeatureV01[]): SpatialWeightsResultV01 {
  validatePlan(planInput);
  if (!Array.isArray(featuresInput) || featuresInput.length === 0) throw new SpatialWeightsErrorV01("At least one feature is required to build spatial weights.");
  if (featuresInput.length > planInput.maxFeatures) throw new SpatialWeightsErrorV01("The feature count exceeds the spatial-weights maxFeatures limit.");
  const features = [...featuresInput].sort((left, right) => left.id.localeCompare(right.id));
  const ids = new Set<string>();
  for (const feature of features) {
    if (!feature.id.trim()) throw new SpatialWeightsErrorV01("Feature ids must be non-empty.");
    if (ids.has(feature.id)) throw new SpatialWeightsErrorV01(`Feature id is duplicated: ${feature.id}.`);
    ids.add(feature.id);
    finiteCoordinate(feature.centroid, `Feature ${feature.id} centroid`);
    for (const [index, coordinate] of (feature.boundary ?? []).entries()) finiteCoordinate(coordinate, `Feature ${feature.id} boundary ${index}`);
  }
  const diagnostics: Array<{ code: "isolated-feature" | "duplicate-id"; featureId?: string; message: string }> = [];
  const rows: SpatialWeightRowV01[] = features.map((feature) => {
    let candidates: Array<{ feature: SpatialWeightFeatureV01; distanceMeters: number }> = [];
    if (planInput.method === "queen" || planInput.method === "rook") {
      candidates = features.filter((candidate) => candidate.id !== feature.id && sharedBoundary(feature, candidate, planInput.method as "queen" | "rook"))
        .map((candidate) => ({ feature: candidate, distanceMeters: haversineMeters(feature.centroid, candidate.centroid) }));
    } else {
      candidates = features.filter((candidate) => candidate.id !== feature.id).map((candidate) => ({ feature: candidate, distanceMeters: haversineMeters(feature.centroid, candidate.centroid) }))
        .sort((left, right) => left.distanceMeters - right.distanceMeters || left.feature.id.localeCompare(right.feature.id));
      if (planInput.method === "distance-band") candidates = candidates.filter((candidate) => candidate.distanceMeters <= planInput.thresholdMeters!);
      if (planInput.method === "k-nearest") candidates = candidates.slice(0, planInput.neighborCount!);
    }
    candidates.sort((left, right) => left.feature.id.localeCompare(right.feature.id));
    if (candidates.length === 0) diagnostics.push({ code: "isolated-feature", featureId: feature.id, message: `Feature ${feature.id} has no neighbors under the ${planInput.method} policy.` });
    const weight = candidates.length === 0 ? 0 : 1 / candidates.length;
    return { id: feature.id, neighbors: candidates.map((candidate) => ({ id: candidate.feature.id, weight, ...(planInput.method === "distance-band" || planInput.method === "k-nearest" ? { distanceMeters: candidate.distanceMeters } : {}) })), isolated: candidates.length === 0 };
  });
  return { schema: "epi-gis-spatial-weights/0.1", planId: planInput.planId, method: planInput.method, rows, diagnostics };
}
