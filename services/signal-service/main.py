"""Signal Service — scorer, filter, strategy builder (Redis/DB fallback)"""
from __future__ import annotations
import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

log = logging.getLogger("signal-service")


class _MemoryCache:
    """Minimal in-memory Redis-like cache."""
    def __init__(self):
        self._store: dict = {}

    async def get(self, key):
        return self._store.get(key)

    async def setex(self, key, ttl, value):
        self._store[key] = value

    async def set(self, key, value, ex=None):
        self._store[key] = value

    async def publish(self, channel, message):
        pass

    async def close(self):
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    use_inmemory = os.environ.get("USE_INMEMORY_CACHE", "0") == "1"
    if use_inmemory:
        app.state.redis = _MemoryCache()
        log.info("signal-service: using in-memory cache")
    else:
        import redis.asyncio as aioredis
        try:
            app.state.redis = aioredis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
                encoding="utf-8",
                decode_responses=True,
            )
        except Exception as e:
            log.warning(f"Redis connect failed, fallback: {e}")
            app.state.redis = _MemoryCache()

    # Only start scheduler if DB is available (skip in mock mode)
    if os.environ.get("USE_MOCK_BACKEND", "0") != "1":
        try:
            from scheduler import SignalScheduler
            scheduler = SignalScheduler(
                redis=app.state.redis,
                ai_service_url=os.environ.get("AI_SERVICE_URL", "http://localhost:8001"),
            )
            asyncio.create_task(scheduler.run())
        except Exception as e:
            log.warning(f"Scheduler start skipped: {e}")

    yield
    await app.state.redis.close()


app = FastAPI(title="NEURA Signal Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "neura-signal"}


# ── Signal endpoints (inline router) ─────────────────────────────────────────
import json, uuid
from datetime import datetime, timezone
from fastapi import Request
from pydantic import BaseModel

class GenerateRequest(BaseModel):
    asset_id: str
    symbol:   str
    category: str = "crypto"

@app.post("/signals/generate")
async def generate_signal(body: GenerateRequest, request: Request):
    """AI Service'ten sinyal al + scorer filtresi uygula."""
    import httpx
    ai_url = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{ai_url}/analysis/signal", json={
                "asset_id": body.asset_id,
                "symbol":   body.symbol,
                "category": body.category,
            })
            signal = r.json().get("signal", {})
    except Exception as e:
        log.warning(f"AI Service call failed: {e}")
        signal = {}

    from scorer import SignalScorer
    scorer = SignalScorer()
    passes = scorer.passes_filter(signal)
    if passes:
        card = scorer.build_strategy_card(signal, body.symbol)
    else:
        card = None

    # cache'e yaz
    key = f"signal:{body.asset_id}"
    await request.app.state.redis.setex(key, 21600, json.dumps(signal))

    return {
        "signal":          signal,
        "strategy_card":   card,
        "passes_filter":   passes,
        "generated_at":    datetime.now(timezone.utc).isoformat(),
    }


@app.get("/signals")
async def list_signals(limit: int = 20, request: Request = None):
    """Cache'teki son sinyalleri listele."""
    redis = request.app.state.redis
    result = []
    try:
        keys = await redis.keys("signal:*")
        for k in list(keys)[:limit]:
            raw = await redis.get(k)
            if raw:
                try: result.append(json.loads(raw))
                except Exception: pass
    except Exception:
        pass
    return {"signals": result, "count": len(result)}


@app.get("/signals/{asset_id}")
async def get_signal(asset_id: str, request: Request):
    raw = await request.app.state.redis.get(f"signal:{asset_id}")
    if not raw:
        from fastapi import HTTPException
        raise HTTPException(404, "Signal not found")
    return json.loads(raw)