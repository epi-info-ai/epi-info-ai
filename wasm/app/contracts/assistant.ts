import type { FieldType } from "./core.ts";

export const EPI_ASSIST_CONTEXT_VERSION = 1 as const;

export interface EpiAssistFieldSummary {
  name: string;
  prompt: string;
  type: FieldType;
  missing: number;
  missingPercent: number;
  violations: number;
}

export interface EpiAssistContext {
  version: typeof EPI_ASSIST_CONTEXT_VERSION;
  projectName: string;
  formName: string;
  recordCount: number;
  fields: EpiAssistFieldSummary[];
}

export type EpiAssistAction =
  | { kind: "open-data-quality"; fieldNames: string[] }
  | { kind: "run-frequency"; fieldName: string; stratifyBy?: string }
  | { kind: "run-epi-curve"; dateField: string; groupField?: string };

export interface EpiAssistProposal {
  summary: string;
  rationale: string;
  actions: EpiAssistAction[];
}

export interface EpiAssistRunMetadata {
  schemaVersion: "1.0.0";
  model: {
    id: string;
    revision: string;
    device: "webgpu" | "wasm";
    dtype: "fp16" | "q4";
  };
  runtime: { name: "transformers.js"; version: string };
  prompt: { systemVersion: string; system: string; user: string };
  toolSchemaVersion: string;
  contextVersion: typeof EPI_ASSIST_CONTEXT_VERSION;
  generation: { maxNewTokens: number; doSample: false; returnFullText: false };
}
