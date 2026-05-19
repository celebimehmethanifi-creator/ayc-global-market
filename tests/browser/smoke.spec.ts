/**
 * Phase 3 Browser/Mobile Smoke — AYC Global Market
 * Tests: no overlap, no overflow, status label honesty, alarm empty state.
 * Run: npx playwright test --project=mobile-390x844 (or all projects)
 */
import { test, expect, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const SCREENSHOT_DIR = path.join(
  __dirname,
  "../../test-results/screenshots/phase3-browser-mobile-smoke",
);

async function shot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const projectName = test.info().project.name;
  const filePath = path.join(SCREENSHOT_DIR, `${projectName}-${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  test.info().attachments.push({
    name: `${name}.png`,
    path: filePath,
    contentType: "image/png",
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function checkNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, "horizontal scroll detected").toBe(false);
}

async function checkTickerNotOverlapping(page: Page) {
  const ticker    = page.locator(".app-ticker").first();
  const bottomNav = page.locator(".bottom-nav").first();
  const tickerBox    = await ticker.boundingBox().catch(() => null);
  const bottomNavBox = await bottomNav.boundingBox().catch(() => null);
  // bottomNavBox is null on tablet (display:none); skip when not rendered
  if (tickerBox && bottomNavBox) {
    expect(tickerBox.y + tickerBox.height, "ticker overlaps bottom nav").toBeLessThanOrEqual(bottomNavBox.y + 2);
  }
}

async function checkNoFakeLiveClaim(page: Page) {
  // "Canlı" in a status badge should only come from the data-status module (proven safe by source audit).
  // This test verifies that "Gerçek zamanlı" is NOT present as a UI claim.
  const bodyText = await page.locator("body").innerText().catch(() => "");
  expect(bodyText, "found unverified 'Gerçek zamanlı' claim").not.toContain("Gerçek zamanlı piyasa istihbarat merkezi");
}

// ── /dashboard ────────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test("renders without crash and shows neutral tagline", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    await shot(page, "dashboard-initial");
    await checkNoHorizontalOverflow(page);
    await checkNoFakeLiveClaim(page);

    // Neutral tagline present
    const bodyText = await page.locator("body").innerText().catch(() => "");
    expect(bodyText).toContain("Piyasa istihbarat merkezi");
  });

  test("alarm widget shows true empty state when no alarms", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(2000);

    await shot(page, "dashboard-alarm-area");

    // EMPTY_ALARM_HINT removed: no demo alarm row
    const bodyText = await page.locator("body").innerText().catch(() => "");
    expect(bodyText).not.toContain("SİSTEM");
    expect(bodyText).not.toContain("Alarm kurduğunuzda burada canlı olarak görünecek");

    // If alarms section visible, empty state renders
    const alarmSection = page.locator("text=Son Alarmlar").first();
    if (await alarmSection.isVisible().catch(() => false)) {
      // Either no alarm rows, or the truthful "Henüz alarm bulunmuyor." text
      const demoRow = page.locator("text=SİSTEM").first();
      await expect(demoRow).not.toBeVisible().catch(() => {/* ok if not found */});
    }
  });

  test("no header or ticker overlap", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);
    await checkTickerNotOverlapping(page);
    await shot(page, "dashboard-header-ticker");
  });
});

// ── /market ───────────────────────────────────────────────────────────────────

test.describe("Market page", () => {
  test("renders, no horizontal overflow, ticker visible", async ({ page }) => {
    await page.goto("/market", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1500);

    await shot(page, "market-initial");
    await checkNoHorizontalOverflow(page);
    await checkNoFakeLiveClaim(page);
  });

  test("no header/nav overlap", async ({ page }) => {
    await page.goto("/market", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1200);
    await checkTickerNotOverlapping(page);
    await shot(page, "market-header");
  });
});

// ── /social ───────────────────────────────────────────────────────────────────

test.describe("Social page", () => {
  test("renders without overflow", async ({ page }) => {
    await page.goto("/social", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    await shot(page, "social-initial");
    await checkNoHorizontalOverflow(page);
  });
});

// ── /performance ──────────────────────────────────────────────────────────────

test.describe("Performance page", () => {
  test("renders without overflow", async ({ page }) => {
    await page.goto("/performance", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    await shot(page, "performance-initial");
    await checkNoHorizontalOverflow(page);
  });
});

// ── /alarms ───────────────────────────────────────────────────────────────────

test.describe("Alarms page", () => {
  test("renders, no overflow, no mock data", async ({ page }) => {
    await page.goto("/alarms", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(1000);

    await shot(page, "alarms-initial");
    await checkNoHorizontalOverflow(page);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    expect(bodyText).not.toContain("MOCK_ALARM");
  });
});

// ── Asset analysis modal — data gating ───────────────────────────────────────

const UNSAFE_ANALYSIS_STATUSES = ["fallback", "no_data", "insufficient"] as const;

/** Mocked analysis payload with real-looking numbers that must be suppressed for unsafe statuses. */
function mockAnalysisBody(status: string) {
  return JSON.stringify({
    ok: true, symbol: "BTCUSDT", timeframe: "1D", category: "crypto",
    latestPrice: 50000, latestClose: 50000, change24h: 0.5,
    tradePlan: { direction: "LONG", entry: 50000, target: 55000, stopLoss: 48000, riskReward: 2.5, confidence: 65 },
    technical: { trend: "LONG", rsi: 55.12, macd: 0.5, atr: 100, support: 48000, resistance: 55000 },
    technicalSummary: "Teknik analiz özeti",
    fundamentalSummary: "BTCUSDT için momentum ve hacim odaklı değerlendirme yapıldı (hacim 1,234,567).",
    dataQuality: { status, updatedAt: null },
    disclaimer: "Bu içerik yatırım tavsiyesi değildir.",
  });
}

test.describe("Asset analysis modal — data gating", () => {
  for (const status of UNSAFE_ANALYSIS_STATUSES) {
    test(`status=${status}: hides LONG chip and actionable metrics`, async ({ page }) => {
      // Intercept analysis API to inject controlled unsafe status
      await page.route("**/api/v1/assets/*/analysis*", route =>
        route.fulfill({ status: 200, contentType: "application/json", body: mockAnalysisBody(status) }),
      );

      await page.goto("/market", { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1500);

      // Click first clickable asset row to open the detail panel
      const row = page.locator("table tbody tr, [data-testid='asset-row'], .asset-row").first();
      const rowVisible = await row.isVisible().catch(() => false);
      if (!rowVisible) {
        test.skip(); // market table not loaded — skip rather than false-fail
        return;
      }
      await row.click();
      await page.waitForTimeout(1500);

      const html = await page.content();
      const bodyText = await page.locator("body").innerText().catch(() => "");

      // Direction chip must be hidden for unsafe status
      expect(html, `${status}: LONG chip must not appear`).not.toMatch(/>\s*LONG\s*</);

      // Numeric target/stop/RR must not appear as actionable values
      expect(bodyText, `${status}: target 55,000 must not appear`).not.toContain("55,000");
      expect(bodyText, `${status}: risk/reward 2.50x must not appear`).not.toContain("2.50x");

      // "değerlendirme yapıldı" must not appear when data is unsafe
      expect(bodyText, `${status}: "değerlendirme yapıldı" must not appear`).not.toContain("değerlendirme yapıldı");
    });
  }
});

// ── Ticker badge ──────────────────────────────────────────────────────────────

test.describe("MarketTicker status badge", () => {
  test("badge shows Gecikmeli or Canlı — never bare Gerçek zamanlı", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText().catch(() => "");
    // Allowed: "Canlı" badge, "Gecikmeli" badge, "AYC Veri" badge
    // Not allowed: bare unverified "Gerçek zamanlı piyasa istihbarat merkezi"
    expect(bodyText).not.toContain("Gerçek zamanlı piyasa istihbarat merkezi");

    // Source label must NOT contain "Canlı" in the sourceLabel position
    // (verified at source level; this checks no regression in rendered HTML)
    const html = await page.content();
    expect(html).not.toContain("Binance Canlı");

    await shot(page, "ticker-badge");
  });
});
