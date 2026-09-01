import type { Column } from "mdb-reader";
import { parseClassicProgram } from "./classic-ast.ts";

export const FILE_CONVERT_PLAN_VERSION = "0.1.0" as const;
export type FileConvertTarget = "sqlite" | "duckdb";

export interface FileConvertPlan {
  version: typeof FILE_CONVERT_PLAN_VERSION;
  inputFile: string;
  outputFile: string;
  target: FileConvertTarget;
  canonicalSource: string;
}

export interface FileConvertTableResult { name: string; columns: number; rows: number }
export interface FileConvertResult {
  bytes: Uint8Array;
  sourceSha256: string;
  target: FileConvertTarget;
  engineVersion: string;
  tables: FileConvertTableResult[];
  warnings: string[];
}

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;
const quoteSqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const targetForOutput = (outputFile: string): FileConvertTarget => {
  if (/\.sqlite$/i.test(outputFile)) return "sqlite";
  if (/\.duckdb$/i.test(outputFile)) return "duckdb";
  throw new RangeError("The output filename must end in .sqlite or .duckdb.");
};
const sqliteType = (column: Column): "INTEGER" | "REAL" | "TEXT" | "BLOB" => {
  if (["boolean", "byte", "integer", "long", "bigint"].includes(column.type)) return "INTEGER";
  if (["float", "double"].includes(column.type)) return "REAL";
  if (["binary", "ole"].includes(column.type)) return "BLOB";
  return "TEXT";
};

function sqliteValue(value: unknown): string | number | bigint | Uint8Array | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") return value;
  if (value instanceof Uint8Array) return value;
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested instanceof Uint8Array ? Array.from(nested) : nested);
}

const duckdbType = (column: Column): string => {
  if (column.type === "boolean") return "BOOLEAN";
  if (column.type === "byte") return "UTINYINT";
  if (column.type === "integer") return "SMALLINT";
  if (column.type === "long") return "INTEGER";
  if (column.type === "bigint") return "BIGINT";
  if (column.type === "float") return "FLOAT";
  if (column.type === "double") return "DOUBLE";
  if (column.type === "currency") return "DECIMAL(19,4)";
  if (column.type === "numeric") {
    const precision = Math.min(Math.max(column.precision ?? 18, 1), 38);
    const scale = Math.min(Math.max(column.scale ?? 0, 0), precision);
    return `DECIMAL(${precision},${scale})`;
  }
  if (["datetime", "datetimextended"].includes(column.type)) return "TIMESTAMP";
  if (column.type === "repid") return "UUID";
  if (["binary", "ole"].includes(column.type)) return "BLOB";
  return "VARCHAR";
};

function duckdbValue(value: unknown, column: Column): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (typeof value === "bigint") return value.toString();
  if (["string", "number", "boolean"].includes(typeof value)) return value as string | number | boolean;
  if (column.type === "complex") return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested instanceof Uint8Array ? [...nested].map((byte) => byte.toString(16).padStart(2, "0")).join("") : nested);
  return JSON.stringify(value, (_key, nested) => typeof nested === "bigint" ? nested.toString() : nested instanceof Uint8Array ? Array.from(nested) : nested);
}

const duckdbImportExpression = (column: Column): string => {
  const identifier = quoteIdentifier(column.name);
  return ["binary", "ole"].includes(column.type)
    ? `CASE WHEN ${identifier} IS NULL THEN NULL ELSE from_hex(${identifier}) END`
    : `CAST(${identifier} AS ${duckdbType(column)})`;
};

