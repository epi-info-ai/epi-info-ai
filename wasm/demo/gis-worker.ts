import {
  GisContractError,
  validateGisPlanV01,
  type GisPlanV01,
  type GisResultV01,
} from "../app/gis/contracts.ts";
import { inspectGeoJsonInputV01 } from "../app/gis/ingestion.ts";

interface ExecuteRequest {
  type: "execute";
  id: string;
  plan: GisPlanV01;
  inputBytes: ArrayBuffer;
}

type WorkerResponse = { id: string; ok: true; result: GisResultV01 } | { id: string; ok: false; error: { name: string; message: string } };

const workerScope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<ExecuteRequest>) => void): void;
  postMessage(message: WorkerResponse): void;
};

function sha256(bytes: ArrayBuffer): Promise<string> {
  return crypto.subtle.digest("SHA-256", bytes).then((digest) => [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""));
}

function receipt(plan: GisPlanV01, status: GisResultV01["status"], diagnostics: GisResultV01["diagnostics"]): GisResultV01["receipt"] {
  return { schema: "epi-gis-receipt/0.1", planId: plan.id, operation: plan.operation, implementationVersion: "0.1.0", projectRevision: plan.projectRevision, validationStatus: "candidate", terminalStatus: status, diagnostics };
}

workerScope.addEventListener("message", async (event) => {
  const { id } = event.data;
  try {
    const plan = validateGisPlanV01(event.data.plan);
    if (plan.operation !== "gis.dataset.inspect") throw new GisContractError([{ code: "invalid-value", path: "operation", message: "GIS-K02 only executes gis.dataset.inspect" }]);
    const input = plan.inputs[0];
    if (!input) throw new RangeError("The inspect operation requires one input asset.");
    if (input.byteLength !== event.data.inputBytes.byteLength) throw new RangeError("Input byte length does not match the plan.");
    if (await sha256(event.data.inputBytes) !== input.sha256.toLowerCase()) throw new Error("Input SHA-256 does not match the plan.");
    const data = inspectGeoJsonInputV01(event.data.inputBytes, plan);
    const diagnostics = [] as const;
    workerScope.postMessage({ id, ok: true, result: { schema: "epi-gis-result/0.1", planId: plan.id, status: "succeeded", data, outputs: [], diagnostics, receipt: receipt(plan, "succeeded", diagnostics) } });
  } catch (error) {
    workerScope.postMessage({ id, ok: false, error: { name: error instanceof Error ? error.name : "Error", message: error instanceof Error ? error.message : String(error) } });
  }
});
