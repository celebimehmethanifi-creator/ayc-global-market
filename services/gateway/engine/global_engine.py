import copy
import math
import time
import statistics
import requests
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from .universe import ASSET_UNIVERSE
from .premium_sources import (
    build_standard_signal,
    normalize_symbol,
    resolve_signal_asset_class,
    source_allowed_for_asset,
    fetch_twelvedata,
    fetch_bybit,
    fetch_okx,
    fetch_coinmarketcap,
    fetch_coingecko,
)
from .premium_flow import flow_overlay
from .ai_orchestrator import ai_overlay

HEADERS = {"User-Agent": "Mozilla/5.0 GlobalAIFirsatMotoru/2.0"}
YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
YAHOO_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search"
BINANCE = "https://api.binance.com/api/v3/ticker/24hr"
BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
COINBASE = "https://api.coinbase.com/v2/prices/{pair}/spot"
COINBASE_SUPPORTED_PAIRS = {"BTC-USD", "ETH-USD", "SOL-USD", "AVAX-USD", "XRP-USD", "ADA-USD", "DOGE-USD"}

# FAZ 2A: signal cache (30-60s)
SIGNAL_CACHE = {}
SIGNAL_CACHE_TTL_SECONDS = 45

# FAZ 2B: market status cache (same short horizon)
MARKET_STATUS_CACHE = {}
MARKET_STATUS_CACHE_TTL_SECONDS = 45

# FAZ 4A: search cache + dynamic asset registry
SEARCH_RESULT_CACHE = {}
SEARCH_RESULT_CACHE_TTL_SECONDS = 60
DYNAMIC_ASSET_REGISTRY = {}

# FAZ 4B: asset history cache (basic chart data)
HISTORY_CACHE = {}
HISTORY_CACHE_TTL_SECONDS = 60
HISTORY_TIMEFRAME_MAP = {
    "1D": {"range": "1d", "interval": "5m"},
    "1W": {"range": "5d", "interval": "30m"},
    "1M": {"range": "1mo", "interval": "1d"},
    "1Y": {"range": "1y", "interval": "1wk"},
}
BINANCE_HISTORY_TIMEFRAME_MAP = {
    "1D": {"interval": "5m", "limit": 288},
    "1W": {"interval": "30m", "limit": 336},
    "1M": {"interval": "1d", "limit": 31},
    "1Y": {"interval": "1w", "limit": 53},
}

# FAZ 2C: smart multi-source controls
SMART_MULTI_SOURCE_MAX = 3
SMART_CONSISTENCY_THRESHOLD = 0.9

# FAZ 2D: asset-class tuned weights
ASSET_CLASS_SCORE_WEIGHTS = {
    "crypto": {"momentum": 0.35, "volume": 0.20, "volatility": 0.30, "consistency": 0.15},
    "bist": {"momentum": 0.38, "volume": 0.22, "volatility": 0.22, "consistency": 0.18},
    "us_stock": {"momentum": 0.45, "volume": 0.30, "volatility": 0.15, "consistency": 0.10},
    "forex": {"momentum": 0.30, "volume": 0.15, "volatility": 0.35, "consistency": 0.20},
    "index": {"momentum": 0.35, "volume": 0.10, "volatility": 0.35, "consistency": 0.20},
    "commodity": {"momentum": 0.30, "volume": 0.20, "volatility": 0.30, "consistency": 0.20},
    "other": {"momentum": 0.40, "volume": 0.30, "volatility": 0.20, "consistency": 0.10},
}

# Test hook (used by deterministic tests)
TEST_NOW_UTC = None


def get_json(url, params=None, timeout=5):
    t = time.perf_counter()
    r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
    ms = int((time.perf_counter() - t) * 1000)
    r.raise_for_status()
    return r.json(), ms


def _now_utc():
    if TEST_NOW_UTC is not None:
        return TEST_NOW_UTC
    return datetime.now(timezone.utc)


def _cache_key_for_asset(asset):
    signal_class = resolve_signal_asset_class(asset)
    normalized_symbol = normalize_symbol(asset.get("symbol"), signal_class)
    return f"{normalized_symbol}::{signal_class}"


def _cache_get_asset(asset):
    key = _cache_key_for_asset(asset)
    entry = SIGNAL_CACHE.get(key)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        SIGNAL_CACHE.pop(key, None)
        return None
    return copy.deepcopy(entry["payload"])


def _cache_set_asset(asset, payload):
    key = _cache_key_for_asset(asset)
    SIGNAL_CACHE[key] = {
        "expires_at": time.time() + SIGNAL_CACHE_TTL_SECONDS,
        "payload": copy.deepcopy(payload),
    }


def _status_cache_get(asset):
    key = _cache_key_for_asset(asset)
    entry = MARKET_STATUS_CACHE.get(key)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        MARKET_STATUS_CACHE.pop(key, None)
        return None
    return dict(entry["payload"])


def _status_cache_set(asset, payload):
    key = _cache_key_for_asset(asset)
    MARKET_STATUS_CACHE[key] = {
        "expires_at": time.time() + MARKET_STATUS_CACHE_TTL_SECONDS,
        "payload": dict(payload),
    }


def _normalize_lookup_input(symbol):
    return str(symbol or "").strip().upper()


def _search_cache_get(query):
    key = _normalize_lookup_input(query)
    if not key:
        return None
    entry = SEARCH_RESULT_CACHE.get(key)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        SEARCH_RESULT_CACHE.pop(key, None)
        return None
    return copy.deepcopy(entry["payload"])


def _search_cache_set(query, payload):
    key = _normalize_lookup_input(query)
    if not key:
        return
    SEARCH_RESULT_CACHE[key] = {
        "expires_at": time.time() + SEARCH_RESULT_CACHE_TTL_SECONDS,
        "payload": copy.deepcopy(payload),
    }


def _history_cache_key(asset, timeframe):
    symbol = _normalize_lookup_input(asset.get("symbol"))
    tf = _normalize_lookup_input(timeframe)
    return f"{symbol}::{tf}"


