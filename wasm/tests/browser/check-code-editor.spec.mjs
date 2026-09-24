import { expect, test } from "@playwright/test";
import { resolve } from "node:path";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("#project-package-open").setInputFiles("wasm/demo/examples/projects/foodborne-outbreak-investigation.epia.json");
  await expect(page.locator("#main-menu-status")).toContainText("Opened Foodborne Outbreak Investigation");
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
});

test("Check Code Editor exposes working Undo and Redo controls", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  const source = dialog.getByRole("textbox", { name: "Check Code source" });
  await dialog.getByRole("button", { name: "New", exact: true }).click();
  await expect(source).toContainText("New Epi Info Check Code program");
  await source.fill("*** UndoMarker\nForm\nBefore\nBEEP\nEnd-Before\nEnd-Form\n");
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(source).not.toContainText("UndoMarker");
  await expect(dialog.locator("#check-code-editor-status")).toContainText("Undid");
  await dialog.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(source).toContainText("UndoMarker");
  await expect(dialog.locator("#check-code-editor-status")).toContainText("Redid");
});

test("Check Code Editor verifies, applies, and executes the bounded foodborne program", async ({ page }) => {
  const designer = page.getByRole("navigation", { name: "Form Designer menu" });
  await designer.getByText("Tools", { exact: true }).click();
  await designer.getByRole("menuitem", { name: "Check Code Editor..." }).click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#check-code-project-program option', { hasText: "foodborne-check-code-tour" })).toHaveCount(1);
  await dialog.locator("#check-code-project-program").selectOption({ label: "foodborne-check-code-tour" });
  await dialog.locator("#check-code-project-program-open").click();
  await expect(dialog.locator("#check-code-editor-status")).toContainText("Opened project Check Code foodborne-check-code-tour");
  await dialog.locator("#check-code-file").setInputFiles("wasm/demo/examples/foodborne/foodborne-check-code-tour.chk");
  await expect(dialog.locator("#check-code-editor-status")).toContainText("Opened foodborne-check-code-tour.chk");
  await dialog.getByRole("button", { name: "Verify Source" }).click();
  await expect(dialog.locator("#check-code-editor-status")).toContainText("Valid typed AST");
  await expect(dialog.locator("#check-code-apply")).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save .chk..." }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.chk$/);
  await dialog.locator("#check-code-apply").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("#form-status")).toContainText("Verified Check Code applied");

  await page.locator('[data-module="data"]').click();
  const message = page.getByRole("dialog", { name: "Foodborne case review" });
  await expect(message).toContainText("Continue reviewing this foodborne case?");
  await message.locator("#check-code-dialog-select").selectOption("true");
  await message.getByRole("button", { name: "OK" }).click();
  const age = page.locator('#record-form [name="age"]');
  await age.fill("130");
  await age.press("Tab");
  const ageReview = page.getByRole("dialog", { name: "Age plausibility review" });
  await expect(ageReview).toContainText("Age must be between 0 and 120 years.");
  await ageReview.getByRole("button", { name: "OK" }).click();
  await expect(age.locator("xpath=ancestor::*[contains(@class,'record-field')][1]")).toHaveAttribute("data-check-code-highlighted", "true");
  await age.fill("34");
  await age.press("Tab");
  await expect(age.locator("xpath=ancestor::*[contains(@class,'record-field')][1]")).not.toHaveAttribute("data-check-code-highlighted", "true");
  const caseStatus = page.locator('#record-form [name="case_status"]');
  const onsetDate = page.locator('#record-form [name="onset_date"]');
  await caseStatus.fill("Confirmed");
  await caseStatus.press("Tab");
  await expect(onsetDate).toHaveAttribute("required", "");
  await expect(onsetDate.locator("xpath=ancestor::*[contains(@class,'record-field')][1]")).toHaveAttribute("data-check-code-highlighted", "true");
  await expect(onsetDate).toBeFocused();
  await expect(page.locator("#record-status")).toContainText("moved to onset_date");
  await expect(page.locator('#record-page-nav button[data-entry-page="Clinical"]')).toHaveAttribute("aria-current", "page");
  await onsetDate.fill("2026-01-10");
  await page.locator('#record-page-nav button[data-entry-page="EntryPage"]').click();
  await expect(message).toBeVisible();
  await message.locator("#check-code-dialog-select").selectOption("true");
  await message.getByRole("button", { name: "OK" }).click();
  await page.locator('#record-form button[name="save_record"]').click();
  await expect(page.locator("#record-count")).toHaveText("(97)");
  await expect(message).toBeVisible();
  await message.locator("#check-code-dialog-select").selectOption("true");
  await message.getByRole("button", { name: "OK" }).click();
  const checkCodeAudit = await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem("epi-info-ai.project-state.v1") ?? "null");
    return project.auditLog.filter((event) => event.action === "check-code-executed").map((event) => event.detail);
  });
  expect(checkCodeAudit.some((detail) => detail.includes("form before"))).toBeTruthy();
  expect(checkCodeAudit.some((detail) => detail.includes("page EntryPage before"))).toBeTruthy();
  expect(checkCodeAudit.some((detail) => detail.includes("record after"))).toBeTruthy();
});

