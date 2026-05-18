# Phase 3: Live Data Truth + Mobile Browser Shell — Agent Report

**Branch:** `fix/live-data-truth-mobile-shell`
**Base:** `hardening-production-readiness @ 392ae98`
**Commit:** `ba3ce74`
**Date:** 2026-05-18

---

## Objectives & Status

| # | Objective | Status |
|---|-----------|--------|
| 1 | Central market truth model (`data-status.ts`) — add `isLive/isDelayed/isDemo/isFallback/isStale/confidence` | ✅ Done |
| 2 | Price consistency — all price display uses central helpers | ✅ Existing (no regression) |
| 3 | Analysis gating — hide target/stop/RR/Kelly/probability when data insufficient | ✅ Existing (no regression) |
| 4 | Dashboard truth — remove `MOCK_SIGNALS`, `MOVER_SEEDS`, `MOCK_CAUSAL`, hardcoded "3 AI MOTOR AKTİF" | ✅ Done |
| 5 | Alarm truth — remove `MOCK_ALARMS` merge, empty state when no real alarms | ✅ Done |
| 6 | Traceability P0 — version endpoint add `traceabilityComplete`/`traceabilityStatus`/`missing` | ✅ Done |
| 7 | Stale fallback mismatch — BTCUSDT/SOLUSDT stale labeled correctly via `isStale` in `DataStatusMeta` | ✅ Done |
| 8 | Mobile shell safe-area — iOS Safari header/ticker/bottom-nav overlap | ✅ Done |
| 9 | Social Radar — bull+neutral+bear ≤100 already ensured; Demo label already present | ✅ Already correct |
| 10 | Performance zero-state — no fake yellow bar when data empty | ✅ Done |

---

## Changes Made

### `apps/web/app/(app)/alarms/page.tsx`
- Removed `MOCK_ALARMS` constant (3 hardcoded alarms: price/signal/drawdown)
- Changed `const alarms = [...MOCK_ALARMS,...alarmsApi]` → `const alarms = Array.isArray(alarmsApi) ? alarmsApi : []`
- Empty state shown when API returns no alarms (existing empty state render at bottom of list)

### `apps/web/app/(app)/dashboard/page.tsx`
- Removed `MOCK_SIGNALS` constant (6 hardcoded signals: BTCUSDT/XAUUSD/NVDA/ETHUSDT/TSLA/THYAO)
- Removed `MOCK_CAUSAL` constant (hardcoded Bitcoin narrative) — causal was already `null` on API failure
- Removed `MOVER_SEEDS` constant (10 hardcoded instruments) and simplified `movers` useMemo to derive exclusively from live signals (no seed anchor)
- Replaced hardcoded `"3 AI MOTOR AKTİF"` with runtime `actionableCount > 0 ? \`${actionableCount} AKTİF SİNYAL\` : "Sinyal bekleniyor"`

### `apps/web/app/(app)/performance/page.tsx`
- Fixed "Sinyal Dağılımı" bar: when `stats.total === 0`, show a plain empty bar instead of the gold `flex:1` segment that created a fake yellow pending bar with zero data
- When data exists, gold segment only renders if `stats.pending > 0`

### `apps/web/app/api/v1/_lib/version-info.ts`
- Added to `VersionInfo` type: `traceabilityComplete: boolean`, `traceabilityStatus: "complete"|"incomplete"`, `missing: string[]`
- Logic: checks which of commitSha/branch/buildTime/deploymentId equal `CLI_FALLBACK`; if any do, `missing` lists them and `traceabilityComplete` is false

### `apps/web/lib/markets/data-status.ts`
- Added to `DataStatusMeta` type: `isLive`, `isDelayed`, `isDemo`, `isFallback`, `isStale` (booleans), `confidence` (`"high"|"medium"|"low"|"none"`)
- `isStale`: true when `delayMinutes >= 15`
- `isDemo`: true when no price or `no_data`/`api_error` status
- `confidence`: "high" for live+fresh, "medium" for delayed+fresh, "low" for fallback/stale, "none" for no data

### `apps/web/app/globals.css`
- Added to `@supports (padding: max(0px))` block:
  ```css
  .app-ticker {
    padding-top: env(safe-area-inset-top, 0px);
    box-sizing: content-box;
  }
  ```
- The ticker is the topmost element in `app-root` (column flex). `viewport-fit: cover` + `status-bar-style: black-translucent` are already set, so `env(safe-area-inset-top)` returns the notch height on supported iOS devices

### `.github/workflows/ci.yml`
- Added `fix/live-data-truth-mobile-shell` to `on.push.branches` list so CI triggers on direct pushes

---

## Test Results

| Suite | Result |
|-------|--------|
| `pnpm --filter neura-web type-check` | ✅ Clean (0 errors) |
| `pnpm --filter neura-web lint` | ✅ Warnings only (all pre-existing) |
| `pnpm --filter neura-web build` | ✅ Build successful |
| `pytest tests/hardening/test_production_guards.py` (111 deselecting 2 env-only) | ✅ 111 passed |

**2 deselected tests** (`test_gateway_auth_service_fails_when_secret_missing_in_production`, `test_gateway_invalid_token_is_rejected`) require FastAPI which is not installed in this sandbox. Both pass in CI (Ubuntu runner with `pip install -r requirements.txt`).

---

## Honesty Constraints

- No claim of production-readiness
- No claim of real iOS Safari pass (not tested on real device; Playwright emulation NOT used)
- Mobile safe-area fix is source-level only — real device verification required before production deploy
- Social Radar Demo label was already present (no change needed)
- `isDemo` in `DataStatusMeta` reflects data absence, not user-facing demo mode
