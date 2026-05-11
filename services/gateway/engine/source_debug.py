from datetime import datetime, timezone
from copy import deepcopy
from urllib.parse import urlencode
import time
import requests

from .config import API_KEYS
from .asset_detail import get_asset_detail

DEBUG_CACHE = {}
DEBUG_CACHE_TTL_SECONDS = 180
TIMEOUT_ALPHA = 7
TIMEOUT_FMP = 7
TIMEOUT_TWELVE = 7


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _float_or_none(value):
    if value in (None, "", "None", "null"):
        return None
    try:
        return float(str(value).replace(",", ""))
    except Exception:
        return None


def _masked_url(base_url: str, params: dict) -> str:
    safe = {}
    for key, value in (params or {}).items():
        if key.lower() in ("apikey", "token"):
            safe[key] = "***"
        else:
            safe[key] = value
    query = urlencode(safe)
    return f"{base_url}?{query}" if query else base_url


def _sanitize_error(message: str) -> str:
    if not message:
        return message
    cleaned = str(message)
    for value in API_KEYS.values():
        if value:
            cleaned = cleaned.replace(value, "***")
    return cleaned


def _cache_get(cache_key: str):
    entry = DEBUG_CACHE.get(cache_key)
    if not entry:
        return None
    if entry["expires_at"] <= time.time():
        DEBUG_CACHE.pop(cache_key, None)
        return None
    result = deepcopy(entry["value"])
    result["fromCache"] = True
    return result


def _cache_set(cache_key: str, value: dict, ttl_seconds: int):
    DEBUG_CACHE[cache_key] = {
        "expires_at": time.time() + ttl_seconds,
        "value": deepcopy(value),
    }


def _result_template(source: str, key_present: bool, timeout_seconds: int):
    return {
        "source": source,
        "keyPresent": key_present,
        "attempted": False,
        "success": False,
        "statusCode": None,
        "errorType": None,
        "errorMessage": None,
        "responseEmpty": None,
        "parsedFields": [],
        "normalizedSample": None,
        "fromCache": False,
        "symbolUsed": None,
        "attemptedUrlWithoutSecrets": None,
        "timeoutSec": timeout_seconds,
        "cacheTtlSec": DEBUG_CACHE_TTL_SECONDS,
    }


def _source_with_cache(cache_key: str, builder):
    cached = _cache_get(cache_key)
    if cached:
        return cached
    result = builder()
    _cache_set(cache_key, result, DEBUG_CACHE_TTL_SECONDS)
    return result


def _symbol_variants(asset):
    symbol = asset["symbol"].upper()
    av = [symbol]
    if symbol.endswith(".IS"):
        trt = symbol.replace(".IS", ".TRT")
        if trt not in av:
            av.append(trt)

    fmp = [symbol]
    if symbol.endswith(".IS"):
        plain = symbol.replace(".IS", "")
        if plain not in fmp:
            fmp.append(plain)

    tw = [symbol]
    if symbol.endswith(".IS"):
        plain = symbol.replace(".IS", "")
        if plain not in tw:
            tw.append(plain)

    return {"alphaVantage": av, "fmp": fmp, "twelveData": tw}