def _history_cache_get(asset, timeframe):
    key = _history_cache_key(asset, timeframe)
    entry = HISTORY_CACHE.get(key)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        HISTORY_CACHE.pop(key, None)
        return None
    return copy.deepcopy(entry["payload"])


def _history_cache_set(asset, timeframe, payload):
    key = _history_cache_key(asset, timeframe)
    HISTORY_CACHE[key] = {
        "expires_at": time.time() + HISTORY_CACHE_TTL_SECONDS,
        "payload": copy.deepcopy(payload),
    }


def _tokenize_lookup_values(value):
    raw = _normalize_lookup_input(value)
    if not raw:
        return set()
    tokens = {raw}
    compact = raw.replace("/", "").replace("-", "").replace("_", "").replace(" ", "")
    tokens.add(compact)
    if "." in raw:
        tokens.add(raw.split(".", 1)[0])
    if "=" in raw:
        tokens.add(raw.split("=", 1)[0])
    if "-" in raw:
        tokens.add(raw.split("-", 1)[0])
    if compact.endswith("USDT") and len(compact) > 4:
        tokens.add(compact[:-4])
    if compact.endswith("USD") and len(compact) > 3:
        tokens.add(compact[:-3])
    if compact.endswith("IS") and len(compact) > 2:
        tokens.add(compact[:-2])
    return {t for t in tokens if t}


def _asset_lookup_tokens(asset):
    signal_class = resolve_signal_asset_class(asset)
    symbol = _normalize_lookup_input(asset.get("symbol"))
    display = _normalize_lookup_input(asset.get("display"))
    normalized_symbol = _normalize_lookup_input(normalize_symbol(symbol, signal_class))
    normalized_display = _normalize_lookup_input(normalize_symbol(display, signal_class))
    tokens = set()
    for candidate in (symbol, display, normalized_symbol, normalized_display):
        tokens.update(_tokenize_lookup_values(candidate))
    return tokens


def _crypto_base_symbol(value):
    raw = _normalize_lookup_input(value)
    if not raw:
        return ""
    compact = raw.replace("/", "").replace("-", "").replace("_", "").replace(" ", "")
    if compact.endswith("USDT") and len(compact) > 4:
        return compact[:-4]
    if compact.endswith("USD") and len(compact) > 3:
        return compact[:-3]
    if "-" in raw:
        return raw.split("-", 1)[0]
    return compact


def _asset_symbol_profile(asset):
    signal_class = resolve_signal_asset_class(asset)
    raw_symbol = _normalize_lookup_input(asset.get("symbol"))
    raw_display = _normalize_lookup_input(asset.get("display")) or raw_symbol
    asset_class = str(asset.get("assetClass") or "").lower()
    canonical = _normalize_lookup_input(normalize_symbol(raw_symbol or raw_display, signal_class))
    profile = {
        "display_symbol": raw_display or raw_symbol,
        "canonical_symbol": canonical,
        "source_symbols": {"yahoo": canonical},
    }
    if signal_class == "crypto" or asset_class == "crypto":
        base = _crypto_base_symbol(raw_symbol or raw_display)
        if base:
            profile["canonical_symbol"] = f"{base}-USD"
            profile["source_symbols"]["yahoo"] = profile["canonical_symbol"]
            profile["source_symbols"]["binance"] = f"{base}USDT"
            if not profile["display_symbol"]:
                profile["display_symbol"] = f"{base}USDT"
    return profile


def _asset_search_row(asset):
    symbol_profile = _asset_symbol_profile(asset)
    return {
        "symbol": str(asset.get("symbol") or "").upper(),
        "display_symbol": str(symbol_profile.get("display_symbol") or asset.get("display") or asset.get("symbol") or "").upper(),
        "canonical_symbol": str(symbol_profile.get("canonical_symbol") or "").upper(),
        "source_symbols": {
            "yahoo": str((symbol_profile.get("source_symbols") or {}).get("yahoo") or "").upper(),
            "binance": str((symbol_profile.get("source_symbols") or {}).get("binance") or "").upper(),
        },
        "name": str(asset.get("name") or asset.get("display") or asset.get("symbol") or ""),
        "asset_class": str(asset.get("assetClass") or "unknown").lower(),
    }


def _local_search_assets(query, limit=5):
    q = _normalize_lookup_input(query)
    if not q:
        return []
    scored = []
    q_tokens = _tokenize_lookup_values(q)
    for idx, asset in enumerate(ASSET_UNIVERSE):
        symbol = _normalize_lookup_input(asset.get("symbol"))
        display = _normalize_lookup_input(asset.get("display"))
        asset_tokens = _asset_lookup_tokens(asset)
        score = None
        if q == symbol:
            score = 0
        elif q == display:
            score = 1
        elif q in asset_tokens:
            score = 2
        else:
            intersection = q_tokens.intersection(asset_tokens)
            if intersection:
                score = 3
        if score is None:
            continue
        scored.append((score, idx, asset))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [row[2] for row in scored[:max(1, int(limit))]]


def _map_yahoo_quote_asset_class(row):
    symbol = _normalize_lookup_input(row.get("symbol"))
    quote_type = _normalize_lookup_input(row.get("quoteType"))
    type_disp = _normalize_lookup_input(row.get("typeDisp"))

    if symbol.startswith("^"):
        return "index"
    if symbol.endswith("=X") or quote_type == "CURRENCY" or type_disp == "CURRENCIES":
        return "forex"
    if symbol.endswith("=F") or quote_type == "FUTURE" or type_disp == "FUTURES":
        return "commodity"
    if quote_type == "CRYPTOCURRENCY" or type_disp == "CRYPTOCURRENCIES" or symbol.endswith("-USD"):
        return "crypto"
    if quote_type == "ETF" or type_disp == "ETFS":
        return "etf"
    if quote_type == "INDEX" or type_disp == "INDICES":
        return "index"
    return "stock"


def _map_yahoo_asset_market(symbol, asset_class):
    s = _normalize_lookup_input(symbol)
    if asset_class == "crypto":
        return "crypto"
    if asset_class == "forex":
        return "forex"
    if asset_class == "index":
        return "index"
    if asset_class == "commodity":
        if s in {"CL=F", "BZ=F", "NG=F"}:
            return "energy"
        return "precious"
    if asset_class == "etf":
        return "etf"
    if s.endswith(".IS"):
        return "turkey"
    return "us"


