export const PROJECT_SNAPSHOT_VERSION = 1 as const;

export type FieldType =
  | "text"
  | "text-uppercase"
  | "multiline"
  | "unique-id"
  | "number"
  | "phone"
  | "date"
  | "time"
  | "checkbox"
  | "yes-no"
  | "option";

export type RecordValue = string | number | boolean | null;
export type EpiRecord = Record<string, RecordValue>;

export interface FieldDefinition {
  name: string;
  prompt: string;
  type: FieldType;
  required: boolean;
  x?: number;
  y?: number;
}

export interface FormSchema {
  name: string;
  fields: FieldDefinition[];
}

export interface ProjectForm {
  id: string;
  schema: FormSchema;
  records: EpiRecord[];
}

export interface BrowserStorageLocation {
  type: "browser";
}

export interface SupabaseStorageLocation {
  type: "supabase";
}

export type ProjectStorageLocation = BrowserStorageLocation | SupabaseStorageLocation;

export interface HostedProjectReference {
  id: string;
  revision: number;
  syncedAt?: string;
}

export interface ProjectSnapshotV1 {
  version?: typeof PROJECT_SNAPSHOT_VERSION;
  name: string;
  currentFormId: string;
  storage?: ProjectStorageLocation;
  remote?: HostedProjectReference;
  forms: ProjectForm[];
}

export interface MapPoint {
  record: EpiRecord;
  recordIndex: number;
  latitude: number;
  longitude: number;
}

const FIELD_TYPES: ReadonlySet<FieldType> = new Set([
  "text",
  "text-uppercase",
  "multiline",
  "unique-id",
  "number",
  "phone",
  "date",
  "time",
  "checkbox",
  "yes-no",
  "option",
]);

export class ProjectSnapshotValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ProjectSnapshotValidationError";
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new ProjectSnapshotValidationError(path, message);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(path, "must be an object");
  }
  return value as Record<string, unknown>;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(path, "must be a non-empty string");
  }
  return value;
}

function fieldDefinitionAt(value: unknown, path: string): FieldDefinition {
  const field = objectAt(value, path);
  const type = nonEmptyString(field.type, `${path}.type`);
  if (!FIELD_TYPES.has(type as FieldType)) {
    fail(`${path}.type`, `unsupported field type ${JSON.stringify(type)}`);
  }
  if (typeof field.required !== "boolean") {
    fail(`${path}.required`, "must be a boolean");
  }
  const result: FieldDefinition = {
    name: nonEmptyString(field.name, `${path}.name`),
    prompt: nonEmptyString(field.prompt, `${path}.prompt`),
    type: type as FieldType,
    required: field.required,
  };
  if (field.x !== undefined) {
    if (typeof field.x !== "number" || !Number.isFinite(field.x)) fail(`${path}.x`, "must be a finite number");
    result.x = field.x;
  }
  if (field.y !== undefined) {
    if (typeof field.y !== "number" || !Number.isFinite(field.y)) fail(`${path}.y`, "must be a finite number");
    result.y = field.y;
  }
  return result;
}

function recordValueAt(value: unknown, path: string): RecordValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fail(path, "must be a string, finite number, boolean, or null");
}

function recordAt(value: unknown, path: string): EpiRecord {
  const source = objectAt(value, path);
  return Object.fromEntries(
    Object.entries(source).map(([key, item]) => [key, recordValueAt(item, `${path}.${key}`)]),
  );
}

function projectFormAt(value: unknown, path: string): ProjectForm {
  const form = objectAt(value, path);
  const schema = objectAt(form.schema, `${path}.schema`);
  if (!Array.isArray(schema.fields)) fail(`${path}.schema.fields`, "must be an array");
  if (!Array.isArray(form.records)) fail(`${path}.records`, "must be an array");

  const fields = schema.fields.map((field, index) => fieldDefinitionAt(field, `${path}.schema.fields[${index}]`));
  const fieldNames = new Set<string>();
  for (const field of fields) {
    if (fieldNames.has(field.name)) fail(`${path}.schema.fields`, `contains duplicate field name ${JSON.stringify(field.name)}`);
    fieldNames.add(field.name);
  }

  return {
    id: nonEmptyString(form.id, `${path}.id`),
    schema: {
      name: nonEmptyString(schema.name, `${path}.schema.name`),
      fields,
    },
    records: form.records.map((record, index) => recordAt(record, `${path}.records[${index}]`)),
  };
}

function storageAt(value: unknown, path: string): ProjectStorageLocation {
  const storage = objectAt(value, path);
  if (storage.type !== "browser" && storage.type !== "supabase") {
    fail(`${path}.type`, "must be browser or supabase");
  }
  return { type: storage.type };
}

function remoteAt(value: unknown, path: string): HostedProjectReference {
  const remote = objectAt(value, path);
  if (typeof remote.revision !== "number" || !Number.isSafeInteger(remote.revision) || remote.revision < 0) {
    fail(`${path}.revision`, "must be a non-negative safe integer");
  }
  const result: HostedProjectReference = {
    id: nonEmptyString(remote.id, `${path}.id`),
    revision: Number(remote.revision),
  };
  if (remote.syncedAt !== undefined) result.syncedAt = nonEmptyString(remote.syncedAt, `${path}.syncedAt`);
  return result;
}

export function validateProjectSnapshot(value: unknown): ProjectSnapshotV1 {
  const snapshot = objectAt(value, "project");
  if (snapshot.version !== undefined && snapshot.version !== PROJECT_SNAPSHOT_VERSION) {
    fail("project.version", `unsupported version ${JSON.stringify(snapshot.version)}`);
  }
  if (!Array.isArray(snapshot.forms) || snapshot.forms.length === 0) {
    fail("project.forms", "must contain at least one form");
  }

  const forms = snapshot.forms.map((form, index) => projectFormAt(form, `project.forms[${index}]`));
  const formIds = new Set<string>();
  for (const form of forms) {
    if (formIds.has(form.id)) fail("project.forms", `contains duplicate form id ${JSON.stringify(form.id)}`);
    formIds.add(form.id);
  }

  const currentFormId = nonEmptyString(snapshot.currentFormId, "project.currentFormId");
  if (!formIds.has(currentFormId)) fail("project.currentFormId", "does not identify a form in this project");

  const result: ProjectSnapshotV1 = {
    name: nonEmptyString(snapshot.name, "project.name"),
    currentFormId,
    forms,
  };
  if (snapshot.version !== undefined) result.version = PROJECT_SNAPSHOT_VERSION;
  if (snapshot.storage !== undefined) result.storage = storageAt(snapshot.storage, "project.storage");
  if (snapshot.remote !== undefined) result.remote = remoteAt(snapshot.remote, "project.remote");
  return result;
}

export function isProjectSnapshot(value: unknown): value is ProjectSnapshotV1 {
  try {
    validateProjectSnapshot(value);
    return true;
  } catch {
    return false;
  }
}

export function parseProjectSnapshotJson(text: string): ProjectSnapshotV1 {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    fail("project", "is not valid JSON");
  }
  return validateProjectSnapshot(value);
}
