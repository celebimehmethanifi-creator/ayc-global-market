from datetime import datetime, timezone
import time
import requests

from .config import API_KEYS
from .global_engine import get_market_status

ALPHAVANTAGE_URL = "https://www.alphavantage.co/query"
TWELVEDATA_PROFILE_URL = "https://api.twelvedata.com/profile"
TWELVEDATA_QUOTE_URL = "https://api.twelvedata.com/quote"
ALPHAVANTAGE_TIMEOUT = 7
TWELVEDATA_TIMEOUT = 7
# FAZ 2A continuation: detail cache TTL 60-180 sec range
DETAIL_TTL_OK_SECONDS = 180
DETAIL_TTL_SOFT_FAIL_SECONDS = 90
DETAIL_TTL_HARD_FAIL_SECONDS = 60
DETAIL_TTL_RATE_LIMIT_SECONDS = 120
HEADERS = {"User-Agent": "GlobalAIDetailEngine/1.0"}
DETAIL_CACHE = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _float_or_none(value):
    if value in (None, "", "None", "null"):
        return None
    try:
        return float(str(value).replace(",", ""))
    except Exception:
        return None


def _section(supported: bool, status: str, reason: str, data=None):
    return {
        "supported": supported,
        "status": status,
        "reason": reason,
        "data": data,
    }


def _base_payload(asset, summary_status: str, summary_reason: str):
    return {
        "symbol": asset["symbol"],
        "display": asset["display"],
        "assetClass": asset["assetClass"],
        "market": asset["market"],
        "generatedAt": _now_iso(),
        "summary": {
            "supported": asset.get("assetClass") == "stock",
            "status": summary_status,
            "reason": summary_reason,
        },
        "marketStatus": {
            "isOpen": None,
            "state": None,
            "source": None,
            "reason": None,
        },
        "marketClosed": None,
        "profile": _section(False, "not_connected", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None),
        "financials_basic": _section(False, "not_connected", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None),
        "news": _section(False, "not_connected", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None),
        "ownership": _section(False, "not_connected", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None),
        "resources": _section(False, "not_connected", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None),
    }


def _stock_fallback_payload(asset, status: str, reason: str):
    payload = _base_payload(asset, status, reason)
    payload["profile"] = _section(True, status, reason, None)
    payload["financials_basic"] = _section(True, status, reason, None)
    return payload


def _unsupported_payload(asset):
    status = "unsupported_asset_class"
    reason = "Bu varlÄ±k tÃ¼rÃ¼ iÃ§in desteklenmiyor"
    payload = _base_payload(asset, status, reason)
    payload["profile"] = _section(False, status, reason, None)
    payload["financials_basic"] = _section(False, status, reason, None)
    return payload


def _overview_symbols(asset):
    symbol = asset["symbol"].upper()
    symbols = [symbol]
    if symbol.endswith(".IS"):
        alt = symbol.replace(".IS", ".TRT")
        if alt not in symbols:
            symbols.append(alt)
    return symbols


def _twelvedata_symbols(asset):
    symbol = asset["symbol"].upper()
    symbols = [symbol]
    if symbol.endswith(".IS"):
        plain = symbol.replace(".IS", "")
        if plain not in symbols:
            symbols.append(plain)
    return symbols


