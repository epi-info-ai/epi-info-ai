import type { RecordLinkPlan } from "./epi-ai-recordlink.ts";
import type { RecordLinkCandidateDiagnostics } from "./epi-ai-recordlink-analysis.ts";
import { RECORDLINK_REVIEW_VERSION, type RecordLinkClericalDecision, type RecordLinkReviewDecision, type RecordLinkReviewReason } from "./epi-ai-recordlink-review.ts";

export const RECORDLINK_REVIEW_ARTIFACT_VERSION = 1 as const;
export const RECORDLINK_REVIEW_ARTIFACT_KIND = "epi-info-ai.recordlink-review" as const;

export interface RecordLinkReviewArtifact {
  kind: typeof RECORDLINK_REVIEW_ARTIFACT_KIND;
  schemaVersion: typeof RECORDLINK_REVIEW_ARTIFACT_VERSION;
  reviewVersion: typeof RECORDLINK_REVIEW_VERSION;
  createdAt: string;
  projectName: string;
  plan: { version: string; resultName: string; canonicalSource: string };
  candidateSet: { candidates: number; fingerprint: string };
  decisions: RecordLinkReviewDecision[];
  privacy: { identifiersIncluded: false; recordValuesIncluded: false; normalizedValuesIncluded: false };
}

const decisionValues: readonly RecordLinkClericalDecision[] = ["match", "non-match", "uncertain"];
const reasonValues: readonly RecordLinkReviewReason[] = ["confirmed-agreement", "acceptable-variation", "conflicting-identifiers", "insufficient-evidence", "other"];

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function fingerprintRecordLinkCandidates(plan: RecordLinkPlan, diagnostics: RecordLinkCandidateDiagnostics): Promise<string> {
  const canonical = {
    planVersion: plan.version,
    diagnosticsVersion: diagnostics.version,
    canonicalSource: plan.canonicalSource,
    resultName: diagnostics.resultName,
    sources: [diagnostics.sourceARecords, diagnostics.sourceBRecords],
    possiblePairs: diagnostics.possiblePairs,
    candidates: diagnostics.scoredCandidates.map((candidate) => ({
      candidateNumber: candidate.candidateNumber,
      sourceAIndex: candidate.sourceAIndex,
      sourceBIndex: candidate.sourceBIndex,
      totalScore: candidate.totalScore,
      maximumScore: candidate.maximumScore,
      classification: candidate.classification,
      comparisons: candidate.comparisons.map((comparison) => ({
        kind: comparison.kind,
        sourceAField: comparison.pair.sourceA,
        sourceBField: comparison.pair.sourceB,
        similarity: comparison.similarity,
        contribution: comparison.contribution,
      })),
    })),
  };
  return sha256(JSON.stringify(canonical));
}

export async function createRecordLinkReviewArtifact(
  projectName: string,
  plan: RecordLinkPlan,
  diagnostics: RecordLinkCandidateDiagnostics,
  decisions: ReadonlyMap<number, RecordLinkReviewDecision>,
  createdAt = new Date().toISOString(),
): Promise<RecordLinkReviewArtifact> {
  if (!projectName.trim()) throw new RangeError("RECORDLINK review artifacts require a project name.");
  if (Number.isNaN(Date.parse(createdAt))) throw new RangeError("RECORDLINK review artifact time must be an ISO date/time.");
  return {
    kind: RECORDLINK_REVIEW_ARTIFACT_KIND,
    schemaVersion: RECORDLINK_REVIEW_ARTIFACT_VERSION,
    reviewVersion: RECORDLINK_REVIEW_VERSION,
    createdAt,
    projectName,
    plan: { version: plan.version, resultName: plan.resultName, canonicalSource: plan.canonicalSource },
    candidateSet: { candidates: diagnostics.scoredCandidates.length, fingerprint: await fingerprintRecordLinkCandidates(plan, diagnostics) },
    decisions: [...decisions.values()].sort((left, right) => left.candidateNumber - right.candidateNumber).map((decision) => ({ ...decision })),
    privacy: { identifiersIncluded: false, recordValuesIncluded: false, normalizedValuesIncluded: false },
  };
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("The RECORDLINK review artifact must be a JSON object.");
  return value as Record<string, unknown>;
}

