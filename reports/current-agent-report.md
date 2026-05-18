# Phase 3 QA Report — fix/live-data-truth-mobile-shell

**Branch:** `fix/live-data-truth-mobile-shell`
**Patch commit:** `ba3ce74`
**Social fix commit:** `a614605` (QA-found bug fixed during this session)
**Base:** `hardening-production-readiness @ 392ae98`
**QA date:** 2026-05-18

---

## Classification

| Gate | Result |
|------|--------|
| SOURCE_ONLY_PASS | **PARTIAL** (see findings below) |
| CI_PASS | **NOT_RUN** — no PR; no Actions results at HEAD |
| API_CONTRACT_PASS | **PARTIAL** — version/health/alarms/signals verified locally; live domain not accessible |
| Browser/mobile smoke | **NOT_RUN** — Chromium download blocked in sandbox |
| REAL_MOBILE_PASS | **NOT_RUN** — no physical device |
| PROD_PASS | **NOT_RUN** — no live domain access |
| **Production-ready** | **NO** |

---

## Source Audit Findings

### ✅ PASS — "Canlı" cannot appear without real provider + valid TTL
`inferBaseStatus()` in `data-status.ts` requires:
- `hasPrice = true`
- Source must be `BINANCE-WS` (live) or `BINANCE` with `delayMinutes ≤ 2`
- Any unknown source with `hasPrice=true` → "fallback", never "live"
- Additional gate: `live` downgrades to `delayed` if `delayMinutes >= 5`

Verified by logic simulation: UNKNOWN/COINGECKO/STOOQ sources cannot produce "live" status.

### ⚠️ PARTIAL — Label centralization
Required labels: `Canlı / Gecikmeli / AYC Veri / Veri yok / Veri yetersiz / Demo`

`data-status.ts` centralizes: Canlı, Gecikmeli, AYC Veri ("BACKEND" source label), Veri yok

**Gaps:**
- `"Veri yetersiz"` — defined only in `AssetDetailModal.tsx:111` as a local fallback in `statusLabel()`, not exported from `data-status.ts`
- `"Demo"` — hardcoded string in `social/page.tsx:243`, not from `data-status.ts`

Both labels exist in the UI but are not centralized through the single module. Minor — not a runtime truth failure, but a maintainability gap.

### ⚠️ PARTIAL — Price display consistency
- **Market page** (`/market`): uses `buildDataStatusMeta()` from `data-status.ts` ✅
- **Dashboard**: uses its own `freshPriceCount >= 8` / 45s TTL logic — NOT `buildDataStatusMeta` ⚠️
- **MarketTicker**: uses 90s TTL / `liveCount >= 3` threshold — NOT `buildDataStatusMeta` ⚠️
- **AssetDetailModal**: uses local `statusLabel()` function; `headerStatus` derived as `analysis?.dataQuality?.status || (livePrice ? "live" : "fallback")` — assigns "live" solely because a price response arrived, no TTL verification ⚠️

Price values themselves all originate from `usePrices()` (PriceContext WebSocket) which is a single source. The *status labels* are computed by three different paths with different thresholds.

### ✅ PASS — Analysis gating (target/stop/RR/Kelly/probability)
- `AssetDetailModal`: `hasSufficientData = analysis?.dataQuality?.status !== "insufficient"` gates Hedef/Stop Loss/RR display — shows "Veri yetersiz" when false ✅
- Scenario API route: returns empty scenarios + message when `dataQuality === "insufficient"` ✅; nulls `probability`, `kellyFraction`, `expectedPnlPct`, `riskReward` when `dataQuality === "fallback"` ✅

### ✅ PASS — Dashboard fake data fully removed
- `MOCK_SIGNALS`: **absent** (grep confirmed)
- `MOVER_SEEDS`: **absent** (grep confirmed)
- `MOCK_CAUSAL`: **absent** (grep confirmed)
- `"3 AI MOTOR AKTİF"`: replaced with runtime `actionableCount > 0 ? \`${actionableCount} AKTİF SİNYAL\` : "Sinyal bekleniyor"` ✅
- `signals` derived from `signalData?.signals` (API) only ✅
- `movers` derived from live signals only (no seed anchor) ✅

### ✅ PASS — Alarm truth
- `MOCK_ALARMS`: **absent** ✅
- Assignment: `const alarms = Array.isArray(alarmsApi) ? alarmsApi : []` ✅
- Empty state renders when `alarms.length === 0` ✅
- API confirmed: `/api/v1/alarms` returns `{"alarms":[],"count":0}` when no alarms stored

### ✅ PASS — Traceability
- `VersionInfo` now has: `traceabilityComplete: boolean`, `traceabilityStatus: "complete"|"incomplete"`, `missing: string[]`
- Smoke test with AYC vars: returns `traceabilityComplete: true, missing: []` ✅
- Smoke test without AYC vars: returns `traceabilityComplete: false, missing: ["commitSha","branch","buildTime","deploymentId"]` ✅
- Cache-Control: `no-store, max-age=0` confirmed ✅

