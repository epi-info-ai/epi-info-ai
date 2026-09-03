import { env, pipeline } from "@huggingface/transformers";
import type { EpiAssistRunMetadata } from "../app/contracts/assistant.ts";
import type { EpiAssistContext } from "../app/contracts/assistant.ts";
import { resolveEpiAssistFrequencyIntent, type EpiAssistFrequencyIntent } from "../app/assistant/intent.ts";
import { epiAssistModel, type EpiAssistModelKey } from "../app/assistant/models.ts";

const MODEL_REVISION = "main";
const RUNTIME_VERSION = "3.7.5";
const SYSTEM_PROMPT_VERSION = "epi-assist-system-v2";
const TOOL_SCHEMA_VERSION = "epi-assist-tools-v3";
const MAX_NEW_TOKENS = 360;
const SYSTEM_PROMPT = "You are Epi Assist inside Epi Info AI. Use only the supplied aggregate context and call one or more supplied tools that match the request. Call every requested tool separately. Use exact field enum values. The phrase 'show X distribution by Y' means call run_frequency with field_name X and stratify_by Y; both arguments are required for that request. Do not calculate results, invent fields, change data, emit code, or answer with ordinary prose.";
type WorkerRequest = { type: "load"; modelKey: EpiAssistModelKey } | { type: "generate"; modelKey: EpiAssistModelKey; prompt: string; context: unknown };
type GraniteTokenizer = {
  apply_chat_template: (messages: Array<{ role: string; content: string }>, options: Record<string, unknown>) => unknown;
};
type GraniteGenerator = ((prompt: string, options: Record<string, unknown>) => Promise<unknown>) & { tokenizer: GraniteTokenizer; dispose?: () => Promise<void> };

env.allowLocalModels = false;
env.useBrowserCache = true;

let generator: GraniteGenerator | null = null;
let loadedModelKey: EpiAssistModelKey | null = null;

function send(type: string, detail: Record<string, unknown> = {}): void {
  self.postMessage({ type, ...detail });
}

async function loadModel(modelKey: EpiAssistModelKey): Promise<GraniteGenerator> {
  if (generator && loadedModelKey === modelKey) return generator;
  if (generator?.dispose) await generator.dispose();
  generator = null;
  loadedModelKey = null;
  const selected = epiAssistModel(modelKey);
  if (selected.device === "webgpu" && !("gpu" in navigator)) throw new Error("WebGPU is not available in this browser. Choose the CPU compatibility model.");
  send("status", { message: "Downloading or opening cached Granite model files…" });
  const createPipeline = pipeline as unknown as (...arguments_: unknown[]) => Promise<GraniteGenerator>;
  generator = await createPipeline("text-generation", selected.modelId, {
    revision: MODEL_REVISION,
    device: selected.device,
    dtype: selected.dtype,
    progress_callback: (progress: { status?: string; file?: string; progress?: number }) => send("progress", progress),
  });
  loadedModelKey = selected.key;
  send("ready", { model: selected.modelId, modelKey: selected.key, label: selected.label });
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

function toolDefinitions(context: unknown, frequencyIntent: EpiAssistFrequencyIntent | null): unknown[] {
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
          properties: {
            field_name: { type: "string", enum: frequencyIntent ? [frequencyIntent.fieldName] : fieldNames },
            stratify_by: { type: "string", enum: frequencyIntent ? [frequencyIntent.stratifyBy] : fieldNames, description: "Field used for STRATAVAR. For 'X distribution by Y', X is field_name and Y is stratify_by." },
          },
          required: frequencyIntent ? ["field_name", "stratify_by"] : ["field_name"],
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
      const selected = epiAssistModel(event.data.modelKey);
      const model = await loadModel(selected.key);
      if (event.data.type === "load") return;
      send("status", { message: "Granite is preparing a local proposal…" });
      const context = event.data.context as EpiAssistContext;
      const frequencyIntent = resolveEpiAssistFrequencyIntent(event.data.prompt, context);
      const groundedIntent = frequencyIntent
        ? `\n\nHOST-GROUNDED REQUEST SHAPE (field names validated against the current form):\nCall run_frequency with field_name=${JSON.stringify(frequencyIntent.fieldName)} and stratify_by=${JSON.stringify(frequencyIntent.stratifyBy)}.`
        : "";
      const user = `${event.data.prompt}\n\nCURRENT AGGREGATE CONTEXT:\n${JSON.stringify(event.data.context)}${groundedIntent}`;
      const rendered = model.tokenizer.apply_chat_template([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: user },
      ], { tools: toolDefinitions(event.data.context, frequencyIntent), tokenize: false, add_generation_prompt: true });
      if (typeof rendered !== "string") throw new Error("Granite's tool-aware chat template did not render text.");
      const result = await model(rendered, { max_new_tokens: MAX_NEW_TOKENS, do_sample: false, return_full_text: false });
      const response = resultText(result);
      if (!response) throw new Error("Granite returned an empty response.");
      const metadata: EpiAssistRunMetadata = {
        schemaVersion: "1.0.0",
        model: { id: selected.modelId, revision: MODEL_REVISION, device: selected.device, dtype: selected.dtype },
        runtime: { name: "transformers.js", version: RUNTIME_VERSION },
        prompt: { systemVersion: SYSTEM_PROMPT_VERSION, system: SYSTEM_PROMPT, user: event.data.prompt },
        toolSchemaVersion: TOOL_SCHEMA_VERSION,
        contextVersion: 1,
        generation: { maxNewTokens: MAX_NEW_TOKENS, doSample: false, returnFullText: false },
      };
      send("result", { response, metadata });
    } catch (error) {
      send("error", { message: error instanceof Error ? error.message : String(error) });
    }
  })();
});
