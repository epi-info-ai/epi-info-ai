import type { EpiRecord, FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram } from "./classic-ast.ts";

export const CLASSIC_MERGE_PLAN_VERSION = "0.1.0" as const;
export const CLASSIC_MERGE_MAX_RECORDS = 250_000;

export interface ClassicMergeKey { currentField: string; sourceField: string }
export interface ClassicMergePlan {
  kind: "merge";
  version: typeof CLASSIC_MERGE_PLAN_VERSION;
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  canonicalSource: string;
  sourceForm: string;
  keys: ClassicMergeKey[];
  mode: "default";
}
export interface ClassicMergeResult {
  destination: MapDataSource;
  destinationRecords: number;
  sourceRecords: number;
  insertedRecords: number;
  updatedRecords: number;
  outputRecords: number;
  sharedFields: string[];
}

const nameKey = (name: string): string => name.toLocaleLowerCase("en-US");
const token = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("]")) throw new RangeError("MERGE table and field names cannot be empty or contain ']'.");
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(trimmed) ? trimmed : `[${trimmed}]`;
};
function resolveField(fields: readonly FieldDefinition[], requested: string, side: string): FieldDefinition {
  const matches = fields.filter((field) => nameKey(field.name) === nameKey(requested));
  if (matches.length !== 1) throw new RangeError(`${requested} is not an unambiguous ${side} field.`);
  return matches[0]!;
}

export function buildClassicMergeCommand(sourceForm: string, keys: readonly ClassicMergeKey[]): string {
  if (!sourceForm.trim()) throw new RangeError("MERGE requires a source table or form.");
  if (!keys.length) throw new RangeError("MERGE requires at least one destination-to-source key pair.");
  return `MERGE ${token(sourceForm)} ${keys.map((pair) => `${token(pair.currentField)} :: ${token(pair.sourceField)}`).join(" AND ")}`;
}

export function resolveClassicMergeCommand(source: string, destinationFields: readonly FieldDefinition[], dataSources: readonly MapDataSource[]): ClassicMergePlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "MergeStatement") throw new RangeError("Select exactly one complete MERGE command.");
  const statement = ast.body[0];
  if (statement.target.kind !== "current-project-table") throw new RangeError("Selected MERGE supports current-project forms only; external paths require a reviewed browser adapter.");
  if (statement.mode !== "default") throw new RangeError(`Legacy MERGE mode ${statement.mode} is parsed but not enabled because the reviewed C# execution path does not branch on its parsed mode.`);
  const sourceMatches = dataSources.filter((candidate) => nameKey(candidate.formName) === nameKey(statement.target.table));
  if (sourceMatches.length !== 1) throw new RangeError(sourceMatches.length ? `${statement.target.table} is ambiguous in the current project.` : `${statement.target.table} is not a form in the current project.`);
  const sourceForm = sourceMatches[0]!;
  const seenCurrent = new Set<string>();
  const seenSource = new Set<string>();
  const keys = statement.keys.map((pair) => {
    const current = resolveField(destinationFields, pair.current.name, "destination-table");
    const sourceField = resolveField(sourceForm.fields, pair.source.name, "source-table");
    if (current.type !== sourceField.type) throw new RangeError(`${current.name} and ${sourceField.name} must have the same field type for MERGE.`);
    if (seenCurrent.has(nameKey(current.name)) || seenSource.has(nameKey(sourceField.name))) throw new RangeError("Each MERGE key field may appear only once.");
    seenCurrent.add(nameKey(current.name));
    seenSource.add(nameKey(sourceField.name));
    return { currentField: current.name, sourceField: sourceField.name };
  });
  return {
    kind: "merge", version: CLASSIC_MERGE_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: buildClassicMergeCommand(sourceForm.formName, keys), sourceForm: sourceForm.formName, keys, mode: "default",
  };
}

function comparable(value: unknown, type: FieldDefinition["type"]): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (type === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? `number:${numeric}` : null;
  }
  if (type === "checkbox" || type === "yes-no") return `boolean:${String(value).toLocaleLowerCase("en-US")}`;
  return `${type}:${String(value)}`;
}
function recordKey(record: EpiRecord, fields: readonly FieldDefinition[], names: readonly string[]): string | null {
  const parts: string[] = [];
  for (const name of names) {
    const field = fields.find((candidate) => candidate.name === name)!;
    const part = comparable(record[name], field.type);
    if (part === null) return null;
    parts.push(part);
  }
  return JSON.stringify(parts);
}

export function applyClassicMerge(destination: MapDataSource, source: MapDataSource, plan: ClassicMergePlan): ClassicMergeResult {
  if (nameKey(source.formName) !== nameKey(plan.sourceForm)) throw new RangeError(`${plan.sourceForm} is not the supplied MERGE source form.`);
  if (destination.records.length + source.records.length > CLASSIC_MERGE_MAX_RECORDS) throw new RangeError(`MERGE staging would exceed the reviewed ${CLASSIC_MERGE_MAX_RECORDS.toLocaleString("en-US")} browser record limit.`);
  const sourceFields = new Map(source.fields.map((field) => [nameKey(field.name), field]));
  const shared = destination.fields.flatMap((field) => {
    const sourceField = sourceFields.get(nameKey(field.name));
    if (!sourceField) return [];
    if (field.type !== sourceField.type) throw new RangeError(`${field.name} has incompatible destination (${field.type}) and source (${sourceField.type}) types.`);
    return [{ destination: field, source: sourceField }];
  });
  if (!shared.length) throw new RangeError("MERGE requires at least one same-named field shared by destination and source.");
  const destinationKeyNames = plan.keys.map(({ currentField }) => currentField);
  const sourceKeyNames = plan.keys.map(({ sourceField }) => sourceField);
  const records = structuredClone(destination.records);
  const index = new Map<string, number>();
  for (const [recordIndex, record] of records.entries()) {
    const value = recordKey(record, destination.fields, destinationKeyNames);
    if (value === null) continue;
    if (index.has(value)) throw new RangeError(`The MERGE destination key is not unique at records ${index.get(value)! + 1} and ${recordIndex + 1}.`);
    index.set(value, recordIndex);
  }
  const destinationKeySet = new Set(destinationKeyNames.map(nameKey));
  let insertedRecords = 0;
  let updatedRecords = 0;
  for (const sourceRecord of source.records) {
    const value = recordKey(sourceRecord, source.fields, sourceKeyNames);
    const matchIndex = value === null ? undefined : index.get(value);
    if (matchIndex !== undefined) {
      const destinationRecord = records[matchIndex]!;
      for (const field of shared) {
        if (!destinationKeySet.has(nameKey(field.destination.name))) destinationRecord[field.destination.name] = sourceRecord[field.source.name] ?? null;
      }
      updatedRecords += 1;
      continue;
    }
    const inserted: EpiRecord = Object.fromEntries(destination.fields.map((field) => [field.name, null]));
    for (const field of shared) inserted[field.destination.name] = sourceRecord[field.source.name] ?? null;
    records.push(inserted);
    insertedRecords += 1;
    const insertedKey = recordKey(inserted, destination.fields, destinationKeyNames);
    if (insertedKey !== null) index.set(insertedKey, records.length - 1);
  }
  return {
    destination: { ...structuredClone(destination), records }, destinationRecords: destination.records.length,
    sourceRecords: source.records.length, insertedRecords, updatedRecords, outputRecords: records.length,
    sharedFields: shared.map(({ destination: field }) => field.name),
  };
}
