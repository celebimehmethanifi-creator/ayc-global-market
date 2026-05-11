<#
.SYNOPSIS
  AYC Global Market - Tam Sistem Baslatici
  Gateway:8000 | AI-Service:8001 | Signal-Service:8002 | Web:3000
#>

param(
  [switch]$Stop,
  [switch]$Status
)

$ROOT   = $PSScriptRoot
$VENV   = "C:\n\venv\Scripts\python.exe"
$NEXT   = "$ROOT\node_modules\.pnpm\next@14.2.3_react-dom@18.3.1_react@18.3.1__react@18.3.1\node_modules\next\dist\bin\next"
$PIDFILE = "$ROOT\.logs\pids.txt"
$LOGDIR  = "$ROOT\.logs"

# ---------- renk yardimcilari ----------
function Info  ($m) { Write-Host "  $m"         -ForegroundColor Cyan    }
function OK    ($m) { Write-Host "  [OK] $m"    -ForegroundColor Green   }
function WARN  ($m) { Write-Host "  [!!] $m"    -ForegroundColor Yellow  }
function ERR   ($m) { Write-Host "  [XX] $m"    -ForegroundColor Red     }
function TITLE ($m) { Write-Host "`n$m" -ForegroundColor White }

# ---------- STOP modu ----------
if ($Stop) {
  TITLE "== AYC Global Market - Servisleri Durduruyor =="
  if (Test-Path $PIDFILE) {
    Get-Content $PIDFILE | ForEach-Object {
      $pid_ = $_.Trim()
      if ($pid_ -match '^\d+$') {
        try { Stop-Process -Id $pid_ -Force -ErrorAction Stop; OK "PID $pid_ durduruldu" }
        catch { WARN "PID $pid_ zaten durmus veya bulunamadi" }
      }
    }
    Remove-Item $PIDFILE -Force
  } else { WARN "PID dosyasi bulunamadi (.logs\pids.txt)" }

  # port bazli fallback
  @(3000,8000,8001,8002) | ForEach-Object {
    $port = $_
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
      $conn | ForEach-Object {
        try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        catch {}
      }
      OK "Port $port temizlendi"
    }
  }
  Write-Host "`n  Tum servisler durduruldu." -ForegroundColor Green
  exit 0
}

# ---------- STATUS modu ----------
if ($Status) {
  TITLE "== AYC Global Market - Servis Durumu =="
  @(
    @{port=8000; name="Gateway      "; url="http://localhost:8000/health"},
    @{port=8001; name="AI-Service   "; url="http://localhost:8001/health"},
    @{port=8002; name="Signal-Svc   "; url="http://localhost:8002/health"},
    @{port=3000; name="Web App      "; url="http://localhost:3000"}
  ) | ForEach-Object {
    $svc = $_
    $conn = Get-NetTCPConnection -LocalPort $svc.port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
      try {
        $r = Invoke-WebRequest $svc.url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        OK "$($svc.name) :$($svc.port)  HTTP $($r.StatusCode)"
      } catch { WARN "$($svc.name) :$($svc.port)  Port acik ama HTTP yanit yok" }
    } else { ERR "$($svc.name) :$($svc.port)  KAPALI" }
  }
  exit 0
}

# =========================================================
# BASLATMA
# =========================================================

TITLE "╔══════════════════════════════════════════╗"
TITLE "║      AYC Global Market  -  Baslatici     ║"
TITLE "╚══════════════════════════════════════════╝"

# Log dizini
if (!(Test-Path $LOGDIR)) { New-Item -ItemType Directory -Path $LOGDIR | Out-Null }
# PID dosyasini sifirla
"" | Set-Content $PIDFILE

# .env yukle
$envFile = "$ROOT\.env"
if (Test-Path $envFile) {
  Get-Content $envFile | Where-Object { $_ -match '^\s*[^#].*=.*' } | ForEach-Object {
    $parts = $_ -split '=', 2
    if ($parts.Count -eq 2) {
      $k = $parts[0].Trim(); $v = $parts[1].Trim()
      [System.Environment]::SetEnvironmentVariable($k, $v, "Process")
    }
  }
  OK ".env yuklendi"
} else { WARN ".env bulunamadi, devam ediliyor" }

# Python venv kontrol
if (!(Test-Path $VENV)) {
  ERR "Python venv bulunamadi: $VENV"
  ERR "Once setup-venv.ps1 calistirin."
  exit 1
}
OK "Python venv bulundu: $VENV"

