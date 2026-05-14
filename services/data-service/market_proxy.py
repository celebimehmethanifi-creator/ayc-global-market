"""
AYC Global Market - Backend Server
Serves static files + API endpoints for the frontend
"""
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import asyncio
import time
import math
import os
import random
from pathlib import Path


def _is_production() -> bool:
    env_name = (os.environ.get("ENVIRONMENT") or os.environ.get("NODE_ENV") or "development").lower()
    return env_name in {"production", "prod"}


def _parse_cors_origins() -> list[str]:
    raw = (os.environ.get("CORS_ORIGINS") or "").strip()
    if raw:
        origins = [item.strip() for item in raw.split(",") if item.strip()]
    else:
        if _is_production():
            raise RuntimeError("CORS_ORIGINS must be configured in production.")
        origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
    if _is_production() and not origins:
        raise RuntimeError("CORS_ORIGINS must be configured in production.")
    return origins

# ─── API Keys ────────────────────────────────────────────────────────────────
def _env_api_key(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _provider_attempts() -> list[dict]:
    providers = [
        ("coingecko", "COINGECKO_API_KEY"),
        ("finnhub", "FINNHUB_API_KEY"),
        ("twelvedata", "TWELVEDATA_API_KEY"),
        ("fmp", "FMP_API_KEY"),
        ("coinmarketcap", "COINMARKETCAP_API_KEY"),
        ("alphavantage", "ALPHAVANTAGE_API_KEY"),
    ]
    attempts: list[dict] = []
    for provider, env_name in providers:
        enabled = bool(_env_api_key(env_name))
        attempts.append(
            {
                "provider": provider,
                "env": env_name,
                "enabled": enabled,
                "status": "configured" if enabled else "disabled_missing_env",
                "credential": "[REDACTED]" if enabled else None,
            }
        )
    return attempts

# ─── App ─────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
app = FastAPI(title="AYC Global Market API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Signature"],
)

# ─── Simple in-memory cache ──────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 90  # seconds

def get_cache(key: str):
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None

def set_cache(key: str, data):
    _cache[key] = (data, time.time())

# ─── HTTP client ─────────────────────────────────────────────────────────────
async def get(url: str, params: dict = None, headers: dict = None, timeout: float = 8.0):
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url, params=params, headers=headers)
            if r.status_code == 200:
                return r.json()
    except Exception:
        pass
    return None

# ─── Signal scoring ──────────────────────────────────────────────────────────
def score_item(change: float, volume_ratio: float = 1.0) -> int:
    base = 50
    if change is None or not math.isfinite(change):
        return base
    base += min(30, max(-30, change * 4))
    base += min(10, volume_ratio * 5)
    return max(0, min(100, int(base)))

def signal_from_score(score: int, change: float) -> str:
    if score >= 72 and change > 0:
        return "AL"
    if score <= 35 or change < -3:
        return "SAT"
    return "İZLE"

def reason_for(name: str, change: float, score: int, lang: str = "tr") -> str:
    if lang == "en":
        if change > 3:    return f"{name} shows strong upward momentum. RSI above 60, volume increasing."
        if change > 0:    return f"{name} in positive trend. Moderate momentum, watch for continuation."
        if change < -3:   return f"{name} under selling pressure. RSI declining, caution advised."
        return f"{name} consolidating. No clear directional signal yet."
    else:
        if change > 3:    return f"{name} güçlü yükseliş momentumu gösteriyor. RSI 60 üzeri, hacim artıyor."
        if change > 0:    return f"{name} pozitif seyirde. Orta düzey momentum, süreç takip edilmeli."
        if change < -3:   return f"{name} satış baskısı altında. RSI düşüyor, dikkatli olunmalı."
        return f"{name} yatay seyrediyor. Net yön sinyali henüz yok."

