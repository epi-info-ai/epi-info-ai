import { calculateChiSquareTrend, calculateCohortSampleSize, calculatePopulationSurvey, calculateTable2x2, calculateUnmatchedCaseControl, cohortEffectFromOdds, cohortOddsFromOutcomes, cohortOddsFromRisk, deriveFrequency, deriveMeans, deriveRate, deriveStratifiedFrequency, deriveStratifiedTable2x2, unmatchedCaseExposureFromOdds, unmatchedOddsFromExposures } from "./engine.js";
import { initializeEpiAssist } from "./epi-assist.js";
import {
  applyClassicMergeRecords,
  applyClassicDeleteTableRecords,
  applyClassicDeleteRecords,
  applyClassicUndeleteRecords,
  applyHostedProjectSnapshot,
  deleteCurrentProjectProgram,
  getCurrentProjectSnapshot,
  replaceCurrentOfflineMapAsset,
  replaceCurrentProjectMapState,
  detachCurrentOfflineMapAsset,
  getCurrentProjectData,
  getCurrentProjectPrograms,
  getProjectDataSources,
  initializeFormDataDemo,
  markCurrentProjectSynced,
  saveCurrentProjectProgram,
  showRecordInEnter,
  testSupabaseConnection,
} from "./form-data.js";
import { initializeMaps } from "./maps.js";
import { calculateStratifiedTable2x2InWorker } from "./stratified-worker-client.js";
import { initializeSupabaseSync } from "./supabase-sync.js";
import { deriveEpiCurve } from "../app/dashboard/epi-curve.js";
import { renderDashboardCommandContract } from "../app/dashboard/dashboard-menu.js";
import { renderClassicAnalysisContract } from "../app/analysis/classic-analysis-menu.js";
import { CLASSIC_AST_VERSION, parseClassicProgram } from "../app/programming/classic-ast.js";
import { createClassicProgramEditor, type ClassicProgramEditorPreferences, type ClassicProgramTabSize } from "../app/programming/classic-editor.js";
import { buildClassicAnalysisCommand, CLASSIC_TABLES_EXPANSION_PLAN_VERSION, resolveSelectedClassicAnalysisCommand, type ClassicAnalysisCommandInput, type ClassicAnalysisCommandKind, type ClassicDefineVariableScope, type ClassicDefineVariableType } from "../app/programming/classic-command-builder.js";
import { initializeUiRunbooks } from "../app/help/runbooks.js";
import { applyClassicSelection, resolveClassicSelectionCommand, type ClassicSelectionOperator } from "../app/programming/classic-selection.js";
import { resolveClassicSortCommand, type ClassicSortDirection } from "../app/programming/classic-sort.js";
import { assignmentValueFromInput, resolveClassicAssignCommand, resolveClassicDefineCommand, resolveClassicUndefineCommand } from "../app/programming/classic-assignment.js";
import { ClassicProgramSession } from "../app/programming/classic-session.js";
import { evaluateClassicIf, resolveClassicIfCommand } from "../app/programming/classic-if.js";
import { classicDisplayRows, resolveClassicDisplayCommand, type ClassicDisplayMode } from "../app/programming/classic-display.js";
import { resolveClassicDefineGroupCommand } from "../app/programming/classic-group.js";
import { applyClassicRelate, resolveClassicRelateCommand } from "../app/programming/classic-relate.js";
import { resolveClassicWriteCommand, serializeClassicWriteCsv } from "../app/programming/classic-write.js";
import { applyClassicMerge, resolveClassicMergeCommand, type ClassicMergePlan, type ClassicMergeResult } from "../app/programming/classic-merge.js";
import { resolveClassicDeleteTableCommand, stageClassicDeleteTable, type ClassicDeleteTablePlan } from "../app/programming/classic-delete.js";
import { resolveClassicDeleteRecordsCommand, stageClassicDeleteRecords, type ClassicDeleteRecordsResult } from "../app/programming/classic-delete-records.js";
import { resolveClassicUndeleteRecordsCommand, stageClassicUndeleteRecords, type ClassicUndeleteRecordsResult } from "../app/programming/classic-undelete-records.js";
import { applyClassicSummarize, resolveClassicSummarizeCommand, type ClassicSummarizeAggregate } from "../app/programming/classic-summarize.js";
import { resolveClassicGraphCommand, type ClassicGraphType } from "../app/programming/classic-graph.js";
import { applyClassicTables, classicTablesOutTable, classicTablesStratified2x2Input, resolveClassicTablesPlan, type ClassicTablesPlan, type ClassicTablesResult } from "../app/programming/classic-tables.js";
import { applyClassicComplexTables, classicComplexTablesOutTable, resolveClassicComplexTablesPlan, type ClassicComplexTablesPlan, type ClassicComplexTablesResult } from "../app/programming/classic-complex-tables.js";
import { applyClassicComplexFrequency, classicComplexFrequencyOutTable, resolveClassicComplexFrequencyPlan, type ClassicComplexFrequencyPlan, type ClassicComplexFrequencyResult } from "../app/programming/classic-complex-frequency.js";
import { applyClassicComplexMeans, classicComplexMeansOutTable, resolveClassicComplexMeansPlan, type ClassicComplexMeansPlan, type ClassicComplexMeansResult } from "../app/programming/classic-complex-means.js";
import { applyEpiAiQualityProfile, resolveEpiAiQualityCommand } from "../app/programming/epi-ai-quality.js";
import { convertAccessFile, resolveFileConvertCommand } from "../app/programming/file-convert.js";
import type { DataQualityReport } from "../app/forms/data-quality.js";
import { renderClassicProgramSurface } from "../app/programming/classic-program-surface.js";
import { ClassicProgramDocumentService, normalizeClassicProgramName, readClassicProgramFile, safeClassicProgramFileName } from "../app/programming/classic-program-document.js";
import { assessClassicProgramCatalog, loadClassicProgramExampleCatalog, type ClassicProgramExample, type ClassicProgramExampleCatalog } from "../app/programming/classic-examples.js";
import { applyBoundedClassicProgram, CLASSIC_PROGRAM_PLAN_VERSION, parseBoundedClassicProgram, type BoundedClassicProgramPlan } from "../app/programming/classic-program.js";
import { appendProgramRunHistory, readProgramRunHistory, type ProgramRunHistoryEntry } from "../app/programming/run-history.js";
import type { BoundaryInterval, BoundaryNumber, ChiSquareTrendRow, CohortSampleSizeInput, CohortSampleSizeResult, ConfidenceInterval, FrequencyResult, MeansResult, PopulationSurveyInput, PopulationSurveyResult, RateResult, StratifiedFrequencyResult, StratifiedTable2x2Input, StratifiedTable2x2Result, Table2x2Input, Table2x2Result, UnmatchedCaseControlInput, UnmatchedCaseControlResult } from "../app/contracts/engine.js";
import type { EpiCurveResult } from "../app/contracts/dashboard.js";
import type { EpiRecord, FieldDefinition } from "../app/contracts/core.js";
import type { ProjectProgram } from "../app/contracts/project-package.js";

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
const CLASSIC_PROGRAM_FONT_FAMILIES = ["Consolas", "Cascadia Mono", "Courier New", "Lucida Console", "Arial", "Times New Roman"] as const;
function readClassicProgramPreferences(): ClassicProgramEditorPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(CLASSIC_PROGRAM_PREFERENCES_KEY) ?? "null") as Partial<ClassicProgramEditorPreferences> | null;
    const tabSize = value?.tabSize === 2 || value?.tabSize === 4 || value?.tabSize === 8 ? value.tabSize : 4;
    const fontFamily = typeof value?.fontFamily === "string" && CLASSIC_PROGRAM_FONT_FAMILIES.includes(value.fontFamily as typeof CLASSIC_PROGRAM_FONT_FAMILIES[number]) ? value.fontFamily : "Consolas";
    const requestedFontSize = Number(value?.fontSize);
    const fontSize = Number.isInteger(requestedFontSize) && requestedFontSize >= 8 && requestedFontSize <= 32 ? requestedFontSize : 15;
    return {
      lineNumbers: value?.lineNumbers ?? true,
      tabSize,
      indentWithTabs: value?.indentWithTabs ?? true,
      fontFamily,
      fontSize,
    };
  } catch {
    return { lineNumbers: true, tabSize: 4, indentWithTabs: true, fontFamily: "Consolas", fontSize: 15 };
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

const classicProgramExampleSelect = requiredElement<HTMLSelectElement>("#classic-program-example");
const classicProgramExampleDescription = requiredElement<HTMLElement>("#classic-program-example-description");
const classicProgramLoadExampleButton = requiredElement<HTMLButtonElement>("#classic-program-load-example");
const classicProgramExamplesFieldset = requiredElement<HTMLFieldSetElement>(".classic-program-examples");
const FOODBORNE_DATASET_ID = "foodborne-outbreak-investigation";
const FOODBORNE_DATASET_SHA256 = "b6e855c8cc6990abb4c25c4a1d9ee5ddea3c0016567bfc30f372faaa07df9cf5";
let classicProgramExamples: readonly ClassicProgramExample[] = [];
let classicProgramCatalog: ClassicProgramExampleCatalog | null = null;
let classicProgramAvailability = new Map<string, { compatible: boolean; issues: string[] }>();
let classicExampleSourceLoaded = false;
const classicProgramDocument = new ClassicProgramDocumentService();
const classicProgramSession = new ClassicProgramSession();
classicProgramDocument.newDocument("// Enter an Epi Info program for the current project.");
const classicProgramEditor = createClassicProgramEditor(
  requiredElement<HTMLElement>("#classic-program-source"),
  "// Enter an Epi Info program for the current project.",
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
  () => renderClassicProgramDocumentState(),
);
const classicProgramFeedback = requiredElement<HTMLElement>("#classic-program-feedback");
const classicProgramOutput = requiredElement<HTMLElement>("#classic-program-output");
const classicProgramLineNumbersButton = requiredElement<HTMLButtonElement>("#view-program-line-numbers");
const classicProgramIndentTabsButton = requiredElement<HTMLButtonElement>("#view-program-indent-tabs");
renderClassicProgramSurface(requiredElement("#classic-program-menu"), requiredElement("#classic-program-toolbar"), requiredElement("#classic-output-toolbar"));
initializeUiRunbooks();
const classicProgramCommandStatus = requiredElement<HTMLElement>("#classic-program-command-status");
const classicProgramToolbarRun = requiredElement<HTMLButtonElement>("#classic-program-toolbar-run");
const classicProgramToolbarCancel = requiredElement<HTMLButtonElement>("#classic-program-toolbar-cancel");
let classicProgramRunController: AbortController | null = null;
classicProgramToolbarCancel.disabled = true;
const classicProgramFontDialog = requiredElement<HTMLDialogElement>("#classic-program-font-dialog");
const classicProgramFontFamily = requiredElement<HTMLSelectElement>("#classic-program-font-family");
const classicProgramFontSize = requiredElement<HTMLInputElement>("#classic-program-font-size");
const classicProgramFontPreview = requiredElement<HTMLElement>("#classic-program-font-preview");
const classicProgramAssistWorkbench = requiredElement<HTMLElement>("#classic-program-workbench");
const classicProgramAssist = requiredElement<HTMLElement>("#classic-program-assist");
const classicProgramAssistToggle = requiredElement<HTMLButtonElement>("#classic-program-assist-toggle");
const classicProgramAssistClose = requiredElement<HTMLButtonElement>("#classic-program-assist-close");
const classicProgramAssistReopen = requiredElement<HTMLButtonElement>("#classic-program-assist-reopen");
const classicProgramAssistTaskLabel = requiredElement<HTMLElement>("#classic-program-assist-task-label");
const classicProgramAssistPreview = requiredElement<HTMLButtonElement>("#classic-program-assist-preview");
const classicProgramAssistStatus = requiredElement<HTMLElement>("#classic-program-assist-status");
const classicProgramAssistPrompt = requiredElement<HTMLTextAreaElement>("#classic-program-assist-prompt");

function setClassicProgramAssistOpen(open: boolean): void {
  classicProgramAssistWorkbench.dataset.assistOpen = String(open);
  classicProgramAssistToggle.setAttribute("aria-expanded", String(open));
  classicProgramAssist.setAttribute("aria-hidden", String(!open));
  classicProgramAssistToggle.title = open ? "Hide Epi Assist" : "Show Epi Assist";
}

classicProgramAssistToggle.addEventListener("click", () => {
  setClassicProgramAssistOpen(classicProgramAssistWorkbench.dataset.assistOpen !== "true");
});

classicProgramAssistClose.addEventListener("click", () => {
  setClassicProgramAssistOpen(false);
  classicProgramAssistReopen.focus();
});

classicProgramAssistReopen.addEventListener("click", () => {
  setClassicProgramAssistOpen(true);
  classicProgramAssistClose.focus();
});

document.querySelectorAll<HTMLButtonElement>("[data-assist-task]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll<HTMLButtonElement>("[data-assist-task]").forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
    const task = button.dataset.assistTask ?? "Plan analysis";
    classicProgramAssistTaskLabel.textContent = task;
    classicProgramAssistPreview.textContent = `Continue with ${task.toLocaleLowerCase()}`;
    classicProgramAssistStatus.textContent = `${task} selected. Continue to choose local Granite or an approved managed foundation-model gateway.`;
  });
});

classicProgramAssistPreview.addEventListener("click", () => {
  const prompt = classicProgramAssistPrompt.value.trim();
  const modelPrompt = requiredElement<HTMLTextAreaElement>("#epi-assist-prompt");
  if (prompt) modelPrompt.value = prompt;
  requiredElement<HTMLDialogElement>("#epi-assist-dialog").showModal();
  classicProgramAssistStatus.textContent = "Opened the model-backed Epi Assist dialog. Choose a provider, enable it, and review the proposed action.";
});

function renderClassicProgramSession(): void {
  const source = classicProgramSession.current(getCurrentProjectData());
  const status = classicProgramSession.selectionStatus(getCurrentProjectData());
  const sort = classicProgramSession.sortStatus();
  const variables = classicProgramSession.variables();
  const groups = classicProgramSession.groups();
  const label = document.createElement("strong");
  label.textContent = "Active data:";
  let detail = status.canonicalSource
    ? ` ${source.formName} · ${status.selected} of ${status.total} records selected; ${status.excluded} excluded (${status.excludedMissing} missing comparisons). ${status.canonicalSource}`
    : ` ${source.formName} · ${status.total} records; no selection.`;
  if (sort.canonicalSource) detail += ` ${sort.canonicalSource}`;
  if (variables.length) detail += ` Variables: ${variables.map((variable) => `${variable.name}=${variable.value === null ? "Missing" : String(variable.value)}`).join(", ")}.`;
  if (groups.length) detail += ` Groups: ${groups.map((group) => `${group.name}=[${group.members.join(", ")}]`).join("; ")}.`;
  detail += ` SET MISSING=${classicProgramSession.includeMissing() ? "ON" : "OFF"}; (.)=${JSON.stringify(classicProgramSession.missingLabel())}.`;
  requiredElement("#classic-program-session-status").replaceChildren(label, detail);
  requiredElement("#classic-program-source-name").textContent = `${source.formName} · ${status.selected} of ${status.total} records${sort.fields ? ` · sorted by ${sort.fields} field${sort.fields === 1 ? "" : "s"}` : ""}`;
}

function renderClassicProgramDocumentState(): void {
  const state = classicProgramDocument.state;
  const dirty = classicProgramDocument.isDirty(classicProgramEditor.getValue());
  requiredElement("#classic-program-document-state").textContent = `${state.name} · ${dirty ? "modified" : "saved"}`;
}

function refreshClassicProjectPrograms(): void {
  const programs = getCurrentProjectPrograms();
  const options = programs.map((program) => new Option(program.name, program.name));
  const empty = new Option(programs.length === 0 ? "No saved programs" : "Choose a saved program", "");
  requiredElement<HTMLSelectElement>("#classic-program-dialog-project").replaceChildren(empty, ...options);
}

function guardUnsavedClassicProgram(): boolean {
  return !classicProgramDocument.isDirty(classicProgramEditor.getValue()) || window.confirm("Discard unsaved changes to the current program?");
}

function openClassicProgram(name: string): void {
  const program = getCurrentProjectPrograms().find((candidate) => candidate.name === name);
  if (!program) throw new Error("The selected project program is no longer available.");
  if (!guardUnsavedClassicProgram()) return;
  classicProgramDocument.open(program, "project");
  classicProgramEditor.setValue(program.source);
  classicExampleSourceLoaded = false;
  classicProgramCommandStatus.textContent = `Opened project program “${program.name}”. Unsupported source remains editable but cannot run.`;
  renderClassicProgramDocumentState();
}

function newClassicProgram(): void {
  if (!guardUnsavedClassicProgram()) return;
  classicProgramDocument.newDocument("");
  classicProgramEditor.setValue("");
  classicExampleSourceLoaded = false;
  classicProgramCommandStatus.textContent = "New untitled program created.";
  renderClassicProgramDocumentState();
  classicProgramEditor.focus();
}

type ClassicProgramDialogMode = "open" | "save" | "save-as";
let classicProgramDialogMode: ClassicProgramDialogMode = "open";
const classicProgramDialog = requiredElement<HTMLDialogElement>("#classic-program-dialog");
const formatProgramTimestamp = (value?: string): string => value ? new Date(value).toLocaleString() : "";
function renderClassicProgramDialogMetadata(program?: ProjectProgram): void {
  const state = program ?? classicProgramDocument.state;
  requiredElement<HTMLInputElement>("#classic-program-author").value = state.author ?? "";
  requiredElement<HTMLTextAreaElement>("#classic-program-comment").value = state.comment ?? "";
  requiredElement<HTMLInputElement>("#classic-program-created").value = formatProgramTimestamp(state.createdAt);
  requiredElement<HTMLInputElement>("#classic-program-updated").value = formatProgramTimestamp(state.modifiedAt);
}
function showClassicProgramDialog(mode: ClassicProgramDialogMode): void {
  classicProgramDialogMode = mode;
  refreshClassicProjectPrograms();
  const saveMode = mode !== "open";
  const saveAsMode = mode === "save-as";
  requiredElement("#classic-program-dialog-title").textContent = saveAsMode ? "Save Program As" : saveMode ? "Save Program" : "Open Program";
  requiredElement<HTMLElement>("#classic-program-name-label").hidden = !saveMode;
  requiredElement<HTMLElement>("#classic-program-file-label").hidden = saveMode;
  requiredElement<HTMLButtonElement>("#classic-program-dialog-primary").textContent = saveMode ? "Save to Current Project" : "Open";
  requiredElement<HTMLButtonElement>("#classic-program-dialog-export").hidden = !saveAsMode;
  requiredElement<HTMLButtonElement>("#classic-program-dialog-delete").hidden = saveMode;
  classicProgramExamplesFieldset.hidden = saveMode || classicProgramExamples.length === 0;
  requiredElement<HTMLInputElement>("#classic-program-author").readOnly = !saveMode;
  requiredElement<HTMLTextAreaElement>("#classic-program-comment").readOnly = !saveMode;
  requiredElement<HTMLInputElement>("#classic-program-name").value = classicProgramDocument.state.name === "Untitled" ? "" : classicProgramDocument.state.name;
  requiredElement<HTMLInputElement>("#classic-program-file").value = "";
  requiredElement("#classic-program-dialog-feedback").textContent = saveAsMode
    ? "Save under another project name or download an interoperable .pgm7 text file."
    : saveMode
      ? "Review the program name, Author, and Comments before saving in the current project."
    : "Choose a project program or a .pgm7 text file.";
  const selectedName = classicProgramDocument.state.origin === "project" ? classicProgramDocument.state.name : "";
  const projectSelect = requiredElement<HTMLSelectElement>("#classic-program-dialog-project");
  projectSelect.value = selectedName;
  renderClassicProgramDialogMetadata(saveMode ? undefined : getCurrentProjectPrograms().find((program) => program.name === selectedName));
  requiredElement<HTMLButtonElement>("#classic-program-dialog-delete").disabled = !projectSelect.value;
  classicProgramDialog.showModal();
}

function saveClassicProgramToProject(name = classicProgramDocument.state.name, metadata: { author?: string; comment?: string } = classicProgramDocument.state): boolean {
  const normalizedName = normalizeClassicProgramName(name);
  const existing = getCurrentProjectPrograms().find((program) => program.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
  const sameOpenProgram = classicProgramDocument.state.origin === "project" && classicProgramDocument.state.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase();
  if (existing && !sameOpenProgram && !window.confirm(`Replace the saved project program “${existing.name}”?`)) return false;
  const program = saveCurrentProjectProgram(normalizedName, classicProgramEditor.getValue(), metadata);
  classicProgramDocument.markSaved(program.name, program.source, "project", program);
  refreshClassicProjectPrograms();
  classicProgramCommandStatus.textContent = `Saved “${program.name}” in the current project.`;
  renderClassicProgramDocumentState();
  return true;
}

function saveClassicProgram(): void {
  showClassicProgramDialog("save");
}

function exportClassicProgramFile(): void {
  const name = requiredElement<HTMLInputElement>("#classic-program-name").value;
  try {
    const fileName = safeClassicProgramFileName(name);
    const source = classicProgramEditor.getValue();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
    link.download = fileName;
    link.click();
    globalThis.setTimeout(() => URL.revokeObjectURL(link.href), 0);
    classicProgramDocument.markSaved(name, source, "file", classicProgramDocument.state);
    classicProgramDialog.close();
    classicProgramCommandStatus.textContent = `Saved ${fileName} as a browser download.`;
    renderClassicProgramDocumentState();
  } catch (error) {
    requiredElement("#classic-program-dialog-feedback").textContent = error instanceof Error ? error.message : "Unable to save the program file.";
  }
}

requiredElement<HTMLSelectElement>("#classic-program-dialog-project").addEventListener("change", (event) => {
  const name = (event.currentTarget as HTMLSelectElement).value;
  renderClassicProgramDialogMetadata(getCurrentProjectPrograms().find((program) => program.name === name));
  requiredElement<HTMLButtonElement>("#classic-program-dialog-delete").disabled = !name;
});
for (const selector of ["#classic-program-file-new", "#classic-program-toolbar-new"]) requiredElement(selector).addEventListener("click", newClassicProgram);
for (const selector of ["#classic-program-file-open", "#classic-program-toolbar-open"]) requiredElement(selector).addEventListener("click", () => showClassicProgramDialog("open"));
for (const selector of ["#classic-program-file-save", "#classic-program-toolbar-save"]) requiredElement(selector).addEventListener("click", saveClassicProgram);
requiredElement("#classic-program-file-save-as").addEventListener("click", () => showClassicProgramDialog("save-as"));
function printClassicProgram(): void {
  requiredElement("#classic-program-print-title").textContent = classicProgramDocument.state.name;
  requiredElement("#classic-program-print-source").textContent = classicProgramEditor.getValue();
  document.body.classList.add("printing-classic-program");
  const cleanup = (): void => document.body.classList.remove("printing-classic-program");
  globalThis.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  globalThis.setTimeout(cleanup, 0);
  closeClassicProgramMenus();
  classicProgramCommandStatus.textContent = "Program sent to the browser print dialog. Page setup is available there when supported by the browser.";
}
for (const selector of ["#classic-program-file-print", "#classic-program-toolbar-print"]) requiredElement(selector).addEventListener("click", printClassicProgram);
requiredElement("#classic-program-dialog-primary").addEventListener("click", () => {
  try {
    if (classicProgramDialogMode === "open") {
      const name = requiredElement<HTMLSelectElement>("#classic-program-dialog-project").value;
      if (!name) throw new RangeError("Choose a project program or a .pgm7 file.");
      openClassicProgram(name);
    } else if (!saveClassicProgramToProject(requiredElement<HTMLInputElement>("#classic-program-name").value, {
      author: requiredElement<HTMLInputElement>("#classic-program-author").value,
      comment: requiredElement<HTMLTextAreaElement>("#classic-program-comment").value,
    })) return;
    classicProgramDialog.close();
  } catch (error) {
    requiredElement("#classic-program-dialog-feedback").textContent = error instanceof Error ? error.message : "Unable to complete the program operation.";
  }
});
requiredElement("#classic-program-dialog-export").addEventListener("click", exportClassicProgramFile);
requiredElement("#classic-program-dialog-delete").addEventListener("click", () => {
  const name = requiredElement<HTMLSelectElement>("#classic-program-dialog-project").value;
  if (!name || !window.confirm(`Delete saved project program “${name}”?`)) return;
  try {
    if (!deleteCurrentProjectProgram(name)) throw new Error("The selected project program is no longer available.");
    if (classicProgramDocument.state.origin === "project" && classicProgramDocument.state.name === name) {
      const source = classicProgramEditor.getValue();
      classicProgramDocument.newDocument("");
      classicProgramEditor.setValue(source);
      renderClassicProgramDocumentState();
    }
    refreshClassicProjectPrograms();
    renderClassicProgramDialogMetadata();
    requiredElement<HTMLButtonElement>("#classic-program-dialog-delete").disabled = true;
    requiredElement("#classic-program-dialog-feedback").textContent = `Deleted “${name}” from the current project. The editor source remains available until you close or replace it.`;
    classicProgramCommandStatus.textContent = `Deleted saved project program “${name}”.`;
  } catch (error) {
    requiredElement("#classic-program-dialog-feedback").textContent = error instanceof Error ? error.message : "Unable to delete the program.";
  }
});
requiredElement<HTMLInputElement>("#classic-program-file").addEventListener("change", async (event) => {
  const file = (event.currentTarget as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const imported = await readClassicProgramFile(file);
    if (!guardUnsavedClassicProgram()) return;
    classicProgramDocument.open(imported, "file");
    classicProgramEditor.setValue(imported.source);
    classicExampleSourceLoaded = false;
    classicProgramDialog.close();
    classicProgramCommandStatus.textContent = `Opened ${file.name}. Review its source before running.`;
    renderClassicProgramDocumentState();
  } catch (error) {
    requiredElement("#classic-program-dialog-feedback").textContent = error instanceof Error ? error.message : "Unable to open the program file.";
  }
});

const classicProgramSearchDialog = requiredElement<HTMLDialogElement>("#classic-program-search-dialog");
let classicProgramSearchMode: "find" | "replace" = "find";
function showClassicProgramSearch(mode: "find" | "replace"): void {
  classicProgramSearchMode = mode;
  const replacing = mode === "replace";
  requiredElement("#classic-program-search-title").textContent = replacing ? "Replace" : "Find";
  requiredElement<HTMLElement>("#classic-program-replacement-label").hidden = !replacing;
  requiredElement<HTMLButtonElement>("#classic-program-search-replace").hidden = !replacing;
  requiredElement<HTMLButtonElement>("#classic-program-search-replace-all").hidden = !replacing;
  requiredElement("#classic-program-search-feedback").textContent = "";
  classicProgramSearchDialog.showModal();
  requiredElement<HTMLInputElement>("#classic-program-search-query").focus();
}
function findClassicProgramText(fromStart = false): boolean {
  const query = requiredElement<HTMLInputElement>("#classic-program-search-query").value;
  const found = classicProgramEditor.findText(query, fromStart, requiredElement<HTMLInputElement>("#classic-program-search-case").checked, requiredElement<HTMLInputElement>("#classic-program-search-word").checked);
  requiredElement("#classic-program-search-feedback").textContent = found ? `Found “${query}”.` : `No more matches for “${query}”.`;
  return found;
}
requiredElement("#classic-program-edit-find").addEventListener("click", () => showClassicProgramSearch("find"));
requiredElement("#classic-program-edit-find-next").addEventListener("click", () => {
  if (!requiredElement<HTMLInputElement>("#classic-program-search-query").value) showClassicProgramSearch("find");
  else findClassicProgramText();
});
requiredElement("#classic-program-edit-replace").addEventListener("click", () => showClassicProgramSearch("replace"));
requiredElement("#classic-program-search-find").addEventListener("click", () => findClassicProgramText());
for (const [selector, replaceAll] of [["#classic-program-search-replace", false], ["#classic-program-search-replace-all", true]] as const) {
  requiredElement(selector).addEventListener("click", () => {
    const query = requiredElement<HTMLInputElement>("#classic-program-search-query").value;
    const count = classicProgramEditor.replaceText(query, requiredElement<HTMLInputElement>("#classic-program-search-replacement").value, replaceAll, requiredElement<HTMLInputElement>("#classic-program-search-case").checked, requiredElement<HTMLInputElement>("#classic-program-search-word").checked);
    requiredElement("#classic-program-search-feedback").textContent = count ? `Replaced ${count} match${count === 1 ? "" : "es"}.` : `No matches for “${query}”.`;
    renderClassicProgramDocumentState();
  });
}
refreshClassicProjectPrograms();
renderClassicProgramDocumentState();
globalThis.addEventListener("epi-info-project-changed", () => {
  classicProgramSession.reset(getCurrentProjectData());
  renderClassicProgramSession();
  refreshClassicProjectPrograms();
  refreshClassicProgramContext();
});

function closeClassicProgramMenus(): void {
  for (const menu of document.querySelectorAll<HTMLDetailsElement>("#classic-program-menu details")) menu.open = false;
}

for (const surface of [requiredElement("#classic-program-menu"), requiredElement("#classic-program-toolbar")]) {
  surface.addEventListener("click", (event) => {
    const gap = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
    if (!gap) return;
    event.preventDefault();
    classicProgramCommandStatus.textContent = gap.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
  });
}
requiredElement("#classic-output-toolbar").addEventListener("click", (event) => {
  const gap = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
  if (!gap) return;
  event.preventDefault();
  requiredElement("#classic-output-navigation-status").textContent = gap.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
});

const editorAction = (action: () => boolean, message: string): void => {
  action();
  classicProgramEditor.focus();
  closeClassicProgramMenus();
  classicProgramCommandStatus.textContent = message;
};
requiredElement("#classic-program-edit-undo").addEventListener("click", () => editorAction(() => classicProgramEditor.undo(), "Undo applied to the current program."));
requiredElement("#classic-program-edit-redo").addEventListener("click", () => editorAction(() => classicProgramEditor.redo(), "Redo applied to the current program."));
const classicClipboardUnavailableMessage = "Clipboard access was blocked by the browser or organizational policy. Use Ctrl+X, Ctrl+C, or Ctrl+V in the Program Editor.";

async function writeClassicProgramClipboard(cut: boolean): Promise<void> {
  closeClassicProgramMenus();
  const selected = classicProgramEditor.getSelectedText();
  if (!selected) {
    classicProgramCommandStatus.textContent = `Select program text before using ${cut ? "Cut" : "Copy"}.`;
    classicProgramEditor.focus();
    return;
  }
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard write is unavailable.");
    await navigator.clipboard.writeText(selected);
    if (cut) classicProgramEditor.replaceSelectedText("");
    classicProgramCommandStatus.textContent = cut
      ? "Cut the selected program text to the clipboard."
      : "Copied the selected program text to the clipboard.";
  } catch {
    classicProgramCommandStatus.textContent = classicClipboardUnavailableMessage;
  }
  classicProgramEditor.focus();
}

