# Phase 3 QA Report — fix/live-data-truth-mobile-shell

**Branch:** `fix/live-data-truth-mobile-shell`
**Code commit:** `21cb0df`
**Report commit:** (this file)
**Base:** `hardening-production-readiness @ 392ae98`
**QA date:** 2026-05-18

Commit history on this branch relevant to Phase 3:
- `ba3ce74` — initial patch (safe-area CSS, alarm feed truth, traceability, perf zero-state, CI workflow)
- `a614605` — social radar bull+bear>100 fix
- `dade011` — Phase 3 v2: centralize labels, gate causal on live BTC, true alarm empty state
- `21cb0df` — Phase 3 v3: source label leak, MarketTicker source-verify, drop EMPTY_ALARM_HINT, neutral dashboard tagline

---

## Classification

| Gate | Result |
|------|--------|
| SOURCE_ONLY_PASS | **PASS** |
| CI_PASS | **NOT_RUN** — awaiting GitHub Actions on HEAD |
| API_CONTRACT_PASS | **PARTIAL_LOCAL_ONLY** — endpoints verified locally; live domain not accessible |
| BROWSER_MOBILE_EMULATION_PASS | **NOT_RUN** — Chromium download blocked in sandbox |
| REAL_MOBILE_PASS | **NOT_RUN** — no physical device |
| PROD_PASS | **FAIL** — live endpoint returns `not_provided_by_cli_deploy` |
| **Production-ready** | **NO** |

---

## Source Audit Findings

### ✅ PASS — "Canlı" status cannot appear without real provider + valid TTL

`inferBaseStatus()` in `data-status.ts` requires:
- `hasPrice = true`
- Source `BINANCE-WS`: `delayMinutes !== null` AND `< 5` → "live"
- Source `BINANCE`: `delayMinutes !== null` AND `<= 2` → "live"
- Any unknown source → "delayed", never "live"
- Additional guard: `live` downgrades to `delayed` if `delayMinutes >= 5`

Verified by logic simulation: UNKNOWN/COINGECKO/STOOQ/BACKEND sources cannot produce "live" status.

### ✅ PASS — Label centralization

Canonical 6-value `DataStatus`: `live | delayed | ayc_data | no_data | insufficient | demo`

All labels flow through `getStatusLabel()` / `getStatusColor()` from `data-status.ts`:
- `AssetDetailModal`: local `AnalysisStatus` type, `statusLabel()`, `statusColor()` removed; uses `mapLegacyStatus()` + central helpers (commit `dade011`)
- `MarketTicker`: uses `getStatusLabel(tickerStatus)` (commit `dade011` + updated `21cb0df`)
- Dashboard: `dataStatus` uses `getStatusLabel()` (commit `dade011`)
- Market page: `buildDataStatusMeta()` (pre-existing)

`mapLegacyStatus()` normalizes old API values: `fallback→delayed`, `no_volume→insufficient`, `license_required→insufficient`, `api_error→no_data`.

### ✅ PASS — Source label leak fixed

`BINANCE-WS` source label changed:
- TR: `"Binance Canlı"` → `"Binance WS"` (commit `21cb0df`)
- EN: `"Binance Live"` → `"Binance Stream"` (commit `21cb0df`)

The word "Canlı" now appears **only** in `dataStatusLabel` when TTL/provider rules pass — not in the source attribution label.

### ✅ PASS — Price/status consistency

- **Market page** (`/market`): `buildDataStatusMeta()` from `data-status.ts` ✅
- **Dashboard**: `getStatusLabel(freshPriceCount >= 8 ? "live" : freshPriceCount > 0 ? "delayed" : "no_data")` — labels from central module ✅
- **MarketTicker**: `source === "binance-ws"` + TTL < 5 min gate for live; falls back to `"delayed"` or `"no_data"` ✅
- **AssetDetailModal**: `mapLegacyStatus(analysis.dataQuality.status) || (livePrice ? "delayed" : "no_data")` — no longer claims "live" on price arrival without TTL ✅

Note: Dashboard 45s freshPriceCount threshold is retained for aggregate display (multi-asset) — this is distinct from per-asset TTL in `buildDataStatusMeta`.

### ✅ PASS — Dashboard realtime claim removed

`"Gerçek zamanlı piyasa istihbarat merkezi"` → `"Piyasa istihbarat merkezi"` (commit `21cb0df`).
No unverified "realtime" claim in UI. Label is neutral, accurate regardless of data freshness.

### ✅ PASS — Analysis gating (target/stop/RR/Kelly/probability)

- `AssetDetailModal`: `mappedQualityStatus !== "insufficient" && mappedQualityStatus !== "no_data"` (post-`mapLegacyStatus`) gates Hedef/Stop Loss/RR display ✅
- Scenario API route: nulls Kelly/probability/RR/PnL for fallback; returns empty for insufficient ✅

### ✅ PASS — Dashboard causal truth

- Causal query gated on `btcLiveFresh` (`nowTs - btcEntry.ts < 60000` AND `price > 0`) (commit `dade011`)
- Fake values removed: `||80000` price fallback, `volume_ratio:2.1`, `indicators:{rsi:62,macd_hist:0.0012}` ✅
- Query `enabled: btcLiveFresh` — disabled when BTC price not verified fresh ✅
- UI shows `"Causal analiz için güvenilir veri yok."` when not fresh ✅

