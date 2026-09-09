import {
  validateProjectSnapshot,
  type DatasetProvenance,
  type EpiRecord,
  type FieldDefinition,
  type FieldType,
  type FormSchema,
  type HostedProjectReference,
  type ProjectForm,
  type ProjectSnapshotV1,
  type ProjectStudyArea,
} from "../app/contracts/core.ts";
import type { MapDataSource } from "../app/contracts/maps.ts";
import type { ClassicDeleteRecordsResult } from "../app/programming/classic-delete-records.ts";
import type { ClassicUndeleteRecordsResult } from "../app/programming/classic-undelete-records.ts";
import type { FieldCheckCode, SafeCheckCodeStatement, SafeFieldAction } from "../app/contracts/check-code.ts";
import type { FieldValidationRule } from "../app/contracts/validation.ts";
import {
  createProjectPackage,
  MAX_PROJECT_PACKAGE_BYTES,
  parseProjectPackage,
  validateProjectProgram,
  type LegacyMigrationPayload,
  type ProjectCodeTable,
  type ProjectProgram,
} from "../app/contracts/project-package.ts";
import {
  createProjectArchive,
  isBinaryProjectArchive,
  MAX_PROJECT_ARCHIVE_BYTES,
  parseProjectArchive,
  type ProjectArchiveAsset,
} from "../app/contracts/project-archive.ts";
import {
  decryptProjectArchive,
  encryptProjectArchive,
  ENCRYPTED_PROJECT_EXTENSION,
  isEncryptedProjectArchive,
} from "../app/contracts/encrypted-project.ts";
import {
  inferSchemaFromCsv,
  inferSchemaFromRows,
  normalizeImportedCoordinates,
  normalizeFieldName,
  parseCsv,
  serializeCsv,
} from "../app/forms/csv.ts";
import { readTabularFile } from "../app/forms/importers.ts";
import { applyDataImport, buildDataImportPreview, suggestedImportKey, type DataImportMode, type DataImportPreview } from "../app/forms/import-preview.ts";
import {
  collectEntryRecord,
  initializeEntryView,
  renderEntryForm as renderEntryFormView,
  renderEntryValidation,
  renderRecords as renderRecordList,
  setEntryView,
} from "../app/forms/entry-view.ts";
import { loadProjectSnapshot } from "../app/forms/project-state.ts";
import { initializeStudyAreaPicker, openStudyAreaPicker } from "../app/forms/study-area-picker.ts";
import { offlineMapProvider } from "../app/maps/offline-map-estimator.ts";
import { removePmtilesAsset, restorePmtilesAsset } from "../app/maps/pmtiles-import.ts";
import { readStoredPmtilesFile } from "../app/maps/pmtiles-reader.ts";
import { createSecureShareReceiver, createSecureShareSender } from "../app/share/webrtc-transfer.ts";
import { renderFormDesignerMenuContract } from "../app/forms/form-designer-menu.ts";
import { renderEnterDataMenuContract } from "../app/forms/enter-data-menu.ts";
import { buildDataQualityReport, type DuplicateGroup } from "../app/forms/data-quality.ts";
import { materializeCalculatedFields, validateProjectRecords, validateRecord, validateRecords } from "../app/forms/validation.ts";
import {
  loadBrowserJson as loadJson,
  loadBrowserText as loadText,
  saveBrowserJson as saveJson,
  saveBrowserText as saveText,
} from "../app/storage/browser.ts";

export { inferSchemaFromCsv, inferSchemaFromRows, parseCsv, parseTsv, serializeCsv } from "../app/forms/csv.ts";
export { parseJsonRecords } from "../app/forms/importers.ts";

const SCHEMA_KEY = "epi-info-ai.form-schema.v1";
const RECORDS_KEY = "epi-info-ai.records.v1";
const PROJECT_KEY = "epi-info-ai.project-name.v1";
const PROJECT_STATE_KEY = "epi-info-ai.project-state.v1";
const PROJECT_RECOVERY_KEY = "epi-info-ai.project-state-unreadable.v1";
const PROJECT_ACTIVE_KEY = "epi-info-ai.project-active.v1";
const RECENT_PROJECTS_KEY = "epi-info-ai.recent-projects.v1";
const PROJECT_EXTRAS_KEY = "epi-info-ai.project-extras.v1";
const SNAP_KEY = "epi-info-ai.snap-to-grid.v1";
const SUPABASE_CONFIG_KEY = "epi-info-ai.supabase-config.v1";
const GRID_SIZE = 12;

type FormDomControl = HTMLElement & HTMLInputElement & HTMLSelectElement & HTMLDialogElement
  & HTMLFormElement & HTMLDetailsElement;

