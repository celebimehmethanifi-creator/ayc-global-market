# Phase 3 QA Report — fix/live-data-truth-mobile-shell

**Branch:** `fix/live-data-truth-mobile-shell`
**Code commit:** `5d4c86c`
**Report commit:** `2868c0f` (HEAD)
**PR:** [#3](https://github.com/celebimehmethanifi-creator/ayc-global-market/pull/3)
**Base:** `hardening-production-readiness @ 392ae98`
**QA date:** 2026-05-18

Commit history (Phase 3):
| Commit | Description |
|--------|-------------|
| `ba3ce74` | safe-area CSS, alarm feed truth, traceability, perf zero-state, CI workflow |
| `a614605` | social radar bull+bear>100 fix |
| `dade011` | Phase 3 v2: centralize labels, gate causal on live BTC, true alarm empty state |
| `21cb0df` | Phase 3 v3: source label leak, MarketTicker source-verify, EMPTY_ALARM_HINT, tagline |
| `5d4c86c` | Phase 3 v4: provider-aware dashboard aggregate status |
| `2868c0f` | report update (HEAD) |

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

## 1. CI Verification (PR #3, HEAD `2868c0f`)

GitHub Actions run `26046686917` — all 4 CI jobs **passed**:

| Job | Conclusion | Duration |
|-----|-----------|----------|
| Web lint + type-check + build | ✅ success | ~72s |
| Pytest backend tests | ✅ success | ~35s |
| Secret scan (gitleaks) | ✅ success | ~6s |
| Docker compose config validation | ✅ success | ~7s |
| Vercel Preview Comments | ✅ success | — |

**Classification: PASS_WITH_WARNINGS** — jobs pass, two non-blocking warnings observed:

### Warning 1 — `gitleaks-action@v2` unexpected input
```yaml
# ci.yml (current):
- uses: gitleaks/gitleaks-action@v2
  with:
    gitleaks-config: .gitleaks.toml   # ← not a valid 'with' input for v2
```
`gitleaks-action@v2` does not accept `gitleaks-config` via the `with` block. The correct form is `env: GITLEAKS_CONFIG: .gitleaks.toml`. Action still runs and the secret scan passes; this generates the "Unexpected input(s): 'gitleaks-config'" annotation in the Actions log. **Does not cause failure.**

### Warning 2 — Node.js 20 runner deprecation
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 20   # ← GitHub Actions deprecating Node 20 runtime
```
GitHub Actions is deprecating Node.js 20 as the internal action runtime in favour of Node.js 22. Affects action script execution environment, not the build artefact. **Does not cause failure.**

---

## 2. API Contract Smoke (local dev, `localhost:3093`, JWT_SECRET set)

| Endpoint | HTTP | Result | Notes |
|----------|------|--------|-------|
| `GET /api/v1/version` | 200 | ✅ PASS | `traceabilityComplete:false` (no AYC env vars — expected in sandbox) |
| `GET /api/v1/health` | 200 | ✅ PASS | Returns 500 without `JWT_SECRET` — correct security guard |
| `GET /api/v1/prices/live?symbols=BTCUSDT` | 200 | ✅ PASS | `prices:{}, count:0` — empty without backend, expected |
| `GET /api/v1/alarms` | 200 | ✅ PASS | Returns 500 without `JWT_SECRET` — correct security guard |
| `GET /api/v1/signals/live` | 200 | ✅ PASS | `signals:[], feed_status:no_signal` |
| `GET /dashboard` | 200 | ✅ PASS | Page compiles and renders |

**Classification: PASS_LOCAL** — all 6 endpoints respond correctly when run with valid secrets. Endpoints requiring JWT correctly return 500 without it (security guard working).

Production endpoints (`aycmarket.com`, `app.aycmarket.com`, `www.aycmarket.com`) are blocked at the network level ("Host not in allowlist") — not testable from this sandbox.

---

## 3. Browser / Mobile Emulation Smoke

**NOT RUN.**

Playwright v1.56.1 is installed. Chromium binary installation fails:
```
Failed to install browsers
Error: Installation process exited with code: 100
```
Ubuntu PPA (`launchpadcontent.net`) returns 403 Forbidden — network restricted in sandbox. The same block was present in all prior sessions.

**Viewports pending** (must be verified externally):
- `390×844` — iPhone 14 Pro
- `393×852` — iPhone 15
- `412×915` — Android
- `430×932` — iPhone 15 Plus
- `768×1024` — iPad

**Checks pending per viewport:**
- No header/ticker overlap with status bar
- No bottom nav overlap with content
- No horizontal overflow
- Hero/demo balance readable
- Copilot bottom area not compressed
- Ticker not crowded or visually duplicated

---

## 4. Real Mobile

**NOT RUN** — no physical device available.

---

## 5. Production

**FAIL.** All production endpoints blocked at network level from this sandbox. Prior manual testing showed `/api/v1/version` returning `not_provided_by_cli_deploy` on live domain. PROD_PASS cannot be marked until:
1. Network access to production is available, AND
2. Live version endpoint returns real commit SHA / branch (not `not_provided_by_cli_deploy`)

---

## Source Audit Summary

All source-level truth leaks resolved at code commit `5d4c86c`. Full audit detail in Phase 3 v1–v4 reports.

| Check | Result | Commit |
|-------|--------|--------|
| "Canlı" requires provider + TTL | ✅ PASS | `dade011` |
| Label centralization | ✅ PASS | `dade011` |
| Source label leak ("Binance Canlı") | ✅ PASS | `21cb0df` |
| Price/status consistency across all components | ✅ PASS | `dade011`–`5d4c86c` |
| Dashboard aggregate provider-aware status | ✅ PASS | `5d4c86c` |
| Dashboard "Gerçek zamanlı" claim removed | ✅ PASS | `21cb0df` |
| MarketTicker source-verified live | ✅ PASS | `21cb0df` |
| AssetDetailModal headerStatus false-live | ✅ PASS | `dade011` |
| Dashboard causal fake values removed | ✅ PASS | `dade011` |
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
| 11 | ⚠️ Warning | CI: gitleaks-action `gitleaks-config` unexpected input — not a failure |
| 12 | ⚠️ Warning | CI: Node.js 20 deprecation in `actions/setup-node@v4` — not a failure |
| 13 | 🔴 Blocker | Browser/mobile emulation NOT_RUN — Chromium install blocked by network |
| 14 | 🔴 Blocker | Real mobile NOT_RUN — no device |
| 15 | 🔴 Blocker | Production FAIL — `not_provided_by_cli_deploy`; network blocked from sandbox |

---

## Test Results at HEAD (`2868c0f` / code `5d4c86c`)

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `pytest` (127/129 local) | ✅ 127 passed, 2 deselected (fastapi env-only) |
| CI: Web lint + type-check + build | ✅ PASS |
| CI: Pytest backend tests | ✅ PASS |
| CI: Secret scan | ✅ PASS |
| CI: Docker compose validate | ✅ PASS |
| API smoke (local + JWT_SECRET) | ✅ 6/6 endpoints pass |

---

## Honesty Summary

**SOURCE_ONLY_PASS: PASS** — no component can produce "Canlı" without verified Binance WS source + TTL.

**CI_PASS: PASS_WITH_WARNINGS** — all 4 jobs green; two non-blocking annotation warnings noted (gitleaks input, Node 20 deprecation).

**API_CONTRACT_PASS: PASS_LOCAL** — all 6 endpoints correct with valid secrets locally. Production not reachable from sandbox.

**BROWSER_MOBILE_EMULATION_PASS: NOT_RUN** — Chromium download blocked; must be verified externally.

**REAL_MOBILE_PASS: NOT_RUN** — no physical device.

**PROD_PASS: FAIL** — network blocked; previous live test returned `not_provided_by_cli_deploy`.

**Production-ready: NO.**
