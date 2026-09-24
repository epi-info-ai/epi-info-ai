import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { zipSync } from "fflate";

function putInt32BE(bytes, offset, value) { bytes[offset] = (value >>> 24) & 255; bytes[offset + 1] = (value >>> 16) & 255; bytes[offset + 2] = (value >>> 8) & 255; bytes[offset + 3] = value & 255; }
function putInt32LE(bytes, offset, value) { new DataView(bytes.buffer).setInt32(offset, value, true); }
function putFloat64LE(bytes, offset, value) { new DataView(bytes.buffer).setFloat64(offset, value, true); }
function shapefileHeader(fileLengthWords) {
  const bytes = new Uint8Array(100);
  putInt32BE(bytes, 0, 9994); putInt32BE(bytes, 24, fileLengthWords); putInt32LE(bytes, 28, 1000); putInt32LE(bytes, 32, 1);
  putFloat64LE(bytes, 36, -83.55); putFloat64LE(bytes, 44, 41.64); putFloat64LE(bytes, 52, -83.55); putFloat64LE(bytes, 60, 41.64);
  return bytes;
}
function onePointShapefileZip() {
  const shp = new Uint8Array(128); shp.set(shapefileHeader(64)); putInt32BE(shp, 100, 1); putInt32BE(shp, 104, 10); putInt32LE(shp, 108, 1); putFloat64LE(shp, 112, -83.55); putFloat64LE(shp, 120, 41.64);
  const shx = new Uint8Array(108); shx.set(shapefileHeader(54)); putInt32BE(shx, 100, 50); putInt32BE(shx, 104, 10);
  const dbf = new Uint8Array(76); dbf[0] = 3; dbf[1] = 126; dbf[2] = 9; dbf[3] = 22; new DataView(dbf.buffer).setUint32(4, 1, true); new DataView(dbf.buffer).setUint16(8, 65, true); new DataView(dbf.buffer).setUint16(10, 11, true); dbf.set(new TextEncoder().encode("id"), 11); dbf[13] = 67; dbf[16] = 10; dbf[32] = 10; dbf[64] = 13; dbf[65] = 32; dbf[66] = 49; dbf[75] = 26;
  const prj = new TextEncoder().encode('GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]');
  return zipSync({ "toledo.shp": shp, "toledo.shx": shx, "toledo.dbf": dbf, "toledo.prj": prj });
}

test("GIS-K02 inspects a bounded GeoJSON fixture in its Worker", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/gis-kernel-spike.html");
  await page.getByRole("button", { name: "Run bounded inspection" }).click();
  await expect(page.locator("#inspect-status")).toHaveAttribute("data-state", "passed", { timeout: 30_000 });
  const result = JSON.parse(await page.locator("#inspect-result").textContent());
  expect(result.status).toBe("succeeded");
  expect(result.data).toMatchObject({ format: "GeoJSON", layerCount: 1, featureCount: 12, geometryTypes: ["Point"], fields: ["health_event", "heat_category", "observation_id"], extent: [-77.0431, 38.8699, -77.0137, 38.9382] });
  expect(result.receipt).toMatchObject({ operation: "gis.dataset.inspect", validationStatus: "candidate", terminalStatus: "succeeded" });
  await expect(page.locator("#result-features")).toHaveText("12");
  await expect(page.locator("#result-operation")).toHaveText("gis.dataset.inspect");
  expect(errors).toEqual([]);
});