# Next.js binary kontrol
if (!(Test-Path $NEXT)) {
  ERR "Next.js bulunamadi: $NEXT"
  ERR "pnpm install --filter neura-web calistirin."
  exit 1
}
OK "Next.js bulundu"

# ---------- servis baslatma fonksiyonu ----------
function Start-Service ($name, $port, $cmd, $workdir, $logfile) {
  TITLE "-- $name baslatiliyor (port $port) --"

  # eski proses varsa temizle
  $old = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($old) {
    $old | ForEach-Object {
      try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {}
    }
    Start-Sleep 1
    OK "Port $port temizlendi"
  }

  $proc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-Command", "cd '$workdir'; $cmd *> '$logfile' 2>&1" `
    -WindowStyle Hidden `
    -PassThru

  Add-Content $PIDFILE $proc.Id
  Info "PID: $($proc.Id) | Log: $logfile"
}

# ---------- 1. Gateway :8000 ----------
Start-Service `
  "Gateway" 8000 `
  "& '$VENV' -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload" `
  "$ROOT\services\gateway" `
  "$LOGDIR\gateway.log"

# ---------- 2. AI-Service :8001 ----------
Start-Service `
  "AI-Service" 8001 `
  "& '$VENV' -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload" `
  "$ROOT\services\ai-service" `
  "$LOGDIR\ai-service.log"

# ---------- 3. Signal-Service :8002 ----------
Start-Service `
  "Signal-Service" 8002 `
  "& '$VENV' -m uvicorn main:app --host 0.0.0.0 --port 8002 --reload" `
  "$ROOT\services\signal-service" `
  "$LOGDIR\signal-service.log"

# ---------- 4. Web App :3000 ----------
TITLE "-- Web App baslatiliyor (port 3000) --"
$old3000 = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($old3000) {
  $old3000 | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } catch {} }
  Start-Sleep 1
  OK "Port 3000 temizlendi"
}
$webProc = Start-Process -FilePath "node.exe" `
  -ArgumentList "$NEXT", "dev" `
  -WorkingDirectory "$ROOT\apps\web" `
  -WindowStyle Hidden `
  -PassThru
Add-Content $PIDFILE $webProc.Id
Info "PID: $($webProc.Id) | Log: $LOGDIR\web.log"

# ---------- saglik kontrolu ----------
TITLE "-- Servisler hazir olana kadar bekleniyor --"
$services = @(
  @{name="Gateway";     url="http://localhost:8000/health"; port=8000},
  @{name="AI-Service";  url="http://localhost:8001/health"; port=8001},
  @{name="Signal-Svc";  url="http://localhost:8002/health"; port=8002},
  @{name="Web App";     url="http://localhost:3000";        port=3000}
)

foreach ($svc in $services) {
  $ok = $false
  for ($i = 1; $i -le 20; $i++) {
    Start-Sleep 2
    try {
      $r = Invoke-WebRequest $svc.url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
      if ($r.StatusCode -lt 400) { OK "$($svc.name) hazir  (HTTP $($r.StatusCode))"; $ok = $true; break }
    } catch {}
    Write-Host "  Bekleniyor: $($svc.name) [$i/20]..." -ForegroundColor DarkGray
  }
  if (!$ok) { WARN "$($svc.name) 40 saniyede yanit vermedi. Log: $LOGDIR\$($svc.name.ToLower() -replace '-service','').log" }
}

# ---------- ozet ----------
TITLE "╔══════════════════════════════════════════╗"
TITLE "║          SISTEM DURUMU OZETI             ║"
TITLE "╚══════════════════════════════════════════╝"
Write-Host ""
Write-Host "  Web Arayuzu   ->  http://localhost:3000"      -ForegroundColor Cyan
Write-Host "  API Gateway   ->  http://localhost:8000"      -ForegroundColor Cyan
Write-Host "  API Docs      ->  http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "  AI Service    ->  http://localhost:8001"      -ForegroundColor Cyan
Write-Host "  Signal Svc    ->  http://localhost:8002"      -ForegroundColor Cyan
Write-Host ""
Write-Host "  Durdurmak icin  : .\start-native.ps1 -Stop"  -ForegroundColor Yellow
Write-Host "  Durum kontrolu  : .\start-native.ps1 -Status" -ForegroundColor Yellow
Write-Host "  Log dizini      : $LOGDIR"                    -ForegroundColor DarkGray
Write-Host ""