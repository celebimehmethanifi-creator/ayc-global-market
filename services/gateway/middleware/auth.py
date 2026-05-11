"""Auth middleware — validates Supabase JWT"""
from __future__ import annotations
import os
import jwt
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

SUPABASE_JWT_SECRET = os.environ.get("SUPABASE_SERVICE_KEY", "")

PUBLIC_PATHS = {
    "/health",
    "/api/docs",
    "/api/redoc",
    "/api/v1/auth/signup",
    "/api/v1/auth/signin",
    "/api/v1/auth/refresh",
    "/api/v1/auth/oauth",
    "/api/v1/webhooks/stripe",
    "/api/v1/webhooks/iyzico",
    "/api/v1/market/overview",  # public overview
}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in PUBLIC_PATHS):
            return await call_next(request)

        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"error": "Unauthorized", "detail": "Bearer token required"},
            )

        token = auth.removeprefix("Bearer ").strip()
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            request.state.user_id = payload.get("sub")
            request.state.user_email = payload.get("email")
            request.state.user_tier = payload.get("app_metadata", {}).get("tier", "free")
        except jwt.ExpiredSignatureError:
            return JSONResponse(status_code=401, content={"error": "Token expired"})
        except jwt.InvalidTokenError as e:
            return JSONResponse(status_code=401, content={"error": "Invalid token", "detail": str(e)})

        return await call_next(request)
