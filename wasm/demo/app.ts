import { calculateChiSquareTrend, calculateCohortSampleSize, calculatePopulationSurvey, calculateTable2x2, calculateUnmatchedCaseControl, cohortEffectFromOdds, cohortOddsFromOutcomes, cohortOddsFromRisk, deriveFrequency, deriveMeans, deriveRate, deriveStratifiedFrequency, deriveStratifiedTable2x2, unmatchedCaseExposureFromOdds, unmatchedOddsFromExposures } from "./engine.js";
import { initializeEpiAssist } from "./epi-assist.js";
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
import { deriveEpiCurve } from "../app/dashboard/epi-curve.js";
import { createClassicProgramEditor, type ClassicProgramEditorPreferences, type ClassicProgramTabSize } from "../app/programming/classic-editor.js";
import { applyBoundedClassicProgram, CLASSIC_PROGRAM_PLAN_VERSION, parseBoundedClassicProgram, type BoundedClassicProgramPlan } from "../app/programming/classic-program.js";
import { appendProgramRunHistory, readProgramRunHistory, type ProgramRunHistoryEntry } from "../app/programming/run-history.js";
import type { BoundaryInterval, BoundaryNumber, ChiSquareTrendRow, CohortSampleSizeInput, CohortSampleSizeResult, ConfidenceInterval, FrequencyResult, MeansResult, PopulationSurveyInput, PopulationSurveyResult, RateResult, StratifiedFrequencyResult, StratifiedTable2x2Input, Table2x2Input, Table2x2Result, UnmatchedCaseControlInput, UnmatchedCaseControlResult } from "../app/contracts/engine.js";
import type { EpiCurveResult } from "../app/contracts/dashboard.js";
import type { EpiRecord } from "../app/contracts/core.js";

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
const populationSurveyForm = requiredElement<HTMLFormElement>("#population-survey-form");
const populationSurveyFeedback = requiredElement<HTMLElement>("#population-survey-feedback");
const cohortForm = requiredElement<HTMLFormElement>("#cohort-form");
const cohortFeedback = requiredElement<HTMLElement>("#cohort-feedback");
const unmatchedForm = requiredElement<HTMLFormElement>("#unmatched-form");
const unmatchedFeedback = requiredElement<HTMLElement>("#unmatched-feedback");
const trendForm = requiredElement<HTMLFormElement>("#trend-form");
const trendRows = requiredElement<HTMLTableSectionElement>("#trend-rows");
const trendFeedback = requiredElement<HTMLElement>("#trend-feedback");
let currentStatCalcTool = "table2x2";

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

function parsePopulationSurveyInput(): PopulationSurveyInput {
  return {
    populationSize: Number(requiredElement<HTMLInputElement>("#population-size").value),
    expectedFrequencyPercent: Number(requiredElement<HTMLInputElement>("#population-expected-frequency").value),
    marginOfErrorPercent: Number(requiredElement<HTMLInputElement>("#population-margin-error").value),
    designEffect: Number(requiredElement<HTMLInputElement>("#population-design-effect").value),
    clusters: Number(requiredElement<HTMLInputElement>("#population-clusters").value),
  };
}

function renderPopulationSurvey(result: PopulationSurveyResult): void {
  const rows = result.rows.map((row) => {
    const tableRow = document.createElement("tr");
    for (const value of [`${row.confidenceLevel * 100}%`, String(row.clusterSize), String(row.totalSample)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      tableRow.append(cell);
    }
    return tableRow;
  });
  requiredElement("#population-survey-rows").replaceChildren(...rows);
  populationSurveyFeedback.textContent = `Calculated ${rows.length} confidence levels locally.`;
  const warnings = requiredElement<HTMLElement>("#population-survey-warnings");
  warnings.textContent = result.diagnostics.warnings.join(" ");
  warnings.hidden = result.diagnostics.warnings.length === 0;
}

function runPopulationSurvey(): void {
  try {
    renderPopulationSurvey(calculatePopulationSurvey(parsePopulationSurveyInput()));
  } catch (error) {
    populationSurveyFeedback.textContent = error instanceof Error ? error.message : "Unable to calculate Population Survey sample sizes.";
  }
}

function cohortNumber(id: string): number {
  return Number(requiredElement<HTMLInputElement>(`#${id}`).value);
}

function parseCohortInput(): CohortSampleSizeInput {
  return {
    confidenceLevel: Number(requiredElement<HTMLSelectElement>("#cohort-confidence").value) as CohortSampleSizeInput["confidenceLevel"],
    powerPercent: cohortNumber("cohort-power"),
    unexposedToExposedRatio: cohortNumber("cohort-ratio"),
    unexposedOutcomePercent: cohortNumber("cohort-unexposed-outcome"),
    oddsRatio: cohortNumber("cohort-odds-ratio"),
  };
}

function renderCohort(result: CohortSampleSizeResult): void {
  const groups = [
    ["Exposed", ...result.methods.map((method) => method.exposed)],
    ["Unexposed", ...result.methods.map((method) => method.unexposed)],
    ["Total", ...result.methods.map((method) => method.total)],
  ];
  const rows = groups.map((values) => {
    const row = document.createElement("tr");
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      cell.textContent = String(value);
      if (index === 0) cell.setAttribute("scope", "row");
      row.append(cell);
    });
    return row;
  });
  requiredElement("#cohort-rows").replaceChildren(...rows);
  cohortFeedback.textContent = "Calculated Kelsey and Fleiss sample sizes locally.";
}

function runCohort(): void {
  try {
    renderCohort(calculateCohortSampleSize(parseCohortInput()));
  } catch (error) {
    cohortFeedback.textContent = error instanceof Error ? error.message : "Unable to calculate cohort sample sizes.";
  }
}

