import {
  validateProjectSnapshot,
  type ProjectSnapshotV1,
} from "./core.ts";

export const PROJECT_PACKAGE_FORMAT = "epi-info-ai-project" as const;
export const PROJECT_PACKAGE_VERSION = 2 as const;
export const MAX_PROJECT_PACKAGE_BYTES = 25 * 1024 * 1024;

export type CompatibilityDisposition = "preserved" | "adapted" | "unsupported" | "blocked";

export interface ProjectProgram {
  name: string;
  source: string;
  language: "classic-analysis" | "check-code";
  author?: string;
  modifiedAt?: string;
}

export interface ProjectCodeTable {
  name: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

export interface LegacyFieldMetadata {
  id: number;
  name: string;
  prompt: string;
  sourceTypeId: number;
  pageId: number | null;
  tabIndex: number | null;
  required: boolean;
  readOnly: boolean;
  tabStop: boolean;
  checkCodeBefore?: string;
  checkCodeAfter?: string;
}

export interface LegacyPageMetadata {
  id: number;
  name: string;
  position: number;
  fields: LegacyFieldMetadata[];
  checkCodeBefore?: string;
  checkCodeAfter?: string;
}

export interface LegacyFormMetadata {
  id: number;
  name: string;
  related: boolean;
  pages: LegacyPageMetadata[];
  unpagedFields: LegacyFieldMetadata[];
  checkCode?: string;
}

export interface MigrationFinding {
  feature: string;
  disposition: CompatibilityDisposition;
  detail: string;
}

export interface LegacyMigrationPayload {
  sourceFormat: "epi-info-access";
  sourceName: string;
  inventory: {
    forms: number;
    pages: number;
    fields: number;
    programs: number;
    codeTables: number;
  };
  forms: LegacyFormMetadata[];
  findings: MigrationFinding[];
}

export interface ProjectPackageV2 {
  format: typeof PROJECT_PACKAGE_FORMAT;
  version: typeof PROJECT_PACKAGE_VERSION;
  exportedAt: string;
  project: ProjectSnapshotV1;
  programs: ProjectProgram[];
  codeTables: ProjectCodeTable[];
  migration?: LegacyMigrationPayload;
}

export class ProjectPackageValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = "ProjectPackageValidationError";
    this.path = path;
  }
}

function fail(path: string, message: string): never {
  throw new ProjectPackageValidationError(path, message);
}

function objectAt(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  return value as Record<string, unknown>;
}

function stringAt(value: unknown, path: string, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) fail(path, "must be a string");
  return value;
}

function integerAt(value: unknown, path: string, minimum?: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (minimum !== undefined && value < minimum)) {
    fail(path, `must be a safe integer${minimum === undefined ? "" : ` greater than or equal to ${minimum}`}`);
  }
  return value;
}

function optionalString(value: unknown, path: string): string | undefined {
  return value === undefined || value === null || value === "" ? undefined : stringAt(value, path);
}

function programAt(value: unknown, path: string): ProjectProgram {
  const source = objectAt(value, path);
  if (source.language !== "classic-analysis" && source.language !== "check-code") {
    fail(`${path}.language`, "must be classic-analysis or check-code");
  }
  const result: ProjectProgram = {
    name: stringAt(source.name, `${path}.name`),
    source: stringAt(source.source, `${path}.source`, true),
    language: source.language,
  };
  const author = optionalString(source.author, `${path}.author`);
  const modifiedAt = optionalString(source.modifiedAt, `${path}.modifiedAt`);
  if (author !== undefined) result.author = author;
  if (modifiedAt !== undefined) result.modifiedAt = modifiedAt;
  return result;
}

function codeTableAt(value: unknown, path: string): ProjectCodeTable {
  const source = objectAt(value, path);
  if (!Array.isArray(source.columns) || !source.columns.every((column) => typeof column === "string" && column.length > 0)) {
    fail(`${path}.columns`, "must be an array of column names");
  }
  if (!Array.isArray(source.rows)) fail(`${path}.rows`, "must be an array");
  return {
    name: stringAt(source.name, `${path}.name`),
    columns: [...source.columns] as string[],
    rows: source.rows.map((row, index) => objectAt(row, `${path}.rows[${index}]`)),
  };
}