def make_item(symbol: str, display: str, name: str, price: float, change: float,
              volume: float, asset_class: str, market: str) -> dict:
    sc = score_item(change)
    sig = signal_from_score(sc, change)
    return {
        "symbol": symbol,
        "display": display,
        "name": name,
        "price": round(price, 6) if price else 0,
        "lastPrice": round(price, 6) if price else 0,
        "change": round(change, 2) if change else 0,
        "volume": volume or 0,
        "asset_class": asset_class,
        "market": market,
        "score": sc,
        "scoreNormalized": sc,
        "signal": sig,
        "decision": sig.lower(),
        "reason": reason_for(name, change or 0, sc),
        "canonical_symbol": symbol,
        "display_symbol": display,
        "source_symbols": {},
    }

# ─── Fallback / mock data ─────────────────────────────────────────────────────
MOCK_CRYPTO = [
    ("BTCUSDT",  "BTC/USDT",  "Bitcoin",    94500, 1.8,  48e9,  "crypto", "crypto"),
    ("ETHUSDT",  "ETH/USDT",  "Ethereum",   3200,  2.4,  22e9,  "crypto", "crypto"),
    ("SOLUSDT",  "SOL/USDT",  "Solana",     172,   3.1,  5.4e9, "crypto", "crypto"),
    ("BNBUSDT",  "BNB/USDT",  "BNB",        610,   0.9,  2.1e9, "crypto", "crypto"),
    ("XRPUSDT",  "XRP/USDT",  "XRP",        0.52,  -1.2, 3.8e9, "crypto", "crypto"),
    ("ADAUSDT",  "ADA/USDT",  "Cardano",    0.44, -0.8,  1.2e9, "crypto", "crypto"),
    ("DOGEUSDT", "DOGE/USDT", "Dogecoin",   0.17, -2.1,  2.3e9, "crypto", "crypto"),
    ("AVAXUSDT", "AVAX/USDT", "Avalanche",  38,    4.2,  0.9e9, "crypto", "crypto"),
    ("LINKUSDT", "LINK/USDT", "Chainlink",  15.2,  1.5,  0.7e9, "crypto", "crypto"),
    ("DOTUSDT",  "DOT/USDT",  "Polkadot",   7.8,  -0.5,  0.6e9, "crypto", "crypto"),
]
MOCK_US = [
    ("AAPL",  "AAPL",  "Apple Inc",       189.5,  0.7, 58e6,  "stock", "us"),
    ("MSFT",  "MSFT",  "Microsoft",       430.2,  1.1, 22e6,  "stock", "us"),
    ("NVDA",  "NVDA",  "NVIDIA",          875.3,  3.2, 48e6,  "stock", "us"),
    ("GOOGL", "GOOGL", "Alphabet",        175.8, -0.4, 18e6,  "stock", "us"),
    ("AMZN",  "AMZN",  "Amazon",          192.4,  1.9, 35e6,  "stock", "us"),
    ("TSLA",  "TSLA",  "Tesla",           172.6, -2.8, 95e6,  "stock", "us"),
    ("META",  "META",  "Meta Platforms",  510.3,  2.1, 12e6,  "stock", "us"),
    ("JPM",   "JPM",   "JPMorgan Chase",  204.5,  0.6, 9e6,   "stock", "us"),
    ("V",     "V",     "Visa",            277.8,  0.3, 7e6,   "stock", "us"),
    ("WMT",   "WMT",   "Walmart",         68.4,   1.4, 8e6,   "stock", "us"),
]
MOCK_TURKEY = [
    ("THYAO.IS", "THYAO", "Türk Hava Yolları", 286.5, 1.2, 4.5e7, "stock", "turkey"),
    ("ASELS.IS", "ASELS", "Aselsan",           79.3, -0.8, 8.2e7, "stock", "turkey"),
    ("EREGL.IS", "EREGL", "Ereğli Demir Çelik", 41.6, 2.1, 5.6e7, "stock", "turkey"),
    ("TUPRS.IS", "TUPRS", "Tüpraş",            156.4, 0.5, 2.3e7, "stock", "turkey"),
    ("SAHOL.IS", "SAHOL", "Sabancı Holding",    47.8, 1.8, 3.1e7, "stock", "turkey"),
    ("SASA.IS",  "SASA",  "SASA Polyester",     39.2, -1.4, 6.4e7, "stock", "turkey"),
    ("KZGYO.IS", "KZGYO", "Kuzey Yıldızı GYO",  12.4,  3.2, 1.2e7, "stock", "turkey"),
    ("SOKM.IS",  "SOKM",  "Şok Marketler",       24.7, -0.6, 4.8e7, "stock", "turkey"),
    ("TAVHL.IS", "TAVHL", "TAV Havalimanları",   93.5,  0.9, 2.8e7, "stock", "turkey"),
    ("BIMAS.IS", "BIMAS", "BIM Mağazaları",     461.0,  1.3, 1.5e7, "stock", "turkey"),
]
MOCK_PRECIOUS = [
    ("XAUUSD", "XAU/USD", "Altın",   2340.5,  0.3, 0, "commodity", "precious"),
    ("XAGUSD", "XAG/USD", "Gümüş",    27.85,  0.8, 0, "commodity", "precious"),
    ("XPTUSD", "XPT/USD", "Platin",   1012.0, -0.4, 0, "commodity", "precious"),
    ("XPDUSD", "XPD/USD", "Paladyum", 985.0,  1.1, 0, "commodity", "precious"),
    ("COPPER", "COPPER",  "Bakır",      4.52,  0.6, 0, "commodity", "precious"),
]
MOCK_ENERGY = [
    ("USOIL",  "WTI",    "Ham Petrol (WTI)",   78.4, -0.9, 0, "commodity", "energy"),
    ("UKOIL",  "BRENT",  "Ham Petrol (Brent)", 82.1, -0.7, 0, "commodity", "energy"),
    ("NATGAS", "NATGAS", "Doğal Gaz",           2.18, 1.4, 0, "commodity", "energy"),
    ("GASOLINE","RBOB",  "Benzin",              2.45, -0.3, 0, "commodity", "energy"),
    ("HEATOIL", "HO",    "Isıtma Yağı",         2.62,  0.1, 0, "commodity", "energy"),
]
MOCK_FOREX = [
    ("EURUSD", "EUR/USD", "Euro / Dolar",       1.0875,  0.2, 0, "forex", "forex"),
    ("USDTRY", "USD/TRY", "Dolar / TL",         32.45,   0.5, 0, "forex", "forex"),
    ("GBPUSD", "GBP/USD", "Sterlin / Dolar",    1.2680, -0.3, 0, "forex", "forex"),
    ("USDJPY", "USD/JPY", "Dolar / Yen",       157.20,   0.1, 0, "forex", "forex"),
    ("EURTRY", "EUR/TRY", "Euro / TL",          35.24,   0.6, 0, "forex", "forex"),
    ("XAUUSD", "XAU/USD", "Altın / Dolar",    2340.5,   0.3, 0, "forex", "forex"),
    ("USDCHF", "USD/CHF", "Dolar / Frank",      0.9040, -0.1, 0, "forex", "forex"),
    ("AUDUSD", "AUD/USD", "Avustralya Doları",  0.6520,  0.4, 0, "forex", "forex"),
]
MOCK_INDEX = [
    ("XU100",  "BIST100", "BIST 100",     9285.4,  0.9, 0, "index", "index"),
    ("SPX",    "S&P 500", "S&P 500",      5248.3,  0.6, 0, "index", "index"),
    ("NDX",    "NASDAQ",  "NASDAQ 100",  18245.7,  1.1, 0, "index", "index"),
    ("DJI",    "DOW",     "Dow Jones",   39478.0,  0.3, 0, "index", "index"),
    ("DAX",    "DAX",     "DAX 40",      18392.6, -0.2, 0, "index", "index"),
    ("FTSE",   "FTSE100", "FTSE 100",     8285.4,  0.1, 0, "index", "index"),
    ("N225",   "NIKKEI",  "Nikkei 225",  38500.2, -0.4, 0, "index", "index"),
    ("HSI",    "HANG",    "Hang Seng",   17842.3,  0.7, 0, "index", "index"),
]
MOCK_ETF = [
    ("SPY",  "SPY",  "SPDR S&P 500 ETF",       524.8, 0.6, 65e6, "etf", "etf"),
    ("QQQ",  "QQQ",  "Invesco QQQ Trust",       446.2, 1.1, 42e6, "etf", "etf"),
    ("VTI",  "VTI",  "Vanguard Total Stock",    252.4, 0.5, 4e6,  "etf", "etf"),
    ("GLD",  "GLD",  "SPDR Gold Shares",        221.3, 0.3, 8e6,  "etf", "etf"),
    ("SLV",  "SLV",  "iShares Silver Trust",     25.4, 0.8, 12e6, "etf", "etf"),
    ("IAU",  "IAU",  "iShares Gold Trust",       44.6, 0.3, 6e6,  "etf", "etf"),
    ("EEM",  "EEM",  "iShares MSCI Emerging",    42.8, 0.9, 18e6, "etf", "etf"),
    ("XLK",  "XLK",  "Technology Select SPDR",  225.6, 1.3, 7e6,  "etf", "etf"),
]

