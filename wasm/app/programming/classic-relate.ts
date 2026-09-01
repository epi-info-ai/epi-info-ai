import type { FieldDefinition } from "../contracts/core.ts";
import type { MapDataSource } from "../contracts/maps.ts";
import { CLASSIC_AST_VERSION, parseClassicProgram } from "./classic-ast.ts";

export const CLASSIC_RELATE_PLAN_VERSION = "0.1.0" as const;
export const CLASSIC_RELATE_MAX_OUTPUT_RECORDS = 250_000;

export interface ClassicRelateKey { currentField: string; relatedField: string }
export interface ClassicRelatePlan {
  kind: "relate";
  version: typeof CLASSIC_RELATE_PLAN_VERSION;
  astVersion: typeof CLASSIC_AST_VERSION;
  source: string;
  canonicalSource: string;
  relatedForm: string;
  keys: ClassicRelateKey[];
  join: "matching" | "all";
}

export interface ClassicRelateResult {
  source: MapDataSource;
  parentRecords: number;
  relatedRecords: number;
  outputRecords: number;
  matchedParentRecords: number;
  unmatchedParentRecords: number;
}

const key = (name: string): string => name.toLocaleLowerCase("en-US");
const token = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed || trimmed.includes("]")) throw new RangeError("RELATE table and field names cannot be empty or contain ']'.");
  return /^[A-Za-z_][A-Za-z0-9_.]*$/.test(trimmed) ? trimmed : `[${trimmed}]`;
};

function resolveField(fields: readonly FieldDefinition[], requested: string, side: string): FieldDefinition {
  const matches = fields.filter((field) => key(field.name) === key(requested));
  if (matches.length !== 1) throw new RangeError(`${requested} is not an unambiguous ${side} field.`);
  return matches[0]!;
}

export function buildClassicRelateCommand(relatedForm: string, keys: readonly ClassicRelateKey[], join: "matching" | "all" = "matching"): string {
  if (!relatedForm.trim()) throw new RangeError("RELATE requires a related table or form.");
  if (!keys.length) throw new RangeError("RELATE requires at least one current-to-related key pair.");
  const keySource = keys.map((pair) => `${token(pair.currentField)} :: ${token(pair.relatedField)}`).join(" AND ");
  return `RELATE ${token(relatedForm)} ${keySource} ${join === "all" ? "ALL" : "MATCHING"}`;
}

export function resolveClassicRelateCommand(
  source: string,
  currentFields: readonly FieldDefinition[],
  dataSources: readonly MapDataSource[],
): ClassicRelatePlan {
  const ast = parseClassicProgram(source);
  if (ast.body.length !== 1 || ast.body[0]?.type !== "RelateStatement") throw new RangeError("Select exactly one complete RELATE command.");
  const statement = ast.body[0];
  if (statement.target.kind !== "current-project-table") throw new RangeError("Selected RELATE supports current-project forms only; external paths require a reviewed browser adapter.");
  const matches = dataSources.filter((candidate) => key(candidate.formName) === key(statement.target.table));
  if (matches.length !== 1) throw new RangeError(matches.length ? `${statement.target.table} is ambiguous in the current project.` : `${statement.target.table} is not a form in the current project.`);
  const related = matches[0]!;
  const seenCurrent = new Set<string>();
  const seenRelated = new Set<string>();
  const keys = statement.keys.map((pair) => {
    const current = resolveField(currentFields, pair.current.name, "current-table");
    const relatedField = resolveField(related.fields, pair.related.name, "related-table");
    if (current.type !== relatedField.type) throw new RangeError(`${current.name} and ${relatedField.name} must have the same field type for RELATE.`);
    if (seenCurrent.has(key(current.name)) || seenRelated.has(key(relatedField.name))) throw new RangeError("Each RELATE key field may appear only once.");
    seenCurrent.add(key(current.name));
    seenRelated.add(key(relatedField.name));
    return { currentField: current.name, relatedField: relatedField.name };
  });
  return {
    kind: "relate", version: CLASSIC_RELATE_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION, source,
    canonicalSource: buildClassicRelateCommand(related.formName, keys, statement.join),
    relatedForm: related.formName, keys, join: statement.join,
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

function recordKey(record: MapDataSource["records"][number], fields: readonly FieldDefinition[], names: readonly string[]): string | null {
  const parts: string[] = [];
  for (const name of names) {
    const field = fields.find((candidate) => candidate.name === name)!;
    const part = comparable(record[name], field.type);
    if (part === null) return null;
    parts.push(part);
  }
  return JSON.stringify(parts);
}

export function applyClassicRelate(parent: MapDataSource, related: MapDataSource, plan: ClassicRelatePlan): ClassicRelateResult {
  if (key(related.formName) !== key(plan.relatedForm)) throw new RangeError(`${plan.relatedForm} is not the supplied related form.`);
  const relatedNames = plan.keys.map((pair) => pair.relatedField);
  const index = new Map<string, MapDataSource["records"]>();
  for (const record of related.records) {
    const joinedKey = recordKey(record, related.fields, relatedNames);
    if (joinedKey === null) continue;
    const bucket = index.get(joinedKey) ?? [];
    bucket.push(record);
    index.set(joinedKey, bucket);
  }

  const used = new Set(parent.fields.map((field) => key(field.name)));
  const relatedFields = related.fields.map((field) => {
    let name = field.name;
    if (used.has(key(name))) {
      let suffix = 2;
      while (used.has(key(`${field.name}${suffix}`))) suffix += 1;
      name = `${field.name}${suffix}`;
    }
    used.add(key(name));
    return { original: field.name, definition: { ...field, name, prompt: name === field.name ? field.prompt : `${field.prompt} (${related.formName})` } };
  });

  const records: MapDataSource["records"] = [];
  let matchedParentRecords = 0;
  let unmatchedParentRecords = 0;
  for (const parentRecord of parent.records) {
    const joinedKey = recordKey(parentRecord, parent.fields, plan.keys.map((pair) => pair.currentField));
    const matches = joinedKey === null ? [] : index.get(joinedKey) ?? [];
    if (matches.length) {
      matchedParentRecords += 1;
      for (const relatedRecord of matches) {
        if (records.length >= CLASSIC_RELATE_MAX_OUTPUT_RECORDS) throw new RangeError(`RELATE would exceed the reviewed ${CLASSIC_RELATE_MAX_OUTPUT_RECORDS.toLocaleString("en-US")} output-record browser limit.`);
        const combined = { ...parentRecord };
        for (const field of relatedFields) combined[field.definition.name] = relatedRecord[field.original] ?? null;
        records.push(combined);
      }
    } else {
      unmatchedParentRecords += 1;
      if (plan.join === "all") {
        if (records.length >= CLASSIC_RELATE_MAX_OUTPUT_RECORDS) throw new RangeError(`RELATE would exceed the reviewed ${CLASSIC_RELATE_MAX_OUTPUT_RECORDS.toLocaleString("en-US")} output-record browser limit.`);
        const combined = { ...parentRecord };
        for (const field of relatedFields) combined[field.definition.name] = null;
        records.push(combined);
      }
    }
  }
  return {
    source: {
      formId: `${parent.formId}--relate--${related.formId}`,
      projectName: parent.projectName,
      formName: `${parent.formName} + ${related.formName}`,
      fields: [...parent.fields.map((field) => ({ ...field })), ...relatedFields.map((field) => field.definition)],
      records,
    },
    parentRecords: parent.records.length, relatedRecords: related.records.length, outputRecords: records.length,
    matchedParentRecords, unmatchedParentRecords,
  };
}
