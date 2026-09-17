import type { RecordLinkPlan } from "./epi-ai-recordlink.ts";
import type { RecordLinkCandidateDiagnostics, RecordLinkScoredCandidate } from "./epi-ai-recordlink-analysis.ts";
import type { RecordLinkReviewDecision } from "./epi-ai-recordlink-review.ts";

export const RECORDLINK_PERSON_CLUSTER_VERSION = "0.1.0" as const;

export interface RecordLinkClusterMember {
  source: "sourceA" | "sourceB";
  recordIndex: number;
}

export interface RecordLinkPersonCluster {
  personNumber: number;
  members: RecordLinkClusterMember[];
  candidateNumbers: number[];
}

export interface RecordLinkRejectedEdge {
  candidateNumber: number;
  reason: "source-membership-conflict";
}

export interface RecordLinkPersonClusterResult {
  version: typeof RECORDLINK_PERSON_CLUSTER_VERSION;
  resultName: string;
  sourceRecords: { sourceA: number; sourceB: number };
  acceptedEdges: number;
  rejectedEdges: RecordLinkRejectedEdge[];
  resolvedReviewCandidates: number;
  linkedClusters: number;
  singletonClusters: number;
  totalPersonClusters: number;
  clusters: RecordLinkPersonCluster[];
  governance: {
    deterministic: true;
    conflictAware: true;
    identifiersExposedInOutput: false;
    sourceMutationExecuted: false;
    mergeExecuted: false;
  };
}

interface Edge {
  candidate: RecordLinkScoredCandidate;
  reviewed: boolean;
}

const nodeKey = (source: RecordLinkClusterMember["source"], recordIndex: number): string => `${source}:${recordIndex}`;

/**
 * Builds a deterministic, non-mutating cross-source cluster proposal.
 * Every review candidate must have a conclusive decision before clustering.
 */
export function createRecordLinkPersonClusters(
  plan: RecordLinkPlan,
  diagnostics: RecordLinkCandidateDiagnostics,
  decisions: ReadonlyMap<number, RecordLinkReviewDecision>,
): RecordLinkPersonClusterResult {
  if (diagnostics.resultName.toLocaleLowerCase("en-US") !== plan.resultName.toLocaleLowerCase("en-US")) {
    throw new RangeError("RECORDLINK plan and diagnostics result names do not match.");
  }
  const reviewCandidates = diagnostics.scoredCandidates.filter(({ classification }) => classification === "review");
  const unresolved = reviewCandidates.filter((candidate) => {
    const decision = decisions.get(candidate.candidateNumber);
    return !decision || decision.effectiveClassification === "review";
  });
  if (unresolved.length) {
    throw new RangeError(`Resolve all RECORDLINK review candidates before person clustering; ${unresolved.length} remain unresolved.`);
  }
  for (const [candidateNumber, decision] of decisions) {
    const candidate = diagnostics.scoredCandidates.find((item) => item.candidateNumber === candidateNumber);
    if (!candidate || candidate.classification !== "review" || decision.resultName !== plan.resultName || decision.automaticClassification !== "review") {
      throw new RangeError(`Decision for Candidate ${candidateNumber} does not belong to the active RECORDLINK review queue.`);
    }
  }

  const edges: Edge[] = diagnostics.scoredCandidates.flatMap((candidate) => {
    if (candidate.classification === "match") return [{ candidate, reviewed: false }];
    if (candidate.classification === "review" && decisions.get(candidate.candidateNumber)?.effectiveClassification === "match") {
      return [{ candidate, reviewed: true }];
    }
    return [];
  }).sort((left, right) =>
    right.candidate.totalScore - left.candidate.totalScore
      || Number(left.reviewed) - Number(right.reviewed)
      || left.candidate.candidateNumber - right.candidate.candidateNumber,
  );

  const parents = new Map<string, string>();
  const members = new Map<string, Map<RecordLinkClusterMember["source"], number>>();
  const clusterCandidates = new Map<string, number[]>();
  const addNode = (source: RecordLinkClusterMember["source"], recordIndex: number): void => {
    const key = nodeKey(source, recordIndex);
    parents.set(key, key);
    members.set(key, new Map([[source, recordIndex]]));
    clusterCandidates.set(key, []);
  };
  for (let index = 0; index < diagnostics.sourceARecords; index++) addNode("sourceA", index);
  for (let index = 0; index < diagnostics.sourceBRecords; index++) addNode("sourceB", index);
  const root = (key: string): string => {
    const parent = parents.get(key);
    if (!parent) throw new RangeError("RECORDLINK cluster candidate references a missing source record.");
    if (parent === key) return key;
    const resolved = root(parent);
    parents.set(key, resolved);
    return resolved;
  };
  const rejectedEdges: RecordLinkRejectedEdge[] = [];
  let acceptedEdges = 0;
  for (const { candidate } of edges) {
    const left = root(nodeKey("sourceA", candidate.sourceAIndex));
    const right = root(nodeKey("sourceB", candidate.sourceBIndex));
    if (left === right) continue;
    const leftMembers = members.get(left)!;
    const rightMembers = members.get(right)!;
    if ([...rightMembers.keys()].some((source) => leftMembers.has(source))) {
      rejectedEdges.push({ candidateNumber: candidate.candidateNumber, reason: "source-membership-conflict" });
      continue;
    }
    const keep = left.localeCompare(right, "en-US") <= 0 ? left : right;
    const remove = keep === left ? right : left;
    const keepMembers = members.get(keep)!;
    for (const [source, index] of members.get(remove)!) keepMembers.set(source, index);
    clusterCandidates.set(keep, [...clusterCandidates.get(keep)!, ...clusterCandidates.get(remove)!, candidate.candidateNumber].sort((a, b) => a - b));
    parents.set(remove, keep);
    members.delete(remove);
    clusterCandidates.delete(remove);
    acceptedEdges++;
  }

  const clusters = [...members.entries()]
    .map(([key, sourceMembers]) => ({
      key,
      members: [...sourceMembers.entries()].map(([source, recordIndex]) => ({ source, recordIndex })).sort((a, b) => a.source.localeCompare(b.source, "en-US") || a.recordIndex - b.recordIndex),
      candidateNumbers: clusterCandidates.get(key)!,
    }))
    .sort((left, right) => left.members[0]!.source.localeCompare(right.members[0]!.source, "en-US") || left.members[0]!.recordIndex - right.members[0]!.recordIndex)
    .map(({ members: clusterMembers, candidateNumbers }, index) => ({ personNumber: index + 1, members: clusterMembers, candidateNumbers }));
  const linkedClusters = clusters.filter(({ members: clusterMembers }) => clusterMembers.length > 1).length;
  return {
    version: RECORDLINK_PERSON_CLUSTER_VERSION,
    resultName: plan.resultName,
    sourceRecords: { sourceA: diagnostics.sourceARecords, sourceB: diagnostics.sourceBRecords },
    acceptedEdges,
    rejectedEdges,
    resolvedReviewCandidates: reviewCandidates.length,
    linkedClusters,
    singletonClusters: clusters.length - linkedClusters,
    totalPersonClusters: clusters.length,
    clusters,
    governance: {
      deterministic: true,
      conflictAware: true,
      identifiersExposedInOutput: false,
      sourceMutationExecuted: false,
      mergeExecuted: false,
    },
  };
}