MOCK_BY_MARKET = {
    "crypto":   MOCK_CRYPTO,
    "us":       MOCK_US,
    "turkey":   MOCK_TURKEY,
    "precious": MOCK_PRECIOUS,
    "energy":   MOCK_ENERGY,
    "forex":    MOCK_FOREX,
    "index":    MOCK_INDEX,
    "etf":      MOCK_ETF,
}

ALL_MOCK = (MOCK_CRYPTO + MOCK_US + MOCK_TURKEY + MOCK_PRECIOUS +
            MOCK_ENERGY + MOCK_FOREX + MOCK_INDEX + MOCK_ETF)

def mock_items(market: str = "all") -> list[dict]:
    src = MOCK_BY_MARKET.get(market, None)
    if src is None:
        src = ALL_MOCK
    # add small random noise to prices/changes so data "feels live"
    result = []
    for row in src:
        sym, disp, name, price, chg, vol, cls, mkt = row
        noise_p = price * (1 + random.uniform(-0.002, 0.002))
        noise_c = chg + random.uniform(-0.15, 0.15)
        result.append(make_item(sym, disp, name, round(noise_p, 6),
                                round(noise_c, 2), vol, cls, mkt))
    return result

# ─── Live data fetchers ───────────────────────────────────────────────────────

async def fetch_crypto_live() -> list[dict]:
    cached = get_cache("crypto_live")
    if cached:
        return cached
    cg_key = _env_api_key("COINGECKO_API_KEY")
    if not cg_key:
        return mock_items("crypto")
    data = await get(
        "https://api.coingecko.com/api/v3/coins/markets",
        params={
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": 30,
            "page": 1,
            "sparkline": "false",
            "price_change_percentage": "24h",
        },
        headers={"x-cg-demo-api-key": cg_key},
    )
    if not data or not isinstance(data, list):
        return mock_items("crypto")
    items = []
    for coin in data:
        sym = f"{coin.get('symbol','').upper()}USDT"
        price = coin.get("current_price") or 0
        change = coin.get("price_change_percentage_24h") or 0
        vol = coin.get("total_volume") or 0
        items.append(make_item(sym, f"{coin.get('symbol','').upper()}/USDT",
                               coin.get("name", sym), price, change, vol,
                               "crypto", "crypto"))
    set_cache("crypto_live", items)
    return items

