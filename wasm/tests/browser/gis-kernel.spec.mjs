import { expect, test } from "@playwright/test";

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