def _dynamic_asset_from_yahoo_row(row):
    symbol = _normalize_lookup_input(row.get("symbol"))
    if not symbol:
        return None
    name = str(row.get("shortname") or row.get("longname") or symbol).strip()
    asset_class = _map_yahoo_quote_asset_class(row)
    market = _map_yahoo_asset_market(symbol, asset_class)
    asset = {
        "symbol": symbol,
        "display": symbol,
        "name": name or symbol,
        "assetClass": asset_class,
        "market": market,
        "temporary": True,
    }
    DYNAMIC_ASSET_REGISTRY[symbol] = asset
    return asset


def _yahoo_search_assets(query, limit=5):
    q = _normalize_lookup_input(query)
    if not q:
        return []
    try:
        payload, _ = get_json(YAHOO_SEARCH, {"q": q, "quotesCount": max(5, int(limit)), "newsCount": 0})
        quotes = payload.get("quotes", []) if isinstance(payload, dict) else []
    except Exception:
        return []

    out = []
    used = set()
    for row in quotes:
        asset = _dynamic_asset_from_yahoo_row(row or {})
        if not asset:
            continue
        sym = _normalize_lookup_input(asset.get("symbol"))
        if not sym or sym in used:
            continue
        used.add(sym)
        out.append(asset)
        if len(out) >= max(1, int(limit)):
            break
    return out


def search_assets(query, limit=5, refresh=False):
    q = _normalize_lookup_input(query)
    if not q:
        return []

    if not refresh:
        cached = _search_cache_get(q)
        if cached is not None:
            return cached

    local_assets = _local_search_assets(q, limit=limit)
    if local_assets:
        rows = [_asset_search_row(a) for a in local_assets][:max(1, int(limit))]
        _search_cache_set(q, rows)
        return rows

    dynamic_assets = _yahoo_search_assets(q, limit=limit)
    rows = [_asset_search_row(a) for a in dynamic_assets][:max(1, int(limit))]
    _search_cache_set(q, rows)
    return rows


def fetch_asset_history(asset, timeframe="1M", refresh=False):
    tf = _normalize_lookup_input(timeframe or "1M")
    if tf not in HISTORY_TIMEFRAME_MAP:
        raise ValueError("timeframe desteklenmiyor")

    if not refresh:
        cached = _history_cache_get(asset, tf)
        if cached is not None:
            return cached

    signal_class = resolve_signal_asset_class(asset)
    asset_class = str(asset.get("assetClass") or "").lower()
    symbol_profile = _asset_symbol_profile(asset)
    canonical_symbol = str(symbol_profile.get("canonical_symbol") or "").upper()
    display_symbol = str(symbol_profile.get("display_symbol") or asset.get("display") or asset.get("symbol") or "").upper()
    source_symbols = symbol_profile.get("source_symbols") or {}
    symbol_out = str(asset.get("symbol") or canonical_symbol or display_symbol).upper()

    def _num_or_none(value):
        try:
            if value is None:
                return None
            num = float(value)
            if math.isfinite(num):
                return num
        except Exception:
            return None
        return None

    def _extract_yahoo_series(payload):
        result = payload.get("chart", {}).get("result", []) if isinstance(payload, dict) else []
        if not result:
            raise ValueError("historical data bulunamadi")

        row = result[0] or {}
        timestamps = row.get("timestamp", []) or []
        quote = ((row.get("indicators", {}) or {}).get("quote", []) or [{}])[0] or {}
        opens = quote.get("open", []) or []
        highs = quote.get("high", []) or []
        lows = quote.get("low", []) or []
        closes = quote.get("close", []) or []
        volumes = quote.get("volume", []) or []

        points = []
        ohlcv = []
        for idx, ts in enumerate(timestamps):
            if ts is None:
                continue
            try:
                t_int = int(ts)
            except Exception:
                continue
            close = _num_or_none(closes[idx] if idx < len(closes) else None)
            if close is None:
                continue
            open_ = _num_or_none(opens[idx] if idx < len(opens) else close)
            high = _num_or_none(highs[idx] if idx < len(highs) else close)
            low = _num_or_none(lows[idx] if idx < len(lows) else close)
            volume = _num_or_none(volumes[idx] if idx < len(volumes) else None)
            points.append([t_int, close])
            ohlcv.append({"t": t_int, "o": open_, "h": high, "l": low, "c": close, "v": volume})
        if not points:
            raise ValueError("historical close serisi bos")
        return points, ohlcv

    def _history_from_yahoo(yahoo_symbol):
        if not yahoo_symbol:
            raise ValueError("yahoo symbol bos")
        params = dict(HISTORY_TIMEFRAME_MAP[tf])
        params["includePrePost"] = "true"
        payload, _ = get_json(YAHOO.format(symbol=yahoo_symbol), params=params, timeout=8)
        points, ohlcv = _extract_yahoo_series(payload)
        return {"points": points, "ohlcv": ohlcv, "source": "Yahoo"}

    def _history_from_binance(binance_symbol):
        if not binance_symbol:
            raise ValueError("binance symbol bos")
        cfg = BINANCE_HISTORY_TIMEFRAME_MAP.get(tf) or {}
        payload, _ = get_json(
            BINANCE_KLINES,
            {"symbol": str(binance_symbol).upper(), "interval": cfg.get("interval", "1d"), "limit": int(cfg.get("limit", 120))},
            timeout=8,
        )
        rows = payload if isinstance(payload, list) else []
        points = []
        ohlcv = []
        for row in rows:
            try:
                t_int = int(int(row[0]) / 1000)
            except Exception:
                continue
            open_ = _num_or_none(row[1] if len(row) > 1 else None)
            high = _num_or_none(row[2] if len(row) > 2 else None)
            low = _num_or_none(row[3] if len(row) > 3 else None)
            close = _num_or_none(row[4] if len(row) > 4 else None)
            volume = _num_or_none(row[5] if len(row) > 5 else None)
            if close is None:
                continue
            points.append([t_int, close])
            ohlcv.append({"t": t_int, "o": open_, "h": high, "l": low, "c": close, "v": volume})
        if not points:
            raise ValueError("binance close serisi bos")
        return {"points": points, "ohlcv": ohlcv, "source": "Binance"}

    def _build_out(data):
        return {
            "status": "ok",
            "symbol": symbol_out,
            "displaySymbol": display_symbol,
            "canonicalSymbol": canonical_symbol,
            "sourceSymbols": {
                "yahoo": str(source_symbols.get("yahoo") or "").upper(),
                "binance": str(source_symbols.get("binance") or "").upper(),
            },
            "timeframe": tf,
            "points": data["points"],
            "ohlcv": data["ohlcv"],
            "source": data["source"],
            "count": len(data["points"]),
        }

    is_crypto = signal_class == "crypto" or asset_class == "crypto"
    is_us_stock = signal_class == "us_stock" and asset_class == "stock"

    if is_crypto:
        yahoo_symbol = source_symbols.get("yahoo") or canonical_symbol
        try:
            out = _build_out(_history_from_yahoo(yahoo_symbol))
            _history_cache_set(asset, tf, out)
            return out
        except Exception:
            binance_symbol = source_symbols.get("binance") or f"{_crypto_base_symbol(symbol_out)}USDT"
            try:
                out = _build_out(_history_from_binance(binance_symbol))
                _history_cache_set(asset, tf, out)
                return out
            except Exception:
                raise ValueError("historical data bulunamadi")

    if is_us_stock:
        out = _build_out(_history_from_yahoo(canonical_symbol or symbol_out))
        _history_cache_set(asset, tf, out)
        return out

    raise ValueError("Bu endpoint su an sadece US stock ve crypto icin destekleniyor.")


