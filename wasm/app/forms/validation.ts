import type { EpiRecord, FieldDefinition, FormSchema, ProjectSnapshotV1, RecordValue } from "../contracts/core.js";
import type { FieldValidationIssue, FieldValidationRule } from "../contracts/validation.js";

function blank(value: RecordValue | undefined): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function comparable(value: RecordValue | undefined, caseSensitive = false): string {
  const text = String(value ?? "").trim();
  return caseSensitive ? text : text.toLocaleLowerCase();
}

function issue(
  formId: string,
  recordIndex: number,
  field: FieldDefinition,
  rule: FieldValidationRule,
  defaultMessage: string,
  suggestedResolution: string,
): FieldValidationIssue {
  return {
    formId,
    recordIndex,
    fieldName: field.name,
    rule: rule.kind,
    severity: rule.severity ?? "error",
    message: rule.message ?? defaultMessage,
    suggestedResolution,
  };
}

function rulesFor(field: FieldDefinition): FieldValidationRule[] {
  const rules = [...(field.rules ?? [])];
  if (field.required && !rules.some((rule) => rule.kind === "required")) rules.unshift({ kind: "required" });
  return rules;
}

function isoDateParts(value: RecordValue | undefined): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function calculateAgeYears(sourceDate: RecordValue | undefined, asOfDate: RecordValue | undefined): number | null {
  const source = isoDateParts(sourceDate);
  const asOf = isoDateParts(asOfDate);
  if (!source || !asOf) return null;
  let age = asOf.year - source.year;
  if (asOf.month < source.month || (asOf.month === source.month && asOf.day < source.day)) age -= 1;
  return age >= 0 ? age : null;
}

function localIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function materializeCalculatedFields(schema: FormSchema, record: EpiRecord, referenceDate = new Date()): EpiRecord {
  const result = { ...record };
  for (const field of schema.fields) {
    const calculation = field.rules?.find((rule) => rule.kind === "calculated-age");
    if (!calculation || calculation.kind !== "calculated-age") continue;
    const asOf = calculation.asOfDateField ? result[calculation.asOfDateField] : localIsoDate(referenceDate);
    const age = calculateAgeYears(result[calculation.sourceDateField], asOf);
    result[field.name] = age;
  }
  return result;
}

export function validateRecord(
  formId: string,
  schema: FormSchema,
  record: EpiRecord,
  recordIndex: number,
  comparisonRecords: readonly EpiRecord[] = [],
): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  for (const field of schema.fields) {
    const value = record[field.name];
    for (const rule of rulesFor(field)) {
      if (rule.kind === "required") {
        if (blank(value)) issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} is required.`, "Enter a value."));
        continue;
      }
      if (rule.kind === "calculated-age") {
        const asOf = rule.asOfDateField ? record[rule.asOfDateField] : localIsoDate(new Date());
        if (blank(record[rule.sourceDateField]) || (rule.asOfDateField !== undefined && blank(asOf))) continue;
        const expected = calculateAgeYears(record[rule.sourceDateField], asOf);
        if (expected === null) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} could not be calculated from valid source dates.`, "Enter valid source and as-of dates."));
        } else if (Number(value) !== expected) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} must equal the calculated age ${expected}.`, "Recalculate this field from its configured dates."));
        }
        continue;
      }
      if (blank(value)) continue;
      if (rule.kind === "range") {
        const candidate = rule.valueType === "number" ? Number(value) : Date.parse(String(value));
        const minimum = rule.min === undefined ? undefined : rule.valueType === "number" ? Number(rule.min) : Date.parse(String(rule.min));
        const maximum = rule.max === undefined ? undefined : rule.valueType === "number" ? Number(rule.max) : Date.parse(String(rule.max));
        if (!Number.isFinite(candidate)) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} is not a valid ${rule.valueType}.`, `Enter a valid ${rule.valueType}.`));
        } else if (minimum !== undefined && candidate < minimum) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} must be at least ${rule.min}.`, `Enter ${rule.min} or a greater value.`));
        } else if (maximum !== undefined && candidate > maximum) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} must be no greater than ${rule.max}.`, `Enter ${rule.max} or a smaller value.`));
        }
      } else if (rule.kind === "legal-values") {
        const candidate = comparable(value, rule.caseSensitive);
        const legal = rule.values.map((entry) => comparable(entry, rule.caseSensitive));
        if (!legal.includes(candidate) && !rule.allowComment) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} must be one of: ${rule.values.join(", ")}.`, "Choose a listed value."));
        }
      } else if (rule.kind === "pattern") {
        const expression = new RegExp(rule.pattern, rule.flags ?? "");
        if (!expression.test(String(value))) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} does not match the required format.`, "Enter a value in the expected format."));
        }
      } else if (rule.kind === "unique") {
        const candidate = comparable(value, rule.caseSensitive);
        if (comparisonRecords.some((other) => comparable(other[field.name], rule.caseSensitive) === candidate)) {
          issues.push(issue(formId, recordIndex, field, rule, `${field.prompt} must be unique.`, "Enter a value not used by another record."));
        }
      }
    }
  }
  return issues;
}

export function validateProjectRecords(project: ProjectSnapshotV1): FieldValidationIssue[] {
  return project.forms.flatMap((form) => validateRecords(form.id, form.schema, form.records));
}

export function validateRecords(
  formId: string,
  schema: FormSchema,
  records: readonly EpiRecord[],
  existingRecords: readonly EpiRecord[] = [],
): FieldValidationIssue[] {
  return records.flatMap((record, index) => validateRecord(
    formId,
    schema,
    record,
    index,
    [...existingRecords, ...records.filter((_, otherIndex) => otherIndex !== index)],
  ));
}
