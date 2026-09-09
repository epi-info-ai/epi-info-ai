import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const legacySampleMdb = "wasm/source/Epi-Info-Community-Edition/Epi.Core/Projects/Sample/Sample.mdb";

function pmtilesV3HeaderFixture() {
  const varint = (value) => {
    const bytes = [];
    let remaining = value;
    do {
      const byte = remaining % 128;
      remaining = Math.floor(remaining / 128);
      bytes.push(byte | (remaining > 0 ? 0x80 : 0));
    } while (remaining > 0);
    return bytes;
  };
  const metadata = new TextEncoder().encode(JSON.stringify({
    vector_layers: [{ id: "test", fields: {}, minzoom: 0, maxzoom: 14 }],
  }));
  const vectorTile = Uint8Array.from([
    0x1a, 0x0b,
    0x0a, 0x04, 0x74, 0x65, 0x73, 0x74,
    0x78, 0x02,
    0x28, 0x80, 0x20,
  ]);
  const root = Uint8Array.from([1, 0, ...varint(357_913_941), vectorTile.length, 1]);
  const metadataOffset = 127 + root.length;
  const tileDataOffset = metadataOffset + metadata.length;
  const bytes = new Uint8Array(tileDataOffset + vectorTile.length);
  bytes.set(new TextEncoder().encode("PMTiles"), 0);
  const view = new DataView(bytes.buffer);
  view.setUint8(7, 3);
  view.setBigUint64(8, 127n, true);
  view.setBigUint64(16, BigInt(root.length), true);
  view.setBigUint64(24, BigInt(metadataOffset), true);
  view.setBigUint64(32, BigInt(metadata.length), true);
  view.setBigUint64(56, BigInt(tileDataOffset), true);
  view.setBigUint64(64, BigInt(vectorTile.length), true);
  view.setUint8(97, 1);
  view.setUint8(98, 1);
  view.setUint8(99, 1);
  view.setUint8(100, 0);
  view.setUint8(101, 14);
  view.setInt32(102, -840000000, true);
  view.setInt32(106, 410000000, true);
  view.setInt32(110, -830000000, true);
  view.setInt32(114, 420000000, true);
  bytes.set(root, 127);
  bytes.set(metadata, metadataOffset);
  bytes.set(vectorTile, tileDataOffset);
  return Buffer.from(bytes);
}

async function applyDataImportPreview(page, mode = "update-and-append") {
  const dialog = page.getByRole("dialog", { name: "Preview Data Import" });
  await expect(dialog).toBeVisible();
  await dialog.locator(`input[name="data-import-mode"][value="${mode}"]`).check();
  await dialog.getByRole("button", { name: "Apply Import" }).click();
  await expect(dialog).toBeHidden();
}

function pmtilesV3RasterFixture() {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/2p6rWQAAAABJRU5ErkJggg==", "base64");
  const root = Buffer.from([1, 0, 1, png.length, 1]);
  const bytes = new Uint8Array(127 + root.length + png.length);
  bytes.set(new TextEncoder().encode("PMTiles"), 0);
  const view = new DataView(bytes.buffer);
  view.setUint8(7, 3);
  view.setBigUint64(8, 127n, true);
  view.setBigUint64(16, BigInt(root.length), true);
  view.setBigUint64(24, BigInt(127 + root.length), true);
  view.setBigUint64(32, 0n, true);
  view.setBigUint64(56, BigInt(127 + root.length), true);
  view.setBigUint64(64, BigInt(png.length), true);
  view.setUint8(97, 1);
  view.setUint8(98, 1);
  view.setUint8(99, 2);
  view.setUint8(100, 0);
  view.setUint8(101, 14);
  view.setInt32(102, -840000000, true);
  view.setInt32(106, 410000000, true);
  view.setInt32(110, -830000000, true);
  view.setInt32(114, 420000000, true);
  bytes.set(root, 127);
  bytes.set(png, 127 + root.length);
  return Buffer.from(bytes);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#main-menu-title")).toBeAttached();
});

async function openClassicDeveloperControls(page) {
  const controls = page.locator("#classic-direct-controls");
  if (!(await controls.evaluate((element) => element.open))) await controls.locator("summary").click();
}

async function createOfflineRasterProject(page, projectName) {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await projectDialog.getByLabel("Database name").fill(projectName);
  await projectDialog.getByRole("button", { name: "Define Study Area...", exact: true }).click();
  const studyAreaDialog = page.getByRole("dialog", { name: "Preview Study Area" });
  await studyAreaDialog.getByLabel("Study area name").fill("Toledo recovery area");
  for (const [label, value] of [["West", "-83.75000"], ["South", "41.50000"], ["East", "-83.45000"], ["North", "41.75000"]]) {
    await studyAreaDialog.getByLabel(label, { exact: true }).fill(value);
  }
  await studyAreaDialog.getByLabel("Offline map source").selectOption("browser-pmtiles");
  await studyAreaDialog.getByLabel("PMTiles v3 file").setInputFiles({
    name: "toledo-recovery.pmtiles",
    mimeType: "application/octet-stream",
    buffer: pmtilesV3RasterFixture(),
  });
  await studyAreaDialog.getByLabel("Map attribution").fill("Recovery test contributors");
  await studyAreaDialog.getByLabel("Data license or terms reference").fill("Test-only fixture");
  await studyAreaDialog.getByRole("button", { name: "Validate Archive" }).click();
  await studyAreaDialog.getByRole("button", { name: "Apply Study Area" }).click();
  await projectDialog.getByRole("button", { name: "Create", exact: true }).click();
  return page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.project-state.v1")));
}

test("legacy application menus expose familiar workflows", async ({ page }) => {
  const applicationMenu = page.getByRole("navigation", { name: "Application menu" });

  await applicationMenu.getByText("File", { exact: true }).click();
  await expect(applicationMenu.getByRole("menuitem", { name: "Open Project" })).toBeVisible();
  await expect(applicationMenu.getByRole("menuitem", { name: "Save Project As" })).toBeVisible();
  await expect(applicationMenu.getByRole("menuitem", { name: "Exit" })).toBeVisible();

  await applicationMenu.getByText("View", { exact: true }).click();
  const statusBarCommand = applicationMenu.getByRole("menuitemcheckbox", { name: "Status Bar" });
  await expect(statusBarCommand).toHaveAttribute("aria-checked", "true");
  await statusBarCommand.click();
  await expect(page.locator("#main-menu-status")).toBeHidden();

  await applicationMenu.getByText("View", { exact: true }).click();
  await statusBarCommand.click();
  await expect(page.locator("#main-menu-status")).toBeVisible();

  await applicationMenu.getByText("Tools", { exact: true }).click();
  await applicationMenu.getByRole("menuitem", { name: "Create Forms" }).click();
  await expect(page.getByRole("heading", { name: "Form Designer" })).toBeVisible();
});

test("Help runbook guides a dataset-matched foodborne Program Editor workflow", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  const applicationMenu = page.getByRole("navigation", { name: "Application menu" });
  await applicationMenu.getByText("Help", { exact: true }).click();
  await applicationMenu.getByRole("menuitem", { name: /Automated Runbooks/ }).click();
  const library = page.getByRole("dialog", { name: "Automated Runbooks" });
  await expect(library).toBeVisible();
  await expect(library.locator("#runbook-prerequisite")).toContainText("96 example records");
  await library.getByRole("button", { name: "Start Runbook" }).click();

  const coach = page.locator("#runbook-coach");
  await expect(coach).toBeVisible();
  await expect(page.locator('[data-module="classic"]')).toHaveAttribute("aria-current", "page");
  await expect(coach.locator("#runbook-progress")).toHaveText("Step 1 of 8");
  await expect(page.locator("#classic-program-title")).toHaveClass(/runbook-highlight/);

  await coach.getByRole("button", { name: "Next" }).click();
  await expect(page.locator("#classic-program-toolbar-open")).toHaveClass(/runbook-highlight/);
  await page.locator("#classic-program-toolbar-open").click();
  await expect(coach.locator("#runbook-step-title")).toHaveText("Choose a foodborne program");
  await expect(page.locator("#classic-program-dialog")).toBeVisible();
  await expect(coach.getByRole("button", { name: "Next" })).toBeEnabled();
  await page.locator("#classic-program-example").selectOption("life-stage-by-sex");
  await expect(coach.locator("#runbook-step-title")).toHaveText("Load visible source");
  await page.locator("#classic-program-load-example").click();
  await expect(coach.locator("#runbook-step-title")).toHaveText("Verify the typed program");
  await expect(page.locator("#classic-program-source")).toContainText("FREQ AgeGroup STRATAVAR=Sex");
  await coach.locator("#runbook-stop").click();
  await expect(coach).toBeHidden();
  await expect(page.locator(".runbook-highlight")).toHaveCount(0);
});

test("Help runbook accepts the saved-project Open Pgm path and never traps Next", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await page.locator("#classic-program-toolbar-open").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-file").setInputFiles("wasm/demo/examples/foodborne-classic-command-tour.pgm7");
  await page.locator("#classic-program-toolbar-save").click();
  await page.locator("#classic-program-dialog-primary").click();
  await expect(page.locator("#classic-program-dialog")).toBeHidden();
  await expect(page.locator("#classic-program-document-state")).toContainText("saved");

  await page.locator("#help-menu summary").click();
  await page.locator("#help-runbooks").click();
  await page.locator("#runbook-start").click();
  const coach = page.locator("#runbook-coach");
  await coach.getByRole("button", { name: "Next" }).click();
  await page.locator("#classic-program-toolbar-open").click();
  await expect(coach.locator("#runbook-step-title")).toHaveText("Choose a foodborne program");
  await page.locator("#classic-program-dialog-project").selectOption({ label: "foodborne-classic-command-tour" });
  await expect(coach.locator("#runbook-step-title")).toHaveText("Load visible source");
  await page.locator("#classic-program-dialog-primary").click();
  await expect(coach.locator("#runbook-step-title")).toHaveText("Verify the typed program");
  await expect(coach.getByRole("button", { name: "Next" })).toBeEnabled();
});