def point(source, asset, ok=True, error=None, price=None, change=None, volume=None, volatility=None, trust=.5, latency=None, consistency_score=None, market_state=None):
    signal_class = resolve_signal_asset_class(asset)
    normalized_symbol = normalize_symbol(asset.get("symbol"), signal_class)
    standard = build_standard_signal(
        symbol=normalized_symbol,
        price=price,
        change_pct=change,
        volume=volume,
        volatility=volatility,
        consistency_score=consistency_score,
        asset_class=signal_class,
    )
    return {
        "source": source,
        "ok": ok,
        "error": error,
        "price": price,
        "change": change,
        "volume": volume,
        "volatility": volatility,
        "trust": trust,
        "latencyMs": latency,
        "symbol": asset["symbol"],
        "display": asset["display"],
        "name": asset["name"],
        "market": asset["market"],
        "assetClass": asset["assetClass"],
        "change_pct": standard["change_pct"],
        "consistency_score": standard["consistency_score"],
        "asset_class": standard["asset_class"],
        "marketState": market_state,
    }


def _stable_hash_seed(value):
    text = str(value or "")
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _seeded_fallback_point(asset):
    seed = _stable_hash_seed(f"{asset.get('market')}::{asset.get('assetClass')}::{asset.get('symbol')}")
    segment_pref = str(asset.get("seedSegment") or "").strip().lower()

    if segment_pref == "long":
        change = round(1.2 + ((seed % 360) / 100.0), 2)
    elif segment_pref == "short":
        change = round(-(1.2 + ((seed % 360) / 100.0)), 2)
    elif segment_pref == "stable":
        change = round(((seed % 80) - 40) / 100.0, 2)
    else:
        change = round(((seed % 901) - 450) / 100.0, 2)

    price = round(10.0 + ((seed >> 4) % 250000) / 100.0, 4)
    volume = float(100000 + ((seed >> 9) % 25000000))
    volatility = round(max(0.25, min(12.0, abs(change) * 1.4 + (((seed >> 13) % 40) / 10.0))), 2)
    return point(
        "SeededFallback",
        asset,
        ok=True,
        price=price,
        change=change,
        volume=volume,
        volatility=volatility,
        trust=.34,
        latency=0,
        consistency_score=60.0,
        market_state="SEEDED_FALLBACK",
    )


def _item_numeric(item, key, default=0.0):
    try:
        value = float(item.get(key))
        if math.isfinite(value):
            return value
    except Exception:
        pass
    return float(default)


def _result_mode_rank(item):
    mode = str(item.get("dataMode") or "").strip().lower()
    if mode == "seeded_fallback":
        return 1
    return 0


def _segment_override(item, target):
    out = dict(item)
    if target == "stable":
        out["segment"] = "stable"
        out["segmentKey"] = "stable"
        out["label_key"] = "segment.stable"
        out["segmentLabel"] = "Stable"
        out["uiLabel"] = f"Stable | Score {int(_item_numeric(out, 'score', 0))}/100"
        return out
    if target == "long":
        out["segment"] = "high opportunity"
        out["segmentKey"] = "high_opportunity"
        out["label_key"] = "segment.high_opportunity"
        out["segmentLabel"] = "High Opportunity"
        out["uiLabel"] = f"High Opportunity | Score {int(_item_numeric(out, 'score', 0))}/100"
        return out
    out["segment"] = "risky"
    out["segmentKey"] = "risky"
    out["label_key"] = "segment.risky"
    out["segmentLabel"] = "Risky"
    out["uiLabel"] = f"Risky | Score {int(_item_numeric(out, 'score', 0))}/100"
    return out


