[CmdletBinding()]
param()

$RepoPath = Join-Path $env:USERPROFILE "Desktop\NEURA"
if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "Repo path not found: $RepoPath"
}
if ($RepoPath -match "OneDrive") {
  throw "OneDrive path is forbidden: $RepoPath"
}

Set-Location $RepoPath

$testResultsPath = Join-Path $RepoPath "test-results"
$playwrightJsonPath = Join-Path $testResultsPath "playwright-results.json"
$playwrightHtmlPath = Join-Path $RepoPath "playwright-report"
$screenshotsPath = Join-Path $testResultsPath "screenshots"
$tracesPath = Join-Path $testResultsPath "playwright-output"
$localAutomationRoot = Join-Path $testResultsPath "local-automation"

$latestAutomationPath = "<none>"
if (Test-Path -LiteralPath $localAutomationRoot) {
  $latest = Get-ChildItem -LiteralPath $localAutomationRoot -Directory | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if ($null -ne $latest) {
    $latestAutomationPath = $latest.FullName
  }
}

Write-Host "Playwright report path (json): $playwrightJsonPath"
Write-Host "Playwright report path (html dir): $playwrightHtmlPath"
Write-Host "test-results path: $testResultsPath"
Write-Host "screenshots path: $screenshotsPath"
Write-Host "traces path: $tracesPath"
Write-Host "local automation log path: $latestAutomationPath"
