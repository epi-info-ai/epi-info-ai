import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testsDirectory, "../..");
const demoDirectory = join(repositoryRoot, "wasm/demo");
const examplesDirectory = join(demoDirectory, "examples");
const fixturesDirectory = join(testsDirectory, "fixtures/phase0");

function repositoryPath(relativePath) {
  return join(repositoryRoot, ...relativePath.split("/"));
}

async function jsonFixture(name) {
  return JSON.parse(await readFile(join(fixturesDirectory, name), "utf8"));
}

function near(actual, expected, tolerance, label) {
  assert.equal(typeof actual, "number", `${label} must be numeric`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected}, received ${actual}`);
}

async function assertFile(relativePath) {
  const file = repositoryPath(relativePath);
  const metadata = await stat(file);
  assert.ok(metadata.isFile(), `${relativePath} must be a file`);
  assert.ok(metadata.size > 0, `${relativePath} must not be empty`);
}

async function checkRequiredAssetsAndUi() {
  const requiredFiles = [
    "wasm/demo/index.html",
    "wasm/ai-lessons-learned.md",
    "wasm/demo/styles.css",
    "wasm/demo/app.ts",
    "wasm/demo/engine.ts",
    "wasm/demo/form-data.ts",
    "wasm/demo/epi-assist.ts",
    "wasm/demo/epi-assist-worker.ts",
    "wasm/demo/maps.ts",
    "wasm/demo/shell.ts",
    "wasm/demo/stratified-worker.ts",
    "wasm/demo/stratified-worker-client.ts",
    "wasm/demo/supabase-sync.ts",
    "wasm/app/contracts/core.ts",
    "wasm/app/contracts/assistant.ts",
    "wasm/app/assistant/proposals.ts",
    "wasm/app/programming/classic-editor.ts",
    "wasm/app/programming/classic-program.ts",
    "wasm/app/programming/run-history.ts",
    "wasm/app/contracts/project-package.ts",
    "wasm/app/forms/geocoding.ts",
    "wasm/demo/epi2x2.wasm",
    "wasm/demo/sample-case-data.csv",
    "wasm/demo/sample-map-layer.geojson",
    "wasm/demo/examples/README.md",
    "wasm/demo/examples/foodborne-outbreak-investigation.csv",
    "wasm/demo/examples/city-of-toledo-neighborhoods.geojson",
    "wasm/demo/examples/sample-project.epia.json",
    "wasm/demo/vendor/leaflet/leaflet.css",
    "wasm/demo/vendor/leaflet/leaflet.js",
    "wasm/demo/vendor/leaflet/LICENSE",
    "wasm/demo/vendor/h3-js/h3-js.es.js",
    "wasm/demo/vendor/h3-js/h3-js.es.js.map",
    "wasm/demo/vendor/h3-js/LICENSE",
    "wasm/demo/vendor/h3-js/NOTICE",
    "wasm/demo/vendor/h3-js/package.json",
    "wasm/demo/vendor/codemirror/LICENSE",
    "wasm/demo/setup/supabase-schema.sql",
    "wasm/docs/research/rust-epidemiology-landscape.md",
    "wasm/docs/validation/algorithm-validation-standard.md",
    "wasm/docs/validation/table2x2-exact-method-contract.md",
    "wasm/docs/validation/stratified-table2x2-method-contract.md",
    "wasm/docs/validation/frequency-method-contract.md",
    "wasm/docs/validation/stratified-frequency-method-contract.md",
    "wasm/docs/validation/classic-program-v0.1-contract.md",
    "wasm/docs/validation/means-method-contract.md",
    "wasm/docs/validation/rate-method-contract.md",
    "wasm/docs/validation/population-survey-method-contract.md",
    "wasm/docs/validation/cohort-cross-sectional-method-contract.md",
    "wasm/docs/validation/unmatched-case-control-method-contract.md",
    "wasm/docs/validation/chi-square-trend-method-contract.md",
    "wasm/docs/design/frequency-compatibility-inventory.md",
    "wasm/docs/design/programming-curriculum-corpus.md",
    "wasm/docs/design/means-compatibility-inventory.md",
    "wasm/docs/design/rates-compatibility-inventory.md",
    "wasm/docs/design/statcalc-compatibility-inventory.md",
    "wasm/validation-lab/content/validate-table2x2.ipynb",
    "wasm/validation-lab/content/validate-stratified2x2.ipynb",
    "wasm/validation-lab/content/validate-frequency.ipynb",
    "wasm/validation-lab/content/validate-means.ipynb",
    "wasm/validation-lab/content/validate-rate.ipynb",
    "wasm/validation-lab/content/validate-population-survey.ipynb",
    "wasm/validation-lab/content/validate-cohort-cross-sectional.ipynb",
    "wasm/validation-lab/content/validate-unmatched-case-control.ipynb",
    "wasm/validation-lab/content/validate-chi-square-trend.ipynb",
    "wasm/validation-lab/jupyter-lite.json",
    "wasm/validation-lab/requirements.txt",
    "wasm/validation-lab/verify.py",
    "wasm/tests/fixtures/algorithm-validation/registry.json",
    "wasm/tests/fixtures/programming-curriculum/registry.json",
    "wasm/demo/tests/fixtures/two-by-two.json",
    "wasm/tests/fixtures/algorithm-validation/legacy-two-by-two-exact-limits.csv",
    "wasm/tests/fixtures/algorithm-validation/legacy-two-by-two-exact-limits.manifest.json",
    "wasm/tests/fixtures/algorithm-validation/stratified-two-by-two-v0.5.json",
    "wasm/tests/fixtures/algorithm-validation/stratified-homogeneity-v0.7.json",
    "wasm/tests/fixtures/algorithm-validation/stratified-exact-v0.8.json",
    "wasm/tests/fixtures/algorithm-validation/stratified-operational-v0.8.json",
    "wasm/tests/fixtures/algorithm-validation/foodborne-frequency-v0.9.json",
    "wasm/tests/fixtures/algorithm-validation/foodborne-means-v0.10.json",
    "wasm/tests/fixtures/algorithm-validation/foodborne-rate-v0.11.json",
    "wasm/tests/fixtures/algorithm-validation/population-survey-v0.12.json",
    "wasm/tests/fixtures/algorithm-validation/cohort-cross-sectional-v0.13.json",
    "wasm/tests/fixtures/algorithm-validation/unmatched-case-control-v0.14.json",
    "wasm/tests/fixtures/algorithm-validation/chi-square-trend-v0.15.json",
  ];
  await Promise.all(requiredFiles.map(assertFile));

  const html = await readFile(join(demoDirectory, "index.html"), "utf8");
  const requiredIds = [
    "main-menu",
    "main-menu-button",
    "file-menu",
    "file-exit",
    "file-open-project",
    "file-save-project",
    "project-package-open",
    "view-menu",
    "view-status-bar",
    "tools-menu",
    "help-menu",
    "designer-file-menu",
    "designer-new-project",
    "designer-project-storage",
    "new-project",
    "project-storage",
    "form-csv-import",
    "save-form",
    "snap-to-grid",
    "record-form",
    "add-geolocation-template",
    "geocode-results-dialog",
    "geocode-results-list",
    "field-rules-dialog",
    "field-rule-age-source",
    "field-check-action",
    "data-quality-dialog",
    "data-quality-duplicate-group",
    "data-quality-deleted-record",
    "data-quality-audit-log",
    "epi-assist-dialog",
    "epi-assist-load",
    "epi-assist-guided",
    "epi-assist-ask",
    "epi-assist-actions",
    "epi-assist-run-details",
    "epi-assist-run-model",
    "epi-assist-run-user-prompt",
    "epi-assist-run-system-prompt",
    "csv-import",
    "csv-export",
    "enter-open-maps",
    "epi-map",
    "map-add-case-cluster",
    "map-add-geojson",
    "map-add-h3",
    "map-add-raster",
    "map-fullscreen-toggle",
    "map-create-timelapse",
    "time-lapse-dialog",
    "time-lapse-field",
    "map-time-lapse-controls",
    "geojson-dialog",
    "geojson-file",
    "geojson-label-field",
    "map-geojson-layers",
    "map-h3-layers",
    "map-raster-layers",
    "h3-dialog",
    "h3-resolution",
    "raster-dialog",
    "raster-file",
    "raster-opacity",
    "table-form",
    "stratified-form",
    "classic-tables-form",
    "classic-exposure-field",
    "classic-exposed-values",
    "classic-outcome-field",
    "classic-case-values",
    "classic-strata-field",
    "classic-run-tables",
    "frequency-form",
    "frequency-field",
    "frequency-strata-field",
    "frequency-include-missing",
    "frequency-run",
    "frequency-rows",
    "frequency-confidence-rows",
    "frequency-stratified-output",
    "frequency-stratified-rows",
    "means-form",
    "means-field",
    "means-run",
    "means-output",
    "means-observations",
    "means-mean",
    "means-median",
    "rates-form",
    "rates-numerator-field",
    "rates-numerator-value",
    "rates-denominator-field",
    "rates-multiplier",
    "rates-run",
    "rates-output",
    "rates-value",
    "population-survey-form",
    "population-size",
    "population-expected-frequency",
    "population-margin-error",
    "population-design-effect",
    "population-clusters",
    "population-survey-calculate",
    "population-survey-rows",
    "cohort-form",
    "cohort-confidence",
    "cohort-power",
    "cohort-ratio",
    "cohort-unexposed-outcome",
    "cohort-risk-ratio",
    "cohort-odds-ratio",
    "cohort-exposed-outcome",
    "cohort-calculate",
    "cohort-rows",
    "unmatched-form",
    "unmatched-confidence",
    "unmatched-power",
    "unmatched-ratio",
    "unmatched-control-exposure",
    "unmatched-odds-ratio",
    "unmatched-case-exposure",
    "unmatched-calculate",
    "unmatched-rows",
    "trend-form",
    "trend-rows",
    "trend-add-row",
    "trend-chi-square",
    "trend-p-value",
    "strata-rows",
    "add-stratum",
    "calculate-stratified",
    "cancel-stratified",
    "stratified-worker-status",
    "project-storage-dialog",
    "project-storage-status",
  ];
  for (const id of requiredIds) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `index.html must retain #${id}`);
  }

  for (const label of ["Create Forms", "Enter Data", "Classic", "Visual Dashboard", "Create Maps", "StatCalc"]) {
    assert.ok(html.includes(label), `main application must retain the familiar ${label} label`);
  }

  const shell = await readFile(join(demoDirectory, "shell.ts"), "utf8");
  assert.match(shell, /designer-new-project[\s\S]*#new-project/);
  assert.match(shell, /designer-project-storage[\s\S]*#project-storage/);
  assert.match(shell, /view-status-bar[\s\S]*main-menu-status/);

  const readme = await readFile(repositoryPath("README.md"), "utf8");
  assert.match(readme, /https:\/\/epi-info-ai-2859c9\.gitpages\.cdc\.gov\//);
  assert.match(readme, /validation-lab\/lab\/index\.html\?path=validate-chi-square-trend\.ipynb/);

  const localAssetReferences = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => match[1])
    .filter((reference) => !reference.startsWith("#") && !/^(?:https?:|data:|mailto:)/.test(reference));
  for (const reference of localAssetReferences) {
    const withoutQuery = reference.split(/[?#]/, 1)[0];
    const maintainedSource = ({ "app.js": "app.ts", "shell.js": "shell.ts" })[withoutQuery] ?? withoutQuery;
    await assertFile(`wasm/demo/${maintainedSource}`);
  }
}

async function checkSourceLanguageBoundary() {
  const rootSources = await readdir(demoDirectory);
  assert.deepEqual(
    rootSources.filter((name) => name.endsWith(".js")),
    [],
    "handwritten application JavaScript must not return to the demo root",
  );
  for (const moduleName of ["app", "engine", "form-data", "maps", "shell", "stratified-worker", "stratified-worker-client", "supabase-sync"]) {
    assert.ok(rootSources.includes(`${moduleName}.ts`), `${moduleName} must remain a TypeScript source module`);
  }
}

async function checkWasmArtifact() {
  const manifest = await jsonFixture("wasm-manifest.json");
  const bytes = await readFile(repositoryPath(manifest.file));
  assert.equal(bytes.length, manifest.size, "WASM artifact size changed; review and update its manifest deliberately");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.sha256, "WASM checksum changed; review numerical provenance before accepting it");
  assert.deepEqual([...bytes.subarray(0, 8)], [0, 97, 115, 109, 1, 0, 0, 0], "WASM header/version is invalid");
  const module = await WebAssembly.compile(bytes);
  const exportNames = new Set(WebAssembly.Module.exports(module).map((item) => item.name));
  for (const requiredExport of manifest.requiredExports) {
    assert.ok(exportNames.has(requiredExport), `WASM export ${requiredExport} is missing`);
  }
}

async function importEngineWithFileFetch() {
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const target = input instanceof Request ? new URL(input.url) : input instanceof URL ? input : new URL(String(input));
    if (target.protocol === "file:") {
      const body = await readFile(fileURLToPath(target));
      return new Response(body, { status: 200, headers: { "content-type": "application/wasm" } });
    }
    return nativeFetch(input, init);
  };
  try {
    return await import(`${pathToFileURL(join(demoDirectory, "engine.ts")).href}?phase0=${Date.now()}`);
  } finally {
    globalThis.fetch = nativeFetch;
  }
}

async function checkTable2x2Contract() {
  const fixture = await jsonFixture("table2x2-baseline.json");
  const { calculateTable2x2 } = await importEngineWithFileFetch();
  const result = calculateTable2x2(fixture.input);
  const tolerance = fixture.absoluteTolerance;

  assert.equal(result.schemaVersion, fixture.contract.schemaVersion);
  assert.equal(result.operation, fixture.contract.operation);
  assert.equal(result.engine.id, fixture.contract.engineId);
  assert.equal(result.engine.version, fixture.contract.engineVersion);
  assert.deepEqual(result.input, fixture.input);
  assert.deepEqual(result.methods, fixture.methods);
  assert.deepEqual(result.totals, fixture.expected.totals);
  near(result.estimates.riskExposed, fixture.expected.riskExposed, tolerance, "risk among exposed");
  near(result.estimates.riskUnexposed, fixture.expected.riskUnexposed, tolerance, "risk among unexposed");
  near(result.estimates.riskRatio.estimate, fixture.expected.riskRatio, tolerance, "risk ratio");
  near(result.estimates.riskRatio.confidenceInterval.lower, fixture.expected.riskRatioConfidenceInterval.lower, tolerance, "risk ratio CI lower");
  near(result.estimates.riskRatio.confidenceInterval.upper, fixture.expected.riskRatioConfidenceInterval.upper, tolerance, "risk ratio CI upper");
  near(result.estimates.oddsRatio.estimate, fixture.expected.oddsRatio, tolerance, "odds ratio");
  near(result.estimates.oddsRatio.confidenceInterval.lower, fixture.expected.oddsRatioConfidenceInterval.lower, tolerance, "odds ratio CI lower");
  near(result.estimates.oddsRatio.confidenceInterval.upper, fixture.expected.oddsRatioConfidenceInterval.upper, tolerance, "odds ratio CI upper");
  near(result.estimates.riskDifference.estimate, fixture.expected.riskDifference, tolerance, "risk difference");
  near(result.estimates.riskDifference.confidenceInterval.lower, fixture.expected.riskDifferenceConfidenceInterval.lower, tolerance, "risk difference CI lower");
  near(result.estimates.riskDifference.confidenceInterval.upper, fixture.expected.riskDifferenceConfidenceInterval.upper, tolerance, "risk difference CI upper");
  near(result.tests.pearson.value, fixture.expected.pearsonChiSquare, tolerance, "Pearson chi-square");
  near(result.tests.pearson.pValue, fixture.expected.pearsonPValue, tolerance, "Pearson p-value");
  near(result.tests.mantelHaenszel.value, fixture.expected.mantelHaenszelChiSquare, tolerance, "Mantel-Haenszel chi-square");
  near(result.tests.mantelHaenszel.pValue, fixture.expected.mantelHaenszelPValue, tolerance, "Mantel-Haenszel p-value");
  near(result.tests.yates.value, fixture.expected.yatesChiSquare, tolerance, "Yates chi-square");
  near(result.tests.yates.pValue, fixture.expected.yatesPValue, tolerance, "Yates p-value");
  for (const tail of ["left", "right", "oneTailed", "twoTailed"]) {
    near(result.tests.fisherExact[tail], fixture.expected.fisherExact[tail], tolerance, `Fisher exact ${tail}`);
  }
  for (const tail of ["left", "right", "oneTailed"]) {
    near(result.tests.midPExact[tail], fixture.expected.midPExact[tail], tolerance, `mid-p exact ${tail}`);
  }
  const conditional = result.estimates.conditionalOddsRatio;
  const conditionalTolerance = 1e-10;
  assert.equal(conditional.estimate.state, "finite");
  near(conditional.estimate.value, fixture.expected.conditionalOddsRatio.estimate, conditionalTolerance, "conditional odds ratio");
  for (const method of ["fisherConfidenceInterval", "midPConfidenceInterval"]) {
    assert.equal(conditional[method].lower.state, "finite");
    assert.equal(conditional[method].upper.state, "finite");
    near(conditional[method].lower.value, fixture.expected.conditionalOddsRatio[method].lower, conditionalTolerance,
      `conditional odds ratio ${method} lower`);
    near(conditional[method].upper.value, fixture.expected.conditionalOddsRatio[method].upper, conditionalTolerance,
      `conditional odds ratio ${method} upper`);
  }
  assert.deepEqual(result.diagnostics.expectedCellCounts, fixture.expected.expectedCellCounts);
  assert.deepEqual(result.diagnostics.warnings, []);

  assert.throws(() => calculateTable2x2({ ...fixture.input, exposedCases: -1 }), /non-negative safe whole numbers/);
  assert.throws(() => calculateTable2x2({ ...fixture.input, exposedCases: Number.MAX_SAFE_INTEGER + 1 }), /safe whole numbers/);
  assert.throws(() => calculateTable2x2({ ...fixture.input, confidenceLevel: 0.8 }), /Confidence level/);
  assert.throws(() => calculateTable2x2({ exposedCases: 0, exposedNonCases: 0, unexposedCases: 0, unexposedNonCases: 0, confidenceLevel: 0.95 }), /at least one observation/i);
  const sparse = calculateTable2x2({ exposedCases: 0, exposedNonCases: 10, unexposedCases: 2, unexposedNonCases: 8, confidenceLevel: 0.95 });
  assert.ok(sparse.diagnostics.warnings.some((warning) => warning.includes("zero")));
  assert.deepEqual(sparse.estimates.conditionalOddsRatio.estimate, { value: 0, state: "zero" });
  assert.deepEqual(sparse.estimates.conditionalOddsRatio.fisherConfidenceInterval.lower, { value: 0, state: "zero" });
  const infinite = calculateTable2x2({ exposedCases: 10, exposedNonCases: 0, unexposedCases: 8, unexposedNonCases: 2, confidenceLevel: 0.95 });
  assert.deepEqual(infinite.estimates.conditionalOddsRatio.estimate, { value: null, state: "positive-infinity" });
  assert.deepEqual(infinite.estimates.conditionalOddsRatio.fisherConfidenceInterval.upper, { value: null, state: "positive-infinity" });
  const uninformative = calculateTable2x2({ exposedCases: 1, exposedNonCases: 0, unexposedCases: 0, unexposedNonCases: 0, confidenceLevel: 0.95 });
  assert.deepEqual(uninformative.estimates.conditionalOddsRatio.estimate, { value: null, state: "unavailable" });
  assert.ok(uninformative.diagnostics.warnings.some((warning) => warning.includes("margins are uninformative")));
}

async function checkStratifiedTable2x2Contract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/stratified-two-by-two-v0.5.json",
  ), "utf8"));
  const { calculateStratifiedTable2x2, deriveStratifiedTable2x2 } = await importEngineWithFileFetch();
  const datasetBytes = await readFile(repositoryPath(fixture.provenance.dataset));
  assert.equal(createHash("sha256").update(datasetBytes).digest("hex"), fixture.provenance.datasetSha256);
  const { inferSchemaFromRows, parseCsv } = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/csv.ts")).href}?stratified=${Date.now()}`);
  const parsedRows = parseCsv(datasetBytes.toString("utf8").replace(/^\uFEFF/, ""));
  const [headers, ...rows] = parsedRows;
  const indexes = Object.fromEntries(["Potato Salad", "Case Status", "Sex"].map((name) => [name, headers.indexOf(name)]));
  assert.ok(Object.values(indexes).every((index) => index >= 0));
  const derived = new Map(fixture.input.strata.map((stratum) => [stratum.label, [0, 0, 0, 0]]));
  const caseValues = new Set(["Confirmed", "Probable", "Suspected"]);
  for (const row of rows) {
    const cells = derived.get(row[indexes.Sex]);
    assert.ok(cells, `unexpected foodborne stratum ${row[indexes.Sex]}`);
    const exposed = row[indexes["Potato Salad"]] === "Yes";
    const illness = caseValues.has(row[indexes["Case Status"]]);
    cells[(exposed ? 0 : 2) + (illness ? 0 : 1)] += 1;
  }
  assert.deepEqual([...derived.entries()], fixture.input.strata.map((stratum) => [stratum.label, [
    stratum.exposedCases, stratum.exposedNonCases, stratum.unexposedCases, stratum.unexposedNonCases,
  ]]));
  const imported = inferSchemaFromRows("foodborne.csv", parsedRows);
  const browserDerivation = deriveStratifiedTable2x2(imported.records, {
    exposureField: "potato_salad",
    exposedValues: ["Yes"],
    outcomeField: "case_status",
    caseValues: ["Confirmed", "Probable", "Suspected"],
    strataField: "sex",
    confidenceLevel: 0.95,
  });
  assert.equal(browserDerivation.command, "TABLES potato_salad case_status STRATAVAR=sex");
  assert.deepEqual(browserDerivation.audit, {
    sourceRecords: 96,
    includedRecords: 96,
    excludedMissing: 0,
    exposureReferenceValues: ["No"],
    outcomeReferenceValues: ["Not a case"],
  });
  assert.deepEqual(browserDerivation.input.strata.map(({ label, exposedCases, exposedNonCases, unexposedCases, unexposedNonCases }) => ({
    label, exposedCases, exposedNonCases, unexposedCases, unexposedNonCases,
  })), fixture.input.strata.map(({ label, exposedCases, exposedNonCases, unexposedCases, unexposedNonCases }) => ({
    label, exposedCases, exposedNonCases, unexposedCases, unexposedNonCases,
  })));
  const withMissing = deriveStratifiedTable2x2([...imported.records, { potato_salad: "", case_status: "Confirmed", sex: "Female" }], {
    exposureField: "potato_salad", exposedValues: ["Yes"], outcomeField: "case_status",
    caseValues: ["Confirmed", "Probable", "Suspected"], strataField: "sex", confidenceLevel: 0.95,
  });
  assert.equal(withMissing.audit.sourceRecords, 97);
  assert.equal(withMissing.audit.includedRecords, 96);
  assert.equal(withMissing.audit.excludedMissing, 1);
  assert.throws(() => deriveStratifiedTable2x2(imported.records, {
    exposureField: "sex", exposedValues: ["Female"], outcomeField: "sex", caseValues: ["Female"],
    strataField: "case_status", confidenceLevel: 0.95,
  }), /three different/);
  const result = calculateStratifiedTable2x2(fixture.input);
  const expected = fixture.expected;
  const tolerance = fixture.tolerance;
  assert.equal(result.schemaVersion, "0.8.0");
  assert.equal(result.operation, fixture.operation);
  assert.deepEqual(result.input, fixture.input);
  near(result.estimates.adjustedOddsRatio.estimate, expected.adjustedOddsRatio, tolerance, "adjusted MH odds ratio");
  near(result.estimates.adjustedOddsRatio.confidenceInterval.lower, expected.adjustedOddsRatioLower, tolerance, "adjusted MH OR lower");
  near(result.estimates.adjustedOddsRatio.confidenceInterval.upper, expected.adjustedOddsRatioUpper, tolerance, "adjusted MH OR upper");
  near(result.estimates.adjustedRiskRatio.estimate, expected.adjustedRiskRatio, tolerance, "adjusted MH risk ratio");
  near(result.estimates.adjustedRiskRatio.confidenceInterval.lower, expected.adjustedRiskRatioLower, tolerance, "adjusted MH RR lower");
  near(result.estimates.adjustedRiskRatio.confidenceInterval.upper, expected.adjustedRiskRatioUpper, tolerance, "adjusted MH RR upper");
  near(result.tests.mantelHaenszelUncorrected.value, expected.mantelHaenszelUncorrected, tolerance, "MH uncorrected");
  near(result.tests.mantelHaenszelCorrected.value, expected.mantelHaenszelCorrected, tolerance, "MH corrected");
  near(result.tests.breslowDayOddsRatio.value, 0, tolerance, "foodborne fixed-margin Breslow-Day");
  near(result.tests.breslowDayTaroneOddsRatio.value, 0, tolerance, "foodborne Breslow-Day-Tarone");
  near(result.tests.legacyBreslowDayOddsRatio.value, 0, tolerance, "foodborne legacy-labelled Breslow-Day");
  near(result.tests.legacyBreslowDayRiskRatio.value, 0, tolerance, "foodborne legacy-labelled Breslow-Day RR");
  near(result.tests.breslowDayOddsRatio.pValue, 1, tolerance, "foodborne fixed-margin Breslow-Day p-value");
  assert.deepEqual(result.diagnostics, { informativeStrata: 2, warnings: [] });
  assert.throws(() => calculateStratifiedTable2x2({ ...fixture.input, strata: [] }), /between 1 and 1,024 strata/);
  assert.throws(() => calculateStratifiedTable2x2({ ...fixture.input, strata: [fixture.input.strata[0], fixture.input.strata[0]] }), /unique ID/);
}

async function checkStratifiedHomogeneityContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/stratified-homogeneity-v0.7.json",
  ), "utf8"));
  const { calculateStratifiedTable2x2 } = await importEngineWithFileFetch();
  const result = calculateStratifiedTable2x2(fixture.input);
  const expected = fixture.expected;
  const tolerance = fixture.tolerance;
  for (const name of ["breslowDayOddsRatio", "breslowDayTaroneOddsRatio", "legacyBreslowDayOddsRatio", "legacyBreslowDayRiskRatio"]) {
    const test = result.tests[name];
    assert.ok(test, `${name} must be available for the positive-cell benchmark`);
    assert.equal(test.degreesOfFreedom, expected.degreesOfFreedom);
    near(test.value, expected[name], tolerance, name);
    near(test.pValue, expected[`${name}PValue`], tolerance, `${name} p-value`);
  }
  const sparse = calculateStratifiedTable2x2({
    ...fixture.input,
    strata: fixture.input.strata.map((stratum, index) => index === 0 ? { ...stratum, exposedCases: 0 } : stratum),
  });
  assert.equal(sparse.tests.legacyBreslowDayOddsRatio, null);
  assert.equal(sparse.tests.legacyBreslowDayRiskRatio, null);
  assert.ok(sparse.diagnostics.warnings.some((warning) => warning.includes("zero cell")));
}