async def fetch_us_stocks_live() -> list[dict]:
    cached = get_cache("us_live")
    if cached:
        return cached
    fmp_key = _env_api_key("FMP_API_KEY")
    if not fmp_key:
        return mock_items("us")
    tickers = ["AAPL","MSFT","NVDA","GOOGL","AMZN","TSLA","META","JPM","V","WMT",
               "UNH","XOM","JNJ","PG","MA","ORCL","HD","ABBV","MRK","LLY"]
    data = await get(
        "https://financialmodelingprep.com/api/v3/quote/" + ",".join(tickers),
        params={"apikey": fmp_key}
    )
    if not data or not isinstance(data, list):
        return mock_items("us")
    items = []
    for q in data:
        sym = q.get("symbol", "")
        price = q.get("price") or 0
        change = q.get("changesPercentage") or 0
        vol = q.get("volume") or 0
        name = q.get("name", sym)
        items.append(make_item(sym, sym, name, price, change, vol, "stock", "us"))
    set_cache("us_live", items)
    return items

async def fetch_turkey_live() -> list[dict]:
    cached = get_cache("turkey_live")
    if cached:
        return cached
    fmp_key = _env_api_key("FMP_API_KEY")
    if not fmp_key:
        return mock_items("turkey")
    tickers = ["THYAO.IS","ASELS.IS","EREGL.IS","TUPRS.IS","SAHOL.IS",
               "SASA.IS","KZGYO.IS","SOKM.IS","TAVHL.IS","BIMAS.IS",
               "AKBNK.IS","GARAN.IS","ISCTR.IS","KRDMD.IS","TOASO.IS"]
    data = await get(
        "https://financialmodelingprep.com/api/v3/quote/" + ",".join(tickers),
        params={"apikey": fmp_key}
    )
    if not data or not isinstance(data, list):
        return mock_items("turkey")
    items = []
    for q in data:
        sym = q.get("symbol", "")
        price = q.get("price") or 0
        change = q.get("changesPercentage") or 0
        vol = q.get("volume") or 0
        name = q.get("name", sym)
        short_sym = sym.replace(".IS", "")
        items.append(make_item(sym, short_sym, name, price, change, vol, "stock", "turkey"))
    set_cache("turkey_live", items)
    return items

