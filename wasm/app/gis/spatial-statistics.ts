/** K09-S3: deterministic candidate Moran's I and LISA statistics. */

import type { SpatialWeightsResultV01 } from "./spatial-weights.ts";

export interface SpatialStatisticObservationV01 { id: string; value: number | null; }
export interface MoranLisaaPlanV01 {
  schema: "epi-gis-spatial-statistics/0.1";
  planId: string;
  statistic: "moran" | "lisa";
  permutations: number;
  seed: number;
  missingPolicy: "exclude" | "fail";
  maxObservations: number;
}

export interface MoranStatisticV01 {
  statistic: "moran";
  value: number | null;
  expectedUnderRandomization: number | null;
  permutationPValue: number | null;
  observationsUsed: number;
  permutations: number;
}

export interface LisaStatisticV01 {
  statistic: "lisa";
  id: string;
  value: number | null;
  localI: number | null;
  permutationPValue: number | null;
  quadrant: "high-high" | "high-low" | "low-high" | "low-low" | "no-data" | "isolated";
}

export interface MoranLisaResultV01 {
  schema: "epi-gis-spatial-statistics/0.1";
  planId: string;
  statistic: "moran" | "lisa";
  result: MoranStatisticV01 | readonly LisaStatisticV01[];
  diagnostics: readonly { code: "missing-value" | "isolated-feature" | "constant-values"; featureId?: string; message: string }[];
  validationStatus: "candidate";
}

export class MoranLisaErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "MoranLisaErrorV01"; }
}

function validatePlan(plan: MoranLisaaPlanV01): void {
  if (plan.schema !== "epi-gis-spatial-statistics/0.1") throw new MoranLisaErrorV01("Unsupported spatial-statistics schema.");
  if (!plan.planId.trim()) throw new MoranLisaErrorV01("A spatial-statistics plan id is required.");
  if (plan.statistic !== "moran" && plan.statistic !== "lisa") throw new MoranLisaErrorV01("Statistic must be moran or lisa.");
  if (!Number.isSafeInteger(plan.permutations) || plan.permutations < 0 || plan.permutations > 100_000) throw new MoranLisaErrorV01("permutations must be an integer from 0 through 100000.");
  if (!Number.isSafeInteger(plan.seed) || plan.seed < 0 || plan.seed > 2_147_483_647) throw new MoranLisaErrorV01("seed must be a non-negative 32-bit integer.");
  if (plan.missingPolicy !== "exclude" && plan.missingPolicy !== "fail") throw new MoranLisaErrorV01("missingPolicy must be exclude or fail.");
  if (!Number.isSafeInteger(plan.maxObservations) || plan.maxObservations < 2 || plan.maxObservations > 100_000) throw new MoranLisaErrorV01("maxObservations must be an integer from 2 through 100000.");
}

