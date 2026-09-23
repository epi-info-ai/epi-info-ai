/** K09-S4: deterministic candidate Getis-Ord Gi* hotspot statistics. */

import type { SpatialWeightsResultV01 } from "./spatial-weights.ts";

export interface GetisOrdPlanV01 {
  schema: "epi-gis-getis-ord/0.1";
  planId: string;
  permutations: number;
  seed: number;
  missingPolicy: "exclude" | "fail";
  includeSelf: true;
  maxObservations: number;
}

export interface GetisOrdEntryV01 {
  id: string;
  value: number;
  statistic: number | null;
  zScore: number | null;
  permutationPValue: number | null;
  classification: "hot" | "cold" | "neutral" | "no-data" | "isolated";
}

export interface GetisOrdResultV01 {
  schema: "epi-gis-getis-ord-result/0.1";
  planId: string;
  statistic: "getis-ord-gi-star";
  entries: readonly GetisOrdEntryV01[];
  diagnostics: readonly { code: "missing-value" | "isolated-feature" | "constant-values"; featureId?: string; message: string }[];
  validationStatus: "candidate";
}

export class GetisOrdErrorV01 extends Error {
  constructor(message: string) { super(message); this.name = "GetisOrdErrorV01"; }
}

function validatePlan(plan: GetisOrdPlanV01): void {
  if (plan.schema !== "epi-gis-getis-ord/0.1") throw new GetisOrdErrorV01("Unsupported Getis-Ord schema.");
  if (!plan.planId.trim()) throw new GetisOrdErrorV01("A Getis-Ord plan id is required.");
  if (!Number.isSafeInteger(plan.permutations) || plan.permutations < 0 || plan.permutations > 100_000) throw new GetisOrdErrorV01("permutations must be an integer from 0 through 100000.");
  if (!Number.isSafeInteger(plan.seed) || plan.seed < 0 || plan.seed > 2_147_483_647) throw new GetisOrdErrorV01("seed must be a non-negative 32-bit integer.");
  if (plan.missingPolicy !== "exclude" && plan.missingPolicy !== "fail") throw new GetisOrdErrorV01("missingPolicy must be exclude or fail.");
  if (plan.includeSelf !== true) throw new GetisOrdErrorV01("Getis-Ord Gi* requires includeSelf=true in v0.1.");
  if (!Number.isSafeInteger(plan.maxObservations) || plan.maxObservations < 2 || plan.maxObservations > 100_000) throw new GetisOrdErrorV01("maxObservations must be an integer from 2 through 100000.");
}

export function createGetisOrdPlanV01(input: Omit<GetisOrdPlanV01, "schema">): GetisOrdPlanV01 {
  const plan = { schema: "epi-gis-getis-ord/0.1", ...input } as GetisOrdPlanV01;
  validatePlan(plan);
  return plan;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 0x9e3779b9;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4_294_967_296; };
}

function permutation(values: readonly number[], random: () => number): number[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) { const swap = Math.floor(random() * (index + 1)); [output[index], output[swap]] = [output[swap]!, output[index]!]; }
  return output;
}

function pValue(observed: number, simulations: readonly number[]): number | null {
  if (simulations.length === 0 || !Number.isFinite(observed)) return null;
  return (simulations.filter((value) => Math.abs(value) >= Math.abs(observed)).length + 1) / (simulations.length + 1);
}

function score(id: string, ids: readonly string[], values: readonly number[], weights: SpatialWeightsResultV01): number | null {
  const row = weights.rows.find((candidate) => candidate.id === id);
  if (!row) return null;
  const valueMap = new Map(ids.map((candidate, index) => [candidate, values[index]!]));
  const weightedSum = values[ids.indexOf(id)]! + row.neighbors.reduce((sum, neighbor) => sum + neighbor.weight * (valueMap.get(neighbor.id) ?? 0), 0);
  const weightTotal = 1 + row.neighbors.reduce((sum, neighbor) => sum + neighbor.weight, 0);
  return weightedSum / weightTotal;
}

export function calculateGetisOrdGiStarV01(plan: GetisOrdPlanV01, weights: SpatialWeightsResultV01, observationsInput: readonly { id: string; value: number | null }[]): GetisOrdResultV01 {
  validatePlan(plan);
  if (weights.schema !== "epi-gis-spatial-weights/0.1") throw new GetisOrdErrorV01("The weights result schema is unsupported.");
  if (observationsInput.length > plan.maxObservations) throw new GetisOrdErrorV01("The observation count exceeds maxObservations.");
  const weightsIds = new Set(weights.rows.map((row) => row.id));
  const observations = new Map<string, number>();
  const diagnostics: Array<{ code: "missing-value" | "isolated-feature" | "constant-values"; featureId?: string; message: string }> = [];
  const seen = new Set<string>();
  for (const observation of observationsInput) {
    if (!observation.id.trim()) throw new GetisOrdErrorV01("Observation ids must be non-empty.");
    if (seen.has(observation.id)) throw new GetisOrdErrorV01(`Observation id is duplicated: ${observation.id}.`);
    seen.add(observation.id);
    if (!weightsIds.has(observation.id)) throw new GetisOrdErrorV01(`Observation ${observation.id} is absent from the weights result.`);
    if (observation.value === null || !Number.isFinite(observation.value)) {
      if (plan.missingPolicy === "fail") throw new GetisOrdErrorV01(`Missing or non-finite values are not permitted: ${observation.id}.`);
      diagnostics.push({ code: "missing-value", featureId: observation.id, message: `Observation ${observation.id} was excluded because its value is missing or non-finite.` });
    } else observations.set(observation.id, observation.value);
  }
  if (observations.size < 2) throw new GetisOrdErrorV01("At least two finite observations are required.");
  const ids = [...observations.keys()].sort();
  const values = ids.map((id) => observations.get(id)!);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  if (variance === 0) diagnostics.push({ code: "constant-values", message: "All included values are equal; Getis-Ord z-scores are undefined." });
  const standardDeviation = Math.sqrt(variance);
  const random = seededRandom(plan.seed);
  const entries = ids.map((id) => {
    const row = weights.rows.find((candidate) => candidate.id === id);
    if (!row || row.neighbors.every((neighbor) => !observations.has(neighbor.id))) {
      diagnostics.push({ code: "isolated-feature", featureId: id, message: `Feature ${id} has no included neighbors.` });
      return { id, value: observations.get(id)!, statistic: null, zScore: null, permutationPValue: null, classification: "isolated" as const };
    }
    const observed = score(id, ids, values, weights);
    const simulations: number[] = [];
    for (let index = 0; index < plan.permutations; index += 1) simulations.push(score(id, ids, permutation(values, random), weights) ?? 0);
    const simulationMean = simulations.length ? simulations.reduce((sum, value) => sum + value, 0) / simulations.length : null;
    const simulationVariance = simulations.length ? simulations.reduce((sum, value) => sum + (value - simulationMean!) ** 2, 0) / simulations.length : null;
    const zScore = observed === null || simulationVariance === null || simulationVariance === 0 ? null : (observed - simulationMean!) / Math.sqrt(simulationVariance);
    const classification: GetisOrdEntryV01["classification"] = zScore === null ? "neutral" : zScore >= 1.96 ? "hot" : zScore <= -1.96 ? "cold" : "neutral";
    return { id, value: observations.get(id)!, statistic: observed, zScore, permutationPValue: pValue(observed ?? NaN, simulations), classification };
  });
  return { schema: "epi-gis-getis-ord-result/0.1", planId: plan.planId, statistic: "getis-ord-gi-star", entries, diagnostics, validationStatus: "candidate" };
}
