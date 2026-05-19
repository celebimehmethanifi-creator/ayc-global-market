[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$RepoPath = if ([string]::IsNullOrWhiteSpace($env:AYC_REPO_PATH)) {
  Join-Path $env:USERPROFILE "Desktop\NEURA"
} else {
  $env:AYC_REPO_PATH
}
if (-not (Test-Path -LiteralPath $RepoPath)) {
  throw "Repo path not found: $RepoPath"
}
if ($RepoPath -match "OneDrive") {
  throw "OneDrive path is forbidden: $RepoPath"
}

Set-Location $RepoPath

$branch = (git branch --show-current).Trim()
if ($branch -ne "fix/live-data-truth-mobile-shell" -and $branch -ne "sync/fix-live-data-truth-mobile-shell") {
  throw "Unexpected branch: $branch"
}

function Resolve-SecretEnv {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not [string]::IsNullOrWhiteSpace((Get-Item "env:$Name" -ErrorAction SilentlyContinue).Value)) {
    return
  }
  $userValue = [Environment]::GetEnvironmentVariable($Name, "User")
  if (-not [string]::IsNullOrWhiteSpace($userValue)) {
    Set-Item -Path "env:$Name" -Value $userValue
    return
  }
  $machineValue = [Environment]::GetEnvironmentVariable($Name, "Machine")
  if (-not [string]::IsNullOrWhiteSpace($machineValue)) {
    Set-Item -Path "env:$Name" -Value $machineValue
    return
  }
}

Resolve-SecretEnv -Name "BROWSERSTACK_USERNAME"
Resolve-SecretEnv -Name "BROWSERSTACK_ACCESS_KEY"

function Normalize-SecretValue {
  param([string]$Value)
  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $Value
  }
  $v = $Value.Trim()
  if ($v.Length -ge 2 -and $v.StartsWith("<") -and $v.EndsWith(">")) {
    $v = $v.Substring(1, $v.Length - 2).Trim()
  }
  if ($v.Length -ge 2 -and (($v.StartsWith("'") -and $v.EndsWith("'")) -or ($v.StartsWith('\"') -and $v.EndsWith('\"')))) {
    $v = $v.Substring(1, $v.Length - 2).Trim()
  }
  return $v
}

$env:BROWSERSTACK_USERNAME = Normalize-SecretValue -Value $env:BROWSERSTACK_USERNAME
$env:BROWSERSTACK_ACCESS_KEY = Normalize-SecretValue -Value $env:BROWSERSTACK_ACCESS_KEY

$hasUser = -not [string]::IsNullOrWhiteSpace($env:BROWSERSTACK_USERNAME)
$hasKey = -not [string]::IsNullOrWhiteSpace($env:BROWSERSTACK_ACCESS_KEY)
Write-Host "BROWSERSTACK_USERNAME_PRESENT=$hasUser"
Write-Host "BROWSERSTACK_ACCESS_KEY_PRESENT=$hasKey"

if (-not $hasUser -or -not $hasKey) {
  exit 2
}

function Test-BrowserStackCredentials {
  param(
    [Parameter(Mandatory = $true)][string]$Username,
    [Parameter(Mandatory = $true)][string]$AccessKey
  )

  $pair = "${Username}:${AccessKey}"
  $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes($pair))
  $headers = @{ Authorization = "Basic $basic" }

  try {
    $response = Invoke-WebRequest `
      -Uri "https://api.browserstack.com/automate/plan.json" `
      -Headers $headers `
      -Method GET `
      -TimeoutSec 30
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 300
  } catch {
    return $false
  }
}

if (-not (Test-BrowserStackCredentials -Username $env:BROWSERSTACK_USERNAME -AccessKey $env:BROWSERSTACK_ACCESS_KEY)) {
  Write-Host "BROWSERSTACK_CREDENTIALS_VALID=false"
  Write-Host "BrowserStack credentials failed API authentication. Update BROWSERSTACK_USERNAME/BROWSERSTACK_ACCESS_KEY."
  exit 3
}

Write-Host "BROWSERSTACK_CREDENTIALS_VALID=true"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$artifactRoot = Join-Path $RepoPath "test-results/browserstack-real-device/$timestamp"
New-Item -ItemType Directory -Path $artifactRoot -Force | Out-Null

$env:BROWSERSTACK_ARTIFACT_ROOT = $artifactRoot
$env:BROWSERSTACK_BUILD_NAME = "phase3-real-device-$timestamp"

$testedUrl = if ([string]::IsNullOrWhiteSpace($env:BROWSERSTACK_TEST_URL)) { "http://bs-local.com:3093" } else { $env:BROWSERSTACK_TEST_URL }
$useLocal = $testedUrl -match "^https?://(localhost|127\.0\.0\.1|bs-local\.com)(:\d+)?(/|$)"
$localIdentifier = "ayc-local-$timestamp"
$env:BROWSERSTACK_LOCAL_IDENTIFIER = $localIdentifier
$env:BROWSERSTACK_TEST_URL = $testedUrl

$testedUrl | Out-File -FilePath (Join-Path $artifactRoot "tested-url.txt") -Encoding utf8

$deviceMatrix = @(
  @{ name = "real-iphone-safari"; browser = "safari"; device = "iPhone 15"; osVersion = "17" },
  @{ name = "real-android-chrome"; browser = "chrome"; device = "Samsung Galaxy S23"; osVersion = "13.0" }
)
$deviceMatrix | ConvertTo-Json -Depth 10 | Out-File -FilePath (Join-Path $artifactRoot "device-matrix.json") -Encoding utf8

