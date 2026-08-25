const SCHEMA_KEY = "epi-info-ai.form-schema.v1";
const RECORDS_KEY = "epi-info-ai.records.v1";
const PROJECT_KEY = "epi-info-ai.project-name.v1";
const PROJECT_STATE_KEY = "epi-info-ai.project-state.v1";
const SNAP_KEY = "epi-info-ai.snap-to-grid.v1";
const SUPABASE_CONFIG_KEY = "epi-info-ai.supabase-config.v1";
const GRID_SIZE = 12;

const FIELD_TYPES = ["text", "text-uppercase", "multiline", "unique-id", "number", "phone", "date", "time", "checkbox", "yes-no", "option"];
const DEFAULT_SCHEMA = {
  name: "Outbreak Case Report Form",
  fields: [
    { name: "case_id", prompt: "Case ID", type: "text", required: true },
    { name: "onset_date", prompt: "Onset date", type: "date", required: false },
    { name: "ill", prompt: "Ill", type: "yes-no", required: true },
    { name: "exposure", prompt: "Primary exposure", type: "text", required: false },
    { name: "age", prompt: "Age", type: "number", required: false },
  ],
};

let schema = loadJson(SCHEMA_KEY, DEFAULT_SCHEMA);
let records = loadJson(RECORDS_KEY, []);
let projectName = loadText(PROJECT_KEY, "Browser Project");
let snapToGrid = loadText(SNAP_KEY, "true") !== "false";
let projectState = loadJson(PROJECT_STATE_KEY, null);
if (!projectState?.forms?.length) {
  projectState = {
    name: projectName,
    currentFormId: "form-default",
    forms: [{ id: "form-default", schema: structuredClone(schema), records: structuredClone(records) }],
  };
}
projectName = projectState.name;
let currentFormId = projectState.currentFormId || projectState.forms[0].id;
const initialForm = projectState.forms.find((form) => form.id === currentFormId) || projectState.forms[0];
schema = structuredClone(initialForm.schema);
records = structuredClone(initialForm.records || []);

function loadJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadText(key, fallback) {
  try {
    return localStorage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

function saveText(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function normalizeSupabaseUrl(value) {
  const url = new URL(String(value || "").trim());
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("Supabase connections must use HTTPS.");
  }
  return url.origin;
}

export async function testSupabaseConnection(urlValue, publishableKeyValue) {
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
  const settings = await response.json();
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
  const badge = document.querySelector("#data-storage-badge");
  if (!badge) return;
  badge.textContent = projectState.storage?.type === "supabase"
    ? "Supabase connected - local working copy"
    : "Local browser data";
}

function newFormId() {
  return globalThis.crypto?.randomUUID?.() || `form-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function alignToGrid(value, gridSize = GRID_SIZE) {
  return Math.round(value / gridSize) * gridSize;
}

function snapCoordinate(value) {
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

export function getCurrentProjectData() {
  return {
    formId: currentFormId,
    projectName,
    formName: schema.name,
    fields: structuredClone(schema.fields),
    records: structuredClone(records),
  };
}

export function getProjectDataSources() {
  syncCurrentForm();
  return projectState.forms.map((form) => ({
    formId: form.id,
    projectName,
    formName: form.schema.name,
    fields: structuredClone(form.schema.fields),
    records: structuredClone(form.records || []),
  }));
}

export function getCurrentProjectSnapshot() {
  syncCurrentForm();
  return structuredClone(projectState);
}

export function markCurrentProjectSynced(remote) {
  projectState.storage = { type: "supabase" };
  projectState.remote = structuredClone(remote);
  syncCurrentForm();
  renderStorageBadge();
}

export function applyHostedProjectSnapshot(snapshot, remote) {
  if (!snapshot?.forms?.length) throw new Error("The hosted project snapshot does not contain any forms.");
  projectState = structuredClone(snapshot);
  projectState.storage = { type: "supabase" };
  projectState.remote = structuredClone(remote);
  projectName = projectState.name || "Hosted Project";
  currentFormId = projectState.currentFormId || projectState.forms[0].id;
  const selectedForm = projectState.forms.find((form) => form.id === currentFormId) || projectState.forms[0];
  currentFormId = selectedForm.id;
  schema = structuredClone(selectedForm.schema);
  records = structuredClone(selectedForm.records || []);
  syncCurrentForm();
  renderDesigner();
  renderEntryForm();
  renderRecords();
  renderStorageBadge();
}

export function showRecordInEnter(formId, recordIndex) {
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
  const record = records[recordIndex];
  const form = document.querySelector("#record-form");
  for (const field of schema.fields) {
    const control = form.elements.namedItem(field.name);
    if (!control) continue;
    if (control.type === "checkbox") control.checked = [true, "true", "1", "Yes"].includes(record[field.name]);
    else control.value = record[field.name] ?? "";
  }
  document.querySelector("#new-record-title").textContent = `Record ${recordIndex + 1}`;
  document.querySelector("#record-status").textContent = "Opened from Maps. This demo displays the record in the entry form.";
  return true;
}

function readFileText(file) {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Unable to read the CSV file.")));
    reader.readAsText(file);
  });
}

async function readCsvText(file) {
  if (!/\.csv$/i.test(file.name)) {
    if (/\.xlsx?$/i.test(file.name)) {
      throw new Error("This is an Excel workbook, not a CSV file. In Excel, use Save As and choose CSV UTF-8, then upload that .csv file.");
    }
    throw new Error("Choose a file whose name ends in .csv.");
  }

  if (typeof file.arrayBuffer !== "function") {
    const text = await readFileText(file);
    if (text.startsWith("PK\u0003\u0004") || text.includes("\u0000")) {
      throw new Error("This appears to be a binary spreadsheet, not a CSV text file. Save it as CSV UTF-8 and try again.");
    }
    return text;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    throw new Error("This appears to be an Excel .xlsx workbook, not a CSV file. Save it as CSV UTF-8 and try again.");
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return new TextDecoder("utf-8").decode(bytes);
}

function normalizeFieldName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
}

function fieldPrompt(header) {
  const words = header.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  const prompt = words ? words[0].toUpperCase() + words.slice(1) : "Field";
  return prompt.replace(/\b(id|dob|ssn)\b/gi, (word) => word.toUpperCase());
}

function inferFieldType(name, values) {
  const populated = values.map((value) => value.trim()).filter(Boolean);
  if (populated.length === 0) return "text";
  if (/(_id|^id$|code|zip|postal)/i.test(name)) return "text";
  if (populated.every((value) => /^(yes|no|unknown)$/i.test(value))) return "yes-no";
  if (populated.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) return "date";
  if (populated.every((value) => value !== "" && Number.isFinite(Number(value)))) return "number";
  return "text";
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(schemaDefinition, dataRecords) {
  const headers = schemaDefinition.fields.map((field) => field.name);
  const lines = [headers.map(escapeCsv).join(",")];
  for (const record of dataRecords) {
    lines.push(headers.map((header) => escapeCsv(record[header])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        value += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value.replace(/\r$/, ""));
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }
  row.push(value.replace(/\r$/, ""));
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

export function inferSchemaFromCsv(fileName, rows) {
  if (rows.length === 0 || rows[0].length === 0) throw new Error("The CSV file is empty.");
  const headers = rows[0].map((header) => header.replace(/^\ufeff/, "").trim());
  const columnCount = Math.max(...rows.map((row) => row.length));
  const columns = Array.from({ length: columnCount }, (_, index) => ({
    index,
    header: headers[index] ?? "",
    hasData: rows.slice(1).some((row) => String(row[index] ?? "").trim() !== ""),
  })).filter((column) => column.header || column.hasData);
  if (columns.length === 0) throw new Error("The CSV file has no usable columns.");

  const usedNames = new Set();
  const fields = columns.map((column) => {
    const header = column.header || `Field ${column.index + 1}`;
    const baseName = normalizeFieldName(header) || `field_${column.index + 1}`;
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name)) {
      name = `${baseName}_${suffix}`;
      suffix += 1;
    }
    usedNames.add(name);
    return {
      name,
      prompt: fieldPrompt(header),
      type: inferFieldType(name, rows.slice(1).map((row) => row[column.index] ?? "")),
      required: false,
    };
  });

  const baseFileName = fileName.replace(/\.csv$/i, "").replace(/[_-]+/g, " ").trim();
  const formName = (baseFileName || "Imported")
    .split(/\s+/)
    .map((word) => fieldPrompt(word))
    .join(" ") + " Form";
  const dataRecords = rows.slice(1).map((row) => Object.fromEntries(
    fields.map((field, fieldIndex) => [field.name, row[columns[fieldIndex].index] ?? ""]),
  ));
  return { schema: { name: formName, fields }, records: dataRecords };
}

function schemaFromDesigner() {
  const fields = [...document.querySelectorAll("#field-list tr")].map((row) => ({
    name: normalizeFieldName(row.querySelector('[data-part="name"]').value),
    prompt: row.querySelector('[data-part="prompt"]').value.trim(),
    type: row.querySelector('[data-part="type"]').value,
    required: row.querySelector('[data-part="required"]').checked,
    x: row.dataset.x === "" ? undefined : Number(row.dataset.x),
    y: row.dataset.y === "" ? undefined : Number(row.dataset.y),
  }));
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
    name: document.querySelector("#form-name").value.trim() || "Untitled form",
    fields,
  };
}

function fieldRow(field = { name: "new_field", prompt: "New field", type: "text", required: false }) {
  const row = document.createElement("tr");
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
    option.textContent = type === "yes-no" ? "Yes / No" : type[0].toUpperCase() + type.slice(1);
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
  return row;
}

function renderDesigner() {
  document.querySelector("#form-name").value = schema.name;
  const list = document.querySelector("#field-list");
  list.replaceChildren(...schema.fields.map((field) => fieldRow(field)));
  renderProjectTree();
  renderCanvas();
}

function renderProjectTree() {
  document.querySelector("#project-tree-name").textContent = `▾ ${projectName}`;
  const formList = document.querySelector("#form-tree-list");
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

function canvasControl(field) {
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
  const canvasFields = document.querySelector("#canvas-fields");
  const items = schema.fields.map((field, index) => {
    const item = document.createElement("div");
    item.className = "canvas-field";
    item.dataset.fieldIndex = String(index);
    const x = Number.isFinite(field.x) ? field.x : 36;
    const y = Number.isFinite(field.y) ? field.y : 30 + index * 52;
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

      const move = (moveEvent) => {
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
        document.querySelector("#form-status").textContent = snapToGrid
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

function fieldFromPalette(type, x, y) {
  const labels = {
    text: "Text field", "text-uppercase": "Uppercase text", multiline: "Notes",
    "unique-id": "Unique identifier", number: "Number", phone: "Phone number",
    date: "Date", time: "Time", checkbox: "Checkbox", "yes-no": "Yes / No", option: "Option",
  };
  const baseName = normalizeFieldName(labels[type] || "New field");
  const used = new Set(schema.fields.map((field) => field.name));
  let name = baseName;
  let suffix = 2;
  while (used.has(name)) name = `${baseName}_${suffix++}`;
  return { name, prompt: labels[type] || "New field", type, required: false, x, y };
}

function entryControl(field) {
  const wrapper = document.createElement("label");
  wrapper.className = "record-field";
  wrapper.textContent = field.prompt;
  const control = field.type === "yes-no" || field.type === "option"
    ? document.createElement("select")
    : field.type === "multiline"
      ? document.createElement("textarea")
      : document.createElement("input");
  control.name = field.name;
  control.required = field.required;

  if (field.type === "yes-no") {
    for (const [value, label] of [["", "Select"], ["Yes", "Yes"], ["No", "No"], ["Unknown", "Unknown"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      control.append(option);
    }
  } else if (field.type === "option") {
    for (const [value, label] of [["", "Select"], ["Option 1", "Option 1"], ["Option 2", "Option 2"]]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      control.append(option);
    }
  } else if (control instanceof HTMLInputElement) {
    control.type = ["number", "date", "time", "checkbox"].includes(field.type) ? field.type : "text";
    if (field.type === "number") control.step = "any";
    if (field.type === "text-uppercase") control.addEventListener("input", () => { control.value = control.value.toUpperCase(); });
  }
  wrapper.append(control);
  return wrapper;
}

function renderEntryForm() {
  document.querySelector("#data-title").textContent = schema.name;
  document.querySelector("#record-fields").replaceChildren(...schema.fields.map(entryControl));
}

function renderRecords() {
  document.querySelector("#record-count").textContent = `(${records.length})`;
  const headerRow = document.createElement("tr");
  for (const field of schema.fields) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = field.prompt;
    headerRow.append(cell);
  }
  document.querySelector("#records-head").replaceChildren(headerRow);

  const body = document.querySelector("#records-body");
  if (records.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = Math.max(1, schema.fields.length);
    cell.className = "empty-state";
    cell.textContent = "No records yet. Save a record or import a CSV file.";
    row.append(cell);
    body.replaceChildren(row);
    return;
  }
  body.replaceChildren(...records.map((record) => {
    const row = document.createElement("tr");
    for (const field of schema.fields) {
      const cell = document.createElement("td");
      cell.textContent = record[field.name] ?? "";
      row.append(cell);
    }
    return row;
  }));
}

function showModule(name) {
  document.querySelector("#main-menu").hidden = true;
  document.querySelector(".app-shell").hidden = false;
  for (const view of document.querySelectorAll("[data-module-view]")) {
    view.hidden = view.dataset.moduleView !== name;
  }
  for (const button of document.querySelectorAll("[data-module]")) {
    const active = button.dataset.module === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}

function showMainMenu() {
  document.querySelector("#main-menu").hidden = false;
  document.querySelector(".app-shell").hidden = true;
  document.querySelector("#main-menu-status").textContent = "Ready";
}

function exportCsv() {
  const blob = new Blob([`\ufeff${serializeCsv(schema, records)}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${normalizeFieldName(schema.name) || "epi_info_ai_data"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  document.querySelector("#csv-status").textContent = `Exported ${records.length} record${records.length === 1 ? "" : "s"}.`;
}

async function importCsv(file) {
  const rows = parseCsv(await readCsvText(file));
  if (rows.length === 0) throw new Error("The CSV file is empty.");
  const headers = rows[0].map((header) => normalizeFieldName(header));
  const expected = schema.fields.map((field) => field.name);
  const missing = expected.filter((name) => !headers.includes(name));
  if (missing.length > 0) throw new Error(`Missing column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);

  const imported = rows.slice(1).map((cells) => Object.fromEntries(
    expected.map((name) => [name, cells[headers.indexOf(name)] ?? ""]),
  ));
  records.push(...imported);
  syncCurrentForm();
  renderRecords();
  document.querySelector("#csv-status").textContent = `Imported ${imported.length} record${imported.length === 1 ? "" : "s"} from ${file.name}.`;
}

async function createFormFromCsv(file, importRows) {
  const rows = parseCsv(await readCsvText(file));
  const inferred = inferSchemaFromCsv(file.name, rows);
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
  document.querySelector("#snap-to-grid").checked = snapToGrid;
  renderDesigner();
  renderEntryForm();
  renderRecords();
  renderStorageBadge();

  for (const button of document.querySelectorAll("[data-module]")) {
    button.addEventListener("click", () => showModule(button.dataset.module));
  }

  for (const button of document.querySelectorAll("[data-open-module]")) {
    button.addEventListener("click", () => showModule(button.dataset.openModule));
  }

  document.querySelector("#main-menu-button").addEventListener("click", showMainMenu);
  for (const button of document.querySelectorAll("[data-menu-message]")) {
    button.addEventListener("click", () => {
      document.querySelector("#main-menu-status").textContent = button.dataset.menuMessage;
    });
  }

  document.querySelector("#add-field").addEventListener("click", () => {
    try {
      schema = schemaFromDesigner();
    } catch {
      // Keep the current in-memory schema if another row is mid-edit.
    }
    schema.fields.push(fieldFromPalette("text", snapCoordinate(36), snapCoordinate(30 + schema.fields.length * 52)));
    renderDesigner();
  });

  document.querySelector("#field-list").addEventListener("input", () => {
    try {
      schema = schemaFromDesigner();
      renderCanvas();
      renderProjectTree();
    } catch {
      // Partial edits are allowed until Save Form performs full validation.
    }
  });

  document.querySelector("#form-name").addEventListener("input", (event) => {
    schema.name = event.target.value || "Untitled Form";
    renderProjectTree();
  });

  for (const fieldType of document.querySelectorAll("#field-palette [data-field-type]")) {
    fieldType.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/x-epi-field-type", fieldType.dataset.fieldType);
      event.dataTransfer.effectAllowed = "copy";
    });
    fieldType.addEventListener("click", () => {
      schema.fields.push(fieldFromPalette(fieldType.dataset.fieldType, snapCoordinate(36), snapCoordinate(30 + schema.fields.length * 52)));
      renderDesigner();
      document.querySelector("#form-status").textContent = `${fieldType.textContent.trim()} added to the canvas.`;
    });
  }

  const formCanvas = document.querySelector("#form-canvas");
  formCanvas.addEventListener("dragover", (event) => {
    event.preventDefault();
    formCanvas.classList.add("drag-target");
  });
  formCanvas.addEventListener("dragleave", () => formCanvas.classList.remove("drag-target"));
  formCanvas.addEventListener("drop", (event) => {
    event.preventDefault();
    formCanvas.classList.remove("drag-target");
    const bounds = formCanvas.getBoundingClientRect();
    const x = snapCoordinate(Math.max(8, event.clientX - bounds.left + formCanvas.scrollLeft - 145));
    const y = snapCoordinate(Math.max(8, event.clientY - bounds.top + formCanvas.scrollTop - 18));
    const fieldIndex = event.dataTransfer.getData("application/x-epi-field-index");
    const fieldType = event.dataTransfer.getData("application/x-epi-field-type");
    if (fieldIndex !== "" && schema.fields[Number(fieldIndex)]) {
      schema.fields[Number(fieldIndex)].x = x;
      schema.fields[Number(fieldIndex)].y = y;
    } else if (fieldType) {
      schema.fields.push(fieldFromPalette(fieldType, x, y));
    }
    renderDesigner();
  });

  document.querySelector("#snap-to-grid").addEventListener("change", (event) => {
    snapToGrid = event.target.checked;
    saveText(SNAP_KEY, String(snapToGrid));
    if (snapToGrid) {
      for (const field of schema.fields) {
        if (Number.isFinite(field.x)) field.x = snapCoordinate(field.x);
        if (Number.isFinite(field.y)) field.y = snapCoordinate(field.y);
      }
    }
    renderCanvas();
    document.querySelector("#form-status").textContent = snapToGrid
      ? `Snap to Grid enabled (${GRID_SIZE}px).`
      : "Snap to Grid disabled; fields can be placed freely.";
  });

  const projectDialog = document.querySelector("#project-dialog");
  const storageEngine = document.querySelector("#storage-engine");
  const supabaseSettings = document.querySelector("#supabase-settings");
  const supabaseUrl = document.querySelector("#supabase-url");
  const supabasePublishableKey = document.querySelector("#supabase-publishable-key");
  const projectDialogNote = document.querySelector("#project-dialog-note");

  function updateStorageDialog() {
    const usesSupabase = storageEngine.value === "supabase";
    supabaseSettings.hidden = !usesSupabase;
    supabaseUrl.required = usesSupabase;
    supabasePublishableKey.required = usesSupabase;
    document.querySelector("#local-storage-access").checked = !usesSupabase;
    document.querySelector("#supabase-storage-access").disabled = !usesSupabase;
    document.querySelector("#supabase-storage-access").checked = usesSupabase;
    projectDialogNote.textContent = usesSupabase
      ? "Test verifies the Supabase Data API. Records remain local until authentication, tables, and Row Level Security policies are installed."
      : "Data remains on this device. Server synchronization is not part of this demo.";
  }

  document.querySelector("#new-project").addEventListener("click", () => {
    const savedSupabase = loadJson(SUPABASE_CONFIG_KEY, {});
    supabaseUrl.value = savedSupabase.url || "";
    supabasePublishableKey.value = savedSupabase.publishableKey || "";
    storageEngine.value = projectState.storage?.type === "supabase" ? "supabase" : "browser";
    updateStorageDialog();
    projectDialog.showModal();
  });
  storageEngine.addEventListener("change", updateStorageDialog);
  for (const closeButton of document.querySelectorAll("[data-close-project-dialog]")) {
    closeButton.addEventListener("click", () => projectDialog.close("cancel"));
  }
  document.querySelector("#test-store").addEventListener("click", async (event) => {
    if (storageEngine.value === "browser") {
      projectDialogNote.textContent = "Local browser storage is available. No server connection is required.";
      return;
    }
    const button = event.currentTarget;
    button.disabled = true;
    projectDialogNote.textContent = "Testing the Supabase Data API connection...";
    try {
      const config = await testSupabaseConnection(supabaseUrl.value, supabasePublishableKey.value);
      saveJson(SUPABASE_CONFIG_KEY, config);
      projectDialogNote.textContent = "Connected to Supabase. The project URL and publishable key are valid.";
    } catch (error) {
      projectDialogNote.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
  document.querySelector("#project-dialog-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (records.length > 0 && !window.confirm("Create a new project and remove the current locally saved demo records?")) return;
    const storageType = storageEngine.value;
    if (storageType === "supabase") {
      projectDialogNote.textContent = "Verifying Supabase before creating the local working copy...";
      try {
        const config = await testSupabaseConnection(supabaseUrl.value, supabasePublishableKey.value);
        saveJson(SUPABASE_CONFIG_KEY, config);
      } catch (error) {
        projectDialogNote.textContent = error.message;
        return;
      }
    }
    projectName = document.querySelector("#database-name").value.trim() || "Untitled Project";
    schema = { name: "New Form", fields: [] };
    records = [];
    currentFormId = newFormId();
    projectState = {
      name: projectName,
      currentFormId,
      storage: { type: storageType },
      forms: [{ id: currentFormId, schema: structuredClone(schema), records: [] }],
    };
    syncCurrentForm();
    renderDesigner();
    renderEntryForm();
    renderRecords();
    renderStorageBadge();
    projectDialog.close("create");
    document.querySelector("#form-status").textContent = storageType === "supabase"
      ? `${projectName} created with a verified Supabase connection and local working copy.`
      : `${projectName} created.`;
  });

  document.querySelector("#new-form").addEventListener("click", () => {
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
    document.querySelector("#form-status").textContent = "New form added to the project.";
  });

  document.querySelector("#restore-demo").addEventListener("click", () => {
    if (!window.confirm("Restore the example form and remove all locally saved demo records?")) return;
    schema = structuredClone(DEFAULT_SCHEMA);
    records = [];
    syncCurrentForm();
    renderDesigner();
    renderEntryForm();
    renderRecords();
    document.querySelector("#form-status").textContent = "Example form restored and demo records removed.";
    document.querySelector("#csv-form-status").textContent = "";
  });

  document.querySelector("#form-csv-import").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = document.querySelector("#csv-form-status");
    status.textContent = `Reading ${file.name}...`;
    try {
      const result = await createFormFromCsv(
        file,
        document.querySelector("#import-rows-with-form").checked,
      );
      const success = result.importedRows
        ? `Created ${result.fields} fields and imported ${result.rows} records from ${file.name}.`
        : `Created ${result.fields} fields from ${file.name}. Existing records were preserved.`;
      status.textContent = result.persisted
        ? success
        : `${success} This browser did not allow persistent storage, so the form lasts until the page is reloaded.`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = "";
    }
  });

  document.querySelector("#save-form").addEventListener("click", () => {
    const status = document.querySelector("#form-status");
    try {
      schema = schemaFromDesigner();
      syncCurrentForm();
      renderDesigner();
      renderEntryForm();
      renderRecords();
      status.textContent = "Form saved.";
    } catch (error) {
      status.textContent = error.message;
    }
  });

  document.querySelector("#record-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const record = Object.fromEntries(schema.fields.map((field) => [field.name, values.get(field.name) ?? ""]));
    records.push(record);
    syncCurrentForm();
    renderRecords();
    event.currentTarget.reset();
    document.querySelector("#new-record-title").textContent = "New record";
    document.querySelector("#record-status").textContent = "Record saved locally.";
  });

  document.querySelector("#reset-record").addEventListener("click", () => {
    document.querySelector("#new-record-title").textContent = "New record";
    document.querySelector("#record-status").textContent = "";
  });

  document.querySelector("#csv-export").addEventListener("click", exportCsv);
  document.querySelector("#csv-import").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importCsv(file);
    } catch (error) {
      document.querySelector("#csv-status").textContent = error.message;
    } finally {
      event.target.value = "";
    }
  });

  showMainMenu();
}
