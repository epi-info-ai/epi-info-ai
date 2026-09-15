import type { EpiRecord, RecordValue } from "../contracts/core.ts";
import type {
  DatasetMatchedPairsRequest,
  MatchedPairsCounts,
  MatchedPairsDerivation,
  MatchedPairsExclusionReason,
} from "../contracts/engine.ts";

const MAX_SOURCE_RECORDS = 100_000;
const MAX_SOURCE_SETS = 50_000;
const MAX_MATCH_VALUE_LENGTH = 512;

type BinaryValue = 0 | 1;

interface MatchGroup {
  displayValue: string;
  members: EpiRecord[];
}

function commandField(name: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name.replaceAll("]", "]]")}]`;
}

function missing(value: RecordValue | undefined): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);
}

function binary(value: RecordValue | undefined): BinaryValue | null | "invalid" {
  if (missing(value)) return null;
  if (value === true || value === 1) return 1;
  if (value === false || value === 0) return 0;
  if (typeof value !== "string") return "invalid";
  const normalized = value.trim().toLocaleLowerCase("en-US");
  if (normalized === "1" || normalized === "yes") return 1;
  if (normalized === "0" || normalized === "no") return 0;
  return "invalid";
}

function matchIdentity(value: RecordValue): { key: string; displayValue: string } {
  const displayValue = typeof value === "string" ? value.trim() : String(value);
  if (displayValue.length > MAX_MATCH_VALUE_LENGTH) {
    throw new RangeError(`MATCH identifiers are limited to ${MAX_MATCH_VALUE_LENGTH} characters.`);
  }
  return { key: `${typeof value}:${displayValue}`, displayValue };
}

function exclusionCounter(reason: MatchedPairsExclusionReason): keyof MatchedPairsDerivation["exclusions"] {
  if (reason === "missing-analysis-value") return "missingAnalysisValueSets";
  if (reason === "invalid-analysis-value") return "invalidAnalysisValueSets";
  if (reason === "invalid-case-control-composition") return "invalidCaseControlCompositionSets";
  return "unsupportedVariableRatioSets";
}

export function deriveMatchedPairs(
  records: readonly EpiRecord[],
  request: DatasetMatchedPairsRequest,
): MatchedPairsDerivation {
  const fields = [request.exposureField, request.outcomeField, request.matchField];
  if (fields.some((field) => !field.trim()) || new Set(fields).size !== fields.length) {
    throw new RangeError("Select three different exposure, outcome, and match identifier fields.");
  }
  if (request.confidenceLevel !== 0.95) throw new RangeError("MATCH V0.1 supports a 95% confidence level only.");
  if (!records.length) throw new RangeError("MATCH requires at least one active record.");
  if (records.length > MAX_SOURCE_RECORDS) {
    throw new RangeError(`MATCH V0.1 is limited to ${MAX_SOURCE_RECORDS.toLocaleString("en-US")} active records.`);
  }

  const groups = new Map<string, MatchGroup>();
  const missingIdentifierRecords: EpiRecord[] = [];
  for (const record of records) {
    const value = record[request.matchField];
    if (missing(value)) {
      missingIdentifierRecords.push(record);
      continue;
    }
    const identity = matchIdentity(value!);
    const group = groups.get(identity.key);
    if (group) group.members.push(record);
    else groups.set(identity.key, { displayValue: identity.displayValue, members: [record] });
    if (groups.size > MAX_SOURCE_SETS) {
      throw new RangeError(`MATCH V0.1 is limited to ${MAX_SOURCE_SETS.toLocaleString("en-US")} matched sets.`);
    }
  }

  const pairs: MatchedPairsCounts = {
    caseExposedControlUnexposed: 0,
    caseUnexposedControlExposed: 0,
    bothExposed: 0,
    neitherExposed: 0,
    discordant: 0,
    concordant: 0,
  };
  const exclusions: MatchedPairsDerivation["exclusions"] = {
    missingAnalysisValueSets: 0,
    invalidAnalysisValueSets: 0,
    invalidCaseControlCompositionSets: 0,
    unsupportedVariableRatioSets: 0,
    sets: [],
  };
  let includedRecords = 0;
  let includedSets = 0;
  let excludedRecords = 0;

  const exclude = (matchValue: string, recordCount: number, reason: MatchedPairsExclusionReason): void => {
    const counter = exclusionCounter(reason);
    if (counter !== "sets") exclusions[counter] += 1;
    exclusions.sets.push({ matchValue, recordCount, reason });
    excludedRecords += recordCount;
  };
  missingIdentifierRecords.forEach((_, index) => exclude(`(missing identifier ${index + 1})`, 1, "missing-analysis-value"));

  for (const group of groups.values()) {
    const outcomes = group.members.map((record) => binary(record[request.outcomeField]));
    const exposures = group.members.map((record) => binary(record[request.exposureField]));
    if (outcomes.includes(null) || exposures.includes(null)) {
      exclude(group.displayValue, group.members.length, "missing-analysis-value");
      continue;
    }
    if (outcomes.includes("invalid") || exposures.includes("invalid")) {
      exclude(group.displayValue, group.members.length, "invalid-analysis-value");
      continue;
    }
    if (group.members.length !== 2) {
      exclude(group.displayValue, group.members.length, "unsupported-variable-ratio");
      continue;
    }
    const caseIndexes = outcomes.flatMap((value, index) => value === 1 ? [index] : []);
    const controlIndexes = outcomes.flatMap((value, index) => value === 0 ? [index] : []);
    if (caseIndexes.length !== 1 || controlIndexes.length !== 1) {
      exclude(group.displayValue, group.members.length, "invalid-case-control-composition");
      continue;
    }
    const caseExposure = exposures[caseIndexes[0]!] as BinaryValue;
    const controlExposure = exposures[controlIndexes[0]!] as BinaryValue;
    if (caseExposure === 1 && controlExposure === 0) pairs.caseExposedControlUnexposed += 1;
    else if (caseExposure === 0 && controlExposure === 1) pairs.caseUnexposedControlExposed += 1;
    else if (caseExposure === 1) pairs.bothExposed += 1;
    else pairs.neitherExposed += 1;
    includedSets += 1;
    includedRecords += 2;
  }

  pairs.discordant = pairs.caseExposedControlUnexposed + pairs.caseUnexposedControlExposed;
  pairs.concordant = pairs.bothExposed + pairs.neitherExposed;
  const warnings = exclusions.sets.length
    ? [`${exclusions.sets.length} matched set${exclusions.sets.length === 1 ? " was" : "s were"} excluded under the bounded V0.1 rules.`]
    : [];
  if (!includedSets) warnings.push("No complete 1:1 matched sets remain; an effect cannot be calculated.");
  else if (!pairs.discordant) warnings.push("No discordant pairs remain; the matched odds ratio is unavailable.");

  return {
    schemaVersion: "0.1.0",
    operation: "epi.match.paired.derive",
    input: { ...request },
    kernelInput: {
      caseExposedControlUnexposed: pairs.caseExposedControlUnexposed,
      caseUnexposedControlExposed: pairs.caseUnexposedControlExposed,
      confidenceLevel: request.confidenceLevel,
    },
    pairs,
    totals: {
      sourceRecords: records.length,
      sourceSets: groups.size + missingIdentifierRecords.length,
      includedRecords,
      includedSets,
      excludedRecords,
      excludedSets: exclusions.sets.length,
    },
    exclusions,
    command: `MATCH ${commandField(request.exposureField)} ${commandField(request.outcomeField)} MATCHVAR=${commandField(request.matchField)}`,
    diagnostics: { warnings },
  };
}
