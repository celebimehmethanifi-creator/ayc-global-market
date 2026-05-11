from __future__ import annotations

import os
import httpx
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

ASSETS = [
    {"id": "a1", "symbol": "BTCUSDT", "name": "Bitcoin",           "category": "CRYPTO", "exchange": "BINANCE",  "currency": "USDT", "data_source": ["coingecko"], "is_active": True, "meta": {}},
    {"id": "a2", "symbol": "ETHUSDT", "name": "Ethereum",          "category": "CRYPTO", "exchange": "BINANCE",  "currency": "USDT", "data_source": ["coingecko"], "is_active": True, "meta": {}},
    {"id": "a3", "symbol": "SOLUSDT", "name": "Solana",            "category": "CRYPTO", "exchange": "BINANCE",  "currency": "USDT", "data_source": ["coingecko"], "is_active": True, "meta": {}},
    {"id": "a4", "symbol": "AAPL",    "name": "Apple Inc.",        "category": "US",     "exchange": "NASDAQ",   "currency": "USD",  "data_source": ["finnhub"],   "is_active": True, "meta": {}},
    {"id": "a5", "symbol": "NVDA",    "name": "NVIDIA",            "category": "US",     "exchange": "NASDAQ",   "currency": "USD",  "data_source": ["finnhub"],   "is_active": True, "meta": {}},
    {"id": "a6", "symbol": "THYAO.IS","name": "Turk Hava Yollari", "category": "BIST",   "exchange": "BIST",     "currency": "TRY",  "data_source": ["finnhub"],   "is_active": True, "meta": {}},
    {"id": "a7", "symbol": "XAUUSD",  "name": "Altin (Gold)",      "category": "PRECIOUS","exchange": "FOREX",   "currency": "USD",  "data_source": ["finnhub"],   "is_active": True, "meta": {}},
    {"id": "a8", "symbol": "EURUSD",  "name": "EUR/USD",           "category": "FOREX",  "exchange": "FX",       "currency": "USD",  "data_source": ["finnhub"],   "is_active": True, "meta": {}},
]

_PRICE_CACHE: dict[str, dict] = {}

_CG_IDS = {
    "BTCUSDT": "bitcoin", "ETHUSDT": "ethereum", "SOLUSDT": "solana",
    "BNBUSDT": "binancecoin", "XRPUSDT": "ripple", "ADAUSDT": "cardano",
}

async def _live_price(symbol: str) -> dict:
    """CoinGecko veya Finnhub'dan canlı fiyat çek."""
    cached = _PRICE_CACHE.get(symbol)
    if cached and (datetime.now(timezone.utc).timestamp() - cached.get("ts", 0)) < 60:
        return cached

    result = {"price": 0.0, "change_pct": 0.0, "source": "none"}
    cg_id = _CG_IDS.get(symbol.upper())
    if cg_id:
        try:
            cg_key = os.environ.get("COINGECKO_API_KEY", "")
            hdrs = {"x-cg-demo-api-key": cg_key} if cg_key else {}
            async with httpx.AsyncClient(timeout=6, headers=hdrs) as c:
                r = await c.get(
                    f"https://api.coingecko.com/api/v3/simple/price"
                    f"?ids={cg_id}&vs_currencies=usd&include_24hr_change=true"
                )
                if r.status_code == 200:
                    d = r.json().get(cg_id, {})
                    result = {"price": d.get("usd", 0), "change_pct": d.get("usd_24h_change", 0), "source": "coingecko"}
        except Exception:
            pass
    else:
        # Yahoo Finance fallback (commodities, forex, stocks)
        _YAHOO_MAP = {
            "XAUUSD": "GC=F", "XAGUSD": "SI=F", "EURUSD": "EURUSD=X",
            "GBPUSD": "GBPUSD=X", "USDJPY": "JPY=X", "USDTRY": "TRY=X",
            "AAPL": "AAPL", "NVDA": "NVDA", "TSLA": "TSLA",
            "THYAO.IS": "THYAO.IS", "GARAN.IS": "GARAN.IS",
        }
        yahoo_sym = _YAHOO_MAP.get(symbol.upper(), symbol)
        try:
            async with httpx.AsyncClient(timeout=6, headers={"User-Agent":"Mozilla/5.0"}) as c:
                r = await c.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?interval=1d&range=1d")
                if r.status_code == 200:
                    meta = r.json().get("chart",{}).get("result",[{}])[0].get("meta",{})
                    price = meta.get("regularMarketPrice", 0)
                    prev  = meta.get("previousClose", price) or price
                    chg   = ((price - prev) / prev * 100) if prev else 0
                    if price:
                        result = {"price": price, "change_pct": round(chg, 2), "source": "yahoo"}
        except Exception:
            pass
        if result["price"] == 0.0:
            fh_key = os.environ.get("FINNHUB_API_KEY", "")
            if fh_key:
                try:
                    async with httpx.AsyncClient(timeout=6) as c:
                        r = await c.get(f"https://finnhub.io/api/v1/quote?symbol={symbol}&token={fh_key}")
                        if r.status_code == 200:
                            d = r.json()
                            if d.get("c"):
                                prev = d.get("pc", d["c"]) or d["c"]
                                chg = ((d["c"] - prev) / prev * 100) if prev else 0
                                result = {"price": d["c"], "change_pct": round(chg, 2), "source": "finnhub"}
                except Exception:
                    pass

    result["ts"] = datetime.now(timezone.utc).timestamp()
    _PRICE_CACHE[symbol] = result
    return result


