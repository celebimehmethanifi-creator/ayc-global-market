"""AYC Global Market - API Gateway v2"""
from __future__ import annotations
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from database import init_db
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pathlib import Path

_env = Path(__file__).parent / ".env"
if _env.exists():
    from dotenv import load_dotenv
    load_dotenv(_env)

try:
    import redis.asyncio as aioredis
    _HAS_REDIS = True
except ImportError:
    _HAS_REDIS = False

from mock_router import router as mock_router
from brain_router import router as brain_router
from consensus_router import router as consensus_router
from universe_router import router as universe_router
from copilot_router import router as copilot_router
from signal_router import router as signal_router
from intelligence_router import router as intelligence_router
from news_router import router as news_router
from price_router import router as price_router
from auth_router    import router as auth_router
from billing_router import router as billing_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.redis = None
    if _HAS_REDIS and os.environ.get("USE_INMEMORY_CACHE","0") != "1":
        try:
            app.state.redis = aioredis.from_url(
                os.environ.get("REDIS_URL","redis://localhost:6379/0"),
                encoding="utf-8", decode_responses=True
            )
        except Exception:
            pass
    yield
    if getattr(app.state, "redis", None):
        await app.state.redis.close()

app = FastAPI(

    title="AYC Global Market API",
    description="AI-powered global market intelligence — GPT-4o + Claude + Gemini",
    version="2.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

@app.on_event("startup")
async def _startup():
    init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = "/api/v1"
app.include_router(auth_router,         prefix=PREFIX)
app.include_router(billing_router,      prefix=PREFIX)
app.include_router(mock_router,    prefix=PREFIX)
app.include_router(brain_router,   prefix=PREFIX)
app.include_router(consensus_router, prefix=f"{PREFIX}/brain")
app.include_router(copilot_router,   prefix=PREFIX)   # Real AI: GPT-4o + Claude + Gemini
app.include_router(signal_router,    prefix=PREFIX)   # 4-stage alarm + 7 scores
app.include_router(universe_router,  prefix=f"{PREFIX}")
app.include_router(intelligence_router, prefix=PREFIX)  # Causal
app.include_router(news_router,         prefix=PREFIX)
app.include_router(price_router,        prefix=PREFIX)   # News & RSS feeds  # Causal + Scenario + Twin + Performance

# ─── Real-time price (REST polling) ───────────────────────────
import httpx, asyncio

BINANCE_PRICE = "https://api.binance.com/api/v3/ticker/price"
YAHOO_QUOTE   = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"

@app.get("/api/v1/price/{symbol}")
async def get_price(symbol: str):
    sym = symbol.upper().strip()
    # Crypto: Binance
    binance_sym = sym if sym.endswith("USDT") else f"{sym}USDT"
    try:
        async with httpx.AsyncClient(timeout=4) as c:
            r = await c.get(BINANCE_PRICE, params={"symbol": binance_sym})
            if r.status_code == 200:
                d = r.json()
                return {"symbol":sym,"price":float(d["price"]),"source":"binance","live":True}
    except Exception:
        pass
    # Fallback: Yahoo
    try:
        async with httpx.AsyncClient(timeout=5, headers={"User-Agent":"Mozilla/5.0"}) as c:
            r = await c.get(YAHOO_QUOTE.format(sym=sym))
            if r.status_code == 200:
                d = r.json()
                price = d["chart"]["result"][0]["meta"].get("regularMarketPrice")
                if price:
                    return {"symbol":sym,"price":float(price),"source":"yahoo","live":True}
    except Exception:
        pass
    return JSONResponse(status_code=404, content={"error":"Fiyat alınamadı"})


# ─── Real-time OHLCV history ──────────────────────────────────
BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
YAHOO_CHART    = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}"

TF_MAP = {
    "1D": {"range":"1d",  "interval":"5m",  "b_interval":"5m",  "b_limit":288},
    "1W": {"range":"5d",  "interval":"30m", "b_interval":"30m", "b_limit":336},
    "1M": {"range":"1mo", "interval":"1d",  "b_interval":"1d",  "b_limit":31},
    "3M": {"range":"3mo", "interval":"1d",  "b_interval":"1d",  "b_limit":90},
    "1Y": {"range":"1y",  "interval":"1wk", "b_interval":"1w",  "b_limit":52},
}

@app.get("/api/v1/ohlcv/{symbol}")
async def get_ohlcv(symbol: str, tf: str = "1M"):
    sym    = symbol.upper().strip()
    cfg    = TF_MAP.get(tf, TF_MAP["1M"])
    candles = []

    # Try Binance first (crypto)
    binance_sym = sym if sym.endswith("USDT") else f"{sym}USDT"
    try:
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(BINANCE_KLINES, params={
                "symbol":binance_sym, "interval":cfg["b_interval"], "limit":cfg["b_limit"]
            })
            if r.status_code == 200:
                for k in r.json():
                    candles.append({
                        "t": int(k[0])//1000,
                        "o": float(k[1]), "h": float(k[2]),
                        "l": float(k[3]), "c": float(k[4]),
                        "v": float(k[5]),
                    })
    except Exception:
        pass

    # Fallback: Yahoo Finance
    if not candles:
        try:
            async with httpx.AsyncClient(timeout=8, headers={"User-Agent":"Mozilla/5.0"}) as c:
                r = await c.get(YAHOO_CHART.format(sym=sym), params={
                    "range":cfg["range"], "interval":cfg["interval"]
                })
                if r.status_code == 200:
                    d = r.json()
                    res = d["chart"]["result"][0]
                    ts   = res["timestamp"]
                    q    = res["indicators"]["quote"][0]
                    opens   = q.get("open",[])
                    highs   = q.get("high",[])
                    lows    = q.get("low",[])
                    closes  = q.get("close",[])
                    volumes = q.get("volume",[])
                    for i,t in enumerate(ts):
                        if i<len(closes) and closes[i] is not None:
                            candles.append({
                                "t": int(t),
                                "o": float(opens[i] or closes[i]),
                                "h": float(highs[i] or closes[i]),
                                "l": float(lows[i] or closes[i]),
                                "c": float(closes[i]),
                                "v": float(volumes[i] or 0) if i<len(volumes) else 0,
                            })
        except Exception:
            pass

    if not candles:
        return JSONResponse(status_code=404, content={"error":"OHLCV alınamadı"})

    return {"symbol":sym,"tf":tf,"count":len(candles),"candles":candles,"source":"live"}


@app.get("/health")
async def health():
    return {"status":"ok","service":"ayc-global-market","version":"2.1.0"}

@app.get("/")
async def root():
    return {"name":"AYC Global Market API","docs":"/api/docs","version":"2.1.0"}

@app.exception_handler(Exception)
async def global_error_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error":"Internal server error","detail":str(exc)})