function requiredElement<T extends Element = FormDomControl>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required Forms interface element is missing: ${selector}`);
  return element;
}

function requiredElements<T extends Element = FormDomControl>(selector: string): NodeListOf<T> {
  return document.querySelectorAll<T>(selector);
}

function requiredControl(parent: ParentNode, selector: string): FormDomControl {
  const element = parent.querySelector<FormDomControl>(selector);
  if (!element) throw new Error(`Required Forms control is missing: ${selector}`);
  return element;
}

function eventControl(event: Event): FormDomControl {
  if (!(event.target instanceof HTMLElement)) throw new Error("Forms event target is not an interface element.");
  return event.target as FormDomControl;
}

interface SupabaseConnectionConfig {
  url: string;
  publishableKey: string;
  providers: { email: boolean; github: boolean };
}

interface RecentProjectEntry {
  id: string;
  name: string;
  lastOpenedAt: string;
  snapshot: ProjectSnapshotV1;
  extras: {
    programs: ProjectProgram[];
    codeTables: ProjectCodeTable[];
    migration?: LegacyMigrationPayload;
  };
}

const FIELD_TYPES: FieldType[] = ["text", "text-uppercase", "multiline", "unique-id", "number", "phone", "date", "time", "checkbox", "yes-no", "option", "command-button"];
const DEFAULT_SCHEMA: FormSchema = {
  name: "Outbreak Case Report Form",
  fields: [
    { name: "case_id", prompt: "Case ID", type: "text", required: true, rules: [{ kind: "unique" }] },
    { name: "onset_date", prompt: "Onset date", type: "date", required: false },
    { name: "ill", prompt: "Ill", type: "yes-no", required: true },
    { name: "exposure", prompt: "Primary exposure", type: "text", required: false },
    { name: "age", prompt: "Age", type: "number", required: false, rules: [{ kind: "range", valueType: "number", min: 0, max: 120 }] },
  ],
};

let schema: FormSchema = loadJson(SCHEMA_KEY, DEFAULT_SCHEMA);
let records: EpiRecord[] = loadJson<EpiRecord[]>(RECORDS_KEY, []);
let projectName = loadText(PROJECT_KEY, "Browser Project");
let snapToGrid = loadText(SNAP_KEY, "true") !== "false";
const loadedProject = loadProjectSnapshot(PROJECT_STATE_KEY, PROJECT_RECOVERY_KEY);
let projectLoadWarning = loadedProject.warning;
let activeRulesRow: HTMLTableRowElement | null = null;
let activeDuplicateGroup: DuplicateGroup | null = null;
function loadProjectPackageExtras(): {
  programs: ProjectProgram[];
  codeTables: ProjectCodeTable[];
  migration?: LegacyMigrationPayload;
} {
  const stored = loadJson<unknown>(PROJECT_EXTRAS_KEY, null);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return { programs: [], codeTables: [] };
  const source = stored as Record<string, unknown>;
  const programs = Array.isArray(source.programs) ? source.programs.flatMap((program, index) => {
    try { return [validateProjectProgram(program, `stored programs[${index}]`)]; } catch { return []; }
  }) : [];
  const codeTables = Array.isArray(source.codeTables) ? source.codeTables.filter((table): table is ProjectCodeTable => Boolean(table && typeof table === "object")) : [];
  return { programs, codeTables };
}

let projectPackageExtras: {
  programs: ProjectProgram[];
  codeTables: ProjectCodeTable[];
  migration?: LegacyMigrationPayload;
} = loadProjectPackageExtras();
let projectState: ProjectSnapshotV1 = loadedProject.snapshot ?? {
    name: projectName,
    currentFormId: "form-default",
    forms: [{ id: "form-default", schema: structuredClone(schema), records: structuredClone(records) }],
  };
let hasActiveProject = loadText(PROJECT_ACTIVE_KEY, "true") !== "false";
let activeRecentProjectId: string | null = null;
let recentProjects = loadJson<RecentProjectEntry[]>(RECENT_PROJECTS_KEY, []).flatMap((entry) => {
  try {
    if (!entry || typeof entry.id !== "string" || typeof entry.lastOpenedAt !== "string") return [];
    const snapshot = validateProjectSnapshot(entry.snapshot);
    return [{
      id: entry.id,
      name: snapshot.name,
      lastOpenedAt: entry.lastOpenedAt,
      snapshot,
      extras: {
        programs: Array.isArray(entry.extras?.programs) ? structuredClone(entry.extras.programs) : [],
        codeTables: Array.isArray(entry.extras?.codeTables) ? structuredClone(entry.extras.codeTables) : [],
        ...(entry.extras?.migration ? { migration: structuredClone(entry.extras.migration) } : {}),
      },
    }];
  } catch {
    return [];
  }
}).slice(0, 8);
projectName = projectState.name;
let currentFormId = projectState.currentFormId || projectState.forms[0]!.id;
const initialForm = projectState.forms.find((form) => form.id === currentFormId) ?? projectState.forms[0]!;
schema = structuredClone(initialForm.schema);
records = structuredClone(initialForm.records || []);
let datasetProvenance: DatasetProvenance | undefined = initialForm.dataset ? structuredClone(initialForm.dataset) : undefined;
let importHistory: DatasetProvenance[] = structuredClone(initialForm.imports ?? (initialForm.dataset ? [initialForm.dataset] : []));
const restoredDataIssues = validateProjectRecords(projectState);
if (restoredDataIssues.length > 0) {
  const detail = `${restoredDataIssues.length} saved-record validation issue${restoredDataIssues.length === 1 ? "" : "s"} found. Open Enter Data > Data Quality to review.`;
  projectLoadWarning = projectLoadWarning ? `${projectLoadWarning} ${detail}` : detail;
}

function normalizeSupabaseUrl(value: string): string {
  const url = new URL(String(value || "").trim());
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Supabase connections must use HTTPS.");
  }
  return url.origin;
}

export async function testSupabaseConnection(urlValue: string, publishableKeyValue: string): Promise<SupabaseConnectionConfig> {
  const url = normalizeSupabaseUrl(urlValue);
  const publishableKey = String(publishableKeyValue || "").trim();
  if (!publishableKey) throw new Error("Enter the Supabase publishable key.");
  const response = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: publishableKey },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("Supabase rejected the publishable key.");
    throw new Error(`Supabase connection failed (HTTP ${response.status}).`);
  }
  const settings = await response.json() as { external?: { email?: unknown; github?: unknown } };
  return {
    url,
    publishableKey,
    providers: {
      email: Boolean(settings.external?.email),
      github: Boolean(settings.external?.github),
    },
  };
}

function renderStorageBadge() {
  const badge = requiredElement("#data-storage-badge");
  if (!badge) return;
  badge.textContent = projectState.storage?.type === "supabase"
    ? "Supabase connected - local working copy"
    : "Local browser data";
}

function newFormId() {
  return globalThis.crypto?.randomUUID?.() || `form-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function alignToGrid(value: number, gridSize = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

function snapCoordinate(value: number): number {
  return snapToGrid ? alignToGrid(value) : Math.round(value);
}

function syncCurrentForm(): boolean {
  if (!hasActiveProject) return true;
  const current = projectState.forms.find((form) => form.id === currentFormId);
  const snapshot: ProjectForm = {
    id: currentFormId,
    schema: structuredClone(schema),
    records: structuredClone(records),
    ...(datasetProvenance ? { dataset: structuredClone(datasetProvenance) } : {}),
    ...(importHistory.length ? { imports: structuredClone(importHistory) } : {}),
  };
  if (current) {
    Object.assign(current, snapshot);
    if (!datasetProvenance) delete current.dataset;
    if (!importHistory.length) delete current.imports;
  } else projectState.forms.push(snapshot);
  projectState.name = projectName;
  projectState.currentFormId = currentFormId;
  return [
    saveJson(PROJECT_STATE_KEY, projectState),
    saveText(PROJECT_KEY, projectName),
    saveJson(SCHEMA_KEY, schema),
    saveJson(RECORDS_KEY, records),
    saveJson(PROJECT_EXTRAS_KEY, projectPackageExtras),
  ].every(Boolean);
}

function rememberCurrentProject(): boolean {
  const entry: RecentProjectEntry = {
    id: activeRecentProjectId ?? lifecycleId("recent"),
    name: projectName,
    lastOpenedAt: new Date().toISOString(),
    snapshot: structuredClone(projectState),
    extras: structuredClone(projectPackageExtras),
  };
  activeRecentProjectId = entry.id;
  recentProjects = [entry, ...recentProjects.filter((candidate) => candidate.id !== entry.id)].slice(0, 8);
  return saveJson(RECENT_PROJECTS_KEY, recentProjects);
}

function setProjectControlsEnabled(enabled: boolean): void {
  for (const selector of [
    "#designer-project-storage", "#project-storage", "#new-form", "#save-form",
    "#snap-to-grid", "#restore-demo", "#form-csv-import", "#designer-enter-data",
    "#designer-new-form", "#designer-menu-enter-data",
  ]) {
    const control = requiredElement<HTMLInputElement | HTMLButtonElement>(selector);
    control.disabled = !enabled;
    control.closest("label")?.setAttribute("aria-disabled", String(!enabled));
  }
  requiredElement<HTMLButtonElement>("#designer-close-project").disabled = !enabled;
  for (const menuControl of requiredElements<HTMLButtonElement>('.designer-menu [data-menu-state="active-project"]')) {
    if (menuControl.dataset.menuDisposition === "legacy-gap") continue;
    menuControl.disabled = !enabled;
  }
  for (const menuControl of requiredElements<HTMLButtonElement>('.enter-data-menu [data-menu-state="has-records"]')) {
    if (menuControl.dataset.menuDisposition === "legacy-gap") continue;
    menuControl.disabled = !enabled || records.length === 0;
  }
}

function renderRecentProjects(): void {
  const trigger = requiredElement<HTMLButtonElement>("#designer-recent-projects");
  const list = requiredElement("#designer-recent-project-list");
  trigger.disabled = recentProjects.length === 0;
  if (recentProjects.length === 0) {
    list.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
    list.replaceChildren();
    return;
  }
  list.replaceChildren(...recentProjects.map((entry) => {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.dataset.recentProjectId = entry.id;
    button.textContent = entry.name;
    button.title = `Last opened ${new Date(entry.lastOpenedAt).toLocaleString()}`;
    button.addEventListener("click", () => openRecentProject(entry.id));
    return button;
  }));
}

function collapseRecentProjects(): void {
  requiredElement("#designer-recent-project-list").hidden = true;
  requiredElement("#designer-recent-projects").setAttribute("aria-expanded", "false");
}

function collapseDesignerSubmenus(except: HTMLButtonElement | null = null): void {
  for (const trigger of requiredElements<HTMLButtonElement>(".designer-menu:not(.enter-data-menu) [data-menu-submenu]")) {
    if (trigger === except) continue;
    trigger.setAttribute("aria-expanded", "false");
    const children = trigger.nextElementSibling;
    if (children instanceof HTMLElement) children.hidden = true;
  }
}

function renderProjectLifecycle(): void {
  requiredElement("#designer-no-project").hidden = hasActiveProject;
  requiredElement(".designer-workspace").hidden = !hasActiveProject;
  requiredElement(".designer-view-switcher").toggleAttribute("data-no-project", !hasActiveProject);
  setProjectControlsEnabled(hasActiveProject);
  requiredElement("#designer-save-state").textContent = hasActiveProject ? "Saved in this browser" : "No project open";
  renderRecentProjects();
  requiredElement("#project-tree-name").textContent = hasActiveProject ? `▾ ${projectName}` : "No project open";
}

function closeCurrentProject(message = "Project closed. Select New Project, Open Project, or Recent Projects to continue."): boolean {
  if (!hasActiveProject) return true;
  try {
    if (requiredElements("#field-list tr").length > 0) schema = validatedDesignerSchema();
    if (!syncCurrentForm() || !rememberCurrentProject() || !saveText(PROJECT_ACTIVE_KEY, "false")) {
      throw new Error("Browser storage did not accept the saved project.");
    }
  } catch (error) {
    requiredElement("#form-status").textContent = error instanceof Error
      ? `Project remains open. ${error.message}`
      : "Project remains open because it could not be saved.";
    return false;
  }
  hasActiveProject = false;
  renderProjectLifecycle();
  requiredElement("#project-lifecycle-status").textContent = message;
  requiredElement("#form-status").textContent = message;
  return true;
}

function activateProject(recentId: string | null = null): void {
  hasActiveProject = true;
  activeRecentProjectId = recentId;
  if (!saveText(PROJECT_ACTIVE_KEY, "true")) {
    requiredElement("#form-status").textContent = "Project opened, but this browser could not persist its active state.";
  }
  renderProjectLifecycle();
}

function openRecentProject(id: string): void {
  const entry = recentProjects.find((candidate) => candidate.id === id);
  if (!entry) return;
  if (!closeCurrentProject("Current project saved to Recent Projects.")) return;
  projectPackageExtras = structuredClone(entry.extras);
  activateProject(entry.id);
  applyLocalProjectSnapshot(entry.snapshot);
  entry.lastOpenedAt = new Date().toISOString();
  recentProjects = [entry, ...recentProjects.filter((candidate) => candidate.id !== id)];
  saveJson(RECENT_PROJECTS_KEY, recentProjects);
  renderRecentProjects();
  collapseRecentProjects();
  requiredElement<HTMLDetailsElement>("#designer-file-menu").open = false;
  requiredElement("#form-status").textContent = `Opened recent project ${entry.name}.`;
}

export function getCurrentProjectData(): MapDataSource {
  return {
    formId: currentFormId,
    projectName,
    formName: schema.name,
    fields: structuredClone(schema.fields),
    records: structuredClone(records),
    ...(datasetProvenance ? { dataset: structuredClone(datasetProvenance) } : {}),
  };
}

export function getProjectDataSources(): MapDataSource[] {
  syncCurrentForm();
  return projectState.forms.map((form) => ({
    formId: form.id,
    projectName,
    formName: form.schema.name,
    fields: structuredClone(form.schema.fields),
    records: structuredClone(form.records || []),
    ...(form.dataset ? { dataset: structuredClone(form.dataset) } : {}),
  }));
}

export function applyClassicMergeRecords(target: MapDataSource): void {
  if (!hasActiveProject) throw new Error("Open a project before applying MERGE.");
  syncCurrentForm();
  const form = projectState.forms.find((candidate) => candidate.id === target.formId);
  if (!form) throw new RangeError("The MERGE destination form is no longer in the current project.");
  const expected = form.schema.fields.map(({ name, type }) => `${name.toLocaleLowerCase("en-US")}:${type}`);
  const received = target.fields.map(({ name, type }) => `${name.toLocaleLowerCase("en-US")}:${type}`);
  if (expected.length !== received.length || expected.some((value, index) => value !== received[index])) {
    throw new RangeError("The MERGE destination schema changed after preview. Rebuild the preview before applying it.");
  }
  const issueKey = (issue: ReturnType<typeof validateRecords>[number]): string => `${issue.recordIndex}:${issue.fieldName}:${issue.rule}:${issue.message}`;
  const existingIssues = new Set(validateRecords(form.id, form.schema, form.records).map(issueKey));
  const introducedIssues = validateRecords(form.id, form.schema, target.records).filter((issue) => !existingIssues.has(issueKey(issue)));
  if (introducedIssues.length) throw new RangeError(`MERGE would introduce ${introducedIssues.length} new field-validation issue${introducedIssues.length === 1 ? "" : "s"}. No project records were changed.`);
  form.records = structuredClone(target.records);
  if (form.id === currentFormId) {
    records = structuredClone(target.records);
    renderEntryForm();
    renderRecords();
  }
  if (!syncCurrentForm()) throw new Error("The MERGE result could not be saved to browser project storage.");
  globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
}

export function applyClassicDeleteTableRecords(target: MapDataSource): void {
  if (!hasActiveProject) throw new Error("Open a project before applying DELETE TABLES.");
  syncCurrentForm();
  const form = projectState.forms.find((candidate) => candidate.id === target.formId);
  if (!form) throw new RangeError("The DELETE TABLES target is no longer in the current project.");
  if (target.records.length !== 0) throw new RangeError("The reviewed DELETE TABLES result must contain no records.");
  const expected = form.schema.fields.map(({ name, type }) => `${name.toLocaleLowerCase("en-US")}:${type}`);
  const received = target.fields.map(({ name, type }) => `${name.toLocaleLowerCase("en-US")}:${type}`);
  if (expected.length !== received.length || expected.some((value, index) => value !== received[index])) {
    throw new RangeError("The DELETE TABLES target schema changed after preview. Generate a new preview.");
  }
  form.records = [];
  delete form.dataset;
  if (form.id === currentFormId) {
    records = [];
    datasetProvenance = undefined;
    importHistory = [];
    renderEntryForm();
    renderRecords();
  }
  if (!syncCurrentForm()) throw new Error("The empty project data table could not be saved to browser storage.");
  globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
}

export function applyClassicDeleteRecords(result: ClassicDeleteRecordsResult): void {
  if (!hasActiveProject) throw new Error("Open a project before applying DELETE RECORDS.");
  syncCurrentForm();
  const form = projectState.forms.find((candidate) => candidate.id === result.formId);
  if (!form) throw new RangeError("The DELETE RECORDS target is no longer in the current project.");
  if (JSON.stringify(form.records) !== JSON.stringify(result.sourceSnapshot)) {
    throw new RangeError("The DELETE RECORDS target changed after preview. Generate a new preview.");
  }
  const occurredAt = new Date().toISOString();
  form.deletedRecords ??= [];
  projectState.auditLog ??= [];
  for (const item of result.deleted) {
    const archiveId = lifecycleId("archive");
    form.deletedRecords.push({
      archiveId, record: structuredClone(item.record), originalIndex: item.originalIndex,
      deletedAt: occurredAt, reason: `Classic Analysis ${result.canonicalSource}`,
    });
    projectState.auditLog.push({
      id: lifecycleId("audit"), occurredAt, action: "record-deleted", formId: result.formId, archiveId,
      detail: `Record ${item.originalIndex + 1} moved to the Recycle Bin by ${result.canonicalSource}.`,
    });
  }
  form.records = structuredClone(result.remainingRecords);
  if (form.id === currentFormId) {
    records = structuredClone(result.remainingRecords);
    renderEntryForm();
    renderRecords();
  }
  if (!syncCurrentForm()) throw new Error("The DELETE RECORDS result could not be saved to browser project storage.");
  globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
}

export function applyClassicUndeleteRecords(result: ClassicUndeleteRecordsResult): void {
  if (!hasActiveProject) throw new Error("Open a project before applying UNDELETE RECORDS.");
  syncCurrentForm();
  const form = projectState.forms.find((candidate) => candidate.id === result.formId);
  if (!form) throw new RangeError("The UNDELETE RECORDS target is no longer in the current project.");
  if (JSON.stringify(form.records) !== JSON.stringify(result.sourceSnapshot)
    || JSON.stringify(form.deletedRecords ?? []) !== JSON.stringify(result.archiveSnapshot)) {
    throw new RangeError("The active records or Recycle Bin changed after preview. Generate a new UNDELETE preview.");
  }
  const occurredAt = new Date().toISOString();
  projectState.auditLog ??= [];
  for (const item of result.restored) {
    projectState.auditLog.push({
      id: lifecycleId("audit"), occurredAt, action: "record-restored", formId: result.formId, archiveId: item.archiveId,
      detail: `Record restored from the Recycle Bin by ${result.canonicalSource}.`,
    });
  }
  form.records = structuredClone(result.restoredRecords);
  form.deletedRecords = structuredClone(result.remainingDeleted);
  if (form.id === currentFormId) {
    records = structuredClone(result.restoredRecords);
    renderEntryForm();
    renderRecords();
  }
  if (!syncCurrentForm()) throw new Error("The UNDELETE RECORDS result could not be saved to browser project storage.");
  globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
}

export function getCurrentProjectSnapshot(): ProjectSnapshotV1 {
  syncCurrentForm();
  return structuredClone(projectState);
}

export function replaceCurrentOfflineMapAsset(previousSha256: string, replacement: ProjectStudyArea["offlineMap"]["asset"]): void {
  if (!replacement) throw new Error("A replacement offline-map asset is required.");
  const studyArea = projectState.studyAreas?.find((area) => area.offlineMap.asset?.sha256 === previousSha256);
  if (!studyArea) throw new Error("The offline-map reference changed before recovery completed.");
  studyArea.offlineMap.asset = structuredClone(replacement);
  studyArea.offlineMap.status = "stored-unverified";
  if (!syncCurrentForm()) throw new Error("The recovered offline-map reference could not be saved.");
  globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
}

export function detachCurrentOfflineMapAsset(sha256: string): void {
  const studyArea = projectState.studyAreas?.find((area) => area.offlineMap.asset?.sha256 === sha256);
  if (!studyArea) throw new Error("The offline-map reference is no longer attached to this project.");
  delete studyArea.offlineMap.asset;
  studyArea.offlineMap.status = "not-downloaded";
  if (!syncCurrentForm()) throw new Error("The offline-map reference could not be detached.");
  globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
}

export function getCurrentProjectPrograms(): ProjectProgram[] {
  return structuredClone(projectPackageExtras.programs.filter((program) => program.language === "classic-analysis"));
}

export function saveCurrentProjectProgram(name: string, source: string, metadata: { author?: string; comment?: string } = {}): ProjectProgram {
  if (!hasActiveProject) throw new Error("Open or create a project before saving a program.");
  const normalizedName = name.trim();
  if (!normalizedName) throw new RangeError("Enter a program name.");
  const existing = projectPackageExtras.programs.findIndex((program) => program.language === "classic-analysis" && program.name.localeCompare(normalizedName, undefined, { sensitivity: "accent" }) === 0);
  const previous = existing >= 0 ? projectPackageExtras.programs[existing] : undefined;
  const timestamp = new Date().toISOString();
  const author = metadata.author === undefined ? previous?.author : metadata.author.trim() || undefined;
  const comment = metadata.comment === undefined ? previous?.comment : metadata.comment.trim() || undefined;
  const program: ProjectProgram = {
    name: normalizedName, source, language: "classic-analysis", createdAt: previous?.createdAt ?? timestamp, modifiedAt: timestamp,
    ...(author ? { author } : {}), ...(comment ? { comment } : {}),
  };
  if (existing >= 0) projectPackageExtras.programs[existing] = program;
  else projectPackageExtras.programs.push(program);
  if (!syncCurrentForm()) throw new Error("The program could not be saved to browser project storage.");
  return structuredClone(program);
}

export function deleteCurrentProjectProgram(name: string): boolean {
  if (!hasActiveProject) throw new Error("Open or create a project before deleting a program.");
  const index = projectPackageExtras.programs.findIndex((program) => program.language === "classic-analysis" && program.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase());
  if (index < 0) return false;
  projectPackageExtras.programs.splice(index, 1);
  if (!syncCurrentForm()) throw new Error("The program could not be deleted from browser project storage.");
  return true;
}

export function markCurrentProjectSynced(remote: HostedProjectReference): void {
  projectState.storage = { type: "supabase" };
  projectState.remote = structuredClone(remote);
  syncCurrentForm();
  renderStorageBadge();
}

export function applyHostedProjectSnapshot(snapshot: unknown, remote: HostedProjectReference): void {
  const nextProject = validateProjectSnapshot(snapshot);
  if (!closeCurrentProject("Current project saved to Recent Projects before downloading the hosted project.")) {
    throw new Error("The hosted project was not opened because the current project could not be closed safely.");
  }
  projectState = nextProject;
  const issues = validateProjectRecords(projectState);
  projectPackageExtras = { programs: [], codeTables: [] };
  projectState.storage = { type: "supabase" };
  projectState.remote = structuredClone(remote);
  projectName = projectState.name || "Hosted Project";
  currentFormId = projectState.currentFormId || projectState.forms[0]!.id;
  const selectedForm = projectState.forms.find((form) => form.id === currentFormId) ?? projectState.forms[0]!;
  currentFormId = selectedForm.id;
  schema = structuredClone(selectedForm.schema);
  records = structuredClone(selectedForm.records || []);
  datasetProvenance = selectedForm.dataset ? structuredClone(selectedForm.dataset) : undefined;
  importHistory = structuredClone(selectedForm.imports ?? (selectedForm.dataset ? [selectedForm.dataset] : []));
  activateProject(null);
  syncCurrentForm();
  renderDesigner();
  renderEntryForm();
  renderRecords();
  renderStorageBadge();
  requiredElement("#form-status").textContent = issues.length > 0
    ? `Hosted project opened with ${issues.length} saved-record validation issue${issues.length === 1 ? "" : "s"}. Open Enter Data > Data Quality to review.`
    : "Hosted project opened and its saved records passed validation.";
}

function applyLocalProjectSnapshot(snapshot: unknown): void {
  projectState = validateProjectSnapshot(snapshot);
  const issues = validateProjectRecords(projectState);
  projectState.storage = { type: "browser" };
  delete projectState.remote;
  projectName = projectState.name;
  currentFormId = projectState.currentFormId;
  const selectedForm = projectState.forms.find((form) => form.id === currentFormId) ?? projectState.forms[0]!;
  currentFormId = selectedForm.id;
  schema = structuredClone(selectedForm.schema);
  records = structuredClone(selectedForm.records);
  datasetProvenance = selectedForm.dataset ? structuredClone(selectedForm.dataset) : undefined;
  importHistory = structuredClone(selectedForm.imports ?? (selectedForm.dataset ? [selectedForm.dataset] : []));
  if (!hasActiveProject) activateProject(null);
  syncCurrentForm();
  renderDesigner();
  renderEntryForm();
  renderRecords();
  renderStorageBadge();
  requiredElement("#form-status").textContent = issues.length > 0
    ? `Project opened with ${issues.length} saved-record validation issue${issues.length === 1 ? "" : "s"}. Open Enter Data > Data Quality to review.`
    : "Project opened and its saved records passed validation.";
  globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
}

export function showRecordInEnter(formId: string, recordIndex: number): boolean {
  const selectedForm = projectState.forms.find((form) => form.id === formId);
  if (!selectedForm || !Number.isInteger(recordIndex) || !selectedForm.records?.[recordIndex]) return false;

  if (formId !== currentFormId) {
    syncCurrentForm();
    currentFormId = formId;
    schema = structuredClone(selectedForm.schema);
    records = structuredClone(selectedForm.records || []);
    datasetProvenance = selectedForm.dataset ? structuredClone(selectedForm.dataset) : undefined;
    importHistory = structuredClone(selectedForm.imports ?? (selectedForm.dataset ? [selectedForm.dataset] : []));
    projectState.currentFormId = currentFormId;
    renderDesigner();
    renderEntryForm();
    renderRecords();
    syncCurrentForm();
  }

  showModule("data");
  const record = records[recordIndex]!;
  const form = requiredElement<HTMLFormElement>("#record-form");
  for (const field of schema.fields) {
    const control = form.elements.namedItem(field.name);
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) continue;
    const value = record[field.name];
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      control.checked = value === true || ["true", "1", "Yes"].includes(String(value ?? ""));
    } else control.value = String(value ?? "");
  }
  requiredElement("#new-record-title").textContent = `Record ${recordIndex + 1}`;
  requiredElement("#record-status").textContent = "Opened from Maps. This demo displays the record in the entry form.";
  return true;
}

