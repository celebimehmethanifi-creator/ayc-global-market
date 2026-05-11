"""
AYC Global Market — Real-Time Price Engine
Sources (priority order):
  Crypto   → Binance REST (free, no key, sub-second)
  Stocks   → Finnhub (have key) → Yahoo Finance fallback
  Forex    → Yahoo Finance → Finnhub fallback
  Precious → Yahoo Finance (GC=F, SI=F ...) → Finnhub
  Energy   → Yahoo Finance (CL=F, NG=F)
  BIST     → Yahoo Finance (.IS suffix)
  Index    → Yahoo Finance (^GSPC, ^DJI, ^IXIC, ^XU100)
Cache TTL: 30s crypto, 60s stocks
"""
from __future__ import annotations
import os, asyncio, time, logging
from typing import Optional
import httpx

log = logging.getLogger("price_engine")

# ── Symbol maps ──────────────────────────────────────────────────
BINANCE_SYMBOLS = {
    "BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","ADAUSDT",
    "DOGEUSDT","AVAXUSDT","LINKUSDT","DOTUSDT","MATICUSDT","LTCUSDT",
    "ATOMUSDT","UNIUSDT","SHIBUSDT","TRXUSDT","NEARUSDT","AAVEUSDT",
    "MKRUSDT","ARBUSDT","OPUSDT","INJUSDT","TIAUSDT","SUIUSDT",
}

YAHOO_MAP = {
    # Precious
    "XAUUSD":  "GC=F",   "XAGUSD":  "SI=F",   "XPTUSD":  "PL=F",
    "XPDUSD":  "PA=F",   "GC=F":    "GC=F",   "SI=F":    "SI=F",
    # Energy
    "USOIL":   "CL=F",   "CL=F":    "CL=F",   "NGAS":    "NG=F",
    "NG=F":    "NG=F",   "BRENT":   "BZ=F",   "BZ=F":    "BZ=F",
    # Forex
    "EURUSD":  "EURUSD=X","GBPUSD":  "GBPUSD=X","USDJPY": "JPY=X",
    "USDTRY":  "TRY=X",  "USDCAD":  "CAD=X",  "AUDUSD":  "AUDUSD=X",
    "USDCHF":  "CHF=X",  "NZDUSD":  "NZDUSD=X",
    # Indices
    "SPX":     "^GSPC",  "DJI":     "^DJI",   "NASDAQ":  "^IXIC",
    "BIST100": "XU100.IS","VIX":     "^VIX",   "FTSE":    "^FTSE",
    "DAX":     "^GDAXI", "NIKKEI":  "^N225",
    # ETFs
    "SPY":     "SPY",    "QQQ":     "QQQ",    "GLD":     "GLD",
    "SLV":     "SLV",    "TLT":     "TLT",    "IWM":     "IWM",
}

_CACHE: dict[str, dict] = {}
CACHE_TTL_CRYPTO = 20   # seconds
CACHE_TTL_OTHER  = 45   # seconds

def _cache_get(symbol: str) -> Optional[dict]:
    entry = _CACHE.get(symbol)
    if not entry:
        return None
    ttl = CACHE_TTL_CRYPTO if symbol.endswith("USDT") else CACHE_TTL_OTHER
    if time.time() - entry["ts"] < ttl:
        return entry
    return None

def _cache_set(symbol: str, data: dict):
    data["ts"] = time.time()
    _CACHE[symbol] = data


async def _binance_price(symbol: str) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=5) as c:
            r = await c.get(f"https://api.binance.com/api/v3/ticker/24hr?symbol={symbol}")
            if r.status_code == 200:
                d = r.json()
                price = float(d["lastPrice"])
                chg   = float(d["priceChangePercent"])
                high  = float(d["highPrice"])
                low   = float(d["lowPrice"])
                vol   = float(d["volume"])
                return {
                    "price": price, "change_pct": round(chg, 2),
                    "high_24h": high, "low_24h": low,
                    "volume": vol, "source": "binance",
                }
    except Exception:
        pass
    return None


