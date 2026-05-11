#!/usr/bin/env bash
# ============================================================
# NEURA — Lokal Başlatma Scripti (macOS / Linux)
# ============================================================
# Kullanım: ./start-local.sh
# Ön koşullar: Docker Desktop, Node.js 20+, pnpm 9+, Python 3.11+

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SKIP_DOCKER=false
SKIP_INSTALL=false
SKIP_MIGRATIONS=false
WEB_ONLY=false

# Argümanları işle
for arg in "$@"; do
    case $arg in
        --skip-docker)     SKIP_DOCKER=true ;;
        --skip-install)    SKIP_INSTALL=true ;;
        --skip-migrations) SKIP_MIGRATIONS=true ;;
        --web-only)        WEB_ONLY=true; SKIP_DOCKER=true; SKIP_MIGRATIONS=true ;;
        --help|-h)
            echo "Kullanım: ./start-local.sh [SEÇENEKLER]"
            echo ""
            echo "  --skip-docker       Docker başlatmayı atla"
            echo "  --skip-install      pnpm install'ı atla"
            echo "  --skip-migrations   DB migration'larını atla"
            echo "  --web-only          Sadece web uygulamasını başlat"
            echo "  --help              Bu mesajı göster"
            exit 0
            ;;
    esac
done

# Renk kodları
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

step() { echo -e "\n${CYAN}[NEURA] $1${NC}"; }
ok()   { echo -e "  ${GREEN}OK${NC}  $1"; }
warn() { echo -e "  ${YELLOW}WARN${NC}  $1"; }
fail() { echo -e "  ${RED}FAIL${NC}  $1"; exit 1; }

# ── 1. Ön koşullar ──────────────────────────────────────────
step "Ön koşullar kontrol ediliyor..."

command -v docker &>/dev/null && ok "Docker" || fail "Docker bulunamadı. https://docs.docker.com/get-docker/"
command -v node   &>/dev/null && ok "Node.js" || fail "Node.js 20+ gerekli. https://nodejs.org/"
command -v pnpm   &>/dev/null && ok "pnpm"    || { warn "pnpm bulunamadı, kuruluyor..."; npm install -g pnpm; ok "pnpm kuruldu"; }

HAS_PYTHON=false
if command -v python3 &>/dev/null; then
    HAS_PYTHON=true; ok "Python"
elif command -v python &>/dev/null; then
    HAS_PYTHON=true; ok "Python"
else
    warn "Python bulunamadı — DB migration'ları atlanacak"
fi

PYTHON_CMD="python3"
command -v python3 &>/dev/null || PYTHON_CMD="python"

# ── 2. .env dosyası ─────────────────────────────────────────
step ".env dosyası kontrol ediliyor..."

if [ ! -f "$ROOT/.env" ]; then
    if [ -f "$ROOT/.env.example" ]; then
        cp "$ROOT/.env.example" "$ROOT/.env"
        ok ".env.example → .env kopyalandı"
        warn "Lütfen .env dosyasını açıp API key'lerinizi girin!"
        echo "  Zorunlu: OPENAI_API_KEY veya ANTHROPIC_API_KEY (AI özellikler için)"
    else
        fail ".env.example bulunamadı!"
    fi
else
    ok ".env mevcut"
fi

# ── 3. Docker Compose (PostgreSQL + Redis) ──────────────────
if [ "$SKIP_DOCKER" = false ] && [ "$WEB_ONLY" = false ]; then
    step "Docker Compose başlatılıyor (postgres + redis)..."
    COMPOSE_FILE="$ROOT/infra/docker-compose.yml"

    docker compose -f "$COMPOSE_FILE" up -d postgres redis
    ok "PostgreSQL + Redis başlatıldı"

    echo "  Veritabanı hazırlanıyor..."
    waited=0
    until docker exec neura_postgres pg_isready -U neura &>/dev/null; do
        sleep 2
        waited=$((waited + 2))
        if [ $waited -ge 30 ]; then
            warn "PostgreSQL 30s içinde hazır olmadı, devam ediliyor..."
            break
        fi
    done
    [ $waited -lt 30 ] && ok "PostgreSQL hazır (${waited}s)"
else
    ok "Docker başlatma atlandı"
fi

# ── 4. Bağımlılık kurulumu ──────────────────────────────────
if [ "$SKIP_INSTALL" = false ]; then
    step "Node bağımlılıkları kuruluyor..."
    cd "$ROOT"
    pnpm install
    ok "pnpm install tamamlandı"
else
    ok "pnpm install atlandı"
fi

# ── 5. DB Migration ─────────────────────────────────────────
if [ "$SKIP_MIGRATIONS" = false ] && [ "$WEB_ONLY" = false ] && [ "$HAS_PYTHON" = true ]; then
    step "Veritabanı migration'ları çalıştırılıyor..."
    cd "$ROOT"

    # virtualenv varsa aktifle
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
        ok "virtualenv aktif"
    fi

    # Alembic
    cd "$ROOT/infra"
    $PYTHON_CMD -m alembic upgrade head && ok "DB migration tamamlandı" || warn "Migration başarısız (ilk kurulumda normal)"

    # Seed
    cd "$ROOT"
    if [ -f "scripts/seed_assets.py" ]; then
        $PYTHON_CMD scripts/seed_assets.py && ok "Seed data yüklendi" || warn "Seed başarısız"
    fi
else
    ok "Migration atlandı"
fi

# ── 6. Web Uygulaması ────────────────────────────────────────
step "NEURA Web başlatılıyor..."
echo ""
echo -e "  URL: \033[35mhttp://localhost:3000\033[0m"
echo "  API: http://localhost:8000 (ayrı terminal ile servisleri başlatın)"
echo ""
echo "  Durdurmak için: Ctrl+C"
echo ""

cd "$ROOT"
pnpm --filter neura-web dev