export async function replayRecordLinkReviewArtifact(
  value: unknown,
  projectName: string,
  plan: RecordLinkPlan,
  diagnostics: RecordLinkCandidateDiagnostics,
): Promise<Map<number, RecordLinkReviewDecision>> {
  const artifact = requireObject(value);
  if (artifact.kind !== RECORDLINK_REVIEW_ARTIFACT_KIND || artifact.schemaVersion !== RECORDLINK_REVIEW_ARTIFACT_VERSION) throw new RangeError("This is not a supported Epi Info AI RECORDLINK review artifact.");
  if (artifact.reviewVersion !== RECORDLINK_REVIEW_VERSION) throw new RangeError("The RECORDLINK review artifact uses an incompatible review-contract version.");
  if (artifact.projectName !== projectName) throw new RangeError("The RECORDLINK review artifact belongs to a different project.");
  const artifactPlan = requireObject(artifact.plan);
  if (artifactPlan.version !== plan.version || artifactPlan.resultName !== plan.resultName || artifactPlan.canonicalSource !== plan.canonicalSource) throw new RangeError("The RECORDLINK review artifact does not match the active command plan.");
  const candidateSet = requireObject(artifact.candidateSet);
  const fingerprint = await fingerprintRecordLinkCandidates(plan, diagnostics);
  if (candidateSet.candidates !== diagnostics.scoredCandidates.length || candidateSet.fingerprint !== fingerprint) throw new RangeError("The RECORDLINK review artifact candidate fingerprint does not match the active data and scoring result.");
  const privacy = requireObject(artifact.privacy);
  if (privacy.identifiersIncluded !== false || privacy.recordValuesIncluded !== false || privacy.normalizedValuesIncluded !== false) throw new RangeError("The RECORDLINK review artifact violates the aggregate-only privacy contract.");
  if (!Array.isArray(artifact.decisions)) throw new TypeError("The RECORDLINK review artifact decisions must be an array.");
  const replayed = new Map<number, RecordLinkReviewDecision>();
  for (const rawDecision of artifact.decisions) {
    const decision = requireObject(rawDecision);
    const candidateNumber = decision.candidateNumber;
    if (!Number.isInteger(candidateNumber) || Number(candidateNumber) < 1 || replayed.has(Number(candidateNumber))) throw new RangeError("The RECORDLINK review artifact contains an invalid or duplicate candidate ordinal.");
    const candidate = diagnostics.scoredCandidates.find((item) => item.candidateNumber === candidateNumber);
    if (!candidate || candidate.classification !== "review") throw new RangeError(`Candidate ${candidateNumber} is not in the active RECORDLINK review queue.`);
    if (decision.resultName !== plan.resultName || decision.automaticClassification !== candidate.classification) throw new RangeError(`Candidate ${candidateNumber} does not match the active RECORDLINK classification.`);
    if (!decisionValues.includes(decision.decision as RecordLinkClericalDecision) || !reasonValues.includes(decision.reason as RecordLinkReviewReason)) throw new RangeError(`Candidate ${candidateNumber} contains an unsupported decision or reason.`);
    if (typeof decision.decidedAt !== "string" || Number.isNaN(Date.parse(decision.decidedAt))) throw new RangeError(`Candidate ${candidateNumber} has an invalid decision time.`);
    const typed = decision as unknown as RecordLinkReviewDecision;
    const expectedEffective = typed.decision === "uncertain" ? "review" : typed.decision;
    if (typed.effectiveClassification !== expectedEffective) throw new RangeError(`Candidate ${candidateNumber} has an inconsistent effective classification.`);
    replayed.set(typed.candidateNumber, { ...typed });
  }
  return replayed;
}
