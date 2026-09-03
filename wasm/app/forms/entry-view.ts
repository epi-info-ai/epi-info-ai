import type { EpiRecord, FieldDefinition, FormSchema } from "../contracts/core.js";
import type { SafeCheckCodeStatement, SafeGeocodeStatement, SafeGotoStatement } from "../contracts/check-code.js";
import type { FieldValidationIssue, FieldValidationRule, LegalValuesRule, PatternRule, RangeRule } from "../contracts/validation.js";
import { geocodeAddress, type GeocodeCandidate } from "./geocoding.ts";
import { initializeLocationPreview, openLocationPreview } from "./location-preview.ts";
import { materializeCalculatedFields } from "./validation.ts";

export type EntryView = "entry" | "records";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required Enter Data interface element is missing: ${selector}`);
  return element;
}

function rule<T extends FieldValidationRule>(field: FieldDefinition, kind: FieldValidationRule["kind"]): T | undefined {
  return field.rules?.find((candidate) => candidate.kind === kind) as T | undefined;
}

function appendOptions(select: HTMLSelectElement, values: readonly string[]): void {
  select.append(new Option("Select", ""), ...values.map((value) => new Option(value, value)));
}

function namedEntryControl(name: string): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null {
  const control = requiredElement<HTMLFormElement>("#record-form").elements.namedItem(name);
  return control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement
    ? control
    : null;
}

function acceptGeocodeCandidate(statement: SafeGeocodeStatement, candidate: GeocodeCandidate): void {
  const latitude = namedEntryControl(statement.latitudeField);
  const longitude = namedEntryControl(statement.longitudeField);
  if (!latitude || !longitude) throw new Error("The GEOCODE coordinate fields are unavailable.");
  latitude.value = candidate.latitude.toFixed(7);
  longitude.value = candidate.longitude.toFixed(7);
  latitude.dispatchEvent(new Event("input", { bubbles: true }));
  longitude.dispatchEvent(new Event("input", { bubbles: true }));
  requiredElement<HTMLDialogElement>("#geocode-results-dialog").close("accepted");
  requiredElement<HTMLElement>("#record-status").textContent = `Coordinates selected: ${latitude.value}, ${longitude.value}. Save the record to retain them.`;
}

function showGeocodeResults(statement: SafeGeocodeStatement, query: string, candidates: readonly GeocodeCandidate[]): void {
  requiredElement<HTMLElement>("#geocode-query").textContent = `Address: ${query}`;
  const list = requiredElement<HTMLElement>("#geocode-results-list");
  list.replaceChildren(...candidates.map((candidate) => {
    const item = document.createElement("article");
    item.className = "geocode-result";
    item.setAttribute("role", "listitem");
    const address = document.createElement("strong");
    address.textContent = candidate.formattedAddress;
    const details = document.createElement("span");
    details.textContent = `${candidate.confidence} confidence · ${candidate.quality} · ${candidate.latitude.toFixed(7)}, ${candidate.longitude.toFixed(7)}`;
    const select = document.createElement("button");
    select.type = "button";
    select.textContent = "Select";
    select.addEventListener("click", () => acceptGeocodeCandidate(statement, candidate));
    item.append(address, details, select);
    return item;
  }));
  requiredElement<HTMLElement>("#geocode-results-status").textContent = candidates.length === 0
    ? "No matching address was returned. Keep or enter coordinates manually, or try again when a configured geocoding service is available."
    : `${candidates.length} possible match${candidates.length === 1 ? "" : "es"}. Select one to accept its coordinates.`;
  requiredElement<HTMLDialogElement>("#geocode-results-dialog").showModal();
}

async function runGeocode(statement: SafeGeocodeStatement, button: HTMLButtonElement): Promise<void> {
  const address = namedEntryControl(statement.addressField)?.value.trim() ?? "";
  const status = requiredElement<HTMLElement>("#record-status");
  button.disabled = true;
  status.textContent = "Searching for possible address matches…";
  try {
    const candidates = await geocodeAddress(address);
    showGeocodeResults(statement, address, candidates);
    status.textContent = candidates.length > 0
      ? "Review the geocoding results and select the intended location."
      : "No address matches were returned; existing coordinates were not changed.";
  } catch (error) {
    status.textContent = `${error instanceof Error ? error.message : "The geocoding service is unavailable."} Existing coordinates were not changed; manual or imported coordinates can still be used.`;
  } finally {
    button.disabled = false;
  }
}

function conditionMatches(statement: SafeCheckCodeStatement, value: string): boolean {
  if (!statement.when) return true;
  const expected = String(statement.when.value ?? "");
  const candidate = statement.when.caseSensitive ? value : value.toLocaleLowerCase();
  const comparison = statement.when.caseSensitive ? expected : expected.toLocaleLowerCase();
  return statement.when.operator === "equals" ? candidate === comparison : candidate !== comparison;
}

export function resolveAfterGoto(field: FieldDefinition, value: string): string | undefined {
  return field.checkCode?.after?.find((statement): statement is SafeGotoStatement => statement.kind === "goto" && conditionMatches(statement, value))?.targetField;
}

export function resolveAfterActions(field: FieldDefinition, value: string): SafeCheckCodeStatement[] {
  return field.checkCode?.after?.filter((statement) => conditionMatches(statement, value)) ?? [];
}

function applyFieldAction(statement: Exclude<SafeCheckCodeStatement, SafeGotoStatement>): void {
  const target = requiredElement<HTMLFormElement>("#record-form").elements.namedItem(statement.targetField);
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
  const wrapper = target.closest<HTMLLabelElement>(".record-field");
  if (statement.action === "enable") target.disabled = false;
  else if (statement.action === "disable") target.disabled = true;
  else if (statement.action === "hide" && wrapper) {
    wrapper.hidden = true;
    if (!target.disabled) target.dataset.disabledByHide = "true";
    target.disabled = true;
  } else if (statement.action === "unhide" && wrapper) {
    wrapper.hidden = false;
    if (target.dataset.disabledByHide === "true") {
      target.disabled = false;
      delete target.dataset.disabledByHide;
    }
  }
  else if (statement.action === "set-required") target.required = true;
  else if (statement.action === "set-not-required") target.required = false;
}

function entryControl(field: FieldDefinition): HTMLElement {
  if (field.type === "command-button") {
    const wrapper = document.createElement("div");
    wrapper.className = "record-field record-command-field";
    const button = document.createElement("button");
    button.type = "button";
    button.name = field.name;
    button.textContent = field.prompt;
    const geocode = field.checkCode?.click?.find((statement) => statement.kind === "geocode");
    if (geocode) {
      const actions = document.createElement("div");
      actions.className = "record-command-actions";
      button.addEventListener("click", () => void runGeocode(geocode, button));
      const preview = document.createElement("button");
      preview.type = "button";
      preview.className = "location-preview-button";
      preview.textContent = "Preview Map";
      preview.addEventListener("click", () => openLocationPreview(geocode));
      actions.append(button, preview);
      wrapper.append(actions);
      return wrapper;
    }
    else button.disabled = true;
    wrapper.append(button);
    return wrapper;
  }
  const wrapper = document.createElement("label");
  wrapper.className = "record-field";
  wrapper.append(document.createTextNode(field.prompt));
  const control = field.type === "yes-no" || field.type === "option"
    ? document.createElement("select")
    : field.type === "multiline"
      ? document.createElement("textarea")
      : document.createElement("input");
  control.name = field.name;
  control.required = field.required || Boolean(rule(field, "required"));
  const calculatedAge = rule(field, "calculated-age");
  if (calculatedAge && control instanceof HTMLInputElement) {
    control.readOnly = true;
    control.dataset.calculated = "age";
    control.title = "Calculated automatically from configured date fields";
  }
  if (field.tabStop === false) {
    control.tabIndex = -1;
    control.dataset.tabStop = "disabled";
    control.title = "Tab stop disabled in Form Designer";
  }

  const legalValues = rule<LegalValuesRule>(field, "legal-values");
  if (field.type === "yes-no") {
    appendOptions(control as HTMLSelectElement, legalValues?.values ?? ["Yes", "No", "Unknown"]);
  } else if (field.type === "option") {
    appendOptions(control as HTMLSelectElement, legalValues?.values ?? ["Option 1", "Option 2"]);
  } else if (control instanceof HTMLInputElement) {
    control.type = ["number", "date", "time", "checkbox"].includes(field.type) ? field.type : "text";
    if (field.type === "number") control.step = "any";
    const coordinate = rule(field, "coordinate");
    if (field.type === "number" && coordinate?.kind === "coordinate") {
      control.step = "0.00001";
      control.inputMode = "decimal";
      control.placeholder = coordinate.axis === "latitude" ? "e.g. +41.65280" : "e.g. -83.53790";
      control.title = "Signed decimal degrees with at least five decimal places";
    }
    if (field.type === "text-uppercase") control.addEventListener("input", () => { control.value = control.value.toUpperCase(); });
    const range = rule<RangeRule>(field, "range");
    if (range?.min !== undefined) control.min = String(range.min);
    if (range?.max !== undefined) control.max = String(range.max);
    const pattern = rule<PatternRule>(field, "pattern");
    if (pattern && field.type !== "number" && field.type !== "date") control.pattern = pattern.pattern;
  }

  const error = document.createElement("span");
  error.id = `field-error-${field.name}`;
  error.className = "field-validation-message";
  error.setAttribute("aria-live", "polite");
  control.setAttribute("aria-describedby", error.id);
  control.addEventListener("focusout", () => {
    const value = control instanceof HTMLInputElement && control.type === "checkbox" ? String(control.checked) : control.value;
    const actions = resolveAfterActions(field, value);
    for (const statement of actions) {
      if (statement.kind === "field-action") applyFieldAction(statement);
    }
    const targetName = actions.find((statement): statement is SafeGotoStatement => statement.kind === "goto")?.targetField;
    const status = document.querySelector<HTMLElement>("#record-status");
    if (actions.some((statement) => statement.kind === "field-action") && status) {
      status.textContent = "Check Code updated field state.";
    }
    if (!targetName) return;
    globalThis.setTimeout(() => {
      const target = requiredElement<HTMLFormElement>("#record-form").elements.namedItem(targetName);
      if (target instanceof HTMLElement) {
        target.focus();
        const status = document.querySelector<HTMLElement>("#record-status");
        if (status) status.textContent = `Check Code moved to ${targetName}.`;
      }
    }, 0);
  });
  wrapper.append(control, error);
  return wrapper;
}

export function renderEntryForm(schema: FormSchema): void {
  requiredElement("#data-title").textContent = schema.name;
  requiredElement("#record-fields").replaceChildren(...schema.fields.map(entryControl));
  const form = requiredElement<HTMLFormElement>("#record-form");
  const refreshCalculations = (): void => {
    const calculated = materializeCalculatedFields(schema, collectEntryRecord(form, schema));
    for (const field of schema.fields) {
      if (!field.rules?.some((candidate) => candidate.kind === "calculated-age")) continue;
      const control = form.elements.namedItem(field.name);
      if (control instanceof HTMLInputElement) control.value = calculated[field.name] === null ? "" : String(calculated[field.name] ?? "");
    }
  };
  form.oninput = refreshCalculations;
  form.onchange = refreshCalculations;
  refreshCalculations();
}

export function renderRecords(schema: FormSchema, records: readonly EpiRecord[]): void {
  const dataFields = schema.fields.filter((field) => field.type !== "command-button");
  requiredElement("#record-count").textContent = `(${records.length})`;
  requiredElement("#mobile-record-count").textContent = `(${records.length})`;
  const headerRow = document.createElement("tr");
  for (const field of dataFields) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = field.prompt;
    headerRow.append(cell);
  }
  requiredElement("#records-head").replaceChildren(headerRow);

  const body = requiredElement("#records-body");
  if (records.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = Math.max(1, dataFields.length);
    cell.className = "empty-state";
    cell.textContent = "No records yet. Save a record or import a data file.";
    row.append(cell);
    body.replaceChildren(row);
    return;
  }
  body.replaceChildren(...records.map((record) => {
    const row = document.createElement("tr");
    for (const field of dataFields) {
      const cell = document.createElement("td");
      cell.textContent = String(record[field.name] ?? "");
      row.append(cell);
    }
    return row;
  }));
}

export function setEntryView(view: EntryView): void {
  requiredElement<HTMLElement>("#data-entry-grid").dataset.mobileView = view;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-entry-view]")) {
    button.setAttribute("aria-pressed", String(button.dataset.entryView === view));
  }
}

export function initializeEntryView(): void {
  initializeLocationPreview();
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-entry-view]")) {
    button.addEventListener("click", () => setEntryView(button.dataset.entryView === "records" ? "records" : "entry"));
  }
}

export function collectEntryRecord(form: HTMLFormElement, schema: FormSchema): EpiRecord {
  return Object.fromEntries(schema.fields.filter((field) => field.type !== "command-button").map((field) => {
    const control = form.elements.namedItem(field.name);
    if (control instanceof HTMLInputElement && control.type === "checkbox") return [field.name, control.checked];
    if (control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement) {
      return [field.name, control.value];
    }
    return [field.name, ""];
  }));
}

export function renderEntryValidation(issues: readonly FieldValidationIssue[]): void {
  for (const control of document.querySelectorAll<HTMLElement>("#record-fields [aria-invalid]")) control.removeAttribute("aria-invalid");
  for (const message of document.querySelectorAll<HTMLElement>("#record-fields .field-validation-message")) message.textContent = "";
  const byField = new Map<string, FieldValidationIssue[]>();
  for (const item of issues) byField.set(item.fieldName, [...(byField.get(item.fieldName) ?? []), item]);
  for (const [fieldName, fieldIssues] of byField) {
    const control = requiredElement<HTMLFormElement>("#record-form").elements.namedItem(fieldName);
    if (control instanceof HTMLElement) control.setAttribute("aria-invalid", "true");
    const message = document.getElementById(`field-error-${fieldName}`);
    if (message) message.textContent = fieldIssues.map((item) => item.message).join(" ");
  }
}
