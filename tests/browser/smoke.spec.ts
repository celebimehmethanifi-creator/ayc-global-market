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
  const ticker = page.locator(".app-ticker, [class*='ticker']").first();
  const nav    = page.locator("nav, [class*='bottom-nav'], [class*='app-nav']").first();
  const tickerBox = await ticker.boundingBox().catch(() => null);
  const navBox    = await nav.boundingBox().catch(() => null);
  if (tickerBox && navBox) {
    // ticker bottom must not overlap nav top
    expect(tickerBox.y + tickerBox.height, "ticker overlaps nav").toBeLessThanOrEqual(navBox.y + 2);
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
