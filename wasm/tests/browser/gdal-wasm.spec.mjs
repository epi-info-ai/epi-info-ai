import { expect, test } from "@playwright/test";

test("GDAL/WASM spike reprojects and validates the synthetic fixture in its Worker", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/examples/gdal-wasm/reprojection/index.html");
  await page.getByRole("button", { name: "Run GDAL/WASM spike" }).click();
  await expect(page.locator("#validation-status")).toHaveAttribute("data-state", "passed", { timeout: 60_000 });
  await expect(page.locator("#validation-status")).toContainText("3 features reprojected");
  await expect(page.locator("#download-result")).toBeEnabled();

  const receipt = JSON.parse(await page.locator("#processing-receipt").textContent());
  const output = JSON.parse(await page.locator("#output-geojson").textContent());
  expect(receipt.execution.environment).toBe("dedicated-browser-worker");
  expect(receipt.parameters.application).toBe("ogr2ogr");
  expect(receipt.parameters.arguments).toEqual([
    "-f", "GeoJSON", "-s_srs", "EPSG:3857", "-t_srs", "EPSG:4326", "-lco", "RFC7946=YES",
  ]);
  expect(receipt.source.sha256).toBe("b306f6eb24faee693aecd329a83f16eb5298d1a3348abc639fbcb0f76c7ece79");
  expect(receipt.output.featureCount).toBe(3);
  expect(receipt.output.bounds).toEqual([-83.5552, 41.6404, -83.5195, 41.6639]);
  expect(output.features).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("GDAL/WASM raster spike warps, clips, resamples, and previews the Toledo fixture", async ({ page }) => {
  await page.goto("/examples/gdal-wasm/raster/index.html");
  await page.locator("#stress-profile").selectOption("quick");
  await page.locator("#run-raster-spike").click();
  await expect(page.locator("#raster-validation-status")).toHaveAttribute("data-state", "passed", { timeout: 90_000 });
  await expect(page.locator("#raster-preview")).toBeVisible();
  await expect(page.locator("#download-raster-result")).toBeEnabled();
  const receipt = JSON.parse(await page.locator("#raster-processing-receipt").textContent());
  expect(receipt.output).toMatchObject({ crs: "EPSG:3857", width: 1024, height: 1024, bands: 1 });
  expect(receipt.output.bounds).toEqual([
    -9308535.820133535, 5101248.438166103, -9289611.50669868, 5119128.644236652,
  ]);
  expect(receipt.parameters.application).toBe("gdalwarp");
});

test("GDAL/WASM Shapefile spike creates and reopens a complete ZIP", async ({ page }) => {
  await page.goto("/examples/gdal-wasm/shapefile/index.html");
  await page.locator("#shapefile-profile").selectOption("300");
  await page.locator("#run-shapefile-spike").click();
  await expect(page.locator("#shapefile-validation")).toHaveAttribute("data-state", "passed", { timeout: 90_000 });
  const receipt = JSON.parse(await page.locator("#shapefile-receipt").textContent());
  expect(receipt.archive.entries).toEqual(expect.arrayContaining([
    "synthetic-sites.dbf", "synthetic-sites.prj", "synthetic-sites.shp", "synthetic-sites.shx",
  ]));
  expect(receipt.reopened).toMatchObject({ driver: "ESRI Shapefile", layers: 1, features: 300 });
  expect(receipt.normalized.features).toBe(300);
});

test("GDAL/WASM spatial join calibrates a Worker pool and preserves cardinality", async ({ page }) => {
  await page.goto("/examples/gdal-wasm/spatial-join/index.html");
  await page.locator("#spatial-join-profile").selectOption("1000");
  await page.locator("#spatial-join-workers").selectOption("auto");
  await page.locator("#run-spatial-join").click();
  await expect(page.locator("#spatial-join-validation")).toHaveAttribute("data-state", "passed", { timeout: 90_000 });
  const receipt = JSON.parse(await page.locator("#spatial-join-receipt").textContent());
  expect(receipt.execution).toMatchObject({ environment: "browser-worker-pool", strategy: "auto" });
  expect([1, 2, 4]).toContain(receipt.execution.workers);
  expect(receipt.calibration.probePoints).toBe(100);
  expect(receipt.calibration.probeMilliseconds).toBeGreaterThan(0);
  expect(receipt.output).toMatchObject({ joinRows: 1000, uniquePointIds: 1000, representedZones: 100 });
  expect(receipt.partitions).toHaveLength(receipt.execution.workers);
});

test("GDAL/WASM dirty-boundary spike repairs topology and preserves reviewed assignments", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/gdal-wasm/dirty-boundaries/index.html");
  await expect(page.locator("#dirty-before-map .boundary-shape")).toHaveCount(3);
  await expect(page.locator("#dirty-before-map .control-point")).toHaveCount(10);
  await page.locator("#dirty-profile").selectOption("20");
  await page.locator("#run-dirty-boundaries").click();
  await expect(page.locator("#dirty-validation")).not.toHaveAttribute("data-state", "pending", { timeout: 90_000 });
  const findings = JSON.parse(await page.locator("#dirty-findings").textContent());
  const receipt = JSON.parse(await page.locator("#dirty-receipt").textContent());
  expect(findings.mismatchSample).toEqual([]);
  await expect(page.locator("#dirty-after-map .boundary-shape")).toHaveCount(3);
  await expect(page.locator("#dirty-after-map .control-point")).toHaveCount(10);
  await expect(page.locator("#dirty-validation")).toHaveAttribute("data-state", "passed");
  await expect(page.locator("#download-repaired")).toBeEnabled();
  await expect(page.locator("#download-classified")).toBeEnabled();
  expect(findings.summary).toEqual({ boundaries: 60, invalidSources: 40, validControls: 20, controlPoints: 200, matchedExpectations: 200, mismatches: 0 });
  expect(receipt.capability).toMatchObject({ geometryValidation: "ST_IsValid", geometryRepair: "ST_MakeValid", spatialPredicate: "ST_Intersects", geosRequired: true });
  expect(receipt.execution).toMatchObject({ environment: "dedicated-browser-worker", sourceMutation: false });
  expect(receipt.assignments).toEqual({ expected: 200, actual: 200, mismatches: 0 });
  expect(errors).toEqual([]);
});

