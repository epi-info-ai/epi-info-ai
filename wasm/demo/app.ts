import { calculateTable2x2, deriveStratifiedTable2x2 } from "./engine.js";
import {
  applyHostedProjectSnapshot,
  getCurrentProjectSnapshot,
  getCurrentProjectData,
  getProjectDataSources,
  initializeFormDataDemo,
  markCurrentProjectSynced,
  showRecordInEnter,
  testSupabaseConnection,
} from "./form-data.js";
import { initializeMaps } from "./maps.js";
import { calculateStratifiedTable2x2InWorker } from "./stratified-worker-client.js";
import { initializeSupabaseSync } from "./supabase-sync.js";
import type { BoundaryInterval, BoundaryNumber, ConfidenceInterval, StratifiedTable2x2Input, Table2x2Input, Table2x2Result } from "../app/contracts/engine.js";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required application interface element is missing: ${selector}`);
  return element;
}

const form = requiredElement<HTMLFormElement>("#table-form");
const message = requiredElement<HTMLElement>("#form-message");
const warningBox = requiredElement<HTMLElement>("#warnings");
const warningList = requiredElement<HTMLUListElement>("#warning-list");
let lastResult: Table2x2Result | null = null;

const cells: Record<Exclude<keyof Table2x2Input, "confidenceLevel">, HTMLInputElement> = {
  exposedCases: requiredElement<HTMLInputElement>("#exposed-cases"),
  exposedNonCases: requiredElement<HTMLInputElement>("#exposed-controls"),
  unexposedCases: requiredElement<HTMLInputElement>("#unexposed-cases"),
  unexposedNonCases: requiredElement<HTMLInputElement>("#unexposed-controls"),
};

const outputIds = [
    "risk-ratio",
    "risk-ratio-ci",
    "odds-ratio",
    "odds-ratio-ci",
    "risk-difference",
    "risk-difference-ci",
    "fisher-exact",
    "mid-p-exact",
    "fisher-one-tailed",
    "fisher-two-tailed",
    "conditional-odds-ratio",
    "conditional-odds-ratio-fisher-ci",
    "conditional-odds-ratio-mid-p-ci",
    "pearson-value",
    "pearson-p",
    "mantel-value",
    "mantel-p",
    "yates-value",
    "yates-p",
    "plain-interpretation",
    "calculation-time",
  ] as const;
type OutputId = typeof outputIds[number];
const output = Object.fromEntries(
  outputIds.map((id) => [id, requiredElement<HTMLElement>(`#${id}`)]),
) as Record<OutputId, HTMLElement>;

function parseInput(): Table2x2Input {
  return {
    exposedCases: Number(cells.exposedCases.value),
    exposedNonCases: Number(cells.exposedNonCases.value),
    unexposedCases: Number(cells.unexposedCases.value),
    unexposedNonCases: Number(cells.unexposedNonCases.value),
    confidenceLevel: Number(requiredElement<HTMLSelectElement>("#confidence-level").value),
  };
}

