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

test("application menus remain reachable and keyboard navigable", async ({ page }) => {
  const navigation = page.getByRole("navigation", { name: "Application menu" });
  const file = navigation.locator("#file-menu > summary");
  await file.focus();
  await page.keyboard.press("Enter");
  await expect(navigation.locator("#file-menu")).toHaveAttribute("open", "");
  await expect(navigation.getByRole("menuitem", { name: "Open Project" })).toBeFocused();

  await page.keyboard.press("ArrowDown");
  await expect(navigation.getByRole("menuitem", { name: /Import Example Project/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(navigation.getByRole("menuitem", { name: "Exit" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(file).toBeFocused();
  await expect(navigation.locator("#file-menu")).not.toHaveAttribute("open", "");

  await file.press("ArrowRight");
  await expect(navigation.getByRole("menuitemcheckbox", { name: "Status Bar" })).toBeFocused();
  await expect(navigation.locator("#view-menu")).toHaveAttribute("open", "");
  await expect(navigation.locator("details[open]")).toHaveCount(1);

  await page.keyboard.press("Escape");
  const help = navigation.locator("#help-menu > summary");
  await help.focus();
  await help.press("Space");
  await expect(navigation.locator("#help-menu")).toHaveAttribute("open", "");
  await expect(navigation.locator("#help-menu [role='menuitem']").first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(navigation.locator("details[open]")).toHaveCount(0);

  await help.click();
  await expect(navigation.locator("#help-menu")).toHaveAttribute("open", "");
  await page.locator(".titlebar .brand-mark").click();
  await expect(navigation.locator("details[open]")).toHaveCount(0);
});

test("fixed dropdown overlay stays inside narrow and zoomed viewports", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.locator("#help-menu > summary").click();
  const popup = page.locator("#help-menu > .legacy-menu-popup");
  await expect(popup).toBeVisible();
  const box = await popup.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(360);
  expect(box.y + box.height).toBeLessThanOrEqual(640);

  await page.evaluate(() => { document.documentElement.style.fontSize = "32px"; });
  await page.locator("#help-menu > summary").click();
  await page.locator("#help-menu > summary").click();
  await expect(popup).toBeVisible();
  const zoomedBox = await popup.boundingBox();
  expect(zoomedBox).not.toBeNull();
  expect(zoomedBox.x).toBeGreaterThanOrEqual(0);
  expect(zoomedBox.x + zoomedBox.width).toBeLessThanOrEqual(360);
});

test("menu-opened dialog closes with Escape and the menu reopens", async ({ page }) => {
  await page.locator("#tools-menu > summary").click();
  await page.getByRole("menuitem", { name: "Options" }).click();
  const dialog = page.getByRole("dialog", { name: "Options" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("#application-language")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.locator("#tools-menu > summary")).toBeFocused();

  await page.locator("#tools-menu > summary").click();
  await expect(page.getByRole("menuitem", { name: "Options" })).toBeVisible();
});

test("module menus share one-open-menu and Escape behavior", async ({ page }) => {
  await page.locator("#main-menu").getByRole("button", { name: "Create Forms" }).click();
  const designer = page.getByRole("navigation", { name: "Form Designer menu" });
  const file = designer.getByText("File", { exact: true });
  await file.focus();
  await page.keyboard.press("ArrowDown");
  await expect(designer.getByRole("menuitem", { name: "New Project...", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(file).toBeFocused();

  await page.locator('[data-module="data"]').click();
  const enter = page.getByRole("navigation", { name: "Enter Data menu" });
  await enter.getByText("File", { exact: true }).click();
  await expect(enter.locator("details[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(enter.locator("details[open]")).toHaveCount(0);

  await page.locator('[data-module="classic"]').click();
  const classic = page.getByRole("navigation", { name: "Classic Analysis menu" });
  await classic.getByText("File", { exact: true }).click();
  await expect(classic.locator("details[open]")).toHaveCount(1);
  await page.locator("#classic-program-menu").getByText("Edit", { exact: true }).click();
  await expect(page.locator("details.legacy-menu[open]")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator("details.legacy-menu[open]")).toHaveCount(0);
});
