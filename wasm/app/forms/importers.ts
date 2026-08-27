import { readSheet } from "read-excel-file/browser";
import { parseCsv, parseTsv, readCsvText } from "./csv.ts";

export const TABULAR_FILE_ACCEPT = [
  ".csv",
  ".tsv",
  ".json",
  ".xlsx",
  "text/csv",
  "text/tab-separated-values",
  "application/json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
].join(",");

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_CELLS = 500_000;

export type TabularSourceKind = "csv" | "tsv" | "json" | "xlsx";

export interface TabularImport {
  kind: TabularSourceKind;
  rows: string[][];
}

type JsonScalar = string | number | boolean | null;

function scalarText(value: unknown, context: string): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().replace(/T00:00:00\.000Z$/, "");
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  throw new Error(`${context} contains a nested object or array. Tabular JSON values must be strings, numbers, booleans, or null.`);
}

export function parseJsonRecords(text: string): string[][] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("The JSON file is not valid JSON.");
  }
  const candidate = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { records?: unknown }).records)
      ? (parsed as { records: unknown[] }).records
      : undefined;
  if (!candidate || candidate.length === 0) {
    throw new Error('JSON input must be a non-empty array of record objects, or an object with a non-empty "records" array.');
  }
  if (candidate.some((record) => typeof record !== "object" || record === null || Array.isArray(record))) {
    throw new Error("Every JSON record must be an object.");
  }
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const record of candidate as Record<string, JsonScalar>[]) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  if (headers.length === 0) throw new Error("The JSON records contain no fields.");
  return [headers, ...(candidate as Record<string, JsonScalar>[]).map((record, rowIndex) =>
    headers.map((header) => scalarText(record[header], `JSON record ${rowIndex + 1}, field ${header}`)),
  )];
}

async function readEncodedText(file: File): Promise<string> {
  if (typeof file.arrayBuffer === "function") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
    if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
    return new TextDecoder("utf-8").decode(bytes);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read the data file.")));
    reader.readAsText(file);
  });
}

function enforceLimits(file: File, rows?: string[][]): void {
  if (file.size > MAX_SOURCE_BYTES) throw new Error("Choose a data file no larger than 10 MB for this browser demo.");
  if (rows && rows.reduce((total, row) => total + row.length, 0) > MAX_CELLS) {
    throw new Error("This data file exceeds the demo limit of 500,000 cells.");
  }
}

export async function readTabularFile(file: File): Promise<TabularImport> {
  enforceLimits(file);
  const extension = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1];
  let kind: TabularSourceKind;
  let rows: string[][];
  if (extension === "xlsx") {
    kind = "xlsx";
    const sheet = await readSheet(file);
    rows = sheet.map((row, rowIndex) => row.map((cell, columnIndex) =>
      scalarText(cell, `Excel row ${rowIndex + 1}, column ${columnIndex + 1}`),
    ));
  } else if (extension === "csv") {
    kind = "csv";
    rows = parseCsv(await readCsvText(file));
  } else if (extension === "tsv") {
    kind = "tsv";
    rows = parseTsv(await readEncodedText(file));
  } else if (extension === "json") {
    kind = "json";
    rows = parseJsonRecords(await readEncodedText(file));
  } else if (extension === "xls") {
    throw new Error("Legacy .xls workbooks are not supported yet. Save the workbook as .xlsx, CSV UTF-8, or TSV.");
  } else {
    throw new Error("Choose a CSV, TSV, JSON, or Excel .xlsx file.");
  }
  enforceLimits(file, rows);
  if (rows.length === 0) throw new Error("The data file is empty.");
  return { kind, rows };
}