function legacyFieldAt(value: unknown, path: string): LegacyFieldMetadata {
  const source = objectAt(value, path);
  const pageId = source.pageId === null ? null : integerAt(source.pageId, `${path}.pageId`, 0);
  const tabIndex = source.tabIndex === null ? null : integerAt(source.tabIndex, `${path}.tabIndex`, 0);
  for (const property of ["required", "readOnly", "tabStop"] as const) {
    if (typeof source[property] !== "boolean") fail(`${path}.${property}`, "must be a boolean");
  }
  const result: LegacyFieldMetadata = {
    id: integerAt(source.id, `${path}.id`, 0),
    name: stringAt(source.name, `${path}.name`),
    prompt: stringAt(source.prompt, `${path}.prompt`, true),
    sourceTypeId: integerAt(source.sourceTypeId, `${path}.sourceTypeId`, 1),
    pageId,
    tabIndex,
    required: source.required as boolean,
    readOnly: source.readOnly as boolean,
    tabStop: source.tabStop as boolean,
  };
  const before = optionalString(source.checkCodeBefore, `${path}.checkCodeBefore`);
  const after = optionalString(source.checkCodeAfter, `${path}.checkCodeAfter`);
  if (before !== undefined) result.checkCodeBefore = before;
  if (after !== undefined) result.checkCodeAfter = after;
  return result;
}

function legacyPageAt(value: unknown, path: string): LegacyPageMetadata {
  const source = objectAt(value, path);
  if (!Array.isArray(source.fields)) fail(`${path}.fields`, "must be an array");
  const result: LegacyPageMetadata = {
    id: integerAt(source.id, `${path}.id`, 0),
    name: stringAt(source.name, `${path}.name`),
    position: integerAt(source.position, `${path}.position`, 0),
    fields: source.fields.map((field, index) => legacyFieldAt(field, `${path}.fields[${index}]`)),
  };
  const before = optionalString(source.checkCodeBefore, `${path}.checkCodeBefore`);
  const after = optionalString(source.checkCodeAfter, `${path}.checkCodeAfter`);
  if (before !== undefined) result.checkCodeBefore = before;
  if (after !== undefined) result.checkCodeAfter = after;
  return result;
}

function migrationAt(value: unknown, path: string): LegacyMigrationPayload {
  const source = objectAt(value, path);
  if (source.sourceFormat !== "epi-info-access") fail(`${path}.sourceFormat`, "must be epi-info-access");
  const inventory = objectAt(source.inventory, `${path}.inventory`);
  if (!Array.isArray(source.forms)) fail(`${path}.forms`, "must be an array");
  if (!Array.isArray(source.findings)) fail(`${path}.findings`, "must be an array");
  const forms = source.forms.map((form, formIndex) => {
    const item = objectAt(form, `${path}.forms[${formIndex}]`);
    if (!Array.isArray(item.pages)) fail(`${path}.forms[${formIndex}].pages`, "must be an array");
    const result: LegacyFormMetadata = {
      id: integerAt(item.id, `${path}.forms[${formIndex}].id`, 0),
      name: stringAt(item.name, `${path}.forms[${formIndex}].name`),
      related: Boolean(item.related),
      pages: item.pages.map((page, pageIndex) => legacyPageAt(page, `${path}.forms[${formIndex}].pages[${pageIndex}]`)),
      unpagedFields: Array.isArray(item.unpagedFields)
        ? item.unpagedFields.map((field, fieldIndex) => legacyFieldAt(field, `${path}.forms[${formIndex}].unpagedFields[${fieldIndex}]`))
        : [],
    };
    const checkCode = optionalString(item.checkCode, `${path}.forms[${formIndex}].checkCode`);
    if (checkCode !== undefined) result.checkCode = checkCode;
    return result;
  });
  const findings = source.findings.map((finding, index) => {
    const item = objectAt(finding, `${path}.findings[${index}]`);
    if (!new Set(["preserved", "adapted", "unsupported", "blocked"]).has(String(item.disposition))) {
      fail(`${path}.findings[${index}].disposition`, "is invalid");
    }
    return {
      feature: stringAt(item.feature, `${path}.findings[${index}].feature`),
      disposition: item.disposition as CompatibilityDisposition,
      detail: stringAt(item.detail, `${path}.findings[${index}].detail`),
    };
  });
  return {
    sourceFormat: "epi-info-access",
    sourceName: stringAt(source.sourceName, `${path}.sourceName`),
    inventory: {
      forms: integerAt(inventory.forms, `${path}.inventory.forms`, 0),
      pages: integerAt(inventory.pages, `${path}.inventory.pages`, 0),
      fields: integerAt(inventory.fields, `${path}.inventory.fields`, 0),
      programs: integerAt(inventory.programs, `${path}.inventory.programs`, 0),
      codeTables: integerAt(inventory.codeTables, `${path}.inventory.codeTables`, 0),
    },
    forms,
    findings,
  };
}