let syncingCohortEffects = false;
function setCohortEffectValues(source: "odds" | "risk" | "outcomes"): void {
  if (syncingCohortEffects) return;
  syncingCohortEffects = true;
  try {
    const baseline = cohortNumber("cohort-unexposed-outcome");
    const oddsInput = requiredElement<HTMLInputElement>("#cohort-odds-ratio");
    const riskInput = requiredElement<HTMLInputElement>("#cohort-risk-ratio");
    const exposedInput = requiredElement<HTMLInputElement>("#cohort-exposed-outcome");
    let odds = Number(oddsInput.value);
    if (source === "risk") odds = cohortOddsFromRisk(baseline, Number(riskInput.value));
    if (source === "outcomes") odds = cohortOddsFromOutcomes(baseline, Number(exposedInput.value));
    const effect = cohortEffectFromOdds(baseline, odds);
    oddsInput.value = String(Math.round(odds * 100000) / 100000);
    riskInput.value = String(Math.round(effect.riskRatio * 100000) / 100000);
    exposedInput.value = String(Math.round(effect.exposedOutcomePercent * 100000) / 100000);
  } catch (error) {
    cohortFeedback.textContent = error instanceof Error ? error.message : "Unable to link effect measures.";
  } finally {
    syncingCohortEffects = false;
  }
}

function unmatchedNumber(id: string): number {
  return Number(requiredElement<HTMLInputElement>(`#${id}`).value);
}

function parseUnmatchedInput(): UnmatchedCaseControlInput {
  return {
    confidenceLevel: Number(requiredElement<HTMLSelectElement>("#unmatched-confidence").value) as UnmatchedCaseControlInput["confidenceLevel"],
    powerPercent: unmatchedNumber("unmatched-power"),
    controlsToCasesRatio: unmatchedNumber("unmatched-ratio"),
    controlExposurePercent: unmatchedNumber("unmatched-control-exposure"),
    oddsRatio: unmatchedNumber("unmatched-odds-ratio"),
  };
}

function renderUnmatched(result: UnmatchedCaseControlResult): void {
  const groups = [
    ["Cases", ...result.methods.map((method) => method.cases)],
    ["Controls", ...result.methods.map((method) => method.controls)],
    ["Total", ...result.methods.map((method) => method.total)],
  ];
  const rows = groups.map((values) => {
    const row = document.createElement("tr");
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      cell.textContent = String(value);
      if (index === 0) cell.setAttribute("scope", "row");
      row.append(cell);
    });
    return row;
  });
  requiredElement("#unmatched-rows").replaceChildren(...rows);
  unmatchedFeedback.textContent = "Calculated Kelsey and Fleiss sample sizes locally.";
}

function runUnmatched(): void {
  try {
    renderUnmatched(calculateUnmatchedCaseControl(parseUnmatchedInput()));
  } catch (error) {
    unmatchedFeedback.textContent = error instanceof Error ? error.message : "Unable to calculate unmatched case-control sample sizes.";
  }
}

let syncingUnmatchedEffects = false;
function setUnmatchedEffectValues(source: "odds" | "exposures"): void {
  if (syncingUnmatchedEffects) return;
  syncingUnmatchedEffects = true;
  try {
    const control = unmatchedNumber("unmatched-control-exposure");
    const oddsInput = requiredElement<HTMLInputElement>("#unmatched-odds-ratio");
    const casesInput = requiredElement<HTMLInputElement>("#unmatched-case-exposure");
    let odds = Number(oddsInput.value);
    if (source === "exposures") odds = unmatchedOddsFromExposures(control, Number(casesInput.value));
    const cases = unmatchedCaseExposureFromOdds(control, odds);
    oddsInput.value = String(Math.round(odds * 100000) / 100000);
    casesInput.value = String(Math.round(cases * 100000) / 100000);
  } catch (error) {
    unmatchedFeedback.textContent = error instanceof Error ? error.message : "Unable to link exposure measures.";
  } finally {
    syncingUnmatchedEffects = false;
  }
}

function addTrendRow(row: ChiSquareTrendRow = { score: 0, cases: 0, controls: 0 }): void {
  const index = trendRows.rows.length;
  const tableRow = document.createElement("tr");
  for (const [field, value] of Object.entries(row) as Array<[keyof ChiSquareTrendRow, number]>) {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.type = "number";
    input.step = "any";
    input.required = true;
    input.value = String(value);
    input.dataset.trendField = field;
    input.setAttribute("aria-label", `Row ${index + 1} ${field}`);
    if (field !== "score") input.min = "0";
    cell.append(input);
    tableRow.append(cell);
  }
  const oddsCell = document.createElement("td");
  const odds = document.createElement("output");
  odds.dataset.trendOdds = "";
  odds.textContent = "...";
  oddsCell.append(odds);
  const actionCell = document.createElement("td");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button trend-remove-row";
  remove.dataset.removeTrendRow = "";
  remove.textContent = "Remove";
  remove.setAttribute("aria-label", `Remove row ${index + 1}`);
  actionCell.append(remove);
  tableRow.append(oddsCell, actionCell);
  trendRows.append(tableRow);
}

function loadTrendRows(rows: readonly ChiSquareTrendRow[]): void {
  trendRows.replaceChildren();
  rows.forEach((row) => addTrendRow(row));
}

function parseTrendRows(): ChiSquareTrendRow[] {
  return [...trendRows.rows].map((row) => {
    const value = (field: keyof ChiSquareTrendRow) => Number(row.querySelector<HTMLInputElement>(`[data-trend-field="${field}"]`)?.value);
    return { score: value("score"), cases: value("cases"), controls: value("controls") };
  });
}

