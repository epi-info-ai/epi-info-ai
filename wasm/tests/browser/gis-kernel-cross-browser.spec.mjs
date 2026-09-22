import { expect, test } from "@playwright/test";
import { zipSync } from "fflate";

function referenceZip(entries) {
  return zipSync(Object.fromEntries(entries.map((name) => [name, new Uint8Array([1])] )));
}

async function openReferenceDialog(page, bytes, name = "reference.zip") {
  await page.goto("/index.html");
  await page.getByRole("button", { name: "Create Maps", exact: true }).click();
  await page.locator("#map-add-layer-menu").locator("summary").click();
  await page.locator("#map-add-reference-layer").click();
  const dialog = page.locator("#reference-layer-dialog");
  await dialog.locator("#reference-layer-file").setInputFiles({ name, mimeType: "application/zip", buffer: Buffer.from(bytes) });
  return dialog;
}

test("K04 reference preflight exposes incomplete bundles across browser engines", async ({ page }) => {
  const dialog = await openReferenceDialog(page, referenceZip(["toledo.shp", "toledo.shx"]));
  await expect(dialog.locator("#reference-layer-candidate")).toHaveValue("");
  await expect(dialog.locator("#reference-layer-candidate option").filter({ hasText: "incomplete" })).toHaveText(/incomplete/);
  await expect(dialog.locator("#reference-layer-review")).toBeDisabled();
  await expect(dialog.locator("#reference-layer-diagnostics")).toContainText("missing");
});

test("K04 reference preflight exposes a complete Shapefile bundle across browser engines", async ({ page }) => {
  const dialog = await openReferenceDialog(page, referenceZip(["toledo.shp", "toledo.shx", "toledo.dbf", "toledo.prj"]));
  await expect(dialog.locator("#reference-layer-candidate")).toHaveValue("");
  await dialog.locator("#reference-layer-candidate").selectOption("shapefile:toledo");
  await dialog.locator("#reference-layer-crs").selectOption("CRS84");
  await expect(dialog.locator("#reference-layer-review")).toBeEnabled();
  await expect(dialog.locator("#reference-layer-dialog-status")).toContainText("candidate layer found");
});
