import type { EpiRecord, FieldDefinition, FormSchema, RecordValue } from "../contracts/core.js";

export const CHECK_CODE_ISUNIQUE_MAX_RECORDS = 10_000;
export const CHECK_CODE_ISUNIQUE_MAX_FIELDS = 12;

function normalized(value: RecordValue | undefined, field: FieldDefinition): string | number | boolean | null {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  if (field.type === "number") {
    const numeric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  if (field.type === "checkbox" || field.type === "yes-no") {
    if (typeof value === "boolean") return value;
    if (/^(?:true|yes|1|\+)$/i.test(String(value).trim())) return true;
    if (/^(?:false|no|0|-)$/i.test(String(value).trim())) return false;
    return null;
  }
  return String(value).trim().toLocaleLowerCase("en-US");
}

export function isUniqueCheckCodeValue(
  schema: FormSchema,
  records: readonly EpiRecord[],
  current: Readonly<EpiRecord>,
  fieldNames: readonly string[],
  currentRecordIndex?: number,
): boolean {
  if (records.length > CHECK_CODE_ISUNIQUE_MAX_RECORDS) {
    throw new RangeError(`ISUNIQUE is limited to ${CHECK_CODE_ISUNIQUE_MAX_RECORDS.toLocaleString("en-US")} active-form records in this browser candidate.`);
  }
  if (fieldNames.length < 1 || fieldNames.length > CHECK_CODE_ISUNIQUE_MAX_FIELDS) {
    throw new RangeError(`ISUNIQUE requires 1 through ${CHECK_CODE_ISUNIQUE_MAX_FIELDS} fields.`);
  }
  if (currentRecordIndex !== undefined && (!Number.isSafeInteger(currentRecordIndex) || currentRecordIndex < 0 || currentRecordIndex >= records.length)) {
    throw new RangeError("ISUNIQUE current-record identity is outside the active-form record collection.");
  }
  const byName = new Map(schema.fields.map((field) => [field.name.toLocaleLowerCase("en-US"), field]));
  const seen = new Set<string>();
  const fields = fieldNames.map((name) => {
    const normalizedName = name.toLocaleLowerCase("en-US");
    if (seen.has(normalizedName)) throw new RangeError(`ISUNIQUE field ${JSON.stringify(name)} is repeated.`);
    seen.add(normalizedName);
    const field = byName.get(normalizedName);
    if (!field || field.type === "command-button") throw new RangeError(`ISUNIQUE field ${JSON.stringify(name)} is not an entry-data field in the active form.`);
    return field;
  });
  const values = fields.map((field) => normalized(current[field.name], field));
  if (values.some((value) => value === null)) return false;
  return !records.some((record, index) => index !== currentRecordIndex
    && fields.every((field, fieldIndex) => normalized(record[field.name], field) === values[fieldIndex]));
}