test("environmental capability package and teaching project remain separate imports", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/index.html");
  await page.locator("#help-menu summary").click();
  await page.locator("#help-capability-packages").click();
  const packages = page.getByRole("dialog", { name: "Capability Packages" });
  await packages.getByRole("button", { name: "Preview package" }).click();
  await expect(packages.locator("#capability-package-preview-title")).toHaveText("Environmental Epidemiology");
  await expect(packages.locator("#capability-package-preview-authority")).toContainText("No execution");
  await packages.locator("#capability-package-install").click();
  await expect(packages.locator("#capability-package-status")).toContainText("installed as inert assets");
  await expect(packages.locator("#capability-package-installed-summary")).toContainText("Environmental Epidemiology");
  await packages.getByRole("button", { name: "Close" }).first().click();
  await expect(packages).not.toBeVisible();
  await page.locator("#help-menu summary").click();
  await page.locator("#help-capability-packages").click();
  await packages.getByRole("button", { name: "Close" }).last().click();
  await expect(packages).not.toBeVisible();

  await page.getByRole("navigation", { name: "Application menu" }).getByText("File", { exact: true }).click();
  await page.getByRole("menuitem", { name: /Import Example Project/ }).click();
  const projects = page.getByRole("dialog", { name: "Import Example Project" });
  await expect(projects.getByRole("button", { name: "Import Environmental Heat and Health Candidate" })).toBeVisible();
  await projects.getByRole("button", { name: "Import Environmental Heat and Health Candidate" }).click();
  await expect(page.locator("#main-menu-status")).toContainText("Imported Environmental Heat and Health Candidate");
  await page.getByRole("button", { name: "Create Maps", exact: true }).click();
  await expect(page.locator("#map-status")).toContainText(/project map|point/i);
  const packagedPointLayer = page.locator('[data-geojson-layer-id="environmental-observation-reference"]');
  await expect(packagedPointLayer.locator('input[data-geojson-toggle="environmental-observation-reference"]')).toHaveCount(1);
  await expect(packagedPointLayer.locator('input[data-geojson-label-toggle="environmental-observation-reference"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Classic Analysis", exact: true }).click();
  await page.locator("#classic-program-toolbar-open").click();
  await page.locator("#classic-program-dialog-project").selectOption("environmental-heat-health-tour");
  await page.locator("#classic-program-dialog-primary").click();
  await expect(page.locator("#classic-program-source .cm-content")).toContainText("TABLES extreme_heat health_event");
  await page.locator("#classic-program-run").click();
  await expect(page.locator("#classic-program-command-status")).toContainText("Program completed");
  await expect(page.locator('#classic-output-browser svg[data-chart-type="Bar"]:visible')).toHaveCount(1);
});

test("GIS inspection runs through the imported teaching project and Program Editor", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("navigation", { name: "Application menu" }).getByText("File", { exact: true }).click();
  await page.getByRole("navigation", { name: "Application menu" }).getByRole("menuitem", { name: /Import Example Project/ }).click();
  const dialog = page.getByRole("dialog", { name: "Import Example Project" });
  await expect(dialog.getByRole("button", { name: "Import GIS Defensive Ingestion Teaching Example" })).toBeVisible();
  await dialog.getByRole("button", { name: "Import GIS Defensive Ingestion Teaching Example" }).click();
  await expect(page.locator("#main-menu-status")).toContainText("Imported GIS Defensive Ingestion Teaching Example");
  await page.getByRole("button", { name: "Classic", exact: true }).click();
  const editor = page.locator("#classic-program-source .cm-content");
  await editor.fill(`DEFINE SelectedAsset TEXTINPUT
DIALOG "Select a GeoJSON asset" SelectedAsset READ "*.geojson"
EPIAI GIS INSPECT FILE=SelectedAsset RESULT=GisInspection CRS=CRS84`);
  await page.locator("#classic-program-run").click();
  const runtime = page.locator("#classic-runtime-dialog");
  await expect(runtime).toBeVisible();
  await runtime.locator("#classic-runtime-dialog-file").setInputFiles({
    name: "valid-control.geojson",
    mimeType: "application/geo+json",
    buffer: fs.readFileSync("wasm/demo/examples/gis-defensive-ingestion/valid-control.geojson"),
  });
  await runtime.getByRole("button", { name: "OK" }).click();
  await expect(page.locator("#classic-gis-output")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#classic-gis-output-summary")).toContainText("valid-control.geojson");
  await expect(page.locator("#classic-gis-output-command")).toHaveText("EPIAI GIS INSPECT FILE=SelectedAsset RESULT=GisInspection CRS=CRS84");
});

test("K04 reference-layer preflight reviews a GeoPackage candidate without mutation", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Create Maps", exact: true }).click();
  await page.locator("#map-add-layer-menu").locator("summary").click();
  await page.locator("#map-add-reference-layer").click();
  const dialog = page.locator("#reference-layer-dialog");
  const header = Buffer.alloc(16);
  header.write("SQLite format 3\0", 0, "ascii");
  await dialog.locator("#reference-layer-file").setInputFiles({ name: "boundaries.gpkg", mimeType: "application/geopackage+sqlite3", buffer: header });
  await expect(dialog.locator("#reference-layer-candidate option")).toHaveCount(2);
  await expect(dialog.locator("#reference-layer-dialog-status")).toContainText("1 candidate layer found");
  await dialog.locator("#reference-layer-candidate").selectOption("geopackage:root");
  await dialog.locator("#reference-layer-crs").selectOption("CRS84");
  await dialog.getByRole("button", { name: "Review Candidate" }).click();
  await expect(dialog.locator("#reference-layer-dialog-status")).toContainText("GeoPackage inspection rejected");
  await expect(page.locator("#map-status")).toHaveText("Standalone map ready.");
});