function schemaFromDesigner(): FormSchema {
  const fields: FieldDefinition[] = [...requiredElements<HTMLTableRowElement>("#field-list tr")].map((row) => {
    const field: FieldDefinition = {
      name: normalizeFieldName(requiredControl(row, '[data-part="name"]').value),
      prompt: requiredControl(row, '[data-part="prompt"]').value.trim(),
      type: requiredControl(row, '[data-part="type"]').value as FieldType,
      required: requiredControl(row, '[data-part="required"]').checked,
      tabStop: requiredControl(row, '[data-part="tab-stop"]').checked,
    };
    if (row.dataset.x !== "" && row.dataset.x !== undefined) field.x = Number(row.dataset.x);
    if (row.dataset.y !== "" && row.dataset.y !== undefined) field.y = Number(row.dataset.y);
    const rules = JSON.parse(row.dataset.rules || "[]") as FieldValidationRule[];
    if (rules.length > 0) field.rules = rules;
    const checkCode = JSON.parse(row.dataset.checkCode || "{}") as FieldCheckCode;
    if ((checkCode.after?.length ?? 0) > 0) field.checkCode = checkCode;
    return field;
  });
  if (fields.length === 0) {
    throw new Error("Add at least one field to the form.");
  }
  const names = fields.map((field) => field.name);
  if (fields.some((field) => !field.name || !field.prompt)) {
    throw new Error("Each field needs a field name and prompt.");
  }
  if (new Set(names).size !== names.length) {
    throw new Error("Field names must be unique.");
  }
  return {
    name: requiredElement("#form-name").value.trim() || "Untitled form",
    fields,
  };
}

function validatedDesignerSchema(): FormSchema {
  const candidate = schemaFromDesigner();
  validateProjectSnapshot({
    ...structuredClone(projectState),
    currentFormId,
    forms: projectState.forms.map((form) => form.id === currentFormId
      ? { ...structuredClone(form), schema: candidate, records: structuredClone(records) }
      : structuredClone(form)),
  });
  return candidate;
}

function updateRulesButton(row: HTMLTableRowElement): void {
  const button = requiredControl(row, '[data-part="rules"]');
  const rules = JSON.parse(row.dataset.rules || "[]") as FieldValidationRule[];
  const checkCode = JSON.parse(row.dataset.checkCode || "{}") as FieldCheckCode;
  const count = rules.length + (checkCode.after?.length ?? 0) + (checkCode.click?.length ?? 0);
  button.textContent = checkCode.click?.some((statement) => statement.kind === "geocode")
    ? "GEOCODE Click"
    : count > 0 ? `Rules (${count})` : "Rules...";
  button.disabled = requiredControl(row, '[data-part="type"]').value === "command-button";
}

function fieldRuleCapabilities(type: FieldType) {
  const textLike = ["text", "text-uppercase", "multiline", "unique-id", "phone"].includes(type);
  return {
    unique: !["checkbox", "yes-no", "option", "command-button"].includes(type),
    range: type === "number" || type === "date",
    legal: textLike || type === "yes-no" || type === "option",
    pattern: textLike,
    calculatedAge: type === "number",
    coordinate: type === "number",
  };
}

function configureFieldRuleInterface(type: FieldType, rules: readonly FieldValidationRule[]): void {
  const capabilities = fieldRuleCapabilities(type);
  const unique = requiredElement<HTMLInputElement>("#field-rule-unique");
  unique.closest("label")!.hidden = !capabilities.unique;
  unique.disabled = !capabilities.unique;
  requiredElement<HTMLElement>("#field-rule-range-group").hidden = !capabilities.range;
  requiredElement<HTMLElement>("#field-rule-legal-group").hidden = !capabilities.legal;
  requiredElement<HTMLElement>("#field-rule-pattern-group").hidden = !capabilities.pattern;
  requiredElement<HTMLElement>("#field-rule-age-group").hidden = !capabilities.calculatedAge;
  requiredElement<HTMLElement>("#field-rule-coordinate-group").hidden = !capabilities.coordinate;
  const lower = requiredElement<HTMLInputElement>("#field-rule-lower");
  const upper = requiredElement<HTMLInputElement>("#field-rule-upper");
  lower.type = upper.type = type === "date" ? "date" : "number";
  lower.step = upper.step = type === "number" ? "any" : "1";
  lower.placeholder = upper.placeholder = type === "date" ? "YYYY-MM-DD" : "Number";
  const compatible = (rule: FieldValidationRule) => {
    if (rule.kind === "unique") return capabilities.unique;
    if (rule.kind === "range") return capabilities.range && rule.valueType === type;
    if (rule.kind === "legal-values") return capabilities.legal;
    if (rule.kind === "pattern") return capabilities.pattern;
    if (rule.kind === "calculated-age") return capabilities.calculatedAge;
    if (rule.kind === "coordinate") return capabilities.coordinate;
    return true;
  };
  const incompatible = rules.filter((rule) => !compatible(rule));
  requiredElement("#field-rules-type-note").textContent = `Available rules are filtered for the ${type} data type.`;
  requiredElement("#field-rules-status").textContent = incompatible.length > 0
    ? `${incompatible.length} saved rule${incompatible.length === 1 ? " is" : "s are"} incompatible with this field type and will be removed if you save.`
    : "";
}

function openFieldRules(row: HTMLTableRowElement): void {
  activeRulesRow = row;
  const rules = JSON.parse(row.dataset.rules || "[]") as FieldValidationRule[];
  const checkCode = JSON.parse(row.dataset.checkCode || "{}") as FieldCheckCode;
  const range = rules.find((rule) => rule.kind === "range");
  const legal = rules.find((rule) => rule.kind === "legal-values");
  const pattern = rules.find((rule) => rule.kind === "pattern");
  const calculatedAge = rules.find((rule) => rule.kind === "calculated-age");
  const coordinate = rules.find((rule) => rule.kind === "coordinate");
  const statement = checkCode.after?.[0];
  const fieldName = normalizeFieldName(requiredControl(row, '[data-part="name"]').value);
  requiredElement("#field-rules-name").textContent = fieldName || "unnamed field";
  const fieldType = requiredControl(row, '[data-part="type"]').value as FieldType;
  requiredElement("#field-rule-unique").checked = rules.some((rule) => rule.kind === "unique");
  requiredElement("#field-rule-lower").value = range?.min === undefined ? "" : String(range.min);
  requiredElement("#field-rule-upper").value = range?.max === undefined ? "" : String(range.max);
  requiredElement("#field-rule-legal-values").value = legal?.values.join("\n") ?? "";
  requiredElement("#field-rule-comment-legal").checked = legal?.allowComment ?? false;
  requiredElement("#field-rule-pattern").value = pattern?.pattern ?? "";
  requiredElement<HTMLSelectElement>("#field-rule-coordinate-axis").value = coordinate?.axis ?? "";
  const dateFields = [...requiredElements<HTMLTableRowElement>("#field-list tr")]
    .filter((candidate) => requiredControl(candidate, '[data-part="type"]').value === "date")
    .map((candidate) => normalizeFieldName(requiredControl(candidate, '[data-part="name"]').value))
    .filter(Boolean);
  requiredElement<HTMLSelectElement>("#field-rule-age-source").replaceChildren(
    new Option("Do not calculate age", ""),
    ...dateFields.map((name) => new Option(name, name, false, calculatedAge?.sourceDateField === name)),
  );
  requiredElement<HTMLSelectElement>("#field-rule-age-as-of").replaceChildren(
    new Option("Today", ""),
    ...dateFields.map((name) => new Option(name, name, false, calculatedAge?.asOfDateField === name)),
  );
  const condition = requiredElement<HTMLSelectElement>("#field-skip-condition");
  condition.value = !statement ? "none" : statement.when?.operator ?? "always";
  requiredElement("#field-skip-value").value = statement?.when ? String(statement.when.value ?? "") : "";
  requiredElement<HTMLSelectElement>("#field-check-action").value = statement?.kind === "field-action" ? statement.action : "goto";
  populateCheckCodeTargets(statement?.targetField ?? "");
  configureFieldRuleInterface(fieldType, rules);
  updateSkipRuleControls();
  requiredElement<HTMLDialogElement>("#field-rules-dialog").showModal();
}

function saveFieldRules(): void {
  if (!activeRulesRow) return;
  const row = activeRulesRow;
  const previousRules = row.dataset.rules ?? "[]";
  const previousCheckCode = row.dataset.checkCode ?? "{}";
  const rules: FieldValidationRule[] = [];
  const type = requiredControl(row, '[data-part="type"]').value as FieldType;
  const capabilities = fieldRuleCapabilities(type);
  if (capabilities.unique && requiredElement("#field-rule-unique").checked) rules.push({ kind: "unique" });
  const lower = requiredElement("#field-rule-lower").value.trim();
  const upper = requiredElement("#field-rule-upper").value.trim();
  if (lower || upper) {
    if (!capabilities.range || (type !== "number" && type !== "date")) throw new Error("Ranges are available only for Number and Date fields.");
    const range: FieldValidationRule = { kind: "range", valueType: type };
    if (lower) range.min = type === "number" ? Number(lower) : lower;
    if (upper) range.max = type === "number" ? Number(upper) : upper;
    rules.push(range);
  }
  const values = requiredElement("#field-rule-legal-values").value.split(/\r?\n/).map((value: string) => value.trim()).filter(Boolean);
  if (capabilities.legal && values.length > 0) rules.push({
    kind: "legal-values",
    values,
    allowComment: requiredElement("#field-rule-comment-legal").checked,
  });
  const pattern = requiredElement("#field-rule-pattern").value.trim();
  if (capabilities.pattern && pattern) {
    new RegExp(pattern);
    rules.push({ kind: "pattern", pattern });
  }
  const ageSource = requiredElement<HTMLSelectElement>("#field-rule-age-source").value;
  if (capabilities.calculatedAge && ageSource) {
    const asOfDateField = requiredElement<HTMLSelectElement>("#field-rule-age-as-of").value;
    rules.push({ kind: "calculated-age", sourceDateField: ageSource, ...(asOfDateField ? { asOfDateField } : {}) });
  }
  const coordinateAxis = requiredElement<HTMLSelectElement>("#field-rule-coordinate-axis").value as "" | "latitude" | "longitude";
  if (capabilities.coordinate && coordinateAxis) {
    rules.push({ kind: "coordinate", axis: coordinateAxis, minimumDecimalPlaces: 5 });
  }
  const condition = requiredElement<HTMLSelectElement>("#field-skip-condition").value;
  const action = requiredElement<HTMLSelectElement>("#field-check-action").value as "goto" | SafeFieldAction;
  const targetField = requiredElement<HTMLSelectElement>("#field-skip-target").value;
  const checkCode: FieldCheckCode = {};
  if (condition !== "none") {
    if (!targetField) throw new Error("Select a target field for the Check Code action.");
    const statement: SafeCheckCodeStatement = action === "goto"
      ? { kind: "goto", targetField }
      : { kind: "field-action", action, targetField };
    if (condition === "equals" || condition === "not-equals") {
      statement.when = { operator: condition, value: requiredElement("#field-skip-value").value };
    }
    checkCode.after = [statement];
  }
  row.dataset.rules = JSON.stringify(rules);
  row.dataset.checkCode = JSON.stringify(checkCode);
  try {
    schema = validatedDesignerSchema();
  } catch (error) {
    row.dataset.rules = previousRules;
    row.dataset.checkCode = previousCheckCode;
    throw error;
  }
  updateRulesButton(row);
  renderCanvas();
  requiredElement<HTMLDialogElement>("#field-rules-dialog").close();
  requiredElement("#form-status").textContent = "Field validation and Check Code updated. Save Form to persist changes.";
}