async function duckdbQuery(connection: { query(sql: string): Promise<unknown> }, sql: string, context: string): Promise<void> {
  try { await connection.query(sql); }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${detail || "the DuckDB worker returned no diagnostic"}.`);
  }
}

export function buildFileConvertCommand(inputFile: string, outputFile: string): string {
  if (!/\.(?:mdb|accdb)$/i.test(inputFile)) throw new RangeError("Choose an .mdb or .accdb input file.");
  targetForOutput(outputFile);
  return `FILE CONVERT ${JSON.stringify(inputFile)} TO ${JSON.stringify(outputFile)}`;
}

export function resolveFileConvertCommand(source: string): FileConvertPlan {
  const ast = parseClassicProgram(source);
  const statement = ast.body[0];
  if (ast.body.length !== 1 || statement?.type !== "FileConvertStatement") throw new RangeError("Select exactly one FILE CONVERT command.");
  return { version: FILE_CONVERT_PLAN_VERSION, inputFile: statement.inputFile, outputFile: statement.outputFile, target: targetForOutput(statement.outputFile), canonicalSource: buildFileConvertCommand(statement.inputFile, statement.outputFile) };
}

async function readAccessSource(file: File, plan: FileConvertPlan) {
  if (file.name.toLocaleLowerCase("en-US") !== plan.inputFile.toLocaleLowerCase("en-US")) throw new RangeError(`Choose ${plan.inputFile}; the selected file is ${file.name}.`);
  const sourceBytes = new Uint8Array(await file.arrayBuffer());
  const sourceSha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", sourceBytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const [{ Buffer }, { default: process }] = await Promise.all([import("buffer"), import("process")]);
  (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
  (globalThis as unknown as { process: typeof process }).process = process;
  const { default: MDBReader } = await import("mdb-reader");
  const reader = new MDBReader(Buffer.from(sourceBytes));
  return { reader, sourceSha256 };
}

export async function convertAccessFileToSqlite(file: File, plan: FileConvertPlan): Promise<FileConvertResult> {
  if (plan.target !== "sqlite") throw new RangeError("The selected FILE CONVERT plan is not a SQLite target.");
  const { reader, sourceSha256 } = await readAccessSource(file, plan);
  const { default: sqlite3InitModule } = await import("@sqlite.org/sqlite-wasm");
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(":memory:", "c");
  const tables: FileConvertTableResult[] = [];
  const warnings = ["Forms, reports, macros, VBA, relationships, indexes, and saved Access query semantics are not migrated in V0.1."];
  try {
    db.exec("BEGIN");
    for (const tableName of reader.getTableNames()) {
      const table = reader.getTable(tableName);
      const columns = table.getColumns();
      if (!columns.length) { warnings.push(`${tableName}: skipped because it has no readable columns.`); continue; }
      db.exec(`CREATE TABLE ${quoteIdentifier(tableName)} (${columns.map((column) => `${quoteIdentifier(column.name)} ${sqliteType(column)}`).join(", ")})`);
      const statement = db.prepare(`INSERT INTO ${quoteIdentifier(tableName)} VALUES (${columns.map(() => "?").join(", ")})`);
      const rows = table.getData();
      try {
        for (const row of rows) {
          statement.bind(columns.map((column) => sqliteValue(row[column.name])));
          statement.step();
          statement.reset(true);
        }
      } finally { statement.finalize(); }
      tables.push({ name: tableName, columns: columns.length, rows: rows.length });
    }
    db.exec("CREATE TABLE _epi_migration_manifest (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
    const manifest = { schemaVersion: 1, sourceFile: file.name, sourceSha256, createdAt: new Date().toISOString(), tables, warnings };
    const manifestStatement = db.prepare("INSERT INTO _epi_migration_manifest VALUES (?, ?)");
    try { manifestStatement.bind(["migration", JSON.stringify(manifest)]).step(); } finally { manifestStatement.finalize(); }
    db.exec("COMMIT");
    return { bytes: sqlite3.capi.sqlite3_js_db_export(db), sourceSha256, target: "sqlite", engineVersion: sqlite3.version.libVersion, tables, warnings };
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch { /* Preserve the original conversion error. */ }
    throw error;
  } finally { db.close(); }
}

export async function convertAccessFileToDuckdb(file: File, plan: FileConvertPlan): Promise<FileConvertResult> {
  if (plan.target !== "duckdb") throw new RangeError("The selected FILE CONVERT plan is not a DuckDB target.");
  const { reader, sourceSha256 } = await readAccessSource(file, plan);
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: new URL("duckdb-mvp.wasm", import.meta.url).href, mainWorker: new URL("duckdb-browser-mvp.worker.js", import.meta.url).href },
    eh: { mainModule: new URL("duckdb-eh.wasm", import.meta.url).href, mainWorker: new URL("duckdb-browser-eh.worker.js", import.meta.url).href },
  });
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
  const databaseName = `access-migration-${crypto.randomUUID()}.duckdb`;
  const databasePath = databaseName;
  const tables: FileConvertTableResult[] = [];
  const warnings = [
    "Forms, reports, macros, VBA, relationships, indexes, and saved Access query semantics are not migrated in V0.1.",
    "DuckDB is the analytical conversion target; use SQLite for the browser operational project store.",
    "V0.1 initializes the writable browser database from DuckDB's public test database; self-hosting the reviewed seed is required before offline or production claims.",
  ];
  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const seedResponse = await fetch("https://blobs.duckdb.org/data/test.db");
    if (!seedResponse.ok) throw new Error(`DuckDB seed request failed with HTTP ${seedResponse.status}.`);
    await db.registerFileBuffer(databasePath, new Uint8Array(await seedResponse.arrayBuffer()));
    await db.open({ path: databasePath, accessMode: duckdb.DuckDBAccessMode.READ_WRITE, arrowLosslessConversion: true });
    const connection = await db.connect();
    let bytes: Uint8Array | null = null;
    try {
      const seedObjects = await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'");
      for (const row of seedObjects.toArray() as unknown as Array<{ table_name: string }>) await connection.query(`DROP TABLE ${quoteIdentifier(String(row.table_name))}`);
      await connection.query("BEGIN TRANSACTION");
      for (const [tableIndex, tableName] of reader.getTableNames().entries()) {
        const table = reader.getTable(tableName);
        const columns = table.getColumns();
        if (!columns.length) { warnings.push(`${tableName}: skipped because it has no readable columns.`); continue; }
        await connection.query(`CREATE TABLE ${quoteIdentifier(tableName)} (${columns.map((column) => `${quoteIdentifier(column.name)} ${duckdbType(column)}`).join(", ")})`);
        const rows = table.getData();
        if (rows.length) {
          const stagingPath = `_epi_access_${tableIndex}.json`;
          const stagedRows = rows.map((row) => Object.fromEntries(columns.map((column) => [column.name, duckdbValue(row[column.name], column)])));
          await db.registerFileText(stagingPath, JSON.stringify(stagedRows));
          try {
            try {
              await connection.query(`INSERT INTO ${quoteIdentifier(tableName)} SELECT ${columns.map(duckdbImportExpression).join(", ")} FROM read_json_auto(${quoteSqlString(stagingPath)}, format = 'array')`);
            } catch (error) {
              const detail = error instanceof Error ? error.message : String(error);
              throw new Error(`DuckDB import failed for Access table ${tableName}: ${detail || "the DuckDB worker returned no diagnostic"}.`);
            }
          } finally { await db.dropFile(stagingPath); }
        }
        tables.push({ name: tableName, columns: columns.length, rows: rows.length });
      }
      await connection.query("CREATE TABLE _epi_migration_manifest (key VARCHAR PRIMARY KEY, value JSON NOT NULL)");
      const manifest = { schemaVersion: 1, target: "duckdb", sourceFile: file.name, sourceSha256, createdAt: new Date().toISOString(), tables, warnings };
      const manifestStatement = await connection.prepare("INSERT INTO _epi_migration_manifest VALUES (?, ?)");
      try { await manifestStatement.query("migration", JSON.stringify(manifest)); } finally { await manifestStatement.close(); }
      await connection.query("COMMIT");
      await duckdbQuery(connection, "CHECKPOINT", "DuckDB could not checkpoint the downloadable database");
      bytes = await db.copyFileToBuffer(databasePath);
    } catch (error) {
      try { await connection.query("ROLLBACK"); } catch { /* Preserve the original conversion error. */ }
      throw error;
    } finally {
      try { await connection.close(); }
      catch (error) { console.warn("DuckDB connection cleanup reported an error; the database worker will be terminated.", error); }
    }
    if (!bytes) throw new Error("DuckDB did not produce a downloadable database buffer.");
    return { bytes, sourceSha256, target: "duckdb", engineVersion: await db.getVersion(), tables, warnings };
  } finally {
    try { await db.terminate(); }
    catch (error) { console.warn("DuckDB worker cleanup reported an error.", error); }
  }
}

export async function convertAccessFile(file: File, plan: FileConvertPlan): Promise<FileConvertResult> {
  return plan.target === "duckdb" ? convertAccessFileToDuckdb(file, plan) : convertAccessFileToSqlite(file, plan);
}