async function checkStratifiedExactContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/stratified-exact-v0.8.json",
  ), "utf8"));
  const { calculateStratifiedTable2x2 } = await importEngineWithFileFetch();
  for (const candidate of fixture.cases) {
    const exact = calculateStratifiedTable2x2(candidate.input).estimates.adjustedConditionalOddsRatio;
    assert.equal(exact.estimate.state, "finite");
    assert.equal(exact.fisherConfidenceInterval.lower.state, "finite");
    assert.equal(exact.fisherConfidenceInterval.upper.state, "finite");
    near(exact.estimate.value, candidate.expected.estimate, fixture.tolerance, `${candidate.id} conditional MLE`);
    near(exact.fisherConfidenceInterval.lower.value, candidate.expected.lower, fixture.tolerance, `${candidate.id} exact lower`);
    near(exact.fisherConfidenceInterval.upper.value, candidate.expected.upper, fixture.tolerance, `${candidate.id} exact upper`);
  }
  const zero = calculateStratifiedTable2x2({ confidenceLevel: 0.95, strata: [
    { id: "one", label: "One", exposedCases: 0, exposedNonCases: 10, unexposedCases: 5, unexposedNonCases: 5 },
    { id: "two", label: "Two", exposedCases: 0, exposedNonCases: 8, unexposedCases: 4, unexposedNonCases: 6 },
  ] }).estimates.adjustedConditionalOddsRatio;
  assert.equal(zero.estimate.state, "zero");
  assert.equal(zero.fisherConfidenceInterval.lower.state, "zero");
  assert.equal(zero.fisherConfidenceInterval.upper.state, "finite");
  const infinite = calculateStratifiedTable2x2({ confidenceLevel: 0.95, strata: [
    { id: "one", label: "One", exposedCases: 5, exposedNonCases: 5, unexposedCases: 0, unexposedNonCases: 10 },
    { id: "two", label: "Two", exposedCases: 4, exposedNonCases: 6, unexposedCases: 0, unexposedNonCases: 8 },
  ] }).estimates.adjustedConditionalOddsRatio;
  assert.equal(infinite.estimate.state, "positive-infinity");
  assert.equal(infinite.fisherConfidenceInterval.lower.state, "finite");
  assert.equal(infinite.fisherConfidenceInterval.upper.state, "positive-infinity");
}

async function checkStratifiedOperationalContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/stratified-operational-v0.8.json",
  ), "utf8"));
  const exactFixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/stratified-exact-v0.8.json",
  ), "utf8"));
  const { calculateStratifiedTable2x2 } = await importEngineWithFileFetch();

  for (const candidate of fixture.literalCases) {
    const result = calculateStratifiedTable2x2(candidate.input);
    const exact = result.estimates.adjustedConditionalOddsRatio;
    assert.equal(exact.estimate.state, candidate.expected.estimateState, `${candidate.id} estimate state`);
    assert.equal(exact.fisherConfidenceInterval.lower.state, candidate.expected.lowerState, `${candidate.id} lower state`);
    assert.equal(exact.fisherConfidenceInterval.upper.state, candidate.expected.upperState, `${candidate.id} upper state`);
    assert.equal(result.diagnostics.informativeStrata, candidate.expected.informativeStrata);
    if (candidate.expected.warningIncludes) {
      assert.ok(result.diagnostics.warnings.some((warning) => warning.includes(candidate.expected.warningIncludes)),
        `${candidate.id} must report ${candidate.expected.warningIncludes}`);
    }
  }

  const metamorphicInput = exactFixture.cases[1].input;
  const original = calculateStratifiedTable2x2(metamorphicInput);
  const reversed = calculateStratifiedTable2x2({
    ...metamorphicInput,
    strata: [...metamorphicInput.strata].reverse().map((stratum, index) => ({
      ...stratum,
      id: `renamed-${index + 1}`,
      label: `Renamed ${index + 1}`,
    })),
  });
  const stableNumbers = (value) => JSON.parse(JSON.stringify(value, (_key, candidate) => (
    typeof candidate === "number" ? Number(candidate.toPrecision(12)) : candidate
  )));
  assert.deepEqual(stableNumbers(reversed.estimates), stableNumbers(original.estimates),
    "stratum order and labels must not alter estimates beyond floating-point tolerance");
  assert.deepEqual(stableNumbers(reversed.tests), stableNumbers(original.tests),
    "stratum order and labels must not alter tests beyond floating-point tolerance");
  assert.deepEqual(reversed.diagnostics, original.diagnostics, "stratum order and labels must not alter warnings");

  const generated = fixture.generatedCases[0];
  const [a, b, c, d] = generated.repeatedCells;
  const maximumInput = {
    confidenceLevel: 0.95,
    strata: Array.from({ length: generated.strata }, (_, index) => ({
      id: `maximum-${index + 1}`,
      label: `Maximum ${index + 1}`,
      exposedCases: a,
      exposedNonCases: b,
      unexposedCases: c,
      unexposedNonCases: d,
    })),
  };
  const started = performance.now();
  const maximum = calculateStratifiedTable2x2(maximumInput);
  const durationMs = performance.now() - started;
  near(maximum.estimates.adjustedOddsRatio.estimate, generated.expected.adjustedOddsRatio, 1e-12, "maximum-strata OR");
  near(maximum.estimates.adjustedRiskRatio.estimate, generated.expected.adjustedRiskRatio, 1e-12, "maximum-strata RR");
  assert.equal(maximum.estimates.adjustedConditionalOddsRatio.estimate.state, generated.expected.exactState);
  assert.ok(durationMs <= generated.budget.ciRunnerMilliseconds,
    `maximum-strata calculation took ${durationMs.toFixed(1)} ms; budget is ${generated.budget.ciRunnerMilliseconds} ms`);
  console.log(`INFO maximum-strata V0.8 calculation ${durationMs.toFixed(1)} ms`);
}

