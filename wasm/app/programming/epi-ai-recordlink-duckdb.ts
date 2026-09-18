import type { EpiRecord, FieldDefinition, RecordValue } from "../contracts/core.ts";
import type { RecordLinkAuditArtifact } from "./epi-ai-recordlink-audit.ts";
import type { RecordLinkPersonOutput } from "./epi-ai-recordlink-output.ts";
import { loadDuckDbSeed, type DuckDbSeedResult } from "./duckdb-seed.ts";

export const RECORDLINK_DUCKDB_VERSION = "0.1.0" as const;

export interface RecordLinkDuckDbManifest {
  schemaVersion: 1;
  version: typeof RECORDLINK_DUCKDB_VERSION;
  kind: "epi-info-ai.recordlink-duckdb";
  createdAt: string;
  projectName: string;
  resultName: string;
  auditFingerprint: string;
  candidateFingerprint: string;
  command: string;
  tables: Array<{ name: string; rows: number }>;
  seed: { version: string; sha256: string; storage: DuckDbSeedResult["storage"] };
  governance: { sourceMutationExecuted: false; mergeExecuted: false; automaticDownloadExecuted: false };
}

export interface RecordLinkDuckDbResult {
  bytes: Uint8Array;
  engineVersion: string;
  manifest: RecordLinkDuckDbManifest;
}

