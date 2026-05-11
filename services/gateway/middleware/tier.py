"""Tier gate middleware — enforces free/pro/elite limits"""
from __future__ import annotations
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

TIER_LIMITS = {
    "free": {
        "daily_signals": 1,
        "copilot": False,
        "alarms_max": 3,
    },
    "pro": {
        "daily_signals": None,  # unlimited
        "copilot": True,
        "alarms_max": 50,
    },
    "elite": {
        "daily_signals": None,
        "copilot": True,
        "alarms_max": None,
    },
}

COPILOT_PATHS = ["/api/v1/copilot"]
SIGNAL_PATHS = ["/api/v1/signals"]


class TierGateMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        tier = getattr(request.state, "user_tier", "free")
        path = request.url.path
        limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

        # Block copilot for free tier
        if any(path.startswith(p) for p in COPILOT_PATHS):
            if not limits["copilot"]:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "Pro gerekli",
                        "detail": "AI Copilot Pro veya Elite plan gerektirir.",
                        "upgrade_url": "/subscribe",
                    },
                )

        return await call_next(request)