def _check_alpha_overview(asset, symbols):
    key = API_KEYS.get("alphavantage")
    cache_key = f"alpha_overview::{asset['symbol']}"

    def build():
        result = _result_template("alpha_vantage_overview", bool(key), TIMEOUT_ALPHA)
        if not key:
            result["errorType"] = "key_missing"
            result["errorMessage"] = "ALPHAVANTAGE_API_KEY bulunamadı"
            result["responseEmpty"] = True
            return result

        last_error = None
        for symbol in symbols:
            params = {"function": "OVERVIEW", "symbol": symbol, "apikey": key}
            result["attempted"] = True
            result["symbolUsed"] = symbol
            result["attemptedUrlWithoutSecrets"] = _masked_url("https://www.alphavantage.co/query", params)
            try:
                resp = requests.get("https://www.alphavantage.co/query", params=params, timeout=TIMEOUT_ALPHA)
                result["statusCode"] = resp.status_code
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as exc:
                last_error = _sanitize_error(str(exc))
                continue

            if data.get("Note") or ("rate limit" in str(data.get("Information", "")).lower()):
                result["errorType"] = "rate_limited"
                result["errorMessage"] = "Alpha Vantage rate limit"
                result["responseEmpty"] = True
                return result

            if data.get("Error Message"):
                result["errorType"] = "request_error"
                result["errorMessage"] = data.get("Error Message")
                result["responseEmpty"] = True
                continue

            normalized = {
                "name": data.get("Name") or None,
                "description": data.get("Description") or None,
                "sector": data.get("Sector") or None,
                "industry": data.get("Industry") or None,
                "country": data.get("Country") or None,
                "marketCap": _float_or_none(data.get("MarketCapitalization")),
                "peRatio": _float_or_none(data.get("PERatio")),
                "pbRatio": _float_or_none(data.get("PriceToBookRatio")),
                "eps": _float_or_none(data.get("EPS")),
                "dividendYield": _float_or_none(data.get("DividendYield")),
                "week52High": _float_or_none(data.get("52WeekHigh")),
                "week52Low": _float_or_none(data.get("52WeekLow")),
                "analystTargetPrice": _float_or_none(data.get("AnalystTargetPrice")),
            }
            parsed = [field for field, value in normalized.items() if value not in (None, "")]
            result["responseEmpty"] = len(parsed) == 0
            if parsed:
                result["success"] = True
                result["errorType"] = None
                result["errorMessage"] = None
                result["parsedFields"] = parsed
                result["normalizedSample"] = normalized
                return result

        result["responseEmpty"] = True
        if last_error:
            result["errorType"] = "request_error"
            result["errorMessage"] = last_error
        elif result["errorType"] is None:
            result["errorType"] = "no_data"
            result["errorMessage"] = "Overview verisi boş döndü"
        return result

    return _source_with_cache(cache_key, build)


def _check_fmp_profile(asset, symbols):
    key = API_KEYS.get("fmp")
    cache_key = f"fmp_profile::{asset['symbol']}"

    def build():
        result = _result_template("fmp_profile", bool(key), TIMEOUT_FMP)
        if not key:
            result["errorType"] = "key_missing"
            result["errorMessage"] = "FMP_API_KEY bulunamadı"
            result["responseEmpty"] = True
            return result

        last_error = None
        for symbol in symbols:
            base = f"https://financialmodelingprep.com/api/v3/profile/{symbol}"
            params = {"apikey": key}
            result["attempted"] = True
            result["symbolUsed"] = symbol
            result["attemptedUrlWithoutSecrets"] = _masked_url(base, params)
            try:
                resp = requests.get(base, params=params, timeout=TIMEOUT_FMP)
                result["statusCode"] = resp.status_code
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as exc:
                last_error = _sanitize_error(str(exc))
                continue

            if isinstance(data, dict) and data.get("Error Message"):
                result["errorType"] = "request_error"
                result["errorMessage"] = data.get("Error Message")
                result["responseEmpty"] = True
                continue

            row = data[0] if isinstance(data, list) and data else None
            if not row:
                continue

            normalized = {
                "name": row.get("companyName") or None,
                "description": row.get("description") or None,
                "sector": row.get("sector") or None,
                "industry": row.get("industry") or None,
                "country": row.get("country") or None,
                "website": row.get("website") or None,
            }
            parsed = [field for field, value in normalized.items() if value not in (None, "")]
            result["responseEmpty"] = len(parsed) == 0
            if parsed:
                result["success"] = True
                result["errorType"] = None
                result["errorMessage"] = None
                result["parsedFields"] = parsed
                result["normalizedSample"] = normalized
                return result

        result["responseEmpty"] = True
        if last_error:
            result["errorType"] = "request_error"
            result["errorMessage"] = last_error
        elif result["errorType"] is None:
            result["errorType"] = "no_data"
            result["errorMessage"] = "FMP profile verisi boş döndü"
        return result

    return _source_with_cache(cache_key, build)


