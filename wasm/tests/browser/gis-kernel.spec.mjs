import { expect, test } from "@playwright/test";
import fs from "node:fs";

test("GIS-K02 inspects a bounded GeoJSON fixture in its Worker", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/gis-kernel-spike.html");
  await page.getByRole("button", { name: "Run inspection" }).click();
  await expect(page.locator("#inspect-status")).toHaveAttribute("data-state", "passed", { timeout: 30_000 });
  const result = JSON.parse(await page.locator("#inspect-result").textContent());
  expect(result.status).toBe("succeeded");
  expect(result.data).toMatchObject({ format: "GeoJSON", layerCount: 1, featureCount: 2, geometryTypes: ["Point"], fields: ["case_id", "status"], extent: [-83.55, 41.64, -83.52, 41.66] });
  expect(result.receipt).toMatchObject({ operation: "gis.dataset.inspect", validationStatus: "candidate", terminalStatus: "succeeded" });
  expect(errors).toEqual([]);
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
