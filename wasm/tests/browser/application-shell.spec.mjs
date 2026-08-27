import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#main-menu-title")).toBeAttached();
});

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

test("File menu opens and saves the migrated official Sample project", async ({ page }) => {
  await page.locator("#project-package-open").setInputFiles("wasm/demo/examples/sample-project.epia.json");
  await expect(page.locator("#main-menu-status")).toContainText("Opened Sample");

  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await expect(page.locator("#project-tree-name")).toContainText("Sample");
  await expect(page.locator("#form-name")).toHaveValue("Oswego");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("navigation", { name: "Application menu" }).getByText("File", { exact: true }).click();
  await page.getByRole("menuitem", { name: "Save Project As" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Sample.epia.json");
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
  await expect(page.locator("#csv-status")).toContainText("Imported 3 records from sample-case-data.csv.");
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
  await expect(page.locator("#csv-status")).toHaveText("Imported 1 record from one-case.json.");
  await expect(page.locator("#record-count")).toHaveText("(1)");
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

  await designerMenu.getByText("File", { exact: true }).click();
  await expect(designerMenu.getByRole("menuitem", { name: "Recent Projects" })).toBeDisabled();
  await designerMenu.getByRole("menuitem", { name: "New Project" }).click();
  await expect(page.getByRole("dialog", { name: "Create a Project Data Store" })).toBeVisible();
  await page.keyboard.press("Escape");

  await designerMenu.getByText("File", { exact: true }).click();
  await designerMenu.getByRole("menuitem", { name: "Project Storage" }).click();
  await expect(page.getByRole("dialog", { name: "Project Storage" })).toBeVisible();
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

test("production artifact opens Maps and initializes Leaflet", async ({ page }) => {
  await page.getByRole("button", { name: "Create Maps" }).click();
  await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible();
  await expect(page.locator("#epi-map")).toHaveClass(/leaflet-container/);
  await expect(page.getByRole("button", { name: "Enter map fullscreen" })).toBeVisible();
  await expect(page.getByText("Add Data Layer", { exact: true })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Stratified 2 x 2 (Mantel-Haenszel)" })).toBeVisible();
  await page.locator("#stratified-form").getByRole("button", { name: "Calculate adjusted results" }).click();
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

test("Classic Analysis renders non-zero OR/RR homogeneity results", async ({ page }) => {
  await page.getByRole("button", { name: "Classic", exact: true }).click();
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
  await page.locator("#stratified-form").getByRole("button", { name: "Calculate adjusted results" }).click();
  await expect(page.locator("#stratified-worker-status")).toContainText("Worker completed");
});

test("JupyterLite validation lab V0.8 is part of the Pages artifact", async ({ page, request }) => {
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