function runTrend(): void {
  try {
    const result = calculateChiSquareTrend(parseTrendRows());
    [...trendRows.rows].forEach((row, index) => {
      const odds = row.querySelector<HTMLOutputElement>("[data-trend-odds]");
      if (odds) odds.textContent = number(result.rows[index]!.oddsRatio, 3);
    });
    requiredElement<HTMLOutputElement>("#trend-chi-square").textContent = number(result.chiSquare, 5);
    requiredElement<HTMLOutputElement>("#trend-p-value").textContent = pValue(result.pValue);
    trendFeedback.textContent = `Calculated ${result.rows.length} exposure levels locally.`;
  } catch (error) {
    requiredElement<HTMLOutputElement>("#trend-chi-square").textContent = "...";
    requiredElement<HTMLOutputElement>("#trend-p-value").textContent = "...";
    trendFeedback.textContent = error instanceof Error ? error.message : "Unable to calculate Chi Square for Trend.";
  }
}

function showStatCalcTool(name: string): void {
  currentStatCalcTool = name;
  for (const view of document.querySelectorAll<HTMLElement>("[data-statcalc-view]")) view.hidden = view.dataset.statcalcView !== name;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-statcalc-tool]")) {
    const active = button.dataset.statcalcTool === name;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-statcalc-tool]")) {
  button.addEventListener("click", () => showStatCalcTool(button.dataset.statcalcTool ?? "table2x2"));
}
for (const button of document.querySelectorAll<HTMLElement>('[data-open-module="statcalc"], [data-module="statcalc"]')) {
  button.addEventListener("click", () => showStatCalcTool(currentStatCalcTool));
}
populationSurveyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (populationSurveyForm.reportValidity()) runPopulationSurvey();
});
populationSurveyForm.addEventListener("input", () => {
  if (populationSurveyForm.checkValidity()) runPopulationSurvey();
});
cohortForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (cohortForm.reportValidity()) runCohort();
});
cohortForm.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "cohort-risk-ratio") setCohortEffectValues("risk");
  else if (target.id === "cohort-exposed-outcome") setCohortEffectValues("outcomes");
  else if (target.id === "cohort-odds-ratio" || target.id === "cohort-unexposed-outcome") setCohortEffectValues("odds");
  if (cohortForm.checkValidity()) runCohort();
});
unmatchedForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (unmatchedForm.reportValidity()) runUnmatched();
});
unmatchedForm.addEventListener("input", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "unmatched-case-exposure") setUnmatchedEffectValues("exposures");
  else if (target.id === "unmatched-odds-ratio" || target.id === "unmatched-control-exposure") setUnmatchedEffectValues("odds");
  if (unmatchedForm.checkValidity()) runUnmatched();
});
trendForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (trendForm.reportValidity()) runTrend();
});
requiredElement("#trend-add-row").addEventListener("click", () => addTrendRow({ score: trendRows.rows.length, cases: 0, controls: 0 }));
requiredElement("#trend-example").addEventListener("click", () => {
  loadTrendRows([{ score: 0, cases: 10, controls: 90 }, { score: 1, cases: 20, controls: 80 }, { score: 2, cases: 30, controls: 70 }, { score: 3, cases: 40, controls: 60 }]);
  runTrend();
});
trendRows.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement) || !target.hasAttribute("data-remove-trend-row")) return;
  if (trendRows.rows.length <= 2) {
    trendFeedback.textContent = "Chi Square for Trend requires at least two rows.";
    return;
  }
  target.closest("tr")?.remove();
  runTrend();
});

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
runPopulationSurvey();
runCohort();
runUnmatched();
loadTrendRows([{ score: 0, cases: 10, controls: 90 }, { score: 1, cases: 20, controls: 80 }, { score: 2, cases: 30, controls: 70 }, { score: 3, cases: 40, controls: 60 }]);
runTrend();
showStatCalcTool(currentStatCalcTool);

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
const CLASSIC_PROGRAM_PREFERENCES_KEY = "epi-info-ai.program-editor-preferences.v1";
function readClassicProgramPreferences(): ClassicProgramEditorPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(CLASSIC_PROGRAM_PREFERENCES_KEY) ?? "null") as Partial<ClassicProgramEditorPreferences> | null;
    const tabSize = value?.tabSize === 2 || value?.tabSize === 4 || value?.tabSize === 8 ? value.tabSize : 4;
    return {
      lineNumbers: value?.lineNumbers ?? true,
      tabSize,
      indentWithTabs: value?.indentWithTabs ?? true,
    };
  } catch {
    return { lineNumbers: true, tabSize: 4, indentWithTabs: true };
  }
}

let classicProgramPreferences = readClassicProgramPreferences();
function saveClassicProgramPreferences(): void {
  try {
    localStorage.setItem(CLASSIC_PROGRAM_PREFERENCES_KEY, JSON.stringify(classicProgramPreferences));
  } catch {
    // The editor remains usable when browser preference storage is unavailable.
  }
}

const AGE_GROUP_PROGRAM = `DEFINE AgeGroup TEXTINPUT
RECODE Age TO AgeGroup
  LOVALUE - 4 = "0-4"
  4 - 17 = "5-17"
  17 - 44 = "18-44"
  44 - 64 = "45-64"
  64 - HIVALUE = "65+"
END
FREQ AgeGroup STRATAVAR=Sex`;
const classicProgramEditor = createClassicProgramEditor(
  requiredElement<HTMLElement>("#classic-program-source"),
  AGE_GROUP_PROGRAM,
  () => getCurrentProjectData().fields,
  classicProgramPreferences,
  ({ line, column }) => {
    requiredElement("#classic-program-cursor-position").textContent = `Ln ${line}, Col ${column}`;
  },
  ({ valid, message, line }) => {
    const status = requiredElement<HTMLElement>("#classic-program-live-status");
    status.dataset.valid = String(valid);
    status.textContent = valid ? `✓ ${message}` : `Syntax issue${line ? ` on line ${line}` : ""}: ${message}`;
  },
);
const classicProgramFeedback = requiredElement<HTMLElement>("#classic-program-feedback");
const classicProgramOutput = requiredElement<HTMLElement>("#classic-program-output");
const classicProgramLineNumbersButton = requiredElement<HTMLButtonElement>("#view-program-line-numbers");
const classicProgramIndentTabsButton = requiredElement<HTMLButtonElement>("#view-program-indent-tabs");

