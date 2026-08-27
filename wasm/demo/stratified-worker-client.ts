import type { StratifiedTable2x2Input, StratifiedTable2x2Result } from "../app/contracts/engine.js";

interface WorkerSuccess {
  id: number;
  ok: true;
  result: StratifiedTable2x2Result;
  durationMs: number;
}

interface WorkerFailure {
  id: number;
  ok: false;
  error: { name: string; message: string };
}

type WorkerResponse = WorkerSuccess | WorkerFailure;

export interface StratifiedWorkerResult {
  result: StratifiedTable2x2Result;
  durationMs: number;
}

interface PendingRequest {
  resolve(value: StratifiedWorkerResult): void;
  reject(error: unknown): void;
  removeAbortListener(): void;
}

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function abortError(message: string): DOMException {
  return new DOMException(message, "AbortError");
}

function rejectPending(error: unknown): void {
  for (const request of pending.values()) {
    request.removeAbortListener();
    request.reject(error);
  }
  pending.clear();
}

function terminateWorker(error?: Error | DOMException): boolean {
  if (!worker) return false;
  worker.terminate();
  worker = null;
  if (error) rejectPending(error);
  return true;
}

function activeWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./stratified-worker.js", import.meta.url), {
    type: "module",
    name: "epi-info-stratified-analysis",
  });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    request.removeAbortListener();
    if (event.data.ok) {
      request.resolve({ result: event.data.result, durationMs: event.data.durationMs });
    } else {
      const error = new Error(event.data.error.message);
      error.name = event.data.error.name;
      request.reject(error);
    }
  });
  worker.addEventListener("error", (event) => {
    terminateWorker(new Error(event.message || "The stratified-analysis Worker failed."));
  });
  return worker;
}

export function calculateStratifiedTable2x2InWorker(
  input: StratifiedTable2x2Input,
  options: { signal?: AbortSignal } = {},
): Promise<StratifiedWorkerResult> {
  if (options.signal?.aborted) return Promise.reject(abortError("The stratified analysis was cancelled."));
  const id = nextRequestId++;
  return new Promise<StratifiedWorkerResult>((resolve, reject) => {
    const onAbort = () => terminateWorker(abortError("The stratified analysis was cancelled."));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    pending.set(id, {
      resolve,
      reject,
      removeAbortListener: () => options.signal?.removeEventListener("abort", onAbort),
    });
    activeWorker().postMessage({ id, input });
  });
}

export function cancelStratifiedCalculations(): boolean {
  return terminateWorker(abortError("The stratified analysis was cancelled."));
}
