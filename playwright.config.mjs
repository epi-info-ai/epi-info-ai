import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./wasm/tests/browser",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:41739",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: process.env.EPI_INFO_USE_INSTALLED_CHROME === "1" ? "off" : "retain-on-failure",
  },
  webServer: {
    command: "node wasm/scripts/preview.mjs",
    url: "http://127.0.0.1:41739",
    env: { EPI_INFO_PREVIEW_PORT: "41739" },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(process.env.EPI_INFO_USE_INSTALLED_CHROME === "1" ? { channel: "chrome" } : {}),
      },
    },
    {
      name: "firefox-navigation",
      testMatch: /cross-browser-navigation\.spec\.mjs/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-navigation",
      testMatch: /cross-browser-navigation\.spec\.mjs/,
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "mobile-webkit-navigation",
      testMatch: /cross-browser-navigation\.spec\.mjs/,
      use: { ...devices["iPhone 13"] },
    },
  ],
});