const quoteIdentifier = (value: string): string => `"${value.replaceAll('"', '""')}"`;
const quoteSqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`;
const outputType = (type: FieldDefinition["type"]): "DOUBLE" | "BOOLEAN" | "VARCHAR" =>
  type === "number" ? "DOUBLE" : type === "checkbox" || type === "yes-no" ? "BOOLEAN" : "VARCHAR";

function jsonValue(value: RecordValue | undefined): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return JSON.stringify(value);
}

interface DuckDbTable {
  name: string;
  columns: Array<{ name: string; type: string }>;
  rows: Array<Record<string, string | number | boolean | null>>;
}

export function recordLinkDuckDbTables(output: RecordLinkPersonOutput, audit: RecordLinkAuditArtifact): DuckDbTable[] {
  if (audit.plan.resultName.toLocaleLowerCase("en-US") !== output.resultName.replace(/_Persons$/i, "").toLocaleLowerCase("en-US")) {
    throw new RangeError("The RECORDLINK person output and audit artifact do not describe the same result.");
  }
  const peopleColumns = [
    { name: "person_id", type: "VARCHAR" }, { name: "source_count", type: "INTEGER" },
    ...output.fields.map((field) => ({ name: field.outputField, type: outputType(field.type) })),
  ];
  return [
    {
      name: output.resultName,
      columns: peopleColumns,
      rows: output.records.map((record) => Object.fromEntries(peopleColumns.map(({ name }) => [name, jsonValue(record[name])]))),
    },
    {
      name: "_recordlink_provenance",
      columns: [
        { name: "person_id", type: "VARCHAR" }, { name: "output_field", type: "VARCHAR" },
        { name: "selected_source_role", type: "VARCHAR" }, { name: "selected_source_field", type: "VARCHAR" },
        { name: "fallback_used", type: "BOOLEAN" }, { name: "disagreement", type: "BOOLEAN" },
      ],
      rows: output.provenance.map((row) => ({ person_id: row.personId, output_field: row.outputField, selected_source_role: row.selectedSourceRole, selected_source_field: row.selectedSourceField, fallback_used: row.fallbackUsed, disagreement: row.disagreement })),
    },
    {
      name: "_recordlink_person",
      columns: [{ name: "person_id", type: "VARCHAR" }, { name: "member_count", type: "INTEGER" }, { name: "linked", type: "BOOLEAN" }, { name: "candidate_numbers", type: "JSON" }],
      rows: audit.personTable.map((row) => ({ person_id: row.personId, member_count: row.memberCount, linked: row.linked, candidate_numbers: JSON.stringify(row.candidateNumbers) })),
    },
    {
      name: "_recordlink_membership",
      columns: [{ name: "person_id", type: "VARCHAR" }, { name: "source_role", type: "VARCHAR" }, { name: "source_record_ordinal", type: "INTEGER" }],
      rows: audit.membershipTable.map((row) => ({ person_id: row.personId, source_role: row.sourceRole, source_record_ordinal: row.sourceRecordOrdinal })),
    },
    {
      name: "_recordlink_link",
      columns: [{ name: "candidate_number", type: "INTEGER" }, { name: "person_id", type: "VARCHAR" }, { name: "score", type: "INTEGER" }, { name: "maximum_score", type: "INTEGER" }, { name: "authority", type: "VARCHAR" }, { name: "decision_reason", type: "VARCHAR" }, { name: "decided_at", type: "VARCHAR" }],
      rows: audit.linkTable.map((row) => ({ candidate_number: row.candidateNumber, person_id: row.personId, score: row.score, maximum_score: row.maximumScore, authority: row.authority, decision_reason: row.decisionReason, decided_at: row.decidedAt })),
    },
    {
      name: "_recordlink_rejected_link",
      columns: [{ name: "candidate_number", type: "INTEGER" }, { name: "reason", type: "VARCHAR" }],
      rows: audit.rejectedLinkTable.map((row) => ({ candidate_number: row.candidateNumber, reason: row.reason })),
    },
    {
      name: "_recordlink_decision",
      columns: [{ name: "candidate_number", type: "INTEGER" }, { name: "automatic_classification", type: "VARCHAR" }, { name: "decision", type: "VARCHAR" }, { name: "effective_classification", type: "VARCHAR" }, { name: "reason", type: "VARCHAR" }, { name: "decided_at", type: "VARCHAR" }],
      rows: audit.decisionTable.map((row) => ({ candidate_number: row.candidateNumber, automatic_classification: row.automaticClassification, decision: row.decision, effective_classification: row.effectiveClassification, reason: row.reason, decided_at: row.decidedAt })),
    },
  ];
}

export async function createRecordLinkDuckDb(
  projectName: string,
  output: RecordLinkPersonOutput,
  audit: RecordLinkAuditArtifact,
  createdAt = new Date().toISOString(),
): Promise<RecordLinkDuckDbResult> {
  if (!projectName.trim()) throw new RangeError("A project name is required for RECORDLINK DuckDB output.");
  if (Number.isNaN(Date.parse(createdAt))) throw new RangeError("RECORDLINK DuckDB creation time must be an ISO date/time.");
  const tables = recordLinkDuckDbTables(output, audit);
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundle = await duckdb.selectBundle({
    mvp: { mainModule: new URL("./duckdb-mvp.wasm", document.baseURI).href, mainWorker: new URL("./duckdb-browser-mvp.worker.js", document.baseURI).href },
    eh: { mainModule: new URL("./duckdb-eh.wasm", document.baseURI).href, mainWorker: new URL("./duckdb-browser-eh.worker.js", document.baseURI).href },
  });
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), worker);
  const databasePath = `recordlink-${crypto.randomUUID()}.duckdb`;
  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    const seed = await loadDuckDbSeed();
    const manifest: RecordLinkDuckDbManifest = {
      schemaVersion: 1, version: RECORDLINK_DUCKDB_VERSION, kind: "epi-info-ai.recordlink-duckdb", createdAt,
      projectName, resultName: output.resultName, auditFingerprint: audit.auditFingerprint,
      candidateFingerprint: audit.candidateSet.fingerprint, command: audit.plan.canonicalSource,
      tables: tables.map(({ name, rows }) => ({ name, rows: rows.length })),
      seed: { version: seed.version, sha256: seed.sha256, storage: seed.storage },
      governance: { sourceMutationExecuted: false, mergeExecuted: false, automaticDownloadExecuted: false },
    };
    await db.registerFileBuffer(databasePath, seed.bytes);
    await db.open({ path: databasePath, accessMode: duckdb.DuckDBAccessMode.READ_WRITE, arrowLosslessConversion: true });
    const connection = await db.connect();
    let bytes: Uint8Array | null = null;
    try {
      const seedObjects = await connection.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'");
      for (const row of seedObjects.toArray() as unknown as Array<{ table_name: string }>) await connection.query(`DROP TABLE ${quoteIdentifier(String(row.table_name))}`);
      await connection.query("BEGIN TRANSACTION");
      for (const [index, table] of tables.entries()) {
        await connection.query(`CREATE TABLE ${quoteIdentifier(table.name)} (${table.columns.map(({ name, type }) => `${quoteIdentifier(name)} ${type}`).join(", ")})`);
        if (table.rows.length) {
          const stagingPath = `_epi_recordlink_${index}.json`;
          await db.registerFileText(stagingPath, JSON.stringify(table.rows));
          try {
            const selections = table.columns.map(({ name, type }) => `CAST(${quoteIdentifier(name)} AS ${type})`).join(", ");
            await connection.query(`INSERT INTO ${quoteIdentifier(table.name)} SELECT ${selections} FROM read_json_auto(${quoteSqlString(stagingPath)}, format = 'array')`);
          } finally { await db.dropFile(stagingPath); }
        }
      }
      await connection.query("CREATE TABLE _epi_recordlink_manifest (key VARCHAR PRIMARY KEY, value JSON NOT NULL)");
      const statement = await connection.prepare("INSERT INTO _epi_recordlink_manifest VALUES (?, ?)");
      try { await statement.query("recordlink", JSON.stringify(manifest)); } finally { await statement.close(); }
      await connection.query("COMMIT");
      await connection.query("CHECKPOINT");
      bytes = await db.copyFileToBuffer(databasePath);
    } catch (error) {
      try { await connection.query("ROLLBACK"); } catch { /* Preserve the original creation error. */ }
      throw error;
    } finally { await connection.close().catch(() => undefined); }
    if (!bytes) throw new Error("DuckDB did not produce a downloadable RECORDLINK database.");
    return { bytes, engineVersion: await db.getVersion(), manifest };
  } finally { await db.terminate().catch(() => undefined); }
}
