# Phase 3 Browser/Mobile Smoke — Windows runner
# Usage: .\scripts\run-browser-smoke-windows.ps1
# Run from repo root: C:\Users\mhani\Desktop\NEURA

param(
  [int]$Port = 3093,
  [string]$Project = ""   # leave empty to run all 5 viewports
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot | Split-Path -Parent

Write-Host "=== Phase 3 Browser/Mobile Smoke ===" -ForegroundColor Cyan
Write-Host "Repo: $RepoRoot"
Write-Host "Port: $Port"

# 1. Verify branch
Push-Location $RepoRoot
$head = git rev-parse --short HEAD
$branch = git rev-parse --abbrev-ref HEAD
Write-Host "Branch: $branch  HEAD: $head"
if ($branch -ne "fix/live-data-truth-mobile-shell") {
  Write-Warning "Expected branch fix/live-data-truth-mobile-shell, got $branch"
}

# 2. Install Playwright Chromium if missing
Write-Host "`n--- Installing Playwright Chromium ---" -ForegroundColor Yellow
npx playwright install chromium

# 3. Set test env vars (safe dummy values)
$env:JWT_SECRET              = "local-test-jwt-secret-32chars-minimum"
$env:SECRET_KEY              = "local-test-secret-key-32chars-minimum"
$env:EXCHANGE_CREDENTIALS_KEY= "local-test-exchange-key-32chars"
$env:NEXT_PUBLIC_API_URL     = "http://localhost:$Port"
$env:NEXT_PUBLIC_SITE_URL    = "http://localhost:$Port"

# 4. Start dev server in background
Write-Host "`n--- Starting Next.js dev server on port $Port ---" -ForegroundColor Yellow
$devServer = Start-Process -FilePath "pnpm" `
  -ArgumentList "--filter", "neura-web", "dev", "--", "-p", "$Port" `
  -WorkingDirectory $RepoRoot `
  -PassThru -NoNewWindow

Write-Host "Dev server PID: $($devServer.Id) — waiting 15s for ready..." -ForegroundColor Gray
Start-Sleep -Seconds 15

# 5. API smoke
Write-Host "`n--- API Contract Smoke ---" -ForegroundColor Yellow
$endpoints = @(
  "/api/v1/version",
  "/api/v1/health",
  "/api/v1/prices/live?symbols=BTCUSDT",
  "/api/v1/alarms",
  "/api/v1/signals/live",
  "/dashboard"
)
$apiResults = @()
foreach ($ep in $endpoints) {
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:$Port$ep" -UseBasicParsing -TimeoutSec 10
    $status = $resp.StatusCode
    Write-Host "  $status  $ep" -ForegroundColor Green
    $apiResults += [pscustomobject]@{ path=$ep; status=$status; result="PASS" }
  } catch {
    $status = $_.Exception.Response?.StatusCode.value__ ?? "ERR"
    Write-Host "  $status  $ep" -ForegroundColor Red
    $apiResults += [pscustomobject]@{ path=$ep; status=$status; result="FAIL" }
  }
}

# 6. Playwright smoke
Write-Host "`n--- Playwright Browser/Mobile Smoke ---" -ForegroundColor Yellow
$screenshotDir = Join-Path $RepoRoot "test-results\screenshots\phase3-browser-mobile-smoke"
New-Item -ItemType Directory -Force -Path $screenshotDir | Out-Null

$pwArgs = @("playwright", "test", "--config=playwright.config.ts")
if ($Project) { $pwArgs += "--project=$Project" }

$env:PLAYWRIGHT_BASE_URL = "http://localhost:$Port"
npx @pwArgs

# 7. Stop dev server
Write-Host "`n--- Stopping dev server ---" -ForegroundColor Yellow
Stop-Process -Id $devServer.Id -Force -ErrorAction SilentlyContinue

# 8. Summary
Write-Host "`n=== Done ===" -ForegroundColor Cyan
Write-Host "Screenshots: $screenshotDir"
Write-Host "API results:"
$apiResults | Format-Table -AutoSize

Pop-Location
