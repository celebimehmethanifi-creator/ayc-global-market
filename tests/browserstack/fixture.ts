import { execSync } from "node:child_process";
import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

type BrowserstackCaps = Record<string, string | boolean>;

const USERNAME = process.env.BROWSERSTACK_USERNAME;
const ACCESS_KEY = process.env.BROWSERSTACK_ACCESS_KEY;
const BASE_URL = process.env.BROWSERSTACK_TEST_URL || process.env.PLAYWRIGHT_BASE_URL || "http://bs-local.com:3093";
const BUILD_NAME =
  process.env.BROWSERSTACK_BUILD_NAME ||
  `phase3-real-device-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const LOCAL_IDENTIFIER = process.env.BROWSERSTACK_LOCAL_IDENTIFIER || "ayc-local-default";
const IS_LOCAL_TARGET = /^https?:\/\/(localhost|127\.0\.0\.1|bs-local\.com)(:\d+)?(\/|$)/i.test(BASE_URL);

if (!USERNAME || !ACCESS_KEY) {
  throw new Error("Missing BrowserStack credentials in environment");
}

const PLAYWRIGHT_VERSION = execSync("npx playwright --version", { encoding: "utf8" }).trim().split(" ")[1] || "1.latest";

const patchAndroidCaps = (name: string, title: string): BrowserstackCaps => {
  const combination = name.split(/@browserstack/)[0];
  const [browserCaps, osCapsRaw] = combination.split(":");
  const [browserRaw, deviceRaw] = browserCaps.split("@");

  const caps: BrowserstackCaps = {
    browser: browserRaw || "chrome",
    deviceName: deviceRaw || "Samsung Galaxy S23",
    osVersion: osCapsRaw || "13.0",
    realMobile: "true",
    name: title,
  };

  return caps;
};

const patchIosCaps = (name: string, title: string): BrowserstackCaps => {
  const combination = name.split(/@browserstack/)[0];
  const [browserCaps, osCapsRaw] = combination.split(":");
  const [browserRaw, deviceRaw] = browserCaps.split("@");

  const caps: BrowserstackCaps = {
    browser: browserRaw || "safari",
    deviceName: deviceRaw || "iPhone 15",
    osVersion: osCapsRaw || "17",
    realMobile: "true",
    name: title,
  };

  return caps;
};

const withCommonCaps = (caps: BrowserstackCaps): BrowserstackCaps => {
  const finalCaps: BrowserstackCaps = {
    ...caps,
    project: "AYC Global Market",
    build: BUILD_NAME,
    "browserstack.username": USERNAME,
    "browserstack.accessKey": ACCESS_KEY,
    "browserstack.debug": "true",
    "browserstack.console": "info",
    "client.playwrightVersion": PLAYWRIGHT_VERSION,
    "browserstack.playwrightVersion": "1.latest",
  };

  if (IS_LOCAL_TARGET) {
    finalCaps["browserstack.local"] = "true";
    finalCaps["browserstack.localIdentifier"] = LOCAL_IDENTIFIER;
  }

  return finalCaps;
};

const wsEndpoint = (caps: BrowserstackCaps) =>
  `wss://cdp.browserstack.com/playwright?caps=${encodeURIComponent(JSON.stringify(caps))}`;

export const test = base.extend<{
  page: Page;
}>({
  page: async ({ playwright }, use, testInfo) => {
    const projectName = testInfo.project.name;
    const title = `${testInfo.file} - ${testInfo.title}`;

    let remoteBrowser: Browser | null = null;
    let remoteContext: BrowserContext | null = null;
    let remotePage: Page | null = null;
    let androidDevice: Awaited<ReturnType<typeof playwright._android.connect>> | null = null;

    try {
      if (projectName.includes("@browserstack-android")) {
        const caps = withCommonCaps(patchAndroidCaps(projectName, title));
        androidDevice = await playwright._android.connect(wsEndpoint(caps));
        await androidDevice.shell("am force-stop com.android.chrome");
        remoteContext = await androidDevice.launchBrowser();
        remotePage = await remoteContext.newPage();
      } else if (projectName.includes("@browserstack-ios")) {
        const caps = withCommonCaps(patchIosCaps(projectName, title));
        remoteBrowser = await playwright.webkit.connect({ wsEndpoint: wsEndpoint(caps) });
        remoteContext = await remoteBrowser.newContext({ baseURL: BASE_URL });
        remotePage = await remoteContext.newPage();
      } else {
        const caps = withCommonCaps({ browser: "chrome", name: title });
        remoteBrowser = await playwright.chromium.connect({ wsEndpoint: wsEndpoint(caps) });
        remoteContext = await remoteBrowser.newContext({ baseURL: BASE_URL });
        remotePage = await remoteContext.newPage();
      }

      await use(remotePage);

      await remotePage.evaluate(
        () => {},
        `browserstack_executor: ${JSON.stringify({ action: "setSessionStatus", arguments: { status: "passed", reason: "All checks passed" } })}`,
      );
    } catch (error) {
      if (remotePage) {
        const reason = error instanceof Error ? error.message.slice(0, 200) : "Unknown failure";
        await remotePage.evaluate(
          () => {},
          `browserstack_executor: ${JSON.stringify({ action: "setSessionStatus", arguments: { status: "failed", reason } })}`,
        ).catch(() => {});
      }
      throw error;
    } finally {
      await remotePage?.close().catch(() => {});
      await remoteContext?.close().catch(() => {});
      await remoteBrowser?.close().catch(() => {});
      await androidDevice?.close().catch(() => {});
    }
  },
});

export { expect };