async function pasteClassicProgramClipboard(): Promise<void> {
  let value: string;
  try {
    if (!navigator.clipboard?.readText) throw new Error("Clipboard read is unavailable.");
    value = await navigator.clipboard.readText();
  } catch {
    closeClassicProgramMenus();
    classicProgramCommandStatus.textContent = classicClipboardUnavailableMessage;
    classicProgramEditor.focus();
    return;
  }
  closeClassicProgramMenus();
  if (!value) {
    classicProgramCommandStatus.textContent = "The clipboard contains no text to paste.";
  } else {
    classicProgramEditor.replaceSelectedText(value);
    classicProgramCommandStatus.textContent = "Pasted clipboard text into the current program.";
  }
  classicProgramEditor.focus();
}

requiredElement("#classic-program-edit-cut").addEventListener("click", () => { void writeClassicProgramClipboard(true); });
requiredElement("#classic-program-edit-copy").addEventListener("click", () => { void writeClassicProgramClipboard(false); });
requiredElement("#classic-program-edit-paste").addEventListener("click", () => { void pasteClassicProgramClipboard(); });
requiredElement("#classic-program-edit-select-all").addEventListener("click", () => editorAction(() => classicProgramEditor.selectAll(), "Selected the complete program."));
requiredElement("#classic-program-edit-beginning").addEventListener("click", () => editorAction(() => classicProgramEditor.moveToBeginning(), "Cursor moved to Program Beginning."));
requiredElement("#classic-program-edit-end").addEventListener("click", () => editorAction(() => classicProgramEditor.moveToEnd(), "Cursor moved to Program End."));
const classicCommandDialog = requiredElement<HTMLDialogElement>("#classic-command-dialog");
const classicCommandDialogKind = requiredElement<HTMLSelectElement>("#classic-command-dialog-kind");
classicCommandDialogKind.append(new Option("NEW BRANCH — Convert Access Database", "file-convert"));
const classicCommandDialogAccessFile = requiredElement<HTMLInputElement>("#classic-command-dialog-access-file");
const classicCommandDialogFileConvertTarget = requiredElement<HTMLSelectElement>("#classic-command-dialog-file-convert-target");
const classicCommandDialogFileConvertName = requiredElement<HTMLInputElement>("#classic-command-dialog-file-convert-name");
const classicCommandDialogSource = requiredElement<HTMLSelectElement>("#classic-command-dialog-source");
const classicCommandDialogRelateCurrentKey = requiredElement<HTMLSelectElement>("#classic-command-dialog-relate-current-key");
const classicCommandDialogRelateRelatedKey = requiredElement<HTMLSelectElement>("#classic-command-dialog-relate-related-key");
const classicCommandDialogRelateAll = requiredElement<HTMLInputElement>("#classic-command-dialog-relate-all");
const classicCommandDialogWriteFile = requiredElement<HTMLInputElement>("#classic-command-dialog-write-file");
const classicCommandDialogWriteFields = requiredElement<HTMLSelectElement>("#classic-command-dialog-write-fields");
const classicCommandDialogMergeCurrentKey = requiredElement<HTMLSelectElement>("#classic-command-dialog-merge-current-key");
const classicCommandDialogMergeSourceKey = requiredElement<HTMLSelectElement>("#classic-command-dialog-merge-source-key");
const classicMergePreviewDialog = requiredElement<HTMLDialogElement>("#classic-merge-preview-dialog");
const classicDeletePreviewDialog = requiredElement<HTMLDialogElement>("#classic-delete-preview-dialog");
const classicDeleteRecordsPreviewDialog = requiredElement<HTMLDialogElement>("#classic-delete-records-preview-dialog");
const classicUndeleteRecordsPreviewDialog = requiredElement<HTMLDialogElement>("#classic-undelete-records-preview-dialog");
const classicCommandDialogDeleteAll = requiredElement<HTMLInputElement>("#classic-command-dialog-delete-all");
const classicCommandDialogDeleteField = requiredElement<HTMLSelectElement>("#classic-command-dialog-delete-field");
const classicCommandDialogDeleteOperator = requiredElement<HTMLSelectElement>("#classic-command-dialog-delete-operator");
const classicCommandDialogDeleteValue = requiredElement<HTMLInputElement>("#classic-command-dialog-delete-value");
const classicCommandDialogDeleteBoolean = requiredElement<HTMLSelectElement>("#classic-command-dialog-delete-boolean");
const classicCommandDialogUndeleteAll = requiredElement<HTMLInputElement>("#classic-command-dialog-undelete-all");
const classicCommandDialogUndeleteField = requiredElement<HTMLSelectElement>("#classic-command-dialog-undelete-field");
const classicCommandDialogUndeleteOperator = requiredElement<HTMLSelectElement>("#classic-command-dialog-undelete-operator");
const classicCommandDialogUndeleteValue = requiredElement<HTMLInputElement>("#classic-command-dialog-undelete-value");
const classicCommandDialogUndeleteBoolean = requiredElement<HTMLSelectElement>("#classic-command-dialog-undelete-boolean");
const classicCommandDialogSummarizeAggregate = requiredElement<HTMLSelectElement>("#classic-command-dialog-summarize-aggregate");
const classicCommandDialogSummarizeField = requiredElement<HTMLSelectElement>("#classic-command-dialog-summarize-field");
const classicCommandDialogSummarizeResult = requiredElement<HTMLInputElement>("#classic-command-dialog-summarize-result");
const classicCommandDialogSummarizeTable = requiredElement<HTMLInputElement>("#classic-command-dialog-summarize-table");
const classicCommandDialogSummarizeStrata = requiredElement<HTMLSelectElement>("#classic-command-dialog-summarize-strata");
const classicCommandDialogGraphType = requiredElement<HTMLSelectElement>("#classic-command-dialog-graph-type");
const classicCommandDialogGraphTitle = requiredElement<HTMLInputElement>("#classic-command-dialog-graph-title");
const classicCommandDialogGraphXTitle = requiredElement<HTMLInputElement>("#classic-command-dialog-graph-x-title");
const classicCommandDialogGraphYTitle = requiredElement<HTMLInputElement>("#classic-command-dialog-graph-y-title");
const classicCommandDialogField = requiredElement<HTMLSelectElement>("#classic-command-dialog-field");
const classicCommandDialogExposure = requiredElement<HTMLSelectElement>("#classic-command-dialog-exposure");
const classicCommandDialogOutcome = requiredElement<HTMLSelectElement>("#classic-command-dialog-outcome");
const classicCommandDialogStrata = requiredElement<HTMLSelectElement>("#classic-command-dialog-strata");
const classicCommandDialogWeight = requiredElement<HTMLSelectElement>("#classic-command-dialog-weight");
const classicCommandDialogPsu = requiredElement<HTMLSelectElement>("#classic-command-dialog-psu");
const classicCommandDialogStatistics = requiredElement<HTMLInputElement>("#classic-command-dialog-statistics");
const classicCommandDialogFisher = requiredElement<HTMLInputElement>("#classic-command-dialog-fisher");
const classicCommandDialogOneIsYes = requiredElement<HTMLInputElement>("#classic-command-dialog-one-is-yes");
const classicCommandDialogOutTable = requiredElement<HTMLInputElement>("#classic-command-dialog-outtable");
const classicCommandDialogIncludeMissing = requiredElement<HTMLInputElement>("#classic-command-dialog-include-missing");
let classicComplexTablesDialog = false;
let classicComplexFrequencyDialog = false;
let classicComplexMeansDialog = false;
const classicCommandDialogVariable = requiredElement<HTMLInputElement>("#classic-command-dialog-variable");
const classicCommandDialogScope = requiredElement<HTMLSelectElement>("#classic-command-dialog-scope");
const classicCommandDialogVariableType = requiredElement<HTMLSelectElement>("#classic-command-dialog-variable-type");
const classicCommandDialogPrompt = requiredElement<HTMLInputElement>("#classic-command-dialog-prompt");
const classicCommandDialogRecodeSource = requiredElement<HTMLSelectElement>("#classic-command-dialog-recode-source");
const classicCommandDialogRecodeTarget = requiredElement<HTMLSelectElement>("#classic-command-dialog-recode-target");
const classicCommandDialogRecodeRows = requiredElement<HTMLTableSectionElement>("#classic-command-dialog-recode-rows");
const classicCommandDialogRecodeElse = requiredElement<HTMLInputElement>("#classic-command-dialog-recode-else");
const classicCommandDialogSelectField = requiredElement<HTMLSelectElement>("#classic-command-dialog-select-field");
const classicCommandDialogSelectOperator = requiredElement<HTMLSelectElement>("#classic-command-dialog-select-operator");
const classicCommandDialogSelectValue = requiredElement<HTMLInputElement>("#classic-command-dialog-select-value");
const classicCommandDialogSelectBoolean = requiredElement<HTMLSelectElement>("#classic-command-dialog-select-boolean");
const classicCommandDialogSortRows = requiredElement<HTMLTableSectionElement>("#classic-command-dialog-sort-rows");
const classicCommandDialogAssignVariable = requiredElement<HTMLSelectElement>("#classic-command-dialog-assign-variable");
const classicCommandDialogAssignValue = requiredElement<HTMLInputElement>("#classic-command-dialog-assign-value");
const classicCommandDialogAssignBoolean = requiredElement<HTMLSelectElement>("#classic-command-dialog-assign-boolean");
const classicCommandDialogUndefineVariable = requiredElement<HTMLSelectElement>("#classic-command-dialog-undefine-variable");
const classicCommandDialogUndefineAll = requiredElement<HTMLInputElement>("#classic-command-dialog-undefine-all");
const classicCommandDialogDisplayMode = requiredElement<HTMLSelectElement>("#classic-command-dialog-display-mode");
const classicCommandDialogDisplayVariables = requiredElement<HTMLSelectElement>("#classic-command-dialog-display-variables");
const classicCommandDialogGroupName = requiredElement<HTMLInputElement>("#classic-command-dialog-group-name");
const classicCommandDialogGroupMembers = requiredElement<HTMLSelectElement>("#classic-command-dialog-group-members");
const classicCommandDialogIfVariable = requiredElement<HTMLSelectElement>("#classic-command-dialog-if-variable");
const classicCommandDialogIfOperator = requiredElement<HTMLSelectElement>("#classic-command-dialog-if-operator");
const classicCommandDialogIfValue = requiredElement<HTMLInputElement>("#classic-command-dialog-if-value");
const classicCommandDialogIfThenVariable = requiredElement<HTMLSelectElement>("#classic-command-dialog-if-then-variable");
const classicCommandDialogIfThenValue = requiredElement<HTMLInputElement>("#classic-command-dialog-if-then-value");
const classicCommandDialogIfHasElse = requiredElement<HTMLInputElement>("#classic-command-dialog-if-has-else");
const classicCommandDialogIfElseVariable = requiredElement<HTMLSelectElement>("#classic-command-dialog-if-else-variable");
const classicCommandDialogIfElseValue = requiredElement<HTMLInputElement>("#classic-command-dialog-if-else-value");

function selectedClassicVariable() {
  return classicProgramSession.variables().find((variable) => variable.name === classicCommandDialogAssignVariable.value);
}

function classicIfVariable(select: HTMLSelectElement) {
  return classicProgramSession.variables().find((variable) => variable.name === select.value);
}

function classicIfDialogValue(select: HTMLSelectElement, input: HTMLInputElement) {
  const variable = classicIfVariable(select);
  if (!variable) throw new RangeError("Run Standard DEFINE commands before authoring IF.");
  if (variable.variableType === "YN") {
    const normalized = input.value.trim().toLocaleLowerCase("en-US");
    if (["yes", "yes (+)", "true", "(+)", "+"].includes(normalized)) return true;
    if (["no", "no (-)", "false", "(-)", "-"].includes(normalized)) return false;
    throw new RangeError(`${variable.name} requires Yes (+) or No (-).`);
  }
  return assignmentValueFromInput(variable, input.value);
}

function appendClassicSortRow(field = "", direction: ClassicSortDirection = "ASC"): void {
  const source = classicProgramSession.current(getCurrentProjectData());
  const fields = source.fields.filter((candidate) => candidate.type !== "command-button");
  const row = document.createElement("tr");
  const fieldCell = document.createElement("td");
  const fieldSelect = document.createElement("select");
  fieldSelect.ariaLabel = "Sort variable";
  fieldSelect.dataset.sortField = "true";
  fieldSelect.replaceChildren(...fields.map((candidate) => new Option(candidate.prompt, candidate.name, false, candidate.name === field)));
  fieldCell.append(fieldSelect);
  const directionCell = document.createElement("td");
  const directionSelect = document.createElement("select");
  directionSelect.ariaLabel = "Sort order";
  directionSelect.dataset.sortDirection = "true";
  directionSelect.replaceChildren(new Option("Ascending", "ASC", false, direction === "ASC"), new Option("Descending", "DESC", false, direction === "DESC"));
  directionCell.append(directionSelect);
  const action = document.createElement("td");
  const remove = document.createElement("button");
  remove.type = "button"; remove.className = "text-button"; remove.textContent = "Remove";
  remove.addEventListener("click", () => { row.remove(); refreshClassicCommandDialogPreview(); });
  action.append(remove);
  row.append(fieldCell, directionCell, action);
  classicCommandDialogSortRows.append(row);
}

function resetClassicSortRows(): void {
  classicCommandDialogSortRows.replaceChildren();
  const fields = classicProgramSession.current(getCurrentProjectData()).fields;
  appendClassicSortRow(fields.find((field) => /^(?:id|case.?id)$/i.test(field.name))?.name ?? fields[0]?.name ?? "");
}

function selectedClassicField(): FieldDefinition | undefined {
  return classicProgramSession.current(getCurrentProjectData()).fields.find((field) => field.name === classicCommandDialogSelectField.value);
}

function classicSelectionDialogValue(): string | number | boolean {
  const field = selectedClassicField();
  if (!field) throw new RangeError("Choose a field to select.");
  if (field.type === "number") {
    const value = Number(classicCommandDialogSelectValue.value);
    if (!classicCommandDialogSelectValue.value.trim() || !Number.isFinite(value)) throw new RangeError(`${field.prompt} requires a finite numeric value.`);
    return value;
  }
  if (field.type === "checkbox" || field.type === "yes-no") return classicCommandDialogSelectBoolean.value === "true";
  if (!classicCommandDialogSelectValue.value.trim()) throw new RangeError(`${field.prompt} requires a comparison value.`);
  return classicCommandDialogSelectValue.value;
}

function appendClassicRecodeRange(from = "", to = "", result = ""): void {
  const row = document.createElement("tr");
  const inputs = [
    ["From value", "from", from], ["To value", "to", to], ["Recoded value", "result", result],
  ] as const;
  for (const [label, key, value] of inputs) {
    const cell = document.createElement("td");
    const input = document.createElement("input");
    input.ariaLabel = label;
    input.dataset.recodeRange = key;
    input.value = value;
    cell.append(input);
    row.append(cell);
  }
  const action = document.createElement("td");
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "text-button";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => { row.remove(); refreshClassicCommandDialogPreview(); });
  action.append(remove);
  row.append(action);
  classicCommandDialogRecodeRows.append(row);
}

function resetClassicRecodeRanges(): void {
  classicCommandDialogRecodeRows.replaceChildren();
  appendClassicRecodeRange("LOVALUE", "17", "0-17");
  appendClassicRecodeRange("17", "44", "18-44");
  appendClassicRecodeRange("44", "64", "45-64");
  appendClassicRecodeRange("64", "HIVALUE", "65+");
}

function classicDefinedFields(baseFields: readonly FieldDefinition[]): FieldDefinition[] {
  try {
    const ast = parseClassicProgram(classicProgramEditor.getValue());
    return ast.body.flatMap((statement): FieldDefinition[] => statement.type === "DefineStatement" && statement.variableType
      ? [{ name: statement.variable.name, prompt: statement.prompt ?? statement.variable.name, type: statement.variableType === "NUMERIC" ? "number" : "text", required: false }]
      : []).filter((field) => !baseFields.some((candidate) => candidate.name.toLocaleLowerCase("en-US") === field.name.toLocaleLowerCase("en-US")));
  } catch {
    return [];
  }
}

function classicDeleteRecordsValue(): string | number | boolean {
  const field = classicProgramSession.current(getCurrentProjectData()).fields.find(({ name }) => name === classicCommandDialogDeleteField.value);
  if (!field) throw new RangeError("Choose a current-form field for DELETE RECORDS.");
  if (field.type === "checkbox" || field.type === "yes-no") return classicCommandDialogDeleteBoolean.value === "true";
  const value = classicCommandDialogDeleteValue.value.trim();
  if (!value) throw new RangeError("Enter a DELETE RECORDS comparison value.");
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new RangeError(`${field.prompt} requires a finite numeric value.`);
    return number;
  }
  return value;
}

function classicUndeleteRecordsValue(): string | number | boolean {
  const field = classicProgramSession.current(getCurrentProjectData()).fields.find(({ name }) => name === classicCommandDialogUndeleteField.value);
  if (!field) throw new RangeError("Choose a current-form field for UNDELETE RECORDS.");
  if (field.type === "checkbox" || field.type === "yes-no") return classicCommandDialogUndeleteBoolean.value === "true";
  const value = classicCommandDialogUndeleteValue.value.trim();
  if (!value) throw new RangeError("Enter an UNDELETE RECORDS comparison value.");
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new RangeError(`${field.prompt} requires a finite numeric value.`);
    return number;
  }
  return value;
}

function classicCommandDialogInput(): ClassicAnalysisCommandInput {
  const kind = classicCommandDialogKind.value as ClassicAnalysisCommandKind;
  if (kind === "set-missing") return { kind, enabled: classicCommandDialogIncludeMissing.checked };
  if (kind === "set-missing-label") return { kind, value: classicProgramSession.missingLabel() };
  if (kind === "quality") return { kind };
  if (kind === "file-convert") {
    const file = classicCommandDialogAccessFile.files?.[0];
    if (!file) throw new RangeError("Choose an Access .mdb or .accdb file.");
    return { kind, inputFile: file.name, outputFile: classicCommandDialogFileConvertName.value.trim() };
  }
  if (kind === "read") return { kind, table: classicCommandDialogSource.value };
  if (kind === "relate") return {
    kind, relatedForm: classicCommandDialogSource.value,
    keys: [{ currentField: classicCommandDialogRelateCurrentKey.value, relatedField: classicCommandDialogRelateRelatedKey.value }],
    join: classicCommandDialogRelateAll.checked ? "all" : "matching",
  };
  if (kind === "write") return { kind, fileName: classicCommandDialogWriteFile.value, fields: [...classicCommandDialogWriteFields.selectedOptions].map((option) => option.value) };
  if (kind === "merge") return {
    kind, sourceForm: classicCommandDialogSource.value,
    keys: [{ currentField: classicCommandDialogMergeCurrentKey.value, sourceField: classicCommandDialogMergeSourceKey.value }],
  };
  if (kind === "delete-table") return { kind, formName: classicCommandDialogSource.value };
  if (kind === "delete-records") return classicCommandDialogDeleteAll.checked
    ? { kind, all: true }
    : { kind, all: false, field: classicCommandDialogDeleteField.value, operator: classicCommandDialogDeleteOperator.value as ClassicSelectionOperator, value: classicDeleteRecordsValue() };
  if (kind === "undelete-records") return classicCommandDialogUndeleteAll.checked
    ? { kind, all: true }
    : { kind, all: false, field: classicCommandDialogUndeleteField.value, operator: classicCommandDialogUndeleteOperator.value as ClassicSelectionOperator, value: classicUndeleteRecordsValue() };
  if (kind === "define") return {
    kind, variable: classicCommandDialogVariable.value,
    scope: classicCommandDialogScope.value as ClassicDefineVariableScope,
    variableType: classicCommandDialogVariableType.value as ClassicDefineVariableType,
    ...(classicCommandDialogPrompt.value.trim() ? { prompt: classicCommandDialogPrompt.value } : {}),
  };
  if (kind === "define-group") return { kind, group: classicCommandDialogGroupName.value, members: [...classicCommandDialogGroupMembers.selectedOptions].map((option) => option.value) };
  if (kind === "undefine") return { kind, variable: classicCommandDialogUndefineAll.checked ? "*" : classicCommandDialogUndefineVariable.value };
  if (kind === "assign") {
    const variable = selectedClassicVariable();
    if (!variable) throw new RangeError("Run a Standard DEFINE command before authoring ASSIGN.");
    return { kind, variable: variable.name, value: assignmentValueFromInput(variable, classicCommandDialogAssignValue.value, classicCommandDialogAssignBoolean.value === "true") };
  }
  if (kind === "recode") return {
    kind, sourceField: classicCommandDialogRecodeSource.value, targetVariable: classicCommandDialogRecodeTarget.value,
    ranges: [...classicCommandDialogRecodeRows.querySelectorAll<HTMLTableRowElement>("tr")].map((row) => {
      const to = row.querySelector<HTMLInputElement>('[data-recode-range="to"]')?.value.trim();
      return {
        from: row.querySelector<HTMLInputElement>('[data-recode-range="from"]')?.value ?? "",
        ...(to ? { to } : {}),
        result: row.querySelector<HTMLInputElement>('[data-recode-range="result"]')?.value ?? "",
      };
    }),
    ...(classicCommandDialogRecodeElse.value.trim() ? { elseResult: classicCommandDialogRecodeElse.value } : {}),
  };
  if (kind === "display") return {
    kind, mode: classicCommandDialogDisplayMode.value as ClassicDisplayMode,
    ...(classicCommandDialogDisplayMode.value === "list" ? { variables: [...classicCommandDialogDisplayVariables.selectedOptions].map((option) => option.value) } : {}),
  };
  if (kind === "select") return { kind, field: classicCommandDialogSelectField.value, operator: classicCommandDialogSelectOperator.value as ClassicSelectionOperator, value: classicSelectionDialogValue() };
  if (kind === "cancel-select") return { kind };
  if (kind === "if") return {
    kind, conditionVariable: classicCommandDialogIfVariable.value,
    operator: classicCommandDialogIfOperator.value as ClassicSelectionOperator,
    compareValue: classicIfDialogValue(classicCommandDialogIfVariable, classicCommandDialogIfValue),
    thenVariable: classicCommandDialogIfThenVariable.value,
    thenValue: classicIfDialogValue(classicCommandDialogIfThenVariable, classicCommandDialogIfThenValue),
    ...(classicCommandDialogIfHasElse.checked ? { elseAssignment: {
      variable: classicCommandDialogIfElseVariable.value,
      value: classicIfDialogValue(classicCommandDialogIfElseVariable, classicCommandDialogIfElseValue),
    } } : {}),
  };
  if (kind === "sort") return { kind, items: [...classicCommandDialogSortRows.querySelectorAll<HTMLTableRowElement>("tr")].map((row) => ({
    field: row.querySelector<HTMLSelectElement>('[data-sort-field="true"]')?.value ?? "",
    direction: (row.querySelector<HTMLSelectElement>('[data-sort-direction="true"]')?.value ?? "ASC") as ClassicSortDirection,
  })) };
  if (kind === "cancel-sort") return { kind };
  if (kind === "list") return { kind, fields: [...classicCommandDialogField.selectedOptions].map((option) => option.value) };
  if (kind === "frequency") return {
    kind, field: classicCommandDialogField.value,
    ...(classicCommandDialogStrata.value ? { stratifyBy: classicCommandDialogStrata.value } : {}),
    ...(classicComplexFrequencyDialog && classicCommandDialogWeight.value ? { weightBy: classicCommandDialogWeight.value } : {}),
    ...(classicComplexFrequencyDialog && classicCommandDialogPsu.value ? { psuBy: classicCommandDialogPsu.value } : {}),
    ...(classicComplexFrequencyDialog && classicCommandDialogOutTable.value.trim() ? { outputTable: classicCommandDialogOutTable.value.trim() } : {}),
  };
  if (kind === "means") return { kind, field: classicCommandDialogField.value, ...(classicComplexMeansDialog && classicCommandDialogStrata.value ? { stratifyBy: classicCommandDialogStrata.value } : {}), ...(classicComplexMeansDialog && classicCommandDialogWeight.value ? { weightBy: classicCommandDialogWeight.value } : {}), ...(classicComplexMeansDialog && classicCommandDialogOutTable.value.trim() ? { outputTable: classicCommandDialogOutTable.value.trim() } : {}), ...(classicComplexMeansDialog && classicCommandDialogPsu.value ? { psuBy: classicCommandDialogPsu.value } : {}) };
  if (kind === "summarize") return {
    kind, aggregate: classicCommandDialogSummarizeAggregate.value as ClassicSummarizeAggregate,
    field: classicCommandDialogSummarizeField.value, resultField: classicCommandDialogSummarizeResult.value,
    outputTable: classicCommandDialogSummarizeTable.value,
    ...(classicCommandDialogSummarizeStrata.value ? { stratifyBy: classicCommandDialogSummarizeStrata.value } : {}),
  };
  if (kind === "graph") return {
    kind, field: classicCommandDialogField.value, graphType: classicCommandDialogGraphType.value as ClassicGraphType,
    ...(classicCommandDialogGraphTitle.value.trim() ? { title: classicCommandDialogGraphTitle.value } : {}),
    ...(classicCommandDialogGraphXTitle.value.trim() ? { xTitle: classicCommandDialogGraphXTitle.value } : {}),
    ...(classicCommandDialogGraphYTitle.value.trim() ? { yTitle: classicCommandDialogGraphYTitle.value } : {}),
  };
  return {
    kind, exposure: classicCommandDialogExposure.value, outcome: classicCommandDialogOutcome.value,
    ...(classicCommandDialogStrata.value ? { stratifyBy: [classicCommandDialogStrata.value] } : {}),
    ...(classicCommandDialogWeight.value ? { weightBy: classicCommandDialogWeight.value } : {}),
    ...(classicCommandDialogPsu.value ? { psuBy: classicCommandDialogPsu.value } : {}),
    ...(!classicCommandDialogStatistics.checked ? { statistics: "NONE" as const } : classicCommandDialogFisher.checked ? { statistics: "FISHER" as const } : {}),
    ...(classicCommandDialogOutTable.value.trim() ? { outputTable: classicCommandDialogOutTable.value.trim() } : {}),
    ...(classicCommandDialogOneIsYes.checked ? { oneIsYes: true } : {}),
  };
}

