[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$RepoPath = Join-Path $env:USERPROFILE "Desktop\NEURA"
if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "Repo path not found: $RepoPath"
}
if ($RepoPath -match "OneDrive") {
  throw "OneDrive path is forbidden: $RepoPath"
}

Set-Location $RepoPath

$ExpectedBranch = "fix/live-data-truth-mobile-shell"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$LogDir = Join-Path $RepoPath "test-results/local-automation/$Timestamp"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

$SummaryPath = Join-Path $LogDir "summary.txt"
$GitStatusBeforePath = Join-Path $LogDir "git-status-before.txt"
$GitStatusAfterPath = Join-Path $LogDir "git-status-after.txt"

function Add-SummaryLine {
  param([string]$Line)
  $Line | Tee-Object -FilePath $SummaryPath -Append | Out-Null
}

function Invoke-LoggedStep {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string]$LogFile
  )

  $LogPath = Join-Path $LogDir $LogFile
  "COMMAND: $Command" | Out-File -LiteralPath $LogPath -Encoding utf8

  $tmpOut = Join-Path $LogDir ([System.IO.Path]::GetRandomFileName() + ".stdout")
  $tmpErr = Join-Path $LogDir ([System.IO.Path]::GetRandomFileName() + ".stderr")

  $proc = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command) `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $tmpOut `
    -RedirectStandardError $tmpErr

  if (Test-Path -LiteralPath $tmpOut) {
    Get-Content -LiteralPath $tmpOut | Tee-Object -FilePath $LogPath -Append | Out-Null
    Remove-Item -LiteralPath $tmpOut -Force
  }
  if (Test-Path -LiteralPath $tmpErr) {
    Get-Content -LiteralPath $tmpErr | Tee-Object -FilePath $LogPath -Append | Out-Null
    Remove-Item -LiteralPath $tmpErr -Force
  }

  $ExitCode = $proc.ExitCode

  "EXIT_CODE: $ExitCode" | Tee-Object -FilePath $LogPath -Append | Out-Null
  return $ExitCode
}

$branch = (git branch --show-current).Trim()
$head = (git rev-parse --short HEAD).Trim()

(git status --short) | Out-File -LiteralPath $GitStatusBeforePath -Encoding utf8

Add-SummaryLine "RepoPath: $RepoPath"
Add-SummaryLine "Timestamp: $Timestamp"
Add-SummaryLine "Branch: $branch"
Add-SummaryLine "Head: $head"

if ($branch -ne $ExpectedBranch) {
  Add-SummaryLine "BRANCH_CHECK: FAIL (expected $ExpectedBranch)"
  Add-SummaryLine "INSTALL_FAIL"
  Add-SummaryLine "TYPECHECK_FAIL"
  Add-SummaryLine "LINT_FAIL"
  Add-SummaryLine "BUILD_FAIL"
  Add-SummaryLine "BROWSER_FAIL"
  (git status --short) | Out-File -LiteralPath $GitStatusAfterPath -Encoding utf8
  Write-Host "INSTALL_FAIL"
  Write-Host "TYPECHECK_FAIL"
  Write-Host "LINT_FAIL"
  Write-Host "BUILD_FAIL"
  Write-Host "BROWSER_FAIL"
  Write-Host "LogPath: $LogDir"
  exit 2
}

$installExit = Invoke-LoggedStep -DisplayName "pnpm install" -Command "pnpm install" -LogFile "install.log"
$typecheckExit = Invoke-LoggedStep -DisplayName "pnpm type-check" -Command "pnpm type-check" -LogFile "type-check.log"
$lintExit = Invoke-LoggedStep -DisplayName "pnpm lint" -Command "pnpm lint" -LogFile "lint.log"
$buildExit = Invoke-LoggedStep -DisplayName "pnpm build" -Command "pnpm build" -LogFile "build.log"
$pwInstallExit = Invoke-LoggedStep -DisplayName "npx playwright install chromium" -Command "npx playwright install chromium" -LogFile "playwright-install.log"
$browserExit = Invoke-LoggedStep -DisplayName "pnpm test:browser" -Command "pnpm test:browser" -LogFile "test-browser.log"

(git status --short) | Out-File -LiteralPath $GitStatusAfterPath -Encoding utf8

$installStatus = if ($installExit -eq 0) { "INSTALL_PASS" } else { "INSTALL_FAIL" }
$typecheckStatus = if ($typecheckExit -eq 0) { "TYPECHECK_PASS" } else { "TYPECHECK_FAIL" }
$lintStatus = if ($lintExit -eq 0) { "LINT_PASS" } else { "LINT_FAIL" }
$buildStatus = if ($buildExit -eq 0) { "BUILD_PASS" } else { "BUILD_FAIL" }
$browserStatus = if ($browserExit -eq 0) { "BROWSER_PASS" } else { "BROWSER_FAIL" }

Add-SummaryLine $installStatus
Add-SummaryLine $typecheckStatus
Add-SummaryLine $lintStatus
Add-SummaryLine $buildStatus
Add-SummaryLine $browserStatus
Add-SummaryLine "LogPath: $LogDir"

Write-Host $installStatus
Write-Host $typecheckStatus
Write-Host $lintStatus
Write-Host $buildStatus
Write-Host $browserStatus
Write-Host "LogPath: $LogDir"

if ($installExit -ne 0 -or $typecheckExit -ne 0 -or $lintExit -ne 0 -or $buildExit -ne 0 -or $pwInstallExit -ne 0 -or $browserExit -ne 0) {
  exit 1
}

exit 0
