from __future__ import annotations
import os
import logging
from contextlib import asynccontextmanager

# API key aliasları (litellm beklentileri)
if os.environ.get("GEMINI_API_KEY") and not os.environ.get("GOOGLE_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]
if os.environ.get("CLAUDE_API_KEY") and not os.environ.get("ANTHROPIC_API_KEY"):
    os.environ["ANTHROPIC_API_KEY"] = os.environ["CLAUDE_API_KEY"]

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

log = logging.getLogger("ai-service")


class _MemoryCache:
    def __init__(self): self._store: dict = {}
    async def get(self, key): return self._store.get(key)
    async def setex(self, key, ttl, value): self._store[key] = value
    async def set(self, key, value, ex=None): self._store[key] = value
    async def publish(self, channel, message): pass
    async def close(self): pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    use_inmemory = os.environ.get("USE_INMEMORY_CACHE", "0") == "1"
    if use_inmemory:
        app.state.redis = _MemoryCache()
        log.info("ai-service: using in-memory cache (no Redis)")
    else:
        import redis.asyncio as aioredis
        try:
            app.state.redis = aioredis.from_url(
                os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
                encoding="utf-8", decode_responses=True,
            )
        except Exception as e:
            log.warning(f"Redis connect failed, fallback to memory: {e}")
            app.state.redis = _MemoryCache()

    if os.environ.get("USE_MOCK_BACKEND", "0") != "1":
        try:
            from db import init_db
            await init_db()
        except Exception as e:
            log.warning(f"DB init skipped: {e}")

    yield

    if hasattr(app.state.redis, "close"):
        await app.state.redis.close()


app = FastAPI(title="NEURA AI Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

from routers.analysis import router as analysis_router
from routers.copilot  import router as copilot_router
from routers.briefing import router as briefing_router

app.include_router(analysis_router, prefix="/analysis")
app.include_router(copilot_router,  prefix="/copilot")
app.include_router(briefing_router, prefix="/briefing")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "neura-ai"}