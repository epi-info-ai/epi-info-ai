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
