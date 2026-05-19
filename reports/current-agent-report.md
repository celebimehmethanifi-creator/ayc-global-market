# AYC BrowserStack Real-Device Start Report

## Context
- Branch: `fix/live-data-truth-mobile-shell`
- Work branch: `sync/fix-live-data-truth-mobile-shell`
- HEAD (before this report update): `934cd2f`
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

## Local Pipeline Result
- `pnpm install`: PASS
- `pnpm type-check`: PASS
- `pnpm lint`: PASS (warnings only)
- `pnpm build`: PASS
- `pnpm test:browser`: PASS (`85 passed / 0 failed`)

## BrowserStack Credential Check
- `BROWSERSTACK_USERNAME_PRESENT=true`
- `BROWSERSTACK_ACCESS_KEY_PRESENT=true`
- `BROWSERSTACK_CREDENTIALS_VALID=false`
- Result: BrowserStack API auth failed before tunnel/session start.
- Session links: not available (no session started)

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
- exact blocker: BrowserStack credentials fail API auth (`BROWSERSTACK_CREDENTIALS_VALID=false`).
- exact file/test: `scripts/ayc-browserstack-real-device.ps1` (`Test-BrowserStackCredentials`), `tests/browserstack/real-device.smoke.spec.ts`
- next action: set valid BrowserStack account credentials in environment and rerun real-device pipeline.
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