function Invoke-LoggedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string]$LogFile
  )

  $logPath = Join-Path $artifactRoot $LogFile
  "COMMAND: $Command" | Out-File -FilePath $logPath -Encoding utf8

  $tmpOut = Join-Path $artifactRoot ([System.IO.Path]::GetRandomFileName() + ".stdout")
  $tmpErr = Join-Path $artifactRoot ([System.IO.Path]::GetRandomFileName() + ".stderr")

  $proc = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command) `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $tmpOut `
    -RedirectStandardError $tmpErr

  if (Test-Path -LiteralPath $tmpOut) {
    Get-Content -LiteralPath $tmpOut | Tee-Object -FilePath $logPath -Append | Out-Null
    Remove-Item -LiteralPath $tmpOut -Force
  }
  if (Test-Path -LiteralPath $tmpErr) {
    Get-Content -LiteralPath $tmpErr | Tee-Object -FilePath $logPath -Append | Out-Null
    Remove-Item -LiteralPath $tmpErr -Force
  }

  "EXIT_CODE: $($proc.ExitCode)" | Tee-Object -FilePath $logPath -Append | Out-Null
  return $proc.ExitCode
}

$serverProc = $null
$localDaemonProc = $null
$browserstackExit = 1

try {
  if ($useLocal) {
    $portReady = $false
    try {
      $portReady = Test-NetConnection -ComputerName 127.0.0.1 -Port 3093 -InformationLevel Quiet
    } catch {
      $portReady = $false
    }

    if (-not $portReady) {
      if (-not (Test-Path -LiteralPath "apps/web/.next/BUILD_ID")) {
        $buildExit = Invoke-LoggedCommand -Command "pnpm --filter neura-web run build" -LogFile "local-next-build.log"
        if ($buildExit -ne 0) {
          throw "Local Next.js build failed with exit code $buildExit"
        }
      }

      $serverOut = Join-Path $artifactRoot "local-server.out.log"
      $serverErr = Join-Path $artifactRoot "local-server.err.log"
      $serverCommand = "Set-Location '$RepoPath'; pnpm --filter neura-web exec next start --hostname 0.0.0.0 --port 3093"
      $serverProc = Start-Process `
        -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $serverCommand) `
        -WindowStyle Hidden `
        -PassThru `
        -RedirectStandardOutput $serverOut `
        -RedirectStandardError $serverErr

      $ready = $false
      for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Milliseconds 1000
        try {
          $tcpReady = Test-NetConnection -ComputerName 127.0.0.1 -Port 3093 -InformationLevel Quiet
          if ($tcpReady) {
            $ready = $true
            break
          }
        } catch {
          # keep waiting
        }
        if ($serverProc.HasExited) {
          break
        }
      }
    if (-not $ready) {
        throw "Local server did not become reachable on port 3093"
      }
    }

    # Clean stale BrowserStackLocal processes that can lock the local binary on Windows.
    Get-Process -Name "BrowserStackLocal" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    $daemonOut = Join-Path $artifactRoot "browserstack-local.log"
    $daemonErr = Join-Path $artifactRoot "browserstack-local.err.log"
    $daemonCommand = "Set-Location '$RepoPath'; node scripts/browserstack-local-daemon.js"
    $localDaemonProc = Start-Process `
      -FilePath "powershell.exe" `
      -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $daemonCommand) `
      -WindowStyle Hidden `
      -PassThru `
      -RedirectStandardOutput $daemonOut `
      -RedirectStandardError $daemonErr

    $daemonReady = $false
    for ($i = 0; $i -lt 90; $i++) {
      Start-Sleep -Milliseconds 1000
      if ($localDaemonProc.HasExited) {
        break
      }
      if (Test-Path -LiteralPath $daemonOut) {
        $content = Get-Content -LiteralPath $daemonOut -Raw -ErrorAction SilentlyContinue
        if ($content -match "BROWSERSTACK_LOCAL_STARTED") {
          $daemonReady = $true
          break
        }
      }
    }
    if (-not $daemonReady) {
      throw "BrowserStack Local daemon did not start"
    }
  }

  $browserstackExit = Invoke-LoggedCommand -Command "pnpm test:browserstack" -LogFile "test-browserstack.log"

  $summaryPath = Join-Path $artifactRoot "browserstack-summary.json"
  $sessionLinksPath = Join-Path $artifactRoot "session-links.md"
  if (Test-Path -LiteralPath $summaryPath) {
    $summary = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json
    @(
      "# BrowserStack Sessions",
      "",
      "- Build name: $($env:BROWSERSTACK_BUILD_NAME)",
      "- Dashboard: https://automate.browserstack.com/dashboard",
      "- Expected(passed): $($summary.stats.expected)",
      "- Unexpected(failed): $($summary.stats.unexpected)",
      "- Skipped: $($summary.stats.skipped)",
      "- Flaky: $($summary.stats.flaky)"
    ) | Out-File -FilePath $sessionLinksPath -Encoding utf8
  } else {
    @(
      "# BrowserStack Sessions",
      "",
      "No summary JSON found. Check test-browserstack.log."
    ) | Out-File -FilePath $sessionLinksPath -Encoding utf8
  }
}
finally {
  if ($null -ne $localDaemonProc -and -not $localDaemonProc.HasExited) {
    Stop-Process -Id $localDaemonProc.Id -Force -ErrorAction SilentlyContinue
  }

  if ($null -ne $serverProc -and -not $serverProc.HasExited) {
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
  }
}

if ($browserstackExit -ne 0) {
  Write-Host "BROWSERSTACK_PASS=false"
  Write-Host "ARTIFACT_PATH=$artifactRoot"
  exit 1
}

Write-Host "BROWSERSTACK_PASS=true"
Write-Host "ARTIFACT_PATH=$artifactRoot"
exit 0
