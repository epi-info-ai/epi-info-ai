/** K09-S5: bounded H3 aggregation adapter with an injected indexer. */

export type H3AggregationMethodV01 = "count" | "sum" | "mean";
export interface H3AggregatePlanV01 {
  schema: "epi-gis-h3-aggregate/0.1";
  planId: string;
  resolution: number;
  aggregation: H3AggregationMethodV01;
  maxObservations: number;
  maxCells: number;
}
export interface H3AggregateObservationV01 { id: string; latitude: number | null; longitude: number | null; value?: number | null; }
export interface H3AggregateCellV01 { cell: string; count: number; sum: number | null; mean: number | null; }
export interface H3AggregateResultV01 {
  schema: "epi-gis-h3-aggregate-result/0.1";
  planId: string;
  resolution: number;
  aggregation: H3AggregationMethodV01;
  cells: readonly H3AggregateCellV01[];
  diagnostics: readonly { code: "missing-coordinate" | "invalid-coordinate" | "missing-value" | "invalid-value" | "cell-limit"; observationId?: string; message: string }[];
  validationStatus: "candidate";
}
export type H3IndexerV01 = (latitude: number, longitude: number, resolution: number) => string;

export class H3AggregationErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "H3AggregationErrorV01"; }
}

function validatePlan(plan: H3AggregatePlanV01): void {
  if (plan.schema !== "epi-gis-h3-aggregate/0.1") throw new H3AggregationErrorV01("Unsupported H3 aggregation schema.");
  if (!plan.planId.trim()) throw new H3AggregationErrorV01("An H3 aggregation plan id is required.");
  if (!Number.isSafeInteger(plan.resolution) || plan.resolution < 0 || plan.resolution > 15) throw new H3AggregationErrorV01("resolution must be an integer from 0 through 15.");
  if (!["count", "sum", "mean"].includes(plan.aggregation)) throw new H3AggregationErrorV01("aggregation must be count, sum, or mean.");
  if (!Number.isSafeInteger(plan.maxObservations) || plan.maxObservations < 1 || plan.maxObservations > 1_000_000) throw new H3AggregationErrorV01("maxObservations must be an integer from 1 through 1000000.");
  if (!Number.isSafeInteger(plan.maxCells) || plan.maxCells < 1 || plan.maxCells > 1_000_000) throw new H3AggregationErrorV01("maxCells must be an integer from 1 through 1000000.");
}

export function createH3AggregatePlanV01(input: Omit<H3AggregatePlanV01, "schema">): H3AggregatePlanV01 {
  const plan = { schema: "epi-gis-h3-aggregate/0.1", ...input } as H3AggregatePlanV01;
  validatePlan(plan);
  return plan;
}

export function aggregateH3V01(plan: H3AggregatePlanV01, observations: readonly H3AggregateObservationV01[], indexer: H3IndexerV01): H3AggregateResultV01 {
  validatePlan(plan);
  if (typeof indexer !== "function") throw new H3AggregationErrorV01("An H3 indexer is required.");
  if (observations.length > plan.maxObservations) throw new H3AggregationErrorV01("The observation count exceeds maxObservations.");
  const diagnostics: Array<{ code: "missing-coordinate" | "invalid-coordinate" | "missing-value" | "invalid-value" | "cell-limit"; observationId?: string; message: string }> = [];
  const cells = new Map<string, { count: number; sum: number }>();
  const seen = new Set<string>();
  for (const observation of observations) {
    if (!observation.id.trim()) throw new H3AggregationErrorV01("Observation ids must be non-empty.");
    if (seen.has(observation.id)) throw new H3AggregationErrorV01(`Observation id is duplicated: ${observation.id}.`);
    seen.add(observation.id);
    if (observation.latitude === null || observation.latitude === undefined || observation.longitude === null || observation.longitude === undefined) { diagnostics.push({ code: "missing-coordinate", observationId: observation.id, message: `Observation ${observation.id} has a missing coordinate.` }); continue; }
    if (!Number.isFinite(observation.latitude) || !Number.isFinite(observation.longitude) || observation.latitude < -90 || observation.latitude > 90 || observation.longitude < -180 || observation.longitude > 180) { diagnostics.push({ code: "invalid-coordinate", observationId: observation.id, message: `Observation ${observation.id} is outside WGS84 latitude/longitude ranges.` }); continue; }
    const value = observation.value === null || observation.value === undefined ? null : observation.value;
    if (plan.aggregation !== "count" && value === null) { diagnostics.push({ code: "missing-value", observationId: observation.id, message: `Observation ${observation.id} has no numeric aggregation value.` }); continue; }
    if (plan.aggregation !== "count" && !Number.isFinite(value)) { diagnostics.push({ code: "invalid-value", observationId: observation.id, message: `Observation ${observation.id} has a non-finite aggregation value.` }); continue; }
    const cell = indexer(observation.latitude, observation.longitude, plan.resolution);
    if (typeof cell !== "string" || cell.trim() === "") throw new H3AggregationErrorV01(`The H3 indexer returned an invalid cell for observation ${observation.id}.`);
    if (!cells.has(cell) && cells.size >= plan.maxCells) { diagnostics.push({ code: "cell-limit", observationId: observation.id, message: `The H3 cell count exceeds the maxCells limit of ${plan.maxCells.toLocaleString()}.` }); continue; }
    const aggregate = cells.get(cell) ?? { count: 0, sum: 0 };
    aggregate.count += 1;
    if (value !== null) aggregate.sum += value;
    cells.set(cell, aggregate);
  }
  const resultCells = [...cells.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([cell, aggregate]) => ({ cell, count: aggregate.count, sum: plan.aggregation === "count" ? null : aggregate.sum, mean: plan.aggregation === "mean" ? aggregate.sum / aggregate.count : null }));
  return { schema: "epi-gis-h3-aggregate-result/0.1", planId: plan.planId, resolution: plan.resolution, aggregation: plan.aggregation, cells: resultCells, diagnostics, validationStatus: "candidate" };
}
