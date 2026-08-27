import type { EpiRecord, FieldDefinition, FieldType, FormSchema, RecordValue } from "../contracts/core.js";

async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read the CSV file.")));
    reader.readAsText(file);
  });
}

export async function readCsvText(file: File): Promise<string> {
  if (!/\.csv$/i.test(file.name)) {
    if (/\.xlsx?$/i.test(file.name)) {
      throw new Error("This is an Excel workbook, not a CSV file. In Excel, use Save As and choose CSV UTF-8, then upload that .csv file.");
    }
    throw new Error("Choose a file whose name ends in .csv.");
  }

  if (typeof file.arrayBuffer !== "function") {
    const text = await readFileText(file);
    if (text.startsWith("PK\u0003\u0004") || text.includes("\u0000")) {
      throw new Error("This appears to be a binary spreadsheet, not a CSV text file. Save it as CSV UTF-8 and try again.");
    }
    return text;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    throw new Error("This appears to be an Excel .xlsx workbook, not a CSV file. Save it as CSV UTF-8 and try again.");
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

export function normalizeFieldName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

export function fieldPrompt(header: string): string {
  const words = header.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const prompt = words ? (words[0]?.toUpperCase() ?? "") + words.slice(1) : "Field";
  return prompt.replace(/\b(id|dob|ssn)\b/gi, (word) => word.toUpperCase());
}

export function inferFieldType(name: string, values: string[]): FieldType {
  const populated = values.map((value) => value.trim()).filter(Boolean);
  if (populated.length === 0) return "text";
  if (/(_id|^id$|code|zip|postal)/i.test(name)) return "text";
  if (populated.every((value) => /^(yes|no|unknown)$/i.test(value))) return "yes-no";
  if (populated.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) return "date";
  if (populated.every((value) => value !== "" && Number.isFinite(Number(value)))) return "number";
  return "text";
}

function escapeCsv(value: RecordValue | undefined): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(schemaDefinition: FormSchema, dataRecords: EpiRecord[]): string {
  const headers = schemaDefinition.fields.map((field) => field.name);
  const lines = [headers.map(escapeCsv).join(",")];
  for (const record of dataRecords) {
    lines.push(headers.map((header) => escapeCsv(record[header])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function parseDelimited(text: string, delimiter: "," | "\t"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === delimiter) {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else if (character !== undefined) {
      value += character;
    }
  }
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

export function parseCsv(text: string): string[][] {
  return parseDelimited(text, ",");
}

export function parseTsv(text: string): string[][] {
  return parseDelimited(text, "\t");
}

export interface CsvInferenceResult {
  schema: FormSchema;
  records: EpiRecord[];
}

export function inferSchemaFromRows(fileName: string, rows: string[][]): CsvInferenceResult {
  const firstRow = rows[0];
  if (!firstRow || firstRow.length === 0) throw new Error("The data file is empty.");
  const headers = firstRow.map((header) => header.replace(/^\ufeff/, "").trim());
  const columnCount = Math.max(...rows.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    index,
    header: headers[index] ?? "",
    hasData: rows.slice(1).some((row) => String(row[index] ?? "").trim() !== ""),
  })).filter((column) => column.header || column.hasData);
  if (columns.length === 0) throw new Error("The data file has no usable columns.");

  const usedNames = new Set<string>();
  const fields: FieldDefinition[] = columns.map((column) => {
    const header = column.header || `Field ${column.index + 1}`;
    const baseName = normalizeFieldName(header) || `field_${column.index + 1}`;
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${baseName}_${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    return {
      name,
      prompt: fieldPrompt(header),
      type: inferFieldType(name, rows.slice(1).map((row) => row[column.index] ?? "")),
      required: false,
    };
  });

  const baseFileName = fileName.replace(/\.(csv|tsv|json|xlsx)$/i, "").replace(/[_-]+/g, " ").trim();
  const formName = (baseFileName || "Imported")
    .split(/\s+/)
    .map((word) => fieldPrompt(word))
    .join(" ") + " Form";
  const records: EpiRecord[] = rows.slice(1).map((row) => Object.fromEntries(
    fields.map((field, fieldIndex) => [field.name, row[columns[fieldIndex]!.index] ?? ""]),
  ));
  return { schema: { name: formName, fields }, records };
}

export function inferSchemaFromCsv(fileName: string, rows: string[][]): CsvInferenceResult {
  return inferSchemaFromRows(fileName, rows);
}