function updateSkipRuleControls(): void {
  const condition = requiredElement<HTMLSelectElement>("#field-skip-condition").value;
  const enabled = condition !== "none";
  requiredElement("#field-skip-target").disabled = !enabled;
  requiredElement("#field-check-action").disabled = !enabled;
  requiredElement("#field-skip-value").disabled = condition !== "equals" && condition !== "not-equals";
}

function populateCheckCodeTargets(selected = ""): void {
  if (!activeRulesRow) return;
  const action = requiredElement<HTMLSelectElement>("#field-check-action").value;
  const target = requiredElement<HTMLSelectElement>("#field-skip-target");
  const candidates = [...requiredElements<HTMLTableRowElement>("#field-list tr")]
    .filter((candidate) => candidate !== activeRulesRow && (action !== "goto" || requiredControl(candidate, '[data-part="tab-stop"]').checked))
    .map((candidate) => normalizeFieldName(requiredControl(candidate, '[data-part="name"]').value))
    .filter(Boolean);
  target.replaceChildren(new Option("Select target field", ""), ...candidates.map((name) => new Option(name, name, false, selected === name)));
}

function setDesignerView(view: "explorer" | "canvas" | "properties"): void {
  requiredElement<HTMLElement>(".designer-workspace").dataset.mobileDesignerView = view;
  for (const button of requiredElements<HTMLButtonElement>("[data-designer-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.designerView === view));
  }
}

function fieldRow(field: FieldDefinition = { name: "new_field", prompt: "New field", type: "text", required: false }): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.dataset.rules = JSON.stringify(field.rules ?? []);
  row.dataset.checkCode = JSON.stringify(field.checkCode ?? {});
  row.dataset.x = String(Number.isFinite(field.x) ? field.x : "");
  row.dataset.y = String(Number.isFinite(field.y) ? field.y : "");
  const nameCell = row.insertCell();
  const nameInput = document.createElement("input");
  nameInput.dataset.part = "name";
  nameInput.value = field.name;
  nameInput.setAttribute("aria-label", "Field name");
  nameCell.append(nameInput);

  const promptCell = row.insertCell();
  const promptInput = document.createElement("input");
  promptInput.dataset.part = "prompt";
  promptInput.value = field.prompt;
  promptInput.setAttribute("aria-label", "Field prompt");
  promptCell.append(promptInput);

  const typeCell = row.insertCell();
  const select = document.createElement("select");
  select.dataset.part = "type";
  select.setAttribute("aria-label", "Field type");
  for (const type of FIELD_TYPES) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type === "yes-no" ? "Yes / No" : type[0]!.toUpperCase() + type.slice(1);
    option.selected = type === field.type;
    select.append(option);
  }
  typeCell.append(select);

  const requiredCell = row.insertCell();
  const required = document.createElement("input");
  required.type = "checkbox";
  required.dataset.part = "required";
  required.checked = field.required;
  required.setAttribute("aria-label", "Required field");
  requiredCell.append(required);

  const tabStopCell = row.insertCell();
  const tabStop = document.createElement("input");
  tabStop.type = "checkbox";
  tabStop.dataset.part = "tab-stop";
  tabStop.checked = field.tabStop !== false;
  tabStop.setAttribute("aria-label", "Tab stop enabled");
  tabStopCell.append(tabStop);

  const rulesCell = row.insertCell();
  const rulesButton = document.createElement("button");
  rulesButton.type = "button";
  rulesButton.className = "text-button";
  rulesButton.dataset.part = "rules";
  rulesButton.addEventListener("click", () => openFieldRules(row));
  rulesCell.append(rulesButton);

  const actionCell = row.insertCell();
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button danger-text";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    row.remove();
    try {
      schema = schemaFromDesigner();
      renderCanvas();
      renderProjectTree();
    } catch {
      // The properties editor will show validation errors when the form is saved.
    }
  });
  actionCell.append(remove);
  updateRulesButton(row);
  return row;
}

function renderDesigner() {
  requiredElement("#form-name").value = schema.name;
  const list = requiredElement("#field-list");
  list.replaceChildren(...schema.fields.map((field) => fieldRow(field)));
  renderProjectTree();
  renderCanvas();
}

