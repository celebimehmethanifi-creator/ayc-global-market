# Phase 3 QA Report — fix/live-data-truth-mobile-shell

**Branch:** `fix/live-data-truth-mobile-shell`
**Code commit:** `5d4c86c`
**Base:** `hardening-production-readiness @ 392ae98`
**QA date:** 2026-05-18

Commit history on this branch (Phase 3):
- `ba3ce74` — safe-area CSS, alarm feed truth, traceability, perf zero-state, CI workflow
- `a614605` — social radar bull+bear>100 fix
- `dade011` — Phase 3 v2: centralize labels, gate causal on live BTC, true alarm empty state
- `21cb0df` — Phase 3 v3: source label leak, MarketTicker source-verify, drop EMPTY_ALARM_HINT, neutral dashboard tagline
- `5d4c86c` — Phase 3 v4: provider-aware aggregate status in dashboard

---

## Classification

| Gate | Result |
|------|--------|
| SOURCE_ONLY_PASS | **PASS** |
| CI_PASS | **NOT_RUN** — awaiting GitHub Actions on HEAD `5d4c86c` |
| API_CONTRACT_PASS | **PARTIAL_LOCAL_ONLY** — local dev only; live domain returns `not_provided_by_cli_deploy` |
| BROWSER_MOBILE_EMULATION_PASS | **NOT_RUN** — Chromium download blocked in sandbox |
| REAL_MOBILE_PASS | **NOT_RUN** — no physical device |
| PROD_PASS | **FAIL** — `not_provided_by_cli_deploy` |
| **Production-ready** | **NO** |

---

## Source Audit Findings

### ✅ PASS — "Canlı" status cannot appear without real provider + valid TTL

`inferBaseStatus()` in `data-status.ts`:
- `BINANCE-WS`: `delayMinutes !== null` AND `< 5` → "live"
- `BINANCE`: `delayMinutes !== null` AND `<= 2` → "live"
- Null `delayMinutes` (missing `updatedAt`) → "delayed", never "live"
- All other sources → "delayed"
- Additional guard: live downgrades to delayed at `delayMinutes >= 5`

### ✅ PASS — Label centralization

All status labels from `getStatusLabel()` / `getStatusColor()` in `data-status.ts`.
`mapLegacyStatus()` normalizes old API values: `fallback→delayed`, `no_volume→insufficient`, `license_required→insufficient`, `api_error→no_data`.
Local `AnalysisStatus` / `statusLabel()` / `statusColor()` removed from `AssetDetailModal` (`dade011`).

### ✅ PASS — Source label leak fixed

`BINANCE-WS` source label: TR `"Binance WS"`, EN `"Binance Stream"` (`21cb0df`).
"Canlı" appears **only** in `dataStatusLabel` when TTL/provider rules pass.

### ✅ PASS — Dashboard aggregate status (Phase 3 v4)

Replaced timestamp-only `freshPriceCount >= 8` threshold with provider-aware logic (`5d4c86c`):

```
wsLiveCount   = source==="binance-ws" AND TTL < 5 min
backendFresh  = source==="backend"    AND TTL < 2 min
anyFresh      = any entry             AND TTL < 90 s

dashStatus:
  wsLiveCount >= 3   → "live"    (Canlı)
  wsLiveCount > 0    → "delayed" (Gecikmeli)
  backendFresh > 0   → "ayc_data" (AYC Veri)
  anyFresh > 0       → "delayed" (Gecikmeli)
  else               → "no_data" (Veri yok)
```

Backend / stooq / coingecko / finnhub timestamps can no longer produce "Canlı".

### ✅ PASS — MarketTicker source-verified status

`source === "binance-ws"` + TTL < 5 min required for live count. `tickerStatus`: live only with 3+ verified items; otherwise delayed or no_data (`21cb0df`).

### ✅ PASS — Dashboard realtime claim removed

`"Gerçek zamanlı piyasa istihbarat merkezi"` → `"Piyasa istihbarat merkezi"` (`21cb0df`).

