"""Simple Redis-backed rate limiter"""
from __future__ import annotations
import os
import time
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as aioredis

RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 120    # requests per window per user/IP


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        user_id = getattr(request.state, "user_id", None)
        key_id = user_id or request.client.host
        redis: aioredis.Redis = request.app.state.redis

        window = int(time.time() // RATE_LIMIT_WINDOW)
        key = f"rate:{key_id}:{window}"

        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, RATE_LIMIT_WINDOW * 2)

        if count > RATE_LIMIT_MAX:
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded", "retry_after": RATE_LIMIT_WINDOW},
                headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(RATE_LIMIT_MAX)
        response.headers["X-RateLimit-Remaining"] = str(max(0, RATE_LIMIT_MAX - count))
        return response
