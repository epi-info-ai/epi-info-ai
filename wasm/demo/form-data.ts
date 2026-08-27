import {
  validateProjectSnapshot,
  type EpiRecord,
  type FieldDefinition,
  type FieldType,
  type FormSchema,
  type HostedProjectReference,
  type ProjectForm,
  type ProjectSnapshotV1,
} from "../app/contracts/core.ts";
import type { MapDataSource } from "../app/contracts/maps.ts";
import type { FieldCheckCode, SafeCheckCodeStatement, SafeFieldAction } from "../app/contracts/check-code.ts";
import type { FieldValidationRule } from "../app/contracts/validation.ts";
import {
  createProjectPackage,
  MAX_PROJECT_PACKAGE_BYTES,
  parseProjectPackage,
  type LegacyMigrationPayload,
  type ProjectCodeTable,
  type ProjectProgram,
} from "../app/contracts/project-package.ts";
import {
  inferSchemaFromCsv,
  inferSchemaFromRows,
  normalizeFieldName,
  parseCsv,
  serializeCsv,
} from "../app/forms/csv.ts";
import { readTabularFile } from "../app/forms/importers.ts";
import {
  collectEntryRecord,
  initializeEntryView,
  renderEntryForm as renderEntryFormView,
  renderEntryValidation,
  renderRecords as renderRecordList,
  setEntryView,
} from "../app/forms/entry-view.ts";
import { loadProjectSnapshot } from "../app/forms/project-state.ts";
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

const FIELD_TYPES: FieldType[] = ["text", "text-uppercase", "multiline", "unique-id", "number", "phone", "date", "time", "checkbox", "yes-no", "option"];
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
let projectPackageExtras: {
  programs: ProjectProgram[];
  codeTables: ProjectCodeTable[];
  migration?: LegacyMigrationPayload;
} = { programs: [], codeTables: [] };
let projectState: ProjectSnapshotV1 = loadedProject.snapshot ?? {
    name: projectName,
    currentFormId: "form-default",
    forms: [{ id: "form-default", schema: structuredClone(schema), records: structuredClone(records) }],
  };
projectName = projectState.name;
let currentFormId = projectState.currentFormId || projectState.forms[0]!.id;
const initialForm = projectState.forms.find((form) => form.id === currentFormId) ?? projectState.forms[0]!;
schema = structuredClone(initialForm.schema);
records = structuredClone(initialForm.records || []);
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

function syncCurrentForm() {
  const current = projectState.forms.find((form) => form.id === currentFormId);
  const snapshot = { id: currentFormId, schema: structuredClone(schema), records: structuredClone(records) };
  if (current) Object.assign(current, snapshot);
  else projectState.forms.push(snapshot);
  projectState.name = projectName;
  projectState.currentFormId = currentFormId;
  saveJson(PROJECT_STATE_KEY, projectState);
  saveText(PROJECT_KEY, projectName);
  saveJson(SCHEMA_KEY, schema);
  saveJson(RECORDS_KEY, records);
}

export function getCurrentProjectData(): MapDataSource {
  return {
    formId: currentFormId,
    projectName,
    formName: schema.name,
    fields: structuredClone(schema.fields),
    records: structuredClone(records),
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
  }));
}

export function getCurrentProjectSnapshot(): ProjectSnapshotV1 {
  syncCurrentForm();
  return structuredClone(projectState);
}

export function markCurrentProjectSynced(remote: HostedProjectReference): void {
  projectState.storage = { type: "supabase" };
  projectState.remote = structuredClone(remote);
  syncCurrentForm();
  renderStorageBadge();
}

export function applyHostedProjectSnapshot(snapshot: unknown, remote: HostedProjectReference): void {
  projectState = validateProjectSnapshot(snapshot);
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
  syncCurrentForm();
  renderDesigner();
  renderEntryForm();
  renderRecords();
  renderStorageBadge();
  requiredElement("#form-status").textContent = issues.length > 0
    ? `Project opened with ${issues.length} saved-record validation issue${issues.length === 1 ? "" : "s"}. Open Enter Data > Data Quality to review.`
    : "Project opened and its saved records passed validation.";
}

