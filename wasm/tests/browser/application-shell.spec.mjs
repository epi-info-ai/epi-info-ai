import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#main-menu-title")).toBeAttached();
});

test("legacy application menus expose familiar workflows", async ({ page }) => {
  const applicationMenu = page.getByRole("navigation", { name: "Application menu" });

  await applicationMenu.getByText("File", { exact: true }).click();
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

test("production artifact opens Maps and initializes Leaflet", async ({ page }) => {
  await page.getByRole("button", { name: "Create Maps" }).click();
  await expect(page.getByRole("heading", { name: "Map", exact: true })).toBeVisible();
  await expect(page.locator("#epi-map")).toHaveClass(/leaflet-container/);
  await expect(page.getByRole("button", { name: "Enter map fullscreen" })).toBeVisible();
  await expect(page.getByText("Add Data Layer", { exact: true })).toBeVisible();
});

test("JupyterLite validation lab V0.1 is part of the Pages artifact", async ({ page, request }) => {
  const response = await page.goto("/validation-lab/lab/index.html?path=validate-table2x2.ipynb");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveTitle(/Epi Info AI Validation Lab|JupyterLite/, { timeout: 30_000 });

  const notebookResponse = await request.get("/validation-lab/files/validate-table2x2.ipynb");
  expect(notebookResponse.ok()).toBe(true);
  const notebook = await notebookResponse.json();
  expect(notebook.nbformat).toBe(4);
  expect(JSON.stringify(notebook)).toContain("Rust/WASM vs SciPy");
});

test("integrated outbreak and Toledo map examples are downloadable", async ({ request }) => {
  const csvResponse = await request.get("/examples/foodborne-outbreak-investigation.csv");
  expect(csvResponse.ok()).toBe(true);
  const csv = await csvResponse.text();
  const rows = csv.trim().split(/\r?\n/);
  expect(rows).toHaveLength(97);
  expect(rows[0]).toContain("Latitude,Longitude,Household Neighborhood");

  const geoJsonResponse = await request.get("/examples/city-of-toledo-neighborhoods.geojson");
  expect(geoJsonResponse.ok()).toBe(true);
  const geoJson = await geoJsonResponse.json();
  expect(geoJson.type).toBe("FeatureCollection");
  expect(geoJson.features).toHaveLength(87);
  expect(geoJson.features.every((feature) => feature.geometry?.type === "MultiPolygon")).toBe(true);
  expect(geoJson.features.every((feature) => typeof feature.properties?.name === "string")).toBe(true);
});
