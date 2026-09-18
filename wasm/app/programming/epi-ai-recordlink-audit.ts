import type { RecordLinkPlan } from "./epi-ai-recordlink.ts";
import type { RecordLinkCandidateDiagnostics } from "./epi-ai-recordlink-analysis.ts";
import { createRecordLinkPersonClusters, RECORDLINK_PERSON_CLUSTER_VERSION, type RecordLinkPersonClusterResult } from "./epi-ai-recordlink-cluster.ts";
import { fingerprintRecordLinkCandidates, replayRecordLinkReviewArtifact } from "./epi-ai-recordlink-review-artifact.ts";
import { RECORDLINK_REVIEW_VERSION, type RecordLinkReviewDecision } from "./epi-ai-recordlink-review.ts";

export const RECORDLINK_AUDIT_ARTIFACT_KIND = "epi-info-ai.recordlink-audit" as const;
export const RECORDLINK_AUDIT_ARTIFACT_VERSION = 1 as const;

export interface RecordLinkPersonAuditRow {
  personId: string;
  memberCount: number;
  linked: boolean;
  candidateNumbers: number[];
}

export interface RecordLinkMembershipAuditRow {
  personId: string;
  sourceRole: "sourceA" | "sourceB";
  sourceRecordOrdinal: number;
}

export interface RecordLinkAuditRow {
  candidateNumber: number;
  personId: string;
  score: number;
  maximumScore: number;
  authority: "automatic-threshold" | "clerical-review";
  decisionReason: RecordLinkReviewDecision["reason"] | null;
  decidedAt: string | null;
}

export interface RecordLinkAuditArtifact {
  kind: typeof RECORDLINK_AUDIT_ARTIFACT_KIND;
  schemaVersion: typeof RECORDLINK_AUDIT_ARTIFACT_VERSION;
  clusterVersion: typeof RECORDLINK_PERSON_CLUSTER_VERSION;
  reviewVersion: typeof RECORDLINK_REVIEW_VERSION;
  createdAt: string;
  projectName: string;
  plan: { version: string; resultName: string; canonicalSource: string };
  candidateSet: { candidates: number; fingerprint: string };
  auditFingerprint: string;
  personTable: RecordLinkPersonAuditRow[];
  membershipTable: RecordLinkMembershipAuditRow[];
  linkTable: RecordLinkAuditRow[];
  rejectedLinkTable: { candidateNumber: number; reason: "source-membership-conflict" }[];
  decisionTable: RecordLinkReviewDecision[];
  privacy: {
    identifiersIncluded: false;
    recordValuesIncluded: false;
    normalizedValuesIncluded: false;
    sourceRecordOrdinalsIncluded: true;
  };
  mutation: { sourceMutationExecuted: false; mergeExecuted: false };
}

const personId = (personNumber: number): string => `P${String(personNumber).padStart(6, "0")}`;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildTables(
  diagnostics: RecordLinkCandidateDiagnostics,
  decisions: ReadonlyMap<number, RecordLinkReviewDecision>,
  clusters: RecordLinkPersonClusterResult,
): Pick<RecordLinkAuditArtifact, "personTable" | "membershipTable" | "linkTable" | "rejectedLinkTable" | "decisionTable"> {
  const personTable = clusters.clusters.map((cluster) => ({
    personId: personId(cluster.personNumber),
    memberCount: cluster.members.length,
    linked: cluster.members.length > 1,
    candidateNumbers: [...cluster.candidateNumbers],
  }));
  const membershipTable = clusters.clusters.flatMap((cluster) => cluster.members.map((member) => ({
    personId: personId(cluster.personNumber),
    sourceRole: member.source,
    sourceRecordOrdinal: member.recordIndex + 1,
  })));
  const personByCandidate = new Map<number, string>();
  for (const cluster of clusters.clusters) for (const candidateNumber of cluster.candidateNumbers) personByCandidate.set(candidateNumber, personId(cluster.personNumber));
  const linkTable = [...personByCandidate.entries()].sort(([left], [right]) => left - right).map<RecordLinkAuditRow>(([candidateNumber, linkedPersonId]) => {
    const candidate = diagnostics.scoredCandidates.find((item) => item.candidateNumber === candidateNumber);
    if (!candidate) throw new RangeError(`Cluster references unavailable Candidate ${candidateNumber}.`);
    const decision = decisions.get(candidateNumber);
    return {
      candidateNumber,
      personId: linkedPersonId,
      score: candidate.totalScore,
      maximumScore: candidate.maximumScore,
      authority: decision ? "clerical-review" : "automatic-threshold",
      decisionReason: decision?.reason ?? null,
      decidedAt: decision?.decidedAt ?? null,
    };
  });
  return {
    personTable,
    membershipTable,
    linkTable,
    rejectedLinkTable: clusters.rejectedEdges.map((edge) => ({ ...edge })),
    decisionTable: [...decisions.values()].sort((left, right) => left.candidateNumber - right.candidateNumber).map((decision) => ({ ...decision })),
  };
}

