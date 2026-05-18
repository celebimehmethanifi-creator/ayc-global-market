# Deploy Version Metadata Traceability Patch — Agent Report

**Date:** 2026-05-18  
**Task:** Deploy Version Metadata Traceability Patch  
**Branch:** fix/deploy-version-metadata @ c500ecb

---

## 1. Branch Before

| Field | Value |
|-------|-------|
| Base branch | hardening-production-readiness |
| Base HEAD | 8b3fff4 |
| Ancestor check (8b3fff4) | PASS |
| Working tree before | clean |

## 2. Work Branch / Commit

| Field | Value |
|-------|-------|
| Branch | fix/deploy-version-metadata |
| Commit | c500ecb |
| Commit message | fix(deploy): add AYC deployment metadata fallback to version endpoint |
| Based on | 8b3fff4 (hardening-production-readiness) |

## 3. Changed Files

| File | Change |
|------|--------|
| `apps/web/app/api/v1/_lib/version-info.ts` | Added AYC_* env vars, deploymentId field |
| `tests/hardening/test_production_guards.py` | Added 4 new version metadata tests |

## 4. Version Route Path

| File | Purpose |
|------|---------|
| `apps/web/app/api/v1/version/route.ts` | Route handler (unchanged — calls getVersionInfo()) |
| `apps/web/app/api/v1/_lib/version-info.ts` | Helper — **patched** |
| `apps/web/app/version.txt/route.ts` | Text format alias (unchanged) |

## 5. Version Metadata Support Result

### Before patch
| Field | Reads |
|-------|-------|
| commitSha | VERCEL_GIT_COMMIT_SHA, NEXT_PUBLIC_COMMIT_SHA, GIT_COMMIT_SHA |
| branch | VERCEL_GIT_COMMIT_REF, NEXT_PUBLIC_BRANCH, GIT_BRANCH |
| buildTime | BUILD_TIME, VERCEL_GIT_COMMIT_TIMESTAMP, NEXT_PUBLIC_BUILD_TIME |
| deploymentUrl | DEPLOYMENT_URL, VERCEL_URL, NEXT_PUBLIC_SITE_URL |
| deploymentId | ❌ field did not exist |

### After patch
| Field | Priority chain |
|-------|---------------|
| commitSha | VERCEL_GIT_COMMIT_SHA → **AYC_COMMIT_SHA** → NEXT_PUBLIC_COMMIT_SHA → GIT_COMMIT_SHA → fallback |
| branch | VERCEL_GIT_COMMIT_REF → **AYC_BRANCH** → NEXT_PUBLIC_BRANCH → GIT_BRANCH → fallback |
| buildTime | **AYC_BUILD_TIME** → BUILD_TIME → VERCEL_GIT_COMMIT_TIMESTAMP → fallback |
| deploymentUrl | DEPLOYMENT_URL → VERCEL_URL → **AYC_DEPLOYMENT_URL** → NEXT_PUBLIC_SITE_URL → fallback |
| deploymentId | ✅ NEW: VERCEL_DEPLOYMENT_ID → **AYC_DEPLOYMENT_ID** → VERCEL_URL → fallback |

## 6. Hardening Tests Added

| Test | Assertion |
|------|-----------|
| `test_version_route_supports_ayc_commit_metadata` | AYC_COMMIT_SHA, AYC_BRANCH, AYC_BUILD_TIME present in helper |
| `test_version_route_prefers_vercel_git_metadata` | VERCEL_GIT_COMMIT_SHA before AYC_COMMIT_SHA; VERCEL_GIT_COMMIT_REF before AYC_BRANCH |
| `test_version_route_safe_fallback_only_when_metadata_missing` | Literal appears exactly once (definition); CLI_FALLBACK used everywhere else |
| `test_version_route_does_not_expose_secrets` | 9 forbidden secret env vars absent from version route + helper |

## 7. Test Command Results

| Command | Result |
|---------|--------|
| `pytest tests/hardening/test_production_guards.py -q` | **111 passed**, 2 deselected (env-only jose C-extension) |
| `pnpm --filter neura-web lint` | **PASS** (warnings only, EXIT 0) |
| `pnpm --filter neura-web type-check` | **PASS** (EXIT 0) |
| `pnpm --filter neura-web build` | **PASS** (EXIT 0) |

## 8. Local Runtime Version Test Result

### With AYC vars set
```
AYC_COMMIT_SHA=test-sha-123
AYC_BRANCH=hardening-production-readiness
AYC_BUILD_TIME=2026-05-18T00:00:00Z
AYC_DEPLOYMENT_ID=fix-deploy-version-metadata
```

**Response:**
```json
{
    "commitSha": "test-sha-123",
    "branch": "hardening-production-readiness",
    "buildTime": "2026-05-18T00:00:00.000Z",
    "environment": "development",
    "deploymentUrl": "not_provided_by_cli_deploy",
    "deploymentId": "fix-deploy-version-metadata"
}
```
**Result: PASS** ✅ — all AYC vars reflected correctly

### Without AYC or Vercel vars

**Response:**
```json
{
    "commitSha": "not_provided_by_cli_deploy",
    "branch": "not_provided_by_cli_deploy",
    "buildTime": "not_provided_by_cli_deploy",
    "environment": "development",
    "deploymentUrl": "not_provided_by_cli_deploy",
    "deploymentId": "not_provided_by_cli_deploy"
}
```
**Result: PASS** ✅ — safe fallback works correctly

## 9. Security Regression Result

| Check | Result |
|-------|--------|
| No secrets in version route/helper | PASS — `git grep` found nothing |
| No CG-/Stripe/AI API key reads in version files | PASS |
| No provider literal key values in current tree | PASS |
| No conflict markers | PASS |
| mock_router guard intact | PASS (not touched) |
| signals/live production guard intact | PASS (not touched) |

## 10. Remaining P0 Blockers

| Blocker | Status |
|---------|--------|
| gitleaks secret scan | Fixed in 8b3fff4 (.gitleaks.toml allowlist committed) |
| Web lint NODE_ENV=production devDep skip | Fixed in 399b649 (NODE_ENV removed from pnpm install) |
| Docker compose env_file missing | Fixed in 399b649 (required: false) |
| Version metadata traceability | **Fixed in this commit (c500ecb)** |

Remaining P1 (out of scope this task):
- git filter-repo history rewrite (separate task)
- Vercel Protection Bypass for browser/mobile preview QA

## 11. Recommendation

**VERSION_METADATA_PATCH_READY**

All tests pass. Lint/type-check/build pass. Runtime confirms AYC metadata flows through.  
Branch `fix/deploy-version-metadata` @ `c500ecb` is ready for controlled merge into `hardening-production-readiness`.

## 12. Production-ready?

**HAYIR** — Codex QA + controlled merge (fix/deploy-version-metadata → hardening-production-readiness) + deploy smoke at `/api/v1/version` with AYC env vars set sonrası karar.
