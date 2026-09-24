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
  pages?: FormPageDefinition[];
  checkCodeProgram?: FormCheckCodeProgram;
}

export interface FormPageDefinition {
  name: string;
  fields: string[];
}

export interface FormCheckCodeProgram {
  version: 1;
  language: "epi-info-check-code";
  source: string;
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
  action: "record-deleted" | "record-restored" | "check-code-executed";
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

export interface ProjectMapAsset {
  id: string;
  fileName: string;
  storage: "opfs";
  storagePath: string;
  byteLength: number;
  sha256: string;
  format: "geojson" | "geotiff";
  mediaType: "application/geo+json" | "image/tiff";
  importedAt: string;
  persistence: "persistent" | "best-effort";
  sourceLineage?: ProjectMapAssetLineageV1;
}

export interface ProjectMapAssetLineageV1 {
  schema: "epi-gis-reference-lineage/0.1";
  planId: string;
  derivedAssetId: string;
  source: {
    fileName: string;
    sha256: string;
    byteLength: number;
    packageFormat: "ZIP" | "GeoPackage";
  };
  selection: {
    candidateId: string;
    format: "Shapefile" | "GeoPackage";
    entries: string[];
    layerName?: string;
  };
  crs: {
    declaredCrs: "CRS84" | "EPSG:4326" | "EPSG:3857" | "unknown";
    targetCrs: "CRS84";
    normalizationRequired: boolean;
  };
  status: "reviewed" | "requires-reprojection";
  persistence: "project-snapshot";
}

export interface ProjectReferenceLayerSourceV1 {
  id: string;
  fileName: string;
  storage: "opfs";
  storagePath: string;
  byteLength: number;
  sha256: string;
  format: "reference-package";
  mediaType: "application/zip" | "application/geopackage+sqlite3";
  packageFormat: "ZIP" | "GeoPackage";
  importedAt: string;
  persistence: "persistent" | "best-effort";
}

export type ProjectMapLayer = {
  id: string;
  kind: "case-cluster" | "spot-map";
  sourceFormId: string;
  name: string;
  visible: boolean;
  latitudeField: string;
  longitudeField: string;
  labelField: string;
  markerStyle: "circle" | "square";
  markerColor: string;
  filter?: { field: string; operator: string; value?: string };
} | {
  id: string;
  kind: "dot-density";
  assetId: string;
  sourceFormId: string;
  name: string;
  visible: boolean;
  boundaryKeyField: string;
  dataKeyField: string;
  valueField: string;
  joinNormalization: "exact" | "trim-casefold";
  valuePerDot: number;
  rounding: "floor" | "nearest" | "ceil";
  seed: number;
  placementMethod: "seeded-jitter" | "deterministic-grid";
  dotColor: string;
  dotRadiusPixels: number;
  opacity: number;
  legendTitle: string;
  maxDotsPerFeature: number;
  maxTotalDots: number;
} | {
  id: string;
  kind: "choropleth";
  assetId: string;
  sourceFormId: string;
  name: string;
  visible: boolean;
  boundaryKeyField: string;
  dataKeyField: string;
  valueField: string;
  joinNormalization: "exact" | "trim-casefold";
  classification: { method: "manual" | "equal-interval" | "quantile"; classCount: number; breaks?: number[] };
  palette: string[];
  opacity: number;
  noDataColor: string;
  legendTitle: string;
  filter?: { field: string; operator: string; value?: string };
} | {
  id: string;
  kind: "geojson";
  assetId: string;
  name: string;
  visible: boolean;
  labelField: string;
  labelsEnabled: boolean;
} | {
  id: string;
  kind: "raster";
  assetId: string;
  name: string;
  visible: boolean;
  opacity: number;
};

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
  mapAssets?: ProjectMapAsset[];
  mapLayers?: ProjectMapLayer[];
  mapPresentation?: ProjectMapPresentationV1;
  referenceLayerSources?: ProjectReferenceLayerSourceV1[];
}