async def _build_signal(sid: str, aid: str, symbol: str, name: str, category: str,
                        direction: str, confidence: float, reasoning: str) -> dict:
    pdata = await _live_price(symbol)
    price = pdata["price"] or 1.0
    mult_t = 1.04 if direction == "long" else 0.96
    mult_s = 0.97 if direction == "long" else 1.03
    return {
        "id": sid, "asset_id": aid, "symbol": symbol, "name": name,
        "category": category, "direction": direction, "confidence": confidence,
        "entry_price": round(price, 4),
        "target_price": round(price * mult_t, 4),
        "stop_loss":    round(price * mult_s, 4),
        "risk_reward":  round(abs(mult_t - 1) / abs(mult_s - 1), 2),
        "current_price": round(price, 4),
        "change_pct":   round(pdata["change_pct"], 2),
        "data_source":  pdata["source"],
        "ai_reasoning": reasoning,
        "kalkan_block": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

ALARMS: list[dict] = []
POSITIONS: list[dict] = []


class AlarmIn(BaseModel):
    alarm_type: str
    condition: dict
    asset_id: str | None = None


class PositionIn(BaseModel):
    asset_id: str
    entry_price: float
    quantity: float
    entry_date: str
    notes: str | None = None
    is_simulation: bool = False


@router.get("/assets")
async def assets(category: str | None = None, search: str | None = None, limit: int = 50, offset: int = 0):
    items = list(ASSETS)
    if category and category != "ALL":
        items = [a for a in items if a["category"] == category]
    if search:
        s = search.lower()
        items = [a for a in items if s in a["symbol"].lower() or s in a["name"].lower()]
    # Canlı fiyatları ekle
    enriched = []
    for a in items[offset: offset + limit]:
        pd = await _live_price(a["symbol"])
        enriched.append({**a, "price": pd["price"], "change_pct": pd["change_pct"]})
    return {"items": enriched, "offset": offset, "limit": limit}


@router.get("/assets/market/overview")
async def market_overview():
    cats: dict[str, int] = {}
    for a in ASSETS:
        cats[a["category"]] = cats.get(a["category"], 0) + 1
    return {"categories": [{"category": k, "total": v, "avg_change": 0.4,
                             "last_update": datetime.now(timezone.utc).isoformat()} for k, v in cats.items()]}


@router.get("/signals")
async def signals(category: str | None = None, direction: str | None = None, min_confidence: float = 70):
    sigs = [
        await _build_signal("s1","a1","BTCUSDT","Bitcoin","CRYPTO","long",82.5,"Momentum & on-chain birikim sinyali."),
        await _build_signal("s2","a2","ETHUSDT","Ethereum","CRYPTO","long",77.0,"ETF akimi ve L2 aktivitesi artıyor."),
        await _build_signal("s3","a4","AAPL","Apple Inc.","US","neutral",74.0,"Bekleme bölgesi, kazanç öncesi temkin."),
        await _build_signal("s4","a7","XAUUSD","Altin","PRECIOUS","long",80.0,"Enflasyon endişesi ve merkez bankası alımları."),
    ]
    items = [s for s in sigs if s["confidence"] >= min_confidence]
    if category and category != "ALL":
        items = [s for s in items if s["category"] == category]
    if direction:
        items = [s for s in items if s["direction"] == direction]
    return {"signals": items, "count": len(items)}


@router.get("/signals/featured")
async def featured():
    btc = await _build_signal("s1","a1","BTCUSDT","Bitcoin","CRYPTO","long",82.5,"Momentum & on-chain birikim sinyali.")
    eth = await _build_signal("s2","a2","ETHUSDT","Ethereum","CRYPTO","long",77.0,"ETF akimi ve L2 aktivitesi artıyor.")
    sol = await _build_signal("s3","a3","SOLUSDT","Solana","CRYPTO","long",71.0,"Ekosistem büyümesi devam ediyor.")
    aapl= await _build_signal("s4","a4","AAPL","Apple Inc.","US","neutral",74.0,"Kazanç öncesi bekleme.")
    nvda= await _build_signal("s5","a5","NVDA","NVIDIA","US","long",85.0,"AI çipi talebi yüksek seyrediyor.")
    return {"featured": {
        "CRYPTO": {"saglam": [btc, eth], "long": [btc, eth, sol], "short": []},
        "US":     {"saglam": [nvda, aapl], "long": [nvda], "short": []},
    }}


@router.get("/signals/{signal_id}")
async def get_signal(signal_id: str):
    btc = await _build_signal("s1","a1","BTCUSDT","Bitcoin","CRYPTO","long",82.5,"Momentum.")
    return {"signal": btc}


@router.get("/signals/{signal_id}/strategy")
async def strategy(signal_id: str):
    btc = await _build_signal("s1","a1","BTCUSDT","Bitcoin","CRYPTO","long",82.5,"Momentum.")
    return {"strategy": {"id": str(uuid4()), "signal_id": signal_id, "asset_id": btc["asset_id"],
                          "entry_price": btc["entry_price"], "target1": btc["target_price"],
                          "target2": btc["target_price"] * 1.02, "stop_loss": btc["stop_loss"],
                          "risk_reward": btc["risk_reward"], "entry_timing": {}, "exit_strategy": {}}}


@router.get("/portfolio/positions")
async def list_positions():
    return {"positions": POSITIONS}


@router.post("/portfolio/positions")
async def add_position(body: PositionIn):
    p = body.model_dump()
    p["id"] = str(uuid4())
    POSITIONS.append(p)
    return {"id": p["id"], "message": "ok"}


@router.get("/portfolio/pnl")
async def pnl():
    return {"pnl": {"total_pnl": 0, "total_pnl_pct": 0, "win_rate": 0}}


@router.get("/alarms")
async def alarms():
    return {"alarms": ALARMS}


@router.post("/alarms")
async def add_alarm(body: AlarmIn):
    a = body.model_dump()
    a["id"] = str(uuid4())
    a["is_active"] = True
    a["created_at"] = datetime.now(timezone.utc).isoformat()
    ALARMS.append(a)
    return {"id": a["id"], "message": "ok"}


@router.delete("/alarms/{alarm_id}")
async def del_alarm(alarm_id: str):
    global ALARMS
    ALARMS = [a for a in ALARMS if a["id"] != alarm_id]
    return {"message": "ok"}


@router.post("/alarms/drawdown-lock")
async def drawdown_lock(body: dict):
    return {"message": f"Drawdown kilidi %{body.get('max_drawdown_pct', 5)}"}


@router.get("/alarms/kalkan-status")
async def kalkan():
    return {"active_kalkan_blocks": []}


# copilot routes -> copilot_router.py (real AI)


@router.get("/social/{asset_id}/votes")
async def votes(asset_id: str):
    return {"asset_id": asset_id, "bullish": 11, "bearish": 5, "neutral": 2,
            "total": 18, "bullish_pct": 61.1, "bearish_pct": 27.8}


@router.get("/social/{asset_id}/contrarian")
async def contrarian(asset_id: str):
    return {"asset_id": asset_id, "contrarian_signal": False, "detail": None}


@router.post("/social/{asset_id}/vote")
async def vote(asset_id: str, body: dict):
    return {"message": "Oy kaydedildi", "asset_id": asset_id, "direction": body.get("direction", "neutral")}


@router.get("/user/profile")
async def get_user_profile():
    return {
        "profile": {
            "id": "demo_user",
            "name": "Demo Kullanıcı",
            "email": "demo@aycglobal.com",
            "tier": "pro",
            "risk_level": "medium",
            "max_drawdown": 10,
            "language": "tr",
            "joined": "2026-01-01T00:00:00Z",
            "avatar_url": None,
        }
    }

@router.put("/user/profile")
async def update_user_profile(body: dict = {}):
    return {"profile": body, "updated": True}
