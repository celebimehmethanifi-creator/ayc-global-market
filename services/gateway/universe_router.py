"""
AYC Global Market - Piyasa Evreni + 5/5/5 Sinyal Tablosu
Her kategori icin: 5 Saglam, 5 Long adayi, 5 Short adayi
Signal Motorlari kullanilarak hizli tarama yapilir.
"""
from __future__ import annotations
import asyncio, json, time
from pathlib import Path
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/universe", tags=["universe"])

# ─── Her kategorinin sembol listesi ─────────────────────────────
UNIVERSE: dict[str, list[dict]] = {
    "crypto": [
        {"s":"BTCUSDT","n":"Bitcoin","m":"crypto"},
        {"s":"ETHUSDT","n":"Ethereum","m":"crypto"},
        {"s":"BNBUSDT","n":"BNB","m":"crypto"},
        {"s":"SOLUSDT","n":"Solana","m":"crypto"},
        {"s":"XRPUSDT","n":"XRP","m":"crypto"},
        {"s":"ADAUSDT","n":"Cardano","m":"crypto"},
        {"s":"AVAXUSDT","n":"Avalanche","m":"crypto"},
        {"s":"DOGEUSDT","n":"Dogecoin","m":"crypto"},
        {"s":"LINKUSDT","n":"Chainlink","m":"crypto"},
        {"s":"DOTUSDT","n":"Polkadot","m":"crypto"},
    ],
    "us": [
        {"s":"AAPL","n":"Apple","m":"us"},
        {"s":"MSFT","n":"Microsoft","m":"us"},
        {"s":"NVDA","n":"NVIDIA","m":"us"},
        {"s":"AMZN","n":"Amazon","m":"us"},
        {"s":"GOOGL","n":"Alphabet","m":"us"},
        {"s":"META","n":"Meta","m":"us"},
        {"s":"TSLA","n":"Tesla","m":"us"},
        {"s":"BRK-B","n":"Berkshire","m":"us"},
        {"s":"JPM","n":"JP Morgan","m":"us"},
        {"s":"V","n":"Visa","m":"us"},
    ],
    "turkey": [
        {"s":"XU100.IS","n":"BIST 100","m":"turkey"},
        {"s":"GARAN.IS","n":"Garanti Bankası","m":"turkey"},
        {"s":"THYAO.IS","n":"THY","m":"turkey"},
        {"s":"SAHOL.IS","n":"Sabancı Holding","m":"turkey"},
        {"s":"EREGL.IS","n":"Ereğli Demir","m":"turkey"},
        {"s":"ISCTR.IS","n":"İş Bankası","m":"turkey"},
        {"s":"BIMAS.IS","n":"BIM","m":"turkey"},
        {"s":"KCHOL.IS","n":"Koç Holding","m":"turkey"},
        {"s":"ASELS.IS","n":"Aselsan","m":"turkey"},
        {"s":"SISE.IS","n":"Şişecam","m":"turkey"},
    ],
    "precious": [
        {"s":"XAUUSD","n":"Altın","m":"precious"},
        {"s":"XAGUSD","n":"Gümüş","m":"precious"},
        {"s":"XPTUSD","n":"Platin","m":"precious"},
        {"s":"XPDUSD","n":"Paladyum","m":"precious"},
        {"s":"GC=F","n":"Altın Vadeli","m":"precious"},
    ],
    "energy": [
        {"s":"CL=F","n":"Petrol (WTI)","m":"energy"},
        {"s":"BZ=F","n":"Brent Petrol","m":"energy"},
        {"s":"NG=F","n":"Doğalgaz","m":"energy"},
        {"s":"XOM","n":"ExxonMobil","m":"energy"},
        {"s":"CVX","n":"Chevron","m":"energy"},
    ],
    "forex": [
        {"s":"EURUSD","n":"EUR/USD","m":"forex"},
        {"s":"GBPUSD","n":"GBP/USD","m":"forex"},
        {"s":"USDJPY","n":"USD/JPY","m":"forex"},
        {"s":"USDTRY","n":"USD/TRY","m":"forex"},
        {"s":"EURTRY","n":"EUR/TRY","m":"forex"},
        {"s":"AUDUSD","n":"AUD/USD","m":"forex"},
        {"s":"USDCHF","n":"USD/CHF","m":"forex"},
    ],
    "index": [
        {"s":"^GSPC","n":"S&P 500","m":"index"},
        {"s":"^DJI","n":"Dow Jones","m":"index"},
        {"s":"^IXIC","n":"NASDAQ","m":"index"},
        {"s":"^FTSE","n":"FTSE 100","m":"index"},
        {"s":"^DAX","n":"DAX","m":"index"},
        {"s":"^N225","n":"Nikkei 225","m":"index"},
    ],
    "etf": [
        {"s":"SPY","n":"SPDR S&P 500","m":"etf"},
        {"s":"QQQ","n":"Invesco QQQ","m":"etf"},
        {"s":"GLD","n":"SPDR Gold","m":"etf"},
        {"s":"TLT","n":"iShares 20Y","m":"etf"},
        {"s":"IWM","n":"Russell 2000","m":"etf"},
        {"s":"EEM","n":"Emerging Markets","m":"etf"},
    ],
}
# Tüm piyasalar = hepsinin birligi
UNIVERSE["all"] = [item for items in UNIVERSE.values() for item in items]