def _balanced_market_segments(items, target_per_segment=5):
    if not items:
        return []

    unique = []
    seen = set()
    for item in items:
        key = _cache_key_for_asset(item)
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(item)

    if len(unique) < max(1, target_per_segment * 3):
        return sorted(
            unique,
            key=lambda x: (
                _result_mode_rank(x),
                -_item_numeric(x, "score", 0),
                -_item_numeric(x, "consensusConfidence", 0),
            ),
        )

    stable_pool = sorted(
        unique,
        key=lambda x: (
            _result_mode_rank(x),
            abs(_item_numeric(x, "change", 0.0)),
            -_item_numeric(x, "dataConsistency", 0.0),
            -_item_numeric(x, "score", 0.0),
        ),
    )
    long_pool = sorted(
        unique,
        key=lambda x: (
            _result_mode_rank(x),
            -_item_numeric(x, "change", 0.0),
            -_item_numeric(x, "score", 0.0),
        ),
    )
    short_pool = sorted(
        unique,
        key=lambda x: (
            _result_mode_rank(x),
            _item_numeric(x, "change", 0.0),
            -_item_numeric(x, "score", 0.0),
        ),
    )

    used = set()

    def _pick(pool, count, predicate=None):
        out = []
        for row in pool:
            if len(out) >= count:
                break
            key = _cache_key_for_asset(row)
            if not key or key in used:
                continue
            if predicate and not predicate(row):
                continue
            used.add(key)
            out.append(row)
        return out

    stable = _pick(stable_pool, target_per_segment)
    long = _pick(long_pool, target_per_segment, predicate=lambda x: _item_numeric(x, "change", 0.0) > 0.05)
    if len(long) < target_per_segment:
        long.extend(_pick(long_pool, target_per_segment - len(long)))
    short = _pick(short_pool, target_per_segment, predicate=lambda x: _item_numeric(x, "change", 0.0) < -0.05)
    if len(short) < target_per_segment:
        short.extend(_pick(short_pool, target_per_segment - len(short)))

    if len(stable) < target_per_segment:
        stable.extend(
            _pick(
                sorted(unique, key=lambda x: (_result_mode_rank(x), -_item_numeric(x, "score", 0.0))),
                target_per_segment - len(stable),
            )
        )
    if len(long) < target_per_segment:
        long.extend(
            _pick(
                sorted(unique, key=lambda x: (_result_mode_rank(x), -_item_numeric(x, "score", 0.0))),
                target_per_segment - len(long),
            )
        )
    if len(short) < target_per_segment:
        short.extend(
            _pick(
                sorted(unique, key=lambda x: (_result_mode_rank(x), -_item_numeric(x, "score", 0.0))),
                target_per_segment - len(short),
            )
        )

    preferred = [_segment_override(x, "stable") for x in stable]
    preferred += [_segment_override(x, "long") for x in long]
    preferred += [_segment_override(x, "short") for x in short]

    preferred_keys = {_cache_key_for_asset(p) for p in preferred if _cache_key_for_asset(p)}
    remaining = []
    for row in sorted(
        unique,
        key=lambda x: (_result_mode_rank(x), -_item_numeric(x, "score", 0), -_item_numeric(x, "consensusConfidence", 0)),
    ):
        key = _cache_key_for_asset(row)
        if not key or key in preferred_keys:
            continue
        remaining.append(row)
    return preferred + remaining


def yahoo(asset):
    if not source_allowed_for_asset(asset, "Yahoo"):
        return None
    signal_class = resolve_signal_asset_class(asset)
    symbol = normalize_symbol(asset.get("symbol"), signal_class)
    try:
        d, ms = get_json(YAHOO.format(symbol=symbol), {"range": "5d", "interval": "1h", "includePrePost": "true"})
        res = d.get("chart", {}).get("result", [])
        if not res:
            raise RuntimeError("bos")
        meta = res[0].get("meta", {}) or {}
        market_state = str(meta.get("marketState") or "").upper() or None
        q = res[0].get("indicators", {}).get("quote", [{}])[0]
        closes = [float(x) for x in q.get("close", []) if x is not None]
        highs = [float(x) for x in q.get("high", []) if x is not None]
        lows = [float(x) for x in q.get("low", []) if x is not None]
        vols = [float(x) for x in q.get("volume", []) if x is not None]
        if len(closes) < 2:
            raise RuntimeError("close eksik")
        last = closes[-1]
        old = closes[0]
        ch = ((last - old) / old) * 100 if old else 0
        hi = max(highs) if highs else last
        lo = min(lows) if lows else last
        vol = ((hi - lo) / last) * 100 if last else abs(ch)
        avgv = sum(vols[-20:]) / len(vols[-20:]) if vols[-20:] else 0
        return point("Yahoo", asset, price=last, change=ch, volume=avgv, volatility=vol, trust=.72, latency=ms, market_state=market_state)
    except Exception as e:
        return point("Yahoo", asset, ok=False, error=str(e), trust=.20)


def binance(asset):
    if not source_allowed_for_asset(asset, "Binance"):
        return None
    signal_class = resolve_signal_asset_class(asset)
    normalized = normalize_symbol(asset.get("symbol"), signal_class)
    exchange_symbol = f"{normalized.split('-')[0]}USDT" if "-" in normalized else normalized
    try:
        d, ms = get_json(BINANCE, {"symbol": exchange_symbol})
        last = float(d.get("lastPrice") or 0)
        ch = float(d.get("priceChangePercent") or 0)
        v = float(d.get("quoteVolume") or 0)
        hi = float(d.get("highPrice") or last)
        lo = float(d.get("lowPrice") or last)
        vol = ((hi - lo) / last) * 100 if last else abs(ch)
        return point("Binance", asset, price=last, change=ch, volume=v, volatility=vol, trust=.82, latency=ms)
    except Exception as e:
        return point("Binance", asset, ok=False, error=str(e), trust=.20)


def coinbase(asset):
    if not source_allowed_for_asset(asset, "Coinbase"):
        return None
    signal_class = resolve_signal_asset_class(asset)
    pair = normalize_symbol(asset.get("symbol"), signal_class)
    if pair not in COINBASE_SUPPORTED_PAIRS:
        return None
    try:
        d, ms = get_json(COINBASE.format(pair=pair))
        last = float(d.get("data", {}).get("amount") or 0)
        return point("Coinbase", asset, price=last, change=None, volume=None, volatility=None, trust=.62, latency=ms)
    except Exception as e:
        return point("Coinbase", asset, ok=False, error=str(e), trust=.15)


def _extract_market_state_from_yahoo_payload(payload):
    try:
        result = payload.get("chart", {}).get("result", []) or []
        if not result:
            return None
        meta = result[0].get("meta", {}) or {}
        state = str(meta.get("marketState") or "").upper().strip()
        return state or None
    except Exception:
        return None


