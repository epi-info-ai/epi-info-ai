import type { StratifiedTable2x2Input, StratifiedTable2x2Result } from "../app/contracts/engine.js";
import { calculateStratifiedTable2x2 } from "./engine.js";

interface StratifiedWorkerRequest {
  id: number;
  input: StratifiedTable2x2Input;
}

type StratifiedWorkerResponse = {
  id: number;
  ok: true;
  result: StratifiedTable2x2Result;
  durationMs: number;
} | {
  id: number;
  ok: false;
  error: { name: string; message: string };
};

const workerScope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<StratifiedWorkerRequest>) => void): void;
  postMessage(message: StratifiedWorkerResponse): void;
};

workerScope.addEventListener("message", (event) => {
  const started = performance.now();
  try {
    const result = calculateStratifiedTable2x2(event.data.input);
    workerScope.postMessage({
      id: event.data.id,
      ok: true,
      result,
      durationMs: performance.now() - started,
    });
  } catch (error) {
    workerScope.postMessage({
      id: event.data.id,
      ok: false,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});