function renderClassicProgramPreferences(): void {
  classicProgramLineNumbersButton.setAttribute("aria-checked", String(classicProgramPreferences.lineNumbers));
  classicProgramLineNumbersButton.textContent = `${classicProgramPreferences.lineNumbers ? "✓ " : ""}Line Numbers`;
  classicProgramIndentTabsButton.setAttribute("aria-checked", String(classicProgramPreferences.indentWithTabs));
  classicProgramIndentTabsButton.textContent = `${classicProgramPreferences.indentWithTabs ? "✓ " : ""}Indent with Tabs`;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-program-tab-size]")) {
    const selected = Number(button.dataset.programTabSize) === classicProgramPreferences.tabSize;
    button.setAttribute("aria-checked", String(selected));
    button.textContent = `${selected ? "✓ " : ""}${button.dataset.programTabSize} columns`;
  }
  requiredElement("#classic-program-tab-status").textContent = `Tab width ${classicProgramPreferences.tabSize} · ${classicProgramPreferences.indentWithTabs ? "Tabs" : "Spaces"}`;
}

function persistAndApplyClassicProgramPreferences(): void {
  saveClassicProgramPreferences();
  classicProgramEditor.setLineNumbers(classicProgramPreferences.lineNumbers);
  classicProgramEditor.setTabSettings(classicProgramPreferences.tabSize, classicProgramPreferences.indentWithTabs);
  renderClassicProgramPreferences();
}

classicProgramLineNumbersButton.addEventListener("click", () => {
  classicProgramPreferences = { ...classicProgramPreferences, lineNumbers: !classicProgramPreferences.lineNumbers };
  persistAndApplyClassicProgramPreferences();
});
classicProgramIndentTabsButton.addEventListener("click", () => {
  classicProgramPreferences = { ...classicProgramPreferences, indentWithTabs: !classicProgramPreferences.indentWithTabs };
  persistAndApplyClassicProgramPreferences();
});
for (const button of document.querySelectorAll<HTMLButtonElement>("[data-program-tab-size]")) {
  button.addEventListener("click", () => {
    classicProgramPreferences = { ...classicProgramPreferences, tabSize: Number(button.dataset.programTabSize) as ClassicProgramTabSize };
    persistAndApplyClassicProgramPreferences();
  });
}
renderClassicProgramPreferences();
const frequencyForm = requiredElement<HTMLFormElement>("#frequency-form");
const frequencyField = requiredElement<HTMLSelectElement>("#frequency-field");
const frequencyStrataField = requiredElement<HTMLSelectElement>("#frequency-strata-field");
const frequencyIncludeMissing = requiredElement<HTMLInputElement>("#frequency-include-missing");
const frequencyFeedback = requiredElement<HTMLElement>("#frequency-feedback");
const frequencyOutput = requiredElement<HTMLElement>("#frequency-output");
let lastFrequencyResult: FrequencyResult | null = null;
let lastStratifiedFrequencyResult: StratifiedFrequencyResult | null = null;
const meansForm = requiredElement<HTMLFormElement>("#means-form");
const meansField = requiredElement<HTMLSelectElement>("#means-field");
const meansFeedback = requiredElement<HTMLElement>("#means-feedback");
const meansOutput = requiredElement<HTMLElement>("#means-output");
let lastMeansResult: MeansResult | null = null;
const ratesForm = requiredElement<HTMLFormElement>("#rates-form");
const ratesNumeratorField = requiredElement<HTMLSelectElement>("#rates-numerator-field");
const ratesNumeratorValue = requiredElement<HTMLSelectElement>("#rates-numerator-value");
const ratesDenominatorField = requiredElement<HTMLSelectElement>("#rates-denominator-field");
const ratesMultiplier = requiredElement<HTMLSelectElement>("#rates-multiplier");
const ratesFeedback = requiredElement<HTMLElement>("#rates-feedback");
const ratesOutput = requiredElement<HTMLElement>("#rates-output");
let lastRateResult: RateResult | null = null;
const epiCurveForm = requiredElement<HTMLFormElement>("#epi-curve-form");
const epiCurveDateField = requiredElement<HTMLSelectElement>("#epi-curve-date-field");
const epiCurveStatusField = requiredElement<HTMLSelectElement>("#epi-curve-status-field");
const epiCurveInterval = requiredElement<HTMLSelectElement>("#epi-curve-interval");
const epiCurveStep = requiredElement<HTMLInputElement>("#epi-curve-step");
const epiCurveStart = requiredElement<HTMLInputElement>("#epi-curve-start");
const epiCurveEnd = requiredElement<HTMLInputElement>("#epi-curve-end");
const epiCurveIncludeMissing = requiredElement<HTMLInputElement>("#epi-curve-include-missing");
const epiCurveFeedback = requiredElement<HTMLElement>("#epi-curve-feedback");
const epiCurveOutput = requiredElement<HTMLElement>("#epi-curve-output");
let lastEpiCurveResult: EpiCurveResult | null = null;
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

function updateFrequencyCommandPreview(): void {
  const bracket = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
  requiredElement("#frequency-generated-command").textContent = frequencyField.value
    ? `FREQ ${bracket(frequencyField.value)}${frequencyStrataField.value ? ` STRATAVAR=${bracket(frequencyStrataField.value)}` : ""}`
    : "FREQ";
}

function refreshFrequencyStrataSelector(): void {
  const source = getCurrentProjectData();
  const selected = source.fields.some((field) => field.name === frequencyStrataField.value && field.name !== frequencyField.value)
    ? frequencyStrataField.value
    : "";
  frequencyStrataField.replaceChildren(
    new Option("Do not stratify", "", false, !selected),
    ...source.fields.filter((field) => field.name !== frequencyField.value).map((field) => new Option(field.prompt, field.name, false, field.name === selected)),
  );
}

