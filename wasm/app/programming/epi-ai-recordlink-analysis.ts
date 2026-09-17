import type { EpiRecord, RecordValue } from "../contracts/core.ts";
import type { RecordLinkPlan, RecordLinkSourceDefinition } from "./epi-ai-recordlink.ts";

export const RECORDLINK_CANDIDATE_DIAGNOSTICS_VERSION = "0.3.0" as const;

export interface RecordLinkDataSource extends RecordLinkSourceDefinition {
  records: readonly EpiRecord[];
}

export interface RecordLinkCandidatePair {
  sourceAIndex: number;
  sourceBIndex: number;
}

export interface RecordLinkBlockingStage {
  pair: { sourceA: string; sourceB: string };
  candidatePairs: number;
  reductionPercent: number;
}

export interface RecordLinkTruthDiagnostics {
  source: string;
  truthPairs: number;
  retainedTruthPairs: number;
  candidateRecall: number;
  classification: {
    truePositiveMatches: number;
    falsePositiveMatches: number;
    falseNegativeMatches: number;
    truthLinksInReview: number;
    precision: number;
    recall: number;
    f1: number;
  };
}

export type RecordLinkClassification = "match" | "review" | "non-match";

export interface RecordLinkFieldComparison {
  kind: "exact" | "fuzzy";
  pair: { sourceA: string; sourceB: string };
  similarity: number | null;
  passed: boolean;
  contribution: 0 | 1;
  missing: boolean;
}

export interface RecordLinkScoredCandidate extends RecordLinkCandidatePair {
  candidateNumber: number;
  exactMatches: number;
  fuzzyMatches: number;
  totalScore: number;
  maximumScore: number;
  classification: RecordLinkClassification;
  comparisons: RecordLinkFieldComparison[];
}

export interface RecordLinkScoreDistribution {
  score: number;
  candidates: number;
}

export interface RecordLinkCandidateDiagnostics {
  version: typeof RECORDLINK_CANDIDATE_DIAGNOSTICS_VERSION;
  planVersion: RecordLinkPlan["version"];
  resultName: string;
  sourceARecords: number;
  sourceBRecords: number;
  possiblePairs: number;
  candidatePairs: RecordLinkCandidatePair[];
  scoredCandidates: RecordLinkScoredCandidate[];
  scoreDistribution: RecordLinkScoreDistribution[];
  maximumScore: number;
  classificationCounts: Record<RecordLinkClassification, number>;
  blockingStages: RecordLinkBlockingStage[];
  reductionPercent: number;
  maximumCandidates: number;
  truth?: RecordLinkTruthDiagnostics;
  governance: {
    comparisonExecuted: true;
    classificationExecuted: true;
    clericalReviewExecuted: false;
    mergeExecuted: false;
    identifiersExposedInOutput: false;
    normalizedValuesExposedInOutput: false;
  };
}

function sourceByName(sources: readonly RecordLinkDataSource[], requested: string, role: string): RecordLinkDataSource {
  const matches = sources.filter(({ id }) => id.toLocaleLowerCase("en-US") === requested.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(`${requested} is not an unambiguous ${role} data source.`);
  return matches[0]!;
}

function normalized(value: RecordValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).normalize("NFKC").trim().toLocaleLowerCase("en-US");
  return text.length ? text : null;
}

function normalizedFuzzyText(value: RecordValue | undefined): string | null {
  const text = normalized(value);
  if (text === null) return null;
  const collapsed = text.replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  return collapsed.length ? collapsed : null;
}

