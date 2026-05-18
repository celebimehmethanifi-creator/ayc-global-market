# Phase 3 QA Report — fix/live-data-truth-mobile-shell

**Branch:** `fix/live-data-truth-mobile-shell`
**Code commit:** `5d4c86c`
**HEAD:** `b2a555b`
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

**HEAD `b2a555b` — runs `26054697357` (push) + `26054704996` (push):**

| Job | Run 26054697357 | Run 26054704996 |
|-----|----------------|----------------|
| Web lint + type-check + build | ✅ success | ✅ success |
| Pytest backend tests | ✅ success | ✅ success |
| Secret scan (gitleaks) | ✅ success | ✅ success |
| Docker compose config validation | ✅ success | ✅ success |
| Vercel Preview Comments | ✅ success | — |

**All jobs pass. PASS_WITH_WARNINGS because 4 informational annotations remain (one per job).**

### CI Warning History

| Warning | Status |
|---------|--------|
| `gitleaks-action@v2` unexpected input `gitleaks-config` | ✅ Fixed at `aec7828` (moved to `env: GITLEAKS_CONFIG`) |
| `setup-node@v4` with `node-version: 20` | ✅ Fixed at `aec7828` (upgraded to `node-version: 22`) |
| Node.js 20 action runner runtime — 4 annotations | ⚠️ Partial — see detail below |

### Remaining Annotations (4, informational)

**What GitHub shows:** One annotation per job:
> "Node.js 20 is deprecated. The following actions target Node.js 20 but **are being forced to run on Node.js 24**: `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4`."

| Job | Actions in annotation |
|-----|-----------------------|
| Web lint + type-check + build | `actions/checkout@v4`, `actions/setup-node@v4`, `pnpm/action-setup@v4` |
| Pytest backend tests | `actions/checkout@v4`, `actions/setup-python@v5` |
| Secret scan | `actions/checkout@v4`, `gitleaks/gitleaks-action@v2` |
| Docker compose config validation | `actions/checkout@v4` |

**Root cause:** These actions' `action.yml` files still declare `runs.using: node20` internally. GitHub annotates any job that invokes a node20-targeted action. This is set by the action maintainers (GitHub team, pnpm team, gitleaks team), not by this repository.

**Mitigation applied at `b2a555b`:** `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` added as workflow-level env. This forces all action scripts to execute on node24, confirming node24 compatibility. Annotation text changed from "deprecated, may not work" to "are being forced to run on node24" — all 4 jobs passed successfully.

**To fully eliminate annotations:** Action maintainers must update their `action.yml` from `runs.using: node20` to `runs.using: node24`. GitHub is enforcing this cutover on **June 2, 2026**.

---

## 2. API Contract Smoke — PASS_LOCAL

Tested against `localhost:3093` (Next.js dev, `JWT_SECRET` set with safe dummy value):

| Endpoint | HTTP | Result | Notes |
|----------|------|--------|-------|
| `GET /api/v1/version` | 200 | ✅ PASS | `traceabilityComplete:false` — no AYC env vars in sandbox |
| `GET /api/v1/health` | 200 | ✅ PASS | 200 with JWT_SECRET; 500 without (correct security guard) |
| `GET /api/v1/prices/live?symbols=BTCUSDT` | 200 | ✅ PASS | `prices:{}, count:0` — empty without backend |
| `GET /api/v1/alarms` | 200 | ✅ PASS | 200 with JWT_SECRET; 500 without |
| `GET /api/v1/signals/live` | 200 | ✅ PASS | `signals:[], feed_status:no_signal` |
| `GET /dashboard` | 200 | ✅ PASS | Page compiles and renders |

Production endpoints (`aycmarket.com`, `app.aycmarket.com`, `www.aycmarket.com`) blocked at network level — "Host not in allowlist".

---

## 3. Browser / Mobile Emulation — PASS

**45/45 tests passed** across 5 viewport projects (committed at `7a9f57f`).

| Viewport | Tests | Result |
|----------|-------|--------|
| mobile-390x844 | 9 | ✅ all pass |
| mobile-393x852 | 9 | ✅ all pass |
| mobile-412x915 | 9 | ✅ all pass |
| mobile-430x932 | 9 | ✅ all pass |
| tablet-768x1024 | 9 | ✅ all pass |

**Tests verified:** no horizontal overflow, dashboard neutral tagline, no fake live claims, no demo alarm rows, no Binance Canlı in HTML, ticker/bottom-nav non-overlapping, all 5 pages render without crash.

**Screenshots:** `test-results/screenshots/phase3-browser-mobile-smoke/` (90 files).

---

## 4. Real Mobile — NOT_RUN

No physical device available in this environment. Cannot claim PASS.

**Required to mark PASS:**
- iOS Safari or Android Chrome screenshot evidence
- Tested pages: Dashboard, Market, Asset detail modal, Alarms, Performance
- Verified: no header/ticker overlap, no bottom nav overlap, no horizontal overflow, no fake "Canlı"/"Gerçek zamanlı" claim

---

## 5. Production — FAIL

**Live endpoint returns `not_provided_by_cli_deploy`.**

