import type { MatchedPairsResult } from "../app/contracts/engine.js";

type MatchedWorkerResponse = { type: "ready" } | {
  type: "result";
  id: number;
  ok: true;
  result: MatchedPairsResult;
  durationMs: number;
} | {
  type: "result";
  id: number;
  ok: false;
  error: { name: string; message: string };
};

export interface MatchedWorkerResult {
  result: MatchedPairsResult;
  durationMs: number;
}

interface PendingRequest {
  input: MatchedPairsResult["input"];
  resolve(value: MatchedWorkerResult): void;
  reject(error: unknown): void;
  cleanUp(): void;
}

let worker: Worker | null = null;
let workerReady = false;
let nextRequestId = 1;
const pending = new Map<number, PendingRequest>();

function abortError(): DOMException {
  return new DOMException("The MATCH calculation was cancelled.", "AbortError");
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
  worker = new Worker(new URL("./matched-worker.js?v=1", document.baseURI), {
    type: "module",
    name: "epi-info-match-analysis",
  });
  worker.addEventListener("message", (event: MessageEvent<MatchedWorkerResponse>) => {
    if (event.data.type === "ready") {
      workerReady = true;
      for (const [id, request] of pending) worker?.postMessage({ id, input: request.input });
      return;
    }
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    request.cleanUp();
    if (event.data.ok) request.resolve({ result: event.data.result, durationMs: event.data.durationMs });
    else {
      const error = new Error(event.data.error.message);
      error.name = event.data.error.name;
      request.reject(error);
    }
  });
  worker.addEventListener("error", (event) => {
    terminateWorker(new Error(event.message || "The MATCH analysis Worker failed."));
  });
  return worker;
}

export function calculateMatchedPairsInWorker(
  input: MatchedPairsResult["input"],
  options: { signal?: AbortSignal } = {},
): Promise<MatchedWorkerResult> {
  if (options.signal?.aborted) return Promise.reject(abortError());
  const id = nextRequestId++;
  return new Promise<MatchedWorkerResult>((resolve, reject) => {
    const onAbort = () => terminateWorker(abortError());
    options.signal?.addEventListener("abort", onAbort, { once: true });
    const timeoutId = setTimeout(() => {
      if (pending.has(id)) terminateWorker(new Error("The MATCH analysis Worker did not respond within 10 seconds."));
    }, 10_000);
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

export function cancelMatchedCalculations(): boolean {
  return terminateWorker(abortError());
}
