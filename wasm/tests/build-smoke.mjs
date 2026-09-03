import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(testsDirectory, "../dist");

async function requireFile(relativePath) {
  const file = join(outputDirectory, relativePath);
  const metadata = await stat(file);
  assert.ok(metadata.isFile(), `${relativePath} must be a production file`);
  assert.ok(metadata.size > 0, `${relativePath} must not be empty`);
  return readFile(file, "utf8");
}

const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "app.js.map",
  "epi-assist.js",
  "epi-assist.js.map",
  "epi-assist-worker.js",
  "epi-assist-worker.js.map",
  "engine.js",
  "engine.js.map",
  "form-data.js",
  "form-data.js.map",
  "maps.js",
  "maps.js.map",
  "supabase-sync.js",
  "supabase-sync.js.map",
  "shell.js",
  "stratified-worker.js",
  "stratified-worker.js.map",
  "stratified-worker-client.js",
  "stratified-worker-client.js.map",
  "epi2x2.wasm",
  "sample-case-data.csv",
  "sample-map-layer.geojson",
  "examples/README.md",
  "examples/foodborne-outbreak-investigation.csv",
  "examples/foodborne-outbreak-investigation.xlsx",
  "examples/foodborne-outbreak-investigation.programs.json",
  "examples/city-of-toledo-neighborhoods.geojson",
  "examples/worldpop-toledo-population-density.tif",
  "examples/sample-project.epia.json",
  "vendor/leaflet/leaflet.js",
  "vendor/h3-js/h3-js.es.js",
  "setup/supabase-schema.sql",
  "validation-fixtures/table2x2-baseline.json",
  "validation-fixtures/foodborne-outbreak-v1-table2x2.json",
  "validation-fixtures/stratified-two-by-two-v0.5.json",
  "validation-fixtures/stratified-homogeneity-v0.7.json",
  "validation-fixtures/stratified-exact-v0.8.json",
  "validation-fixtures/stratified-operational-v0.8.json",
  "validation-fixtures/foodborne-frequency-v0.9.json",
  "validation-fixtures/foodborne-means-v0.10.json",
  "validation-fixtures/foodborne-rate-v0.11.json",
  "validation-fixtures/population-survey-v0.12.json",
  "validation-fixtures/cohort-cross-sectional-v0.13.json",
  "validation-fixtures/unmatched-case-control-v0.14.json",
  "validation-fixtures/chi-square-trend-v0.15.json",
  "validation-fixtures/foodborne-tables-stratified-v0.3.json",
  "validation-fixtures/foodborne-tables-unstratified-v0.3.json",
  "validation-fixtures/foodborne-tables-fisher-v0.5.json",
  "validation-fixtures/foodborne-tables-missing-v0.6.json",
  "build-manifest.json",
];
requiredFiles.push("sqlite3.wasm");
requiredFiles.push("duckdb-mvp.wasm", "duckdb-browser-mvp.worker.js");
requiredFiles.push("duckdb-eh.wasm", "duckdb-browser-eh.worker.js");
await Promise.all(requiredFiles.map(requireFile));

