# AYC Global Market - Tüm Servisleri Başlat
# Kullanım: .\start-all.ps1

$ROOT = $PSScriptRoot
$VENV = "$ROOT\venv\Scripts"
$ENV_FILE = "$ROOT\.env"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AYC Global Market - Servis Başlatıcı" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# .env yükle
if (Test-Path $ENV_FILE) {
    Get-Content $ENV_FILE | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.+)$") {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
    Write-Host "✓ .env yüklendi" -ForegroundColor Green
}

$env:USE_INMEMORY_CACHE = "1"
$env:AI_SERVICE_URL = "http://localhost:8001"

# Portları temizle
foreach ($port in @(8001, 8002)) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Write-Host "  Port $port temizlendi" -ForegroundColor Yellow
    }
}

# AI-Service (8001)
Write-Host ""
Write-Host "▶ AI-Service başlatılıyor (port 8001)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$ROOT\services\ai-service'; $VENV\uvicorn.exe main:app --host 0.0.0.0 --port 8001"
) -WindowStyle Normal

Start-Sleep -Seconds 2

# Signal-Service (8002)
Write-Host "▶ Signal-Service başlatılıyor (port 8002)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$ROOT\services\signal-service'; $VENV\uvicorn.exe main:app --host 0.0.0.0 --port 8002"
) -WindowStyle Normal

Start-Sleep -Seconds 2

# Web (3000)
Write-Host "▶ Web App başlatılıyor (port 3000)..." -ForegroundColor Yellow
Start-Process -FilePath "powershell.exe" -ArgumentList @(
    "-NoExit", "-Command",
    "cd '$ROOT\apps\web'; npx next dev -p 3000"
) -WindowStyle Normal

Start-Sleep -Seconds 5

# Durum kontrolü
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Servis Durumları" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$checks = @(
    @{name="Gateway    :8000"; url="http://localhost:8000/health"},
    @{name="AI-Service :8001"; url="http://localhost:8001/health"},
    @{name="Signal-Svc :8002"; url="http://localhost:8002/health"},
    @{name="Web App    :3000"; url="http://localhost:3000"}
)

foreach ($c in $checks) {
    try {
        $r = Invoke-WebRequest $c.url -TimeoutSec 8 -UseBasicParsing
        Write-Host "  ✓ $($c.name) - HTTP $($r.StatusCode)" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ $($c.name) - Henüz hazır değil (normal)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Tarayıcıda aç: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""