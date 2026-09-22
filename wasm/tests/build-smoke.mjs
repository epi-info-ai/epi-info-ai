import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testsDirectory = dirname(fileURLToPath(import.meta.url));
const outputDirectory = resolve(testsDirectory, "../dist");
const repositoryReadme = await readFile(resolve(testsDirectory, "../../README.md"), "utf8");

assert.match(
  repositoryReadme,
  /https:\/\/epi-info-ai-2859c9\.gitpages\.cdc\.gov\/examples\/gdal-wasm\/reprojection\/index\.html/,
  "the main README must link to the GitLab Pages GDAL/WASM validation lab",
);
assert.match(
  repositoryReadme,
  /https:\/\/epi-info-ai\.github\.io\/epi-info-ai\/examples\/gdal-wasm\/reprojection\/index\.html/,
  "the main README must link to the GitHub Pages GDAL/WASM validation lab",
);

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
  "engine-manifest.json",
  "engine.js",
  "engine.js.map",
  "form-data.js",
  "form-data.js.map",
  "cluster-worker.js",
  "cluster-worker.js.map",
  "cluster-worker-client.js",
  "cluster-worker-client.js.map",
  "gis-worker.js",
  "gis-worker.js.map",
  "gis-kernel-spike.js",
  "gis-kernel-spike.js.map",
  "gis-kernel-spike.html",
  "maps.js",
  "maps.js.map",
  "supabase-sync.js",
  "supabase-sync.js.map",
  "shell.js",
  "stratified-worker.js",
  "stratified-worker.js.map",
  "stratified-worker-client.js",
  "stratified-worker-client.js.map",
  "matched-worker.js",
  "matched-worker.js.map",
  "matched-worker-client.js",
  "matched-worker-client.js.map",
  "epi2x2.wasm",
  "sample-case-data.csv",
  "sample-map-layer.geojson",
  "assets/duckdb/README.md",
  "assets/duckdb/seed-v1.duckdb",
  "examples/README.md",
  "examples/program-catalogs.json",
  "examples/foodborne/README.md",
  "examples/foodborne/GIS_WORKFLOW_V0.1.md",
  "examples/foodborne/epi-info-teaching.json",
  "examples/foodborne/foodborne-outbreak-investigation.csv",
  "examples/foodborne/foodborne-outbreak-investigation.xlsx",
  "examples/foodborne/foodborne-outbreak-investigation.programs.json",
  "examples/foodborne/foodborne-dialog-tour.pgm7",
  "examples/foodborne/foodborne-investigation.runbook.json",
  "examples/foodborne/foodborne-gis-investigation.runbook.json",
  "examples/foodborne/maps/city-of-toledo-neighborhoods.geojson",
  "examples/foodborne/maps/worldpop-toledo-population-density.tif",
  "examples/cluster/README.md",
  "examples/cluster/space-time-cluster-synthetic-v0.1.csv",
  "examples/cluster/space-time-cluster-command-tour.pgm7",
  "examples/cluster/space-time-cluster-synthetic-v0.1.programs.json",
  "examples/cluster/space-time-cluster.runbook.json",
  "examples/matched-case-control/README.md",
  "examples/matched-case-control/DATA_DICTIONARY.md",
  "examples/matched-case-control/case-control-database-example.xlsx",
  "examples/matched-case-control/case-control-database-example.programs.json",
  "examples/matched-case-control/matched-case-control-command-tour.pgm7",
  "examples/matched-case-control/match-school-zero-cell.pgm7",
  "examples/matched-case-control/matched-pairs-hand-audit.csv",
  "examples/matched-case-control/matched-pairs-hand-audit.programs.json",
  "examples/matched-case-control/match-hand-audit.pgm7",
  "examples/matched-case-control/matched-pairs-no-discordance.csv",
  "examples/matched-case-control/matched-pairs-no-discordance.programs.json",
  "examples/matched-case-control/match-no-discordance.pgm7",
  "examples/matched-case-control/matched-logistic-test-data.csv",
  "examples/matched-case-control/match-pb-by-pair.pgm7",
  "examples/projects/README.md",
  "examples/projects/sample-project.epia.json",
  "examples/projects/epi-info-projects.json",
  "examples/projects/foodborne-outbreak-investigation.epia.json",
  "examples/projects/foodborne-outbreak-investigation.epia",
  "examples/projects/space-time-cluster-detection.epia.json",
  "examples/projects/gis-defensive-ingestion-teaching.epia.json",
  "examples/projects/gis-defensive-ingestion-test-cases.csv",
  "examples/recordlink/recordlink.runbook.json",
  "examples/gdal-wasm/README.md",
  "examples/gdal-wasm/THIRD_PARTY_NOTICES.md",
  "examples/gdal-wasm/LICENSE.fflate.txt",
  "examples/gdal-wasm/styles.css",
  "examples/gdal-wasm/reprojection/index.html",
  "examples/gdal-wasm/reprojection/source-sites-epsg3857.geojson",
  "examples/gdal-wasm/reprojection/expected-result.json",
  "examples/gdal-wasm/reprojection/gdal-wasm-spike.js",
  "examples/gdal-wasm/raster/index.html",
  "examples/gdal-wasm/raster/expected-result.json",
  "examples/gdal-wasm/raster/gdal-raster-spike.js",
  "examples/gdal-wasm/shapefile/index.html",
  "examples/gdal-wasm/shapefile/gdal-shapefile-spike.js",
  "examples/gdal-wasm/spatial-join/index.html",
  "examples/gdal-wasm/spatial-join/gdal-spatial-join-spike.js",
  "examples/gdal-wasm/dirty-boundaries/index.html",
  "examples/gdal-wasm/dirty-boundaries/dirty-boundaries.geojson",
  "examples/gdal-wasm/dirty-boundaries/control-points.geojson",
  "examples/gdal-wasm/dirty-boundaries/gdal-dirty-boundaries-spike.js",
  "examples/gdal-wasm/zonal-statistics/index.html",
  "examples/gdal-wasm/zonal-statistics/study-zones.geojson",
  "examples/gdal-wasm/zonal-statistics/expected-result.json",
  "examples/gdal-wasm/zonal-statistics/gdal-zonal-statistics-spike.js",
  "examples/gdal-wasm/cog-offline/index.html",
  "examples/gdal-wasm/cog-offline/toledo-population-cog.tif",
  "examples/gdal-wasm/cog-offline/gdal-cog-offline-spike.js",
  "examples/gdal-wasm/geopackage/index.html",
  "examples/gdal-wasm/geopackage/gdal-geopackage-spike.js",
  "examples/gdal-wasm/runtime/gdal3.js",
  "examples/gdal-wasm/runtime/gdal3WebAssembly.wasm",
  "examples/gdal-wasm/runtime/gdal3WebAssembly.data",
  "examples/gdal-wasm/runtime/LICENSE.gdal3.js.txt",
  "examples/gis-defensive-ingestion/README.md",
  "examples/gis-defensive-ingestion/ingestion-test-package.json",
  "examples/gis-defensive-ingestion/valid-control.geojson",
  "examples/gis-defensive-ingestion/misformatted.csv",
  "examples/gis-defensive-ingestion/corrupt-geojson.geojson",
  "examples/gis-defensive-ingestion/swapped-latitude-longitude.geojson",
  "examples/gis-defensive-ingestion/incorrect-coordinate-sign.geojson",
  "examples/gis-defensive-ingestion/out-of-range-coordinate.geojson",
  "examples/gis-defensive-ingestion/non-finite-coordinate.geojson",
  "examples/gis-defensive-ingestion/too-many-features.geojson",
  "examples/gis-defensive-ingestion/deeply-nested-geometry.geojson",
  "examples/gis-defensive-ingestion/property-limit.geojson",
  "examples/gis-defensive-ingestion/gis-defensive-ingestion-test-cases.csv",
  "examples/gis-defensive-ingestion/gis-defensive-ingestion.programs.json",
  "examples/gis-defensive-ingestion/gis-defensive-ingestion.runbook.json",
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
  "validation-fixtures/matched-pairs-contract-v0.1.json",
  "validation-fixtures/matched-pairs-boundaries-v0.1.json",
  "validation-fixtures/conditional-logistic-v0.1.json",
  "validation-fixtures/space-time-cluster-synthetic-v0.1.json",
  "validation-fixtures/space-time-cluster-synthetic-v0.1.csv",
  "validation-fixtures/chi-square-trend-v0.15.json",
  "validation-fixtures/foodborne-tables-stratified-v0.3.json",
  "validation-fixtures/foodborne-tables-unstratified-v0.3.json",
  "validation-fixtures/foodborne-tables-fisher-v0.5.json",
  "validation-fixtures/foodborne-tables-missing-v0.6.json",
  "validation-fixtures/foodborne-tables-adjusted-v0.8.json",
  "validation-fixtures/foodborne-tables-weighted-v0.9.json",
  "validation-fixtures/foodborne-tables-psuvar-v0.2.json",
  "validation-fixtures/foodborne-tables-psuvar-outtable-v0.2.json",
  "validation-fixtures/foodborne-frequency-psuvar-v0.1.json",
  "validation-fixtures/foodborne-means-psuvar-v0.1.json",
  "validation-fixtures/foodborne-means-psuvar-outtable-v0.1.json",
  "build-manifest.json",
];
requiredFiles.push("sqlite3.wasm");
requiredFiles.push("duckdb-mvp.wasm", "duckdb-browser-mvp.worker.js");
requiredFiles.push("duckdb-eh.wasm", "duckdb-browser-eh.worker.js");
await Promise.all(requiredFiles.map(requireFile));
const duckDbSeedBytes = await readFile(join(outputDirectory, "assets/duckdb/seed-v1.duckdb"));
assert.equal(duckDbSeedBytes.length, 274432, "the reviewed DuckDB seed byte length must remain pinned");
assert.equal(
  createHash("sha256").update(duckDbSeedBytes).digest("hex"),
  "eaffa154f61f16789211ac80161b0dea2cd4f79cf0e0a3413443303def9a1ffc",
  "the production DuckDB seed must match the reviewed digest",
);
const engineManifest = JSON.parse(await requireFile("engine-manifest.json"));
const engineBytes = await readFile(join(outputDirectory, "epi2x2.wasm"));
assert.equal(engineBytes.length, engineManifest.size);
assert.equal(createHash("sha256").update(engineBytes).digest("hex"), engineManifest.sha256);