test("packaged foodborne expressions verify as a typed Check Code program", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  await expect(dialog.locator('#check-code-project-program option', { hasText: "foodborne-check-code-expressions" })).toHaveCount(1);
  await dialog.locator("#check-code-project-program").selectOption({ label: "foodborne-check-code-expressions" });
  await dialog.locator("#check-code-project-program-open").click();
  await expect(dialog.getByRole("textbox", { name: "Check Code source" })).toContainText("ROUND(ABS(age - 40) / 3, 2)");
  await expect(dialog.getByRole("textbox", { name: "Check Code source" })).toContainText("UPPERCASE(SUBSTRING(case_status, 1, 4))");
  await dialog.getByRole("button", { name: "Verify Source" }).click();
  await expect(dialog.locator("#check-code-editor-status")).toContainText("Valid typed AST");
  await expect(dialog.locator("#check-code-apply")).toBeEnabled();
});

test("Check Code Editor provides line numbers, font and tab preferences, search, and line diagnostics", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  const source = dialog.getByRole("textbox", { name: "Check Code source" });
  await expect(dialog.locator(".cm-lineNumbers")).toBeVisible();

  await dialog.locator("#check-code-line-numbers").click();
  await expect(dialog.locator(".cm-lineNumbers")).toHaveCount(0);
  await dialog.locator("#check-code-line-numbers").click();
  await expect(dialog.locator(".cm-lineNumbers")).toBeVisible();

  await dialog.locator("#check-code-tab-size").selectOption("8");
  await dialog.locator("#check-code-indent-tabs").uncheck();
  await expect(dialog.locator("#check-code-tab-status")).toHaveText("Tab width 8 · Spaces");

  await dialog.locator("#check-code-font").click();
  const fontDialog = page.getByRole("dialog", { name: "Set Check Code Font" });
  await fontDialog.locator("#check-code-font-family").selectOption("Courier New");
  await fontDialog.locator("#check-code-font-size").fill("18");
  await fontDialog.locator("#check-code-font-apply").click();
  await expect(dialog.locator("#check-code-font-status")).toHaveText("Courier New · 18 px");
  await expect(dialog.locator(".cm-editor")).toHaveAttribute("style", /Courier New.*18px/);

  await source.press("Control+f");
  const searchDialog = page.getByRole("dialog", { name: "Find Check Code" });
  await expect(searchDialog).toBeVisible();
  await searchDialog.locator("#check-code-search-query").fill("case_status");
  await searchDialog.locator("#check-code-search-find").click();
  await expect(searchDialog.locator("#check-code-search-status")).toContainText("Match selected");
  await searchDialog.locator('.legacy-dialog-actions button[value="cancel"]').click();

  await source.fill("Form\n  Before\n    ASSIGN MissingField = \"unsafe\"\n  End-Before\nEnd-Form\n");
  await expect(dialog.locator("#check-code-live-status")).toContainText("line 3");
  await expect(dialog.locator(".cm-lint-marker-error")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("epi-info-ai.check-code-editor-preferences.v1")))).toMatchObject({
    lineNumbers: true,
    tabSize: 8,
    indentWithTabs: false,
    fontFamily: "Courier New",
    fontSize: 18,
  });
});

test("Check Code Editor executes bounded relative page GOTO against the validated page model", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  await dialog.getByRole("textbox", { name: "Check Code source" }).fill("Form\n  Before\n    GOTO +1\n  End-Before\nEnd-Form\n");
  await dialog.getByRole("button", { name: "Verify Source" }).click();
  await expect(dialog.locator("#check-code-editor-status")).toContainText("complete source is executable");
  await expect(dialog.locator("#check-code-apply")).toBeEnabled();
  await dialog.locator("#check-code-apply").click();
  await page.locator('[data-module="data"]').click();
  await expect(page.locator('#record-page-nav button[data-entry-page="Clinical"]')).toHaveAttribute("aria-current", "page");
});

test("Check Code Editor rejects unresolved references without partial execution", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  await dialog.getByRole("textbox", { name: "Check Code source" }).fill("Form\n  Before\n    ASSIGN MissingField = \"unsafe\"\n  End-Before\nEnd-Form\n");
  await dialog.getByRole("button", { name: "Verify Source" }).click();
  await expect(dialog.locator("#check-code-editor-status")).toContainText("execution remains disabled");
  await expect(dialog.locator("#check-code-editor-diagnostics")).toContainText("MissingField");
  await expect(dialog.locator("#check-code-apply")).toBeDisabled();
});