test("File menu opens and saves the migrated official Sample project", async ({ page }) => {
  await page.locator("#project-package-open").setInputFiles("wasm/demo/examples/sample-project.epia.json");
  await expect(page.locator("#main-menu-status")).toContainText("Opened Sample");

  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await expect(page.locator("#project-tree-name")).toContainText("Sample");
  await expect(page.locator("#form-name")).toHaveValue("Oswego");
  const designerMenu = page.getByRole("navigation", { name: "Form Designer menu" });
  await designerMenu.getByText("File", { exact: true }).click();
  await designerMenu.getByRole("menuitem", { name: "Recent Projects", exact: true }).click();
  await expect(designerMenu.getByRole("menuitem", { name: "Browser Project", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("navigation", { name: "Application menu" }).getByText("File", { exact: true }).click();
  await page.getByRole("menuitem", { name: "Save Project As" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Sample.epia");
});

for (const viewport of [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`familiar launcher remains usable at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.reload();

    await expect(page.locator(".brand-copy strong")).toContainText("Epi Info");
    await expect(page.getByText("Local demo", { exact: true })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Application menu" })).toBeVisible();

    const createForms = page.locator("#main-menu").getByRole("button", { name: "Create Forms" });
    const createMaps = page.locator("#main-menu").getByRole("button", { name: "Create Maps" });
    await expect(createForms).toBeVisible();
    await expect(createMaps).toBeVisible();

    const launcherOrder = await page.locator("#main-menu .legacy-launch-button").allTextContents();
    expect(launcherOrder.map((label) => label.trim())).toEqual([
      "Create Forms",
      "Enter Data",
      "Classic",
      "Visual Dashboard",
      "Create Maps",
      "Epi Info Website",
      "Exit",
    ]);

    for (const control of [createForms, createMaps]) {
      const box = await control.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    if (viewport.width < 961) {
      const fileMenu = page.getByRole("navigation", { name: "Application menu" }).getByText("File", {
        exact: true,
      });
      const menuBox = await fileMenu.boundingBox();
      expect(menuBox?.width).toBeGreaterThanOrEqual(44);
      expect(menuBox?.height).toBeGreaterThanOrEqual(44);
    }

    const hasBodyOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasBodyOverflow).toBe(false);
  });
}

test("keyboard focus and status feedback remain visible", async ({ page }) => {
  const createForms = page.locator("#main-menu").getByRole("button", { name: "Create Forms" });
  await createForms.focus();
  const focusStyle = await createForms.evaluate((element) => {
    const style = getComputedStyle(element);
    return { boxShadow: style.boxShadow, outlineStyle: style.outlineStyle };
  });
  expect(focusStyle.boxShadow === "none" && focusStyle.outlineStyle === "none").toBe(false);

  const status = page.getByRole("status");
  await expect(status).toBeVisible();
  await expect(status).toHaveText("Ready");
});

test("phone Enter Data keeps record entry primary and line list reachable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator("#main-menu").getByRole("button", { name: "Enter Data" }).click();

  const switcher = page.getByLabel("Enter Data views");
  const entryPanel = page.locator("#entry-form-panel");
  const recordsPanel = page.locator("#records-panel");
  await expect(switcher).toBeVisible();
  await expect(entryPanel).toBeVisible();
  await expect(recordsPanel).toBeHidden();

  const promptOrder = await page.locator("#record-fields .record-field").evaluateAll((labels) =>
    labels.map((label) => label.childNodes[0]?.textContent?.trim()),
  );
  expect(promptOrder).toEqual(["Case ID", "Onset date", "Ill", "Primary exposure", "Age"]);

  const caseId = entryPanel.locator('input[name="case_id"]');
  await entryPanel.getByRole("button", { name: "Save record" }).click();
  expect(await caseId.evaluate((input) => input.validationMessage)).not.toBe("");

  await caseId.fill("PHONE-001");
  await entryPanel.locator('select[name="ill"]').selectOption("Yes");
  await entryPanel.getByRole("button", { name: "Save record" }).click();
  await expect(page.locator("#record-status")).toHaveText("Record saved locally.");
  await expect(page.locator("#mobile-record-count")).toHaveText("(1)");

  await switcher.getByRole("button", { name: /Saved records/ }).click();
  await expect(entryPanel).toBeHidden();
  await expect(recordsPanel).toBeVisible();
  await expect(recordsPanel.getByText("PHONE-001", { exact: true })).toBeVisible();

  await page.locator("#csv-import").setInputFiles("wasm/demo/sample-case-data.csv");
  await applyDataImportPreview(page);
  await expect(page.locator("#csv-status")).toContainText("appended 3");
  await expect(page.locator("#mobile-record-count")).toHaveText("(4)");
});

test("Form Designer creates forms from TSV and JSON records", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  const input = page.locator("#form-csv-import");
  const status = page.locator("#csv-form-status");

  await input.setInputFiles({
    name: "case-line-list.tsv",
    mimeType: "text/tab-separated-values",
    buffer: Buffer.from("Case ID\tAge\tIll\nTSV-001\t42\tYes\n"),
  });
  await expect(status).toContainText("Created 3 fields from case-line-list.tsv.");
  await expect(page.locator("#field-list tr")).toHaveCount(3);

  await input.setInputFiles({
    name: "case-line-list.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([
      { "Case ID": "JSON-001", Age: 31, Ill: true },
      { "Case ID": "JSON-002", Age: 54, Ill: false },
    ])),
  });
  await expect(status).toContainText("Created 3 fields from case-line-list.json.");
});

test("Form Designer parses an Excel workbook instead of treating it as CSV", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#form-csv-import").setInputFiles(
    "wasm/demo/examples/foodborne-outbreak-investigation.xlsx",
  );
  await expect(page.locator("#csv-form-status")).toContainText(
    "from foodborne-outbreak-investigation.xlsx.",
  );
  await expect(page.locator("#field-list tr")).toHaveCount(27);
});

test("Enter Data imports JSON through the same validated record path", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Enter Data" }).click();
  await page.locator("#csv-import").setInputFiles({
    name: "one-case.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify([{
      case_id: "JSON-101",
      onset_date: "2026-08-26",
      ill: "Yes",
      exposure: "Community event",
      age: 38,
    }])),
  });
  await applyDataImportPreview(page);
  await expect(page.locator("#csv-status")).toContainText("appended 1");
  await expect(page.locator("#record-count")).toHaveText("(1)");
});

test("Enter Data imports the canonical foodborne coordinates into its inferred form", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields from foodborne-outbreak-investigation.csv");

  await page.locator("#designer-enter-data").click();
  await expect(page.locator("#record-count")).toHaveText("(0)");
  await page.locator("#csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await applyDataImportPreview(page);
  await expect(page.locator("#csv-status")).toContainText("appended 96");
  await expect(page.locator("#record-count")).toHaveText("(96)");
  await expect(page.locator("#records-body tr").first()).toContainText("41.67230");
  await expect(page.locator("#records-body tr").first()).toContainText("-83.61450");
});

test("Enter Data previews and safely rejects a blind repeat-file append", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields from foodborne-outbreak-investigation.csv");
  await page.locator("#designer-enter-data").click();

  const file = "wasm/demo/examples/foodborne-outbreak-investigation.csv";
  await page.locator("#csv-import").setInputFiles(file);
  const dialog = page.getByRole("dialog", { name: "Preview Data Import" });
  await expect(dialog.locator("#data-import-preview-new")).toHaveText("96");
  await expect(dialog.locator("#data-import-preview-key")).toHaveValue("id");
  await applyDataImportPreview(page);
  await expect(page.locator("#record-count")).toHaveText("(96)");

  await page.locator("#csv-import").setInputFiles(file);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#data-import-preview-warning")).toContainText("exact file was imported previously");
  await expect(dialog.locator("#data-import-preview-matching")).toHaveText("96");
  await expect(dialog.locator("#data-import-preview-unchanged")).toHaveText("96");
  await expect(dialog.locator("#data-import-preview-new")).toHaveText("0");
  await expect(dialog.getByRole("button", { name: "Apply Import" })).toBeDisabled();
  await dialog.locator('input[name="data-import-mode"][value="append-new"]').check();
  await dialog.getByRole("button", { name: "Apply Import" }).click();
  await expect(page.locator("#record-count")).toHaveText("(96)");
  await expect(page.locator("#csv-status")).toContainText("appended 0 new and ignored 96 matching");
});

test("Data Packager creates an authenticated package and reviews it before import", async ({ page }) => {
  test.setTimeout(60_000);
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("imported 96 records");
  await page.locator("#designer-enter-data").click();

  const enterMenu = page.getByRole("navigation", { name: "Enter Data menu" });
  await enterMenu.getByText("File", { exact: true }).click();
  await enterMenu.getByRole("menuitem", { name: "Package For Transport", exact: true }).click();
  const packageDialog = page.getByRole("dialog", { name: "Package Data for Transport" });
  await expect(packageDialog).toBeVisible();
  await expect(packageDialog.locator("#package-record-count")).toHaveText("96");
  await packageDialog.locator("#package-remove-fields").selectOption("nausea");
  await packageDialog.locator("#package-passphrase").fill("field-demo-passphrase");
  await packageDialog.locator("#package-passphrase-verify").fill("field-demo-passphrase");
  const downloadPromise = page.waitForEvent("download");
  await packageDialog.getByRole("button", { name: "Package", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.epiax$/);
  await expect(packageDialog.locator("#package-transport-status")).toContainText("Package creation complete: 96 records, 1 field blanked");
  const downloadedPath = await download.path();
  expect(downloadedPath).toBeTruthy();
  const encryptedPackage = {
    name: download.suggestedFilename(),
    mimeType: "application/vnd.epi-info-ai.encrypted-project",
    buffer: await readFile(downloadedPath),
  };
  await packageDialog.locator(".legacy-dialog-actions button[value=cancel]").click();

  await enterMenu.getByText("File", { exact: true }).click();
  await enterMenu.getByRole("menuitem", { name: "Import Data", exact: true }).click();
  await enterMenu.getByRole("menuitem", { name: "From Data Package", exact: true }).click();
  const importDialog = page.getByRole("dialog", { name: "Import Encrypted Data Package" });
  await importDialog.locator("#data-package-file").setInputFiles(encryptedPackage);
  await importDialog.locator("#data-package-passphrase").fill("field-demo-passphrase");
  await importDialog.getByRole("button", { name: "Review Import" }).click();

  const preview = page.getByRole("dialog", { name: "Preview Data Import" });
  await expect(preview).toBeVisible();
  await expect(preview.locator("#data-import-preview-matching")).toHaveText("96");
  await expect(preview.locator("#data-import-preview-unchanged")).toHaveText("96");
  await applyDataImportPreview(page);
  await expect(page.locator("#record-count")).toHaveText("(96)");
  await expect(page.locator("#csv-status")).toContainText("left 96 unchanged");

  await enterMenu.getByText("File", { exact: true }).click();
  await enterMenu.getByRole("menuitem", { name: "Secure Epi Info Share...", exact: true }).click();
  const shareDialog = page.getByRole("dialog", { name: /Secure Epi Info Share/ });
  await expect(shareDialog.locator("#secure-share-send-selection")).toContainText(download.suggestedFilename());
  await shareDialog.locator("#secure-share-create-offer").click();
  await expect.poll(async () => {
    if (await shareDialog.locator("#secure-share-send-offer").inputValue()) return "ready";
    return (await shareDialog.locator("#secure-share-send-status").textContent())?.includes("could not create a direct WebRTC route") ? "unavailable" : "waiting";
  }, { timeout: 12_000 }).not.toBe("waiting");
  if (!await shareDialog.locator("#secure-share-send-offer").inputValue()) {
    test.skip(true, "The CI runner exposes no direct WebRTC route; authenticated package/import assertions completed before this capability skip.");
  }
  const offer = await shareDialog.locator("#secure-share-send-offer").inputValue();
  expect(offer).not.toBe("");
  await expect(shareDialog.locator("#secure-share-send-fingerprint")).not.toHaveText("Not created");
  await shareDialog.locator("#secure-share-receive-offer").fill(offer);
  await shareDialog.locator("#secure-share-create-answer").click();
  await expect(shareDialog.locator("#secure-share-receive-answer")).not.toHaveValue("");
  const answer = await shareDialog.locator("#secure-share-receive-answer").inputValue();
  expect(answer).not.toBe("");
  await expect(shareDialog.locator("#secure-share-receive-fingerprint")).not.toHaveText("Not created");
  await shareDialog.locator("#secure-share-send-answer").fill(answer);
  await shareDialog.locator("#secure-share-accept-answer").click();
  await expect(shareDialog.locator("#secure-share-review-received")).toBeEnabled({ timeout: 15_000 });
  await expect(shareDialog.locator("#secure-share-receive-status")).toContainText("received and verified");
  await shareDialog.locator("#secure-share-receive-passphrase").fill("field-demo-passphrase");
  await shareDialog.locator("#secure-share-review-received").click();
  await expect(preview).toBeVisible();
  await expect(preview.locator("#data-import-preview-warning")).toContainText("exact file was imported previously");
  await expect(preview.getByRole("button", { name: "Apply Import" })).toBeDisabled();
  await preview.locator('.legacy-dialog-actions button[value="cancel"]').click();
});

test("Form Designer authors a safe conditional skip and Enter follows it", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  const illRow = page.locator("#field-list tr").nth(2);
  await illRow.getByRole("button", { name: /Rules/ }).click();
  const rulesDialog = page.getByRole("dialog", { name: "Field Validation and Check Code" });
  await expect(rulesDialog.getByText("ill", { exact: true })).toBeVisible();
  await rulesDialog.getByLabel("When").selectOption("equals");
  await rulesDialog.getByLabel("Comparison value").fill("No");
  await rulesDialog.getByLabel("Target field").selectOption("age");
  await rulesDialog.getByRole("button", { name: "OK" }).click();
  await expect(illRow.getByRole("button", { name: "Rules (1)" })).toBeVisible();
  await page.getByRole("button", { name: "Save Form" }).click();
  await expect(page.locator("#form-status")).toHaveText("Form saved.");

  await page.getByRole("button", { name: "Enter Data", exact: true }).last().click();
  await page.locator("#record-fields").getByLabel("Case ID", { exact: true }).fill("SKIP-001");
  const ill = page.locator('#record-fields select[name="ill"]');
  await ill.focus();
  await ill.selectOption("No");
  await ill.press("Tab");
  await expect(page.locator('#record-fields input[name="age"]')).toBeFocused();
  await expect(page.locator("#record-status")).toHaveText("Check Code moved to age.");
});

test("Form Designer authors calculated age and a safe field-state action", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  const rulesDialog = page.getByRole("dialog", { name: "Field Validation and Check Code" });
  const ageRow = page.locator("#field-list tr").nth(4);
  await ageRow.getByRole("button", { name: /Rules/ }).click();
  await rulesDialog.getByLabel("Date of birth/source date").selectOption("onset_date");
  await rulesDialog.getByRole("button", { name: "OK" }).click();

  const illRow = page.locator("#field-list tr").nth(2);
  await illRow.getByRole("button", { name: /Rules/ }).click();
  await rulesDialog.getByLabel("When").selectOption("equals");
  await rulesDialog.getByLabel("Comparison value").fill("No");
  await rulesDialog.getByLabel("Action").selectOption("disable");
  await rulesDialog.getByLabel("Target field").selectOption("exposure");
  await rulesDialog.getByRole("button", { name: "OK" }).click();
  await page.getByRole("button", { name: "Save Form" }).click();

  await page.getByRole("button", { name: "Enter Data", exact: true }).last().click();
  const sourceDate = new Date();
  sourceDate.setFullYear(sourceDate.getFullYear() - 20);
  const iso = `${sourceDate.getFullYear()}-${String(sourceDate.getMonth() + 1).padStart(2, "0")}-${String(sourceDate.getDate()).padStart(2, "0")}`;
  await page.locator("#record-fields").getByLabel("Onset date", { exact: true }).fill(iso);
  const age = page.locator('#record-fields input[name="age"]');
  await expect(age).toHaveValue("20");
  await expect(age).toHaveAttribute("readonly", "");
  const ill = page.locator('#record-fields select[name="ill"]');
  await ill.selectOption("No");
  await ill.press("Tab");
  await expect(page.locator("#record-fields").getByLabel("Primary exposure", { exact: true })).toBeDisabled();
});

test("Data Quality summarizes completeness and presents a recoverable lifecycle", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Enter Data" }).click();
  await page.locator("#record-fields").getByLabel("Case ID", { exact: true }).fill("QUALITY-001");
  await page.locator('#record-fields select[name="ill"]').selectOption("Yes");
  await page.locator("#entry-form-panel").getByRole("button", { name: "Save record" }).click();
  await page.getByRole("button", { name: "Data Quality..." }).click();
  const dialog = page.getByRole("dialog", { name: "Data Quality Check" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#data-quality-summary")).toContainText("1 record");
  await expect(dialog.getByRole("table").first()).toContainText("Case ID");
  await expect(dialog.getByText(/deleted records remain recoverable/i)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Restore selected record" })).toBeDisabled();
});

test("Data Quality missingness bars focus attention on incomplete foodborne fields", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="data"]').click();
  await page.getByRole("button", { name: "Data Quality..." }).click();

  const onsetBar = page.getByRole("progressbar", { name: "Onset Date: 52 of 96 records missing" });
  await expect(onsetBar).toHaveAttribute("aria-valuenow", "54.2");
  await expect(onsetBar.locator("span")).toHaveAttribute("style", /54\.166/);
  await expect(onsetBar.locator("xpath=ancestor::tr")).toHaveAttribute("data-missing-severity", "high");

  const vomitingBar = page.getByRole("progressbar", { name: "Vomiting: 2 of 96 records missing" });
  await expect(vomitingBar).toHaveAttribute("aria-valuenow", "2.1");
  await expect(vomitingBar.locator("xpath=ancestor::tr")).toHaveAttribute("data-missing-severity", "some");

  const idBar = page.getByRole("progressbar", { name: "ID: 0 of 96 records missing" });
  await expect(idBar).toHaveAttribute("aria-valuenow", "0.0");
  await expect(idBar.locator("xpath=ancestor::tr")).toHaveAttribute("data-missing-severity", "none");
});

test("Data Quality compares duplicates and supports audited delete and restore", async ({ page }) => {
  const projectPackage = {
    format: "epi-info-ai-project", version: 2, exportedAt: "2026-08-27T12:00:00.000Z",
    programs: [], codeTables: [],
    project: {
      version: 1, name: "Duplicate review", currentFormId: "cases", storage: { type: "browser" },
      forms: [{
        id: "cases",
        schema: { name: "Cases", fields: [
          { name: "case_id", prompt: "Case ID", type: "text", required: true, rules: [{ kind: "unique" }] },
          { name: "status", prompt: "Status", type: "text", required: false },
        ] },
        records: [{ case_id: "DUP-001", status: "Probable" }, { case_id: "DUP-001", status: "Confirmed" }],
      }],
    },
  };
  await page.locator("#project-package-open").setInputFiles({
    name: "duplicate-review.epia.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(projectPackage)),
  });
  await page.locator("#main-menu").getByRole("button", { name: "Enter Data" }).click();
  await page.getByRole("button", { name: "Data Quality..." }).click();
  const dialog = page.getByRole("dialog", { name: "Data Quality Check" });
  await expect(dialog.getByLabel("Duplicate candidate")).toContainText("Case ID: dup-001");
  await expect(page.locator("#data-quality-comparison")).toContainText("Probable");
  await expect(page.locator("#data-quality-comparison")).toContainText("Confirmed");
  await dialog.getByLabel(/Reason for moving/).fill("Confirmed duplicate during review");
  page.once("dialog", (confirmation) => confirmation.accept());
  await dialog.getByRole("button", { name: "Move Record A to Recycle Bin" }).click();
  await expect(dialog.getByRole("status").last()).toContainText("Recycle Bin");
  await expect(page.locator("#record-count")).toHaveText("(1)");
  await dialog.getByLabel("Recoverable deleted record").selectOption({ index: 1 });
  await dialog.getByRole("button", { name: "Restore selected record" }).click();
  await expect(page.locator("#record-count")).toHaveText("(2)");
  await expect(page.locator("#data-quality-audit-log")).toContainText("restored");
});

test("phone Form Designer exposes focused familiar views", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  const switcher = page.getByLabel("Form Designer views");
  await expect(switcher).toBeVisible();
  await expect(page.getByLabel("Form design canvas")).toBeVisible();
  await expect(page.getByLabel("Current project and forms")).toBeHidden();

  await switcher.getByRole("button", { name: "Project Explorer" }).click();
  await expect(page.getByLabel("Current project and forms")).toBeVisible();
  await expect(page.getByLabel("Form design canvas")).toBeHidden();

  await switcher.getByRole("button", { name: "Field Properties" }).click();
  await expect(page.locator("#field-list")).toBeVisible();
  await expect(page.getByLabel("Current project and forms")).toBeHidden();
});

for (const viewport of [
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`Enter Data preserves both familiar panels at ${viewport.name} width`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.reload();
    await page.locator("#main-menu").getByRole("button", { name: "Enter Data" }).click();

    await expect(page.getByLabel("Enter Data views")).toBeHidden();
    await expect(page.locator("#entry-form-panel")).toBeVisible();
    await expect(page.locator("#records-panel")).toBeVisible();

    const [entryBox, recordsBox] = await Promise.all([
      page.locator("#entry-form-panel").boundingBox(),
      page.locator("#records-panel").boundingBox(),
    ]);
    if (viewport.name === "desktop") {
      expect(Math.abs((entryBox?.y ?? 0) - (recordsBox?.y ?? 1))).toBeLessThan(2);
      expect(recordsBox?.x).toBeGreaterThan(entryBox?.x ?? 0);
    } else {
      expect(recordsBox?.y).toBeGreaterThan(entryBox?.y ?? 0);
    }
  });
}

test("Form Designer keeps legacy project commands and adds Project Storage", async ({ page }) => {
  await page.getByRole("button", { name: "Create Forms" }).click();
  const designerMenu = page.getByRole("navigation", { name: "Form Designer menu" });
  await expect(designerMenu.locator(":scope > details > summary")).toHaveText(["File", "Edit", "View", "Insert", "Format", "Tools", "Help"]);

  await designerMenu.getByText("File", { exact: true }).click();
  const fileContractOrder = await page.locator("#designer-file-menu [data-menu-command], #designer-file-menu [data-menu-submenu]").evaluateAll(
    (items) => items.map((item) => item.getAttribute("data-menu-command") ?? item.getAttribute("data-menu-submenu")),
  );
  expect(fileContractOrder).toEqual([
    "new-project", "new-project-template", "new-project-data-dictionary", "new-form", "new-page",
    "open-project", "open-project-web", "close-project", "get-template", "print", "copy-mobile",
    "publish-cloud", "publish-web", "recent-projects", "exit", "project-storage",
  ]);
  await expect(designerMenu.getByRole("menuitem", { name: /^Open Project\.\.\. Ctrl\+O$/ })).toBeEnabled();
  await expect(designerMenu.getByRole("menuitem", { name: "Close Project" })).toBeEnabled();
  await expect(designerMenu.getByRole("menuitem", { name: "Recent Projects" })).toBeDisabled();
  await expect(page.locator('#designer-file-menu [data-menu-command="new-project-template"]')).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#designer-project-storage")).toHaveAttribute("data-new-branch", "true");
  await page.locator('#designer-file-menu [data-menu-command="new-project-template"]').dispatchEvent("click");
  await expect(page.locator("#form-status")).toContainText("Legacy Form Designer command is not implemented");
  await designerMenu.getByRole("menuitem", { name: "New Project...", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Create a Project Data Store" })).toBeVisible();
  await page.keyboard.press("Escape");
  const fileChooser = page.waitForEvent("filechooser");
  await page.keyboard.press("Control+O");
  await fileChooser;

  await designerMenu.getByText("File", { exact: true }).click();
  await designerMenu.getByRole("menuitem", { name: "Project Storage" }).click();
  await expect(page.getByRole("dialog", { name: "Project Storage" })).toBeVisible();
});

test("Enter Data preserves the legacy menu contract and discloses browser branches", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Enter Data" }).click();
  const enterMenu = page.getByRole("navigation", { name: "Enter Data menu" });
  await expect(enterMenu.locator(":scope > details > summary")).toHaveText(["File", "Edit", "View", "Tools", "Help"]);

  await enterMenu.getByText("File", { exact: true }).click();
  const fileOrder = await page.locator("#enter-file-menu > .legacy-menu-popup > [data-menu-command], #enter-file-menu > .legacy-menu-popup > .legacy-contract-submenu > [data-menu-submenu]").evaluateAll(
    (items) => items.map((item) => item.getAttribute("data-menu-command") ?? item.getAttribute("data-menu-submenu")),
  );
  expect(fileOrder).toEqual([
    "new-record", "open-form", "edit-form", "close-form", "save", "import-data", "package-transport",
    "secure-share", "print", "recent-forms", "exit", "import-browser-file",
  ]);
  await expect(enterMenu.getByRole("menuitem", { name: /^Open Form\.\.\. Ctrl\+O$/ })).toHaveAttribute("aria-disabled", "true");
  await expect(enterMenu.getByRole("menuitem", { name: "Package For Transport", exact: true })).toBeEnabled();
  await expect(page.locator("#enter-menu-secure-share")).toHaveAttribute("data-new-branch", "true");
  await expect(page.locator("#enter-menu-import-file")).toHaveAttribute("data-new-branch", "true");
  await enterMenu.getByRole("menuitem", { name: "Import Data", exact: true }).click();
  await expect(enterMenu.getByRole("menuitem", { name: "From Epi Info 7 Project", exact: true })).toBeVisible();

  await page.locator('#enter-file-menu [data-menu-command="open-form"]').dispatchEvent("click");
  await expect(page.locator("#record-status")).toContainText("Legacy Enter Data command is not implemented");

  await enterMenu.getByText("View", { exact: true }).click();
  const statusBar = enterMenu.getByRole("menuitem", { name: "Status Bar", exact: true });
  await expect(statusBar).toHaveAttribute("aria-checked", "true");
  await statusBar.click();
  await expect(page.locator("#enter-statusbar")).toBeHidden();

  await enterMenu.getByText("Tools", { exact: true }).click();
  await expect(page.locator("#enter-menu-data-quality")).toHaveAttribute("data-new-branch", "true");
  await page.locator("#enter-menu-data-quality").click();
  await expect(page.getByRole("dialog", { name: "Data Quality Check" })).toBeVisible();
});

test("Visual Dashboard preserves its toolbar and right-click gadget tree", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Visual Dashboard" }).click();
  const toolbar = page.getByRole("toolbar", { name: "Visual Dashboard toolbar" });
  await expect(toolbar.getByRole("button")).toHaveText(["Refresh", "Set Data Source", "Open", "Save", "Save As"]);
  await expect(page.locator("#dashboard-toolbar-source")).toContainText("Browser Project / Outbreak Case Report Form");
  await expect(page.locator("#dashboard-toolbar-count")).toHaveText("(0 records)");
  await toolbar.getByRole("button", { name: "Set Data Source", exact: true }).dispatchEvent("click");
  await expect(page.locator("#dashboard-command-status")).toContainText("Legacy Visual Dashboard command is not implemented");

  await page.locator("#dashboard-canvas").dispatchEvent("contextmenu");
  const canvasMenu = page.getByRole("menu", { name: "Visual Dashboard canvas commands" });
  await expect(canvasMenu).toBeVisible();
  await canvasMenu.getByRole("menuitem", { name: "Add Analysis Gadget", exact: true }).click();
  await expect(canvasMenu.getByRole("menuitem", { name: "Rates", exact: true })).toBeVisible();
  await expect(canvasMenu.getByRole("menuitem", { name: "Frequency", exact: true })).toHaveAttribute("aria-disabled", "true");
  await canvasMenu.getByRole("menuitem", { name: "Rates", exact: true }).click();
  await expect(page.locator("#dashboard-command-status")).toContainText("Rates gadget selected");
  await expect(page.locator("#rates-numerator-field")).toBeFocused();

  await page.locator("#dashboard-canvas").dispatchEvent("contextmenu");
  await canvasMenu.getByRole("menuitem", { name: "Add Analysis Gadget", exact: true }).click();
  await canvasMenu.getByRole("menuitem", { name: "Charts", exact: true }).click();
  await expect(canvasMenu.getByRole("menuitem", { name: "Epi Curve chart", exact: true })).toBeVisible();
  await canvasMenu.getByRole("menuitem", { name: "Epi Curve chart", exact: true }).click();
  await expect(page.locator("#dashboard-command-status")).toContainText("Epi Curve gadget selected");
  await expect(page.locator("#epi-curve-date-field")).toBeFocused();
});

test("Classic Analysis preserves its four-menu shell and Command Explorer", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Classic", exact: true }).click();

  const explorer = page.locator(".classic-command-explorer");
  const output = page.locator(".classic-output-window");
  const editor = page.locator(".classic-program-editor");
  const [explorerBox, outputBox, editorBox] = await Promise.all([
    explorer.boundingBox(), output.boundingBox(), editor.boundingBox(),
  ]);
  expect(explorerBox).not.toBeNull();
  expect(outputBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(outputBox.x).toBeGreaterThan(explorerBox.x);
  expect(editorBox.x).toBe(outputBox.x);
  expect(editorBox.y).toBeGreaterThan(outputBox.y);
  await expect(editor.locator("#classic-message-area")).toBeAttached();
  await expect(page.locator("#classic-direct-controls")).not.toHaveAttribute("open", "");

  const menu = page.getByRole("navigation", { name: "Classic Analysis menu" });
  await expect(menu.locator("summary")).toHaveText(["File", "View", "Tools", "Help"]);
  await menu.getByText("View", { exact: true }).click();
  const explorerToggle = menu.getByRole("menuitemcheckbox", { name: "Command Explorer", exact: true });
  await expect(explorerToggle).toHaveAttribute("aria-checked", "true");
  await explorerToggle.click();
  await expect(page.locator(".classic-workspace-shell")).toHaveAttribute("data-command-explorer-collapsed", "true");
  await expect(page.locator("#classic-command-explorer-toggle")).toHaveAttribute("aria-label", "Show Command Explorer");
  await expect(page.locator("#classic-command-tree")).toHaveAttribute("aria-hidden", "true");
  await page.locator("#classic-command-explorer-toggle").click();
  await expect(page.locator(".classic-workspace-shell")).toHaveAttribute("data-command-explorer-collapsed", "false");

  const explorerResizer = page.locator("#classic-command-explorer-resizer");
  await explorerResizer.focus();
  await explorerResizer.press("ArrowRight");
  await expect(explorerResizer).toHaveAttribute("aria-valuenow", "250");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.classic-workspace-preferences.v1"))?.commandExplorerWidth)).toBe(250);

  await menu.getByText("View", { exact: true }).click();
  const statusBar = menu.getByRole("menuitemcheckbox", { name: "Status Bar", exact: true });
  await expect(statusBar).toHaveAttribute("aria-checked", "true");
  await statusBar.click();
  await expect(page.locator("#classic-statusbar")).toBeHidden();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  await expect(tree.locator("details > summary")).toHaveText([
    "Data", "Variables", "Select/If", "Statistics", "Advanced Statistics", "Output",
    "User-Defined Commands", "User Interaction", "Options", "New Branches — Epi Info AI",
  ]);

  await tree.locator("summary").filter({ hasText: /^Data$/ }).click();
  const read = tree.getByRole("treeitem", { name: "Read", exact: true });
  await expect(read).not.toHaveAttribute("aria-disabled", "true");
  await read.click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("read");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("READ");
  await page.locator("#classic-command-dialog button", { hasText: "Cancel" }).click();

  await tree.getByRole("treeitem", { name: "List", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("list");
  await expect(page.locator("#classic-command-dialog-field")).toHaveAttribute("multiple");
  await page.locator("#classic-command-dialog button", { hasText: "Cancel" }).click();

  await tree.getByRole("treeitem", { name: "Frequencies", exact: true }).click();
  await expect(page.locator("#classic-command-dialog")).toBeVisible();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("frequency");
  await page.locator("#classic-command-dialog button", { hasText: "Cancel" }).click();

  await tree.getByRole("treeitem", { name: "Means", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("means");
  await page.locator("#classic-command-dialog button", { hasText: "Cancel" }).click();
  await tree.getByRole("treeitem", { name: "Tables", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("tables");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("TABLES");
  await expect(page.locator("#classic-command-dialog-fisher-label")).toBeVisible();
  await expect(page.locator("#classic-command-dialog-weight-label")).toBeVisible();
  await expect(page.locator("#classic-command-dialog-outtable-label")).toBeVisible();
  await expect(page.locator("#classic-command-dialog-statistics-label")).toBeVisible();
  await expect(page.locator("#classic-command-dialog-one-is-yes-label")).toBeVisible();
  await page.locator("#classic-command-dialog-outtable").fill("PotatoStatusBySex");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("OUTTABLE=PotatoStatusBySex");
  await page.locator("#classic-command-dialog-fisher").check();
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("STATISTICS=FISHER");
  await page.locator("#classic-command-dialog-weight").selectOption("age");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("WEIGHTVAR=age");
  await expect(page.locator("#classic-command-dialog-fisher")).toBeDisabled();
  await page.locator("#classic-command-dialog-statistics").uncheck();
  await page.locator("#classic-command-dialog-one-is-yes").check();
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("STATISTICS=NONE");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("ONEISYES");
  await page.locator("#classic-command-dialog button", { hasText: "Cancel" }).click();

  await tree.locator("summary").filter({ hasText: /^Options$/ }).click();
  await tree.getByRole("treeitem", { name: "Set", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("set-missing");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("SET MISSING=OFF");
  await page.locator("#classic-command-dialog-include-missing").check();
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("SET MISSING=ON");
  await page.locator("#classic-command-dialog button", { hasText: "Cancel" }).click();
});

test("Form Designer preserves nested legacy Tools menu branches", async ({ page }) => {
  await page.getByRole("button", { name: "Create Forms" }).click();
  const designerMenu = page.getByRole("navigation", { name: "Form Designer menu" });
  await designerMenu.getByText("Tools", { exact: true }).click();
  await designerMenu.getByRole("menuitem", { name: "Make PRJ File", exact: true }).click();
  await expect(designerMenu.getByRole("menuitem", { name: "From Epi Info 7 project (MS Access)", exact: true })).toBeVisible();
  await expect(designerMenu.getByRole("menuitem", { name: "From Epi Info 7 project (SQLite)", exact: true })).toBeVisible();
  await expect(designerMenu.getByRole("menuitem", { name: "From Epi Info 7 project (SQL Server)", exact: true })).toBeVisible();
});

test("Form Designer safely closes, persists, and reopens a recent project", async ({ page }) => {
  await page.getByRole("button", { name: "Create Forms" }).click();
  const designerMenu = page.getByRole("navigation", { name: "Form Designer menu" });

  await designerMenu.getByText("File", { exact: true }).click();
  await designerMenu.getByRole("menuitem", { name: "Close Project" }).click();

  await expect(page.getByRole("heading", { name: "No project is open" })).toBeVisible();
  await expect(page.locator("#project-lifecycle-status")).toContainText("Project closed");
  await expect(page.locator("#new-form")).toBeDisabled();
  await expect(page.locator("#project-storage")).toBeDisabled();
  await expect(page.locator(".designer-workspace")).toBeHidden();

  await page.reload();
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await expect(page.getByRole("heading", { name: "No project is open" })).toBeVisible();

  await designerMenu.getByText("File", { exact: true }).click();
  const recent = designerMenu.getByRole("menuitem", { name: "Recent Projects", exact: true });
  await expect(recent).toBeEnabled();
  await recent.click();
  await designerMenu.getByRole("menuitem", { name: "Browser Project", exact: true }).click();

  await expect(page.getByRole("heading", { name: "No project is open" })).toBeHidden();
  await expect(page.locator("#project-tree-name")).toContainText("Browser Project");
  await expect(page.locator("#new-form")).toBeEnabled();
  await expect(page.locator(".designer-workspace")).toBeVisible();
  await expect(page.locator("#form-status")).toContainText("Opened recent project Browser Project");

  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await createDialog.getByLabel("Database name").fill("Replacement Project");
  await createDialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator("#project-tree-name")).toContainText("Replacement Project");
  await designerMenu.getByText("File", { exact: true }).click();
  await designerMenu.getByRole("menuitem", { name: "Recent Projects", exact: true }).click();
  await expect(designerMenu.getByRole("menuitem", { name: "Browser Project", exact: true })).toBeVisible();
});

test("Form Designer keeps the project open when browser autosave fails", async ({ page }) => {
  await page.getByRole("button", { name: "Create Forms" }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === "epi-info-ai.project-state.v1") throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });

  const designerMenu = page.getByRole("navigation", { name: "Form Designer menu" });
  await designerMenu.getByText("File", { exact: true }).click();
  await designerMenu.getByRole("menuitem", { name: "Close Project" }).click();

  await expect(page.getByRole("heading", { name: "No project is open" })).toBeHidden();
  await expect(page.locator(".designer-workspace")).toBeVisible();
  await expect(page.locator("#form-status")).toContainText("Project remains open");
  await expect(page.locator("#designer-close-project")).toBeEnabled();
});

test("phone project dialogs keep state and action feedback in context", async ({ page, context }) => {
  await page.route("https://demo.supabase.co/auth/v1/settings", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ external: { email: true, github: true } }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.getByRole("button", { name: "Project Storage", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Project Storage" });
  const connectionStatus = page.locator("#project-storage-status");
  const state = page.locator("#storage-state");
  await expect(dialog).toBeVisible();
  await expect(state).toHaveAttribute("data-state", "local");
  await expect(connectionStatus).toBeInViewport();

  const dialogBox = await dialog.boundingBox();
  expect(dialogBox?.width).toBeLessThanOrEqual(390);
  expect(dialogBox?.height).toBeLessThanOrEqual(844);
  expect(await page.locator("#project-storage-dialog .legacy-dialog-body").evaluate(
    (body) => getComputedStyle(body).overflowY,
  )).toBe("auto");

  const testConnection = page.getByRole("button", { name: "Test Connection" });
  const copySetup = page.getByRole("button", { name: "Copy Setup SQL" });
  for (const control of [testConnection, copySetup]) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.locator("#storage-supabase-url").fill("https://demo.supabase.co");
  await page.locator("#storage-supabase-key").fill("publishable-test-key");
  await testConnection.click();
  await expect(state).toHaveAttribute("data-state", "pending");
  await expect(testConnection).toBeDisabled();
  await expect(connectionStatus).toHaveText("Testing the Supabase connection...");
  await expect(state).toHaveAttribute("data-state", "connected");
  await expect(connectionStatus).toContainText("Supabase connection verified");

  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  const accountStatus = page.locator("#storage-account-status");
  await expect(accountStatus).toHaveText("Enter the Supabase account email and password.");
  await expect(state).toHaveAttribute("data-state", "failed");
  const [accountActionsBox, accountStatusBox] = await Promise.all([
    page.locator("#storage-sign-in").locator("xpath=..").boundingBox(),
    accountStatus.boundingBox(),
  ]);
  expect(accountStatusBox?.y).toBeGreaterThan(accountActionsBox?.y ?? 0);

  await context.setOffline(true);
  await expect(state).toHaveAttribute("data-state", "offline");
  await expect(connectionStatus).toContainText("local working copy remains available");
  await context.setOffline(false);
  await expect(state).toHaveAttribute("data-state", "local");

  await dialog.locator(".legacy-dialog-actions").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const createDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await expect(createDialog).toBeVisible();
  await expect(page.locator("#project-dialog-note")).toBeInViewport();
  const createBox = await createDialog.boundingBox();
  expect(createBox?.width).toBeLessThanOrEqual(390);
  expect(createBox?.height).toBeLessThanOrEqual(844);
});

test("New Project captures a portable study area without requiring a dataset", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.getByRole("button", { name: "New Project", exact: true }).click();

  const projectDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await projectDialog.getByLabel("Database name").fill("Toledo Offline Field Project");
  await projectDialog.getByRole("button", { name: "Define Study Area...", exact: true }).click();

  const studyAreaDialog = page.getByRole("dialog", { name: "Preview Study Area" });
  await expect(studyAreaDialog).toBeVisible();
  await expect(projectDialog).toBeHidden();
  const studyAreaDialogBox = await studyAreaDialog.boundingBox();
  expect(studyAreaDialogBox?.width).toBeLessThanOrEqual(390);
  expect(studyAreaDialogBox?.height).toBeLessThanOrEqual(844);
  const studyAreaMap = studyAreaDialog.locator("#project-study-area-map");
  await expect(studyAreaMap).toHaveClass(/leaflet-container/);
  await studyAreaDialog.getByRole("button", { name: "Draw Bounding Box" }).click();
  await studyAreaMap.click({ position: { x: 90, y: 90 } });
  await expect(studyAreaDialog.locator("#study-area-draw-status")).toContainText("opposite corner");
  await studyAreaMap.click({ position: { x: 280, y: 210 } });
  await expect(studyAreaDialog.getByLabel("West", { exact: true })).not.toHaveValue("");
  await studyAreaDialog.getByLabel("Study area name").fill("Toledo field investigation");
  await studyAreaDialog.getByLabel("West", { exact: true }).fill("-83.75000");
  await studyAreaDialog.getByLabel("South", { exact: true }).fill("41.50000");
  await studyAreaDialog.getByLabel("East", { exact: true }).fill("-83.45000");
  await studyAreaDialog.getByLabel("North", { exact: true }).fill("41.75000");
  await studyAreaDialog.getByLabel("Offline map source").selectOption("browser-pmtiles");
  await expect(studyAreaDialog.locator("#study-area-summary")).toContainText("recommended offline range 0\u201314");
  await expect(studyAreaDialog.locator("#study-area-provider-policy")).toContainText("browser OPFS");
  await expect(studyAreaDialog.locator("#study-area-package-estimate")).toContainText("358 tiles");
  await expect(studyAreaDialog.locator("#study-area-package-estimate")).toContainText("Within the 100 MiB project limit");
  await expect(studyAreaDialog.getByText("Browser cache is opportunistic, not offline coverage.")).toBeVisible();
  await studyAreaDialog.getByLabel("PMTiles v3 file").setInputFiles({
    name: "toledo-field.pmtiles",
    mimeType: "application/octet-stream",
    buffer: pmtilesV3HeaderFixture(),
  });
  await studyAreaDialog.getByLabel("Map attribution").fill("OpenStreetMap contributors");
  await studyAreaDialog.getByLabel("Data license or terms reference").fill("ODbL-1.0");
  await studyAreaDialog.getByRole("button", { name: "Validate Archive" }).click();
  await expect(studyAreaDialog.locator("#study-area-pmtiles-status")).toContainText("Validated PMTiles v3 mvt archive");
  await expect(studyAreaDialog.locator("#study-area-pmtiles-status")).toContainText("Storage waits for Apply Study Area");
  await expect(studyAreaDialog.getByRole("button", { name: "Apply Study Area" })).toBeEnabled();
  await studyAreaDialog.getByRole("button", { name: "Apply Study Area" }).click();

  await expect(projectDialog).toBeVisible();
  await expect(projectDialog.locator("#project-study-area-summary")).toContainText("Toledo field investigation");
  await expect(projectDialog.locator("#project-study-area-summary")).toContainText("358 tiles (approximately 8.7 MiB) via Browser-local PMTiles package");
  await expect(projectDialog.locator("#project-study-area-summary")).toContainText("toledo-field.pmtiles validated and stored");
  await projectDialog.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.locator("#project-tree-name")).toContainText("Toledo Offline Field Project");
  await expect(page.locator("#form-status")).toContainText("Study area Toledo field investigation was saved");

  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.project-state.v1")));
  expect(snapshot.studyAreas).toHaveLength(1);
  expect(snapshot.studyAreas[0]).toMatchObject({
    name: "Toledo field investigation",
    source: "manual-bounds",
    bounds: [-83.75, 41.5, -83.45, 41.75],
    bufferKm: 0,
    offlineMap: {
      minZoom: 0,
      maxZoom: 14,
      packageLimitMiB: 100,
      status: "stored-unverified",
      providerId: "browser-pmtiles",
      estimate: {
        estimatorVersion: "web-mercator-v1",
        tileCount: 358,
        averageTileBytes: 25600,
        estimatedBytes: 9164800,
      },
      asset: {
        fileName: "toledo-field.pmtiles",
        storage: "opfs",
        byteLength: pmtilesV3HeaderFixture().length,
        format: "pmtiles-v3",
        tileType: "mvt",
        tileCompression: "none",
        bounds: [-84, 41, -83, 42],
        minZoom: 0,
        maxZoom: 14,
        attribution: "OpenStreetMap contributors",
        license: "ODbL-1.0",
      },
    },
  });
  expect(snapshot.studyAreas[0].offlineMap.asset.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(snapshot.studyAreas[0].offlineMap.asset.id).toBe(snapshot.studyAreas[0].offlineMap.asset.sha256);
  expect(snapshot.studyAreas[0].offlineMap.asset.storagePath).toContain(snapshot.studyAreas[0].offlineMap.asset.sha256);
  expect(["persistent", "best-effort"]).toContain(snapshot.studyAreas[0].offlineMap.asset.persistence);
  const storedArchiveSize = await page.evaluate(async (sha256) => {
    const root = await navigator.storage.getDirectory();
    const appDirectory = await root.getDirectoryHandle("epi-info-ai");
    const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
    const entries = [];
    for await (const [name] of mapDirectory.entries()) if (name.includes(sha256)) entries.push(name);
    return (await (await mapDirectory.getFileHandle(entries.at(-1))).getFile()).size;
  }, snapshot.studyAreas[0].offlineMap.asset.sha256);
  expect(storedArchiveSize).toBe(pmtilesV3HeaderFixture().length);
  expect(snapshot.studyAreas[0].geometry.coordinates[0]).toEqual([
    [-83.75, 41.5], [-83.45, 41.5], [-83.45, 41.75], [-83.75, 41.75], [-83.75, 41.5],
  ]);
  await page.locator('.module-rail [data-module="maps"]').click();
  await expect(page.locator("#map-basemap-status")).toContainText("Offline package active", { timeout: 15_000 });
  await expect(page.locator("#map-basemap-status")).toContainText("MapLibre MVT · 1 source layer");
  await expect(page.locator("#map-basemap-offline")).toBeEnabled();
  await expect(page.locator("#map-basemap-offline")).toBeChecked();
  await expect(page.locator(".epi-maplibre-offline-layer canvas")).toBeVisible();
});

test("raster PMTiles render from OPFS without online tile requests", async ({ page }) => {
  let onlineTileRequests = 0;
  await page.route("https://tile.openstreetmap.org/**", (route) => {
    onlineTileRequests += 1;
    return route.abort();
  });
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await projectDialog.getByLabel("Database name").fill("Toledo Raster Offline Project");
  await projectDialog.getByRole("button", { name: "Define Study Area...", exact: true }).click();
  const studyAreaDialog = page.getByRole("dialog", { name: "Preview Study Area" });
  await studyAreaDialog.getByLabel("Study area name").fill("Toledo raster study area");
  for (const [label, value] of [["West", "-83.75000"], ["South", "41.50000"], ["East", "-83.45000"], ["North", "41.75000"]]) {
    await studyAreaDialog.getByLabel(label, { exact: true }).fill(value);
  }
  await studyAreaDialog.getByLabel("Offline map source").selectOption("browser-pmtiles");
  await studyAreaDialog.getByLabel("PMTiles v3 file").setInputFiles({
    name: "toledo-raster.pmtiles",
    mimeType: "application/octet-stream",
    buffer: pmtilesV3RasterFixture(),
  });
  await studyAreaDialog.getByLabel("Map attribution").fill("Test raster contributors");
  await studyAreaDialog.getByLabel("Data license or terms reference").fill("Test-only fixture");
  await studyAreaDialog.getByRole("button", { name: "Validate Archive" }).click();
  await expect(studyAreaDialog.locator("#study-area-pmtiles-status")).toContainText("Validated PMTiles v3 png archive");
  await studyAreaDialog.getByRole("button", { name: "Apply Study Area" }).click();
  await projectDialog.getByRole("button", { name: "Create", exact: true }).click();
  onlineTileRequests = 0;
  await page.getByRole("button", { name: "Maps", exact: true }).click();
  await expect(page.locator("#map-basemap-offline")).toBeEnabled();
  await expect(page.locator("#map-basemap-offline")).toBeChecked();
  await expect(page.locator("#map-basemap-status")).toContainText("Offline package active");
  await expect(page.locator("#map-basemap-status")).toContainText("SHA-256 verified");
  await expect(page.locator("#map-status")).toContainText("no tile-network requests are used");
  await page.waitForTimeout(300);
  expect(onlineTileRequests).toBe(0);
});

test("portable project archive restores its embedded PMTiles after local loss", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await projectDialog.getByLabel("Database name").fill("Portable Toledo Project");
  await projectDialog.getByRole("button", { name: "Define Study Area...", exact: true }).click();
  const studyAreaDialog = page.getByRole("dialog", { name: "Preview Study Area" });
  await studyAreaDialog.getByLabel("Study area name").fill("Portable Toledo area");
  for (const [label, value] of [["West", "-83.75000"], ["South", "41.50000"], ["East", "-83.45000"], ["North", "41.75000"]]) {
    await studyAreaDialog.getByLabel(label, { exact: true }).fill(value);
  }
  await studyAreaDialog.getByLabel("Offline map source").selectOption("browser-pmtiles");
  await studyAreaDialog.getByLabel("PMTiles v3 file").setInputFiles({
    name: "portable-toledo.pmtiles",
    mimeType: "application/octet-stream",
    buffer: pmtilesV3RasterFixture(),
  });
  await studyAreaDialog.getByLabel("Map attribution").fill("Portable test contributors");
  await studyAreaDialog.getByLabel("Data license or terms reference").fill("Test-only fixture");
  await studyAreaDialog.getByRole("button", { name: "Validate Archive" }).click();
  await studyAreaDialog.getByRole("button", { name: "Apply Study Area" }).click();
  await projectDialog.getByRole("button", { name: "Create", exact: true }).click();
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.project-state.v1")));
  const originalPath = before.studyAreas[0].offlineMap.asset.storagePath;

  const downloadPromise = page.waitForEvent("download");
  const applicationMenu = page.getByRole("navigation", { name: "Application menu" });
  await applicationMenu.getByText("File", { exact: true }).click();
  await applicationMenu.getByRole("menuitem", { name: "Save Project As" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Portable-Toledo-Project.epia");
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  await page.evaluate(async (storagePath) => {
    const root = await navigator.storage.getDirectory();
    const appDirectory = await root.getDirectoryHandle("epi-info-ai");
    const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
    await mapDirectory.removeEntry(storagePath.split("/").at(-1));
  }, originalPath);
  await page.locator("#project-package-open").setInputFiles(downloadPath);
  await expect(page.locator("#main-menu-status")).toContainText("Restored 1 offline map archive into this browser");
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.project-state.v1")));
  const restoredPath = after.studyAreas[0].offlineMap.asset.storagePath;
  expect(restoredPath).not.toBe(originalPath);
  const restoredSize = await page.evaluate(async (storagePath) => {
    const root = await navigator.storage.getDirectory();
    const appDirectory = await root.getDirectoryHandle("epi-info-ai");
    const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
    return (await (await mapDirectory.getFileHandle(storagePath.split("/").at(-1))).getFile()).size;
  }, restoredPath);
  expect(restoredSize).toBe(pmtilesV3RasterFixture().length);
});

test("Maps detects an evicted PMTiles package and accepts only the recorded archive", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  const snapshot = await createOfflineRasterProject(page, "Eviction Recovery Project");
  const asset = snapshot.studyAreas[0].offlineMap.asset;
  await page.evaluate(async (storagePath) => {
    const root = await navigator.storage.getDirectory();
    const appDirectory = await root.getDirectoryHandle("epi-info-ai");
    const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
    await mapDirectory.removeEntry(storagePath.split("/").at(-1));
  }, asset.storagePath);

  await page.getByRole("button", { name: "Maps", exact: true }).click();
  const recovery = page.locator("#map-offline-recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute("data-state", "missing");
  await expect(recovery).toContainText("missing from browser storage");
  await expect(page.locator("#map-basemap-offline")).toBeDisabled();
  await expect(page.locator('[name="map-basemap"][value="blank"]')).toBeChecked();

  await page.locator("#map-offline-reimport-file").setInputFiles({
    name: "wrong.pmtiles",
    mimeType: "application/octet-stream",
    buffer: pmtilesV3HeaderFixture(),
  });
  await expect(recovery.locator("#map-offline-recovery-detail")).toContainText("Recovery rejected");
  await expect(recovery).toBeVisible();

  await page.locator("#map-offline-reimport-file").setInputFiles({
    name: "toledo-recovery.pmtiles",
    mimeType: "application/octet-stream",
    buffer: pmtilesV3RasterFixture(),
  });
  await expect(recovery).toBeHidden();
  await expect(page.locator("#map-basemap-status")).toContainText("Offline package active");
  await expect(page.locator("#map-basemap-status")).toContainText("SHA-256 verified");
});

test("Maps detects corrupt PMTiles and can detach the unusable package", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  const snapshot = await createOfflineRasterProject(page, "Corrupt Package Project");
  const asset = snapshot.studyAreas[0].offlineMap.asset;
  await page.evaluate(async (storagePath) => {
    const root = await navigator.storage.getDirectory();
    const appDirectory = await root.getDirectoryHandle("epi-info-ai");
    const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
    const handle = await mapDirectory.getFileHandle(storagePath.split("/").at(-1));
    const bytes = new Uint8Array(await (await handle.getFile()).arrayBuffer());
    bytes[bytes.length - 1] ^= 0xff;
    const writable = await handle.createWritable();
    await writable.write(bytes);
    await writable.close();
  }, asset.storagePath);

  await page.getByRole("button", { name: "Maps", exact: true }).click();
  const recovery = page.locator("#map-offline-recovery");
  await expect(recovery).toBeVisible();
  await expect(recovery).toHaveAttribute("data-state", "corrupt");
  await expect(recovery).toContainText("failed integrity verification");
  await recovery.getByRole("button", { name: "Detach offline package" }).click();
  await expect(recovery).toBeHidden();
  const detached = await page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.project-state.v1")));
  expect(detached.studyAreas[0].offlineMap.status).toBe("not-downloaded");
  expect(detached.studyAreas[0].offlineMap.asset).toBeUndefined();
});

test("cancelling New Project removes its uncommitted PMTiles archive", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await projectDialog.getByRole("button", { name: "Define Study Area...", exact: true }).click();
  const studyAreaDialog = page.getByRole("dialog", { name: "Preview Study Area" });
  for (const [label, value] of [["West", "-83.75000"], ["South", "41.50000"], ["East", "-83.45000"], ["North", "41.75000"]]) {
    await studyAreaDialog.getByLabel(label, { exact: true }).fill(value);
  }
  await studyAreaDialog.getByLabel("Offline map source").selectOption("browser-pmtiles");
  await studyAreaDialog.getByLabel("PMTiles v3 file").setInputFiles({
    name: "uncommitted.pmtiles",
    mimeType: "application/octet-stream",
    buffer: pmtilesV3HeaderFixture(),
  });
  await studyAreaDialog.getByLabel("Map attribution").fill("OpenStreetMap contributors");
  await studyAreaDialog.getByLabel("Data license or terms reference").fill("ODbL-1.0");
  await studyAreaDialog.getByRole("button", { name: "Validate Archive" }).click();
  await expect(studyAreaDialog.locator("#study-area-pmtiles-status")).toHaveAttribute("data-state", "valid");
  await studyAreaDialog.getByRole("button", { name: "Apply Study Area" }).click();
  await expect(projectDialog.locator("#project-study-area-summary")).toContainText("uncommitted.pmtiles validated and stored");
  await projectDialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(projectDialog).toBeHidden();
  await expect.poll(async () => page.evaluate(async () => {
    try {
      const root = await navigator.storage.getDirectory();
      const appDirectory = await root.getDirectoryHandle("epi-info-ai");
      const mapDirectory = await appDirectory.getDirectoryHandle("offline-maps");
      let count = 0;
      for await (const _entry of mapDirectory.entries()) count += 1;
      return count;
    } catch {
      return 0;
    }
  })).toBe(0);
});

test("production artifact opens Maps and initializes Leaflet", async ({ page }) => {
  await page.getByRole("button", { name: "Create Maps" }).click();
  await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible();
  await expect(page.locator("#epi-map")).toHaveClass(/leaflet-container/);
  await expect(page.getByRole("button", { name: "Enter map fullscreen" })).toBeVisible();
  await expect(page.getByText("Add Data Layer", { exact: true })).toBeVisible();
});

test("legacy Geo-location template geocodes only after explicit result selection", async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.abort());
  await page.route("https://nominatim.openstreetmap.org/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          display_name: "123 Main Street, Toledo, Lucas County, Ohio, USA",
          lat: "41.6528",
          lon: "-83.5379",
          importance: 0.8,
          category: "place",
          type: "house",
        },
      ]),
    });
  });
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.getByRole("button", { name: "New Project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "Create a Project Data Store" });
  await projectDialog.getByLabel("Database name").fill("Geolocation parity test");
  await projectDialog.getByRole("button", { name: "Create", exact: true }).click();

  await page.getByRole("button", { name: "Geo-location", exact: true }).click();
  await expect(page.locator("#form-status")).toContainText("legacy GEOCODE field template");
  await page.getByRole("button", { name: "Enter Data", exact: true }).last().click();
  await page.getByLabel("Address", { exact: true }).fill("123 Main Street, Toledo, Ohio");
  await page.getByRole("button", { name: "Get Coordinates", exact: true }).click();

  const results = page.getByRole("dialog", { name: "Geocode Results" });
  await expect(results).toBeVisible();
  const recordForm = page.locator("#record-form");
  await expect(recordForm.getByLabel("Latitude", { exact: true })).toHaveValue("");
  await expect(recordForm.getByLabel("Longitude", { exact: true })).toHaveValue("");
  await results.getByRole("button", { name: "Select", exact: true }).click();
  await expect(recordForm.getByLabel("Latitude", { exact: true })).toHaveValue("41.6528000");
  await expect(recordForm.getByLabel("Longitude", { exact: true })).toHaveValue("-83.5379000");

  await page.getByRole("button", { name: "Preview Map", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview Location on OpenStreetMap" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("123 Main Street, Toledo, Ohio", { exact: true })).toBeVisible();
  await expect(preview.locator("#location-preview-latitude")).toHaveText("41.6528000");
  await expect(preview.locator("#location-preview-longitude")).toHaveText("-83.5379000");
  await expect(preview.locator("#location-preview-map")).toHaveClass(/leaflet-container/);
  const marker = preview.locator(".leaflet-marker-icon");
  await expect(marker).toBeVisible();
  await expect(marker).toHaveAttribute("title", "Current record location. Drag to adjust.");
  const originalLatitude = await recordForm.getByLabel("Latitude", { exact: true }).inputValue();
  const markerBox = await marker.boundingBox();
  if (!markerBox) throw new Error("Location preview marker has no draggable bounds.");
  const start = { x: markerBox.x + markerBox.width / 2, y: markerBox.y + markerBox.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 55, start.y + 35, { steps: 6 });
  await expect.poll(() => recordForm.getByLabel("Latitude", { exact: true }).inputValue()).not.toBe(originalLatitude);
  await page.mouse.up();
  await expect(recordForm.getByLabel("Latitude", { exact: true })).toHaveValue(/^-?\d+\.\d{7}$/);
  await expect(recordForm.getByLabel("Longitude", { exact: true })).toHaveValue(/^-?\d+\.\d{7}$/);
  await expect(preview.locator("#location-preview-status")).toContainText("Form coordinates updated");
  await preview.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.locator("#record-status")).toContainText("Record saved locally");

  await page.locator("#enter-open-maps").click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "Case Cluster", exact: true }).click();
  const caseCluster = page.locator("#case-cluster-dialog");
  await expect(caseCluster).toBeVisible();
  await expect(page.locator("#map-latitude-field")).toHaveValue("latitude");
  await expect(page.locator("#map-longitude-field")).toHaveValue("longitude");
});

test("StatCalc renders legacy-named Rust/WASM Fisher and mid-p results", async ({ page }) => {
  await page.locator('[data-open-module="statcalc"]').click();
  await page.locator("#exposed-cases").fill("21");
  await page.locator("#exposed-controls").fill("27");
  await page.locator("#unexposed-cases").fill("27");
  await page.locator("#unexposed-controls").fill("25");
  await page.locator("#table-form").getByRole("button", { name: "Calculate" }).click();

  await expect(page.locator("#fisher-one-tailed")).toHaveText("0.2688");
  await expect(page.locator("#fisher-two-tailed")).toHaveText("0.4310");
  await expect(page.locator("#fisher-exact")).toHaveText("0.4310");
  await expect(page.locator("#mid-p-exact")).toHaveText("0.2116");
  await expect(page.locator("#conditional-odds-ratio")).toHaveText("0.72");
  await expect(page.locator("#conditional-odds-ratio-fisher-ci")).toHaveText("95% exact Fisher CI 0.30–1.70");
  await expect(page.locator("#conditional-odds-ratio-mid-p-ci")).toHaveText("95% exact mid-p CI 0.32–1.60");
});

test("Classic Analysis stratified table renders Mantel-Haenszel results", async ({ page }) => {
  await page.getByRole("button", { name: "Classic", exact: true }).click();
  await openClassicDeveloperControls(page);
  await expect(page.getByRole("heading", { name: "Stratified 2 x 2 (Mantel-Haenszel)" })).toBeVisible();
  await page.locator("#stratified-form").getByRole("button", { name: "Calculate adjusted results" }).click();
  await expect(page.locator("#stratified-worker-status")).toContainText("Worker completed");
  await expect(page.locator("#stratified-or")).toHaveText("15.00");
  await expect(page.locator("#stratified-rr")).toHaveText("4.50");
  await expect(page.locator("#stratified-mh-value")).toHaveText("32.21");
  await expect(page.locator("#stratified-mh-corrected-value")).toHaveText("29.95");
  await expect(page.locator("#stratified-bdt-or-value")).toHaveText("0.00");
  await expect(page.locator("#stratified-legacy-bd-or-value")).toHaveText("0.00");
  await expect(page.locator("#stratified-bd-or-value")).toHaveText("0.00");
  await expect(page.locator("#stratified-legacy-bd-rr-value")).toHaveText("0.00");
  await expect(page.locator("#stratified-conditional-or")).toHaveText("13.92");
  await expect(page.locator("#stratified-conditional-or-ci")).toContainText("4.89");
  await expect(page.locator("#stratified-conditional-or-ci")).toContainText("44.32");

  await page.locator("#add-stratum").click();
  await expect(page.locator("#strata-rows tr")).toHaveCount(3);
  await page.locator("#strata-rows tr").last().getByRole("button", { name: "Remove" }).click();
  await expect(page.locator("#strata-rows tr")).toHaveCount(2);
});

test("Classic Analysis TABLES derives foodborne strata from the current form", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await openClassicDeveloperControls(page);
  await expect(page.locator("#classic-source-name")).toContainText("96 records");
  await expect(page.locator("#classic-exposure-field")).toHaveValue("potato_salad");
  await expect(page.locator("#classic-outcome-field")).toHaveValue("case_status");
  await expect(page.locator("#classic-strata-field")).toHaveValue("sex");
  await expect(page.locator("#classic-generated-command")).toHaveText("TABLES potato_salad case_status STRATAVAR=sex");

  await page.locator("#classic-run-tables").click();
  await expect(page.locator("#classic-tables-feedback")).toContainText("Included 96 of 96 records; excluded 0");
  await expect(page.locator("#classic-tables-feedback")).toContainText("Reference exposure: No");
  await expect(page.locator("#classic-tables-feedback")).toContainText("Reference outcome: Not a case");
  await expect(page.locator("#strata-rows tr")).toHaveCount(2);
  expect(await page.locator("#strata-rows tr").nth(0).locator("input").evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual(["Female", "18", "6", "4", "20"]);
  expect(await page.locator("#strata-rows tr").nth(1).locator("input").evaluateAll((inputs) => inputs.map((input) => input.value))).toEqual(["Male", "18", "6", "4", "20"]);
  await expect(page.locator("#stratified-or")).toHaveText("15.00");
  await expect(page.locator("#stratified-rr")).toHaveText("4.50");
});

test("Classic Analysis FREQ derives the foodborne Case Status distribution", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await openClassicDeveloperControls(page);
  await expect(page.locator("#frequency-field")).toHaveValue("case_status");
  await expect(page.locator("#frequency-generated-command")).toHaveText("FREQ case_status");
  await page.locator("#frequency-run").click();

  await expect(page.locator("#frequency-output")).toBeVisible();
  await expect(page.locator("#classic-output-welcome")).toBeHidden();
  await expect(page.locator("#frequency-feedback")).toContainText("Included 96 of 96 records; excluded 0");
  await expect(page.locator("#frequency-method")).toHaveText("Exact 95% confidence limits");
  await expect(page.locator("#frequency-total")).toHaveText("96");
  await expect(page.locator("#frequency-rows tr")).toHaveCount(4);
  expect(await page.locator("#frequency-rows tr").allTextContents()).toEqual([
    "Confirmed2222.9%22.9%",
    "Not a case5254.2%77.1%",
    "Probable1616.7%93.8%",
    "Suspected66.3%100.0%",
  ]);
  expect(await page.locator("#frequency-confidence-rows tr").allTextContents()).toEqual([
    "Confirmed15.0%32.6%",
    "Not a case43.7%64.4%",
    "Probable9.8%25.6%",
    "Suspected2.3%13.1%",
  ]);

  await page.locator("#frequency-field").selectOption("age");
  await page.locator("#frequency-strata-field").selectOption("sex");
  await expect(page.locator("#frequency-generated-command")).toHaveText("FREQ age STRATAVAR=sex");
  await page.locator("#frequency-run").click();
  await expect(page.locator("#frequency-stratified-title")).toHaveText("Age by Sex");
  await expect(page.locator("#frequency-feedback")).toContainText("Produced 2 strata from 96 of 96 records");
  await expect(page.locator("#frequency-stratified-rows tr")).toHaveCount(82);
  await expect(page.locator("#frequency-stratified-rows")).toContainText("Female");
  await expect(page.locator("#frequency-stratified-rows")).toContainText("Male");
});

test("Program Editor does not expose foodborne programs without their dataset", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Classic" }).click();
  await expect(page.locator(".classic-program-examples")).toBeHidden();
  await expect(page.locator("#classic-program-source .cm-content")).toContainText("Enter an Epi Info program for the current project");
  expect(await page.evaluate(() => performance.getEntriesByName(new URL("examples/foodborne-outbreak-investigation.programs.json", location.href).href).length)).toBe(0);

  await page.locator('[data-module="forms"]').click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles({
    name: "unrelated.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Person ID,Score\nP-001,10\n"),
  });
  await expect(page.locator("#csv-form-status")).toContainText("Created 2 fields and imported 1 record");
  await page.locator('[data-module="classic"]').click();
  await expect(page.locator(".classic-program-examples")).toBeHidden();
  expect(await page.evaluate(() => performance.getEntriesByName(new URL("examples/foodborne-outbreak-investigation.programs.json", location.href).href).length)).toBe(0);
});

test("Program Editor and Output preserve the legacy menus and toolbar order", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Classic" }).click();
  await expect(page.locator("#classic-program-menu summary")).toHaveText(["File", "Edit", "Fonts"]);
  await expect(page.locator("#classic-program-toolbar button span")).toHaveText(["New Pgm", "Open Pgm", "Save Pgm", "Print...", "Run Commands", "Cancel"]);
  await expect(page.locator("#classic-output-toolbar button span")).toHaveText(["Previous", "Next", "Last", "History", "Open", "Bookmark", "Print", "Maximize", "Clear Output"]);

  await page.locator("#classic-program-menu summary", { hasText: "Edit" }).click();
  await page.locator("#classic-program-edit-end").click();
  await expect(page.locator("#classic-program-command-status")).toHaveText("Cursor moved to Program End.");
  await page.evaluate(() => { window.__epiPrintCalls = 0; window.print = () => { window.__epiPrintCalls += 1; }; });
  await page.locator("#classic-program-toolbar-print").click();
  await page.locator("#classic-program-menu summary", { hasText: "File" }).click();
  await page.locator("#classic-program-file-print").click();
  await expect.poll(() => page.evaluate(() => window.__epiPrintCalls)).toBe(2);
  await expect(page.locator("#classic-program-command-status")).toContainText("browser print dialog");
  await page.locator("#classic-output-history").click();
  await expect(page.locator("#classic-program-history")).toHaveAttribute("open", "");
  await expect(page.locator("#classic-output-navigation-status")).toHaveText("Command history opened.");
});

test("Output opens safe files and supports bookmarks print and maximize", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Classic", exact: true }).click();
  for (const selector of ["#classic-output-open", "#classic-output-bookmark", "#classic-output-print", "#classic-output-maximize"]) {
    await expect(page.locator(selector)).not.toHaveAttribute("aria-disabled", "true");
  }

  await page.locator("#classic-output-file").setInputFiles({
    name: "saved-analysis.html",
    mimeType: "text/html",
    buffer: Buffer.from("<!doctype html><title>Saved analysis</title><h1>Foodborne output</h1><p>96 records</p>"),
  });
  await expect(page.locator("#classic-opened-output")).toBeVisible();
  await expect(page.locator("#classic-opened-output-title")).toHaveText("saved-analysis.html");
  await expect(page.locator("#classic-opened-output-body iframe")).toHaveAttribute("sandbox", "");

  await page.locator("#classic-output-bookmark").click();
  await expect(page.locator("#classic-output-bookmark-dialog")).toBeVisible();
  await page.locator("#classic-output-bookmark-name").fill("Foodborne saved output");
  await page.locator("#classic-output-bookmark-save").click();
  await expect(page.locator("#classic-output-navigation-status")).toContainText("Bookmarked current output");

  await page.evaluate(() => { window.__epiOutputPrintCalls = 0; window.print = () => { window.__epiOutputPrintCalls += 1; }; });
  await page.locator("#classic-output-print").click();
  await expect.poll(() => page.evaluate(() => window.__epiOutputPrintCalls)).toBe(1);
  await expect(page.locator("#classic-output-navigation-status")).toContainText("browser print dialog");

  const workspace = page.locator(".classic-workspace-shell");
  await page.locator("#classic-output-maximize").click();
  await expect(workspace).toHaveAttribute("data-output-maximized", "true");
  await expect(page.locator("#classic-program-title")).toBeHidden();
  await expect(page.locator("#classic-output-maximize span")).toHaveText("Restore");
  await page.locator("#classic-output-maximize").click();
  await expect(workspace).toHaveAttribute("data-output-maximized", "false");
  await expect(page.locator("#classic-program-title")).toBeVisible();

  await page.locator("#classic-output-clear").click();
  await expect(page.locator("#classic-opened-output")).toBeHidden();
  await page.locator("#classic-output-history").click();
  await page.getByRole("button", { name: "Foodborne saved output" }).click();
  await expect(page.locator("#classic-opened-output")).toBeVisible();
});

test("Program Editor Cut Copy and Paste preserve exact source", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(page.url()).origin });
  await page.locator("#main-menu").getByRole("button", { name: "Classic", exact: true }).click();
  const editor = page.locator("#classic-program-source .cm-content");
  const source = "FREQ Age\nMEANS Age";
  await editor.fill(source);
  await editor.press("Control+A");

  await page.locator("#classic-program-menu summary", { hasText: "Edit" }).click();
  await page.locator("#classic-program-edit-copy").click();
  await expect(page.locator("#classic-program-command-status")).toHaveText("Copied the selected program text to the clipboard.");

  await page.locator("#classic-program-menu summary", { hasText: "Edit" }).click();
  await page.locator("#classic-program-edit-cut").click();
  await expect(page.locator("#classic-program-command-status")).toHaveText("Cut the selected program text to the clipboard.");
  await expect(editor).toHaveText("");
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n")).toBe(source);

  await page.locator("#classic-program-menu summary", { hasText: "Edit" }).click();
  await page.locator("#classic-program-edit-paste").click();
  await expect(page.locator("#classic-program-command-status")).toHaveText("Pasted clipboard text into the current program.");
  await expect(editor.locator(".cm-line")).toHaveText(["FREQ Age", "MEANS Age"]);
});

test("Program Editor saves project programs and exchanges .pgm7 files", async ({ page }) => {
  await page.locator("#project-package-open").setInputFiles("wasm/demo/examples/sample-project.epia.json");
  await expect(page.locator("#main-menu-status")).toContainText("Opened Sample");
  await page.locator("#main-menu").getByRole("button", { name: "Classic", exact: true }).click();
  await expect(page.locator("#classic-program-library")).toHaveCount(0);
  await page.locator("#classic-program-toolbar-open").click();
  await expect(page.locator("#classic-program-dialog-project option", { hasText: "Statistics" })).toHaveCount(1);
  await page.locator("#classic-program-dialog-project").selectOption("Statistics");
  await page.locator("#classic-program-dialog-primary").click();
  await expect(page.locator("#classic-program-source .cm-content")).toContainText("ROUTEOUT");
  await expect(page.locator("#classic-program-document-state")).toHaveText("Statistics · saved");

  await page.locator("#classic-program-toolbar-new").click();
  const editor = page.locator("#classic-program-source .cm-content");
  await editor.fill("FREQ age\nFREQ sex");
  await expect(page.locator("#classic-program-document-state")).toHaveText("Untitled · modified");
  await page.locator("#classic-program-toolbar-save").click();
  await expect(page.locator("#classic-program-dialog")).toBeVisible();
  await page.locator("#classic-program-name").fill("Foodborne Quick Check");
  await page.locator("#classic-program-author").fill("Demo Analyst");
  await page.locator("#classic-program-comment").fill("Foodborne demonstration program");
  await page.locator("#classic-program-dialog-primary").click();
  await expect(page.locator("#classic-program-document-state")).toHaveText("Foodborne Quick Check · saved");
  await page.locator("#classic-program-toolbar-open").click();
  await expect(page.locator("#classic-program-dialog-project option", { hasText: "Foodborne Quick Check" })).toHaveCount(1);
  await page.getByRole("dialog", { name: "Open Program" }).getByRole("button", { name: "Cancel", exact: true }).click();

  await page.locator("#classic-program-menu summary").getByText("Edit", { exact: true }).click();
  await page.locator("#classic-program-edit-replace").click();
  await page.locator("#classic-program-search-query").fill("FREQ");
  await page.locator("#classic-program-search-replacement").fill("MEANS");
  await page.locator("#classic-program-search-replace-all").click();
  await expect(page.locator("#classic-program-search-feedback")).toHaveText("Replaced 2 matches.");
  await expect(editor).toContainText("MEANS age");
  await page.locator("#classic-program-search-dialog button", { hasText: "Close" }).click();
  await page.locator("#classic-program-toolbar-save").click();
  await expect(page.locator("#classic-program-dialog-title")).toHaveText("Save Program");
  await expect(page.locator("#classic-program-author")).toBeEditable();
  await expect(page.locator("#classic-program-author")).toHaveValue("Demo Analyst");
  await page.locator("#classic-program-author").fill("Demo Analyst Updated");
  await page.locator("#classic-program-dialog-primary").click();
  await expect(page.locator("#classic-program-document-state")).toHaveText("Foodborne Quick Check · saved");

  await page.locator("#classic-program-menu summary").getByText("File", { exact: true }).click();
  await page.locator("#classic-program-file-save-as").click();
  await page.locator("#classic-program-name").fill("Foodborne Export");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#classic-program-dialog-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Foodborne-Export.pgm7");

  await page.locator("#classic-program-toolbar-open").click();
  await page.locator("#classic-program-file").setInputFiles({ name: "Imported.pgm7", mimeType: "text/plain", buffer: Buffer.from("FREQ case_status") });
  await expect(editor).toContainText("FREQ case_status");
  await expect(page.locator("#classic-program-document-state")).toHaveText("Imported · saved");

  await page.locator("#classic-program-toolbar-open").click();
  await page.locator("#classic-program-dialog-project").selectOption("Foodborne Quick Check");
  await expect(page.locator("#classic-program-author")).toHaveValue("Demo Analyst Updated");
  await expect(page.locator("#classic-program-comment")).toHaveValue("Foodborne demonstration program");
  await expect(page.locator("#classic-program-created")).not.toHaveValue("");
  await expect(page.locator("#classic-program-updated")).not.toHaveValue("");
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-dialog-delete").click();
  await expect(page.locator("#classic-program-dialog-feedback")).toContainText("Deleted");
  await expect(page.locator("#classic-program-dialog-project option", { hasText: "Foodborne Quick Check" })).toHaveCount(0);
  await expect(editor).toContainText("FREQ case_status");
});

test("Program Editor opens and runs the demo foodborne PGM through visible Output and history", async ({ page }) => {
  const expectedProgramSource = await readFile("wasm/demo/examples/foodborne-age-groups-by-sex.pgm", "utf8");
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await page.locator("#classic-program-toolbar-open").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-file").setInputFiles("wasm/demo/examples/foodborne-age-groups-by-sex.pgm");

  const editor = page.locator("#classic-program-source .cm-content");
  await expect(editor).toContainText("DEFINE AgeGroup TEXTINPUT");
  await expect(editor).toContainText("FREQ AgeGroup STRATAVAR=Sex");
  await expect(page.locator("#classic-program-document-state")).toHaveText("foodborne-age-groups-by-sex · saved");
  await expect(page.locator("#classic-program-live-status")).toContainText("Program syntax is valid");
  await page.locator("#classic-program-run").click();

  await expect(page.locator("#classic-program-output-title")).toHaveText("Age group by Sex");
  await expect(page.locator("#classic-program-output-variable-heading")).toHaveText("Age group");
  await expect(page.locator("#classic-program-output-rows tr")).toHaveCount(8);
  await expect(page.locator("#classic-program-output-rows")).toContainText("Female");
  await expect(page.locator("#classic-program-output-rows")).toContainText("Male");
  await expect(page.locator("#classic-program-feedback")).toContainText("Executed DEFINE → RECODE → FREQ for 96 records");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");

  // A runnable external PGM must also complete the familiar Save Pgm workflow.
  await page.locator("#classic-program-toolbar-save").click();
  await expect(page.locator("#classic-program-dialog")).toBeVisible();
  await expect(page.locator("#classic-program-name")).toHaveValue("foodborne-age-groups-by-sex");
  await page.locator("#classic-program-dialog-primary").click();
  await expect(page.locator("#classic-program-document-state")).toHaveText("foodborne-age-groups-by-sex \u00b7 saved");
  await page.locator("#classic-program-toolbar-open").click();
  await expect(page.locator("#classic-program-dialog-project option", { hasText: "foodborne-age-groups-by-sex" })).toHaveCount(1);
  await page.getByRole("dialog", { name: "Open Program" }).getByRole("button", { name: "Cancel", exact: true }).click();

  await page.locator("#classic-program-menu summary").getByText("File", { exact: true }).click();
  await page.locator("#classic-program-file-save-as").click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#classic-program-dialog-export").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("foodborne-age-groups-by-sex.pgm7");
  expect(await readFile(await download.path(), "utf8")).toBe(expectedProgramSource);
});

test("Program Editor runs the foodborne pgm7 command tour sequentially", async ({ page }) => {
  test.setTimeout(60_000);
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await page.locator("#classic-program-toolbar-open").click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-file").setInputFiles("wasm/demo/examples/foodborne-classic-command-tour.pgm7");
  await expect(page.locator("#classic-program-live-status")).toContainText("Program syntax is valid");
  await page.setViewportSize({ width: 900, height: 700 });
  await expect(page.locator("#classic-program-assist")).toBeVisible();
  await expect(page.locator("#classic-program-workbench")).toHaveAttribute("data-assist-open", "true");
  expect(await page.locator("#classic-program-assist").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.top < window.innerHeight && bounds.bottom > 0;
  })).toBe(true);
  await page.setViewportSize({ width: 1280, height: 720 });

  const sourceEditor = page.locator("#classic-program-source .cm-content");
  const sourceScroller = page.locator("#classic-program-source .cm-scroller");
  await sourceEditor.focus();
  await sourceEditor.press("Control+End");
  await expect.poll(() => sourceScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const commandTourLineCount = await sourceEditor.locator(".cm-line").count();
  for (let line = 0; line < commandTourLineCount + 2; line++) await sourceEditor.press("ArrowUp");
  await expect(page.locator("#classic-program-cursor-position")).toContainText("Ln 1, Col ");
  await expect.poll(() => sourceScroller.evaluate((element) => element.scrollTop)).toBeLessThanOrEqual(6);
  expect(await sourceEditor.locator(".cm-line").first().evaluate((line, scroller) => {
    const lineBox = line.getBoundingClientRect();
    const scrollerBox = scroller.getBoundingClientRect();
    return lineBox.top >= scrollerBox.top && lineBox.bottom <= scrollerBox.bottom;
  }, await sourceScroller.elementHandle())).toBe(true);

  await page.locator("#classic-program-toolbar-run").click();
  await expect(page.locator("#classic-program-command-status")).toHaveText("Program completed: 29 of 29 commands succeeded.");
  await expect(page.locator("#classic-program-feedback")).toContainText("Executed all 29 commands in source order");
  await expect(page.locator("#classic-program-session-status")).toContainText("96 records; no selection");
  await expect(page.locator("#classic-program-session-status")).not.toContainText("SORT Age");
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(96);
  await expect(page.locator("#classic-summarize-output-body tr")).toHaveCount(2);
  await expect(page.locator("#classic-graph-output-title")).toHaveText("Foodborne cases by status");
  await expect(page.locator("#classic-tables-categorical-title")).toContainText("Complex Sample Means");
  await expect(page.locator("#classic-tables-categorical-count")).toContainText("63 PSU/stratum units");
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-means tbody tr")).toHaveCount(3);
  await expect(page.locator("#classic-quality-output")).toBeVisible();
  await expect(page.locator("#classic-quality-output-count")).toHaveText("96 records · 27 fields");
  await expect(page.locator('#classic-quality-output-body tr[data-field-name="hospitalization_date"]')).toContainText("74");
  await expect(page.locator("#classic-program-history-count")).toHaveText("30");
  await expect(page.locator("#classic-sequential-output")).toBeVisible();
  await expect(page.locator("#classic-sequential-output-count")).toHaveText("29 of 29 commands retained");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command")).toHaveCount(29);
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(4)).toHaveText('SET (.)="Not recorded"');
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(5)).toHaveText("SET MISSING=ON");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(6)).toHaveText("TABLES vomiting Sex");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(6)).toContainText("Not recorded");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(9)).toHaveText("TABLES potato_salad hamburger");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(10)).toHaveText("TABLES potato_salad hamburger STRATAVAR=Sex");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(10).locator(".classic-tables-adjusted")).toContainText("Mantel-Haenszel Odds Ratio");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(11)).toHaveText("TABLES potato_salad case_status STRATAVAR=Sex STATISTICS=FISHER");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(12)).toHaveText("TABLES potato_salad case_status WEIGHTVAR=Age");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(12)).toContainText("weighted N 3917");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(13)).toHaveText("TABLES potato_salad hamburger STRATAVAR=Sex WEIGHTVAR=Age PSUVAR=household_neighborhood OUTTABLE=PotatoHamburgerSurvey");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(13)).toContainText("57 PSU/stratum units");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(13)).toContainText("df 55");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(13)).toContainText("OUTTABLE stored 4 rows as PotatoHamburgerSurvey");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(13).locator(".classic-complex-tables-risk")).toContainText("1.2232");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(14)).toHaveText("TABLES potato_salad hamburger STRATAVAR=Sex case_status");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(23)).toHaveText("TABLES potato_salad case_status STRATAVAR=Sex OUTTABLE=PotatoStatusBySex");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(23)).toContainText("OUTTABLE stored 16 long-form rows as PotatoStatusBySex");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(24)).toContainText("DEFINE FoodExposures GROUPVAR");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(25)).toHaveText("TABLES FoodExposures case_status OUTTABLE=FoodExposureStatusCounts");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(25).locator(".classic-tables-expanded-result")).toHaveCount(3);
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(25)).toContainText("OUTTABLE retains the final exposure grilled_chicken with 8 rows");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(26)).toHaveText("FREQ case_status STRATAVAR=Sex WEIGHTVAR=Age PSUVAR=household_neighborhood OUTTABLE=CaseStatusSurvey");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(26)).toContainText("57 PSU/stratum units");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(26).locator(".classic-complex-frequency tbody tr")).toHaveCount(4);
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command code").nth(27)).toHaveText("MEANS Age Sex STRATAVAR=case_status OUTTABLE=AgeBySexSurvey PSUVAR=household_neighborhood");
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(27).locator(".classic-complex-means tbody tr")).toHaveCount(3);
  await expect(page.locator("#classic-sequential-output-body .classic-sequential-command").nth(27)).toContainText("Browser-adapted OUTTABLE stored 3 rows as AgeBySexSurvey");
  await expect(page.locator("#classic-sequential-output-body .classic-tables-2x2")).toHaveCount(12);

  await expect(page.locator("#classic-program-title")).toBeVisible();
  await expect(page.locator("#classic-program-menu")).toBeVisible();
  await expect(page.locator("#classic-program-toolbar")).toBeVisible();

  await page.locator("#classic-output-clear").click();
  await expect(page.locator("#classic-output-navigation-status")).toHaveText("Output cleared. Command history is retained.");
  for (const selector of ["#classic-program-output", "#classic-sequential-output", "#classic-list-output", "#classic-summarize-output", "#classic-graph-output", "#classic-tables-categorical-output", "#classic-quality-output", "#classic-program-history-output"]) {
    await expect(page.locator(selector)).toBeHidden();
  }
  await expect(page.locator("#classic-program-history-count")).toHaveText("30");
  await page.locator("#classic-output-history").click();
  await expect(page.locator("#classic-program-history-output")).toBeVisible();
  await expect(page.locator("#classic-program-history-count")).toHaveText("30");
});

test("browser-verified READ LIST FREQ MEANS and TABLES fixtures run through Open Pgm", async ({ page }) => {
  test.setTimeout(60_000);
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();

  const openAndRun = async (file, commandCount = 1) => {
    await page.locator("#classic-program-toolbar-open").click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#classic-program-file").setInputFiles(file);
    await expect(page.locator("#classic-program-live-status")).toContainText("Program syntax is valid");
    await page.locator("#classic-program-toolbar-run").click();
    await expect(page.locator("#classic-program-command-status")).toHaveText(`Program completed: ${commandCount} of ${commandCount} commands succeeded.`);
  };

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.pgm");
  await expect(page.locator("#classic-program-source-name")).toContainText("Foodborne Outbreak Investigation Form · 96 of 96 records");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-list-core-fields.pgm");
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(96);
  await expect(page.locator("#classic-list-output-body tr").first()).toContainText("P001");
  await expect(page.locator("#classic-list-output-body tr").last()).toContainText("P096");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-frequency-case-status.pgm");
  await expect(page.locator("#frequency-output-title")).toHaveText("Case Status");
  await expect(page.locator("#frequency-rows tr")).toHaveCount(4);
  await expect(page.locator("#frequency-total")).toHaveText("96");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-means-age.pgm");
  await expect(page.locator("#means-output-title")).toHaveText("Age");
  await expect(page.locator("#means-observations")).toHaveText("96");
  await expect(page.locator("#means-total")).toHaveText("3917.0000");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status.pgm");
  await expect(page.locator("#classic-tables-categorical-count")).toHaveText("96 records · 2 strata");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum")).toHaveCount(2);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-percent-row")).toHaveCount(8);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-pearson")).toHaveCount(2);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-expected-warning")).toHaveCount(2);
  await expect(page.locator("#classic-tables-categorical-note")).toContainText("No exposed/case classification was inferred");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-potato-salad-by-status-unstratified.pgm");
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("Potato Salad by Case Status");
  await expect(page.locator("#classic-tables-categorical-count")).toHaveText("96 records · unstratified");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum")).toHaveCount(1);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum h3")).toHaveText("All records");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-percent-row")).toHaveCount(4);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-pearson")).toContainText("52.0769");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-pearson")).toContainText("df 3");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-two-by-two.pgm");
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("Potato Salad by Hamburger");
  await expect(page.locator("#classic-tables-categorical-note")).toContainText("legacy Single Table Analysis");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-2x2-interpretation")).toContainText("exposed=Yes");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-2x2-interpretation")).toContainText("case=Yes");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-2x2")).toHaveCount(2);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-2x2").first()).toContainText("Odds Ratio (cross product)");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-2x2").first()).toContainText("1.0870");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-2x2").last()).toContainText("Fisher exact");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher.pgm");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-fisher")).toContainText("5.5523629098e-14");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-fisher")).toContainText("2,737 tables enumerated");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-multiple-strata.pgm");
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("Potato Salad by Hamburger, stratified by Sex, Case Status");
  await expect(page.locator("#classic-tables-categorical-count")).toHaveText("96 records · 8 strata");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum")).toHaveCount(8);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum h3").first()).toHaveText("Sex: Female · Case Status: Confirmed");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum h3").last()).toHaveText("Sex: Male · Case Status: Suspected");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-stratified-two-by-two.pgm");
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("Potato Salad by Hamburger, stratified by Sex");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum")).toHaveCount(2);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-adjusted")).toBeVisible();
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-adjusted-estimates")).toContainText("1.1805");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-adjusted-estimates")).toContainText("1.0417");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-adjusted-tests")).toContainText("Breslow-Day-Tarone");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-adjusted-tests")).toContainText("7.1717");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-adjusted-audit")).toContainText("Rust/WASM epi.stratified2x2 0.8.0");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-weighted.pgm");
  await expect(page.locator("#classic-tables-categorical-count")).toHaveText("96 records · weighted N 3917 · unstratified");
  await expect(page.locator("#classic-tables-categorical-note")).toContainText("Counts are sums of finite, non-negative Age values");
  await expect(page.locator("#classic-tables-categorical-note")).toContainText("Exact and 2 × 2 risk/odds statistics remain disabled");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-2x2")).toHaveCount(0);

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar.pgm");
  await expect(page.locator("#classic-tables-categorical-title")).toContainText("Complex Sample Tables");
  await expect(page.locator("#classic-tables-categorical-count")).toContainText("weighted N 3917");
  await expect(page.locator("#classic-tables-categorical-count")).toContainText("57 PSU/stratum units");
  await expect(page.locator("#classic-tables-categorical-count")).toContainText("df 55");
  await expect(page.locator("#classic-tables-categorical-note")).toContainText("Taylor-series variance using PSU Household Neighborhood within design strata Sex and weights Age");
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-tables tbody tr")).toHaveCount(4);
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-tables-risk")).toContainText("1.2232");
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-tables-risk")).toContainText("1.1059");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar.pgm");
  await expect(page.locator("#classic-tables-categorical-title")).toContainText("Age by Sex — Complex Sample Means");
  await expect(page.locator("#classic-tables-categorical-count")).toContainText("63 PSU/stratum units");
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-means tbody tr")).toHaveCount(3);
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-means tbody tr").last()).toContainText("5.4792");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-means-psuvar-outtable.pgm", 3);
  await expect(page.locator("#classic-program-source-name")).toContainText("AgeBySexSurvey");
  await expect(page.locator("#classic-program-source-name")).toContainText("3 of 3 records");
  await expect(page.locator("#classic-list-output-head th")).toHaveText(["Sex", "Variable Name", "Count", "Mean", "Standard Error", "Lower Confidence Limit", "Upper Confidence Limit", "Minimum", "Maximum"]);
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(3);
  await expect(page.locator("#classic-list-output-body tr").first()).toContainText("43.541666666666664");
  await expect(page.locator("#classic-list-output-body tr").last()).toContainText("Difference");
  await expect(page.locator("#classic-list-output-body tr").last()).toContainText("5.479166666666664");
  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.pgm");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-frequency-psuvar-outtable.pgm", 3);
  await expect(page.locator("#classic-program-source-name")).toContainText("CaseStatusSurvey · 4 of 4 records");
  await expect(page.locator("#classic-list-output-head th")).toHaveText(["Case Status", "Variable Name", "Count", "Row Percent", "Column Percent", "Standard Error Percent", "Lower Confidence Limit", "Upper Confidence Limit", "Design Effect"]);
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(4);
  await expect(page.locator("#classic-list-output-body tr").first()).toContainText("25.708450344651517");
  await expect(page.locator("#classic-list-output-body tr").last()).toContainText("1.1227594285303308");
  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.pgm");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-psuvar-outtable.pgm", 3);
  await expect(page.locator("#classic-program-source-name")).toContainText("PotatoHamburgerSurvey · 4 of 4 records");
  await expect(page.locator("#classic-list-output-head th")).toHaveText(["Potato Salad", "Hamburger", "Count", "Row Percent", "Column Percent", "Standard Error Percent", "Lower Confidence Limit", "Upper Confidence Limit", "Design Effect"]);
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(4);
  await expect(page.locator("#classic-list-output-body tr").first()).toContainText("52.57894736842105");
  await expect(page.locator("#classic-list-output-body tr").last()).toContainText("1.3722735249414506");
  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.pgm");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar.pgm", 2);
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("FoodExposures by Case Status");
  await expect(page.locator("#classic-tables-categorical-count")).toHaveText("3 expanded tables · 96 source records");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-expanded-result")).toHaveCount(3);
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-expanded-result").nth(0)).toContainText("Potato Salad by Case Status");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-expanded-result").nth(1)).toContainText("Hamburger by Case Status");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-expanded-result").nth(2)).toContainText("Grilled Chicken by Case Status");
  await page.locator("#classic-output-history").click();
  await expect(page.locator("#classic-program-history-rows tr").filter({ hasText: "3 exposure fields" })).toHaveCount(1);

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-fisher-rxc.pgm");
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("Case Status by Sex");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-fisher")).toContainText("0.8747236693");

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-options.pgm");
  await expect(page.locator("#classic-tables-categorical-note")).toContainText("STATISTICS=NONE suppressed inferential output");
  await expect(page.locator("#classic-tables-categorical-note")).toContainText("NOWRAP/COLUMNSIZE were accepted as legacy compatibility no-ops");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-pearson")).toHaveCount(0);

  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-groupvar-outtable.pgm", 4);
  await expect(page.locator("#classic-program-source-name")).toContainText("FoodExposureStatusCounts · 8 of 8 records");
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(8);
  await expect(page.locator("#classic-list-output-body tr").first()).toContainText("grilled_chicken:case_status");

  // OUTTABLE changes the active READ source, so restore the canonical form before
  // exercising the second materialization fixture.
  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-read-current-form.pgm");
  await openAndRun("wasm/tests/fixtures/classic-command-parity/foodborne-tables-outtable.pgm", 3);
  await expect(page.locator("#classic-program-source-name")).toContainText("PotatoStatusBySex \u00b7 16 of 16 records");
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(16);
  await expect(page.locator("#classic-list-output-body tr").first()).toContainText("Female");
  await expect(page.locator("#classic-list-output-body tr").first()).toContainText("potato_salad:case_status");
  await expect(page.locator("#classic-list-output-body tr").nth(9)).toContainText("20");
});

test("Program Editor Cancel stops a sequential run and retains completed work", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const cancel = page.locator("#classic-program-toolbar-cancel");
  const run = page.locator("#classic-program-toolbar-run");
  await expect(cancel).toBeDisabled();
  const editor = page.locator("#classic-program-source .cm-content");
  await editor.fill(Array.from({ length: 250 }, () => "FREQ case_status").join("\n"));
  await run.click();
  await expect(cancel).toBeEnabled();
  await expect.poll(async () => Number(await page.locator("#classic-program-history-count").textContent())).toBeGreaterThan(0);
  await cancel.click();

  await expect(page.locator("#classic-program-command-status")).toContainText("Program cancelled by user");
  await expect(page.locator("#classic-program-feedback")).toContainText("Completed output, session effects, and history were retained");
  await expect(cancel).toBeDisabled();
  await expect(run).toBeEnabled();
  await expect(page.locator("#frequency-output")).toBeVisible();
  await expect(page.locator("#classic-program-history-rows tr").first().locator("td").nth(2)).toHaveText("cancelled");
  await expect(page.locator("#classic-program-history-rows")).toContainText("succeeded");
});

test("typed command dialogs insert visible source and selected commands fail closed", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  const editor = page.locator("#classic-program-source .cm-content");
  await tree.locator("summary").filter({ hasText: /^Data$/ }).click();
  await tree.getByRole("treeitem", { name: "Read", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-source option")).toContainText(["Foodborne Outbreak Investigation Form (96 records)"]);
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-toolbar-run").click();
  await expect(page.locator("#classic-program-session-status")).toContainText("Foodborne Outbreak Investigation Form · 96 records");
  await expect(page.locator("#classic-program-command-status")).toContainText("Selected READ command completed");

  const selectIf = tree.locator("details").filter({ hasText: "Select/If" });
  await selectIf.locator("summary").click();
  await tree.getByRole("treeitem", { name: "Select", exact: true }).click();
  await page.locator("#classic-command-dialog-select-field").selectOption("case_status");
  await page.locator("#classic-command-dialog-select-value").fill("Confirmed");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('SELECT case_status = "Confirmed"');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-session-status")).toContainText("22 of 96 records selected; 74 excluded");
  await expect(page.locator("#classic-program-session-status")).toContainText('SELECT (case_status = "Confirmed")');

  await tree.getByRole("treeitem", { name: "Sort", exact: true }).click();
  await page.locator('[data-sort-field="true"]').first().selectOption("age");
  await page.locator('[data-sort-direction="true"]').first().selectOption("DESC");
  await page.locator("#classic-command-dialog-add-sort").click();
  await page.locator('[data-sort-field="true"]').nth(1).selectOption("id");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("SORT age DESCENDING id ASCENDING");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-session-status")).toContainText("SORT age DESCENDING id ASCENDING");

  await tree.getByRole("treeitem", { name: "List", exact: true }).click();
  await page.locator("#classic-command-dialog-field").selectOption(["id", "age", "sex"]);
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("LIST id age sex");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-list-output-head th")).toHaveText(["ID", "Age", "Sex"]);
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(22);
  await expect(page.locator("#classic-list-output-note")).toHaveText("Showing all 22 records.");
  const descendingAges = (await page.locator("#classic-list-output-body tr td:nth-child(2)").allTextContents()).map(Number);
  expect(descendingAges.every((age, index) => index === 0 || descendingAges[index - 1] >= age)).toBe(true);

  await tree.getByRole("treeitem", { name: "Cancel Sort", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("CANCEL SORT");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-session-status")).not.toContainText("SORT age");
  await tree.getByRole("treeitem", { name: "List", exact: true }).click();
  await page.locator("#classic-command-dialog-field").selectOption(["id", "age", "sex"]);
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-list-output-body tr").first().locator("td").first()).toHaveText("P001");

  await tree.getByRole("treeitem", { name: "Cancel Select", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("CANCEL SELECT");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-session-status")).toContainText("96 records; no selection");

  await tree.getByRole("treeitem", { name: "Frequencies", exact: true }).click();
  await page.locator("#classic-command-dialog-field").selectOption("case_status");
  await page.locator("#classic-command-dialog-strata").selectOption("sex");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("FREQ case_status STRATAVAR=sex");
  await page.locator("#classic-command-dialog-insert").click();
  await expect(editor).toContainText("FREQ case_status STRATAVAR=sex");
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#frequency-stratified-title")).toHaveText("Case Status by Sex");
  await expect(page.locator("#classic-program-command-status")).toContainText("Selected FREQ command completed");

  await tree.getByRole("treeitem", { name: "Means", exact: true }).click();
  await page.locator("#classic-command-dialog-field").selectOption("age");
  await page.locator("#classic-command-dialog-insert").click();
  await expect(editor).toContainText("MEANS age");
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#means-output-title")).toHaveText("Age");
  await expect(page.locator("#classic-program-command-status")).toContainText("Selected MEANS command completed");

  await tree.getByRole("treeitem", { name: "Tables", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("TABLES potato_salad case_status STRATAVAR=sex");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-exposure-field")).toHaveValue("potato_salad");
  await expect(page.locator("#classic-outcome-field")).toHaveValue("case_status");
  await expect(page.locator("#classic-strata-field")).toHaveValue("sex");
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("Potato Salad by Case Status, stratified by Sex");
  await expect(page.locator("#classic-tables-categorical-body .classic-tables-stratum")).toHaveCount(2);
  await expect(page.locator("#classic-program-command-status")).toContainText("completed as a categorical cross-tabulation");

  const advanced = tree.locator("details").filter({ hasText: "Advanced Statistics" });
  await advanced.locator("summary").click();
  await tree.getByRole("treeitem", { name: "Complex Sample Frequencies", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-psu-label")).toBeVisible();
  await expect(page.locator("#classic-command-dialog-weight-label")).toBeVisible();
  await page.locator("#classic-command-dialog-outtable").fill("CaseStatusSurvey");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("FREQ case_status STRATAVAR=sex WEIGHTVAR=age PSUVAR=household_neighborhood OUTTABLE=CaseStatusSurvey");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-command-status")).toContainText("Selected PSUVAR FREQ command completed");
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-frequency tbody tr")).toHaveCount(4);

  await tree.getByRole("treeitem", { name: "Complex Sample Tables", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-psu-label")).toBeVisible();
  await expect(page.locator("#classic-command-dialog-fisher-label")).toBeHidden();
  await expect(page.locator("#classic-command-dialog-outtable-label")).toBeVisible();
  await page.locator("#classic-command-dialog-outcome").selectOption("hamburger");
  await page.locator("#classic-command-dialog-weight").selectOption("age");
  await page.locator("#classic-command-dialog-psu").selectOption("household_neighborhood");
  await page.locator("#classic-command-dialog-outtable").fill("PotatoHamburgerSurvey");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("TABLES potato_salad hamburger STRATAVAR=sex WEIGHTVAR=age PSUVAR=household_neighborhood OUTTABLE=PotatoHamburgerSurvey");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-command-status")).toContainText("Selected PSUVAR TABLES command completed");

  await tree.getByRole("treeitem", { name: "Complex Sample Means", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-outtable-label")).toContainText("browser adaptation");
  await expect(page.locator("#classic-command-dialog-outtable-label")).toBeVisible();
  await page.locator("#classic-command-dialog-outtable").fill("AgeSurvey");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("MEANS age STRATAVAR=case_status OUTTABLE=AgeSurvey PSUVAR=household_neighborhood");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-command-status")).toContainText("browser-adapted result table is available to READ");
  await expect(page.locator("#classic-tables-categorical-body .classic-complex-means tbody tr")).toHaveCount(1);

  await editor.fill("FREQ age\nMEANS age");
  await editor.press("Control+A");
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("Select exactly one complete command");
  await expect(page.locator("#classic-program-feedback")).toContainText("Nothing was run");
  await expect(page.locator("#classic-program-history-count")).toHaveText("14");
});

test("Define and Recode dialogs author a runnable foodborne program as visible source", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  const variables = tree.locator("details").filter({ hasText: "Variables" });
  await variables.locator("summary").click();
  await tree.getByRole("treeitem", { name: "Define", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("define");
  await page.locator("#classic-command-dialog-variable").fill("FoodAgeGroup");
  await page.locator("#classic-command-dialog-prompt").fill("Foodborne age group");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('DEFINE FoodAgeGroup TEXTINPUT "Foodborne age group"');
  await page.locator("#classic-command-dialog-insert").click();

  const editor = page.locator("#classic-program-source .cm-content");
  await expect(editor).toContainText('DEFINE FoodAgeGroup TEXTINPUT "Foodborne age group"');
  await tree.getByRole("treeitem", { name: "Recode", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("recode");
  await expect(page.locator("#classic-command-dialog-recode-rows tr")).toHaveCount(4);
  await page.locator("#classic-command-dialog-recode-source").selectOption("age");
  await page.locator("#classic-command-dialog-recode-target").selectOption("FoodAgeGroup");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("RECODE age TO FoodAgeGroup");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText('LOVALUE - 17 = "0-17"');
  await page.locator("#classic-command-dialog-insert").click();

  await tree.getByRole("treeitem", { name: "Frequencies", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-field option", { hasText: "Foodborne age group" })).toHaveCount(1);
  await page.locator("#classic-command-dialog-field").selectOption("FoodAgeGroup");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("FREQ FoodAgeGroup");
  await page.locator("#classic-command-dialog-insert").click();
  await expect(editor).toContainText("RECODE age TO FoodAgeGroup");
  await expect(editor).toContainText("FREQ FoodAgeGroup");

  await page.locator("#classic-program-run").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("Executed DEFINE → RECODE → FREQ for 96 records");
  await expect(page.locator("#classic-program-output-title")).toHaveText("Foodborne age group");
  await expect(page.locator("#classic-program-output-variable-heading")).toHaveText("Foodborne age group");
  await expect(page.locator("#classic-program-output-rows tr")).toHaveCount(4);
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("selected DEFINE and ASSIGN manage bounded Standard session variables", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  const variables = tree.locator("details").filter({ hasText: "Variables" });
  await variables.locator("summary").click();
  const editor = page.locator("#classic-program-source .cm-content");
  await tree.getByRole("treeitem", { name: "Define", exact: true }).click();
  await page.locator("#classic-command-dialog-variable").fill("ReviewLabel");
  await page.locator("#classic-command-dialog-variable-type").selectOption("TEXTINPUT");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("DEFINE ReviewLabel TEXTINPUT");
  await page.locator("#classic-command-dialog-insert").click();
  await editor.press("Control+A");
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-session-status")).toContainText("Variables: ReviewLabel=Missing");

  await tree.getByRole("treeitem", { name: "Assign", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-assign-variable")).toHaveValue("ReviewLabel");
  await page.locator("#classic-command-dialog-assign-value").fill("Priority review");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('ASSIGN ReviewLabel = "Priority review"');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-session-status")).toContainText("ReviewLabel=Priority review");
  await expect(page.locator("#classic-program-feedback")).toContainText("Record data was not changed");

  await editor.fill("ASSIGN age = 20");
  await editor.press("Control+A");
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("cannot mutate data-source fields");
  await expect(page.locator("#classic-program-feedback")).toContainText("Nothing was run");

  await tree.locator("summary").filter({ hasText: /^Data$/ }).click();
  await tree.getByRole("treeitem", { name: "Read", exact: true }).click();
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-session-status")).not.toContainText("Variables:");
  await expect(page.locator("#classic-program-history-count")).toHaveText("4");
});

test("bounded IF executes one audited Standard-variable ASSIGN branch", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();
  const editor = page.locator("#classic-program-source .cm-content");
  const run = page.locator("#classic-program-run-selection");
  for (const source of ["DEFINE ReviewLabel TEXTINPUT", "DEFINE PriorityFlag YN", 'ASSIGN ReviewLabel = "Priority review"']) {
    await editor.fill(source);
    await editor.press("Control+A");
    await run.click();
  }
  await expect(page.locator("#classic-program-session-status")).toContainText("ReviewLabel=Priority review");

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  await tree.locator("details").filter({ hasText: "Select/If" }).locator("summary").click();
  await tree.getByRole("treeitem", { name: "If", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("if");
  await page.locator("#classic-command-dialog-if-variable").selectOption("ReviewLabel");
  await page.locator("#classic-command-dialog-if-value").fill("Priority review");
  await page.locator("#classic-command-dialog-if-then-variable").selectOption("PriorityFlag");
  await page.locator("#classic-command-dialog-if-then-value").fill("Yes (+)");
  await page.locator("#classic-command-dialog-if-else-variable").selectOption("PriorityFlag");
  await page.locator("#classic-command-dialog-if-else-value").fill("No (-)");
  await expect(page.locator("#classic-command-dialog-preview")).toContainText('IF ReviewLabel = "Priority review" THEN');
  await expect(page.locator("#classic-command-dialog-preview")).toContainText("ASSIGN PriorityFlag = (+)");
  await page.locator("#classic-command-dialog-insert").click();
  await editor.press("Control+A");
  await run.click();
  await expect(page.locator("#classic-program-session-status")).toContainText("PriorityFlag=true");
  await expect(page.locator("#classic-program-feedback")).toContainText("IF evaluated true; THEN");
  await expect(page.locator("#classic-program-feedback")).toContainText("Record data was not changed");
  await expect(page.locator("#classic-program-history-count")).toHaveText("4");

  await editor.fill("IF age >= 18 THEN\n  ASSIGN PriorityFlag = (+)\nEND");
  await editor.press("Control+A");
  await run.click();
  await expect(page.locator("#classic-program-feedback")).toContainText("Record-field IF conditions");
  await expect(page.locator("#classic-program-feedback")).toContainText("Nothing was run");
});

test("UNDEFINE removes one or all Standard session variables", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();
  const editor = page.locator("#classic-program-source .cm-content");
  const run = page.locator("#classic-program-run-selection");
  for (const source of ["DEFINE ReviewLabel TEXTINPUT", "DEFINE PriorityFlag YN"]) {
    await editor.fill(source);
    await editor.press("Control+A");
    await run.click();
  }
  await expect(page.locator("#classic-program-session-status")).toContainText("ReviewLabel=Missing");
  await expect(page.locator("#classic-program-session-status")).toContainText("PriorityFlag=Missing");

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  await tree.locator("details").filter({ hasText: "Variables" }).locator("summary").click();
  await tree.getByRole("treeitem", { name: "Undefine", exact: true }).click();
  await page.locator("#classic-command-dialog-undefine-variable").selectOption("ReviewLabel");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("UNDEFINE ReviewLabel");
  await page.locator("#classic-command-dialog-insert").click();
  await run.click();
  await expect(page.locator("#classic-program-session-status")).not.toContainText("ReviewLabel=");
  await expect(page.locator("#classic-program-session-status")).toContainText("PriorityFlag=Missing");

  await tree.getByRole("treeitem", { name: "Undefine", exact: true }).click();
  await page.locator("#classic-command-dialog-undefine-all").check();
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("UNDEFINE *");
  await page.locator("#classic-command-dialog-insert").click();
  await run.click();
  await expect(page.locator("#classic-program-session-status")).not.toContainText("Variables:");
  await expect(page.locator("#classic-program-feedback")).toContainText("Undefined 1 Standard session variable");
  await expect(page.locator("#classic-program-feedback")).toContainText("Record data was not changed");
  await expect(page.locator("#classic-program-history-count")).toHaveText("4");
});

test("DISPLAY DBVARIABLES renders familiar variable metadata without mutation", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();
  const editor = page.locator("#classic-program-source .cm-content");
  const run = page.locator("#classic-program-run-selection");
  for (const source of ['DEFINE ReviewLabel TEXTINPUT "Review label"', 'ASSIGN ReviewLabel = "Priority review"']) {
    await editor.fill(source);
    await editor.press("Control+A");
    await run.click();
  }

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  await tree.locator("details").filter({ hasText: "Variables" }).locator("summary").click();
  await tree.getByRole("treeitem", { name: "Display", exact: true }).click();
  await page.locator("#classic-command-dialog-display-mode").selectOption("defined");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("DISPLAY DBVARIABLES DEFINE");
  await page.locator("#classic-command-dialog-insert").click();
  await run.click();
  await expect(page.locator("#classic-display-output")).toBeVisible();
  await expect(page.locator("#classic-display-output-body tr")).toHaveCount(1);
  await expect(page.locator("#classic-display-output-body")).toContainText("ReviewLabel");
  await expect(page.locator("#classic-display-output-body")).toContainText("Priority review");
  await expect(page.locator("#classic-display-output-body")).toContainText("Standard");

  await tree.getByRole("treeitem", { name: "Display", exact: true }).click();
  await page.locator("#classic-command-dialog-display-mode").selectOption("list");
  await page.locator("#classic-command-dialog-display-variables").selectOption(["ReviewLabel", "case_status"]);
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("DISPLAY DBVARIABLES LIST case_status ReviewLabel");
  await page.locator("#classic-command-dialog-insert").click();
  await run.click();
  await expect(page.locator("#classic-display-output-body tr")).toHaveCount(2);
  await expect(page.locator("#classic-display-output-body")).toContainText("Case Status");
  await expect(page.locator("#classic-program-session-status")).toContainText("ReviewLabel=Priority review");
  await expect(page.locator("#classic-program-feedback")).toContainText("No data or session state was changed");
  await expect(page.locator("#classic-program-history-count")).toHaveText("4");
});

test("DEFINE GROUPVAR stores a foodborne field group and LIST expands it", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const editor = page.locator("#classic-program-source .cm-content");
  const run = page.locator("#classic-program-run-selection");
  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  await tree.locator("details").filter({ hasText: "Variables" }).locator("summary").click();
  await tree.getByRole("treeitem", { name: "DefineGroup", exact: true }).click();
  await page.locator("#classic-command-dialog-group-name").fill("FoodSymptoms");
  await page.locator("#classic-command-dialog-group-members").selectOption(["diarrhea", "vomiting", "nausea", "abdominal_cramps", "fever"]);
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("DEFINE FoodSymptoms GROUPVAR diarrhea vomiting nausea abdominal_cramps fever");
  await page.locator("#classic-command-dialog-insert").click();
  await editor.press("Control+A");
  await run.click();
  await expect(page.locator("#classic-program-session-status")).toContainText("Groups: FoodSymptoms=[diarrhea, vomiting, nausea, abdominal_cramps, fever]");
  await expect(page.locator("#classic-program-feedback")).toContainText("Record data was not changed");

  if (!(await page.locator("#classic-command-list").isVisible())) await tree.getByText("Statistics", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "List", exact: true }).click();
  await page.locator("#classic-command-dialog-field").selectOption(["id", "FoodSymptoms"]);
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("LIST id FoodSymptoms");
  await page.locator("#classic-command-dialog-insert").click();
  await run.click();
  await expect(page.locator("#classic-list-output-head th")).toHaveText(["ID", "Diarrhea", "Vomiting", "Nausea", "Abdominal Cramps", "Fever"]);
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(96);
  await expect(page.locator("#classic-list-output-note")).toHaveText("Showing all 96 records.");
  await expect(page.locator("#classic-program-history-count")).toHaveText("2");
});

test("RELATE joins a current-project foodborne form and activates the combined table", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const editor = page.locator("#classic-program-source .cm-content");
  const run = page.locator("#classic-program-run-selection");
  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-relate").isVisible())) await tree.getByText("Data", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Relate", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-source")).toHaveValue("Foodborne Outbreak Investigation Form");
  await page.locator("#classic-command-dialog-relate-current-key").selectOption("id");
  await page.locator("#classic-command-dialog-relate-related-key").selectOption("id");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("RELATE [Foodborne Outbreak Investigation Form] id :: id MATCHING");
  await page.locator("#classic-command-dialog-insert").click();
  await editor.press("Control+A");
  await run.click();
  await expect(page.locator("#classic-program-source-name")).toContainText("Foodborne Outbreak Investigation Form + Foodborne Outbreak Investigation Form");
  await expect(page.locator("#classic-program-feedback")).toContainText("96 combined records are now active");
  await expect(page.locator("#classic-program-feedback")).toContainText("0 unmatched parent records");

  await editor.fill("LIST id case_status case_status2");
  await editor.press("Control+A");
  await run.click();
  await expect(page.locator("#classic-list-output-head th")).toHaveText(["ID", "Case Status", "Case Status (Foodborne Outbreak Investigation Form)"]);
  await expect(page.locator("#classic-list-output-body tr")).toHaveCount(96);
  await expect(page.locator("#classic-program-history-count")).toHaveText("2");
});

test("WRITE exports selected active foodborne fields through an explicit browser download", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-write").isVisible())) await tree.getByText("Data", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Write (Export)", exact: true }).click();
  await page.locator("#classic-command-dialog-write-file").fill("foodborne-demo.csv");
  await page.locator("#classic-command-dialog-write-fields").selectOption(["id", "age", "sex", "case_status"]);
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('WRITE REPLACE "Text" {foodborne-demo.csv}:foodborne_demo#csv id age sex case_status');
  await page.locator("#classic-command-dialog-insert").click();
  const editor = page.locator("#classic-program-source .cm-content");
  await editor.press("Control+A");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#classic-program-run-selection").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("foodborne-demo.csv");
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString("utf8").replace(/^\ufeff/, "");
  expect(csv.split("\r\n")).toHaveLength(97);
  expect(csv.split("\r\n")[0]).toBe("id,age,sex,case_status");
  await expect(page.locator("#classic-program-feedback")).toContainText("96 active records and 4 fields");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("MERGE previews and explicitly confirms current-project destination changes", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-merge").isVisible())) await tree.getByText("Data", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Merge", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-source")).toHaveValue("Foodborne Outbreak Investigation Form");
  await page.locator("#classic-command-dialog-merge-current-key").selectOption("id");
  await page.locator("#classic-command-dialog-merge-source-key").selectOption("id");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("MERGE [Foodborne Outbreak Investigation Form] id :: id");
  await page.locator("#classic-command-dialog-insert").click();
  const editor = page.locator("#classic-program-source .cm-content");
  await editor.press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator("#classic-merge-preview-dialog")).toBeVisible();
  await expect(page.locator("#classic-merge-preview-before")).toHaveText("96");
  await expect(page.locator("#classic-merge-preview-source-count")).toHaveText("96");
  await expect(page.locator("#classic-merge-preview-updated")).toHaveText("96");
  await expect(page.locator("#classic-merge-preview-inserted")).toHaveText("0");
  await expect(page.locator("#classic-merge-preview-after")).toHaveText("96");
  await expect(page.locator("#classic-program-feedback")).toContainText("No records have changed");
  await expect(page.locator("#classic-program-history-count")).toHaveText("0");

  await page.locator("#classic-merge-preview-apply").click();
  await expect(page.locator("#classic-merge-preview-dialog")).toBeHidden();
  await expect(page.locator("#classic-program-feedback")).toContainText("MERGE applied");
  await expect(page.locator("#classic-program-feedback")).toContainText("96 destination records are now active");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("DELETE TABLES requires review and preserves the foodborne form design", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-delete-file-table").isVisible())) await tree.getByText("Data", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Delete File/Table", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("DELETE TABLES [Foodborne Outbreak Investigation Form]");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator("#classic-delete-preview-dialog")).toBeVisible();
  await expect(page.locator("#classic-delete-preview-records")).toHaveText("96");
  await expect(page.locator("#classic-program-history-count")).toHaveText("0");
  await expect(page.locator("#classic-delete-preview-apply")).toBeDisabled();
  await page.locator("#classic-delete-preview-confirm").check();
  await page.locator("#classic-delete-preview-apply").click();
  await expect(page.locator("#classic-delete-preview-dialog")).toBeHidden();
  await expect(page.locator("#classic-program-feedback")).toContainText("96 records were removed");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
  await page.locator('[data-module="forms"]').click();
  await expect(page.locator("#field-list tr")).toHaveCount(27);
});

test("DELETE RECORDS moves matching foodborne records to the recoverable Recycle Bin", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-delete-records").isVisible())) await tree.getByText("Data", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Delete Records", exact: true }).click();
  await page.locator("#classic-command-dialog-delete-field").selectOption("case_status");
  await page.locator("#classic-command-dialog-delete-value").fill("Confirmed");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('DELETE (case_status = "Confirmed")');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator("#classic-delete-records-preview-dialog")).toBeVisible();
  await expect(page.locator("#classic-delete-records-preview-source")).toHaveText("96");
  await expect(page.locator("#classic-delete-records-preview-matched")).toHaveText("22");
  await expect(page.locator("#classic-delete-records-preview-remaining")).toHaveText("74");
  await expect(page.locator("#classic-program-history-count")).toHaveText("0");
  await page.locator("#classic-delete-records-preview-confirm").check();
  await page.locator("#classic-delete-records-preview-apply").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("22 records moved to the Recycle Bin");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");

  await page.locator('[data-module="data"]').click();
  await expect(page.locator("#record-count")).toHaveText("(74)");
  await page.locator("#enter-data-quality").click();
  await expect(page.locator("#data-quality-deleted-record option")).toHaveCount(23);
  await expect(page.locator("#data-quality-audit-log")).toContainText("DELETE (case_status = \"Confirmed\")");
  await page.locator("[data-close-data-quality]").last().click();

  await page.locator('[data-module="classic"]').click();
  if (!(await page.locator("#classic-command-undelete-records").isVisible())) await tree.getByText("Data", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Undelete Records", exact: true }).click();
  await page.locator("#classic-command-dialog-undelete-field").selectOption("case_status");
  await page.locator("#classic-command-dialog-undelete-value").fill("Confirmed");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('UNDELETE (case_status = "Confirmed")');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-undelete-records-preview-dialog")).toBeVisible();
  await expect(page.locator("#classic-undelete-records-preview-active")).toHaveText("74");
  await expect(page.locator("#classic-undelete-records-preview-deleted")).toHaveText("22");
  await expect(page.locator("#classic-undelete-records-preview-matched")).toHaveText("22");
  await expect(page.locator("#classic-undelete-records-preview-after")).toHaveText("96");
  await page.locator("#classic-undelete-records-preview-confirm").check();
  await page.locator("#classic-undelete-records-preview-apply").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("22 records restored");
  await expect(page.locator("#classic-program-history-count")).toHaveText("2");
  await page.locator('[data-module="data"]').click();
  await expect(page.locator("#record-count")).toHaveText("(96)");
  await page.locator("#enter-data-quality").click();
  await expect(page.locator("#data-quality-deleted-record option")).toHaveCount(1);
  await expect(page.locator("#data-quality-audit-log")).toContainText("UNDELETE (case_status = \"Confirmed\")");
});

test("SUMMARIZE creates a named foodborne age-by-sex output table", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-summarize").isVisible())) await tree.getByText("Statistics", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Summarize", exact: true }).click();
  await page.locator("#classic-command-dialog-summarize-aggregate").selectOption("AVG");
  await page.locator("#classic-command-dialog-summarize-field").selectOption("age");
  await page.locator("#classic-command-dialog-summarize-result").fill("AverageAge");
  await page.locator("#classic-command-dialog-summarize-table").fill("FoodborneAgeBySex");
  await page.locator("#classic-command-dialog-summarize-strata").selectOption("sex");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("SUMMARIZE AverageAge :: AVG(age) TO FoodborneAgeBySex STRATAVAR=sex");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator("#classic-summarize-output")).toBeVisible();
  await expect(page.locator("#classic-summarize-output-title")).toHaveText("FoodborneAgeBySex");
  await expect(page.locator("#classic-summarize-output-body tr")).toHaveCount(2);
  await expect(page.locator("#classic-summarize-output-body")).toContainText("43.5416666667");
  await expect(page.locator("#classic-summarize-output-body")).toContainText("38.0625");
  await expect(page.locator("#classic-program-feedback")).toContainText("created in-session table FoodborneAgeBySex with 2 rows");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");

  if (!(await page.locator("#classic-command-read").isVisible())) await tree.getByText("Data", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Read", exact: true }).click();
  await page.locator("#classic-command-dialog-source").selectOption({ label: "FoodborneAgeBySex (2 records)" });
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("READ FoodborneAgeBySex");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();
  await expect(page.locator("#classic-program-source-name")).toContainText("FoodborneAgeBySex · 2 of 2 records");
  await expect(page.locator("#classic-program-history-count")).toHaveText("2");
});

test("Classic GRAPH renders the foodborne case-status Bar chart", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-graph").isVisible())) await tree.getByText("Statistics", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Graph", exact: true }).click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("graph");
  await page.locator("#classic-command-dialog-field").selectOption("case_status");
  await page.locator("#classic-command-dialog-graph-title").fill("Foodborne cases by status");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('GRAPH case_status GRAPHTYPE="Bar" TITLETEXT="Foodborne cases by status" XTITLE="Count" YTITLE="Case Status"');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator("#classic-graph-output")).toBeVisible();
  await expect(page.locator("#classic-graph-output-title")).toHaveText("Foodborne cases by status");
  await expect(page.locator("#classic-graph-output-plot svg")).toBeVisible();
  await expect(page.locator('#classic-graph-output-plot svg[data-orientation="horizontal"]')).toBeVisible();
  await expect(page.locator("#classic-graph-output-plot rect")).toHaveCount(4);
  await expect(page.locator("#classic-graph-output-body tr")).toHaveCount(4);
  await expect(page.locator("#classic-graph-output-body")).toContainText("Not a case");
  await expect(page.locator("#classic-graph-output-body")).toContainText("52");
  await expect(page.locator("#classic-program-feedback")).toContainText("GRAPH rendered 4 horizontal bars from 96 active records");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("NEW BRANCH Quality Profile runs as visible audited IDE source", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const newBranches = page.locator(".classic-command-group").filter({ hasText: "New Branches" });
  await newBranches.locator("summary").click();
  await page.locator("#classic-command-quality").click();
  await expect(page.locator("#classic-command-dialog-kind")).toHaveValue("quality");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText("EPIAI QUALITY *");
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator("#classic-quality-output")).toBeVisible();
  await expect(page.locator("#classic-quality-output-count")).toHaveText("96 records · 27 fields");
  await expect(page.locator('#classic-quality-output-body tr[data-field-name="hospitalization_date"]')).toContainText("74");
  await expect(page.locator('#classic-quality-output-body tr[data-field-name="hospitalization_date"] .classic-quality-mini-bar')).toHaveAttribute("aria-label", "77.1% missing");
  await expect(page.locator("#classic-program-feedback")).toContainText("No data changed");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("NEW BRANCH FILE CONVERT migrates the legacy Sample MDB to a SQLite download", async ({ page }) => {
  test.skip(!existsSync(legacySampleMdb), "The private legacy-source Sample.mdb fixture is not available in this checkout.");
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();
  const newBranches = page.locator(".classic-command-group").filter({ hasText: "New Branches" });
  await newBranches.locator("summary").click();
  await page.locator("#classic-command-file-convert").click();
  await page.locator("#classic-command-dialog-access-file").setInputFiles(legacySampleMdb);
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('FILE CONVERT "Sample.mdb" TO "Sample.sqlite"');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#classic-program-run-selection").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Sample.sqlite");
  const sqlitePath = await download.path();
  const sqliteBytes = await readFile(sqlitePath);
  expect(sqliteBytes.subarray(0, 16).toString("utf8")).toBe("SQLite format 3\0");
  expect(sqliteBytes.length).toBeGreaterThan(100_000);
  await expect(page.locator("#classic-file-convert-output")).toBeVisible();
  await expect(page.locator("#classic-file-convert-output-body tr").first()).toBeVisible();
  await expect(page.locator("#classic-file-convert-output-warnings")).toContainText("Forms, reports, macros, VBA");
  await expect(page.locator("#classic-program-feedback")).toContainText("Converted");
  await expect(page.locator("#classic-program-feedback")).toContainText("migration manifest");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("NEW BRANCH FILE CONVERT selects DuckDB from the output extension", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!existsSync(legacySampleMdb), "The private legacy-source Sample.mdb fixture is not available in this checkout.");
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();
  const newBranches = page.locator(".classic-command-group").filter({ hasText: "New Branches" });
  await newBranches.locator("summary").click();
  await page.locator("#classic-command-file-convert").click();
  await page.locator("#classic-command-dialog-access-file").setInputFiles(legacySampleMdb);
  await page.locator("#classic-command-dialog-file-convert-target").selectOption("duckdb");
  await expect(page.locator("#classic-command-dialog-file-convert-name")).toHaveValue("Sample.duckdb");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('FILE CONVERT "Sample.mdb" TO "Sample.duckdb"');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#classic-program-run-selection").click();
  const download = await Promise.race([
    downloadPromise,
    page.locator("#classic-program-feedback").filter({ hasText: "Nothing was run" }).waitFor().then(async () => {
      throw new Error(await page.locator("#classic-program-feedback").textContent() ?? "DuckDB conversion failed without feedback.");
    }),
  ]);
  expect(download.suggestedFilename()).toBe("Sample.duckdb");
  const duckdbPath = await download.path();
  const duckdbBytes = await readFile(duckdbPath);
  expect(duckdbBytes.length).toBeGreaterThan(100_000);
  expect(duckdbBytes.subarray(8, 12).toString("ascii")).toBe("DUCK");
  await expect(page.locator("#classic-file-convert-output-summary")).toContainText("DuckDB");
  await expect(page.locator("#classic-file-convert-output-warnings")).toContainText("analytical conversion target");
  await expect(page.locator("#classic-program-feedback")).toContainText("DuckDB download includes a migration manifest");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("Classic GRAPH renders Column separately from Bar", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-graph").isVisible())) await tree.getByText("Statistics", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Graph", exact: true }).click();
  await page.locator("#classic-command-dialog-field").selectOption("case_status");
  await page.locator("#classic-command-dialog-graph-type").selectOption("Column");
  await page.locator("#classic-command-dialog-graph-x-title").fill("Case Status");
  await page.locator("#classic-command-dialog-graph-y-title").fill("Count");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('GRAPH case_status GRAPHTYPE="Column" TITLETEXT="Foodborne cases by status" XTITLE="Case Status" YTITLE="Count"');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator('#classic-graph-output-plot svg[data-orientation="vertical"]')).toBeVisible();
  await expect(page.locator("#classic-graph-output-plot rect")).toHaveCount(4);
  await expect(page.locator("#classic-program-feedback")).toContainText("GRAPH rendered 4 vertical columns from 96 active records");
});

test("Classic GRAPH renders an auditable foodborne Pie chart", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.locator('[data-module="classic"]').click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#classic-program-toolbar-new").click();

  const tree = page.getByRole("tree", { name: "Classic Analysis commands" });
  if (!(await page.locator("#classic-command-graph").isVisible())) await tree.getByText("Statistics", { exact: true }).click();
  await tree.getByRole("treeitem", { name: "Graph", exact: true }).click();
  await page.locator("#classic-command-dialog-field").selectOption("case_status");
  await page.locator("#classic-command-dialog-graph-type").selectOption("Pie");
  await page.locator("#classic-command-dialog-graph-title").fill("Foodborne case status");
  await page.locator("#classic-command-dialog-graph-x-title").fill("");
  await page.locator("#classic-command-dialog-graph-y-title").fill("");
  await expect(page.locator("#classic-command-dialog-preview")).toHaveText('GRAPH case_status GRAPHTYPE="Pie" TITLETEXT="Foodborne case status"');
  await page.locator("#classic-command-dialog-insert").click();
  await page.locator("#classic-program-source .cm-content").press("Control+A");
  await page.locator("#classic-program-run-selection").click();

  await expect(page.locator('#classic-graph-output-plot svg[data-orientation="radial"][data-chart-type="Pie"]')).toBeVisible();
  await expect(page.locator("#classic-graph-output-plot .classic-graph-slice")).toHaveCount(4);
  await expect(page.locator("#classic-graph-output-plot .classic-graph-slice[tabindex='0']")).toHaveCount(4);
  await expect(page.locator("#classic-graph-output-body tr")).toHaveCount(4);
  await expect(page.locator("#classic-graph-output-body")).toContainText("Not a case");
  await expect(page.locator("#classic-program-feedback")).toContainText("GRAPH rendered 4 pie slices from 96 active records");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");
});

test("Program Editor safely runs the taught age-group RECODE and records history", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await expect(page.locator("#classic-program-source-name")).toContainText("96 records");
  await expect(page.locator("#classic-program-source .cm-lineNumbers")).toBeVisible();
  await expect(page.locator("#classic-program-live-status")).toContainText("Program syntax is valid");
  await page.locator("#view-menu summary").click();
  await page.locator("#view-program-line-numbers").click();
  await expect(page.locator("#classic-program-source .cm-lineNumbers")).toBeHidden();
  await page.locator("#view-program-line-numbers").click();
  await expect(page.locator("#classic-program-source .cm-lineNumbers")).toBeVisible();
  await page.locator('[data-program-tab-size="8"]').click();
  await page.locator("#view-program-indent-tabs").click();
  await page.locator("#view-menu summary").click();
  await expect(page.locator("#classic-program-tab-status")).toHaveText("Tab width 8 · Spaces");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.program-editor-preferences.v1")))).toEqual({
    lineNumbers: true,
    tabSize: 8,
    indentWithTabs: false,
    fontFamily: "Consolas",
    fontSize: 15,
  });
  await page.locator("#classic-program-menu summary").filter({ hasText: /^Fonts$/ }).click();
  await page.locator("#classic-program-font").click();
  await expect(page.getByRole("dialog", { name: "Set Editor Font" })).toBeVisible();
  await page.locator("#classic-program-font-family").selectOption("Courier New");
  await page.locator("#classic-program-font-size").fill("18");
  await expect(page.locator("#classic-program-font-preview")).toHaveCSS("font-size", "18px");
  await page.locator("#classic-program-font-apply").click();
  await expect(page.locator("#classic-program-source .cm-content")).toHaveCSS("font-size", "18px");
  await expect(page.locator("#classic-program-source .cm-content")).toHaveCSS("font-family", /Courier New/);
  await expect(page.locator("#classic-program-font-status")).toHaveText("Courier New · 18 px");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.program-editor-preferences.v1")))).toMatchObject({ fontFamily: "Courier New", fontSize: 18 });
  const editor = page.locator("#classic-program-source .cm-content");
  await editor.click();
  const caretStyle = await page.evaluate(() => {
    const caret = document.querySelector("#classic-program-source .cm-cursor");
    if (!(caret instanceof HTMLElement)) throw new Error("Program Editor caret was not rendered.");
    const style = getComputedStyle(caret);
    const layerStyle = getComputedStyle(caret.parentElement);
    return { backgroundColor: style.backgroundColor, width: style.width, borderLeftWidth: style.borderLeftWidth, animationName: layerStyle.animationName };
  });
  expect(caretStyle.backgroundColor).toBe("rgb(210, 24, 42)");
  expect(parseFloat(caretStyle.width)).toBeGreaterThanOrEqual(4);
  expect(parseFloat(caretStyle.width)).toBeLessThan(8);
  expect(caretStyle.borderLeftWidth).toBe("0px");
  expect(caretStyle.animationName).toBe("epi-program-caret-blink");
  await editor.fill("RECODE ");
  const completionList = page.locator("#classic-program-source .cm-tooltip-autocomplete");
  await expect(completionList).toBeVisible();
  await expect(completionList).toContainText("age");
  await expect(completionList).not.toContainText("sex");
  await editor.press("a");
  await editor.press("Enter");
  await expect(editor).toContainText("RECODE age");
  await page.locator("#classic-program-toolbar-open").click();
  await expect(page.locator(".classic-program-examples")).toBeVisible();
  await expect(page.locator("#classic-program-example option")).toHaveCount(6);
  await page.locator("#classic-program-example").selectOption("age-band-by-case-status");
  await expect(page.locator("#classic-program-example-description")).toContainText("Case Status");
  await page.locator("#classic-program-load-example").click();
  await expect(editor).toContainText("DEFINE BroadAgeGroup TEXTINPUT");
  await expect(page.locator("#classic-program-live-status")).toContainText("Program syntax is valid");
  await page.locator("#classic-program-run").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("Executed DEFINE → RECODE → FREQ for 96 records");
  await expect(page.locator("#classic-program-output-title")).toHaveText("Broad age group by Case Status");
  await expect(page.locator("#classic-program-output-variable-heading")).toHaveText("Broad age group");
  await expect(page.locator("#classic-program-history-count")).toHaveText("1");

  await page.locator("#classic-program-toolbar-open").click();
  await page.locator("#classic-program-example").selectOption("life-stage-by-sex");
  await page.locator("#classic-program-load-example").click();
  await page.locator("#classic-program-verify").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("Program verified");
  await expect(page.locator("#classic-program-canonical")).toHaveCount(0);
  await expect(page.locator("#classic-program-history-count")).toHaveText("2");

  await page.locator("#classic-program-run").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("Executed DEFINE → RECODE → FREQ for 96 records");
  await expect(page.locator("#classic-program-output-rows tr")).toHaveCount(8);
  expect(await page.locator("#classic-program-output-rows tr").allTextContents()).toEqual([
    "Female18-442041.7%41.7%27.6%56.8%",
    "Female45-641327.1%68.8%15.3%41.8%",
    "Female5-17510.4%79.2%3.5%22.7%",
    "Female65+1020.8%100.0%10.5%35.0%",
    "Male18-442654.2%54.2%39.2%68.6%",
    "Male45-641633.3%87.5%20.4%48.4%",
    "Male5-17510.4%97.9%3.5%22.7%",
    "Male65+12.1%100.0%0.1%11.1%",
  ]);
  await expect(page.locator("#classic-program-history-count")).toHaveText("3");

  await page.locator("#classic-program-toolbar-open").click();
  await page.locator("#classic-program-example").selectOption("potato-salad-by-case-status");
  await expect(page.locator("#classic-program-example-description")).toContainText("unstratified categorical TABLES");
  await page.locator("#classic-program-load-example").click();
  await expect(editor).toHaveText("TABLES potato_salad case_status STATISTICS=FISHER");
  await page.locator("#classic-program-toolbar-run").click();
  await expect(page.locator("#classic-program-command-status")).toHaveText("Program completed: 1 of 1 commands succeeded.");
  await expect(page.locator("#classic-tables-categorical-title")).toHaveText("Potato Salad by Case Status");
  await expect(page.locator("#classic-tables-categorical-count")).toHaveText("96 records · unstratified");
  await expect(page.locator("#classic-program-history-count")).toHaveText("5");

  await editor.fill(`${await editor.innerText()}\nEXECUTE "malware.exe"`);
  await expect(page.locator("#classic-program-live-status")).toContainText("Unsupported command: EXECUTE");
  await page.locator("#classic-program-run").click();
  await expect(page.locator("#classic-program-feedback")).toContainText("Unsupported command: EXECUTE");
  await expect(page.locator("#classic-program-feedback")).toContainText("Nothing was run");
  await expect(page.locator("#classic-program-output")).toBeHidden();
  await expect(page.locator("#classic-program-history-count")).toHaveText("6");
});

test("Classic Analysis MEANS derives foodborne Age descriptive statistics", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await openClassicDeveloperControls(page);
  await expect(page.locator("#means-field")).toHaveValue("age");
  await expect(page.locator("#means-generated-command")).toHaveText("MEANS age");
  await page.locator("#means-run").click();

  await expect(page.locator("#means-feedback")).toContainText("Included 96 of 96 records; excluded 0");
  await expect(page.locator("#means-output-title")).toHaveText("Age");
  await expect(page.locator("#means-observations")).toHaveText("96");
  await expect(page.locator("#means-total")).toHaveText("3917.0000");
  await expect(page.locator("#means-mean")).toHaveText("40.8021");
  await expect(page.locator("#means-variance")).toHaveText("312.6446");
  await expect(page.locator("#means-std-dev")).toHaveText("17.6818");
  await expect(page.locator("#means-minimum")).toHaveText("5.0000");
  await expect(page.locator("#means-quartile-25")).toHaveText("27.5000");
  await expect(page.locator("#means-median")).toHaveText("40.5000");
  await expect(page.locator("#means-quartile-75")).toHaveText("54.5000");
  await expect(page.locator("#means-maximum")).toHaveText("75.0000");
  await expect(page.locator("#means-mode")).toHaveText("31.0000");
});

test("Visual Dashboard Rates derives the foodborne Confirmed rate", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="dashboard"]').click();
  await expect(page.getByRole("heading", { name: "Visual Dashboard" })).toBeVisible();
  await expect(page.locator("#rates-numerator-field")).toHaveValue("case_status");
  await expect(page.locator("#rates-numerator-value")).toHaveValue("Confirmed");
  await expect(page.locator("#rates-denominator-field")).toHaveValue("id");
  await page.locator("#rates-run").click();

  await expect(page.locator("#rates-feedback")).toContainText("Included 96 of 96 records; excluded 0");
  await expect(page.locator("#rates-numerator")).toHaveText("22");
  await expect(page.locator("#rates-false-count")).toHaveText("74");
  await expect(page.locator("#rates-denominator")).toHaveText("96");
  await expect(page.locator("#rates-value")).toHaveText("22.9167");
});

test("Visual Dashboard Epi Curve charts foodborne onset dates by case status", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="dashboard"]').click();
  await expect(page.locator("#epi-curve-date-field")).toHaveValue("onset_date");
  await expect(page.locator("#epi-curve-status-field")).toHaveValue("case_status");
  await page.locator("#epi-curve-run").click();

  await expect(page.locator("#epi-curve-feedback")).toContainText("Plotted 44 of 96 records in 3 intervals");
  await expect(page.locator("#epi-curve-table-body tr")).toHaveCount(3);
  await expect(page.locator("#epi-curve-table-body tr").nth(0)).toContainText("Jan 10, 2026");
  await expect(page.locator("#epi-curve-table-body tr").nth(0)).toContainText("1");
  await expect(page.locator("#epi-curve-table-body tr").nth(1)).toContainText("32");
  await expect(page.locator("#epi-curve-table-body tr").nth(2)).toContainText("11");
  await expect(page.locator("#epi-curve-warnings")).toContainText("52 records have no Onset Date value");
});

test("StatCalc Population Survey preserves the legacy default table and clustered design", async ({ page }) => {
  await page.getByRole("button", { name: "StatCalc", exact: true }).first().click();
  await page.getByRole("button", { name: "Population Survey", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Population Survey" })).toBeVisible();
  await expect(page.locator("#population-size")).toHaveValue("999999");
  await expect(page.locator("#population-expected-frequency")).toHaveValue("50");
  await expect(page.locator("#population-margin-error")).toHaveValue("5");
  await expect(page.locator("#population-design-effect")).toHaveValue("1.0");
  await expect(page.locator("#population-clusters")).toHaveValue("1");
  await expect(page.locator("#population-survey-rows tr")).toHaveCount(7);
  await expect(page.locator("#population-survey-rows tr").nth(2)).toHaveText(/95%384384/);
  await expect(page.locator("#population-survey-rows tr").nth(6)).toHaveText(/99\.99%15121512/);

  await page.locator("#population-size").fill("10000");
  await page.locator("#population-design-effect").fill("2");
  await page.locator("#population-clusters").fill("10");
  await page.locator("#population-survey-calculate").click();
  await expect(page.locator("#population-survey-rows tr").nth(2)).toHaveText(/95%74740/);
});

test("StatCalc Cohort or Cross-Sectional preserves sample sizes and linked effects", async ({ page }) => {
  await page.getByRole("button", { name: "StatCalc", exact: true }).first().click();
  await page.getByRole("button", { name: "Cohort or Cross-Sectional", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Cohort or Cross-Sectional" })).toBeVisible();
  await expect(page.locator("#cohort-confidence")).toHaveValue("0.999");
  await page.locator("#cohort-confidence").selectOption("0.95");
  await expect(page.locator("#cohort-rows tr")).toHaveCount(3);
  await expect(page.locator("#cohort-rows tr").nth(0)).toHaveText(/Exposed131216/);
  await expect(page.locator("#cohort-rows tr").nth(1)).toHaveText(/Unexposed131216/);
  await expect(page.locator("#cohort-rows tr").nth(2)).toHaveText(/Total262432/);

  await page.locator("#cohort-unexposed-outcome").fill("10");
  await page.locator("#cohort-ratio").fill("2");
  await page.locator("#cohort-odds-ratio").fill("2");
  await page.locator("#cohort-calculate").click();
  await expect(page.locator("#cohort-risk-ratio")).toHaveValue("1.81818");
  await expect(page.locator("#cohort-exposed-outcome")).toHaveValue("18.18182");
  await expect(page.locator("#cohort-rows tr").nth(2)).toHaveText(/Total587615669/);
});

test("StatCalc Unmatched Case-Control preserves sample sizes and linked exposures", async ({ page }) => {
  await page.getByRole("button", { name: "StatCalc", exact: true }).first().click();
  await page.getByRole("button", { name: "Unmatched Case-Control", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Unmatched Case-Control", exact: true })).toBeVisible();
  await expect(page.locator("#unmatched-confidence")).toHaveValue("0.999");
  await page.locator("#unmatched-confidence").selectOption("0.95");
  await expect(page.locator("#unmatched-rows tr")).toHaveCount(3);
  await expect(page.locator("#unmatched-rows tr").nth(0)).toHaveText(/Cases171620/);
  await expect(page.locator("#unmatched-rows tr").nth(1)).toHaveText(/Controls171620/);
  await expect(page.locator("#unmatched-rows tr").nth(2)).toHaveText(/Total343240/);

  await page.locator("#unmatched-control-exposure").fill("20");
  await page.locator("#unmatched-ratio").fill("2");
  await page.locator("#unmatched-odds-ratio").fill("3");
  await page.locator("#unmatched-calculate").click();
  await expect(page.locator("#unmatched-case-exposure")).toHaveValue("42.85714");
  await expect(page.locator("#unmatched-rows tr").nth(2)).toHaveText(/Total137140159/);
});

test("Classic Analysis renders non-zero OR/RR homogeneity results", async ({ page }) => {
  await page.getByRole("button", { name: "Classic", exact: true }).click();
  await openClassicDeveloperControls(page);
  const values = [
    ["Stratum 1", "10", "20", "15", "25"],
    ["Stratum 2", "30", "10", "10", "30"],
    ["Stratum 3", "8", "12", "14", "16"],
  ];
  await page.locator("#add-stratum").click();
  for (let row = 0; row < values.length; row += 1) {
    const inputs = page.locator("#strata-rows tr").nth(row).locator("input");
    for (let column = 0; column < values[row].length; column += 1) await inputs.nth(column).fill(values[row][column]);
  }
  await page.locator("#stratified-form").getByRole("button", { name: "Calculate adjusted results" }).click();
  await expect(page.locator("#stratified-bdt-or-value")).toHaveText("14.69");
  await expect(page.locator("#stratified-legacy-bd-or-value")).toHaveText("14.16");
  await expect(page.locator("#stratified-bd-or-value")).toHaveText("14.71");
  await expect(page.locator("#stratified-bdt-or-p")).toHaveText("0.0006");
  await expect(page.locator("#stratified-legacy-bd-rr-value")).toHaveText("10.99");
  await expect(page.locator("#stratified-legacy-bd-rr-p")).toHaveText("0.0041");
  await expect(page.locator("#stratified-conditional-or")).toHaveText("2.03");
  await expect(page.locator("#stratified-conditional-or-ci")).toContainText("1.10");
  await expect(page.locator("#stratified-conditional-or-ci")).toContainText("3.75");
});

test("stratified analysis runs in a cancellable Worker and recovers after cancellation", async ({ page }) => {
  const evidence = await page.evaluate(async () => {
    const workerClient = await import("/stratified-worker-client.js");
    await workerClient.calculateStratifiedTable2x2InWorker({
      confidenceLevel: 0.95,
      strata: [
        { id: "warmup", label: "Warm-up", exposedCases: 1, exposedNonCases: 1, unexposedCases: 1, unexposedNonCases: 1 },
      ],
    });
    const input = {
      confidenceLevel: 0.95,
      strata: Array.from({ length: 1024 }, (_, index) => ({
        id: `cancel-${index + 1}`,
        label: `Cancel ${index + 1}`,
        exposedCases: 1,
        exposedNonCases: 1,
        unexposedCases: 1,
        unexposedNonCases: 1,
      })),
    };
    const controller = new AbortController();
    const cancelled = workerClient.calculateStratifiedTable2x2InWorker(input, { signal: controller.signal })
      .then(() => "completed", (error) => error.name);
    controller.abort();
    const cancellation = await cancelled;
    const recovered = await workerClient.calculateStratifiedTable2x2InWorker({
      confidenceLevel: 0.95,
      strata: [
        { id: "female", label: "Female", exposedCases: 18, exposedNonCases: 6, unexposedCases: 4, unexposedNonCases: 20 },
        { id: "male", label: "Male", exposedCases: 18, exposedNonCases: 6, unexposedCases: 4, unexposedNonCases: 20 },
      ],
    });
    return {
      cancellation,
      estimate: recovered.result.estimates.adjustedConditionalOddsRatio.estimate,
      durationMs: recovered.durationMs,
    };
  });
  expect(evidence.cancellation).toBe("AbortError");
  expect(evidence.estimate.state).toBe("finite");
  expect(evidence.estimate.value).toBeCloseTo(13.92417586473359, 10);
  expect(evidence.durationMs).toBeGreaterThanOrEqual(0);

  await page.getByRole("button", { name: "Classic", exact: true }).last().click();
  await openClassicDeveloperControls(page);
  await page.locator("#stratified-form").getByRole("button", { name: "Calculate adjusted results" }).click();
  await expect(page.locator("#stratified-worker-status")).toContainText("Worker completed");
});

test("JupyterLite validation lab V0.9 is part of the Pages artifact", async ({ page, request }) => {
  const response = await page.goto("/validation-lab/lab/index.html?path=validate-table2x2.ipynb");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Epi Info AI Validation Lab|JupyterLite/, { timeout: 30_000 });

  const notebookResponse = await request.get("/validation-lab/files/validate-table2x2.ipynb");
  expect(notebookResponse.ok()).toBe(true);
  const notebook = await notebookResponse.json();
  expect(notebook.nbformat).toBe(4);
  expect(JSON.stringify(notebook)).toContain("foodborne-outbreak-v1-table2x2.json");
  expect(JSON.stringify(notebook)).toContain("risk_ratio_ci_lower");
  expect(JSON.stringify(notebook)).toContain("fisher_exact_two_tailed");
  expect(JSON.stringify(notebook)).toContain("mid_p_exact_one_tailed");
  expect(JSON.stringify(notebook)).toContain("conditional_odds_ratio_fisher_lower");
  expect(JSON.stringify(notebook)).toContain("nchypergeom_fisher");

  const stratifiedResponse = await request.get("/validation-lab/files/validate-stratified2x2.ipynb");
  expect(stratifiedResponse.ok()).toBe(true);
  const stratifiedNotebook = await stratifiedResponse.json();
  expect(JSON.stringify(stratifiedNotebook)).toContain("stratified_mh_odds_ratio");
  expect(JSON.stringify(stratifiedNotebook)).toContain("mantelHaenszelCorrected");
  expect(JSON.stringify(stratifiedNotebook)).toContain("datasetSha256");
  expect(JSON.stringify(stratifiedNotebook)).toContain("Potato Salad");
  expect(JSON.stringify(stratifiedNotebook)).toContain("stratified_breslow_day_tarone_odds_ratio");
  expect(JSON.stringify(stratifiedNotebook)).toContain("stratified_legacy_woolf_odds_ratio");
  expect(JSON.stringify(stratifiedNotebook)).toContain("stratified_legacy_woolf_risk_ratio");
  expect(JSON.stringify(stratifiedNotebook)).toContain("stratified_conditional_odds_ratio_fisher_lower");
  expect(JSON.stringify(stratifiedNotebook)).toContain("stratified-exact-v0.8.json");
  expect(JSON.stringify(stratifiedNotebook)).toContain("stratified-operational-v0.8.json");
  expect(JSON.stringify(stratifiedNotebook)).toContain("scipy.stats");

  const operationalResponse = await request.get("/validation-fixtures/stratified-operational-v0.8.json");
  expect(operationalResponse.ok()).toBe(true);
  const operational = await operationalResponse.json();
  expect(operational.generatedCases[0].strata).toBe(1024);
  expect(operational.reviewedLimits.maximumConvolutionWork).toBe(2_000_000);

  const frequencyResponse = await request.get("/validation-lab/files/validate-frequency.ipynb");
  expect(frequencyResponse.ok()).toBe(true);
  const frequencyNotebook = await frequencyResponse.json();
  expect(JSON.stringify(frequencyNotebook)).toContain("foodborne-frequency-v0.9.json");
  expect(JSON.stringify(frequencyNotebook)).toContain("frequency_ci_lower");
  expect(JSON.stringify(frequencyNotebook)).toContain("scipy.stats");

  const frequencyFixtureResponse = await request.get("/validation-fixtures/foodborne-frequency-v0.9.json");
  expect(frequencyFixtureResponse.ok()).toBe(true);
  const frequencyFixture = await frequencyFixtureResponse.json();
  expect(frequencyFixture.expected.includedRecords).toBe(96);
  expect(frequencyFixture.expected.categories.map((category) => category.frequency)).toEqual([22, 52, 16, 6]);

  const meansResponse = await request.get("/validation-lab/files/validate-means.ipynb");
  expect(meansResponse.ok()).toBe(true);
  const meansNotebook = await meansResponse.json();
  expect(JSON.stringify(meansNotebook)).toContain("foodborne-means-v0.10.json");
  expect(JSON.stringify(meansNotebook)).toContain("means_sample_variance");
  expect(JSON.stringify(meansNotebook)).toContain("statistics.variance");

  const meansFixtureResponse = await request.get("/validation-fixtures/foodborne-means-v0.10.json");
  expect(meansFixtureResponse.ok()).toBe(true);
  const meansFixture = await meansFixtureResponse.json();
  expect(meansFixture.expected.statistics.mean).toBeCloseTo(40.802083333333336, 12);
  expect(meansFixture.expected.statistics.median).toBe(40.5);

  const rateResponse = await request.get("/validation-lab/files/validate-rate.ipynb");
  expect(rateResponse.ok()).toBe(true);
  const rateNotebook = await rateResponse.json();
  expect(JSON.stringify(rateNotebook)).toContain("foodborne-rate-v0.11.json");
  expect(JSON.stringify(rateNotebook)).toContain("rate_calculate");

  const rateFixtureResponse = await request.get("/validation-fixtures/foodborne-rate-v0.11.json");
  expect(rateFixtureResponse.ok()).toBe(true);
  const rateFixture = await rateFixtureResponse.json();
  expect(rateFixture.expected).toMatchObject({ numerator: 22, denominator: 96, falseCount: 74 });

  const populationResponse = await request.get("/validation-lab/files/validate-population-survey.ipynb");
  expect(populationResponse.ok()).toBe(true);
  const populationNotebook = await populationResponse.json();
  expect(JSON.stringify(populationNotebook)).toContain("population-survey-v0.12.json");
  expect(JSON.stringify(populationNotebook)).toContain("population_survey_cluster_size");

  const populationFixtureResponse = await request.get("/validation-fixtures/population-survey-v0.12.json");
  expect(populationFixtureResponse.ok()).toBe(true);
  const populationFixture = await populationFixtureResponse.json();
  expect(populationFixture.cases[0].expected.map((row) => row.clusterSize)).toEqual([164, 270, 384, 471, 663, 1082, 1512]);

  const cohortResponse = await request.get("/validation-lab/files/validate-cohort-cross-sectional.ipynb");
  expect(cohortResponse.ok()).toBe(true);
  const cohortNotebook = await cohortResponse.json();
  expect(JSON.stringify(cohortNotebook)).toContain("cohort-cross-sectional-v0.13.json");
  expect(JSON.stringify(cohortNotebook)).toContain("cohort_sample_size");

  const cohortFixtureResponse = await request.get("/validation-fixtures/cohort-cross-sectional-v0.13.json");
  expect(cohortFixtureResponse.ok()).toBe(true);
  const cohortFixture = await cohortFixtureResponse.json();
  expect(cohortFixture.cases[0].methods.map((method) => method.total)).toEqual([26, 24, 32]);

  const unmatchedResponse = await request.get("/validation-lab/files/validate-unmatched-case-control.ipynb");
  expect(unmatchedResponse.ok()).toBe(true);
  const unmatchedNotebook = await unmatchedResponse.json();
  expect(JSON.stringify(unmatchedNotebook)).toContain("unmatched-case-control-v0.14.json");
  expect(JSON.stringify(unmatchedNotebook)).toContain("unmatched_case_control_sample_size");

  const unmatchedFixtureResponse = await request.get("/validation-fixtures/unmatched-case-control-v0.14.json");
  expect(unmatchedFixtureResponse.ok()).toBe(true);
  const unmatchedFixture = await unmatchedFixtureResponse.json();
  expect(unmatchedFixture.cases[0].methods.map((method) => method.total)).toEqual([34, 32, 40]);
});

test("integrated Sample, outbreak, Toledo, and WorldPop examples are downloadable", async ({ request }) => {
  const sampleResponse = await request.get("/examples/sample-project.epia.json");
  expect(sampleResponse.ok()).toBe(true);
  const sample = await sampleResponse.json();
  expect(sample.format).toBe("epi-info-ai-project");
  expect(sample.version).toBe(2);
  expect(sample.project.forms).toHaveLength(18);
  expect(sample.programs[0].name).toBe("Statistics");
  expect(sample.migration.inventory).toEqual({ forms: 18, pages: 26, fields: 417, programs: 1, codeTables: 22 });

  const csvResponse = await request.get("/examples/foodborne-outbreak-investigation.csv");
  expect(csvResponse.ok()).toBe(true);
  const csv = await csvResponse.text();
  const rows = csv.trim().split(/\r?\n/);
  expect(rows).toHaveLength(97);
  expect(rows[0]).toContain("Latitude,Longitude,Household Neighborhood");

  const excelResponse = await request.get("/examples/foodborne-outbreak-investigation.xlsx");
  expect(excelResponse.ok()).toBe(true);
  const excel = await excelResponse.body();
  expect(createHash("sha256").update(excel).digest("hex")).toBe(
    "ed94c4201abd251304db8b3fddf3c8733bbc46d46bbbcb0f115b7804c6740b9d",
  );

  const geoJsonResponse = await request.get("/examples/city-of-toledo-neighborhoods.geojson");
  expect(geoJsonResponse.ok()).toBe(true);
  const geoJson = await geoJsonResponse.json();
  expect(geoJson.type).toBe("FeatureCollection");
  expect(geoJson.features).toHaveLength(87);
  expect(geoJson.features.every((feature) => feature.geometry?.type === "MultiPolygon")).toBe(true);
  expect(geoJson.features.every((feature) => typeof feature.properties?.name === "string")).toBe(true);

  const rasterResponse = await request.get("/examples/worldpop-toledo-population-density.tif");
  expect(rasterResponse.ok()).toBe(true);
  const raster = await rasterResponse.body();
  expect(raster).toHaveLength(304873);
  expect([...raster.subarray(0, 4)]).toEqual([0x49, 0x49, 0x2a, 0x00]);
  expect(createHash("sha256").update(raster).digest("hex")).toBe(
    "cf7ec32de75d9b782a141e0e8e361216d9c74a71b467486aaa4f0c1782060df1",
  );
});

test("Chi Square for Trend preserves the familiar table and Rust result", async ({ page }) => {
  await page.locator('[data-open-module="statcalc"]').click();
  await page.getByRole("button", { name: "Chi Square for Trend" }).click();
  await expect(page.getByRole("heading", { name: "Chi Square for Trend" })).toBeVisible();
  await page.locator("#trend-example").click();
  await expect(page.locator("#trend-rows tr")).toHaveCount(4);
  await expect(page.locator("#trend-chi-square")).toHaveText("26.60000");
  await expect(page.locator("#trend-p-value")).toHaveText("< 0.0001");
  await expect(page.locator('[data-trend-odds]').last()).toHaveText("6.000");
});

test("Maps uploads and renders the WorldPop GeoTIFF below vector panes", async ({ page }) => {
  await page.getByRole("button", { name: "Create Maps" }).click();
  await page.getByText("Add Data Layer", { exact: true }).click();
  await page.getByRole("button", { name: "GeoTIFF Raster..." }).click();
  await page.locator("#raster-file").setInputFiles("wasm/demo/examples/worldpop-toledo-population-density.tif");
  await page.locator("#raster-form").getByRole("button", { name: "Add Layer" }).click();
  await expect(page.locator("#map-raster-layers")).toContainText("worldpop-toledo-population-density");
  await expect(page.locator(".leaflet-image-layer")).toBeVisible();
  await expect(page.locator("#map-status")).toContainText("beneath vector layers");
});

test("Epi Assist previews reviewed actions without loading or contacting a model", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");
  await page.getByRole("button", { name: /Epi Assist/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Epi Assist" })).toBeVisible();
  await expect(page.locator("#epi-assist-status")).toContainText("not loaded");
  await expect(page.locator("#epi-assist-model option")).toHaveCount(5);
  await expect(page.locator("#epi-assist-model")).toHaveValue("granite-4.0-350m-wasm");
  await expect(page.locator("#epi-assist-model-description")).toContainText("CPU via WebAssembly");
  await page.locator("#epi-assist-model").selectOption("granite-4.0-1b");
  await expect(page.locator("#epi-assist-model-description")).toContainText("1.78 GB");
  await expect(page.locator("#epi-assist-load")).toHaveText("Load Granite 4.0 1B — WebGPU");
  await expect(page.locator("#epi-assist-status")).toContainText("Granite 4.0 1B Instruct — WebGPU selected");
  await page.locator("#epi-assist-model").selectOption("openai-chatgpt");
  await expect(page.locator("#epi-assist-provider-badge")).toHaveText("Managed gateway");
  await expect(page.locator("#epi-assist-model-description")).toContainText("same-origin Epi Assist gateway");
  await expect(page.locator("#epi-assist-privacy")).toContainText("provider API keys are never sent to or stored in this client");
  await page.route("**/api/epi-assist/v1/propose", async (route) => {
    const request = route.request().postDataJSON();
    expect(request.provider).toBe("openai");
    expect(request.modelAlias).toBe("chatgpt");
    expect(request.context.records).toBeUndefined();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({
      schemaVersion: "1.0.0",
      provider: "openai",
      model: { id: "approved-chatgpt-model", revision: "2026-09-03" },
      requestId: "browser-gateway-test-1",
      toolCalls: [{ name: "run_frequency", arguments: { field_name: "age", stratify_by: "sex" } }],
      audit: { systemVersion: "gateway-system-v1", toolSchemaVersion: "epi-assist-tools-v3" },
    }) });
  });
  await page.locator("#epi-assist-load").click();
  await expect(page.locator("#epi-assist-ask")).toBeEnabled();
  await page.locator("#epi-assist-prompt").fill("Show age distribution by sex");
  await page.locator("#epi-assist-ask").click();
  await expect(page.locator("#epi-assist-result-source")).toContainText("approved-chatgpt-model");
  await expect(page.locator("#epi-assist-actions button")).toHaveText("Run Frequency: Age by Sex");
  await page.locator("#epi-assist-run-details").click();
  await expect(page.locator("#epi-assist-run-request-id")).toHaveText("browser-gateway-test-1");
  await page.locator("#epi-assist-guided").click();
  await expect(page.locator("#epi-assist-result-source")).toContainText("Granite not used");
  await expect(page.locator("#epi-assist-actions button").first()).toBeVisible();
  await page.locator("#epi-assist-actions button").filter({ hasText: "Run Frequency" }).click();
  await expect(page.getByRole("heading", { name: "Analysis" })).toBeVisible();
  await expect(page.locator("#frequency-feedback")).toContainText("Included");
  await expect(page.locator("#frequency-output")).toBeVisible();
});

test("Program Editor Epi Assist hands its prompt to the model-backed dialog", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("Created 27 fields and imported 96 records");

  await page.locator('[data-module="classic"]').click();
  await page.locator("#classic-program-assist-prompt").fill("Show gender distribution by status");
  await page.locator("#classic-program-assist-preview").click();

  await expect(page.getByRole("dialog", { name: "Epi Assist" })).toBeVisible();
  await expect(page.locator("#epi-assist-prompt")).toHaveValue("Show gender distribution by status");
  await expect(page.locator("#epi-assist-status")).toContainText("not loaded");
  await expect(page.locator("#epi-assist-ask")).toBeDisabled();
});
