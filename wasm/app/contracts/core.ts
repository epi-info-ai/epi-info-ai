import { validateFieldRules, type FieldValidationRule } from "./validation.ts";
import { validateFieldCheckCode, type FieldCheckCode } from "./check-code.ts";

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
  | "option"
  | "command-button";

export type RecordValue = string | number | boolean | null;
export type EpiRecord = Record<string, RecordValue>;

export interface FieldDefinition {
  name: string;
  prompt: string;
  type: FieldType;
  required: boolean;
  rules?: FieldValidationRule[];
  tabStop?: boolean;
  checkCode?: FieldCheckCode;
  x?: number;
  y?: number;
}

export interface FormSchema {
  name: string;
  fields: FieldDefinition[];
}

export interface DatasetProvenance {
  id: string;
  file: string;
  sha256: string;
}

export interface ProjectForm {
  id: string;
  schema: FormSchema;
  records: EpiRecord[];
  dataset?: DatasetProvenance;
  imports?: DatasetProvenance[];
  deletedRecords?: DeletedRecord[];
}

export interface DeletedRecord {
  archiveId: string;
  record: EpiRecord;
  originalIndex: number;
  deletedAt: string;
  reason: string;
}

export interface ProjectAuditEvent {
  id: string;
  occurredAt: string;
  action: "record-deleted" | "record-restored";
  formId: string;
  archiveId: string;
  detail: string;
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

export type StudyAreaBounds = [west: number, south: number, east: number, north: number];

export interface StudyAreaPolygon {
  type: "Polygon";
  coordinates: Array<Array<[longitude: number, latitude: number]>>;
}

export interface OfflineMapPlan {
  minZoom: number;
  maxZoom: number;
  packageLimitMiB: number;
  status: "not-downloaded" | "stored-unverified";
  providerId?: string;
  estimate?: OfflineMapEstimate;
  asset?: OfflineMapAsset;
}

export interface OfflineMapEstimate {
  estimatorVersion: "web-mercator-v1";
  tileCount: number;
  averageTileBytes: number;
  estimatedBytes: number;
}

export interface OfflineMapAsset {
  id: string;
  fileName: string;
  storage: "opfs";
  storagePath: string;
  byteLength: number;
  sha256: string;
  format: "pmtiles-v3";
  tileType: "mvt" | "png" | "jpeg" | "webp" | "avif";
  tileCompression: string;
  bounds: StudyAreaBounds;
  minZoom: number;
  maxZoom: number;
  attribution: string;
  license: string;
  importedAt: string;
  persistence: "persistent" | "best-effort";
}

export interface ProjectStudyArea {
  id: string;
  name: string;
  source: "drawn-bounds" | "manual-bounds";
  geometry: StudyAreaPolygon;
  bounds: StudyAreaBounds;
  bufferKm: number;
  offlineMap: OfflineMapPlan;
}

export interface ProjectSnapshotV1 {
  version?: typeof PROJECT_SNAPSHOT_VERSION;
  name: string;
  currentFormId: string;
  storage?: ProjectStorageLocation;
  remote?: HostedProjectReference;
  forms: ProjectForm[];
  auditLog?: ProjectAuditEvent[];
  studyAreas?: ProjectStudyArea[];
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
  "command-button",
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
  if (field.rules !== undefined) {
    result.rules = validateFieldRules(field.rules, `${path}.rules`);
    const textLike = ["text", "text-uppercase", "multiline", "unique-id", "phone"].includes(result.type);
    for (const [index, rule] of result.rules.entries()) {
      const rulePath = `${path}.rules[${index}]`;
      if (rule.kind === "range" && (result.type !== "number" && result.type !== "date" || rule.valueType !== result.type)) {
        fail(rulePath, `range rules must match a Number or Date field's data type`);
      }
      if (rule.kind === "pattern" && !textLike) fail(rulePath, "pattern rules require a text-like field");
      if (rule.kind === "legal-values" && !textLike && result.type !== "yes-no" && result.type !== "option") {
        fail(rulePath, "legal-values rules require a text, Yes/No, or Option field");
      }
      if (rule.kind === "calculated-age" && result.type !== "number") fail(rulePath, "calculated-age rules require a Number field");
      if (rule.kind === "coordinate" && result.type !== "number") fail(rulePath, "coordinate rules require a Number field");
      if (rule.kind === "unique" && ["checkbox", "yes-no", "option", "command-button"].includes(result.type)) {
        fail(rulePath, "unique rules are not available for Boolean, Option, or Command Button fields");
      }
    }
  }
  if (field.tabStop !== undefined) {
    if (typeof field.tabStop !== "boolean") fail(`${path}.tabStop`, "must be a boolean");
    result.tabStop = field.tabStop;
  }
  if (field.checkCode !== undefined) result.checkCode = validateFieldCheckCode(field.checkCode, `${path}.checkCode`);
  return result;
}

function validateCheckCodeTargets(fields: readonly FieldDefinition[], path: string): void {
  const byName = new Map(fields.map((field) => [field.name, field]));
  const edges = new Map<string, string[]>();
  for (const field of fields) {
    const statements = field.checkCode?.after ?? [];
    const targets = statements.map((statement) => statement.targetField);
    edges.set(field.name, statements.filter((statement) => statement.kind === "goto").map((statement) => statement.targetField));
    for (const statement of statements) {
      const target = statement.targetField;
      if (!byName.has(target)) fail(`${path}.${field.name}.checkCode`, `goto target ${JSON.stringify(target)} does not exist`);
      if (target === field.name) fail(`${path}.${field.name}.checkCode`, "cannot goto the same field");
      if (statement.kind === "goto" && byName.get(target)?.tabStop === false) fail(`${path}.${field.name}.checkCode`, `goto target ${JSON.stringify(target)} has its tab stop disabled`);
    }
    const geocodeStatements = field.checkCode?.click ?? [];
    if (geocodeStatements.length > 0 && field.type !== "command-button") {
      fail(`${path}.${field.name}.checkCode.click`, "GEOCODE Click requires a Command Button field");
    }
    for (const statement of geocodeStatements) {
      const address = byName.get(statement.addressField);
      const latitude = byName.get(statement.latitudeField);
      const longitude = byName.get(statement.longitudeField);
      if (!address || !["text", "text-uppercase", "multiline"].includes(address.type)) {
        fail(`${path}.${field.name}.checkCode.click`, `GEOCODE address field ${JSON.stringify(statement.addressField)} must be a text field`);
      }
      if (!latitude || latitude.type !== "number") {
        fail(`${path}.${field.name}.checkCode.click`, `GEOCODE latitude field ${JSON.stringify(statement.latitudeField)} must be a Number field`);
      }
      if (!longitude || longitude.type !== "number") {
        fail(`${path}.${field.name}.checkCode.click`, `GEOCODE longitude field ${JSON.stringify(statement.longitudeField)} must be a Number field`);
      }
      const latitudeRule = latitude.rules?.find((rule) => rule.kind === "coordinate");
      const longitudeRule = longitude.rules?.find((rule) => rule.kind === "coordinate");
      if (latitudeRule?.kind !== "coordinate" || latitudeRule.axis !== "latitude") {
        fail(`${path}.${field.name}.checkCode.click`, "GEOCODE latitude target must use the Latitude coordinate rule");
      }
      if (longitudeRule?.kind !== "coordinate" || longitudeRule.axis !== "longitude") {
        fail(`${path}.${field.name}.checkCode.click`, "GEOCODE longitude target must use the Longitude coordinate rule");
      }
    }
    const calculations = field.rules?.filter((rule) => rule.kind === "calculated-age") ?? [];
    for (const calculation of calculations) {
      const source = byName.get(calculation.sourceDateField);
      if (!source) fail(`${path}.${field.name}.rules`, `calculated-age source ${JSON.stringify(calculation.sourceDateField)} does not exist`);
      if (source.type !== "date") fail(`${path}.${field.name}.rules`, "calculated-age source must be a date field");
      if (calculation.asOfDateField) {
        const asOf = byName.get(calculation.asOfDateField);
        if (!asOf) fail(`${path}.${field.name}.rules`, `calculated-age as-of field ${JSON.stringify(calculation.asOfDateField)} does not exist`);
        if (asOf.type !== "date") fail(`${path}.${field.name}.rules`, "calculated-age as-of field must be a date field");
      }
      if (field.type !== "number") fail(`${path}.${field.name}.rules`, "calculated-age target must be a number field");
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (name: string): void => {
    if (visiting.has(name)) fail(path, `contains a goto cycle involving ${JSON.stringify(name)}`);
    if (visited.has(name)) return;
    visiting.add(name);
    for (const target of edges.get(name) ?? []) {
      visit(target);
    }
    visiting.delete(name);
    visited.add(name);
  };
  for (const field of fields) visit(field.name);
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

function datasetProvenanceAt(value: unknown, path: string): DatasetProvenance {
  const dataset = objectAt(value, path);
  const sha256 = nonEmptyString(dataset.sha256, `${path}.sha256`).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) fail(`${path}.sha256`, "must be a SHA-256 digest");
  return {
    id: nonEmptyString(dataset.id, `${path}.id`),
    file: nonEmptyString(dataset.file, `${path}.file`),
    sha256,
  };
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
  validateCheckCodeTargets(fields, `${path}.schema.fields`);

  const result: ProjectForm = {
    id: nonEmptyString(form.id, `${path}.id`),
    schema: {
      name: nonEmptyString(schema.name, `${path}.schema.name`),
      fields,
    },
    records: form.records.map((record, index) => recordAt(record, `${path}.records[${index}]`)),
  };
  if (form.dataset !== undefined) result.dataset = datasetProvenanceAt(form.dataset, `${path}.dataset`);
  if (form.imports !== undefined) {
    if (!Array.isArray(form.imports)) fail(`${path}.imports`, "must be an array");
    result.imports = form.imports.map((item, index) => datasetProvenanceAt(item, `${path}.imports[${index}]`));
  }
  if (form.deletedRecords !== undefined) {
    if (!Array.isArray(form.deletedRecords)) fail(`${path}.deletedRecords`, "must be an array");
    result.deletedRecords = form.deletedRecords.map((item, index) => {
      const deleted = objectAt(item, `${path}.deletedRecords[${index}]`);
      if (typeof deleted.originalIndex !== "number" || !Number.isSafeInteger(deleted.originalIndex) || deleted.originalIndex < 0) {
        fail(`${path}.deletedRecords[${index}].originalIndex`, "must be a non-negative safe integer");
      }
      const deletedAt = nonEmptyString(deleted.deletedAt, `${path}.deletedRecords[${index}].deletedAt`);
      if (!Number.isFinite(Date.parse(deletedAt))) fail(`${path}.deletedRecords[${index}].deletedAt`, "must be a valid date/time");
      return {
        archiveId: nonEmptyString(deleted.archiveId, `${path}.deletedRecords[${index}].archiveId`),
        record: recordAt(deleted.record, `${path}.deletedRecords[${index}].record`),
        originalIndex: deleted.originalIndex,
        deletedAt,
        reason: nonEmptyString(deleted.reason, `${path}.deletedRecords[${index}].reason`),
      };
    });
    const archiveIds = new Set<string>();
    for (const deleted of result.deletedRecords) {
      if (archiveIds.has(deleted.archiveId)) fail(`${path}.deletedRecords`, `contains duplicate archive id ${JSON.stringify(deleted.archiveId)}`);
      archiveIds.add(deleted.archiveId);
    }
  }
  return result;
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

function finiteCoordinate(value: unknown, path: string, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail(path, `must be a finite number from ${minimum} through ${maximum}`);
  }
  return value;
}

function studyAreaAt(value: unknown, path: string): ProjectStudyArea {
  const source = objectAt(value, path);
  if (source.source !== "drawn-bounds" && source.source !== "manual-bounds") {
    fail(`${path}.source`, "must be drawn-bounds or manual-bounds");
  }
  if (!Array.isArray(source.bounds) || source.bounds.length !== 4) fail(`${path}.bounds`, "must contain west, south, east, and north");
  const west = finiteCoordinate(source.bounds[0], `${path}.bounds[0]`, -180, 180);
  const south = finiteCoordinate(source.bounds[1], `${path}.bounds[1]`, -90, 90);
  const east = finiteCoordinate(source.bounds[2], `${path}.bounds[2]`, -180, 180);
  const north = finiteCoordinate(source.bounds[3], `${path}.bounds[3]`, -90, 90);
  if (west >= east) fail(`${path}.bounds`, "west must be less than east; antimeridian-crossing areas are not supported yet");
  if (south >= north) fail(`${path}.bounds`, "south must be less than north");

  const geometry = objectAt(source.geometry, `${path}.geometry`);
  if (geometry.type !== "Polygon" || !Array.isArray(geometry.coordinates) || geometry.coordinates.length !== 1) {
    fail(`${path}.geometry`, "must be a single-ring Polygon");
  }
  const ringSource = geometry.coordinates[0];
  if (!Array.isArray(ringSource) || ringSource.length !== 5) fail(`${path}.geometry.coordinates[0]`, "must be a closed five-position bounding-box ring");
  const ring = ringSource.map((position, index): [number, number] => {
    if (!Array.isArray(position) || position.length !== 2) fail(`${path}.geometry.coordinates[0][${index}]`, "must be a longitude/latitude position");
    return [
      finiteCoordinate(position[0], `${path}.geometry.coordinates[0][${index}][0]`, -180, 180),
      finiteCoordinate(position[1], `${path}.geometry.coordinates[0][${index}][1]`, -90, 90),
    ];
  });
  const expected: Array<[number, number]> = [[west, south], [east, south], [east, north], [west, north], [west, south]];
  if (ring.some((position, index) => position[0] !== expected[index]![0] || position[1] !== expected[index]![1])) {
    fail(`${path}.geometry`, "must match the declared bounding box");
  }

  const offline = objectAt(source.offlineMap, `${path}.offlineMap`);
  for (const property of ["minZoom", "maxZoom", "packageLimitMiB"] as const) {
    if (typeof offline[property] !== "number" || !Number.isSafeInteger(offline[property])) fail(`${path}.offlineMap.${property}`, "must be a safe integer");
  }
  const offlineMinZoom = Number(offline.minZoom);
  const offlineMaxZoom = Number(offline.maxZoom);
  const packageLimitMiB = Number(offline.packageLimitMiB);
  if (offlineMinZoom < 0 || offlineMaxZoom > 22 || offlineMinZoom > offlineMaxZoom) {
    fail(`${path}.offlineMap`, "zoom range must be ordered within 0 through 22");
  }
  if (packageLimitMiB < 1 || packageLimitMiB > 1024) fail(`${path}.offlineMap.packageLimitMiB`, "must be from 1 through 1024 MiB");
  if (offline.status !== "not-downloaded" && offline.status !== "stored-unverified") fail(`${path}.offlineMap.status`, "must be not-downloaded or stored-unverified");
  if (offline.providerId !== undefined) nonEmptyString(offline.providerId, `${path}.offlineMap.providerId`);
  let estimate: OfflineMapEstimate | undefined;
  if (offline.estimate !== undefined) {
    const estimateSource = objectAt(offline.estimate, `${path}.offlineMap.estimate`);
    if (estimateSource.estimatorVersion !== "web-mercator-v1") fail(`${path}.offlineMap.estimate.estimatorVersion`, "must be web-mercator-v1");
    for (const property of ["tileCount", "averageTileBytes", "estimatedBytes"] as const) {
      if (typeof estimateSource[property] !== "number" || !Number.isSafeInteger(estimateSource[property]) || estimateSource[property] < 0) {
        fail(`${path}.offlineMap.estimate.${property}`, "must be a non-negative safe integer");
      }
    }
    const tileCount = Number(estimateSource.tileCount);
    const averageTileBytes = Number(estimateSource.averageTileBytes);
    const estimatedBytes = Number(estimateSource.estimatedBytes);
    if (averageTileBytes < 1) fail(`${path}.offlineMap.estimate.averageTileBytes`, "must be at least 1");
    if (estimatedBytes !== tileCount * averageTileBytes) {
      fail(`${path}.offlineMap.estimate.estimatedBytes`, "must equal tileCount multiplied by averageTileBytes");
    }
    estimate = {
      estimatorVersion: "web-mercator-v1",
      tileCount,
      averageTileBytes,
      estimatedBytes,
    };
  }
  let asset: OfflineMapAsset | undefined;
  if (offline.asset !== undefined) {
    const assetSource = objectAt(offline.asset, `${path}.offlineMap.asset`);
    if (assetSource.storage !== "opfs") fail(`${path}.offlineMap.asset.storage`, "must be opfs");
    if (assetSource.format !== "pmtiles-v3") fail(`${path}.offlineMap.asset.format`, "must be pmtiles-v3");
    if (!["mvt", "png", "jpeg", "webp", "avif"].includes(String(assetSource.tileType))) {
      fail(`${path}.offlineMap.asset.tileType`, "is not supported");
    }
    if (assetSource.persistence !== "persistent" && assetSource.persistence !== "best-effort") {
      fail(`${path}.offlineMap.asset.persistence`, "must be persistent or best-effort");
    }
    const assetId = nonEmptyString(assetSource.id, `${path}.offlineMap.asset.id`);
    const sha256 = nonEmptyString(assetSource.sha256, `${path}.offlineMap.asset.sha256`).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(sha256)) fail(`${path}.offlineMap.asset.sha256`, "must be a SHA-256 digest");
    if (assetId !== sha256) fail(`${path}.offlineMap.asset.id`, "must equal the archive SHA-256 digest");
    if (typeof assetSource.byteLength !== "number" || !Number.isSafeInteger(assetSource.byteLength) || assetSource.byteLength < 127) {
      fail(`${path}.offlineMap.asset.byteLength`, "must be a safe integer of at least 127 bytes");
    }
    const assetByteLength = Number(assetSource.byteLength);
    if (assetByteLength > packageLimitMiB * 1024 * 1024) fail(`${path}.offlineMap.asset.byteLength`, "exceeds the project package limit");
    if (!Array.isArray(assetSource.bounds) || assetSource.bounds.length !== 4) fail(`${path}.offlineMap.asset.bounds`, "must contain west, south, east, and north");
    const assetBounds: StudyAreaBounds = [
      finiteCoordinate(assetSource.bounds[0], `${path}.offlineMap.asset.bounds[0]`, -180, 180),
      finiteCoordinate(assetSource.bounds[1], `${path}.offlineMap.asset.bounds[1]`, -90, 90),
      finiteCoordinate(assetSource.bounds[2], `${path}.offlineMap.asset.bounds[2]`, -180, 180),
      finiteCoordinate(assetSource.bounds[3], `${path}.offlineMap.asset.bounds[3]`, -90, 90),
    ];
    if (assetBounds[0] > west || assetBounds[1] > south || assetBounds[2] < east || assetBounds[3] < north) {
      fail(`${path}.offlineMap.asset.bounds`, "must cover the complete study area");
    }
    for (const property of ["minZoom", "maxZoom"] as const) {
      if (typeof assetSource[property] !== "number" || !Number.isSafeInteger(assetSource[property])) fail(`${path}.offlineMap.asset.${property}`, "must be a safe integer");
    }
    const assetMinZoom = Number(assetSource.minZoom);
    const assetMaxZoom = Number(assetSource.maxZoom);
    if (assetMinZoom < 0 || assetMaxZoom > 22 || assetMinZoom > offlineMinZoom || assetMaxZoom < offlineMaxZoom) {
      fail(`${path}.offlineMap.asset`, "zoom coverage must contain the complete planned range");
    }
    const importedAt = nonEmptyString(assetSource.importedAt, `${path}.offlineMap.asset.importedAt`);
    if (Number.isNaN(Date.parse(importedAt))) fail(`${path}.offlineMap.asset.importedAt`, "must be an ISO date-time");
    const storagePath = nonEmptyString(assetSource.storagePath, `${path}.offlineMap.asset.storagePath`);
    if (!storagePath.startsWith("epi-info-ai/offline-maps/") || storagePath.includes("..") || !storagePath.endsWith(".pmtiles") || !storagePath.includes(sha256)) {
      fail(`${path}.offlineMap.asset.storagePath`, "must remain in the offline-maps OPFS directory and identify the archive digest");
    }
    asset = {
      id: assetId,
      fileName: nonEmptyString(assetSource.fileName, `${path}.offlineMap.asset.fileName`),
      storage: "opfs",
      storagePath,
      byteLength: assetByteLength,
      sha256,
      format: "pmtiles-v3",
      tileType: assetSource.tileType as OfflineMapAsset["tileType"],
      tileCompression: nonEmptyString(assetSource.tileCompression, `${path}.offlineMap.asset.tileCompression`),
      bounds: assetBounds,
      minZoom: assetMinZoom,
      maxZoom: assetMaxZoom,
      attribution: nonEmptyString(assetSource.attribution, `${path}.offlineMap.asset.attribution`),
      license: nonEmptyString(assetSource.license, `${path}.offlineMap.asset.license`),
      importedAt,
      persistence: assetSource.persistence,
    };
  }
  if (offline.status === "stored-unverified" && !asset) fail(`${path}.offlineMap.asset`, "is required when status is stored-unverified");
  if (offline.status === "not-downloaded" && asset) fail(`${path}.offlineMap.status`, "must be stored-unverified when an asset is attached");
  if (typeof source.bufferKm !== "number" || !Number.isFinite(source.bufferKm) || source.bufferKm < 0 || source.bufferKm > 500) {
    fail(`${path}.bufferKm`, "must be a finite number from 0 through 500");
  }
  const bufferKm = Number(source.bufferKm);
  return {
    id: nonEmptyString(source.id, `${path}.id`),
    name: nonEmptyString(source.name, `${path}.name`),
    source: source.source,
    geometry: { type: "Polygon", coordinates: [ring] },
    bounds: [west, south, east, north],
    bufferKm,
    offlineMap: {
      minZoom: offlineMinZoom,
      maxZoom: offlineMaxZoom,
      packageLimitMiB,
      status: offline.status,
      ...(offline.providerId !== undefined ? { providerId: nonEmptyString(offline.providerId, `${path}.offlineMap.providerId`) } : {}),
      ...(estimate ? { estimate } : {}),
      ...(asset ? { asset } : {}),
    },
  };
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
  if (snapshot.studyAreas !== undefined) {
    if (!Array.isArray(snapshot.studyAreas)) fail("project.studyAreas", "must be an array");
    result.studyAreas = snapshot.studyAreas.map((area, index) => studyAreaAt(area, `project.studyAreas[${index}]`));
    const studyAreaIds = new Set<string>();
    for (const area of result.studyAreas) {
      if (studyAreaIds.has(area.id)) fail("project.studyAreas", `contains duplicate study-area id ${JSON.stringify(area.id)}`);
      studyAreaIds.add(area.id);
    }
  }
  if (snapshot.auditLog !== undefined) {
    if (!Array.isArray(snapshot.auditLog)) fail("project.auditLog", "must be an array");
    result.auditLog = snapshot.auditLog.map((item, index) => {
      const event = objectAt(item, `project.auditLog[${index}]`);
      if (event.action !== "record-deleted" && event.action !== "record-restored") {
        fail(`project.auditLog[${index}].action`, "must be record-deleted or record-restored");
      }
      const occurredAt = nonEmptyString(event.occurredAt, `project.auditLog[${index}].occurredAt`);
      if (!Number.isFinite(Date.parse(occurredAt))) fail(`project.auditLog[${index}].occurredAt`, "must be a valid date/time");
      return {
        id: nonEmptyString(event.id, `project.auditLog[${index}].id`),
        occurredAt,
        action: event.action,
        formId: nonEmptyString(event.formId, `project.auditLog[${index}].formId`),
        archiveId: nonEmptyString(event.archiveId, `project.auditLog[${index}].archiveId`),
        detail: nonEmptyString(event.detail, `project.auditLog[${index}].detail`),
      };
    });
    const auditIds = new Set<string>();
    for (const event of result.auditLog) {
      if (auditIds.has(event.id)) fail("project.auditLog", `contains duplicate audit id ${JSON.stringify(event.id)}`);
      if (!formIds.has(event.formId)) fail("project.auditLog", `references unknown form id ${JSON.stringify(event.formId)}`);
      auditIds.add(event.id);
    }
  }
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
