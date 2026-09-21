import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  await page.locator("#import-rows-with-form").check();
  await page.locator("#form-csv-import").setInputFiles("wasm/demo/examples/foodborne/foodborne-outbreak-investigation.csv");
  await expect(page.locator("#csv-form-status")).toContainText("imported 96 records");
});

test("Check Code Editor verifies, applies, and executes the bounded foodborne program", async ({ page }) => {
  const designer = page.getByRole("navigation", { name: "Form Designer menu" });
  await designer.getByText("Tools", { exact: true }).click();
  await designer.getByRole("menuitem", { name: "Check Code Editor..." }).click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  await expect(dialog).toBeVisible();
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
  const message = page.getByRole("dialog", { name: "Check Code Message" });
  await expect(message).toContainText("Review the foodborne case before saving.");
  await message.getByRole("button", { name: "OK" }).click();
  const caseStatus = page.locator('#record-form [name="case_status"]');
  const onsetDate = page.locator('#record-form [name="onset_date"]');
  await caseStatus.fill("Confirmed");
  await caseStatus.press("Tab");
  await expect(onsetDate).toHaveAttribute("required", "");
  await expect(onsetDate).toBeFocused();
  await expect(page.locator("#record-status")).toContainText("moved to onset_date");
  await onsetDate.fill("2026-01-10");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.locator("#record-count")).toHaveText("(97)");
  await expect(message).toBeVisible();
  await message.getByRole("button", { name: "OK" }).click();
  const checkCodeAudit = await page.evaluate(() => {
    const project = JSON.parse(localStorage.getItem("epi-info-ai.project-state.v1") ?? "null");
    return project.auditLog.filter((event) => event.action === "check-code-executed").map((event) => event.detail);
  });
  expect(checkCodeAudit.some((detail) => detail.includes("form before"))).toBeTruthy();
  expect(checkCodeAudit.some((detail) => detail.includes("page EntryPage before"))).toBeTruthy();
  expect(checkCodeAudit.some((detail) => detail.includes("record after"))).toBeTruthy();
});

test("Check Code Editor rejects unresolved references without partial execution", async ({ page }) => {
  await page.locator("#designer-toolbar-check-code").click();
  const dialog = page.getByRole("dialog", { name: "Check Code Editor" });
  await dialog.locator("#check-code-source").fill("Form\n  Before\n    ASSIGN MissingField = \"unsafe\"\n  End-Before\nEnd-Form\n");
  await dialog.getByRole("button", { name: "Verify Source" }).click();
  await expect(dialog.locator("#check-code-editor-status")).toContainText("execution remains disabled");
  await expect(dialog.locator("#check-code-editor-diagnostics")).toContainText("MissingField");
  await expect(dialog.locator("#check-code-apply")).toBeDisabled();
});
