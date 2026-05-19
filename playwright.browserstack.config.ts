import { defineConfig } from "@playwright/test";

const BASE_URL = process.env.BROWSERSTACK_TEST_URL || process.env.PLAYWRIGHT_BASE_URL || "http://bs-local.com:3093";
const ARTIFACT_ROOT = process.env.BROWSERSTACK_ARTIFACT_ROOT || "test-results/browserstack-real-device";
const USERNAME = process.env.BROWSERSTACK_USERNAME;
const ACCESS_KEY = process.env.BROWSERSTACK_ACCESS_KEY;

if (!USERNAME || !ACCESS_KEY) {
  throw new Error("Missing BrowserStack credentials in environment.");
}

export default defineConfig({
  testDir: "./tests/browserstack",
  outputDir: `${ARTIFACT_ROOT}/playwright-output`,
  timeout: 120000,
  expect: { timeout: 15000 },
  retries: 0,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: `${ARTIFACT_ROOT}/browserstack-summary.json` }],
    ["html", { outputFolder: `${ARTIFACT_ROOT}/html-report`, open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    screenshot: "on",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 90000,
  },
  projects: [
    {
      name: "chrome@Samsung Galaxy S23:13@browserstack-android",
      use: {
        browserName: "chromium",
        channel: "chrome",
      },
    },
    {
      name: "safari@iPhone 15:17@browserstack-ios",
      use: {
        browserName: "chromium",
        channel: "chrome",
      },
    },
  ],
});