function refreshFrequencySelector(): void {
  const source = getCurrentProjectData();
  requiredElement("#frequency-source-name").textContent = `${source.formName} · ${source.records.length} records`;
  if (source.fields.length === 0) {
    frequencyField.replaceChildren();
    frequencyFeedback.textContent = "The current form has no fields available for FREQ.";
    frequencyOutput.hidden = true;
    return;
  }
  const selected = source.fields.some((field) => field.name === frequencyField.value)
    ? frequencyField.value
    : fieldByHint(/case.?status|outcome|ill/) ?? source.fields[0]!.name;
  setFieldOptions(frequencyField, selected);
  refreshFrequencyStrataSelector();
  updateFrequencyCommandPreview();
  frequencyFeedback.textContent = "Values shown come from the current form. Missing values are excluded unless requested.";
  frequencyOutput.hidden = lastFrequencyResult === null;
  requiredElement<HTMLElement>("#frequency-stratified-output").hidden = lastStratifiedFrequencyResult === null;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function renderProgramHistory(): void {
  const history = readProgramRunHistory();
  requiredElement("#classic-program-history-count").textContent = String(history.length);
  const rows = history.slice(0, 20).map((entry) => {
    const row = document.createElement("tr");
    const command = entry.canonicalSource?.split("\n").at(-1) ?? entry.source.split("\n").find((line) => line.trim()) ?? "";
    for (const value of [
      new Date(entry.occurredAt).toLocaleString(),
      entry.origin,
      entry.status,
      command,
      entry.summary,
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  requiredElement("#classic-program-history-rows").replaceChildren(...rows);
}

function recordProgramRun(entry: Omit<ProgramRunHistoryEntry, "version" | "id" | "occurredAt">): void {
  appendProgramRunHistory(entry);
  renderProgramHistory();
}

function validateProgram(): { plan: BoundedClassicProgramPlan; source: ReturnType<typeof getCurrentProjectData> } {
  const source = getCurrentProjectData();
  const plan = parseBoundedClassicProgram(classicProgramEditor.getValue(), source.fields);
  requiredElement("#classic-program-canonical-source").textContent = plan.canonicalSource;
  requiredElement<HTMLElement>("#classic-program-canonical").hidden = false;
  return { plan, source };
}

function renderProgramFrequency(plan: BoundedClassicProgramPlan, records: EpiRecord[]): { rows: number; included: number } {
  const request = { field: plan.frequency.field, prompt: plan.frequency.field, includeMissing: false };
  const result = plan.frequency.stratifyBy
    ? deriveStratifiedFrequency(records, {
      ...request,
      stratifyBy: plan.frequency.stratifyBy,
      stratifyPrompt: plan.frequency.stratifyBy,
    })
    : deriveFrequency(records, request);
  const strata = result.operation === "epi.frequency.stratified"
    ? result.strata.map((stratum) => ({ label: stratum.value, result: stratum.result }))
    : [{ label: "All records", result }];
  const rows = strata.flatMap((stratum) => stratum.result.categories.map((category) => {
    const row = document.createElement("tr");
    for (const value of [
      stratum.label,
      category.value,
      String(category.frequency),
      percent(category.percent),
      percent(category.cumulativePercent),
      percent(category.confidenceInterval.lower),
      percent(category.confidenceInterval.upper),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  requiredElement("#classic-program-output-rows").replaceChildren(...rows);
  requiredElement("#classic-program-output-title").textContent = `${plan.frequency.field}${plan.frequency.stratifyBy ? ` by ${plan.frequency.stratifyBy}` : ""}`;
  classicProgramOutput.hidden = false;
  return {
    rows: rows.length,
    included: strata.reduce((total, stratum) => total + stratum.result.totals.includedRecords, 0),
  };
}

function runClassicProgram(verifyOnly: boolean): void {
  let project = getCurrentProjectData();
  try {
    const validated = validateProgram();
    project = validated.source;
    if (verifyOnly) {
      classicProgramFeedback.textContent = "Program verified. Three allowlisted statements produced a typed V0.1 execution plan; nothing was run.";
      recordProgramRun({
        origin: "user-program", status: "verified", planVersion: validated.plan.version,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: classicProgramEditor.getValue(), canonicalSource: validated.plan.canonicalSource,
        summary: "Verified DEFINE → RECODE → FREQ plan without execution.", diagnostics: [],
      });
      return;
    }
    const applied = applyBoundedClassicProgram(project.records, validated.plan);
    const output = renderProgramFrequency(validated.plan, applied.records);
    classicProgramFeedback.textContent = `Executed DEFINE → RECODE → FREQ for ${output.included} records and produced ${output.rows} output rows. The current form was not modified.`;
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: validated.plan.version,
      projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
      source: classicProgramEditor.getValue(), canonicalSource: validated.plan.canonicalSource,
      summary: `Produced ${output.rows} frequency rows from ${output.included} included records.`, diagnostics: [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to verify the program.";
    classicProgramFeedback.textContent = `${message} Nothing was run.`;
    classicProgramOutput.hidden = true;
    requiredElement<HTMLElement>("#classic-program-canonical").hidden = true;
    recordProgramRun({
      origin: "user-program", status: "failed", planVersion: CLASSIC_PROGRAM_PLAN_VERSION,
      projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
      source: classicProgramEditor.getValue(), summary: "Program rejected before execution.", diagnostics: [message],
    });
  }
}

function refreshClassicProgramContext(): void {
  const source = getCurrentProjectData();
  requiredElement("#classic-program-source-name").textContent = `${source.formName} · ${source.records.length} records`;
  classicProgramEditor.refreshDiagnostics();
}

function renderFrequency(result: FrequencyResult): void {
  lastFrequencyResult = result;
  lastStratifiedFrequencyResult = null;
  const exact = result.totals.includedRecords < 300;
  const method = exact ? "Exact" : "Wilson";
  requiredElement("#frequency-output-title").textContent = result.input.prompt || result.input.field;
  requiredElement("#frequency-variable-heading").textContent = result.input.prompt || result.input.field;
  requiredElement("#frequency-method").textContent = `${method} 95% confidence limits`;
  requiredElement("#frequency-confidence-title").textContent = `${method} 95% Conf Limits`;
  const rows = result.categories.map((category) => {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = category.value;
    row.append(heading);
    for (const value of [String(category.frequency), percent(category.percent), percent(category.cumulativePercent)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  requiredElement("#frequency-rows").replaceChildren(...rows);
  const confidenceRows = result.categories.map((category) => {
    const row = document.createElement("tr");
    for (const value of [category.value, percent(category.confidenceInterval.lower), percent(category.confidenceInterval.upper)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  requiredElement("#frequency-confidence-rows").replaceChildren(...confidenceRows);
  requiredElement("#frequency-total").textContent = String(result.totals.includedRecords);
  const warning = requiredElement<HTMLElement>("#frequency-warnings");
  warning.textContent = result.diagnostics.warnings.join(" ");
  warning.hidden = result.diagnostics.warnings.length === 0;
  requiredElement("#frequency-generated-command").textContent = result.command;
  frequencyFeedback.textContent = `Included ${result.totals.includedRecords} of ${result.totals.sourceRecords} records; excluded ${result.totals.excludedMissing} with missing values. ${result.totals.categoryCount} categories.`;
  frequencyOutput.hidden = false;
  requiredElement<HTMLElement>("#frequency-stratified-output").hidden = true;
}

function renderStratifiedFrequency(result: StratifiedFrequencyResult): void {
  lastFrequencyResult = null;
  lastStratifiedFrequencyResult = result;
  const rows = result.strata.flatMap((stratum) => stratum.result.categories.map((category) => {
    const row = document.createElement("tr");
    for (const value of [
      stratum.value,
      category.value,
      String(category.frequency),
      percent(category.percent),
      percent(category.cumulativePercent),
      percent(category.confidenceInterval.lower),
      percent(category.confidenceInterval.upper),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  requiredElement("#frequency-stratified-rows").replaceChildren(...rows);
  requiredElement("#frequency-stratified-title").textContent = `${result.input.prompt} by ${result.input.stratifyPrompt}`;
  const warnings = [result.diagnostics.warnings, ...result.strata.map((stratum) => stratum.result.diagnostics.warnings)].flat();
  const warning = requiredElement<HTMLElement>("#frequency-stratified-warnings");
  warning.textContent = warnings.join(" ");
  warning.hidden = warnings.length === 0;
  requiredElement("#frequency-generated-command").textContent = result.command;
  frequencyFeedback.textContent = `Produced ${result.strata.length} strata from ${result.totals.includedRecords} of ${result.totals.sourceRecords} records. Percentages and cumulative percentages are within each stratum.`;
  frequencyOutput.hidden = true;
  requiredElement<HTMLElement>("#frequency-stratified-output").hidden = false;
}

function updateMeansCommandPreview(): void {
  const bracket = (name: string) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : `[${name}]`;
  requiredElement("#means-generated-command").textContent = meansField.value
    ? `MEANS ${bracket(meansField.value)}`
    : "MEANS";
}

function refreshMeansSelector(): void {
  const source = getCurrentProjectData();
  requiredElement("#means-source-name").textContent = `${source.formName} · ${source.records.length} records`;
  const numericFields = source.fields.filter((field) => field.type === "number");
  if (numericFields.length === 0) {
    meansField.replaceChildren();
    meansFeedback.textContent = "The current form has no numeric fields available for MEANS.";
    meansOutput.hidden = true;
    return;
  }
  const selected = numericFields.some((field) => field.name === meansField.value)
    ? meansField.value
    : numericFields.find((field) => /age|duration|amount|count|weight/i.test(`${field.name} ${field.prompt}`))?.name ?? numericFields[0]!.name;
  meansField.replaceChildren(...numericFields.map((field) => new Option(field.prompt, field.name, false, field.name === selected)));
  updateMeansCommandPreview();
  meansFeedback.textContent = "Missing and non-numeric values are excluded and reported.";
  meansOutput.hidden = lastMeansResult === null;
}

function renderMeans(result: MeansResult): void {
  lastMeansResult = result;
  requiredElement("#means-output-title").textContent = result.input.prompt || result.input.field;
  const values: Record<string, number> = {
    "#means-observations": result.statistics.observations,
    "#means-total": result.statistics.total,
    "#means-mean": result.statistics.mean,
    "#means-variance": result.statistics.variance,
    "#means-std-dev": result.statistics.standardDeviation,
    "#means-minimum": result.statistics.minimum,
    "#means-quartile-25": result.statistics.quartile25,
    "#means-median": result.statistics.median,
    "#means-quartile-75": result.statistics.quartile75,
    "#means-maximum": result.statistics.maximum,
    "#means-mode": result.statistics.mode,
  };
  for (const [selector, value] of Object.entries(values)) {
    requiredElement(selector).textContent = selector === "#means-observations" ? String(value) : value.toFixed(4);
  }
  requiredElement("#means-generated-command").textContent = result.command;
  meansFeedback.textContent = `Included ${result.totals.includedRecords} of ${result.totals.sourceRecords} records; excluded ${result.totals.excludedMissingOrNonNumeric}.`;
  const warning = requiredElement<HTMLElement>("#means-warnings");
  warning.textContent = result.diagnostics.warnings.join(" ");
  warning.hidden = result.diagnostics.warnings.length === 0;
  meansOutput.hidden = false;
}

function refreshRatesValueSelector(): void {
  setValueOptions(ratesNumeratorValue, ratesNumeratorField.value, () => false);
  if (ratesNumeratorValue.options.length > 0) ratesNumeratorValue.selectedIndex = 0;
}

function refreshRatesSelectors(): void {
  const source = getCurrentProjectData();
  requiredElement("#rates-source-name").textContent = `${source.formName} · ${source.records.length} records`;
  if (source.fields.length === 0) {
    ratesNumeratorField.replaceChildren();
    ratesDenominatorField.replaceChildren();
    ratesNumeratorValue.replaceChildren();
    ratesFeedback.textContent = "The current form has no fields available for Rates.";
    ratesOutput.hidden = true;
    return;
  }
  const numerator = source.fields.some((field) => field.name === ratesNumeratorField.value)
    ? ratesNumeratorField.value : source.fields.find((field) => field.name === "case_status")?.name ?? source.fields[0]!.name;
  const denominator = source.fields.some((field) => field.name === ratesDenominatorField.value)
    ? ratesDenominatorField.value : source.fields.find((field) => field.name === "id")?.name ?? source.fields[0]!.name;
  setFieldOptions(ratesNumeratorField, numerator);
  setFieldOptions(ratesDenominatorField, denominator);
  refreshRatesValueSelector();
  const confirmed = [...ratesNumeratorValue.options].find((option) => /^confirmed$/i.test(option.value));
  if (confirmed) ratesNumeratorValue.value = confirmed.value;
  ratesFeedback.textContent = "COUNT aggregation uses denominator records with a non-missing selected field.";
  ratesOutput.hidden = lastRateResult === null;
}

function renderRate(result: RateResult): void {
  lastRateResult = result;
  requiredElement("#rates-output-title").textContent = result.input.numeratorPrompt || result.input.numeratorField;
  requiredElement("#rates-description").textContent = `Count of ${result.input.numeratorPrompt} = ${result.input.numeratorValue} per count of ${result.input.denominatorPrompt}`;
  requiredElement("#rates-numerator").textContent = String(result.aggregates.numerator);
  requiredElement("#rates-false-count").textContent = String(result.aggregates.falseCount);
  requiredElement("#rates-denominator").textContent = String(result.aggregates.denominator);
  requiredElement("#rates-value").textContent = result.rate.toFixed(4);
  requiredElement("#rates-method").textContent = `per ${new Intl.NumberFormat("en-US").format(result.input.multiplier)}`;
  ratesFeedback.textContent = `Included ${result.aggregates.denominator} of ${result.totals.sourceRecords} records; excluded ${result.totals.excludedDenominatorMissing} with a missing denominator.`;
  const warning = requiredElement<HTMLElement>("#rates-warnings");
  warning.textContent = result.diagnostics.warnings.join(" ");
  warning.hidden = result.diagnostics.warnings.length === 0;
  ratesOutput.hidden = false;
}

const epiCurveColors = ["#087fa4", "#ef9f00", "#6f5797", "#4e8b57", "#bb4d44", "#657985"];

function refreshEpiCurveSelectors(): void {
  const source = getCurrentProjectData();
  requiredElement("#epi-curve-source-name").textContent = `${source.formName} · ${source.records.length} records`;
  const dateFields = source.fields.filter((field) => field.type === "date" || /date|onset/i.test(`${field.name} ${field.prompt}`));
  if (dateFields.length === 0) {
    epiCurveDateField.replaceChildren();
    epiCurveStatusField.replaceChildren(new Option("Do not group", ""));
    epiCurveFeedback.textContent = "The current form has no date field available for an Epi Curve.";
    epiCurveOutput.hidden = true;
    return;
  }
  const currentDate = dateFields.some((field) => field.name === epiCurveDateField.value)
    ? epiCurveDateField.value
    : dateFields.find((field) => /onset/i.test(`${field.name} ${field.prompt}`))?.name ?? dateFields[0]!.name;
  epiCurveDateField.replaceChildren(...dateFields.map((field) => new Option(field.prompt, field.name, false, field.name === currentDate)));
  const currentStatus = source.fields.some((field) => field.name === epiCurveStatusField.value)
    ? epiCurveStatusField.value
    : fieldByHint(/case.?status|status|classification/) ?? "";
  epiCurveStatusField.replaceChildren(
    new Option("Do not group", "", false, currentStatus === ""),
    ...source.fields.map((field) => new Option(field.prompt, field.name, false, field.name === currentStatus)),
  );
  epiCurveFeedback.textContent = "Choose chart properties, then click Generate Epi Curve.";
  epiCurveOutput.hidden = lastEpiCurveResult === null;
}

function renderEpiCurve(result: EpiCurveResult): void {
  lastEpiCurveResult = result;
  const maxTotal = Math.max(1, ...result.bins.map((bin) => bin.total));
  const legend = result.categories.map((category, index) => {
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.style.backgroundColor = epiCurveColors[index % epiCurveColors.length]!;
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, document.createTextNode(category));
    return item;
  });
  requiredElement("#epi-curve-legend").replaceChildren(...legend);
  const bars = result.bins.map((bin) => {
    const group = document.createElement("div");
    group.className = "epi-curve-bin";
    group.setAttribute("role", "img");
    group.setAttribute("aria-label", `${bin.label}: ${bin.total} record${bin.total === 1 ? "" : "s"}`);
    const stack = document.createElement("div");
    stack.className = "epi-curve-stack";
    stack.style.height = `${Math.max(bin.total === 0 ? 0 : 3, (bin.total / maxTotal) * 100)}%`;
    for (const [index, category] of result.categories.entries()) {
      const count = bin.counts[category] ?? 0;
      if (count === 0) continue;
      const segment = document.createElement("span");
      segment.style.flexGrow = String(count);
      segment.style.backgroundColor = epiCurveColors[index % epiCurveColors.length]!;
      segment.title = `${category}: ${count}`;
      stack.append(segment);
    }
    const label = document.createElement("span");
    label.className = "epi-curve-bin-label";
    label.textContent = bin.label;
    group.append(stack, label);
    return group;
  });
  requiredElement("#epi-curve-plot").replaceChildren(...bars);
  const rows = result.bins.map((bin) => {
    const row = document.createElement("tr");
    const values = [bin.label, ...result.categories.map((category) => String(bin.counts[category] ?? 0)), String(bin.total)];
    for (const [index, value] of values.entries()) {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (cell instanceof HTMLTableCellElement && index === 0) cell.scope = "row";
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  });
  requiredElement("#epi-curve-table-head").replaceChildren(...["Interval", ...result.categories, "Total"].map((label) => {
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = label;
    return heading;
  }));
  requiredElement("#epi-curve-table-body").replaceChildren(...rows);
  const warnings = requiredElement<HTMLElement>("#epi-curve-warnings");
  warnings.textContent = result.diagnostics.warnings.join(" ");
  warnings.hidden = result.diagnostics.warnings.length === 0;
  epiCurveFeedback.textContent = `Plotted ${result.totals.includedRecords} of ${result.totals.sourceRecords} records in ${result.bins.length} interval${result.bins.length === 1 ? "" : "s"}.`;
  epiCurveOutput.hidden = false;
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
requiredElement("#classic-program-load-age-example").addEventListener("click", () => {
  classicProgramEditor.setValue(AGE_GROUP_PROGRAM);
  classicProgramFeedback.textContent = "Loaded the bounded age-group example. Verify the cut points before running.";
  requiredElement<HTMLElement>("#classic-program-canonical").hidden = true;
  classicProgramEditor.focus();
});
requiredElement("#classic-program-verify").addEventListener("click", () => runClassicProgram(true));
requiredElement("#classic-program-run").addEventListener("click", () => runClassicProgram(false));
for (const button of document.querySelectorAll<HTMLElement>('[data-open-module="classic"], [data-module="classic"]')) {
  button.addEventListener("click", refreshClassicProgramContext);
  button.addEventListener("click", refreshClassicTablesSelectors);
  button.addEventListener("click", refreshFrequencySelector);
  button.addEventListener("click", refreshMeansSelector);
}
for (const button of document.querySelectorAll<HTMLElement>('[data-open-module="dashboard"], [data-module="dashboard"]')) {
  button.addEventListener("click", refreshRatesSelectors);
  button.addEventListener("click", refreshEpiCurveSelectors);
}
epiCurveForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const source = getCurrentProjectData();
    const dateField = source.fields.find((field) => field.name === epiCurveDateField.value);
    const statusField = source.fields.find((field) => field.name === epiCurveStatusField.value);
    if (!dateField) throw new RangeError("Select a main date variable from the current form.");
    renderEpiCurve(deriveEpiCurve(source.records, {
      dateField: dateField.name,
      datePrompt: dateField.prompt,
      ...(statusField ? { caseStatusField: statusField.name, caseStatusPrompt: statusField.prompt } : {}),
      interval: epiCurveInterval.value as "hour" | "day" | "month" | "year",
      step: Number(epiCurveStep.value),
      ...(epiCurveStart.value ? { start: epiCurveStart.value } : {}),
      ...(epiCurveEnd.value ? { end: epiCurveEnd.value } : {}),
      includeMissing: epiCurveIncludeMissing.checked,
    }));
  } catch (error) {
    epiCurveFeedback.textContent = error instanceof Error ? error.message : "Unable to generate the Epi Curve.";
  }
});
ratesNumeratorField.addEventListener("change", refreshRatesValueSelector);
ratesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const source = getCurrentProjectData();
    const numeratorField = source.fields.find((field) => field.name === ratesNumeratorField.value);
    const denominatorField = source.fields.find((field) => field.name === ratesDenominatorField.value);
    if (!numeratorField || !denominatorField) throw new RangeError("Select valid fields from the current form.");
    renderRate(deriveRate(source.records, {
      numeratorField: numeratorField.name,
      numeratorPrompt: numeratorField.prompt,
      numeratorValue: ratesNumeratorValue.value,
      denominatorField: denominatorField.name,
      denominatorPrompt: denominatorField.prompt,
      multiplier: Number(ratesMultiplier.value),
    }));
  } catch (error) {
    ratesFeedback.textContent = error instanceof Error ? error.message : "Unable to calculate the rate.";
  }
});
frequencyField.addEventListener("change", () => {
  refreshFrequencyStrataSelector();
  updateFrequencyCommandPreview();
});
frequencyStrataField.addEventListener("change", updateFrequencyCommandPreview);
frequencyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const source = getCurrentProjectData();
    const field = source.fields.find((candidate) => candidate.name === frequencyField.value);
    if (!field) throw new RangeError("Select a frequency variable from the current form.");
    const strata = source.fields.find((candidate) => candidate.name === frequencyStrataField.value);
    if (strata) {
      renderStratifiedFrequency(deriveStratifiedFrequency(source.records, {
        field: field.name,
        prompt: field.prompt,
        includeMissing: frequencyIncludeMissing.checked,
        stratifyBy: strata.name,
        stratifyPrompt: strata.prompt,
      }));
    } else {
      renderFrequency(deriveFrequency(source.records, {
        field: field.name,
        prompt: field.prompt,
        includeMissing: frequencyIncludeMissing.checked,
      }));
    }
  } catch (error) {
    frequencyFeedback.textContent = error instanceof Error ? error.message : "Unable to calculate the frequency table.";
  }
});
meansField.addEventListener("change", updateMeansCommandPreview);
meansForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    const source = getCurrentProjectData();
    const field = source.fields.find((candidate) => candidate.name === meansField.value && candidate.type === "number");
    if (!field) throw new RangeError("Select a numeric variable from the current form.");
    renderMeans(deriveMeans(source.records, { field: field.name, prompt: field.prompt }));
  } catch (error) {
    meansFeedback.textContent = error instanceof Error ? error.message : "Unable to calculate descriptive statistics.";
  }
});
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
refreshClassicProgramContext();
renderProgramHistory();
refreshFrequencySelector();
refreshMeansSelector();
refreshRatesSelectors();

try {
  initializeFormDataDemo();
  initializeEpiAssist(getCurrentProjectData);
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
