"""
AYC Global Market - Signal Intelligence Router
GET /signals/live          - tum aktif sinyaller (WATCH/SETUP/TRIGGER/KALKAN)
GET /signals/state/{sym}   - tek sembol derin analiz
"""
from __future__ import annotations
import asyncio, time
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/signals", tags=["signals"])

# Izlenecek evren (genisletilebilir)
UNIVERSE = [
    {"symbol":"BTCUSDT",  "name":"Bitcoin",        "market":"crypto"},
    {"symbol":"ETHUSDT",  "name":"Ethereum",        "market":"crypto"},
    {"symbol":"SOLUSDT",  "name":"Solana",          "market":"crypto"},
    {"symbol":"BNBUSDT",  "name":"BNB Chain",       "market":"crypto"},
    {"symbol":"XRPUSDT",  "name":"Ripple",          "market":"crypto"},
    {"symbol":"ADAUSDT",  "name":"Cardano",         "market":"crypto"},
    {"symbol":"DOGEUSDT", "name":"Dogecoin",        "market":"crypto"},
    {"symbol":"AVAXUSDT", "name":"Avalanche",       "market":"crypto"},
    {"symbol":"AAPL",     "name":"Apple",           "market":"us"},
    {"symbol":"NVDA",     "name":"NVIDIA",          "market":"us"},
    {"symbol":"TSLA",     "name":"Tesla",           "market":"us"},
    {"symbol":"MSFT",     "name":"Microsoft",       "market":"us"},
    {"symbol":"XAUUSD",   "name":"Altin",           "market":"precious"},
    {"symbol":"THYAO",    "name":"Turk Hava Yollari","market":"bist"},
    {"symbol":"GARAN",    "name":"Garanti",         "market":"bist"},
]

STAGE_COLOR = {
    "TRIGGER": "#0ECB81",
    "SETUP":   "#D4A843",
    "WATCH":   "#60A5FA",
    "KALKAN":  "#F6465D",
    "NONE":    "#4B5563",
}
STAGE_LABEL = {
    "TRIGGER": "Tetik Alarmi",
    "SETUP":   "Kurulum Olusuyor",
    "WATCH":   "Izleme Alarmi",
    "KALKAN":  "Kalkan Bloke",
    "NONE":    "Sinyal Yok",
}


async def _fetch_ohlcv_and_price(symbol: str, market: str) -> tuple[list, float, float, float]:
    """(candles, price, change_24h, volume_ratio)"""
    try:
        import yfinance as yf
        sym_map = {
            "BTCUSDT":"BTC-USD","ETHUSDT":"ETH-USD","SOLUSDT":"SOL-USD",
            "BNBUSDT":"BNB-USD","XRPUSDT":"XRP-USD","ADAUSDT":"ADA-USD",
            "DOGEUSDT":"DOGE-USD","AVAXUSDT":"AVAX-USD","XAUUSD":"GC=F",
            "USOIL":"CL=F",
        }
        yf_sym = sym_map.get(symbol, symbol)
        df = await asyncio.get_event_loop().run_in_executor(
            None, lambda: yf.Ticker(yf_sym).history(period="60d", interval="1d")
        )
        if df is None or df.empty:
            return [], 0, 0, 1
        candles = [
            {"c": row["Close"], "h": row["High"], "l": row["Low"],
             "o": row["Open"],  "v": row["Volume"]}
            for _, row in df.iterrows() if row["Close"] > 0
        ]
        price   = float(candles[-1]["c"]) if candles else 0
        prev    = float(candles[-2]["c"]) if len(candles) >= 2 else price
        chg_24h = (price - prev) / prev * 100 if prev else 0
        vols    = [float(c["v"]) for c in candles]
        avg_vol = sum(vols[-20:]) / 20 if len(vols) >= 20 else (vols[-1] if vols else 1)
        vol_ratio = (float(candles[-1]["v"]) / avg_vol) if avg_vol > 0 else 1
        return candles, price, round(chg_24h, 2), round(vol_ratio, 2)
    except Exception as e:
        return [], 0, 0, 1


def _payload_to_dict(p, asset: dict) -> dict:
    from signal_intelligence import AlarmPayload
    s = p.scores
    return {
        "symbol":     p.symbol,
        "name":       asset["name"],
        "market":     asset["market"],
        "stage":      p.stage,
        "stage_label":STAGE_LABEL.get(p.stage, p.stage),
        "stage_color":STAGE_COLOR.get(p.stage, "#4B5563"),
        "direction":  p.direction,
        "ai_hint":    p.ai_hint,
        "stage_reason": p.stage_reason,
        "kalkan_reason":p.kalkan_reason,
        "trigger_level": p.trigger_level,
        "invalidation":  p.invalidation,
        "take_profit":   p.take_profit,
        "motor_votes":   p.motor_votes,
        "warnings":      p.warnings[:3],
        "scores": {
            "opportunity": s.opportunity,
            "risk":        s.risk,
            "confidence":  s.confidence,
            "news_impact": s.news_impact,
            "liquidity":   s.liquidity,
            "volatility":  s.volatility,
            "trend":       s.trend,
            "composite":   s.composite,
        },
    }


@router.get("/live")
async def signals_live(
    market: str = Query("all", description="all|crypto|us|bist|precious"),
    limit: int  = Query(15, le=20),
):
    from signal_intelligence import run_signal_pipeline

    t0       = time.perf_counter()
    universe = UNIVERSE if market == "all" else [a for a in UNIVERSE if a["market"] == market]
    universe = universe[:limit]

    async def _process(asset):
        sym = asset["symbol"]
        candles, price, chg, vol_ratio = await _fetch_ohlcv_and_price(sym, asset["market"])
        if not candles or price == 0:
            return None
        try:
            payload = run_signal_pipeline(
                symbol=sym, candles=candles, price=price,
                change_24h=chg, volume_ratio=vol_ratio, market=asset["market"],
            )
            d = _payload_to_dict(payload, asset)
            d["price"]     = price
            d["change_24h"]= chg
            return d
        except Exception as e:
            return {"symbol": sym, "stage": "NONE", "error": str(e)}

    results = await asyncio.gather(*[_process(a) for a in universe])
    results = [r for r in results if r]

    # Sirala: TRIGGER > SETUP > WATCH > KALKAN > NONE
    order = {"TRIGGER":0,"SETUP":1,"WATCH":2,"KALKAN":3,"NONE":4}
    results.sort(key=lambda x: order.get(x.get("stage","NONE"), 5))

    return {
        "signals": results,
        "count":   len(results),
        "elapsed_ms": int((time.perf_counter()-t0)*1000),
        "stage_counts": {k: sum(1 for r in results if r.get("stage")==k) for k in order},
    }


@router.get("/state/{symbol}")
async def signal_state(symbol: str):
    """Tek sembol icin derin 7-skor + 4-asama analizi"""
    from signal_intelligence import run_signal_pipeline

    asset = next((a for a in UNIVERSE if a["symbol"].upper() == symbol.upper()),
                 {"symbol": symbol, "name": symbol, "market": "crypto"})

    candles, price, chg, vol_ratio = await _fetch_ohlcv_and_price(symbol, asset["market"])
    if not candles or price == 0:
        return JSONResponse({"error": f"Veri alinamadi: {symbol}"}, status_code=503)

    try:
        payload = run_signal_pipeline(
            symbol=symbol, candles=candles, price=price,
            change_24h=chg, volume_ratio=vol_ratio, market=asset["market"],
        )
        d = _payload_to_dict(payload, asset)
        d["price"]      = price
        d["change_24h"] = chg
        d["motor_reasons"] = payload.motor_reasons
        return d
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)