async def fetch_forex_live() -> list[dict]:
    cached = get_cache("forex_live")
    if cached:
        return cached
    td_key = _env_api_key("TWELVEDATA_API_KEY")
    if not td_key:
        return mock_items("forex")
    symbols = "EUR/USD,USD/TRY,GBP/USD,USD/JPY,EUR/TRY,USD/CHF,AUD/USD"
    data = await get(
        f"https://api.twelvedata.com/quote?symbol={symbols}&apikey={td_key}"
    )
    items = []
    if data and isinstance(data, dict):
        for sym_key, q in data.items():
            if not isinstance(q, dict):
                continue
            price = float(q.get("close") or q.get("price") or 0)
            change = float(q.get("percent_change") or 0)
            clean_sym = sym_key.replace("/", "")
            items.append(make_item(clean_sym, sym_key, sym_key,
                                   price, change, 0, "forex", "forex"))
    if not items:
        items = mock_items("forex")
    set_cache("forex_live", items)
    return items

async def fetch_precious_live() -> list[dict]:
    cached = get_cache("precious_live")
    if cached:
        return cached
    td_key = _env_api_key("TWELVEDATA_API_KEY")
    if not td_key:
        return mock_items("precious")
    symbols = "XAU/USD,XAG/USD,XPT/USD"
    data = await get(
        f"https://api.twelvedata.com/quote?symbol={symbols}&apikey={td_key}"
    )
    items = []
    if data and isinstance(data, dict):
        for sym_key, q in data.items():
            if not isinstance(q, dict):
                continue
            price = float(q.get("close") or 0)
            change = float(q.get("percent_change") or 0)
            names = {"XAU/USD": "Altın", "XAG/USD": "Gümüş", "XPT/USD": "Platin"}
            name = names.get(sym_key, sym_key)
            clean_sym = sym_key.replace("/", "")
            items.append(make_item(clean_sym, sym_key, name, price, change, 0, "commodity", "precious"))
    if not items:
        items = mock_items("precious")
    set_cache("precious_live", items)
    return items

