import time
import requests
from .config import API_KEYS

HEADERS = {"User-Agent": "GlobalAIPremiumEngine/1.0"}

# FAZ 2A - source capability matrix (asset class -> allowed sources)
SOURCE_CAPABILITY_MATRIX = {
    "crypto": {"Binance", "Coinbase", "Bybit", "OKX", "CoinMarketCap", "CoinGecko"},
    "bist": {"Yahoo"},
    "us_stock": {"TwelveData", "Yahoo"},
    "forex": {"Yahoo"},
    "index": {"Yahoo"},
    "commodity": {"Yahoo"},
    "other": {"Yahoo"},
}

COINGECKO_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "BNB": "binancecoin",
    "AVAX": "avalanche-2",
    "XRP": "ripple",
    "ADA": "cardano",
    "DOGE": "dogecoin",
}


def _as_float(value):
    if value in (None, "", "None", "null"):
        return None
    try:
        return float(value)
    except Exception:
        return None


def resolve_signal_asset_class(asset):
    base = str(asset.get("assetClass") or "").lower()
    market = str(asset.get("market") or "").lower()
    if base == "crypto":
        return "crypto"
    if base == "stock" and market == "turkey":
        return "bist"
    if base in ("stock", "etf") and market in ("us", "etf", "energy"):
        return "us_stock"
    if base == "forex":
        return "forex"
    if base == "index":
        return "index"
    if base == "commodity":
        return "commodity"
    return "other"


def normalize_symbol(symbol, asset_class):
    s = str(symbol or "").strip().upper()
    cls = str(asset_class or "").strip().lower()
    if not s:
        return s

    if cls == "bist":
        if s.endswith(".TRT"):
            s = s.replace(".TRT", ".IS")
        if s.endswith(".IS") or "=" in s or s.startswith("^"):
            return s
        return f"{s}.IS"

    if cls == "forex":
        if s.endswith("=X"):
            return s
        compact = s.replace("/", "").replace("-", "")
        if len(compact) == 6 and compact.isalnum():
            return f"{compact}=X"
        return s

    if cls == "crypto":
        if s.endswith("USDT"):
            return f"{s[:-4]}-USD"
        if s.endswith("USD") and "-" not in s and len(s) > 3:
            return f"{s[:-3]}-USD"
        if "-" in s:
            return s
        return f"{s}-USD"

    if cls == "commodity":
        return s if s.endswith("=F") else f"{s}=F"

    if cls == "index":
        return s

    return s


def _source_allowed(asset, source):
    signal_class = resolve_signal_asset_class(asset)
    allowed = SOURCE_CAPABILITY_MATRIX.get(signal_class, SOURCE_CAPABILITY_MATRIX["other"])
    return source in allowed


def source_allowed_for_asset(asset, source):
    return _source_allowed(asset, source)


def _symbol_for_source(asset, source):
    signal_class = resolve_signal_asset_class(asset)
    normalized = normalize_symbol(asset.get("symbol"), signal_class)
    if source in ("Binance", "Bybit", "OKX"):
        if signal_class != "crypto":
            return normalized
        base = normalized.split("-")[0]
        return f"{base}USDT"
    if source == "Coinbase":
        return normalized
    if source in ("CoinMarketCap", "CoinGecko"):
        return normalized.split("-")[0]
    if source == "AlphaVantage" and signal_class == "bist":
        return normalized.replace(".IS", ".TRT")
    if source == "FMP" and signal_class == "bist":
        return normalized.replace(".IS", "")
    return normalized


def build_standard_signal(symbol, price=None, change_pct=None, volume=None, volatility=None, consistency_score=None, asset_class=None):
    price_f = _as_float(price)
    change_f = _as_float(change_pct)
    volume_f = _as_float(volume)
    volatility_f = _as_float(volatility)

    if change_f is None:
        change_f = 0.0
    if volume_f is None:
        volume_f = 0.0
    if volatility_f is None:
        volatility_f = abs(change_f)
    if consistency_score is None:
        consistency_score = 55.0 if price_f is not None else 0.0

    return {
        "symbol": str(symbol or "").upper(),
        "price": price_f,
        "change_pct": change_f,
        "volume": volume_f,
        "volatility": volatility_f,
        "consistency_score": float(consistency_score),
        "asset_class": str(asset_class or ""),
    }


