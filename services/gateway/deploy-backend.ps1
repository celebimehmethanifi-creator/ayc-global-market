# AYC Global Market - Backend Deploy Script
# KULLANIM:
#   $env:RAILWAY_TOKEN = "<token>"
#   .\deploy-backend.ps1

param([string]$Token = $env:RAILWAY_TOKEN)

if (-not $Token) {
    Write-Host "HATA: RAILWAY_TOKEN gerekli" -ForegroundColor Red
    Write-Host 'Kullanim: $env:RAILWAY_TOKEN = "TOKEN_BURAYA"; .\deploy-backend.ps1'
    exit 1
}

$env:RAILWAY_TOKEN = $Token

Write-Host "=== AYC Backend Deploy ===" -ForegroundColor Cyan
railway whoami

$vars = @(
    "ENVIRONMENT=production",
    "DATABASE_URL=<set-in-railway-or-managed-postgres>",
    "SECRET_KEY=<min-32-char-random-secret>",
    "FRONTEND_URL=<https://app.example.com>",
    "CORS_ORIGINS=<https://app.example.com,https://www.app.example.com>",
    "FINNHUB_API_KEY=<provider-key>",
    "TWELVEDATA_API_KEY=<provider-key>",
    "ALPHAVANTAGE_API_KEY=<provider-key>",
    "BYBIT_API_KEY=<provider-key>",
    "BYBIT_SECRET=<provider-secret>",
    "OKX_API_KEY=<provider-key>",
    "OKX_SECRET=<provider-secret>",
    "OKX_PASSPHRASE=<provider-passphrase>",
    "COINGLASS_API_KEY=<provider-key>",
    "CRYPTOQUANT_API_KEY=<provider-key>",
    "FMP_API_KEY=<provider-key>",
    "FRED_API_KEY=<provider-key>",
    "NEWSAPI_KEY=<provider-key>",
    "MARKETAUX_API_KEY=<provider-key>",
    "OPENAI_API_KEY=<provider-key>",
    "ANTHROPIC_API_KEY=<provider-key>",
    "GOOGLE_API_KEY=<provider-key>",
    "COINMARKETCAP_API_KEY=<provider-key>",
    "COINGECKO_API_KEY=<provider-key>",
    "SANTIMENT_API_KEY=<provider-key>",
    "TCMB_EVDS_API_KEY=<provider-key>",
    "DUNE_API_KEY=<provider-key>",
    "STRIPE_SECRET_KEY=<provider-key>",
    "STRIPE_WEBHOOK_SECRET=<provider-secret>",
    "LEMON_API_KEY=<provider-key>",
    "LEMON_WEBHOOK_SECRET=<provider-secret>",
    "LEMON_STORE_ID=<provider-store-id>",
    "LEMON_VARIANT_PRO=<provider-variant-id>",
    "LEMON_VARIANT_ELITE=<provider-variant-id>"
)

Write-Host "[2/3] Env variables yukleniyor ($($vars.Count) adet)..." -ForegroundColor Yellow
railway variables set @vars 2>&1

Write-Host "[3/3] Deploy ediliyor..." -ForegroundColor Yellow
railway up --detach 2>&1

Write-Host ""
Write-Host "Deploy tamam! Railway URL:" -ForegroundColor Green
$domain = railway domain 2>&1
Write-Host $domain -ForegroundColor Cyan
Write-Host ""
Write-Host "SON ADIM: Vercel'de NEXT_PUBLIC_API_URL guncelle" -ForegroundColor Yellow
Write-Host "cd ..\..\apps\web"
Write-Host "echo 'https://RAILWAY_URL_BURAYA' | npx vercel env add NEXT_PUBLIC_API_URL production --force"
Write-Host "npx vercel --prod --yes"