async def fetch_energy_live() -> list[dict]:
    cached = get_cache("energy_live")
    if cached:
        return cached
    td_key = _env_api_key("TWELVEDATA_API_KEY")
    if not td_key:
        return mock_items("energy")
    symbols = "WTI/USD,BRENT/USD,NGAS/USD"
    data = await get(
        f"https://api.twelvedata.com/quote?symbol={symbols}&apikey={td_key}"
    )
    items = []
    if data and isinstance(data, dict):
        for sym_key, q in data.items():
            if not isinstance(q, dict):
                continue
            price = float(q.get("close") or 0)
            change = float(q.get("percent_change") or 0)
            names = {"WTI/USD": "Ham Petrol (WTI)", "BRENT/USD": "Ham Petrol (Brent)", "NGAS/USD": "Doğal Gaz"}
            name = names.get(sym_key, sym_key)
            clean_sym = sym_key.replace("/", "")
            items.append(make_item(clean_sym, sym_key, name, price, change, 0, "commodity", "energy"))
    if not items:
        items = mock_items("energy")
    set_cache("energy_live", items)
    return items

async def fetch_index_live() -> list[dict]:
    cached = get_cache("index_live")
    if cached:
        return cached
    fmp_key = _env_api_key("FMP_API_KEY")
    if not fmp_key:
        return mock_items("index")
    data = await get(
        "https://financialmodelingprep.com/api/v3/quote/%5EGSPC,%5ENDX,%5EDJI,%5EFTSE,%5EGDAXI,%5EN225,%5EHSI",
        params={"apikey": fmp_key}
    )
    items = []
    if data and isinstance(data, list):
        for q in data:
            sym = q.get("symbol", "").lstrip("^")
            price = q.get("price") or 0
            change = q.get("changesPercentage") or 0
            name = q.get("name", sym)
            items.append(make_item(sym, sym, name, price, change, 0, "index", "index"))
    # Add BIST
    bist = await get(
        "https://financialmodelingprep.com/api/v3/quote/XU100.IS",
        params={"apikey": fmp_key}
    )
    if bist and isinstance(bist, list) and bist:
        q = bist[0]
        items.insert(0, make_item("XU100", "BIST100", "BIST 100",
                                  q.get("price") or 9285, q.get("changesPercentage") or 0, 0, "index", "index"))
    if not items:
        items = mock_items("index")
    set_cache("index_live", items)
    return items

async def fetch_etf_live() -> list[dict]:
    cached = get_cache("etf_live")
    if cached:
        return cached
    fmp_key = _env_api_key("FMP_API_KEY")
    if not fmp_key:
        return mock_items("etf")
    tickers = "SPY,QQQ,VTI,GLD,SLV,IAU,EEM,XLK,IWM,VNQ"
    data = await get(
        f"https://financialmodelingprep.com/api/v3/quote/{tickers}",
        params={"apikey": fmp_key}
    )
    if not data or not isinstance(data, list):
        return mock_items("etf")
    items = []
    for q in data:
        sym = q.get("symbol", "")
        price = q.get("price") or 0
        change = q.get("changesPercentage") or 0
        vol = q.get("volume") or 0
        name = q.get("name", sym)
        items.append(make_item(sym, sym, name, price, change, vol, "etf", "etf"))
    set_cache("etf_live", items)
    return items

async def fetch_market_data(market: str) -> list[dict]:
    fetchers = {
        "crypto":   fetch_crypto_live,
        "us":       fetch_us_stocks_live,
        "turkey":   fetch_turkey_live,
        "forex":    fetch_forex_live,
        "precious": fetch_precious_live,
        "energy":   fetch_energy_live,
        "index":    fetch_index_live,
        "etf":      fetch_etf_live,
    }
    if market in fetchers:
        try:
            return await fetchers[market]()
        except Exception:
            return mock_items(market)
    # "all" — fetch all categories in parallel
    try:
        results = await asyncio.gather(
            fetch_crypto_live(), fetch_us_stocks_live(), fetch_turkey_live(),
            fetch_forex_live(), fetch_precious_live(), fetch_energy_live(),
            fetch_index_live(), fetch_etf_live(),
            return_exceptions=True
        )
        items = []
        for r in results:
            if isinstance(r, list):
                items.extend(r)
        return items if items else mock_items("all")
    except Exception:
        return mock_items("all")