def _check_fmp_financials(asset, symbols):
    key = API_KEYS.get("fmp")
    cache_key = f"fmp_financials::{asset['symbol']}"

    def build():
        result = _result_template("fmp_financials_basic", bool(key), TIMEOUT_FMP)
        if not key:
            result["errorType"] = "key_missing"
            result["errorMessage"] = "FMP_API_KEY bulunamadı"
            result["responseEmpty"] = True
            return result

        last_error = None
        for symbol in symbols:
            base = f"https://financialmodelingprep.com/api/v3/key-metrics/{symbol}"
            params = {"limit": 1, "apikey": key}
            result["attempted"] = True
            result["symbolUsed"] = symbol
            result["attemptedUrlWithoutSecrets"] = _masked_url(base, params)
            try:
                resp = requests.get(base, params=params, timeout=TIMEOUT_FMP)
                result["statusCode"] = resp.status_code
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as exc:
                last_error = _sanitize_error(str(exc))
                continue

            row = data[0] if isinstance(data, list) and data else None
            if not row:
                continue

            normalized = {
                "marketCap": _float_or_none(row.get("marketCap")),
                "peRatio": _float_or_none(row.get("peRatio")),
                "pbRatio": _float_or_none(row.get("pbRatio")),
                "eps": _float_or_none(row.get("netIncomePerShare")),
                "dividendYield": _float_or_none(row.get("dividendYield")),
                "week52High": None,
                "week52Low": None,
                "analystTargetPrice": None,
            }
            parsed = [field for field, value in normalized.items() if value not in (None, "")]
            result["responseEmpty"] = len(parsed) == 0
            if parsed:
                result["success"] = True
                result["errorType"] = None
                result["errorMessage"] = None
                result["parsedFields"] = parsed
                result["normalizedSample"] = normalized
                return result

        result["responseEmpty"] = True
        if last_error:
            result["errorType"] = "request_error"
            result["errorMessage"] = last_error
        elif result["errorType"] is None:
            result["errorType"] = "no_data"
            result["errorMessage"] = "FMP financials verisi boş döndü"
        return result

    return _source_with_cache(cache_key, build)


def _check_twelvedata_quote(asset, symbols):
    key = API_KEYS.get("twelvedata")
    cache_key = f"twelvedata_quote::{asset['symbol']}"

    def build():
        result = _result_template("twelvedata_quote", bool(key), TIMEOUT_TWELVE)
        if not key:
            result["errorType"] = "key_missing"
            result["errorMessage"] = "TWELVEDATA_API_KEY bulunamadı"
            result["responseEmpty"] = True
            return result

        last_error = None
        for symbol in symbols:
            params = {"symbol": symbol, "apikey": key}
            result["attempted"] = True
            result["symbolUsed"] = symbol
            result["attemptedUrlWithoutSecrets"] = _masked_url("https://api.twelvedata.com/quote", params)
            try:
                resp = requests.get("https://api.twelvedata.com/quote", params=params, timeout=TIMEOUT_TWELVE)
                result["statusCode"] = resp.status_code
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as exc:
                last_error = _sanitize_error(str(exc))
                continue

            if data.get("status") == "error":
                message = data.get("message", "TwelveData error")
                code = str(data.get("code", ""))
                result["errorType"] = "rate_limited" if code in ("429", "400", "401") and "limit" in message.lower() else "request_error"
                result["errorMessage"] = message
                result["responseEmpty"] = True
                continue

            normalized = {
                "name": data.get("name") or None,
                "marketCap": _float_or_none(data.get("market_cap")),
                "week52High": _float_or_none((data.get("fifty_two_week") or {}).get("high")),
                "week52Low": _float_or_none((data.get("fifty_two_week") or {}).get("low")),
                "close": _float_or_none(data.get("close")),
                "volume": _float_or_none(data.get("volume")),
            }
            parsed = [field for field, value in normalized.items() if value not in (None, "")]
            result["responseEmpty"] = len(parsed) == 0
            if parsed:
                result["success"] = True
                result["errorType"] = None
                result["errorMessage"] = None
                result["parsedFields"] = parsed
                result["normalizedSample"] = normalized
                return result

        result["responseEmpty"] = True
        if last_error:
            result["errorType"] = "request_error"
            result["errorMessage"] = last_error
        elif result["errorType"] is None:
            result["errorType"] = "no_data"
            result["errorMessage"] = "TwelveData quote verisi boş döndü"
        return result

    return _source_with_cache(cache_key, build)