def _fetch_yahoo_market_state(asset):
    signal_class = resolve_signal_asset_class(asset)
    symbol = normalize_symbol(asset.get("symbol"), signal_class)
    try:
        payload, _ = get_json(YAHOO.format(symbol=symbol), {"range": "1d", "interval": "1d", "includePrePost": "true"})
        return _extract_market_state_from_yahoo_payload(payload)
    except Exception:
        return None


def _time_fallback_market_status(asset, now_utc=None):
    dt = now_utc or _now_utc()
    signal_class = resolve_signal_asset_class(asset)

    if signal_class == "crypto":
        return {"marketOpen": True, "marketState": "TIME_FALLBACK_24X7", "source": "time_fallback", "reason": "crypto_24x7"}

    if dt.weekday() >= 5:
        return {"marketOpen": False, "marketState": "TIME_FALLBACK_WEEKEND", "source": "time_fallback", "reason": "weekend"}

    minutes = dt.hour * 60 + dt.minute

    if signal_class in ("us_stock", "index"):
        is_open = (14 * 60 + 30) <= minutes < (21 * 60)
        return {
            "marketOpen": is_open,
            "marketState": "TIME_FALLBACK_REGULAR" if is_open else "TIME_FALLBACK_CLOSED",
            "source": "time_fallback",
            "reason": "us_regular_utc_1430_2100",
        }

    if signal_class == "bist":
        is_open = (7 * 60) <= minutes < (15 * 60)
        return {
            "marketOpen": is_open,
            "marketState": "TIME_FALLBACK_REGULAR" if is_open else "TIME_FALLBACK_CLOSED",
            "source": "time_fallback",
            "reason": "bist_regular_utc_0700_1500",
        }

    # forex / commodity / other: weekdays open fallback
    return {"marketOpen": True, "marketState": "TIME_FALLBACK_WEEKDAY_OPEN", "source": "time_fallback", "reason": "weekday_open"}


def get_market_status(asset, points=None, refresh=False):
    if not refresh:
        cached = _status_cache_get(asset)
        if cached:
            return cached

    yahoo_state = None
    if points:
        for p in points:
            if not p:
                continue
            if str(p.get("source") or "").lower() == "yahoo":
                raw_state = str(p.get("marketState") or "").upper().strip()
                if raw_state:
                    yahoo_state = raw_state
                    break

    if not yahoo_state:
        yahoo_state = _fetch_yahoo_market_state(asset)

    if yahoo_state == "REGULAR":
        status = {"marketOpen": True, "marketState": "REGULAR", "source": "yahoo_market_state", "reason": "yahoo_regular"}
        _status_cache_set(asset, status)
        return status
    if yahoo_state == "CLOSED":
        status = {"marketOpen": False, "marketState": "CLOSED", "source": "yahoo_market_state", "reason": "yahoo_closed"}
        _status_cache_set(asset, status)
        return status

    status = _time_fallback_market_status(asset)
    _status_cache_set(asset, status)
    return status


def macro(asset):
    m = asset.get("market")
    reasons = []
    if m == "turkey":
        reasons.append("TCMB/EVDS Turkiye makro katmani notr fallback ile karara dahil.")
    elif m in ("us", "index", "etf", "precious", "energy", "forex"):
        reasons.append("FED/FRED/global likidite katmani notr fallback ile karara dahil.")
    else:
        reasons.append("Kripto icin global likidite/risk istahi katmani notr fallback ile karara dahil.")
    return {"macroScore": 50, "centralBankScore": 50, "currencyPressure": 50, "reasons": reasons}


def weighted(points, key):
    pts = [p for p in points if p and p.get("ok") and p.get(key) is not None]
    if not pts:
        return None
    tw = sum(max(p.get("trust", .1), .01) for p in pts)
    return sum(float(p[key]) * max(p.get("trust", .1), .01) for p in pts) / tw


def consistency_stats(points):
    prices = [float(p["price"]) for p in points if p and p.get("ok") and p.get("price") is not None]
    raw_count = len(prices)
    if raw_count < 2:
        return {
            "consistency_score": 0.0,
            "normalized_dev": None,
            "mean": prices[0] if prices else None,
            "std_dev": 0.0,
            "raw_count": raw_count,
            "used_count": raw_count,
            "removed_count": 0,
        }

    raw_mean = statistics.mean(prices)
    raw_std = statistics.pstdev(prices)
    lower = raw_mean - (2 * raw_std)
    upper = raw_mean + (2 * raw_std)
    filtered = [p for p in prices if lower <= p <= upper]
    if len(filtered) < 2:
        filtered = list(prices)

    used_mean = statistics.mean(filtered)
    used_std = statistics.pstdev(filtered) if len(filtered) > 1 else 0.0
    normalized_dev = (used_std / used_mean) if used_mean else 1.0
    consistency = max(0.0, min(1.0, 1.0 - normalized_dev))
    return {
        "consistency_score": consistency,
        "normalized_dev": normalized_dev,
        "mean": used_mean,
        "std_dev": used_std,
        "raw_count": raw_count,
        "used_count": len(filtered),
        "removed_count": max(0, raw_count - len(filtered)),
    }


def _score_weights_for_asset(asset):
    signal_class = resolve_signal_asset_class(asset)
    return ASSET_CLASS_SCORE_WEIGHTS.get(signal_class, ASSET_CLASS_SCORE_WEIGHTS["other"])


def _classify_segment(score100, momentum_norm, consistency_norm, volatility_norm):
    if consistency_norm < 0.75 or volatility_norm >= 0.65:
        segment = "risky"
        label = "Risky"
    elif score100 >= 75 and momentum_norm >= 0.70 and consistency_norm >= 0.85:
        segment = "high opportunity"
        label = "High Opportunity"
    else:
        segment = "stable"
        label = "Stable"
    segment_key = str(segment).replace(" ", "_")
    return {
        "segment": segment,
        "segmentKey": segment_key,
        "labelKey": f"segment.{segment_key}",
        "segmentLabel": label,
        "uiLabel": f"{label} | Score {int(score100)}/100",
    }