export function showRecordInEnter(formId: string, recordIndex: number): boolean {
  const selectedForm = projectState.forms.find((form) => form.id === formId);
  if (!selectedForm || !Number.isInteger(recordIndex) || !selectedForm.records?.[recordIndex]) return false;

  if (formId !== currentFormId) {
    syncCurrentForm();
    currentFormId = formId;
    schema = structuredClone(selectedForm.schema);
    records = structuredClone(selectedForm.records || []);
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
  const count = rules.length + (checkCode.after?.length ?? 0);
  button.textContent = count > 0 ? `Rules (${count})` : "Rules...";
}

function openFieldRules(row: HTMLTableRowElement): void {
  activeRulesRow = row;
  const rules = JSON.parse(row.dataset.rules || "[]") as FieldValidationRule[];
  const checkCode = JSON.parse(row.dataset.checkCode || "{}") as FieldCheckCode;
  const range = rules.find((rule) => rule.kind === "range");
  const legal = rules.find((rule) => rule.kind === "legal-values");
  const pattern = rules.find((rule) => rule.kind === "pattern");
  const calculatedAge = rules.find((rule) => rule.kind === "calculated-age");
  const statement = checkCode.after?.[0];
  const fieldName = normalizeFieldName(requiredControl(row, '[data-part="name"]').value);
  requiredElement("#field-rules-name").textContent = fieldName || "unnamed field";
  requiredElement("#field-rule-unique").checked = rules.some((rule) => rule.kind === "unique");
  requiredElement("#field-rule-lower").value = range?.min === undefined ? "" : String(range.min);
  requiredElement("#field-rule-upper").value = range?.max === undefined ? "" : String(range.max);
  requiredElement("#field-rule-legal-values").value = legal?.values.join("\n") ?? "";
  requiredElement("#field-rule-comment-legal").checked = legal?.allowComment ?? false;
  requiredElement("#field-rule-pattern").value = pattern?.pattern ?? "";
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
  requiredElement("#field-rules-status").textContent = "";
  updateSkipRuleControls();
  requiredElement<HTMLDialogElement>("#field-rules-dialog").showModal();
}

function saveFieldRules(): void {
  if (!activeRulesRow) return;
  const row = activeRulesRow;
  const previousRules = row.dataset.rules ?? "[]";
  const previousCheckCode = row.dataset.checkCode ?? "{}";
  const rules: FieldValidationRule[] = [];
  if (requiredElement("#field-rule-unique").checked) rules.push({ kind: "unique" });
  const lower = requiredElement("#field-rule-lower").value.trim();
  const upper = requiredElement("#field-rule-upper").value.trim();
  if (lower || upper) {
    const type = requiredControl(row, '[data-part="type"]').value;
    if (type !== "number" && type !== "date") throw new Error("Ranges are available only for Number and Date fields.");
    const range: FieldValidationRule = { kind: "range", valueType: type };
    if (lower) range.min = type === "number" ? Number(lower) : lower;
    if (upper) range.max = type === "number" ? Number(upper) : upper;
    rules.push(range);
  }
  const values = requiredElement("#field-rule-legal-values").value.split(/\r?\n/).map((value: string) => value.trim()).filter(Boolean);
  if (values.length > 0) rules.push({
    kind: "legal-values",
    values,
    allowComment: requiredElement("#field-rule-comment-legal").checked,
  });
  const pattern = requiredElement("#field-rule-pattern").value.trim();
  if (pattern) {
    new RegExp(pattern);
    rules.push({ kind: "pattern", pattern });
  }
  const ageSource = requiredElement<HTMLSelectElement>("#field-rule-age-source").value;
  if (ageSource) {
    if (requiredControl(row, '[data-part="type"]').value !== "number") throw new Error("Calculated age is available only for Number fields.");
    const asOfDateField = requiredElement<HTMLSelectElement>("#field-rule-age-as-of").value;
    rules.push({ kind: "calculated-age", sourceDateField: ageSource, ...(asOfDateField ? { asOfDateField } : {}) });
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
    date: "Date", time: "Time", checkbox: "Checkbox", "yes-no": "Yes / No", option: "Option",
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
    for (const value of [field.prompt, field.present, field.missing, `${(field.completeness * 100).toFixed(1)}%`, field.violations]) {
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

function saveProjectPackage(): void {
  syncCurrentForm();
  const packageValue = createProjectPackage(projectState, projectPackageExtras);
  const blob = new Blob([`${JSON.stringify(packageValue, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${safeFileStem(projectName)}.epia.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  requiredElement("#main-menu-status").textContent = `Saved ${projectName} as a portable Epi Info AI project package.`;
}

async function openProjectPackage(file: File): Promise<void> {
  if (file.size > MAX_PROJECT_PACKAGE_BYTES) {
    throw new Error(`Project packages are limited to ${Math.round(MAX_PROJECT_PACKAGE_BYTES / 1024 / 1024)} MB in this prototype.`);
  }
  const packageValue = parseProjectPackage(await file.text());
  projectPackageExtras = {
    programs: structuredClone(packageValue.programs),
    codeTables: structuredClone(packageValue.codeTables),
  };
  if (packageValue.migration !== undefined) projectPackageExtras.migration = structuredClone(packageValue.migration);
  applyLocalProjectSnapshot(packageValue.project);
  const legacySummary = packageValue.migration
    ? ` Migrated inventory: ${packageValue.migration.inventory.forms} forms, ${packageValue.migration.inventory.pages} pages, ${packageValue.migration.inventory.fields} fields.`
    : "";
  requiredElement("#main-menu-status").textContent = `Opened ${packageValue.project.name}.${legacySummary}`;
  requiredElement("#form-status").textContent = `Opened ${packageValue.project.name} with ${packageValue.programs.length} program${packageValue.programs.length === 1 ? "" : "s"} and ${packageValue.codeTables.length} code table${packageValue.codeTables.length === 1 ? "" : "s"}.${legacySummary}`;
}

async function importDataFile(file: File): Promise<void> {
  const importedFile = await readTabularFile(file);
  const rows = importedFile.rows;
  const headers = rows[0]!.map((header) => normalizeFieldName(header));
  const expected = schema.fields.map((field) => field.name);
  const missing = expected.filter((name) => !headers.includes(name));
  if (missing.length > 0) throw new Error(`Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);

  const imported = rows.slice(1).map((cells) => materializeCalculatedFields(schema, Object.fromEntries(
    expected.map((name) => [name, cells[headers.indexOf(name)] ?? ""]),
  )));
  const validationIssues = validateRecords(currentFormId, schema, imported, records);
  const errors = validationIssues.filter((issue) => issue.severity === "error");
  if (errors.length > 0) {
    throw new Error(`Import validation found ${errors.length} error${errors.length === 1 ? "" : "s"}. ${errors[0]!.message}`);
  }
  records.push(...imported);
  syncCurrentForm();
  renderRecords();
  requiredElement("#csv-status").textContent = `Imported ${imported.length} record${imported.length === 1 ? "" : "s"} from ${file.name}.`;
}

async function createFormFromDataFile(file: File, importRows: boolean): Promise<{ fields: number; rows: number; importedRows: boolean; persisted: boolean }> {
  const importedFile = await readTabularFile(file);
  const inferred = inferSchemaFromRows(file.name, importedFile.rows);
  schema = inferred.schema;
  if (importRows) {
    records = inferred.records;
  }
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
  requiredElement("#snap-to-grid").checked = snapToGrid;
  renderDesigner();
  renderEntryForm();
  renderRecords();
  renderStorageBadge();
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

  requiredElement("#file-open-project").addEventListener("click", () => requiredElement<HTMLInputElement>("#project-package-open").click());
  requiredElement("#file-save-project").addEventListener("click", saveProjectPackage);
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
    storageEngine.value = projectState.storage?.type === "supabase" ? "supabase" : "browser";
    updateStorageDialog();
    projectDialog.showModal();
  });
  storageEngine.addEventListener("change", updateStorageDialog);
  for (const closeButton of requiredElements("[data-close-project-dialog]")) {
    closeButton.addEventListener("click", () => projectDialog.close("cancel"));
  }
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
    if (records.length > 0 && !window.confirm("Create a new project and remove the current locally saved demo records?")) return;
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
    projectName = requiredElement("#database-name").value.trim() || "Untitled Project";
    schema = { name: "New Form", fields: [] };
    records = [];
    currentFormId = newFormId();
    projectState = {
      name: projectName,
      currentFormId,
      storage: { type: storageType },
      forms: [{ id: currentFormId, schema: structuredClone(schema), records: [] }],
    };
    projectPackageExtras = { programs: [], codeTables: [] };
    syncCurrentForm();
    renderDesigner();
    renderEntryForm();
    renderRecords();
    renderStorageBadge();
    projectDialog.close("create");
    requiredElement("#form-status").textContent = storageType === "supabase"
      ? `${projectName} created with a verified Supabase connection and local working copy.`
      : `${projectName} created.`;
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
  requiredElement("#csv-import").addEventListener("change", async (event) => {
    const target = eventControl(event);
    const file = target.files?.[0];
    if (!file) return;
    requiredElement("#csv-status").textContent = `Importing ${file.name}...`;
    try {
      await importDataFile(file);
    } catch (error) {
      requiredElement("#csv-status").textContent = error instanceof Error ? error.message : "Unable to import this data file.";
    } finally {
      target.value = "";
    }
  });

  showMainMenu();
}