export interface ProjectMapPresentationV1 {
  schema: "epi-gis-map-presentation/0.1";
  background: "street" | "blank" | "offline";
  annotations: { title: string; subtitle: string; note: string; showLegend: boolean; showNorthArrow: boolean; showScaleBar: boolean };
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
  if (schema.pages !== undefined) {
    if (!Array.isArray(schema.pages) || schema.pages.length === 0) fail(`${path}.schema.pages`, "must be a non-empty array when present");
    if (schema.pages.length > 100) fail(`${path}.schema.pages`, "must not exceed 100 pages");
    const pageNames = new Set<string>();
    const assignedFields = new Set<string>();
    result.schema.pages = schema.pages.map((value, pageIndex) => {
      const pagePath = `${path}.schema.pages[${pageIndex}]`;
      const page = objectAt(value, pagePath);
      const name = nonEmptyString(page.name, `${pagePath}.name`).trim();
      const normalizedName = name.toLocaleLowerCase("en-US");
      if (pageNames.has(normalizedName)) fail(`${path}.schema.pages`, `contains duplicate page name ${JSON.stringify(name)}`);
      pageNames.add(normalizedName);
      if (!Array.isArray(page.fields)) fail(`${pagePath}.fields`, "must be an array");
      const pageFields = page.fields.map((field, fieldIndex) => nonEmptyString(field, `${pagePath}.fields[${fieldIndex}]`));
      for (const field of pageFields) {
        if (!fieldNames.has(field)) fail(`${pagePath}.fields`, `references missing field ${JSON.stringify(field)}`);
        if (assignedFields.has(field)) fail(`${path}.schema.pages`, `assigns field ${JSON.stringify(field)} to more than one page`);
        assignedFields.add(field);
      }
      return { name, fields: pageFields };
    });
    for (const field of fields) {
      if (!assignedFields.has(field.name)) fail(`${path}.schema.pages`, `does not assign field ${JSON.stringify(field.name)} to a page`);
    }
  }
  if (schema.checkCodeProgram !== undefined) {
    const program = objectAt(schema.checkCodeProgram, `${path}.schema.checkCodeProgram`);
    if (program.version !== 1) fail(`${path}.schema.checkCodeProgram.version`, "must be 1");
    if (program.language !== "epi-info-check-code") fail(`${path}.schema.checkCodeProgram.language`, "must be epi-info-check-code");
    if (typeof program.source !== "string") fail(`${path}.schema.checkCodeProgram.source`, "must be a string");
    if (program.source.length > 100_000) fail(`${path}.schema.checkCodeProgram.source`, "must not exceed 100,000 characters");
    result.schema.checkCodeProgram = { version: 1, language: "epi-info-check-code", source: program.source };
  }
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

function projectMapAssetAt(value: unknown, path: string): ProjectMapAsset {
  const source = objectAt(value, path);
  if (source.storage !== "opfs") fail(`${path}.storage`, "must be opfs");
  if (source.format !== "geojson" && source.format !== "geotiff") fail(`${path}.format`, "must be geojson or geotiff");
  const expectedMediaType = source.format === "geojson" ? "application/geo+json" : "image/tiff";
  if (source.mediaType !== expectedMediaType) fail(`${path}.mediaType`, `must be ${expectedMediaType}`);
  if (source.persistence !== "persistent" && source.persistence !== "best-effort") fail(`${path}.persistence`, "must be persistent or best-effort");
  const sha256 = nonEmptyString(source.sha256, `${path}.sha256`).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) fail(`${path}.sha256`, "must be a SHA-256 digest");
  const id = nonEmptyString(source.id, `${path}.id`);
  if (id !== sha256) fail(`${path}.id`, "must equal the asset SHA-256 digest");
  if (typeof source.byteLength !== "number" || !Number.isSafeInteger(source.byteLength) || source.byteLength < 1) {
    fail(`${path}.byteLength`, "must be a positive safe integer");
  }
  const limit = source.format === "geojson" ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
  if (source.byteLength > limit) fail(`${path}.byteLength`, `exceeds the ${source.format === "geojson" ? 10 : 50} MiB format limit`);
  const extension = source.format === "geojson" ? ".geojson" : ".tif";
  const storagePath = nonEmptyString(source.storagePath, `${path}.storagePath`);
  if (!storagePath.startsWith("epi-info-ai/map-assets/") || storagePath.includes("..")
    || !storagePath.endsWith(extension) || !storagePath.includes(sha256)) {
    fail(`${path}.storagePath`, `must remain in the map-assets OPFS directory and end in ${extension}`);
  }
  const importedAt = nonEmptyString(source.importedAt, `${path}.importedAt`);
  if (!Number.isFinite(Date.parse(importedAt))) fail(`${path}.importedAt`, "must be a valid date/time");
  const result: ProjectMapAsset = {
    id,
    fileName: nonEmptyString(source.fileName, `${path}.fileName`),
    storage: "opfs",
    storagePath,
    byteLength: source.byteLength,
    sha256,
    format: source.format,
    mediaType: expectedMediaType,
    importedAt,
    persistence: source.persistence,
  };
  if (source.sourceLineage !== undefined) {
    const lineage = objectAt(source.sourceLineage, `${path}.sourceLineage`);
    if (lineage.schema !== "epi-gis-reference-lineage/0.1") fail(`${path}.sourceLineage.schema`, "must be epi-gis-reference-lineage/0.1");
    if (lineage.persistence !== "project-snapshot") fail(`${path}.sourceLineage.persistence`, "must be project-snapshot");
    const lineagePlanId = nonEmptyString(lineage.planId, `${path}.sourceLineage.planId`);
    const derivedAssetId = nonEmptyString(lineage.derivedAssetId, `${path}.sourceLineage.derivedAssetId`);
    if (derivedAssetId !== id) fail(`${path}.sourceLineage.derivedAssetId`, "must identify the containing map asset");
    const sourceLineage = objectAt(lineage.source, `${path}.sourceLineage.source`);
    const lineageSha256 = nonEmptyString(sourceLineage.sha256, `${path}.sourceLineage.source.sha256`).toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(lineageSha256)) fail(`${path}.sourceLineage.source.sha256`, "must be a SHA-256 digest");
    if (typeof sourceLineage.byteLength !== "number" || !Number.isSafeInteger(sourceLineage.byteLength) || sourceLineage.byteLength < 1) {
      fail(`${path}.sourceLineage.source.byteLength`, "must be a positive safe integer");
    }
    if (sourceLineage.packageFormat !== "ZIP" && sourceLineage.packageFormat !== "GeoPackage") fail(`${path}.sourceLineage.source.packageFormat`, "must be ZIP or GeoPackage");
    const selection = objectAt(lineage.selection, `${path}.sourceLineage.selection`);
    if (selection.format !== "Shapefile" && selection.format !== "GeoPackage") fail(`${path}.sourceLineage.selection.format`, "must be Shapefile or GeoPackage");
    if (!Array.isArray(selection.entries) || selection.entries.some((entry) => typeof entry !== "string" || entry.length === 0)) fail(`${path}.sourceLineage.selection.entries`, "must contain non-empty strings");
    if (selection.format === "GeoPackage" && (typeof selection.layerName !== "string" || selection.layerName.trim().length === 0 || selection.layerName.length > 200)) fail(`${path}.sourceLineage.selection.layerName`, "must be a non-empty GeoPackage layer name of at most 200 characters");
    const crs = objectAt(lineage.crs, `${path}.sourceLineage.crs`);
    if (crs.declaredCrs !== "CRS84" && crs.declaredCrs !== "EPSG:4326" && crs.declaredCrs !== "EPSG:3857" && crs.declaredCrs !== "unknown") fail(`${path}.sourceLineage.crs.declaredCrs`, "must be a supported CRS declaration");
    if (crs.targetCrs !== "CRS84") fail(`${path}.sourceLineage.crs.targetCrs`, "must be CRS84");
    if (typeof crs.normalizationRequired !== "boolean") fail(`${path}.sourceLineage.crs.normalizationRequired`, "must be boolean");
    if (lineage.status !== "reviewed" && lineage.status !== "requires-reprojection") fail(`${path}.sourceLineage.status`, "must be reviewed or requires-reprojection");
    result.sourceLineage = {
      schema: "epi-gis-reference-lineage/0.1",
      planId: lineagePlanId,
      derivedAssetId,
      source: {
        fileName: nonEmptyString(sourceLineage.fileName, `${path}.sourceLineage.source.fileName`),
        sha256: lineageSha256,
        byteLength: sourceLineage.byteLength,
        packageFormat: sourceLineage.packageFormat,
      },
      selection: {
        candidateId: nonEmptyString(selection.candidateId, `${path}.sourceLineage.selection.candidateId`),
        format: selection.format,
        entries: [...selection.entries],
        ...(typeof selection.layerName === "string" ? { layerName: selection.layerName } : {}),
      },
      crs: {
        declaredCrs: crs.declaredCrs,
        targetCrs: "CRS84",
        normalizationRequired: crs.normalizationRequired,
      },
      status: lineage.status,
      persistence: "project-snapshot",
    };
  }
  return result;
}

