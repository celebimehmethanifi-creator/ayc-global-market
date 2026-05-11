"""
AYC Global Market — Unified News Engine v2
Sources: Google News RSS (24h), CoinDesk RSS, GDELT, Finnhub, AlphaVantage, NewsAPI, MarketAux
"""
from __future__ import annotations
import os, hashlib, time, re, json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import httpx
from fastapi import APIRouter, Query

router = APIRouter(tags=["news"])

# ─── API Keys ─────────────────────────────────────────────────────
def _env(k: str, d: str = "") -> str:
    return os.environ.get(k, d).strip()

# ─── Symbol → Query mapping ───────────────────────────────────────
SYMBOL_QUERY: Dict[str, str] = {
    "BTC": "BTC OR Bitcoin",
    "ETH": "ETH OR Ethereum",
    "XRP": "XRP OR Ripple",
    "SOL": "SOL OR Solana",
    "BNB": "BNB OR Binance",
    "ADA": "ADA OR Cardano",
    "DOGE": "DOGE OR Dogecoin",
    "AVAX": "AVAX OR Avalanche",
    "DOT": "DOT OR Polkadot",
    "LINK": "LINK OR Chainlink",
    "AAPL": "AAPL OR Apple",
    "TSLA": "TSLA OR Tesla",
    "NVDA": "NVDA OR Nvidia",
    "MSFT": "MSFT OR Microsoft",
    "GOOGL": "GOOGL OR Google",
    "AMZN": "AMZN OR Amazon",
    "META": "META OR Facebook",
    "NFLX": "NFLX OR Netflix",
    "THYAO": 'THYAO OR "Türk Hava Yolları"',
    "ASELS": "ASELS OR Aselsan",
    "GARAN": "GARAN OR Garanti",
    "SISE": "SISE OR Sisecam",
    "KCHOL": "KCHOL OR Koç",
    "XAUUSD": "altın OR gold OR XAU",
    "XAGUSD": "silver OR gümüş OR XAG",
    "EURUSD": "EURUSD OR euro dollar",
    "USDTRY": "dolar TL OR USDTRY",
    "BRENT": "brent petrol OR crude oil",
    "WTI": "WTI oil OR ham petrol",
    "BIST100": "BIST100 OR borsa istanbul",
    "SPX": "S&P 500 OR SPX OR SP500",
    "NDX": "Nasdaq OR NDX OR QQQ",
    "DXY": "DXY OR dolar endeksi",
}

# ─── RSS Feed templates ───────────────────────────────────────────
def rss_google_tr(q: str) -> str:
    return f"https://news.google.com/rss/search?q={q.replace(' ','+').replace('OR','OR')}+when:24h&hl=tr&gl=TR&ceid=TR:tr"

def rss_google_us(q: str) -> str:
    return f"https://news.google.com/rss/search?q={q.replace(' ','+').replace('OR','OR')}+when:24h&hl=en-US&gl=US&ceid=US:en"

RSS_STATIC: Dict[str, List[str]] = {
    "business_tr": ["https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=tr&gl=TR&ceid=TR:tr"],
    "business_us": ["https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en"],
    "crypto":      ["https://www.coindesk.com/arc/outboundfeeds/rss/",
                    "https://news.google.com/rss/search?q=crypto+OR+bitcoin+OR+ethereum+when:24h&hl=en-US&gl=US&ceid=US:en"],
    "turkey":      ["https://news.google.com/rss/search?q=bist+OR+borsa+istanbul+OR+turk+borsasi+when:24h&hl=tr&gl=TR&ceid=TR:tr"],
    "macro":       ["https://news.google.com/rss/search?q=fed+OR+inflation+OR+faiz+OR+merkez+bankasi+when:24h&hl=en-US&gl=US&ceid=US:en"],
    "geo":         ["https://news.google.com/rss/search?q=war+OR+crisis+OR+oil+price+OR+jeopolitik+when:24h&hl=en-US&gl=US&ceid=US:en"],
    "global":      ["https://news.google.com/rss/search?q=stock+market+OR+financial+markets+OR+global+economy+when:24h&hl=en-US&gl=US&ceid=US:en"],
    "all":         ["https://news.google.com/rss/search?q=bitcoin+OR+gold+OR+stock+market+OR+borsa+when:24h&hl=en-US&gl=US&ceid=US:en"],
}

