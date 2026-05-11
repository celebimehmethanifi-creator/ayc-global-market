"""Briefing router — daily morning briefing (mock fallback when no LLM key)"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from datetime import datetime

from fastapi import APIRouter, Request

log = logging.getLogger("briefing")
router = APIRouter(tags=["briefing"])

DISCLAIMER = "Bu içerik yatırım tavsiyesi değildir."

BRIEFING_SYSTEM = """Sen NEURA finans asistanısın. Her sabah kullanıcıya 06:30'da kısa, özlü bir piyasa brifing hazırlıyorsun.
Format:
🌅 SABAH BRİFİNG - {date}
📊 Piyasa Özeti: (2-3 cümle)
🔥 Öne Çıkan Fırsatlar: (bullet list, max 3)
⚠️ Dikkat Edilmesi Gerekenler: (bullet list, max 3)
💡 Günün Tavsiyesi: (1 cümle)
⚠️ Bu içerik yatırım tavsiyesi değildir."""


def _has_llm_key() -> bool:
    return bool(
        os.environ.get("OPENAI_API_KEY")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("LITELLM_API_KEY")
    )


def _mock_briefing(today: str) -> str:
    return (
        f"🌅 SABAH BRİFİNG - {today}\n\n"
        "📊 Piyasa Özeti: Demo modunda çalışıyorsunuz. Gerçek piyasa verisi için API anahtarlarını ekleyin.\n\n"
        "🔥 Öne Çıkan Fırsatlar:\n"
        "• BTCUSDT — güçlü destek seviyesi\n"
        "• THYAO.IS — pozitif momentum\n"
        "• AAPL — range içi hareket\n\n"
        "⚠️ Dikkat Edilmesi Gerekenler:\n"
        "• Risk yönetimini ihmal etmeyin\n"
        "• Stop-loss seviyelerinizi belirleyin\n"
        "• Portföy çeşitlendirmesine önem verin\n\n"
        "💡 Günün Tavsiyesi: Demo modunda analiz üretilmiyor, gerçek key ekleyiniz.\n\n"
        "⚠️ Bu içerik yatırım tavsiyesi değildir."
    )


@router.get("/latest")
async def latest_briefing(user_id: str = "", request: Request = None):
    redis_client = request.app.state.redis if request else None
    cache_key = f"briefing:{datetime.utcnow().strftime('%Y-%m-%d')}"

    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            pass

    today = datetime.utcnow().strftime("%d %B %Y")

    if _has_llm_key():
        try:
            import litellm
            response = await asyncio.to_thread(
                litellm.completion,
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": BRIEFING_SYSTEM.format(date=today)},
                    {"role": "user", "content": "Bugün için piyasa brifingini hazırla. Kripto, BIST ve global piyasaları kapsasın."},
                ],
                temperature=0.6,
                max_tokens=500,
            )
            summary = response.choices[0].message.content
        except Exception as e:
            log.error(f"Briefing LLM error: {e}")
            summary = _mock_briefing(today)
    else:
        summary = _mock_briefing(today)

    result = {
        "summary": summary,
        "generated_at": datetime.utcnow().isoformat(),
        "disclaimer": DISCLAIMER,
    }

    if redis_client:
        try:
            await redis_client.setex(cache_key, 3600 * 12, json.dumps(result))
        except Exception:
            pass

    return result
