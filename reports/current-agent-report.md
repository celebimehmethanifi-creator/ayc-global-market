# Phase 3 QA Report — fix/live-data-truth-mobile-shell

**Branch:** `fix/live-data-truth-mobile-shell`
**Code commit:** `5d4c86c`
**HEAD:** (post-selector-fix commit — see git log)
**PR:** [#3](https://github.com/celebimehmethanifi-creator/ayc-global-market/pull/3)
**Base:** `hardening-production-readiness @ 392ae98`
**QA date:** 2026-05-18

---

## Classification

| Gate | Result |
|------|--------|
| SOURCE_ONLY_PASS | **PASS** |
| CI_PASS | **PASS_WITH_WARNINGS** |
| API_CONTRACT_PASS | **PASS_LOCAL** |
| BROWSER_MOBILE_EMULATION_PASS | **PASS** |
| REAL_MOBILE_PASS | **NOT_RUN** |
| PROD_PASS | **FAIL** |
| **Production-ready** | **NO** |

---

## Tool Versions (Linux sandbox)

| Tool | Version |
|------|---------|
| Node.js | v22.22.2 |
| Playwright | 1.56.1 |
| Chromium | build 1194 (pre-installed at `/opt/pw-browsers/`) |
| Next.js | 14.2.3 |
| Python | 3.11 |

---

## 1. CI — PASS_WITH_WARNINGS

GitHub Actions run `26046686917` on PR #3 HEAD `2868c0f`:

| Job | Conclusion |
|-----|-----------|
| Web lint + type-check + build | ✅ success |
| Pytest backend tests | ✅ success |
| Secret scan (gitleaks) | ✅ success |
| Docker compose config validation | ✅ success |
| Vercel Preview Comments | ✅ success |

**Known warnings (non-blocking):**

**Warning 1 — `gitleaks-action@v2` unexpected input**
```yaml
- uses: gitleaks/gitleaks-action@v2
  with:
    gitleaks-config: .gitleaks.toml   # not a valid with input for v2
```
`gitleaks-action@v2` ignores `with.gitleaks-config`; correct form is `env: GITLEAKS_CONFIG: .gitleaks.toml`. Generates "Unexpected input(s): 'gitleaks-config'" annotation. **Job passes.**

**Warning 2 — Node.js 20 deprecation**
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20   # GitHub Actions deprecating Node 20 internal runtime
```
Affects action script execution runtime only, not the build artefact. **Job passes.**

---

## 2. API Contract Smoke — PASS_LOCAL

Tested against `localhost:3093` (Next.js dev, `JWT_SECRET` set with safe dummy value):

| Endpoint | HTTP | Result | Notes |
|----------|------|--------|-------|
| `GET /api/v1/version` | 200 | ✅ PASS | `traceabilityComplete:false` (no AYC env vars — expected) |
| `GET /api/v1/health` | 200 | ✅ PASS | Returns 500 without `JWT_SECRET` — correct security guard |
| `GET /api/v1/prices/live?symbols=BTCUSDT` | 200 | ✅ PASS | `prices:{}, count:0` — empty without backend |
| `GET /api/v1/alarms` | 200 | ✅ PASS | Returns 500 without `JWT_SECRET` — correct security guard |
| `GET /api/v1/signals/live` | 200 | ✅ PASS | `signals:[], feed_status:no_signal` |
| `GET /dashboard` | 200 | ✅ PASS | Page compiles and renders |

Production endpoints (`aycmarket.com`, `app.aycmarket.com`, `www.aycmarket.com`) blocked at network level — "Host not in allowlist".

---

## 3. Browser / Mobile Emulation — PASS

**45/45 tests passed** across 5 viewport projects.

| Viewport | Tests | Result |
|----------|-------|--------|
| mobile-390x844 | 9 | ✅ all pass |
| mobile-393x852 | 9 | ✅ all pass |
| mobile-412x915 | 9 | ✅ all pass |
| mobile-430x932 | 9 | ✅ all pass |
| tablet-768x1024 | 9 | ✅ all pass |

**Execution environment:**
- Chromium build 1194 at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
- `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`
- Dev server: `localhost:3093` (Next.js dev, `JWT_SECRET` set)
- Playwright 1.56.1 (pinned exact in package.json)

**Tests verified:**

| Check | Result |
|-------|--------|
| No horizontal overflow (all 5 viewports × all pages) | ✅ PASS |
| Dashboard neutral tagline "Piyasa istihbarat merkezi" | ✅ PASS |
| No "Gerçek zamanlı piyasa istihbarat merkezi" in body | ✅ PASS |
| No "Binance Canlı" in rendered HTML | ✅ PASS |
| No `SİSTEM` / `EMPTY_ALARM_HINT` demo row in alarm widget | ✅ PASS |
| No `MOCK_ALARM` on alarms page | ✅ PASS |
| Ticker does not overlap bottom nav (`.bottom-nav`) on mobile | ✅ PASS |
| Dashboard, Market, Social, Performance, Alarms render without crash | ✅ PASS |

**Selector note:** Initial test run (35/45 pass) had a selector bug in `checkTickerNotOverlapping` — `"nav, ..."` matched the top sidebar `<nav>` at y=0 instead of `.bottom-nav` at y≈786. Fixed selector to `.bottom-nav`. Re-run: 45/45 pass.

**Screenshots:** `test-results/screenshots/phase3-browser-mobile-smoke/` (90 files — 45 tests × 2 shots each).

---

## 4. Real Mobile — NOT_RUN

No physical device available. Required: real iOS Safari or Android Chrome with DevTools remote debugging evidence.

---

## 5. Production — FAIL

All production hostnames blocked at network level from sandbox. Previous manual testing showed `/api/v1/version` returning `not_provided_by_cli_deploy` on live domain.

**Required to mark PASS:** live `/api/v1/version` must return real `commitSha` and `branch` (not `not_provided_by_cli_deploy`).

---

## Source Audit Summary (all PASS at code commit `5d4c86c`)

| Check | Result | Fix commit |
|-------|--------|------------|
| "Canlı" requires provider + TTL | ✅ PASS | `dade011` |
| Label centralization | ✅ PASS | `dade011` |
| Source label "Binance Canlı" leak | ✅ PASS | `21cb0df` |
| AssetDetailModal headerStatus false-live | ✅ PASS | `dade011` |
| Dashboard causal fake values | ✅ PASS | `dade011` |
| Dashboard aggregate provider-aware status | ✅ PASS | `5d4c86c` |
| Dashboard "Gerçek zamanlı" claim removed | ✅ PASS | `21cb0df` |
| MarketTicker source-verified live | ✅ PASS | `21cb0df` |
| Alarm EMPTY_ALARM_HINT removed | ✅ PASS | `21cb0df` |
| Social radar percentages | ✅ FIXED | `a614605` |
| Traceability fields | ✅ PASS | `ba3ce74` |
| Performance zero-state bar | ✅ PASS | `ba3ce74` |
| Mobile safe-area CSS | ✅ PASS (source-only) | `ba3ce74` |

---

## Open Issues

| # | Severity | Issue |
|---|----------|-------|
| 1–10 | ✅ Fixed | All source-level truth leaks |
| 11 | ⚠️ Warning | CI: gitleaks-action `gitleaks-config` unexpected input (annotation, not failure) |
| 12 | ⚠️ Warning | CI: Node.js 20 deprecation in `actions/setup-node@v4` (annotation, not failure) |
| 13 | ✅ Done | Browser/mobile emulation — 45/45 PASS (Linux sandbox with pre-installed Chromium build 1194) |
| 14 | 🔴 Blocker | Real mobile NOT_RUN — no device |
| 15 | 🔴 Blocker | Production FAIL — `not_provided_by_cli_deploy`; network blocked from sandbox |

---

## Test Results at HEAD

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `pytest` (127/129) | ✅ 127 passed, 2 deselected (fastapi env-only) |
| CI: Web lint + type-check + build | ✅ PASS |
| CI: Pytest backend tests | ✅ PASS |
| CI: Secret scan | ✅ PASS |
| CI: Docker compose validate | ✅ PASS |
| API smoke local | ✅ 6/6 PASS |
| Browser/mobile emulation | ✅ **45/45 PASS** (5 viewports) |

---

## Honesty Summary

**SOURCE_ONLY_PASS: PASS** — no component produces "Canlı" without verified source + TTL.

**CI_PASS: PASS_WITH_WARNINGS** — all jobs green; two non-blocking annotation warnings.

**API_CONTRACT_PASS: PASS_LOCAL** — 6/6 endpoints correct locally.

**BROWSER_MOBILE_EMULATION_PASS: PASS** — 45/45 tests pass across 5 viewports (390×844, 393×852, 412×915, 430×932, 768×1024). No overlap, no overflow, no fake live claims in rendered HTML. Chromium build 1194 on Linux sandbox.

**REAL_MOBILE_PASS: NOT_RUN** — no device.

**PROD_PASS: FAIL** — `not_provided_by_cli_deploy`.

**Production-ready: NO.**