def _check_twelvedata_profile(asset, symbols):
    key = API_KEYS.get("twelvedata")
    cache_key = f"twelvedata_profile::{asset['symbol']}"

    def build():
        result = _result_template("twelvedata_profile", bool(key), TIMEOUT_TWELVE)
        if not key:
            result["errorType"] = "key_missing"
            result["errorMessage"] = "TWELVEDATA_API_KEY bulunamadı"
            result["responseEmpty"] = True
            return result

        last_error = None
        for symbol in symbols:
            params = {"symbol": symbol, "apikey": key}
            result["attempted"] = True
            result["symbolUsed"] = symbol
            result["attemptedUrlWithoutSecrets"] = _masked_url("https://api.twelvedata.com/profile", params)
            try:
                resp = requests.get("https://api.twelvedata.com/profile", params=params, timeout=TIMEOUT_TWELVE)
                result["statusCode"] = resp.status_code
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as exc:
                last_error = _sanitize_error(str(exc))
                continue

            if data.get("status") == "error":
                message = data.get("message", "TwelveData error")
                lower = message.lower()
                if "plan" in lower or "upgrade" in lower or "subscription" in lower:
                    result["errorType"] = "request_error"
                elif "limit" in lower:
                    result["errorType"] = "rate_limited"
                else:
                    result["errorType"] = "request_error"
                result["errorMessage"] = message
                result["responseEmpty"] = True
                continue

            normalized = {
                "name": data.get("name") or None,
                "description": data.get("description") or None,
                "sector": data.get("sector") or None,
                "industry": data.get("industry") or None,
                "country": data.get("country") or None,
            }
            parsed = [field for field, value in normalized.items() if value not in (None, "")]
            result["responseEmpty"] = len(parsed) == 0
            if parsed:
                result["success"] = True
                result["errorType"] = None
                result["errorMessage"] = None
                result["parsedFields"] = parsed
                result["normalizedSample"] = normalized
                return result

        result["responseEmpty"] = True
        if last_error:
            result["errorType"] = "request_error"
            result["errorMessage"] = last_error
        elif result["errorType"] is None:
            result["errorType"] = "no_data"
            result["errorMessage"] = "TwelveData profile verisi boş döndü"
        return result

    return _source_with_cache(cache_key, build)


def _check_alpha_global_quote(asset, symbols):
    key = API_KEYS.get("alphavantage")
    cache_key = f"alpha_quote::{asset['symbol']}"

    def build():
        result = _result_template("alpha_vantage_global_quote", bool(key), TIMEOUT_ALPHA)
        if not key:
            result["errorType"] = "key_missing"
            result["errorMessage"] = "ALPHAVANTAGE_API_KEY bulunamadı"
            result["responseEmpty"] = True
            return result

        last_error = None
        for symbol in symbols:
            params = {"function": "GLOBAL_QUOTE", "symbol": symbol, "apikey": key}
            result["attempted"] = True
            result["symbolUsed"] = symbol
            result["attemptedUrlWithoutSecrets"] = _masked_url("https://www.alphavantage.co/query", params)
            try:
                resp = requests.get("https://www.alphavantage.co/query", params=params, timeout=TIMEOUT_ALPHA)
                result["statusCode"] = resp.status_code
                resp.raise_for_status()
                data = resp.json()
            except requests.RequestException as exc:
                last_error = _sanitize_error(str(exc))
                continue

            if data.get("Note") or ("rate limit" in str(data.get("Information", "")).lower()):
                result["errorType"] = "rate_limited"
                result["errorMessage"] = "Alpha Vantage rate limit"
                result["responseEmpty"] = True
                return result

            quote = data.get("Global Quote", {})
            normalized = {
                "price": _float_or_none(quote.get("05. price")),
                "volume": _float_or_none(quote.get("06. volume")),
                "changePercent": _float_or_none(str(quote.get("10. change percent", "")).replace("%", "")),
            }
            parsed = [field for field, value in normalized.items() if value not in (None, "")]
            result["responseEmpty"] = len(parsed) == 0
            if parsed:
                result["success"] = True
                result["errorType"] = None
                result["errorMessage"] = None
                result["parsedFields"] = parsed
                result["normalizedSample"] = normalized
                return result

        result["responseEmpty"] = True
        if last_error:
            result["errorType"] = "request_error"
            result["errorMessage"] = last_error
        elif result["errorType"] is None:
            result["errorType"] = "no_data"
            result["errorMessage"] = "Alpha Vantage quote verisi boş döndü"
        return result

    return _source_with_cache(cache_key, build)


