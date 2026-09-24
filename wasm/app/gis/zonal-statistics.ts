/** K09-S9: bounded raster zonal-statistics candidate. */

export type ZonalStatisticV01 = "count" | "sum" | "mean" | "minimum" | "maximum";
export type ZonalNoDataPolicyV01 = "exclude" | "fail";
export interface ZonalStatisticsPlanV01 {
  schema: "epi-gis-zonal-statistics/0.1";
  planId: string;
  statistic: ZonalStatisticV01;
  noDataPolicy: ZonalNoDataPolicyV01;
  maxZones: number;
  maxCells: number;
}
export interface ZonalRasterV01 {
  width: number;
  height: number;
  origin: readonly [longitude: number, latitude: number];
  cellSize: readonly [longitude: number, latitude: number];
  values: readonly (number | null)[];
  noDataValue?: number | null;
}
export interface ZonalFeatureV01 {
  id: string;
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}
export interface ZonalStatisticsRowV01 {
  zoneId: string;
  count: number;
  value: number | null;
  noDataCount: number;
  cellCount: number;
}
export interface ZonalStatisticsResultV01 {
  schema: "epi-gis-zonal-statistics-result/0.1";
  planId: string;
  statistic: ZonalStatisticV01;
  noDataPolicy: ZonalNoDataPolicyV01;
  rows: readonly ZonalStatisticsRowV01[];
  diagnostics: readonly { code: "invalid-raster" | "invalid-zone" | "no-data" | "empty-zone"; zoneId?: string; message: string }[];
  validationStatus: "candidate";
}
export class ZonalStatisticsErrorV01 extends Error { constructor(message: string) { super(message); this.name = "ZonalStatisticsErrorV01"; } }

function validatePlan(plan: ZonalStatisticsPlanV01): void {
  if (plan.schema !== "epi-gis-zonal-statistics/0.1") throw new ZonalStatisticsErrorV01("Unsupported zonal-statistics schema.");
  if (!plan.planId.trim()) throw new ZonalStatisticsErrorV01("A zonal-statistics plan id is required.");
  if (!["count", "sum", "mean", "minimum", "maximum"].includes(plan.statistic)) throw new ZonalStatisticsErrorV01("Unsupported zonal statistic.");
  if (!["exclude", "fail"].includes(plan.noDataPolicy)) throw new ZonalStatisticsErrorV01("noDataPolicy must be exclude or fail.");
  if (!Number.isSafeInteger(plan.maxZones) || plan.maxZones < 1 || plan.maxZones > 100_000) throw new ZonalStatisticsErrorV01("maxZones must be an integer from 1 through 100000.");
  if (!Number.isSafeInteger(plan.maxCells) || plan.maxCells < 1 || plan.maxCells > 10_000_000) throw new ZonalStatisticsErrorV01("maxCells must be an integer from 1 through 10000000.");
}
export function createZonalStatisticsPlanV01(input: Omit<ZonalStatisticsPlanV01, "schema">): ZonalStatisticsPlanV01 { const plan = { schema: "epi-gis-zonal-statistics/0.1", ...input } as ZonalStatisticsPlanV01; validatePlan(plan); return plan; }

