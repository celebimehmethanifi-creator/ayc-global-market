"""Copilot router — chat + briefing"""
from __future__ import annotations
import httpx
import os
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/copilot", tags=["copilot"])
AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://ai-service:8001")
DISCLAIMER = "Bu içerik yatırım tavsiyesi değildir. Yatırım kararlarınızı kendi araştırmalarınıza dayandırınız."


class ChatIn(BaseModel):
    message: str
    context: dict = {}


@router.post("/chat")
async def chat(body: ChatIn, request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    # Fetch portfolio context
    port_result = await db.execute(
        text("""
            SELECT a.symbol, pp.entry_price, pp.quantity, ap.price as current_price
            FROM portfolio_positions pp
            JOIN portfolios p ON p.id = pp.portfolio_id
            JOIN assets a ON a.id = pp.asset_id
            LEFT JOIN LATERAL (
                SELECT price FROM asset_prices WHERE asset_id = pp.asset_id ORDER BY fetched_at DESC LIMIT 1
            ) ap ON true
            WHERE p.user_id = :uid AND pp.is_simulation = false LIMIT 20
        """),
        {"uid": uid},
    )
    positions = [dict(r) for r in port_result.mappings().all()]

    payload = {
        "user_id": uid,
        "message": body.message,
        "portfolio": positions,
        "extra_context": body.context,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(f"{AI_SERVICE_URL}/copilot/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            return {"reply": "AI servisi şu anda meşgul, lütfen kısa süre sonra tekrar deneyin.", "disclaimer": DISCLAIMER}

    data["disclaimer"] = DISCLAIMER
    return data


@router.get("/briefing/latest")
async def latest_briefing(request: Request, db: AsyncSession = Depends(get_db)):
    uid = request.state.user_id
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(f"{AI_SERVICE_URL}/briefing/latest?user_id={uid}")
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            data = {"summary": "Sabah brifing hazırlanıyor...", "generated_at": None}
    data["disclaimer"] = DISCLAIMER
    return data


@router.post("/what-if")
async def what_if(body: dict, request: Request):
    uid = request.state.user_id
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(f"{AI_SERVICE_URL}/copilot/what-if", json={"user_id": uid, **body})
            resp.raise_for_status()
            data = resp.json()
        except Exception:
            data = {"result": "What-If simülasyonu şu anda kullanılamıyor."}
    data["disclaimer"] = DISCLAIMER
    return data