Production deploy uses Vercel CLI (not Vercel Git integration). CLI deploys do not auto-inject `VERCEL_GIT_COMMIT_SHA` / `VERCEL_GIT_COMMIT_REF`. The `/api/v1/version` endpoint falls through its entire priority chain and reaches the `CLI_FALLBACK` sentinel.

**Priority chain in `apps/web/app/api/v1/_lib/version-info.ts`:**
```
commitSha: VERCEL_GIT_COMMIT_SHA → AYC_COMMIT_SHA → NEXT_PUBLIC_COMMIT_SHA → ...
branch:    VERCEL_GIT_COMMIT_REF  → AYC_BRANCH     → NEXT_PUBLIC_BRANCH → ...
buildTime: AYC_BUILD_TIME → BUILD_TIME → VERCEL_GIT_COMMIT_TIMESTAMP → ...
deployId:  VERCEL_DEPLOYMENT_ID → AYC_DEPLOYMENT_ID → VERCEL_URL → ...
```

**Required to mark PROD_PASS — operator must do ONE of:**

**Option A — Recommended:** Enable Vercel Git integration for this project in Vercel dashboard. Vercel then auto-injects `VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_GIT_COMMIT_TIMESTAMP`, `VERCEL_DEPLOYMENT_ID`, `VERCEL_URL` on every deploy. No code change needed.

**Option B — CLI deploy workaround:** Set these vars in Vercel dashboard (Env vars tab) before next CLI deploy:
```
AYC_COMMIT_SHA     = <full git SHA>
AYC_BRANCH         = hardening-production-readiness
AYC_BUILD_TIME     = <ISO-8601 build timestamp>
AYC_DEPLOYMENT_ID  = <Vercel deployment ID>
AYC_DEPLOYMENT_URL = https://aycmarket.com
```
Or pass them at deploy time:
```bash
NEXT_PUBLIC_COMMIT_SHA=$(git rev-parse HEAD) \
NEXT_PUBLIC_BRANCH=hardening-production-readiness \
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
DEPLOYMENT_URL=https://aycmarket.com \
vercel deploy --prod
```

**Sandbox constraint:** Cannot access Vercel dashboard or run production deploys from this sandbox. Network access to `aycmarket.com` blocked. PROD_PASS remains FAIL.

**To verify PASS:** `https://aycmarket.com/api/v1/version` must return `traceabilityComplete: true` with real `commitSha` and `branch` (not `not_provided_by_cli_deploy`).

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
| 11 | ✅ Fixed | CI: gitleaks-action `gitleaks-config` moved to env var (`aec7828`) |
| 12 | ✅ Fixed | CI: `setup-node` node-version 20 → 22 (`aec7828`) |
| 13 | ✅ Done | Browser/mobile emulation — 45/45 PASS (`7a9f57f`) |
| 16 | ⚠️ Warning | CI: 4 action runner node20→24 annotations — informational, jobs pass, `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` applied (`b2a555b`). Fully eliminate: action maintainers must update `action.yml` runtime to node24. GitHub enforces June 2 2026. |
| 14 | 🔴 Blocker | Real mobile NOT_RUN — no device available |
| 15 | 🔴 Blocker | Production FAIL — `/api/v1/version` returns `not_provided_by_cli_deploy`. Fix: set AYC_* env vars in Vercel dashboard before CLI deploy, or enable Vercel Git integration. |

---

## Test Results at HEAD (`b2a555b`)

| Suite | Result |
|-------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| `pytest` (127/129) | ✅ 127 passed, 2 deselected |
| CI: Web lint + type-check + build | ✅ PASS (node24) |
| CI: Pytest backend tests | ✅ PASS (node24) |
| CI: Secret scan | ✅ PASS (node24, no gitleaks false positives) |
| CI: Docker compose validate | ✅ PASS (node24) |
| API smoke local | ✅ 6/6 PASS |
| Browser/mobile emulation | ✅ **45/45 PASS** (5 viewports) |

---

## Honesty Summary

**SOURCE_ONLY_PASS: PASS** — no component produces "Canlı" without verified source + TTL.

**CI_PASS: PASS_WITH_WARNINGS** — all 8 jobs succeed on node24. 4 informational annotations remain (one per job): "actions target node20 but are being forced to run on node24." `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` applied; actions confirmed node24-compatible. Annotations cannot be fully removed without action maintainer releases.

**API_CONTRACT_PASS: PASS_LOCAL** — 6/6 endpoints correct locally.

**BROWSER_MOBILE_EMULATION_PASS: PASS** — 45/45 tests across 5 viewports. No overlap, no overflow, no fake live claims.

**REAL_MOBILE_PASS: NOT_RUN** — no physical device. Evidence required: real iOS Safari + Android Chrome screenshots.

**PROD_PASS: FAIL** — `/api/v1/version` returns `not_provided_by_cli_deploy`. Fix: enable Vercel Git integration OR set `AYC_COMMIT_SHA`, `AYC_BRANCH`, `AYC_BUILD_TIME`, `AYC_DEPLOYMENT_ID` in Vercel dashboard before CLI deploy.

**Production-ready: NO.**