### ✅ PASS — Performance zero-state bar
- When `stats.total === 0`: plain grey bar rendered, no gold segment ✅
- Gold segment only renders when `stats.pending > 0` ✅

### ❌ BUG FOUND AND FIXED — Social Radar percentages
**Agent claimed "already correct" — INCORRECT.**

`seededSentiment()` formula: `bull = 35+(hash%46)`, `bear = 12+((hash*3)%35)`. When `bull+bear > 100`, neutral is clamped to 0 but the displayed text percentages (bull%, neutral%, bear%) still summed to >100 (up to 126 for some symbols). Confirmed: 351 of 1610 possible value combinations produced sum > 100.

**Fix applied** (`a614605`): proportional scaling when `bull+bear > 100`. All 1610 combinations now produce exactly 100.

### ✅ PASS — Mobile shell safe-area CSS
- `@supports (padding: max(0px))` block now includes `.app-ticker { padding-top: env(safe-area-inset-top, 0px); box-sizing: content-box; }`
- `viewport-fit: cover` and `status-bar-style: black-translucent` already set in root layout
- `app-root` is `height:100dvh` flex-column with `overflow:hidden` — ticker height expansion pushes other elements down correctly
- Bottom nav and app-main already handle `env(safe-area-inset-bottom)` at multiple breakpoints
- **NOT verified on real device** — source-level only

### ✅ PASS — MarketTicker no duplicates
- 38 unique symbols (no key duplicates confirmed by audit)
- Double-render in JSX (`[0,1].map`) is intentional for seamless CSS scroll loop, not a bug

---

## API Contract Smoke (local dev server)

All tests against `http://localhost:3092` with Next.js dev server:

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /api/v1/version` (no AYC vars) | ✅ 200, `traceabilityComplete:false`, `missing:[4 fields]` | Correct fallback |
| `GET /api/v1/version` (AYC vars set) | ✅ 200, `traceabilityComplete:true`, `missing:[]` | Correct |
| `GET /api/v1/health` | ✅ 200, `status:"ok"` | |
| `GET /api/v1/prices/live?symbols=BTCUSDT` | ✅ 200, `prices:{},count:0` | Empty without backend (expected) |
| `GET /api/v1/alarms` | ✅ 200, `alarms:[],count:0` | Correct empty state |
| `GET /api/v1/signals/live` | ✅ 200, `signals:[],feed_status:"no_signal"` | Correct |
| `GET /dashboard` (page) | ✅ 200 | |

---

## Browser / Mobile Smoke

**NOT RUN** — Playwright Chromium download blocked (network restricted in sandbox).

Required viewports for future verification:
- 390×844 (iPhone 14 Pro)
- 393×852 (iPhone 15)
- 412×915 (Android)
- 430×932 (iPhone 15 Plus)
- 768×1024 (iPad)

Checks needed when browser access available:
- Ticker not overlapping status bar
- Bottom nav not overlapping content
- No horizontal overflow
- Demo balance readable alongside nav

---

## Open Issues After QA

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 1 | Fixed | Social Radar bull+bear sum could exceed 100 (351/1610 combinations) | Fixed in `a614605` |
| 2 | Minor | "Veri yetersiz" and "Demo" labels not in `data-status.ts` — two separate paths | Accept as-is: no runtime truth failure |
| 3 | Minor | Dashboard & ticker "live" threshold differs from `buildDataStatusMeta` (45s/90s vs 5min) | Accept as-is: different freshness granularity, not false-positive "live" |
| 4 | Minor | AssetDetailModal assigns `headerStatus:"live"` based on price response arrival, no TTL | Low risk: only shown in modal header |
| 5 | Blocker | CI not run on branch HEAD (`a614605`) — no PR opened | Create PR or push triggers CI on next push |
| 6 | Blocker | Browser/mobile smoke not run | Requires network access for Playwright |
| 7 | Blocker | Real mobile not tested | Requires physical device |
| 8 | Blocker | Production not verified | No live domain access |

---

## Test Results at HEAD (a614605)

| Suite | Result |
|-------|--------|
| `pnpm --filter neura-web type-check` | ✅ Clean |
| `pytest tests/hardening/...` (111/113) | ✅ 111 passed, 2 deselected (fastapi env-only) |
| Social radar math verification | ✅ All 1610 combinations sum to 100 |
| API smoke (local dev server) | ✅ Key endpoints respond correctly |

---

## Honesty Summary

- **SOURCE_ONLY_PASS: PARTIAL** — mock data removed, gating correct, social fixed; label centralization and multi-path price status are gaps
- **Production-ready: NO** — CI not run, browser smoke not run, real mobile not tested, live domain not accessible
