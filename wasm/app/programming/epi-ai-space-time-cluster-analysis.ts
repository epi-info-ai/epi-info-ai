import type { EpiRecord } from "../contracts/core.ts";
import type { SpaceTimeClusterPlan } from "./epi-ai-space-time-cluster.ts";

export const SPACE_TIME_CLUSTER_SCORING_VERSION = "0.2.0" as const;
export const SPACE_TIME_CLUSTER_MAX_MONTE_CARLO_WORK = 25_000_000;
const DAY_MS = 86_400_000;
const EARTH_RADIUS_KM = 6371.0088;

export interface SpaceTimeClusterExclusions {
  missingId: number;
  invalidDate: number;
  outsideStudyPeriod: number;
  invalidLatitude: number;
  invalidLongitude: number;
}

export interface SpaceTimeClusterWindow {
  rank: number;
  observed: number;
  expected: number;
  observedExpectedRatio: number;
  logLikelihoodRatio: number;
  start: string;
  end: string;
  center: { latitude: number; longitude: number };
  radiusKm: number;
  locationCount: number;
  caseCount: number;
  memberPoints: Array<{ latitude: number; longitude: number; cases: number }>;
  caseIds: string[];
  pValue: number | null;
  monteCarloExceedances?: number;
}

export interface SpaceTimeClusterScoringResult {
  version: typeof SPACE_TIME_CLUSTER_SCORING_VERSION;
  state: "scored-no-inference";
  plan: SpaceTimeClusterPlan;
  totals: {
    sourceRecords: number;
    eligibleRecords: number;
    excludedRecords: number;
    distinctLocations: number;
    timeBins: number;
    spatialWindows: number;
    temporalWindows: number;
    candidateWindows: number;
  };
  exclusions: SpaceTimeClusterExclusions;
  clusters: SpaceTimeClusterWindow[];
  diagnostics: string[];
}

export interface SpaceTimeClusterInferenceResult extends Omit<SpaceTimeClusterScoringResult, "state"> {
  state: "inferred-candidate";
  inference: {
    method: "maximum-likelihood-ratio-monte-carlo";
    randomGenerator: "mulberry32-v1";
    seed: number;
    replications: number;
    work: number;
  };
}

export interface SpaceTimeClusterProgress {
  completedReplications: number;
  totalReplications: number;
  fraction: number;
}

interface PreparedCase { id: string; dateMs: number; timeBin: number; latitude: number; longitude: number; locationKey: string }
interface Location { key: string; latitude: number; longitude: number; cases: PreparedCase[] }
interface SpatialWindow { center: Location; radiusKm: number; locations: Location[]; caseCount: number }

const text = (value: unknown): string => value === null || value === undefined ? "" : String(value).trim();
const isoDay = (milliseconds: number): string => new Date(milliseconds).toISOString().slice(0, 10);
const radians = (degrees: number): number => degrees * Math.PI / 180;

export function haversineKilometers(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const latitudeA = radians(a.latitude);
  const latitudeB = radians(b.latitude);
  const chord = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(chord)));
}

function timeBin(dateMs: number, startMs: number, plan: SpaceTimeClusterPlan): number {
  if (plan.timeUnit === "MONTH") {
    const date = new Date(dateMs);
    const start = new Date(startMs);
    return Math.floor(((date.getUTCFullYear() - start.getUTCFullYear()) * 12 + date.getUTCMonth() - start.getUTCMonth()) / plan.timeLength);
  }
  const days = Math.floor((dateMs - startMs) / DAY_MS);
  const width = plan.timeUnit === "WEEK" ? plan.timeLength * 7 : plan.timeLength;
  return Math.floor(days / width);
}

function binStart(bin: number, startMs: number, plan: SpaceTimeClusterPlan): number {
  if (plan.timeUnit === "MONTH") {
    const start = new Date(startMs);
    return Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + bin * plan.timeLength, 1);
  }
  return startMs + bin * (plan.timeUnit === "WEEK" ? plan.timeLength * 7 : plan.timeLength) * DAY_MS;
}

