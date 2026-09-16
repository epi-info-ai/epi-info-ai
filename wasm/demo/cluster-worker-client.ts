import type { EpiRecord } from "../app/contracts/core.js";
import type { SpaceTimeClusterPlan } from "../app/programming/epi-ai-space-time-cluster.js";
import type {
  SpaceTimeClusterInferenceResult,
  SpaceTimeClusterProgress,
} from "../app/programming/epi-ai-space-time-cluster-analysis.js";

type ClusterWorkerResponse = { type: "ready" } | ({ type: "progress"; id: number } & SpaceTimeClusterProgress) | {
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

export interface ClusterWorkerResult {
  result: SpaceTimeClusterInferenceResult;
  durationMs: number;
}

interface PendingRequest {
  records: readonly EpiRecord[];
  plan: SpaceTimeClusterPlan;
  maximumResults: number;
  onProgress: ((progress: SpaceTimeClusterProgress) => void) | undefined;
  resolve(value: ClusterWorkerResult): void;
  reject(error: unknown): void;
  cleanUp(): void;
}

let worker: Worker | null = null;
let workerReady = false;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function abortError(): DOMException {
  return new DOMException("The space-time cluster calculation was cancelled.", "AbortError");
}

function rejectPending(error: unknown): void {
  for (const request of pending.values()) {
    request.cleanUp();
    request.reject(error);
  }
  pending.clear();
}

function terminateWorker(error?: Error | DOMException): boolean {
  if (!worker) return false;
  worker.terminate();
  worker = null;
  workerReady = false;
  if (error) rejectPending(error);
  return true;
}

function postRequest(instance: Worker, id: number, request: PendingRequest): void {
  instance.postMessage({ id, records: request.records, plan: request.plan, maximumResults: request.maximumResults });
}

function activeWorker(): Worker {
  if (worker) return worker;
  const instance = new Worker(new URL("./cluster-worker.js?v=1", document.baseURI), {
    type: "module",
    name: "epi-info-space-time-cluster",
  });
  worker = instance;
  instance.addEventListener("message", (event: MessageEvent<ClusterWorkerResponse>) => {
    if (worker !== instance) return;
    if (event.data.type === "ready") {
      workerReady = true;
      for (const [id, request] of pending) postRequest(instance, id, request);
      return;
    }
    const request = pending.get(event.data.id);
    if (!request) return;
    if (event.data.type === "progress") {
      request.onProgress?.({
        completedReplications: event.data.completedReplications,
        totalReplications: event.data.totalReplications,
        fraction: event.data.fraction,
      });
      return;
    }
    pending.delete(event.data.id);
    request.cleanUp();
    if (event.data.ok) request.resolve({ result: event.data.result, durationMs: event.data.durationMs });
    else {
      const error = new Error(event.data.error.message);
      error.name = event.data.error.name;
      request.reject(error);
    }
  });
  instance.addEventListener("error", (event) => {
    if (worker === instance) terminateWorker(new Error(event.message || "The space-time cluster Worker failed."));
  });
  return instance;
}

export function calculateSpaceTimeClustersInWorker(
  records: readonly EpiRecord[],
  plan: SpaceTimeClusterPlan,
  options: { signal?: AbortSignal; maximumResults?: number; onProgress?: (progress: SpaceTimeClusterProgress) => void } = {},
): Promise<ClusterWorkerResult> {
  if (options.signal?.aborted) return Promise.reject(abortError());
  const id = nextRequestId++;
  return new Promise<ClusterWorkerResult>((resolve, reject) => {
    const onAbort = () => terminateWorker(abortError());
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const timeoutId = setTimeout(() => {
      if (pending.has(id)) terminateWorker(new Error("The space-time cluster Worker did not respond within 60 seconds."));
    }, 60_000);
    pending.set(id, {
      records,
      plan,
      maximumResults: options.maximumResults ?? 20,
      onProgress: options.onProgress,
      resolve,
      reject,
      cleanUp: () => {
        clearTimeout(timeoutId);
        options.signal?.removeEventListener("abort", onAbort);
      },
    });
    const instance = activeWorker();
    if (workerReady) postRequest(instance, id, pending.get(id)!);
  });
}

export function cancelSpaceTimeClusterCalculations(): boolean {
  return terminateWorker(abortError());
}
