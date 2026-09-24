import { expect, test } from "@playwright/test";

const pageErrors = new WeakMap();

test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#main-menu-title")).toBeAttached();
});

test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page) ?? []).toEqual([]);
});

test("project dialog closes by titlebar, footer, and Escape and can reopen", async ({ page }) => {
  const applicationMenu = page.getByRole("navigation", { name: "Application menu" });
  const openDialog = async () => {
    await applicationMenu.getByText("File", { exact: true }).click();
    await applicationMenu.getByRole("menuitem", { name: /Import Example Project/ }).click();
    const dialog = page.getByRole("dialog", { name: "Import Example Project" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#example-project-status")).toContainText("verified project choices");
    return dialog;
  };

  let dialog = await openDialog();
  await dialog.getByRole("button", { name: "Close" }).first().click();
  await expect(dialog).toBeHidden();

  dialog = await openDialog();
  await dialog.getByRole("button", { name: "Close" }).last().click();
  await expect(dialog).toBeHidden();

  dialog = await openDialog();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(applicationMenu.locator("#file-menu > summary")).toBeFocused();
});

test("capability package dialog remains scrollable and both close controls work", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  const help = page.locator("#help-menu > summary");
  const openDialog = async () => {
    await help.click();
    await page.getByRole("menuitem", { name: /Capability Packages/ }).click();
    const dialog = page.getByRole("dialog", { name: "Capability Packages" });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  let dialog = await openDialog();
  await dialog.locator("#capability-package-preview").click();
  await expect(dialog.locator("#capability-package-status")).toContainText("Manifest structure is valid");
  const body = dialog.locator(".legacy-dialog-body");
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await dialog.locator("#capability-package-close-titlebar").click();
  await expect(dialog).toBeHidden();

  dialog = await openDialog();
  await dialog.locator("#capability-package-close-action").scrollIntoViewIfNeeded();
  await dialog.locator("#capability-package-close-action").click();
  await expect(dialog).toBeHidden();

  dialog = await openDialog();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(help).toBeFocused();
});

test("options dialog traps interaction and returns focus after Cancel", async ({ page }) => {
  const tools = page.locator("#tools-menu > summary");
  await tools.click();
  await page.getByRole("menuitem", { name: "Options" }).click();
  const dialog = page.getByRole("dialog", { name: "Options" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("#application-language")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(tools).toBeFocused();
});