function updateClassicCommandDialog(): void {
  const source = classicProgramSession.current(getCurrentProjectData());
  const kind = classicCommandDialogKind.value as ClassicAnalysisCommandKind;
  const projectSources = kind === "read" ? [...getProjectDataSources(), ...classicProgramSession.outTables()] : getProjectDataSources();
  const read = kind === "read";
  const relate = kind === "relate";
  const write = kind === "write";
  const merge = kind === "merge";
  const deleteTable = kind === "delete-table";
  const deleteRecords = kind === "delete-records";
  const undeleteRecords = kind === "undelete-records";
  const define = kind === "define";
  const defineGroup = kind === "define-group";
  const undefine = kind === "undefine";
  const assign = kind === "assign";
  const recode = kind === "recode";
  const display = kind === "display";
  const select = kind === "select";
  const cancelSelect = kind === "cancel-select";
  const ifCommand = kind === "if";
  const sort = kind === "sort";
  const cancelSort = kind === "cancel-sort";
  const list = kind === "list";
  const means = kind === "means";
  const tables = kind === "tables";
  const summarize = kind === "summarize";
  const graph = kind === "graph";
  const setMissing = kind === "set-missing";
  const quality = kind === "quality";
  const fileConvert = kind === "file-convert";
  const definedFields = classicDefinedFields(source.fields);
  const availableFields = [...source.fields, ...definedFields];
  const sessionVariables = classicProgramSession.variables();
  const sessionGroups = classicProgramSession.groups();
  const previousGroupMembers = new Set([...classicCommandDialogGroupMembers.selectedOptions].map((option) => option.value));
  classicCommandDialogGroupMembers.replaceChildren(
    ...source.fields.map((field) => new Option(`${field.prompt} (Field)`, field.name, false, previousGroupMembers.has(field.name))),
    ...sessionVariables.map((variable) => new Option(`${variable.prompt ?? variable.name} (Defined)`, variable.name, false, previousGroupMembers.has(variable.name))),
  );
  const previousDisplayVariables = new Set([...classicCommandDialogDisplayVariables.selectedOptions].map((option) => option.value));
  classicCommandDialogDisplayVariables.replaceChildren(
    ...source.fields.map((field) => new Option(`${field.prompt} (Field)`, field.name, false, previousDisplayVariables.has(field.name))),
    ...sessionVariables.map((variable) => new Option(`${variable.prompt ?? variable.name} (Defined)`, variable.name, false, previousDisplayVariables.has(variable.name))),
  );
  requiredElement<HTMLElement>("#classic-command-dialog-display-variables-label").hidden = !display || classicCommandDialogDisplayMode.value !== "list";
  const previousUndefineVariable = classicCommandDialogUndefineVariable.value;
  classicCommandDialogUndefineVariable.replaceChildren(...sessionVariables.map((variable) => new Option(`${variable.prompt ?? variable.name} (${variable.variableType})`, variable.name)));
  if (sessionVariables.some((variable) => variable.name === previousUndefineVariable)) classicCommandDialogUndefineVariable.value = previousUndefineVariable;
  classicCommandDialogUndefineVariable.disabled = classicCommandDialogUndefineAll.checked;
  for (const selectElement of [classicCommandDialogIfVariable, classicCommandDialogIfThenVariable, classicCommandDialogIfElseVariable]) {
    const previous = selectElement.value;
    selectElement.replaceChildren(...sessionVariables.map((variable) => new Option(`${variable.prompt ?? variable.name} (${variable.variableType})`, variable.name)));
    if (sessionVariables.some((variable) => variable.name === previous)) selectElement.value = previous;
  }
  for (const [selectElement, input] of [[classicCommandDialogIfVariable, classicCommandDialogIfValue], [classicCommandDialogIfThenVariable, classicCommandDialogIfThenValue], [classicCommandDialogIfElseVariable, classicCommandDialogIfElseValue]] as const) {
    const variable = classicIfVariable(selectElement);
    input.type = variable?.variableType === "NUMERIC" ? "number" : variable?.variableType === "DATEFORMAT" ? "date" : variable?.variableType === "TIMEFORMAT" ? "time" : "text";
    input.placeholder = variable?.variableType === "YN" ? "Yes (+) or No (-)" : "";
  }
  const booleanIf = classicIfVariable(classicCommandDialogIfVariable)?.variableType === "YN";
  classicCommandDialogIfOperator.querySelectorAll<HTMLOptionElement>("option").forEach((option) => { option.disabled = Boolean(booleanIf && !["=", "<>"].includes(option.value)); });
  if (booleanIf && !["=", "<>"].includes(classicCommandDialogIfOperator.value)) classicCommandDialogIfOperator.value = "=";
  requiredElement<HTMLElement>("#classic-command-dialog-if-else-variable-label").hidden = !ifCommand || !classicCommandDialogIfHasElse.checked;
  requiredElement<HTMLElement>("#classic-command-dialog-if-else-value-label").hidden = !ifCommand || !classicCommandDialogIfHasElse.checked;
  const fields = means ? availableFields.filter((field) => field.type === "number") : list
    ? [...availableFields, ...sessionGroups.map((group) => ({ name: group.name, prompt: `${group.name} (group)`, type: "text" as const, required: false }))]
    : availableFields;
  const previousWriteFields = new Set([...classicCommandDialogWriteFields.selectedOptions].map((option) => option.value));
  classicCommandDialogWriteFields.replaceChildren(...source.fields.map((field) => new Option(field.prompt, field.name, false, previousWriteFields.size === 0 || previousWriteFields.has(field.name))));
  const previousSource = classicCommandDialogSource.value;
  classicCommandDialogSource.replaceChildren(...projectSources.map((candidate) => new Option(`${candidate.formName} (${candidate.records.length} records)`, candidate.formName)));
  if (projectSources.some((candidate) => candidate.formName === previousSource)) classicCommandDialogSource.value = previousSource;
  const relatedSource = projectSources.find((candidate) => candidate.formName === classicCommandDialogSource.value) ?? projectSources[0];
  const previousCurrentKey = classicCommandDialogRelateCurrentKey.value;
  classicCommandDialogRelateCurrentKey.replaceChildren(...source.fields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (source.fields.some((field) => field.name === previousCurrentKey)) classicCommandDialogRelateCurrentKey.value = previousCurrentKey;
  const currentKeyType = source.fields.find((field) => field.name === classicCommandDialogRelateCurrentKey.value)?.type;
  const relatedKeyFields = relatedSource?.fields.filter((field) => field.type === currentKeyType) ?? [];
  const previousRelatedKey = classicCommandDialogRelateRelatedKey.value;
  classicCommandDialogRelateRelatedKey.replaceChildren(...relatedKeyFields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (relatedKeyFields.some((field) => field.name === previousRelatedKey)) classicCommandDialogRelateRelatedKey.value = previousRelatedKey;
  const previousMergeCurrentKey = classicCommandDialogMergeCurrentKey.value;
  classicCommandDialogMergeCurrentKey.replaceChildren(...source.fields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (source.fields.some((field) => field.name === previousMergeCurrentKey)) classicCommandDialogMergeCurrentKey.value = previousMergeCurrentKey;
  const mergeKeyType = source.fields.find((field) => field.name === classicCommandDialogMergeCurrentKey.value)?.type;
  const mergeSourceFields = relatedSource?.fields.filter((field) => field.type === mergeKeyType) ?? [];
  const previousMergeSourceKey = classicCommandDialogMergeSourceKey.value;
  classicCommandDialogMergeSourceKey.replaceChildren(...mergeSourceFields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (mergeSourceFields.some((field) => field.name === previousMergeSourceKey)) classicCommandDialogMergeSourceKey.value = previousMergeSourceKey;
  const previousField = classicCommandDialogField.value;
  const previousFields = new Set([...classicCommandDialogField.selectedOptions].map((option) => option.value));
  classicCommandDialogField.multiple = list;
  classicCommandDialogField.size = list ? Math.min(7, Math.max(2, fields.length)) : 1;
  classicCommandDialogField.replaceChildren(...fields.map((field, index) => new Option(field.prompt, field.name, false, list ? previousFields.has(field.name) || (previousFields.size === 0 && index < 3) : field.name === previousField)));
  if (!list && fields.some((field) => field.name === previousField)) classicCommandDialogField.value = previousField;
  const allOptions = source.fields.map((field) => new Option(field.prompt, field.name));
  const previousExposure = classicCommandDialogExposure.value;
  classicCommandDialogExposure.replaceChildren(
    new Option("All eligible variables (*)", "*"),
    ...allOptions.map((option) => option.cloneNode(true)),
    ...sessionGroups.map((group) => new Option(`${group.name} (GROUPVAR · ${group.members.length} fields)`, group.name)),
  );
  if ([...classicCommandDialogExposure.options].some(({ value }) => value === previousExposure)) classicCommandDialogExposure.value = previousExposure;
  classicCommandDialogOutcome.replaceChildren(...allOptions.map((option) => option.cloneNode(true)));
  classicCommandDialogStrata.replaceChildren(new Option("Do not stratify", ""), ...allOptions.map((option) => option.cloneNode(true)));
  const previousWeight = classicCommandDialogWeight.value;
  const weightOptions = source.fields.filter(({ type }) => type === "number");
  classicCommandDialogWeight.replaceChildren(new Option("Do not weight", ""), ...weightOptions.map((field) => new Option(`${field.prompt} (${field.name})`, field.name)));
  if (weightOptions.some(({ name }) => name === previousWeight)) classicCommandDialogWeight.value = previousWeight;
  const previousPsu = classicCommandDialogPsu.value;
  classicCommandDialogPsu.replaceChildren(new Option("Choose the primary sampling unit", ""), ...source.fields.filter(({ type }) => type !== "command-button").map((field) => new Option(`${field.prompt} (${field.name})`, field.name)));
  if (source.fields.some(({ name }) => name === previousPsu)) classicCommandDialogPsu.value = previousPsu;
  const summaryAggregate = classicCommandDialogSummarizeAggregate.value;
  const summaryFields = ["AVG", "STDEV", "STDEVP", "SUM", "VAR", "VARP"].includes(summaryAggregate) ? source.fields.filter(({ type }) => type === "number") : source.fields;
  const previousSummaryField = classicCommandDialogSummarizeField.value;
  classicCommandDialogSummarizeField.replaceChildren(...summaryFields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (summaryFields.some(({ name }) => name === previousSummaryField)) classicCommandDialogSummarizeField.value = previousSummaryField;
  const previousSummaryStrata = classicCommandDialogSummarizeStrata.value;
  classicCommandDialogSummarizeStrata.replaceChildren(new Option("Do not group", ""), ...source.fields.filter(({ name }) => name !== classicCommandDialogSummarizeField.value).map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if ([...classicCommandDialogSummarizeStrata.options].some(({ value }) => value === previousSummaryStrata)) classicCommandDialogSummarizeStrata.value = previousSummaryStrata;
  const previousRecodeSource = classicCommandDialogRecodeSource.value;
  const numericOptions = source.fields.filter((field) => field.type === "number");
  classicCommandDialogRecodeSource.replaceChildren(...numericOptions.map((field) => new Option(field.prompt, field.name)));
  if (numericOptions.some((field) => field.name === previousRecodeSource)) classicCommandDialogRecodeSource.value = previousRecodeSource;
  const previousRecodeTarget = classicCommandDialogRecodeTarget.value;
  classicCommandDialogRecodeTarget.replaceChildren(...availableFields.map((field) => new Option(`${field.prompt}${definedFields.includes(field) ? " (defined)" : ""}`, field.name)));
  if (availableFields.some((field) => field.name === previousRecodeTarget)) classicCommandDialogRecodeTarget.value = previousRecodeTarget;
  const previousAssignVariable = classicCommandDialogAssignVariable.value;
  classicCommandDialogAssignVariable.replaceChildren(...sessionVariables.map((variable) => new Option(`${variable.prompt ?? variable.name} (${variable.variableType})`, variable.name)));
  if (sessionVariables.some((variable) => variable.name === previousAssignVariable)) classicCommandDialogAssignVariable.value = previousAssignVariable;
  const assignVariable = selectedClassicVariable();
  const booleanAssignment = assignVariable?.variableType === "YN";
  requiredElement<HTMLElement>("#classic-command-dialog-assign-value-label").hidden = !assign || booleanAssignment;
  requiredElement<HTMLElement>("#classic-command-dialog-assign-boolean-label").hidden = !assign || !booleanAssignment;
  classicCommandDialogAssignValue.type = assignVariable?.variableType === "NUMERIC" ? "number" : assignVariable?.variableType === "DATEFORMAT" ? "date" : assignVariable?.variableType === "TIMEFORMAT" ? "time" : "text";
  const previousSelectField = classicCommandDialogSelectField.value;
  const selectableFields = source.fields.filter((field) => field.type !== "command-button");
  classicCommandDialogSelectField.replaceChildren(...selectableFields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (selectableFields.some((field) => field.name === previousSelectField)) classicCommandDialogSelectField.value = previousSelectField;
  const previousDeleteField = classicCommandDialogDeleteField.value;
  classicCommandDialogDeleteField.replaceChildren(...selectableFields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (selectableFields.some((field) => field.name === previousDeleteField)) classicCommandDialogDeleteField.value = previousDeleteField;
  const deleteField = source.fields.find(({ name }) => name === classicCommandDialogDeleteField.value);
  const booleanDelete = deleteField?.type === "checkbox" || deleteField?.type === "yes-no";
  const deleteAll = deleteRecords && classicCommandDialogDeleteAll.checked;
  requiredElement<HTMLElement>("#classic-command-dialog-delete-field-label").hidden = !deleteRecords || deleteAll;
  requiredElement<HTMLElement>("#classic-command-dialog-delete-operator-label").hidden = !deleteRecords || deleteAll;
  requiredElement<HTMLElement>("#classic-command-dialog-delete-value-label").hidden = !deleteRecords || deleteAll || booleanDelete;
  requiredElement<HTMLElement>("#classic-command-dialog-delete-boolean-label").hidden = !deleteRecords || deleteAll || !booleanDelete;
  classicCommandDialogDeleteValue.type = deleteField?.type === "number" ? "number" : deleteField?.type === "date" ? "date" : deleteField?.type === "time" ? "time" : "text";
  classicCommandDialogDeleteOperator.querySelectorAll<HTMLOptionElement>("option").forEach((option) => { option.disabled = Boolean(booleanDelete && !["=", "<>"].includes(option.value)); });
  if (booleanDelete && !["=", "<>"].includes(classicCommandDialogDeleteOperator.value)) classicCommandDialogDeleteOperator.value = "=";
  const previousUndeleteField = classicCommandDialogUndeleteField.value;
  classicCommandDialogUndeleteField.replaceChildren(...selectableFields.map((field) => new Option(`${field.prompt} (${field.type})`, field.name)));
  if (selectableFields.some((field) => field.name === previousUndeleteField)) classicCommandDialogUndeleteField.value = previousUndeleteField;
  const undeleteField = source.fields.find(({ name }) => name === classicCommandDialogUndeleteField.value);
  const booleanUndelete = undeleteField?.type === "checkbox" || undeleteField?.type === "yes-no";
  const undeleteAll = undeleteRecords && classicCommandDialogUndeleteAll.checked;
  requiredElement<HTMLElement>("#classic-command-dialog-undelete-field-label").hidden = !undeleteRecords || undeleteAll;
  requiredElement<HTMLElement>("#classic-command-dialog-undelete-operator-label").hidden = !undeleteRecords || undeleteAll;
  requiredElement<HTMLElement>("#classic-command-dialog-undelete-value-label").hidden = !undeleteRecords || undeleteAll || booleanUndelete;
  requiredElement<HTMLElement>("#classic-command-dialog-undelete-boolean-label").hidden = !undeleteRecords || undeleteAll || !booleanUndelete;
  classicCommandDialogUndeleteValue.type = undeleteField?.type === "number" ? "number" : undeleteField?.type === "date" ? "date" : undeleteField?.type === "time" ? "time" : "text";
  classicCommandDialogUndeleteOperator.querySelectorAll<HTMLOptionElement>("option").forEach((option) => { option.disabled = Boolean(booleanUndelete && !["=", "<>"].includes(option.value)); });
  if (booleanUndelete && !["=", "<>"].includes(classicCommandDialogUndeleteOperator.value)) classicCommandDialogUndeleteOperator.value = "=";
  const selectField = selectedClassicField();
  const booleanSelection = selectField?.type === "checkbox" || selectField?.type === "yes-no";
  requiredElement<HTMLElement>("#classic-command-dialog-select-value-label").hidden = !select || booleanSelection;
  requiredElement<HTMLElement>("#classic-command-dialog-select-boolean-label").hidden = !select || !booleanSelection;
  classicCommandDialogSelectValue.type = selectField?.type === "number" ? "number" : selectField?.type === "date" ? "date" : selectField?.type === "time" ? "time" : "text";
  classicCommandDialogSelectOperator.querySelectorAll<HTMLOptionElement>('option').forEach((option) => { option.disabled = Boolean(booleanSelection && !["=", "<>"].includes(option.value)); });
  if (booleanSelection && !["=", "<>"].includes(classicCommandDialogSelectOperator.value)) classicCommandDialogSelectOperator.value = "=";
  requiredElement<HTMLElement>("#classic-command-dialog-source-label").hidden = !read && !relate && !merge && !deleteTable;
  requiredElement("#classic-command-dialog-source-label").firstChild!.textContent = deleteTable ? "Project form data table" : merge ? "Source project form" : relate ? "Related project form" : "Project form";
  requiredElement<HTMLElement>("#classic-command-dialog-relate").hidden = !relate;
  requiredElement<HTMLElement>("#classic-command-dialog-write").hidden = !write;
  requiredElement<HTMLElement>("#classic-command-dialog-merge").hidden = !merge;
  requiredElement<HTMLElement>("#classic-command-dialog-delete-table").hidden = !deleteTable;
  requiredElement<HTMLElement>("#classic-command-dialog-delete-records").hidden = !deleteRecords;
  requiredElement<HTMLElement>("#classic-command-dialog-undelete-records").hidden = !undeleteRecords;
  requiredElement<HTMLElement>("#classic-command-dialog-define").hidden = !define;
  requiredElement<HTMLElement>("#classic-command-dialog-define-group").hidden = !defineGroup;
  requiredElement<HTMLElement>("#classic-command-dialog-undefine").hidden = !undefine;
  requiredElement<HTMLElement>("#classic-command-dialog-assign").hidden = !assign;
  requiredElement<HTMLElement>("#classic-command-dialog-recode").hidden = !recode;
  requiredElement<HTMLElement>("#classic-command-dialog-display").hidden = !display;
  requiredElement<HTMLElement>("#classic-command-dialog-select").hidden = !select;
  requiredElement<HTMLElement>("#classic-command-dialog-if").hidden = !ifCommand;
  requiredElement<HTMLElement>("#classic-command-dialog-sort").hidden = !sort;
  requiredElement<HTMLElement>("#classic-command-dialog-summarize").hidden = !summarize;
  requiredElement<HTMLElement>("#classic-command-dialog-graph").hidden = !graph;
  requiredElement<HTMLElement>("#classic-command-dialog-set-missing").hidden = !setMissing;
  requiredElement<HTMLElement>("#classic-command-dialog-quality").hidden = !quality;
  requiredElement<HTMLElement>("#classic-command-dialog-file-convert").hidden = !fileConvert;
  requiredElement<HTMLElement>("#classic-command-dialog-field-label").hidden = read || relate || write || merge || deleteTable || deleteRecords || undeleteRecords || define || defineGroup || undefine || assign || recode || display || select || cancelSelect || ifCommand || sort || cancelSort || tables || summarize || setMissing || quality || fileConvert;
  requiredElement<HTMLElement>("#classic-command-dialog-exposure-label").hidden = !tables;
  requiredElement<HTMLElement>("#classic-command-dialog-outcome-label").hidden = !tables;
  requiredElement<HTMLElement>("#classic-command-dialog-fisher-label").hidden = !tables || classicComplexTablesDialog;
  requiredElement<HTMLElement>("#classic-command-dialog-statistics-label").hidden = !tables || classicComplexTablesDialog;
  requiredElement<HTMLElement>("#classic-command-dialog-one-is-yes-label").hidden = !tables || classicComplexTablesDialog;
  requiredElement<HTMLElement>("#classic-command-dialog-weight-label").hidden = !tables && !classicComplexFrequencyDialog && !classicComplexMeansDialog;
  requiredElement<HTMLElement>("#classic-command-dialog-psu-label").hidden = (!tables || !classicComplexTablesDialog) && !classicComplexFrequencyDialog && !classicComplexMeansDialog;
  const outTableLabel = requiredElement<HTMLElement>("#classic-command-dialog-outtable-label");
  outTableLabel.hidden = !tables && !classicComplexFrequencyDialog && !classicComplexMeansDialog;
  outTableLabel.firstChild!.textContent = classicComplexMeansDialog ? "Output table (optional · browser adaptation)" : "Output table (optional)";
  requiredElement<HTMLElement>("#classic-command-dialog-strata-label").hidden = read || relate || write || merge || deleteTable || deleteRecords || undeleteRecords || define || defineGroup || undefine || assign || recode || display || select || cancelSelect || ifCommand || sort || cancelSort || list || (means && !classicComplexMeansDialog) || summarize || graph || setMissing || quality || fileConvert;
  requiredElement("#classic-command-dialog-field-label").firstChild!.textContent = list ? "Fields to list" : means ? "Means of" : graph ? "Graph variable" : "Frequency of";
  const byHint = (pattern: RegExp, excluded = new Set<string>()): string | undefined => source.fields.find((field) => !excluded.has(field.name) && pattern.test(`${field.name} ${field.prompt}`))?.name;
  if (kind === "frequency") classicCommandDialogField.value = byHint(/case.?status|status/) ?? classicCommandDialogField.value;
  if (classicComplexFrequencyDialog) {
    classicCommandDialogStrata.value = byHint(/^sex| sex|gender/, new Set([classicCommandDialogField.value])) ?? "";
    classicCommandDialogWeight.value = byHint(/^age| age|weight/, new Set([classicCommandDialogField.value, classicCommandDialogStrata.value])) ?? "";
    classicCommandDialogPsu.value = byHint(/household.?neighborhood|cluster|psu/, new Set([classicCommandDialogField.value, classicCommandDialogStrata.value, classicCommandDialogWeight.value])) ?? "";
  }
  if (classicComplexMeansDialog) {
    classicCommandDialogStrata.value = byHint(/case.?status|status/, new Set([classicCommandDialogField.value])) ?? "";
    classicCommandDialogPsu.value = byHint(/household.?neighborhood|cluster|psu/, new Set([classicCommandDialogField.value, classicCommandDialogStrata.value])) ?? "";
    classicCommandDialogWeight.value = "";
  }
  if (graph) classicCommandDialogField.value = byHint(/case.?status|status/) ?? classicCommandDialogField.value;
  if (kind === "means") classicCommandDialogField.value = byHint(/age|duration|amount|count|weight/) ?? classicCommandDialogField.value;
  if (recode) {
    classicCommandDialogRecodeSource.value = byHint(/age|duration|amount|count|weight/) ?? classicCommandDialogRecodeSource.value;
    const definedTarget = definedFields.find((field) => field.type === "text");
    if (definedTarget) classicCommandDialogRecodeTarget.value = definedTarget.name;
  }
  if (tables) {
    classicCommandDialogExposure.value = byHint(/potato.?salad|expos/) ?? classicCommandDialogExposure.value;
    classicCommandDialogOutcome.value = byHint(/case.?status|outcome|ill/, new Set([classicCommandDialogExposure.value])) ?? classicCommandDialogOutcome.value;
    classicCommandDialogStrata.value = byHint(/^sex| sex|gender/, new Set([classicCommandDialogExposure.value, classicCommandDialogOutcome.value])) ?? "";
    if ([classicCommandDialogExposure.value, classicCommandDialogOutcome.value, classicCommandDialogStrata.value].includes(classicCommandDialogWeight.value)) classicCommandDialogWeight.value = "";
    if (classicComplexTablesDialog && !classicCommandDialogPsu.value) classicCommandDialogPsu.value = byHint(/household.?neighborhood|cluster|psu/) ?? "";
    if (!classicComplexTablesDialog) classicCommandDialogPsu.value = "";
    if (classicComplexTablesDialog) { classicCommandDialogFisher.checked = false; classicCommandDialogOneIsYes.checked = false; }
    classicCommandDialogFisher.disabled = Boolean(classicCommandDialogWeight.value || !classicCommandDialogStatistics.checked);
    if (classicCommandDialogWeight.value || !classicCommandDialogStatistics.checked) classicCommandDialogFisher.checked = false;
  }
  try {
    const input = classicCommandDialogInput();
    if (classicComplexTablesDialog && input.kind === "tables" && !input.psuBy) throw new RangeError("Choose the primary sampling unit variable.");
    if (classicComplexFrequencyDialog && input.kind === "frequency" && !input.psuBy) throw new RangeError("Choose the primary sampling unit variable.");
    if (classicComplexMeansDialog && input.kind === "means" && !input.psuBy) throw new RangeError("Choose the primary sampling unit variable.");
    if (Object.values(input).some((value) => value === "")) throw new RangeError("Choose every required variable.");
    if (input.kind === "define" && availableFields.some((field) => field.name.toLocaleLowerCase("en-US") === input.variable.trim().toLocaleLowerCase("en-US"))) {
      throw new RangeError(`${input.variable.trim()} already exists in the active Classic Analysis data or program.`);
    }
    const command = buildClassicAnalysisCommand(input);
    parseClassicProgram(command);
    if (input.kind === "define") resolveClassicDefineCommand(command, source.fields, sessionVariables, sessionGroups);
    if (input.kind === "relate") resolveClassicRelateCommand(command, source.fields, projectSources);
    if (input.kind === "write") resolveClassicWriteCommand(command, source.fields, sessionGroups);
    if (input.kind === "merge") resolveClassicMergeCommand(command, source.fields, projectSources);
    if (input.kind === "delete-table") resolveClassicDeleteTableCommand(command, projectSources);
    if (input.kind === "delete-records") resolveClassicDeleteRecordsCommand(command, source.fields);
    if (input.kind === "undelete-records") resolveClassicUndeleteRecordsCommand(command, source.fields);
    if (input.kind === "summarize") resolveClassicSummarizeCommand(command, source.fields);
    if (input.kind === "graph") resolveClassicGraphCommand(command, source.fields);
    if (input.kind === "quality") resolveEpiAiQualityCommand(command, source.fields);
    if (input.kind === "file-convert") resolveFileConvertCommand(command);
    if (input.kind === "define-group") resolveClassicDefineGroupCommand(command, source.fields, sessionVariables, sessionGroups);
    if (input.kind === "undefine") resolveClassicUndefineCommand(command, source.fields, sessionVariables);
    if (input.kind === "assign") resolveClassicAssignCommand(command, source.fields, sessionVariables);
    if (input.kind === "display") resolveClassicDisplayCommand(command, source.fields, sessionVariables);
    if (input.kind === "select" || input.kind === "cancel-select") resolveClassicSelectionCommand(command, source.fields);
    if (input.kind === "if") resolveClassicIfCommand(command, source.fields, sessionVariables);
    if (input.kind === "sort" || input.kind === "cancel-sort") resolveClassicSortCommand(command, source.fields);
    if (input.kind === "tables" || input.kind === "frequency" || input.kind === "means") resolveSelectedClassicAnalysisCommand(command, source.fields, projectSources, sessionVariables, sessionGroups);
    requiredElement("#classic-command-dialog-preview").textContent = command;
    requiredElement("#classic-command-dialog-feedback").textContent = "Ready to insert visible source at the current selection or cursor.";
    requiredElement<HTMLButtonElement>("#classic-command-dialog-insert").disabled = false;
  } catch (error) {
    requiredElement("#classic-command-dialog-preview").textContent = kind === "read" ? "READ" : kind === "relate" ? "RELATE" : kind === "write" ? "WRITE" : kind === "merge" ? "MERGE" : kind === "delete-table" ? "DELETE TABLES" : kind === "delete-records" ? "DELETE" : kind === "undelete-records" ? "UNDELETE" : kind === "define" ? "DEFINE" : kind === "define-group" ? "DEFINE GROUPVAR" : kind === "undefine" ? "UNDEFINE" : kind === "assign" ? "ASSIGN" : kind === "recode" ? "RECODE" : kind === "display" ? "DISPLAY DBVARIABLES" : kind === "select" ? "SELECT" : kind === "cancel-select" ? "CANCEL SELECT" : kind === "if" ? "IF" : kind === "sort" ? "SORT" : kind === "cancel-sort" ? "CANCEL SORT" : kind === "list" ? "LIST" : kind === "frequency" ? "FREQ" : kind === "means" ? "MEANS" : kind === "summarize" ? "SUMMARIZE" : kind === "graph" ? "GRAPH" : kind === "quality" ? "EPIAI QUALITY *" : kind === "file-convert" ? "FILE CONVERT" : "TABLES";
    requiredElement("#classic-command-dialog-feedback").textContent = error instanceof Error ? error.message : "Choose valid command fields.";
    requiredElement<HTMLButtonElement>("#classic-command-dialog-insert").disabled = true;
  }
}

function showClassicCommandDialog(kind: ClassicAnalysisCommandKind = "frequency", complexTables = false, complexFrequency = false, complexMeans = false): void {
  closeClassicProgramMenus();
  classicComplexTablesDialog = kind === "tables" && complexTables;
  classicComplexFrequencyDialog = kind === "frequency" && complexFrequency;
  classicComplexMeansDialog = kind === "means" && complexMeans;
  classicCommandDialogKind.value = kind;
  if (kind === "recode" && classicCommandDialogRecodeRows.rows.length === 0) resetClassicRecodeRanges();
  if (kind === "sort") resetClassicSortRows();
  const title = complexTables ? "Complex Sample Tables" : kind === "read" ? "Read" : kind === "relate" ? "Relate" : kind === "write" ? "Write (Export)" : kind === "merge" ? "Merge" : kind === "delete-table" ? "Delete File/Table" : kind === "delete-records" ? "Delete Records" : kind === "undelete-records" ? "Undelete Records" : kind === "define" ? "Define" : kind === "define-group" ? "DefineGroup" : kind === "undefine" ? "Undefine" : kind === "assign" ? "Assign" : kind === "recode" ? "Recode" : kind === "display" ? "Display" : kind === "select" ? "Select" : kind === "cancel-select" ? "Cancel Select" : kind === "if" ? "If" : kind === "sort" ? "Sort" : kind === "cancel-sort" ? "Cancel Sort" : kind === "list" ? "List" : kind === "frequency" ? "Frequencies" : kind === "means" ? "Means" : kind === "summarize" ? "Summarize" : kind === "graph" ? "Graph" : kind === "quality" ? "NEW BRANCH — Quality Profile" : kind === "file-convert" ? "NEW BRANCH — Convert Access Database" : "Tables";
  requiredElement("#classic-command-dialog-title").textContent = `${complexFrequency ? "Complex Sample Frequencies" : complexMeans ? "Complex Sample Means" : title} Command`;
  updateClassicCommandDialog();
  classicCommandDialog.showModal();
  classicProgramCommandStatus.textContent = "Typed command dialog opened. Nothing executes until visible source is selected and run.";
  classicMessageArea.textContent = `Message Area: ${title} command dialog opened.`;
}

classicCommandDialogKind.addEventListener("change", () => {
  if (classicCommandDialogKind.value !== "frequency") classicComplexFrequencyDialog = false;
  if (classicCommandDialogKind.value !== "tables") classicComplexTablesDialog = false;
  if (classicCommandDialogKind.value !== "means") classicComplexMeansDialog = false;
  if (classicCommandDialogKind.value === "recode" && classicCommandDialogRecodeRows.rows.length === 0) resetClassicRecodeRanges();
  if (classicCommandDialogKind.value === "sort" && classicCommandDialogSortRows.rows.length === 0) resetClassicSortRows();
  updateClassicCommandDialog();
});
classicCommandDialogAccessFile.addEventListener("change", () => {
  const file = classicCommandDialogAccessFile.files?.[0];
  if (file) classicCommandDialogFileConvertName.value = file.name.replace(/\.(?:mdb|accdb)$/i, "") + `.${classicCommandDialogFileConvertTarget.value}`;
  updateClassicCommandDialog();
});
classicCommandDialogFileConvertTarget.addEventListener("change", () => {
  classicCommandDialogFileConvertName.value = classicCommandDialogFileConvertName.value.replace(/\.(?:sqlite|duckdb)$/i, "") + `.${classicCommandDialogFileConvertTarget.value}`;
  refreshClassicCommandDialogPreview();
});
classicCommandDialogFileConvertName.addEventListener("input", refreshClassicCommandDialogPreview);
function refreshClassicCommandDialogPreview(): void {
  try {
    if (classicCommandDialogKind.value === "tables") {
      classicCommandDialogFisher.disabled = Boolean(classicCommandDialogWeight.value || !classicCommandDialogStatistics.checked);
      if (classicCommandDialogWeight.value || !classicCommandDialogStatistics.checked) classicCommandDialogFisher.checked = false;
    }
    const input = classicCommandDialogInput();
    if (classicComplexTablesDialog && input.kind === "tables" && !input.psuBy) throw new RangeError("Choose the primary sampling unit variable.");
    if (classicComplexFrequencyDialog && input.kind === "frequency" && !input.psuBy) throw new RangeError("Choose the primary sampling unit variable.");
    if (classicComplexMeansDialog && input.kind === "means" && !input.psuBy) throw new RangeError("Choose the primary sampling unit variable.");
    if (input.kind === "define") {
      const source = classicProgramSession.current(getCurrentProjectData());
      const fields = [...source.fields, ...classicDefinedFields(source.fields)];
      if (fields.some((field) => field.name.toLocaleLowerCase("en-US") === input.variable.trim().toLocaleLowerCase("en-US"))) {
        throw new RangeError(`${input.variable.trim()} already exists in the active Classic Analysis data or program.`);
      }
    }
    const command = buildClassicAnalysisCommand(input);
    parseClassicProgram(command);
    if (input.kind === "define") resolveClassicDefineCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, classicProgramSession.variables(), classicProgramSession.groups());
    if (input.kind === "relate") resolveClassicRelateCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, getProjectDataSources());
    if (input.kind === "write") resolveClassicWriteCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, classicProgramSession.groups());
    if (input.kind === "merge") resolveClassicMergeCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, getProjectDataSources());
    if (input.kind === "delete-table") resolveClassicDeleteTableCommand(command, getProjectDataSources());
    if (input.kind === "delete-records") resolveClassicDeleteRecordsCommand(command, classicProgramSession.current(getCurrentProjectData()).fields);
    if (input.kind === "undelete-records") resolveClassicUndeleteRecordsCommand(command, classicProgramSession.current(getCurrentProjectData()).fields);
    if (input.kind === "summarize") resolveClassicSummarizeCommand(command, classicProgramSession.current(getCurrentProjectData()).fields);
    if (input.kind === "define-group") resolveClassicDefineGroupCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, classicProgramSession.variables(), classicProgramSession.groups());
    if (input.kind === "undefine") resolveClassicUndefineCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, classicProgramSession.variables());
    if (input.kind === "assign") resolveClassicAssignCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, classicProgramSession.variables());
    if (input.kind === "display") resolveClassicDisplayCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, classicProgramSession.variables());
    if (input.kind === "select" || input.kind === "cancel-select") resolveClassicSelectionCommand(command, classicProgramSession.current(getCurrentProjectData()).fields);
    if (input.kind === "if") resolveClassicIfCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, classicProgramSession.variables());
    if (input.kind === "sort" || input.kind === "cancel-sort") resolveClassicSortCommand(command, classicProgramSession.current(getCurrentProjectData()).fields);
    if (input.kind === "tables") resolveSelectedClassicAnalysisCommand(command, classicProgramSession.current(getCurrentProjectData()).fields, getProjectDataSources(), classicProgramSession.variables(), classicProgramSession.groups());
    requiredElement("#classic-command-dialog-preview").textContent = command;
    requiredElement("#classic-command-dialog-feedback").textContent = "Ready to insert visible source at the current selection or cursor.";
    requiredElement<HTMLButtonElement>("#classic-command-dialog-insert").disabled = Object.values(input).some((value) => value === "");
  } catch (error) {
    requiredElement("#classic-command-dialog-feedback").textContent = error instanceof Error ? error.message : "Choose valid command fields.";
    requiredElement<HTMLButtonElement>("#classic-command-dialog-insert").disabled = true;
  }
}
classicCommandDialogSource.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogRelateCurrentKey.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogRelateRelatedKey.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogRelateAll.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogWriteFile.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogWriteFields.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogMergeCurrentKey.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogMergeSourceKey.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogDeleteAll.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogDeleteField.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogDeleteOperator.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogDeleteBoolean.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogDeleteValue.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogUndeleteAll.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogUndeleteField.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogUndeleteOperator.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogUndeleteBoolean.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogUndeleteValue.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogSummarizeAggregate.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogSummarizeField.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogSummarizeResult.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogSummarizeTable.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogSummarizeStrata.addEventListener("change", refreshClassicCommandDialogPreview);
for (const select of [classicCommandDialogField, classicCommandDialogExposure, classicCommandDialogOutcome, classicCommandDialogStrata, classicCommandDialogWeight, classicCommandDialogPsu, classicCommandDialogScope, classicCommandDialogVariableType, classicCommandDialogRecodeSource, classicCommandDialogRecodeTarget, classicCommandDialogSelectOperator, classicCommandDialogSelectBoolean, classicCommandDialogAssignBoolean, classicCommandDialogIfOperator]) select.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogFisher.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogStatistics.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogOneIsYes.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogOutTable.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogIncludeMissing.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogGraphType.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogDisplayMode.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogDisplayVariables.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogAssignVariable.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogUndefineVariable.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogUndefineAll.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogSelectField.addEventListener("change", updateClassicCommandDialog);
for (const select of [classicCommandDialogIfVariable, classicCommandDialogIfThenVariable, classicCommandDialogIfElseVariable]) select.addEventListener("change", updateClassicCommandDialog);
classicCommandDialogIfHasElse.addEventListener("change", updateClassicCommandDialog);
for (const input of [classicCommandDialogVariable, classicCommandDialogPrompt, classicCommandDialogRecodeElse, classicCommandDialogSelectValue, classicCommandDialogAssignValue, classicCommandDialogIfValue, classicCommandDialogIfThenValue, classicCommandDialogIfElseValue, classicCommandDialogGraphTitle, classicCommandDialogGraphXTitle, classicCommandDialogGraphYTitle]) input.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogGroupName.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogGroupMembers.addEventListener("change", refreshClassicCommandDialogPreview);
classicCommandDialogRecodeRows.addEventListener("input", refreshClassicCommandDialogPreview);
classicCommandDialogSortRows.addEventListener("change", refreshClassicCommandDialogPreview);
requiredElement("#classic-command-dialog-add-range").addEventListener("click", () => { appendClassicRecodeRange(); refreshClassicCommandDialogPreview(); });
requiredElement("#classic-command-dialog-add-sort").addEventListener("click", () => { appendClassicSortRow(); refreshClassicCommandDialogPreview(); });
requiredElement("#classic-command-dialog-insert").addEventListener("click", () => {
  try {
    const input = classicCommandDialogInput();
    const command = buildClassicAnalysisCommand(input);
    classicProgramEditor.replaceSelection(command, input.kind !== "define" && input.kind !== "recode");
    classicCommandDialog.close();
    classicProgramCommandStatus.textContent = `Inserted ${command.split("\n", 1)[0]}. The visible source is ready for review; execution authority is unchanged.`;
    renderClassicProgramDocumentState();
  } catch (error) {
    requiredElement("#classic-command-dialog-feedback").textContent = error instanceof Error ? error.message : "Unable to insert the command.";
  }
});
requiredElement("#classic-program-edit-insert-command").addEventListener("click", () => showClassicCommandDialog());
classicProgramToolbarRun.addEventListener("click", () => {
  // Legacy ProgramEditor.btnRun_Click executes highlighted source first and
  // falls back to the complete PGM only when the editor has no selection.
  void startClassicProgramTask((signal) => classicProgramEditor.getSelectedText().trim()
    ? runSelectedClassicCommand(undefined, false, signal)
    : runClassicProgram(false, signal));
});
classicProgramToolbarCancel.addEventListener("click", () => {
  if (!classicProgramRunController || classicProgramRunController.signal.aborted) return;
  classicProgramRunController.abort();
  classicProgramToolbarCancel.disabled = true;
  classicProgramCommandStatus.textContent = "Cancellation requested; the current statement will finish safely.";
});