test("K04 normalization executes a reviewed Shapefile ZIP in the GDAL Worker", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Create Maps", exact: true }).click();
  await page.locator("#map-add-layer-menu").locator("summary").click();
  await page.locator("#map-add-reference-layer").click();
  const dialog = page.locator("#reference-layer-dialog");
  await dialog.locator("#reference-layer-file").setInputFiles({ name: "toledo.zip", mimeType: "application/zip", buffer: Buffer.from(onePointShapefileZip()) });
  await dialog.locator("#reference-layer-candidate").selectOption("shapefile:toledo");
  await dialog.locator("#reference-layer-crs").selectOption("CRS84");
  await dialog.getByRole("button", { name: "Review Candidate" }).click();
  await dialog.getByRole("button", { name: "Normalize to GeoJSON" }).click();
  await expect(dialog.locator("#reference-layer-dialog-status")).toContainText("Normalized and saved 1 features", { timeout: 90_000 });
  await expect(dialog.locator("#reference-layer-download")).toBeVisible();
  await expect(page.locator("#map-status")).toContainText("Added GeoJSON layer");
});

test("K04 imports, selects, and normalizes one layer from a generated GeoPackage", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/examples/gdal-wasm/geopackage/index.html");
  await page.locator("#run-geopackage").click();
  await expect(page.locator("#geopackage-validation")).toHaveAttribute("data-state", "passed", { timeout: 90_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#download-geopackage").click();
  const download = await downloadPromise;
  const packagePath = await download.path();
  if (!packagePath) throw new Error("GeoPackage download did not produce a local path.");

  await page.goto("/index.html");
  await page.getByRole("button", { name: "Create Maps", exact: true }).click();
  await page.locator("#map-add-layer-menu").locator("summary").click();
  await page.locator("#map-add-reference-layer").click();
  const dialog = page.locator("#reference-layer-dialog");
  await dialog.locator("#reference-layer-file").setInputFiles({ name: "epi-info-field-study.gpkg", mimeType: "application/geopackage+sqlite3", buffer: fs.readFileSync(packagePath) });
  await dialog.locator("#reference-layer-candidate").selectOption("geopackage:root");
  await dialog.locator("#reference-layer-crs").selectOption("CRS84");
  await dialog.getByRole("button", { name: "Review Candidate" }).click();
  await expect(dialog.locator("#reference-layer-sub-layer option")).toHaveCount(4, { timeout: 90_000 });
  await dialog.locator("#reference-layer-sub-layer").selectOption("case_sites");
  await dialog.getByRole("button", { name: "Review Selected Layer" }).click();
  await dialog.getByRole("button", { name: "Normalize to GeoJSON" }).click();
  await expect(dialog.locator("#reference-layer-dialog-status")).toContainText("Normalized and saved 3 features", { timeout: 90_000 });
  await expect(dialog.locator("#reference-layer-download")).toBeVisible();
  await expect(page.locator("#map-status")).toContainText("Added GeoJSON layer");
  const normalizedDownloadPromise = page.waitForEvent("download");
  await dialog.locator("#reference-layer-download").click();
  const normalizedDownload = await normalizedDownloadPromise;
  const normalizedPath = await normalizedDownload.path();
  if (!normalizedPath) throw new Error("Normalized GeoJSON download did not produce a local path.");
  const normalized = JSON.parse(fs.readFileSync(normalizedPath, "utf8"));
  expect(normalized.type).toBe("FeatureCollection");
  expect(normalized.features).toHaveLength(3);
  expect(normalized.features.map(({ properties }) => properties.record_id).sort()).toEqual(["CASE-001", "CASE-002", "CASE-003"]);
  expect(normalized.features.map(({ geometry }) => geometry.coordinates)).toEqual([
    [-83.53741, 41.65281], [-83.53127, 41.64892], [-83.54863, 41.65734],
  ]);
});

test("K05 Spot Map and Case Cluster teaching fixture expose diagnostics and editable state", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Create Forms", exact: true }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/gis-k05-point-layers/gis-k05-point-layer.csv");
  await expect(page.locator("#csv-form-status")).toContainText("imported 6 records");
  await page.locator("#designer-enter-data").click();
  await page.locator("#enter-open-maps").click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "Spot Map", exact: true }).click();
  const dialog = page.locator("#case-cluster-dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#map-latitude-field")).toHaveValue("latitude");
  await expect(page.locator("#map-longitude-field")).toHaveValue("longitude");
  await page.locator("#map-label-field").selectOption("description");
  await page.locator("#map-marker-style").selectOption("square");
  await page.locator("#map-marker-color").fill("#2255aa");
  await page.locator("#map-filter-field").selectOption("status");
  await page.locator("#map-filter-operator").selectOption("equals");
  await page.locator("#map-filter-value").fill("Case");
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.locator("#map-record-layer-name")).toContainText("Spot Map");
  await page.locator("#map-layer-panel-toggle").click();
  await expect(page.locator("#map-point-diagnostics-panel")).toBeVisible();
  await expect(page.locator("#map-point-diagnostics-summary")).toContainText("skipped");
  await page.locator("#map-record-layer-edit").click();
  await expect(dialog).toBeVisible();
  await expect(page.locator("#map-marker-style")).toHaveValue("square");
  await expect(page.locator("#map-filter-field")).toHaveValue("status");
  await expect(page.locator("#map-filter-value")).toHaveValue("Case");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "Case Cluster", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("K06 Choropleth teaching fixture joins values, renders a legend, and persists its layer", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Create Forms", exact: true }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/gis-k06-choropleth/county-values.csv");
  await expect(page.locator("#csv-form-status")).toContainText("imported 5 records");
  await page.locator("#designer-enter-data").click();
  await page.locator("#enter-open-maps").click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "GeoJSON Layer...", exact: true }).click();
  const geojsonDialog = page.locator("#geojson-dialog");
  await geojsonDialog.locator("#geojson-file").setInputFiles("wasm/demo/examples/gis-k06-choropleth/county-boundaries.geojson");
  await geojsonDialog.locator("#geojson-layer-name").fill("County boundaries");
  await geojsonDialog.getByRole("button", { name: "Add Layer", exact: true }).click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "Choropleth", exact: true }).click();
  const dialog = page.locator("#choropleth-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#choropleth-boundary-asset option")).toHaveCount(2);
  await dialog.locator("#choropleth-boundary-asset").selectOption({ label: "county-boundaries.geojson" });
  await expect(dialog.locator("#choropleth-boundary-key option")).toContainText(["GEOID"]);
  await dialog.locator("#choropleth-boundary-key").selectOption("GEOID");
  await dialog.locator("#choropleth-data-key").selectOption("county_fips");
  await dialog.locator("#choropleth-value-field").selectOption("case_rate");
  await dialog.locator("#choropleth-legend-title").fill("Case rate");
  await dialog.getByRole("button", { name: "Add Choropleth", exact: true }).click();
  await expect(page.locator("#map-status")).toContainText("Added Choropleth");
  await page.locator("#map-layer-panel-toggle").click();
  await expect(page.locator("#map-choropleth-layers")).toContainText("Choropleth");
  await expect(page.locator("#map-choropleth-layers")).toContainText("Case rate");
  await expect(page.locator("#map-choropleth-layers")).toContainText("diagnostic");
  await page.locator('.module-rail [data-module="forms"]').click();
  await page.locator('.module-rail [data-module="maps"]').click();
  await expect(page.locator("#map-status")).toContainText("Restored 2 project map layers", { timeout: 15_000 });
  await page.locator("#map-layer-panel-toggle").click();
  await expect(page.locator("#map-choropleth-layers")).toContainText("Case rate");
});

