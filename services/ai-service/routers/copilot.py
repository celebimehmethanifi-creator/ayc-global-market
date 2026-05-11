"""Copilot router — chat + what-if (mock fallback when no LLM key)"""
from __future__ import annotations
import logging
import os

from fastapi import APIRouter
from pydantic import BaseModel

log = logging.getLogger("copilot")
router = APIRouter(tags=["copilot"])

DISCLAIMER = "Bu içerik yatırım tavsiyesi değildir. Yatırım kararlarınızı kendi araştırmalarınıza dayandırınız."

COPILOT_SYSTEM = """Sen NEURA, kullanıcının kişisel AI finans asistanısın.
Kullanıcının portföyünü biliyorsun ve piyasa analizleri yapabiliyorsun.
HER ZAMAN yanıtın sonuna şu uyarıyı ekle: "⚠️ Bu içerik yatırım tavsiyesi değildir."
Yanıtların Türkçe, kısa, net ve kullanıcı dostu olsun.
Abartılı getiri vaatlerinde bulunma. Risk faktörlerini mutlaka belirt."""


def _has_llm_key() -> bool:
    return bool(
        os.environ.get("OPENAI_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("LITELLM_API_KEY")
    )


def _mock_chat(message: str) -> str:
    return (
        f"[Demo Modu] '{message[:80]}' sorunuz alındı. "
        "Şu an AI servisi demo modunda çalışıyor — gerçek API anahtarı eklenmeden "
        "LLM yanıtı üretilemez. "
        "⚠️ Bu içerik yatırım tavsiyesi değildir."
    )


class ChatIn(BaseModel):
    user_id: str
    message: str
    portfolio: list[dict] = []
    extra_context: dict = {}


class WhatIfIn(BaseModel):
    user_id: str
    scenario: str
    amount: float = 1000
    asset: str = ""
    portfolio: list[dict] = []


@router.post("/chat")
async def chat(body: ChatIn):
    if _has_llm_key():
        try:
            import litellm
            import asyncio
            portfolio_ctx = ""
            if body.portfolio:
                portfolio_ctx = "\n\nKullanıcının portföyü:\n"
                for pos in body.portfolio[:10]:
                    pnl = ((float(pos.get("current_price", 0)) - float(pos.get("entry_price", 0))) /
                           float(pos.get("entry_price", 1)) * 100) if pos.get("entry_price") else 0
                    portfolio_ctx += f"- {pos.get('symbol', '?')}: giriş {pos.get('entry_price')}, PnL: {pnl:.1f}%\n"
            messages = [
                {"role": "system", "content": COPILOT_SYSTEM + portfolio_ctx},
                {"role": "user", "content": body.message},
            ]
            response = await asyncio.to_thread(
                litellm.completion, model="gpt-4o", messages=messages,
                temperature=0.5, max_tokens=600,
            )
            reply = response.choices[0].message.content
        except Exception as e:
            log.error(f"Copilot LLM error: {e}")
            reply = _mock_chat(body.message)
    else:
        reply = _mock_chat(body.message)

    return {
        "reply": reply,
        "referenced_signals": [],
        "kalkan_warning": None,
        "suggested_actions": [],
        "disclaimer": DISCLAIMER,
    }


@router.post("/what-if")
async def what_if(body: WhatIfIn):
    if _has_llm_key():
        try:
            import litellm, asyncio
            prompt = (
                f"Kullanıcı şu senaryoyu soruyor:\n\"{body.scenario}\"\n"
                f"Varlık: {body.asset or 'belirtilmedi'}, Miktar: {body.amount} TL\n\n"
                "Olası sonuçları analiz et: iyimser, beklenen ve kötümser senaryo. "
                "Risk faktörlerini listele. KISA tut (max 200 kelime, Türkçe)."
            )
            response = await asyncio.to_thread(
                litellm.completion, model="gpt-4o",
                messages=[
                    {"role": "system", "content": COPILOT_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.4, max_tokens=500,
            )
            result = response.choices[0].message.content
        except Exception as e:
            log.error(f"What-if error: {e}")
            result = "[Demo] What-If simülasyonu şu an kullanılamıyor."
    else:
        result = (
            f"[Demo Modu] '{body.scenario}' senaryosu için örnek analiz:\n"
            "• İyimser: +15-20% (güçlü momentum devam ederse)\n"
            "• Beklenen: +3-7% (mevcut trend sürdürülebilirse)\n"
            "• Kötümser: -8-12% (makro baskı artarsa)\n"
            "⚠️ Bu içerik yatırım tavsiyesi değildir."
        )
    return {"result": result, "disclaimer": DISCLAIMER}
