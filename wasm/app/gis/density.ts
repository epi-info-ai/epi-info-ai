/** K09-S6: bounded candidate density surface over signed WGS84 points. */

export interface DensityPlanV01 {
  schema: "epi-gis-density/0.1";
  planId: string;
  bandwidthMeters: number;
  cellSizeMeters: number;
  maxObservations: number;
  maxCells: number;
}
export interface DensityObservationV01 { id: string; latitude: number | null; longitude: number | null; weight?: number | null; }
export interface DensityCellV01 { row: number; column: number; latitude: number; longitude: number; density: number; }
export interface DensityResultV01 {
  schema: "epi-gis-density-result/0.1";
  planId: string;
  method: "gaussian-kernel-equirectangular";
  bandwidthMeters: number;
  cellSizeMeters: number;
  cells: readonly DensityCellV01[];
  diagnostics: readonly { code: "missing-coordinate" | "invalid-coordinate" | "invalid-weight"; observationId?: string; message: string }[];
  validationStatus: "candidate";
}
export class DensityErrorV01 extends Error { constructor(message: string) { super(message); this.name = "DensityErrorV01"; } }

const EARTH_RADIUS_METERS = 6_371_008.8;
function validatePlan(plan: DensityPlanV01): void {
  if (plan.schema !== "epi-gis-density/0.1") throw new DensityErrorV01("Unsupported density schema.");
  if (!plan.planId.trim()) throw new DensityErrorV01("A density plan id is required.");
  for (const [name, value, maximum] of [["bandwidthMeters", plan.bandwidthMeters, 1_000_000], ["cellSizeMeters", plan.cellSizeMeters, 1_000_000]] as const) if (!Number.isFinite(value) || value <= 0 || value > maximum) throw new DensityErrorV01(`${name} must be greater than zero and no greater than ${maximum}.`);
  if (!Number.isSafeInteger(plan.maxObservations) || plan.maxObservations < 1 || plan.maxObservations > 1_000_000) throw new DensityErrorV01("maxObservations must be an integer from 1 through 1000000.");
  if (!Number.isSafeInteger(plan.maxCells) || plan.maxCells < 1 || plan.maxCells > 1_000_000) throw new DensityErrorV01("maxCells must be an integer from 1 through 1000000.");
}
export function createDensityPlanV01(input: Omit<DensityPlanV01, "schema">): DensityPlanV01 { const plan = { schema: "epi-gis-density/0.1", ...input } as DensityPlanV01; validatePlan(plan); return plan; }

export function calculateDensityV01(plan: DensityPlanV01, observationsInput: readonly DensityObservationV01[]): DensityResultV01 {
  validatePlan(plan);
  if (observationsInput.length > plan.maxObservations) throw new DensityErrorV01("The observation count exceeds maxObservations.");
  const diagnostics: Array<{ code: "missing-coordinate" | "invalid-coordinate" | "invalid-weight"; observationId?: string; message: string }> = [];
  const observations: Array<{ latitude: number; longitude: number; weight: number }> = [];
  const seen = new Set<string>();
  for (const observation of observationsInput) {
    if (!observation.id.trim()) throw new DensityErrorV01("Observation ids must be non-empty.");
    if (seen.has(observation.id)) throw new DensityErrorV01(`Observation id is duplicated: ${observation.id}.`);
    seen.add(observation.id);
    if (observation.latitude === null || observation.latitude === undefined || observation.longitude === null || observation.longitude === undefined) { diagnostics.push({ code: "missing-coordinate", observationId: observation.id, message: `Observation ${observation.id} has a missing coordinate.` }); continue; }
    if (!Number.isFinite(observation.latitude) || !Number.isFinite(observation.longitude) || observation.latitude < -90 || observation.latitude > 90 || observation.longitude < -180 || observation.longitude > 180) { diagnostics.push({ code: "invalid-coordinate", observationId: observation.id, message: `Observation ${observation.id} is outside WGS84 latitude/longitude ranges.` }); continue; }
    const weight = observation.weight === undefined || observation.weight === null ? 1 : observation.weight;
    if (!Number.isFinite(weight) || weight < 0) { diagnostics.push({ code: "invalid-weight", observationId: observation.id, message: `Observation ${observation.id} has an invalid non-negative weight.` }); continue; }
    observations.push({ latitude: observation.latitude, longitude: observation.longitude, weight });
  }
  if (observations.length === 0) throw new DensityErrorV01("At least one valid coordinate is required.");
  const minLat = Math.min(...observations.map(({ latitude }) => latitude));
  const maxLat = Math.max(...observations.map(({ latitude }) => latitude));
  const minLon = Math.min(...observations.map(({ longitude }) => longitude));
  const maxLon = Math.max(...observations.map(({ longitude }) => longitude));
  const meanLatitudeRadians = ((minLat + maxLat) / 2) * Math.PI / 180;
  const metersPerDegreeLat = Math.PI * EARTH_RADIUS_METERS / 180;
  const metersPerDegreeLon = metersPerDegreeLat * Math.max(0.01, Math.cos(meanLatitudeRadians));
  const widthMeters = Math.max(plan.cellSizeMeters, (maxLon - minLon) * metersPerDegreeLon);
  const heightMeters = Math.max(plan.cellSizeMeters, (maxLat - minLat) * metersPerDegreeLat);
  const columns = Math.max(1, Math.ceil(widthMeters / plan.cellSizeMeters));
  const rows = Math.max(1, Math.ceil(heightMeters / plan.cellSizeMeters));
  if (rows * columns > plan.maxCells) throw new DensityErrorV01(`The density grid requires ${(rows * columns).toLocaleString()} cells, exceeding maxCells ${plan.maxCells.toLocaleString()}.`);
  const normalization = 1 / (2 * Math.PI * plan.bandwidthMeters ** 2);
  const cells: DensityCellV01[] = [];
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const x = (column + 0.5) * plan.cellSizeMeters;
    const y = (row + 0.5) * plan.cellSizeMeters;
    let density = 0;
    for (const observation of observations) {
      const observationX = (observation.longitude - minLon) * metersPerDegreeLon;
      const observationY = (observation.latitude - minLat) * metersPerDegreeLat;
      const distanceSquared = (x - observationX) ** 2 + (y - observationY) ** 2;
      density += observation.weight * normalization * Math.exp(-distanceSquared / (2 * plan.bandwidthMeters ** 2));
    }
    cells.push({ row, column, latitude: minLat + y / metersPerDegreeLat, longitude: minLon + x / metersPerDegreeLon, density });
  }
  return { schema: "epi-gis-density-result/0.1", planId: plan.planId, method: "gaussian-kernel-equirectangular", bandwidthMeters: plan.bandwidthMeters, cellSizeMeters: plan.cellSizeMeters, cells, diagnostics, validationStatus: "candidate" };
}
