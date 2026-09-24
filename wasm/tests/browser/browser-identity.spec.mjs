import { expect, test } from "@playwright/test";

test("local demo sign-in supplies an explicit browser identity", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("epi-info-ai.operator-identity.v1"));
  await page.reload();

  const opener = page.locator("#local-demo-sign-in");
  await expect(opener).toContainText("Log in");
  await opener.click();
  await page.locator("#local-demo-display-name").fill("Field Investigator");
  await page.getByRole("button", { name: "Log in locally" }).click();
  await expect(opener).toContainText("Field Investigator");

  await page.reload();
  await expect(opener).toContainText("Field Investigator");
  await opener.click();
  await page.locator("#local-demo-sign-out").click();
  await expect(opener).toContainText("Log in");
});
