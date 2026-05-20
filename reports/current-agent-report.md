# AYC BrowserStack Real-Device Start Report

## Context
- Branch: `fix/live-data-truth-mobile-shell`
- Work branch: `sync/fix-live-data-truth-mobile-shell`
- HEAD (before this report update): `5a7f2d0`
- Date: `2026-05-20`
- BrowserStack setup commit: `df51d7b`

## Commands Run
1. `pnpm install`
2. `pnpm type-check`
3. `pnpm lint`
4. `pnpm build`
5. `npx playwright install chromium`
6. `pnpm test:browser`
7. `powershell -ExecutionPolicy Bypass -File .\scripts\ayc-browserstack-real-device.ps1`
8. `Invoke-WebRequest https://aycmarket.com/api/v1/version`
9. `Invoke-WebRequest https://app.aycmarket.com/api/v1/version`
10. `curl -I https://www.aycmarket.com/api/v1/version`
11. BrowserStack credential debug (runtime-only trim + `GET /automate/plan.json` Basic Auth)

## Local Pipeline Result
- `pnpm install`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS (warnings only)
- `pnpm build`: PASS
- `pnpm test:browser`: PASS (`85 passed / 0 failed`)

## BrowserStack Credential Debug (Requested)
- `process.env.kirvec_TIR7wr`: present=`false`
- `process.env.g6BvNrFycP5929pQNTGT`: present=`false`
- runtime trim applied: `true` (no persisted changes)
- `credentials_present`: `false`
- `credentials_valid`: `false`
- classification: `INVALID_CREDENTIALS`
- blocker: `BROWSERSTACK_AUTH_BLOCKED`
- HTTP status: `null` (request not attempted due to missing process env vars)
- sanitized error body: `missing process.env credential variable(s)`

## BrowserStack Config Verification
- Not executed because auth is blocked.
- Next run target after valid credentials: verify env-only credentials, iOS Safari + Android Chrome capabilities, `browserstack.local=true` for localhost mode, and session/artifact outputs.

## Production Version Trace Check
- `https://aycmarket.com/api/v1/version`: `200`, returns `commitSha=not_provided_by_cli_deploy`, `branch=not_provided_by_cli_deploy`
- `https://app.aycmarket.com/api/v1/version`: `200`, returns `commitSha=not_provided_by_cli_deploy`, `branch=not_provided_by_cli_deploy`
- `https://www.aycmarket.com/api/v1/version`: `308` redirect to `https://aycmarket.com/api/v1/version`

## BrowserStack Setup Added
- `playwright.browserstack.config.ts`
- `tests/browserstack/fixture.ts`
- `tests/browserstack/real-device.smoke.spec.ts`
- `scripts/ayc-browserstack-real-device.ps1`
- `scripts/browserstack-local-daemon.js`
- `package.json` (`test:browserstack` script + `browserstack-local` dev dependency)
- `pnpm-lock.yaml`

## Blocking Gates (Owner + Next Action)

### REAL_MOBILE_PASS = FAIL
- owner: `Codex`
- handoff target: `User (external secret)`
- exact blocker: `BROWSERSTACK_AUTH_BLOCKED` (missing `process.env.kirvec_TIR7wr` and/or `process.env.g6BvNrFycP5929pQNTGT`).
- exact file/test: `scripts/ayc-browserstack-real-device.ps1` (`Test-BrowserStackCredentials`), `tests/browserstack/real-device.smoke.spec.ts`
- next action: set valid BrowserStack credentials in process env vars (`kirvec_TIR7wr`, `g6BvNrFycP5929pQNTGT`) and rerun auth check.
- next validation command: `powershell -ExecutionPolicy Bypass -File .\scripts\ayc-browserstack-real-device.ps1`

### PROD_PASS = FAIL
- owner: `Codex`
- handoff target: `User (external deploy approval/permission)`
- exact blocker: live version API still exposes deploy fallback identity (`not_provided_by_cli_deploy`).
- exact file/test: `apps/web/app/api/v1/version/route.ts`, `apps/web/app/api/v1/_lib/version-info.ts`, live check via `curl -I https://www.aycmarket.com/api/v1/version`
- next action: deploy pipeline must inject real commit/branch/build metadata to production.
- next validation command: `Invoke-WebRequest https://aycmarket.com/api/v1/version`

## Final Classification
- SOURCE_ONLY_PASS: PASS
- CI_PASS: NOT_RUN
- API_CONTRACT_PASS: PASS_LOCAL
- BROWSER_MOBILE_EMULATION_PASS: PASS
- REAL_MOBILE_PASS: FAIL
- PROD_PASS: FAIL
- Production-ready: NO