export function validateProjectPackage(value: unknown): ProjectPackageV2 {
  const source = objectAt(value, "package");
  if (source.format !== PROJECT_PACKAGE_FORMAT) fail("package.format", `must be ${PROJECT_PACKAGE_FORMAT}`);
  if (source.version !== PROJECT_PACKAGE_VERSION) fail("package.version", `must be ${PROJECT_PACKAGE_VERSION}`);
  if (!Array.isArray(source.programs)) fail("package.programs", "must be an array");
  if (!Array.isArray(source.codeTables)) fail("package.codeTables", "must be an array");
  const result: ProjectPackageV2 = {
    format: PROJECT_PACKAGE_FORMAT,
    version: PROJECT_PACKAGE_VERSION,
    exportedAt: stringAt(source.exportedAt, "package.exportedAt"),
    project: validateProjectSnapshot(source.project),
    programs: source.programs.map((program, index) => programAt(program, `package.programs[${index}]`)),
    codeTables: source.codeTables.map((table, index) => codeTableAt(table, `package.codeTables[${index}]`)),
  };
  if (source.migration !== undefined) result.migration = migrationAt(source.migration, "package.migration");
  if (!Number.isFinite(Date.parse(result.exportedAt))) fail("package.exportedAt", "must be an ISO-compatible date/time");
  if (new Set(result.programs.map((program) => program.name.toLocaleLowerCase())).size !== result.programs.length) {
    fail("package.programs", "contains duplicate program names");
  }
  if (new Set(result.codeTables.map((table) => table.name.toLocaleLowerCase())).size !== result.codeTables.length) {
    fail("package.codeTables", "contains duplicate code-table names");
  }
  if (result.migration) {
    const pages = result.migration.forms.flatMap((form) => form.pages);
    const fields = result.migration.forms.flatMap((form) => [
      ...form.unpagedFields,
      ...form.pages.flatMap((page) => page.fields),
    ]);
    const actual = {
      forms: result.migration.forms.length,
      pages: pages.length,
      fields: fields.length,
      programs: result.programs.length,
      codeTables: result.codeTables.length,
    };
    for (const [name, count] of Object.entries(actual)) {
      if (result.migration.inventory[name as keyof typeof actual] !== count) {
        fail(`package.migration.inventory.${name}`, `declares ${result.migration.inventory[name as keyof typeof actual]} but contains ${count}`);
      }
    }
    if (result.project.forms.length !== result.migration.inventory.forms) {
      fail("package.project.forms", "must contain one runnable projection per migrated form");
    }
  }
  return result;
}

export function parseProjectPackage(text: string): ProjectPackageV2 {
  try {
    return validateProjectPackage(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError) fail("package", "is not valid JSON");
    throw error;
  }
}

export function createProjectPackage(project: ProjectSnapshotV1, extras: Partial<Pick<ProjectPackageV2, "programs" | "codeTables" | "migration">> = {}): ProjectPackageV2 {
  const candidate: ProjectPackageV2 = {
    format: PROJECT_PACKAGE_FORMAT,
    version: PROJECT_PACKAGE_VERSION,
    exportedAt: new Date().toISOString(),
    project: validateProjectSnapshot(project),
    programs: extras.programs ?? [],
    codeTables: extras.codeTables ?? [],
  };
  if (extras.migration !== undefined) candidate.migration = extras.migration;
  return validateProjectPackage(candidate);
}
