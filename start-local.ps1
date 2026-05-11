# ============================================================
# NEURA — Lokal Başlatma Scripti (Windows PowerShell)
# ============================================================
# Kullanım: .\start-local.ps1
# Ön koşullar: Docker Desktop, Node.js 20+, pnpm 9+, Python 3.11+

param(
    [switch]$SkipDocker,
    [switch]$SkipInstall,
    [switch]$SkipMigrations,
    [switch]$WebOnly,
    [switch]$Help
)

if ($Help) {
    Write-Host @"
NEURA Lokal Başlatma Scripti

Parametreler:
  -SkipDocker       Docker Compose'u atla (zaten çalışıyorsa)
  -SkipInstall      pnpm install'ı atla (paketler zaten kuruluysa)
  -SkipMigrations   DB migration'larını atla
  -WebOnly          Sadece web uygulamasını başlat
  -Help             Bu yardım mesajını göster

Örnek:
  .\start-local.ps1                    # Tam başlatma
  .\start-local.ps1 -SkipDocker        # Docker zaten çalışıyor
  .\start-local.ps1 -WebOnly -SkipDocker -SkipInstall
"@
    exit 0
}

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

function Write-Step { param($msg) Write-Host "`n[NEURA] $msg" -ForegroundColor Cyan }
function Write-OK   { param($msg) Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-WARN { param($msg) Write-Host "  WARN  $msg" -ForegroundColor Yellow }
function Write-FAIL { param($msg) Write-Host "  FAIL  $msg" -ForegroundColor Red }

# ── 1. Ön koşul kontrolleri ──────────────────────────────────
Write-Step "Ön koşullar kontrol ediliyor..."

$checks = @(
    @{ cmd = "docker --version"; name = "Docker" },
    @{ cmd = "node --version";   name = "Node.js" },
    @{ cmd = "pnpm --version";   name = "pnpm" }
)

foreach ($c in $checks) {
    try {
        $null = Invoke-Expression $c.cmd 2>&1
        Write-OK $c.name
    } catch {
        Write-FAIL "$($c.name) bulunamadı. Lütfen yükleyin."
        if ($c.name -eq "pnpm") {
            Write-Host "  pnpm kurmak için: npm install -g pnpm" -ForegroundColor Yellow
        }
        exit 1
    }
}

# Python isteğe bağlı (migration için)
$hasPython = $false
try {
    $null = python --version 2>&1
    $hasPython = $true
    Write-OK "Python"
} catch {
    Write-WARN "Python bulunamadı — DB migration'ları atlanacak"
}

# ── 2. .env dosyası ──────────────────────────────────────────
Write-Step ".env dosyası kontrol ediliyor..."

$envFile = Join-Path $Root ".env"
$envExample = Join-Path $Root ".env.example"

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-OK ".env.example → .env kopyalandı"
        Write-WARN "Lütfen .env dosyasını açıp API key'lerinizi girin!"
        Write-Host "  Zorunlu: OPENAI_API_KEY veya ANTHROPIC_API_KEY (AI özellikler için)" -ForegroundColor Yellow
    } else {
        Write-FAIL ".env.example bulunamadı!"
        exit 1
    }
} else {
    Write-OK ".env mevcut"
}

# ── 3. Docker Compose (PostgreSQL + Redis) ───────────────────
if (-not $SkipDocker -and -not $WebOnly) {
    Write-Step "Docker Compose başlatılıyor (postgres + redis)..."
    $composeFile = Join-Path $Root "infra\docker-compose.yml"

    try {
        # Sadece postgres ve redis başlat (Python servisleri ayrı)
        docker compose -f $composeFile up -d postgres redis
        Write-OK "PostgreSQL + Redis başlatıldı"

        # Sağlık kontrolü
        Write-Host "  Veritabanı hazırlanıyor..." -ForegroundColor DarkGray
        $maxWait = 30
        $waited = 0
        do {
            Start-Sleep 2
            $waited += 2
            $pgReady = docker exec neura_postgres pg_isready -U neura 2>&1
            if ($pgReady -like "*accepting*") { break }
        } while ($waited -lt $maxWait)

        if ($waited -ge $maxWait) {
            Write-WARN "PostgreSQL 30s içinde hazır olmadı, devam ediliyor..."
        } else {
            Write-OK "PostgreSQL hazır ($waited s)"
        }
    } catch {
        Write-FAIL "Docker Compose başlatılamadı: $_"
        Write-Host "  Docker Desktop çalışıyor mu?" -ForegroundColor Yellow
        exit 1
    }
} elseif ($SkipDocker -or $WebOnly) {
    Write-OK "Docker başlatma atlandı"
}

# ── 4. Bağımlılık kurulumu ───────────────────────────────────
if (-not $SkipInstall) {
    Write-Step "Node bağımlılıkları kuruluyor (pnpm install)..."
    Set-Location $Root
    try {
        pnpm install
        Write-OK "pnpm install tamamlandı"
    } catch {
        Write-FAIL "pnpm install başarısız: $_"
        exit 1
    }
} else {
    Write-OK "pnpm install atlandı"
}

# ── 5. DB Migration ──────────────────────────────────────────
if (-not $SkipMigrations -and -not $WebOnly -and $hasPython) {
    Write-Step "Veritabanı migration'ları çalıştırılıyor..."
    Set-Location $Root
    try {
        # virtualenv varsa aktifle
        $venvActivate = Join-Path $Root "venv\Scripts\Activate.ps1"
        if (Test-Path $venvActivate) {
            & $venvActivate
            Write-OK "virtualenv aktif"
        }

        # Alembic migration
        $infraPath = Join-Path $Root "infra"
        Set-Location $infraPath
        python -m alembic upgrade head
        Write-OK "DB migration tamamlandı"

        # Seed
        Set-Location $Root
        $seedScript = Join-Path $Root "scripts\seed_assets.py"
        if (Test-Path $seedScript) {
            python $seedScript
            Write-OK "Seed data yüklendi"
        }
    } catch {
        Write-WARN "Migration başarısız (ilk kurulumda normal olabilir): $_"
    }
    Set-Location $Root
} else {
    Write-OK "Migration atlandı"
}

# ── 6. Web Uygulaması Başlat ─────────────────────────────────
Write-Step "NEURA Web başlatılıyor..."
Write-Host ""
Write-Host "  URL: http://localhost:3000" -ForegroundColor Magenta
Write-Host "  API: http://localhost:8000 (ayrı terminal ile servisleri başlatın)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Durdurmak için: Ctrl+C" -ForegroundColor DarkGray
Write-Host ""

Set-Location $Root

try {
    # Sadece web uygulamasını başlat
    pnpm --filter neura-web dev
} catch {
    Write-FAIL "Web başlatılamadı: $_"
    Write-Host ""
    Write-Host "Manuel başlatma:" -ForegroundColor Yellow
    Write-Host "  cd apps/web && pnpm dev" -ForegroundColor White
    exit 1
}
