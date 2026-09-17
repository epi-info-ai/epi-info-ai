interface RpcResponse {
  id?: string | number;
  success?: boolean;
  data?: unknown;
}

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

export interface GdalDataset { pointer: number; path: string; type: string; info: object }
export interface GdalDatasetInfo {
  type: string;
  driverName: string;
  bandCount?: number;
  width?: number;
  height?: number;
  projectionWkt?: string;
  coordinateTransform?: number[];
  corners?: number[][];
  layerCount?: number;
  featureCount?: number;
  layers?: Array<{ name: string; featureCount: number }>;
}
export interface GdalOpenedDataset { datasets: GdalDataset[]; errors: string[] }

/** Typed, cancellable client for the single upstream gdal3.js Worker. */
export class GdalWorkerClient {
  readonly worker: Worker;
  private nextId = 1;
  private pending = new Map<string | number, PendingCall>();
  private readonly baseUrl: URL;

  constructor(baseUrl: URL = new URL("./runtime/", import.meta.url)) {
    this.baseUrl = baseUrl;
    this.worker = new Worker(new URL("gdal3.js", baseUrl), { name: "epi-info-gdal-wasm-spike" });
    this.worker.addEventListener("message", (event: MessageEvent<RpcResponse>) => {
      const id = event.data.id;
      if (id === undefined) return;
      const call = this.pending.get(id);
      if (!call) return;
      this.pending.delete(id);
      if (event.data.success) call.resolve(event.data.data);
      else call.reject(new Error(this.errorMessage(event.data.data)));
    });
    this.worker.addEventListener("error", (event) => {
      const location = [event.filename, event.lineno ? `line ${event.lineno}` : "", event.colno ? `column ${event.colno}` : ""].filter(Boolean).join(", ");
      this.failAll(new Error(`${event.message || "The GDAL Worker failed."}${location ? ` (${location})` : ""}`));
    });
    this.worker.addEventListener("messageerror", () => this.failAll(new Error("The browser could not deserialize a message from the GDAL Worker.")));
  }

  async initialize(): Promise<void> {
    const ready = new Promise<unknown>((resolve, reject) => this.pending.set("onload", { resolve, reject }));
    const base = this.baseUrl;
    this.worker.postMessage({
      func: "constructor",
      params: {
        config: {
          useWorker: false,
          paths: {
            wasm: new URL("gdal3WebAssembly.wasm", base).href,
            data: new URL("gdal3WebAssembly.data", base).href,
          },
        },
      },
    });
    await ready;
  }

  call<T>(func: string, ...params: unknown[]): Promise<T> {
    const id = this.nextId++;
    const result = new Promise<T>((resolve, reject) => this.pending.set(id, {
      resolve: (value) => resolve(value as T),
      reject,
    }));
    this.worker.postMessage({ func, params, id });
    return result;
  }

  terminate(reason = "GDAL/WASM processing cancelled."): void {
    this.worker.terminate();
    this.failAll(new Error(reason));
  }

  private failAll(error: Error): void {
    for (const call of this.pending.values()) call.reject(error);
    this.pending.clear();
  }

  private errorMessage(value: unknown): string {
    if (value instanceof Error) return value.message;
    if (value && typeof value === "object" && "message" in value) return String(value.message);
    return typeof value === "string" ? value : "The GDAL Worker rejected the operation.";
  }
}