# ─── Cache ────────────────────────────────────────────────────────
_CACHE: Dict[str, Dict] = {}
CACHE_TTL = 300  # 5 min

def _cache_get(key: str):
    c = _CACHE.get(key)
    if c and (time.time() - c["ts"]) < CACHE_TTL:
        return c["data"]
    return None

def _cache_set(key: str, data):
    _CACHE[key] = {"ts": time.time(), "data": data}

# ─── Sentiment ────────────────────────────────────────────────────
BEARISH_KW = ["fall","drop","crash","decline","lose","loss","fear","crisis","sell","bear","down","dump","plunge","slump","weak","warn","risk","concern","trouble","sanction","recession","bankrupt","default","collapse","ban"]
BULLISH_KW = ["rise","surge","rally","gain","bull","buy","up","high","record","growth","profit","break","soar","climb","strong","boost","approve","launch","adoption","partnership","beat","exceed","recover"]

def _sentiment(text: str) -> str:
    t = text.lower()
    b = sum(1 for w in BEARISH_KW if w in t)
    u = sum(1 for w in BULLISH_KW if w in t)
    if u > b: return "bullish"
    if b > u: return "bearish"
    return "neutral"

def _relevance(title: str, query: str) -> int:
    t = title.lower()
    score = 50
    for q in query.lower().split(" or "):
        q = q.strip().strip('"')
        if q in t:
            score += 20
    return min(score, 100)

# ─── Parsers ─────────────────────────────────────────────────────
def _parse_rss(xml_text: str, source_name: str = "RSS", query: str = "") -> List[Dict]:
    items = re.findall(r"<item>(.*?)</item>", xml_text, re.DOTALL)
    result = []
    seen = set()
    for item in items:
        def g(tag):
            m = re.search(rf"<{tag}[^>]*><!\[CDATA\[(.*?)\]\]></{tag}>", item, re.DOTALL)
            if m: return m.group(1).strip()
            m = re.search(rf"<{tag}[^>]*>(.*?)</{tag}>", item, re.DOTALL)
            return re.sub(r"<[^>]+>","",m.group(1).strip()) if m else ""

        title = g("title")
        url   = g("link") or g("guid")
        pub   = g("pubDate")
        desc  = g("description")[:200] if g("description") else ""
        src_m = re.search(r"<source[^>]*>(.*?)</source>", item)
        src   = src_m.group(1) if src_m else source_name
        img_m = re.search(r'url="([^"]+\.(?:jpg|jpeg|png|webp|gif))"', item)
        img   = img_m.group(1) if img_m else None

        uid = hashlib.md5((url or title or "").encode()).hexdigest()[:8]
        if not title or uid in seen: continue
        seen.add(uid)
        result.append({
            "id": uid,
            "title": title,
            "url": url,
            "source": src,
            "published_at": pub,
            "summary": desc,
            "sentiment": _sentiment(title + " " + desc),
            "relevance_score": _relevance(title, query) if query else 50,
            "image_url": img,
            "provider": "rss",
        })
    return result


def _parse_gdelt(data: dict, query: str = "") -> List[Dict]:
    articles = data.get("articles", [])
    result = []
    for a in articles:
        title = a.get("title","")
        url   = a.get("url","")
        if not title: continue
        uid = hashlib.md5(url.encode()).hexdigest()[:8]
        result.append({
            "id": uid,
            "title": title,
            "url": url,
            "source": a.get("domain","GDELT"),
            "published_at": a.get("seendate",""),
            "summary": "",
            "sentiment": _sentiment(title),
            "relevance_score": _relevance(title, query),
            "image_url": None,
            "provider": "gdelt",
        })
    return result