function referenceLayerSourceAt(value: unknown, path: string): ProjectReferenceLayerSourceV1 {
  const source = objectAt(value, path);
  if (source.storage !== "opfs") fail(`${path}.storage`, "must be opfs");
  if (source.format !== "reference-package") fail(`${path}.format`, "must be reference-package");
  if (source.mediaType !== "application/zip" && source.mediaType !== "application/geopackage+sqlite3") fail(`${path}.mediaType`, "must be application/zip or application/geopackage+sqlite3");
  if (source.packageFormat !== "ZIP" && source.packageFormat !== "GeoPackage") fail(`${path}.packageFormat`, "must be ZIP or GeoPackage");
  const expectedMediaType = source.packageFormat === "ZIP" ? "application/zip" : "application/geopackage+sqlite3";
  if (source.mediaType !== expectedMediaType) fail(`${path}.mediaType`, `must be ${expectedMediaType} for ${source.packageFormat}`);
  if (source.persistence !== "persistent" && source.persistence !== "best-effort") fail(`${path}.persistence`, "must be persistent or best-effort");
  const sha256 = nonEmptyString(source.sha256, `${path}.sha256`).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(sha256)) fail(`${path}.sha256`, "must be a SHA-256 digest");
  const id = nonEmptyString(source.id, `${path}.id`);
  if (id !== sha256) fail(`${path}.id`, "must equal the source SHA-256 digest");
  if (typeof source.byteLength !== "number" || !Number.isSafeInteger(source.byteLength) || source.byteLength < 1 || source.byteLength > 100 * 1024 * 1024) {
    fail(`${path}.byteLength`, "must be a positive safe integer no greater than 100 MiB");
  }
  const extension = source.packageFormat === "ZIP" ? ".zip" : ".gpkg";
  const storagePath = nonEmptyString(source.storagePath, `${path}.storagePath`);
  if (!storagePath.startsWith("epi-info-ai/reference-layer-sources/") || storagePath.includes("..") || !storagePath.endsWith(extension) || !storagePath.includes(sha256)) {
    fail(`${path}.storagePath`, `must remain in the reference-layer-sources OPFS directory and end in ${extension}`);
  }
  const importedAt = nonEmptyString(source.importedAt, `${path}.importedAt`);
  if (!Number.isFinite(Date.parse(importedAt))) fail(`${path}.importedAt`, "must be a valid date/time");
  return {
    id,
    fileName: nonEmptyString(source.fileName, `${path}.fileName`),
    storage: "opfs",
    storagePath,
    byteLength: source.byteLength,
    sha256,
    format: "reference-package",
    mediaType: expectedMediaType,
    packageFormat: source.packageFormat,
    importedAt,
    persistence: source.persistence,
  };
}