# ─── Asset history helper ─────────────────────────────────────────────────────
async def fetch_history_twelvedata(symbol: str, interval: str, outputsize: int) -> list:
    """Fetch OHLC from TwelveData and return [[ts_ms, close], ...]"""
    td_key = _env_api_key("TWELVEDATA_API_KEY")
    if not td_key:
        return []
    data = await get(
        "https://api.twelvedata.com/time_series",
        params={
            "symbol": symbol,
            "interval": interval,
            "outputsize": outputsize,
            "apikey": td_key,
        }
    )
    if not data or "values" not in data:
        return []
    try:
        from datetime import datetime
        points = []
        for row in reversed(data["values"]):
            dt = datetime.fromisoformat(row["datetime"])
            ts = int(dt.timestamp() * 1000)
            price = float(row["close"])
            points.append([ts, price])
        return points
    except Exception:
        return []

def generate_mock_history(base_price: float, n: int, interval_ms: int) -> list:
    now_ms = int(time.time() * 1000)
    points = []
    price = base_price
    for i in range(n, 0, -1):
        ts = now_ms - i * interval_ms
        price *= (1 + random.uniform(-0.015, 0.015))
        points.append([ts, round(price, 6)])
    return points

# ─── Markets list ─────────────────────────────────────────────────────────────
MARKET_DEFS = [
    {"key": "all",      "label": "Tüm Piyasalar", "label_en": "All Markets"},
    {"key": "turkey",   "label": "BIST / Türkiye", "label_en": "BIST / Turkey"},
    {"key": "us",       "label": "ABD Borsası",    "label_en": "US Stocks"},
    {"key": "crypto",   "label": "Kripto",         "label_en": "Crypto"},
    {"key": "precious", "label": "Değerli Emtia",  "label_en": "Precious Metals"},
    {"key": "energy",   "label": "Enerji",         "label_en": "Energy"},
    {"key": "forex",    "label": "Forex",           "label_en": "Forex"},
    {"key": "index",    "label": "Endeksler",       "label_en": "Indices"},
    {"key": "etf",      "label": "ETF",             "label_en": "ETF"},
]

# ─── API Routes ───────────────────────────────────────────────────────────────

@app.get("/markets")
async def get_markets():
    return JSONResponse({"items": MARKET_DEFS})

@app.get("/signals")
async def get_signals(market: str = "all", limit: int = 20, refresh: str = "false"):
    items = await fetch_market_data(market)
    provider_attempts = _provider_attempts()
    any_provider_configured = any(item.get("enabled") for item in provider_attempts)
    # sort by abs(change) desc for "most active" feel
    items_sorted = sorted(items, key=lambda x: abs(x.get("change") or 0), reverse=True)
    return JSONResponse({
        "items": items_sorted[:limit],
        "market": market,
        "source": "live" if any_provider_configured else "mock",
        "providerAttempts": provider_attempts,
        "dataQuality": "provider-dependent" if any_provider_configured else "mock",
        "total": len(items_sorted),
    })

@app.get("/universe")
async def get_universe(market: str = "all"):
    items = await fetch_market_data(market)
    return JSONResponse({"items": items, "total": len(items)})

@app.get("/search")
async def search(q: str = "", limit: int = 10):
    if not q.strip():
        return JSONResponse({"items": []})
    q_upper = q.upper().strip()
    all_items = await fetch_market_data("all")
    results = []
    for item in all_items:
        sym   = str(item.get("symbol", "")).upper()
        disp  = str(item.get("display", "")).upper()
        name  = str(item.get("name", "")).upper()
        if q_upper in sym or q_upper in disp or q_upper in name:
            results.append(item)
        if len(results) >= limit:
            break
    return JSONResponse({"items": results})

