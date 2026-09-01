import type { MapDataSource } from "../contracts/maps.ts";
import { parseClassicProgram } from "./classic-ast.ts";

export interface ClassicDeleteTablePlan {
  formId: string;
  formName: string;
  recordCount: number;
  canonicalSource: string;
}

const fieldToken = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;

export function buildClassicDeleteTableCommand(formName: string): string {
  const trimmed = formName.trim();
  if (!trimmed) throw new RangeError("Choose a current-project form data table.");
  return `DELETE TABLES ${fieldToken(trimmed)}`;
}

export function resolveClassicDeleteTableCommand(source: string, projectSources: readonly MapDataSource[]): ClassicDeleteTablePlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "DeleteStatement") throw new RangeError("Select exactly one DELETE FILE/TABLE command.");
  const statement = ast.body[0];
  if (statement.runSilent) throw new RangeError("RUNSILENT is disabled for destructive browser commands; explicit review and confirmation are required.");
  if (statement.saveData) throw new RangeError("SAVEDATA has no reviewed browser equivalent in this slice.");
  if (statement.permanent) throw new RangeError("PERMANENT applies to DELETE RECORDS, not this reviewed DELETE TABLES subset.");
  if (statement.target.kind === "records") throw new RangeError("This command is DELETE RECORDS; use its reviewed record-lifecycle plan.");
  if (statement.target.kind === "external-file") throw new RangeError("Browser code cannot delete an operating-system file by path. Project Files and user-granted file handles require a separate reviewed adapter.");
  if (statement.target.kind === "external-table") {
    if (!statement.target.table) throw new RangeError("The legacy short external-table DELETE is unimplemented in the reviewed C# interpreter and remains disabled.");
    throw new RangeError("Deleting tables from external databases requires a server or user-granted data-source adapter and remains disabled.");
  }
  const table = statement.target.table;
  const matches = projectSources.filter((candidate) => candidate.formName.toLocaleLowerCase("en-US") === table.toLocaleLowerCase("en-US"));
  if (matches.length !== 1) throw new RangeError(matches.length ? `${table} is ambiguous in the current project.` : `${table} is not a form in the current project.`);
  const target = matches[0]!;
  return {
    formId: target.formId,
    formName: target.formName,
    recordCount: target.records.length,
    canonicalSource: buildClassicDeleteTableCommand(target.formName),
  };
}

export function stageClassicDeleteTable(target: MapDataSource, plan: ClassicDeleteTablePlan): MapDataSource {
  if (target.formId !== plan.formId) throw new RangeError("DELETE target changed after review. Generate a new preview.");
  if (target.records.length !== plan.recordCount) throw new RangeError("DELETE target record count changed after review. Generate a new preview.");
  return { ...target, fields: structuredClone(target.fields), records: [] };
}