function renderProjectTree() {
  requiredElement("#project-tree-name").textContent = `▾ ${projectName}`;
  const formList = requiredElement("#form-tree-list");
  formList.replaceChildren(...projectState.forms.map((form) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tree-node tree-form${form.id === currentFormId ? " selected" : ""}`;
    button.setAttribute("role", "treeitem");
    button.textContent = form.id === currentFormId ? schema.name : form.schema.name;
    button.addEventListener("click", () => {
      if (form.id === currentFormId) return;
      try {
        schema = schemaFromDesigner();
      } catch {
        // Preserve the last valid current schema when an edit is incomplete.
      }
      syncCurrentForm();
      currentFormId = form.id;
      schema = structuredClone(form.schema);
      records = structuredClone(form.records || []);
      datasetProvenance = form.dataset ? structuredClone(form.dataset) : undefined;
      importHistory = structuredClone(form.imports ?? (form.dataset ? [form.dataset] : []));
      projectState.currentFormId = currentFormId;
      renderDesigner();
      renderEntryForm();
      renderRecords();
      syncCurrentForm();
    });
    return button;
  }));
}

function canvasControl(field: FieldDefinition): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement {
  if (field.type === "multiline") return document.createElement("textarea");
  if (field.type === "command-button") {
    const button = document.createElement("input");
    button.type = "button";
    button.value = field.prompt;
    return button;
  }
  if (field.type === "yes-no" || field.type === "option") {
    const select = document.createElement("select");
    const option = document.createElement("option");
    option.textContent = field.type === "yes-no" ? "Yes / No" : "Select option";
    select.append(option);
    return select;
  }
  const input = document.createElement("input");
  input.type = field.type === "checkbox" ? "checkbox" : ["number", "date", "time"].includes(field.type) ? field.type : "text";
  return input;
}

function renderCanvas() {
  const canvasFields = requiredElement("#canvas-fields");
  const items = schema.fields.map((field, index) => {
    const item = document.createElement("div");
    item.className = "canvas-field";
    item.dataset.fieldIndex = String(index);
    const x = Number.isFinite(field.x) ? field.x! : 36;
    const y = Number.isFinite(field.y) ? field.y! : 30 + index * 52;
    item.style.left = `${snapCoordinate(x)}px`;
    item.style.top = `${snapCoordinate(y)}px`;
    const label = document.createElement("label");
    label.textContent = field.prompt;
    item.append(label, canvasControl(field));
    item.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      const startPointerX = event.clientX;
      const startPointerY = event.clientY;
      const startLeft = Number.parseFloat(item.style.left);
      const startTop = Number.parseFloat(item.style.top);
      item.classList.add("dragging");
      item.setPointerCapture?.(event.pointerId);

      const move = (moveEvent: PointerEvent) => {
        const nextX = snapCoordinate(Math.max(0, startLeft + moveEvent.clientX - startPointerX));
        const nextY = snapCoordinate(Math.max(0, startTop + moveEvent.clientY - startPointerY));
        field.x = nextX;
        field.y = nextY;
        item.style.left = `${nextX}px`;
        item.style.top = `${nextY}px`;
      };
      const finish = () => {
        item.removeEventListener("pointermove", move);
        item.removeEventListener("pointerup", finish);
        item.removeEventListener("pointercancel", finish);
        item.classList.remove("dragging");
        syncCurrentForm();
        renderDesigner();
        requiredElement("#form-status").textContent = snapToGrid
          ? `Field aligned to the ${GRID_SIZE}px grid.`
          : "Field positioned freely.";
      };
      item.addEventListener("pointermove", move);
      item.addEventListener("pointerup", finish);
      item.addEventListener("pointercancel", finish);
    });
    return item;
  });
  canvasFields.replaceChildren(...items);
}

function fieldFromPalette(type: FieldType, x: number, y: number): FieldDefinition {
  const labels: Record<FieldType, string> = {
    text: "Text field", "text-uppercase": "Uppercase text", multiline: "Notes",
    "unique-id": "Unique identifier", number: "Number", phone: "Phone number",
    date: "Date", time: "Time", checkbox: "Checkbox", "yes-no": "Yes / No", option: "Option", "command-button": "Command Button",
  };
  const baseName = normalizeFieldName(labels[type] || "New field");
  const used = new Set(schema.fields.map((field) => field.name));
  let name = baseName;
  let suffix = 2;
  while (used.has(name)) name = `${baseName}_${suffix++}`;
  const field: FieldDefinition = { name, prompt: labels[type] || "New field", type, required: false, tabStop: true, x, y };
  if (type === "unique-id") field.rules = [{ kind: "unique" }];
  return field;
}

function geolocationTemplateFields(): FieldDefinition[] {
  const used = new Set(schema.fields.map((field) => field.name));
  let suffix = "";
  let sequence = 2;
  while ([`address${suffix}`, `get_coordinates${suffix}`, `latitude${suffix}`, `longitude${suffix}`].some((name) => used.has(name))) {
    suffix = `_${sequence++}`;
  }
  const addressField = `address${suffix}`;
  const buttonField = `get_coordinates${suffix}`;
  const latitudeField = `latitude${suffix}`;
  const longitudeField = `longitude${suffix}`;
  return [
    { name: addressField, prompt: "Address", type: "multiline", required: false, tabStop: true, x: 36, y: 30 },
    {
      name: buttonField,
      prompt: "Get Coordinates",
      type: "command-button",
      required: false,
      tabStop: true,
      x: 36,
      y: 102,
      checkCode: {
        version: 1,
        click: [{ kind: "geocode", addressField, latitudeField, longitudeField }],
      },
    },
    {
      name: latitudeField,
      prompt: "Latitude",
      type: "number",
      required: false,
      tabStop: true,
      x: 300,
      y: 30,
      rules: [{ kind: "coordinate", axis: "latitude", minimumDecimalPlaces: 5 }],
    },
    {
      name: longitudeField,
      prompt: "Longitude",
      type: "number",
      required: false,
      tabStop: true,
      x: 300,
      y: 82,
      rules: [{ kind: "coordinate", axis: "longitude", minimumDecimalPlaces: 5 }],
    },
  ];
}

function renderEntryForm() {
  renderEntryFormView(schema);
}

function renderRecords() {
  renderRecordList(schema, records);
}

function currentProjectForm(): ProjectForm {
  const form = projectState.forms.find((candidate) => candidate.id === currentFormId);
  if (!form) throw new Error("The current form is not present in this project.");
  return form;
}

function lifecycleId(prefix: string): string {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function renderDataQuality(): void {
  const report = buildDataQualityReport(currentFormId, schema, records);
  requiredElement("#data-quality-summary").textContent = `${report.recordCount} record${report.recordCount === 1 ? "" : "s"}; ${report.issues.length} validation issue${report.issues.length === 1 ? "" : "s"}; ${report.duplicateGroups.length} duplicate candidate group${report.duplicateGroups.length === 1 ? "" : "s"}.`;
  const fieldRows = report.fields.map((field) => {
    const row = document.createElement("tr");
    row.dataset.fieldName = field.fieldName;
    const missingPercent = report.recordCount === 0 ? 0 : (field.missing / report.recordCount) * 100;
    row.dataset.missingSeverity = missingPercent >= 50 ? "high" : missingPercent > 0 ? "some" : "none";
    for (const value of [field.prompt, field.present]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    const missingCell = document.createElement("td");
    missingCell.className = "data-quality-missing-cell";
    const missingCount = document.createElement("span");
    missingCount.className = "data-quality-missing-count";
    missingCount.textContent = String(field.missing);
    const missingBar = document.createElement("span");
    missingBar.className = "data-quality-missing-bar";
    missingBar.setAttribute("role", "progressbar");
    missingBar.setAttribute("aria-label", `${field.prompt}: ${field.missing} of ${report.recordCount} records missing`);
    missingBar.setAttribute("aria-valuemin", "0");
    missingBar.setAttribute("aria-valuemax", "100");
    missingBar.setAttribute("aria-valuenow", missingPercent.toFixed(1));
    missingBar.title = `${missingPercent.toFixed(1)}% missing`;
    const missingFill = document.createElement("span");
    missingFill.style.width = `${missingPercent}%`;
    missingBar.append(missingFill);
    missingCell.append(missingCount, missingBar);
    row.append(missingCell);
    for (const value of [`${(field.completeness * 100).toFixed(1)}%`, field.violations]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  requiredElement("#data-quality-fields").replaceChildren(...fieldRows);
  const issueRows = report.issues.slice(0, 500).map((issue) => {
    const row = document.createElement("tr");
    for (const value of [issue.recordIndex + 1, issue.fieldName, issue.rule, issue.message, issue.suggestedResolution]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  if (issueRows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "empty-state";
    cell.textContent = "No validation issues found.";
    row.append(cell);
    issueRows.push(row);
  }
  requiredElement("#data-quality-issues").replaceChildren(...issueRows);
  const duplicateSelect = requiredElement<HTMLSelectElement>("#data-quality-duplicate-group");
  const selectedGroupId = activeDuplicateGroup?.id;
  duplicateSelect.replaceChildren(
    new Option(report.duplicateGroups.length === 0 ? "No duplicate candidates" : "Select duplicate candidates", ""),
    ...report.duplicateGroups.map((group) => new Option(group.label, group.id)),
  );
  activeDuplicateGroup = report.duplicateGroups.find((group) => group.id === selectedGroupId) ?? report.duplicateGroups[0] ?? null;
  duplicateSelect.value = activeDuplicateGroup?.id ?? "";
  renderDuplicateComparison();

  const form = currentProjectForm();
  const deletedRecords = form.deletedRecords ?? [];
  const deletedSelect = requiredElement<HTMLSelectElement>("#data-quality-deleted-record");
  const previousArchiveId = deletedSelect.value;
  deletedSelect.replaceChildren(
    new Option(deletedRecords.length === 0 ? "Recycle Bin is empty" : "Select a deleted record", ""),
    ...deletedRecords.map((item) => new Option(`${new Date(item.deletedAt).toLocaleString()} — ${item.reason}`, item.archiveId)),
  );
  if (deletedRecords.some((item) => item.archiveId === previousArchiveId)) deletedSelect.value = previousArchiveId;
  requiredElement<HTMLButtonElement>("#data-quality-restore-record").disabled = !deletedSelect.value;

  const events = (projectState.auditLog ?? []).filter((event) => event.formId === currentFormId).slice(-20).reverse();
  const auditItems = events.map((event) => {
    const item = document.createElement("li");
    item.textContent = `${new Date(event.occurredAt).toLocaleString()}: ${event.detail}`;
    return item;
  });
  if (auditItems.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No record lifecycle events.";
    auditItems.push(item);
  }
  requiredElement("#data-quality-audit-log").replaceChildren(...auditItems);
  requiredElement("#data-quality-limit-note").textContent = report.issues.length > 500
    ? `Showing the first 500 of ${report.issues.length} issues.`
    : "Validation is non-destructive. Duplicate removal requires comparison and a reason; deleted records remain recoverable.";
}

function renderDuplicateComparison(): void {
  const comparison = requiredElement("#data-quality-comparison");
  const indexes = activeDuplicateGroup?.recordIndexes.slice(0, 2) ?? [];
  requiredElement("#data-quality-record-a").textContent = indexes[0] === undefined ? "Record A" : `Record ${indexes[0] + 1}`;
  requiredElement("#data-quality-record-b").textContent = indexes[1] === undefined ? "Record B" : `Record ${indexes[1] + 1}`;
  const rows = indexes.length < 2 ? [] : schema.fields.map((field) => {
    const row = document.createElement("tr");
    for (const value of [field.prompt, records[indexes[0]!]![field.name] ?? "", records[indexes[1]!]![field.name] ?? ""]) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.append(cell);
    }
    return row;
  });
  if (rows.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "empty-state";
    cell.textContent = "Select a duplicate candidate to compare two records.";
    row.append(cell);
    rows.push(row);
  }
  comparison.replaceChildren(...rows);
  requiredElement<HTMLButtonElement>("#data-quality-delete-a").disabled = indexes.length < 2;
  requiredElement<HTMLButtonElement>("#data-quality-delete-b").disabled = indexes.length < 2;
}

function moveDuplicateToRecycleBin(side: 0 | 1): void {
  const recordIndex = activeDuplicateGroup?.recordIndexes[side];
  if (recordIndex === undefined || !records[recordIndex]) throw new Error("Select a duplicate pair first.");
  const reason = requiredElement<HTMLInputElement>("#data-quality-delete-reason").value.trim();
  if (!reason) throw new Error("Enter a reason before moving a record to the Recycle Bin.");
  if (!window.confirm(`Move record ${recordIndex + 1} to the Recycle Bin? It can be restored.`)) return;
  const form = currentProjectForm();
  const archiveId = lifecycleId("archive");
  const occurredAt = new Date().toISOString();
  const [record] = records.splice(recordIndex, 1);
  form.deletedRecords ??= [];
  form.deletedRecords.push({ archiveId, record: structuredClone(record!), originalIndex: recordIndex, deletedAt: occurredAt, reason });
  projectState.auditLog ??= [];
  projectState.auditLog.push({
    id: lifecycleId("audit"), occurredAt, action: "record-deleted", formId: currentFormId, archiveId,
    detail: `Record ${recordIndex + 1} moved to the Recycle Bin. Reason: ${reason}`,
  });
  activeDuplicateGroup = null;
  syncCurrentForm();
  renderRecords();
  renderDataQuality();
  requiredElement("#data-quality-action-status").textContent = "Record moved to the Recycle Bin and audit history updated.";
}

function restoreDeletedRecord(): void {
  const archiveId = requiredElement<HTMLSelectElement>("#data-quality-deleted-record").value;
  const form = currentProjectForm();
  const archiveIndex = form.deletedRecords?.findIndex((item) => item.archiveId === archiveId) ?? -1;
  if (archiveIndex < 0) throw new Error("Select a record from the Recycle Bin.");
  const [archived] = form.deletedRecords!.splice(archiveIndex, 1);
  const insertAt = Math.min(archived!.originalIndex, records.length);
  records.splice(insertAt, 0, structuredClone(archived!.record));
  const occurredAt = new Date().toISOString();
  projectState.auditLog ??= [];
  projectState.auditLog.push({
    id: lifecycleId("audit"), occurredAt, action: "record-restored", formId: currentFormId, archiveId,
    detail: `Record restored from the Recycle Bin at position ${insertAt + 1}.`,
  });
  syncCurrentForm();
  renderRecords();
  renderDataQuality();
  requiredElement("#data-quality-action-status").textContent = "Record restored and audit history updated.";
}

function showModule(name: string): void {
  requiredElement("#main-menu").hidden = true;
  requiredElement(".app-shell").hidden = false;
  for (const view of requiredElements("[data-module-view]")) {
    view.hidden = view.dataset.moduleView !== name;
  }
  for (const button of requiredElements("[data-module]")) {
    const active = button.dataset.module === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (name === "data") setEntryView("entry");
}

function showMainMenu() {
  requiredElement("#main-menu").hidden = false;
  requiredElement(".app-shell").hidden = true;
  requiredElement("#main-menu-status").textContent = "Ready";
}

function exportCsv() {
  const blob = new Blob([`\ufeff${serializeCsv(schema, records)}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${normalizeFieldName(schema.name) || "epi_info_ai_data"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  requiredElement("#csv-status").textContent = `Exported ${records.length} record${records.length === 1 ? "" : "s"}.`;
}

function safeFileStem(value: string): string {
  return value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "epi-info-ai-project";
}

function datasetIdForFile(fileName: string): string {
  return fileName
    .replace(/\.(csv|tsv|json|xlsx)$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "imported-dataset";
}

async function datasetProvenanceForFile(file: File): Promise<DatasetProvenance> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const sha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return { id: datasetIdForFile(file.name), file: file.name, sha256 };
}

interface PendingDataImport {
  fileName: string;
  provenance: DatasetProvenance;
  incoming: EpiRecord[];
  preview: DataImportPreview;
}

let pendingDataImport: PendingDataImport | null = null;

function selectedImportMode(): DataImportMode | undefined {
  return document.querySelector<HTMLInputElement>('input[name="data-import-mode"]:checked')?.value as DataImportMode | undefined;
}

function renderDataImportPreview(): void {
  if (!pendingDataImport) return;
  const preview = pendingDataImport.preview;
  requiredElement("#data-import-preview-file").textContent = `${pendingDataImport.fileName} · SHA-256 ${pendingDataImport.provenance.sha256}`;
  requiredElement("#data-import-preview-incoming").textContent = String(preview.incoming);
  requiredElement("#data-import-preview-new").textContent = String(preview.newRecords);
  requiredElement("#data-import-preview-matching").textContent = String(preview.matchingRecords);
  requiredElement("#data-import-preview-changed").textContent = String(preview.changedRecords);
  requiredElement("#data-import-preview-unchanged").textContent = String(preview.unchangedRecords);
  const keyProblems = preview.blankIncomingKeys + preview.duplicateIncomingKeys + preview.duplicateDestinationKeys;
  requiredElement("#data-import-preview-key-problems").textContent = String(keyProblems);
  requiredElement("#data-import-preview-invalid").textContent = String(preview.invalidRecords);
  const warnings = [
    ...(preview.exactFilePreviouslyImported ? ["This exact file was imported previously. Review the matching counts before proceeding."] : []),
    ...(!preview.keyField ? ["No reliable matching key was selected. Choose a unique field or use Replace."] : []),
    ...(preview.blankIncomingKeys ? [`${preview.blankIncomingKeys} incoming record${preview.blankIncomingKeys === 1 ? " has" : "s have"} a blank key.`] : []),
    ...(preview.duplicateIncomingKeys ? [`${preview.duplicateIncomingKeys} duplicate incoming key value${preview.duplicateIncomingKeys === 1 ? " was" : "s were"} found.`] : []),
    ...(preview.duplicateDestinationKeys ? [`${preview.duplicateDestinationKeys} duplicate destination key value${preview.duplicateDestinationKeys === 1 ? " prevents" : "s prevent"} an unambiguous merge.`] : []),
    ...(preview.invalidRecords ? [`${preview.invalidRecords} incoming record${preview.invalidRecords === 1 ? " does" : "s do"} not satisfy the form's validation rules.`] : []),
  ];
  const warning = requiredElement<HTMLElement>("#data-import-preview-warning");
  warning.textContent = warnings.join(" ");
  warning.hidden = warnings.length === 0;
  const mode = selectedImportMode();
  const canApply = Boolean(mode && preview.invalidRecords === 0 && (mode === "replace" || preview.canMerge));
  requiredElement<HTMLButtonElement>("#data-import-preview-apply").disabled = !canApply;
  requiredElement("#data-import-preview-feedback").textContent = canApply
    ? "No records have changed. Select Apply Import to continue."
    : "No records have changed. Choose an allowed import type or Cancel.";
}

function updatePendingDataImportPreview(): void {
  if (!pendingDataImport) return;
  const selected = requiredElement<HTMLSelectElement>("#data-import-preview-key").value || undefined;
  pendingDataImport.preview = buildDataImportPreview({
    fields: schema.fields,
    current: records,
    incoming: pendingDataImport.incoming,
    ...(selected ? { keyField: selected } : {}),
    provenance: pendingDataImport.provenance,
    priorImports: importHistory,
    invalidRecords: pendingDataImport.preview.invalidRecords,
  });
  renderDataImportPreview();
}

function projectOfflineAssets(snapshot: ProjectSnapshotV1) {
  const assets = (snapshot.studyAreas ?? []).flatMap((area) => area.offlineMap.asset ? [area.offlineMap.asset] : []);
  return assets.filter((asset, index) => assets.findIndex((candidate) => candidate.sha256 === asset.sha256) === index);
}

async function saveProjectPackage(): Promise<void> {
  if (!hasActiveProject) {
    requiredElement("#main-menu-status").textContent = "Open or create a project before exporting a project package.";
    return;
  }
  requiredElement("#main-menu-status").textContent = `Preparing ${projectName} for portable export...`;
  try {
    syncCurrentForm();
    const packageValue = createProjectPackage(projectState, projectPackageExtras);
    const archiveAssets: ProjectArchiveAsset[] = [];
    for (const asset of projectOfflineAssets(packageValue.project)) {
      archiveAssets.push({ asset, file: await readStoredPmtilesFile(asset) });
    }
    const blob = await createProjectArchive(packageValue, archiveAssets);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${safeFileStem(projectName)}.epia`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 0);
    const mapSummary = archiveAssets.length === 0 ? "" : ` with ${archiveAssets.length} embedded offline map archive${archiveAssets.length === 1 ? "" : "s"}`;
    requiredElement("#main-menu-status").textContent = `Saved ${projectName}${mapSummary} as a portable Epi Info AI project package.`;
  } catch (error) {
    requiredElement("#main-menu-status").textContent = error instanceof Error
      ? `Project export failed: ${error.message} Re-import any missing offline map package and try again.`
      : "Project export failed.";
  }
}

async function openProjectPackage(file: File): Promise<void> {
  if (file.size > MAX_PROJECT_ARCHIVE_BYTES) throw new Error("Project packages are limited to 150 MiB in this prototype.");
  const binary = await isBinaryProjectArchive(file);
  let packageValue;
  let embeddedAssets: ProjectArchiveAsset[] = [];
  if (binary) {
    const archive = await parseProjectArchive(file);
    packageValue = archive.projectPackage;
    embeddedAssets = archive.assets;
  } else {
    if (file.size > MAX_PROJECT_PACKAGE_BYTES) {
      throw new Error(`Legacy JSON project packages are limited to ${Math.round(MAX_PROJECT_PACKAGE_BYTES / 1024 / 1024)} MB in this prototype.`);
    }
    packageValue = parseProjectPackage(await file.text());
  }
  const restoredAssets = [];
  try {
    for (const embedded of embeddedAssets) restoredAssets.push(await restorePmtilesAsset(embedded.asset, embedded.file));
  } catch (error) {
    await Promise.all(restoredAssets.map((asset) => removePmtilesAsset(asset).catch(() => undefined)));
    throw error;
  }
  for (const area of packageValue.project.studyAreas ?? []) {
    const asset = area.offlineMap.asset;
    if (!asset) continue;
    const restored = restoredAssets.find((candidate) => candidate.sha256 === asset.sha256);
    if (restored) area.offlineMap.asset = restored;
  }
  if (!closeCurrentProject("Current project saved to Recent Projects before opening a project package.")) {
    await Promise.all(restoredAssets.map((asset) => removePmtilesAsset(asset).catch(() => undefined)));
    throw new Error("The selected package was not opened because the current project could not be closed safely.");
  }
  projectPackageExtras = {
    programs: structuredClone(packageValue.programs),
    codeTables: structuredClone(packageValue.codeTables),
  };
  if (packageValue.migration !== undefined) projectPackageExtras.migration = structuredClone(packageValue.migration);
  activateProject(null);
  applyLocalProjectSnapshot(packageValue.project);
  const legacySummary = packageValue.migration
    ? ` Migrated inventory: ${packageValue.migration.inventory.forms} forms, ${packageValue.migration.inventory.pages} pages, ${packageValue.migration.inventory.fields} fields.`
    : "";
  const referencedMapCount = projectOfflineAssets(packageValue.project).length;
  const mapSummary = restoredAssets.length > 0
    ? ` Restored ${restoredAssets.length} offline map archive${restoredAssets.length === 1 ? "" : "s"} into this browser.`
    : referencedMapCount > 0
      ? " This older JSON package records an offline map but does not contain its bytes; re-import the PMTiles archive before offline use."
      : "";
  requiredElement("#main-menu-status").textContent = `Opened ${packageValue.project.name}.${legacySummary}${mapSummary}`;
  requiredElement("#form-status").textContent = `Opened ${packageValue.project.name} with ${packageValue.programs.length} program${packageValue.programs.length === 1 ? "" : "s"} and ${packageValue.codeTables.length} code table${packageValue.codeTables.length === 1 ? "" : "s"}.${legacySummary}${mapSummary}`;
}

function openDataImportPreview(fileName: string, provenance: DatasetProvenance, imported: EpiRecord[]): void {
  const validationIssues = validateRecords(currentFormId, schema, imported, []);
  const errors = validationIssues.filter((issue) => issue.severity === "error");
  const invalidRecords = new Set(errors.map(({ recordIndex }) => recordIndex)).size;
  const key = suggestedImportKey(schema.fields, imported);
  const keySelect = requiredElement<HTMLSelectElement>("#data-import-preview-key");
  keySelect.replaceChildren(
    new Option("No matching key (Replace only)", ""),
    ...schema.fields.filter(({ type }) => type !== "command-button").map((field) => new Option(`${field.prompt} (${field.name})${field.name === key ? " — suggested" : ""}`, field.name)),
  );
  keySelect.value = key ?? "";
  for (const control of requiredElements<HTMLInputElement>('input[name="data-import-mode"]')) control.checked = false;
  pendingDataImport = {
    fileName,
    provenance,
    incoming: imported,
    preview: buildDataImportPreview({ fields: schema.fields, current: records, incoming: imported, ...(key ? { keyField: key } : {}), provenance, priorImports: importHistory, invalidRecords }),
  };
  if (!pendingDataImport.preview.exactFilePreviouslyImported) {
    requiredElement<HTMLInputElement>('input[name="data-import-mode"][value="update-and-append"]').checked = true;
  }
  renderDataImportPreview();
  requiredElement<HTMLDialogElement>("#data-import-preview-dialog").showModal();
  requiredElement("#csv-status").textContent = `Previewing ${imported.length} record${imported.length === 1 ? "" : "s"} from ${fileName}; no records changed.`;
}

async function previewDataImportFile(file: File): Promise<void> {
  const importedDataset = await datasetProvenanceForFile(file);
  const importedFile = await readTabularFile(file);
  const rows = importedFile.rows;
  const headers = rows[0]!.map((header) => normalizeFieldName(header));
  const expected = schema.fields.filter((field) => field.type !== "command-button").map((field) => field.name);
  const missing = expected.filter((name) => !headers.includes(name));
  if (missing.length > 0) throw new Error(`Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);

  const imported = rows.slice(1).map((cells) => normalizeImportedCoordinates(schema, materializeCalculatedFields(schema, Object.fromEntries(
    expected.map((name) => [name, cells[headers.indexOf(name)] ?? ""]),
  ))));
  openDataImportPreview(file.name, importedDataset, imported);
}

function transportIdentityField(): string | undefined {
  return suggestedImportKey(schema.fields, records)
    ?? schema.fields.find((field) => field.type === "unique-id" || field.rules?.some((rule) => rule.kind === "unique"))?.name;
}

function openPackageTransportDialog(): void {
  syncCurrentForm();
  const identityField = transportIdentityField();
  requiredElement("#package-project-name").textContent = projectName;
  requiredElement("#package-form-name").textContent = schema.name;
  requiredElement("#package-record-count").textContent = String(records.length);
  requiredElement<HTMLInputElement>("#package-name").value = safeFileStem(`${projectName}-${schema.name}`);
  requiredElement<HTMLInputElement>("#package-append-timestamp").checked = false;
  requiredElement<HTMLInputElement>("#package-passphrase").value = "";
  requiredElement<HTMLInputElement>("#package-passphrase-verify").value = "";
  requiredElement<HTMLInputElement>("#package-filter-value").value = "";
  requiredElement("#package-transport-status").textContent = identityField
    ? `${schema.fields.find(({ name }) => name === identityField)?.prompt ?? identityField} will be used to match records when imported.`
    : "No unique identity field was detected. The receiving import preview will allow Replace only.";
  const removeFields = requiredElement<HTMLSelectElement>("#package-remove-fields");
  removeFields.replaceChildren(...schema.fields.filter(({ type }) => type !== "command-button").map((field) => {
    const protectedField = field.required || field.name === identityField || field.rules?.some((rule) => rule.kind === "unique");
    const option = new Option(`${field.prompt} (${field.name})${protectedField ? " — protected" : ""}`, field.name);
    option.disabled = Boolean(protectedField);
    return option;
  }));
  requiredElement<HTMLSelectElement>("#package-filter-field").replaceChildren(
    new Option("All records", ""),
    ...schema.fields.filter(({ type }) => type !== "command-button").map((field) => new Option(`${field.prompt} (${field.name})`, field.name)),
  );
  requiredElement<HTMLSelectElement>("#package-filter-operator").value = "equals";
  requiredElement<HTMLDialogElement>("#package-transport-dialog").showModal();
}

function selectedTransportRecords(): EpiRecord[] {
  const filterField = requiredElement<HTMLSelectElement>("#package-filter-field").value;
  const filterValue = requiredElement<HTMLInputElement>("#package-filter-value").value.trim().toLocaleLowerCase("en-US");
  const operator = requiredElement<HTMLSelectElement>("#package-filter-operator").value;
  const selected = !filterField || !filterValue ? records : records.filter((record) => {
    const candidate = String(record[filterField] ?? "").trim().toLocaleLowerCase("en-US");
    if (operator === "not-equals") return candidate !== filterValue;
    if (operator === "contains") return candidate.includes(filterValue);
    return candidate === filterValue;
  });
  const removed = new Set([...requiredElement<HTMLSelectElement>("#package-remove-fields").selectedOptions].map(({ value }) => value));
  return selected.map((record) => Object.fromEntries(Object.entries(structuredClone(record)).map(([field, value]) => [field, removed.has(field) ? "" : value])));
}

let lastTransportPackage: File | null = null;
let secureShareSender: Awaited<ReturnType<typeof createSecureShareSender>> | null = null;
let secureShareReceiver: ReturnType<typeof createSecureShareReceiver> | null = null;
let receivedSecureSharePackage: File | null = null;

async function createTransportPackage(): Promise<void> {
  const status = requiredElement("#package-transport-status");
  const passphrase = requiredElement<HTMLInputElement>("#package-passphrase").value;
  const verification = requiredElement<HTMLInputElement>("#package-passphrase-verify").value;
  if (passphrase !== verification) throw new Error("The passphrases do not match.");
  const packageName = safeFileStem(requiredElement<HTMLInputElement>("#package-name").value);
  const selectedRecords = selectedTransportRecords();
  if (selectedRecords.length === 0) throw new Error("The selected record filter produced no records.");
  const current = projectState.forms.find(({ id }) => id === currentFormId);
  if (!current) throw new Error("The current form is unavailable.");
  const packagedForm: ProjectForm = {
    id: current.id,
    schema: structuredClone(current.schema),
    records: selectedRecords,
  };
  const transportProject: ProjectSnapshotV1 = {
    version: 1,
    name: projectName,
    currentFormId,
    storage: { type: "browser" },
    forms: [packagedForm],
  };
  status.textContent = `Validating and encrypting ${selectedRecords.length} record${selectedRecords.length === 1 ? "" : "s"}...`;
  const portable = createProjectPackage(transportProject);
  const archive = await createProjectArchive(portable, []);
  const encrypted = await encryptProjectArchive(archive, passphrase);
  const suffix = requiredElement<HTMLInputElement>("#package-append-timestamp").checked
    ? `-${new Date().toISOString().replace(/[:.]/g, "-")}`
    : "";
  const fileName = `${packageName}${suffix}${ENCRYPTED_PROJECT_EXTENSION}`;
  lastTransportPackage = new File([encrypted], fileName, { type: encrypted.type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(lastTransportPackage);
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
  const removed = requiredElement<HTMLSelectElement>("#package-remove-fields").selectedOptions.length;
  status.textContent = `Package creation complete: ${selectedRecords.length} record${selectedRecords.length === 1 ? "" : "s"}, ${removed} field${removed === 1 ? "" : "s"} blanked. Store the passphrase separately.`;
}

async function reviewEncryptedDataPackage(selectedFile?: File, selectedPassphrase?: string): Promise<void> {
  const status = requiredElement("#data-package-import-status");
  const file = selectedFile ?? requiredElement<HTMLInputElement>("#data-package-file").files?.[0];
  if (!file) throw new Error("Select an encrypted data package.");
  if (/\.edp7$/i.test(file.name)) {
    throw new Error("Legacy .edp7 decryption is not enabled until representative compatibility fixtures pass review. Use a modern .epiax package in this V0.1 slice.");
  }
  if (!await isEncryptedProjectArchive(file)) throw new Error("The selected file is not a supported encrypted Epi Info AI package.");
  status.textContent = `Decrypting and validating ${file.name}...`;
  const decrypted = await decryptProjectArchive(file, selectedPassphrase ?? requiredElement<HTMLInputElement>("#data-package-passphrase").value);
  const parsed = await parseProjectArchive(decrypted);
  const source = parsed.projectPackage.project.forms.length === 1
    ? parsed.projectPackage.project.forms[0]
    : parsed.projectPackage.project.forms.find(({ id, schema: candidate }) => id === currentFormId || candidate.name === schema.name);
  if (!source) throw new Error("The package does not contain a form compatible with the current form.");
  const currentFields = schema.fields.filter(({ type }) => type !== "command-button");
  const mismatched = currentFields.filter((field) => !source.schema.fields.some((candidate) => candidate.name === field.name && candidate.type === field.type));
  if (mismatched.length) throw new Error(`The packaged form is incompatible. Missing or different field${mismatched.length === 1 ? "" : "s"}: ${mismatched.map(({ prompt }) => prompt).join(", ")}.`);
  const imported = source.records.map((record) => normalizeImportedCoordinates(schema, materializeCalculatedFields(schema,
    Object.fromEntries(currentFields.map(({ name }) => [name, record[name] ?? ""])),
  )));
  const provenance = await datasetProvenanceForFile(file);
  const importDialog = requiredElement<HTMLDialogElement>("#data-package-import-dialog");
  if (importDialog.open) importDialog.close("review");
  const shareDialog = requiredElement<HTMLDialogElement>("#secure-share-dialog");
  if (shareDialog.open) shareDialog.close("review");
  openDataImportPreview(file.name, provenance, imported);
}

function resetSecureShare(): void {
  secureShareSender?.close();
  secureShareReceiver?.close();
  secureShareSender = null;
  secureShareReceiver = null;
  receivedSecureSharePackage = null;
  for (const selector of ["#secure-share-send-offer", "#secure-share-send-answer", "#secure-share-receive-offer", "#secure-share-receive-answer", "#secure-share-receive-passphrase"]) {
    requiredElement<HTMLInputElement | HTMLTextAreaElement>(selector).value = "";
  }
  requiredElement("#secure-share-send-fingerprint").textContent = "Not created";
  requiredElement("#secure-share-receive-sender-fingerprint").textContent = "Not received";
  requiredElement("#secure-share-receive-fingerprint").textContent = "Not created";
  requiredElement<HTMLProgressElement>("#secure-share-send-progress").value = 0;
  requiredElement<HTMLProgressElement>("#secure-share-receive-progress").value = 0;
  requiredElement<HTMLButtonElement>("#secure-share-accept-answer").disabled = true;
  requiredElement<HTMLButtonElement>("#secure-share-review-received").disabled = true;
  requiredElement("#secure-share-send-status").textContent = "";
  requiredElement("#secure-share-receive-status").textContent = "";
  requiredElement("#secure-share-send-selection").textContent = lastTransportPackage
    ? `${lastTransportPackage.name} (${(lastTransportPackage.size / 1024).toFixed(1)} KiB) is ready from Package for Transport.`
    : "Create a transport package first or select an existing .epiax file.";
}

function openSecureShareDialog(): void {
  resetSecureShare();
  requiredElement<HTMLInputElement>("#secure-share-send-file").value = "";
  requiredElement<HTMLDialogElement>("#secure-share-dialog").showModal();
}

function secureShareSendFile(): File | undefined {
  return requiredElement<HTMLInputElement>("#secure-share-send-file").files?.[0] ?? lastTransportPackage ?? undefined;
}

async function createFormFromDataFile(file: File, importRows: boolean): Promise<{ fields: number; rows: number; importedRows: boolean; persisted: boolean }> {
  const importedDataset = importRows ? await datasetProvenanceForFile(file) : undefined;
  const importedFile = await readTabularFile(file);
  const inferred = inferSchemaFromRows(file.name, importedFile.rows);
  schema = inferred.schema;
  if (importRows) {
    records = inferred.records;
  }
  datasetProvenance = importedDataset;
  importHistory = importedDataset ? [structuredClone(importedDataset)] : [];
  renderDesigner();
  renderEntryForm();
  renderRecords();
  syncCurrentForm();
  const schemaPersisted = saveJson(SCHEMA_KEY, schema);
  const recordsPersisted = !importRows || saveJson(RECORDS_KEY, records);
  return {
    fields: schema.fields.length,
    rows: inferred.records.length,
    importedRows: importRows,
    persisted: schemaPersisted && recordsPersisted,
  };
}

export function initializeFormDataDemo() {
  renderFormDesignerMenuContract(requiredElement(".designer-menu"));
  renderEnterDataMenuContract(requiredElement(".enter-data-menu"));
  requiredElement("#snap-to-grid").checked = snapToGrid;
  renderDesigner();
  renderEntryForm();
  renderRecords();
  renderStorageBadge();
  renderProjectLifecycle();
  if (projectLoadWarning) {
    requiredElement("#main-menu-status").textContent = projectLoadWarning;
    requiredElement("#form-status").textContent = projectLoadWarning;
    projectLoadWarning = "";
  }

  for (const button of requiredElements("[data-module]")) {
    button.addEventListener("click", () => showModule(button.dataset.module ?? ""));
  }

  for (const button of requiredElements("[data-open-module]")) {
    button.addEventListener("click", () => showModule(button.dataset.openModule ?? ""));
  }

  initializeEntryView();
  initializeStudyAreaPicker();

  requiredElement("#file-open-project").addEventListener("click", () => requiredElement<HTMLInputElement>("#project-package-open").click());
  requiredElement("#file-save-project").addEventListener("click", () => void saveProjectPackage());
  requiredElement("#designer-open-project").addEventListener("click", () => {
    requiredElement<HTMLDetailsElement>("#designer-file-menu").open = false;
    requiredElement<HTMLInputElement>("#project-package-open").click();
  });
  requiredElement("#designer-new-project").addEventListener("click", () => {
    requiredElement<HTMLDetailsElement>("#designer-file-menu").open = false;
    requiredElement<HTMLButtonElement>("#new-project").click();
  });
  requiredElement("#designer-new-form").addEventListener("click", () => requiredElement<HTMLButtonElement>("#new-form").click());
  requiredElement("#designer-project-storage").addEventListener("click", () => {
    requiredElement<HTMLDetailsElement>("#designer-file-menu").open = false;
    requiredElement<HTMLButtonElement>("#project-storage").click();
  });
  requiredElement("#designer-menu-enter-data").addEventListener("click", () => requiredElement<HTMLButtonElement>("#designer-enter-data").click());
  requiredElement("#designer-exit").addEventListener("click", () => {
    if (!closeCurrentProject("Project saved and Form Designer closed.")) return;
    requiredElement<HTMLButtonElement>("#main-menu-button").click();
  });
  requiredElement("#no-project-open").addEventListener("click", () => requiredElement<HTMLInputElement>("#project-package-open").click());
  requiredElement("#designer-close-project").addEventListener("click", () => {
    requiredElement<HTMLDetailsElement>("#designer-file-menu").open = false;
    closeCurrentProject();
  });
  requiredElement("#no-project-new").addEventListener("click", () => requiredElement<HTMLButtonElement>("#new-project").click());
  for (const trigger of requiredElements<HTMLButtonElement>(".designer-menu:not(.enter-data-menu) [data-menu-submenu]")) {
    trigger.addEventListener("click", () => {
      if (trigger.disabled || trigger.getAttribute("aria-disabled") === "true") return;
      const list = trigger.nextElementSibling;
      if (!(list instanceof HTMLElement)) return;
      const willOpen = list.hidden;
      collapseDesignerSubmenus(willOpen ? trigger : null);
      list.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
    });
  }
  for (const menu of requiredElements<HTMLDetailsElement>(".designer-menu details.legacy-menu")) {
    menu.addEventListener("toggle", () => {
      if (!menu.open) collapseDesignerSubmenus();
    });
  }
  for (const trigger of requiredElements<HTMLButtonElement>(".enter-data-menu [data-menu-submenu]")) {
    trigger.addEventListener("click", () => {
      if (trigger.disabled || trigger.getAttribute("aria-disabled") === "true") return;
      const list = trigger.nextElementSibling;
      if (!(list instanceof HTMLElement)) return;
      const willOpen = list.hidden;
      for (const other of requiredElements<HTMLButtonElement>(".enter-data-menu [data-menu-submenu]")) {
        if (other === trigger) continue;
        other.setAttribute("aria-expanded", "false");
        if (other.nextElementSibling instanceof HTMLElement) other.nextElementSibling.hidden = true;
      }
      list.hidden = !willOpen;
      trigger.setAttribute("aria-expanded", String(willOpen));
    });
  }
  requiredElement(".designer-menu").addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
    if (!target) return;
    event.preventDefault();
    const message = target.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
    (hasActiveProject ? requiredElement("#form-status") : requiredElement("#project-lifecycle-status")).textContent = message;
  });
  requiredElement(".enter-data-menu").addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
    if (!target) return;
    event.preventDefault();
    requiredElement("#record-status").textContent = target.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
  });
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "o") return;
    const formsView = requiredElement<HTMLElement>('[data-module-view="forms"]');
    if (formsView.hidden) return;
    event.preventDefault();
    requiredElement<HTMLButtonElement>("#designer-open-project").click();
  });
  requiredElement("#project-package-open").addEventListener("change", async (event) => {
    const target = eventControl(event);
    const file = target.files?.[0];
    if (!file) return;
    requiredElement("#main-menu-status").textContent = `Opening ${file.name}...`;
    try {
      await openProjectPackage(file);
    } catch (error) {
      requiredElement("#main-menu-status").textContent = error instanceof Error ? error.message : "Unable to open this project package.";
    } finally {
      target.value = "";
    }
  });

  for (const button of requiredElements<HTMLButtonElement>("[data-designer-view]")) {
    button.addEventListener("click", () => {
      const view = button.dataset.designerView;
      setDesignerView(view === "explorer" || view === "properties" ? view : "canvas");
    });
  }

  requiredElement("#enter-data-quality").addEventListener("click", () => {
    activeDuplicateGroup = null;
    requiredElement("#data-quality-action-status").textContent = "";
    renderDataQuality();
    requiredElement<HTMLDialogElement>("#data-quality-dialog").showModal();
  });
  requiredElement("#enter-menu-data-quality").addEventListener("click", () => requiredElement<HTMLButtonElement>("#enter-data-quality").click());
  requiredElement("#enter-menu-import-file").addEventListener("click", () => requiredElement<HTMLInputElement>("#csv-import").click());
  requiredElement("#enter-menu-package-transport").addEventListener("click", () => {
    requiredElement<HTMLDetailsElement>("#enter-file-menu").open = false;
    openPackageTransportDialog();
  });
  requiredElement("#enter-menu-import-package").addEventListener("click", () => {
    requiredElement<HTMLDetailsElement>("#enter-file-menu").open = false;
    requiredElement<HTMLInputElement>("#data-package-file").value = "";
    requiredElement<HTMLInputElement>("#data-package-passphrase").value = "";
    requiredElement("#data-package-import-status").textContent = "";
    requiredElement<HTMLDialogElement>("#data-package-import-dialog").showModal();
  });
  requiredElement("#enter-menu-secure-share").addEventListener("click", () => {
    requiredElement<HTMLDetailsElement>("#enter-file-menu").open = false;
    openSecureShareDialog();
  });
  requiredElement("#package-create").addEventListener("click", async () => {
    try { await createTransportPackage(); }
    catch (error) { requiredElement("#package-transport-status").textContent = error instanceof Error ? error.message : "Unable to create the encrypted data package."; }
  });
  requiredElement("#data-package-review").addEventListener("click", async () => {
    try { await reviewEncryptedDataPackage(); }
    catch (error) { requiredElement("#data-package-import-status").textContent = error instanceof Error ? error.message : "Unable to review the encrypted data package."; }
  });
  requiredElement("#secure-share-send-file").addEventListener("change", () => {
    const file = requiredElement<HTMLInputElement>("#secure-share-send-file").files?.[0];
    requiredElement("#secure-share-send-selection").textContent = file
      ? `${file.name} (${(file.size / 1024).toFixed(1)} KiB) selected.`
      : lastTransportPackage ? `${lastTransportPackage.name} remains ready from Package for Transport.` : "No encrypted package selected.";
  });
  requiredElement("#secure-share-create-offer").addEventListener("click", async () => {
    const status = requiredElement("#secure-share-send-status");
    try {
      const file = secureShareSendFile();
      if (!file) throw new Error("Create or select an encrypted .epiax package first.");
      if (!await isEncryptedProjectArchive(file)) throw new Error("Secure Share sends authenticated .epiax packages only.");
      secureShareSender?.close();
      secureShareSender = await createSecureShareSender(file, {
        onStatus(message) { status.textContent = message; },
        onProgress({ transferred, total }) {
          const progress = requiredElement<HTMLProgressElement>("#secure-share-send-progress");
          progress.max = total; progress.value = transferred;
        },
        onError(error) { status.textContent = error.message; },
      });
      requiredElement<HTMLTextAreaElement>("#secure-share-send-offer").value = secureShareSender.offer;
      requiredElement("#secure-share-send-fingerprint").textContent = secureShareSender.fingerprint;
      requiredElement<HTMLButtonElement>("#secure-share-accept-answer").disabled = false;
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to create a Secure Share offer."; }
  });
  requiredElement("#secure-share-accept-answer").addEventListener("click", async () => {
    const status = requiredElement("#secure-share-send-status");
    try {
      if (!secureShareSender) throw new Error("Create an offer first.");
      status.textContent = "Applying the receiver answer...";
      await secureShareSender.acceptAnswer(requiredElement<HTMLTextAreaElement>("#secure-share-send-answer").value);
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to apply the receiver answer."; }
  });
  requiredElement("#secure-share-create-answer").addEventListener("click", async () => {
    const status = requiredElement("#secure-share-receive-status");
    try {
      secureShareReceiver?.close();
      receivedSecureSharePackage = null;
      requiredElement<HTMLButtonElement>("#secure-share-review-received").disabled = true;
      secureShareReceiver = createSecureShareReceiver({
        onStatus(message) { status.textContent = message; },
        onProgress({ transferred, total }) {
          const progress = requiredElement<HTMLProgressElement>("#secure-share-receive-progress");
          progress.max = total; progress.value = transferred;
        },
        onFile(file) {
          receivedSecureSharePackage = file;
          requiredElement<HTMLButtonElement>("#secure-share-review-received").disabled = false;
        },
        onError(error) { status.textContent = error.message; },
      });
      const result = await secureShareReceiver.acceptOffer(requiredElement<HTMLTextAreaElement>("#secure-share-receive-offer").value);
      requiredElement<HTMLTextAreaElement>("#secure-share-receive-answer").value = result.answer;
      requiredElement("#secure-share-receive-sender-fingerprint").textContent = result.senderFingerprint;
      requiredElement("#secure-share-receive-fingerprint").textContent = result.fingerprint;
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to create a Secure Share answer."; }
  });
  requiredElement("#secure-share-review-received").addEventListener("click", async () => {
    const status = requiredElement("#secure-share-receive-status");
    try {
      if (!receivedSecureSharePackage) throw new Error("No verified package has been received.");
      await reviewEncryptedDataPackage(receivedSecureSharePackage, requiredElement<HTMLInputElement>("#secure-share-receive-passphrase").value);
    } catch (error) { status.textContent = error instanceof Error ? error.message : "Unable to review the received package."; }
  });
  requiredElement("#secure-share-dialog").addEventListener("close", resetSecureShare);
  requiredElement("#enter-menu-new-record").addEventListener("click", () => {
    setEntryView("entry");
    requiredElement<HTMLFormElement>("#record-form").reset();
    renderEntryValidation([]);
    requiredElement("#new-record-title").textContent = "New record";
    requiredElement("#record-status").textContent = "Ready for a new record.";
  });
  requiredElement("#enter-menu-edit-form").addEventListener("click", () => requiredElement<HTMLButtonElement>('[data-module="forms"]').click());
  requiredElement("#enter-menu-save").addEventListener("click", () => requiredElement<HTMLFormElement>("#record-form").requestSubmit());
  requiredElement("#enter-menu-exit").addEventListener("click", () => requiredElement<HTMLButtonElement>("#main-menu-button").click());
  requiredElement("#enter-menu-status-bar").addEventListener("click", (event) => {
    const statusbar = requiredElement<HTMLElement>("#enter-statusbar");
    statusbar.hidden = !statusbar.hidden;
    requiredElement<HTMLButtonElement>("#enter-menu-status-bar").setAttribute("aria-checked", String(!statusbar.hidden));
  });
  requiredElement("#enter-menu-status-bar").setAttribute("aria-checked", "true");
  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
    const dataView = requiredElement<HTMLElement>('[data-module-view="data"]');
    if (dataView.hidden || !hasActiveProject) return;
    event.preventDefault();
    requiredElement<HTMLFormElement>("#record-form").requestSubmit();
  });
  for (const button of requiredElements("[data-close-data-quality]")) {
    button.addEventListener("click", () => requiredElement<HTMLDialogElement>("#data-quality-dialog").close());
  }
  requiredElement("#data-quality-duplicate-group").addEventListener("change", (event) => {
    const report = buildDataQualityReport(currentFormId, schema, records);
    activeDuplicateGroup = report.duplicateGroups.find((group) => group.id === eventControl(event).value) ?? null;
    renderDuplicateComparison();
  });
  requiredElement("#data-quality-delete-a").addEventListener("click", () => {
    try { moveDuplicateToRecycleBin(0); }
    catch (error) { requiredElement("#data-quality-action-status").textContent = error instanceof Error ? error.message : "Unable to delete this record."; }
  });
  requiredElement("#data-quality-delete-b").addEventListener("click", () => {
    try { moveDuplicateToRecycleBin(1); }
    catch (error) { requiredElement("#data-quality-action-status").textContent = error instanceof Error ? error.message : "Unable to delete this record."; }
  });
  requiredElement("#data-quality-deleted-record").addEventListener("change", (event) => {
    requiredElement<HTMLButtonElement>("#data-quality-restore-record").disabled = !eventControl(event).value;
  });
  requiredElement("#data-quality-restore-record").addEventListener("click", () => {
    try { restoreDeletedRecord(); }
    catch (error) { requiredElement("#data-quality-action-status").textContent = error instanceof Error ? error.message : "Unable to restore this record."; }
  });

  requiredElement("#field-skip-condition").addEventListener("change", updateSkipRuleControls);
  requiredElement("#field-check-action").addEventListener("change", () => populateCheckCodeTargets());
  requiredElement("#field-rules-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      saveFieldRules();
    } catch (error) {
      requiredElement("#field-rules-status").textContent = error instanceof Error ? error.message : "Unable to save these field rules.";
    }
  });
  for (const button of requiredElements("[data-close-field-rules]")) {
    button.addEventListener("click", () => requiredElement<HTMLDialogElement>("#field-rules-dialog").close());
  }

  requiredElement("#main-menu-button").addEventListener("click", showMainMenu);
  for (const button of requiredElements("[data-menu-message]")) {
    button.addEventListener("click", () => {
      requiredElement("#main-menu-status").textContent = button.dataset.menuMessage ?? "";
    });
  }

  requiredElement("#add-field").addEventListener("click", () => {
    try {
      schema = validatedDesignerSchema();
    } catch {
      // Keep the current in-memory schema if another row is mid-edit.
    }
    schema.fields.push(fieldFromPalette("text", snapCoordinate(36), snapCoordinate(30 + schema.fields.length * 52)));
    renderDesigner();
  });

  requiredElement("#add-geolocation-template").addEventListener("click", () => {
    try {
      schema = schemaFromDesigner();
    } catch {
      // Preserve the last valid schema while another property row is mid-edit.
    }
    schema.fields.push(...geolocationTemplateFields());
    syncCurrentForm();
    renderDesigner();
    renderEntryForm();
    renderRecords();
    requiredElement("#form-status").textContent = "Geo-location template added: Address, Get Coordinates, Latitude, and Longitude. This matches the legacy GEOCODE field template.";
  });

  requiredElement("#field-list").addEventListener("input", () => {
    try {
      schema = schemaFromDesigner();
      renderCanvas();
      renderProjectTree();
    } catch {
      // Partial edits are allowed until Save Form performs full validation.
    }
  });

  requiredElement("#form-name").addEventListener("input", (event) => {
    schema.name = eventControl(event).value || "Untitled Form";
    renderProjectTree();
  });

  for (const fieldType of requiredElements<HTMLElement>("#field-palette [data-field-type]")) {
    fieldType.addEventListener("dragstart", (event: DragEvent) => {
      const transfer = event.dataTransfer;
      const type = fieldType.dataset.fieldType as FieldType | undefined;
      if (!transfer || !type) return;
      transfer.setData("application/x-epi-field-type", type);
      transfer.effectAllowed = "copy";
    });
    fieldType.addEventListener("click", () => {
      const type = fieldType.dataset.fieldType as FieldType | undefined;
      if (!type) return;
      schema.fields.push(fieldFromPalette(type, snapCoordinate(36), snapCoordinate(30 + schema.fields.length * 52)));
      renderDesigner();
      requiredElement("#form-status").textContent = `${fieldType.textContent?.trim() ?? "Field"} added to the canvas.`;
    });
  }

  const formCanvas = requiredElement<HTMLElement>("#form-canvas");
  formCanvas.addEventListener("dragover", (event: DragEvent) => {
    event.preventDefault();
    formCanvas.classList.add("drag-target");
  });
  formCanvas.addEventListener("dragleave", () => formCanvas.classList.remove("drag-target"));
  formCanvas.addEventListener("drop", (event: DragEvent) => {
    event.preventDefault();
    formCanvas.classList.remove("drag-target");
    const bounds = formCanvas.getBoundingClientRect();
    const x = snapCoordinate(Math.max(8, event.clientX - bounds.left + formCanvas.scrollLeft - 145));
    const y = snapCoordinate(Math.max(8, event.clientY - bounds.top + formCanvas.scrollTop - 18));
    const fieldIndex = event.dataTransfer?.getData("application/x-epi-field-index") ?? "";
    const fieldType = event.dataTransfer?.getData("application/x-epi-field-type") as FieldType | "";
    if (fieldIndex !== "" && schema.fields[Number(fieldIndex)]) {
      schema.fields[Number(fieldIndex)]!.x = x;
      schema.fields[Number(fieldIndex)]!.y = y;
    } else if (fieldType) {
      schema.fields.push(fieldFromPalette(fieldType, x, y));
    }
    renderDesigner();
  });

  requiredElement("#snap-to-grid").addEventListener("change", (event) => {
    snapToGrid = eventControl(event).checked;
    saveText(SNAP_KEY, String(snapToGrid));
    if (snapToGrid) {
      for (const field of schema.fields) {
        if (Number.isFinite(field.x)) field.x = snapCoordinate(field.x!);
        if (Number.isFinite(field.y)) field.y = snapCoordinate(field.y!);
      }
    }
    renderCanvas();
    requiredElement("#form-status").textContent = snapToGrid
      ? `Snap to Grid enabled (${GRID_SIZE}px).`
      : "Snap to Grid disabled; fields can be placed freely.";
  });

  const projectDialog = requiredElement("#project-dialog");
  const storageEngine = requiredElement("#storage-engine");
  const supabaseSettings = requiredElement("#supabase-settings");
  const supabaseUrl = requiredElement("#supabase-url");
  const supabasePublishableKey = requiredElement("#supabase-publishable-key");
  const projectDialogNote = requiredElement("#project-dialog-note");
  const projectStudyAreaSummary = requiredElement("#project-study-area-summary");
  const projectStudyAreaRemove = requiredElement<HTMLButtonElement>("#project-study-area-remove");
  let pendingStudyArea: ProjectStudyArea | null = null;

  function discardPendingStudyAreaAsset() {
    const asset = pendingStudyArea?.offlineMap.asset;
    if (asset) void removePmtilesAsset(asset).catch(() => undefined);
  }

  function renderPendingStudyArea() {
    const estimate = pendingStudyArea?.offlineMap.estimate;
    const estimateSummary = estimate
      ? `; ${estimate.tileCount.toLocaleString()} tiles (approximately ${(estimate.estimatedBytes / 1024 / 1024).toFixed(1)} MiB) via ${offlineMapProvider(pendingStudyArea!.offlineMap.providerId ?? "").label}`
      : "";
    const asset = pendingStudyArea?.offlineMap.asset;
    const assetSummary = asset
      ? `; ${asset.fileName} validated and stored in ${asset.persistence === "persistent" ? "persistent" : "best-effort"} browser storage`
      : "";
    projectStudyAreaSummary.textContent = pendingStudyArea
      ? `${pendingStudyArea.name}: ${pendingStudyArea.bounds.map((coordinate) => coordinate.toFixed(5)).join(", ")}; zoom 0-${pendingStudyArea.offlineMap.maxZoom}${estimateSummary}${assetSummary}.`
      : "No study area selected. You can add one later.";
    projectStudyAreaRemove.hidden = !pendingStudyArea;
  }

  function updateStorageDialog() {
    const usesSupabase = storageEngine.value === "supabase";
    supabaseSettings.hidden = !usesSupabase;
    supabaseUrl.required = usesSupabase;
    supabasePublishableKey.required = usesSupabase;
    requiredElement("#local-storage-access").checked = !usesSupabase;
    requiredElement("#supabase-storage-access").disabled = !usesSupabase;
    requiredElement("#supabase-storage-access").checked = usesSupabase;
    projectDialogNote.textContent = usesSupabase
      ? "Test verifies the Supabase Data API. Records remain local until authentication, tables, and Row Level Security policies are installed."
      : "Data remains on this device. Server synchronization is not part of this demo.";
  }

  requiredElement("#new-project").addEventListener("click", () => {
    const savedSupabase = loadJson<Partial<SupabaseConnectionConfig>>(SUPABASE_CONFIG_KEY, {});
    supabaseUrl.value = savedSupabase.url || "";
    supabasePublishableKey.value = savedSupabase.publishableKey || "";
    storageEngine.value = hasActiveProject && projectState.storage?.type === "supabase" ? "supabase" : "browser";
    discardPendingStudyAreaAsset();
    pendingStudyArea = null;
    renderPendingStudyArea();
    updateStorageDialog();
    projectDialog.showModal();
  });
  requiredElement("#project-study-area-open").addEventListener("click", () => {
    const proposedName = requiredElement<HTMLInputElement>("#database-name").value.trim() || "Project";
    projectDialog.close("study-area");
    openStudyAreaPicker(proposedName, (studyArea) => {
      if (studyArea) pendingStudyArea = studyArea;
      renderPendingStudyArea();
      projectDialog.showModal();
    });
  });
  projectStudyAreaRemove.addEventListener("click", () => {
    discardPendingStudyAreaAsset();
    pendingStudyArea = null;
    renderPendingStudyArea();
  });
  storageEngine.addEventListener("change", updateStorageDialog);
  for (const closeButton of requiredElements("[data-close-project-dialog]")) {
    closeButton.addEventListener("click", () => {
      discardPendingStudyAreaAsset();
      pendingStudyArea = null;
      projectDialog.close("cancel");
    });
  }
  projectDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    discardPendingStudyAreaAsset();
    pendingStudyArea = null;
    projectDialog.close("cancel");
  });
  const testStoreButton = requiredElement<HTMLButtonElement>("#test-store");
  testStoreButton.addEventListener("click", async () => {
    if (storageEngine.value === "browser") {
      projectDialogNote.textContent = "Local browser storage is available. No server connection is required.";
      return;
    }
    testStoreButton.disabled = true;
    projectDialogNote.textContent = "Testing the Supabase Data API connection...";
    try {
      const config = await testSupabaseConnection(supabaseUrl.value, supabasePublishableKey.value);
      saveJson(SUPABASE_CONFIG_KEY, config);
      projectDialogNote.textContent = "Connected to Supabase. The project URL and publishable key are valid.";
    } catch (error) {
      projectDialogNote.textContent = error instanceof Error ? error.message : "Unable to test the Supabase connection.";
    } finally {
      testStoreButton.disabled = false;
    }
  });
  requiredElement("#project-dialog-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const storageType = storageEngine.value === "supabase" ? "supabase" : "browser";
    if (storageType === "supabase") {
      projectDialogNote.textContent = "Verifying Supabase before creating the local working copy...";
      try {
        const config = await testSupabaseConnection(supabaseUrl.value, supabasePublishableKey.value);
        saveJson(SUPABASE_CONFIG_KEY, config);
      } catch (error) {
        projectDialogNote.textContent = error instanceof Error ? error.message : "Unable to verify the Supabase connection.";
        return;
      }
    }
    if (!closeCurrentProject("Current project saved to Recent Projects before creating the new project.")) {
      projectDialogNote.textContent = "The new project was not created because the current project could not be closed safely.";
      return;
    }
    projectName = requiredElement("#database-name").value.trim() || "Untitled Project";
    schema = { name: "New Form", fields: [] };
    records = [];
    currentFormId = newFormId();
    datasetProvenance = undefined;
    importHistory = [];
    projectState = {
      name: projectName,
      currentFormId,
      storage: { type: storageType },
      forms: [{ id: currentFormId, schema: structuredClone(schema), records: [] }],
      ...(pendingStudyArea ? { studyAreas: [structuredClone(pendingStudyArea)] } : {}),
    };
    projectPackageExtras = { programs: [], codeTables: [] };
    activateProject(null);
    syncCurrentForm();
    renderDesigner();
    renderEntryForm();
    renderRecords();
    renderStorageBadge();
    projectDialog.close("create");
    const areaStatus = pendingStudyArea ? ` Study area ${pendingStudyArea.name} was saved with the project.` : "";
    requiredElement("#form-status").textContent = storageType === "supabase"
      ? `${projectName} created with a verified Supabase connection and local working copy.${areaStatus}`
      : `${projectName} created.${areaStatus}`;
    pendingStudyArea = null;
  });

  requiredElement("#new-form").addEventListener("click", () => {
    try {
      schema = schemaFromDesigner();
    } catch {
      // Preserve the last valid version if a property edit is incomplete.
    }
    syncCurrentForm();
    currentFormId = newFormId();
    schema = { name: "New Form", fields: [] };
    records = [];
    datasetProvenance = undefined;
    importHistory = [];
    projectState.forms.push({ id: currentFormId, schema: structuredClone(schema), records: [] });
    projectState.currentFormId = currentFormId;
    syncCurrentForm();
    renderDesigner();
    renderEntryForm();
    renderRecords();
    requiredElement("#form-status").textContent = "New form added to the project.";
  });

  requiredElement("#restore-demo").addEventListener("click", () => {
    if (!window.confirm("Restore the example form and remove all locally saved demo records?")) return;
    schema = structuredClone(DEFAULT_SCHEMA);
    records = [];
    datasetProvenance = undefined;
    importHistory = [];
    syncCurrentForm();
    renderDesigner();
    renderEntryForm();
    renderRecords();
    requiredElement("#form-status").textContent = "Example form restored and demo records removed.";
    requiredElement("#csv-form-status").textContent = "";
  });

  requiredElement("#form-csv-import").addEventListener("change", async (event) => {
    const target = eventControl(event);
    const file = target.files?.[0];
    if (!file) return;
    const status = requiredElement("#csv-form-status");
    status.textContent = `Reading ${file.name}...`;
    try {
      const result = await createFormFromDataFile(
        file,
        requiredElement("#import-rows-with-form").checked,
      );
      const success = result.importedRows
        ? `Created ${result.fields} fields and imported ${result.rows} records from ${file.name}.`
        : `Created ${result.fields} fields from ${file.name}. Existing records were preserved.`;
      status.textContent = result.persisted
        ? success
        : `${success} This browser did not allow persistent storage, so the form lasts until the page is reloaded.`;
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Unable to create a form from this data file.";
    } finally {
      target.value = "";
    }
  });

  requiredElement("#save-form").addEventListener("click", () => {
    const status = requiredElement("#form-status");
    try {
      schema = validatedDesignerSchema();
      syncCurrentForm();
      renderDesigner();
      renderEntryForm();
      renderRecords();
      status.textContent = "Form saved.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "Unable to save this form.";
    }
  });

  const recordForm = requiredElement<HTMLFormElement>("#record-form");
  recordForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const record = materializeCalculatedFields(schema, collectEntryRecord(recordForm, schema));
    const validationIssues = validateRecord(currentFormId, schema, record, records.length, records);
    renderEntryValidation(validationIssues);
    const errors = validationIssues.filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      requiredElement("#record-status").textContent = `Record not saved. Review ${errors.length} validation error${errors.length === 1 ? "" : "s"}.`;
      requiredElement<HTMLElement>(`[name="${errors[0]!.fieldName}"]`).focus();
      return;
    }
    records.push(record);
    syncCurrentForm();
    renderRecords();
    recordForm.reset();
    renderEntryValidation([]);
    requiredElement("#new-record-title").textContent = "New record";
    requiredElement("#record-status").textContent = "Record saved locally.";
  });

  requiredElement("#reset-record").addEventListener("click", () => {
    requiredElement("#new-record-title").textContent = "New record";
    requiredElement("#record-status").textContent = "";
    renderEntryValidation([]);
  });

  requiredElement("#csv-export").addEventListener("click", exportCsv);
  requiredElement("#data-import-preview-key").addEventListener("change", updatePendingDataImportPreview);
  for (const control of requiredElements<HTMLInputElement>('input[name="data-import-mode"]')) {
    control.addEventListener("change", renderDataImportPreview);
  }
  requiredElement("#data-import-preview-apply").addEventListener("click", () => {
    if (!pendingDataImport) return;
    const mode = selectedImportMode();
    if (!mode) return;
    const preview = pendingDataImport.preview;
    try {
      const nextRecords = applyDataImport(records, pendingDataImport.incoming, preview, mode);
      const validationIssues = validateRecords(currentFormId, schema, nextRecords, []);
      const errors = validationIssues.filter((issue) => issue.severity === "error");
      if (errors.length) throw new Error(`Result validation found ${errors.length} error${errors.length === 1 ? "" : "s"}. ${errors[0]!.message}`);
      records = nextRecords;
      datasetProvenance ??= structuredClone(pendingDataImport.provenance);
      if (!importHistory.some(({ sha256 }) => sha256 === pendingDataImport!.provenance.sha256)) {
        importHistory.push(structuredClone(pendingDataImport.provenance));
      }
      const effect = mode === "replace"
        ? `replaced the current data with ${preview.incoming} record${preview.incoming === 1 ? "" : "s"}`
        : mode === "update-and-append"
          ? `updated ${preview.changedRecords}, appended ${preview.newRecords}, and left ${preview.unchangedRecords} unchanged`
          : mode === "update-only"
            ? `updated ${preview.changedRecords}, left ${preview.unchangedRecords} unchanged, and ignored ${preview.newRecords} new`
            : `appended ${preview.newRecords} new and ignored ${preview.matchingRecords} matching`;
      const fileName = pendingDataImport.fileName;
      const persisted = syncCurrentForm();
      renderRecords();
      requiredElement("#csv-status").textContent = `Import from ${fileName}: ${effect}. ${records.length} total record${records.length === 1 ? "" : "s"}.${persisted ? "" : " Browser persistence was unavailable."}`;
      pendingDataImport = null;
      requiredElement<HTMLDialogElement>("#data-import-preview-dialog").close("apply");
      globalThis.dispatchEvent(new CustomEvent("epi-info-project-changed"));
    } catch (error) {
      requiredElement("#data-import-preview-feedback").textContent = error instanceof Error ? error.message : "Unable to apply this import.";
    }
  });
  requiredElement("#data-import-preview-dialog").addEventListener("close", (event) => {
    const dialog = event.currentTarget as HTMLDialogElement;
    if (dialog.returnValue !== "apply" && pendingDataImport) {
      requiredElement("#csv-status").textContent = `Import of ${pendingDataImport.fileName} canceled; no records changed.`;
      pendingDataImport = null;
    }
  });
  requiredElement("#csv-import").addEventListener("change", async (event) => {
    const target = eventControl(event);
    const file = target.files?.[0];
    if (!file) return;
    requiredElement("#csv-status").textContent = `Preparing preview for ${file.name}...`;
    try {
      await previewDataImportFile(file);
    } catch (error) {
      requiredElement("#csv-status").textContent = error instanceof Error ? error.message : "Unable to import this data file.";
    } finally {
      target.value = "";
    }
  });

  showMainMenu();
}