test("IOCODE remains editable but requires the governed occupational epidemiology package", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  await dialog.getByRole("textbox", { name: "Check Code source" }).fill(`Field id
  After
    IOCODE id, sex, case_status, id, sex, case_status, id
  End-After
End-Field
`);
  await dialog.getByRole("button", { name: "Verify Source" }).click();
  await expect(dialog.locator("#check-code-editor-status")).toContainText("execution remains disabled");
  await expect(dialog.locator("#check-code-editor-diagnostics")).toContainText("Occupational Epidemiology package");
  await expect(dialog.locator("#check-code-editor-diagnostics")).not.toContainText("Unsupported statement");
  await expect(dialog.locator("#check-code-apply")).toBeDisabled();
});

test("capability package import verifies inert assets and preserves the IOCODE execution gate", async ({ page }) => {
  const fixtureRoot = resolve("wasm/tests/fixtures/capability-package");
  const fixtureFor = (url) => {
    if (url.endsWith("/epi-info-capability.json")) return resolve(fixtureRoot, "epi-info-capability.json");
    if (url.includes("/examples/iocode-check-code-tour.chk")) return resolve(fixtureRoot, "examples/iocode-check-code-tour.chk");
    if (url.includes("/fixtures/package-boundary.json")) return resolve(fixtureRoot, "fixtures/package-boundary.json");
    if (url.includes("/docs/model-card-placeholder.md")) return resolve(fixtureRoot, "docs/model-card-placeholder.md");
    return null;
  };
  await page.route("https://git.cdc.gov/epi-info-ai/package-occupational-epidemiology/**", (route) => route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<html><title>Sign in</title></html>",
  }));
  await page.route("https://raw.githubusercontent.com/epi-info-ai/iocode-occupational-epidemiology/**", async (route) => {
    const path = fixtureFor(route.request().url());
    if (!path) return route.abort();
    await route.fulfill({ path });
  });

  await page.locator("#help-menu summary").click();
  await page.locator("#help-capability-packages").click();
  const packages = page.getByRole("dialog", { name: "Capability Packages" });
  await packages.locator("#capability-package-preset").selectOption({ label: "Occupational Epidemiology: IOCODE" });
  await packages.getByRole("button", { name: "Preview package" }).click();
  await expect(packages.locator("#capability-package-preview-title")).toHaveText("Occupational Epidemiology: IOCODE");
  await expect(packages.locator("#capability-package-preview-manifest-source")).toHaveText("raw.githubusercontent.com");
  await expect(packages.locator("#capability-package-preview-scientific")).toContainText("Not approved");
  await expect(packages.locator("#capability-package-preview-signature")).toContainText("integrity checks only");
  await expect(packages.locator("#capability-package-preview-authority")).toContainText("No execution");
  await expect(packages.locator("#capability-package-install")).toBeEnabled();
  await packages.locator("#capability-package-install").click();
  await expect(packages.locator("#capability-package-status")).toContainText("installed as inert assets");
  await expect(packages.locator("#capability-package-installed-summary")).toContainText("passed 3 artifact checks");
  await packages.getByRole("button", { name: "Close" }).last().click();

  await page.locator("#designer-toolbar-check-code").click();
  const editor = page.getByRole("dialog", { name: "Check Code Editor" });
  await editor.getByRole("textbox", { name: "Check Code source" }).fill(`Field id
  After
    IOCODE id, sex, case_status, id, sex, case_status, id
  End-After
End-Field
`);
  await editor.getByRole("button", { name: "Verify Source" }).click();
  await expect(editor.locator("#check-code-editor-diagnostics")).toContainText("installed and integrity-checked");
  await expect(editor.locator("#check-code-editor-diagnostics")).toContainText("scientific execution is not approved");
  await expect(editor.locator("#check-code-apply")).toBeDisabled();
});