const classicOutputTargets = ["#classic-program-output", "#classic-sequential-output", "#classic-display-output", "#classic-list-output", "#classic-summarize-output", "#classic-graph-output", "#classic-tables-categorical-output", "#classic-quality-output", "#classic-file-convert-output", "#frequency-stratified-output", "#frequency-output", "#means-output", "#classic-opened-output", "#classic-program-history-output"];
const classicOutputBrowser = requiredElement<HTMLElement>("#classic-output-browser");
for (const selector of classicOutputTargets) {
  const output = document.querySelector<HTMLElement>(selector);
  if (output) {
    // The parent Output dock controls module visibility. Preserve each document's
    // own hidden state instead of letting shell navigation reveal every result.
    output.removeAttribute("data-module-view");
    classicOutputBrowser.append(output);
  }
}
let classicOutputPosition = -1;
function visibleClassicOutputs(): HTMLElement[] {
  return classicOutputTargets.map((selector) => document.querySelector<HTMLElement>(selector)).filter((target): target is HTMLElement => Boolean(target && !target.hidden));
}
function visitClassicOutput(position: number): void {
  const outputs = visibleClassicOutputs();
  if (outputs.length === 0) {
    requiredElement("#classic-output-navigation-status").textContent = "No command output is available yet.";
    return;
  }
  classicOutputPosition = Math.max(0, Math.min(position, outputs.length - 1));
  const output = outputs[classicOutputPosition]!;
  output.scrollIntoView({ behavior: "smooth", block: "start" });
  const title = output.querySelector("h2, h3")?.textContent?.trim() ?? "Output";
  requiredElement("#classic-output-navigation-status").textContent = `${title} (${classicOutputPosition + 1} of ${outputs.length}).`;
}
requiredElement("#classic-output-previous").addEventListener("click", () => visitClassicOutput(classicOutputPosition <= 0 ? 0 : classicOutputPosition - 1));
requiredElement("#classic-output-next").addEventListener("click", () => visitClassicOutput(classicOutputPosition + 1));
requiredElement("#classic-output-last").addEventListener("click", () => visitClassicOutput(visibleClassicOutputs().length - 1));
requiredElement("#classic-output-history").addEventListener("click", () => {
  requiredElement<HTMLElement>("#classic-program-history-output").hidden = false;
  const history = requiredElement<HTMLDetailsElement>("#classic-program-history");
  history.open = true;
  history.scrollIntoView({ behavior: "smooth", block: "start" });
  requiredElement("#classic-output-navigation-status").textContent = "Command history opened.";
});
requiredElement("#classic-output-clear").addEventListener("click", () => {
  // Legacy OutputWindow.tsbClear_Click navigates the result browser to
  // about:blank. It does not erase SessionHistory, so History can reopen it.
  for (const output of visibleClassicOutputs()) output.hidden = true;
  classicOutputPosition = -1;
  classicOutputBrowser.scrollTop = 0;
  requiredElement("#classic-output-navigation-status").textContent = "Output cleared. Command history is retained.";
  classicOutputBrowser.focus();
});

function currentClassicOutput(): HTMLElement | undefined {
  const outputs = visibleClassicOutputs();
  if (outputs.length === 0) return undefined;
  if (classicOutputPosition < 0) return outputs.at(-1);
  return outputs[Math.max(0, Math.min(classicOutputPosition, outputs.length - 1))] ?? outputs.at(-1);
}

const classicOutputFile = requiredElement<HTMLInputElement>("#classic-output-file");
requiredElement("#classic-output-open").addEventListener("click", () => classicOutputFile.click());
classicOutputFile.addEventListener("change", async () => {
  const file = classicOutputFile.files?.[0];
  classicOutputFile.value = "";
  if (!file) return;
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const allowed = new Set(["htm", "html", "xml", "gif", "jpeg", "jpg", "bmp", "png"]);
  if (!allowed.has(extension)) {
    requiredElement("#classic-output-navigation-status").textContent = "Choose a legacy HTML, XML, GIF, JPEG, BMP, or PNG output file. TIFF rendering remains a browser adaptation gap.";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    requiredElement("#classic-output-navigation-status").textContent = "The selected output exceeds the 10 MB browser safety limit.";
    return;
  }
  const body = requiredElement<HTMLElement>("#classic-opened-output-body");
  if (extension === "htm" || extension === "html") {
    const frame = document.createElement("iframe");
    frame.title = `Saved Epi Info output: ${file.name}`;
    frame.setAttribute("sandbox", "");
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:">`;
    frame.srcdoc = `${policy}${await file.text()}`;
    body.replaceChildren(frame);
  } else if (extension === "xml") {
    const source = document.createElement("pre");
    source.textContent = await file.text();
    body.replaceChildren(source);
  } else {
    const image = document.createElement("img");
    image.alt = `Saved Epi Info output from ${file.name}`;
    const objectUrl = URL.createObjectURL(file);
    image.src = objectUrl;
    image.addEventListener("load", () => URL.revokeObjectURL(objectUrl), { once: true });
    image.addEventListener("error", () => URL.revokeObjectURL(objectUrl), { once: true });
    body.replaceChildren(image);
  }
  requiredElement("#classic-opened-output-title").textContent = file.name;
  const opened = requiredElement<HTMLElement>("#classic-opened-output");
  opened.hidden = false;
  classicOutputPosition = visibleClassicOutputs().indexOf(opened);
  visitClassicOutput(classicOutputPosition);
  requiredElement("#classic-output-navigation-status").textContent = `Opened ${file.name} in the sandboxed Output viewer.`;
});

interface ClassicOutputBookmark { id: string; name: string; outputId: string }
const classicOutputBookmarks: ClassicOutputBookmark[] = [];
const classicOutputBookmarkDialog = requiredElement<HTMLDialogElement>("#classic-output-bookmark-dialog");
const classicOutputBookmarkName = requiredElement<HTMLInputElement>("#classic-output-bookmark-name");
function renderClassicOutputBookmarks(): void {
  requiredElement("#classic-output-bookmark-count").textContent = String(classicOutputBookmarks.length);
  const list = requiredElement("#classic-output-bookmark-list");
  if (classicOutputBookmarks.length === 0) {
    const empty = document.createElement("li"); empty.textContent = "No bookmarks in this session."; list.replaceChildren(empty); return;
  }
  list.replaceChildren(...classicOutputBookmarks.map((bookmark) => {
    const item = document.createElement("li");
    const button = document.createElement("button"); button.type = "button"; button.textContent = bookmark.name;
    button.addEventListener("click", () => {
      const output = document.getElementById(bookmark.outputId);
      if (!output) { requiredElement("#classic-output-navigation-status").textContent = `Bookmark “${bookmark.name}” is no longer available in this session.`; return; }
      output.hidden = false;
      classicOutputPosition = visibleClassicOutputs().indexOf(output);
      visitClassicOutput(classicOutputPosition);
    });
    item.append(button); return item;
  }));
}
requiredElement("#classic-output-bookmark").addEventListener("click", () => {
  const output = currentClassicOutput();
  if (!output) { requiredElement("#classic-output-navigation-status").textContent = "Create or open output before adding a bookmark."; return; }
  classicOutputBookmarkName.value = output.querySelector("h2, h3")?.textContent?.trim() ?? "Output";
  requiredElement("#classic-output-bookmark-feedback").textContent = "";
  classicOutputBookmarkDialog.showModal();
  classicOutputBookmarkName.focus();
});
requiredElement("#classic-output-bookmark-save").addEventListener("click", () => {
  const output = currentClassicOutput();
  const name = classicOutputBookmarkName.value.trim();
  if (!output || !name) { requiredElement("#classic-output-bookmark-feedback").textContent = "Enter a bookmark name for the current output."; return; }
  classicOutputBookmarks.push({ id: crypto.randomUUID(), name, outputId: output.id });
  renderClassicOutputBookmarks();
  classicOutputBookmarkDialog.close();
  requiredElement("#classic-output-navigation-status").textContent = `Bookmarked current output as “${name}”.`;
});

requiredElement("#classic-output-print").addEventListener("click", () => {
  const output = currentClassicOutput();
  if (!output) { requiredElement("#classic-output-navigation-status").textContent = "Create or open output before printing."; return; }
  output.classList.add("classic-output-print-document");
  document.body.classList.add("printing-classic-output");
  const cleanup = (): void => { document.body.classList.remove("printing-classic-output"); output.classList.remove("classic-output-print-document"); };
  globalThis.addEventListener("afterprint", cleanup, { once: true });
  window.print();
  globalThis.setTimeout(cleanup, 0);
  requiredElement("#classic-output-navigation-status").textContent = "Current output sent to the browser print dialog.";
});

const classicOutputWorkspaceShell = requiredElement<HTMLElement>(".classic-workspace-shell");
const classicOutputMaximize = requiredElement<HTMLButtonElement>("#classic-output-maximize");
function setClassicOutputMaximized(maximized: boolean): void {
  classicOutputWorkspaceShell.dataset.outputMaximized = String(maximized);
  classicOutputMaximize.setAttribute("aria-pressed", String(maximized));
  classicOutputMaximize.querySelector("span")!.textContent = maximized ? "Restore" : "Maximize";
  requiredElement("#classic-output-navigation-status").textContent = maximized ? "Output maximized; Command Explorer and Program Editor are hidden." : "Output restored with Command Explorer and Program Editor.";
}
classicOutputMaximize.addEventListener("click", () => setClassicOutputMaximized(classicOutputWorkspaceShell.dataset.outputMaximized !== "true"));
globalThis.addEventListener("keydown", (event) => { if (event.key === "Escape" && classicOutputWorkspaceShell.dataset.outputMaximized === "true") setClassicOutputMaximized(false); });
renderClassicOutputBookmarks();

function selectedClassicProgramExample(): ClassicProgramExample | undefined {
  return classicProgramExamples.find((example) => example.id === classicProgramExampleSelect.value);
}

function renderClassicProgramExampleDescription(): void {
  const example = selectedClassicProgramExample();
  if (!example) {
    classicProgramExampleDescription.textContent = "No compatible program is selected.";
    classicProgramLoadExampleButton.disabled = true;
    return;
  }
  const availability = classicProgramAvailability.get(example.id);
  classicProgramExampleDescription.textContent = availability?.compatible
    ? `${example.description} Required fields: ${example.requiredFields.join(", ")}.`
    : `${example.description} ${availability?.issues.join(" ") || "This program is not compatible with the current form."}`;
  classicProgramLoadExampleButton.disabled = !availability?.compatible;
}

function loadSelectedClassicProgramExample(focusEditor = true): void {
  const example = selectedClassicProgramExample();
  if (!example || !classicProgramAvailability.get(example.id)?.compatible) return;
  classicProgramEditor.setValue(example.source);
  classicExampleSourceLoaded = true;
  classicProgramFeedback.textContent = `Loaded “${example.title}”. Review the visible source and cut points before running.`;
  classicProgramOutput.hidden = true;
  if (classicProgramDialog.open) classicProgramDialog.close();
  if (focusEditor) classicProgramEditor.focus();
}

function hideClassicProgramExamples(message: string): void {
  classicProgramExamplesFieldset.hidden = true;
  classicProgramExamples = [];
  classicProgramAvailability.clear();
  classicProgramExampleSelect.replaceChildren(new Option("No dataset-specific examples available", ""));
  classicProgramExampleSelect.disabled = true;
  classicProgramLoadExampleButton.disabled = true;
  classicProgramExampleDescription.textContent = message;
  if (classicExampleSourceLoaded) {
    classicProgramEditor.setValue("// Enter an Epi Info program for the current project.");
    classicProgramFeedback.textContent = "The previous dataset-specific example was removed because its dataset is no longer current.";
    classicExampleSourceLoaded = false;
  }
}

async function refreshClassicProgramExamples(): Promise<void> {
  const source = getCurrentProjectData();
  const isFoodborneDataset = source.dataset?.id === FOODBORNE_DATASET_ID || source.dataset?.sha256 === FOODBORNE_DATASET_SHA256;
  if (!isFoodborneDataset || source.records.length === 0) {
    hideClassicProgramExamples(source.records.length === 0
      ? "Import a recognized example dataset before choosing its programs."
      : "The current dataset has no packaged Program Editor examples.");
    return;
  }
  try {
    classicProgramCatalog ??= await loadClassicProgramExampleCatalog(new URL("./examples/foodborne-outbreak-investigation.programs.json", import.meta.url));
    const availability = assessClassicProgramCatalog(classicProgramCatalog, {
      ...(source.dataset ? { dataset: source.dataset } : {}),
      fields: source.fields,
      recordCount: source.records.length,
    });
    if (!availability.datasetMatches) {
      hideClassicProgramExamples(availability.message);
      return;
    }
    classicProgramExamples = classicProgramCatalog.programs;
    classicProgramAvailability = new Map(availability.programs.map((program) => [program.example.id, { compatible: program.compatible, issues: program.issues }]));
    const options = availability.programs.map((program) => {
      const option = new Option(program.example.title, program.example.id);
      option.disabled = !program.compatible;
      return option;
    });
    classicProgramExampleSelect.replaceChildren(...options);
    const firstCompatible = availability.programs.find((program) => program.compatible)?.example;
    classicProgramExampleSelect.value = firstCompatible?.id ?? "";
    classicProgramExampleSelect.disabled = !firstCompatible;
    classicProgramExamplesFieldset.hidden = classicProgramDialogMode !== "open";
    renderClassicProgramExampleDescription();
    if (firstCompatible && !classicExampleSourceLoaded) loadSelectedClassicProgramExample(false);
    classicProgramFeedback.textContent = availability.message;
  } catch (error) {
    classicProgramExampleSelect.replaceChildren(new Option("Foodborne program catalog unavailable", ""));
    classicProgramExampleDescription.textContent = error instanceof Error ? error.message : "Unable to load the foodborne program catalog.";
    classicProgramExampleSelect.disabled = true;
    classicProgramLoadExampleButton.disabled = true;
  }
}

void refreshClassicProgramExamples();

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
  requiredElement("#classic-program-font-status").textContent = `${classicProgramPreferences.fontFamily} · ${classicProgramPreferences.fontSize} px`;
}

function persistAndApplyClassicProgramPreferences(): void {
  saveClassicProgramPreferences();
  classicProgramEditor.setLineNumbers(classicProgramPreferences.lineNumbers);
  classicProgramEditor.setTabSettings(classicProgramPreferences.tabSize, classicProgramPreferences.indentWithTabs);
  classicProgramEditor.setFont(classicProgramPreferences.fontFamily, classicProgramPreferences.fontSize);
  renderClassicProgramPreferences();
}

function renderClassicProgramFontPreview(): void {
  classicProgramFontPreview.style.fontFamily = classicProgramFontFamily.value;
  classicProgramFontPreview.style.fontSize = `${classicProgramFontSize.valueAsNumber || 15}px`;
}

requiredElement("#classic-program-font").addEventListener("click", () => {
  classicProgramFontFamily.value = classicProgramPreferences.fontFamily;
  classicProgramFontSize.value = String(classicProgramPreferences.fontSize);
  renderClassicProgramFontPreview();
  closeClassicProgramMenus();
  classicProgramFontDialog.showModal();
  classicProgramFontFamily.focus();
});
classicProgramFontFamily.addEventListener("change", renderClassicProgramFontPreview);
classicProgramFontSize.addEventListener("input", renderClassicProgramFontPreview);
requiredElement("#classic-program-font-apply").addEventListener("click", () => {
  const fontFamily = classicProgramFontFamily.value;
  const fontSize = classicProgramFontSize.valueAsNumber;
  if (!CLASSIC_PROGRAM_FONT_FAMILIES.includes(fontFamily as typeof CLASSIC_PROGRAM_FONT_FAMILIES[number]) || !Number.isInteger(fontSize) || fontSize < 8 || fontSize > 32) {
    classicProgramFontSize.reportValidity();
    return;
  }
  classicProgramPreferences = { ...classicProgramPreferences, fontFamily, fontSize };
  persistAndApplyClassicProgramPreferences();
  classicProgramFontDialog.close();
  classicProgramCommandStatus.textContent = `Editor font changed to ${fontFamily}, ${fontSize} px.`;
  classicProgramEditor.focus();
});

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

renderDashboardCommandContract(requiredElement("#dashboard-toolbar-commands"), requiredElement("#dashboard-canvas-menu-items"));
renderClassicAnalysisContract(requiredElement("#classic-analysis-menu"), requiredElement("#classic-command-tree"));

const classicMessageArea = requiredElement<HTMLElement>("#classic-message-area");
const classicStatusbar = requiredElement<HTMLElement>("#classic-statusbar");
const classicWorkspaceShell = requiredElement<HTMLElement>(".classic-workspace-shell");
const classicCommandExplorerTree = requiredElement<HTMLElement>("#classic-command-tree");
const classicCommandExplorerToggle = requiredElement<HTMLButtonElement>("#classic-command-explorer-toggle");
const classicCommandExplorerResizer = requiredElement<HTMLElement>("#classic-command-explorer-resizer");
const classicCommandExplorerMenuToggle = requiredElement<HTMLButtonElement>("#classic-menu-command-explorer");
const classicStatusbarToggle = requiredElement<HTMLButtonElement>("#classic-menu-status-bar");
const CLASSIC_WORKSPACE_PREFERENCES_KEY = "epi-info-ai.classic-workspace-preferences.v1";
const CLASSIC_COMMAND_EXPLORER_MIN_WIDTH = 200;
const CLASSIC_COMMAND_EXPLORER_MAX_WIDTH = 480;
type ClassicWorkspacePreferences = { commandExplorerCollapsed: boolean; commandExplorerWidth: number };