export async function createRecordLinkAuditArtifact(
  projectName: string,
  plan: RecordLinkPlan,
  diagnostics: RecordLinkCandidateDiagnostics,
  decisions: ReadonlyMap<number, RecordLinkReviewDecision>,
  clusters: RecordLinkPersonClusterResult,
  createdAt = new Date().toISOString(),
): Promise<RecordLinkAuditArtifact> {
  if (!projectName.trim()) throw new RangeError("RECORDLINK audit artifacts require a project name.");
  if (Number.isNaN(Date.parse(createdAt))) throw new RangeError("RECORDLINK audit artifact time must be an ISO date/time.");
  if (clusters.resultName !== plan.resultName || clusters.sourceRecords.sourceA !== diagnostics.sourceARecords || clusters.sourceRecords.sourceB !== diagnostics.sourceBRecords) {
    throw new RangeError("The RECORDLINK cluster proposal does not match the active plan and source counts.");
  }
  const tables = buildTables(diagnostics, decisions, clusters);
  if (tables.membershipTable.length !== diagnostics.sourceARecords + diagnostics.sourceBRecords) throw new RangeError("The RECORDLINK membership audit table does not cover every source record exactly once.");
  const candidateFingerprint = await fingerprintRecordLinkCandidates(plan, diagnostics);
  const auditFingerprint = await sha256(JSON.stringify({ candidateFingerprint, ...tables }));
  return {
    kind: RECORDLINK_AUDIT_ARTIFACT_KIND,
    schemaVersion: RECORDLINK_AUDIT_ARTIFACT_VERSION,
    clusterVersion: RECORDLINK_PERSON_CLUSTER_VERSION,
    reviewVersion: RECORDLINK_REVIEW_VERSION,
    createdAt,
    projectName,
    plan: { version: plan.version, resultName: plan.resultName, canonicalSource: plan.canonicalSource },
    candidateSet: { candidates: diagnostics.scoredCandidates.length, fingerprint: candidateFingerprint },
    auditFingerprint,
    ...tables,
    privacy: { identifiersIncluded: false, recordValuesIncluded: false, normalizedValuesIncluded: false, sourceRecordOrdinalsIncluded: true },
    mutation: { sourceMutationExecuted: false, mergeExecuted: false },
  };
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("The RECORDLINK audit artifact must be a JSON object.");
  return value as Record<string, unknown>;
}

export async function replayRecordLinkAuditArtifact(
  value: unknown,
  projectName: string,
  plan: RecordLinkPlan,
  diagnostics: RecordLinkCandidateDiagnostics,
): Promise<{ artifact: RecordLinkAuditArtifact; decisions: Map<number, RecordLinkReviewDecision>; clusters: RecordLinkPersonClusterResult }> {
  const raw = requireObject(value);
  if (raw.kind !== RECORDLINK_AUDIT_ARTIFACT_KIND || raw.schemaVersion !== RECORDLINK_AUDIT_ARTIFACT_VERSION) throw new RangeError("This is not a supported Epi Info AI RECORDLINK audit artifact.");
  if (raw.clusterVersion !== RECORDLINK_PERSON_CLUSTER_VERSION || raw.reviewVersion !== RECORDLINK_REVIEW_VERSION) throw new RangeError("The RECORDLINK audit artifact uses incompatible contract versions.");
  const privacy = requireObject(raw.privacy);
  if (privacy.identifiersIncluded !== false || privacy.recordValuesIncluded !== false || privacy.normalizedValuesIncluded !== false || privacy.sourceRecordOrdinalsIncluded !== true) throw new RangeError("The RECORDLINK audit artifact violates the reviewed privacy contract.");
  const mutation = requireObject(raw.mutation);
  if (mutation.sourceMutationExecuted !== false || mutation.mergeExecuted !== false) throw new RangeError("A RECORDLINK audit artifact cannot claim source mutation or MERGE execution.");
  if (!Array.isArray(raw.decisionTable) || typeof raw.createdAt !== "string") throw new RangeError("The RECORDLINK audit artifact has invalid decisions or creation time.");
  const planBinding = requireObject(raw.plan);
  const candidateSet = requireObject(raw.candidateSet);
  const decisions = await replayRecordLinkReviewArtifact({
    kind: "epi-info-ai.recordlink-review",
    schemaVersion: 1,
    reviewVersion: RECORDLINK_REVIEW_VERSION,
    createdAt: raw.createdAt,
    projectName: raw.projectName,
    plan: planBinding,
    candidateSet,
    decisions: raw.decisionTable,
    privacy: { identifiersIncluded: false, recordValuesIncluded: false, normalizedValuesIncluded: false },
  }, projectName, plan, diagnostics);
  const clusters = createRecordLinkPersonClusters(plan, diagnostics, decisions);
  const recreated = await createRecordLinkAuditArtifact(projectName, plan, diagnostics, decisions, clusters, raw.createdAt);
  if (raw.auditFingerprint !== recreated.auditFingerprint) throw new RangeError("The RECORDLINK audit-table fingerprint does not match the active data, decisions, and clusters.");
  for (const table of ["personTable", "membershipTable", "linkTable", "rejectedLinkTable", "decisionTable"] as const) {
    if (JSON.stringify(raw[table]) !== JSON.stringify(recreated[table])) throw new RangeError(`The RECORDLINK ${table} does not match its verified reconstruction.`);
  }
  return { artifact: recreated, decisions, clusters };
}
