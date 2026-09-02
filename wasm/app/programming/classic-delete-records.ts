import type { EpiRecord, FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { parseClassicProgram } from "./classic-ast.ts";
import { applyClassicSelection, buildClassicSelectionCommand, resolveClassicSelectionCommand, type ClassicSelectionOperator } from "./classic-selection.ts";

export const CLASSIC_DELETE_RECORDS_PLAN_VERSION = "0.1.0" as const;
export const CLASSIC_DELETE_RECORDS_LIMIT = 50_000;

export type ClassicDeleteRecordsInput =
  | { all: true }
  | { all: false; field: string; operator: ClassicSelectionOperator; value: string | number | boolean };

export interface ClassicDeleteRecordsPlan {
  version: typeof CLASSIC_DELETE_RECORDS_PLAN_VERSION;
  source: string;
  canonicalSource: string;
  selection: { kind: "all" } | { kind: "comparison"; field: string; operator: ClassicSelectionOperator; value: string | number | boolean };
}

export interface ClassicDeleteRecordsResult {
  formId: string;
  formName: string;
  sourceSnapshot: EpiRecord[];
  remainingRecords: EpiRecord[];
  deleted: Array<{ originalIndex: number; record: EpiRecord }>;
  activeRecords: number;
  matchedRecords: number;
  canonicalSource: string;
}

export function buildClassicDeleteRecordsCommand(input: ClassicDeleteRecordsInput): string {
  if (input.all) return "DELETE *";
  return buildClassicSelectionCommand(input.field, input.operator, input.value).replace(/^SELECT /, "DELETE (") + ")";
}

export function resolveClassicDeleteRecordsCommand(source: string, fields: readonly FieldDefinition[]): ClassicDeleteRecordsPlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "DeleteStatement") throw new RangeError("Select exactly one DELETE RECORDS command.");
  const statement = ast.body[0];
  if (statement.target.kind !== "records") throw new RangeError("Select exactly one DELETE RECORDS command.");
  if (statement.runSilent) throw new RangeError("RUNSILENT is disabled for destructive browser commands; explicit review and confirmation are required.");
  if (statement.permanent) throw new RangeError("PERMANENT record deletion is disabled. Use recoverable deletion and the Recycle Bin in this slice.");
  if (statement.saveData) throw new RangeError("SAVEDATA has no reviewed browser equivalent for DELETE RECORDS.");
  if (statement.target.selection === "all") return {
    version: CLASSIC_DELETE_RECORDS_PLAN_VERSION, source, canonicalSource: "DELETE *", selection: { kind: "all" },
  };
  const expression = statement.target.raw.startsWith("(") && statement.target.raw.endsWith(")")
    ? statement.target.raw.slice(1, -1).trim() : statement.target.raw;
  const selection = resolveClassicSelectionCommand(`SELECT ${expression}`, fields);
  if (selection.kind !== "apply" || selection.mode !== "comparison") throw new RangeError("DELETE RECORDS currently requires one reviewed field-to-value comparison or '*'.");
  return {
    version: CLASSIC_DELETE_RECORDS_PLAN_VERSION, source,
    canonicalSource: buildClassicDeleteRecordsCommand({ all: false, field: selection.field, operator: selection.operator, value: selection.value }),
    selection: { kind: "comparison", field: selection.field, operator: selection.operator, value: selection.value },
  };
}

const recordKey = (record: EpiRecord, fields: readonly FieldDefinition[]): string => JSON.stringify(fields.map(({ name }) => record[name] ?? null));

export function stageClassicDeleteRecords(base: MapDataSource, active: MapDataSource, plan: ClassicDeleteRecordsPlan): ClassicDeleteRecordsResult {
  if (base.formId !== active.formId) throw new RangeError("DELETE RECORDS can modify only the active saved project form.");
  const baseSchema = base.fields.map(({ name, type }) => `${name.toLocaleLowerCase("en-US")}:${type}`);
  const activeSchema = active.fields.map(({ name, type }) => `${name.toLocaleLowerCase("en-US")}:${type}`);
  if (baseSchema.length !== activeSchema.length || baseSchema.some((value, index) => value !== activeSchema[index])) {
    throw new RangeError("DELETE RECORDS is unavailable for a RELATE result or another derived table. READ a saved project form first.");
  }
  const comparison = plan.selection.kind === "comparison" ? plan.selection : undefined;
  const matchedActive = !comparison
    ? structuredClone(active.records)
    : (() => {
      const selectionPlan = resolveClassicSelectionCommand(
        plan.canonicalSource.replace(/^DELETE \(/, "SELECT ").replace(/\)$/, ""), base.fields,
      );
      if (selectionPlan.kind !== "apply") throw new RangeError("DELETE RECORDS selection could not be reconstructed.");
      return applyClassicSelection(active.records, selectionPlan).records;
    })();
  if (matchedActive.length > CLASSIC_DELETE_RECORDS_LIMIT) {
    throw new RangeError(`DELETE RECORDS is limited to ${CLASSIC_DELETE_RECORDS_LIMIT.toLocaleString("en-US")} recoverable records per reviewed operation.`);
  }
  const remainingByKey = new Map<string, number>();
  for (const record of matchedActive) {
    const key = recordKey(record, base.fields);
    remainingByKey.set(key, (remainingByKey.get(key) ?? 0) + 1);
  }
  const remainingRecords: EpiRecord[] = [];
  const deleted: ClassicDeleteRecordsResult["deleted"] = [];
  for (const [originalIndex, record] of base.records.entries()) {
    const key = recordKey(record, base.fields);
    const count = remainingByKey.get(key) ?? 0;
    if (count > 0) {
      deleted.push({ originalIndex, record: structuredClone(record) });
      if (count === 1) remainingByKey.delete(key); else remainingByKey.set(key, count - 1);
    } else remainingRecords.push(structuredClone(record));
  }
  if (remainingByKey.size) throw new RangeError("The active selection no longer matches the saved form. READ the form again before deleting records.");
  return {
    formId: base.formId, formName: base.formName, sourceSnapshot: structuredClone(base.records), remainingRecords, deleted,
    activeRecords: active.records.length, matchedRecords: deleted.length, canonicalSource: plan.canonicalSource,
  };
}
