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
    "wasm/app/assistant/gateway.ts",
    "wasm/demo/maps.ts",
    "wasm/demo/shell.ts",
    "wasm/demo/stratified-worker.ts",
    "wasm/demo/stratified-worker-client.ts",
    "wasm/demo/supabase-sync.ts",
    "wasm/app/contracts/core.ts",
    "wasm/app/contracts/assistant.ts",
    "wasm/app/assistant/proposals.ts",
    "wasm/app/programming/classic-editor.ts",
    "wasm/app/programming/classic-program-document.ts",
    "wasm/app/programming/classic-command-builder.ts",
    "wasm/app/programming/classic-selection.ts",
    "wasm/app/programming/classic-sort.ts",
    "wasm/app/programming/classic-assignment.ts",
    "wasm/app/programming/classic-if.ts",
    "wasm/app/programming/classic-display.ts",
    "wasm/app/programming/classic-group.ts",
    "wasm/app/programming/classic-relate.ts",
    "wasm/app/programming/classic-write.ts",
    "wasm/app/programming/classic-merge.ts",
    "wasm/app/programming/classic-delete.ts",
    "wasm/app/programming/classic-delete-records.ts",
    "wasm/app/programming/classic-undelete-records.ts",
    "wasm/app/programming/classic-summarize.ts",
    "wasm/app/programming/classic-graph.ts",
    "wasm/app/programming/classic-tables.ts",
    "wasm/app/programming/classic-complex-means.ts",
    "wasm/app/programming/epi-ai-quality.ts",
    "wasm/app/programming/file-convert.ts",
    "wasm/app/programming/classic-command-parity.ts",
    "wasm/app/programming/classic-session.ts",
    "wasm/docs/design/charts-compatibility-inventory.md",
    "COMMAND_SET.md",
    "wasm/app/programming/classic-program-surface.ts",
    "wasm/app/programming/classic-program.ts",
    "wasm/app/programming/run-history.ts",
    "wasm/app/contracts/project-package.ts",
    "wasm/app/contracts/project-archive.ts",
    "wasm/app/maps/project-map-assets.ts",
    "wasm/app/contracts/encrypted-project.ts",
    "wasm/app/forms/geocoding.ts",
    "wasm/app/forms/import-preview.ts",
    "wasm/app/share/webrtc-transfer.ts",
    "wasm/app/help/runbooks.ts",
    "wasm/app/forms/form-designer-menu.ts",
    "wasm/app/forms/enter-data-menu.ts",
    "wasm/app/maps/pmtiles-reader.ts",
    "wasm/app/maps/maplibre-pmtiles.ts",
    "wasm/app/dashboard/dashboard-menu.ts",
    "wasm/app/analysis/classic-analysis-menu.ts",
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
    "wasm/docs/validation/tables-mxn-method-contract.md",
    "wasm/docs/validation/complex-sample-means-method-contract.md",
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
    "wasm/validation-lab/content/validate-tables.ipynb",
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
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar.pgm",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar.expected.json",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-outtable.pgm",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-outtable.expected.json",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher-rxc.pgm",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher-rxc.expected.json",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar-outtable.pgm",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar-outtable.expected.json",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-options.pgm",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-options.expected.json",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar.pgm",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar.expected.json",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar-outtable.pgm",
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar-outtable.expected.json",
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
    "file-open-encrypted-project",
    "file-save-encrypted-project",
    "project-package-open",
    "view-menu",
    "view-status-bar",
    "tools-menu",
    "help-menu",
    "help-runbooks",
    "runbook-library-dialog",
    "runbook-coach",
    "encrypted-project-save-dialog",
    "encrypted-project-save-create",
    "encrypted-project-open-dialog",
    "encrypted-project-open-review",
    "encrypted-project-open-apply",
    "designer-file-menu",
    "designer-no-project",
    "project-lifecycle-status",
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
    "epi-assist-provider-badge",
    "epi-assist-run-request-id",
    "csv-import",
    "data-import-preview-dialog",
    "data-import-preview-key",
    "data-import-preview-apply",
    "package-transport-dialog",
    "package-create",
    "data-package-import-dialog",
    "data-package-review",
    "secure-share-dialog",
    "secure-share-create-offer",
    "secure-share-create-answer",
    "secure-share-review-received",
    "secure-share-save-received",
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
    "classic-analysis-menu",
    "classic-command-tree",
    "classic-message-area",
    "classic-statusbar",
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
  assert.match(shell, /view-status-bar[\s\S]*main-menu-status/);

  const menuContract = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/form-designer-menu.ts")).href}?menu=${Date.now()}`);
  assert.deepEqual(menuContract.FORM_DESIGNER_MENUS.map((menu) => menu.label), ["File", "Edit", "View", "Insert", "Format", "Tools", "Help"]);
  const fileCommands = menuContract.FORM_DESIGNER_MENUS[0].entries.filter((entry) => entry.kind !== "separator").map((entry) => entry.label);
  assert.deepEqual(fileCommands, [
    "New Project...", "New Project from Template...", "New Project from Data Dictionary...", "New Form", "New Page",
    "Open Project...", "Open Project from Web...", "Close Project", "Get Template...", "Print...",
    "Copy Form to Mobile Device...", "Publish Form to Cloud Data Capture...", "Publish Form to Web Survey...",
    "Recent Projects", "Exit", "Project Storage...",
  ]);
  const enterMenuContract = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/enter-data-menu.ts")).href}?menu=${Date.now()}`);
  assert.deepEqual(enterMenuContract.ENTER_DATA_MENUS.map((menu) => menu.label), ["File", "Edit", "View", "Tools", "Help"]);
  const enterFileCommands = enterMenuContract.ENTER_DATA_MENUS[0].entries
    .filter((entry) => entry.kind !== "separator").map((entry) => entry.label);
  assert.deepEqual(enterFileCommands, [
    "New Record", "Open Form...", "Edit Form", "Close Form", "Save", "Import Data", "Package For Transport",
    "Secure Epi Info Share...", "Print...", "Recent Forms", "Exit", "Import Browser Data File...",
  ]);
  const dashboardContract = await import(`${pathToFileURL(repositoryPath("wasm/app/dashboard/dashboard-menu.ts")).href}?menu=${Date.now()}`);
  assert.deepEqual(dashboardContract.DASHBOARD_TOOLBAR.map((entry) => entry.label), ["Refresh", "Set Data Source", "Open", "Save", "Save As"]);
  const addAnalysis = dashboardContract.DASHBOARD_CANVAS_MENU.find((entry) => entry.kind === "submenu" && entry.key === "add-analysis");
  assert.ok(addAnalysis && addAnalysis.kind === "submenu");
  assert.deepEqual(addAnalysis.children.slice(0, 9).map((entry) => entry.label), [
    "Line list", "Rates", "Frequency", "Word cloud", "Combined frequency", "M x N / 2 x 2 Table",
    "Matched pair case-control", "Means", "Duplicates List",
  ]);
  const classicContract = await import(`${pathToFileURL(repositoryPath("wasm/app/analysis/classic-analysis-menu.ts")).href}?menu=${Date.now()}`);
  assert.deepEqual(classicContract.CLASSIC_ANALYSIS_MENUS.map((menu) => menu.label), ["File", "View", "Tools", "Help"]);
  assert.deepEqual(classicContract.CLASSIC_COMMAND_GROUPS.map((group) => group.label), [
    "Data", "Variables", "Select/If", "Statistics", "Advanced Statistics", "Output",
    "User-Defined Commands", "User Interaction", "Options", "New Branches — Epi Info AI",
  ]);
  const statistics = classicContract.CLASSIC_COMMAND_GROUPS.find((group) => group.key === "statistics");
  assert.deepEqual(statistics.commands.map((entry) => entry.label), ["List", "Frequencies", "Tables", "Means", "Summarize", "Graph"]);
  const newBranches = classicContract.CLASSIC_COMMAND_GROUPS.find((group) => group.key === "new-branches");
  assert.deepEqual(newBranches.commands.map((entry) => [entry.label, entry.newBranch]), [["Quality Profile", true], ["Convert Access Database", true]]);
  const programSurface = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-program-surface.ts")).href}?menu=${Date.now()}`);
  assert.deepEqual(programSurface.CLASSIC_PROGRAM_MENUS.map((menu) => menu.label), ["File", "Edit", "Fonts"]);
  assert.equal(programSurface.CLASSIC_PROGRAM_MENUS[2].entries.find((entry) => entry.kind === "command" && entry.key === "editor-font").disposition, "implemented");
  assert.deepEqual(programSurface.CLASSIC_PROGRAM_MENUS[0].entries.filter((entry) => entry.kind === "command").map((entry) => entry.label), [
    "New...", "Open Pgm...", "Save Pgm", "Save Pgm As...", "Print...", "Page Setup...",
  ]);
  assert.deepEqual(programSurface.CLASSIC_PROGRAM_TOOLBAR.map((entry) => entry.label), ["New Pgm", "Open Pgm", "Save Pgm", "Print...", "Run Commands", "Cancel"]);
  assert.equal(programSurface.CLASSIC_PROGRAM_MENUS[0].entries.find((entry) => entry.kind === "command" && entry.key === "print").disposition, "implemented");
  assert.equal(programSurface.CLASSIC_PROGRAM_MENUS[0].entries.find((entry) => entry.kind === "command" && entry.key === "page-setup").disposition, "legacy-gap");
  assert.deepEqual(programSurface.CLASSIC_OUTPUT_TOOLBAR.filter((entry) => entry.kind === "command").map((entry) => entry.label), [
    "Previous", "Next", "Last", "History", "Open", "Bookmark", "Print", "Maximize", "Clear Output",
  ]);
  const programDocuments = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-program-document.ts")).href}?document=${Date.now()}`);
  assert.equal(programDocuments.normalizeClassicProgramName(" Statistics.pgm7 "), "Statistics");
  assert.equal(programDocuments.normalizeClassicProgramName(" Foodborne Check.pgm "), "Foodborne Check");
  assert.equal(programDocuments.safeClassicProgramFileName("Foodborne Check"), "Foodborne-Check.pgm7");
  assert.throws(() => programDocuments.normalizeClassicProgramName("bad/name"), /file-path characters/);
  const commandParity = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-command-parity.ts")).href}?parity=${Date.now()}`);
  assert.equal(commandParity.CLASSIC_COMMAND_PARITY.length, 49);
  assert.equal(new Set(commandParity.CLASSIC_COMMAND_PARITY.map((entry) => entry.id)).size, 49);
  assert.deepEqual(Object.fromEntries([...new Set(commandParity.CLASSIC_COMMAND_PARITY.map((entry) => entry.group))].map((group) => [
    group, commandParity.CLASSIC_COMMAND_PARITY.filter((entry) => entry.group === group).length,
  ])), { data: 7, variables: 6, "select-if": 5, statistics: 8, "advanced-statistics": 7, output: 7, "user-defined": 4, "user-interaction": 4, options: 1 });
  assert.deepEqual(commandParity.CLASSIC_COMMAND_PARITY.filter((entry) => entry.explorer === "legacy-enum-only").map((entry) => entry.legacyName), ["Match", "Map", "Reports", "Help"]);
  const commandSet = await readFile(repositoryPath("COMMAND_SET.md"), "utf8");
  assert.match(commandSet, /Typed AST\/parser branches \| 28 \|/);
  assert.match(commandSet, /Browser-verified using checked-in `\.pgm` and expected output \| 21 \|/);
  assert.match(commandSet, /Legacy-parity-verified against reviewed desktop Epi Info output \| 0 \|/);
  for (const entry of commandParity.CLASSIC_COMMAND_PARITY) {
    assert.ok(["not-started", "browser-verified", "legacy-parity-verified"].includes(entry.parityStatus), `${entry.id} must declare parity status`);
    if (entry.parityStatus !== "not-started") {
      assert.ok(entry.validationProgram && entry.expectedOutput, `${entry.id} verified status requires a PGM and expected output`);
      await assertFile(entry.validationProgram);
      await assertFile(entry.expectedOutput);
    }
    if (entry.parityStatus === "legacy-parity-verified") {
      assert.ok(entry.legacyOutput, `${entry.id} legacy parity requires captured legacy output`);
      await assertFile(entry.legacyOutput);
    }
  }
  for (const group of classicContract.CLASSIC_COMMAND_GROUPS) {
    for (const entry of group.commands) {
      if (entry.newBranch) {
        assert.equal(commandParity.classicCommandParityEntry(group.key, entry.key), undefined, `${group.key}/${entry.key} must not be misrepresented as legacy parity`);
      } else {
        assert.equal(commandParity.classicCommandParityEntry(group.key, entry.key)?.explorer, "visible", `${group.key}/${entry.key} must be in the legacy command parity set`);
      }
    }
  }
  assert.equal(commandParity.classicCommandParityEntry("data", "read").selectedExecution, "executes-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("data", "relate").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("data", "delete-file-table").selectedExecution, "review-required-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("data", "delete-records").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("data", "undelete-records").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("statistics", "summarize").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("statistics", "graph").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("statistics", "tables").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("statistics", "list").selectedExecution, "executes-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("variables", "define").dialog, "typed-source-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("variables", "recode").dialog, "typed-source-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("variables", "define").selectedExecution, "executes-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("variables", "define-group").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("variables", "undefine").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("variables", "display").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("variables", "assign").selectedExecution, "executes-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("select-if", "select").selectedExecution, "executes-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("select-if", "cancel-select").dialog, "typed-source-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("select-if", "sort").selectedExecution, "executes-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("select-if", "cancel-sort").dialog, "typed-source-v0.1");
  assert.equal(commandParity.classicCommandParityEntry("select-if", "if").parityStatus, "browser-verified");
  assert.equal(commandParity.classicCommandParityEntry("user-defined", "execute-file").browserPolicy, "blocked");

  const chartInventory = await readFile(repositoryPath("wasm/docs/design/charts-compatibility-inventory.md"), "utf8");
  assert.deepEqual([...chartInventory.matchAll(/\| LEGACY-CLASSIC-GRAPH-\d{3} \| ([^|]+) \|/g)].map((match) => match[1].trim()), [
    "Area", "Bar", "Bubble", "Column", "Epi Curve", "Line", "Pie", "Scatter",
  ]);
  assert.deepEqual([...chartInventory.matchAll(/\| LEGACY-DASHBOARD-02[1-8] \| ([^|]+) \|/g)].map((match) => match[1].trim()), [
    "Column chart", "Line chart", "Area chart", "Pie chart", "Aberration Detection chart", "Pareto chart", "Scatter chart", "Epi Curve chart",
  ]);
  assert.match(chartInventory, /16 independently tracked\s+chart branches/);
  assert.match(chartInventory, /0 of 8 legacy-parity-verified/);

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
  const { deriveFrequency, deriveMeans, deriveStratifiedFrequency } = await importEngineWithFileFetch();
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
  const source = `DEFINE AgeGroup TEXTINPUT "Age group"
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
  assert.equal(plan.astVersion, "1.0.0");
  assert.equal(plan.recode.sourceField, "age");
  assert.equal(plan.recode.targetPrompt, "Age group");
  assert.equal(plan.frequency.prompt, "Age group");
  assert.equal(plan.frequency.stratifyBy, "sex");
  assert.equal(plan.frequency.stratifyPrompt, "Sex");
  assert.match(plan.canonicalSource, /^DEFINE AgeGroup TEXTINPUT "Age group"/);
  assert.match(plan.canonicalSource, /FREQ AgeGroup STRATAVAR=sex$/);
  const applied = programming.applyBoundedClassicProgram(imported.records, plan);
  assert.deepEqual(applied.derivedField, { name: "AgeGroup", prompt: "Age group", type: "text", required: false });
  const grouped = deriveStratifiedFrequency(applied.records, {
    field: plan.frequency.field, prompt: plan.frequency.prompt, includeMissing: false,
    stratifyBy: plan.frequency.stratifyBy, stratifyPrompt: plan.frequency.stratifyPrompt,
  });
  assert.deepEqual(grouped.strata.flatMap((stratum) => stratum.result.categories.map((category) =>
    [stratum.value, category.value, category.frequency])), [
    ["Female", "18-44", 20], ["Female", "45-64", 13], ["Female", "5-17", 5], ["Female", "65+", 10],
    ["Male", "18-44", 26], ["Male", "45-64", 16], ["Male", "5-17", 5], ["Male", "65+", 1],
  ]);
  assert.throws(() => programming.parseBoundedClassicProgram(`${source}\nEXECUTE "malware.exe"`, imported.schema.fields), /Unsupported command/);
  assert.throws(() => programming.parseBoundedClassicProgram(source.replace("Age TO", "Sex TO"), imported.schema.fields), /must be a Number field/);
  const identifierFallback = programming.parseBoundedClassicProgram(source.replace(' TEXTINPUT "Age group"', " TEXTINPUT"), imported.schema.fields);
  assert.equal(identifierFallback.frequency.prompt, "AgeGroup", "a missing DEFINE prompt must use the exact variable identifier, not an invented label");

  const commandBuilder = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-command-builder.ts")).href}?commands=${Date.now()}`);
  const projectSource = { formId: "foodborne", projectName: "Outbreak Project", formName: "Foodborne Form", fields: imported.schema.fields, records: imported.records };

  const readExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.expected.json",
  ), "utf8"));
  const readProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.pgm",
  ), "utf8");
  const readSource = { ...projectSource, formName: readExpected.expected.activeForm };
  const readPlan = commandBuilder.resolveSelectedClassicAnalysisCommand(readProgram, projectSource.fields, [readSource]);
  assert.deepEqual(readPlan, { kind: "read", table: readExpected.expected.activeForm, source: readProgram });
  assert.equal(readSource.records.length, readExpected.expected.activeRecords);
  assert.equal(readSource.fields.length, readExpected.expected.activeFields);
  assert.equal(readExpected.dataset.sha256, fixture.dataset.sha256);

  const listExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-list-core-fields.expected.json",
  ), "utf8"));
  const listProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-list-core-fields.pgm",
  ), "utf8");
  const listPlan = commandBuilder.resolveSelectedClassicAnalysisCommand(listProgram, projectSource.fields);
  assert.equal(listPlan.kind, "list");
  assert.equal(listExpected.dataset.sha256, fixture.dataset.sha256);
  assert.deepEqual(listPlan.fields, listExpected.expected.fields);
  const listRows = projectSource.records.map((record) => Object.fromEntries(
    listPlan.fields.map((field) => [field, record[field]]),
  ));
  assert.equal(listRows.length, listExpected.expected.recordCount);
  assert.equal(createHash("sha256").update(JSON.stringify(listRows)).digest("hex"), listExpected.expected.rowsSha256);
  assert.deepEqual(listRows.slice(0, 3), listExpected.expected.firstRows);
  assert.deepEqual(listRows.slice(-3), listExpected.expected.lastRows);

  const frequencyExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-frequency-case-status.expected.json",
  ), "utf8"));
  const frequencyProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-frequency-case-status.pgm",
  ), "utf8");
  const frequencyPlan = commandBuilder.resolveSelectedClassicAnalysisCommand(frequencyProgram, projectSource.fields);
  assert.equal(frequencyPlan.kind, "frequency");
  const frequencyField = projectSource.fields.find(({ name }) => name === frequencyPlan.field);
  assert.ok(frequencyField);
  const frequencyResult = deriveFrequency(projectSource.records, {
    field: frequencyPlan.field, prompt: frequencyField.prompt, includeMissing: false,
  });
  assert.equal(frequencyResult.command, frequencyExpected.command);
  assert.deepEqual(frequencyResult.totals, {
    sourceRecords: frequencyExpected.expected.sourceRecords,
    includedRecords: frequencyExpected.expected.includedRecords,
    excludedMissing: frequencyExpected.expected.excludedMissing,
    categoryCount: frequencyExpected.expected.categoryCount,
  });
  assert.deepEqual(frequencyResult.categories.map(({ value, frequency }) => ({ value, frequency })), frequencyExpected.expected.categories);

  const meansExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-means-age.expected.json",
  ), "utf8"));
  const meansProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-means-age.pgm",
  ), "utf8");
  const meansPlan = commandBuilder.resolveSelectedClassicAnalysisCommand(meansProgram, projectSource.fields);
  assert.equal(meansPlan.kind, "means");
  const meansField = projectSource.fields.find(({ name }) => name === meansPlan.field);
  assert.ok(meansField);
  const meansResult = deriveMeans(projectSource.records, { field: meansPlan.field, prompt: meansField.prompt });
  assert.equal(meansResult.command, meansExpected.command);
  assert.deepEqual(meansResult.totals, {
    sourceRecords: meansExpected.expected.sourceRecords,
    includedRecords: meansExpected.expected.includedRecords,
    excludedMissingOrNonNumeric: meansExpected.expected.excludedMissingOrNonNumeric,
  });
  for (const [name, expected] of Object.entries(meansExpected.expected.statistics)) {
    near(meansResult.statistics[name], expected, 1e-12, `PGM MEANS Age ${name}`);
  }

  const tablesExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status.expected.json",
  ), "utf8"));
  const tablesProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status.pgm",
  ), "utf8");
  const tablesCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(tablesProgram, projectSource.fields);
  assert.equal(tablesCommand.kind, "tables");
  const tables = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-tables.ts")).href}?tables=${Date.now()}`);
  const tablesPlan = tables.resolveClassicTablesPlan(tablesProgram, projectSource.fields, tablesCommand.exposure, tablesCommand.outcome, tablesCommand.stratifyBy);
  const tablesResult = tables.applyClassicTables(projectSource.records, tablesPlan);
  assert.equal(tablesPlan.version, "classic-tables-v0.11.0");
  assert.equal(tablesResult.operation, tablesExpected.operation);
  for (const property of ["sourceRecords", "includedRecords", "excludedMissing", "exposureValues", "outcomeValues", "strata"]) {
    assert.deepEqual(tablesResult[property], tablesExpected[property]);
  }

  const unstratifiedTablesExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status-unstratified.expected.json",
  ), "utf8"));
  const unstratifiedTablesProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status-unstratified.pgm",
  ), "utf8");
  const unstratifiedTablesCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(unstratifiedTablesProgram, projectSource.fields);
  assert.deepEqual(unstratifiedTablesCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "case_status", source: unstratifiedTablesProgram,
  });
  const unstratifiedTablesPlan = tables.resolveClassicTablesPlan(
    unstratifiedTablesProgram, projectSource.fields, unstratifiedTablesCommand.exposure, unstratifiedTablesCommand.outcome,
  );
  assert.equal(unstratifiedTablesPlan.canonicalSource, "TABLES potato_salad case_status");
  const unstratifiedTablesResult = tables.applyClassicTables(projectSource.records, unstratifiedTablesPlan);
  for (const property of ["sourceRecords", "includedRecords", "excludedMissing", "exposureValues", "outcomeValues", "strata"]) {
    assert.deepEqual(unstratifiedTablesResult[property], unstratifiedTablesExpected[property]);
  }
  assert.throws(
    () => tables.resolveClassicTablesPlan("TABLES Sex Sex", projectSource.fields, "Sex", "Sex"),
    /exposure and outcome must use different fields/,
  );

  const groupTablesExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar.expected.json",
  ), "utf8"));
  const groupModule = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-group.ts")).href}?tablesGroup=${Date.now()}`);
  const groupDefinition = groupModule.resolveClassicDefineGroupCommand(
    `DEFINE ${groupTablesExpected.group.name} GROUPVAR ${groupTablesExpected.group.members.join(" ")}`,
    projectSource.fields, [], [],
  );
  const groupTablesCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(
    groupTablesExpected.command, projectSource.fields, [], [], [groupDefinition],
  );
  assert.equal(groupTablesCommand.kind, "tables");
  assert.equal(groupTablesCommand.exposure, groupTablesExpected.group.name);
  assert.deepEqual(groupTablesCommand.exposures, groupTablesExpected.group.members);
  assert.equal(commandBuilder.CLASSIC_TABLES_EXPANSION_PLAN_VERSION, groupTablesExpected.expansionPlanVersion);
  const groupTablesResults = groupTablesCommand.exposures.map((exposure) => {
    const plan = tables.resolveClassicTablesPlan(groupTablesExpected.command, projectSource.fields, exposure, groupTablesCommand.outcome);
    const result = tables.applyClassicTables(projectSource.records, plan);
    return {
      exposure,
      includedRecords: result.includedRecords,
      excludedMissing: result.excludedMissing,
      cells: result.strata[0].rows.map(({ counts }) => counts),
      pearsonChiSquare: result.strata[0].pearson.chiSquare,
    };
  });
  for (const [index, expected] of groupTablesExpected.expected.entries()) {
    assert.deepEqual({ ...groupTablesResults[index], pearsonChiSquare: undefined }, { ...expected, pearsonChiSquare: undefined });
    near(groupTablesResults[index].pearsonChiSquare, expected.pearsonChiSquare, 1e-12, `TABLES GROUPVAR ${expected.exposure} Pearson`);
  }
  const wildcardTables = commandBuilder.resolveSelectedClassicAnalysisCommand("TABLES * case_status", projectSource.fields);
  assert.equal(wildcardTables.kind, "tables");
  assert.equal(wildcardTables.exposure, "*");
  assert.ok(wildcardTables.exposures.length > 1);
  assert.equal(wildcardTables.exposures.includes("case_status"), false);
  assert.throws(
    () => commandBuilder.resolveSelectedClassicAnalysisCommand("TABLES FoodExposures case_status", projectSource.fields, [], [], [{ name: "FoodExposures", members: ["potato_salad", "case_status"] }]),
    /cannot be both a TABLES exposure and its outcome/,
  );

  const twoByTwoExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-two-by-two.expected.json",
  ), "utf8"));
  const twoByTwoProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-two-by-two.pgm",
  ), "utf8");
  const twoByTwoCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(twoByTwoProgram, projectSource.fields);
  assert.equal(twoByTwoCommand.kind, "tables");
  const twoByTwoPlan = tables.resolveClassicTablesPlan(twoByTwoProgram, projectSource.fields, twoByTwoCommand.exposure, twoByTwoCommand.outcome);
  const twoByTwoResult = tables.applyClassicTables(projectSource.records, twoByTwoPlan);
  for (const property of ["sourceRecords", "includedRecords", "excludedMissing", "exposureValues", "outcomeValues", "strata"]) {
    assert.deepEqual(twoByTwoResult[property], twoByTwoExpected[property]);
  }
  const { calculateTable2x2 } = await importEngineWithFileFetch();
  const twoByTwoKernelResult = calculateTable2x2(twoByTwoResult.strata[0].twoByTwo.input);
  near(twoByTwoKernelResult.estimates.oddsRatio.estimate, twoByTwoExpected.kernelAnchors.oddsRatio, 1e-12, "TABLES 2x2 OR");
  near(twoByTwoKernelResult.estimates.riskRatio.estimate, twoByTwoExpected.kernelAnchors.riskRatio, 1e-12, "TABLES 2x2 RR");
  near(twoByTwoKernelResult.estimates.riskDifference.estimate, twoByTwoExpected.kernelAnchors.riskDifference, 1e-12, "TABLES 2x2 RD");
  near(twoByTwoKernelResult.tests.pearson.value, twoByTwoExpected.kernelAnchors.pearsonChiSquare, 1e-12, "TABLES 2x2 Pearson");

  const fisherProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher.pgm",
  ), "utf8");
  const fisherCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(fisherProgram, projectSource.fields);
  assert.deepEqual(fisherCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "case_status", statistics: "FISHER", source: fisherProgram,
  });
  const fisherPlan = tables.resolveClassicTablesPlan(
    fisherProgram, projectSource.fields, fisherCommand.exposure, fisherCommand.outcome, fisherCommand.stratifyBy, fisherCommand.statistics,
  );
  const fisherResult = tables.applyClassicTables(projectSource.records, fisherPlan).strata[0].fisherExact;
  assert.equal(fisherPlan.canonicalSource, "TABLES potato_salad case_status STATISTICS=FISHER");
  assert.equal(fisherResult.state, "computed");
  assert.equal(fisherResult.tablesEnumerated, 2737);
  near(fisherResult.pValue, 5.552362909835065e-14, 1e-25, "TABLES Fisher-Freeman-Halton p-value");
  const boundedFisher = tables.calculateBoundedFisherExact([[0, 40, 2, 6], [22, 12, 14, 0]], 10);
  assert.equal(boundedFisher.state, "unavailable");
  assert.match(boundedFisher.reason, /10-table browser limit/);

  const multipleStrataProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-multiple-strata.pgm",
  ), "utf8");
  const multipleStrataExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-multiple-strata.expected.json",
  ), "utf8"));
  const multipleStrataCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(multipleStrataProgram, projectSource.fields);
  assert.deepEqual(multipleStrataCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "hamburger", stratifyBy: ["sex", "case_status"], source: multipleStrataProgram,
  });
  const multipleStrataPlan = tables.resolveClassicTablesPlan(
    multipleStrataProgram, projectSource.fields, multipleStrataCommand.exposure, multipleStrataCommand.outcome, multipleStrataCommand.stratifyBy,
  );
  const multipleStrataResult = tables.applyClassicTables(projectSource.records, multipleStrataPlan);
  assert.equal(multipleStrataResult.planVersion, multipleStrataExpected.planVersion);
  assert.equal(multipleStrataResult.canonicalSource, multipleStrataExpected.canonicalSource);
  assert.equal(multipleStrataResult.sourceRecords, multipleStrataExpected.sourceRecords);
  assert.equal(multipleStrataResult.includedRecords, multipleStrataExpected.includedRecords);
  assert.equal(multipleStrataResult.excludedMissing, multipleStrataExpected.excludedMissing);
  assert.deepEqual(multipleStrataResult.strata.map(({ value, total, rows }) => ({
    value, total, cells: rows.map(({ counts }) => counts),
  })), multipleStrataExpected.strata);

  const adjustedTablesProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-stratified-two-by-two.pgm",
  ), "utf8");
  const adjustedTablesExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-stratified-two-by-two.expected.json",
  ), "utf8"));
  const adjustedTablesCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(adjustedTablesProgram, projectSource.fields);
  assert.deepEqual(adjustedTablesCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "hamburger", stratifyBy: ["sex"], source: adjustedTablesProgram,
  });
  const adjustedTablesPlan = tables.resolveClassicTablesPlan(
    adjustedTablesProgram, projectSource.fields, adjustedTablesCommand.exposure, adjustedTablesCommand.outcome, adjustedTablesCommand.stratifyBy,
  );
  const adjustedTablesCategorical = tables.applyClassicTables(projectSource.records, adjustedTablesPlan);
  const adjustedTablesInput = tables.classicTablesStratified2x2Input(adjustedTablesCategorical);
  assert.ok(adjustedTablesInput);
  assert.deepEqual(adjustedTablesInput.strata.map(({ label, exposedCases, exposedNonCases, unexposedCases, unexposedNonCases }) => ({
    value: label, cells: [[exposedCases, exposedNonCases], [unexposedCases, unexposedNonCases]],
  })), adjustedTablesExpected.strata.map(({ value, cells }) => ({ value, cells })));
  const { calculateStratifiedTable2x2 } = await importEngineWithFileFetch();
  const adjustedTablesResult = calculateStratifiedTable2x2(adjustedTablesInput);
  const adjustedExpected = adjustedTablesExpected.adjusted;
  near(adjustedTablesResult.estimates.adjustedOddsRatio.estimate, adjustedExpected.adjustedOddsRatio, adjustedTablesExpected.tolerance, "TABLES stratified MH OR");
  near(adjustedTablesResult.estimates.adjustedOddsRatio.confidenceInterval.lower, adjustedExpected.adjustedOddsRatioLower, adjustedTablesExpected.tolerance, "TABLES stratified MH OR lower");
  near(adjustedTablesResult.estimates.adjustedOddsRatio.confidenceInterval.upper, adjustedExpected.adjustedOddsRatioUpper, adjustedTablesExpected.tolerance, "TABLES stratified MH OR upper");
  near(adjustedTablesResult.estimates.adjustedRiskRatio.estimate, adjustedExpected.adjustedRiskRatio, adjustedTablesExpected.tolerance, "TABLES stratified MH RR");
  near(adjustedTablesResult.estimates.adjustedRiskRatio.confidenceInterval.lower, adjustedExpected.adjustedRiskRatioLower, adjustedTablesExpected.tolerance, "TABLES stratified MH RR lower");
  near(adjustedTablesResult.estimates.adjustedRiskRatio.confidenceInterval.upper, adjustedExpected.adjustedRiskRatioUpper, adjustedTablesExpected.tolerance, "TABLES stratified MH RR upper");
  near(adjustedTablesResult.estimates.adjustedConditionalOddsRatio.estimate.value, adjustedExpected.conditionalOddsRatio, adjustedTablesExpected.tolerance, "TABLES stratified conditional OR");
  near(adjustedTablesResult.tests.mantelHaenszelUncorrected.value, adjustedExpected.mantelHaenszelUncorrected, adjustedTablesExpected.tolerance, "TABLES stratified MH chi-square");
  near(adjustedTablesResult.tests.breslowDayTaroneOddsRatio.value, adjustedExpected.breslowDayTaroneOddsRatio, adjustedTablesExpected.tolerance, "TABLES stratified Breslow-Day-Tarone");
  assert.equal(adjustedTablesResult.diagnostics.informativeStrata, adjustedExpected.informativeStrata);
  assert.equal(tables.classicTablesStratified2x2Input(twoByTwoResult), null, "unstratified 2 x 2 must not claim adjustment");
  assert.equal(tables.classicTablesStratified2x2Input(tablesResult), null, "M x N strata must not infer exposed/case classifications");

  const classicAst = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-ast.ts")).href}?missing=${Date.now()}`);
  const missingSettings = classicAst.parseClassicProgram("SET (.)=\"Not recorded\"\nSET MISSING=ON\nTABLES vomiting Sex\nSET MISSING=OFF\nSET (.)=\"Missing\"");
  assert.deepEqual(missingSettings.body.map(({ type }) => type), ["SetStatement", "SetStatement", "TablesStatement", "SetStatement", "SetStatement"]);
  assert.deepEqual(missingSettings.body.filter(({ type, option }) => type === "SetStatement" && option === "MISSING").map(({ enabled }) => enabled), [true, false]);
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("SET MISSING=(+)", projectSource.fields), {
    kind: "set-missing", enabled: true, source: "SET MISSING=(+)",
  });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('SET (.)="Not recorded"', projectSource.fields), {
    kind: "set-missing-label", value: "Not recorded", source: 'SET (.)="Not recorded"',
  });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("SET IGNORE=OFF", projectSource.fields), {
    kind: "set-missing", enabled: true, source: "SET IGNORE=OFF",
  });
  const missingPlan = tables.resolveClassicTablesPlan("TABLES vomiting Sex", projectSource.fields, "vomiting", "sex", undefined, undefined, undefined, true, "Not recorded");
  const missingResult = tables.applyClassicTables(projectSource.records, missingPlan);
  const missingExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-missing.expected.json",
  ), "utf8"));
  assert.equal(missingResult.includedRecords, missingExpected.expected.includedRecords);
  assert.equal(missingResult.excludedMissing, missingExpected.expected.excludedMissing);
  assert.equal(missingResult.includedMissing, missingExpected.expected.includedMissing);
  assert.deepEqual(missingResult.strata[0].rows.find(({ exposureValue }) => exposureValue === "Not recorded").counts, missingExpected.expected.missingExposureCounts);
  assert.equal(missingResult.strata[0].rows.find(({ exposureValue }) => exposureValue === "Not recorded").total, missingExpected.expected.missingExposureTotal);
  const excludedMissingPlan = tables.resolveClassicTablesPlan("TABLES vomiting Sex", projectSource.fields, "vomiting", "sex");
  const excludedMissingResult = tables.applyClassicTables(projectSource.records, excludedMissingPlan);
  assert.equal(excludedMissingResult.includedRecords, 94);
  assert.equal(excludedMissingResult.excludedMissing, 2);
  assert.equal(excludedMissingResult.includedMissing, 0);

  const weightedTablesProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-weighted.pgm",
  ), "utf8");
  const weightedTablesExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-weighted.expected.json",
  ), "utf8"));
  const weightedTablesCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(weightedTablesProgram, projectSource.fields);
  assert.deepEqual(weightedTablesCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "case_status", weightBy: "age", source: weightedTablesProgram,
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand(weightedTablesCommand), "TABLES potato_salad case_status WEIGHTVAR=age");
  const weightedTablesPlan = tables.resolveClassicTablesPlan(
    weightedTablesProgram, projectSource.fields, weightedTablesCommand.exposure, weightedTablesCommand.outcome,
    weightedTablesCommand.stratifyBy, weightedTablesCommand.statistics, weightedTablesCommand.weightBy,
  );
  const weightedTablesResult = tables.applyClassicTables(projectSource.records, weightedTablesPlan);
  assert.equal(weightedTablesPlan.canonicalSource, weightedTablesExpected.canonicalSource);
  assert.equal(weightedTablesResult.weightedTotal, weightedTablesExpected.weightedTotal);
  assert.equal(weightedTablesResult.excludedInvalidWeight, 0);
  assert.equal(weightedTablesResult.zeroWeightRecords, 0);
  assert.deepEqual(weightedTablesResult.strata[0].rows.map(({ exposureValue, counts, total }) => ({ exposureValue, counts, total })), weightedTablesExpected.rows);
  assert.equal(weightedTablesResult.strata[0].twoByTwo, undefined);
  assert.equal(tables.classicTablesStratified2x2Input(weightedTablesResult), null);
  assert.throws(
    () => commandBuilder.resolveSelectedClassicAnalysisCommand("TABLES potato_salad case_status WEIGHTVAR=Sex", projectSource.fields),
    /must be a Number field/,
  );
  assert.throws(
    () => commandBuilder.resolveSelectedClassicAnalysisCommand("TABLES potato_salad case_status WEIGHTVAR=Age STATISTICS=FISHER", projectSource.fields),
    /not available with WEIGHTVAR/,
  );
  const invalidWeightPlan = tables.resolveClassicTablesPlan("TABLES exposure outcome WEIGHTVAR=weight", [
    { name: "exposure", prompt: "Exposure", type: "yes-no", required: false },
    { name: "outcome", prompt: "Outcome", type: "yes-no", required: false },
    { name: "weight", prompt: "Weight", type: "number", required: false },
  ], "exposure", "outcome", undefined, undefined, "weight");
  const invalidWeightResult = tables.applyClassicTables([
    { exposure: "Yes", outcome: "Yes", weight: 1.5 },
    { exposure: "Yes", outcome: "No", weight: 0 },
    { exposure: "No", outcome: "Yes", weight: -1 },
    { exposure: "No", outcome: "No", weight: null },
  ], invalidWeightPlan);
  assert.equal(invalidWeightResult.includedRecords, 2);
  assert.equal(invalidWeightResult.weightedTotal, 1.5);
  assert.equal(invalidWeightResult.zeroWeightRecords, 1);
  assert.equal(invalidWeightResult.excludedInvalidWeight, 2);

  const complexTablesProgram = await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar.pgm",
  ), "utf8");
  const complexTablesExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar.expected.json",
  ), "utf8"));
  const complexTablesCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(complexTablesProgram, projectSource.fields);
  assert.deepEqual(complexTablesCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "hamburger", stratifyBy: ["sex"],
    weightBy: "age", psuBy: "household_neighborhood", source: complexTablesProgram,
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand(complexTablesCommand), complexTablesExpected.canonicalSource);
  const complexTables = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-complex-tables.ts")).href}?complexTables=${Date.now()}`);
  const complexPlan = complexTables.resolveClassicComplexTablesPlan(
    complexTablesProgram, projectSource.fields, complexTablesCommand.exposure, complexTablesCommand.outcome,
    complexTablesCommand.stratifyBy, complexTablesCommand.weightBy, complexTablesCommand.psuBy,
  );
  const complexResult = complexTables.applyClassicComplexTables(projectSource.records, complexPlan);
  assert.equal(complexPlan.version, complexTablesExpected.planVersion);
  assert.equal(complexPlan.canonicalSource, complexTablesExpected.canonicalSource);
  for (const property of ["includedRecords", "excludedRecords", "weightedTotal", "designStrata", "primarySamplingUnits", "degreesOfFreedom", "exposureValues", "outcomeValues"]) {
    assert.deepEqual(complexResult[property], complexTablesExpected.expected[property], `PSUVAR ${property}`);
  }
  near(complexResult.confidenceMultiplier, complexTablesExpected.expected.confidenceMultiplier, 1e-12, "PSUVAR legacy t multiplier");
  for (const [rowIndex, expectedRow] of complexTablesExpected.expected.rows.entries()) {
    const actualRow = complexResult.rows[rowIndex];
    assert.equal(actualRow.exposureValue, expectedRow.exposureValue);
    near(actualRow.weightedTotal, expectedRow.weightedTotal, 1e-12, `PSUVAR row ${rowIndex + 1} total`);
    for (const [cellIndex, expectedCell] of expectedRow.cells.entries()) {
      const actualCell = actualRow.cells[cellIndex];
      assert.equal(actualCell.outcomeValue, expectedCell.outcomeValue);
      assert.equal(actualCell.count, expectedCell.count);
      for (const property of ["weightedCount", "rowPercent", "columnPercent", "standardError", "lowerConfidenceLimit", "upperConfidenceLimit", "designEffect"]) {
        near(actualCell[property], expectedCell[property], 1e-10, `PSUVAR row ${rowIndex + 1} cell ${cellIndex + 1} ${property}`);
      }
    }
  }
  for (const property of ["oddsRatio", "oddsRatioStandardError", "oddsRatioLower", "oddsRatioUpper", "riskRatio", "riskRatioStandardError", "riskRatioLower", "riskRatioUpper", "riskDifferencePercent", "riskDifferenceStandardError", "riskDifferenceLower", "riskDifferenceUpper"]) {
    near(complexResult.risk[property], complexTablesExpected.expected.risk[property], 1e-10, `PSUVAR ${property}`);
  }
  assert.throws(
    () => complexTables.resolveClassicComplexTablesPlan("TABLES potato_salad hamburger STRATAVAR=Sex case_status PSUVAR=household_neighborhood", projectSource.fields, "potato_salad", "hamburger", ["sex", "case_status"], undefined, "household_neighborhood"),
    /single STRATAVAR design stratum/,
  );
  const complexOutTableExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar-outtable.expected.json",
  ), "utf8"));
  const complexOutTableCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(complexOutTableExpected.command, projectSource.fields);
  assert.deepEqual(complexOutTableCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "hamburger", stratifyBy: ["sex"], weightBy: "age",
    psuBy: "household_neighborhood", outputTable: "PotatoHamburgerSurvey", source: complexOutTableExpected.command,
  });
  const complexOutTablePlan = complexTables.resolveClassicComplexTablesPlan(
    complexOutTableExpected.command, projectSource.fields, complexOutTableCommand.exposure, complexOutTableCommand.outcome,
    complexOutTableCommand.stratifyBy, complexOutTableCommand.weightBy, complexOutTableCommand.psuBy, complexOutTableCommand.outputTable,
  );
  assert.equal(complexOutTablePlan.canonicalSource, complexOutTableExpected.command);
  const complexOutTableSource = complexTables.classicComplexTablesOutTable(
    projectSource, complexOutTablePlan, complexTables.applyClassicComplexTables(projectSource.records, complexOutTablePlan),
  );
  assert.equal(complexOutTableSource.formName, complexOutTableExpected.outputTable);
  assert.deepEqual(complexOutTableSource.fields.map(({ name }) => name), complexOutTableExpected.fields);
  assert.deepEqual(complexOutTableSource.records, complexOutTableExpected.records);
  assert.throws(
    () => complexTables.applyClassicComplexTables([{ potato_salad: "Yes", hamburger: "Yes", household_neighborhood: "Only" }],
      complexTables.resolveClassicComplexTablesPlan("TABLES potato_salad hamburger PSUVAR=household_neighborhood", projectSource.fields, "potato_salad", "hamburger", undefined, undefined, "household_neighborhood")),
    /at least two complete PSUs/,
  );

  const complexFrequencyProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-frequency-psuvar.pgm"), "utf8");
  const complexFrequencyExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-frequency-psuvar.expected.json"), "utf8"));
  const complexFrequencyCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(complexFrequencyProgram, projectSource.fields);
  assert.deepEqual(complexFrequencyCommand, {
    kind: "frequency", field: "case_status", stratifyBy: "sex", weightBy: "age", psuBy: "household_neighborhood",
    outputTable: "CaseStatusSurvey", source: complexFrequencyProgram,
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand(complexFrequencyCommand), complexFrequencyExpected.canonicalSource);
  const complexFrequency = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-complex-frequency.ts")).href}?complexFrequency=${Date.now()}`);
  const complexFrequencyPlan = complexFrequency.resolveClassicComplexFrequencyPlan(
    complexFrequencyProgram, projectSource.fields, complexFrequencyCommand.field, complexFrequencyCommand.stratifyBy,
    complexFrequencyCommand.weightBy, complexFrequencyCommand.psuBy, complexFrequencyCommand.outputTable,
  );
  const complexFrequencyResult = complexFrequency.applyClassicComplexFrequency(projectSource.records, complexFrequencyPlan);
  assert.equal(complexFrequencyPlan.version, complexFrequencyExpected.planVersion);
  assert.equal(complexFrequencyPlan.canonicalSource, complexFrequencyExpected.canonicalSource);
  for (const property of ["includedRecords", "excludedRecords", "weightedTotal", "designStrata", "primarySamplingUnits", "degreesOfFreedom"]) {
    assert.equal(complexFrequencyResult[property], complexFrequencyExpected.expected[property], `CSF ${property}`);
  }
  near(complexFrequencyResult.confidenceMultiplier, complexFrequencyExpected.expected.confidenceMultiplier, 1e-12, "CSF legacy t multiplier");
  for (const [index, expectedRow] of complexFrequencyExpected.expected.rows.entries()) {
    const actualRow = complexFrequencyResult.rows[index];
    assert.equal(actualRow.value, expectedRow.value);
    assert.equal(actualRow.count, expectedRow.count);
    for (const property of ["weightedCount", "percent", "standardError", "lowerConfidenceLimit", "upperConfidenceLimit", "logitLowerConfidenceLimit", "logitUpperConfidenceLimit", "designEffect"]) {
      near(actualRow[property], expectedRow[property], 1e-10, `CSF row ${index + 1} ${property}`);
    }
  }
  const complexFrequencyOutTable = complexFrequency.classicComplexFrequencyOutTable(projectSource, complexFrequencyPlan, complexFrequencyResult);
  assert.equal(complexFrequencyOutTable.formName, complexFrequencyExpected.outTable.name);
  assert.deepEqual(complexFrequencyOutTable.fields.map(({ name }) => name), complexFrequencyExpected.outTable.fields);
  assert.deepEqual(complexFrequencyOutTable.records.map((record) => record.case_status), complexFrequencyExpected.outTable.categoryOrdinals);
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand("FREQ case_status WEIGHTVAR=age", projectSource.fields), /enabled with the Complex Sample Frequencies PSUVAR path/);
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand("FREQ case_status PSUVAR=case_status", projectSource.fields), /must use different fields/);

  const complexMeansProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar.pgm"), "utf8");
  const complexMeansExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar.expected.json"), "utf8"));
  const complexMeansCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(complexMeansProgram, projectSource.fields);
  assert.deepEqual(complexMeansCommand, { kind: "means", field: "age", crossTabBy: "sex", stratifyBy: "case_status", psuBy: "household_neighborhood", source: complexMeansProgram });
  assert.equal(commandBuilder.buildClassicAnalysisCommand(complexMeansCommand), complexMeansExpected.canonicalSource);
  const complexMeans = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-complex-means.ts")).href}?complexMeans=${Date.now()}`);
  const complexMeansPlan = complexMeans.resolveClassicComplexMeansPlan(complexMeansProgram, projectSource.fields, complexMeansCommand.field, complexMeansCommand.crossTabBy, complexMeansCommand.stratifyBy, complexMeansCommand.weightBy, complexMeansCommand.psuBy);
  const complexMeansResult = complexMeans.applyClassicComplexMeans(projectSource.records, complexMeansPlan);
  for (const property of ["includedRecords", "excludedRecords", "designStrata", "primarySamplingUnits", "degreesOfFreedom"]) assert.equal(complexMeansResult[property], complexMeansExpected.expected[property], `CSMEANS ${property}`);
  near(complexMeansResult.confidenceMultiplier, complexMeansExpected.expected.confidenceMultiplier, 1e-12, "CSMEANS legacy t multiplier");
  for (const [index, expectedRow] of complexMeansExpected.expected.rows.entries()) {
    const actual = complexMeansResult.rows[index]; assert.equal(actual.label, expectedRow.label); assert.equal(actual.count, expectedRow.count);
    for (const property of ["mean", "standardError", "lowerConfidenceLimit", "upperConfidenceLimit", "minimum", "maximum"]) if (expectedRow[property] === null) assert.equal(actual[property], null); else near(actual[property], expectedRow[property], 1e-10, `CSMEANS row ${index + 1} ${property}`);
  }
  const complexMeansOutTableExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar-outtable.expected.json"), "utf8"));
  const complexMeansOutTableCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(complexMeansOutTableExpected.command, projectSource.fields);
  assert.deepEqual(complexMeansOutTableCommand, { kind: "means", field: "age", crossTabBy: "sex", stratifyBy: "case_status", outputTable: "AgeBySexSurvey", psuBy: "household_neighborhood", source: complexMeansOutTableExpected.command });
  assert.equal(commandBuilder.buildClassicAnalysisCommand(complexMeansOutTableCommand), complexMeansOutTableExpected.command);
  const complexMeansOutTablePlan = complexMeans.resolveClassicComplexMeansPlan(complexMeansOutTableExpected.command, projectSource.fields, complexMeansOutTableCommand.field, complexMeansOutTableCommand.crossTabBy, complexMeansOutTableCommand.stratifyBy, complexMeansOutTableCommand.weightBy, complexMeansOutTableCommand.psuBy, complexMeansOutTableCommand.outputTable);
  const complexMeansOutTableResult = complexMeans.applyClassicComplexMeans(projectSource.records, complexMeansOutTablePlan);
  const complexMeansOutTable = complexMeans.classicComplexMeansOutTable(projectSource, complexMeansOutTablePlan, complexMeansOutTableResult);
  assert.equal(complexMeansOutTable.formName, complexMeansOutTableExpected.outputTable);
  assert.deepEqual(complexMeansOutTable.fields.map(({ name }) => name), complexMeansOutTableExpected.fields);
  assert.deepEqual(complexMeansOutTable.records, complexMeansOutTableExpected.records);
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand("MEANS Age OUTTABLE=AgeSurvey", projectSource.fields), /adapted OUTTABLE are enabled with the Complex Sample Means PSUVAR path/);
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand(complexMeansOutTableExpected.command, projectSource.fields, [{ ...projectSource, formName: "agebysexsurvey" }]), /conflicts with an existing project form/);

  const outTableExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-outtable.expected.json",
  ), "utf8"));
  const outTableCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(outTableExpected.command, projectSource.fields);
  assert.deepEqual(outTableCommand, {
    kind: "tables", exposure: "potato_salad", outcome: "case_status", stratifyBy: ["sex"], outputTable: "PotatoStatusBySex", source: outTableExpected.command,
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand(outTableCommand), outTableExpected.command);
  const outTablePlan = tables.resolveClassicTablesPlan(
    outTableExpected.command, projectSource.fields, outTableCommand.exposure, outTableCommand.outcome,
    outTableCommand.stratifyBy, outTableCommand.statistics, outTableCommand.weightBy, false, "Missing", outTableCommand.outputTable,
  );
  const outTableResult = tables.applyClassicTables(projectSource.records, outTablePlan);
  const outTableSource = tables.classicTablesOutTable(projectSource, outTablePlan, outTableResult);
  assert.equal(outTablePlan.version, outTableExpected.planVersion);
  assert.equal(outTablePlan.canonicalSource, outTableExpected.command);
  assert.equal(outTableSource.formName, outTableExpected.outputTable);
  assert.deepEqual(outTableSource.fields.map(({ name }) => name), outTableExpected.fields);
  assert.deepEqual(outTableSource.records, outTableExpected.records);
  const expandedOutTableCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(
    "TABLES FoodExposures case_status OUTTABLE=FoodExposureStatusCounts", projectSource.fields, [], [], [groupDefinition],
  );
  assert.deepEqual(expandedOutTableCommand.exposures, ["potato_salad", "hamburger", "grilled_chicken"]);
  assert.equal(expandedOutTableCommand.outputTable, "FoodExposureStatusCounts");
  const expandedOutTableExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar-outtable.expected.json",
  ), "utf8"));
  const expandedOutTables = expandedOutTableCommand.exposures.map((exposure) => {
    const plan = tables.resolveClassicTablesPlan(expandedOutTableCommand.source, projectSource.fields, exposure, expandedOutTableCommand.outcome, undefined, undefined, undefined, false, "Missing", expandedOutTableCommand.outputTable);
    return tables.classicTablesOutTable(projectSource, plan, tables.applyClassicTables(projectSource.records, plan));
  });
  assert.equal(expandedOutTables.at(-1).formName, expandedOutTableExpected.outputTable);
  assert.deepEqual(expandedOutTables.at(-1).fields.map(({ name }) => name), expandedOutTableExpected.fields);
  assert.deepEqual(expandedOutTables.at(-1).records, expandedOutTableExpected.records);
  const generalExactExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher-rxc.expected.json",
  ), "utf8"));
  const generalExactPlan = tables.resolveClassicTablesPlan(generalExactExpected.command, projectSource.fields, "case_status", "sex", undefined, "FISHER");
  const generalExactResult = tables.applyClassicTables(projectSource.records, generalExactPlan);
  assert.deepEqual(generalExactResult.strata[0].rows.map(({ counts }) => counts), generalExactExpected.cells);
  assert.equal(generalExactResult.strata[0].fisherExact.tablesEnumerated, generalExactExpected.fisher.tablesEnumerated);
  near(generalExactResult.strata[0].fisherExact.pValue, generalExactExpected.fisher.pValue, 1e-14, "TABLES 4 x 2 Fisher-Freeman-Halton p-value");
  const threeByThreeExact = tables.calculateBoundedFisherExact([[2, 0, 0], [0, 2, 0], [0, 0, 2]]);
  assert.equal(threeByThreeExact.state, "computed");
  assert.equal(threeByThreeExact.tablesEnumerated, 21);
  near(threeByThreeExact.pValue, 1 / 15, 1e-14, "TABLES 3 x 3 Fisher-Freeman-Halton p-value");
  const tablesOptionsExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-tables-options.expected.json",
  ), "utf8"));
  const tablesOptionsCommand = commandBuilder.resolveSelectedClassicAnalysisCommand(tablesOptionsExpected.command, projectSource.fields);
  assert.equal(commandBuilder.buildClassicAnalysisCommand(tablesOptionsCommand), tablesOptionsExpected.command);
  assert.deepEqual({
    statistics: tablesOptionsCommand.statistics, oneIsYes: tablesOptionsCommand.oneIsYes,
    noWrap: tablesOptionsCommand.noWrap, columnSize: tablesOptionsCommand.columnSize,
  }, {
    statistics: tablesOptionsExpected.statistics, oneIsYes: tablesOptionsExpected.oneIsYes,
    noWrap: tablesOptionsExpected.noWrap, columnSize: tablesOptionsExpected.columnSize,
  });
  const tablesOptionsPlan = tables.resolveClassicTablesPlan(
    tablesOptionsExpected.command, projectSource.fields, tablesOptionsCommand.exposure, tablesOptionsCommand.outcome,
    undefined, tablesOptionsCommand.statistics, undefined, false, "Missing", undefined,
    tablesOptionsCommand.oneIsYes, tablesOptionsCommand.noWrap, tablesOptionsCommand.columnSize,
  );
  const tablesOptionsResult = tables.applyClassicTables(projectSource.records, tablesOptionsPlan);
  assert.deepEqual(tablesOptionsResult.strata[0].rows.map(({ counts }) => counts), tablesOptionsExpected.cells);
  assert.equal(tablesOptionsResult.strata[0].pearson, null);
  assert.equal(tablesOptionsResult.strata[0].twoByTwo, undefined);
  const numericOneIsYesPlan = tables.resolveClassicTablesPlan("TABLES exposure outcome ONEISYES", [
    { name: "exposure", prompt: "Exposure", type: "number", required: false },
    { name: "outcome", prompt: "Outcome", type: "number", required: false },
  ], "exposure", "outcome", undefined, undefined, undefined, false, "Missing", undefined, true);
  const numericOneIsYes = tables.applyClassicTables([
    { exposure: 0, outcome: 0 }, { exposure: 0, outcome: 1 }, { exposure: 1, outcome: 0 }, { exposure: 1, outcome: 1 },
  ], numericOneIsYesPlan);
  assert.deepEqual(numericOneIsYes.exposureValues, ["1", "0"]);
  assert.deepEqual(numericOneIsYes.outcomeValues, ["1", "0"]);
  assert.throws(
    () => commandBuilder.resolveSelectedClassicAnalysisCommand("TABLES potato_salad case_status OUTTABLE=ExistingOutput", projectSource.fields, [{ ...projectSource, formName: "ExistingOutput" }]),
    /conflicts with an existing project form/,
  );

  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "quality" }), "EPIAI QUALITY *");
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("EPIAI QUALITY *", imported.schema.fields), { kind: "quality", source: "EPIAI QUALITY *" });
  const quality = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/epi-ai-quality.ts")).href}?quality=${Date.now()}`);
  const qualityPlan = quality.resolveEpiAiQualityCommand("EPIAI QUALITY *", imported.schema.fields);
  const qualityReport = quality.applyEpiAiQualityProfile(projectSource, qualityPlan);
  assert.equal(qualityReport.recordCount, 96);
  assert.equal(qualityReport.fields.find(({ fieldName }) => fieldName === "onset_date").missing, 52);
  assert.equal(qualityReport.fields.find(({ fieldName }) => fieldName === "hospitalization_date").missing, 74);
  assert.throws(() => quality.resolveEpiAiQualityCommand("EPIAI QUALITY Age", imported.schema.fields), /QUALITY \* only/);
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "file-convert", inputFile: "Sample.mdb", outputFile: "Sample.sqlite" }), 'FILE CONVERT "Sample.mdb" TO "Sample.sqlite"');
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('FILE CONVERT "Sample.mdb" TO "Sample.sqlite"', imported.schema.fields), {
    kind: "file-convert", inputFile: "Sample.mdb", outputFile: "Sample.sqlite", source: 'FILE CONVERT "Sample.mdb" TO "Sample.sqlite"',
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "file-convert", inputFile: "Sample.mdb", outputFile: "Sample.duckdb" }), 'FILE CONVERT "Sample.mdb" TO "Sample.duckdb"');
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('FILE CONVERT "Sample.mdb" TO "Sample.duckdb"', imported.schema.fields), {
    kind: "file-convert", inputFile: "Sample.mdb", outputFile: "Sample.duckdb", source: 'FILE CONVERT "Sample.mdb" TO "Sample.duckdb"',
  });
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand('FILE CONVERT "Sample.csv" TO "Sample.sqlite"', imported.schema.fields), /mdb or .accdb/);
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "define", variable: "AgeGroup", scope: "STANDARD", variableType: "TEXTINPUT" }), "DEFINE AgeGroup TEXTINPUT");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "define", variable: "CaseCount", scope: "GLOBAL", variableType: "NUMERIC", prompt: "Case count" }), 'DEFINE CaseCount GLOBAL NUMERIC "Case count"');
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "define-group", group: "FoodSymptoms", members: ["diarrhea", "vomiting", "nausea"] }), "DEFINE FoodSymptoms GROUPVAR diarrhea vomiting nausea");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "assign", variable: "ReviewLabel", value: "Priority" }), 'ASSIGN ReviewLabel = "Priority"');
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "undefine", variable: "ReviewLabel" }), "UNDEFINE ReviewLabel");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "undefine", variable: "*" }), "UNDEFINE *");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "display", mode: "defined" }), "DISPLAY DBVARIABLES DEFINE");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "display", mode: "list", variables: ["ReviewLabel", "case_status"] }), "DISPLAY DBVARIABLES LIST ReviewLabel case_status");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({
    kind: "recode", sourceField: "age", targetVariable: "AgeGroup",
    ranges: [{ from: "LOVALUE", to: "17", result: "0-17" }, { from: "17", to: "HIVALUE", result: "18+" }],
  }), 'RECODE age TO AgeGroup\n  LOVALUE - 17 = "0-17"\n  17 - HIVALUE = "18+"\nEND');
  assert.throws(() => commandBuilder.buildClassicAnalysisCommand({ kind: "define", variable: "bad name", scope: "STANDARD", variableType: "TEXTINPUT" }), /Variable names/);
  assert.throws(() => commandBuilder.buildClassicAnalysisCommand({ kind: "recode", sourceField: "age", targetVariable: "AgeGroup", ranges: [] }), /at least one/);
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "read", table: "Foodborne Form" }), "READ [Foodborne Form]");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "relate", relatedForm: "Foodborne Form", keys: [{ currentField: "id", relatedField: "id" }], join: "matching" }), "RELATE [Foodborne Form] id :: id MATCHING");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "list", fields: ["id", "age", "sex"] }), "LIST id age sex");
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("READ [Foodborne Form]", [], [projectSource]), { kind: "read", table: "Foodborne Form", source: "READ [Foodborne Form]" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("RELATE [Foodborne Form] ID :: id ALL", imported.schema.fields, [projectSource]), {
    kind: "relate", relatedForm: "Foodborne Form", keys: [{ currentField: "id", relatedField: "id" }], join: "all", source: "RELATE [Foodborne Form] ID :: id ALL",
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "write", fileName: "foodborne-review.csv", fields: ["id", "age", "sex", "case_status"] }), 'WRITE REPLACE "Text" {foodborne-review.csv}:foodborne_review#csv id age sex case_status');
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('WRITE REPLACE "Text" {foodborne-review.csv}:foodborne_review#csv ID Age Sex Case_Status', imported.schema.fields), {
    kind: "write", fileName: "foodborne-review.csv", fields: ["id", "age", "sex", "case_status"],
    source: 'WRITE REPLACE "Text" {foodborne-review.csv}:foodborne_review#csv ID Age Sex Case_Status',
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "merge", sourceForm: "Foodborne Form", keys: [{ currentField: "id", sourceField: "id" }] }), "MERGE [Foodborne Form] id :: id");
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("MERGE [Foodborne Form] ID :: id", imported.schema.fields, [projectSource]), {
    kind: "merge", sourceForm: "Foodborne Form", keys: [{ currentField: "id", sourceField: "id" }], source: "MERGE [Foodborne Form] ID :: id",
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "delete-table", formName: "Foodborne Form" }), "DELETE TABLES [Foodborne Form]");
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("DELETE TABLES [Foodborne Form]", imported.schema.fields, [projectSource]), {
    kind: "delete-table", formName: "Foodborne Form", source: "DELETE TABLES [Foodborne Form]",
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "delete-records", all: false, field: "case_status", operator: "=", value: "Confirmed" }), 'DELETE (case_status = "Confirmed")');
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('DELETE (Case_Status = "Confirmed")', imported.schema.fields, [projectSource]), {
    kind: "delete-records", all: false, field: "case_status", operator: "=", value: "Confirmed", source: 'DELETE (Case_Status = "Confirmed")',
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "undelete-records", all: false, field: "case_status", operator: "=", value: "Confirmed" }), 'UNDELETE (case_status = "Confirmed")');
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('UNDELETE (Case_Status = "Confirmed")', imported.schema.fields, [projectSource]), {
    kind: "undelete-records", all: false, field: "case_status", operator: "=", value: "Confirmed", source: 'UNDELETE (Case_Status = "Confirmed")',
  });
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "summarize", aggregate: "AVG", field: "age", resultField: "AverageAge", outputTable: "FoodborneAgeBySex", stratifyBy: "sex" }), "SUMMARIZE AverageAge :: AVG(age) TO FoodborneAgeBySex STRATAVAR=sex");
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("SUMMARIZE AverageAge :: AVG(Age) TO FoodborneAgeBySex STRATAVAR=Sex", imported.schema.fields), {
    kind: "summarize", aggregate: "AVG", field: "age", resultField: "AverageAge", outputTable: "FoodborneAgeBySex", stratifyBy: "sex",
    source: "SUMMARIZE AverageAge :: AVG(Age) TO FoodborneAgeBySex STRATAVAR=Sex",
  });
  const graphSource = 'GRAPH case_status GRAPHTYPE="Bar" TITLETEXT="Foodborne cases by status" XTITLE="Count" YTITLE="Case Status"';
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "graph", field: "case_status", graphType: "Bar", title: "Foodborne cases by status", xTitle: "Count", yTitle: "Case Status" }), graphSource);
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand(graphSource, imported.schema.fields), {
    kind: "graph", field: "case_status", graphType: "Bar", title: "Foodborne cases by status", xTitle: "Count", yTitle: "Case Status", source: graphSource,
  });
  const columnGraphSource = 'GRAPH case_status GRAPHTYPE="Column" TITLETEXT="Foodborne cases by status" XTITLE="Case Status" YTITLE="Count"';
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "graph", field: "case_status", graphType: "Column", title: "Foodborne cases by status", xTitle: "Case Status", yTitle: "Count" }), columnGraphSource);
  assert.equal(commandBuilder.resolveSelectedClassicAnalysisCommand(columnGraphSource, imported.schema.fields).graphType, "Column");
  const pieGraphSource = 'GRAPH case_status GRAPHTYPE="Pie" TITLETEXT="Foodborne case status"';
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "graph", field: "case_status", graphType: "Pie", title: "Foodborne case status" }), pieGraphSource);
  assert.equal(commandBuilder.resolveSelectedClassicAnalysisCommand(pieGraphSource, imported.schema.fields).graphType, "Pie");
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("LIST ID Age Sex", imported.schema.fields), { kind: "list", fields: ["id", "age", "sex"], source: "LIST ID Age Sex" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("LIST * EXCEPT Latitude Longitude", imported.schema.fields).fields, imported.schema.fields.map((field) => field.name).filter((name) => !["latitude", "longitude"].includes(name)));
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand("READ {C:\\legacy.mdb}:Oswego", imported.schema.fields, [projectSource]), /external paths/);
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "frequency", field: "case_status", stratifyBy: "sex" }), "FREQ case_status STRATAVAR=sex");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "means", field: "age" }), "MEANS age");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "select", field: "case_status", operator: "=", value: "Confirmed" }), 'SELECT case_status = "Confirmed"');
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "cancel-select" }), "CANCEL SELECT");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "sort", items: [{ field: "age", direction: "DESC" }, { field: "id", direction: "ASC" }] }), "SORT age DESCENDING id ASCENDING");
  assert.equal(commandBuilder.buildClassicAnalysisCommand({ kind: "cancel-sort" }), "CANCEL SORT");
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('SELECT Case_Status = "Confirmed"', imported.schema.fields), { kind: "select", field: "case_status", operator: "=", value: "Confirmed", source: 'SELECT Case_Status = "Confirmed"' });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("CANCEL SELECT", imported.schema.fields), { kind: "cancel-select", source: "CANCEL SELECT" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("SORT Age DESC ID ASCENDING", imported.schema.fields), { kind: "sort", items: [{ field: "age", direction: "DESC" }, { field: "id", direction: "ASC" }], source: "SORT Age DESC ID ASCENDING" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("CANCEL SORT", imported.schema.fields), { kind: "cancel-sort", source: "CANCEL SORT" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("DEFINE ReviewLabel TEXTINPUT", imported.schema.fields), { kind: "define", variable: "ReviewLabel", scope: "STANDARD", variableType: "TEXTINPUT", source: "DEFINE ReviewLabel TEXTINPUT" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("DEFINE FoodSymptoms GROUPVAR diarrhea vomiting nausea", imported.schema.fields), {
    kind: "define-group", group: "FoodSymptoms", members: ["diarrhea", "vomiting", "nausea"], source: "DEFINE FoodSymptoms GROUPVAR diarrhea vomiting nausea",
  });
  const reviewVariable = { name: "ReviewLabel", scope: "STANDARD", variableType: "TEXTINPUT" };
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand('ASSIGN ReviewLabel = "Priority"', imported.schema.fields, [], [reviewVariable]), { kind: "assign", variable: "ReviewLabel", value: "Priority", source: 'ASSIGN ReviewLabel = "Priority"' });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("UNDEFINE ReviewLabel", imported.schema.fields, [], [reviewVariable]), { kind: "undefine", variable: "ReviewLabel", source: "UNDEFINE ReviewLabel" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("MEANS Age", imported.schema.fields), { kind: "means", field: "age", source: "MEANS Age" });
  assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand("TABLES potato_salad case_status STRATAVAR=Sex", imported.schema.fields), {
    kind: "tables", exposure: "potato_salad", outcome: "case_status", stratifyBy: ["sex"],
    source: "TABLES potato_salad case_status STRATAVAR=Sex",
  });
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand("FREQ age\nMEANS age", imported.schema.fields), /exactly one/);
  assert.throws(() => commandBuilder.resolveSelectedClassicAnalysisCommand("MEANS sex", imported.schema.fields), /Number field/);

  const selection = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-selection.ts")).href}?selection=${Date.now()}`);
  const confirmedPlan = selection.resolveClassicSelectionCommand('SELECT Case_Status = "Confirmed"', imported.schema.fields);
  assert.equal(confirmedPlan.kind, "apply");
  const confirmed = selection.applyClassicSelection(imported.records, confirmedPlan);
  assert.ok(confirmed.selectedRecords > 0 && confirmed.selectedRecords < imported.records.length);
  assert.ok(confirmed.records.every((record) => record.case_status === "Confirmed"));
  const adults = selection.applyClassicSelection(confirmed.records, selection.resolveClassicSelectionCommand("SELECT Age >= 18", imported.schema.fields));
  assert.ok(adults.selectedRecords < confirmed.selectedRecords, "a successive legacy SELECT must narrow the current selection");
  assert.ok(adults.records.every((record) => Number(record.age) >= 18 && record.case_status === "Confirmed"));
  const compoundPlan = selection.resolveClassicSelectionCommand('SELECT case_status = "Confirmed" AND age >= 18', imported.schema.fields);
  assert.equal(compoundPlan.mode, "expression");
  const compound = selection.applyClassicSelection(imported.records, compoundPlan);
  assert.equal(compound.selectedRecords, 21);
  assert.deepEqual(compound.records.map(({ id }) => id), adults.records.map(({ id }) => id), "compound AND and successive SELECT must select the same records");
  const like = selection.applyClassicSelection(imported.records, selection.resolveClassicSelectionCommand('SELECT id LIKE "P00*"', imported.schema.fields));
  assert.equal(like.selectedRecords, 9, "legacy LIKE uses a case-insensitive '*' wildcard");
  const missing = selection.applyClassicSelection(imported.records, selection.resolveClassicSelectionCommand("SELECT onset_date = (.)", imported.schema.fields));
  assert.equal(missing.selectedRecords, 52, "legacy missing-to-missing equality must select missing values");
  const arithmetic = selection.applyClassicSelection(imported.records, selection.resolveClassicSelectionCommand("SELECT (age + 2) >= 20 AND NOT sex = \"Unknown\"", imported.schema.fields));
  assert.equal(arithmetic.selectedRecords, imported.records.filter((record) => Number(record.age) >= 18).length);
  const threshold = { name: "AdultAge", scope: "STANDARD", variableType: "NUMERIC", value: 18 };
  const variablePlan = selection.resolveClassicSelectionCommand("SELECT age >= AdultAge", imported.schema.fields, [threshold]);
  assert.equal(selection.applyClassicSelection(imported.records, variablePlan).selectedRecords, imported.records.filter((record) => Number(record.age) >= 18).length);
  assert.equal(selection.applyClassicSelection(imported.records, selection.resolveClassicSelectionCommand('SELECT UPPERCASE(sex) = "FEMALE"', imported.schema.fields)).selectedRecords, 48);
  assert.equal(selection.applyClassicSelection(imported.records, selection.resolveClassicSelectionCommand("SELECT STRLEN(id) = 4", imported.schema.fields)).selectedRecords, 96);
  assert.equal(selection.applyClassicSelection(imported.records, selection.resolveClassicSelectionCommand("SELECT ROUND(-1.25, 1) = -1.3", imported.schema.fields)).selectedRecords, 96, "ROUND must use legacy midpoint-away-from-zero behavior");
  assert.throws(() => selection.resolveClassicSelectionCommand("SELECT ROUND(age, 1, 2) > 0", imported.schema.fields), /requires 1 or 2 arguments/);
  assert.throws(() => selection.resolveClassicSelectionCommand("SELECT UNSUPPORTED(age) > 0", imported.schema.fields), /not yet a parity-reviewed SELECT function/);
  assert.throws(() => selection.resolveClassicSelectionCommand('SELECT age = "18"', imported.schema.fields), /Number field/);

  const { ClassicProgramSession } = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-session.ts")).href}?session=${Date.now()}`);
  const session = new ClassicProgramSession();
  session.reset(projectSource);
  session.select(confirmed.records, confirmedPlan.canonicalSource, confirmed.excludedMissing);
  assert.equal(session.current(projectSource).records.length, confirmed.selectedRecords);
  assert.equal(session.selectionStatus(projectSource).total, 96);
  assert.match(session.selectionStatus(projectSource).canonicalSource, /^SELECT /);
  assert.equal(session.cancelSelection(), true);
  assert.equal(session.current(projectSource).records.length, 96);
  assert.equal(session.cancelSelection(), false);

  const sorting = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-sort.ts")).href}?sort=${Date.now()}`);
  const sortPlan = sorting.resolveClassicSortCommand("SORT Age DESCENDING ID ASCENDING", imported.schema.fields);
  assert.equal(sortPlan.kind, "apply");
  const sorted = sorting.applyClassicSort(imported.records, sortPlan);
  const sortedAges = sorted.map((record) => Number(record.age));
  assert.ok(sortedAges.every((age, index) => index === 0 || sortedAges[index - 1] >= age));
  const ties = sorting.applyClassicSort([{ group: "A", id: 2 }, { group: "A", id: 1 }, { group: "B", id: 3 }], sorting.resolveClassicSortCommand("SORT group ASC id DESC", [
    { name: "group", prompt: "Group", type: "text", required: false }, { name: "id", prompt: "ID", type: "number", required: false },
  ]));
  assert.deepEqual(ties.map((record) => record.id), [2, 1, 3]);
  assert.throws(() => sorting.resolveClassicSortCommand("SORT age ASC Age DESC", imported.schema.fields), /only once/);
  session.sort(sortPlan);
  assert.equal(session.current(projectSource).records[0].age, sorted[0].age);
  assert.equal(session.filtered(projectSource).records[0].id, imported.records[0].id, "filter membership must retain source order independently of SORT");
  assert.equal(session.cancelSort(), true);
  assert.equal(session.current(projectSource).records[0].id, imported.records[0].id);
  assert.equal(session.cancelSort(), false);

  session.defineVariable({ name: "TemporaryReadVariable", scope: "STANDARD", variableType: "TEXTINPUT" });
  session.defineGroup({ name: "TemporaryReadGroup", members: ["id", "age"] });
  session.storeOutTable({ ...projectSource, formName: "TemporaryReadOutput" });
  const activatedReadSource = session.read(readPlan.table, [readSource]);
  assert.equal(activatedReadSource.formName, readExpected.expected.activeForm);
  assert.equal(session.current(projectSource).records.length, readExpected.expected.activeRecords);
  assert.equal(session.selectionStatus(projectSource).canonicalSource, undefined);
  assert.equal(session.sortStatus().fields, 0);
  assert.equal(session.variables().length, 0);
  assert.equal(session.groups().length, 0);
  assert.equal(session.outTables().length, 0);
  session.reset(projectSource);

  const relate = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-relate.ts")).href}?relate=${Date.now()}`);
  const relateExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-relate-by-id.expected.json",
  ), "utf8"));
  assert.equal(relateExpected.dataset.sha256, fixture.dataset.sha256);
  const relatePlan = relate.resolveClassicRelateCommand(
    "RELATE [Foodborne Form] ID :: id MATCHING", imported.schema.fields, [projectSource],
  );
  assert.deepEqual(relatePlan.keys, relateExpected.expected.keys);
  const related = relate.applyClassicRelate(projectSource, projectSource, relatePlan);
  assert.equal(related.matchedParentRecords, relateExpected.expected.matchedParentRecords);
  assert.equal(related.unmatchedParentRecords, relateExpected.expected.unmatchedParentRecords);
  assert.equal(related.outputRecords, relateExpected.expected.outputRecords);
  assert.equal(related.source.fields.length, relateExpected.expected.outputFieldCount);
  assert.ok(related.source.fields.some((field) => field.name === "case_status2"));
  assert.ok(related.source.records.every((record) => record.case_status === record.case_status2));
  session.relate(related.source);
  assert.equal(session.current(projectSource).records.length, relateExpected.expected.outputRecords);
  assert.equal(session.current(projectSource).fields.length, relateExpected.expected.outputFieldCount);
  const compositePlan = relate.resolveClassicRelateCommand(
    "RELATE [Foodborne Form] sex :: sex AND age :: age MATCHING", imported.schema.fields, [projectSource],
  );
  assert.equal(compositePlan.keys.length, 2);
  const parentWithMissing = { ...projectSource, records: [...projectSource.records, { ...projectSource.records[0], id: "UNMATCHED" }] };
  const allResult = relate.applyClassicRelate(parentWithMissing, projectSource, { ...relatePlan, join: "all", canonicalSource: "RELATE [Foodborne Form] id :: id ALL" });
  assert.equal(allResult.unmatchedParentRecords, 1);
  assert.equal(allResult.outputRecords, 97);
  assert.equal(allResult.source.records.at(-1).id2, null);
  assert.throws(() => relate.resolveClassicRelateCommand("RELATE {C:\\legacy.prj}:Foodborne id :: id", imported.schema.fields, [projectSource]), /external paths/);
  assert.throws(() => relate.resolveClassicRelateCommand("RELATE [Foodborne Form] age :: sex", imported.schema.fields, [projectSource]), /same field type/);

  const write = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-write.ts")).href}?write=${Date.now()}`);
  const writeExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-write-csv.expected.json",
  ), "utf8"));
  const writeProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-write-csv.pgm"), "utf8");
  const writePlan = write.resolveClassicWriteCommand(writeProgram, imported.schema.fields);
  const writeCsv = write.serializeClassicWriteCsv(writePlan, imported.records);
  const writeLines = writeCsv.split("\r\n");
  assert.equal(writePlan.fileName, writeExpected.expected.fileName);
  assert.deepEqual(writePlan.fields.map(({ name }) => name), writeExpected.expected.fields);
  assert.equal(writeLines.length - 1, writeExpected.expected.recordCount);
  assert.equal(writeLines[0], writeExpected.expected.header);
  assert.throws(() => write.resolveClassicWriteCommand(writeProgram.replace("REPLACE", "APPEND"), imported.schema.fields), /APPEND requires/);
  assert.throws(() => write.resolveClassicWriteCommand(writeProgram.replace('"Text"', '"Epi7"'), imported.schema.fields), /cannot create legacy Epi7/);
  assert.throws(() => write.resolveClassicWriteCommand(writeProgram.replace("foodborne-write-example.csv", "C:\\legacy\\foodborne.csv"), imported.schema.fields), /not an operating-system path/);

  const merge = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-merge.ts")).href}?merge=${Date.now()}`);
  const mergeExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-merge-by-id.expected.json",
  ), "utf8"));
  const mergeProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-merge-by-id.pgm"), "utf8");
  const foodborneMergePlan = merge.resolveClassicMergeCommand(mergeProgram, imported.schema.fields, [projectSource]);
  const foodborneMerged = merge.applyClassicMerge(projectSource, projectSource, foodborneMergePlan);
  assert.equal(foodborneMerged.updatedRecords, mergeExpected.expected.updatedRecords);
  assert.equal(foodborneMerged.insertedRecords, mergeExpected.expected.insertedRecords);
  assert.equal(foodborneMerged.outputRecords, mergeExpected.expected.outputRecords);
  assert.deepEqual(foodborneMerged.destination.records, projectSource.records);
  const mergeFields = [
    { name: "id", prompt: "ID", type: "text", required: true },
    { name: "status", prompt: "Status", type: "text", required: false },
    { name: "age", prompt: "Age", type: "number", required: false },
  ];
  const mergeDestination = { formId: "destination", projectName: "Merge Project", formName: "Cases", fields: mergeFields, records: [{ id: "A", status: "Old", age: 20 }, { id: "B", status: "Keep", age: 30 }] };
  const mergeSource = { formId: "source", projectName: "Merge Project", formName: "Updates", fields: mergeFields, records: [{ id: "A", status: "Updated", age: 21 }, { id: "C", status: "Inserted", age: 40 }] };
  const syntheticPlan = merge.resolveClassicMergeCommand("MERGE Updates id :: id", mergeDestination.fields, [mergeSource]);
  const syntheticMerged = merge.applyClassicMerge(mergeDestination, mergeSource, syntheticPlan);
  assert.deepEqual({ updated: syntheticMerged.updatedRecords, inserted: syntheticMerged.insertedRecords, output: syntheticMerged.outputRecords }, { updated: 1, inserted: 1, output: 3 });
  assert.deepEqual(syntheticMerged.destination.records, [{ id: "A", status: "Updated", age: 21 }, { id: "B", status: "Keep", age: 30 }, { id: "C", status: "Inserted", age: 40 }]);
  assert.throws(() => merge.applyClassicMerge({ ...mergeDestination, records: [...mergeDestination.records, { id: "A", status: "Duplicate", age: 22 }] }, mergeSource, syntheticPlan), /destination key is not unique/);
  assert.throws(() => merge.resolveClassicMergeCommand("MERGE Updates id :: id UPDATE", mergeDestination.fields, [mergeSource]), /does not branch on its parsed mode/);
  assert.throws(() => merge.resolveClassicMergeCommand("MERGE {C:\\legacy.mdb}:Updates id :: id", mergeDestination.fields, [mergeSource]), /external paths/);

  const classicDelete = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-delete.ts")).href}?delete=${Date.now()}`);
  const deleteExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-delete-table.expected.json"), "utf8"));
  const deleteProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-delete-table.pgm"), "utf8");
  const deleteSource = { ...projectSource, formName: deleteExpected.expected.targetForm };
  const deletePlan = classicDelete.resolveClassicDeleteTableCommand(deleteProgram, [deleteSource]);
  const deleted = classicDelete.stageClassicDeleteTable(deleteSource, deletePlan);
  assert.equal(deletePlan.recordCount, deleteExpected.expected.deletedRecords);
  assert.equal(deleted.records.length, deleteExpected.expected.remainingRecords);
  assert.equal(deleted.fields.length, deleteExpected.expected.preservedFieldCount);
  assert.throws(() => classicDelete.resolveClassicDeleteTableCommand(`${deleteProgram.trim()} RUNSILENT`, [deleteSource]), /explicit review/);
  assert.throws(() => classicDelete.resolveClassicDeleteTableCommand("DELETE {C:\\legacy\\cases.csv}", [projectSource]), /operating-system file/);
  assert.throws(() => classicDelete.resolveClassicDeleteTableCommand("DELETE TABLES {C:\\legacy.mdb}", [projectSource]), /unimplemented/);
  assert.throws(() => classicDelete.resolveClassicDeleteTableCommand("DELETE TABLES {C:\\legacy.mdb}:Cases", [projectSource]), /external databases/);

  const deleteRecords = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-delete-records.ts")).href}?deleteRecords=${Date.now()}`);
  const deleteRecordsExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-delete-confirmed-records.expected.json"), "utf8"));
  const deleteRecordsProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-delete-confirmed-records.pgm"), "utf8");
  const deleteRecordsPlan = deleteRecords.resolveClassicDeleteRecordsCommand(deleteRecordsProgram, projectSource.fields);
  const deleteRecordsResult = deleteRecords.stageClassicDeleteRecords(projectSource, projectSource, deleteRecordsPlan);
  assert.equal(deleteRecordsResult.matchedRecords, deleteRecordsExpected.expected.deletedRecords);
  assert.equal(deleteRecordsResult.remainingRecords.length, deleteRecordsExpected.expected.remainingRecords);
  assert.ok(deleteRecordsResult.deleted.every(({ record }) => record.case_status === "Confirmed"));
  assert.equal(deleteRecords.stageClassicDeleteRecords(projectSource, { ...projectSource, records: projectSource.records.filter((record) => record.sex === "Female") }, deleteRecordsPlan).matchedRecords, 10);
  assert.throws(() => deleteRecords.resolveClassicDeleteRecordsCommand(`${deleteRecordsProgram.trim()} PERMANENT`, projectSource.fields), /PERMANENT record deletion is disabled/);
  assert.throws(() => deleteRecords.resolveClassicDeleteRecordsCommand(`${deleteRecordsProgram.trim()} RUNSILENT`, projectSource.fields), /explicit review/);

  const undeleteRecords = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-undelete-records.ts")).href}?undeleteRecords=${Date.now()}`);
  const undeleteExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-undelete-confirmed-records.expected.json"), "utf8"));
  const undeleteProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-undelete-confirmed-records.pgm"), "utf8");
  const deletedArchive = deleteRecordsResult.deleted.map((item, index) => ({
    archiveId: `archive-${index + 1}`, record: item.record, originalIndex: item.originalIndex,
    deletedAt: "2026-09-01T00:00:00.000Z", reason: "Classic Analysis DELETE confirmed cases",
  }));
  const undeletePlan = undeleteRecords.resolveClassicUndeleteRecordsCommand(undeleteProgram, projectSource.fields);
  const undeleteResult = undeleteRecords.stageClassicUndeleteRecords({ ...projectSource, records: deleteRecordsResult.remainingRecords }, deletedArchive, undeletePlan);
  assert.equal(undeleteResult.restored.length, undeleteExpected.expected.restoredRecords);
  assert.equal(undeleteResult.restoredRecords.length, undeleteExpected.expected.activeRecordsAfter);
  assert.equal(undeleteResult.remainingDeleted.length, undeleteExpected.expected.recycleBinAfter);
  assert.deepEqual(undeleteResult.restoredRecords.map(({ id }) => id), projectSource.records.map(({ id }) => id));
  assert.throws(() => undeleteRecords.resolveClassicUndeleteRecordsCommand(`${undeleteProgram.trim()} RUNSILENT`, projectSource.fields), /explicit review/);

  const summarize = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-summarize.ts")).href}?summarize=${Date.now()}`);
  const summarizeExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-summarize-age-by-sex.expected.json"), "utf8"));
  const summarizeProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-summarize-age-by-sex.pgm"), "utf8");
  const summarizePlan = summarize.resolveClassicSummarizeCommand(summarizeProgram, projectSource.fields);
  const summarizeResult = summarize.applyClassicSummarize(projectSource, summarizePlan);
  assert.equal(summarizeResult.source.formName, summarizeExpected.expected.outputTable);
  assert.equal(summarizeResult.groups, summarizeExpected.expected.rows.length);
  assert.deepEqual(summarizeResult.source.records, summarizeExpected.expected.rows);
  assert.throws(() => summarize.resolveClassicSummarizeCommand("SUMMARIZE AverageAge :: AVG(age) TO Weighted WEIGHTVAR=age", projectSource.fields), /WEIGHTVAR remains disabled/);
  assert.throws(() => summarize.resolveClassicSummarizeCommand("SUMMARIZE AverageAge :: AVG(age), Total :: COUNT() TO Multiple", projectSource.fields), /exactly one aggregate/);

  const graph = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-graph.ts")).href}?graph=${Date.now()}`);
  const graphExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status.expected.json"), "utf8"));
  const graphProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status.pgm"), "utf8");
  const graphPlan = graph.resolveClassicGraphCommand(graphProgram, projectSource.fields);
  const graphResult = deriveFrequency(projectSource.records, { field: graphPlan.field, prompt: graphPlan.fieldDefinition.prompt, includeMissing: false });
  assert.equal(graphPlan.canonicalSource, graphExpected.command);
  assert.equal(graphResult.totals.sourceRecords, graphExpected.expected.sourceRecords);
  assert.equal(graphResult.totals.includedRecords, graphExpected.expected.includedRecords);
  assert.equal(graphResult.totals.excludedMissing, graphExpected.expected.excludedMissing);
  assert.deepEqual(graphResult.categories.map(({ value, frequency }) => ({ value, frequency })), graphExpected.expected.categories);
  const columnExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status-column.expected.json"), "utf8"));
  const columnProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status-column.pgm"), "utf8");
  const columnPlan = graph.resolveClassicGraphCommand(columnProgram, projectSource.fields);
  assert.equal(columnPlan.graphType, "Column");
  assert.equal(columnPlan.canonicalSource, columnExpected.command);
  assert.deepEqual(deriveFrequency(projectSource.records, { field: columnPlan.field, prompt: columnPlan.fieldDefinition.prompt, includeMissing: false }).categories.map(({ value, frequency }) => ({ value, frequency })), columnExpected.expected.categories);
  const pieExpected = JSON.parse(await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status-pie.expected.json"), "utf8"));
  const pieProgram = await readFile(repositoryPath("wasm/tests/fixtures/classic-command-parity/foodborne-graph-case-status-pie.pgm"), "utf8");
  const piePlan = graph.resolveClassicGraphCommand(pieProgram, projectSource.fields);
  assert.equal(piePlan.graphType, "Pie");
  assert.equal(piePlan.canonicalSource, pieExpected.command);
  assert.deepEqual(deriveFrequency(projectSource.records, { field: piePlan.field, prompt: piePlan.fieldDefinition.prompt, includeMissing: false }).categories.map(({ value, frequency }) => ({ value, frequency })), pieExpected.expected.categories);
  assert.throws(() => graph.resolveClassicGraphCommand('GRAPH case_status GRAPHTYPE="Line"', projectSource.fields), /supports Bar, Column, and Pie charts only/);
  assert.throws(() => graph.resolveClassicGraphCommand('GRAPH case_status sex GRAPHTYPE="Bar"', projectSource.fields), /one variable/);

  const assignment = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-assignment.ts")).href}?assignment=${Date.now()}`);
  const definePlan = assignment.resolveClassicDefineCommand("DEFINE ReviewLabel TEXTINPUT", imported.schema.fields, []);
  session.defineVariable(definePlan);
  const assignPlan = assignment.resolveClassicAssignCommand('ASSIGN ReviewLabel = "Priority"', imported.schema.fields, session.variables());
  session.assignVariable(assignPlan.variable.name, assignPlan.value);
  assert.equal(session.variables()[0].value, "Priority");
  assert.throws(() => assignment.resolveClassicAssignCommand("ASSIGN ReviewLabel = age + 1", imported.schema.fields, session.variables()), /one literal value/);
  assert.throws(() => assignment.resolveClassicAssignCommand("ASSIGN age = 20", imported.schema.fields, session.variables()), /cannot mutate data-source fields/);
  assert.throws(() => assignment.resolveClassicDefineCommand("DEFINE Shared GLOBAL TEXTINPUT", imported.schema.fields, session.variables()), /Standard session variables only/);
  session.read(projectSource.formName, [projectSource]);
  assert.equal(session.variables().length, 0, "READ must clear Standard session variables");

  const classicIf = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-if.ts")).href}?if=${Date.now()}`);
  const ifProgramPath = "wasm/tests/fixtures/classic-command-parity/foodborne-if-standard-variable.pgm";
  const ifExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-if-standard-variable.expected.json",
  ), "utf8"));
  const ifProgram = await readFile(repositoryPath(ifProgramPath), "utf8");
  assert.equal(ifExpected.dataset.recordCount, imported.records.length);
  assert.equal(ifExpected.dataset.sha256, fixture.dataset.sha256);
  session.reset(projectSource);
  for (const source of ["DEFINE ReviewLabel TEXTINPUT", "DEFINE PriorityFlag YN"]) {
    session.defineVariable(assignment.resolveClassicDefineCommand(source, imported.schema.fields, session.variables()));
  }
  const initialize = assignment.resolveClassicAssignCommand('ASSIGN ReviewLabel = "Priority review"', imported.schema.fields, session.variables());
  session.assignVariable(initialize.variable.name, initialize.value);
  const ifSource = ifProgram.slice(ifProgram.indexOf("IF ReviewLabel"));
  const ifPlan = classicIf.resolveClassicIfCommand(ifSource, imported.schema.fields, session.variables());
  const ifResult = classicIf.evaluateClassicIf(ifPlan, session.variables());
  assert.equal(ifResult.conditionResult, ifExpected.expected.conditionResult);
  assert.equal(ifResult.branch, ifExpected.expected.branch);
  session.assignVariable(ifResult.assignment.variable, ifResult.assignment.value);
  assert.deepEqual(Object.fromEntries(session.variables().map(({ name, value }) => [name, value])), ifExpected.expected.variables);
  assert.equal(session.current(projectSource).records.length, ifExpected.expected.recordCount);
  assert.throws(() => classicIf.resolveClassicIfCommand('IF age >= 18 THEN\nASSIGN PriorityFlag = (+)\nEND', imported.schema.fields, session.variables()), /Record-field IF/);
  assert.throws(() => classicIf.resolveClassicIfCommand('IF ReviewLabel = "Priority review" THEN\nFREQ case_status\nEND', imported.schema.fields, session.variables()), /exactly one ASSIGN/);

  const undefineExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-undefine-standard-variable.expected.json",
  ), "utf8"));
  assert.equal(undefineExpected.dataset.sha256, fixture.dataset.sha256);
  const undefineOne = assignment.resolveClassicUndefineCommand("UNDEFINE ReviewLabel", imported.schema.fields, session.variables());
  const removedOne = session.undefineVariable(undefineOne.variable.name);
  assert.equal(removedOne.name, undefineExpected.expected.individualRemoved);
  const undefineAll = assignment.resolveClassicUndefineCommand("UNDEFINE *", imported.schema.fields, session.variables());
  assert.equal(undefineAll.mode, "all-standard");
  assert.deepEqual(session.undefineAllStandard().map(({ name }) => name), undefineExpected.expected.allStandardRemoved);
  assert.deepEqual(session.variables(), undefineExpected.expected.remainingVariables);
  assert.equal(session.current(projectSource).records.length, undefineExpected.expected.recordCount);
  assert.throws(() => assignment.resolveClassicUndefineCommand("UNDEFINE age", imported.schema.fields, session.variables()), /data-source field/);
  assert.throws(() => assignment.resolveClassicUndefineCommand("UNDEFINE * GLOBAL", imported.schema.fields, session.variables()), /Global variable lifetime/);

  const display = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-display.ts")).href}?display=${Date.now()}`);
  const displayExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-display-dbvariables.expected.json",
  ), "utf8"));
  assert.equal(displayExpected.dataset.sha256, fixture.dataset.sha256);
  session.defineVariable(assignment.resolveClassicDefineCommand('DEFINE ReviewLabel TEXTINPUT "Review label"', imported.schema.fields, session.variables()));
  const displayAssignment = assignment.resolveClassicAssignCommand('ASSIGN ReviewLabel = "Priority review"', imported.schema.fields, session.variables());
  session.assignVariable(displayAssignment.variable.name, displayAssignment.value);
  const definedDisplay = display.resolveClassicDisplayCommand("DISPLAY DBVARIABLES DEFINE", imported.schema.fields, session.variables());
  assert.deepEqual(display.classicDisplayRows(definedDisplay, projectSource.formName).map(({ variable, variableValue: value, specialInfo, table }) => ({ variable, value, specialInfo, table })), displayExpected.expected.defined);
  const fieldDisplay = display.resolveClassicDisplayCommand("DISPLAY DBVARIABLES FIELDVAR", imported.schema.fields, session.variables());
  assert.equal(display.classicDisplayRows(fieldDisplay, projectSource.formName).length, displayExpected.expected.fieldCount);
  const selectedDisplay = display.resolveClassicDisplayCommand("DISPLAY DBVARIABLES LIST ReviewLabel case_status", imported.schema.fields, session.variables());
  assert.deepEqual(display.classicDisplayRows(selectedDisplay, projectSource.formName).map(({ variable }) => variable).sort(), [...displayExpected.expected.selected].sort());
  assert.equal(session.current(projectSource).records.length, displayExpected.expected.recordCount);
  assert.throws(() => display.resolveClassicDisplayCommand("DISPLAY DBVIEWS", imported.schema.fields, session.variables()), /DBVARIABLES only/);
  assert.throws(() => display.resolveClassicDisplayCommand("DISPLAY DBVARIABLES OUTTABLE=VariableAudit", imported.schema.fields, session.variables()), /OUTTABLE/);

  const groups = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-group.ts")).href}?group=${Date.now()}`);
  const groupExpected = JSON.parse(await readFile(repositoryPath(
    "wasm/tests/fixtures/classic-command-parity/foodborne-define-group.expected.json",
  ), "utf8"));
  assert.equal(groupExpected.dataset.sha256, fixture.dataset.sha256);
  session.reset(projectSource);
  const groupPlan = groups.resolveClassicDefineGroupCommand(
    "DEFINE FoodSymptoms GROUPVAR diarrhea vomiting nausea abdominal_cramps fever",
    imported.schema.fields, session.variables(), session.groups(),
  );
  const group = session.defineGroup(groupPlan);
  assert.equal(group.name, groupExpected.expected.group);
  assert.deepEqual(group.members, groupExpected.expected.members);
  assert.deepEqual(session.groups(), [{ name: groupExpected.expected.group, members: groupExpected.expected.members }]);
  const groupList = commandBuilder.resolveSelectedClassicAnalysisCommand(
    "LIST id FoodSymptoms", imported.schema.fields, [], session.variables(), session.groups(),
  );
  assert.deepEqual(groupList.fields, groupExpected.expected.listFields);
  assert.equal(session.current(projectSource).records.length, groupExpected.expected.recordCount);
  assert.throws(() => groups.resolveClassicDefineGroupCommand("DEFINE age GROUPVAR diarrhea", imported.schema.fields, [], []), /field or scalar variable/);
  assert.throws(() => groups.resolveClassicDefineGroupCommand("DEFINE Other GROUPVAR FoodSymptoms", imported.schema.fields, [], session.groups()), /Nested GROUPVAR/);
  session.read(projectSource.formName, [projectSource]);
  assert.equal(session.groups().length, 0, "READ must clear GROUPVAR definitions");

  const examples = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-examples.ts")).href}?examples=${Date.now()}`);
  const catalogValue = JSON.parse(await readFile(repositoryPath(
    "wasm/demo/examples/foodborne-outbreak-investigation.programs.json",
  ), "utf8"));
  const catalog = examples.validateClassicProgramExampleCatalog(catalogValue);
  assert.equal(catalog.dataset.file, "foodborne-outbreak-investigation.csv");
  assert.equal(catalog.dataset.sha256, fixture.dataset.sha256);
  assert.equal(catalog.dataset.recordCount, imported.records.length);
  assert.deepEqual(catalog.dataset.fieldTypes, { Age: "number", Sex: "text", case_status: "text", potato_salad: "yes-no" });
  assert.deepEqual(catalog.programs.map(({ id }) => id), [
    "life-stage-by-sex", "age-band-by-case-status", "age-decades", "potato-salad-by-case-status", "food-exposure-two-by-two", "quality-profile",
  ]);
  for (const example of catalog.programs) {
    if (example.id === "quality-profile") {
      assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand(example.source, imported.schema.fields), { kind: "quality", source: "EPIAI QUALITY *" });
      continue;
    }
    if (example.id === "potato-salad-by-case-status") {
      assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand(example.source, imported.schema.fields), {
        kind: "tables", exposure: "potato_salad", outcome: "case_status", statistics: "FISHER", source: example.source,
      });
      continue;
    }
    if (example.id === "food-exposure-two-by-two") {
      assert.deepEqual(commandBuilder.resolveSelectedClassicAnalysisCommand(example.source, imported.schema.fields), {
        kind: "tables", exposure: "potato_salad", outcome: "hamburger", source: example.source,
      });
      continue;
    }
    const examplePlan = programming.parseBoundedClassicProgram(example.source, imported.schema.fields);
    const exampleData = programming.applyBoundedClassicProgram(imported.records, examplePlan);
    assert.equal(exampleData.records.length, 96, `${example.id} must preserve the foodborne record count`);
    assert.ok(exampleData.records.some((record) => typeof record[examplePlan.recode.targetField] === "string"), `${example.id} must derive categories`);
  }
  const available = examples.assessClassicProgramCatalog(catalog, {
    dataset: { id: catalog.dataset.id, file: catalog.dataset.file, sha256: catalog.dataset.sha256 },
    fields: imported.schema.fields,
    recordCount: imported.records.length,
  });
  assert.equal(available.datasetMatches, true);
  assert.ok(available.programs.every((program) => program.compatible));
  const renamed = examples.assessClassicProgramCatalog(catalog, {
    dataset: { id: "renamed-import", file: "renamed-import.csv", sha256: catalog.dataset.sha256 },
    fields: imported.schema.fields,
    recordCount: imported.records.length,
  });
  assert.equal(renamed.datasetMatches, true, "the original digest must recognize a renamed canonical import");
  const absent = examples.assessClassicProgramCatalog(catalog, { fields: imported.schema.fields, recordCount: imported.records.length });
  assert.equal(absent.datasetMatches, false);
  assert.ok(absent.programs.every((program) => !program.compatible));
  const wrongType = examples.assessClassicProgramCatalog(catalog, {
    dataset: { id: catalog.dataset.id, file: catalog.dataset.file, sha256: catalog.dataset.sha256 },
    fields: imported.schema.fields.map((field) => field.name.toLowerCase() === "age" ? { ...field, type: "text" } : field),
    recordCount: imported.records.length,
  });
  assert.match(wrongType.programs.find((program) => program.example.id === "age-decades").issues.join(" "), /must be number/i);
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
  assert.deepEqual(serializedRows, rows.map((row, index) => index === 0 ? row : [
    ...row.slice(0, 5), Number(row[5]).toFixed(5), Number(row[6]).toFixed(5),
  ]));

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
  const importedRecordValidation = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/validation.ts")).href}?csvvalidation=${Date.now()}`);
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
  assert.equal(outbreak.records[0].latitude, "41.67230");
  assert.equal(outbreak.records[0].longitude, "-83.61450");
  assert.ok(outbreak.records.every((record) => Number(record.latitude) >= 41.6 && Number(record.latitude) <= 41.8));
  assert.ok(outbreak.records.every((record) => Number(record.longitude) >= -83.7 && Number(record.longitude) <= -83.4));
  assert.ok(outbreak.records.every((record) => importedRecordValidation.validateRecord("foodborne", outbreak.schema, record, 0).length === 0));
  const importPreview = await import(`${pathToFileURL(repositoryPath("wasm/app/forms/import-preview.ts")).href}?importpreview=${Date.now()}`);
  const importFields = [
    { name: "id", prompt: "ID", type: "text", required: true, rules: [{ kind: "unique" }] },
    { name: "status", prompt: "Status", type: "text", required: false },
  ];
  const currentRows = [{ id: "A", status: "Open" }, { id: "B", status: "Open" }];
  const incomingRows = [{ id: "A", status: "Open" }, { id: "B", status: "Closed" }, { id: "C", status: "Open" }];
  const provenance = { id: "preview", file: "preview.csv", sha256: "a".repeat(64) };
  assert.equal(importPreview.suggestedImportKey(importFields, incomingRows), "id");
  const preview = importPreview.buildDataImportPreview({ fields: importFields, current: currentRows, incoming: incomingRows, keyField: "id", provenance, priorImports: [provenance] });
  assert.deepEqual({
    incoming: preview.incoming, newRecords: preview.newRecords, matchingRecords: preview.matchingRecords,
    changedRecords: preview.changedRecords, unchangedRecords: preview.unchangedRecords,
    exactFilePreviouslyImported: preview.exactFilePreviouslyImported, canMerge: preview.canMerge,
  }, { incoming: 3, newRecords: 1, matchingRecords: 2, changedRecords: 1, unchangedRecords: 1, exactFilePreviouslyImported: true, canMerge: true });
  assert.deepEqual(importPreview.applyDataImport(currentRows, incomingRows, preview, "update-and-append"), incomingRows);
  assert.deepEqual(importPreview.applyDataImport(currentRows, incomingRows, preview, "update-only"), [{ id: "A", status: "Open" }, { id: "B", status: "Closed" }]);
  assert.deepEqual(importPreview.applyDataImport(currentRows, incomingRows, preview, "append-new"), [{ id: "A", status: "Open" }, { id: "B", status: "Open" }, { id: "C", status: "Open" }]);
  assert.deepEqual(importPreview.applyDataImport(currentRows, incomingRows, preview, "replace"), incomingRows);
  const nonDestructivePreview = importPreview.buildDataImportPreview({ fields: importFields, current: [{ id: "A", status: "Confirmed" }], incoming: [{ id: "A", status: "" }], keyField: "id", provenance, priorImports: [] });
  assert.deepEqual(importPreview.applyDataImport([{ id: "A", status: "Confirmed" }], [{ id: "A", status: "" }], nonDestructivePreview, "update-only"), [{ id: "A", status: "Confirmed" }]);
  const ambiguous = importPreview.buildDataImportPreview({ fields: importFields, current: currentRows, incoming: [...incomingRows, incomingRows[0]], keyField: "id", provenance, priorImports: [] });
  assert.equal(ambiguous.canMerge, false);
  assert.equal(ambiguous.duplicateIncomingKeys, 1);
  assert.throws(() => importPreview.applyDataImport(currentRows, incomingRows, ambiguous, "append-new"), /unique, complete matching key/i);
  const invalid = importPreview.buildDataImportPreview({ fields: importFields, current: currentRows, incoming: incomingRows, keyField: "id", provenance, priorImports: [], invalidRecords: 1 });
  assert.equal(invalid.invalidRecords, 1);
  assert.equal(invalid.canMerge, false);
  const blankKey = importPreview.buildDataImportPreview({ fields: importFields, current: currentRows, incoming: [{ id: "", status: "Open" }], keyField: "id", provenance, priorImports: [] });
  assert.equal(blankKey.blankIncomingKeys, 1);
  assert.equal(blankKey.canMerge, false);
  const caseEdit = importPreview.buildDataImportPreview({ fields: importFields, current: [{ id: "A", status: "Open" }], incoming: [{ id: "a", status: "open" }], keyField: "id", provenance, priorImports: [] });
  assert.equal(caseEdit.matchingRecords, 1);
  assert.equal(caseEdit.changedRecords, 1);
  assert.equal(module.alignToGrid(19, 12), 24);
  assert.equal(module.alignToGrid(5, 12), 0);

  const snapshot = await jsonFixture("project-snapshot-v1.json");
  const contracts = await import(`${pathToFileURL(repositoryPath("wasm/app/contracts/core.ts")).href}?phase0=${Date.now()}`);
  const validated = contracts.validateProjectSnapshot(snapshot);
  assert.deepEqual(validated, snapshot);
  assert.equal(contracts.isProjectSnapshot(snapshot), true);
  assert.equal(contracts.isProjectSnapshot({ ...snapshot, version: 2 }), false);
  const withImportHistory = structuredClone(snapshot);
  withImportHistory.forms[0].imports = [{ id: "preview", file: "preview.csv", sha256: "a".repeat(64) }];
  assert.deepEqual(contracts.validateProjectSnapshot(withImportHistory).forms[0].imports, withImportHistory.forms[0].imports);
  const withStudyArea = structuredClone(snapshot);
  withStudyArea.studyAreas = [{
    id: "toledo-field-investigation",
    name: "Toledo field investigation",
    source: "drawn-bounds",
    bounds: [-83.75, 41.5, -83.45, 41.75],
    geometry: {
      type: "Polygon",
      coordinates: [[[-83.75, 41.5], [-83.45, 41.5], [-83.45, 41.75], [-83.75, 41.75], [-83.75, 41.5]]],
    },
    bufferKm: 0,
    offlineMap: {
      minZoom: 0,
      maxZoom: 14,
      packageLimitMiB: 100,
      status: "not-downloaded",
      providerId: "browser-pmtiles",
      estimate: {
        estimatorVersion: "web-mercator-v1",
        tileCount: 358,
        averageTileBytes: 25600,
        estimatedBytes: 9164800,
      },
    },
  }];
  assert.deepEqual(contracts.validateProjectSnapshot(withStudyArea).studyAreas, withStudyArea.studyAreas);
  const withOfflineAsset = structuredClone(withStudyArea);
  withOfflineAsset.studyAreas[0].offlineMap.status = "stored-unverified";
  withOfflineAsset.studyAreas[0].offlineMap.asset = {
    id: "a".repeat(64),
    fileName: "toledo.pmtiles",
    storage: "opfs",
    storagePath: `epi-info-ai/offline-maps/${"a".repeat(64)}.pmtiles`,
    byteLength: 129,
    sha256: "a".repeat(64),
    format: "pmtiles-v3",
    tileType: "mvt",
    tileCompression: "none",
    bounds: [-84, 41, -83, 42],
    minZoom: 0,
    maxZoom: 14,
    attribution: "OpenStreetMap contributors",
    license: "ODbL-1.0",
    importedAt: "2026-09-02T12:00:00.000Z",
    persistence: "best-effort",
  };
  assert.equal(contracts.validateProjectSnapshot(withOfflineAsset).studyAreas[0].offlineMap.status, "stored-unverified");
  const assetWithoutReadyStatus = structuredClone(withOfflineAsset);
  assetWithoutReadyStatus.studyAreas[0].offlineMap.status = "not-downloaded";
  assert.throws(() => contracts.validateProjectSnapshot(assetWithoutReadyStatus), /must be stored-unverified/i);
  const invalidStudyArea = structuredClone(withStudyArea);
  invalidStudyArea.studyAreas[0].bounds = [-83.45, 41.5, -83.75, 41.75];
  assert.throws(() => contracts.validateProjectSnapshot(invalidStudyArea), /west must be less than east/i);
  const duplicateStudyArea = structuredClone(withStudyArea);
  duplicateStudyArea.studyAreas.push(structuredClone(duplicateStudyArea.studyAreas[0]));
  assert.throws(() => contracts.validateProjectSnapshot(duplicateStudyArea), /duplicate study-area id/i);
  const withDataset = structuredClone(snapshot);
  withDataset.forms[0].dataset = {
    id: "foodborne-outbreak-investigation",
    file: "foodborne-outbreak-investigation.csv",
    sha256: "b6e855c8cc6990abb4c25c4a1d9ee5ddea3c0016567bfc30f372faaa07df9cf5",
  };
  assert.deepEqual(contracts.validateProjectSnapshot(withDataset).forms[0].dataset, withDataset.forms[0].dataset);
  withDataset.forms[0].dataset.sha256 = "not-a-digest";
  assert.throws(() => contracts.validateProjectSnapshot(withDataset), /SHA-256 digest/i);
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
  const offlineEstimator = await import(`${pathToFileURL(repositoryPath("wasm/app/maps/offline-map-estimator.ts")).href}?phase0=${Date.now()}`);
  assert.equal(offlineEstimator.tileCountForBounds([-180, -85, 180, 85], 0), 1);
  assert.equal(offlineEstimator.tileCountForBounds([-180, -85, 180, 85], 1), 4);
  const pmtilesEstimate = offlineEstimator.estimateOfflineMapPackage(
    [-83.75, 41.5, -83.45, 41.75],
    0,
    14,
    offlineEstimator.offlineMapProvider("browser-pmtiles"),
  );
  assert.deepEqual(pmtilesEstimate, {
    estimatorVersion: "web-mercator-v1",
    tileCount: 358,
    averageTileBytes: 25600,
    estimatedBytes: 9164800,
  });
  assert.throws(() => offlineEstimator.tileCountForBounds([-83.45, 41.5, -83.75, 41.75], 14), /ordered finite/i);
  const pmtilesImporter = await import(`${pathToFileURL(repositoryPath("wasm/app/maps/pmtiles-import.ts")).href}?phase0=${Date.now()}`);
  const pmtilesHeaderBytes = new ArrayBuffer(127);
  const pmtilesHeader = new Uint8Array(pmtilesHeaderBytes);
  pmtilesHeader.set(new TextEncoder().encode("PMTiles"), 0);
  const pmtilesView = new DataView(pmtilesHeaderBytes);
  pmtilesView.setUint8(7, 3);
  pmtilesView.setBigUint64(8, 127n, true);
  pmtilesView.setBigUint64(16, 1n, true);
  pmtilesView.setBigUint64(24, 128n, true);
  pmtilesView.setBigUint64(32, 0n, true);
  pmtilesView.setBigUint64(56, 128n, true);
  pmtilesView.setBigUint64(64, 1n, true);
  pmtilesView.setUint8(97, 1);
  pmtilesView.setUint8(98, 1);
  pmtilesView.setUint8(99, 1);
  pmtilesView.setUint8(100, 0);
  pmtilesView.setUint8(101, 14);
  pmtilesView.setInt32(102, -840000000, true);
  pmtilesView.setInt32(106, 410000000, true);
  pmtilesView.setInt32(110, -830000000, true);
  pmtilesView.setInt32(114, 420000000, true);
  assert.deepEqual(pmtilesImporter.parsePmtilesHeader(pmtilesHeaderBytes, 129), {
    version: 3,
    rootOffset: 127,
    rootLength: 1,
    metadataOffset: 128,
    metadataLength: 0,
    leafDirectoryOffset: 0,
    leafDirectoryLength: 0,
    tileDataOffset: 128,
    tileDataLength: 1,
    internalCompression: "none",
    tileCompression: "none",
    tileType: "mvt",
    minZoom: 0,
    maxZoom: 14,
    bounds: [-84, 41, -83, 42],
  });
  pmtilesView.setUint8(7, 2);
  assert.throws(() => pmtilesImporter.parsePmtilesHeader(pmtilesHeaderBytes, 129), /version 2 is not supported/i);
  const pmtilesReader = await import(`${pathToFileURL(repositoryPath("wasm/app/maps/pmtiles-reader.ts")).href}?phase0=${Date.now()}`);
  assert.deepEqual(pmtilesReader.deserializePmtilesDirectory(Uint8Array.from([1, 0, 1, 68, 1])), [{
    tileId: 0,
    runLength: 1,
    length: 68,
    offset: 0,
  }]);
  assert.deepEqual([
    pmtilesReader.zxyToPmtilesId(0, 0, 0),
    pmtilesReader.zxyToPmtilesId(1, 0, 0),
    pmtilesReader.zxyToPmtilesId(1, 0, 1),
    pmtilesReader.zxyToPmtilesId(1, 1, 1),
    pmtilesReader.zxyToPmtilesId(1, 1, 0),
  ], [0, 1, 2, 3, 4]);
  assert.equal(pmtilesReader.pmtilesRasterMimeType("png"), "image/png");
  assert.equal(pmtilesReader.pmtilesRasterMimeType("mvt"), null);
  assert.throws(() => pmtilesReader.deserializePmtilesDirectory(Uint8Array.from([1, 0, 1, 68, 0])), /offset or length/i);
  const maplibrePmtiles = await import(`${pathToFileURL(repositoryPath("wasm/app/maps/maplibre-pmtiles.ts")).href}?phase0=${Date.now()}`);
  assert.deepEqual(maplibrePmtiles.vectorLayerIds({
    vector_layers: [{ id: "boundaries" }, { id: "places" }, { id: "boundaries" }, { id: "" }, null],
  }), ["boundaries", "places"]);
  const vectorStyle = maplibrePmtiles.vectorPmtilesStyle({
    asset: { id: "a".repeat(64), attribution: "Fixture contributors", license: "Fixture license" },
    header: { minZoom: 0, maxZoom: 14 },
    metadata: { vector_layers: [{ id: "boundaries" }] },
  });
  assert.equal(vectorStyle.sources.offline.type, "vector");
  assert.deepEqual(vectorStyle.sources.offline.tiles, [`epi-pmtiles://${"a".repeat(64)}/{z}/{x}/{y}.mvt`]);
  assert.equal(vectorStyle.layers.length, 3);
  assert.ok(vectorStyle.layers.every((layer) => layer.source === "offline" && layer["source-layer"] === "boundaries"));
  assert.throws(() => maplibrePmtiles.vectorPmtilesStyle({
    asset: { id: "a".repeat(64), attribution: "Fixture contributors", license: "Fixture license" },
    header: { minZoom: 0, maxZoom: 14 },
    metadata: {},
  }), /does not declare vector_layers metadata/i);
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
  assert.deepEqual(contracts.validateProjectProgram({
    name: "Metadata", source: "FREQ age", language: "classic-analysis", author: "Analyst",
    comment: "Reviewed example", createdAt: "2026-08-31T12:00:00.000Z", modifiedAt: "2026-08-31T13:00:00.000Z",
  }), {
    name: "Metadata", source: "FREQ age", language: "classic-analysis", author: "Analyst",
    comment: "Reviewed example", createdAt: "2026-08-31T12:00:00.000Z", modifiedAt: "2026-08-31T13:00:00.000Z",
  });
  assert.throws(() => contracts.validateProjectProgram({ name: "Bad", source: "", language: "classic-analysis", createdAt: "yesterday-ish" }), /createdAt/);
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