async function checkFrequencyContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/foodborne-frequency-v0.9.json",
  ), "utf8"));
  const datasetBytes = await readFile(repositoryPath(fixture.dataset.file));
  assert.equal(createHash("sha256").update(datasetBytes).digest("hex"), fixture.dataset.sha256);
  const { inferSchemaFromRows, parseCsv } = await import(
    `${pathToFileURL(repositoryPath("wasm/app/forms/csv.ts")).href}?frequency=${Date.now()}`
  );
  const parsedRows = parseCsv(datasetBytes.toString("utf8").replace(/^\uFEFF/, ""));
  const imported = inferSchemaFromRows("foodborne.csv", parsedRows);
  const { deriveFrequency, deriveStratifiedFrequency } = await importEngineWithFileFetch();
  const result = deriveFrequency(imported.records, {
    field: fixture.request.field,
    prompt: fixture.request.prompt,
    includeMissing: fixture.request.includeMissing,
  });
  assert.equal(result.schemaVersion, "0.9.0");
  assert.equal(result.operation, fixture.operation);
  assert.equal(result.engine.id, "epi-core-wasm");
  assert.equal(result.command, fixture.expected.command);
  assert.equal(result.totals.includedRecords, fixture.expected.includedRecords);
  assert.equal(result.totals.excludedMissing, fixture.expected.excludedMissing);
  assert.deepEqual(result.categories.map(({ value, frequency }) => ({ value, frequency })),
    fixture.expected.categories.map(({ value, frequency }) => ({ value, frequency })));
  for (const [index, expected] of fixture.expected.categories.entries()) {
    const actual = result.categories[index];
    near(actual.percent, expected.percent, 1e-12, `${expected.value} percent`);
    near(actual.cumulativePercent, expected.cumulativePercent, 1e-12, `${expected.value} cumulative percent`);
    near(actual.confidenceInterval.lower, expected.lower, 1e-12, `${expected.value} exact lower`);
    near(actual.confidenceInterval.upper, expected.upper, 1e-12, `${expected.value} exact upper`);
  }

  const missingRecords = [{ value: "A" }, { value: "" }, { value: null }, { value: "B" }];
  const excluded = deriveFrequency(missingRecords, { field: "value", prompt: "Value", includeMissing: false });
  assert.deepEqual(excluded.categories.map(({ value, frequency }) => [value, frequency]), [["A", 1], ["B", 1]]);
  assert.equal(excluded.totals.excludedMissing, 2);
  const included = deriveFrequency(missingRecords, { field: "value", prompt: "Value", includeMissing: true });
  assert.deepEqual(included.categories.map(({ value, frequency }) => [value, frequency]), [["A", 1], ["B", 1], ["Missing", 2]]);
  assert.equal(included.categories.at(-1).missing, true);
  const wilson = deriveFrequency(Array.from({ length: 300 }, () => ({ value: "Only" })), {
    field: "value", prompt: "Value", includeMissing: false,
  });
  assert.deepEqual(wilson.categories[0].confidenceInterval, { lower: 1, upper: 1 });
  const stratified = deriveStratifiedFrequency(imported.records, {
    field: "age", prompt: "Age", includeMissing: false, stratifyBy: "sex", stratifyPrompt: "Sex",
  });
  assert.equal(stratified.operation, "epi.frequency.stratified");
  assert.equal(stratified.command, "FREQ age STRATAVAR=sex");
  assert.deepEqual(stratified.strata.map((stratum) => [stratum.value, stratum.result.totals.sourceRecords]), [["Female", 48], ["Male", 48]]);
  assert.equal(stratified.strata.reduce((total, stratum) => total + stratum.result.totals.includedRecords, 0), 96);

  const programming = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-program.ts")).href}?program=${Date.now()}`);
  const source = `DEFINE AgeGroup TEXTINPUT
RECODE Age TO AgeGroup
LOVALUE - 4 = "0-4"
4 - 17 = "5-17"
17 - 44 = "18-44"
44 - 64 = "45-64"
64 - HIVALUE = "65+"
END
FREQ AgeGroup STRATAVAR=Sex`;
  const plan = programming.parseBoundedClassicProgram(source, imported.schema.fields);
  assert.equal(plan.version, "0.1.0");
  assert.equal(plan.recode.sourceField, "age");
  assert.equal(plan.frequency.stratifyBy, "sex");
  assert.match(plan.canonicalSource, /FREQ AgeGroup STRATAVAR=sex$/);
  const applied = programming.applyBoundedClassicProgram(imported.records, plan);
  const grouped = deriveStratifiedFrequency(applied.records, {
    field: plan.frequency.field, prompt: plan.frequency.field, includeMissing: false,
    stratifyBy: plan.frequency.stratifyBy, stratifyPrompt: plan.frequency.stratifyBy,
  });
  assert.deepEqual(grouped.strata.flatMap((stratum) => stratum.result.categories.map((category) =>
    [stratum.value, category.value, category.frequency])), [
    ["Female", "18-44", 20], ["Female", "45-64", 13], ["Female", "5-17", 5], ["Female", "65+", 10],
    ["Male", "18-44", 26], ["Male", "45-64", 16], ["Male", "5-17", 5], ["Male", "65+", 1],
  ]);
  assert.throws(() => programming.parseBoundedClassicProgram(`${source}\nEXECUTE "malware.exe"`, imported.schema.fields), /Unsupported command/);
  assert.throws(() => programming.parseBoundedClassicProgram(source.replace("Age TO", "Sex TO"), imported.schema.fields), /must be a Number field/);
}

async function checkMeansContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/foodborne-means-v0.10.json",
  ), "utf8"));
  const datasetBytes = await readFile(repositoryPath(fixture.dataset.file));
  assert.equal(createHash("sha256").update(datasetBytes).digest("hex"), fixture.dataset.sha256);
  const { inferSchemaFromRows, parseCsv } = await import(
    `${pathToFileURL(repositoryPath("wasm/app/forms/csv.ts")).href}?means=${Date.now()}`
  );
  const imported = inferSchemaFromRows("foodborne.csv", parseCsv(datasetBytes.toString("utf8").replace(/^\uFEFF/, "")));
  const { deriveMeans } = await importEngineWithFileFetch();
  const result = deriveMeans(imported.records, fixture.request);
  assert.equal(result.schemaVersion, "0.10.0");
  assert.equal(result.operation, fixture.operation);
  assert.equal(result.command, fixture.expected.command);
  assert.equal(result.totals.sourceRecords, fixture.expected.sourceRecords);
  assert.equal(result.totals.includedRecords, fixture.expected.includedRecords);
  assert.equal(result.totals.excludedMissingOrNonNumeric, fixture.expected.excludedMissingOrNonNumeric);
  for (const [name, expected] of Object.entries(fixture.expected.statistics)) {
    near(result.statistics[name], expected, 1e-12, `foodborne Age ${name}`);
  }

  const partial = deriveMeans([{ age: 2 }, { age: "" }, { age: "invalid" }, { age: 4 }], {
    field: "age", prompt: "Age",
  });
  assert.equal(partial.totals.excludedMissingOrNonNumeric, 2);
  assert.equal(partial.statistics.mean, 3);
  assert.equal(partial.statistics.variance, 2);
  assert.throws(() => deriveMeans([{ age: 2 }], { field: "age", prompt: "Age" }), /at least two/);
}

async function checkRateContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/foodborne-rate-v0.11.json",
  ), "utf8"));
  const datasetBytes = await readFile(repositoryPath(fixture.dataset.file));
  assert.equal(createHash("sha256").update(datasetBytes).digest("hex"), fixture.dataset.sha256);
  const { inferSchemaFromRows, parseCsv } = await import(
    `${pathToFileURL(repositoryPath("wasm/app/forms/csv.ts")).href}?rate=${Date.now()}`
  );
  const imported = inferSchemaFromRows("foodborne.csv", parseCsv(datasetBytes.toString("utf8").replace(/^\uFEFF/, "")));
  const { deriveRate } = await importEngineWithFileFetch();
  const numerator = imported.schema.fields.find((field) => field.name === fixture.request.numeratorField);
  const denominator = imported.schema.fields.find((field) => field.name === fixture.request.denominatorField);
  assert.ok(numerator && denominator);
  const result = deriveRate(imported.records, {
    numeratorField: numerator.name,
    numeratorPrompt: numerator.prompt,
    numeratorValue: fixture.request.numeratorValue,
    denominatorField: denominator.name,
    denominatorPrompt: denominator.prompt,
    multiplier: fixture.request.multiplier,
  });
  assert.equal(result.schemaVersion, "0.11.0");
  assert.equal(result.operation, fixture.operation);
  assert.equal(result.aggregates.numerator, fixture.expected.numerator);
  assert.equal(result.aggregates.denominator, fixture.expected.denominator);
  assert.equal(result.aggregates.falseCount, fixture.expected.falseCount);
  assert.equal(result.totals.excludedDenominatorMissing, fixture.expected.excludedDenominatorMissing);
  near(result.rate, fixture.expected.rate, 1e-12, "foodborne Confirmed rate");
  const missing = deriveRate([{ status: "Yes", id: "1" }, { status: "Yes", id: "" }], {
    numeratorField: "status", numeratorPrompt: "Status", numeratorValue: "yes",
    denominatorField: "id", denominatorPrompt: "ID", multiplier: 100,
  });
  assert.equal(missing.aggregates.numerator, 1);
  assert.equal(missing.aggregates.denominator, 1);
  assert.equal(missing.rate, 100);
  assert.throws(() => deriveRate([], {
    numeratorField: "status", numeratorPrompt: "Status", numeratorValue: "yes",
    denominatorField: "id", denominatorPrompt: "ID", multiplier: 100,
  }), /No records/);
}

async function checkPopulationSurveyContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/population-survey-v0.12.json",
  ), "utf8"));
  const { calculatePopulationSurvey } = await importEngineWithFileFetch();
  const defaultCase = fixture.cases[0];
  const result = calculatePopulationSurvey(defaultCase.input);
  assert.equal(result.schemaVersion, "0.12.0");
  assert.equal(result.operation, fixture.operation);
  assert.deepEqual(result.rows, defaultCase.expected);
  const clustered = fixture.cases[1];
  const clusteredResult = calculatePopulationSurvey(clustered.input);
  assert.deepEqual(clusteredResult.rows.find((row) => row.confidenceLevel === 0.95), clustered.expected95);
  assert.match(clusteredResult.diagnostics.warnings[0], /rounded up/);
  assert.throws(() => calculatePopulationSurvey({ ...defaultCase.input, populationSize: 0 }), /Population size/);
  assert.throws(() => calculatePopulationSurvey({ ...defaultCase.input, expectedFrequencyPercent: 100 }), /Expected frequency/);
  assert.throws(() => calculatePopulationSurvey({ ...defaultCase.input, clusters: 1.5 }), /whole number/);
}