def _parse_finnhub(articles: list, query: str = "") -> List[Dict]:
    result = []
    for a in articles:
        headline = a.get("headline","")
        url = a.get("url","")
        if not headline: continue
        uid = hashlib.md5(url.encode()).hexdigest()[:8]
        ts = a.get("datetime", 0)
        pub = datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else ""
        result.append({
            "id": uid,
            "title": headline,
            "url": url,
            "source": a.get("source","Finnhub"),
            "published_at": pub,
            "summary": a.get("summary","")[:200],
            "sentiment": _sentiment(headline),
            "relevance_score": _relevance(headline, query),
            "image_url": a.get("image"),
            "provider": "finnhub",
        })
    return result


def _parse_alphavantage(data: dict, query: str = "") -> List[Dict]:
    feed = data.get("feed", [])
    result = []
    for a in feed:
        title = a.get("title","")
        url   = a.get("url","")
        if not title: continue
        uid = hashlib.md5(url.encode()).hexdigest()[:8]
        overall = a.get("overall_sentiment_label","neutral").lower()
        if "bullish" in overall: sent = "bullish"
        elif "bearish" in overall: sent = "bearish"
        else: sent = "neutral"
        result.append({
            "id": uid,
            "title": title,
            "url": url,
            "source": a.get("source","Alpha Vantage"),
            "published_at": a.get("time_published",""),
            "summary": a.get("summary","")[:200],
            "sentiment": sent,
            "relevance_score": int(float(a.get("overall_sentiment_score",0.5))*100),
            "image_url": a.get("banner_image"),
            "provider": "alphavantage",
        })
    return result


def _parse_marketaux(data: dict, query: str = "") -> List[Dict]:
    articles = data.get("data", [])
    result = []
    for a in articles:
        title = a.get("title","")
        url   = a.get("url","")
        if not title: continue
        uid = hashlib.md5(url.encode()).hexdigest()[:8]
        score = a.get("sentiment_score", 0)
        if score > 0.1: sent = "bullish"
        elif score < -0.1: sent = "bearish"
        else: sent = "neutral"
        result.append({
            "id": uid,
            "title": title,
            "url": url,
            "source": a.get("source","MarketAux"),
            "published_at": a.get("published_at",""),
            "summary": a.get("description","")[:200],
            "sentiment": sent,
            "relevance_score": int(abs(score)*100),
            "image_url": a.get("image_url"),
            "provider": "marketaux",
        })
    return result


def _parse_newsapi(data: dict, query: str = "") -> List[Dict]:
    articles = data.get("articles", [])
    result = []
    for a in articles:
        title = a.get("title","") or ""
        url   = a.get("url","") or ""
        if not title or title == "[Removed]": continue
        uid = hashlib.md5(url.encode()).hexdigest()[:8]
        desc = (a.get("description","") or "")[:200]
        result.append({
            "id": uid,
            "title": title,
            "url": url,
            "source": (a.get("source") or {}).get("name","NewsAPI"),
            "published_at": a.get("publishedAt",""),
            "summary": desc,
            "sentiment": _sentiment(title + " " + desc),
            "relevance_score": _relevance(title, query),
            "image_url": a.get("urlToImage"),
            "provider": "newsapi",
        })
    return result


# ─── Fetchers ─────────────────────────────────────────────────────
async def _fetch_url(url: str, json_mode=False) -> Any:
    try:
        async with httpx.AsyncClient(
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0 (compatible; AYCMarket/2.0)"},
            follow_redirects=True,
        ) as c:
            r = await c.get(url)
            if r.status_code == 200:
                return r.json() if json_mode else r.text
    except Exception:
        pass
    return None


async def _fetch_rss_multi(urls: List[str], query: str = "", limit: int = 20) -> List[Dict]:
    results = []
    for url in urls:
        xml = await _fetch_url(url)
        if xml:
            results.extend(_parse_rss(xml, query=query))
    return _dedup(results)[:limit]


async def _fetch_gdelt(query: str, limit: int = 10) -> List[Dict]:
    url = f"https://api.gdeltproject.org/api/v2/doc/doc?query={query.replace(' ','+')}&mode=ArtList&format=json&timespan=24h&maxrecords={limit}"
    data = await _fetch_url(url, json_mode=True)
    if data:
        return _parse_gdelt(data, query)[:limit]
    return []