export function createMoranLisaPlanV01(input: Omit<MoranLisaaPlanV01, "schema">): MoranLisaaPlanV01 {
  const plan = { schema: "epi-gis-spatial-statistics/0.1", ...input } as MoranLisaaPlanV01;
  validatePlan(plan);
  return plan;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function permutation(values: readonly number[], random: () => number): number[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}

function twoSidedPValue(observed: number, simulated: readonly number[]): number | null {
  if (simulated.length === 0 || !Number.isFinite(observed)) return null;
  const extreme = simulated.filter((value) => Math.abs(value) >= Math.abs(observed)).length;
  return (extreme + 1) / (simulated.length + 1);
}

function validateInputs(plan: MoranLisaaPlanV01, weights: SpatialWeightsResultV01, observations: readonly SpatialStatisticObservationV01[]): Map<string, number> {
  if (weights.schema !== "epi-gis-spatial-weights/0.1") throw new MoranLisaErrorV01("The weights result schema is unsupported.");
  if (observations.length > plan.maxObservations) throw new MoranLisaErrorV01("The observation count exceeds maxObservations.");
  const weightsIds = new Set(weights.rows.map((row) => row.id));
  const values = new Map<string, number>();
  const missing: string[] = [];
  const duplicate = new Set<string>();
  for (const observation of observations) {
    if (!observation.id.trim()) throw new MoranLisaErrorV01("Observation ids must be non-empty.");
    if (duplicate.has(observation.id)) throw new MoranLisaErrorV01(`Observation id is duplicated: ${observation.id}.`);
    duplicate.add(observation.id);
    if (!weightsIds.has(observation.id)) throw new MoranLisaErrorV01(`Observation ${observation.id} is absent from the weights result.`);
    if (observation.value === null || !Number.isFinite(observation.value)) { missing.push(observation.id); continue; }
    values.set(observation.id, observation.value);
  }
  if (plan.missingPolicy === "fail" && missing.length > 0) throw new MoranLisaErrorV01(`Missing or non-finite values are not permitted: ${missing.join(", ")}.`);
  if (values.size < 2) throw new MoranLisaErrorV01("At least two finite observations are required.");
  return values;
}

function neighborValues(rowId: string, weights: SpatialWeightsResultV01, values: Map<string, number>): Array<{ id: string; weight: number; value: number }> {
  const row = weights.rows.find((candidate) => candidate.id === rowId);
  if (!row) return [];
  return row.neighbors.flatMap((neighbor) => { const value = values.get(neighbor.id); return value === undefined ? [] : [{ id: neighbor.id, weight: neighbor.weight, value }]; });
}

function moranValue(ids: readonly string[], values: readonly number[], weights: SpatialWeightsResultV01): number | null {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviations = new Map(ids.map((id, index) => [id, values[index]! - mean]));
  const denominator = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  if (denominator === 0) return null;
  let numerator = 0;
  let weightSum = 0;
  for (const row of weights.rows) {
    const left = deviations.get(row.id);
    if (left === undefined) continue;
    for (const neighbor of row.neighbors) {
      const right = deviations.get(neighbor.id);
      if (right === undefined) continue;
      numerator += neighbor.weight * left * right;
      weightSum += neighbor.weight;
    }
  }
  return weightSum === 0 ? null : (values.length / weightSum) * (numerator / denominator);
}

export function calculateMoranLisaV01(plan: MoranLisaaPlanV01, weights: SpatialWeightsResultV01, observationsInput: readonly SpatialStatisticObservationV01[]): MoranLisaResultV01 {
  validatePlan(plan);
  const values = validateInputs(plan, weights, observationsInput);
  const ids = [...values.keys()].sort();
  const observations = ids.map((id) => values.get(id)!);
  const diagnostics: Array<{ code: "missing-value" | "isolated-feature" | "constant-values"; featureId?: string; message: string }> = observationsInput.filter((observation) => !values.has(observation.id)).map((observation) => ({ code: "missing-value", featureId: observation.id, message: `Observation ${observation.id} was excluded because its value is missing or non-finite.` }));
  const mean = observations.reduce((sum, value) => sum + value, 0) / observations.length;
  const variance = observations.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  if (variance === 0) diagnostics.push({ code: "constant-values", message: "All included values are equal; spatial statistics are undefined." });
  const valuesById = new Map(ids.map((id, index) => [id, observations[index]! ]));
  const random = seededRandom(plan.seed);
  if (plan.statistic === "moran") {
    const simulated: number[] = [];
    for (let index = 0; index < plan.permutations; index += 1) {
      const shuffled = permutation(observations, random);
      simulated.push(moranValue(ids, shuffled, weights) ?? 0);
    }
    const value = moranValue(ids, observations, weights);
    const expected = value === null ? null : -1 / Math.max(1, observations.length - 1);
    if (value === null) diagnostics.push({ code: "constant-values", message: "Moran's I is undefined for constant values or zero total weight." });
    return { schema: "epi-gis-spatial-statistics/0.1", planId: plan.planId, statistic: "moran", result: { statistic: "moran", value, expectedUnderRandomization: expected, permutationPValue: twoSidedPValue(value ?? NaN, simulated), observationsUsed: observations.length, permutations: plan.permutations }, diagnostics, validationStatus: "candidate" };
  }
  const m2 = variance / observations.length;
  const lisa = ids.map((id) => {
    const neighbors = neighborValues(id, weights, values);
    if (neighbors.length === 0) { diagnostics.push({ code: "isolated-feature", featureId: id, message: `Feature ${id} has no included neighbors.` }); return { statistic: "lisa" as const, id, value: valuesById.get(id)!, localI: null, permutationPValue: null, quadrant: "isolated" as const }; }
    const centered = valuesById.get(id)! - mean;
    const lag = neighbors.reduce((sum, neighbor) => sum + neighbor.weight * (neighbor.value - mean), 0);
    const localI = m2 === 0 ? null : centered * lag / m2;
    const quadrant = centered >= 0 ? (lag >= 0 ? "high-high" : "high-low") : (lag >= 0 ? "low-high" : "low-low");
    const simulated: number[] = [];
    for (let index = 0; index < plan.permutations; index += 1) {
      const shuffled = permutation(observations, random);
      const simulatedMean = shuffled.reduce((sum, value) => sum + value, 0) / shuffled.length;
      const simulatedM2 = shuffled.reduce((sum, value) => sum + (value - simulatedMean) ** 2, 0) / shuffled.length;
      const simulatedValues = new Map(ids.map((candidateId, candidateIndex) => [candidateId, shuffled[candidateIndex]!]));
      const simulatedNeighbors = neighborValues(id, weights, simulatedValues);
      const simulatedCentered = simulatedValues.get(id)! - simulatedMean;
      const simulatedLag = simulatedNeighbors.reduce((sum, neighbor) => sum + neighbor.weight * (neighbor.value - simulatedMean), 0);
      simulated.push(simulatedM2 === 0 ? 0 : simulatedCentered * simulatedLag / simulatedM2);
    }
    return { statistic: "lisa" as const, id, value: valuesById.get(id)!, localI, permutationPValue: twoSidedPValue(localI ?? NaN, simulated), quadrant: localI === null ? "no-data" as const : quadrant as "high-high" | "high-low" | "low-high" | "low-low" };
  });
  return { schema: "epi-gis-spatial-statistics/0.1", planId: plan.planId, statistic: "lisa", result: lisa, diagnostics, validationStatus: "candidate" };
}
