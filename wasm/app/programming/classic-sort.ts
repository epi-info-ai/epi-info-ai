import type { EpiRecord, FieldDefinition, FieldType, RecordValue } from "../contracts/core.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram } from "./classic-ast.ts";

export const CLASSIC_SORT_PLAN_VERSION = "0.1.0" as const;
export type ClassicSortDirection = "ASC" | "DESC";
export interface ClassicSortItem { field: string; fieldType: FieldType; direction: ClassicSortDirection }
export type ClassicSortPlan =
  | { kind: "apply"; version: typeof CLASSIC_SORT_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string; canonicalSource: string; items: ClassicSortItem[] }
  | { kind: "cancel"; version: typeof CLASSIC_SORT_PLAN_VERSION; astVersion: typeof CLASSIC_AST_VERSION; source: string; canonicalSource: "CANCEL SORT" };

const fieldToken = (name: string): string => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
const isMissing = (value: RecordValue | undefined): boolean => value === null || value === undefined || (typeof value === "string" && value.trim() === "");

export function buildClassicSortCommand(items: readonly Pick<ClassicSortItem, "field" | "direction">[]): string {
  if (!items.length) throw new RangeError("SORT requires at least one sort variable.");
  return `SORT ${items.map((item) => `${fieldToken(item.field)} ${item.direction === "DESC" ? "DESCENDING" : "ASCENDING"}`).join(" ")}`;
}

export function resolveClassicSortCommand(source: string, fields: readonly FieldDefinition[]): ClassicSortPlan {
  if (!source.trim()) throw new RangeError("Select one complete SORT or CANCEL SORT command in the Program Editor.");
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "SortStatement") throw new RangeError("Select exactly one complete SORT or CANCEL SORT command.");
  const statement = ast.body[0];
  if (statement.mode !== "apply") return { kind: "cancel", version: CLASSIC_SORT_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource: "CANCEL SORT" };
  const seen = new Set<string>();
  const items = statement.items.map((item): ClassicSortItem => {
    const matches = fields.filter((field) => field.name.toLocaleLowerCase("en-US") === item.field.name.toLocaleLowerCase("en-US"));
    if (matches.length !== 1) throw new RangeError(matches.length ? `${item.field.name} is ambiguous in the current form.` : `${item.field.name} is not a field in the current form.`);
    const field = matches[0]!;
    if (field.type === "command-button") throw new RangeError(`${field.prompt} is a command button and cannot be sorted.`);
    const key = field.name.toLocaleLowerCase("en-US");
    if (seen.has(key)) throw new RangeError(`${field.prompt} can appear only once in a SORT command.`);
    seen.add(key);
    return { field: field.name, fieldType: field.type, direction: item.direction };
  });
  return { kind: "apply", version: CLASSIC_SORT_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source, canonicalSource: buildClassicSortCommand(items), items };
}

function comparable(value: RecordValue, fieldType: FieldType): string | number | boolean {
  if (fieldType === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number : String(value).toLocaleLowerCase("en-US");
  }
  if (fieldType === "checkbox" || fieldType === "yes-no") {
    if (typeof value === "boolean") return value;
    return /^(?:yes|true|1)$/i.test(String(value));
  }
  return String(value).toLocaleLowerCase("en-US");
}

export function applyClassicSort(records: readonly EpiRecord[], plan: Extract<ClassicSortPlan, { kind: "apply" }>): EpiRecord[] {
  return records.map((record, index) => ({ record, index })).sort((leftEntry, rightEntry) => {
    for (const item of plan.items) {
      const left = leftEntry.record[item.field];
      const right = rightEntry.record[item.field];
      const leftMissing = isMissing(left);
      const rightMissing = isMissing(right);
      let compared = 0;
      if (leftMissing || rightMissing) compared = leftMissing === rightMissing ? 0 : leftMissing ? -1 : 1;
      else {
        const a = comparable(left!, item.fieldType);
        const b = comparable(right!, item.fieldType);
        compared = a < b ? -1 : a > b ? 1 : 0;
      }
      if (compared) return item.direction === "DESC" ? -compared : compared;
    }
    return leftEntry.index - rightEntry.index;
  }).map(({ record }) => structuredClone(record));
}
