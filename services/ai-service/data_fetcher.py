"""
Finance API Layer — NEURA Data Fetcher
Öncelik sırası: TwelveData > Finnhub > CoinGecko > yfinance (fallback)
Her kaynak timeout ve hata yönetimiyle sarmalanmış.
"""
from __future__ import annotations
import asyncio
import logging
import os
from typing import Any

log = logging.getLogger("data_fetcher")

# ── Timeout constants ────────────────────────────────────────────────────────
TIMEOUT = 8  # saniye


# ══════════════════════════════════════════════════════════════════════════════
# CRYPTO — CoinGecko (birincil) + Binance WS fiyat fallback
# ══════════════════════════════════════════════════════════════════════════════
_COINGECKO_IDS = {
    "BTC": "bitcoin", "BTCUSDT": "bitcoin", "BTC-USD": "bitcoin",
    "ETH": "ethereum", "ETHUSDT": "ethereum", "ETH-USD": "ethereum",
    "SOL": "solana", "SOLUSDT": "solana",
    "BNB": "binancecoin", "BNBUSDT": "binancecoin",
    "XRP": "ripple", "XRPUSDT": "ripple",
    "ADA": "cardano", "ADAUSDT": "cardano",
    "AVAX": "avalanche-2", "AVAXUSDT": "avalanche-2",
    "DOGE": "dogecoin", "DOGEUSDT": "dogecoin",
    "DOT": "polkadot", "DOTUSDT": "polkadot",
    "LINK": "chainlink", "LINKUSDT": "chainlink",
    "MATIC": "matic-network", "MATICUSDT": "matic-network",
    "UNI": "uniswap", "UNIUSDT": "uniswap",
    "LTC": "litecoin", "LTCUSDT": "litecoin",
    "ATOM": "cosmos", "ATOMUSDT": "cosmos",
}

def _normalize_symbol(symbol: str) -> str:
    """BTCUSDT -> BTC, BTC-USD -> BTC, bitcoin -> BTC etc."""
    s = symbol.upper().replace("-USD","").replace("USDT","").replace("USD","")
    return s.strip()

