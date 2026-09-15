import type { MatchedPairsResult } from "../app/contracts/engine.js";
import { calculateMatchedPairs } from "./engine.js";

interface MatchedWorkerRequest {
  id: number;
  input: MatchedPairsResult["input"];
}

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

const workerScope = globalThis as unknown as {
  addEventListener(type: "message", listener: (event: MessageEvent<MatchedWorkerRequest>) => void): void;
  postMessage(message: MatchedWorkerResponse): void;
};

workerScope.addEventListener("message", (event) => {
  const started = performance.now();
  try {
    workerScope.postMessage({
      type: "result",
      id: event.data.id,
      ok: true,
      result: calculateMatchedPairs(event.data.input),
      durationMs: performance.now() - started,
    });
  } catch (error) {
    workerScope.postMessage({
      type: "result",
      id: event.data.id,
      ok: false,
      error: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  }
});

workerScope.postMessage({ type: "ready" });
