import type { DatasetProvenance } from "../contracts/core.js";
import type { MatchedPairsDerivation, MatchedPairsResult } from "../contracts/engine.js";

export const CLASSIC_MATCH_REVIEW_VERSION = "0.1.0" as const;

export type ClassicMatchReviewDisposition = "browser-reviewed" | "agrees-with-legacy" | "differs-from-legacy";

export interface ClassicMatchReviewInput {
  projectName: string;
  formName: string;
  dataset?: DatasetProvenance;
  derivation: MatchedPairsDerivation;
  result: MatchedPairsResult;
}

export interface ClassicMatchReviewEvidence {
  schemaVersion: typeof CLASSIC_MATCH_REVIEW_VERSION;
  kind: "epi-info-ai.match-review";
  createdAt: string;
  review: {
    reviewer: string;
    reviewedOn: string;
    disposition: ClassicMatchReviewDisposition;
    notes: string;
    parityEffect: "none" | "candidate-agreement" | "candidate-discrepancy";
  };
  context: {
    projectName: string;
    formName: string;
    dataset: DatasetProvenance | null;
    sourceRecords: number;
  };
  execution: {
    command: string;
    planVersion: "classic-match-paired-v0.1.0";
    resultSchemaVersion: MatchedPairsResult["schemaVersion"];
    engine: MatchedPairsResult["engine"];
  };
  aggregateResult: {
    input: MatchedPairsDerivation["input"];
    pairs: MatchedPairsDerivation["pairs"];
    totals: MatchedPairsDerivation["totals"];
    exclusions: Omit<MatchedPairsDerivation["exclusions"], "sets">;
    derivationWarnings: string[];
    calculation: MatchedPairsResult;
  };
  fingerprints: {
    datasetSha256: string | null;
    commandSha256: string;
    aggregateResultSha256: string;
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateClassicMatchReview(
  reviewer: string,
  reviewedOn: string,
  disposition: string,
  notes: string,
): { reviewer: string; reviewedOn: string; disposition: ClassicMatchReviewDisposition; notes: string } {
  const normalizedReviewer = reviewer.trim();
  const normalizedNotes = notes.trim();
  if (!normalizedReviewer) throw new RangeError("Enter the reviewer name or identifier.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn) || Number.isNaN(Date.parse(`${reviewedOn}T00:00:00Z`))) {
    throw new RangeError("Choose a valid review date.");
  }
  if (!(["browser-reviewed", "agrees-with-legacy", "differs-from-legacy"] as const).includes(disposition as ClassicMatchReviewDisposition)) {
    throw new RangeError("Choose a review disposition.");
  }
  if (disposition !== "browser-reviewed" && !normalizedNotes) {
    throw new RangeError("Describe the legacy Epi Info version, comparison run, and any observed difference in the notes.");
  }
  return { reviewer: normalizedReviewer, reviewedOn, disposition: disposition as ClassicMatchReviewDisposition, notes: normalizedNotes };
}

function aggregateMatchResult(input: ClassicMatchReviewInput): ClassicMatchReviewEvidence["aggregateResult"] {
  const { sets: _excludedSetIdentifiers, ...exclusions } = input.derivation.exclusions;
  return {
    input: input.derivation.input,
    pairs: input.derivation.pairs,
    totals: input.derivation.totals,
    exclusions,
    derivationWarnings: [...input.derivation.diagnostics.warnings],
    calculation: input.result,
  };
}

export async function fingerprintClassicMatchReview(
  input: ClassicMatchReviewInput,
): Promise<ClassicMatchReviewEvidence["fingerprints"]> {
  return {
    datasetSha256: input.dataset?.sha256 ?? null,
    commandSha256: await sha256(input.derivation.command),
    aggregateResultSha256: await sha256(canonicalJson(aggregateMatchResult(input))),
  };
}

export async function createClassicMatchReviewEvidence(
  input: ClassicMatchReviewInput,
  reviewInput: { reviewer: string; reviewedOn: string; disposition: string; notes: string },
  now = new Date(),
): Promise<ClassicMatchReviewEvidence> {
  const review = validateClassicMatchReview(reviewInput.reviewer, reviewInput.reviewedOn, reviewInput.disposition, reviewInput.notes);
  const aggregateResult = aggregateMatchResult(input);
  const parityEffect = review.disposition === "agrees-with-legacy"
    ? "candidate-agreement"
    : review.disposition === "differs-from-legacy" ? "candidate-discrepancy" : "none";
  return {
    schemaVersion: CLASSIC_MATCH_REVIEW_VERSION,
    kind: "epi-info-ai.match-review",
    createdAt: now.toISOString(),
    review: { ...review, parityEffect },
    context: {
      projectName: input.projectName,
      formName: input.formName,
      dataset: input.dataset ? { ...input.dataset } : null,
      sourceRecords: input.derivation.totals.sourceRecords,
    },
    execution: {
      command: input.derivation.command,
      planVersion: "classic-match-paired-v0.1.0",
      resultSchemaVersion: input.result.schemaVersion,
      engine: { ...input.result.engine },
    },
    aggregateResult,
    fingerprints: await fingerprintClassicMatchReview(input),
  };
}
