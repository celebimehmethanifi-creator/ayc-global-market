import { test, expect } from "./fixture";`r`nimport type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const ARTIFACT_DIR =
  process.env.BROWSERSTACK_ARTIFACT_ROOT
    ? path.join(process.env.BROWSERSTACK_ARTIFACT_ROOT, "screenshots")
    : path.join(__dirname, "../../test-results/browserstack-real-device/screenshots");

async function shot(page: Page, name: string) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const filePath = path.join(ARTIFACT_DIR, `${test.info().project.name}-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  test.info().attachments.push({
    name: `${name}.png`,
    path: filePath,
    contentType: "image/png",
  });
}

async function bodyText(page: Page) {
  return page.locator("body").innerText().catch(() => "");
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "horizontal overflow detected").toBe(false);
}

async function assertNoFakeLiveClaims(page: Page) {
  const text = await bodyText(page);
  expect(text).not.toContain("Binance Canlı");
  expect(text).not.toContain("Gerçek zamanlı piyasa istihbarat merkezi");
}

test.describe.configure({ mode: "serial" });

test.describe("BrowserStack real-device phase3 smoke", () => {
  test("page sweep: dashboard/market/alarms/performance/social/scenario/copilot/profile", async ({ page }) => {
    const routes = [
      "/dashboard",
      "/market",
      "/alarms",
      "/performance",
      "/social",
      "/scenario",
      "/copilot",
      "/profile",
    ] as const;

    for (const route of routes) {
      await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1200);

      await assertNoHorizontalOverflow(page);
      await assertNoFakeLiveClaims(page);
      await shot(page, route.replaceAll("/", "-") || "root");

      const ticker = page.locator(".app-ticker").first();
      const header = page.locator(".app-header").first();
      const bottomNav = page.locator(".bottom-nav").first();

      const tickerBox = await ticker.boundingBox().catch(() => null);
      const headerBox = await header.boundingBox().catch(() => null);
      const bottomNavBox = await bottomNav.boundingBox().catch(() => null);

      if (tickerBox && headerBox) {
        expect(tickerBox.y + tickerBox.height, "ticker overlaps header").toBeLessThanOrEqual(headerBox.y + 2);
      }

      if (bottomNavBox) {
        const viewport = page.viewportSize();
        if (viewport) {
          expect(bottomNavBox.y, "bottom nav clipped out of viewport").toBeLessThanOrEqual(viewport.height);
        }
      }
    }
  });

  test("asset modal fail-closed + alarms/scenario honesty", async ({ page }) => {
    await page.goto("/market", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);

    for (const symbol of ["BTCUSDT", "SOLUSDT"]) {
      const item = page.locator(`text=${symbol}`).first();
      if ((await item.count()) === 0) {
        continue;
      }

      await item.click({ timeout: 10000 }).catch(async () => {
        const row = page.locator("table tbody tr, .market-mobile-card, [data-testid='asset-row']").first();
        await row.click({ timeout: 10000 });
      });
      await page.waitForTimeout(1500);

      const text = await bodyText(page);
      expect(text).not.toContain("değerlendirme yapıldı");
      expect(text).not.toContain("fiyat aksiyonu bazlı özet üretildi");
      expect(text).not.toContain("momentum ve hacim odaklı değerlendirme yapıldı");
      await shot(page, `asset-modal-${symbol.toLowerCase()}`);

      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(600);
    }

    await page.goto("/alarms", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
    const alarmsText = await bodyText(page);
    expect(alarmsText).not.toContain("MOCK_ALARM");
    expect(alarmsText).not.toContain("SİSTEM");
    await shot(page, "alarms-state");

    await page.goto("/scenario", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1000);
    const firstInput = page.locator("input").first();
    if ((await firstInput.count()) > 0) {
      await firstInput.fill("W");
    }
    const runBtn = page.locator("button:has-text('Çalıştır'), button:has-text('Run')").first();
    if (await runBtn.isVisible().catch(() => false)) {
      await runBtn.click();
      await page.waitForTimeout(1000);
    }
    const scenarioText = await bodyText(page);
    expect(scenarioText).not.toContain("LONG");
    expect(scenarioText).not.toContain("SHORT");
    await shot(page, "scenario-invalid");
  });

  test("version endpoint should not expose CLI fallback markers", async ({ request }) => {
    const resp = await request.get("/api/v1/version");
    expect(resp.ok()).toBeTruthy();
    const body = await resp.json();
    expect(body.commitSha).toBeTruthy();
    expect(body.branch).toBeTruthy();

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("CLI_FALLBACK");
    expect(serialized).not.toContain("not_provided_by_cli_deploy");
  });
});

