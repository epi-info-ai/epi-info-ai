import type { EpiRecord, FieldDefinition, RecordValue } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram } from "./classic-ast.ts";
import { expandClassicGroupNames, type ClassicGroupDefinition } from "./classic-group.ts";

export const CLASSIC_WRITE_PLAN_VERSION = "0.1.0" as const;
export interface ClassicWriteInput {
  fileName: string;
  fields?: string[];
  except?: boolean;
  mode?: "REPLACE" | "APPEND";
}
export interface ClassicWritePlan {
  kind: "write";
  version: typeof CLASSIC_WRITE_PLAN_VERSION;
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  canonicalSource: string;
  mode: "REPLACE";
  format: "Text";
  fileName: string;
  fields: FieldDefinition[];
}

const key = (value: string): string => value.toLocaleLowerCase("en-US");
const token = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const safeFileName = (value: string): string => {
  const fileName = value.trim();
  if (!fileName || fileName === "." || fileName === "..") throw new RangeError("WRITE requires a browser download file name.");
  if (/[\\/]/.test(fileName)) throw new RangeError("Browser WRITE accepts a download file name, not an operating-system path.");
  if (/[\u0000-\u001f<>:\"|?*]/.test(fileName)) throw new RangeError("WRITE file name contains characters that are not safe for a browser download.");
  return /\.csv$/i.test(fileName) ? fileName : `${fileName}.csv`;
};
const tableName = (fileName: string): string => fileName.replace(/\.csv$/i, "").replace(/[^A-Za-z0-9_]/g, "_") || "export";

export function buildClassicWriteCommand(input: ClassicWriteInput): string {
  const fileName = safeFileName(input.fileName);
  const mode = input.mode ?? "REPLACE";
  const fields = input.fields ?? [];
  const selection = fields.length ? `${input.except ? "* EXCEPT " : ""}${fields.map(token).join(" ")}` : "*";
  return `WRITE ${mode} "Text" {${fileName}}:${tableName(fileName)}#csv ${selection}`;
}

export function resolveClassicWriteCommand(source: string, fields: readonly FieldDefinition[], groups: readonly ClassicGroupDefinition[] = []): ClassicWritePlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "WriteStatement") throw new RangeError("Select exactly one complete WRITE command.");
  const statement = ast.body[0];
  if (statement.mode !== "REPLACE") throw new RangeError("Browser WRITE supports REPLACE downloads only. APPEND requires an explicitly selected existing file and remains a reviewed adapter gap.");
  if (statement.format !== "Text") throw new RangeError(`Browser WRITE cannot create legacy ${statement.format} files. Use \"Text\" for a UTF-8 CSV download.`);
  const fileName = safeFileName(statement.target.source);
  const fieldMap = new Map(fields.map((field) => [key(field.name), field]));
  const resolveNames = (names: string[]): FieldDefinition[] => expandClassicGroupNames(names, groups).map((name) => {
    const field = fieldMap.get(key(name));
    if (!field) throw new RangeError(`${name} is not a field in the active Classic data source.`);
    return field;
  });
  let selected: FieldDefinition[];
  if (statement.selection.kind === "all") selected = [...fields];
  else if (statement.selection.kind === "all-except") {
    const excluded = new Set(resolveNames(statement.selection.fields.map(({ name }) => name)).map(({ name }) => key(name)));
    selected = fields.filter(({ name }) => !excluded.has(key(name)));
  } else selected = resolveNames(statement.selection.fields.map(({ name }) => name));
  if (!selected.length) throw new RangeError("WRITE must export at least one field.");
  if (new Set(selected.map(({ name }) => key(name))).size !== selected.length) throw new RangeError("Each WRITE field may appear only once.");
  return {
    kind: "write", version: CLASSIC_WRITE_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: buildClassicWriteCommand({ fileName, fields: selected.map(({ name }) => name) }),
    mode: "REPLACE", format: "Text", fileName, fields: structuredClone(selected),
  };
}

function csvCell(value: RecordValue | undefined): string {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function serializeClassicWriteCsv(plan: ClassicWritePlan, records: readonly EpiRecord[]): string {
  const names = plan.fields.map(({ name }) => name);
  return [names.map(csvCell).join(","), ...records.map((record) => names.map((name) => csvCell(record[name])).join(","))].join("\r\n");
}