function binEnd(bin: number, startMs: number, studyEndMs: number, plan: SpaceTimeClusterPlan): number {
  if (plan.timeUnit === "MONTH") {
    const start = new Date(startMs);
    return Math.min(studyEndMs, Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + (bin + 1) * plan.timeLength, 1) - DAY_MS);
  }
  const widthDays = (plan.timeUnit === "WEEK" ? 7 : 1) * plan.timeLength;
  return Math.min(studyEndMs, startMs + ((bin + 1) * widthDays - 1) * DAY_MS);
}

function likelihoodRatio(observed: number, expected: number, total: number): number {
  if (!(observed > expected) || expected <= 0 || expected >= total) return 0;
  const outsideObserved = total - observed;
  const outsideExpected = total - expected;
  const inside = observed * Math.log(observed / expected);
  const outside = outsideObserved > 0 ? outsideObserved * Math.log(outsideObserved / outsideExpected) : 0;
  return Math.max(0, inside + outside);
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled(values: readonly number[], random: () => number): number[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const replacement = Math.floor(random() * (index + 1));
    [result[index], result[replacement]] = [result[replacement]!, result[index]!];
  }
  return result;
}

function prepare(records: readonly EpiRecord[], plan: SpaceTimeClusterPlan) {
  const exclusions: SpaceTimeClusterExclusions = { missingId: 0, invalidDate: 0, outsideStudyPeriod: 0, invalidLatitude: 0, invalidLongitude: 0 };
  const startMs = Date.parse(`${plan.studyStart}T00:00:00Z`);
  const endMs = Date.parse(`${plan.studyEnd}T00:00:00Z`);
  const prepared: PreparedCase[] = [];
  const ids = new Set<string>();
  for (const record of records) {
    const id = text(record[plan.idField]);
    if (!id) { exclusions.missingId++; continue; }
    if (ids.has(id)) throw new RangeError(`EPIAI CLUSTER SPACE_TIME requires unique IDs; ${id} is duplicated.`);
    ids.add(id);
    const rawDate = text(record[plan.dateField]);
    const dateMs = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? Date.parse(`${rawDate}T00:00:00Z`) : Number.NaN;
    if (!Number.isFinite(dateMs)) { exclusions.invalidDate++; continue; }
    if (dateMs < startMs || dateMs > endMs) { exclusions.outsideStudyPeriod++; continue; }
    const latitude = Number(record[plan.latitudeField]);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) { exclusions.invalidLatitude++; continue; }
    const longitude = Number(record[plan.longitudeField]);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) { exclusions.invalidLongitude++; continue; }
    prepared.push({ id, dateMs, timeBin: timeBin(dateMs, startMs, plan), latitude, longitude, locationKey: `${latitude.toFixed(6)},${longitude.toFixed(6)}` });
  }
  prepared.sort((a, b) => a.id.localeCompare(b.id));
  return { prepared, exclusions, startMs, endMs };
}

function spatialWindows(locations: Location[], total: number, plan: SpaceTimeClusterPlan): SpatialWindow[] {
  const cap = total * plan.maxCaseFraction;
  const unique = new Map<string, SpatialWindow>();
  for (const center of locations) {
    const ordered = locations.map((location) => ({ location, distance: haversineKilometers(center, location) }))
      .filter(({ distance }) => distance <= plan.maxDistanceKm + 1e-12)
      .sort((a, b) => a.distance - b.distance || a.location.key.localeCompare(b.location.key));
    const members: Location[] = [];
    let cases = 0;
    for (const item of ordered) {
      const nextCases = cases + item.location.cases.length;
      if (nextCases > cap + 1e-12) break;
      members.push(item.location);
      cases = nextCases;
      const memberKey = members.map(({ key }) => key).sort().join("|");
      const previous = unique.get(memberKey);
      const candidate = { center, radiusKm: item.distance, locations: [...members], caseCount: cases };
      if (!previous || candidate.radiusKm < previous.radiusKm) unique.set(memberKey, candidate);
    }
  }
  return [...unique.values()].sort((a, b) => a.locations.map(({ key }) => key).sort().join("|").localeCompare(b.locations.map(({ key }) => key).sort().join("|")));
}