def _get(url, params=None, headers=None, timeout=6):
    started = time.perf_counter()
    r = requests.get(url, params=params, headers={**HEADERS, **(headers or {})}, timeout=timeout)
    latency = int((time.perf_counter() - started) * 1000)
    r.raise_for_status()
    return r.json(), latency


def point(source, asset, ok=True, error=None, price=None, change=None, volume=None, volatility=None, trust=.5, latency=None, consistency_score=None):
    signal_class = resolve_signal_asset_class(asset)
    normalized_asset_symbol = normalize_symbol(asset.get("symbol"), signal_class)
    standard = build_standard_signal(
        symbol=normalized_asset_symbol,
        price=price,
        change_pct=change,
        volume=volume,
        volatility=volatility,
        consistency_score=consistency_score,
        asset_class=signal_class,
    )
    return {
        "source": source, "ok": ok, "error": error, "price": price, "change": change,
        "volume": volume, "volatility": volatility, "trust": trust, "latencyMs": latency,
        "symbol": asset["symbol"], "display": asset["display"], "name": asset["name"],
        "market": asset["market"], "assetClass": asset["assetClass"],
        "change_pct": standard["change_pct"],
        "consistency_score": standard["consistency_score"],
        "asset_class": standard["asset_class"],
    }


def fetch_finnhub(asset):
    if not _source_allowed(asset, "Finnhub"):
        return None
    key = API_KEYS.get("finnhub")
    if not key:
        return None
    symbol = _symbol_for_source(asset, "Finnhub")
    try:
        data, ms = _get("https://finnhub.io/api/v1/quote", {"symbol": symbol, "token": key})
        price = float(data.get("c") or 0)
        prev = float(data.get("pc") or 0)
        if price <= 0:
            raise RuntimeError("Finnhub fiyat bos")
        change = ((price - prev) / prev * 100) if prev else None
        return point("Finnhub", asset, price=price, change=change, trust=.78, latency=ms)
    except Exception as e:
        return point("Finnhub", asset, ok=False, error=str(e), trust=.18)


def fetch_twelvedata(asset):
    if not _source_allowed(asset, "TwelveData"):
        return None
    key = API_KEYS.get("twelvedata")
    if not key:
        return None
    symbol = _symbol_for_source(asset, "TwelveData")
    try:
        data, ms = _get("https://api.twelvedata.com/quote", {"symbol": symbol, "apikey": key})
        if data.get("status") == "error":
            raise RuntimeError(data.get("message", "TwelveData error"))
        price = float(data.get("close") or data.get("price") or 0)
        change = float(data.get("percent_change") or 0)
        volume = float(data.get("volume") or 0)
        if price <= 0:
            raise RuntimeError("TwelveData fiyat bos")
        return point("TwelveData", asset, price=price, change=change, volume=volume, trust=.76, latency=ms)
    except Exception as e:
        return point("TwelveData", asset, ok=False, error=str(e), trust=.18)


def fetch_alphavantage(asset):
    if not _source_allowed(asset, "AlphaVantage"):
        return None
    key = API_KEYS.get("alphavantage")
    if not key:
        return None
    symbol = _symbol_for_source(asset, "AlphaVantage")
    try:
        data, ms = _get("https://www.alphavantage.co/query", {"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": key})
        q = data.get("Global Quote", {})
        price = float(q.get("05. price") or 0)
        change = float((q.get("10. change percent") or "0%").replace("%", ""))
        volume = float(q.get("06. volume") or 0)
        if price <= 0:
            raise RuntimeError("AlphaVantage fiyat bos")
        return point("AlphaVantage", asset, price=price, change=change, volume=volume, trust=.70, latency=ms)
    except Exception as e:
        return point("AlphaVantage", asset, ok=False, error=str(e), trust=.14)


def fetch_fmp(asset):
    if not _source_allowed(asset, "FMP"):
        return None
    key = API_KEYS.get("fmp")
    if not key:
        return None
    symbol = _symbol_for_source(asset, "FMP")
    try:
        data, ms = _get(f"https://financialmodelingprep.com/api/v3/quote/{symbol}", {"apikey": key})
        if not data:
            raise RuntimeError("FMP bos")
        q = data[0]
        price = float(q.get("price") or 0)
        change = float(q.get("changesPercentage") or 0)
        volume = float(q.get("volume") or 0)
        if price <= 0:
            raise RuntimeError("FMP fiyat bos")
        return point("FMP", asset, price=price, change=change, volume=volume, trust=.74, latency=ms)
    except Exception as e:
        return point("FMP", asset, ok=False, error=str(e), trust=.16)


