# AYC Global Market - Backend Deploy Script
# KULLANIM: $env:RAILWAY_TOKEN = "tokenin"; .\deploy-backend.ps1

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
    "DATABASE_URL=sqlite:///./ayc_market.db",
    "SECRET_KEY=ayc-prod-$(New-Guid)-secret",
    "FRONTEND_URL=https://aycmarket.com",
    "CORS_ORIGINS=https://aycmarket.com,https://www.aycmarket.com,https://web-nine-fawn-33.vercel.app,http://localhost:3000",
    "FINNHUB_API_KEY=d7pp429r01qosaapdudgd7pp429r01qosaapdue0",
    "TWELVEDATA_API_KEY=c6293bae084a4c0fb46e2cb5df525ef8",
    "ALPHAVANTAGE_API_KEY=63T2IM69L6OSSR51",
    "BYBIT_API_KEY=91kDqh3JRJzn3xTl43",
    "BYBIT_SECRET=hfNpUJGn5RGt5Hmx0IHY8cnfece9ZtQXBENk",
    "OKX_API_KEY=099328fb-0c26-44b7-af52-059407dd9949",
    "OKX_SECRET=A1EA36997142F5F76EEEAABC88E22604",
    "OKX_PASSPHRASE=TradeGPT_2026_secure",
    "COINGLASS_API_KEY=b88252135cff44748469d9fa6841e1f2",
    "CRYPTOQUANT_API_KEY=Qd07P8UImVlQhs7FjuTKCMPGdnIrglxtH4i8MkEg2gkcg3L9ZnVehyeCny5zi9OlrKEJ154",
    "FMP_API_KEY=nJNYTTBAWGupP7ZAXz5Mh5hVOskZgxwU",
    "FRED_API_KEY=dd6f72e0842c8a13b4b3256b56138463",
    "NEWSAPI_KEY=c8c10ec84736411da833d7ee21bfadd4",
    "MARKETAUX_API_KEY=QBZXKrTm7brvylma26KC14zmnbLmwD333TEyfgux",
    "OPENAI_API_KEY=YOUR_OPENAI_API_KEY_HERE",
    "ANTHROPIC_API_KEY=YOUR_ANTHROPIC_API_KEY_HERE",
    "GOOGLE_API_KEY=YOUR_GOOGLE_API_KEY_HERE",
    "COINMARKETCAP_API_KEY=0bf380a7619b417fa1ad2309d6f086fc",
    "COINGECKO_API_KEY=CG-MoxLLAjSA3r2JHXanw9fotD5",
    "SANTIMENT_API_KEY=mvbvasrizi7t7aya_lqxgl46fsgpp7pvo",
    "TCMB_EVDS_API_KEY=bnlRSJ9cbN",
    "DUNE_API_KEY=F6joMEZUXrVlDsTpuEIObEPTVYAM8iq6"
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
Write-Host "SON ADIM: Vercel'de NEXT_PUBLIC_API_URL guncelle:" -ForegroundColor Yellow
Write-Host "cd ..\..\apps\web"
Write-Host "echo 'https://RAILWAY_URL_BURAYA' | npx vercel env add NEXT_PUBLIC_API_URL production --force"
Write-Host "npx vercel --prod --yes"