export function scoreSpaceTimeClusterCandidates(records: readonly EpiRecord[], plan: SpaceTimeClusterPlan, maximumResults = 20): SpaceTimeClusterScoringResult {
  if (maximumResults < 1 || maximumResults > 1000 || !Number.isInteger(maximumResults)) throw new RangeError("maximumResults must be an integer from 1 through 1000.");
  const { prepared, exclusions, startMs, endMs } = prepare(records, plan);
  if (prepared.length < 4) throw new RangeError("EPIAI CLUSTER SPACE_TIME requires at least four eligible cases.");
  const locationMap = new Map<string, Location>();
  for (const record of prepared) {
    const location = locationMap.get(record.locationKey) ?? { key: record.locationKey, latitude: record.latitude, longitude: record.longitude, cases: [] };
    location.cases.push(record);
    locationMap.set(record.locationKey, location);
  }
  const locations = [...locationMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const maximumBin = Math.max(...prepared.map(({ timeBin: bin }) => bin));
  const timeBins = maximumBin + 1;
  if (locations.length < 2 || timeBins < 2) throw new RangeError("EPIAI CLUSTER SPACE_TIME requires at least two distinct locations and time bins.");
  const spatial = spatialWindows(locations, prepared.length, plan);
  if (!spatial.length) throw new RangeError("The spatial limits exclude every candidate window.");
  const maximumTemporalLength = Math.max(1, Math.min(plan.maxTimeUnits, Math.floor(timeBins * plan.maxTimeFraction)));
  const temporalMarginal = Array.from({ length: timeBins }, (_, bin) => prepared.filter((record) => record.timeBin === bin).length);
  const scored: Omit<SpaceTimeClusterWindow, "rank">[] = [];
  let temporalWindows = 0;
  for (let first = 0; first < timeBins; first++) {
    for (let last = first; last < Math.min(timeBins, first + maximumTemporalLength); last++) {
      temporalWindows++;
      const timeCases = temporalMarginal.slice(first, last + 1).reduce((sum, count) => sum + count, 0);
      for (const window of spatial) {
        const memberKeys = new Set(window.locations.map(({ key }) => key));
        const cases = prepared.filter((record) => memberKeys.has(record.locationKey) && record.timeBin >= first && record.timeBin <= last);
        const expected = window.caseCount * timeCases / prepared.length;
        const logLikelihoodRatio = likelihoodRatio(cases.length, expected, prepared.length);
        if (logLikelihoodRatio <= 0) continue;
        scored.push({
          observed: cases.length, expected, observedExpectedRatio: cases.length / expected, logLikelihoodRatio,
          start: isoDay(binStart(first, startMs, plan)), end: isoDay(binEnd(last, startMs, endMs, plan)),
          center: { latitude: window.center.latitude, longitude: window.center.longitude }, radiusKm: window.radiusKm,
          locationCount: window.locations.length, caseCount: cases.length,
          memberPoints: window.locations.map(({ latitude, longitude, cases: locationCases }) => ({ latitude, longitude, cases: locationCases.length })),
          caseIds: cases.map(({ id }) => id).sort(), pValue: null,
        });
      }
    }
  }
  scored.sort((a, b) => b.logLikelihoodRatio - a.logLikelihoodRatio || b.observed - a.observed || a.start.localeCompare(b.start) || a.center.latitude - b.center.latitude || a.center.longitude - b.center.longitude);
  const excludedRecords = Object.values(exclusions).reduce((sum, count) => sum + count, 0);
  return {
    version: SPACE_TIME_CLUSTER_SCORING_VERSION, state: "scored-no-inference", plan,
    totals: {
      sourceRecords: records.length, eligibleRecords: prepared.length, excludedRecords,
      distinctLocations: locations.length, timeBins, spatialWindows: spatial.length,
      temporalWindows, candidateWindows: spatial.length * temporalWindows,
    },
    exclusions, clusters: scored.slice(0, maximumResults).map((cluster, index) => ({ rank: index + 1, ...cluster })),
    diagnostics: [
      "Candidate scores are descriptive only; Monte Carlo inference is not implemented and p-values are null.",
      "Circle centers, radii, member points, and time intervals are map-ready but are not rendered automatically.",
    ],
  };
}

/**
 * Candidate Monte Carlo inference for the retrospective space-time permutation
 * model. Event-time bins are permuted across fixed case locations, preserving
 * both spatial and temporal marginals. Each replication contributes its maximum
 * candidate-window LLR, so reported p-values adjust for the scan over windows.
 * This numerical candidate remains unavailable through the UI pending an
 * independent notebook oracle, Worker cancellation/progress, and review.
 */
export function inferSpaceTimeClusters(
  records: readonly EpiRecord[],
  plan: SpaceTimeClusterPlan,
  maximumResults = 20,
  onProgress?: (progress: SpaceTimeClusterProgress) => void,
): SpaceTimeClusterInferenceResult {
  const scored = scoreSpaceTimeClusterCandidates(records, plan, maximumResults);
  const { prepared } = prepare(records, plan);
  const locationMap = new Map<string, Location>();
  for (const record of prepared) {
    const location = locationMap.get(record.locationKey) ?? { key: record.locationKey, latitude: record.latitude, longitude: record.longitude, cases: [] };
    location.cases.push(record);
    locationMap.set(record.locationKey, location);
  }
  const locations = [...locationMap.values()].sort((a, b) => a.key.localeCompare(b.key));
  const spatial = spatialWindows(locations, prepared.length, plan);
  const maximumBin = Math.max(...prepared.map(({ timeBin: bin }) => bin));
  const timeBins = maximumBin + 1;
  const maximumTemporalLength = Math.max(1, Math.min(plan.maxTimeUnits, Math.floor(timeBins * plan.maxTimeFraction)));
  const temporalMarginal = Array.from({ length: timeBins }, (_, bin) => prepared.filter((record) => record.timeBin === bin).length);
  const temporal: Array<{ first: number; last: number; cases: number }> = [];
  for (let first = 0; first < timeBins; first++) {
    for (let last = first; last < Math.min(timeBins, first + maximumTemporalLength); last++) {
      temporal.push({ first, last, cases: temporalMarginal.slice(first, last + 1).reduce((sum, count) => sum + count, 0) });
    }
  }
  const work = plan.replications * spatial.length * temporal.length;
  if (work > SPACE_TIME_CLUSTER_MAX_MONTE_CARLO_WORK) {
    throw new RangeError(`Monte Carlo work ${work} exceeds the reviewed limit ${SPACE_TIME_CLUSTER_MAX_MONTE_CARLO_WORK}; reduce REPLICATIONS or scan-window limits.`);
  }
  const spatialMembership = spatial.map((window) => {
    const keys = new Set(window.locations.map(({ key }) => key));
    return prepared.map(({ locationKey }) => keys.has(locationKey));
  });
  const random = mulberry32(plan.seed);
  const originalBins = prepared.map(({ timeBin: bin }) => bin);
  const nullMaximums: number[] = [];
  onProgress?.({ completedReplications: 0, totalReplications: plan.replications, fraction: 0 });
  for (let replication = 0; replication < plan.replications; replication++) {
    const permutedBins = shuffled(originalBins, random);
    let maximum = 0;
    for (const period of temporal) {
      for (let spatialIndex = 0; spatialIndex < spatial.length; spatialIndex++) {
        let observed = 0;
        const membership = spatialMembership[spatialIndex]!;
        for (let caseIndex = 0; caseIndex < prepared.length; caseIndex++) {
          const bin = permutedBins[caseIndex]!;
          if (membership[caseIndex] && bin >= period.first && bin <= period.last) observed++;
        }
        const expected = spatial[spatialIndex]!.caseCount * period.cases / prepared.length;
        maximum = Math.max(maximum, likelihoodRatio(observed, expected, prepared.length));
      }
    }
    nullMaximums.push(maximum);
    const completedReplications = replication + 1;
    onProgress?.({ completedReplications, totalReplications: plan.replications, fraction: completedReplications / plan.replications });
  }
  const clusters = scored.clusters.map((cluster) => {
    const monteCarloExceedances = nullMaximums.filter((maximum) => maximum + 1e-12 >= cluster.logLikelihoodRatio).length;
    return { ...cluster, pValue: (1 + monteCarloExceedances) / (1 + plan.replications), monteCarloExceedances };
  });
  return {
    ...scored,
    state: "inferred-candidate",
    clusters,
    inference: {
      method: "maximum-likelihood-ratio-monte-carlo",
      randomGenerator: "mulberry32-v1",
      seed: plan.seed,
      replications: plan.replications,
      work,
    },
    diagnostics: [
      "Candidate p-values use the maximum likelihood-ratio null distribution and (1 + exceedances) / (1 + replications).",
      "Inference is deterministic for the recorded mulberry32-v1 seed but remains disabled in the UI pending independent validation and Worker controls.",
    ],
  };
}
