import type { FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { buildDataQualityReport, type DataQualityReport } from "../forms/data-quality.ts";
import { parseClassicProgram } from "./classic-ast.ts";

export const EPI_AI_QUALITY_PLAN_VERSION = "0.1.0" as const;

export interface EpiAiQualityPlan {
  version: typeof EPI_AI_QUALITY_PLAN_VERSION;
  mode: "profile";
  canonicalSource: "EPIAI QUALITY *";
}

export function buildEpiAiQualityCommand(input: { mode: "profile" }): "EPIAI QUALITY *" { void input; return "EPIAI QUALITY *"; }

export function resolveEpiAiQualityCommand(source: string, fields: readonly FieldDefinition[]): EpiAiQualityPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "EpiAiQualityStatement") throw new RangeError("Select exactly one EPIAI QUALITY command.");
  void fields;
  return { version: EPI_AI_QUALITY_PLAN_VERSION, mode: "profile", canonicalSource: "EPIAI QUALITY *" };
}

export function applyEpiAiQualityProfile(source: MapDataSource, plan: EpiAiQualityPlan): DataQualityReport {
  void plan;
  return buildDataQualityReport(source.formId, { name: source.formName, fields: source.fields }, source.records);
}