async function checkPortableProjectArchive() {
  const packages = await import(`${pathToFileURL(repositoryPath("wasm/app/contracts/project-package.ts")).href}?archive=${Date.now()}`);
  const archives = await import(`${pathToFileURL(repositoryPath("wasm/app/contracts/project-archive.ts")).href}?archive=${Date.now()}`);
  const snapshot = await jsonFixture("project-snapshot-v1.json");
  const bytes = new Uint8Array(129);
  bytes.set(new TextEncoder().encode("PMTiles"));
  const view = new DataView(bytes.buffer);
  view.setUint8(7, 3);
  view.setBigUint64(8, 127n, true);
  view.setBigUint64(16, 1n, true);
  view.setBigUint64(24, 128n, true);
  view.setBigUint64(32, 0n, true);
  view.setBigUint64(56, 128n, true);
  view.setBigUint64(64, 1n, true);
  view.setUint8(97, 1);
  view.setUint8(98, 1);
  view.setUint8(99, 1);
  view.setUint8(100, 0);
  view.setUint8(101, 14);
  view.setInt32(102, -840000000, true);
  view.setInt32(106, 410000000, true);
  view.setInt32(110, -830000000, true);
  view.setInt32(114, 420000000, true);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const asset = {
    id: digest,
    fileName: "toledo.pmtiles",
    storage: "opfs",
    storagePath: `epi-info-ai/offline-maps/fixture-${digest}.pmtiles`,
    byteLength: bytes.byteLength,
    sha256: digest,
    format: "pmtiles-v3",
    tileType: "mvt",
    tileCompression: "none",
    bounds: [-84, 41, -83, 42],
    minZoom: 0,
    maxZoom: 14,
    attribution: "Fixture contributors",
    license: "Fixture license",
    importedAt: "2026-09-02T12:00:00.000Z",
    persistence: "best-effort",
  };
  snapshot.studyAreas = [{
    id: "toledo", name: "Toledo", source: "drawn-bounds",
    bounds: [-83.75, 41.5, -83.45, 41.75],
    geometry: { type: "Polygon", coordinates: [[[-83.75, 41.5], [-83.45, 41.5], [-83.45, 41.75], [-83.75, 41.75], [-83.75, 41.5]]] },
    bufferKm: 0,
    offlineMap: { minZoom: 0, maxZoom: 14, packageLimitMiB: 100, status: "stored-unverified", providerId: "browser-pmtiles", asset },
  }];
  const geojsonBytes = new TextEncoder().encode(JSON.stringify({ type: "FeatureCollection", features: [] }));
  const geojsonDigest = createHash("sha256").update(geojsonBytes).digest("hex");
  const geojsonAsset = {
    id: geojsonDigest, fileName: "study-area.geojson", storage: "opfs",
    storagePath: `epi-info-ai/map-assets/${geojsonDigest}.geojson`, byteLength: geojsonBytes.byteLength,
    sha256: geojsonDigest, format: "geojson", mediaType: "application/geo+json",
    importedAt: "2026-09-10T12:00:00.000Z", persistence: "best-effort",
  };
  const geotiffBytes = new Uint8Array([0x49, 0x49, 0x2a, 0x00]);
  const geotiffDigest = createHash("sha256").update(geotiffBytes).digest("hex");
  const geotiffAsset = {
    id: geotiffDigest, fileName: "population.tif", storage: "opfs",
    storagePath: `epi-info-ai/map-assets/${geotiffDigest}.tif`, byteLength: geotiffBytes.byteLength,
    sha256: geotiffDigest, format: "geotiff", mediaType: "image/tiff",
    importedAt: "2026-09-10T12:01:00.000Z", persistence: "best-effort",
  };
  snapshot.mapAssets = [geojsonAsset, geotiffAsset];
  snapshot.mapLayers = [
    { id: "geojson-study", kind: "geojson", assetId: geojsonDigest, name: "Study area", visible: true, labelField: "", labelsEnabled: false },
    { id: "raster-population", kind: "raster", assetId: geotiffDigest, name: "Population", visible: true, opacity: 0.7 },
  ];
  const packageValue = packages.createProjectPackage(snapshot);
  const payload = new File([bytes], asset.fileName, { type: "application/vnd.pmtiles" });
  const archiveBlob = await archives.createProjectArchive(packageValue, [
    { asset, file: payload },
    { asset: geojsonAsset, file: new File([geojsonBytes], geojsonAsset.fileName, { type: geojsonAsset.mediaType }) },
    { asset: geotiffAsset, file: new File([geotiffBytes], geotiffAsset.fileName, { type: geotiffAsset.mediaType }) },
  ]);
  const archiveFile = new File([archiveBlob], "toledo.epia", { type: archiveBlob.type });
  assert.equal(await archives.isBinaryProjectArchive(archiveFile), true);
  const restored = await archives.parseProjectArchive(archiveFile);
  assert.equal(restored.projectPackage.project.name, snapshot.name);
  assert.equal(restored.assets.length, 3);
  assert.equal(restored.assets[0].asset.sha256, digest);
  assert.deepEqual(new Uint8Array(await restored.assets[0].file.arrayBuffer()), bytes);
  assert.equal(restored.assets[1].asset.format, "geojson");
  assert.deepEqual(new Uint8Array(await restored.assets[1].file.arrayBuffer()), geojsonBytes);
  assert.equal(restored.assets[2].asset.format, "geotiff");
  assert.deepEqual(new Uint8Array(await restored.assets[2].file.arrayBuffer()), geotiffBytes);
  assert.equal(await archives.isBinaryProjectArchive(new Blob([JSON.stringify(packageValue)])), false);
  const tampered = new Uint8Array(await archiveBlob.arrayBuffer());
  tampered[tampered.length - 1] ^= 0xff;
  await assert.rejects(
    () => archives.parseProjectArchive(new File([tampered], "tampered.epia")),
    /SHA-256 check/i,
  );
  await assert.rejects(
    () => archives.parseProjectArchive(new File([archiveBlob, new Uint8Array([1])], "trailing.epia")),
    /trailing bytes/i,
  );
}