function number(value: number | null, digits = 2): string {
  if (value === null || !Number.isFinite(value)) return "Undefined";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function pValue(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Undefined";
  if (value < 0.0001) return "< 0.0001";
  return value.toFixed(4);
}

function confidenceLabel(level: number, interval: ConfidenceInterval | null, percent = false): string {
  if (!interval) return `${Math.round(level * 100)}% CI unavailable`;
  const multiplier = percent ? 100 : 1;
  const suffix = percent ? "%" : "";
  return `${Math.round(level * 100)}% CI ${number(interval.lower * multiplier, percent ? 1 : 2)}${suffix}–${number(interval.upper * multiplier, percent ? 1 : 2)}${suffix}`;
}

function boundaryLabel(result: BoundaryNumber): string {
  if (result.state === "positive-infinity") return "Infinity";
  if (result.state === "unavailable" || result.value === null) return "Unavailable";
  return number(result.value);
}

function exactConfidenceLabel(level: number, method: "Fisher" | "mid-p", interval: BoundaryInterval): string {
  return `${Math.round(level * 100)}% exact ${method} CI ${boundaryLabel(interval.lower)}–${boundaryLabel(interval.upper)}`;
}

function renderTotals(input: Omit<Table2x2Input, "confidenceLevel">): void {
  requiredElement("#exposed-total").textContent = String(input.exposedCases + input.exposedNonCases);
  requiredElement("#unexposed-total").textContent = String(input.unexposedCases + input.unexposedNonCases);
  requiredElement("#case-total").textContent = String(input.exposedCases + input.unexposedCases);
  requiredElement("#noncase-total").textContent = String(input.exposedNonCases + input.unexposedNonCases);
  requiredElement("#grand-total").textContent = String(
    input.exposedCases + input.exposedNonCases + input.unexposedCases + input.unexposedNonCases,
  );
}

function render(result: Table2x2Result): void {
  const { estimates, tests, input, diagnostics } = result;
  output["risk-ratio"].textContent = number(estimates.riskRatio.estimate);
  output["risk-ratio-ci"].textContent = confidenceLabel(input.confidenceLevel, estimates.riskRatio.confidenceInterval);
  output["odds-ratio"].textContent = number(estimates.oddsRatio.estimate);
  output["odds-ratio-ci"].textContent = confidenceLabel(input.confidenceLevel, estimates.oddsRatio.confidenceInterval);
  output["risk-difference"].textContent = estimates.riskDifference.estimate === null
    ? "Undefined"
    : `${number(estimates.riskDifference.estimate * 100, 1)}%`;
  output["risk-difference-ci"].textContent = confidenceLabel(
    input.confidenceLevel,
    estimates.riskDifference.confidenceInterval,
    true,
  );
  output["fisher-exact"].textContent = pValue(tests.fisherExact?.twoTailed ?? null);
  output["mid-p-exact"].textContent = pValue(tests.midPExact?.oneTailed ?? null);
  output["fisher-one-tailed"].textContent = pValue(tests.fisherExact?.oneTailed ?? null);
  output["fisher-two-tailed"].textContent = pValue(tests.fisherExact?.twoTailed ?? null);
  output["conditional-odds-ratio"].textContent = boundaryLabel(estimates.conditionalOddsRatio.estimate);
  output["conditional-odds-ratio-fisher-ci"].textContent = exactConfidenceLabel(
    input.confidenceLevel,
    "Fisher",
    estimates.conditionalOddsRatio.fisherConfidenceInterval,
  );
  output["conditional-odds-ratio-mid-p-ci"].textContent = exactConfidenceLabel(
    input.confidenceLevel,
    "mid-p",
    estimates.conditionalOddsRatio.midPConfidenceInterval,
  );
  output["pearson-value"].textContent = number(tests.pearson?.value ?? null);
  output["pearson-p"].textContent = pValue(tests.pearson?.pValue ?? null);
  output["mantel-value"].textContent = number(tests.mantelHaenszel?.value ?? null);
  output["mantel-p"].textContent = pValue(tests.mantelHaenszel?.pValue ?? null);
  output["yates-value"].textContent = number(tests.yates?.value ?? null);
  output["yates-p"].textContent = pValue(tests.yates?.pValue ?? null);

  const rr = estimates.riskRatio.estimate;
  output["plain-interpretation"].textContent = rr === null
    ? "A risk ratio cannot be estimated from this table. Review the cell counts and diagnostic warnings."
    : rr >= 1
      ? `The risk of illness among exposed people was ${number(rr)} times the risk among unexposed people.`
      : `The risk of illness among exposed people was ${number((1 - rr) * 100, 1)}% lower than among unexposed people.`;

  warningList.replaceChildren();
  for (const warning of diagnostics.warnings) {
    const item = document.createElement("li");
    item.textContent = warning;
    warningList.append(item);
  }
  warningBox.hidden = diagnostics.warnings.length === 0;
  output["calculation-time"].textContent = `Calculated locally · ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function calculate(): void {
  const input = parseInput();
  renderTotals(input);
  try {
    lastResult = calculateTable2x2(input);
    message.hidden = true;
    render(lastResult);
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : "Unable to calculate this table.";
    message.hidden = false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (form.reportValidity()) calculate();
});

form.addEventListener("input", () => renderTotals(parseInput()));

requiredElement("#example-button").addEventListener("click", () => {
  const example: Omit<Table2x2Input, "confidenceLevel"> = { exposedCases: 40, exposedNonCases: 60, unexposedCases: 10, unexposedNonCases: 90 };
  for (const name of Object.keys(example) as Array<keyof typeof example>) cells[name].value = String(example[name]);
  calculate();
});

requiredElement("#reset-button").addEventListener("click", () => {
  const reset: Omit<Table2x2Input, "confidenceLevel"> = { exposedCases: 0, exposedNonCases: 0, unexposedCases: 0, unexposedNonCases: 0 };
  for (const name of Object.keys(reset) as Array<keyof typeof reset>) cells[name].value = String(reset[name]);
  renderTotals(reset);
  cells.exposedCases.focus();
});

const copyJsonButton = requiredElement<HTMLButtonElement>("#copy-json");
copyJsonButton.addEventListener("click", async () => {
  if (!lastResult) return;
  await navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
  const original = copyJsonButton.textContent;
  copyJsonButton.textContent = "Copied";
  setTimeout(() => { copyJsonButton.textContent = original; }, 1200);
});

calculate();

const stratifiedForm = requiredElement<HTMLFormElement>("#stratified-form");
const strataRows = requiredElement<HTMLTableSectionElement>("#strata-rows");
const stratifiedMessage = requiredElement<HTMLElement>("#stratified-message");
const stratifiedWorkerStatus = requiredElement<HTMLElement>("#stratified-worker-status");
const stratifiedCalculateButton = requiredElement<HTMLButtonElement>("#calculate-stratified");
const stratifiedCancelButton = requiredElement<HTMLButtonElement>("#cancel-stratified");
const classicTablesForm = requiredElement<HTMLFormElement>("#classic-tables-form");
const classicExposureField = requiredElement<HTMLSelectElement>("#classic-exposure-field");
const classicOutcomeField = requiredElement<HTMLSelectElement>("#classic-outcome-field");
const classicStrataField = requiredElement<HTMLSelectElement>("#classic-strata-field");
const classicExposedValues = requiredElement<HTMLSelectElement>("#classic-exposed-values");
const classicCaseValues = requiredElement<HTMLSelectElement>("#classic-case-values");
const classicConfidenceLevel = requiredElement<HTMLSelectElement>("#classic-confidence-level");
const classicFeedback = requiredElement<HTMLElement>("#classic-tables-feedback");
let nextStratumId = 3;
let stratifiedController: AbortController | null = null;

function selectedValues(select: HTMLSelectElement): string[] {
  return [...select.selectedOptions].map((option) => option.value);
}

function distinctValues(fieldName: string): string[] {
  return [...new Set(getCurrentProjectData().records.map((record) => String(record[fieldName] ?? "").trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "en-US"));
}

function setValueOptions(select: HTMLSelectElement, fieldName: string, preferred: (value: string) => boolean): void {
  const prior = new Set(selectedValues(select));
  const values = distinctValues(fieldName);
  const hasPrior = values.some((value) => prior.has(value));
  select.replaceChildren(...values.map((value, index) => {
    const option = new Option(value, value);
    option.selected = prior.has(value) || (!hasPrior && (preferred(value) || (values.length === 1 && index === 0)));
    return option;
  }));
  if (selectedValues(select).length === 0 && select.options[0]) select.options[0].selected = true;
}

function fieldByHint(hint: RegExp, excluded = new Set<string>()): string | null {
  const source = getCurrentProjectData();
  return source.fields.find((field) => !excluded.has(field.name) && hint.test(`${field.name} ${field.prompt}`))?.name ?? null;
}

function setFieldOptions(select: HTMLSelectElement, selected: string): void {
  const source = getCurrentProjectData();
  select.replaceChildren(...source.fields.map((field) => new Option(field.prompt, field.name, false, field.name === selected)));
}

function updateClassicCommandPreview(): void {
  const bracket = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
  requiredElement("#classic-generated-command").textContent = classicExposureField.value && classicOutcomeField.value && classicStrataField.value
    ? `TABLES ${bracket(classicExposureField.value)} ${bracket(classicOutcomeField.value)} STRATAVAR=${bracket(classicStrataField.value)}`
    : "TABLES";
}

function refreshClassicTablesSelectors(): void {
  const source = getCurrentProjectData();
  requiredElement("#classic-source-name").textContent = `${source.formName} · ${source.records.length} records`;
  if (source.fields.length < 3) {
    classicFeedback.textContent = "The current form needs at least three fields for exposure, outcome, and stratification.";
    return;
  }
  const exposure = source.fields.some((field) => field.name === classicExposureField.value)
    ? classicExposureField.value
    : fieldByHint(/potato.?salad|expos/) ?? source.fields[0]!.name;
  const outcome = source.fields.some((field) => field.name === classicOutcomeField.value && field.name !== exposure)
    ? classicOutcomeField.value
    : fieldByHint(/case.?status|outcome|ill/, new Set([exposure])) ?? source.fields.find((field) => field.name !== exposure)!.name;
  const strata = source.fields.some((field) => field.name === classicStrataField.value && ![exposure, outcome].includes(field.name))
    ? classicStrataField.value
    : fieldByHint(/^sex| sex|gender/, new Set([exposure, outcome])) ?? source.fields.find((field) => ![exposure, outcome].includes(field.name))!.name;
  setFieldOptions(classicExposureField, exposure);
  setFieldOptions(classicOutcomeField, outcome);
  setFieldOptions(classicStrataField, strata);
  setValueOptions(classicExposedValues, exposure, (value) => /^yes$|^true$|^1$/i.test(value));
  setValueOptions(classicCaseValues, outcome, (value) => !/^not a case$|^no$|^false$|^0$/i.test(value));
  updateClassicCommandPreview();
  classicFeedback.textContent = "Values shown come from the current form. Use Ctrl/Command-click to select multiple values.";
}

function replaceStrataRows(input: StratifiedTable2x2Input): void {
  strataRows.replaceChildren(...input.strata.map((stratum) => {
    const row = document.createElement("tr");
    row.dataset.stratumId = stratum.id;
    const values = [stratum.label, stratum.exposedCases, stratum.exposedNonCases, stratum.unexposedCases, stratum.unexposedNonCases];
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      const inputElement = document.createElement("input");
      inputElement.value = String(value);
      inputElement.setAttribute("aria-label", `${stratum.label} ${index === 0 ? "label" : ["a", "b", "c", "d"][index - 1]}`);
      if (index > 0) { inputElement.type = "number"; inputElement.min = "0"; inputElement.step = "1"; }
      cell.append(inputElement);
      row.append(cell);
    });
    const actionCell = document.createElement("td");
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "text-button"; remove.dataset.removeStratum = ""; remove.textContent = "Remove";
    actionCell.append(remove); row.append(actionCell);
    return row;
  }));
}

function stratifiedInput(): StratifiedTable2x2Input {
  const strata = [...strataRows.querySelectorAll<HTMLTableRowElement>("tr")].map((row, index) => {
    const inputs = row.querySelectorAll<HTMLInputElement>("input");
    return {
      id: row.dataset.stratumId ?? `stratum-${index + 1}`,
      label: inputs[0]!.value.trim() || `Stratum ${index + 1}`,
      exposedCases: Number(inputs[1]!.value),
      exposedNonCases: Number(inputs[2]!.value),
      unexposedCases: Number(inputs[3]!.value),
      unexposedNonCases: Number(inputs[4]!.value),
    };
  });
  return { strata, confidenceLevel: Number(requiredElement<HTMLSelectElement>("#confidence-level").value) };
}

async function calculateStratified(): Promise<void> {
  stratifiedController?.abort();
  const controller = new AbortController();
  stratifiedController = controller;
  stratifiedCalculateButton.disabled = true;
  stratifiedCancelButton.hidden = false;
  stratifiedWorkerStatus.textContent = "Calculating in an isolated Worker...";
  try {
    const { result, durationMs } = await calculateStratifiedTable2x2InWorker(
      stratifiedInput(),
      { signal: controller.signal },
    );
    requiredElement("#stratified-or").textContent = number(result.estimates.adjustedOddsRatio.estimate);
    requiredElement("#stratified-or-ci").textContent = confidenceLabel(result.input.confidenceLevel, result.estimates.adjustedOddsRatio.confidenceInterval);
    requiredElement("#stratified-rr").textContent = number(result.estimates.adjustedRiskRatio.estimate);
    requiredElement("#stratified-rr-ci").textContent = confidenceLabel(result.input.confidenceLevel, result.estimates.adjustedRiskRatio.confidenceInterval);
    requiredElement("#stratified-conditional-or").textContent = boundaryLabel(result.estimates.adjustedConditionalOddsRatio.estimate);
    requiredElement("#stratified-conditional-or-ci").textContent = exactConfidenceLabel(
      result.input.confidenceLevel,
      "Fisher",
      result.estimates.adjustedConditionalOddsRatio.fisherConfidenceInterval,
    );
    requiredElement("#stratified-mh-value").textContent = number(result.tests.mantelHaenszelUncorrected?.value ?? null);
    requiredElement("#stratified-mh-p").textContent = pValue(result.tests.mantelHaenszelUncorrected?.pValue ?? null);
    requiredElement("#stratified-mh-corrected-value").textContent = number(result.tests.mantelHaenszelCorrected?.value ?? null);
    requiredElement("#stratified-mh-corrected-p").textContent = pValue(result.tests.mantelHaenszelCorrected?.pValue ?? null);
    requiredElement("#stratified-bdt-or-value").textContent = number(result.tests.breslowDayTaroneOddsRatio?.value ?? null);
    requiredElement("#stratified-bdt-or-p").textContent = pValue(result.tests.breslowDayTaroneOddsRatio?.pValue ?? null);
    requiredElement("#stratified-legacy-bd-or-value").textContent = number(result.tests.legacyBreslowDayOddsRatio?.value ?? null);
    requiredElement("#stratified-legacy-bd-or-p").textContent = pValue(result.tests.legacyBreslowDayOddsRatio?.pValue ?? null);
    requiredElement("#stratified-bd-or-value").textContent = number(result.tests.breslowDayOddsRatio?.value ?? null);
    requiredElement("#stratified-bd-or-p").textContent = pValue(result.tests.breslowDayOddsRatio?.pValue ?? null);
    requiredElement("#stratified-legacy-bd-rr-value").textContent = number(result.tests.legacyBreslowDayRiskRatio?.value ?? null);
    requiredElement("#stratified-legacy-bd-rr-p").textContent = pValue(result.tests.legacyBreslowDayRiskRatio?.pValue ?? null);
    const warnings = requiredElement<HTMLElement>("#stratified-warnings");
    warnings.textContent = result.diagnostics.warnings.join(" ");
    warnings.hidden = result.diagnostics.warnings.length === 0;
    stratifiedMessage.hidden = true;
    stratifiedWorkerStatus.textContent = `Worker completed in ${durationMs.toFixed(1)} ms.`;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      stratifiedWorkerStatus.textContent = "Calculation cancelled. You can revise the tables and run it again.";
      stratifiedMessage.hidden = true;
    } else {
      stratifiedMessage.textContent = error instanceof Error ? error.message : "Unable to calculate the stratified analysis.";
      stratifiedMessage.hidden = false;
      stratifiedWorkerStatus.textContent = "Worker calculation failed; the previous results remain visible.";
    }
  } finally {
    if (stratifiedController === controller) {
      stratifiedController = null;
      stratifiedCalculateButton.disabled = false;
      stratifiedCancelButton.hidden = true;
    }
  }
}

stratifiedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (stratifiedForm.reportValidity()) void calculateStratified();
});
stratifiedCancelButton.addEventListener("click", () => stratifiedController?.abort());
requiredElement("#add-stratum").addEventListener("click", () => {
  const id = `stratum-${nextStratumId++}`;
  const row = document.createElement("tr");
  row.dataset.stratumId = id;
  row.innerHTML = `<td><input aria-label="New stratum label" value="Stratum ${nextStratumId - 1}"></td>${["a", "b", "c", "d"].map((cell) => `<td><input aria-label="New stratum ${cell}" type="number" min="0" step="1" value="0"></td>`).join("")}<td><button class="text-button" type="button" data-remove-stratum>Remove</button></td>`;
  strataRows.append(row);
  row.querySelector<HTMLInputElement>("input")?.focus();
});
strataRows.addEventListener("click", (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("[data-remove-stratum]");
  if (!button) return;
  button.closest("tr")?.remove();
});
classicExposureField.addEventListener("change", () => {
  setValueOptions(classicExposedValues, classicExposureField.value, (value) => /^yes$|^true$|^1$/i.test(value));
  updateClassicCommandPreview();
});
classicOutcomeField.addEventListener("change", () => {
  setValueOptions(classicCaseValues, classicOutcomeField.value, (value) => !/^not a case$|^no$|^false$|^0$/i.test(value));
  updateClassicCommandPreview();
});
classicStrataField.addEventListener("change", updateClassicCommandPreview);
for (const button of document.querySelectorAll<HTMLElement>('[data-open-module="classic"], [data-module="classic"]')) {
  button.addEventListener("click", refreshClassicTablesSelectors);
}
classicTablesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const source = getCurrentProjectData();
    const derivation = deriveStratifiedTable2x2(source.records, {
      exposureField: classicExposureField.value,
      exposedValues: selectedValues(classicExposedValues),
      outcomeField: classicOutcomeField.value,
      caseValues: selectedValues(classicCaseValues),
      strataField: classicStrataField.value,
      confidenceLevel: Number(classicConfidenceLevel.value),
    });
    replaceStrataRows(derivation.input);
    requiredElement("#classic-generated-command").textContent = derivation.command;
    classicFeedback.textContent = `Included ${derivation.audit.includedRecords} of ${derivation.audit.sourceRecords} records; excluded ${derivation.audit.excludedMissing} with missing selected values. Reference exposure: ${derivation.audit.exposureReferenceValues.join(", ") || "none"}. Reference outcome: ${derivation.audit.outcomeReferenceValues.join(", ") || "none"}.`;
    void calculateStratified();
  } catch (error) {
    classicFeedback.textContent = error instanceof Error ? error.message : "Unable to derive the selected tables.";
  }
});
refreshClassicTablesSelectors();
void calculateStratified();

try {
  initializeFormDataDemo();
  initializeMaps(getCurrentProjectData, getProjectDataSources, showRecordInEnter);
  initializeSupabaseSync({
    getSnapshot: () => {
      const snapshot = getCurrentProjectSnapshot();
      if (!snapshot) throw new Error("No current project is available to synchronize.");
      return snapshot;
    },
    markSynced: markCurrentProjectSynced,
    applySnapshot: applyHostedProjectSnapshot,
    testConnection: testSupabaseConnection,
  });
} catch (error) {
  console.error(error);
  const status = requiredElement("#main-menu-status");
  status.textContent = `A demo module could not start: ${error instanceof Error ? error.message : String(error)}`;
}
