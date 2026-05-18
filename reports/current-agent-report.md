# Phase 3 QA Report — fix/live-data-truth-mobile-shell

**Branch:** `fix/live-data-truth-mobile-shell`
**Code commit:** `5d4c86c`
**HEAD:** `27f3d4d`
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
| BROWSER_MOBILE_EMULATION_PASS | **NOT_RUN** |
| REAL_MOBILE_PASS | **NOT_RUN** |
| PROD_PASS | **FAIL** |
| **Production-ready** | **NO** |

---

## Tool Versions (Linux sandbox)

| Tool | Version |
|------|---------|
| Node.js | v22.22.2 |
| Playwright | 1.56.1 (global) |
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

## 3. Browser / Mobile Emulation — NOT_RUN

**All Chromium installation methods failed in Linux sandbox:**

| Method | Result |
|--------|--------|
| `playwright install chromium` | Silent failure — no binary installed |
| `playwright install chromium --with-deps` | Ubuntu PPA `launchpadcontent.net` returns 403 Forbidden |
| `PLAYWRIGHT_BROWSERS_PATH=/tmp playwright install chromium` | Playwright CDN blocked — code=1 |
| `apt-get install -y chromium-browser` | Installs snap stub only; snap daemon unavailable in sandbox |

**Test infrastructure committed** (`27f3d4d`) — ready to run on Windows workspace:

| File | Purpose |
|------|---------|
| `playwright.config.ts` | 5 viewport projects |
| `tests/browser/smoke.spec.ts` | Full smoke suite |
| `scripts/run-browser-smoke-windows.ps1` | Windows one-command runner |
| `test-results/screenshots/phase3-browser-mobile-smoke/` | Output directory |

### To run on `C:\Users\mhani\Desktop\NEURA`:

```powershell
git pull --ff-only

# Install deps (if not done)
pnpm install

# Install Playwright Chromium
pnpm test:browser:install

# Set env and start dev server (separate terminal)
$env:JWT_SECRET="local-test-jwt-secret-32chars-minimum"
$env:NEXT_PUBLIC_API_URL="http://localhost:3093"
pnpm --filter neura-web dev -- -p 3093

# Run all 5 viewport smoke tests
pnpm test:browser
```

Or use the one-command script:
```powershell
.\scripts\run-browser-smoke-windows.ps1
```

**Checks the smoke verifies:**
- No horizontal overflow at any viewport
- No header/ticker overlap with content
- No bottom nav overlap
- `"Piyasa istihbarat merkezi"` neutral tagline present (not "Gerçek zamanlı")
- No `EMPTY_ALARM_HINT` / `SİSTEM` demo row
- No `"Binance Canlı"` in rendered HTML
- Dashboard, market, social, performance, alarms pages render without crash

**Viewports pending:** `390×844`, `393×852`, `412×915`, `430×932`, `768×1024`

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
| 13 | 🔴 Blocker | Browser/mobile emulation NOT_RUN — infrastructure committed `27f3d4d`; run on `C:\Users\mhani\Desktop\NEURA` |
| 14 | 🔴 Blocker | Real mobile NOT_RUN — no device |
| 15 | 🔴 Blocker | Production FAIL — `not_provided_by_cli_deploy`; network blocked from sandbox |

---

## Test Results at HEAD (`27f3d4d`)

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `pytest` (127/129) | ✅ 127 passed, 2 deselected (fastapi env-only) |
| CI: Web lint + type-check + build | ✅ PASS |
| CI: Pytest backend tests | ✅ PASS |
| CI: Secret scan | ✅ PASS |
| CI: Docker compose validate | ✅ PASS |
| API smoke local | ✅ 6/6 PASS |
| Browser/mobile emulation | ⏳ NOT_RUN — run on Windows |

---

## Honesty Summary

**SOURCE_ONLY_PASS: PASS** — no component produces "Canlı" without verified source + TTL.

**CI_PASS: PASS_WITH_WARNINGS** — all jobs green; two non-blocking annotation warnings.

**API_CONTRACT_PASS: PASS_LOCAL** — 6/6 endpoints correct locally.

**BROWSER_MOBILE_EMULATION_PASS: NOT_RUN** — infrastructure committed; Chromium network-blocked in sandbox. Run `pnpm test:browser` on `C:\Users\mhani\Desktop\NEURA`.

**REAL_MOBILE_PASS: NOT_RUN** — no device.

**PROD_PASS: FAIL** — `not_provided_by_cli_deploy`.

**Production-ready: NO.**
