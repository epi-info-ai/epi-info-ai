import { env, pipeline } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/granite-4.0-350m-ONNX-web";
type WorkerRequest = { type: "load" } | { type: "generate"; prompt: string; context: unknown };
type GraniteGenerator = (messages: Array<{ role: string; content: string }>, options: Record<string, unknown>) => Promise<unknown>;

env.allowLocalModels = false;
env.useBrowserCache = true;

let generator: GraniteGenerator | null = null;

function send(type: string, detail: Record<string, unknown> = {}): void {
  self.postMessage({ type, ...detail });
}

async function loadModel(): Promise<GraniteGenerator> {
  if (generator) return generator;
  if (!("gpu" in navigator)) throw new Error("WebGPU is not available in this browser.");
  send("status", { message: "Downloading or opening cached Granite model files…" });
  const createPipeline = pipeline as unknown as (...arguments_: unknown[]) => Promise<GraniteGenerator>;
  generator = await createPipeline("text-generation", MODEL_ID, {
    device: "webgpu",
    dtype: "fp16",
    progress_callback: (progress: { status?: string; file?: string; progress?: number }) => send("progress", progress),
  });
  send("ready", { model: MODEL_ID });
  return generator;
}

function resultText(result: unknown): string {
  if (!Array.isArray(result) || !result.length || typeof result[0] !== "object" || result[0] === null) return "";
  const generated = (result[0] as { generated_text?: unknown }).generated_text;
  if (typeof generated === "string") return generated;
  if (Array.isArray(generated)) {
    const last = generated.at(-1);
    if (last && typeof last === "object" && typeof (last as { content?: unknown }).content === "string") return (last as { content: string }).content;
  }
  return "";
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void (async () => {
    try {
      const model = await loadModel();
      if (event.data.type === "load") return;
      send("status", { message: "Granite is preparing a local proposal…" });
      const system = `You are Epi Assist inside Epi Info AI. Use only the supplied aggregate context. Return JSON only with summary, rationale, and actions. Allowed actions are: {"kind":"open-data-quality","fieldNames":[field names]}, {"kind":"run-frequency","fieldName":"field name"}, and {"kind":"run-epi-curve","dateField":"date field name","groupField":"optional field name"}. Never invent fields, claim statistical validation, change data, or emit code.`;
      const user = `${event.data.prompt}\n\nCURRENT AGGREGATE CONTEXT:\n${JSON.stringify(event.data.context)}`;
      const result = await model([
        { role: "system", content: system },
        { role: "user", content: user },
      ], { max_new_tokens: 420, do_sample: false, return_full_text: false });
      const response = resultText(result);
      if (!response) throw new Error("Granite returned an empty response.");
      send("result", { response });
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : String(error) });
    }
  })();
});