async def _fetch_finnhub(symbol: str, limit: int = 10) -> List[Dict]:
    key = _env("FINNHUB_API_KEY")
    if not key: return []
    from datetime import date, timedelta
    today = date.today().isoformat()
    week_ago = (date.today() - timedelta(days=7)).isoformat()
    url = f"https://finnhub.io/api/v1/company-news?symbol={symbol}&from={week_ago}&to={today}&token={key}"
    data = await _fetch_url(url, json_mode=True)
    if isinstance(data, list):
        return _parse_finnhub(data, symbol)[:limit]
    return []


async def _fetch_finnhub_crypto_news(limit: int = 10) -> List[Dict]:
    key = _env("FINNHUB_API_KEY")
    if not key: return []
    url = f"https://finnhub.io/api/v1/news?category=crypto&token={key}"
    data = await _fetch_url(url, json_mode=True)
    if isinstance(data, list):
        return _parse_finnhub(data, "crypto")[:limit]
    return []


async def _fetch_alphavantage(ticker: str, limit: int = 10) -> List[Dict]:
    key = _env("ALPHAVANTAGE_API_KEY")
    if not key: return []
    # crypto vs stock
    is_crypto = ticker in {"BTC","ETH","XRP","SOL","BNB","ADA","DOGE","AVAX","DOT","LINK"}
    t = f"CRYPTO:{ticker}" if is_crypto else ticker
    url = f"https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers={t}&sort=LATEST&limit={limit}&apikey={key}"
    data = await _fetch_url(url, json_mode=True)
    if data:
        return _parse_alphavantage(data, ticker)[:limit]
    return []


async def _fetch_marketaux(symbols: str, limit: int = 10) -> List[Dict]:
    key = _env("MARKETAUX_API_KEY") or _env("MARKETAUX_KEY")
    if not key: return []
    url = f"https://api.marketaux.com/v1/news/all?symbols={symbols}&filter_entities=true&language=en&api_token={key}&limit={limit}"
    data = await _fetch_url(url, json_mode=True)
    if data:
        return _parse_marketaux(data, symbols)[:limit]
    return []


async def _fetch_newsapi(query: str, limit: int = 10) -> List[Dict]:
    key = _env("NEWSAPI_KEY")
    if not key: return []
    url = f"https://newsapi.org/v2/everything?q={query.replace(' ','+')}&sortBy=publishedAt&pageSize={limit}&language=en&apiKey={key}"
    data = await _fetch_url(url, json_mode=True)
    if data:
        return _parse_newsapi(data, query)[:limit]
    return []


def _dedup(items: List[Dict]) -> List[Dict]:
    seen = set()
    out = []
    for i in items:
        uid = i.get("id","")
        if uid not in seen:
            seen.add(uid)
            out.append(i)
    return out


def _sort_by_relevance(items: List[Dict]) -> List[Dict]:
    return sorted(items, key=lambda x: x.get("relevance_score", 50), reverse=True)


# ─── Main aggregator ──────────────────────────────────────────────
async def _aggregate_news(
    query: str,
    symbol: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 15,
) -> List[Dict]:
    cache_key = f"news_{query}_{symbol}_{category}_{limit}"
    cached = _cache_get(cache_key)
    if cached: return cached

    tasks_results: List[Dict] = []

    # 1. Google News RSS (always)
    rss_urls = [rss_google_us(query), rss_google_tr(query)]
    if category and category in RSS_STATIC:
        rss_urls = RSS_STATIC[category] + rss_urls
    elif category == "crypto":
        rss_urls += ["https://www.coindesk.com/arc/outboundfeeds/rss/"]
    rss_items = await _fetch_rss_multi(rss_urls[:4], query=query, limit=limit)
    tasks_results.extend(rss_items)

    # 2. GDELT (free, no key)
    gdelt_q = query.split(" OR ")[0].strip('"')
    gdelt_items = await _fetch_gdelt(gdelt_q, limit=8)
    tasks_results.extend(gdelt_items)

    # 3. Finnhub (if symbol given)
    if symbol:
        fh = await _fetch_finnhub(symbol, limit=8)
        if not fh and symbol in {"BTC","ETH","XRP","SOL"}:
            fh = await _fetch_finnhub_crypto_news(8)
        tasks_results.extend(fh)

    # 4. AlphaVantage news sentiment (if key present)
    if symbol:
        av = await _fetch_alphavantage(symbol, limit=8)
        tasks_results.extend(av)

    # 5. MarketAux
    if symbol:
        mx = await _fetch_marketaux(symbol, limit=8)
        tasks_results.extend(mx)

    # 6. NewsAPI fallback
    newsapi_items = await _fetch_newsapi(query, limit=8)
    tasks_results.extend(newsapi_items)

    # Dedup + sort
    final = _sort_by_relevance(_dedup(tasks_results))[:limit]
    _cache_set(cache_key, final)
    return final