def debug_stock_sources(asset):
    mapping = _symbol_variants(asset)
    payload = {
        "symbol": asset["symbol"],
        "display": asset["display"],
        "assetClass": asset.get("assetClass"),
        "market": asset.get("market"),
        "generatedAt": _now_iso(),
        "supported": asset.get("assetClass") == "stock",
        "symbolMapping": {
            "alphaVantage": mapping["alphaVantage"],
            "fmp": mapping["fmp"],
            "twelveData": mapping["twelveData"],
        },
        "timeouts": {
            "alphaVantageSec": TIMEOUT_ALPHA,
            "fmpSec": TIMEOUT_FMP,
            "twelveDataSec": TIMEOUT_TWELVE,
        },
        "cache": {
            "sourceCheckTtlSec": DEBUG_CACHE_TTL_SECONDS,
        },
        "assetDetailSections": None,
        "sources": [],
    }

    if asset.get("assetClass") != "stock":
        payload["assetDetailSections"] = {
            "profileStatus": "unsupported_asset_class",
            "financialsBasicStatus": "unsupported_asset_class",
            "reason": "Bu varlık türü için desteklenmiyor",
        }
        payload["sources"] = [
            _result_template("alpha_vantage_overview", bool(API_KEYS.get("alphavantage")), TIMEOUT_ALPHA),
            _result_template("fmp_profile", bool(API_KEYS.get("fmp")), TIMEOUT_FMP),
            _result_template("fmp_financials_basic", bool(API_KEYS.get("fmp")), TIMEOUT_FMP),
            _result_template("twelvedata_quote", bool(API_KEYS.get("twelvedata")), TIMEOUT_TWELVE),
            _result_template("twelvedata_profile", bool(API_KEYS.get("twelvedata")), TIMEOUT_TWELVE),
            _result_template("alpha_vantage_global_quote", bool(API_KEYS.get("alphavantage")), TIMEOUT_ALPHA),
        ]
        for source in payload["sources"]:
            source["errorType"] = "unsupported_asset_class"
            source["errorMessage"] = "Bu varlık türü için desteklenmiyor"
            source["responseEmpty"] = True
        return payload

    detail_payload = get_asset_detail(asset)
    payload["assetDetailSections"] = {
        "summaryStatus": detail_payload.get("summary", {}).get("status"),
        "summaryReason": detail_payload.get("summary", {}).get("reason"),
        "profileStatus": detail_payload.get("profile", {}).get("status"),
        "profileReason": detail_payload.get("profile", {}).get("reason"),
        "financialsBasicStatus": detail_payload.get("financials_basic", {}).get("status"),
        "financialsBasicReason": detail_payload.get("financials_basic", {}).get("reason"),
    }

    payload["sources"] = [
        _check_alpha_overview(asset, mapping["alphaVantage"]),
        _check_fmp_profile(asset, mapping["fmp"]),
        _check_fmp_financials(asset, mapping["fmp"]),
        _check_twelvedata_quote(asset, mapping["twelveData"]),
        _check_twelvedata_profile(asset, mapping["twelveData"]),
        _check_alpha_global_quote(asset, mapping["alphaVantage"]),
    ]
    return payload
