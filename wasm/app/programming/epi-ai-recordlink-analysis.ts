import type { EpiRecord, RecordValue } from "../contracts/core.ts";
import type { RecordLinkPlan, RecordLinkSourceDefinition } from "./epi-ai-recordlink.ts";

export const RECORDLINK_CANDIDATE_DIAGNOSTICS_VERSION = "0.1.0" as const;

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
}

export interface RecordLinkCandidateDiagnostics {
  version: typeof RECORDLINK_CANDIDATE_DIAGNOSTICS_VERSION;
  planVersion: RecordLinkPlan["version"];
  resultName: string;
  sourceARecords: number;
  sourceBRecords: number;
  possiblePairs: number;
  candidatePairs: RecordLinkCandidatePair[];
  blockingStages: RecordLinkBlockingStage[];
  reductionPercent: number;
  maximumCandidates: number;
  truth?: RecordLinkTruthDiagnostics;
  governance: {
    comparisonExecuted: false;
    classificationExecuted: false;
    mergeExecuted: false;
    identifiersExposedInOutput: false;
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
  if (plan.truthSource && plan.truthIdA && plan.truthIdB) {
    const truthSource = sourceByName(sources, plan.truthSource, "TRUTH");
    const candidateKeys = new Set(candidatePairs.map(({ sourceAIndex, sourceBIndex }) => `${sourceAIndex}:${sourceBIndex}`));
    const truthKeys = new Set<string>();
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
    blockingStages,
    reductionPercent: reduction(candidatePairs.length, possiblePairs),
    maximumCandidates: plan.maxCandidates,
    ...(truth ? { truth } : {}),
    governance: {
      comparisonExecuted: false,
      classificationExecuted: false,
      mergeExecuted: false,
      identifiersExposedInOutput: false,
    },
  };
}