async function checkCohortSampleSizeContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/cohort-cross-sectional-v0.13.json",
  ), "utf8"));
  const { calculateCohortSampleSize, cohortEffectFromOdds, cohortOddsFromOutcomes, cohortOddsFromRisk } = await importEngineWithFileFetch();
  for (const testCase of fixture.cases) {
    const result = calculateCohortSampleSize(testCase.input);
    assert.equal(result.schemaVersion, "0.13.0");
    assert.equal(result.operation, fixture.operation);
    assert.deepEqual(result.methods, testCase.methods);
    assert.ok(Math.abs(result.derived.exposedOutcomePercent - testCase.derived.exposedOutcomePercent) < 1e-10);
    assert.ok(Math.abs(result.derived.riskRatio - testCase.derived.riskRatio) < 1e-10);
  }
  const source = fixture.cases[0];
  const effect = cohortEffectFromOdds(source.input.unexposedOutcomePercent, source.input.oddsRatio);
  assert.ok(Math.abs(cohortOddsFromOutcomes(source.input.unexposedOutcomePercent, effect.exposedOutcomePercent) - 24) < 1e-10);
  assert.ok(Math.abs(cohortOddsFromRisk(source.input.unexposedOutcomePercent, effect.riskRatio) - 24) < 1e-10);
  assert.throws(() => calculateCohortSampleSize({ ...source.input, oddsRatio: 1 }), /different from 1/);
}

async function checkUnmatchedCaseControlContract() {
  const fixture = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/algorithm-validation/unmatched-case-control-v0.14.json",
  ), "utf8"));
  const { calculateUnmatchedCaseControl, unmatchedCaseExposureFromOdds, unmatchedOddsFromExposures } = await importEngineWithFileFetch();
  for (const testCase of fixture.cases) {
    const result = calculateUnmatchedCaseControl(testCase.input);
    assert.equal(result.schemaVersion, "0.14.0");
    assert.equal(result.operation, fixture.operation);
    assert.deepEqual(result.methods, testCase.methods);
    assert.ok(Math.abs(result.derived.caseExposurePercent - testCase.derived.caseExposurePercent) < 1e-10);
  }
  const source = fixture.cases[0];
  const caseExposure = unmatchedCaseExposureFromOdds(source.input.controlExposurePercent, source.input.oddsRatio);
  assert.ok(Math.abs(unmatchedOddsFromExposures(source.input.controlExposurePercent, caseExposure) - 10) < 1e-10);
  assert.throws(() => calculateUnmatchedCaseControl({ ...source.input, oddsRatio: 1 }), /different from 1/);
}

async function checkFoodborneValidationFixture() {
  const fixturePath = "wasm/tests/fixtures/algorithm-validation/foodborne-outbreak-v1-table2x2.json";
  const fixture = JSON.parse(await readFile(repositoryPath(fixturePath), "utf8"));
  const csvBytes = await readFile(repositoryPath(fixture.dataset.file));
  assert.equal(createHash("sha256").update(csvBytes).digest("hex"), fixture.dataset.sha256);

  const { parseCsv } = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/csv.ts")).href}?foodborne=${Date.now()}`);
  const [headers, ...rows] = parseCsv(csvBytes.toString("utf8").replace(/^\uFEFF/, ""));
  assert.equal(rows.length, fixture.dataset.rows);
  const caseIndex = headers.indexOf(fixture.derivation.caseField);
  const exposureIndex = headers.indexOf(fixture.derivation.exposureField);
  assert.ok(caseIndex >= 0 && exposureIndex >= 0, "foodborne derivation fields must exist");
  const normalize = (value) => value.trim().toLocaleLowerCase("en-US");
  const cases = new Set(fixture.derivation.caseValues.map(normalize));
  const noncases = new Set(fixture.derivation.noncaseValues.map(normalize));
  const yes = new Set(fixture.derivation.yesValues.map(normalize));
  const no = new Set(fixture.derivation.noValues.map(normalize));
  const derived = { exposedCases: 0, exposedNonCases: 0, unexposedCases: 0, unexposedNonCases: 0 };
  let excluded = 0;

  for (const row of rows) {
    const status = normalize(row[caseIndex] ?? "");
    const exposure = normalize(row[exposureIndex] ?? "");
    if ((!cases.has(status) && !noncases.has(status)) || (!yes.has(exposure) && !no.has(exposure))) {
      excluded += 1;
    } else if (yes.has(exposure) && cases.has(status)) {
      derived.exposedCases += 1;
    } else if (yes.has(exposure)) {
      derived.exposedNonCases += 1;
    } else if (cases.has(status)) {
      derived.unexposedCases += 1;
    } else {
      derived.unexposedNonCases += 1;
    }
  }
  assert.deepEqual(derived, {
    exposedCases: fixture.input.exposedCases,
    exposedNonCases: fixture.input.exposedNonCases,
    unexposedCases: fixture.input.unexposedCases,
    unexposedNonCases: fixture.input.unexposedNonCases,
  });
  assert.equal(excluded, fixture.derivation.excludedRows);

  const { calculateTable2x2 } = await importEngineWithFileFetch();
  const result = calculateTable2x2(fixture.input);
  const expected = fixture.expected;
  const tolerance = fixture.comparisons.finiteResults.tolerance;
  near(result.estimates.riskRatio.estimate, expected.riskRatio, tolerance, "foodborne risk ratio");
  near(result.estimates.riskRatio.confidenceInterval.lower, expected.riskRatioConfidenceInterval.lower, tolerance, "foodborne risk ratio CI lower");
  near(result.estimates.riskRatio.confidenceInterval.upper, expected.riskRatioConfidenceInterval.upper, tolerance, "foodborne risk ratio CI upper");
  near(result.estimates.oddsRatio.estimate, expected.oddsRatio, tolerance, "foodborne odds ratio");
  near(result.estimates.oddsRatio.confidenceInterval.lower, expected.oddsRatioConfidenceInterval.lower, tolerance, "foodborne odds ratio CI lower");
  near(result.estimates.oddsRatio.confidenceInterval.upper, expected.oddsRatioConfidenceInterval.upper, tolerance, "foodborne odds ratio CI upper");
  near(result.tests.pearson.pValue, expected.pearsonPValue, tolerance, "foodborne Pearson p-value");
  near(result.tests.mantelHaenszel.pValue, expected.mantelHaenszelPValue, tolerance, "foodborne Mantel-Haenszel p-value");
  near(result.tests.yates.pValue, expected.yatesPValue, tolerance, "foodborne Yates p-value");
  for (const tail of ["left", "right", "oneTailed", "twoTailed"]) {
    near(result.tests.fisherExact[tail], expected.fisherExact[tail], tolerance, `foodborne Fisher exact ${tail}`);
  }
  for (const tail of ["left", "right", "oneTailed"]) {
    near(result.tests.midPExact[tail], expected.midPExact[tail], tolerance, `foodborne mid-p exact ${tail}`);
  }
  const conditional = result.estimates.conditionalOddsRatio;
  const conditionalTolerance = fixture.comparisons.conditionalOddsRatioResults.tolerance;
  near(conditional.estimate.value, expected.conditionalOddsRatio.estimate, conditionalTolerance, "foodborne conditional odds ratio");
  for (const method of ["fisherConfidenceInterval", "midPConfidenceInterval"]) {
    near(conditional[method].lower.value, expected.conditionalOddsRatio[method].lower, conditionalTolerance,
      `foodborne conditional odds ratio ${method} lower`);
    near(conditional[method].upper.value, expected.conditionalOddsRatio[method].upper, conditionalTolerance,
      `foodborne conditional odds ratio ${method} upper`);
  }
}