const html = await requireFile("index.html");
assert.match(html, /src=["']app\.js\?v=89["']/);
assert.match(html, /href=["']styles\.css\?v=59["']/);
assert.match(html, /id=["']study-area-dialog["']/);
assert.match(html, /id=["']main-menu["']/);
assert.match(html, /id=["']file-menu["']/);
assert.match(html, /id=["']file-exit["']/);
assert.match(html, /id=["']file-open-project["']/);
assert.match(html, /id=["']file-save-project["']/);
assert.match(html, /id=["']tools-menu["']/);
assert.match(html, /id=["']designer-file-menu["']/);
for (const menu of ["file", "edit", "view", "insert", "format", "tools", "help"]) {
  assert.match(html, new RegExp(`data-designer-menu-host=["']${menu}["']`));
}
for (const menu of ["file", "edit", "view", "tools", "help"]) {
  assert.match(html, new RegExp(`data-enter-menu-host=["']${menu}["']`));
}
for (const menu of ["file", "view", "tools", "help"]) {
  assert.match(html, new RegExp(`data-classic-menu-host=["']${menu}["']`));
}
for (const menu of ["file", "edit", "fonts"]) {
  assert.match(html, new RegExp(`data-classic-program-menu-host=["']${menu}["']`));
}
assert.match(html, /id=["']epi-map["']/);
assert.match(html, /id=["']map-offline-recovery["']/);
assert.match(html, /id=["']map-offline-reimport-file["']/);
assert.match(html, /id=["']field-rule-coordinate-group["']/);
assert.match(html, /id=["']dashboard-toolbar-commands["']/);
assert.match(html, /id=["']dashboard-canvas-menu-items["']/);
assert.match(html, /id=["']classic-command-tree["']/);
assert.match(html, /id=["']classic-message-area["']/);
assert.match(html, /id=["']classic-program-toolbar["']/);
assert.match(html, /id=["']classic-output-toolbar["']/);
assert.match(html, /id=["']classic-program-dialog["']/);
assert.match(html, /id=["']classic-program-dialog-delete["']/);
assert.match(html, /id=["']classic-command-dialog["']/);
assert.match(html, /id=["']classic-command-dialog-define["']/);
assert.match(html, /id=["']classic-command-dialog-recode["']/);
assert.match(html, /id=["']classic-command-dialog-write["']/);
assert.match(html, /id=["']classic-command-dialog-merge["']/);
assert.match(html, /id=["']classic-merge-preview-dialog["']/);
assert.match(html, /id=["']classic-delete-preview-dialog["']/);
assert.match(html, /id=["']classic-delete-records-preview-dialog["']/);
assert.match(html, /id=["']classic-undelete-records-preview-dialog["']/);
assert.match(html, /id=["']classic-command-dialog-summarize["']/);
assert.match(html, /id=["']classic-summarize-output["']/);
assert.match(html, /id=["']classic-command-dialog-graph["']/);
assert.match(html, /id=["']classic-command-dialog-set-missing["']/);
assert.match(html, /id=["']classic-graph-output["']/);
assert.match(html, /id=["']classic-program-session-status["']/);
assert.match(html, /id=["']classic-list-output["']/);
assert.match(html, /id=["']classic-program-run-selection["']/);
assert.match(html, /id=["']classic-program-printout["']/);
assert.match(html, /id=["']classic-program-search-dialog["']/);

const manifest = JSON.parse(await requireFile("build-manifest.json"));
const bundledJavaScript = (await Promise.all(manifest.outputs
  .filter((output) => output.startsWith("wasm/dist/") && output.endsWith(".js"))
  .map((output) => requireFile(output.slice("wasm/dist/".length)))))
  .join("\n");
const app = bundledJavaScript;
const formData = bundledJavaScript;
assert.match(formData, /designer-project-storage/);
assert.match(formData, /New Project from Template/);
assert.match(formData, /Import Browser Data File/);
assert.match(app, /Add Analysis Gadget/);
assert.match(app, /dashboard-menu-epi-curve/);
assert.match(app, /User-Defined Commands/);
assert.match(app, /classic-command-frequencies/);
assert.match(app, /Selected GRAPH command completed/);
assert.match(app, /classic-program-toolbar-run/);
assert.match(app, /classic-selected-command-v1\.0\.0/);
assert.match(app, /DISPLAY DBVARIABLES rendered/);
assert.match(app, /UNDEFINE \* GLOBAL remains fail-closed/);
assert.match(app, /Bounded IF does not silently compare Missing values/);
assert.match(app, /classic-command-assign/);
assert.match(app, /Record data was not changed/);
assert.match(app, /classic-command-select/);
assert.match(app, /CANCEL SELECT/);
assert.match(app, /classic-command-sort/);
assert.match(app, /classic-command-write/);
assert.match(app, /classic-command-merge/);
assert.match(app, /MERGE preview closed without changing project records/);
assert.match(app, /explicit browser CSV download/);
assert.match(app, /CANCEL SORT/);
assert.match(app, /Clear Output/);
assert.match(app, /\.pgm7/);
assert.match(app, /saveCurrentProjectProgram/);
assert.match(app, /initializeMaps/);
assert.match(app, /initializeFormDataDemo/);
assert.match(app, /initializeSupabaseSync/);
assert.match(app, /initializeEpiAssist/);
assert.match(app, /calculateStratifiedTable2x2InWorker/);
assert.match(app, /deriveFrequency/);
assert.match(app, /deriveMeans/);
assert.match(app, /deriveRate/);
assert.match(app, /calculatePopulationSurvey/);
assert.match(app, /calculateCohortSampleSize/);
assert.match(app, /calculateUnmatchedCaseControl/);
assert.match(app, /calculateChiSquareTrend/);
const maps = bundledJavaScript;
assert.match(maps, /MAP_PANE_Z_INDEX/);
assert.match(maps, /aggregateH3Cells/);
assert.match(maps, /addRasterLayer/);

assert.equal(manifest.schemaVersion, 1);
assert.ok(manifest.sourceModules.includes("wasm/demo/app.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/form-data.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/engine.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/shell.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/stratified-worker.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/stratified-worker-client.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/supabase-sync.ts"));
assert.ok(manifest.outputs.includes("wasm/dist/app.js"));

const outputListing = JSON.stringify(manifest);
assert.doesNotMatch(outputListing, /\.secrets|gitlab_access_token/i);
console.log(`Production artifact baseline passed (${requiredFiles.length} required files).`);
