import type { DeletedRecord, EpiRecord, FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { parseClassicProgram } from "./classic-ast.ts";
import { applyClassicSelection, buildClassicSelectionCommand, resolveClassicSelectionCommand, type ClassicSelectionOperator } from "./classic-selection.ts";

export const CLASSIC_UNDELETE_RECORDS_PLAN_VERSION = "0.1.0" as const;
export const CLASSIC_UNDELETE_RECORDS_LIMIT = 50_000;

export type ClassicUndeleteRecordsInput =
  | { all: true }
  | { all: false; field: string; operator: ClassicSelectionOperator; value: string | number | boolean };

export interface ClassicUndeleteRecordsPlan {
  version: typeof CLASSIC_UNDELETE_RECORDS_PLAN_VERSION;
  source: string;
  canonicalSource: string;
  selection: { kind: "all" } | { kind: "comparison"; field: string; fieldType: FieldDefinition["type"]; operator: ClassicSelectionOperator; value: string | number | boolean };
}

export interface ClassicUndeleteRecordsResult {
  formId: string;
  formName: string;
  sourceSnapshot: EpiRecord[];
  archiveSnapshot: DeletedRecord[];
  restoredRecords: EpiRecord[];
  restored: DeletedRecord[];
  remainingDeleted: DeletedRecord[];
  canonicalSource: string;
}

export function buildClassicUndeleteRecordsCommand(input: ClassicUndeleteRecordsInput): string {
  if (input.all) return "UNDELETE *";
  return buildClassicSelectionCommand(input.field, input.operator, input.value).replace(/^SELECT /, "UNDELETE (") + ")";
}

export function resolveClassicUndeleteRecordsCommand(source: string, fields: readonly FieldDefinition[]): ClassicUndeleteRecordsPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "UndeleteStatement") throw new RangeError("Select exactly one UNDELETE RECORDS command.");
  const statement = ast.body[0];
  if (statement.runSilent) throw new RangeError("RUNSILENT is disabled for browser record restoration; explicit review and confirmation are required.");
  if (statement.selection === "all") return {
    version: CLASSIC_UNDELETE_RECORDS_PLAN_VERSION, source, canonicalSource: "UNDELETE *", selection: { kind: "all" },
  };
  const expression = statement.raw.startsWith("(") && statement.raw.endsWith(")") ? statement.raw.slice(1, -1).trim() : statement.raw;
  const selection = resolveClassicSelectionCommand(`SELECT ${expression}`, fields);
  if (selection.kind !== "apply") throw new RangeError("UNDELETE RECORDS requires record criteria or '*'.");
  return {
    version: CLASSIC_UNDELETE_RECORDS_PLAN_VERSION, source,
    canonicalSource: buildClassicUndeleteRecordsCommand({ all: false, field: selection.field, operator: selection.operator, value: selection.value }),
    selection: { kind: "comparison", field: selection.field, fieldType: selection.fieldType, operator: selection.operator, value: selection.value },
  };
}

export function stageClassicUndeleteRecords(base: MapDataSource, deletedRecords: readonly DeletedRecord[], plan: ClassicUndeleteRecordsPlan): ClassicUndeleteRecordsResult {
  const selectionPlan = plan.selection.kind === "all" ? undefined : {
    kind: "apply", version: "0.1.0", astVersion: "1.0.0", source: plan.source,
    canonicalSource: plan.canonicalSource.replace(/^UNDELETE \(/, "SELECT ").replace(/\)$/, ""),
    field: plan.selection.field, fieldType: plan.selection.fieldType, operator: plan.selection.operator, value: plan.selection.value,
  } as const;
  const restored = deletedRecords.filter(({ record }) => !selectionPlan || applyClassicSelection([record], selectionPlan).selectedRecords === 1).map((item) => structuredClone(item));
  if (restored.length > CLASSIC_UNDELETE_RECORDS_LIMIT) throw new RangeError(`UNDELETE RECORDS is limited to ${CLASSIC_UNDELETE_RECORDS_LIMIT.toLocaleString("en-US")} records per reviewed operation.`);
  const restoredIds = new Set(restored.map(({ archiveId }) => archiveId));
  const remainingDeleted = deletedRecords.filter(({ archiveId }) => !restoredIds.has(archiveId)).map((item) => structuredClone(item));
  const restoredRecords = structuredClone(base.records);
  for (const item of [...restored].sort((a, b) => a.originalIndex - b.originalIndex)) {
    restoredRecords.splice(Math.min(item.originalIndex, restoredRecords.length), 0, structuredClone(item.record));
  }
  return {
    formId: base.formId, formName: base.formName, sourceSnapshot: structuredClone(base.records),
    archiveSnapshot: deletedRecords.map((item) => structuredClone(item)), restoredRecords, restored, remainingDeleted, canonicalSource: plan.canonicalSource,
  };
}