async function checkLegacyTwoByTwoCorpus() {
  const manifest = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/algorithm-validation/legacy-two-by-two-exact-limits.manifest.json"), "utf8"));
  const corpusBytes = await readFile(repositoryPath(manifest.inputFixture.file));
  const exactLimitBytes = await readFile(repositoryPath(manifest.extractedFixture.file));
  const canonicalCorpusBytes = Buffer.from(corpusBytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
  assert.equal(createHash("sha256").update(canonicalCorpusBytes).digest("hex"), manifest.inputFixture.sha256);
  assert.equal(createHash("sha256").update(exactLimitBytes).digest("hex"), manifest.extractedFixture.sha256);
  const corpus = JSON.parse(corpusBytes.toString("utf8").replace(/^\uFEFF/, ""));
  const exactLimitRows = exactLimitBytes.toString("utf8")
    .trim().split(/\r?\n/).slice(1).map((line) => {
      const [id, fisherLower, fisherUpper] = line.split(",");
      return { id: Number(id), fisherLower: Number(fisherLower), fisherUpper: Number(fisherUpper) };
    });
  assert.equal(corpus.length, 100, "the legacy-derived 2 x 2 corpus must retain all 100 cases");
  assert.equal(exactLimitRows.length, manifest.extractedFixture.rows);
  assert.equal(exactLimitRows.length, corpus.length, "legacy exact-limit fixture must align with the 100 cases");
  const { calculateTable2x2 } = await importEngineWithFileFetch();
  for (const testCase of corpus) {
    const result = calculateTable2x2(testCase.input);
    near(result.tests.fisherExact.oneTailed, testCase.expected.fisherOneTailed, 1e-9,
      `legacy case ${testCase.id} Fisher one-tailed`);
    near(result.tests.fisherExact.twoTailed, testCase.expected.fisherTwoTailed, 1e-9,
      `legacy case ${testCase.id} Fisher two-tailed`);
    assert.ok(Math.abs(result.tests.midPExact.left + result.tests.midPExact.right - 1) <= 1e-12,
      `legacy case ${testCase.id} mid-p tails must sum to one`);
    const exactLimits = exactLimitRows[testCase.id];
    assert.equal(exactLimits.id, testCase.id);
    near(result.estimates.conditionalOddsRatio.fisherConfidenceInterval.lower.value, exactLimits.fisherLower, manifest.comparison.tolerance,
      `legacy case ${testCase.id} Fisher exact odds-ratio lower limit`);
    near(result.estimates.conditionalOddsRatio.fisherConfidenceInterval.upper.value, exactLimits.fisherUpper, manifest.comparison.tolerance,
      `legacy case ${testCase.id} Fisher exact odds-ratio upper limit`);
    const conditional = result.estimates.conditionalOddsRatio;
    assert.ok(conditional.fisherConfidenceInterval.lower.value <= conditional.estimate.value
      && conditional.estimate.value <= conditional.fisherConfidenceInterval.upper.value,
      `legacy case ${testCase.id} conditional estimate must lie within Fisher limits`);
    assert.ok(conditional.midPConfidenceInterval.lower.value <= conditional.estimate.value
      && conditional.estimate.value <= conditional.midPConfidenceInterval.upper.value,
      `legacy case ${testCase.id} conditional estimate must lie within mid-p limits`);
  }
}

async function checkCsvAndProjectFixtures() {
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
    clear: () => memory.clear(),
  };
  const unreadableProject = JSON.stringify({ name: "Damaged project", currentFormId: "missing", forms: [] });
  memory.set("epi-info-ai.project-state.v1", unreadableProject);
  const module = await import(`${pathToFileURL(join(demoDirectory, "form-data.ts")).href}?phase0=${Date.now()}`);
  assert.equal(memory.get("epi-info-ai.project-state-unreadable.v1"), unreadableProject);
  const csv = await readFile(join(fixturesDirectory, "csv-roundtrip.csv"), "utf8");
  const rows = module.parseCsv(csv);
  assert.equal(rows.length, 4);
  assert.equal(rows[2][4], 'Said "better" today');
  assert.equal(rows[3][4], "Unicode name: José");

  const inferred = module.inferSchemaFromCsv("phase0_cases.csv", rows);
  assert.equal(inferred.schema.name, "Phase0 Cases Form");
  assert.deepEqual(inferred.schema.fields.map((field) => field.name), rows[0]);
  assert.deepEqual(inferred.schema.fields.map((field) => field.type), ["text", "date", "yes-no", "number", "text", "number", "number"]);
  assert.equal(inferred.records.length, 3);

  const serializedRows = module.parseCsv(module.serializeCsv(inferred.schema, inferred.records));
  assert.deepEqual(serializedRows, rows);

  const tsvRows = module.parseTsv('Case ID\tAge\tNotes\nTSV-001\t42\t"tabs stay tabular"\n');
  assert.deepEqual(tsvRows, [["Case ID", "Age", "Notes"], ["TSV-001", "42", "tabs stay tabular"]]);
  const jsonRows = module.parseJsonRecords(JSON.stringify([
    { "Case ID": "JSON-001", Age: 31, Ill: true },
    { "Case ID": "JSON-002", Age: null, Ill: false, Notes: "follow-up" },
  ]));
  assert.deepEqual(jsonRows, [
    ["Case ID", "Age", "Ill", "Notes"],
    ["JSON-001", "31", "true", ""],
    ["JSON-002", "", "false", "follow-up"],
  ]);
  assert.throws(() => module.parseJsonRecords('{"type":"FeatureCollection","features":[]}'), /array of record objects/i);

  const outbreakCsv = await readFile(join(examplesDirectory, "foodborne-outbreak-investigation.csv"), "utf8");
  const outbreakRows = module.parseCsv(outbreakCsv);
  assert.equal(outbreakRows.length, 97);
  assert.equal(outbreakRows[0].length, 27);
  assert.equal(outbreakRows[0][0], "ID");
  assert.equal(outbreakRows[0][24], "Latitude");
  assert.equal(outbreakRows[0][25], "Longitude");
  assert.equal(outbreakRows[0][26], "Household Neighborhood");
  const outbreak = module.inferSchemaFromCsv("foodborne-outbreak-investigation.csv", outbreakRows);
  assert.equal(outbreak.records.length, 96);
  assert.deepEqual(outbreak.schema.fields.find((field) => field.name === "latitude")?.rules,
    [{ kind: "coordinate", axis: "latitude", minimumDecimalPlaces: 5 }]);
  assert.deepEqual(outbreak.schema.fields.find((field) => field.name === "longitude")?.rules,
    [{ kind: "coordinate", axis: "longitude", minimumDecimalPlaces: 5 }]);
  assert.equal(new Set(outbreak.records.map((record) => record.id)).size, 96);
  assert.ok(outbreak.records.every((record) => Number(record.latitude) >= 41.6 && Number(record.latitude) <= 41.8));
  assert.ok(outbreak.records.every((record) => Number(record.longitude) >= -83.7 && Number(record.longitude) <= -83.4));
  assert.equal(module.alignToGrid(19, 12), 24);
  assert.equal(module.alignToGrid(5, 12), 0);

  const snapshot = await jsonFixture("project-snapshot-v1.json");
  const contracts = await import(`${pathToFileURL(repositoryPath("wasm/app/contracts/core.ts")).href}?phase0=${Date.now()}`);
  const validated = contracts.validateProjectSnapshot(snapshot);
  assert.deepEqual(validated, snapshot);
  assert.equal(contracts.isProjectSnapshot(snapshot), true);
  assert.equal(contracts.isProjectSnapshot({ ...snapshot, version: 2 }), false);
  for (const invalid of await jsonFixture("project-snapshot-invalid.json")) {
    assert.throws(
      () => contracts.validateProjectSnapshot(invalid.snapshot),
      new RegExp(invalid.errorPattern, "i"),
      invalid.name,
    );
  }
  assert.ok(validated.name);
  assert.ok(validated.forms.length > 0);
  assert.ok(validated.forms.some((form) => form.id === validated.currentFormId));
  for (const form of validated.forms) {
    const names = form.schema.fields.map((field) => field.name);
    assert.equal(new Set(names).size, names.length, `${form.id} field names must be unique`);
    assert.ok(form.schema.fields.every((field) => field.name && field.prompt && field.type));
    assert.ok(Array.isArray(form.records));
  }
}