function projectMapLayerAt(
  value: unknown,
  path: string,
  assets: ReadonlyMap<string, ProjectMapAsset>,
  forms: ReadonlyMap<string, ProjectForm>,
): ProjectMapLayer {
  const source = objectAt(value, path);
  if (source.kind !== "case-cluster" && source.kind !== "spot-map" && source.kind !== "choropleth" && source.kind !== "dot-density" && source.kind !== "geojson" && source.kind !== "raster") {
    fail(`${path}.kind`, "must be case-cluster, spot-map, choropleth, dot-density, geojson, or raster");
  }
  if (typeof source.visible !== "boolean") fail(`${path}.visible`, "must be boolean");
  const shared = {
    id: nonEmptyString(source.id, `${path}.id`),
    name: nonEmptyString(source.name, `${path}.name`),
    visible: source.visible,
  };
  if (source.kind === "case-cluster" || source.kind === "spot-map") {
    const sourceFormId = nonEmptyString(source.sourceFormId, `${path}.sourceFormId`);
    const form = forms.get(sourceFormId);
    if (!form) fail(`${path}.sourceFormId`, "must identify a form in this project");
    const latitudeField = nonEmptyString(source.latitudeField, `${path}.latitudeField`);
    const longitudeField = nonEmptyString(source.longitudeField, `${path}.longitudeField`);
    const labelField = typeof source.labelField === "string" ? source.labelField : fail(`${path}.labelField`, "must be a string");
    const fields = new Map(form.schema.fields.map((field) => [field.name, field]));
    if (!fields.has(latitudeField)) fail(`${path}.latitudeField`, "must identify a field in the source form");
    if (!fields.has(longitudeField)) fail(`${path}.longitudeField`, "must identify a field in the source form");
    if (labelField && !fields.has(labelField)) fail(`${path}.labelField`, "must be blank or identify a field in the source form");
    const markerStyle = source.markerStyle === undefined ? "circle" : source.markerStyle;
    if (markerStyle !== "circle" && markerStyle !== "square") fail(`${path}.markerStyle`, "must be circle or square");
    const markerColor = source.markerColor === undefined ? "#df291e" : source.markerColor;
    if (typeof markerColor !== "string" || !/^#[0-9a-f]{6}$/i.test(markerColor)) fail(`${path}.markerColor`, "must be a six-digit hex color");
    let filter: { field: string; operator: string; value?: string } | undefined;
    if (source.filter !== undefined) {
      const filterSource = objectAt(source.filter, `${path}.filter`);
      const filterField = nonEmptyString(filterSource.field, `${path}.filter.field`);
      const allowedOperators = ["equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal", "is-empty", "is-not-empty"];
      if (typeof filterSource.operator !== "string" || !allowedOperators.includes(filterSource.operator)) fail(`${path}.filter.operator`, "is not a supported point-layer operator");
      if (!["is-empty", "is-not-empty"].includes(String(filterSource.operator)) && typeof filterSource.value !== "string") fail(`${path}.filter.value`, "must be a string for this operator");
      if (!fields.has(filterField)) fail(`${path}.filter.field`, "must identify a field in the source form");
      filter = { field: filterField, operator: String(filterSource.operator), ...(typeof filterSource.value === "string" ? { value: filterSource.value } : {}) };
    }
    return { ...shared, kind: source.kind, sourceFormId, latitudeField, longitudeField, labelField, markerStyle, markerColor, ...(filter ? { filter } : {}) };
  }
  if (source.kind === "choropleth") {
    const assetId = nonEmptyString(source.assetId, `${path}.assetId`);
    const asset = assets.get(assetId);
    if (!asset) fail(`${path}.assetId`, "must identify a project map asset");
    if (asset.format !== "geojson") fail(`${path}.assetId`, "must identify a GeoJSON project asset");
    const sourceFormId = nonEmptyString(source.sourceFormId, `${path}.sourceFormId`);
    const form = forms.get(sourceFormId);
    if (!form) fail(`${path}.sourceFormId`, "must identify a form in this project");
    const fields = new Map(form.schema.fields.map((field) => [field.name, field]));
    const boundaryKeyField = nonEmptyString(source.boundaryKeyField, `${path}.boundaryKeyField`);
    const dataKeyField = nonEmptyString(source.dataKeyField, `${path}.dataKeyField`);
    const valueField = nonEmptyString(source.valueField, `${path}.valueField`);
    for (const [field, fieldPath] of [[dataKeyField, `${path}.dataKeyField`], [valueField, `${path}.valueField`]] as const) if (!fields.has(field)) fail(fieldPath, "must identify a field in the source form");
    if (source.joinNormalization !== "exact" && source.joinNormalization !== "trim-casefold") fail(`${path}.joinNormalization`, "must be exact or trim-casefold");
    const classification = objectAt(source.classification, `${path}.classification`);
    if (classification.method !== "manual" && classification.method !== "equal-interval" && classification.method !== "quantile") fail(`${path}.classification.method`, "is not supported");
    if (typeof classification.classCount !== "number" || !Number.isSafeInteger(classification.classCount) || classification.classCount < 2 || classification.classCount > 12) fail(`${path}.classification.classCount`, "must be an integer from 2 through 12");
    const breaks = classification.breaks;
    if (classification.method === "manual") {
      if (!Array.isArray(breaks) || breaks.length !== classification.classCount - 1 || breaks.some((value) => typeof value !== "number" || !Number.isFinite(value))) fail(`${path}.classification.breaks`, "must contain one fewer finite numeric break than classes");
    } else if (breaks !== undefined) fail(`${path}.classification.breaks`, "must be omitted for automatic classification");
    if (!Array.isArray(source.palette) || source.palette.length !== classification.classCount || source.palette.some((color) => typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))) fail(`${path}.palette`, "must contain one six-digit hex color per class");
    if (typeof source.opacity !== "number" || !Number.isFinite(source.opacity) || source.opacity < 0 || source.opacity > 1) fail(`${path}.opacity`, "must be from 0 through 1");
    if (typeof source.noDataColor !== "string" || !/^#[0-9a-f]{6}$/i.test(source.noDataColor)) fail(`${path}.noDataColor`, "must be a six-digit hex color");
    const legendTitle = nonEmptyString(source.legendTitle, `${path}.legendTitle`);
    let filter: { field: string; operator: string; value?: string } | undefined;
    if (source.filter !== undefined) {
      const filterSource = objectAt(source.filter, `${path}.filter`);
      const filterField = nonEmptyString(filterSource.field, `${path}.filter.field`);
      const allowedOperators = ["equals", "not-equals", "contains", "greater-than", "greater-or-equal", "less-than", "less-or-equal", "is-empty", "is-not-empty"];
      if (typeof filterSource.operator !== "string" || !allowedOperators.includes(filterSource.operator)) fail(`${path}.filter.operator`, "is not a supported choropleth operator");
      if (!["is-empty", "is-not-empty"].includes(String(filterSource.operator)) && typeof filterSource.value !== "string") fail(`${path}.filter.value`, "must be a string for this operator");
      if (!fields.has(filterField)) fail(`${path}.filter.field`, "must identify a field in the source form");
      filter = { field: filterField, operator: String(filterSource.operator), ...(typeof filterSource.value === "string" ? { value: filterSource.value } : {}) };
    }
    return { ...shared, kind: "choropleth", assetId, sourceFormId, boundaryKeyField, dataKeyField, valueField, joinNormalization: source.joinNormalization, classification: { method: classification.method, classCount: classification.classCount, ...(Array.isArray(breaks) ? { breaks } : {}) }, palette: source.palette, opacity: source.opacity, noDataColor: source.noDataColor, legendTitle, ...(filter ? { filter } : {}) };
  }
  if (source.kind === "dot-density") {
    const assetId = nonEmptyString(source.assetId, `${path}.assetId`);
    const asset = assets.get(assetId);
    if (!asset || asset.format !== "geojson") fail(`${path}.assetId`, "must identify a GeoJSON project asset");
    const sourceFormId = nonEmptyString(source.sourceFormId, `${path}.sourceFormId`);
    const form = forms.get(sourceFormId);
    if (!form) fail(`${path}.sourceFormId`, "must identify a form in this project");
    const fields = new Map(form.schema.fields.map((field) => [field.name, field]));
    const boundaryKeyField = nonEmptyString(source.boundaryKeyField, `${path}.boundaryKeyField`);
    const dataKeyField = nonEmptyString(source.dataKeyField, `${path}.dataKeyField`);
    const valueField = nonEmptyString(source.valueField, `${path}.valueField`);
    if (!fields.has(dataKeyField)) fail(`${path}.dataKeyField`, "must identify a field in the source form");
    if (!fields.has(valueField)) fail(`${path}.valueField`, "must identify a field in the source form");
    if (source.joinNormalization !== "exact" && source.joinNormalization !== "trim-casefold") fail(`${path}.joinNormalization`, "must be exact or trim-casefold");
    if (typeof source.valuePerDot !== "number" || !Number.isFinite(source.valuePerDot) || source.valuePerDot <= 0) fail(`${path}.valuePerDot`, "must be a positive finite number");
    if (source.rounding !== "floor" && source.rounding !== "nearest" && source.rounding !== "ceil") fail(`${path}.rounding`, "is not supported");
    if (typeof source.seed !== "number" || !Number.isSafeInteger(source.seed) || source.seed < 0 || source.seed > 0xffffffff) fail(`${path}.seed`, "must be a uint32");
    if (source.placementMethod !== "seeded-jitter" && source.placementMethod !== "deterministic-grid") fail(`${path}.placementMethod`, "is not supported");
    if (typeof source.dotColor !== "string" || !/^#[0-9a-f]{6}$/i.test(source.dotColor)) fail(`${path}.dotColor`, "must be a six-digit hex color");
    if (typeof source.dotRadiusPixels !== "number" || !Number.isFinite(source.dotRadiusPixels) || source.dotRadiusPixels <= 0 || source.dotRadiusPixels > 20) fail(`${path}.dotRadiusPixels`, "must be from greater than 0 through 20");
    if (typeof source.opacity !== "number" || !Number.isFinite(source.opacity) || source.opacity < 0 || source.opacity > 1) fail(`${path}.opacity`, "must be from 0 through 1");
    const legendTitle = nonEmptyString(source.legendTitle, `${path}.legendTitle`);
    if (typeof source.maxDotsPerFeature !== "number" || !Number.isSafeInteger(source.maxDotsPerFeature) || source.maxDotsPerFeature < 1) fail(`${path}.maxDotsPerFeature`, "must be a positive integer");
    if (typeof source.maxTotalDots !== "number" || !Number.isSafeInteger(source.maxTotalDots) || source.maxTotalDots < 1 || source.maxDotsPerFeature > source.maxTotalDots) fail(`${path}.maxTotalDots`, "must be a positive integer at least as large as maxDotsPerFeature");
    return { ...shared, kind: "dot-density", assetId, sourceFormId, boundaryKeyField, dataKeyField, valueField, joinNormalization: source.joinNormalization, valuePerDot: source.valuePerDot, rounding: source.rounding, seed: source.seed, placementMethod: source.placementMethod, dotColor: source.dotColor, dotRadiusPixels: source.dotRadiusPixels, opacity: source.opacity, legendTitle, maxDotsPerFeature: source.maxDotsPerFeature, maxTotalDots: source.maxTotalDots };
  }
  const assetId = nonEmptyString(source.assetId, `${path}.assetId`);
  const asset = assets.get(assetId);
  if (!asset) fail(`${path}.assetId`, "must identify a project map asset");
  if (asset.format !== source.kind && !(source.kind === "raster" && asset.format === "geotiff")) {
    fail(`${path}.assetId`, "does not match the layer kind");
  }
  const assetShared = { ...shared, assetId };
  if (source.kind === "geojson") {
    if (typeof source.labelsEnabled !== "boolean") fail(`${path}.labelsEnabled`, "must be boolean");
    if (typeof source.labelField !== "string" || source.labelField.length > 200) fail(`${path}.labelField`, "must be a string of at most 200 characters");
    return { ...assetShared, kind: "geojson", labelField: source.labelField, labelsEnabled: source.labelsEnabled };
  }
  if (typeof source.opacity !== "number" || !Number.isFinite(source.opacity) || source.opacity < 0.1 || source.opacity > 1) {
    fail(`${path}.opacity`, "must be from 0.1 through 1");
  }
  return { ...assetShared, kind: "raster", opacity: source.opacity };
}

function projectMapPresentationAt(value: unknown, path: string): ProjectMapPresentationV1 {
  const source = objectAt(value, path);
  if (source.schema !== "epi-gis-map-presentation/0.1") fail(`${path}.schema`, "must be epi-gis-map-presentation/0.1");
  if (source.background !== "street" && source.background !== "blank" && source.background !== "offline") fail(`${path}.background`, "must be street, blank, or offline");
  const annotations = objectAt(source.annotations, `${path}.annotations`);
  const text = (key: string, maximum: number): string => {
    if (typeof annotations[key] !== "string" || String(annotations[key]).length > maximum) fail(`${path}.annotations.${key}`, `must be text of at most ${maximum} characters`);
    return String(annotations[key]).trim();
  };
  const title = text("title", 200);
  const subtitle = text("subtitle", 300);
  const note = text("note", 2000);
  for (const key of ["showLegend", "showNorthArrow", "showScaleBar"]) if (typeof annotations[key] !== "boolean") fail(`${path}.annotations.${key}`, "must be boolean");
  return { schema: "epi-gis-map-presentation/0.1", background: source.background, annotations: { title, subtitle, note, showLegend: annotations.showLegend as boolean, showNorthArrow: annotations.showNorthArrow as boolean, showScaleBar: annotations.showScaleBar as boolean } };
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
  if (snapshot.mapAssets !== undefined) {
    if (!Array.isArray(snapshot.mapAssets)) fail("project.mapAssets", "must be an array");
    result.mapAssets = snapshot.mapAssets.map((asset, index) => projectMapAssetAt(asset, `project.mapAssets[${index}]`));
    const ids = new Set<string>();
    for (const asset of result.mapAssets) {
      if (ids.has(asset.id)) fail("project.mapAssets", `contains duplicate asset id ${JSON.stringify(asset.id)}`);
      ids.add(asset.id);
    }
  }
  if (snapshot.mapLayers !== undefined) {
    if (!Array.isArray(snapshot.mapLayers)) fail("project.mapLayers", "must be an array");
    const assets = new Map((result.mapAssets ?? []).map((asset) => [asset.id, asset]));
    const formsById = new Map(forms.map((form) => [form.id, form]));
    result.mapLayers = snapshot.mapLayers.map((layer, index) => projectMapLayerAt(layer, `project.mapLayers[${index}]`, assets, formsById));
    const ids = new Set<string>();
    for (const layer of result.mapLayers) {
      if (ids.has(layer.id)) fail("project.mapLayers", `contains duplicate layer id ${JSON.stringify(layer.id)}`);
      ids.add(layer.id);
    }
  }
  if (snapshot.mapPresentation !== undefined) result.mapPresentation = projectMapPresentationAt(snapshot.mapPresentation, "project.mapPresentation");
  if (snapshot.referenceLayerSources !== undefined) {
    if (!Array.isArray(snapshot.referenceLayerSources)) fail("project.referenceLayerSources", "must be an array");
    result.referenceLayerSources = snapshot.referenceLayerSources.map((source, index) => referenceLayerSourceAt(source, `project.referenceLayerSources[${index}]`));
    const ids = new Set<string>();
    for (const source of result.referenceLayerSources) {
      if (ids.has(source.id)) fail("project.referenceLayerSources", `contains duplicate source id ${JSON.stringify(source.id)}`);
      ids.add(source.id);
    }
  }
  for (const [index, asset] of (result.mapAssets ?? []).entries()) {
    const lineageSource = asset.sourceLineage?.source;
    if (!lineageSource) continue;
    const matchingSource = (result.referenceLayerSources ?? []).find((source) => source.id === lineageSource.sha256);
    if (!matchingSource
      || matchingSource.sha256 !== lineageSource.sha256
      || matchingSource.byteLength !== lineageSource.byteLength
      || matchingSource.packageFormat !== lineageSource.packageFormat) {
      fail(`project.mapAssets[${index}].sourceLineage.source`, "must exactly match a bundled project.referenceLayerSources entry by id, SHA-256, byte length, and package format");
    }
  }
  if (snapshot.auditLog !== undefined) {
    if (!Array.isArray(snapshot.auditLog)) fail("project.auditLog", "must be an array");
    result.auditLog = snapshot.auditLog.map((item, index) => {
      const event = objectAt(item, `project.auditLog[${index}]`);
      if (event.action !== "record-deleted" && event.action !== "record-restored" && event.action !== "check-code-executed") {
        fail(`project.auditLog[${index}].action`, "must be record-deleted, record-restored, or check-code-executed");
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