test("K07 Dot Density teaching fixture renders dots, diagnostics, and restores", async ({ page }) => {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Create Forms", exact: true }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/gis-k07-dot-density/county-values.csv");
  await expect(page.locator("#csv-form-status")).toContainText("imported 3 records");
  await page.locator("#designer-enter-data").click();
  await page.locator("#enter-open-maps").click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "GeoJSON Layer...", exact: true }).click();
  const geojsonDialog = page.locator("#geojson-dialog");
  await geojsonDialog.locator("#geojson-file").setInputFiles("wasm/demo/examples/gis-k07-dot-density/county-boundaries.geojson");
  await geojsonDialog.getByRole("button", { name: "Add Layer", exact: true }).click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "Dot Density", exact: true }).click();
  const dialog = page.locator("#dot-density-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("#dot-density-boundary-asset").selectOption({ label: "county-boundaries.geojson" });
  await dialog.locator("#dot-density-boundary-key").selectOption("GEOID");
  await dialog.locator("#dot-density-data-key").selectOption("county_fips");
  await dialog.locator("#dot-density-value-field").selectOption("cases");
  await dialog.locator("#dot-density-legend-title").fill("Cases per dot");
  await dialog.getByRole("button", { name: "Add Dot Density", exact: true }).click();
  await expect(page.locator("#map-status")).toContainText("Added Dot Density");
  await page.locator("#map-layer-panel-toggle").click();
  await expect(page.locator("#map-dot-density-layers")).toContainText("Dot Density");
  await expect(page.locator("#map-dot-density-layers")).toContainText("Cases per dot");
  await expect(page.locator("#map-dot-density-layers")).toContainText("diagnostic");
  await page.locator('.module-rail [data-module="forms"]').click();
  await page.locator('.module-rail [data-module="maps"]').click();
  await expect(page.locator("#map-status")).toContainText("Restored 2 project map layers", { timeout: 15_000 });
  await page.locator("#map-layer-panel-toggle").click();
  await expect(page.locator("#map-dot-density-layers")).toContainText("Cases per dot");
});