def _fetch_overview(symbol: str, key: str):
    response = requests.get(
        ALPHAVANTAGE_URL,
        params={"function": "OVERVIEW", "symbol": symbol, "apikey": key},
        headers=HEADERS,
        timeout=ALPHAVANTAGE_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def _fetch_twelvedata(url: str, symbol: str, key: str):
    response = requests.get(
        url,
        params={"symbol": symbol, "apikey": key},
        headers=HEADERS,
        timeout=TWELVEDATA_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def _normalize_overview(raw):
    profile = {
        "name": raw.get("Name") or None,
        "description": raw.get("Description") or None,
        "sector": raw.get("Sector") or None,
        "industry": raw.get("Industry") or None,
        "country": raw.get("Country") or None,
    }
    financials = {
        "currentPrice": None,
        "open": None,
        "dayHigh": None,
        "dayLow": None,
        "previousClose": None,
        "changePercent": None,
        "quoteVolume": None,
        "marketCap": _float_or_none(raw.get("MarketCapitalization")),
        "peRatio": _float_or_none(raw.get("PERatio")),
        "pbRatio": _float_or_none(raw.get("PriceToBookRatio")),
        "eps": _float_or_none(raw.get("EPS")),
        "dividendYield": _float_or_none(raw.get("DividendYield")),
        "week52High": _float_or_none(raw.get("52WeekHigh")),
        "week52Low": _float_or_none(raw.get("52WeekLow")),
        "analystTargetPrice": _float_or_none(raw.get("AnalystTargetPrice")),
    }
    return profile, financials


def _normalize_twelvedata_profile(raw):
    return {
        "name": raw.get("name") or None,
        "description": raw.get("description") or None,
        "sector": raw.get("sector") or None,
        "industry": raw.get("industry") or None,
        "country": raw.get("country") or None,
    }


def _normalize_twelvedata_quote(raw):
    fifty_two_week = raw.get("fifty_two_week") or {}
    return {
        "currentPrice": _float_or_none(raw.get("close")),
        "open": _float_or_none(raw.get("open")),
        "dayHigh": _float_or_none(raw.get("high")),
        "dayLow": _float_or_none(raw.get("low")),
        "previousClose": _float_or_none(raw.get("previous_close")),
        "changePercent": _float_or_none(raw.get("percent_change")),
        "quoteVolume": _float_or_none(raw.get("volume")),
        "marketCap": _float_or_none(raw.get("market_cap")),
        "peRatio": _float_or_none(raw.get("pe")),
        "pbRatio": _float_or_none(raw.get("pb")),
        "eps": _float_or_none(raw.get("eps")),
        "dividendYield": _float_or_none(raw.get("dividend_yield")),
        "week52High": _float_or_none(fifty_two_week.get("high")),
        "week52Low": _float_or_none(fifty_two_week.get("low")),
        "analystTargetPrice": _float_or_none(raw.get("analyst_target_price")),
    }


def _has_data(data: dict) -> bool:
    return any(value not in (None, "", "None", "null") for value in (data or {}).values())


def _merge_fill_missing(primary: dict, fallback: dict):
    merged = dict(primary or {})
    for key, value in (fallback or {}).items():
        if merged.get(key) in (None, "", "None", "null"):
            merged[key] = value
    return merged


def _build_success_payload(asset, profile, financials, reason="GerÃ§ek veri ile dolduruldu"):
    payload = _base_payload(asset, "ok", reason)
    payload["profile"] = _section(True, "ok", reason, profile)
    payload["financials_basic"] = _section(True, "ok", reason, financials)
    return payload


def _cache_ttl_for_status(status: str) -> int:
    if status == "ok":
        return DETAIL_TTL_OK_SECONDS
    if status in ("key_missing", "no_data", "disabled_source"):
        return DETAIL_TTL_SOFT_FAIL_SECONDS
    if status == "rate_limited":
        return DETAIL_TTL_RATE_LIMIT_SECONDS
    return DETAIL_TTL_HARD_FAIL_SECONDS


def _status_reason(status: str, source_label: str):
    if status == "key_missing":
        return f"{source_label} API key bulunamadÄ±"
    if status == "rate_limited":
        return "Kaynak ÅŸu anda yanÄ±t vermiyor"
    if status == "request_error":
        return "Kaynak ÅŸu anda yanÄ±t vermiyor"
    if status == "unsupported_asset_class":
        return "Bu varlÄ±k tÃ¼rÃ¼ iÃ§in desteklenmiyor"
    if status == "disabled_source":
        return "Bu kaynak bu adÄ±mda devre dÄ±ÅŸÄ± bÄ±rakÄ±ldÄ±"
    return "Bu alan henÃ¼z baÄŸlÄ± deÄŸil"


def _fetch_twelvedata_profile(asset):
    key = API_KEYS.get("twelvedata")
    if not key:
        return "key_missing", _status_reason("key_missing", "TwelveData"), None

    last_request_error = None
    for symbol in _twelvedata_symbols(asset):
        try:
            raw = _fetch_twelvedata(TWELVEDATA_PROFILE_URL, symbol, key)
        except requests.RequestException as exc:
            last_request_error = str(exc)
            continue

        if raw.get("status") == "error":
            code = int(raw.get("code", 0) or 0)
            message = (raw.get("message") or "").lower()
            if code == 429 or "limit" in message:
                return "rate_limited", _status_reason("rate_limited", "TwelveData"), None
            if code == 401:
                return "key_missing", _status_reason("key_missing", "TwelveData"), None
            if code == 400:
                continue
            if code == 403:
                continue
            last_request_error = raw.get("message") or "TwelveData profile request_error"
            continue

        normalized = _normalize_twelvedata_profile(raw)
        if _has_data(normalized):
            return "ok", "TwelveData profile verisi alÄ±ndÄ±", normalized

    if last_request_error:
        return "request_error", _status_reason("request_error", "TwelveData"), None
    return "no_data", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None


def _fetch_twelvedata_financials(asset):
    key = API_KEYS.get("twelvedata")
    if not key:
        return "key_missing", _status_reason("key_missing", "TwelveData"), None

    last_request_error = None
    for symbol in _twelvedata_symbols(asset):
        try:
            raw = _fetch_twelvedata(TWELVEDATA_QUOTE_URL, symbol, key)
        except requests.RequestException as exc:
            last_request_error = str(exc)
            continue

        if raw.get("status") == "error":
            code = int(raw.get("code", 0) or 0)
            message = (raw.get("message") or "").lower()
            if code == 429 or "limit" in message:
                return "rate_limited", _status_reason("rate_limited", "TwelveData"), None
            if code == 401:
                return "key_missing", _status_reason("key_missing", "TwelveData"), None
            if code == 400:
                continue
            last_request_error = raw.get("message") or "TwelveData quote request_error"
            continue

        normalized = _normalize_twelvedata_quote(raw)
        if _has_data(normalized):
            return "ok", "TwelveData quote verisi alÄ±ndÄ±", normalized

    if last_request_error:
        return "request_error", _status_reason("request_error", "TwelveData"), None
    return "no_data", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None


def _fetch_alpha_overview(asset):
    key = API_KEYS.get("alphavantage")
    if not key:
        return "key_missing", _status_reason("key_missing", "Alpha Vantage"), None, None

    last_request_error = None
    for symbol in _overview_symbols(asset):
        try:
            raw = _fetch_overview(symbol, key)
        except requests.RequestException as exc:
            last_request_error = str(exc)
            continue

        note = raw.get("Note") or ""
        info = raw.get("Information") or ""
        if note or ("rate limit" in info.lower()):
            return "rate_limited", _status_reason("rate_limited", "Alpha Vantage"), None, None

        if raw.get("Error Message"):
            continue

        profile, financials = _normalize_overview(raw)
        if _has_data(profile) or _has_data(financials):
            return "ok", "Alpha Vantage OVERVIEW verisi alÄ±ndÄ±", profile, financials

    if last_request_error:
        return "request_error", _status_reason("request_error", "Alpha Vantage"), None, None
    return "no_data", "Bu alan henÃ¼z baÄŸlÄ± deÄŸil", None, None


def _profile_fallback_allowed(status: str) -> bool:
    return status in ("no_data", "request_error", "key_missing")


def _financials_fallback_allowed(status: str) -> bool:
    return status in ("no_data", "request_error", "key_missing")


def _build_stock_payload(asset):
    td_profile_status, td_profile_reason, td_profile_data = _fetch_twelvedata_profile(asset)
    td_fin_status, td_fin_reason, td_fin_data = _fetch_twelvedata_financials(asset)

    profile_data = td_profile_data if td_profile_data else None
    financials_data = td_fin_data if td_fin_data else None
    profile_status = td_profile_status
    profile_reason = td_profile_reason
    financials_status = td_fin_status
    financials_reason = td_fin_reason

    alpha_status = None
    alpha_reason = None
    alpha_profile = None
    alpha_financials = None
    if _profile_fallback_allowed(profile_status) or _financials_fallback_allowed(financials_status):
        alpha_status, alpha_reason, alpha_profile, alpha_financials = _fetch_alpha_overview(asset)

    if _profile_fallback_allowed(profile_status) and alpha_status == "ok" and _has_data(alpha_profile):
        profile_data = _merge_fill_missing(profile_data or {}, alpha_profile)
        profile_status = "ok"
        profile_reason = "Alpha Vantage fallback ile dolduruldu"
    elif profile_status != "ok" and alpha_status in ("rate_limited", "request_error"):
        profile_status = alpha_status
        profile_reason = alpha_reason

    if _financials_fallback_allowed(financials_status) and alpha_status == "ok" and _has_data(alpha_financials):
        financials_data = _merge_fill_missing(financials_data or {}, alpha_financials)
        financials_status = "ok"
        financials_reason = "Alpha Vantage fallback ile dolduruldu"
    elif financials_status != "ok" and alpha_status in ("rate_limited", "request_error"):
        financials_status = alpha_status
        financials_reason = alpha_reason

    if not _has_data(profile_data):
        profile_data = None
    if not _has_data(financials_data):
        financials_data = None

    if profile_status == "ok" and financials_status == "ok":
        summary_status = "ok"
        summary_reason = "TwelveData primary source kullanÄ±ldÄ±. FMP disabled_source."
    else:
        priority = [profile_status, financials_status]
        if "rate_limited" in priority:
            summary_status = "rate_limited"
        elif "request_error" in priority:
            summary_status = "request_error"
        elif "key_missing" in priority:
            summary_status = "key_missing"
        else:
            summary_status = "no_data"
        summary_reason = _status_reason(summary_status, "Detail source")

    payload = _base_payload(asset, summary_status, summary_reason)
    payload["profile"] = _section(True, profile_status, profile_reason, profile_data)
    payload["financials_basic"] = _section(True, financials_status, financials_reason, financials_data)
    return payload


def get_asset_detail(asset):
    cache_key = f"{asset['symbol'].upper()}::{asset.get('assetClass','')}"
    now = time.time()
    cached = DETAIL_CACHE.get(cache_key)
    if cached and cached["expires_at"] > now:
        return cached["payload"]

    if asset.get("assetClass") != "stock":
        payload = _unsupported_payload(asset)
    else:
        payload = _build_stock_payload(asset)

    market_status = get_market_status(asset)
    payload["marketStatus"] = {
        "isOpen": bool(market_status.get("marketOpen")),
        "state": market_status.get("marketState"),
        "source": market_status.get("source"),
        "reason": market_status.get("reason"),
    }
    payload["marketClosed"] = not bool(market_status.get("marketOpen"))
    payload["summary"]["marketFlag"] = "Market kapalı" if payload["marketClosed"] else "Market açık"

    DETAIL_CACHE[cache_key] = {
        "expires_at": now + _cache_ttl_for_status(payload["summary"]["status"]),
        "payload": payload,
    }
    return payload