test("Check Code database dialogs use bounded current-project catalogs", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const editor = page.getByRole("dialog", { name: "Check Code Editor" });
  await editor.getByRole("textbox", { name: "Check Code source" }).fill(`DefineVariables
  DEFINE ChosenField STANDARD TEXTINPUT
  DEFINE ChosenStatus STANDARD TEXTINPUT
  DEFINE ChosenView STANDARD TEXTINPUT
  DEFINE ChosenDatabase STANDARD TEXTINPUT
End-DefineVariables
Form
  Before
    DIALOG "Choose field" ChosenField DBVARIABLES TITLETEXT="Fields"
    DIALOG "Choose status" ChosenStatus DBVALUES current case_status TITLETEXT="Statuses"
    DIALOG "Choose view" ChosenView DBVIEWS TITLETEXT="Project forms"
    DIALOG "Choose database" ChosenDatabase DATABASES TITLETEXT="Project stores"
  End-Before
End-Form
`);
  await editor.getByRole("button", { name: "Verify Source" }).click();
  await expect(editor.locator("#check-code-apply")).toBeEnabled();
  await editor.locator("#check-code-apply").click();
  await page.locator('[data-module="data"]').click();

  const fieldsDialog = page.getByRole("dialog", { name: "Fields" });
  const fields = fieldsDialog.locator("#check-code-dialog-select");
  await expect(fields.locator('option[value="case_status"]')).toHaveText("case_status");
  await expect(fields.locator('option[value="age"]')).toHaveText("age");
  await fields.selectOption("case_status");
  await fieldsDialog.getByRole("button", { name: "OK" }).click();

  const statusesDialog = page.getByRole("dialog", { name: "Statuses" });
  const statuses = statusesDialog.locator("#check-code-dialog-select");
  await expect(statuses.locator('option[value="Confirmed"]')).toHaveText("Confirmed");
  await expect(statuses.locator('option[value="Probable"]')).toHaveText("Probable");
  await statuses.selectOption("Confirmed");
  await statusesDialog.getByRole("button", { name: "OK" }).click();
  await expect(statusesDialog).toBeHidden();

  const viewsDialog = page.getByRole("dialog", { name: "Project forms" });
  const views = viewsDialog.locator("#check-code-dialog-select");
  await expect(views.locator("option")).toHaveCount(2);
  await views.selectOption({ index: 1 });
  await viewsDialog.getByRole("button", { name: "OK" }).click();

  const databasesDialog = page.getByRole("dialog", { name: "Project stores" });
  const databases = databasesDialog.locator("#check-code-dialog-select");
  await expect(databases.locator("option")).toHaveCount(2);
  await databases.selectOption({ index: 1 });
  await databasesDialog.getByRole("button", { name: "OK" }).click();
  await expect(databasesDialog).toBeHidden();
});

test("AUTOSEARCH previews bounded active-form matches without replacing the draft", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const editor = page.getByRole("dialog", { name: "Check Code Editor" });
  await editor.getByRole("textbox", { name: "Check Code source" }).fill(`Field id
  After
    AUTOSEARCH id DISPLAYLIST id age sex case_status CONTINUENEW ALWAYS
  End-After
End-Field
`);
  await editor.getByRole("button", { name: "Verify Source" }).click();
  await expect(editor.locator("#check-code-apply")).toBeEnabled();
  await editor.locator("#check-code-apply").click();
  await page.locator('[data-module="data"]').click();
  const id = page.locator('#record-form [name="id"]');
  await id.fill("P001");
  await id.press("Tab");
  const matches = page.getByRole("dialog", { name: "AUTOSEARCH matches" });
  await expect(matches.locator("#check-code-autosearch-summary")).toContainText("1 existing record matched id");
  await expect(matches.locator("tbody")).toContainText("P001");
  await expect(matches.locator("tbody")).toContainText("34");
  await matches.getByRole("button", { name: "Continue new record" }).click();
  await expect(id).toHaveValue("P001");
  await expect(page.locator("#record-count")).toHaveText("(96)");
});

test("GOTOFORM validates and moves only between forms in the current project", async ({ page }) => {
  await page.locator("#project-package-open").setInputFiles("wasm/demo/examples/recordlink/recordlink-synthetic-project.epia.json");
  await expect(page.locator("#main-menu-status")).toContainText("Opened Synthetic Patient Record Linkage");
  await page.locator('[data-module="data"]').click();
  await expect(page.locator("#data-title")).toHaveText("patient_registry_a");

  await page.locator('#record-form [name="record_id"]').fill("DEMO-A-001");
  await page.locator('#record-page-nav button[data-entry-page="Demographics"]').click();
  const facility = page.locator('#record-form [name="facility_code"]');
  await facility.fill("F01");
  await facility.press("Tab");
  const confirmation = page.getByRole("dialog", { name: "Cross-form Check Code" });
  await expect(confirmation).toContainText("Continue to the surveillance source form?");
  await confirmation.locator("#check-code-dialog-select").selectOption("true");
  await confirmation.getByRole("button", { name: "OK" }).click();

  await expect(page.locator("#data-title")).toHaveText("surveillance_b");
  await expect(page.locator("#record-count")).toHaveText("(8)");
  await expect(page.locator("#record-status")).toContainText("moved to project form surveillance_b");
  await expect(page.locator('#form-tree-list [aria-current="true"]')).toHaveCount(0);
  await expect(page.locator("#form-tree-list .tree-form.selected")).toContainText("surveillance_b");
});