def fetch_coinmarketcap(asset):
    if not _source_allowed(asset, "CoinMarketCap"):
        return None
    key = API_KEYS.get("coinmarketcap")
    if not key:
        return None
    symbol = _symbol_for_source(asset, "CoinMarketCap")
    try:
        data, ms = _get(
            "https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest",
            {"symbol": symbol, "convert": "USD"},
            {"X-CMC_PRO_API_KEY": key},
        )
        q = data.get("data", {}).get(symbol, {}).get("quote", {}).get("USD", {})
        price = float(q.get("price") or 0)
        change = float(q.get("percent_change_24h") or 0)
        volume = float(q.get("volume_24h") or 0)
        if price <= 0:
            raise RuntimeError("CMC fiyat bos")
        return point("CoinMarketCap", asset, price=price, change=change, volume=volume, trust=.80, latency=ms)
    except Exception as e:
        return point("CoinMarketCap", asset, ok=False, error=str(e), trust=.18)


def fetch_coingecko(asset):
    if not _source_allowed(asset, "CoinGecko"):
        return None
    base = _symbol_for_source(asset, "CoinGecko")
    cid = COINGECKO_IDS.get(base)
    if not cid:
        return None
    try:
        headers = {}
        if API_KEYS.get("coingecko"):
            headers["x-cg-demo-api-key"] = API_KEYS["coingecko"]
        data, ms = _get(
            "https://api.coingecko.com/api/v3/simple/price",
            {"ids": cid, "vs_currencies": "usd", "include_24hr_change": "true", "include_24hr_vol": "true"},
            headers,
        )
        q = data.get(cid, {})
        price = float(q.get("usd") or 0)
        change = float(q.get("usd_24h_change") or 0)
        volume = float(q.get("usd_24h_vol") or 0)
        if price <= 0:
            raise RuntimeError("CoinGecko fiyat bos")
        return point("CoinGecko", asset, price=price, change=change, volume=volume, trust=.66, latency=ms)
    except Exception as e:
        return point("CoinGecko", asset, ok=False, error=str(e), trust=.14)


def fetch_bybit(asset):
    if not _source_allowed(asset, "Bybit"):
        return None
    symbol = _symbol_for_source(asset, "Bybit")
    try:
        data, ms = _get("https://api.bybit.com/v5/market/tickers", {"category": "spot", "symbol": symbol})
        rows = data.get("result", {}).get("list", [])
        if not rows:
            raise RuntimeError("Bybit bos")
        q = rows[0]
        price = float(q.get("lastPrice") or 0)
        prev = float(q.get("prevPrice24h") or 0)
        change = ((price - prev) / prev * 100) if prev else float(q.get("price24hPcnt") or 0) * 100
        volume = float(q.get("turnover24h") or 0)
        high = float(q.get("highPrice24h") or price)
        low = float(q.get("lowPrice24h") or price)
        volatility = ((high - low) / price * 100) if price else abs(change)
        return point("Bybit", asset, price=price, change=change, volume=volume, volatility=volatility, trust=.74, latency=ms)
    except Exception as e:
        return point("Bybit", asset, ok=False, error=str(e), trust=.16)


def fetch_okx(asset):
    if not _source_allowed(asset, "OKX"):
        return None
    symbol = _symbol_for_source(asset, "OKX").replace("USDT", "-USDT")
    try:
        data, ms = _get("https://www.okx.com/api/v5/market/ticker", {"instId": symbol})
        rows = data.get("data", [])
        if not rows:
            raise RuntimeError("OKX bos")
        q = rows[0]
        price = float(q.get("last") or 0)
        open24 = float(q.get("open24h") or 0)
        change = ((price - open24) / open24 * 100) if open24 else 0
        volume = float(q.get("volCcy24h") or q.get("vol24h") or 0)
        high = float(q.get("high24h") or price)
        low = float(q.get("low24h") or price)
        volatility = ((high - low) / price * 100) if price else abs(change)
        return point("OKX", asset, price=price, change=change, volume=volume, volatility=volatility, trust=.74, latency=ms)
    except Exception as e:
        return point("OKX", asset, ok=False, error=str(e), trust=.16)


PREMIUM_SOURCE_FUNCTIONS = [
    fetch_finnhub,
    fetch_twelvedata,
    fetch_alphavantage,
    fetch_fmp,
    fetch_coinmarketcap,
    fetch_coingecko,
    fetch_bybit,
    fetch_okx,
]
