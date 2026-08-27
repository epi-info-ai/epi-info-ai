import type { StratifiedTable2x2Input, StratifiedTable2x2Result } from "../app/contracts/engine.js";

interface WorkerSuccess {
  type: "result";
  id: number;
  ok: true;
  result: StratifiedTable2x2Result;
  durationMs: number;
}

interface WorkerFailure {
  type: "result";
  id: number;
  ok: false;
  error: { name: string; message: string };
}

interface WorkerReady {
  type: "ready";
}

type WorkerResponse = WorkerReady | WorkerSuccess | WorkerFailure;

export interface StratifiedWorkerResult {
  result: StratifiedTable2x2Result;
  durationMs: number;
}

interface PendingRequest {
  input: StratifiedTable2x2Input;
  resolve(value: StratifiedWorkerResult): void;
  reject(error: unknown): void;
  cleanUp(): void;
}

let worker: Worker | null = null;
let workerReady = false;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function abortError(message: string): DOMException {
  return new DOMException(message, "AbortError");
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

function activeWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./stratified-worker.js", import.meta.url), {
    type: "module",
    name: "epi-info-stratified-analysis",
  });
  worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    if (event.data.type === "ready") {
      workerReady = true;
      for (const [id, request] of pending) worker?.postMessage({ id, input: request.input });
      return;
    }
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    request.cleanUp();
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
    const timeoutId = setTimeout(() => {
      if (pending.has(id)) terminateWorker(new Error("The stratified-analysis Worker did not respond within 15 seconds."));
    }, 15_000);
    pending.set(id, {
      input,
      resolve,
      reject,
      cleanUp: () => {
        clearTimeout(timeoutId);
        options.signal?.removeEventListener("abort", onAbort);
      },
    });
    const currentWorker = activeWorker();
    if (workerReady) currentWorker.postMessage({ id, input });
  });
}

export function cancelStratifiedCalculations(): boolean {
  return terminateWorker(abortError("The stratified analysis was cancelled."));
}