test("GDAL/WASM zonal statistics masks population raster and handles missing coverage", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/gdal-wasm/zonal-statistics/index.html");
  await page.locator("#zonal-profile").selectOption("standard");
  await page.locator("#run-zonal").click();
  await expect(page.locator("#zonal-validation")).not.toHaveAttribute("data-state", "pending", { timeout: 90_000 });
  const receipt = JSON.parse(await page.locator("#zonal-receipt").textContent());
  expect(receipt.validation.failures).toEqual([]);
  expect(receipt.validation.referenceMethod).toBe("independent-geotiff-cell-center-point-in-polygon");
  expect(receipt.validation.referenceComparisons).toHaveLength(6);
  await expect(page.locator("#zonal-validation")).toHaveAttribute("data-state", "passed");
  await expect(page.locator("#zonal-map path")).toHaveCount(6);
  await expect(page.locator("#zonal-table tbody tr")).toHaveCount(6);
  await expect(page.locator("#zonal-table tbody tr.denominator-small")).toHaveCount(1);
  await expect(page.locator("#zonal-denominator-warning")).toContainText("Z05");
  await expect(page.locator("#zonal-denominator-warning")).toContainText("not a universal suppression rule");
  await expect(page.locator("#download-zonal")).toBeEnabled();
  expect(receipt.execution).toMatchObject({ environment: "dedicated-browser-worker", zoneJobs: 6, passes: 1 });
  expect(receipt.results).toHaveLength(6);
  expect(receipt.results.find(({ zoneId }) => zoneId === "Z06")).toMatchObject({ population: 0, coveragePercent: 0, ratePer100000: null, outsideRaster: true });
  expect(receipt.denominatorReview).toMatchObject({ threshold: 5000, policy: "demonstration-review-cue-not-universal-suppression", unavailable: ["Z06"] });
  expect(receipt.denominatorReview.small.map(({ zoneId }) => zoneId)).toEqual(["Z05"]);
  expect(errors).toEqual([]);
});

