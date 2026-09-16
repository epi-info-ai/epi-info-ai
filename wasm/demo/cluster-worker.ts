import type { EpiRecord } from "../app/contracts/core.js";
import type { SpaceTimeClusterPlan } from "../app/programming/epi-ai-space-time-cluster.js";
import {
  inferSpaceTimeClusters,
  type SpaceTimeClusterInferenceResult,
} from "../app/programming/epi-ai-space-time-cluster-analysis.js";

interface ClusterWorkerRequest {
  id: number;
  records: EpiRecord[];
  plan: SpaceTimeClusterPlan;
  maximumResults: number;
}

type ClusterWorkerResponse = { type: "ready" } | {
  type: "progress";
  id: number;
  completedReplications: number;
  totalReplications: number;
  fraction: number;
} | {
  type: "result";
  id: number;
  ok: true;
  result: SpaceTimeClusterInferenceResult;
  durationMs: number;
} | {
  type: "result";
  id: number;
  ok: false;
  error: { name: string; message: string };
};

const workerScope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<ClusterWorkerRequest>) => void): void;
  postMessage(message: ClusterWorkerResponse): void;
};

workerScope.addEventListener("message", (event) => {
  const { id, records, plan, maximumResults } = event.data;
  const started = performance.now();
  const progressStep = Math.max(1, Math.floor(plan.replications / 100));
  try {
    const result = inferSpaceTimeClusters(records, plan, maximumResults, (progress) => {
      if (progress.completedReplications === 0 || progress.completedReplications === progress.totalReplications || progress.completedReplications % progressStep === 0) {
        workerScope.postMessage({ type: "progress", id, ...progress });
      }
    });
    workerScope.postMessage({ type: "result", id, ok: true, result, durationMs: performance.now() - started });
  } catch (error) {
    workerScope.postMessage({
      type: "result",
      id,
      ok: false,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

workerScope.postMessage({ type: "ready" });