async function checkEncryptedProjectArchive() {
  const encryptedProjects = await import(`${pathToFileURL(repositoryPath("wasm/app/contracts/encrypted-project.ts")).href}?encrypted=${Date.now()}`);
  const plaintextBytes = new TextEncoder().encode("authenticated Epi Info project fixture");
  const plaintext = new Blob([plaintextBytes], { type: "application/vnd.epi-info-ai.project" });
  const encrypted = await encryptedProjects.encryptProjectArchive(plaintext, "correct horse battery staple", 100_000);
  assert.equal(encrypted.type, encryptedProjects.ENCRYPTED_PROJECT_MEDIA_TYPE);
  assert.equal(await encryptedProjects.isEncryptedProjectArchive(encrypted), true);
  assert.equal(await encryptedProjects.isEncryptedProjectArchive(plaintext), false);
  const decrypted = await encryptedProjects.decryptProjectArchive(encrypted, "correct horse battery staple");
  assert.deepEqual(new Uint8Array(await decrypted.arrayBuffer()), plaintextBytes);
  await assert.rejects(
    () => encryptedProjects.decryptProjectArchive(encrypted, "wrong passphrase"),
    /incorrect or the package was modified/i,
  );
  const tamperedBytes = new Uint8Array(await encrypted.arrayBuffer());
  tamperedBytes[tamperedBytes.length - 1] ^= 1;
  await assert.rejects(
    () => encryptedProjects.decryptProjectArchive(new Blob([tamperedBytes]), "correct horse battery staple"),
    /incorrect or the package was modified/i,
  );
  await assert.rejects(
    () => encryptedProjects.encryptProjectArchive(plaintext, "too short", 100_000),
    /at least 12 characters/i,
  );
  const transfers = await import(`${pathToFileURL(repositoryPath("wasm/app/share/webrtc-transfer.ts")).href}?share=${Date.now()}`);
  const fakeOffer = JSON.stringify({ type: "offer", sdp: "v=0\r\na=fingerprint:sha-256 AA:BB:CC:DD\r\n" });
  assert.equal(transfers.signalingFingerprint(fakeOffer), "AA:BB:CC:DD");
  assert.equal(transfers.SECURE_SHARE_CHUNK_BYTES, 64 * 1024);
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

  const tablesNotebook = JSON.parse(await readFile(repositoryPath("wasm/validation-lab/content/validate-tables.ipynb"), "utf8"));
  assert.equal(tablesNotebook.nbformat, 4);
  assert.equal(tablesNotebook.metadata?.kernelspec?.name, "python");
  const tablesSource = tablesNotebook.cells.flatMap((cell) => cell.source || []).join("");
  for (const requiredText of [
    "foodborne-tables-stratified-v0.3.json",
    "foodborne-tables-unstratified-v0.3.json",
    "foodborne-tables-fisher-v0.5.json",
    "Fisher-Freeman-Halton",
    "foodborne-tables-missing-v0.6.json",
    "foodborne-tables-adjusted-v0.8.json",
    "foodborne-tables-weighted-v0.9.json",
    "foodborne-tables-psuvar-v0.2.json",
    "foodborne-tables-psuvar-outtable-v0.2.json",
    "SET MISSING=ON",
    "chi2_contingency",
    "Rust/WASM kernel",
    "Mantel-Haenszel OR, RR",
    "WEIGHTVAR frequency weights",
    "PSUVAR Taylor variance",
    "PSUVAR OUTTABLE",
    "CSF Taylor variance + OUTTABLE",
    "CSM domain means, Taylor variance",
    "foodborne-means-psuvar-outtable-v0.1.json",
  ]) {
    assert.ok(tablesSource.includes(requiredText), `TABLES validation notebook must retain ${requiredText}`);
  }
}