/** Deterministic Jaro-Winkler similarity in [0, 1], with the conventional 0.7 prefix gate. */
export function jaroWinklerSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  const matchDistance = Math.max(0, Math.floor(Math.max(leftCharacters.length, rightCharacters.length) / 2) - 1);
  const leftMatches = new Array<boolean>(leftCharacters.length).fill(false);
  const rightMatches = new Array<boolean>(rightCharacters.length).fill(false);
  let matches = 0;
  for (let leftIndex = 0; leftIndex < leftCharacters.length; leftIndex++) {
    const start = Math.max(0, leftIndex - matchDistance);
    const end = Math.min(leftIndex + matchDistance + 1, rightCharacters.length);
    for (let rightIndex = start; rightIndex < end; rightIndex++) {
      if (rightMatches[rightIndex] || leftCharacters[leftIndex] !== rightCharacters[rightIndex]) continue;
      leftMatches[leftIndex] = true;
      rightMatches[rightIndex] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  const matchedLeft = leftCharacters.filter((_, index) => leftMatches[index]);
  const matchedRight = rightCharacters.filter((_, index) => rightMatches[index]);
  let transpositions = 0;
  for (let index = 0; index < matches; index++) if (matchedLeft[index] !== matchedRight[index]) transpositions++;
  const jaro = (matches / leftCharacters.length + matches / rightCharacters.length + (matches - transpositions / 2) / matches) / 3;
  if (jaro <= 0.7) return jaro;
  let prefix = 0;
  while (prefix < Math.min(4, leftCharacters.length, rightCharacters.length) && leftCharacters[prefix] === rightCharacters[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function compareCandidate(
  plan: RecordLinkPlan,
  sourceA: RecordLinkDataSource,
  sourceB: RecordLinkDataSource,
  pair: RecordLinkCandidatePair,
  candidateNumber: number,
): RecordLinkScoredCandidate {
  const recordA = sourceA.records[pair.sourceAIndex]!;
  const recordB = sourceB.records[pair.sourceBIndex]!;
  const exact = plan.exactPairs.map<RecordLinkFieldComparison>((fieldPair) => {
    const valueA = normalized(recordA[fieldPair.sourceA]);
    const valueB = normalized(recordB[fieldPair.sourceB]);
    const missing = valueA === null || valueB === null;
    const passed = !missing && valueA === valueB;
    return { kind: "exact", pair: { ...fieldPair }, similarity: missing ? null : passed ? 1 : 0, passed, contribution: passed ? 1 : 0, missing };
  });
  const fuzzy = plan.fuzzyPairs.map<RecordLinkFieldComparison>((fieldPair) => {
    const valueA = normalizedFuzzyText(recordA[fieldPair.sourceA]);
    const valueB = normalizedFuzzyText(recordB[fieldPair.sourceB]);
    const missing = valueA === null || valueB === null;
    const similarity = missing ? null : jaroWinklerSimilarity(valueA, valueB);
    const passed = similarity !== null && similarity >= plan.fuzzyThreshold;
    return { kind: "fuzzy", pair: { ...fieldPair }, similarity, passed, contribution: passed ? 1 : 0, missing };
  });
  const comparisons = [...exact, ...fuzzy];
  const totalScore = comparisons.reduce((sum, { contribution }) => sum + contribution, 0);
  const classification: RecordLinkClassification = totalScore >= plan.matchThreshold
    ? "match"
    : totalScore >= plan.reviewThreshold ? "review" : "non-match";
  return {
    ...pair,
    candidateNumber,
    exactMatches: exact.filter(({ passed }) => passed).length,
    fuzzyMatches: fuzzy.filter(({ passed }) => passed).length,
    totalScore,
    maximumScore: comparisons.length,
    classification,
    comparisons,
  };
}

function uniqueIds(source: RecordLinkDataSource, field: string, role: string): Map<string, number> {
  const result = new Map<string, number>();
  source.records.forEach((record, index) => {
    const value = normalized(record[field]);
    if (value === null) throw new RangeError(`${role} ${field} is missing in record ${index + 1}.`);
    if (result.has(value)) throw new RangeError(`${role} ${field} must uniquely identify records; duplicate value found at record ${index + 1}.`);
    result.set(value, index);
  });
  return result;
}

const reduction = (retained: number, possible: number): number => possible === 0 ? 0 : (1 - retained / possible) * 100;

export function generateRecordLinkCandidateDiagnostics(
  plan: RecordLinkPlan,
  sources: readonly RecordLinkDataSource[],
): RecordLinkCandidateDiagnostics {
  const sourceA = sourceByName(sources, plan.sourceA, "SOURCEA");
  const sourceB = sourceByName(sources, plan.sourceB, "SOURCEB");
  const idsA = uniqueIds(sourceA, plan.idA, "SOURCEA IDA");
  const idsB = uniqueIds(sourceB, plan.idB, "SOURCEB IDB");
  const possiblePairs = sourceA.records.length * sourceB.records.length;
  if (!Number.isSafeInteger(possiblePairs)) throw new RangeError("RECORDLINK source pair space exceeds the browser's safe integer range.");
  let candidatePairs: RecordLinkCandidatePair[] = [];
  const firstBlock = plan.blockPairs[0]!;
  for (let sourceAIndex = 0; sourceAIndex < sourceA.records.length; sourceAIndex++) {
    for (let sourceBIndex = 0; sourceBIndex < sourceB.records.length; sourceBIndex++) {
      const valueA = normalized(sourceA.records[sourceAIndex]![firstBlock.sourceA]);
      const valueB = normalized(sourceB.records[sourceBIndex]![firstBlock.sourceB]);
      if (valueA === null || valueB === null || valueA !== valueB) continue;
      candidatePairs.push({ sourceAIndex, sourceBIndex });
      if (candidatePairs.length > plan.maxCandidates) {
        throw new RangeError(`RECORDLINK blocking retained more than ${plan.maxCandidates.toLocaleString("en-US")} candidate pairs at ${firstBlock.sourceA}:${firstBlock.sourceB}, exceeding MAXCANDIDATES=${plan.maxCandidates.toLocaleString("en-US")}. Refine BLOCK before comparison.`);
      }
    }
  }
  const blockingStages: RecordLinkBlockingStage[] = [{
    pair: { ...firstBlock }, candidatePairs: candidatePairs.length, reductionPercent: reduction(candidatePairs.length, possiblePairs),
  }];
  for (const pair of plan.blockPairs.slice(1)) {
    candidatePairs = candidatePairs.filter(({ sourceAIndex, sourceBIndex }) => {
      const valueA = normalized(sourceA.records[sourceAIndex]![pair.sourceA]);
      const valueB = normalized(sourceB.records[sourceBIndex]![pair.sourceB]);
      return valueA !== null && valueB !== null && valueA === valueB;
    });
    blockingStages.push({ pair: { ...pair }, candidatePairs: candidatePairs.length, reductionPercent: reduction(candidatePairs.length, possiblePairs) });
  }

  let truth: RecordLinkTruthDiagnostics | undefined;
  const truthKeys = new Set<string>();
  if (plan.truthSource && plan.truthIdA && plan.truthIdB) {
    const truthSource = sourceByName(sources, plan.truthSource, "TRUTH");
    const candidateKeys = new Set(candidatePairs.map(({ sourceAIndex, sourceBIndex }) => `${sourceAIndex}:${sourceBIndex}`));
    for (const [index, record] of truthSource.records.entries()) {
      const truthA = normalized(record[plan.truthIdA]);
      const truthB = normalized(record[plan.truthIdB]);
      if (truthA === null || truthB === null) throw new RangeError(`TRUTH identifiers are missing in record ${index + 1}.`);
      const sourceAIndex = idsA.get(truthA);
      const sourceBIndex = idsB.get(truthB);
      if (sourceAIndex === undefined || sourceBIndex === undefined) throw new RangeError(`TRUTH record ${index + 1} references an identifier absent from SOURCEA or SOURCEB.`);
      const key = `${sourceAIndex}:${sourceBIndex}`;
      if (truthKeys.has(key)) throw new RangeError(`TRUTH contains a duplicate link at record ${index + 1}.`);
      truthKeys.add(key);
    }
    const retainedTruthPairs = [...truthKeys].filter((key) => candidateKeys.has(key)).length;
    truth = {
      source: truthSource.id,
      truthPairs: truthKeys.size,
      retainedTruthPairs,
      candidateRecall: truthKeys.size === 0 ? 1 : retainedTruthPairs / truthKeys.size,
      classification: { truePositiveMatches: 0, falsePositiveMatches: 0, falseNegativeMatches: 0, truthLinksInReview: 0, precision: 0, recall: 0, f1: 0 },
    };
  }

  const scoredCandidates = candidatePairs.map((pair, index) => compareCandidate(plan, sourceA, sourceB, pair, index + 1));
  const scoreCounts = new Map<number, number>();
  for (const candidate of scoredCandidates) scoreCounts.set(candidate.totalScore, (scoreCounts.get(candidate.totalScore) ?? 0) + 1);
  const scoreDistribution = [...scoreCounts.entries()]
    .sort(([left], [right]) => right - left)
    .map(([score, candidates]) => ({ score, candidates }));
  const classificationCounts: Record<RecordLinkClassification, number> = { match: 0, review: 0, "non-match": 0 };
  for (const candidate of scoredCandidates) classificationCounts[candidate.classification]++;
  if (truth) {
    const automaticMatches = scoredCandidates.filter(({ classification }) => classification === "match");
    const truePositiveMatches = automaticMatches.filter(({ sourceAIndex, sourceBIndex }) => truthKeys.has(`${sourceAIndex}:${sourceBIndex}`)).length;
    const falsePositiveMatches = automaticMatches.length - truePositiveMatches;
    const falseNegativeMatches = truth.truthPairs - truePositiveMatches;
    const truthLinksInReview = scoredCandidates.filter(({ classification, sourceAIndex, sourceBIndex }) => classification === "review" && truthKeys.has(`${sourceAIndex}:${sourceBIndex}`)).length;
    const precision = automaticMatches.length === 0 ? (truth.truthPairs === 0 ? 1 : 0) : truePositiveMatches / automaticMatches.length;
    const recall = truth.truthPairs === 0 ? 1 : truePositiveMatches / truth.truthPairs;
    truth.classification = {
      truePositiveMatches,
      falsePositiveMatches,
      falseNegativeMatches,
      truthLinksInReview,
      precision,
      recall,
      f1: precision + recall === 0 ? 0 : 2 * precision * recall / (precision + recall),
    };
  }

  return {
    version: RECORDLINK_CANDIDATE_DIAGNOSTICS_VERSION,
    planVersion: plan.version,
    resultName: plan.resultName,
    sourceARecords: sourceA.records.length,
    sourceBRecords: sourceB.records.length,
    possiblePairs,
    candidatePairs,
    scoredCandidates,
    scoreDistribution,
    maximumScore: plan.exactPairs.length + plan.fuzzyPairs.length,
    classificationCounts,
    blockingStages,
    reductionPercent: reduction(candidatePairs.length, possiblePairs),
    maximumCandidates: plan.maxCandidates,
    ...(truth ? { truth } : {}),
    governance: {
      comparisonExecuted: true,
      classificationExecuted: true,
      clericalReviewExecuted: false,
      mergeExecuted: false,
      identifiersExposedInOutput: false,
      normalizedValuesExposedInOutput: false,
    },
  };
}