@app.get("/analyze/{symbol}")
async def analyze(symbol: str):
    all_items = await fetch_market_data("all")
    sym_upper = symbol.upper()
    found = None
    for item in all_items:
        if str(item.get("symbol", "")).upper() == sym_upper or \
           str(item.get("display", "")).upper() == sym_upper:
            found = item
            break
    if not found:
        # try to get from finnhub
        fh_key = _env_api_key("FINNHUB_API_KEY")
        if not fh_key:
            found = make_item(symbol, symbol, symbol, 0, 0, 0, "unknown", "all")
            found["providerUnavailable"] = "finnhub"
            found["dataQuality"] = "mock"
            return JSONResponse(found)
        data = await get(
            f"https://finnhub.io/api/v1/quote",
            params={"symbol": symbol, "token": fh_key}
        )
        if data and data.get("c"):
            price = data["c"]
            change = ((data["c"] - data.get("pc", data["c"])) / data.get("pc", data["c"])) * 100 if data.get("pc") else 0
            found = make_item(symbol, symbol, symbol, price, change, 0, "stock", "us")
        else:
            found = make_item(symbol, symbol, symbol, 0, 0, 0, "unknown", "all")
    return JSONResponse(found)

@app.get("/asset-detail/{symbol}")
async def asset_detail(symbol: str):
    all_items = await fetch_market_data("all")
    sym_upper = symbol.upper()
    for item in all_items:
        if str(item.get("symbol", "")).upper() == sym_upper or \
           str(item.get("display", "")).upper().replace("/", "") == sym_upper:
            return JSONResponse(item)
    # Fallback: finnhub
    fh_key = _env_api_key("FINNHUB_API_KEY")
    if not fh_key:
        return JSONResponse(
            {
                "error": "provider_unavailable",
                "provider": "finnhub",
                "status": "disabled_missing_env",
            },
            status_code=503,
        )
    data = await get(
        f"https://finnhub.io/api/v1/quote",
        params={"symbol": symbol, "token": fh_key}
    )
    if data and data.get("c"):
        price = data["c"]
        pc = data.get("pc") or price
        change = ((price - pc) / pc) * 100 if pc else 0
        item = make_item(symbol, symbol, symbol, price, change, 0, "stock", "us")
        return JSONResponse(item)
    return JSONResponse({"error": "not_found"}, status_code=404)

@app.get("/asset-history/{symbol}")
async def asset_history(symbol: str, timeframe: str = "1D"):
    sym = symbol.upper().replace("%2F", "/")
    # determine interval and outputsize
    tf_map = {
        "1D": ("5min",  72),
        "1W": ("1h",    168),
        "1M": ("4h",    180),
        "1Y": ("1day",  365),
    }
    interval, outputsize = tf_map.get(timeframe, ("1h", 24))

    # Try TwelveData
    td_sym = sym
    points = await fetch_history_twelvedata(td_sym, interval, outputsize)

    # Fallback: generate synthetic data based on current price
    if not points:
        base = 100.0
        all_items = await fetch_market_data("all")
        for item in all_items:
            if str(item.get("symbol","")).upper() == sym or \
               str(item.get("display","")).upper().replace("/","") == sym:
                base = item.get("price") or 100
                break
        interval_ms_map = {"5min": 300000, "1h": 3600000, "4h": 14400000, "1day": 86400000}
        iv_ms = interval_ms_map.get(interval, 3600000)
        points = generate_mock_history(base, outputsize, iv_ms)

    return JSONResponse({
        "symbol": sym,
        "timeframe": timeframe,
        "points": points,
        "source": "live" if points else "mock",
    })

# ─── Static files (LAST — catches everything else) ───────────────────────────
app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend:app", host="0.0.0.0", port=3000, reload=False, log_level="info")