function readClassicWorkspacePreferences(): ClassicWorkspacePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(CLASSIC_WORKSPACE_PREFERENCES_KEY) ?? "null") as Partial<ClassicWorkspacePreferences> | null;
    const storedWidth = Number(value?.commandExplorerWidth);
    return {
      commandExplorerCollapsed: value?.commandExplorerCollapsed ?? window.matchMedia("(max-width: 900px)").matches,
      commandExplorerWidth: Number.isFinite(storedWidth)
        ? Math.min(CLASSIC_COMMAND_EXPLORER_MAX_WIDTH, Math.max(CLASSIC_COMMAND_EXPLORER_MIN_WIDTH, storedWidth))
        : 240,
    };
  } catch {
    return { commandExplorerCollapsed: window.matchMedia("(max-width: 900px)").matches, commandExplorerWidth: 240 };
  }
}

let classicWorkspacePreferences = readClassicWorkspacePreferences();

function saveClassicWorkspacePreferences(): void {
  try {
    localStorage.setItem(CLASSIC_WORKSPACE_PREFERENCES_KEY, JSON.stringify(classicWorkspacePreferences));
  } catch {
    // Docking remains usable when browser preference storage is unavailable.
  }
}

function renderClassicCommandExplorerDock(): void {
  const collapsed = classicWorkspacePreferences.commandExplorerCollapsed;
  classicWorkspaceShell.style.setProperty("--classic-command-explorer-width", `${classicWorkspacePreferences.commandExplorerWidth}px`);
  classicWorkspaceShell.dataset.commandExplorerCollapsed = String(collapsed);
  classicCommandExplorerToggle.setAttribute("aria-expanded", String(!collapsed));
  classicCommandExplorerToggle.setAttribute("aria-label", collapsed ? "Show Command Explorer" : "Hide Command Explorer");
  classicCommandExplorerToggle.title = `${collapsed ? "Show" : "Hide"} Command Explorer (Ctrl+Alt+C)`;
  classicCommandExplorerToggle.textContent = collapsed ? "Command Explorer ›" : "‹";
  classicCommandExplorerTree.setAttribute("aria-hidden", String(collapsed));
  classicCommandExplorerResizer.setAttribute("aria-valuenow", String(classicWorkspacePreferences.commandExplorerWidth));
  classicCommandExplorerMenuToggle.setAttribute("aria-checked", String(!collapsed));
}

function setClassicCommandExplorerCollapsed(collapsed: boolean): void {
  classicWorkspacePreferences.commandExplorerCollapsed = collapsed;
  renderClassicCommandExplorerDock();
  saveClassicWorkspacePreferences();
  classicMessageArea.textContent = `Message Area: Command Explorer ${collapsed ? "hidden" : "shown"}.`;
}

function setClassicCommandExplorerWidth(width: number, save = false): void {
  const availableWidth = Math.max(CLASSIC_COMMAND_EXPLORER_MIN_WIDTH, classicWorkspaceShell.getBoundingClientRect().width - 320);
  classicWorkspacePreferences.commandExplorerWidth = Math.round(Math.min(CLASSIC_COMMAND_EXPLORER_MAX_WIDTH, availableWidth, Math.max(CLASSIC_COMMAND_EXPLORER_MIN_WIDTH, width)));
  renderClassicCommandExplorerDock();
  if (save) saveClassicWorkspacePreferences();
}

classicCommandExplorerMenuToggle.setAttribute("role", "menuitemcheckbox");
classicStatusbarToggle.setAttribute("role", "menuitemcheckbox");
classicStatusbarToggle.setAttribute("aria-checked", "true");
renderClassicCommandExplorerDock();

classicCommandExplorerToggle.addEventListener("click", () => {
  setClassicCommandExplorerCollapsed(!classicWorkspacePreferences.commandExplorerCollapsed);
});

classicCommandExplorerMenuToggle.addEventListener("click", () => {
  setClassicCommandExplorerCollapsed(!classicWorkspacePreferences.commandExplorerCollapsed);
});

classicCommandExplorerResizer.addEventListener("pointerdown", (event) => {
  if (classicWorkspacePreferences.commandExplorerCollapsed) return;
  event.preventDefault();
  classicCommandExplorerResizer.setPointerCapture(event.pointerId);
  classicWorkspaceShell.dataset.resizingCommandExplorer = "true";
});

classicCommandExplorerResizer.addEventListener("pointermove", (event) => {
  if (!classicCommandExplorerResizer.hasPointerCapture(event.pointerId)) return;
  setClassicCommandExplorerWidth(event.clientX - classicWorkspaceShell.getBoundingClientRect().left);
});

function finishClassicCommandExplorerResize(event: PointerEvent): void {
  if (!classicCommandExplorerResizer.hasPointerCapture(event.pointerId)) return;
  classicCommandExplorerResizer.releasePointerCapture(event.pointerId);
  delete classicWorkspaceShell.dataset.resizingCommandExplorer;
  saveClassicWorkspacePreferences();
}

classicCommandExplorerResizer.addEventListener("pointerup", finishClassicCommandExplorerResize);
classicCommandExplorerResizer.addEventListener("pointercancel", finishClassicCommandExplorerResize);
classicCommandExplorerResizer.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  setClassicCommandExplorerWidth(classicWorkspacePreferences.commandExplorerWidth + (event.key === "ArrowLeft" ? -10 : 10), true);
});

document.addEventListener("keydown", (event) => {
  if (!event.ctrlKey || !event.altKey || event.code !== "KeyC" || classicWorkspaceShell.hidden) return;
  event.preventDefault();
  setClassicCommandExplorerCollapsed(!classicWorkspacePreferences.commandExplorerCollapsed);
  classicCommandExplorerToggle.focus();
});

requiredElement("#classic-analysis-menu").addEventListener("click", (event) => {
  const command = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
  command?.closest<HTMLDetailsElement>("details")?.removeAttribute("open");
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
  if (!target) return;
  event.preventDefault();
  classicMessageArea.textContent = target.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
});

classicStatusbarToggle.addEventListener("click", () => {
  classicStatusbar.hidden = !classicStatusbar.hidden;
  classicStatusbarToggle.setAttribute("aria-checked", String(!classicStatusbar.hidden));
  classicMessageArea.textContent = `Message Area: Status Bar ${classicStatusbar.hidden ? "hidden" : "shown"}.`;
});

requiredElement("#classic-command-tree").addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
  if (!target) return;
  event.preventDefault();
  classicMessageArea.textContent = target.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
});

requiredElement("#classic-command-read").addEventListener("click", () => showClassicCommandDialog("read"));
requiredElement("#classic-command-relate").addEventListener("click", () => showClassicCommandDialog("relate"));
requiredElement("#classic-command-write").addEventListener("click", () => showClassicCommandDialog("write"));
requiredElement("#classic-command-merge").addEventListener("click", () => showClassicCommandDialog("merge"));
requiredElement("#classic-command-delete-file-table").addEventListener("click", () => showClassicCommandDialog("delete-table"));
requiredElement("#classic-command-delete-records").addEventListener("click", () => showClassicCommandDialog("delete-records"));
requiredElement("#classic-command-undelete-records").addEventListener("click", () => showClassicCommandDialog("undelete-records"));
requiredElement("#classic-command-summarize").addEventListener("click", () => showClassicCommandDialog("summarize"));
requiredElement("#classic-command-graph").addEventListener("click", () => showClassicCommandDialog("graph"));
requiredElement("#classic-command-quality").addEventListener("click", () => showClassicCommandDialog("quality"));
requiredElement("#classic-command-file-convert").addEventListener("click", () => showClassicCommandDialog("file-convert"));
requiredElement("#classic-command-define").addEventListener("click", () => showClassicCommandDialog("define"));
requiredElement("#classic-command-define-group").addEventListener("click", () => showClassicCommandDialog("define-group"));
requiredElement("#classic-command-undefine").addEventListener("click", () => showClassicCommandDialog("undefine"));
requiredElement("#classic-command-assign").addEventListener("click", () => showClassicCommandDialog("assign"));
requiredElement("#classic-command-recode").addEventListener("click", () => showClassicCommandDialog("recode"));
requiredElement("#classic-command-display").addEventListener("click", () => showClassicCommandDialog("display"));
requiredElement("#classic-command-select").addEventListener("click", () => showClassicCommandDialog("select"));
requiredElement("#classic-command-cancel-select").addEventListener("click", () => showClassicCommandDialog("cancel-select"));
requiredElement("#classic-command-if").addEventListener("click", () => showClassicCommandDialog("if"));
requiredElement("#classic-command-sort").addEventListener("click", () => showClassicCommandDialog("sort"));
requiredElement("#classic-command-cancel-sort").addEventListener("click", () => showClassicCommandDialog("cancel-sort"));
requiredElement("#classic-command-list").addEventListener("click", () => showClassicCommandDialog("list"));
requiredElement("#classic-command-frequencies").addEventListener("click", () => showClassicCommandDialog("frequency"));
requiredElement("#classic-command-complex-frequencies").addEventListener("click", () => showClassicCommandDialog("frequency", false, true));
requiredElement("#classic-command-complex-means").addEventListener("click", () => showClassicCommandDialog("means", false, false, true));
requiredElement("#classic-command-means").addEventListener("click", () => showClassicCommandDialog("means"));
requiredElement("#classic-command-tables").addEventListener("click", () => showClassicCommandDialog("tables"));
requiredElement("#classic-command-complex-tables").addEventListener("click", () => showClassicCommandDialog("tables", true));
requiredElement("#classic-command-set").addEventListener("click", () => showClassicCommandDialog("set-missing"));

function collapseDashboardSubmenus(except: HTMLButtonElement | null = null): void {
  for (const trigger of document.querySelectorAll<HTMLButtonElement>("#dashboard-canvas-menu [data-dashboard-submenu]")) {
    if (trigger === except) continue;
    trigger.setAttribute("aria-expanded", "false");
    if (trigger.nextElementSibling instanceof HTMLElement) trigger.nextElementSibling.hidden = true;
  }
}

for (const trigger of document.querySelectorAll<HTMLButtonElement>("#dashboard-canvas-menu [data-dashboard-submenu]")) {
  trigger.addEventListener("click", () => {
    const children = trigger.nextElementSibling;
    if (!(children instanceof HTMLElement)) return;
    const willOpen = children.hidden;
    children.hidden = !willOpen;
    trigger.setAttribute("aria-expanded", String(willOpen));
  });
}

requiredElement("#dashboard-canvas-menu").addEventListener("toggle", () => {
  if (!requiredElement<HTMLDetailsElement>("#dashboard-canvas-menu").open) collapseDashboardSubmenus();
});

requiredElement("#dashboard-canvas-menu-items").addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
  if (!target) return;
  event.preventDefault();
  requiredElement("#dashboard-command-status").textContent = target.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
});

requiredElement("#dashboard-toolbar-commands").addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[aria-disabled="true"]') : null;
  if (!target) return;
  event.preventDefault();
  requiredElement("#dashboard-command-status").textContent = target.dataset.unavailableReason ?? "This familiar command is not implemented yet.";
});

requiredElement("#dashboard-canvas").addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const menu = requiredElement<HTMLDetailsElement>("#dashboard-canvas-menu");
  menu.open = true;
  menu.querySelector<HTMLElement>("summary")?.focus();
  requiredElement("#dashboard-command-status").textContent = "Canvas commands opened. Choose a familiar gadget or canvas operation.";
});

function openDashboardGadget(selector: string, label: string): void {
  const gadget = requiredElement<HTMLElement>(selector);
  requiredElement<HTMLDetailsElement>("#dashboard-canvas-menu").open = false;
  gadget.scrollIntoView({ behavior: "smooth", block: "start" });
  globalThis.setTimeout(
    () => gadget.querySelector<HTMLElement>("select:not(:disabled), input:not(:disabled), button:not(:disabled)")?.focus({ preventScroll: true }),
    0,
  );
  requiredElement("#dashboard-command-status").textContent = `${label} gadget selected on the current canvas.`;
}

requiredElement("#dashboard-menu-rates").addEventListener("click", () => openDashboardGadget(".dashboard-rates-gadget", "Rates"));
requiredElement("#dashboard-menu-epi-curve").addEventListener("click", () => openDashboardGadget(".dashboard-epi-curve-gadget", "Epi Curve"));

function refreshDashboardCommandSurface(): void {
  const source = getCurrentProjectData();
  requiredElement("#dashboard-toolbar-source").replaceChildren(
    Object.assign(document.createElement("strong"), { textContent: "Data Source:" }),
    ` ${source.projectName} / ${source.formName}`,
  );
  requiredElement("#dashboard-toolbar-count").textContent = `(${source.records.length} records)`;
}

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
  return { plan, source };
}

function renderProgramFrequency(plan: BoundedClassicProgramPlan, records: EpiRecord[]): { rows: number; included: number } {
  const request = { field: plan.frequency.field, prompt: plan.frequency.prompt, includeMissing: false };
  const result = plan.frequency.stratifyBy
    ? deriveStratifiedFrequency(records, {
      ...request,
      stratifyBy: plan.frequency.stratifyBy,
      stratifyPrompt: plan.frequency.stratifyPrompt ?? plan.frequency.stratifyBy,
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
  requiredElement("#classic-program-output-title").textContent = `${plan.frequency.prompt}${plan.frequency.stratifyBy ? ` by ${plan.frequency.stratifyPrompt ?? plan.frequency.stratifyBy}` : ""}`;
  requiredElement("#classic-program-output-variable-heading").textContent = plan.frequency.prompt;
  classicProgramOutput.hidden = false;
  return {
    rows: rows.length,
    included: strata.reduce((total, stratum) => total + stratum.result.totals.includedRecords, 0),
  };
}

class ClassicProgramCancelledError extends Error {
  constructor() { super("Program execution was cancelled by the user."); this.name = "ClassicProgramCancelledError"; }
}

function assertClassicProgramNotCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ClassicProgramCancelledError();
}

function isClassicProgramCancellation(error: unknown): boolean {
  return error instanceof ClassicProgramCancelledError;
}

async function yieldClassicProgramTurn(signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
  assertClassicProgramNotCancelled(signal);
}

function renderClassicProgramRunState(running: boolean): void {
  classicProgramToolbarRun.disabled = running;
  classicProgramToolbarCancel.disabled = !running;
  requiredElement<HTMLButtonElement>("#classic-program-run").disabled = running;
  requiredElement<HTMLButtonElement>("#classic-program-run-selection").disabled = running;
  requiredElement<HTMLButtonElement>("#classic-program-verify").disabled = running;
  requiredElement<HTMLElement>(".classic-program-editor").setAttribute("aria-busy", String(running));
}

async function startClassicProgramTask(task: (signal: AbortSignal) => Promise<void>): Promise<void> {
  if (classicProgramRunController) return;
  const controller = new AbortController();
  classicProgramRunController = controller;
  renderClassicProgramRunState(true);
  try {
    await task(controller.signal);
  } finally {
    if (classicProgramRunController === controller) classicProgramRunController = null;
    renderClassicProgramRunState(false);
  }
}

async function runClassicProgram(verifyOnly: boolean, signal?: AbortSignal): Promise<void> {
  let project = getCurrentProjectData();
  try {
    assertClassicProgramNotCancelled(signal);
    const sourceText = classicProgramEditor.getValue();
    const parsed = parseClassicProgram(sourceText);
    const boundedShape = parsed.body.length === 3
      && parsed.body[0]?.type === "DefineStatement"
      && parsed.body[1]?.type === "RecodeStatement"
      && parsed.body[2]?.type === "FrequencyStatement";
    if (!boundedShape) {
      if (verifyOnly) {
        classicProgramFeedback.textContent = `Program syntax verified for ${parsed.body.length} statements. Semantic checks run in sequence when you choose Run Commands; nothing was run.`;
        return;
      }
      await runSequentialClassicProgram(sourceText, parsed, signal);
      return;
    }
    const validated = validateProgram();
    project = validated.source;
    if (verifyOnly) {
      classicProgramFeedback.textContent = "Program verified. Three allowlisted statements produced a typed V0.1 execution plan; nothing was run.";
      recordProgramRun({
        origin: "user-program", status: "verified", planVersion: validated.plan.version, astVersion: validated.plan.astVersion,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: classicProgramEditor.getValue(), canonicalSource: validated.plan.canonicalSource,
        summary: "Verified DEFINE → RECODE → FREQ plan without execution.", diagnostics: [],
      });
      return;
    }
    const applied = applyBoundedClassicProgram(project.records, validated.plan);
    assertClassicProgramNotCancelled(signal);
    const output = renderProgramFrequency(validated.plan, applied.records);
    classicProgramFeedback.textContent = `Executed DEFINE → RECODE → FREQ for ${output.included} records and produced ${output.rows} output rows. The current form was not modified.`;
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: validated.plan.version, astVersion: validated.plan.astVersion,
      projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
      source: classicProgramEditor.getValue(), canonicalSource: validated.plan.canonicalSource,
      summary: `Produced ${output.rows} frequency rows from ${output.included} included records.`, diagnostics: [],
    });
  } catch (error) {
    if (isClassicProgramCancellation(error)) {
      classicProgramFeedback.textContent = "Program cancelled before execution completed. Completed output and history were retained.";
      classicProgramCommandStatus.textContent = "Program cancelled by user.";
      recordProgramRun({
        origin: "user-program", status: "cancelled", planVersion: CLASSIC_PROGRAM_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: classicProgramEditor.getValue(), summary: "Program cancelled by user.", diagnostics: [],
      });
      return;
    }
    const message = error instanceof Error ? error.message : "Unable to verify the program.";
    classicProgramFeedback.textContent = `${message} Nothing was run.`;
    classicProgramOutput.hidden = true;
    recordProgramRun({
      origin: "user-program", status: "failed", planVersion: CLASSIC_PROGRAM_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
      source: classicProgramEditor.getValue(), summary: "Program rejected before execution.", diagnostics: [message],
    });
  }
}