const html = await requireFile("index.html");
assert.match(html, /<title>Epi Info AI<\/title>/);
assert.doesNotMatch(html, /2 x 2 Table Demo/);
assert.match(html, /src=["']app\.js\?v=114["']/);
assert.match(html, /href=["']styles\.css\?v=68["']/);
assert.match(html, /id=["']app-version["'][^>]*>v0\.1\.0</);
assert.match(html, /id=["']example-project-dialog["']/);
assert.match(html, /id=["']teaching-repository-dialog["']/);
assert.match(html, /id=["']study-area-dialog["']/);
assert.match(html, /id=["']main-menu["']/);
assert.match(html, /id=["']file-menu["']/);
assert.match(html, /id=["']file-exit["']/);
assert.match(html, /id=["']file-open-project["']/);
assert.match(html, /id=["']file-save-project["']/);
assert.match(html, /id=["']tools-menu["']/);
assert.match(html, /id=["']tools-options["']/);
assert.match(html, /id=["']application-options-dialog["']/);
assert.match(html, /id=["']application-language["']/);
assert.match(html, /id=["']help-runbooks["']/);
assert.match(html, /id=["']runbook-library-dialog["']/);
assert.match(html, /id=["']runbook-coach["']/);
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
assert.match(app, /calculateMatchedPairs/);
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
assert.ok(manifest.sourceModules.includes("wasm/demo/matched-worker.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/matched-worker-client.ts"));
assert.ok(manifest.sourceModules.includes("wasm/demo/supabase-sync.ts"));
assert.ok(manifest.outputs.includes("wasm/dist/app.js"));

const outputListing = JSON.stringify(manifest);
assert.doesNotMatch(outputListing, /\.secrets|gitlab_access_token/i);
console.log(`Production artifact baseline passed (${requiredFiles.length} required files).`);
