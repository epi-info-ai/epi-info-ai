import { calculateTable2x2 } from "./engine.js";
import {
  getCurrentProjectData,
  getProjectDataSources,
  initializeFormDataDemo,
  showRecordInEnter,
} from "./form-data.js?v=14";
import { initializeMaps } from "./maps.js?v=3";

const form = document.querySelector("#table-form");
const message = document.querySelector("#form-message");
const warningBox = document.querySelector("#warnings");
const warningList = document.querySelector("#warning-list");
let lastResult = null;

const cells = {
  exposedCases: document.querySelector("#exposed-cases"),
  exposedNonCases: document.querySelector("#exposed-controls"),
  unexposedCases: document.querySelector("#unexposed-cases"),
  unexposedNonCases: document.querySelector("#unexposed-controls"),
};

const output = Object.fromEntries(
  [
    "risk-ratio",
    "risk-ratio-ci",
    "odds-ratio",
    "odds-ratio-ci",
    "risk-difference",
    "risk-difference-ci",
    "fisher-exact",
    "pearson-value",
    "pearson-p",
    "mantel-value",
    "mantel-p",
    "yates-value",
    "yates-p",
    "plain-interpretation",
    "calculation-time",
  ].map((id) => [id, document.querySelector(`#${id}`)]),
);

function parseInput() {
  return {
    exposedCases: Number(cells.exposedCases.value),
    exposedNonCases: Number(cells.exposedNonCases.value),
    unexposedCases: Number(cells.unexposedCases.value),
    unexposedNonCases: Number(cells.unexposedNonCases.value),
    confidenceLevel: Number(document.querySelector("#confidence-level").value),
  };
}

function number(value, digits = 2) {
  if (value === null || !Number.isFinite(value)) return "Undefined";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function pValue(value) {
  if (value === null || !Number.isFinite(value)) return "Undefined";
  if (value < 0.0001) return "< 0.0001";
  return value.toFixed(4);
}

function confidenceLabel(level, interval, percent = false) {
  if (!interval) return `${Math.round(level * 100)}% CI unavailable`;
  const multiplier = percent ? 100 : 1;
  const suffix = percent ? "%" : "";
  return `${Math.round(level * 100)}% CI ${number(interval.lower * multiplier, percent ? 1 : 2)}${suffix}–${number(interval.upper * multiplier, percent ? 1 : 2)}${suffix}`;
}

function renderTotals(input) {
  document.querySelector("#exposed-total").textContent = input.exposedCases + input.exposedNonCases;
  document.querySelector("#unexposed-total").textContent = input.unexposedCases + input.unexposedNonCases;
  document.querySelector("#case-total").textContent = input.exposedCases + input.unexposedCases;
  document.querySelector("#noncase-total").textContent = input.exposedNonCases + input.unexposedNonCases;
  document.querySelector("#grand-total").textContent =
    input.exposedCases + input.exposedNonCases + input.unexposedCases + input.unexposedNonCases;
}

function render(result) {
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

function calculate() {
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

document.querySelector("#example-button").addEventListener("click", () => {
  const example = { exposedCases: 40, exposedNonCases: 60, unexposedCases: 10, unexposedNonCases: 90 };
  for (const [name, value] of Object.entries(example)) cells[name].value = value;
  calculate();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  const reset = { exposedCases: 0, exposedNonCases: 0, unexposedCases: 0, unexposedNonCases: 0 };
  for (const [name, value] of Object.entries(reset)) cells[name].value = value;
  renderTotals(reset);
  cells.exposedCases.focus();
});

document.querySelector("#copy-json").addEventListener("click", async (event) => {
  if (!lastResult) return;
  await navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2));
  const button = event.currentTarget;
  const original = button.textContent;
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = original; }, 1200);
});

calculate();
try {
  initializeFormDataDemo();
  initializeMaps(getCurrentProjectData, getProjectDataSources, showRecordInEnter);
} catch (error) {
  console.error(error);
  const status = document.querySelector("#main-menu-status");
  status.textContent = `A demo module could not start: ${error instanceof Error ? error.message : String(error)}`;
}