async function checkEpiAssistProposalBoundary() {
  const proposals = await import(`${pathToFileURL(repositoryPath("wasm/app/assistant/proposals.ts")).href}?assistant=${Date.now()}`);
  const intents = await import(`${pathToFileURL(repositoryPath("wasm/app/assistant/intent.ts")).href}?assistant=${Date.now()}`);
  const models = await import(`${pathToFileURL(repositoryPath("wasm/app/assistant/models.ts")).href}?assistant=${Date.now()}`);
  const gateway = await import(`${pathToFileURL(repositoryPath("wasm/app/assistant/gateway.ts")).href}?assistant=${Date.now()}`);
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
  assert.deepEqual(intents.resolveEpiAssistFrequencyIntent("Show age distribution by sex", context), {
    kind: "run-frequency",
    fieldName: "age",
    stratifyBy: "sex",
  });
  assert.equal(intents.resolveEpiAssistFrequencyIntent("Show an invented distribution by sex", context), null);
  assert.equal(intents.resolveEpiAssistFrequencyIntent("Show gender distribution by status", context), null);
  assert.deepEqual(models.EPI_ASSIST_MODELS.map(({ key, device, dtype, approximateSize }) => ({ key, device, dtype, approximateSize })), [
    { key: "granite-4.0-350m-wasm", device: "wasm", dtype: "q4", approximateSize: "576 MB" },
    { key: "granite-4.0-350m-webgpu", device: "webgpu", dtype: "fp16", approximateSize: "709 MB" },
    { key: "granite-4.0-1b", device: "webgpu", dtype: "q4", approximateSize: "1.78 GB" },
  ]);
  const partial = proposals.parseEpiAssistToolCalls(`
<tool_call>{"name":"run_frequency","arguments":{"field_name":"case_status"}}</tool_call>
<tool_call>{"name":"execute_code","arguments":{"code":"delete records"}}</tool_call>
<tool_call>{"name":"run_epi_curve","arguments":`, context);
  assert.deepEqual(partial.actions.map((action) => action.kind), ["run-frequency"]);
  assert.match(partial.rationale, /1 other call was discarded/);
  assert.throws(() => proposals.parseEpiAssistToolCalls('<tool_call>{"name":"run_frequency","arguments":{"field_name":"invented"}}</tool_call>', context), /No model tool call passed validation/);

  assert.deepEqual(gateway.EPI_ASSIST_CLOUD_CHOICES.map(({ key, provider, modelAlias }) => ({ key, provider, modelAlias })), [
    { key: "openai-chatgpt", provider: "openai", modelAlias: "chatgpt" },
    { key: "anthropic-claude", provider: "anthropic", modelAlias: "claude" },
  ]);
  let gatewayRequest;
  const cloud = await gateway.requestCloudProposal(
    gateway.EPI_ASSIST_CLOUD_CHOICES[0],
    "Show age distribution by sex",
    context,
    async (_url, init) => {
      gatewayRequest = JSON.parse(String(init.body));
      return new Response(JSON.stringify({
        schemaVersion: "1.0.0",
        provider: "openai",
        model: { id: "approved-chatgpt-model", revision: "2026-09-03" },
        requestId: "gateway-test-1",
        toolCalls: [{ name: "run_frequency", arguments: { field_name: "age", stratify_by: "sex" } }],
        audit: { systemVersion: "gateway-system-v1", toolSchemaVersion: "epi-assist-tools-v3" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
    new URL("https://example.test/api/epi-assist/v1/propose"),
    "https://example.test",
  );
  assert.equal(gatewayRequest.provider, "openai");
  assert.equal(gatewayRequest.modelAlias, "chatgpt");
  assert.equal("records" in gatewayRequest.context, false);
  assert.equal(JSON.stringify(gatewayRequest).includes("apiKey"), false);
  assert.equal(cloud.metadata.requestId, "gateway-test-1");
  assert.deepEqual(proposals.parseEpiAssistNativeToolCalls(cloud.response.toolCalls, context, "ChatGPT").actions[0], { kind: "run-frequency", fieldName: "age", stratifyBy: "sex" });
  await assert.rejects(() => gateway.requestCloudProposal(
    gateway.EPI_ASSIST_CLOUD_CHOICES[1],
    "Show age distribution",
    context,
    async () => new Response("{}", { status: 200 }),
    new URL("https://outside.example/api"),
    "https://example.test",
  ), /same-origin/);

  const workerSource = await readFile(repositoryPath("wasm/demo/epi-assist-worker.ts"), "utf8");
  for (const provenanceMarker of [
    'MODEL_REVISION = "main"',
    'RUNTIME_VERSION = "3.7.5"',
    'SYSTEM_PROMPT_VERSION = "epi-assist-system-v2"',
    'TOOL_SCHEMA_VERSION = "epi-assist-tools-v3"',
    'required: frequencyIntent ? ["field_name", "stratify_by"] : ["field_name"]',
    "model: { id: selected.modelId, revision: MODEL_REVISION, device: selected.device, dtype: selected.dtype }",
    "prompt: { systemVersion: SYSTEM_PROMPT_VERSION, system: SYSTEM_PROMPT, user: event.data.prompt }",
  ]) assert.ok(workerSource.includes(provenanceMarker), `Epi Assist must retain ${provenanceMarker}`);
}

async function checkClassicProgramAst() {
  const parser = await import(`${pathToFileURL(repositoryPath("wasm/app/programming/classic-ast.ts")).href}?ast=${Date.now()}`);
  const source = `READ {Projects\\Sample\\Sample.prj}:Oswego
DEFINE AgeGroup TEXTINPUT
ASSIGN AgeGroup = "Unknown"
RECODE Age TO AgeGroup
  LOVALUE - 4 = "0-4"
  4 - 17 = "5-17"
  ELSE = "Adult"
END
SELECT Sex = "Female" AND Age >= 18
IF Age >= 18 THEN
  FREQ AgeGroup STRATAVAR=Sex WEIGHTVAR=Weight
ELSE
  TABLES Exposure Ill STRATAVAR=Sex STATISTICS=FISHER
END
SORT Age DESCENDING ID ASCENDING
CANCEL SORT`;
  const ast = parser.parseClassicProgram(source);
  assert.equal(ast.type, "Program");
  assert.equal(ast.astVersion, "1.0.0");
  assert.deepEqual(ast.body.map((statement) => statement.type), [
    "ReadStatement", "DefineStatement", "AssignStatement", "RecodeStatement", "SelectStatement", "IfStatement", "SortStatement", "SortStatement",
  ]);
  assert.deepEqual(ast.body[0].target, {
    kind: "external-table", source: "{Projects\\Sample\\Sample.prj}", table: "Oswego", raw: "{Projects\\Sample\\Sample.prj}:Oswego",
  });
  assert.equal(ast.body[1].variableType, "TEXTINPUT");
  assert.equal(ast.body[2].value.type, "Literal");
  assert.equal(ast.body[3].clauses.length, 3);
  assert.equal(ast.body[3].clauses[0].type, "RecodeValueClause");
  assert.equal(ast.body[4].expression.type, "BinaryExpression");
  assert.equal(ast.body[4].expression.operator, "AND");
  assert.deepEqual(ast.body[5].consequent.map((statement) => statement.type), ["FrequencyStatement"]);
  assert.deepEqual(ast.body[5].alternate.map((statement) => statement.type), ["TablesStatement"]);
  assert.deepEqual(ast.body[5].consequent[0].options.stratifyBy.map(({ name }) => name), ["Sex"]);
  assert.equal(ast.body[5].consequent[0].options.weightBy.name, "Weight");
  assert.equal(ast.body[5].alternate[0].options.statistics, "FISHER");
  assert.equal(ast.body[5].span.end.line, 14);
  assert.deepEqual(ast.body[6].items.map((item) => [item.field.name, item.direction]), [["Age", "DESC"], ["ID", "ASC"]]);
  assert.equal(ast.body[7].mode, "cancel");

  const selectionForms = parser.parseClassicProgram("FREQ * EXCEPT Secret NOWRAP\nSELECT\nCANCEL SELECT\nSORT");
  assert.equal(selectionForms.body[0].selection.kind, "all-except");
  assert.equal(selectionForms.body[1].mode, "clear");
  assert.equal(selectionForms.body[2].mode, "cancel");
  assert.equal(selectionForms.body[3].mode, "clear");
  const graph = parser.parseClassicProgram('GRAPH Case_Status GRAPHTYPE="Bar" TITLETEXT="Cases"');
  assert.equal(graph.body[0].type, "GraphStatement");
  assert.equal(graph.body[0].field.name, "Case_Status");
  assert.equal(graph.body[0].graphType, "Bar");
  const commandTourSource = await readFile(repositoryPath("wasm/demo/examples/foodborne-classic-command-tour.pgm7"), "utf8");
  const commandTour = parser.parseClassicProgram(commandTourSource);
  assert.deepEqual(commandTour.body.map(({ type }) => type), [
    "ListStatement", "FrequencyStatement", "FrequencyStatement", "MeansStatement", "SetStatement", "SetStatement", "TablesStatement", "SetStatement", "SetStatement", "TablesStatement", "TablesStatement",
    "TablesStatement", "TablesStatement", "TablesStatement", "TablesStatement", "SelectStatement", "FrequencyStatement", "SelectStatement", "SortStatement",
    "ListStatement", "SortStatement", "SummarizeStatement", "GraphStatement", "TablesStatement", "DefineGroupStatement", "TablesStatement",
    "FrequencyStatement", "MeansStatement", "EpiAiQualityStatement", "DefineStatement", "DefineStatement", "AssignStatement", "IfStatement",
  ]);
  assert.equal(commandTour.body[27].options.outputTable.name, "AgeBySexSurvey");
  assert.equal(commandTour.body[32].alternate[0].type, "AssignStatement");
  assert.throws(() => parser.parseClassicProgram("EXECUTE \"malware.exe\""), /Unsupported command/);
  assert.throws(() => parser.parseClassicProgram("IF Age > 10 THEN\nFREQ Age"), /IF is missing END/);
  assert.throws(() => parser.parseClassicProgram("ASSIGN Age = (10 + 2"), /closing parenthesis/);
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
    ["portable binary project archive with PMTiles", checkPortableProjectArchive],
    ["authenticated encrypted project archive", checkEncryptedProjectArchive],
    ["algorithm validation registry", checkAlgorithmValidationRegistry],
    ["programming curriculum registry", checkProgrammingCurriculumRegistry],
    ["JupyterLite validation lab source", checkValidationLabSource],
    ["Epi Assist typed proposal allowlist", checkEpiAssistProposalBoundary],
    ["versioned Classic Program AST", checkClassicProgramAst],
  ];

  for (const [name, check] of checks) {
    await check();
    console.log(`PASS ${name}`);
  }
  console.log(`Phase 0 automated baseline passed (${checks.length} checks).`);
}

await run();
