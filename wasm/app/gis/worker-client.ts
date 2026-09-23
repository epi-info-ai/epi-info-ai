import {
  GisContractError,
  validateGisPlanV01,
  type GisDatasetInspectResultV01,
  type GisPlanV01,
  type GisResultV01,
} from "./contracts.ts";

export interface GisWorkerOptionsV01 {
  signal?: AbortSignal;
  timeoutMilliseconds?: number;
}

type WorkerResponse = { id: string; ok: true; result: GisResultV01 } | {
  id: string;
  ok: false;
  error: { name: string; message: string };
};

function abortError(): DOMException {
  return new DOMException("The Epi GIS operation was cancelled.", "AbortError");
}

/** The only host-facing execution method in GIS-K02. */
export function inspectGisDatasetInWorker(
  plan: GisPlanV01,
  inputBytes: ArrayBuffer,
  options: GisWorkerOptionsV01 = {},
): Promise<GisResultV01 & { data: GisDatasetInspectResultV01 }> {
  const validatedPlan = validateGisPlanV01(plan);
  if (validatedPlan.operation !== "gis.dataset.inspect") return Promise.reject(new GisContractError([{ code: "invalid-value", path: "operation", message: "GIS-K02 only executes gis.dataset.inspect" }]));
  if (options.signal?.aborted) return Promise.reject(abortError());

  const worker = new Worker(new URL("gis-worker.js?v=1", document.baseURI), {
    type: "module",
    name: "epi-info-gis-kernel",
  });
  const id = crypto.randomUUID();
  const timeout = options.timeoutMilliseconds ?? validatedPlan.limits.timeoutMilliseconds;

  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = (): void => finish(() => reject(abortError()));
    const timeoutId = window.setTimeout(() => finish(() => reject(new Error(`The Epi GIS Worker timed out after ${timeout} milliseconds.`))), timeout);
    const finish = (callback: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      options.signal?.removeEventListener("abort", onAbort);
      worker.terminate();
      callback();
    };
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.id !== id) return;
      if (response.ok) finish(() => resolve(response.result as GisResultV01 & { data: GisDatasetInspectResultV01 }));
      else finish(() => {
        const error = new Error(response.error.message);
        error.name = response.error.name;
        reject(error);
      });
    });
    worker.addEventListener("error", (event) => finish(() => reject(new Error(event.message || "The Epi GIS Worker failed."))));
    options.signal?.addEventListener("abort", onAbort, { once: true });
    worker.postMessage({ type: "execute", id, plan: validatedPlan, inputBytes }, [inputBytes]);
  });
}