function refreshClassicProgramContext(): void {
  classicProgramSession.syncDefault(getCurrentProjectData());
  renderClassicProgramSession();
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

function renderClassicListOutput(project: ReturnType<typeof getCurrentProjectData>, fields: readonly string[]): void {
  const definitions = fields.map((name) => project.fields.find((field) => field.name === name)!);
  requiredElement("#classic-list-output-title").textContent = `Line List · ${project.formName}`;
  requiredElement("#classic-list-output-count").textContent = `${project.records.length} records`;
  requiredElement("#classic-list-output-head").replaceChildren(...definitions.map((field) => {
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = field.prompt;
    return heading;
  }));
  const displayed = project.records.slice(0, 100);
  requiredElement("#classic-list-output-body").replaceChildren(...displayed.map((record) => {
    const row = document.createElement("tr");
    row.replaceChildren(...fields.map((field) => {
      const cell = document.createElement("td");
      const value = record[field];
      cell.textContent = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
      return cell;
    }));
    return row;
  }));
  requiredElement("#classic-list-output-note").textContent = displayed.length < project.records.length
    ? `Showing the first ${displayed.length} of ${project.records.length} records in this browser preview.`
    : `Showing all ${project.records.length} records.`;
  requiredElement<HTMLElement>("#classic-list-output").hidden = false;
}

function renderClassicDisplayOutput(project: ReturnType<typeof getCurrentProjectData>, source: string): number {
  const plan = resolveClassicDisplayCommand(source, project.fields, classicProgramSession.variables());
  const rows = classicDisplayRows(plan, project.formName);
  requiredElement("#classic-display-output-title").textContent = `Variables · ${project.formName}`;
  requiredElement("#classic-display-output-count").textContent = `${rows.length} variable${rows.length === 1 ? "" : "s"}`;
  requiredElement("#classic-display-output-body").replaceChildren(...rows.map((row) => {
    const tr = document.createElement("tr");
    for (const value of [row.pageNumber, row.prompt, row.fieldType, row.variable, row.variableValue === null ? "Missing" : String(row.variableValue), row.formatValue, row.specialInfo, row.table]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      tr.append(cell);
    }
    return tr;
  }));
  requiredElement<HTMLElement>("#classic-display-output").hidden = false;
  return rows.length;
}

function renderClassicSummarizeOutput(result: ReturnType<typeof applyClassicSummarize>): void {
  requiredElement("#classic-summarize-output-title").textContent = result.source.formName;
  requiredElement("#classic-summarize-output-count").textContent = `${result.groups} row${result.groups === 1 ? "" : "s"}`;
  requiredElement("#classic-summarize-output-head").replaceChildren(...result.source.fields.map((field) => {
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = field.prompt;
    return heading;
  }));
  requiredElement("#classic-summarize-output-body").replaceChildren(...result.source.records.map((record) => {
    const row = document.createElement("tr");
    row.replaceChildren(...result.source.fields.map((field) => {
      const cell = document.createElement("td");
      const value = record[field.name];
      cell.textContent = value == null ? "Missing" : typeof value === "number" ? String(Math.round(value * 1e10) / 1e10) : String(value);
      return cell;
    }));
    return row;
  }));
  requiredElement("#classic-summarize-output-note").textContent = `Included ${result.includedRecords} of ${result.sourceRecords} active records; ${result.excludedMissing} aggregate-field values were missing. The named table is available to READ during this Classic session.`;
  requiredElement<HTMLElement>("#classic-summarize-output").hidden = false;
}

function renderClassicGraphOutput(plan: ReturnType<typeof resolveClassicGraphCommand>, result: FrequencyResult): void {
  const output = requiredElement<HTMLElement>("#classic-graph-output");
  const plot = requiredElement<HTMLElement>("#classic-graph-output-plot");
  const title = plan.title ?? `${plan.fieldDefinition.prompt} distribution`;
  requiredElement("#classic-graph-output-title").textContent = title;
  requiredElement("#classic-graph-output-count").textContent = `${plan.graphType} · ${result.totals.includedRecords} records · ${result.categories.length} categories`;
  requiredElement("#classic-graph-output-body").replaceChildren(...result.categories.map((category) => {
    const row = document.createElement("tr");
    for (const value of [category.value, String(category.frequency), percent(category.percent)]) {
      const cell = document.createElement("td"); cell.textContent = value; row.append(cell);
    }
    return row;
  }));

  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 760 390");
  svg.setAttribute("aria-label", `${title}. ${result.categories.map(({ value, frequency }) => `${value}: ${frequency}`).join(", ")}.`);
  svg.setAttribute("role", "img");
  svg.dataset.orientation = plan.graphType === "Bar" ? "horizontal" : plan.graphType === "Column" ? "vertical" : "radial";
  svg.dataset.chartType = plan.graphType;
  if (plan.graphType === "Pie") {
    const palette = ["#087ea4", "#e58b19", "#3b8f5a", "#9b59b6", "#c7463b", "#5072a7", "#8a6d3b", "#6d7b87"];
    const centerX = 260, centerY = 195, radius = 135;
    const total = Math.max(1, result.categories.reduce((sum, category) => sum + category.frequency, 0));
    let angle = -Math.PI / 2;
    result.categories.forEach((category, index) => {
      const fraction = category.frequency / total;
      const nextAngle = angle + fraction * Math.PI * 2;
      const color = palette[index % palette.length]!;
      let slice: SVGElement;
      if (fraction >= 0.999999) {
        slice = document.createElementNS(ns, "circle");
        slice.setAttribute("cx", String(centerX)); slice.setAttribute("cy", String(centerY)); slice.setAttribute("r", String(radius));
      } else {
        const startX = centerX + radius * Math.cos(angle), startY = centerY + radius * Math.sin(angle);
        const endX = centerX + radius * Math.cos(nextAngle), endY = centerY + radius * Math.sin(nextAngle);
        slice = document.createElementNS(ns, "path");
        slice.setAttribute("d", `M ${centerX} ${centerY} L ${startX} ${startY} A ${radius} ${radius} 0 ${fraction > 0.5 ? 1 : 0} 1 ${endX} ${endY} Z`);
      }
      slice.setAttribute("class", "classic-graph-slice");
      slice.setAttribute("fill", color);
      slice.setAttribute("tabindex", "0");
      slice.setAttribute("aria-label", `${category.value}: ${category.frequency}, ${percent(category.percent)}`);
      const sliceTitle = document.createElementNS(ns, "title"); sliceTitle.textContent = `${category.value}: ${category.frequency} (${percent(category.percent)})`; slice.append(sliceTitle);
      const swatch = document.createElementNS(ns, "rect"); swatch.setAttribute("x", "455"); swatch.setAttribute("y", String(92 + index * 48)); swatch.setAttribute("width", "18"); swatch.setAttribute("height", "18"); swatch.setAttribute("rx", "2"); swatch.setAttribute("fill", color); swatch.setAttribute("class", "classic-graph-legend-swatch");
      const legend = document.createElementNS(ns, "text"); legend.setAttribute("x", "484"); legend.setAttribute("y", String(106 + index * 48)); legend.setAttribute("class", "classic-graph-legend-label"); legend.textContent = `${category.value}: ${category.frequency} (${percent(category.percent)})`;
      svg.append(slice, swatch, legend);
      angle = nextAngle;
    });
    plot.replaceChildren(svg);
    requiredElement("#classic-graph-output-note").textContent = `Missing values excluded: ${result.totals.excludedMissing}. Slice areas use the same typed frequency operation as FREQ; the data table is the authoritative accessible output.`;
    output.hidden = false;
    return;
  }
  const max = Math.max(1, ...result.categories.map(({ frequency }) => frequency));
  const horizontal = plan.graphType === "Bar";
  const plotLeft = horizontal ? 180 : 72, plotTop = 45, plotWidth = horizontal ? 542 : 650, plotHeight = 260;
  const axis = document.createElementNS(ns, "path");
  axis.setAttribute("d", `M ${plotLeft} ${plotTop} V ${plotTop + plotHeight} H ${plotLeft + plotWidth}`);
  axis.setAttribute("class", "classic-graph-axis");
  svg.append(axis);
  if (horizontal) {
    const slot = plotHeight / Math.max(1, result.categories.length);
    result.categories.forEach((category, index) => {
      const width = category.frequency / max * (plotWidth - 35);
      const height = Math.min(48, slot * 0.62);
      const x = plotLeft;
      const y = plotTop + index * slot + (slot - height) / 2;
      const bar = document.createElementNS(ns, "rect");
      bar.setAttribute("x", String(x)); bar.setAttribute("y", String(y)); bar.setAttribute("width", String(width)); bar.setAttribute("height", String(height));
      bar.setAttribute("class", "classic-graph-bar");
      const barTitle = document.createElementNS(ns, "title"); barTitle.textContent = `${category.value}: ${category.frequency} (${percent(category.percent)})`; bar.append(barTitle);
      const count = document.createElementNS(ns, "text"); count.setAttribute("x", String(x + width + 9)); count.setAttribute("y", String(y + height / 2 + 5)); count.setAttribute("class", "classic-graph-count classic-graph-count-horizontal"); count.textContent = String(category.frequency);
      const label = document.createElementNS(ns, "text"); label.setAttribute("x", String(plotLeft - 10)); label.setAttribute("y", String(y + height / 2 + 5)); label.setAttribute("class", "classic-graph-label classic-graph-label-horizontal"); label.textContent = category.value.length > 22 ? `${category.value.slice(0, 21)}…` : category.value;
      svg.append(bar, count, label);
    });
  } else {
    const slot = plotWidth / Math.max(1, result.categories.length);
    result.categories.forEach((category, index) => {
      const height = category.frequency / max * (plotHeight - 20);
      const width = Math.min(120, slot * 0.62);
      const x = plotLeft + index * slot + (slot - width) / 2;
      const y = plotTop + plotHeight - height;
      const bar = document.createElementNS(ns, "rect");
      bar.setAttribute("x", String(x)); bar.setAttribute("y", String(y)); bar.setAttribute("width", String(width)); bar.setAttribute("height", String(height));
      bar.setAttribute("class", "classic-graph-bar");
      const barTitle = document.createElementNS(ns, "title"); barTitle.textContent = `${category.value}: ${category.frequency} (${percent(category.percent)})`; bar.append(barTitle);
      const count = document.createElementNS(ns, "text"); count.setAttribute("x", String(x + width / 2)); count.setAttribute("y", String(Math.max(plotTop + 12, y - 8))); count.setAttribute("class", "classic-graph-count"); count.textContent = String(category.frequency);
      const label = document.createElementNS(ns, "text"); label.setAttribute("x", String(x + width / 2)); label.setAttribute("y", String(plotTop + plotHeight + 22)); label.setAttribute("class", "classic-graph-label"); label.textContent = category.value.length > 18 ? `${category.value.slice(0, 17)}…` : category.value;
      svg.append(bar, count, label);
    });
  }
  const xTitle = document.createElementNS(ns, "text"); xTitle.setAttribute("x", String(plotLeft + plotWidth / 2)); xTitle.setAttribute("y", "372"); xTitle.setAttribute("class", "classic-graph-axis-title"); xTitle.textContent = plan.xTitle ?? plan.fieldDefinition.prompt;
  const yTitle = document.createElementNS(ns, "text"); yTitle.setAttribute("x", "18"); yTitle.setAttribute("y", String(plotTop + plotHeight / 2)); yTitle.setAttribute("transform", `rotate(-90 18 ${plotTop + plotHeight / 2})`); yTitle.setAttribute("class", "classic-graph-axis-title"); yTitle.textContent = plan.yTitle ?? "Count";
  svg.append(xTitle, yTitle);
  plot.replaceChildren(svg);
  requiredElement("#classic-graph-output-note").textContent = `Missing values excluded: ${result.totals.excludedMissing}. ${horizontal ? "Bar lengths" : "Column heights"} use the same typed frequency operation as FREQ.`;
  output.hidden = false;
}

function renderEpiAiQualityOutput(report: DataQualityReport): void {
  const rows = [...report.fields].sort((left, right) =>
    right.missing - left.missing || right.violations - left.violations || left.prompt.localeCompare(right.prompt),
  );
  requiredElement("#classic-quality-output-count").textContent = `${report.recordCount} records · ${rows.length} fields`;
  requiredElement("#classic-quality-output-summary").textContent =
    `${report.issues.length} validation issue${report.issues.length === 1 ? "" : "s"}; ${report.duplicateGroups.length} duplicate candidate group${report.duplicateGroups.length === 1 ? "" : "s"}. Problematic fields are shown first.`;
  requiredElement("#classic-quality-output-body").replaceChildren(...rows.map((field) => {
    const row = document.createElement("tr");
    row.dataset.fieldName = field.fieldName;
    const values = [field.prompt, String(field.present), String(field.missing)];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const missingness = document.createElement("td");
    const track = document.createElement("span");
    track.className = "classic-quality-mini-bar";
    track.setAttribute("role", "img");
    const missingPercent = report.recordCount ? field.missing / report.recordCount * 100 : 0;
    track.setAttribute("aria-label", `${missingPercent.toFixed(1)}% missing`);
    const fill = document.createElement("span");
    fill.style.width = `${missingPercent}%`;
    track.append(fill);
    missingness.append(track);
    row.append(missingness);
    for (const value of [`${(field.completeness * 100).toFixed(1)}%`, String(field.violations)]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    return row;
  }));
  requiredElement<HTMLElement>("#classic-quality-output").hidden = false;
}

function renderClassicTablesOutput(plan: ClassicTablesPlan, result: ClassicTablesResult): void {
  const output = requiredElement<HTMLElement>("#classic-tables-categorical-output");
  const formatCount = (value: number): string => Number.isInteger(value) ? String(value) : number(value, 4);
  requiredElement("#classic-tables-categorical-title").textContent = `${plan.exposurePrompt} by ${plan.outcomePrompt}${plan.strataPrompts.length ? `, stratified by ${plan.strataPrompts.join(", ")}` : ""}`;
  requiredElement("#classic-tables-categorical-count").textContent = `${result.includedRecords} records${plan.weightField ? ` · weighted N ${formatCount(result.weightedTotal)}` : ""} · ${plan.strataFields.length ? `${result.strata.length} strata` : "unstratified"}`;
  requiredElement("#classic-tables-categorical-note").textContent =
    `${plan.weightField ? `Counts are sums of finite, non-negative ${plan.weightPrompt} values; ${result.excludedInvalidWeight} record${result.excludedInvalidWeight === 1 ? "" : "s"} with a missing or invalid weight excluded and ${result.zeroWeightRecords} zero-weight record${result.zeroWeightRecords === 1 ? "" : "s"} retained for audit. ` : "Counts and percentages preserve every observed value; "}${plan.includeMissing ? `${result.includedMissing} record${result.includedMissing === 1 ? "" : "s"} containing blanks included as “${plan.representationOfMissing}”` : `${result.excludedMissing} record${result.excludedMissing === 1 ? "" : "s"} with a blank selected value excluded`}.${plan.statistics === "NONE" ? " STATISTICS=NONE suppressed inferential output." : plan.weightField ? " Exact and 2 × 2 risk/odds statistics remain disabled for weighted observations." : result.strata.some(({ twoByTwo }) => twoByTwo) ? " Binary tables also receive the legacy Single Table Analysis." : " No exposed/case classification was inferred."}${plan.oneIsYes ? " ONEISYES applied affirmative-first ordering to numeric 0/1 categories." : ""}${plan.noWrap || plan.columnSize !== undefined ? " NOWRAP/COLUMNSIZE were accepted as legacy compatibility no-ops, matching the inspected Rule_Tables executor." : ""}`;
  const body = requiredElement("#classic-tables-categorical-body");
  body.replaceChildren(...result.strata.map((stratum) => {
    const section = document.createElement("section");
    section.className = "classic-tables-stratum";
    const heading = document.createElement("h3");
    heading.textContent = plan.strataPrompts.length === 1 ? `${plan.strataPrompts[0]}: ${stratum.value}` : stratum.value;
    const scroll = document.createElement("div");
    scroll.className = "results-table-scroll";
    const table = document.createElement("table");
    table.className = "results-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const exposureHeading = document.createElement("th");
    exposureHeading.scope = "col";
    exposureHeading.textContent = plan.exposurePrompt;
    headRow.append(exposureHeading, ...result.outcomeValues.map((value) => {
      const th = document.createElement("th"); th.scope = "col"; th.textContent = value; return th;
    }));
    const totalHeading = document.createElement("th"); totalHeading.scope = "col"; totalHeading.textContent = "Total"; headRow.append(totalHeading);
    head.append(headRow);
    const tableBody = document.createElement("tbody");
    tableBody.replaceChildren(...stratum.rows.flatMap((row) => {
      const valueRow = document.createElement("tr");
      const valueHeading = document.createElement("th"); valueHeading.scope = "row"; valueHeading.textContent = row.exposureValue;
      valueRow.append(valueHeading, ...row.counts.map((count) => { const td = document.createElement("td"); td.textContent = formatCount(count); return td; }));
      const valueTotal = document.createElement("td"); valueTotal.textContent = formatCount(row.total); valueRow.append(valueTotal);
      const percentRow = (label: string, values: readonly number[], total: string): HTMLTableRowElement => {
        const tr = document.createElement("tr"); tr.className = "classic-tables-percent-row";
        const th = document.createElement("th"); th.scope = "row"; th.textContent = `${row.exposureValue} ${label}`;
        tr.append(th, ...values.map((value) => { const td = document.createElement("td"); td.textContent = `${value.toFixed(1)}%`; return td; }));
        const totalCell = document.createElement("td"); totalCell.textContent = total; tr.append(totalCell); return tr;
      };
      return [valueRow, percentRow("Row %", row.rowPercents, "100.0%"), percentRow("Col %", row.columnPercents, `${(row.total / stratum.total * 100).toFixed(1)}%`)];
    }));
    const foot = document.createElement("tfoot");
    const footRow = document.createElement("tr");
    const footHeading = document.createElement("th"); footHeading.scope = "row"; footHeading.textContent = "Total";
    footRow.append(footHeading, ...stratum.columnTotals.map((count) => { const td = document.createElement("td"); td.textContent = formatCount(count); return td; }));
    const grandTotal = document.createElement("td"); grandTotal.textContent = formatCount(stratum.total); footRow.append(grandTotal); foot.append(footRow);
    const totalPercentRow = document.createElement("tr");
    const totalPercentHeading = document.createElement("th"); totalPercentHeading.scope = "row"; totalPercentHeading.textContent = "Total %";
    totalPercentRow.append(totalPercentHeading, ...stratum.columnPercents.map((value) => { const td = document.createElement("td"); td.textContent = `${value.toFixed(1)}%`; return td; }));
    const hundred = document.createElement("td"); hundred.textContent = "100.0%"; totalPercentRow.append(hundred); foot.append(totalPercentRow);
    table.append(head, tableBody, foot); scroll.append(table);
    const statistics = document.createElement("div"); statistics.className = "classic-tables-statistics";
    if (stratum.pearson) {
      const title = document.createElement("h4"); title.textContent = "Single Table Analysis";
      const summary = document.createElement("p"); summary.className = "classic-tables-pearson";
      summary.textContent = `Pearson Chi-Squared ${stratum.pearson.chiSquare.toFixed(4)} · df ${stratum.pearson.degreesOfFreedom} · Probability ${stratum.pearson.pValue.toFixed(6)}`;
      statistics.append(title, summary);
      if (stratum.pearson.warning) {
        const warning = document.createElement("p"); warning.className = "warnings classic-tables-expected-warning"; warning.textContent = stratum.pearson.warning; statistics.append(warning);
      }
      const expected = document.createElement("details");
      const expectedSummary = document.createElement("summary"); expectedSummary.textContent = `Expected counts · minimum ${stratum.pearson.minimumExpected.toFixed(2)} · ${stratum.pearson.cellsExpectedBelowFive} below 5`;
      const expectedScroll = document.createElement("div"); expectedScroll.className = "results-table-scroll";
      const expectedTable = document.createElement("table"); expectedTable.className = "results-table classic-tables-expected";
      const expectedHead = document.createElement("thead"); const expectedHeadRow = document.createElement("tr");
      const expectedExposure = document.createElement("th"); expectedExposure.scope = "col"; expectedExposure.textContent = plan.exposurePrompt;
      expectedHeadRow.append(expectedExposure, ...result.outcomeValues.map((value) => { const th = document.createElement("th"); th.scope = "col"; th.textContent = value; return th; })); expectedHead.append(expectedHeadRow);
      const expectedBody = document.createElement("tbody"); expectedBody.replaceChildren(...stratum.rows.map((row) => {
        const tr = document.createElement("tr"); const th = document.createElement("th"); th.scope = "row"; th.textContent = row.exposureValue;
        tr.append(th, ...row.expectedCounts.map((value) => { const td = document.createElement("td"); td.textContent = value.toFixed(2); return td; })); return tr;
      }));
      expectedTable.append(expectedHead, expectedBody); expectedScroll.append(expectedTable); expected.append(expectedSummary, expectedScroll); statistics.append(expected);

      if (stratum.twoByTwo) {
        const analysis = calculateTable2x2(stratum.twoByTwo.input);
        const formatValue = (value: number | null, digits = 4): string => value === null ? "Undefined" : number(value, digits);
        const formatInterval = (interval: { lower: number; upper: number } | null): string => interval
          ? `${number(interval.lower, 4)} to ${number(interval.upper, 4)}` : "Undefined";
        const formatBoundary = (value: { value: number | null; state: string }): string => value.state === "positive-infinity"
          ? "Infinity" : value.state === "zero" ? "0" : value.state === "finite" ? number(value.value!, 4) : "Undefined";
        const formatBoundaryInterval = (interval: { lower: { value: number | null; state: string }; upper: { value: number | null; state: string } }): string =>
          `${formatBoundary(interval.lower)} to ${formatBoundary(interval.upper)}`;

        const interpretation = document.createElement("p");
        interpretation.className = "classic-tables-2x2-interpretation";
        interpretation.textContent = `2 × 2 orientation: exposed=${stratum.twoByTwo.exposedValue}, unexposed=${stratum.twoByTwo.unexposedValue}; case=${stratum.twoByTwo.caseValue}, non-case=${stratum.twoByTwo.nonCaseValue}.`;

        const estimateTable = document.createElement("table"); estimateTable.className = "results-table classic-tables-2x2";
        const estimateHead = document.createElement("thead");
        estimateHead.innerHTML = "<tr><th scope=\"col\">Parameter</th><th scope=\"col\">Estimate</th><th scope=\"col\">95% confidence interval</th></tr>";
        const estimateBody = document.createElement("tbody");
        const estimates: Array<readonly [string, string, string]> = [
          ["Odds Ratio (cross product)", formatValue(analysis.estimates.oddsRatio.estimate), formatInterval(analysis.estimates.oddsRatio.confidenceInterval)],
          ["Odds Ratio (conditional MLE)", formatBoundary(analysis.estimates.conditionalOddsRatio.estimate), formatBoundaryInterval(analysis.estimates.conditionalOddsRatio.midPConfidenceInterval)],
          ["Risk Ratio (RR)", formatValue(analysis.estimates.riskRatio.estimate), formatInterval(analysis.estimates.riskRatio.confidenceInterval)],
          ["Risk Difference (RD%)", analysis.estimates.riskDifference.estimate === null ? "Undefined" : `${number(analysis.estimates.riskDifference.estimate * 100, 4)}%`, analysis.estimates.riskDifference.confidenceInterval ? `${number(analysis.estimates.riskDifference.confidenceInterval.lower * 100, 4)}% to ${number(analysis.estimates.riskDifference.confidenceInterval.upper * 100, 4)}%` : "Undefined"],
        ];
        estimateBody.replaceChildren(...estimates.map((values) => {
          const row = document.createElement("tr");
          values.forEach((value, index) => { const cell = document.createElement(index === 0 ? "th" : "td"); cell.textContent = value; if (index === 0) cell.setAttribute("scope", "row"); row.append(cell); });
          return row;
        }));
        estimateTable.append(estimateHead, estimateBody);

        const testsTable = document.createElement("table"); testsTable.className = "results-table classic-tables-2x2";
        const testsHead = document.createElement("thead"); testsHead.innerHTML = "<tr><th scope=\"col\">Statistical test</th><th scope=\"col\">Statistic</th><th scope=\"col\">1-tailed p</th><th scope=\"col\">2-tailed p</th></tr>";
        const testsBody = document.createElement("tbody");
        const tests: Array<readonly [string, string, string, string]> = [
          ["Chi-square - uncorrected", formatValue(analysis.tests.pearson?.value ?? null), "", formatValue(analysis.tests.pearson?.pValue ?? null, 10)],
          ["Chi-square - Mantel-Haenszel", formatValue(analysis.tests.mantelHaenszel?.value ?? null), "", formatValue(analysis.tests.mantelHaenszel?.pValue ?? null, 10)],
          ["Chi-square - corrected (Yates)", formatValue(analysis.tests.yates?.value ?? null), "", formatValue(analysis.tests.yates?.pValue ?? null, 10)],
          ["Mid-p exact", "", formatValue(analysis.tests.midPExact?.oneTailed ?? null, 10), ""],
          ["Fisher exact", "", formatValue(analysis.tests.fisherExact?.oneTailed ?? null, 10), formatValue(analysis.tests.fisherExact?.twoTailed ?? null, 10)],
        ];
        testsBody.replaceChildren(...tests.map(([label, statistic, oneTailed, twoTailed]) => {
          const row = document.createElement("tr");
          [label, statistic, oneTailed, twoTailed].forEach((value, index) => { const cell = document.createElement(index === 0 ? "th" : "td"); cell.textContent = value; if (index === 0) cell.setAttribute("scope", "row"); row.append(cell); });
          return row;
        }));
        testsTable.append(testsHead, testsBody);
        statistics.append(interpretation, estimateTable, testsTable);
        if (analysis.diagnostics.warnings.length) {
          const warnings = document.createElement("ul"); warnings.className = "warnings classic-tables-2x2-warnings";
          warnings.replaceChildren(...analysis.diagnostics.warnings.map((message) => { const item = document.createElement("li"); item.textContent = message; return item; }));
          statistics.append(warnings);
        }
      }
      if (stratum.fisherExact) {
        const fisher = document.createElement("p");
        fisher.className = stratum.fisherExact.state === "computed" ? "classic-tables-fisher" : "warnings classic-tables-fisher";
        fisher.textContent = stratum.fisherExact.state === "computed"
          ? `Fisher–Freeman–Halton Exact (R x C) Probability ${stratum.fisherExact.pValue < 1e-6 ? stratum.fisherExact.pValue.toExponential(10) : stratum.fisherExact.pValue.toFixed(10)} · ${stratum.fisherExact.tablesEnumerated.toLocaleString("en-US")} tables enumerated`
          : `Fisher–Freeman–Halton Exact unavailable: ${stratum.fisherExact.reason}`;
        statistics.append(fisher);
      }
    } else {
      const unavailable = document.createElement("p"); unavailable.className = "warnings"; unavailable.textContent = "Pearson chi-square is undefined because this stratum has fewer than two non-empty rows or columns."; statistics.append(unavailable);
    }
    section.append(heading, scroll, statistics); return section;
  }));
  output.hidden = false;
}

function renderClassicComplexFrequencyOutput(plan: ClassicComplexFrequencyPlan, result: ClassicComplexFrequencyResult): void {
  const output = requiredElement<HTMLElement>("#classic-tables-categorical-output");
  requiredElement("#classic-tables-categorical-title").textContent = `${plan.prompt} — Complex Sample Frequencies`;
  requiredElement("#classic-tables-categorical-count").textContent = `${result.includedRecords} records · weighted N ${number(result.weightedTotal, 4)} · ${result.primarySamplingUnits} PSU/stratum units · df ${result.degreesOfFreedom}`;
  requiredElement("#classic-tables-categorical-note").textContent = `Taylor-series variance using PSU ${plan.psuPrompt}${plan.strataPrompt ? ` within design strata ${plan.strataPrompt}` : " without a STRATAVAR"}${plan.weightPrompt ? ` and weights ${plan.weightPrompt}` : " with unit weights"}. ${result.excludedRecords} incomplete or invalid design records excluded. Linear and logit 95% limits use the inspected legacy t multiplier ${number(result.confidenceMultiplier, 6)}.`;
  const section = document.createElement("section"); section.className = "classic-tables-stratum classic-complex-frequency-result";
  const heading = document.createElement("h3"); heading.textContent = "Complex Sample Design Analysis";
  const scroll = document.createElement("div"); scroll.className = "results-table-scroll";
  const table = document.createElement("table"); table.className = "results-table classic-complex-frequency";
  const head = document.createElement("thead"); head.innerHTML = `<tr><th scope="col">${plan.prompt}</th><th scope="col">Count</th><th scope="col">Weighted count</th><th scope="col">Percent</th><th scope="col">SE %</th><th scope="col">Linear lower</th><th scope="col">Linear upper</th><th scope="col">Logit lower</th><th scope="col">Logit upper</th><th scope="col">Design effect</th></tr>`;
  const body = document.createElement("tbody");
  body.replaceChildren(...result.rows.map((resultRow) => {
    const row = document.createElement("tr");
    const values = [resultRow.value, String(resultRow.count), number(resultRow.weightedCount, 4), resultRow.percent.toFixed(3), resultRow.standardError.toFixed(4), resultRow.lowerConfidenceLimit.toFixed(3), resultRow.upperConfidenceLimit.toFixed(3), resultRow.logitLowerConfidenceLimit === null ? "Undefined" : resultRow.logitLowerConfidenceLimit.toFixed(3), resultRow.logitUpperConfidenceLimit === null ? "Undefined" : resultRow.logitUpperConfidenceLimit.toFixed(3), resultRow.designEffect === null ? "Undefined" : resultRow.designEffect.toFixed(4)];
    values.forEach((value, index) => { const cell = document.createElement(index === 0 ? "th" : "td"); cell.textContent = value; if (index === 0) cell.setAttribute("scope", "row"); row.append(cell); });
    return row;
  }));
  table.append(head, body); scroll.append(table); section.append(heading, scroll);
  requiredElement("#classic-tables-categorical-body").replaceChildren(section);
  output.hidden = false;
}

function renderClassicComplexMeansOutput(plan: ClassicComplexMeansPlan, result: ClassicComplexMeansResult): void {
  const output = requiredElement<HTMLElement>("#classic-tables-categorical-output");
  requiredElement("#classic-tables-categorical-title").textContent = `${plan.prompt}${plan.crossTabPrompt ? ` by ${plan.crossTabPrompt}` : ""} — Complex Sample Means`;
  requiredElement("#classic-tables-categorical-count").textContent = `${result.includedRecords} records · ${result.primarySamplingUnits} PSU/stratum units · df ${result.degreesOfFreedom}`;
  requiredElement("#classic-tables-categorical-note").textContent = `Taylor-series variance using PSU ${plan.psuPrompt}${plan.strataPrompt ? ` within design strata ${plan.strataPrompt}` : " without a STRATAVAR"}${plan.weightPrompt ? ` and weights ${plan.weightPrompt}` : " with unit weights"}. ${result.excludedRecords} incomplete or invalid design records excluded.`;
  const section = document.createElement("section"); section.className = "classic-tables-stratum classic-complex-means-result";
  const table = document.createElement("table"); table.className = "results-table classic-complex-means";
  table.innerHTML = `<thead><tr><th scope="col">${plan.crossTabPrompt ?? "Domain"}</th><th scope="col">Count</th><th scope="col">Mean</th><th scope="col">Standard error</th><th scope="col">Lower 95%</th><th scope="col">Upper 95%</th><th scope="col">Minimum</th><th scope="col">Maximum</th></tr></thead>`;
  const body = document.createElement("tbody"); const show = (value: number | null): string => value === null ? "—" : number(value, 4);
  body.replaceChildren(...result.rows.map((item) => { const row = document.createElement("tr"); [item.label, item.count === null ? "" : String(item.count), show(item.mean), show(item.standardError), show(item.lowerConfidenceLimit), show(item.upperConfidenceLimit), show(item.minimum), show(item.maximum)].forEach((value, index) => { const cell = document.createElement(index === 0 ? "th" : "td"); cell.textContent = value; if (index === 0) cell.setAttribute("scope", "row"); row.append(cell); }); return row; }));
  table.append(body); const scroll = document.createElement("div"); scroll.className = "results-table-scroll"; scroll.append(table); section.append(scroll); requiredElement("#classic-tables-categorical-body").replaceChildren(section); output.hidden = false;
}

function renderClassicComplexTablesOutput(plan: ClassicComplexTablesPlan, result: ClassicComplexTablesResult): void {
  const output = requiredElement<HTMLElement>("#classic-tables-categorical-output");
  const body = requiredElement("#classic-tables-categorical-body");
  const format = (value: number, digits = 4): string => Number.isInteger(value) ? String(value) : number(value, digits);
  requiredElement("#classic-tables-categorical-title").textContent = `${plan.exposurePrompt} by ${plan.outcomePrompt} — Complex Sample Tables`;
  requiredElement("#classic-tables-categorical-count").textContent = `${result.includedRecords} records · weighted N ${format(result.weightedTotal)} · ${result.primarySamplingUnits} PSU/stratum units · df ${result.degreesOfFreedom}`;
  requiredElement("#classic-tables-categorical-note").textContent = `Taylor-series variance using PSU ${plan.psuPrompt}${plan.strataPrompt ? ` within design strata ${plan.strataPrompt}` : " without a STRATAVAR"}${plan.weightPrompt ? ` and weights ${plan.weightPrompt}` : " with unit weights"}. ${result.excludedRecords} incomplete or invalid design record${result.excludedRecords === 1 ? " was" : "s were"} excluded. 95% limits use the inspected legacy t multiplier ${number(result.confidenceMultiplier, 6)}.`;
  const section = document.createElement("section");
  section.className = "classic-tables-stratum classic-complex-tables-result";
  const heading = document.createElement("h3");
  heading.textContent = "CTABLES Complex Sample Design Analysis";
  const scroll = document.createElement("div");
  scroll.className = "results-table-scroll";
  const table = document.createElement("table");
  table.className = "results-table classic-complex-tables";
  const head = document.createElement("thead");
  head.innerHTML = `<tr><th scope="col">${plan.exposurePrompt}</th><th scope="col">${plan.outcomePrompt}</th><th scope="col">Count</th><th scope="col">Weighted count</th><th scope="col">Row %</th><th scope="col">Col %</th><th scope="col">SE %</th><th scope="col">Lower 95%</th><th scope="col">Upper 95%</th><th scope="col">Design effect</th></tr>`;
  const tableBody = document.createElement("tbody");
  tableBody.replaceChildren(...result.rows.flatMap((row) => row.cells.map((cell, index) => {
    const tr = document.createElement("tr");
    const values = [index === 0 ? row.exposureValue : "", cell.outcomeValue, String(cell.count), format(cell.weightedCount), cell.rowPercent.toFixed(2), cell.columnPercent.toFixed(2), cell.standardError.toFixed(4), cell.lowerConfidenceLimit.toFixed(2), cell.upperConfidenceLimit.toFixed(2), cell.designEffect === null ? "Undefined" : cell.designEffect.toFixed(4)];
    values.forEach((value, column) => { const node = document.createElement(column < 2 ? "th" : "td"); node.textContent = value; if (column < 2) node.setAttribute("scope", column === 0 ? "rowgroup" : "row"); tr.append(node); });
    return tr;
  })));
  table.append(head, tableBody); scroll.append(table); section.append(heading, scroll);
  if (result.risk) {
    const riskHeading = document.createElement("h4"); riskHeading.textContent = "CTABLES Complex Sample Design Analysis of 2 × 2 Table";
    const orientation = document.createElement("p"); orientation.className = "classic-tables-2x2-interpretation";
    orientation.textContent = `Orientation: exposed=${result.risk.exposedValue}, unexposed=${result.risk.unexposedValue}; case=${result.risk.caseValue}, non-case=${result.risk.nonCaseValue}.`;
    const riskTable = document.createElement("table"); riskTable.className = "results-table classic-complex-tables-risk";
    riskTable.innerHTML = `<thead><tr><th scope="col">Parameter</th><th scope="col">Estimate</th><th scope="col">Standard error</th><th scope="col">95% confidence limits</th></tr></thead><tbody>
      <tr><th scope="row">Odds Ratio (OR)</th><td>${format(result.risk.oddsRatio)}</td><td>${format(result.risk.oddsRatioStandardError)}</td><td>${format(result.risk.oddsRatioLower)} to ${format(result.risk.oddsRatioUpper)}</td></tr>
      <tr><th scope="row">Risk Ratio (RR)</th><td>${format(result.risk.riskRatio)}</td><td>${format(result.risk.riskRatioStandardError)}</td><td>${format(result.risk.riskRatioLower)} to ${format(result.risk.riskRatioUpper)}</td></tr>
      <tr><th scope="row">Risk Difference (RD%)</th><td>${format(result.risk.riskDifferencePercent)}%</td><td>${format(result.risk.riskDifferenceStandardError)}%</td><td>${format(result.risk.riskDifferenceLower)}% to ${format(result.risk.riskDifferenceUpper)}%</td></tr>
    </tbody>`;
    section.append(riskHeading, orientation, riskTable);
  }
  body.replaceChildren(section);
  output.hidden = false;
}

function renderClassicTablesAdjustedOutput(result: StratifiedTable2x2Result, durationMs: number): void {
  const section = document.createElement("section");
  section.className = "classic-tables-adjusted";
  const heading = document.createElement("h3");
  heading.textContent = "Stratified 2 × 2 Analysis";
  const orientation = document.createElement("p");
  orientation.className = "classic-tables-adjusted-orientation";
  orientation.textContent = `Adjusted across ${result.input.strata.length} strata using the exposed/case orientation shown in each table.`;

  const estimateTable = document.createElement("table");
  estimateTable.className = "results-table classic-tables-adjusted-estimates";
  const estimateHead = document.createElement("thead");
  estimateHead.innerHTML = "<tr><th scope=\"col\">Parameter</th><th scope=\"col\">Estimate</th><th scope=\"col\">95% confidence interval</th></tr>";
  const estimateBody = document.createElement("tbody");
  const interval = (value: ConfidenceInterval | null): string => value ? `${number(value.lower, 4)} to ${number(value.upper, 4)}` : "Undefined";
  const boundaryInterval = (value: BoundaryInterval): string => `${boundaryLabel(value.lower)} to ${boundaryLabel(value.upper)}`;
  const estimates: Array<readonly [string, string, string]> = [
    ["Mantel-Haenszel Odds Ratio", number(result.estimates.adjustedOddsRatio.estimate, 4), interval(result.estimates.adjustedOddsRatio.confidenceInterval)],
    ["Mantel-Haenszel Risk Ratio", number(result.estimates.adjustedRiskRatio.estimate, 4), interval(result.estimates.adjustedRiskRatio.confidenceInterval)],
    ["Conditional Maximum Likelihood Odds Ratio", boundaryLabel(result.estimates.adjustedConditionalOddsRatio.estimate), boundaryInterval(result.estimates.adjustedConditionalOddsRatio.fisherConfidenceInterval)],
  ];
  estimateBody.replaceChildren(...estimates.map((values) => {
    const row = document.createElement("tr");
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.setAttribute("scope", "row");
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
  estimateTable.append(estimateHead, estimateBody);

  const testsTable = document.createElement("table");
  testsTable.className = "results-table classic-tables-adjusted-tests";
  const testsHead = document.createElement("thead");
  testsHead.innerHTML = "<tr><th scope=\"col\">Statistical test</th><th scope=\"col\">Statistic</th><th scope=\"col\">df</th><th scope=\"col\">Probability</th></tr>";
  const testsBody = document.createElement("tbody");
  const testRows: Array<readonly [string, StratifiedTable2x2Result["tests"][keyof StratifiedTable2x2Result["tests"]]]> = [
    ["Mantel-Haenszel Chi-Squared - uncorrected", result.tests.mantelHaenszelUncorrected],
    ["Mantel-Haenszel Chi-Squared - corrected", result.tests.mantelHaenszelCorrected],
    ["Breslow-Day test for Odds Ratio homogeneity", result.tests.breslowDayOddsRatio],
    ["Breslow-Day-Tarone test for Odds Ratio homogeneity", result.tests.breslowDayTaroneOddsRatio],
    ["Epi Info test for Odds Ratio homogeneity", result.tests.legacyBreslowDayOddsRatio],
    ["Epi Info test for Risk Ratio homogeneity", result.tests.legacyBreslowDayRiskRatio],
  ];
  testsBody.replaceChildren(...testRows.map(([label, test]) => {
    const row = document.createElement("tr");
    const values = [label, test ? number(test.value, 4) : "Undefined", test ? String(test.degreesOfFreedom) : "", test ? pValue(test.pValue) : "Undefined"];
    values.forEach((value, index) => {
      const cell = document.createElement(index === 0 ? "th" : "td");
      if (index === 0) cell.setAttribute("scope", "row");
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
  testsTable.append(testsHead, testsBody);

  const audit = document.createElement("p");
  audit.className = "classic-tables-adjusted-audit";
  audit.textContent = `Rust/WASM epi.stratified2x2 ${result.engine.version} · ${result.diagnostics.informativeStrata} informative strata · ${durationMs.toFixed(1)} ms Worker calculation.`;
  section.append(heading, orientation, estimateTable, testsTable, audit);
  if (result.diagnostics.warnings.length) {
    const warnings = document.createElement("ul");
    warnings.className = "warnings classic-tables-adjusted-warnings";
    warnings.replaceChildren(...result.diagnostics.warnings.map((message) => {
      const item = document.createElement("li"); item.textContent = message; return item;
    }));
    section.append(warnings);
  }
  requiredElement("#classic-tables-categorical-body").append(section);
}

const CLASSIC_SELECTED_COMMAND_PLAN_VERSION = "classic-selected-command-v1.0.0";
let pendingClassicMerge: { plan: ClassicMergePlan; result: ClassicMergeResult } | null = null;
let pendingClassicDelete: { plan: ClassicDeleteTablePlan; staged: ReturnType<typeof stageClassicDeleteTable> } | null = null;
let pendingClassicDeleteRecords: ClassicDeleteRecordsResult | null = null;
let pendingClassicUndeleteRecords: ClassicUndeleteRecordsResult | null = null;
async function runSelectedClassicCommand(sourceOverride?: string, rethrow = false, signal?: AbortSignal): Promise<void> {
  const fallbackProject = getCurrentProjectData();
  let project = classicProgramSession.current(fallbackProject);
  const selectedSource = sourceOverride ?? classicProgramEditor.getSelectedText();
  try {
    assertClassicProgramNotCancelled(signal);
    const selectedAst = parseClassicProgram(selectedSource);
    const selectedSources = selectedAst.body[0]?.type === "ReadStatement" ? [...getProjectDataSources(), ...classicProgramSession.outTables()] : getProjectDataSources();
    const command = resolveSelectedClassicAnalysisCommand(selectedSource, project.fields, selectedSources, classicProgramSession.variables(), classicProgramSession.groups());
    if (command.kind === "set-missing") {
      classicProgramSession.setIncludeMissing(command.enabled);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `SET MISSING=${command.enabled ? "ON" : "OFF"}. Subsequent analyses will ${command.enabled ? "include missing values as a visible Missing category" : "exclude records missing any participating value"}.`;
      classicProgramCommandStatus.textContent = "Classic Analysis missing-value setting updated for this session.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: buildClassicAnalysisCommand(command),
        summary: `SET MISSING=${command.enabled ? "ON" : "OFF"}; no records changed.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "set-missing-label") {
      classicProgramSession.setMissingLabel(command.value);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Missing values will display as “${classicProgramSession.missingLabel()}” in subsequent analyses. No records changed.`;
      classicProgramCommandStatus.textContent = "Classic Analysis missing-value display label updated for this session.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: buildClassicAnalysisCommand(command),
        summary: `SET (.)=${JSON.stringify(classicProgramSession.missingLabel())}; no records changed.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "file-convert") {
      const plan = resolveFileConvertCommand(selectedSource);
      const file = classicCommandDialogAccessFile.files?.[0];
      if (!file) throw new RangeError(`Choose ${plan.inputFile} again through Insert Command before running FILE CONVERT.`);
      classicProgramFeedback.textContent = `Converting ${file.name} in this browser. The source file remains read-only…`;
      const targetLabel = plan.target === "duckdb" ? "DuckDB" : "SQLite";
      classicProgramCommandStatus.textContent = `FILE CONVERT is reading user tables and building a ${targetLabel} database.`;
      const result = await convertAccessFile(file, plan);
      assertClassicProgramNotCancelled(signal);
      const mime = plan.target === "duckdb" ? "application/octet-stream" : "application/vnd.sqlite3";
      const url = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes).buffer], { type: mime }));
      const link = document.createElement("a");
      link.href = url; link.download = plan.outputFile; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      const rows = result.tables.reduce((sum, table) => sum + table.rows, 0);
      requiredElement("#classic-file-convert-output-count").textContent = `${result.tables.length} tables · ${rows} rows`;
      requiredElement("#classic-file-convert-output-summary").textContent = `${plan.inputFile} → ${plan.outputFile} · ${targetLabel} ${result.engineVersion} · source SHA-256 ${result.sourceSha256}`;
      requiredElement("#classic-file-convert-output-body").replaceChildren(...result.tables.map((table) => {
        const row = document.createElement("tr");
        for (const value of [table.name, String(table.columns), String(table.rows)]) { const cell = document.createElement("td"); cell.textContent = value; row.append(cell); }
        return row;
      }));
      requiredElement("#classic-file-convert-output-warnings").replaceChildren(...result.warnings.map((warning) => { const item = document.createElement("li"); item.textContent = warning; return item; }));
      requiredElement<HTMLElement>("#classic-file-convert-output").hidden = false;
      requiredElement("#classic-file-convert-output").scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `Converted ${result.tables.length} tables and ${rows} rows to ${plan.outputFile}; the ${targetLabel} download includes a migration manifest and ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}.`;
      classicProgramCommandStatus.textContent = `NEW BRANCH FILE CONVERT completed with ${targetLabel} ${result.engineVersion}. Review migration warnings before use.`;
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: plan.version, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `Converted ${result.tables.length} Access tables and ${rows} rows; source SHA-256 ${result.sourceSha256}.`, diagnostics: result.warnings,
      });
      return;
    }
    if (command.kind === "relate") {
      const sources = getProjectDataSources();
      const plan = resolveClassicRelateCommand(selectedSource, project.fields, sources);
      const related = sources.find((candidate) => candidate.formName.toLocaleLowerCase("en-US") === plan.relatedForm.toLocaleLowerCase("en-US"))!;
      const result = applyClassicRelate(project, related, plan);
      project = classicProgramSession.relate(result.source);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Related ${result.parentRecords} active records to ${result.relatedRecords} ${plan.relatedForm} records; ${result.outputRecords} combined records are now active (${result.unmatchedParentRecords} unmatched parent records).`;
      classicProgramCommandStatus.textContent = "Selected RELATE command completed; subsequent LIST, FREQ, and MEANS use the combined active table.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: result.parentRecords,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `RELATE produced ${result.outputRecords} records from ${result.matchedParentRecords} matched and ${result.unmatchedParentRecords} unmatched parent records.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "write") {
      const plan = resolveClassicWriteCommand(selectedSource, project.fields, classicProgramSession.groups());
      const csv = serializeClassicWriteCsv(plan, project.records);
      const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = plan.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      classicProgramFeedback.textContent = `WRITE prepared ${project.records.length} active records and ${plan.fields.length} fields as ${plan.fileName}.`;
      classicProgramCommandStatus.textContent = "Selected WRITE REPLACE command completed as an explicit browser CSV download.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `WRITE downloaded ${project.records.length} records and ${plan.fields.length} fields as UTF-8 CSV.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "merge") {
      const sources = getProjectDataSources();
      const destination = classicProgramSession.base(fallbackProject);
      if (!sources.some((candidate) => candidate.formId === destination.formId)) {
        throw new RangeError("MERGE can modify a saved project form only. READ a project form before running MERGE against a RELATE result.");
      }
      const plan = resolveClassicMergeCommand(selectedSource, destination.fields, sources);
      const sourceForm = sources.find((candidate) => candidate.formName.toLocaleLowerCase("en-US") === plan.sourceForm.toLocaleLowerCase("en-US"))!;
      const result = applyClassicMerge(destination, sourceForm, plan);
      pendingClassicMerge = { plan, result };
      requiredElement("#classic-merge-preview-destination").textContent = destination.formName;
      requiredElement("#classic-merge-preview-source").textContent = sourceForm.formName;
      requiredElement("#classic-merge-preview-before").textContent = String(result.destinationRecords);
      requiredElement("#classic-merge-preview-source-count").textContent = String(result.sourceRecords);
      requiredElement("#classic-merge-preview-updated").textContent = String(result.updatedRecords);
      requiredElement("#classic-merge-preview-inserted").textContent = String(result.insertedRecords);
      requiredElement("#classic-merge-preview-after").textContent = String(result.outputRecords);
      requiredElement("#classic-merge-preview-fields").textContent = `Shared fields considered: ${result.sharedFields.join(", ")}. Key fields are not overwritten on matched records.`;
      requiredElement("#classic-merge-preview-feedback").textContent = "Preview ready. No project records have changed.";
      classicMergePreviewDialog.showModal();
      classicProgramFeedback.textContent = `MERGE preview: ${result.updatedRecords} source rows would update a destination record and ${result.insertedRecords} would be inserted. No records have changed.`;
      classicProgramCommandStatus.textContent = "Selected MERGE command is awaiting explicit confirmation in Review Merge.";
      return;
    }
    if (command.kind === "delete-table") {
      const sources = getProjectDataSources();
      const plan = resolveClassicDeleteTableCommand(selectedSource, sources);
      const target = sources.find((candidate) => candidate.formId === plan.formId)!;
      const staged = stageClassicDeleteTable(target, plan);
      pendingClassicDelete = { plan, staged };
      requiredElement("#classic-delete-preview-form").textContent = plan.formName;
      requiredElement("#classic-delete-preview-records").textContent = String(plan.recordCount);
      requiredElement<HTMLInputElement>("#classic-delete-preview-confirm").checked = false;
      requiredElement<HTMLButtonElement>("#classic-delete-preview-apply").disabled = true;
      requiredElement("#classic-delete-preview-feedback").textContent = "Preview ready. No project records have changed.";
      classicDeletePreviewDialog.showModal();
      classicProgramFeedback.textContent = `DELETE TABLES preview: ${plan.recordCount} records would be permanently removed from ${plan.formName}. No records have changed.`;
      classicProgramCommandStatus.textContent = "Selected DELETE TABLES command is awaiting explicit confirmation.";
      return;
    }
    if (command.kind === "delete-records") {
      const base = classicProgramSession.base(fallbackProject);
      const saved = getProjectDataSources().find((candidate) => candidate.formId === base.formId);
      if (!saved) throw new RangeError("DELETE RECORDS can modify only a saved project form.");
      const plan = resolveClassicDeleteRecordsCommand(selectedSource, project.fields);
      const result = stageClassicDeleteRecords(saved, project, plan);
      if (!result.matchedRecords) throw new RangeError("DELETE RECORDS matched no active records. No preview was opened.");
      pendingClassicDeleteRecords = result;
      requiredElement("#classic-delete-records-preview-form").textContent = result.formName;
      requiredElement("#classic-delete-records-preview-source").textContent = String(result.sourceSnapshot.length);
      requiredElement("#classic-delete-records-preview-active").textContent = String(result.activeRecords);
      requiredElement("#classic-delete-records-preview-matched").textContent = String(result.matchedRecords);
      requiredElement("#classic-delete-records-preview-remaining").textContent = String(result.remainingRecords.length);
      requiredElement<HTMLInputElement>("#classic-delete-records-preview-confirm").checked = false;
      requiredElement<HTMLButtonElement>("#classic-delete-records-preview-apply").disabled = true;
      requiredElement("#classic-delete-records-preview-feedback").textContent = "Preview ready. No project records have changed.";
      classicDeleteRecordsPreviewDialog.showModal();
      classicProgramFeedback.textContent = `DELETE RECORDS preview: ${result.matchedRecords} of ${result.activeRecords} active records would move to the Recycle Bin. No records have changed.`;
      classicProgramCommandStatus.textContent = "Selected DELETE RECORDS command is awaiting explicit confirmation.";
      return;
    }
    if (command.kind === "undelete-records") {
      const base = classicProgramSession.base(fallbackProject);
      const saved = getProjectDataSources().find((candidate) => candidate.formId === base.formId);
      if (!saved) throw new RangeError("UNDELETE RECORDS can restore only into a saved project form.");
      if (project.formId !== saved.formId || project.records.length !== saved.records.length) {
        throw new RangeError("UNDELETE RECORDS requires the complete saved form. CANCEL SELECT or READ the form again before restoring records.");
      }
      const form = getCurrentProjectSnapshot().forms.find((candidate) => candidate.id === saved.formId)!;
      const plan = resolveClassicUndeleteRecordsCommand(selectedSource, saved.fields);
      const result = stageClassicUndeleteRecords(saved, form.deletedRecords ?? [], plan);
      if (!result.restored.length) throw new RangeError("UNDELETE RECORDS matched no records in the Recycle Bin. No preview was opened.");
      pendingClassicUndeleteRecords = result;
      requiredElement("#classic-undelete-records-preview-form").textContent = result.formName;
      requiredElement("#classic-undelete-records-preview-active").textContent = String(result.sourceSnapshot.length);
      requiredElement("#classic-undelete-records-preview-deleted").textContent = String(result.archiveSnapshot.length);
      requiredElement("#classic-undelete-records-preview-matched").textContent = String(result.restored.length);
      requiredElement("#classic-undelete-records-preview-remaining").textContent = String(result.remainingDeleted.length);
      requiredElement("#classic-undelete-records-preview-after").textContent = String(result.restoredRecords.length);
      requiredElement<HTMLInputElement>("#classic-undelete-records-preview-confirm").checked = false;
      requiredElement<HTMLButtonElement>("#classic-undelete-records-preview-apply").disabled = true;
      requiredElement("#classic-undelete-records-preview-feedback").textContent = "Preview ready. No project records have changed.";
      classicUndeleteRecordsPreviewDialog.showModal();
      classicProgramFeedback.textContent = `UNDELETE RECORDS preview: ${result.restored.length} of ${result.archiveSnapshot.length} deleted records would be restored. No records have changed.`;
      classicProgramCommandStatus.textContent = "Selected UNDELETE RECORDS command is awaiting explicit confirmation.";
      return;
    }
    if (command.kind === "define") {
      const plan = resolveClassicDefineCommand(selectedSource, project.fields, classicProgramSession.variables(), classicProgramSession.groups());
      const variable = classicProgramSession.defineVariable(plan);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Defined Standard ${variable.variableType} session variable ${variable.name}. Its current value is Missing.`;
      classicProgramCommandStatus.textContent = "Selected DEFINE command completed; the variable is available to bounded ASSIGN.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource, summary: `Defined Standard ${variable.variableType} session variable ${variable.name}.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "define-group") {
      const plan = resolveClassicDefineGroupCommand(selectedSource, project.fields, classicProgramSession.variables(), classicProgramSession.groups());
      const group = classicProgramSession.defineGroup(plan);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Defined GROUPVAR ${group.name} with ${group.members.length} members. Record data was not changed.`;
      classicProgramCommandStatus.textContent = "Selected DEFINE GROUPVAR command completed; LIST can now expand the named group.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `Defined GROUPVAR ${group.name} with ${group.members.length} members.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "undefine") {
      const plan = resolveClassicUndefineCommand(selectedSource, project.fields, classicProgramSession.variables());
      const removed = plan.mode === "all-standard"
        ? classicProgramSession.undefineAllStandard()
        : [classicProgramSession.undefineVariable(plan.variable!.name)];
      renderClassicProgramSession();
      classicProgramFeedback.textContent = plan.mode === "all-standard"
        ? `Undefined ${removed.length} Standard session variable${removed.length === 1 ? "" : "s"}. Record data was not changed.`
        : `Undefined Standard session variable ${removed[0]!.name}. Record data was not changed.`;
      classicProgramCommandStatus.textContent = "Selected UNDEFINE command completed; removed variables are no longer available to ASSIGN or IF.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `UNDEFINE removed ${removed.length} Standard session variable${removed.length === 1 ? "" : "s"}.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "assign") {
      const plan = resolveClassicAssignCommand(selectedSource, project.fields, classicProgramSession.variables());
      const variable = classicProgramSession.assignVariable(plan.variable.name, plan.value);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Assigned ${variable.name} = ${String(variable.value)} in this Classic session. Record data was not changed.`;
      classicProgramCommandStatus.textContent = "Selected ASSIGN command completed for one Standard session variable.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource, summary: `Assigned Standard session variable ${variable.name}.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "display") {
      const plan = resolveClassicDisplayCommand(selectedSource, project.fields, classicProgramSession.variables());
      const rowCount = renderClassicDisplayOutput(project, selectedSource);
      requiredElement("#classic-display-output").scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `Displayed ${rowCount} current variable${rowCount === 1 ? "" : "s"}. No data or session state was changed.`;
      classicProgramCommandStatus.textContent = "Selected DISPLAY DBVARIABLES command completed in familiar Output.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `DISPLAY DBVARIABLES rendered ${rowCount} variable${rowCount === 1 ? "" : "s"}.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "if") {
      const plan = resolveClassicIfCommand(selectedSource, project.fields, classicProgramSession.variables());
      const result = evaluateClassicIf(plan, classicProgramSession.variables());
      if (result.assignment) classicProgramSession.assignVariable(result.assignment.variable, result.assignment.value);
      renderClassicProgramSession();
      const effect = result.assignment
        ? `${result.assignment.variable} = ${String(result.assignment.value)}`
        : "no assignment (the condition was false and no ELSE was present)";
      classicProgramFeedback.textContent = `IF evaluated ${String(result.conditionResult)}; ${result.branch.toUpperCase()} produced ${effect}. Record data was not changed.`;
      classicProgramCommandStatus.textContent = "Selected IF block completed through one validated Standard-variable ASSIGN branch.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `IF evaluated ${String(result.conditionResult)} and selected ${result.branch.toUpperCase()}; ${effect}.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "read") {
      project = classicProgramSession.read(command.table, [...getProjectDataSources(), ...classicProgramSession.outTables()]);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Read ${project.records.length} records from ${project.formName}. Subsequent selected commands use this active data source.`;
      classicProgramCommandStatus.textContent = "Selected READ command completed; the active Classic Analysis data source changed.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: buildClassicAnalysisCommand(command), summary: `READ selected ${project.formName} with ${project.records.length} records.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "select") {
      const plan = resolveClassicSelectionCommand(selectedSource, project.fields, classicProgramSession.variables());
      if (plan.kind !== "apply") throw new Error("The selected command did not contain selection criteria.");
      const result = applyClassicSelection(classicProgramSession.filtered(fallbackProject).records, plan);
      classicProgramSession.select(result.records, plan.canonicalSource, result.excludedMissing);
      project = classicProgramSession.current(fallbackProject);
      const status = classicProgramSession.selectionStatus(fallbackProject);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Selected ${status.selected} of ${status.total} records; ${status.excluded} excluded (${status.excludedMissing} missing comparisons). Additional SELECT commands narrow this selection with AND.`;
      classicProgramCommandStatus.textContent = "Selected SELECT command completed; LIST, FREQ, and MEANS now use the selected records.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: result.sourceRecords,
        source: selectedSource, canonicalSource: plan.canonicalSource, summary: `SELECT retained ${result.selectedRecords} of ${result.sourceRecords} active records; ${result.excludedRecords} excluded.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "cancel-select") {
      const hadSelection = classicProgramSession.cancelSelection();
      project = classicProgramSession.current(fallbackProject);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = hadSelection ? `Selection cancelled; all ${project.records.length} records are active again.` : `No selection was active; all ${project.records.length} records remain active.`;
      classicProgramCommandStatus.textContent = "Selected CANCEL SELECT command completed; the active data source is unfiltered.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: "CANCEL SELECT", summary: hadSelection ? `CANCEL SELECT restored all ${project.records.length} records.` : "CANCEL SELECT completed with no active selection.", diagnostics: [],
      });
      return;
    }
    if (command.kind === "sort") {
      const plan = resolveClassicSortCommand(selectedSource, project.fields);
      if (plan.kind !== "apply") throw new Error("The selected command did not contain sort variables.");
      classicProgramSession.sort(plan);
      project = classicProgramSession.current(fallbackProject);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = `Sorted ${project.records.length} active records by ${plan.items.length} field${plan.items.length === 1 ? "" : "s"}. Selection membership was unchanged.`;
      classicProgramCommandStatus.textContent = "Selected SORT command completed; LIST now uses the active record order.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource, summary: `SORT ordered ${project.records.length} active records by ${plan.items.length} field${plan.items.length === 1 ? "" : "s"}.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "cancel-sort") {
      const hadSort = classicProgramSession.cancelSort();
      project = classicProgramSession.current(fallbackProject);
      renderClassicProgramSession();
      classicProgramFeedback.textContent = hadSort ? `Sort cancelled; ${project.records.length} active records returned to source order.` : `No sort was active; ${project.records.length} records remain in source order.`;
      classicProgramCommandStatus.textContent = "Selected CANCEL SORT command completed; selection membership was unchanged.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: "CANCEL SORT", summary: hadSort ? `CANCEL SORT restored source order for ${project.records.length} active records.` : "CANCEL SORT completed with no active sort.", diagnostics: [],
      });
      return;
    }
    if (command.kind === "list") {
      renderClassicListOutput(project, command.fields);
      requiredElement("#classic-list-output").scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `Executed selected ${buildClassicAnalysisCommand(command)} for ${project.records.length} records.`;
      classicProgramCommandStatus.textContent = "Selected LIST command completed through the active Classic Analysis data source.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: buildClassicAnalysisCommand(command), summary: `Listed ${command.fields.length} fields for ${project.records.length} records.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "frequency") {
      const field = project.fields.find((candidate) => candidate.name === command.field)!;
      if (command.psuBy) {
        const plan = resolveClassicComplexFrequencyPlan(selectedSource, project.fields, command.field, command.stratifyBy, command.weightBy, command.psuBy, command.outputTable);
        const result = applyClassicComplexFrequency(project.records, plan);
        renderClassicComplexFrequencyOutput(plan, result);
        const outTable = plan.outputTable ? classicProgramSession.storeOutTable(classicComplexFrequencyOutTable(project, plan, result)) : null;
        requiredElement("#classic-tables-categorical-output").scrollIntoView({ behavior: "smooth", block: "start" });
        classicProgramFeedback.textContent = `Complex Sample Frequencies used ${result.primarySamplingUnits} PSU/stratum units and ${result.designStrata} design strata (df ${result.degreesOfFreedom}).${outTable ? ` OUTTABLE ${outTable.formName} retained ${outTable.records.length} result rows.` : ""}`;
        classicProgramCommandStatus.textContent = "Selected PSUVAR FREQ command completed through the legacy Taylor-series complex-sample method.";
        recordProgramRun({
          origin: "user-program", status: "succeeded", planVersion: plan.version, astVersion: CLASSIC_AST_VERSION,
          projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
          source: selectedSource, canonicalSource: plan.canonicalSource,
          summary: `Complex Sample Frequencies analyzed ${result.includedRecords} complete records using ${result.primarySamplingUnits} PSU/stratum units, ${result.designStrata} strata, and df ${result.degreesOfFreedom}.${outTable ? ` OUTTABLE stored ${outTable.records.length} rows as ${outTable.formName}.` : ""}`,
          diagnostics: result.excludedRecords ? [`${result.excludedRecords} incomplete or invalid survey-design records excluded.`] : [],
        });
        return;
      }
      const strata = command.stratifyBy ? project.fields.find((candidate) => candidate.name === command.stratifyBy) : undefined;
      if (strata) renderStratifiedFrequency(deriveStratifiedFrequency(project.records, {
        field: field.name, prompt: field.prompt, includeMissing: false, stratifyBy: strata.name, stratifyPrompt: strata.prompt,
      }));
      else renderFrequency(deriveFrequency(project.records, { field: field.name, prompt: field.prompt, includeMissing: false }));
      const output = strata ? requiredElement("#frequency-stratified-output") : requiredElement("#frequency-output");
      output.scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `Executed selected ${buildClassicAnalysisCommand(command)}. Missing values were excluded.`;
      classicProgramCommandStatus.textContent = "Selected FREQ command completed through the typed frequency operation.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: buildClassicAnalysisCommand(command), summary: "Executed one selected FREQ command.", diagnostics: [],
      });
      return;
    }
    if (command.kind === "means") {
      if (command.psuBy) {
        const plan = resolveClassicComplexMeansPlan(selectedSource, project.fields, command.field, command.crossTabBy, command.stratifyBy, command.weightBy, command.psuBy, command.outputTable);
        const result = applyClassicComplexMeans(project.records, plan); renderClassicComplexMeansOutput(plan, result);
        const outTable = plan.outputTable ? classicProgramSession.storeOutTable(classicComplexMeansOutTable(project, plan, result)) : null;
        requiredElement("#classic-tables-categorical-output").scrollIntoView({ behavior: "smooth", block: "start" });
        classicProgramFeedback.textContent = `Complex Sample Means used ${result.primarySamplingUnits} PSU/stratum units and ${result.designStrata} design strata (df ${result.degreesOfFreedom}).${outTable ? ` Adapted OUTTABLE ${outTable.formName} retained ${outTable.records.length} visible result rows.` : ""}`;
        classicProgramCommandStatus.textContent = `Selected PSUVAR MEANS command completed through the legacy Taylor-series complex-sample method${outTable ? "; its browser-adapted result table is available to READ in this session" : ""}.`;
        recordProgramRun({ origin: "user-program", status: "succeeded", planVersion: plan.version, astVersion: CLASSIC_AST_VERSION, projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length, source: selectedSource, canonicalSource: plan.canonicalSource, summary: `Complex Sample Means analyzed ${result.includedRecords} complete records using ${result.primarySamplingUnits} PSU/stratum units, ${result.designStrata} strata, and df ${result.degreesOfFreedom}.${outTable ? ` Browser-adapted OUTTABLE stored ${outTable.records.length} rows as ${outTable.formName}.` : ""}`, diagnostics: [...(result.excludedRecords ? [`${result.excludedRecords} incomplete or invalid survey-design records excluded.`] : []), ...(outTable ? ["Desktop Complex Sample Means exposes a disabled Output to Table control; this result-table schema is an explicit browser adaptation."] : [])] });
        return;
      }
      const field = project.fields.find((candidate) => candidate.name === command.field)!;
      renderMeans(deriveMeans(project.records, { field: field.name, prompt: field.prompt }));
      meansOutput.scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `Executed selected ${buildClassicAnalysisCommand(command)}.`;
      classicProgramCommandStatus.textContent = "Selected MEANS command completed through the typed means operation.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: buildClassicAnalysisCommand(command), summary: "Executed one selected MEANS command.", diagnostics: [],
      });
      return;
    }
    if (command.kind === "summarize") {
      const plan = resolveClassicSummarizeCommand(selectedSource, project.fields);
      const result = applyClassicSummarize(project, plan);
      classicProgramSession.storeOutTable(result.source);
      renderClassicSummarizeOutput(result);
      requiredElement("#classic-summarize-output").scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `SUMMARIZE created in-session table ${result.source.formName} with ${result.groups} row${result.groups === 1 ? "" : "s"}.`;
      classicProgramCommandStatus.textContent = "Selected SUMMARIZE completed; its named output table is available to READ in this Classic session.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: result.sourceRecords,
        source: selectedSource, canonicalSource: result.canonicalSource,
        summary: `SUMMARIZE created ${result.source.formName} with ${result.groups} rows from ${result.includedRecords} included values.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "graph") {
      const plan = resolveClassicGraphCommand(selectedSource, project.fields);
      const result = deriveFrequency(project.records, { field: plan.field, prompt: plan.fieldDefinition.prompt, includeMissing: false });
      renderClassicGraphOutput(plan, result);
      requiredElement("#classic-graph-output").scrollIntoView({ behavior: "smooth", block: "start" });
      const graphShape = plan.graphType === "Bar" ? "horizontal bars" : plan.graphType === "Column" ? "vertical columns" : "pie slices";
      classicProgramFeedback.textContent = `GRAPH rendered ${result.categories.length} ${graphShape} from ${result.totals.includedRecords} active records.`;
      classicProgramCommandStatus.textContent = "Selected GRAPH command completed through the typed frequency operation and browser chart renderer.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: plan.version, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `GRAPH rendered ${result.categories.length} ${plan.graphType} categories; ${result.totals.excludedMissing} missing values excluded.`, diagnostics: [],
      });
      return;
    }
    if (command.kind === "quality") {
      const plan = resolveEpiAiQualityCommand(selectedSource, project.fields);
      const report = applyEpiAiQualityProfile(project, plan);
      renderEpiAiQualityOutput(report);
      requiredElement("#classic-quality-output").scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `QUALITY profiled ${report.fields.length} fields across ${report.recordCount} active records. No data changed.`;
      classicProgramCommandStatus.textContent = "NEW BRANCH EPIAI QUALITY completed through the same typed validation engine used by Data Quality Check.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: plan.version, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: plan.canonicalSource,
        summary: `QUALITY found ${report.issues.length} validation issues and ${report.duplicateGroups.length} duplicate candidate groups.`, diagnostics: [],
      });
      return;
    }
    const tableExposures = command.exposures ?? [command.exposure];
    if (command.psuBy) {
      const complexRuns: Array<{ plan: ClassicComplexTablesPlan; result: ClassicComplexTablesResult; snapshot: HTMLElement }> = [];
      for (const exposure of tableExposures) {
        assertClassicProgramNotCancelled(signal);
        const plan = resolveClassicComplexTablesPlan(selectedSource, project.fields, exposure, command.outcome, command.stratifyBy, command.weightBy, command.psuBy, command.outputTable);
        const result = applyClassicComplexTables(project.records, plan);
        renderClassicComplexTablesOutput(plan, result);
        const snapshot = retainedSequentialOutput(requiredElement<HTMLElement>("#classic-tables-categorical-output"));
        snapshot.classList.add("classic-tables-expanded-result");
        complexRuns.push({ plan, result, snapshot });
      }
      const firstRun = complexRuns[0]!;
      const finalRun = complexRuns.at(-1)!;
      const outTable = finalRun.plan.outputTable ? classicProgramSession.storeOutTable(classicComplexTablesOutTable(project, finalRun.plan, finalRun.result)) : null;
      if (complexRuns.length > 1) {
        requiredElement("#classic-tables-categorical-title").textContent = `${command.exposure} by ${firstRun.plan.outcomePrompt} — Complex Sample Tables`;
        requiredElement("#classic-tables-categorical-count").textContent = `${complexRuns.length} expanded survey tables · ${project.records.length} source records`;
        requiredElement("#classic-tables-categorical-note").textContent = `Legacy exposure expansion ran ${complexRuns.length} survey-adjusted tables using PSU ${firstRun.plan.psuPrompt}.`;
        requiredElement("#classic-tables-categorical-body").replaceChildren(...complexRuns.map(({ snapshot }) => snapshot));
      }
      requiredElement<HTMLElement>("#classic-tables-categorical-output").hidden = false;
      requiredElement("#classic-tables-categorical-output").scrollIntoView({ behavior: "smooth", block: "start" });
      classicProgramFeedback.textContent = `Complex Sample Tables used ${firstRun.result.primarySamplingUnits} PSU/stratum units and ${firstRun.result.designStrata} design strata (df ${firstRun.result.degreesOfFreedom})${complexRuns.length > 1 ? ` across ${complexRuns.length} expanded exposures` : ""}.${outTable ? ` OUTTABLE ${outTable.formName} retained ${outTable.records.length} result rows${complexRuns.length > 1 ? ` from the final exposure ${finalRun.plan.exposureField}` : ""}.` : ""}`;
      classicProgramCommandStatus.textContent = "Selected PSUVAR TABLES command completed through the legacy Taylor-series complex-sample method.";
      recordProgramRun({
        origin: "user-program", status: "succeeded", planVersion: complexRuns.length > 1 ? CLASSIC_TABLES_EXPANSION_PLAN_VERSION : firstRun.plan.version, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, canonicalSource: complexRuns.length > 1 ? selectedSource.trim() : firstRun.plan.canonicalSource,
        summary: `Complex Sample Tables analyzed ${firstRun.result.includedRecords} complete records using ${firstRun.result.primarySamplingUnits} PSU/stratum units, ${firstRun.result.designStrata} strata, and df ${firstRun.result.degreesOfFreedom}.${firstRun.result.risk ? " Survey-adjusted OR, RR, and RD were produced." : ""}${outTable ? ` OUTTABLE stored ${outTable.records.length} rows as ${outTable.formName}.` : ""}`,
        diagnostics: firstRun.result.excludedRecords ? [`${firstRun.result.excludedRecords} incomplete or invalid survey-design records excluded.`] : [],
      });
      return;
    }
    const tableRuns: Array<{ plan: ClassicTablesPlan; result: ClassicTablesResult; adjusted: StratifiedTable2x2Result | null; snapshot: HTMLElement }> = [];
    for (const [tableIndex, exposure] of tableExposures.entries()) {
      assertClassicProgramNotCancelled(signal);
      const tablesPlan = resolveClassicTablesPlan(selectedSource, project.fields, exposure, command.outcome, command.stratifyBy, command.statistics, command.weightBy, classicProgramSession.includeMissing(), classicProgramSession.missingLabel(), command.outputTable, command.oneIsYes, command.noWrap, command.columnSize);
      const tablesResult = applyClassicTables(project.records, tablesPlan);
      renderClassicTablesOutput(tablesPlan, tablesResult);
      const adjustedInput = classicTablesStratified2x2Input(tablesResult);
      let adjustedResult: StratifiedTable2x2Result | null = null;
      if (adjustedInput) {
        classicProgramCommandStatus.textContent = `Calculating adjusted results for table ${tableIndex + 1} of ${tableExposures.length} across ${adjustedInput.strata.length} strata in the Rust/WASM Worker...`;
        const adjusted = await calculateStratifiedTable2x2InWorker(adjustedInput, signal ? { signal } : {});
        assertClassicProgramNotCancelled(signal);
        adjustedResult = adjusted.result;
        renderClassicTablesAdjustedOutput(adjusted.result, adjusted.durationMs);
      }
      const snapshot = retainedSequentialOutput(requiredElement<HTMLElement>("#classic-tables-categorical-output"));
      snapshot.classList.add("classic-tables-expanded-result");
      tableRuns.push({ plan: tablesPlan, result: tablesResult, adjusted: adjustedResult, snapshot });
    }
    const firstRun = tableRuns[0]!;
    const finalRun = tableRuns.at(-1)!;
    const outTable = finalRun.plan.outputTable ? classicProgramSession.storeOutTable(classicTablesOutTable(project, finalRun.plan, finalRun.result)) : null;
    if (tableRuns.length > 1) {
      requiredElement("#classic-tables-categorical-title").textContent = `${command.exposure} by ${firstRun.plan.outcomePrompt}`;
      requiredElement("#classic-tables-categorical-count").textContent = `${tableRuns.length} expanded tables · ${project.records.length} source records`;
      requiredElement("#classic-tables-categorical-note").textContent = `Legacy TABLES exposure expansion ran ${tableRuns.length} GROUPVAR or wildcard members in declared field order. Each result below retains its resolved exposure field and statistics.`;
      requiredElement("#classic-tables-categorical-body").replaceChildren(...tableRuns.map(({ snapshot }) => snapshot));
      requiredElement<HTMLElement>("#classic-tables-categorical-output").hidden = false;
    }
    requiredElement("#classic-tables-categorical-output").scrollIntoView({ behavior: "smooth", block: "start" });
    const binaryTables = tableRuns.reduce((sum, { result }) => sum + result.strata.filter(({ twoByTwo }) => twoByTwo).length, 0);
    const adjustedRuns = tableRuns.filter(({ adjusted }) => adjusted).length;
    if (tableRuns.length > 1) {
      classicProgramFeedback.textContent = `TABLES expanded ${command.exposure} into ${tableRuns.length} exposure fields and produced ${tableRuns.length} auditable cross-tabulations against ${firstRun.plan.outcomePrompt}.${binaryTables ? ` ${binaryTables} binary stratum table${binaryTables === 1 ? "" : "s"} received Single Table Analysis.` : ""}${adjustedRuns ? ` ${adjustedRuns} expanded result${adjustedRuns === 1 ? "" : "s"} received adjusted stratified analysis.` : ""}${outTable ? ` As in desktop Epi Info, OUTTABLE was replaced for each expansion and retains the final exposure ${finalRun.plan.exposureField} as ${outTable.formName} (${outTable.records.length} rows).` : ""}`;
      classicProgramCommandStatus.textContent = "Selected TABLES command completed through legacy exposure GROUPVAR/wildcard expansion.";
    } else {
      classicProgramFeedback.textContent = `TABLES counted ${firstRun.result.includedRecords} records${firstRun.plan.weightField ? ` with weighted N ${firstRun.result.weightedTotal}` : ""} ${firstRun.plan.strataFields.length ? `across ${firstRun.result.strata.length} strata` : "in one unstratified table"}.${firstRun.result.includedMissing ? ` ${firstRun.result.includedMissing} records containing missing participating values were included.` : ""}${firstRun.result.excludedInvalidWeight ? ` ${firstRun.result.excludedInvalidWeight} invalid weights were excluded.` : ""}${binaryTables ? ` ${binaryTables} binary table${binaryTables === 1 ? "" : "s"} also received Single Table Analysis.` : firstRun.plan.statistics === "NONE" ? " Inferential statistics were suppressed by STATISTICS=NONE." : firstRun.plan.weightField ? " Exact and binary risk/odds statistics were not applied to weighted observations." : " No exposed/case classification was inferred."}${firstRun.adjusted ? " Mantel-Haenszel adjusted estimates and homogeneity tests were calculated across strata." : ""}${outTable ? ` OUTTABLE created in-session table ${outTable.formName} with ${outTable.records.length} rows.` : ""}`;
      classicProgramCommandStatus.textContent = firstRun.adjusted
        ? "Selected TABLES command completed with stratified 2 x 2 adjusted results from the Rust/WASM kernel."
        : firstRun.plan.weightField
          ? "Selected TABLES command completed as a weighted categorical cross-tabulation."
        : binaryTables
          ? "Selected TABLES command completed with legacy-style 2 x 2 statistics."
        : "Selected TABLES command completed as a categorical cross-tabulation.";
    }
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: tableRuns.length > 1 ? CLASSIC_TABLES_EXPANSION_PLAN_VERSION : firstRun.plan.version, astVersion: CLASSIC_AST_VERSION,
      projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
      source: selectedSource, canonicalSource: tableRuns.length > 1 ? selectedSource.trim() : firstRun.plan.canonicalSource,
      summary: tableRuns.length > 1
        ? `TABLES expanded ${command.exposure} into ${tableRuns.length} exposure fields and produced ${tableRuns.length} categorical outputs from ${project.records.length} source records.${outTable ? ` OUTTABLE retains the final exposure ${finalRun.plan.exposureField} with ${outTable.records.length} rows as ${outTable.formName}.` : ""}`
        : `TABLES produced ${firstRun.plan.strataFields.length ? `${firstRun.result.strata.length} categorical strata` : "one unstratified categorical table"} from ${firstRun.result.includedRecords} records${firstRun.plan.weightField ? ` with weighted N ${firstRun.result.weightedTotal}; ${firstRun.result.excludedInvalidWeight} invalid weights excluded` : ""}; ${firstRun.plan.includeMissing ? `${firstRun.result.includedMissing} records containing missing values included` : `${firstRun.result.excludedMissing} missing records excluded`}.${firstRun.adjusted ? ` Rust/WASM calculated adjusted results across ${firstRun.adjusted.diagnostics.informativeStrata} informative strata.` : ""}${outTable ? ` OUTTABLE stored ${outTable.records.length} long-form rows as ${outTable.formName}.` : ""}`,
      diagnostics: tableRuns.flatMap(({ adjusted }) => adjusted?.diagnostics.warnings ?? []),
    });
  } catch (error) {
    if (isClassicProgramCancellation(error)) {
      classicProgramFeedback.textContent = "Selected command cancelled. Any previously completed output and history were retained.";
      classicProgramCommandStatus.textContent = "Selected command cancelled by user.";
      recordProgramRun({
        origin: "user-program", status: "cancelled", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
        source: selectedSource, summary: "Selected command cancelled by user.", diagnostics: [],
      });
      if (rethrow) throw error;
      return;
    }
    const message = error instanceof Error ? error.message : "Unable to run the selected command.";
    classicProgramFeedback.textContent = `${message} Nothing was run.`;
    classicProgramCommandStatus.textContent = "Selected command rejected before execution.";
    recordProgramRun({
      origin: "user-program", status: "failed", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: project.projectName, formName: project.formName, sourceRecords: project.records.length,
      source: selectedSource, summary: "Selected command rejected before execution.", diagnostics: [message],
    });
    if (rethrow) throw error;
  }
}

const CLASSIC_SEQUENTIAL_PROGRAM_PLAN_VERSION = "classic-sequential-program-v0.1.0";

function sequentialOutputSource(statement: ReturnType<typeof parseClassicProgram>["body"][number]): HTMLElement | null {
  if (statement.type === "ListStatement") return requiredElement<HTMLElement>("#classic-list-output");
  if (statement.type === "FrequencyStatement") {
    if (statement.options.psuVariable) return requiredElement<HTMLElement>("#classic-tables-categorical-output");
    const stratified = requiredElement<HTMLElement>("#frequency-stratified-output");
    return stratified.hidden ? requiredElement<HTMLElement>("#frequency-output") : stratified;
  }
  if (statement.type === "MeansStatement") return statement.options.psuVariable ? requiredElement<HTMLElement>("#classic-tables-categorical-output") : requiredElement<HTMLElement>("#means-output");
  if (statement.type === "TablesStatement") return requiredElement<HTMLElement>("#classic-tables-categorical-output");
  if (statement.type === "SummarizeStatement") return requiredElement<HTMLElement>("#classic-summarize-output");
  if (statement.type === "GraphStatement") return requiredElement<HTMLElement>("#classic-graph-output");
  if (statement.type === "DisplayStatement") return requiredElement<HTMLElement>("#classic-display-output");
  if (statement.type === "EpiAiQualityStatement") return requiredElement<HTMLElement>("#classic-quality-output");
  if (statement.type === "FileConvertStatement") return requiredElement<HTMLElement>("#classic-file-convert-output");
  return null;
}

function retainedSequentialOutput(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.hidden = false;
  clone.removeAttribute("id");
  clone.removeAttribute("aria-labelledby");
  clone.removeAttribute("data-module-view");
  for (const element of clone.querySelectorAll<HTMLElement>("[id]")) element.removeAttribute("id");
  for (const control of clone.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("input, button, select, textarea")) control.disabled = true;
  return clone;
}

function appendSequentialCommandOutput(
  index: number,
  total: number,
  statement: ReturnType<typeof parseClassicProgram>["body"][number],
  statementSource: string,
  history: ProgramRunHistoryEntry | undefined,
): void {
  const article = document.createElement("article"); article.className = "classic-sequential-command";
  const header = document.createElement("header");
  const title = document.createElement("h3"); title.textContent = `Command ${index} of ${total} · ${history?.status ?? "completed"}`;
  const code = document.createElement("code"); code.textContent = statementSource;
  header.append(title, code);
  const summary = document.createElement("p"); summary.className = "classic-sequential-command-summary";
  summary.textContent = history?.summary ?? "Command completed; no separate Output document was produced.";
  article.append(header, summary);
  const output = sequentialOutputSource(statement);
  if (output && !output.hidden) {
    const result = document.createElement("div"); result.className = "classic-sequential-command-result";
    result.append(retainedSequentialOutput(output)); article.append(result);
  }
  requiredElement("#classic-sequential-output-body").append(article);
  requiredElement("#classic-sequential-output-count").textContent = `${index} of ${total} commands retained`;
  requiredElement<HTMLElement>("#classic-sequential-output").hidden = false;
}

async function runSequentialClassicProgram(source: string, ast: ReturnType<typeof parseClassicProgram>, signal?: AbortSignal): Promise<void> {
  const normalizedSource = source.replace(/\r\n?/g, "\n");
  const initial = getCurrentProjectData();
  let completed = 0;
  requiredElement("#classic-sequential-output-body").replaceChildren();
  requiredElement("#classic-sequential-output-count").textContent = `0 of ${ast.body.length} commands retained`;
  requiredElement<HTMLElement>("#classic-sequential-output").hidden = false;
  classicProgramCommandStatus.textContent = `Running ${ast.body.length} commands in source orderâ€¦`;
  try {
    for (const [index, statement] of ast.body.entries()) {
      classicProgramCommandStatus.textContent = `Running command ${index + 1} of ${ast.body.length}...`;
      await yieldClassicProgramTurn(signal);
      const statementSource = normalizedSource.slice(statement.span.start.offset, statement.span.end.offset).trim();
      await runSelectedClassicCommand(statementSource, true, signal);
      completed++;
      appendSequentialCommandOutput(completed, ast.body.length, statement, statementSource, readProgramRunHistory()[0]);
    }
    const active = classicProgramSession.current(initial);
    classicProgramFeedback.textContent = `Executed all ${completed} commands in source order for ${initial.records.length} source records. Review the generated Output documents and history.`;
    classicProgramCommandStatus.textContent = `Program completed: ${completed} of ${ast.body.length} commands succeeded.`;
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: CLASSIC_SEQUENTIAL_PROGRAM_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: active.projectName, formName: active.formName, sourceRecords: initial.records.length,
      source, summary: `Sequential program completed all ${completed} commands.`, diagnostics: [],
    });
  } catch (error) {
    if (isClassicProgramCancellation(error)) {
      classicProgramFeedback.textContent = `Program cancelled after ${completed} of ${ast.body.length} commands. Completed output, session effects, and history were retained; later commands were not run.`;
      classicProgramCommandStatus.textContent = `Program cancelled by user after ${completed} of ${ast.body.length} commands.`;
      recordProgramRun({
        origin: "user-program", status: "cancelled", planVersion: CLASSIC_SEQUENTIAL_PROGRAM_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
        projectName: initial.projectName, formName: initial.formName, sourceRecords: initial.records.length,
        source, summary: `Sequential program cancelled after ${completed} commands.`, diagnostics: [],
      });
      return;
    }
    const message = error instanceof Error ? error.message : "The command failed.";
    classicProgramFeedback.textContent = `Program stopped after ${completed} of ${ast.body.length} commands: ${message}`;
    classicProgramCommandStatus.textContent = `Program stopped at command ${completed + 1}; later commands were not run.`;
    recordProgramRun({
      origin: "user-program", status: "failed", planVersion: CLASSIC_SEQUENTIAL_PROGRAM_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: initial.projectName, formName: initial.formName, sourceRecords: initial.records.length,
      source, summary: `Sequential program stopped after ${completed} commands.`, diagnostics: [message],
    });
  }
}

requiredElement("#classic-program-run-selection").addEventListener("click", () => {
  void startClassicProgramTask((signal) => runSelectedClassicCommand(undefined, false, signal));
});
requiredElement("#classic-merge-preview-apply").addEventListener("click", () => {
  const pending = pendingClassicMerge;
  if (!pending) return;
  try {
    applyClassicMergeRecords(pending.result.destination);
    const refreshed = getProjectDataSources().find((candidate) => candidate.formId === pending.result.destination.formId)!;
    classicProgramSession.merge(refreshed);
    renderClassicProgramSession();
    classicProgramFeedback.textContent = `MERGE applied: ${pending.result.updatedRecords} source rows updated destination records and ${pending.result.insertedRecords} records were inserted. ${pending.result.outputRecords} destination records are now active.`;
    classicProgramCommandStatus.textContent = "Confirmed MERGE completed and was saved in this browser project.";
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: refreshed.projectName, formName: refreshed.formName, sourceRecords: pending.result.sourceRecords,
      source: pending.plan.source, canonicalSource: pending.plan.canonicalSource,
      summary: `MERGE updated ${pending.result.updatedRecords} source rows, inserted ${pending.result.insertedRecords} records, and left ${pending.result.outputRecords} destination records.`, diagnostics: [],
    });
    pendingClassicMerge = null;
    classicMergePreviewDialog.close("applied");
  } catch (error) {
    requiredElement("#classic-merge-preview-feedback").textContent = error instanceof Error ? error.message : "MERGE could not be applied. No project records were changed.";
  }
});
classicMergePreviewDialog.addEventListener("close", () => {
  if (classicMergePreviewDialog.returnValue !== "applied") {
    pendingClassicMerge = null;
    classicProgramCommandStatus.textContent = "MERGE preview closed without changing project records.";
  }
});

requiredElement<HTMLInputElement>("#classic-delete-preview-confirm").addEventListener("change", (event) => {
  requiredElement<HTMLButtonElement>("#classic-delete-preview-apply").disabled = !(event.currentTarget as HTMLInputElement).checked;
});
requiredElement("#classic-delete-preview-apply").addEventListener("click", () => {
  const pending = pendingClassicDelete;
  if (!pending) return;
  try {
    const currentTarget = getProjectDataSources().find((candidate) => candidate.formId === pending.plan.formId);
    if (!currentTarget) throw new RangeError("The DELETE TABLES target is no longer in the current project.");
    const reviewedTarget = stageClassicDeleteTable(currentTarget, pending.plan);
    applyClassicDeleteTableRecords(reviewedTarget);
    classicProgramSession.reset(getCurrentProjectData());
    renderClassicProgramSession();
    classicProgramFeedback.textContent = `DELETE TABLES applied: ${pending.plan.recordCount} records were removed from ${pending.plan.formName}; the form design was preserved.`;
    classicProgramCommandStatus.textContent = "Confirmed DELETE TABLES completed and was saved in this browser project.";
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: pending.staged.projectName, formName: pending.plan.formName, sourceRecords: pending.plan.recordCount,
      source: pending.plan.canonicalSource, canonicalSource: pending.plan.canonicalSource,
      summary: `DELETE TABLES removed ${pending.plan.recordCount} records and preserved the project form schema.`, diagnostics: [],
    });
    pendingClassicDelete = null;
    classicDeletePreviewDialog.close("applied");
  } catch (error) {
    requiredElement("#classic-delete-preview-feedback").textContent = error instanceof Error ? error.message : "DELETE TABLES could not be applied. No project records were changed.";
  }
});
classicDeletePreviewDialog.addEventListener("close", () => {
  if (classicDeletePreviewDialog.returnValue !== "applied") {
    pendingClassicDelete = null;
    classicProgramCommandStatus.textContent = "DELETE TABLES preview closed without changing project records.";
  }
});

requiredElement<HTMLInputElement>("#classic-delete-records-preview-confirm").addEventListener("change", (event) => {
  requiredElement<HTMLButtonElement>("#classic-delete-records-preview-apply").disabled = !(event.currentTarget as HTMLInputElement).checked;
});
requiredElement("#classic-delete-records-preview-apply").addEventListener("click", () => {
  const pending = pendingClassicDeleteRecords;
  if (!pending) return;
  try {
    applyClassicDeleteRecords(pending);
    const refreshed = getProjectDataSources().find((candidate) => candidate.formId === pending.formId)!;
    classicProgramSession.reset(refreshed);
    renderClassicProgramSession();
    classicProgramFeedback.textContent = `DELETE RECORDS applied: ${pending.matchedRecords} records moved to the Recycle Bin; ${pending.remainingRecords.length} remain active.`;
    classicProgramCommandStatus.textContent = "Confirmed recoverable DELETE RECORDS completed and was saved in this browser project.";
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: refreshed.projectName, formName: refreshed.formName, sourceRecords: pending.sourceSnapshot.length,
      source: pending.canonicalSource, canonicalSource: pending.canonicalSource,
      summary: `DELETE RECORDS moved ${pending.matchedRecords} records to the Recycle Bin and left ${pending.remainingRecords.length} active.`, diagnostics: [],
    });
    pendingClassicDeleteRecords = null;
    classicDeleteRecordsPreviewDialog.close("applied");
  } catch (error) {
    requiredElement("#classic-delete-records-preview-feedback").textContent = error instanceof Error ? error.message : "DELETE RECORDS could not be applied. No project records were changed.";
  }
});
classicDeleteRecordsPreviewDialog.addEventListener("close", () => {
  if (classicDeleteRecordsPreviewDialog.returnValue !== "applied") {
    pendingClassicDeleteRecords = null;
    classicProgramCommandStatus.textContent = "DELETE RECORDS preview closed without changing project records.";
  }
});

requiredElement<HTMLInputElement>("#classic-undelete-records-preview-confirm").addEventListener("change", (event) => {
  requiredElement<HTMLButtonElement>("#classic-undelete-records-preview-apply").disabled = !(event.currentTarget as HTMLInputElement).checked;
});
requiredElement("#classic-undelete-records-preview-apply").addEventListener("click", () => {
  const pending = pendingClassicUndeleteRecords;
  if (!pending) return;
  try {
    applyClassicUndeleteRecords(pending);
    const refreshed = getProjectDataSources().find((candidate) => candidate.formId === pending.formId)!;
    classicProgramSession.reset(refreshed);
    renderClassicProgramSession();
    classicProgramFeedback.textContent = `UNDELETE RECORDS applied: ${pending.restored.length} records restored; ${pending.remainingDeleted.length} remain in the Recycle Bin.`;
    classicProgramCommandStatus.textContent = "Confirmed UNDELETE RECORDS completed and was saved in this browser project.";
    recordProgramRun({
      origin: "user-program", status: "succeeded", planVersion: CLASSIC_SELECTED_COMMAND_PLAN_VERSION, astVersion: CLASSIC_AST_VERSION,
      projectName: refreshed.projectName, formName: refreshed.formName, sourceRecords: pending.sourceSnapshot.length,
      source: pending.canonicalSource, canonicalSource: pending.canonicalSource,
      summary: `UNDELETE RECORDS restored ${pending.restored.length} records and left ${pending.remainingDeleted.length} in the Recycle Bin.`, diagnostics: [],
    });
    pendingClassicUndeleteRecords = null;
    classicUndeleteRecordsPreviewDialog.close("applied");
  } catch (error) {
    requiredElement("#classic-undelete-records-preview-feedback").textContent = error instanceof Error ? error.message : "UNDELETE RECORDS could not be applied. No project records were changed.";
  }
});
classicUndeleteRecordsPreviewDialog.addEventListener("close", () => {
  if (classicUndeleteRecordsPreviewDialog.returnValue !== "applied") {
    pendingClassicUndeleteRecords = null;
    classicProgramCommandStatus.textContent = "UNDELETE RECORDS preview closed without changing project records.";
  }
});

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
classicProgramExampleSelect.addEventListener("change", renderClassicProgramExampleDescription);
classicProgramLoadExampleButton.addEventListener("click", () => loadSelectedClassicProgramExample());
requiredElement("#classic-program-verify").addEventListener("click", () => void startClassicProgramTask((signal) => runClassicProgram(true, signal)));
requiredElement("#classic-program-run").addEventListener("click", () => void startClassicProgramTask((signal) => runClassicProgram(false, signal)));
for (const button of document.querySelectorAll<HTMLElement>('[data-open-module="classic"], [data-module="classic"]')) {
  button.addEventListener("click", () => void refreshClassicProgramExamples());
  button.addEventListener("click", refreshClassicProgramContext);
  button.addEventListener("click", refreshClassicProjectPrograms);
  button.addEventListener("click", refreshClassicTablesSelectors);
  button.addEventListener("click", refreshFrequencySelector);
  button.addEventListener("click", refreshMeansSelector);
}
for (const button of document.querySelectorAll<HTMLElement>('[data-open-module="dashboard"], [data-module="dashboard"]')) {
  button.addEventListener("click", refreshDashboardCommandSurface);
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
  classicProgramSession.reset(getCurrentProjectData());
  renderClassicProgramSession();
  initializeEpiAssist(getCurrentProjectData);
  initializeMaps(
    getCurrentProjectData,
    getProjectDataSources,
    showRecordInEnter,
    getCurrentProjectSnapshot,
    replaceCurrentOfflineMapAsset,
    detachCurrentOfflineMapAsset,
    replaceCurrentProjectMapState,
  );
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