const finiteCoordinate = (value: unknown): value is readonly [number, number] => Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]) && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90;
function ringContains(ring: readonly (readonly [number, number])[], point: readonly [number, number]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index]!; const [previousX, previousY] = ring[previous]!;
    if ((y > point[1]) !== (previousY > point[1]) && point[0] < (previousX - x) * (point[1] - y) / (previousY - y) + x) inside = !inside;
  }
  return inside;
}
function polygonContains(polygon: unknown, point: readonly [number, number]): boolean {
  if (!Array.isArray(polygon) || polygon.length === 0) return false;
  const rings = polygon.filter((ring): ring is readonly (readonly [number, number])[] => Array.isArray(ring) && ring.every(finiteCoordinate));
  if (rings.length !== polygon.length || rings[0]!.length < 3 || !ringContains(rings[0]!, point)) return false;
  return !rings.slice(1).some((hole) => ringContains(hole, point));
}
function zoneContains(zone: ZonalFeatureV01, point: readonly [number, number]): boolean {
  return zone.geometry.type === "Polygon" ? polygonContains(zone.geometry.coordinates, point) : Array.isArray(zone.geometry.coordinates) && zone.geometry.coordinates.some((polygon) => polygonContains(polygon, point));
}
function validateRaster(raster: ZonalRasterV01): void {
  if (!Number.isSafeInteger(raster.width) || !Number.isSafeInteger(raster.height) || raster.width < 1 || raster.height < 1) throw new ZonalStatisticsErrorV01("Raster dimensions must be positive integers.");
  if (raster.width * raster.height !== raster.values.length) throw new ZonalStatisticsErrorV01("Raster values must equal width multiplied by height.");
  if (!finiteCoordinate(raster.origin) || !Number.isFinite(raster.cellSize[0]) || !Number.isFinite(raster.cellSize[1]) || raster.cellSize[0] <= 0 || raster.cellSize[1] <= 0) throw new ZonalStatisticsErrorV01("Raster must use finite WGS84 origin and positive cell size.");
  if (raster.origin[0] + raster.width * raster.cellSize[0] > 180 || raster.origin[1] + raster.height * raster.cellSize[1] > 90) throw new ZonalStatisticsErrorV01("Raster extent exceeds WGS84 bounds.");
  if (raster.values.some((value) => value !== null && !Number.isFinite(value))) throw new ZonalStatisticsErrorV01("Raster values must be finite numbers or null.");
}
function cloneZone(zone: ZonalFeatureV01): ZonalFeatureV01 { return structuredClone(zone); }

export function calculateZonalStatisticsV01(plan: ZonalStatisticsPlanV01, raster: ZonalRasterV01, zonesInput: readonly ZonalFeatureV01[]): ZonalStatisticsResultV01 {
  validatePlan(plan); validateRaster(raster);
  if (raster.width * raster.height > plan.maxCells) throw new ZonalStatisticsErrorV01("Raster cell count exceeds maxCells.");
  if (zonesInput.length > plan.maxZones) throw new ZonalStatisticsErrorV01("Zone count exceeds maxZones.");
  const zones = zonesInput.map(cloneZone).sort((left, right) => left.id.localeCompare(right.id));
  const diagnostics: Array<ZonalStatisticsResultV01["diagnostics"][number]> = [];
  const seen = new Set<string>();
  const rows = zones.map((zone) => {
    if (!zone.id.trim() || seen.has(zone.id)) throw new ZonalStatisticsErrorV01("Zone ids must be non-empty and unique.");
    seen.add(zone.id);
    if (!zone.geometry || !["Polygon", "MultiPolygon"].includes(zone.geometry.type)) { diagnostics.push({ code: "invalid-zone", zoneId: zone.id, message: "Only Polygon and MultiPolygon zones are supported." }); return { zoneId: zone.id, count: 0, value: null, noDataCount: 0, cellCount: 0 }; }
    const values: number[] = []; let noDataCount = 0; let cellCount = 0;
    for (let row = 0; row < raster.height; row++) for (let column = 0; column < raster.width; column++) {
      const point: [number, number] = [raster.origin[0] + (column + 0.5) * raster.cellSize[0], raster.origin[1] + (row + 0.5) * raster.cellSize[1]];
      if (!zoneContains(zone, point)) continue;
      cellCount++; const raw = raster.values[row * raster.width + column]; const isNoData = raw === undefined || raw === null || (raster.noDataValue !== undefined && raw === raster.noDataValue);
      if (isNoData) { noDataCount++; continue; } values.push(raw);
    }
    if (noDataCount > 0 && plan.noDataPolicy === "fail") throw new ZonalStatisticsErrorV01(`Zone ${zone.id} contains NoData cells.`);
    if (cellCount === 0) diagnostics.push({ code: "empty-zone", zoneId: zone.id, message: "No raster cell centers fall inside the zone." });
    if (noDataCount > 0) diagnostics.push({ code: "no-data", zoneId: zone.id, message: `${noDataCount} NoData cells were excluded.` });
    const value = values.length === 0 ? null : plan.statistic === "count" ? values.length : plan.statistic === "sum" ? values.reduce((sum, current) => sum + current, 0) : plan.statistic === "mean" ? values.reduce((sum, current) => sum + current, 0) / values.length : plan.statistic === "minimum" ? Math.min(...values) : Math.max(...values);
    return { zoneId: zone.id, count: values.length, value, noDataCount, cellCount };
  });
  return { schema: "epi-gis-zonal-statistics-result/0.1", planId: plan.planId, statistic: plan.statistic, noDataPolicy: plan.noDataPolicy, rows, diagnostics, validationStatus: "candidate" };
}