test("COG range extraction replays the verified window from OPFS while offline", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/gdal-wasm/cog-offline/index.html");
  await page.locator("#run-cog-cold").click();
  await expect(page.locator("#cog-validation")).toHaveAttribute("data-state", "passed", { timeout: 90_000 });
  const coldReceipt = JSON.parse(await page.locator("#cog-receipt").textContent());
  expect(coldReceipt.failures).toEqual([]);
  expect(coldReceipt.source).toMatchObject({ bytes: 9_570_199, width: 2048, height: 1161, overviews: 3 });
  expect(coldReceipt.cold.output).toMatchObject({ width: 256, height: 256 });
  expect(coldReceipt.cold.classification).toMatchObject({ method: "five-quantile-positive-values" });
  expect(coldReceipt.cold.classification.palette).toHaveLength(5);
  expect(coldReceipt.cold.classification.breaks).toHaveLength(5);
  expect(coldReceipt.cold.classification.classCounts).toHaveLength(5);
  expect(coldReceipt.cold.classification.classCounts.every((count) => count > 0)).toBe(true);
  expect(coldReceipt.cold.transferredBytes).toBeLessThan(9_570_199 / 2);
  expect(coldReceipt.cold.records.length).toBeGreaterThan(0);
  expect(coldReceipt.cold.records.every(({ status }) => status === 206)).toBe(true);
  await expect(page.locator("#cog-preview")).toBeVisible();
  await expect(page.locator("#cog-legend span")).toHaveCount(5);
  await expect(page.locator("#run-cog-offline")).toBeEnabled();

  try {
    await context.setOffline(true);
    await page.locator("#run-cog-offline").click();
    await expect(page.locator("#cog-validation")).toHaveAttribute("data-state", "passed", { timeout: 90_000 });
    await expect(page.locator("#cog-validation")).toContainText("offline replay");
    const replayReceipt = JSON.parse(await page.locator("#cog-receipt").textContent());
    expect(replayReceipt.offlineReplay).toMatchObject({
      sourceNetworkRequests: 0,
      identicalDigest: true,
      identicalStatistics: true,
      identicalClassification: true,
    });
  } finally {
    await context.setOffline(false);
  }
  expect(errors).toEqual([]);
});

test("GeoPackage spike round-trips three explicitly selected layers in a fresh Worker", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/examples/gdal-wasm/geopackage/index.html");
  await expect(page.locator("#geopackage-layer")).toBeDisabled();
  await page.locator("#run-geopackage").click();
  await expect(page.locator("#geopackage-validation")).not.toHaveAttribute("data-state", "pending", { timeout: 90_000 });
  const state = await page.locator("#geopackage-validation").getAttribute("data-state");
  if (state !== "passed") throw new Error(`GeoPackage UI failure: ${await page.locator("#geopackage-status").textContent()}`);
  const receipt = JSON.parse(await page.locator("#geopackage-receipt").textContent());
  expect(receipt.validation.failures).toEqual([]);
  expect(receipt.execution).toMatchObject({ environment: "two-sequential-dedicated-workers", writerDestroyedBeforeReopen: true, networkInput: false });
  expect(receipt.package.driver).toBe("GeoPackage");
  expect(receipt.package.bytes).toBeGreaterThan(0);
  expect(receipt.validation.discoveredLayerNames).toEqual(["case_sites", "project_metadata", "study_areas"]);
  expect(receipt.selectionPolicy).toEqual({ automaticLayerSelection: "rejected-when-layer-count-exceeds-one", required: "explicit-discovered-layer-name" });
  expect(receipt.inventory).toHaveLength(3);
  expect(receipt.inventory.map(({ crs, name }) => [name, crs])).toEqual([
    ["case_sites", "EPSG:4326"], ["study_areas", "EPSG:4326"], ["project_metadata", "Not applicable"],
  ]);
  expect(receipt.inventory.map(({ features, name }) => [name, features])).toEqual([
    ["case_sites", 3], ["study_areas", 2], ["project_metadata", 2],
  ]);
  await expect(page.locator("#geopackage-inventory tbody tr")).toHaveCount(3);
  await expect(page.locator("#geopackage-layer")).toBeEnabled();
  await expect(page.locator("#geopackage-layer option")).toHaveCount(4);
  await expect(page.locator("#download-geopackage")).toBeEnabled();
  await page.locator("#geopackage-layer").selectOption("case_sites");
  await expect(page.locator("#download-geopackage-layer")).toBeEnabled();
  await expect(page.locator("#geopackage-map-preview circle")).toHaveCount(3);
  await expect(page.locator("#geopackage-preview-crs")).toHaveText("EPSG:4326");
  await expect(page.locator("#geopackage-json-preview")).toContainText("Niño - café");
  await page.locator("#geopackage-layer").selectOption("study_areas");
  await expect(page.locator("#geopackage-map-preview path")).toHaveCount(2);
  await page.locator("#geopackage-layer").selectOption("project_metadata");
  await expect(page.locator("#geopackage-preview-summary")).toContainText("nonspatial GeoJSON features");
  await expect(page.locator("#geopackage-preview-crs")).toHaveText("Not applicable");
  await expect(page.locator("#geopackage-json-preview")).toContainText('"geometry": null');
  expect(errors).toEqual([]);
});
