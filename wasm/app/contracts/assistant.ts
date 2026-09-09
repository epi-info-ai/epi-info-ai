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

export type EpiAssistProviderId = "local-granite" | "openai" | "anthropic";

export interface EpiAssistGatewayRequest {
  schemaVersion: "1.0.0";
  provider: Exclude<EpiAssistProviderId, "local-granite">;
  modelAlias: "chatgpt" | "claude";
  prompt: string;
  context: EpiAssistContext;
}

export interface EpiAssistGatewayResponse {
  schemaVersion: "1.0.0";
  provider: Exclude<EpiAssistProviderId, "local-granite">;
  model: { id: string; revision: string };
  requestId: string;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown> | string }>;
  audit: {
    systemVersion: string;
    toolSchemaVersion: string;
  };
}

export interface EpiAssistRunMetadata {
  schemaVersion: "1.0.0";
  provider?: { id: EpiAssistProviderId; mode: "local" | "gateway" };
  model: {
    id: string;
    revision: string;
    device: "webgpu" | "wasm" | "managed";
    dtype: "fp16" | "q4" | "provider-managed";
  };
  runtime: { name: string; version: string };
  prompt: { systemVersion: string; system: string; user: string };
  toolSchemaVersion: string;
  contextVersion: typeof EPI_ASSIST_CONTEXT_VERSION;
  generation: Record<string, string | number | boolean>;
  requestId?: string;
}