# ─── Endpoints ────────────────────────────────────────────────────

@router.get("/news")
async def get_news(
    query: str = Query(..., description="Arama terimi (örn: bitcoin, apple, bist)"),
    limit: int = Query(10, ge=1, le=20),
):
    """
    Belirtilen sorgu için çoklu kaynaklardan haber aggregation.
    Kaynaklar: Google News RSS, GDELT, Finnhub, AlphaVantage, MarketAux, NewsAPI
    """
    items = await _aggregate_news(query=query, limit=limit)
    sentiment_dist = {
        "bullish": sum(1 for i in items if i["sentiment"]=="bullish"),
        "bearish": sum(1 for i in items if i["sentiment"]=="bearish"),
        "neutral": sum(1 for i in items if i["sentiment"]=="neutral"),
    }
    return {
        "query": query,
        "count": len(items),
        "sentiment_summary": sentiment_dist,
        "items": items,
    }


@router.get("/news/global")
async def get_global_news(
    topic: str = Query("business", description="business|crypto|macro|geo|turkey"),
    limit: int = Query(15, ge=1, le=30),
):
    """Global/tematik haber akışı."""
    cat = topic if topic in RSS_STATIC else "global"
    urls = RSS_STATIC.get(cat, RSS_STATIC["global"])
    items = await _fetch_rss_multi(urls, query=topic, limit=limit)
    # Supplement with GDELT
    gdelt_items = await _fetch_gdelt(topic, limit=8)
    combined = _sort_by_relevance(_dedup(items + gdelt_items))[:limit]
    return {
        "topic": topic,
        "count": len(combined),
        "items": combined,
    }


@router.get("/news/{symbol}")
async def get_news_for_symbol(
    symbol: str,
    limit: int = Query(10, ge=1, le=20),
):
    """Belirli bir varlık sembolü için haber aggregation (BTC, AAPL, THYAO, XAUUSD...)."""
    sym = symbol.upper().replace("USDT","").replace("-USD","")
    query = SYMBOL_QUERY.get(sym, sym)
    items = await _aggregate_news(query=query, symbol=sym, limit=limit)
    sentiment_dist = {
        "bullish": sum(1 for i in items if i["sentiment"]=="bullish"),
        "bearish": sum(1 for i in items if i["sentiment"]=="bearish"),
        "neutral": sum(1 for i in items if i["sentiment"]=="neutral"),
    }
    # Determine overall sentiment
    if sentiment_dist["bullish"] > sentiment_dist["bearish"] + sentiment_dist["neutral"]:
        overall = "bullish"
    elif sentiment_dist["bearish"] > sentiment_dist["bullish"] + sentiment_dist["neutral"]:
        overall = "bearish"
    else:
        overall = "neutral"

    return {
        "symbol": sym,
        "query": query,
        "count": len(items),
        "sentiment_summary": sentiment_dist,
        "overall_sentiment": overall,
        "items": items,
    }


@router.get("/news/feed/ticker")
async def news_ticker_feed(limit: int = Query(10, ge=3, le=20)):
    """Compact ticker headlines for scrolling marquee."""
    cache_key = f"ticker_{limit}"
    cached = _cache_get(cache_key)
    if cached: return cached

    items = await _fetch_rss_multi(RSS_STATIC["all"] + RSS_STATIC["crypto"], query="market", limit=limit)
    result = {
        "count": len(items),
        "headlines": [{
            "id": n["id"],
            "title": n["title"],
            "url": n["url"],
            "source": n["source"],
            "sentiment": n["sentiment"],
        } for n in items[:limit]],
    }
    _cache_set(cache_key, result)
    return result
