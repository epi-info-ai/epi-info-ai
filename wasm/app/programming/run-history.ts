export const RUN_HISTORY_VERSION = 1 as const;
export const RUN_HISTORY_STORAGE_KEY = "epi-info-ai.run-history.v1";

export type RunOrigin = "manual" | "user-program" | "visual-flow" | "epi-assist" | "plugin";
export type RunStatus = "verified" | "succeeded" | "failed";

export interface ProgramRunHistoryEntry {
  version: typeof RUN_HISTORY_VERSION;
  id: string;
  occurredAt: string;
  origin: RunOrigin;
  status: RunStatus;
  planVersion: string;
  astVersion?: string;
  projectName: string;
  formName: string;
  sourceRecords: number;
  source: string;
  canonicalSource?: string;
  summary: string;
  diagnostics: string[];
}

function isEntry(value: unknown): value is ProgramRunHistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<ProgramRunHistoryEntry>;
  return entry.version === RUN_HISTORY_VERSION
    && typeof entry.id === "string"
    && typeof entry.occurredAt === "string"
    && ["manual", "user-program", "visual-flow", "epi-assist", "plugin"].includes(String(entry.origin))
    && ["verified", "succeeded", "failed"].includes(String(entry.status))
    && typeof entry.source === "string"
    && typeof entry.summary === "string"
    && Array.isArray(entry.diagnostics);
}

export function readProgramRunHistory(storage: Storage = localStorage): ProgramRunHistoryEntry[] {
  try {
    const parsed = JSON.parse(storage.getItem(RUN_HISTORY_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, 100) : [];
  } catch {
    return [];
  }
}

export function appendProgramRunHistory(
  entry: Omit<ProgramRunHistoryEntry, "version" | "id" | "occurredAt">,
  storage: Storage = localStorage,
): ProgramRunHistoryEntry {
  const complete: ProgramRunHistoryEntry = {
    version: RUN_HISTORY_VERSION,
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    ...entry,
  };
  const history = [complete, ...readProgramRunHistory(storage)].slice(0, 100);
  storage.setItem(RUN_HISTORY_STORAGE_KEY, JSON.stringify(history));
  return complete;
}
