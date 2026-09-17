import type { RecordValue } from "../contracts/core.ts";
import type { RecordLinkPlan } from "./epi-ai-recordlink.ts";
import type { RecordLinkCandidateDiagnostics, RecordLinkClassification, RecordLinkDataSource, RecordLinkScoredCandidate } from "./epi-ai-recordlink-analysis.ts";

export const RECORDLINK_REVIEW_VERSION = "0.1.0" as const;

export type RecordLinkClericalDecision = "match" | "non-match" | "uncertain";
export type RecordLinkReviewReason = "confirmed-agreement" | "acceptable-variation" | "conflicting-identifiers" | "insufficient-evidence" | "other";

export interface RecordLinkReviewField {
  role: "identifier" | "blocking" | "exact" | "fuzzy";
  sourceAField: string;
  sourceBField: string;
  sourceAValue: string;
  sourceBValue: string;
  normalizedSourceAValue: string;
  normalizedSourceBValue: string;
  similarity: number | null;
  contribution: 0 | 1 | null;
}

export interface RecordLinkReviewCase {
  version: typeof RECORDLINK_REVIEW_VERSION;
  resultName: string;
  candidateNumber: number;
  automaticClassification: RecordLinkClassification;
  totalScore: number;
  maximumScore: number;
  sourceALabel: string;
  sourceBLabel: string;
  fields: RecordLinkReviewField[];
}

export interface RecordLinkReviewDecision {
  version: typeof RECORDLINK_REVIEW_VERSION;
  resultName: string;
  candidateNumber: number;
  automaticClassification: RecordLinkClassification;
  decision: RecordLinkClericalDecision;
  effectiveClassification: RecordLinkClassification;
  reason: RecordLinkReviewReason;
  decidedAt: string;
}

const normalized = (value: RecordValue | undefined, fuzzy = false): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).normalize("NFKC").trim().toLocaleLowerCase("en-US");
  if (!text.length) return null;
  if (!fuzzy) return text;
  const collapsed = text.replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
  return collapsed.length ? collapsed : null;
};

const display = (value: RecordValue | undefined): string => value === null || value === undefined || String(value).length === 0 ? "(missing)" : String(value);
const normalizedDisplay = (value: RecordValue | undefined, fuzzy = false): string => normalized(value, fuzzy) ?? "(missing)";

function sourceByName(sources: readonly RecordLinkDataSource[], name: string): RecordLinkDataSource {
  const matches = sources.filter(({ id }) => id.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(`${name} is not an unambiguous RECORDLINK review source.`);
  return matches[0]!;
}

function candidateByNumber(diagnostics: RecordLinkCandidateDiagnostics, candidateNumber: number): RecordLinkScoredCandidate {
  if (!Number.isInteger(candidateNumber) || candidateNumber < 1) throw new RangeError("RECORDLINK review candidate number must be a positive integer.");
  const candidate = diagnostics.scoredCandidates.find((item) => item.candidateNumber === candidateNumber);
  if (!candidate) throw new RangeError(`RECORDLINK candidate ${candidateNumber} is not available in this result.`);
  if (candidate.classification !== "review") throw new RangeError(`RECORDLINK candidate ${candidateNumber} is classified ${candidate.classification}; V0.5 clerical review is limited to the review queue.`);
  return candidate;
}

export function createRecordLinkReviewCase(
  plan: RecordLinkPlan,
  diagnostics: RecordLinkCandidateDiagnostics,
  sources: readonly RecordLinkDataSource[],
  candidateNumber: number,
): RecordLinkReviewCase {
  if (diagnostics.resultName.toLocaleLowerCase("en-US") !== plan.resultName.toLocaleLowerCase("en-US")) throw new RangeError("RECORDLINK plan and diagnostics result names do not match.");
  const sourceA = sourceByName(sources, plan.sourceA);
  const sourceB = sourceByName(sources, plan.sourceB);
  const candidate = candidateByNumber(diagnostics, candidateNumber);
  const recordA = sourceA.records[candidate.sourceAIndex];
  const recordB = sourceB.records[candidate.sourceBIndex];
  if (!recordA || !recordB) throw new RangeError(`RECORDLINK candidate ${candidateNumber} references a source record that is no longer available.`);

  const fields: RecordLinkReviewField[] = [{
    role: "identifier",
    sourceAField: plan.idA,
    sourceBField: plan.idB,
    sourceAValue: display(recordA[plan.idA]),
    sourceBValue: display(recordB[plan.idB]),
    normalizedSourceAValue: normalizedDisplay(recordA[plan.idA]),
    normalizedSourceBValue: normalizedDisplay(recordB[plan.idB]),
    similarity: null,
    contribution: null,
  }];
  for (const pair of plan.blockPairs) {
    fields.push({
      role: "blocking", sourceAField: pair.sourceA, sourceBField: pair.sourceB,
      sourceAValue: display(recordA[pair.sourceA]), sourceBValue: display(recordB[pair.sourceB]),
      normalizedSourceAValue: normalizedDisplay(recordA[pair.sourceA]), normalizedSourceBValue: normalizedDisplay(recordB[pair.sourceB]),
      similarity: null, contribution: null,
    });
  }
  for (const comparison of candidate.comparisons) {
    fields.push({
      role: comparison.kind,
      sourceAField: comparison.pair.sourceA,
      sourceBField: comparison.pair.sourceB,
      sourceAValue: display(recordA[comparison.pair.sourceA]),
      sourceBValue: display(recordB[comparison.pair.sourceB]),
      normalizedSourceAValue: normalizedDisplay(recordA[comparison.pair.sourceA], comparison.kind === "fuzzy"),
      normalizedSourceBValue: normalizedDisplay(recordB[comparison.pair.sourceB], comparison.kind === "fuzzy"),
      similarity: comparison.similarity,
      contribution: comparison.contribution,
    });
  }
  return {
    version: RECORDLINK_REVIEW_VERSION,
    resultName: plan.resultName,
    candidateNumber,
    automaticClassification: candidate.classification,
    totalScore: candidate.totalScore,
    maximumScore: candidate.maximumScore,
    sourceALabel: sourceA.id,
    sourceBLabel: sourceB.id,
    fields,
  };
}

export function createRecordLinkReviewDecision(
  reviewCase: RecordLinkReviewCase,
  decision: RecordLinkClericalDecision,
  reason: RecordLinkReviewReason,
  decidedAt = new Date().toISOString(),
): RecordLinkReviewDecision {
  if (!(["match", "non-match", "uncertain"] as const).includes(decision)) throw new RangeError("Choose Match, Non-match, or Uncertain for the clerical decision.");
  if (!(["confirmed-agreement", "acceptable-variation", "conflicting-identifiers", "insufficient-evidence", "other"] as const).includes(reason)) throw new RangeError("Choose a supported RECORDLINK review reason.");
  if (Number.isNaN(Date.parse(decidedAt))) throw new RangeError("RECORDLINK review decision time must be an ISO date/time.");
  return {
    version: RECORDLINK_REVIEW_VERSION,
    resultName: reviewCase.resultName,
    candidateNumber: reviewCase.candidateNumber,
    automaticClassification: reviewCase.automaticClassification,
    decision,
    effectiveClassification: decision === "uncertain" ? "review" : decision,
    reason,
    decidedAt,
  };
}
