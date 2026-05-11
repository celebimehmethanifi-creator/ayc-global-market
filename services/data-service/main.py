"""Data Service — market data fetcher, normalizer, cache writer"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("data-service")


class _MemCache:
    """Redis-drop-in for environments without Redis."""
    def __init__(self): self._s: dict = {}
    async def get(self, k):          return self._s.get(k)
    async def set(self, k, v, ex=None): self._s[k] = v
    async def setex(self, k, ttl, v):   self._s[k] = v
    async def publish(self, ch, v):  pass
    async def close(self):           pass
    async def keys(self, pat="*"):   return list(self._s.keys())


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Cache
    use_mem = os.environ.get("USE_INMEMORY_CACHE", "0") == "1"
    if use_mem:
        app.state.redis = _MemCache()
        log.info("data-service: in-memory cache")
    else:
        import redis.asyncio as aioredis
        try:
            app.state.redis = aioredis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
                encoding="utf-8", decode_responses=True,
            )
        except Exception as e:
            log.warning(f"Redis fallback to memory: {e}")
            app.state.redis = _MemCache()

    # DB URL — SQLite default
    db_url_raw = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./neura_data.db")
    if db_url_raw.startswith("postgresql://"):
        db_url = db_url_raw.replace("postgresql://", "postgresql+asyncpg://")
    elif db_url_raw.startswith("postgres://"):
        db_url = db_url_raw.replace("postgres://", "postgresql+asyncpg://")
    else:
        db_url = db_url_raw
    app.state.db_url = db_url

    # Background tasks
    tasks = []
    try:
        from scheduler import DataScheduler
        sched = DataScheduler(redis=app.state.redis, db_url=db_url)
        tasks.append(asyncio.create_task(sched.run_periodic_fetches()))
        log.info("data-service: scheduler started")
    except Exception as e:
        log.warning(f"Scheduler skipped: {e}")

    try:
        from fetchers.binance_ws import BinanceWSClient
        ws = BinanceWSClient(redis=app.state.redis)
        tasks.append(asyncio.create_task(ws.run()))
        log.info("data-service: Binance WS started")
    except Exception as e:
        log.warning(f"Binance WS skipped: {e}")

    yield

    for t in tasks:
        t.cancel()
    await app.state.redis.close()


app = FastAPI(title="NEURA Data Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "neura-data"}


@app.get("/prices")
async def get_prices(request_obj: None = None):
    """Cache'teki tüm fiyat verilerini döner."""
    from fastapi import Request
    redis = app.state.redis
    result = {}
    try:
        keys = await redis.keys("price:*")
        for k in keys[:100]:
            v = await redis.get(k)
            if v:
                try:
                    result[k.replace("price:", "")] = json.loads(v)
                except Exception:
                    result[k.replace("price:", "")] = v
    except Exception:
        pass
    return {"prices": result, "count": len(result)}


@app.get("/prices/{symbol}")
async def get_price(symbol: str):
    """Tek sembol fiyatı."""
    redis = app.state.redis
    raw = await redis.get(f"price:{symbol.upper()}")
    if not raw:
        return {"symbol": symbol, "price": None, "message": "Not fetched yet"}
    try:
        return {"symbol": symbol, **json.loads(raw)}
    except Exception:
        return {"symbol": symbol, "raw": raw}