### ✅ PASS — Dashboard fake data fully removed

- `MOCK_SIGNALS`, `MOVER_SEEDS`, `MOCK_CAUSAL`: **absent** ✅
- `"3 AI MOTOR AKTİF"`: replaced with runtime `actionableCount` ✅
- Causal fake payload removed ✅

### ✅ PASS — Alarm truth

- `MOCK_ALARMS`: **absent** ✅
- `EMPTY_ALARM_HINT` constant: **removed entirely** (commit `21cb0df`) ✅
- True empty state rendered when `alarms.length === 0` ✅
- API confirmed: `/api/v1/alarms` returns `{"alarms":[],"count":0}` when no alarms stored ✅

### ✅ PASS — Traceability

- `VersionInfo`: `traceabilityComplete: boolean`, `traceabilityStatus`, `missing: string[]`
- Smoke with AYC vars: `traceabilityComplete:true, missing:[]` ✅
- Smoke without AYC vars: `traceabilityComplete:false, missing:[4 fields]` ✅
- Cache-Control: `no-store, max-age=0` ✅

### ✅ PASS — Performance zero-state bar

- `stats.total === 0` → grey bar, no gold segment ✅
- Gold segment only when `stats.pending > 0` ✅

### ✅ FIXED — Social Radar percentages (QA-found bug)

`seededSentiment()`: proportional scaling when `bull+bear > 100`. All 1610 combinations now sum to exactly 100 (commit `a614605`).

### ✅ PASS (source-only) — Mobile shell safe-area CSS

`.app-ticker { padding-top: env(safe-area-inset-top, 0px); box-sizing: content-box; }` — `viewport-fit:cover` and `black-translucent` already set. **Not verified on real device.**

### ✅ PASS — MarketTicker no duplicate symbols; source-verified status

38 unique symbols confirmed. Double-render in JSX is intentional for seamless CSS scroll loop.
Live status now requires `source === "binance-ws"` + TTL < 5 min (commit `21cb0df`).

---

## API Contract Smoke (local dev server)

All tested against `http://localhost:3092` (Next.js dev):

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /api/v1/version` (no AYC vars) | ✅ 200 | `traceabilityComplete:false` |
| `GET /api/v1/version` (AYC vars set) | ✅ 200 | `traceabilityComplete:true` |
| `GET /api/v1/health` | ✅ 200 | `status:"ok"` |
| `GET /api/v1/prices/live?symbols=BTCUSDT` | ✅ 200 | Empty without backend (expected) |
| `GET /api/v1/alarms` | ✅ 200 | `alarms:[], count:0` |
| `GET /api/v1/signals/live` | ✅ 200 | `signals:[], feed_status:"no_signal"` |
| `GET /dashboard` | ✅ 200 | |

---

## Browser / Mobile Smoke

**NOT RUN** — Playwright Chromium download blocked (network restricted in sandbox).

Required viewports for future verification:
- 390×844 (iPhone 14 Pro)
- 393×852 (iPhone 15)
- 412×915 (Android)
- 430×932 (iPhone 15 Plus)
- 768×1024 (iPad)

---

## Production

**FAIL** — Live endpoint returns `not_provided_by_cli_deploy`. Not verified.

---

## Open Issues

| # | Severity | Issue |
|---|----------|-------|
| 1 | Fixed | Social Radar bull+bear>100 — `a614605` |
| 2 | Fixed | Label centralization gaps — `dade011` |
| 3 | Fixed | Dashboard/ticker threshold inconsistency — labels now from `getStatusLabel()` — `dade011` |
| 4 | Fixed | AssetDetailModal headerStatus false-live — `dade011` |
| 5 | Fixed | Dashboard causal fake values — `dade011` |
| 6 | Fixed | EMPTY_ALARM_HINT demo row — `dade011` / `21cb0df` |
| 7 | Fixed | Source label "Binance Canlı" leak — `21cb0df` |
| 8 | Fixed | MarketTicker unverified live threshold — `21cb0df` |
| 9 | Fixed | "Gerçek zamanlı" unverified claim — `21cb0df` |
| 10 | Blocker | CI not run on HEAD (`21cb0df`) — awaiting GitHub Actions |
| 11 | Blocker | Browser/mobile smoke NOT_RUN — network blocked |
| 12 | Blocker | Real mobile NOT_RUN — no device |
| 13 | Blocker | Production FAIL — `not_provided_by_cli_deploy` |

---

## Test Results at HEAD (21cb0df)

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | ✅ Clean (0 errors) |
| `pytest` (127/129) | ✅ 127 passed, 2 deselected (fastapi env-only; pass in CI) |
| Social radar math | ✅ All 1610 combinations sum to 100 |
| API smoke (local) | ✅ Key endpoints respond correctly |

---

## Honesty Summary

- **SOURCE_ONLY_PASS: PASS** — all source-level truth leaks resolved at HEAD `21cb0df`
- **CI_PASS: NOT_RUN** — awaiting GitHub Actions on pushed HEAD
- **PROD_PASS: FAIL** — live domain returns `not_provided_by_cli_deploy`
- **Production-ready: NO** — CI, browser smoke, real mobile, and production verification all remain outstanding