def technical(change, volume, volatility, cons_pct, weights):
    # FAZ 2C: explicit normalized metrics (0-1)
    momentum = max(0.0, min(1.0, (float(change) + 10.0) / 20.0))
    # volume is current weighted volume; avg_volume is passed through 'volume' arg by caller as ratio-ready value.
    volume_score = max(0.0, min(1.0, float(volume)))
    volatility_norm = max(0.0, min(1.0, float(volatility)))
    consistency_norm = max(0.0, min(1.0, float(cons_pct) / 100.0))
    final_norm = (
        momentum * float(weights["momentum"]) +
        volume_score * float(weights["volume"]) +
        volatility_norm * float(weights["volatility"]) +
        consistency_norm * float(weights["consistency"])
    )
    final_norm = max(0.0, min(1.0, final_norm))
    score = int(round(final_norm * 100))
    return {
        "technicalScore": score,
        "momentum": round(momentum, 6),
        "volumeScore": round(volume_score, 6),
        "volatilityNorm": round(volatility_norm, 6),
        "consistencyNorm": round(consistency_norm, 6),
        "scoreNorm": round(final_norm, 6),
        "score100": score,
        "weights": {
            "momentum": round(float(weights["momentum"]), 4),
            "volume": round(float(weights["volume"]), 4),
            "volatility": round(float(weights["volatility"]), 4),
            "consistency": round(float(weights["consistency"]), 4),
        },
    }


def decide(asset, points):
    ok = [p for p in points if p and p.get("ok")]
    price = weighted(ok, "price")
    change = weighted(ok, "change") or 0
    volume = weighted(ok, "volume") or 0
    volatility_pct = weighted(ok, "volatility") or abs(change)
    cons_meta = consistency_stats(ok)
    cons_score = cons_meta["consistency_score"]
    cons_pct = cons_score * 100

    for p in points:
        if p is None:
            continue
        p["consistency_score"] = cons_score
        if p.get("change_pct") is None:
            p["change_pct"] = float(p.get("change") or 0.0)

    # FAZ 2C metric preparation:
    # momentum: short-term weighted change (%)
    momentum_raw = float(change)
    # volume_score: current volume / avg volume
    valid_volumes = [float(p["volume"]) for p in ok if p.get("volume") is not None]
    avg_volume = statistics.mean(valid_volumes) if valid_volumes else 0.0
    volume_ratio = (float(volume) / avg_volume) if avg_volume else 0.0
    volume_score_norm = max(0.0, min(1.0, volume_ratio))
    # volatility: (high-low)/price ratio. source volatility is percentage, convert to ratio.
    volatility_ratio = max(0.0, float(volatility_pct) / 100.0)
    volatility_norm = max(0.0, min(1.0, volatility_ratio))

    weights = _score_weights_for_asset(asset)
    tech = technical(momentum_raw, volume_score_norm, volatility_norm, cons_pct, weights)
    mac = macro(asset)
    source_strength = min(100, 35 + len(ok) * 15)
    risk_score = round(.35 * max(0, 100 - (volatility_norm * 100 * 8)) + .25 * cons_pct + .20 * source_strength + .20 * mac["macroScore"])
    final_norm = tech["scoreNorm"]
    final = int(max(0, min(100, round(final_norm * 100))))
    segment_meta = _classify_segment(final, tech["momentum"], tech["consistencyNorm"], tech["volatilityNorm"])
    symbol_profile = _asset_symbol_profile(asset)
    if final >= 80 and risk_score >= 55:
        decision, color, risk = "Guclu Aday", "green", "Dusuk-Orta Risk" if risk_score >= 70 else "Orta Risk"
    elif final >= 60:
        decision, color, risk = "Takip", "blue", "Orta Risk"
    elif risk_score < 45:
        decision, color, risk = "Riskli / Izle", "amber", "Yuksek Risk"
    else:
        decision, color, risk = "Scout", "violet", "Orta Risk"
    reason = f"{len(ok)} kaynak karsilastirildi. Veri tutarliligi %{round(cons_pct)}. Teknik skor {tech['technicalScore']}. Makro/merkez bankasi katmani dahil. Risk skoru {risk_score}."
    return {
        "symbol": asset["symbol"],
        "display": asset["display"],
        "displaySymbol": symbol_profile.get("display_symbol") or asset["display"],
        "canonicalSymbol": symbol_profile.get("canonical_symbol") or asset["symbol"],
        "sourceSymbols": symbol_profile.get("source_symbols") or {},
        "name": asset["name"],
        "assetClass": asset["assetClass"],
        "market": asset["market"],
        "source": "global_brain_engine",
        "lastPrice": price,
        "change": round(change, 2),
        "quoteVolume": round(volume, 2),
        "volatility": round(volatility_norm, 6),
        "momentum": round(tech["momentum"], 6),
        "volumeScore": round(tech["volumeScore"], 6),
        "sourceCount": len(ok),
        "dataConsistency": round(cons_pct, 2),
        "consistencyScore": round(cons_score, 6),
        "consistencyMeta": cons_meta,
        "sources": points,
        "macro": mac,
        "technical": tech,
        "score": final,
        "scoreNormalized": final,
        "segment": segment_meta["segment"],
        "segmentKey": segment_meta["segmentKey"],
        "label_key": segment_meta["labelKey"],
        "segmentLabel": segment_meta["segmentLabel"],
        "uiLabel": segment_meta["uiLabel"],
        "status": decision.replace(" Aday", ""),
        "decision": decision,
        "color": color,
        "risk": risk,
        "reason": reason,
        "consensusConfidence": risk_score,
        "brain": {
            "decision": decision,
            "confidence": risk_score,
            "opinions": [
                {"model": "multi_source_data_engine", "confidence": round(cons_pct), "comment": f"Kaynak tutarliligi %{round(cons_pct)}."},
                {"model": "technical_engine", "confidence": tech["technicalScore"], "comment": f"Teknik skor {tech['technicalScore']}."},
                {"model": "macro_central_bank_engine", "confidence": mac["macroScore"], "comment": "Merkez bankasi ve makro katman karara dahil."},
                {"model": "risk_guard", "confidence": risk_score, "comment": f"Risk filtresi: {risk}."},
            ],
        },
    }


def _invoke_source(fn, asset):
    try:
        return fn(asset)
    except Exception as e:
        return point("internal", asset, ok=False, error=str(e), trust=.01)


