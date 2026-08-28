import { env, pipeline } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/granite-4.0-350m-ONNX-web";
type WorkerRequest = { type: "load" } | { type: "generate"; prompt: string; context: unknown };
type GraniteTokenizer = {
  apply_chat_template: (messages: Array<{ role: string; content: string }>, options: Record<string, unknown>) => unknown;
};
type GraniteGenerator = ((prompt: string, options: Record<string, unknown>) => Promise<unknown>) & { tokenizer: GraniteTokenizer };

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

function toolDefinitions(context: unknown): unknown[] {
  const fields = typeof context === "object" && context !== null && Array.isArray((context as { fields?: unknown }).fields)
    ? (context as { fields: Array<{ name?: unknown; type?: unknown }> }).fields
    : [];
  const fieldNames = fields.map((field) => field.name).filter((name): name is string => typeof name === "string");
  const dateFields = fields.filter((field) => field.type === "date").map((field) => field.name).filter((name): name is string => typeof name === "string");
  return [
    {
      type: "function",
      function: {
        name: "open_data_quality",
        description: "Open the existing Data Quality report focused on fields with missing or invalid values.",
        parameters: {
          type: "object",
          properties: { field_names: { type: "array", items: { type: "string", enum: fieldNames }, maxItems: 10 } },
          required: ["field_names"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "run_frequency",
        description: "Run the existing Classic Analysis FREQ operation for one current-form field.",
        parameters: {
          type: "object",
          properties: { field_name: { type: "string", enum: fieldNames } },
          required: ["field_name"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "run_epi_curve",
        description: "Generate the existing Visual Dashboard Epi Curve using a Date field and optional grouping field.",
        parameters: {
          type: "object",
          properties: {
            date_field: { type: "string", enum: dateFields },
            group_field: { type: "string", enum: fieldNames },
          },
          required: ["date_field"],
        },
      },
    },
  ];
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void (async () => {
    try {
      const model = await loadModel();
      if (event.data.type === "load") return;
      send("status", { message: "Granite is preparing a local proposal…" });
      const system = "You are Epi Assist inside Epi Info AI. Use only the supplied aggregate context and call one or more supplied tools that match the request. Call every requested tool separately. Use exact field enum values. Do not calculate results, invent fields, change data, emit code, or answer with ordinary prose.";
      const user = `${event.data.prompt}\n\nCURRENT AGGREGATE CONTEXT:\n${JSON.stringify(event.data.context)}`;
      const rendered = model.tokenizer.apply_chat_template([
        { role: "system", content: system },
        { role: "user", content: user },
      ], { tools: toolDefinitions(event.data.context), tokenize: false, add_generation_prompt: true });
      if (typeof rendered !== "string") throw new Error("Granite's tool-aware chat template did not render text.");
      const result = await model(rendered, { max_new_tokens: 360, do_sample: false, return_full_text: false });
      const response = resultText(result);
      if (!response) throw new Error("Granite returned an empty response.");
      send("result", { response });
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : String(error) });
    }
  })();
});
