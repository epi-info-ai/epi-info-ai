import type { EpiRecord, FormSchema, RecordValue } from "../contracts/core.js";
import type { FieldValidationIssue } from "../contracts/validation.js";
import { validateRecords } from "./validation.ts";

export interface FieldCompleteness {
  fieldName: string;
  prompt: string;
  present: number;
  missing: number;
  completeness: number;
  violations: number;
}

export interface DataQualityReport {
  formId: string;
  recordCount: number;
  fields: FieldCompleteness[];
  issues: FieldValidationIssue[];
  duplicateIssues: number;
  duplicateGroups: DuplicateGroup[];
}

export interface DuplicateGroup {
  id: string;
  fieldName: string;
  label: string;
  value: string;
  recordIndexes: number[];
}

function isMissing(value: RecordValue | undefined): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

export function buildDataQualityReport(formId: string, schema: FormSchema, records: readonly EpiRecord[]): DataQualityReport {
  const issues = validateRecords(formId, schema, records);
  const dataFields = schema.fields.filter((field) => field.type !== "command-button");
  const fields = dataFields.map((field) => {
    const missing = records.filter((record) => isMissing(record[field.name])).length;
    const present = records.length - missing;
    return {
      fieldName: field.name,
      prompt: field.prompt,
      present,
      missing,
      completeness: records.length === 0 ? 1 : present / records.length,
      violations: issues.filter((issue) => issue.fieldName === field.name).length,
    };
  });
  const duplicateGroups: DuplicateGroup[] = [];
  for (const field of schema.fields.filter((candidate) => candidate.rules?.some((rule) => rule.kind === "unique"))) {
    const uniqueRule = field.rules?.find((rule) => rule.kind === "unique");
    const values = new Map<string, number[]>();
    for (const [index, record] of records.entries()) {
      const raw = record[field.name];
      if (isMissing(raw)) continue;
      const normalized = String(raw).trim();
      const key = uniqueRule?.caseSensitive ? normalized : normalized.toLocaleLowerCase();
      values.set(key, [...(values.get(key) ?? []), index]);
    }
    for (const [value, recordIndexes] of values) {
      if (recordIndexes.length < 2) continue;
      duplicateGroups.push({ id: `${field.name}:${value}`, fieldName: field.name, label: `${field.prompt}: ${value}`, value, recordIndexes });
    }
  }
  const exact = new Map<string, number[]>();
  for (const [index, record] of records.entries()) {
    const signature = JSON.stringify(dataFields.map((field) => record[field.name] ?? null));
    exact.set(signature, [...(exact.get(signature) ?? []), index]);
  }
  for (const [, recordIndexes] of exact) {
    if (recordIndexes.length < 2) continue;
    duplicateGroups.push({ id: `exact:${recordIndexes.join("-")}`, fieldName: "*", label: `Exact duplicate records ${recordIndexes.map((index) => index + 1).join(", ")}`, value: "Exact row match", recordIndexes });
  }
  return {
    formId,
    recordCount: records.length,
    fields,
    issues,
    duplicateIssues: issues.filter((issue) => issue.rule === "unique").length,
    duplicateGroups,
  };
}