async def _fetch_coingecko(symbol: str) -> dict | None:
    cg_id = _COINGECKO_IDS.get(symbol.upper())
    if not cg_id:
        return None
    api_key = os.environ.get("COINGECKO_API_KEY", "")
    headers = {"x-cg-demo-api-key": api_key} if api_key else {}
    url = (
        f"https://api.coingecko.com/api/v3/coins/{cg_id}"
        "?localization=false&tickers=false&community_data=false"
        "&developer_data=false&sparkline=false"
    )
    try:
        import aiohttp
        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=TIMEOUT)) as r:
                if r.status != 200:
                    return None
                d = await r.json()
        mkt = d.get("market_data", {})
        price = mkt.get("current_price", {}).get("usd", 0)
        high  = mkt.get("high_24h", {}).get("usd", 0)
        low   = mkt.get("low_24h", {}).get("usd", 0)
        vol   = mkt.get("total_volume", {}).get("usd", 0)
        chg   = mkt.get("price_change_percentage_24h", 0)
        mc    = mkt.get("market_cap", {}).get("usd", 0)
        return {
            "symbol": symbol, "price": price, "high": high, "low": low,
            "volume": vol, "change_pct": chg, "market_cap": mc,
            "source": "coingecko",
        }
    except Exception as e:
        log.debug(f"CoinGecko {symbol}: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# STOCKS — Finnhub (birincil) + TwelveData (ikincil) + yfinance (fallback)
# ══════════════════════════════════════════════════════════════════════════════
async def _fetch_finnhub(symbol: str) -> dict | None:
    key = os.environ.get("FINNHUB_API_KEY", "")
    if not key:
        return None
    try:
        import aiohttp
        # Quote
        q_url = f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={key}"
        # Company profile (for name)
        p_url = f"https://finnhub.io/api/v1/stock/profile2?symbol={symbol}&token={key}"
        async with aiohttp.ClientSession() as session:
            t = aiohttp.ClientTimeout(total=TIMEOUT)
            async with session.get(q_url, timeout=t) as r:
                quote = await r.json() if r.status == 200 else {}
            async with session.get(p_url, timeout=t) as r:
                profile = await r.json() if r.status == 200 else {}
        if not quote.get("c"):
            return None
        price = float(quote["c"])
        prev  = float(quote.get("pc", price))
        chg   = ((price - prev) / prev * 100) if prev else 0
        return {
            "symbol": symbol,
            "price": price,
            "high": float(quote.get("h", 0)),
            "low": float(quote.get("l", 0)),
            "open": float(quote.get("o", 0)),
            "prev_close": prev,
            "volume": 0,
            "change_pct": round(chg, 4),
            "market_cap": profile.get("marketCapitalization", 0),
            "name": profile.get("name", symbol),
            "source": "finnhub",
        }
    except Exception as e:
        log.debug(f"Finnhub {symbol}: {e}")
        return None


async def _fetch_twelvedata(symbol: str) -> dict | None:
    key = os.environ.get("TWELVEDATA_API_KEY", "")
    if not key:
        return None
    try:
        import aiohttp
        url = f"https://api.twelvedata.com/price?symbol={symbol}&apikey={key}"
        url2 = f"https://api.twelvedata.com/quote?symbol={symbol}&apikey={key}"
        async with aiohttp.ClientSession() as session:
            t = aiohttp.ClientTimeout(total=TIMEOUT)
            async with session.get(url2, timeout=t) as r:
                d = await r.json() if r.status == 200 else {}
        if d.get("status") == "error" or not d.get("close"):
            return None
        price = float(d["close"])
        prev  = float(d.get("previous_close", price))
        chg   = ((price - prev) / prev * 100) if prev else 0
        return {
            "symbol": symbol,
            "price": price,
            "high": float(d.get("high", 0)),
            "low": float(d.get("low", 0)),
            "volume": float(d.get("volume", 0)),
            "change_pct": round(chg, 4),
            "name": d.get("name", symbol),
            "exchange": d.get("exchange", ""),
            "source": "twelvedata",
        }
    except Exception as e:
        log.debug(f"TwelveData {symbol}: {e}")
        return None


async def _fetch_yfinance(symbol: str, category: str = "stock") -> dict | None:
    """yfinance sync API — thread'de çalıştırılır."""
    try:
        import yfinance as yf
        # BIST hisseleri için .IS suffix
        yf_sym = symbol
        if category == "turkey" and not symbol.endswith(".IS"):
            yf_sym = f"{symbol}.IS"
        elif category == "index":
            _idx = {"S&P500": "^GSPC", "NDX": "^NDX", "DJI": "^DJI",
                    "BIST100": "XU100.IS", "DAX": "^GDAXI", "FTSE100": "^FTSE", "N225": "^N225"}
            yf_sym = _idx.get(symbol, symbol)
        elif category == "forex":
            yf_sym = symbol.replace("/", "") + "=X"
        elif category in ("precious", "energy"):
            _comm = {"XAU/USD": "GC=F", "XAG/USD": "SI=F", "XPT/USD": "PL=F",
                     "WTI": "CL=F", "BRENT": "BZ=F", "NATGAS": "NG=F"}
            yf_sym = _comm.get(symbol, symbol)

        def _sync():
            t = yf.Ticker(yf_sym)
            info = t.fast_info
            return {
                "price": getattr(info, "last_price", None) or getattr(info, "regularMarketPrice", 0),
                "high":  getattr(info, "day_high", 0),
                "low":   getattr(info, "day_low", 0),
                "prev_close": getattr(info, "previous_close", 0),
                "volume": getattr(info, "three_month_average_volume", 0),
            }

        d = await asyncio.wait_for(asyncio.to_thread(_sync), timeout=10)
        if not d["price"]:
            return None
        prev  = d["prev_close"] or d["price"]
        chg   = ((d["price"] - prev) / prev * 100) if prev else 0
        return {
            "symbol": symbol,
            "price": float(d["price"]),
            "high": float(d["high"]),
            "low": float(d["low"]),
            "volume": float(d["volume"]),
            "change_pct": round(chg, 4),
            "source": "yfinance",
        }
    except Exception as e:
        log.debug(f"yfinance {symbol}: {e}")
        return None


# ══════════════════════════════════════════════════════════════════════════════
# TECHNICAL INDICATORS — hesapla (fiyat verisi yoksa basit tahmin)
# ══════════════════════════════════════════════════════════════════════════════
def _compute_technicals(price: float, high: float, low: float, change_pct: float) -> dict:
    """Basit teknik göstergeler — gerçek history olmadan heuristic."""
    if not price:
        return {}
    spread = (high - low) / price * 100 if price else 0
    rsi_approx = 50 + (change_pct * 2.5)  # heuristic
    rsi_approx = max(10, min(90, rsi_approx))
    return {
        "rsi_14": round(rsi_approx, 1),
        "spread_pct": round(spread, 3),
        "volatility_percentile": round(min(99, spread * 10), 1),
        "trend": "bullish" if change_pct > 1 else ("bearish" if change_pct < -1 else "sideways"),
    }


# ══════════════════════════════════════════════════════════════════════════════
# MAIN: fetch_market_data — tek giriş noktası
# ══════════════════════════════════════════════════════════════════════════════
async def fetch_market_data(symbol: str, category: str) -> dict:
    """
    Katmanlı veri çekimi:
    crypto  → CoinGecko → yfinance
    stock   → Finnhub → TwelveData → yfinance
    forex   → TwelveData → yfinance
    precious/energy → TwelveData → yfinance
    index   → TwelveData → yfinance
    etf     → Finnhub → TwelveData → yfinance
    """
    data = None

    if category == "crypto":
        data = await _fetch_coingecko(symbol)
        if not data:
            data = await _fetch_yfinance(symbol, category)

    elif category in ("us", "etf"):
        data = await _fetch_finnhub(symbol)
        if not data:
            data = await _fetch_twelvedata(symbol)
        if not data:
            data = await _fetch_yfinance(symbol, category)

    elif category == "turkey":
        data = await _fetch_twelvedata(f"{symbol}.IS")
        if not data:
            data = await _fetch_finnhub(f"{symbol}.IS")
        if not data:
            data = await _fetch_yfinance(symbol, category)

    elif category in ("forex", "precious", "energy"):
        data = await _fetch_twelvedata(symbol)
        if not data:
            data = await _fetch_yfinance(symbol, category)

    elif category == "index":
        data = await _fetch_twelvedata(symbol)
        if not data:
            data = await _fetch_yfinance(symbol, category)

    else:
        # Genel fallback
        data = await _fetch_finnhub(symbol) or await _fetch_twelvedata(symbol) or await _fetch_yfinance(symbol, category)

    if not data:
        log.warning(f"All sources failed for {symbol} ({category}) — using price=0")
        data = {"symbol": symbol, "price": 0, "high": 0, "low": 0, "volume": 0, "change_pct": 0, "source": "none"}

    # Teknik göstergeler ekle
    data["technicals"] = _compute_technicals(
        price=data.get("price", 0),
        high=data.get("high", 0),
        low=data.get("low", 0),
        change_pct=data.get("change_pct", 0),
    )
    data["category"] = category
    return data