async def _fetch_price(symbol: str, market: str, session) -> dict:
    """Gateway'den hizli fiyat al."""
    try:
        async with session.get(f"http://localhost:8000/api/v1/price/{symbol}",
                               timeout=__import__("aiohttp").ClientTimeout(total=5)) as r:
            if r.status == 200:
                d = await r.json()
                return {"symbol": symbol, "price": d.get("price",0),
                        "change": d.get("change",0), "source": d.get("source",""),
                        "live": d.get("live",False)}
    except Exception:
        pass
    return {"symbol": symbol, "price": 0, "change": 0, "source": "unavailable", "live": False}


async def _score_asset(asset: dict, session) -> dict | None:
    """OHLCV al, motor skorlari hesapla, varligı değerlendir."""
    import sys, importlib
    gw = str(Path(__file__).parent)
    if gw not in sys.path: sys.path.insert(0, gw)
    sm = importlib.import_module("signal_motors")
    import aiohttp

    try:
        # Fiyat + OHLCV paralel
        price_task = _fetch_price(asset["s"], asset["m"], session)
        async with session.get(f"http://localhost:8000/api/v1/ohlcv/{asset['s']}?tf=1D",
                               timeout=aiohttp.ClientTimeout(total=8)) as r:
            if r.status != 200: return None
            od = await r.json()

        price_data = await price_task
        candles = od.get("candles", [])
        if len(candles) < 15: return None

        change = price_data.get("change", 0)
        result = sm.compute_technical_score(candles, change_24h=change)
        score  = result["technical_score"]
        longs  = result["long_votes"]
        shorts = result["short_votes"]

        # Durum belirle
        if longs >= 3 and score >= 58:
            state = "LONG"
        elif shorts >= 3 and score < 43:
            state = "SHORT"
        elif longs >= 2 and score >= 52:
            state = "LONG"
        elif shorts >= 2 and score < 45:
            state = "SHORT"
        elif score >= 53:
            state = "SAGLAM"
        else:
            state = "IZLE"

        return {
            "symbol":   asset["s"],
            "name":     asset["n"],
            "market":   asset["m"],
            "price":    price_data.get("price", 0),
            "change":   change,
            "live":     price_data.get("live", False),
            "score":    score,
            "long_votes": longs,
            "short_votes": shorts,
            "state":    state,
            "indicators": {
                "rsi":  result["indicators"].get("rsi"),
                "ma20": result["indicators"].get("ma20"),
            },
            "motors_summary": [{"m": m["motor"], "s": m["signal"], "sc": m["score"]}
                               for m in result["motors"]],
        }
    except Exception as e:
        return None


@router.get("/{market_id}")
async def get_universe(
    market_id: str,
    limit_each: int = Query(5, description="Her kategoriden max N aday"),
):
    """
    Belirtilen market kategorisi icin 5 Saglam + 5 Long + 5 Short uret.
    Gercek candle verisiyle motor analizi yapilir.
    """
    t0 = time.perf_counter()
    assets = UNIVERSE.get(market_id, UNIVERSE.get("crypto"))
    if not assets:
        return JSONResponse({"error": f"Bilinmeyen market: {market_id}"}, status_code=404)

    import aiohttp
    async with aiohttp.ClientSession() as session:
        tasks = [_score_asset(a, session) for a in assets]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    scored = [r for r in results if r and isinstance(r, dict)]

    # Kategorilere ayir
    long_cands  = sorted([r for r in scored if r["state"]=="LONG"],  key=lambda x:-x["score"])
    short_cands = sorted([r for r in scored if r["state"]=="SHORT"], key=lambda x: x["score"])
    saglam_cands= sorted([r for r in scored if r["state"]=="SAGLAM"],key=lambda x:-x["score"])
    izle_cands  = [r for r in scored if r["state"]=="IZLE"]

    # Saglam yoksa yüksek skoru al
    if not saglam_cands:
        fallback = sorted([r for r in scored if r["state"] in ["LONG","IZLE"]], key=lambda x:-x["score"])
        saglam_cands = fallback[:limit_each]

    ms = int((time.perf_counter()-t0)*1000)
    return {
        "market": market_id,
        "total_scanned": len(scored),
        "elapsed_ms": ms,
        "saglam":  saglam_cands[:limit_each],
        "long":    long_cands[:limit_each],
        "short":   short_cands[:limit_each],
        "izle":    izle_cands[:3],
        "note": f"{len(scored)}/{len(assets)} varlik analiz edildi. Gercek OHLCV verisi kullanildi.",
    }