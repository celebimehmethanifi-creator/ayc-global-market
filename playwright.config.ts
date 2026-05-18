import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3093";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: "./test-results/playwright-output",
  timeout: 30000,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    screenshot: "on",
    video: "off",
    trace: "off",
  },
  projects: [
    {
      name: "mobile-390x844",
      use: { ...devices["iPhone 14 Pro"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "mobile-393x852",
      use: { ...devices["iPhone 15"], viewport: { width: 393, height: 852 } },
    },
    {
      name: "mobile-412x915",
      use: { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } },
    },
    {
      name: "mobile-430x932",
      use: { ...devices["iPhone 15 Plus"], viewport: { width: 430, height: 932 } },
    },
    {
      name: "tablet-768x1024",
      use: { ...devices["iPad (gen 7)"], viewport: { width: 768, height: 1024 } },
    },
  ],
});