### ✅ PASS — AssetDetailModal header status

`mapLegacyStatus(analysis.dataQuality.status) || (livePrice ? "delayed" : "no_data")` — no longer claims "live" on price arrival without TTL (`dade011`).

### ✅ PASS — Dashboard causal truth

Causal query gated on `btcLiveFresh` (`nowTs - btcEntry.ts < 60000` AND `price > 0`). Fake values removed: `||80000`, `volume_ratio:2.1`, `indicators:{rsi:62,macd_hist:0.0012}` (`dade011`).

### ✅ PASS — Dashboard fake data fully removed

`MOCK_SIGNALS`, `MOVER_SEEDS`, `MOCK_CAUSAL`: absent. Hardcoded "3 AI MOTOR AKTİF" replaced with runtime `actionableCount`.

### ✅ PASS — Alarm truth

`EMPTY_ALARM_HINT` constant removed entirely (`21cb0df`). True empty state when `alarms.length === 0`.

### ✅ PASS — Traceability

`traceabilityComplete`, `traceabilityStatus`, `missing` fields in `/api/v1/version`. Cache-Control: `no-store, max-age=0`.

### ✅ PASS — Performance zero-state bar

No gold segment when `stats.total === 0`. Gold only when `stats.pending > 0`.

### ✅ FIXED — Social Radar percentages

Proportional scaling when `bull+bear > 100`. All 1610 combinations sum to exactly 100 (`a614605`).

### ✅ PASS (source-only) — Mobile shell safe-area CSS

`.app-ticker { padding-top: env(safe-area-inset-top, 0px); box-sizing: content-box; }` — not verified on real device.

### ✅ PASS — MarketTicker no duplicate symbols

38 unique symbols. Double-render intentional for seamless CSS scroll loop.

---

## API Contract Smoke (local dev server, `localhost:3092`)

| Endpoint | Result | Notes |
|----------|--------|-------|
| `GET /api/v1/version` | ✅ 200 | `traceabilityComplete` present |
| `GET /api/v1/health` | ✅ 200 | `status:"ok"` |
| `GET /api/v1/prices/live?symbols=BTCUSDT` | ✅ 200 | Empty without backend (expected) |
| `GET /api/v1/alarms` | ✅ 200 | `alarms:[], count:0` |
| `GET /api/v1/signals/live` | ✅ 200 | `signals:[], feed_status:"no_signal"` |
| `GET /dashboard` | ✅ 200 | |

Live domain: **not tested** — returns `not_provided_by_cli_deploy`.

---

## Browser / Mobile Smoke

**NOT RUN** — Playwright Chromium download blocked (network restricted in sandbox).

Viewports pending: `390×844`, `393×852`, `412×915`, `430×932`, `768×1024`.

---

## Production

**FAIL** — Live endpoint returns `not_provided_by_cli_deploy`. Not accessible from this environment.

---

## Open Issues

| # | Severity | Issue |
|---|----------|-------|
| 1–10 | Fixed | All source-level truth leaks (see commit log above) |
| 11 | Blocker | CI not run on HEAD `5d4c86c` — awaiting GitHub Actions |
| 12 | Blocker | Browser/mobile smoke NOT_RUN — network blocked |
| 13 | Blocker | Real mobile NOT_RUN — no device |
| 14 | Blocker | Production FAIL — `not_provided_by_cli_deploy` |

---

## Test Results at HEAD (`5d4c86c`)

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `pytest` (127/129) | ✅ 127 passed, 2 deselected (fastapi env-only) |
| Social radar math | ✅ All 1610 combinations sum to 100 |
| API smoke (local) | ✅ Key endpoints respond correctly |

---

## Honesty Summary

**SOURCE_ONLY_PASS: PASS** — all source-level truth leaks resolved. No component can produce "Canlı" from timestamps alone or from non-live providers.

**CI_PASS: NOT_RUN** — GitHub Actions not verified at this HEAD.

**PROD_PASS: FAIL** — live domain not accessible.

**Production-ready: NO.**