async def _yahoo_price(yf_symbol: str, original: str) -> Optional[dict]:
    try:
        urls = [
            f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_symbol}?interval=1m&range=1d",
            f"https://query2.finance.yahoo.com/v8/finance/chart/{yf_symbol}?interval=1m&range=1d",
        ]
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        for url in urls:
            try:
                async with httpx.AsyncClient(timeout=7, headers=headers) as c:
                    r = await c.get(url)
                    if r.status_code == 200:
                        result = r.json().get("chart", {}).get("result", [])
                        if not result:
                            continue
                        meta = result[0].get("meta", {})
                        price = meta.get("regularMarketPrice") or meta.get("previousClose", 0)
                        prev  = meta.get("previousClose") or meta.get("chartPreviousClose", price) or price
                        high  = meta.get("regularMarketDayHigh", price)
                        low   = meta.get("regularMarketDayLow", price)
                        vol   = meta.get("regularMarketVolume", 0)
                        chg   = ((price - prev) / prev * 100) if prev and price else 0
                        if price and price > 0:
                            return {
                                "price": round(float(price), 4),
                                "change_pct": round(float(chg), 2),
                                "high_24h": round(float(high), 4),
                                "low_24h": round(float(low), 4),
                                "volume": float(vol),
                                "source": "yahoo",
                            }
            except Exception:
                continue
    except Exception:
        pass
    return None


async def _finnhub_price(symbol: str) -> Optional[dict]:
    key = os.environ.get("FINNHUB_API_KEY", "")
    if not key:
        return None
    fh_sym = symbol.replace("USDT","").upper()
    # Forex mapping
    forex_map = {"EURUSD":"OANDA:EUR_USD","GBPUSD":"OANDA:GBP_USD","USDJPY":"OANDA:USD_JPY","USDTRY":"OANDA:USD_TRY"}
    fh_sym = forex_map.get(symbol, fh_sym)
    try:
        async with httpx.AsyncClient(timeout=6) as c:
            r = await c.get(f"https://finnhub.io/api/v1/quote?symbol={fh_sym}&token={key}")
            if r.status_code == 200:
                d = r.json()
                price = d.get("c", 0)
                prev  = d.get("pc", price) or price
                high  = d.get("h", price)
                low   = d.get("l", price)
                if price and price > 0:
                    chg = ((price - prev) / prev * 100) if prev else 0
                    return {
                        "price": round(float(price), 4),
                        "change_pct": round(float(chg), 2),
                        "high_24h": round(float(high), 4),
                        "low_24h": round(float(low), 4),
                        "volume": 0,
                        "source": "finnhub",
                    }
    except Exception:
        pass
    return None


async def _twelvedata_price(symbol: str) -> Optional[dict]:
    key = os.environ.get("TWELVEDATA_API_KEY", "")
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=7) as c:
            r = await c.get(
                f"https://api.twelvedata.com/quote?symbol={symbol}&apikey={key}"
            )
            if r.status_code == 200:
                d = r.json()
                if d.get("status") == "error":
                    return None
                price = float(d.get("close", 0))
                prev  = float(d.get("previous_close", price) or price)
                chg   = float(d.get("percent_change", 0))
                if price > 0:
                    return {
                        "price": price,
                        "change_pct": round(chg, 2),
                        "high_24h": float(d.get("high", price)),
                        "low_24h": float(d.get("low", price)),
                        "volume": float(d.get("volume", 0) or 0),
                        "source": "twelvedata",
                    }
    except Exception:
        pass
    return None


async def get_price(symbol: str) -> dict:
    """Gerçek zamanlı fiyat — önbellek destekli, çok kaynaklı."""
    sym_upper = symbol.upper()

    # Cache hit
    cached = _cache_get(sym_upper)
    if cached:
        return cached

    result = None

    # 1. Binance (crypto, en hızlı)
    if sym_upper in BINANCE_SYMBOLS or sym_upper.endswith("USDT"):
        result = await _binance_price(sym_upper)

    # 2. Yahoo Finance (stocks, forex, commodities, indices)
    if not result:
        yf_sym = YAHOO_MAP.get(sym_upper, sym_upper)
        result = await _yahoo_price(yf_sym, sym_upper)

    # 3. Finnhub fallback
    if not result:
        result = await _finnhub_price(sym_upper)

    # 4. TwelveData fallback
    if not result:
        result = await _twelvedata_price(sym_upper)

    if result:
        _cache_set(sym_upper, result)
        return result

    return {"price": 0.0, "change_pct": 0.0, "high_24h": 0.0, "low_24h": 0.0, "volume": 0.0, "source": "unavailable", "error": "Fiyat alınamadı"}


async def get_prices_batch(symbols: list[str]) -> dict[str, dict]:
    """Toplu fiyat çekme — paralel."""
    results = await asyncio.gather(*[get_price(s) for s in symbols], return_exceptions=True)
    return {
        sym: (r if isinstance(r, dict) else {"price": 0, "change_pct": 0, "source": "error"})
        for sym, r in zip(symbols, results)
    }
