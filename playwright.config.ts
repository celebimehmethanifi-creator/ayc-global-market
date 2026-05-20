import { defineConfig } from "@playwright/test";
import * as path from "path";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3093";

// Use the pre-installed Chromium binary (build 1194) on Linux.
// On Windows the browser will be found automatically after `pnpm test:browser:install`.
const CHROMIUM_EXEC =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (process.platform === "linux"
    ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
    : undefined);

const chromiumBase = {
  browserName: "chromium" as const,
  ...(CHROMIUM_EXEC ? { executablePath: CHROMIUM_EXEC } : {}),
  launchOptions: {
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  },
};

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
    ...chromiumBase,
  },
  webServer: {
    command:
      "pnpm --filter neura-web run build && pnpm --filter neura-web exec next start --hostname 127.0.0.1 --port 3093",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    stdout: "pipe",
    stderr: "pipe",
  },
  projects: [
    {
      name: "mobile-390x844",
      use: { ...chromiumBase, viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 },
    },
    {
      name: "mobile-393x852",
      use: { ...chromiumBase, viewport: { width: 393, height: 852 }, isMobile: true, deviceScaleFactor: 3 },
    },
    {
      name: "mobile-412x915",
      use: { ...chromiumBase, viewport: { width: 412, height: 915 }, isMobile: true, deviceScaleFactor: 2.625 },
    },
    {
      name: "mobile-430x932",
      use: { ...chromiumBase, viewport: { width: 430, height: 932 }, isMobile: true, deviceScaleFactor: 3 },
    },
    {
      name: "tablet-768x1024",
      use: { ...chromiumBase, viewport: { width: 768, height: 1024 }, isMobile: false, deviceScaleFactor: 2 },
    },
  ],
});