def _source_plan(asset):
    signal_class = resolve_signal_asset_class(asset)
    if signal_class == "crypto":
        return [binance, coinbase, fetch_bybit, fetch_okx, fetch_coinmarketcap, fetch_coingecko]
    if signal_class == "us_stock":
        return [fetch_twelvedata, yahoo]
    return [yahoo]


def analyze_asset(asset, refresh=False):
    if not refresh:
        cached = _cache_get_asset(asset)
        if cached:
            return cached

    plan = _source_plan(asset)[:SMART_MULTI_SOURCE_MAX]
    points = []

    if plan:
        primary = _invoke_source(plan[0], asset)
        if primary:
            points.append(primary)

        if len(plan) > 1:
            secondary = _invoke_source(plan[1], asset)
            if secondary:
                points.append(secondary)

        ok_points = [p for p in points if p and p.get("ok")]
        ok_count = len(ok_points)
        consistency = consistency_stats(ok_points)["consistency_score"] if ok_count >= 2 else 0.0

        # Smart multi-source rule:
        # - min 2 source target
        # - if consistency < threshold, pull 3rd source (max 3 total)
        should_call_third = False
        if len(plan) > 2:
            if ok_count < 2:
                should_call_third = True
            elif consistency < SMART_CONSISTENCY_THRESHOLD:
                should_call_third = True

        if should_call_third:
            third = _invoke_source(plan[2], asset)
            if third:
                points.append(third)

    ok_points = [p for p in points if p and p.get("ok")]
    fallback_used = False
    if not ok_points:
        points.append(_seeded_fallback_point(asset))
        fallback_used = True

    status = get_market_status(asset, points=points, refresh=refresh)
    result = decide(asset, points)
    result["marketOpen"] = status["marketOpen"]
    result["marketState"] = status["marketState"]
    result["marketStatusSource"] = status["source"]
    result["marketStatusReason"] = status["reason"]
    seeded_points = [
        p for p in points
        if p and p.get("ok") and str(p.get("source") or "").strip().lower() == "seededfallback"
    ]
    live_points = [
        p for p in points
        if p and p.get("ok") and str(p.get("source") or "").strip().lower() != "seededfallback"
    ]
    provider_backed = len(live_points) > 0
    seeded_used = len(seeded_points) > 0
    data_mode = "live" if provider_backed else "seeded_fallback"

    result["dataMode"] = data_mode
    result["fallbackUsed"] = seeded_used
    result["seededFallbackUsed"] = seeded_used
    result["providerBacked"] = provider_backed
    result["liveSourceCount"] = len(live_points)
    result["seededFallbackCount"] = len(seeded_points)
    result["dataQuality"] = "provider_backed" if provider_backed else "seeded_fallback"
    result["sourceQuality"] = "high" if provider_backed else "limited"

    if seeded_used and not provider_backed:
        result["consensusConfidence"] = min(int(_item_numeric(result, "consensusConfidence", 0)), 40)
        seeded_score = min(int(_item_numeric(result, "score", 0)), 55)
        result["score"] = seeded_score
        result["scoreNormalized"] = seeded_score
        result["status"] = "Veri Sinirli"
        result["decision"] = "Veri Sinirli"
        result["risk"] = "Yuksek Risk"
        result["color"] = "amber"
        result["reason"] = "Canli saglayici verisi sinirli oldugu icin seeded fallback kullanildi."

    _cache_set_asset(asset, result)
    return result


def scan_market(market="all", asset_class="all", limit=5, refresh=False):
    assets = ASSET_UNIVERSE
    if market != "all":
        assets = [a for a in assets if a["market"] == market]
    if asset_class != "all":
        assets = [a for a in assets if a["assetClass"] == asset_class]

    safe_limit = max(1, int(limit))
    target_scan_count = max(15, safe_limit * 2)

    if market == "all":
        grouped = {}
        for asset in assets:
            grouped.setdefault(asset.get("market", "all"), []).append(asset)
        selected = []
        per_market_pick = max(4, min(8, math.ceil(target_scan_count / max(1, len(grouped)))))
        for bucket in grouped.values():
            ordered_bucket = sorted(bucket, key=lambda x: _cache_key_for_asset(x) or str(x.get("symbol") or ""))
            selected.extend(ordered_bucket[:per_market_pick])
        if len(selected) < target_scan_count:
            seen = {_cache_key_for_asset(x) for x in selected if _cache_key_for_asset(x)}
            for asset in sorted(assets, key=lambda x: _cache_key_for_asset(x) or str(x.get("symbol") or "")):
                key = _cache_key_for_asset(asset)
                if not key or key in seen:
                    continue
                seen.add(key)
                selected.append(asset)
                if len(selected) >= target_scan_count:
                    break
        assets = selected
    elif len(assets) > target_scan_count:
        assets = sorted(assets, key=lambda x: _cache_key_for_asset(x) or str(x.get("symbol") or ""))[:target_scan_count]

    results = []
    with ThreadPoolExecutor(max_workers=10) as ex:
        futures = [ex.submit(analyze_asset, a, refresh) for a in assets]
        for fut in as_completed(futures):
            try:
                item = fut.result()
                if item.get("sourceCount", 0) > 0:
                    results.append(item)
            except Exception:
                pass

    ranked = sorted(results, key=lambda x: (x["score"], x.get("consensusConfidence", 0)), reverse=True)
    target_per_segment = 5 if safe_limit >= 15 else max(1, safe_limit // 3)
    balanced = _balanced_market_segments(ranked, target_per_segment=target_per_segment)
    return balanced[:safe_limit]


def find_asset(symbol):
    s = _normalize_lookup_input(symbol)
    if not s:
        return None

    # 1) local universe with normalized symbol matching
    local = _local_search_assets(s, limit=1)
    if local:
        return local[0]

    # 2) dynamic registry from prior Yahoo fallback searches
    for asset in DYNAMIC_ASSET_REGISTRY.values():
        if s in _asset_lookup_tokens(asset):
            return asset

    # 3) live fallback search (first result as temporary asset)
    dynamic = _yahoo_search_assets(s, limit=1)
    if dynamic:
        return dynamic[0]
    return None