async function checkMapFixture() {
  const fixture = await jsonFixture("map-points.json");
  const { aggregateH3Cells, buildTimeLapseStops, extractMapPoints, inferMapFields, listGeoJsonPolygonProperties, MAP_PANE_Z_INDEX, mapPaneForGeometryType, parseGeoJson, polygonLabelAnchor } = await import(`${pathToFileURL(join(demoDirectory, "maps.ts")).href}?phase0=${Date.now()}`);
  const points = extractMapPoints(fixture.records, fixture.latitudeField, fixture.longitudeField);
  assert.deepEqual(points.map(({ recordIndex, latitude, longitude }) => ({ recordIndex, latitude, longitude })), fixture.expected);
  const h3Cells = aggregateH3Cells(points, 8);
  assert.ok(h3Cells.length > 0);
  assert.equal(h3Cells.reduce((total, cell) => total + cell.count, 0), points.length);
  assert.ok(h3Cells.every((cell) => typeof cell.cell === "string" && cell.cell.length > 0));
  assert.throws(() => aggregateH3Cells(points, -1), /0 through 15/);
  assert.throws(() => aggregateH3Cells(points, 16), /0 through 15/);
  assert.throws(() => aggregateH3Cells(points, 8.5), /whole number/);
  assert.ok(MAP_PANE_Z_INDEX.point > MAP_PANE_Z_INDEX.line);
  assert.ok(MAP_PANE_Z_INDEX.line > MAP_PANE_Z_INDEX.polygon);
  assert.ok(MAP_PANE_Z_INDEX.polygon > MAP_PANE_Z_INDEX.raster);
  assert.equal(mapPaneForGeometryType("Point"), "epi-point-pane");
  assert.equal(mapPaneForGeometryType("LineString"), "epi-line-pane");
  assert.equal(mapPaneForGeometryType("Polygon"), "epi-polygon-pane");
  assert.deepEqual(inferMapFields([
    { name: "case_number", prompt: "Case ID" },
    { name: "x_coordinate", prompt: "Longitude" },
    { name: "y_coordinate", prompt: "Latitude" },
  ]), { latitude: "y_coordinate", longitude: "x_coordinate", label: "case_number" });
  const geoJsonFixture = await readFile(join(fixturesDirectory, "geojson-layer.json"), "utf8");
  const parsed = parseGeoJson(geoJsonFixture);
  assert.equal(parsed.geojson.type, "FeatureCollection");
  assert.equal(parsed.featureCount, 3);
  assert.deepEqual(listGeoJsonPolygonProperties(parsed.geojson), ["name", "status"]);
  const toledoText = await readFile(join(examplesDirectory, "city-of-toledo-neighborhoods.geojson"), "utf8");
  const toledo = parseGeoJson(toledoText);
  assert.equal(toledo.geojson.type, "FeatureCollection");
  assert.equal(toledo.featureCount, 87);
  assert.ok(toledo.geojson.features.every((feature) => feature.geometry?.type === "MultiPolygon"));
  assert.ok(toledo.geojson.features.every((feature) => typeof feature.properties?.name === "string" && feature.properties.name.length > 0));
  assert.ok(listGeoJsonPolygonProperties(toledo.geojson).includes("name"));
  const polygonAnchor = polygonLabelAnchor(parsed.geojson.features[2].geometry);
  assert.ok(polygonAnchor.clearance > 0);
  assert.ok(polygonAnchor.latitude > 41.63 && polygonAnchor.latitude < 41.69);
  assert.ok(polygonAnchor.longitude > -83.57 && polygonAnchor.longitude < -83.51);
  const polygonWithHoleAnchor = polygonLabelAnchor({
    type: "Polygon",
    coordinates: [
      [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
      [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
    ],
  });
  assert.ok(polygonWithHoleAnchor.clearance > 0);
  assert.ok(!(polygonWithHoleAnchor.longitude > 3 && polygonWithHoleAnchor.longitude < 7
    && polygonWithHoleAnchor.latitude > 3 && polygonWithHoleAnchor.latitude < 7));
  const timeStops = buildTimeLapseStops([
    { record: { onset_date: "2026-01-11" }, recordIndex: 1 },
    { record: { onset_date: "2026-01-10" }, recordIndex: 0 },
    { record: { onset_date: "2026-01-11" }, recordIndex: 2 },
    { record: { onset_date: "not-a-date" }, recordIndex: 3 },
  ], "onset_date");
  assert.equal(timeStops.length, 2);
  assert.deepEqual(timeStops.map((stop) => stop.points.map((point) => point.recordIndex)), [[0], [1, 2]]);
  assert.throws(() => buildTimeLapseStops([
    { record: { time: "08:00" } },
    { record: { time: "09:00" } },
  ], "time", 1), /demo limit/);
  assert.throws(() => parseGeoJson("not json"), /not valid JSON/);
  assert.throws(() => parseGeoJson('{"type":"FeatureCollection","features":[{},{}]}'), /must be a Feature/);
  assert.throws(() => parseGeoJson(geoJsonFixture, 2), /demo limit/);
}

async function checkSupabaseSetupContract() {
  const sql = (await readFile(join(demoDirectory, "setup/supabase-schema.sql"), "utf8")).toLowerCase();
  for (const requirement of [
    "create table if not exists public.epi_projects",
    "enable row level security",
    "auth.uid()",
    "revoke all on table public.epi_projects from anon",
    "grant select, insert, update, delete on table public.epi_projects to authenticated",
  ]) {
    assert.ok(sql.includes(requirement), `Supabase setup must retain: ${requirement}`);
  }
}

async function checkFormValidationContracts() {
  const contracts = await import(`${pathToFileURL(repositoryPath("wasm/app/contracts/core.ts")).href}?validation=${Date.now()}`);
  const validation = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/validation.ts")).href}?validation=${Date.now()}`);
  const schema = {
    name: "Validation form",
    fields: [
      { name: "case_id", prompt: "Case ID", type: "text", required: true, rules: [{ kind: "unique" }, { kind: "pattern", pattern: "^CASE-[0-9]{3}$" }] },
      { name: "age", prompt: "Age", type: "number", required: false, rules: [{ kind: "range", valueType: "number", min: 0, max: 120 }] },
      { name: "status", prompt: "Status", type: "option", required: false, rules: [{ kind: "legal-values", values: ["Confirmed", "Probable"] }] },
      { name: "latitude", prompt: "Latitude", type: "number", required: false, rules: [{ kind: "coordinate", axis: "latitude", minimumDecimalPlaces: 5 }] },
      { name: "longitude", prompt: "Longitude", type: "number", required: false, rules: [{ kind: "coordinate", axis: "longitude", minimumDecimalPlaces: 5 }] },
    ],
  };
  const snapshot = contracts.validateProjectSnapshot({
    version: 1,
    name: "Validation project",
    currentFormId: "validation-form",
    forms: [{ id: "validation-form", schema, records: [] }],
  });
  assert.deepEqual(snapshot.forms[0].schema.fields[0].rules, schema.fields[0].rules);
  const issues = validation.validateRecord(
    "validation-form",
    schema,
    { case_id: "case-001", age: 121, status: "Suspected", latitude: "41.6528", longitude: "-183.53790" },
    1,
    [{ case_id: "CASE-001", age: 40, status: "Confirmed" }],
  );
  assert.deepEqual(new Set(issues.map((issue) => issue.rule)), new Set(["unique", "pattern", "range", "legal-values", "coordinate"]));
  assert.equal(issues.filter((issue) => issue.rule === "coordinate").length, 2);
  assert.ok(issues.every((issue) => issue.formId === "validation-form" && issue.recordIndex === 1 && issue.suggestedResolution));
  assert.throws(() => contracts.validateProjectSnapshot({
    name: "Invalid rules",
    currentFormId: "form",
    forms: [{ id: "form", schema: { name: "Form", fields: [{ name: "x", prompt: "X", type: "text", required: false, rules: [{ kind: "range", valueType: "number" }] }] }, records: [] }],
  }), /must define min, max, or both/);
  assert.throws(() => contracts.validateProjectSnapshot({
    name: "Invalid coordinate rule",
    currentFormId: "form",
    forms: [{ id: "form", schema: { name: "Form", fields: [{ name: "latitude", prompt: "Latitude", type: "text", required: false, rules: [{ kind: "coordinate", axis: "latitude", minimumDecimalPlaces: 5 }] }] }, records: [] }],
  }), /coordinate rules require a Number field/);
  const coordinateSchema = contracts.validateProjectSnapshot({
    name: "Coordinates",
    currentFormId: "form",
    forms: [{ id: "form", schema: { name: "Form", fields: [
      { name: "latitude", prompt: "Latitude", type: "number", required: false, rules: [{ kind: "coordinate", axis: "latitude", minimumDecimalPlaces: 5 }] },
      { name: "longitude", prompt: "Longitude", type: "number", required: false, rules: [{ kind: "coordinate", axis: "longitude", minimumDecimalPlaces: 5 }] },
    ] }, records: [] }],
  }).forms[0].schema;
  assert.equal(validation.validateRecord("form", coordinateSchema, { latitude: "+41.65280", longitude: "-83.53790" }, 0).length, 0);

  const geocodeSchema = {
    name: "Legacy Geo-location template",
    fields: [
      { name: "address", prompt: "Address", type: "multiline", required: false },
      { name: "get_coordinates", prompt: "Get Coordinates", type: "command-button", required: false, checkCode: { version: 1, click: [{ kind: "geocode", addressField: "address", latitudeField: "latitude", longitudeField: "longitude" }] } },
      { name: "latitude", prompt: "Latitude", type: "number", required: false, rules: [{ kind: "coordinate", axis: "latitude", minimumDecimalPlaces: 5 }] },
      { name: "longitude", prompt: "Longitude", type: "number", required: false, rules: [{ kind: "coordinate", axis: "longitude", minimumDecimalPlaces: 5 }] },
    ],
  };
  const geocodeProject = contracts.validateProjectSnapshot({
    version: 1,
    name: "Geocode project",
    currentFormId: "geocode",
    forms: [{ id: "geocode", schema: geocodeSchema, records: [] }],
  });
  assert.equal(geocodeProject.forms[0].schema.fields[1].checkCode.click[0].kind, "geocode");
  assert.throws(() => contracts.validateProjectSnapshot({
    version: 1,
    name: "Invalid geocode project",
    currentFormId: "geocode",
    forms: [{ id: "geocode", schema: { ...geocodeSchema, fields: geocodeSchema.fields.map((field) => field.name === "latitude" ? { ...field, type: "text", rules: undefined } : field) }, records: [] }],
  }), /latitude field.*Number/i);

  const skipSchema = {
    name: "Skip form",
    fields: [
      { name: "hospitalized", prompt: "Hospitalized", type: "yes-no", required: false, tabStop: true, checkCode: { version: 1, after: [{ kind: "goto", targetField: "antibiotics", when: { operator: "equals", value: "No" } }] } },
      { name: "admission_date", prompt: "Admission date", type: "date", required: false, tabStop: true },
      { name: "antibiotics", prompt: "Antibiotics", type: "yes-no", required: false, tabStop: true },
    ],
  };
  const skipProject = contracts.validateProjectSnapshot({
    version: 1,
    name: "Skip project",
    currentFormId: "skip",
    forms: [{ id: "skip", schema: skipSchema, records: [] }],
  });
  assert.equal(skipProject.forms[0].schema.fields[0].checkCode.after[0].targetField, "antibiotics");
  const entryView = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/entry-view.ts")).href}?skip=${Date.now()}`);
  assert.equal(entryView.resolveAfterGoto(skipSchema.fields[0], "No"), "antibiotics");
  assert.equal(entryView.resolveAfterGoto(skipSchema.fields[0], "Yes"), undefined);
  const actionField = {
    name: "hospitalized", prompt: "Hospitalized", type: "yes-no", required: false,
    checkCode: { after: [{ kind: "field-action", action: "disable", targetField: "admission_date", when: { operator: "equals", value: "No" } }] },
  };
  assert.deepEqual(entryView.resolveAfterActions(actionField, "No").map((statement) => statement.action), ["disable"]);
  assert.deepEqual(entryView.resolveAfterActions(actionField, "Yes"), []);
  assert.throws(() => contracts.validateProjectSnapshot({
    name: "Skip cycle",
    currentFormId: "skip",
    forms: [{ id: "skip", schema: { name: "Skip", fields: [
      { name: "a", prompt: "A", type: "text", required: false, checkCode: { after: [{ kind: "goto", targetField: "b" }] } },
      { name: "b", prompt: "B", type: "text", required: false, checkCode: { after: [{ kind: "goto", targetField: "a" }] } },
    ] }, records: [] }],
  }), /goto cycle/i);

  const ageSchema = {
    name: "Calculated age form",
    fields: [
      { name: "birth_date", prompt: "Birth date", type: "date", required: true },
      { name: "interview_date", prompt: "Interview date", type: "date", required: true },
      { name: "age", prompt: "Age", type: "number", required: false, rules: [{ kind: "calculated-age", sourceDateField: "birth_date", asOfDateField: "interview_date" }] },
    ],
  };
  contracts.validateProjectSnapshot({ name: "Age", currentFormId: "age", forms: [{ id: "age", schema: ageSchema, records: [] }] });
  assert.equal(validation.calculateAgeYears("2000-08-27", "2026-08-26"), 25);
  assert.equal(validation.calculateAgeYears("2000-08-27", "2026-08-27"), 26);
  assert.equal(validation.calculateAgeYears("not-a-date", "2026-08-27"), null);
  assert.deepEqual(validation.materializeCalculatedFields(ageSchema, { birth_date: "2000-08-27", interview_date: "2026-08-27", age: 0 }).age, 26);
  assert.throws(() => contracts.validateProjectSnapshot({
    name: "Bad age", currentFormId: "age", forms: [{ id: "age", schema: { name: "Bad", fields: [
      { name: "age", prompt: "Age", type: "number", required: false, rules: [{ kind: "calculated-age", sourceDateField: "missing" }] },
    ] }, records: [] }],
  }), /calculated-age source/);

  const dataQuality = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/data-quality.ts")).href}?quality=${Date.now()}`);
  const quality = dataQuality.buildDataQualityReport("validation-form", schema, [
    { case_id: "CASE-001", age: 40, status: "Confirmed" },
    { case_id: "CASE-001", age: "", status: "Suspected" },
  ]);
  assert.equal(quality.recordCount, 2);
  assert.equal(quality.fields.find((field) => field.fieldName === "age").missing, 1);
  assert.equal(quality.duplicateIssues, 2);
  assert.ok(quality.duplicateGroups.some((group) => group.fieldName === "case_id" && group.recordIndexes.length === 2));
  assert.ok(quality.issues.some((issue) => issue.rule === "legal-values"));

  const lifecycle = contracts.validateProjectSnapshot({
    version: 1,
    name: "Lifecycle",
    currentFormId: "validation-form",
    forms: [{ id: "validation-form", schema, records: [], deletedRecords: [{
      archiveId: "archive-1", record: { case_id: "CASE-001" }, originalIndex: 0,
      deletedAt: "2026-08-27T12:00:00.000Z", reason: "Confirmed duplicate",
    }] }],
    auditLog: [{ id: "audit-1", occurredAt: "2026-08-27T12:00:00.000Z", action: "record-deleted", formId: "validation-form", archiveId: "archive-1", detail: "Record moved to Recycle Bin." }],
  });
  assert.equal(lifecycle.forms[0].deletedRecords[0].reason, "Confirmed duplicate");
  assert.equal(lifecycle.auditLog[0].action, "record-deleted");
}

async function checkGeocodingProviderBoundary() {
  const geocoding = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/geocoding.ts")).href}?geocode=${Date.now()}`);
  let requestedUrl = "";
  const candidates = await geocoding.geocodeAddress("123 Main Street, Toledo, Ohio", {
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return new Response(JSON.stringify([{
        display_name: "123 Main Street, Toledo, Lucas County, Ohio, USA",
        lat: "41.6528",
        lon: "-83.5379",
        importance: 0.8,
        category: "place",
        type: "house",
      }]), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.match(requestedUrl, /format=jsonv2/);
  assert.match(requestedUrl, /limit=7/);
  assert.match(requestedUrl, /q=123\+Main\+Street/);
  assert.deepEqual(candidates[0], {
    formattedAddress: "123 Main Street, Toledo, Lucas County, Ohio, USA",
    confidence: "High",
    quality: "place: house",
    latitude: 41.6528,
    longitude: -83.5379,
    provider: "OpenStreetMap Nominatim",
  });
  await assert.rejects(() => geocoding.geocodeAddress(" ", { fetchImpl: async () => new Response("[]") }), /Enter an address/);
}

async function checkSampleProjectPackage() {
  const contracts = await import(`${pathToFileURL(repositoryPath("wasm/app/contracts/project-package.ts")).href}?package=${Date.now()}`);
  const source = await readFile(repositoryPath("wasm/demo/examples/sample-project.epia.json"), "utf8");
  const canonicalSource = source.replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(canonicalSource).digest("hex"), "00af75d2d22d669bc4ea204f07a9525557023bafad349564c813c942238f3bb4");
  const packageValue = contracts.parseProjectPackage(source);
  assert.equal(packageValue.project.name, "Sample");
  assert.equal(packageValue.project.forms.length, 18);
  assert.equal(packageValue.programs.length, 1);
  assert.equal(packageValue.programs[0].name, "Statistics");
  assert.match(packageValue.programs[0].source, /READ \{Projects\/Sample\/Sample\.prj\}:Oswego/);
  assert.match(packageValue.programs[0].source, /LOGISTIC CHD = CAT/);
  assert.equal(packageValue.codeTables.length, 22);
  assert.deepEqual(packageValue.migration.inventory, {
    forms: 18,
    pages: 26,
    fields: 417,
    programs: 1,
    codeTables: 22,
  });
  assert.equal(packageValue.migration.forms.flatMap((form) => form.pages).length, 26);
  assert.equal(packageValue.migration.forms.flatMap((form) => [
    ...form.unpagedFields,
    ...form.pages.flatMap((page) => page.fields),
  ]).length, 417);
  const recordCounts = Object.fromEntries(packageValue.project.forms.map((form) => [form.schema.name, form.records.length]));
  assert.equal(recordCounts.Oswego, 75);
  assert.equal(recordCounts.Epi10, 2152);
  assert.equal(recordCounts.Smoke, 337);
  const invalidPackage = JSON.parse(source);
  invalidPackage.version = 99;
  assert.throws(() => contracts.validateProjectPackage(invalidPackage), /package.version/);
}

async function checkAlgorithmValidationRegistry() {
  const registry = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/algorithm-validation/registry.json"), "utf8"));
  const allowedStates = new Set(["experimental", "candidate", "validated", "restricted", "retired"]);
  const allowedGateStates = new Set(["not-started", "partial", "passed", "failed", "not-applicable"]);
  const requiredGates = ["G0", "G1", "G2", "G3", "G4", "G5", "G6"];
  assert.equal(registry.schemaVersion, "1.0.0");
  assert.ok(Array.isArray(registry.algorithms) && registry.algorithms.length > 0);
  assert.equal(new Set(registry.algorithms.map((algorithm) => algorithm.operation)).size, registry.algorithms.length,
    "algorithm operation IDs must be unique");

  for (const algorithm of registry.algorithms) {
    assert.match(algorithm.operation, /^epi\.[A-Za-z0-9.]+$/);
    assert.ok(allowedStates.has(algorithm.state), `${algorithm.operation} has an invalid validation state`);
    assert.ok(algorithm.resultSchemaVersion && algorithm.implementation?.engineId && algorithm.implementation?.source);
    assert.ok(Array.isArray(algorithm.evidence) && Array.isArray(algorithm.knownGaps));
    await assertFile(algorithm.implementation.source);
    await Promise.all(algorithm.evidence.map(assertFile));
    for (const gate of requiredGates) {
      assert.ok(allowedGateStates.has(algorithm.gates?.[gate]), `${algorithm.operation} must record ${gate}`);
    }
    if (["validated", "restricted"].includes(algorithm.state)) {
      assert.ok(requiredGates.every((gate) => ["passed", "not-applicable"].includes(algorithm.gates[gate])),
        `${algorithm.operation} cannot be ${algorithm.state} with incomplete gates`);
      assert.ok(algorithm.approvals?.statistical && algorithm.approvals?.implementation,
        `${algorithm.operation} requires statistical and implementation approvals`);
    }
  }
}

async function checkProgrammingCurriculumRegistry() {
  const registry = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/programming-curriculum/registry.json",
  ), "utf8"));
  const allowedEvidence = new Set(["taught-workflow", "command-reference-example", "official-sample-program", "legacy-implementation"]);
  const allowedStates = new Set(["catalogued", "transcribed", "parsed", "executable", "parity-candidate", "reviewed"]);
  assert.equal(registry.schemaVersion, "1.0.0");
  assert.ok(Array.isArray(registry.examples) && registry.examples.length >= 7);
  assert.equal(new Set(registry.examples.map((example) => example.id)).size, registry.examples.length,
    "curriculum example IDs must be unique");
  for (const example of registry.examples) {
    assert.match(example.id, /^CURR-(CHECK|PGM)-[0-9]{3}$/);
    assert.ok(allowedEvidence.has(example.evidenceClass), `${example.id} has an invalid evidence class`);
    assert.ok(allowedStates.has(example.state), `${example.id} has an invalid promotion state`);
    assert.match(example.source, /^https:\/\//);
    assert.ok(Array.isArray(example.commands) && example.commands.length > 0);
    assert.ok(Array.isArray(example.workflow) && example.workflow.length > 0);
    assert.ok(typeof example.executionPolicy === "string" && example.executionPolicy.length > 0);
  }
}

async function checkValidationLabSource() {
  const notebook = JSON.parse(await readFile(repositoryPath("wasm/validation-lab/content/validate-table2x2.ipynb"), "utf8"));
  assert.equal(notebook.nbformat, 4);
  assert.equal(notebook.metadata?.kernelspec?.name, "python");
  const source = notebook.cells.flatMap((cell) => cell.source || []).join("");
  for (const requiredText of [
    "candidate operation",
    "WebAssembly.instantiate",
    "scipy.stats.contingency",
    "nchypergeom_fisher",
    "conditional_odds_ratio_fisher_lower",
    "absoluteTolerance",
    "wasm_sha256",
    "GitLab CI",
  ]) {
    assert.ok(source.includes(requiredText), `validation notebook must retain ${requiredText}`);
  }
}

async function checkEpiAssistProposalBoundary() {
  const proposals = await import(`${pathToFileURL(repositoryPath("wasm/app/assistant/proposals.ts")).href}?assistant=${Date.now()}`);
  const context = {
    version: 1,
    projectName: "Outbreak Project",
    formName: "Case Form",
    recordCount: 10,
    fields: [
      { name: "case_status", prompt: "Case Status", type: "text", missing: 1, missingPercent: 10, violations: 0 },
      { name: "onset_date", prompt: "Onset Date", type: "date", missing: 2, missingPercent: 20, violations: 0 },
      { name: "age", prompt: "Age", type: "number", missing: 0, missingPercent: 0, violations: 0 },
      { name: "sex", prompt: "Sex", type: "text", missing: 0, missingPercent: 0, violations: 0 },
    ],
  };
  const accepted = proposals.parseEpiAssistJson(JSON.stringify({
    summary: "Review the outbreak",
    rationale: "Use established workflows.",
    actions: [
      { kind: "open-data-quality", fieldNames: ["onset_date"] },
      { kind: "run-frequency", fieldName: "case_status" },
      { kind: "run-epi-curve", dateField: "onset_date", groupField: "case_status" },
    ],
  }), context);
  assert.equal(accepted.actions.length, 3);
  assert.throws(() => proposals.parseEpiAssistJson('{"summary":"x","rationale":"y","actions":[{"kind":"execute-code","code":"delete records"}]}', context), /does not allow/);
  assert.throws(() => proposals.parseEpiAssistJson('{"summary":"x","rationale":"y","actions":[{"kind":"run-frequency","fieldName":"invented"}]}', context), /not a field/);
  assert.throws(() => proposals.parseEpiAssistJson('{"summary":"x","rationale":"y","actions":[{"kind":"run-epi-curve","dateField":"case_status"}]}', context), /Date type/);
  const fallback = proposals.buildGuidedProposal(context);
  assert.deepEqual(fallback.actions.map((action) => action.kind), ["open-data-quality", "run-frequency", "run-epi-curve"]);
  const toolCalls = proposals.parseEpiAssistToolCalls(`
<tool_call>{"name":"open_data_quality","arguments":{"field_names":["onset_date"]}}</tool_call>
<tool_call>{"name":"run_frequency","arguments":{"field_name":"age","stratify_by":"sex"}}</tool_call>
<tool_call>{"name":"run_epi_curve","arguments":{"date_field":"onset_date","group_field":"case_status"}}</tool_call>`, context);
  assert.deepEqual(toolCalls.actions.map((action) => action.kind), ["open-data-quality", "run-frequency", "run-epi-curve"]);
  assert.deepEqual(toolCalls.actions[1], { kind: "run-frequency", fieldName: "age", stratifyBy: "sex" });
  const partial = proposals.parseEpiAssistToolCalls(`
<tool_call>{"name":"run_frequency","arguments":{"field_name":"case_status"}}</tool_call>
<tool_call>{"name":"execute_code","arguments":{"code":"delete records"}}</tool_call>
<tool_call>{"name":"run_epi_curve","arguments":`, context);
  assert.deepEqual(partial.actions.map((action) => action.kind), ["run-frequency"]);
  assert.match(partial.rationale, /1 other call was discarded/);
  assert.throws(() => proposals.parseEpiAssistToolCalls('<tool_call>{"name":"run_frequency","arguments":{"field_name":"invented"}}</tool_call>', context), /No Granite tool call passed validation/);

  const workerSource = await readFile(repositoryPath("wasm/demo/epi-assist-worker.ts"), "utf8");
  for (const provenanceMarker of [
    'MODEL_REVISION = "main"',
    'RUNTIME_VERSION = "3.7.5"',
    'SYSTEM_PROMPT_VERSION = "epi-assist-system-v1"',
    'TOOL_SCHEMA_VERSION = "epi-assist-tools-v2"',
    "prompt: { systemVersion: SYSTEM_PROMPT_VERSION, system: SYSTEM_PROMPT, user: event.data.prompt }",
  ]) assert.ok(workerSource.includes(provenanceMarker), `Epi Assist must retain ${provenanceMarker}`);
}

async function run() {
  const checks = [
    ["required assets and familiar UI landmarks", checkRequiredAssetsAndUi],
    ["TypeScript source language boundary", checkSourceLanguageBoundary],
    ["WASM checksum and exports", checkWasmArtifact],
    ["2 x 2 result contract", checkTable2x2Contract],
    ["stratified 2 x 2 result contract", checkStratifiedTable2x2Contract],
    ["stratified OR/RR homogeneity contract", checkStratifiedHomogeneityContract],
    ["stratified exact conditional contract", checkStratifiedExactContract],
    ["stratified operational limits and metamorphic contract", checkStratifiedOperationalContract],
    ["foodborne Classic FREQ contract", checkFrequencyContract],
    ["foodborne Classic MEANS contract", checkMeansContract],
    ["foodborne Visual Dashboard Rates contract", checkRateContract],
    ["StatCalc Population Survey contract", checkPopulationSurveyContract],
    ["StatCalc Cohort or Cross-Sectional contract", checkCohortSampleSizeContract],
    ["StatCalc Unmatched Case-Control contract", checkUnmatchedCaseControlContract],
    ["foodborne 2 x 2 validation fixture", checkFoodborneValidationFixture],
    ["legacy 100-case exact 2 x 2 corpus", checkLegacyTwoByTwoCorpus],
    ["CSV, grid, and project fixtures", checkCsvAndProjectFixtures],
    ["map coordinate filtering", checkMapFixture],
    ["Supabase RLS setup contract", checkSupabaseSetupContract],
    ["form validation contracts", checkFormValidationContracts],
    ["legacy GEOCODE provider boundary", checkGeocodingProviderBoundary],
    ["portable Sample project package", checkSampleProjectPackage],
    ["algorithm validation registry", checkAlgorithmValidationRegistry],
    ["programming curriculum registry", checkProgrammingCurriculumRegistry],
    ["JupyterLite validation lab source", checkValidationLabSource],
    ["Epi Assist typed proposal allowlist", checkEpiAssistProposalBoundary],
  ];

  for (const [name, check] of checks) {
    await check();
    console.log(`PASS ${name}`);
  }
  console.log(`Phase 0 automated baseline passed (${checks.length} checks).`);
}

await run();
