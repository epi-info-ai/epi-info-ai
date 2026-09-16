import type { DatasetProvenance, EpiRecord, FieldDefinition } from "../contracts/core.ts";

export const DATA_IMPORT_PREVIEW_VERSION = "data-import-preview-v0.1.0" as const;

export type DataImportMode = "update-and-append" | "update-only" | "append-new" | "replace";

export interface DataImportPreview {
  version: typeof DATA_IMPORT_PREVIEW_VERSION;
  keyField?: string;
  incoming: number;
  newRecords: number;
  matchingRecords: number;
  changedRecords: number;
  unchangedRecords: number;
  blankIncomingKeys: number;
  duplicateIncomingKeys: number;
  duplicateDestinationKeys: number;
  invalidRecords: number;
  exactFilePreviouslyImported: boolean;
  canMerge: boolean;
}

const folded = (value: unknown): string => String(value ?? "").trim().toLocaleLowerCase("en-US");
const comparable = (value: unknown): string => String(value ?? "").trim();

function sameRecord(left: EpiRecord, right: EpiRecord, fields: readonly FieldDefinition[]): boolean {
  return fields
    .filter(({ type }) => type !== "command-button")
    .every(({ name }) => comparable(right[name]) === "" || comparable(left[name]) === comparable(right[name]));
}

function duplicateCount(keys: readonly string[]): number {
  const counts = new Map<string, number>();
  for (const key of keys.filter(Boolean)) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
}

function importKeyScore(field: FieldDefinition): number {
  const normalizedName = field.name.toLocaleLowerCase("en-US");
  const compactName = normalizedName.replace(/[^a-z0-9]/g, "");
  const identifierLabel = `${field.name} ${field.prompt}`;
  const identifierName = /^(?:id|uid|uuid|guid|globalrecordid)$/.test(compactName)
    || /(?:case|record|person|patient|subject)id$/.test(compactName);
  return (normalizedName === "globalrecordid" ? 100 : 0)
    + (field.rules?.some((rule) => rule.kind === "unique") ? 80 : 0)
    + (field.type === "unique-id" ? 60 : 0)
    + (identifierName || /_id$/i.test(field.name) ? 40 : 0)
    + (/(?:^|[_\s])identifier(?:$|[_\s])/i.test(identifierLabel) ? 20 : 0);
}

/**
 * Return only fields that can safely identify one incoming and one destination
 * record. A field must have identifier semantics, be complete, and be unique
 * on both sides. This deliberately excludes categorical values, measurements,
 * and repeated matched-set identifiers from the import merge-key selector.
 */
export function candidateImportKeys(
  fields: readonly FieldDefinition[],
  current: readonly EpiRecord[],
  incoming: readonly EpiRecord[],
): FieldDefinition[] {
  return fields.map((field, index) => ({ field, index, score: importKeyScore(field) }))
    .filter(({ field, score }) => field.type !== "command-button"
      && score > 0
      && incoming.length > 0
      && incoming.every((record) => folded(record[field.name]) !== "")
      && duplicateCount(incoming.map((record) => folded(record[field.name]))) === 0
      && current.every((record) => folded(record[field.name]) !== "")
      && duplicateCount(current.map((record) => folded(record[field.name]))) === 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ field }) => field);
}

export function suggestedImportKey(
  fields: readonly FieldDefinition[],
  incoming: readonly EpiRecord[],
  current: readonly EpiRecord[] = [],
): string | undefined {
  return candidateImportKeys(fields, current, incoming)[0]?.name;
}

export function buildDataImportPreview(input: {
  fields: readonly FieldDefinition[];
  current: readonly EpiRecord[];
  incoming: readonly EpiRecord[];
  keyField?: string;
  provenance: DatasetProvenance;
  priorImports: readonly DatasetProvenance[];
  invalidRecords?: number;
}): DataImportPreview {
  const keyField = input.keyField?.trim() || undefined;
  const exactFilePreviouslyImported = input.priorImports.some(({ sha256 }) => sha256.toLowerCase() === input.provenance.sha256.toLowerCase());
  if (!keyField) {
    return {
      version: DATA_IMPORT_PREVIEW_VERSION,
      incoming: input.incoming.length,
      newRecords: input.incoming.length,
      matchingRecords: 0,
      changedRecords: 0,
      unchangedRecords: 0,
      blankIncomingKeys: 0,
      duplicateIncomingKeys: 0,
      duplicateDestinationKeys: 0,
      invalidRecords: input.invalidRecords ?? 0,
      exactFilePreviouslyImported,
      canMerge: false,
    };
  }
  if (!input.fields.some(({ name }) => name === keyField)) throw new RangeError(`${keyField} is not a current form field.`);
  const incomingKeys = input.incoming.map((record) => folded(record[keyField]));
  const destinationKeys = input.current.map((record) => folded(record[keyField]));
  const blankIncomingKeys = incomingKeys.filter((key) => !key).length;
  const duplicateIncomingKeys = duplicateCount(incomingKeys);
  const duplicateDestinationKeys = duplicateCount(destinationKeys);
  const destinationByKey = new Map(input.current.map((record) => [folded(record[keyField]), record]).filter(([key]) => Boolean(key)) as Array<[string, EpiRecord]>);
  let newRecords = 0;
  let changedRecords = 0;
  let unchangedRecords = 0;
  for (let index = 0; index < input.incoming.length; index++) {
    const existing = destinationByKey.get(incomingKeys[index]!);
    if (!existing) newRecords++;
    else if (sameRecord(existing, input.incoming[index]!, input.fields)) unchangedRecords++;
    else changedRecords++;
  }
  return {
    version: DATA_IMPORT_PREVIEW_VERSION,
    keyField,
    incoming: input.incoming.length,
    newRecords,
    matchingRecords: changedRecords + unchangedRecords,
    changedRecords,
    unchangedRecords,
    blankIncomingKeys,
    duplicateIncomingKeys,
    duplicateDestinationKeys,
    invalidRecords: input.invalidRecords ?? 0,
    exactFilePreviouslyImported,
    canMerge: (input.invalidRecords ?? 0) === 0 && blankIncomingKeys === 0 && duplicateIncomingKeys === 0 && duplicateDestinationKeys === 0,
  };
}

export function applyDataImport(
  current: readonly EpiRecord[],
  incoming: readonly EpiRecord[],
  preview: DataImportPreview,
  mode: DataImportMode,
): EpiRecord[] {
  if (mode === "replace") return structuredClone([...incoming]);
  if (!preview.keyField || !preview.canMerge) throw new RangeError("Choose a unique, complete matching key before merging records.");
  const keyField = preview.keyField;
  const result = structuredClone([...current]);
  const positions = new Map(result.map((record, index) => [folded(record[keyField]), index]).filter(([key]) => Boolean(key)) as Array<[string, number]>);
  for (const record of incoming) {
    const position = positions.get(folded(record[keyField]));
    if (position === undefined) {
      if (mode === "update-and-append" || mode === "append-new") result.push(structuredClone(record));
    } else if (mode === "update-and-append" || mode === "update-only") {
      const merged = structuredClone(result[position]!);
      for (const [field, value] of Object.entries(record)) {
        if (field === keyField || comparable(value) !== "") merged[field] = structuredClone(value);
      }
      result[position] = merged;
    }
  }
  return result;
}
