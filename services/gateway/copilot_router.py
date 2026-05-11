"""
AYC Global Market - Copilot Router
GPT-4o + Claude 3.5 + Gemini -> finansal sohbet asistani
Dogrudan gateway icinde calisir, ai-service'e proxy gerekmez.
"""
from __future__ import annotations
import os, json, time, asyncio
from pathlib import Path
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

router = APIRouter(prefix="/copilot", tags=["copilot"])

_ENV_LOADED = False
def _load_env():
    global _ENV_LOADED
    if _ENV_LOADED: return
    env = Path(__file__).parent / ".env"
    if env.exists():
        from dotenv import load_dotenv; load_dotenv(env)
    _ENV_LOADED = True

DISCLAIMER = "Bu icerik yatirim tavsiyesi degildir. Kendi arastirmanizi yapin."

# ═══ SYSTEM PROMPTS ═══════════════════════════════════════════
COPILOT_SYSTEM = """Sen AYC Global Market Copilot, kullanicinin kisisel AI finans asistanisin.
- Rol: Piyasa yorumcusu + portfoy danismani
- Dil: Turkce, kisa ve net
- Stil: Profesyonel ama anlasilir, basliklari markdownla vurgula
- ZORUNLU: Her yanit sonunda "⚠️ Bu icerik yatirim tavsiyesi degildir." ekle
- Guclu yonlerin: Teknik analiz, risk yonetimi, piyasa bagi
- Yapma: Kesin getiri vaadi, "kesinlikle al/sat" demek
- Yap: RSI, MACD, destek/direnc gibi gostergelerden bahset, risk faktoru belirt"""

BRIEFING_SYSTEM = """Sen AYC Global Market sabah brifing yazarisin.
Kullanicinin bugunun piyasalarinda dikkat etmesi gereken onemli noktalar neler?
Kisa (3-4 cumle), okunmasi kolay bir brifing yaz. Turkce. Markdown kullanma.
Onemli seviyeler, makro etkenler ve kripto/hisse ozeti icin."""

# ═══ AI CALL HELPERS ══════════════════════════════════════════
async def _openai_chat(messages: list, max_tokens=600):
    _load_env()
    key = os.environ.get("OPENAI_API_KEY","")
    if not key: return None, "no_key"
    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            async with s.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model":"gpt-4o","messages":messages,"max_tokens":max_tokens,"temperature":0.5},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                d = await r.json()
                if "error" in d:
                    return None, d["error"].get("message","OpenAI error")
                return d["choices"][0]["message"]["content"], None
    except Exception as e:
        return None, str(e)

async def _claude_chat(system: str, messages: list, max_tokens=600):
    _load_env()
    key = os.environ.get("ANTHROPIC_API_KEY","") or os.environ.get("CLAUDE_API_KEY","")
    if not key: return None, "no_key"
    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            async with s.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key":key,"anthropic-version":"2023-06-01","Content-Type":"application/json"},
                json={"model":"claude-3-5-sonnet-20241022","max_tokens":max_tokens,"system":system,"messages":messages},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                d = await r.json()
                if d.get("type") == "error":
                    return None, d.get("error",{}).get("message","Claude error")
                content = d.get("content",[])
                if not content: return None, "empty response"
                return content[0].get("text",""), None
    except Exception as e:
        return None, str(e)

async def _gemini_chat(prompt: str, max_tokens=600):
    _load_env()
    key = os.environ.get("GEMINI_API_KEY","")
    if not key: return None, "no_key"
    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            async with s.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}",
                headers={"Content-Type":"application/json"},
                json={"contents":[{"parts":[{"text":prompt}]}],
                      "generationConfig":{"temperature":0.5,"maxOutputTokens":max_tokens}},
                timeout=aiohttp.ClientTimeout(total=30)
            ) as r:
                d = await r.json()
                if "error" in d: return None, str(d["error"].get("message","Gemini error"))
                cands = d.get("candidates")
                if not cands: return None, "no candidates"
                return cands[0]["content"]["parts"][0]["text"], None
    except Exception as e:
        return None, str(e)


# ═══ ROUTES ══════════════════════════════════════════════════
class ChatIn(BaseModel):
    message: str
    portfolio: list = []
    chat_history: list = []  # [{"role":"user","content":"..."},...]
    user_id: str = "anon"
    prefer_model: str = "gpt"  # "gpt"|"claude"|"gemini"

class ChatOut(BaseModel):
    reply: str
    model_used: str
    disclaimer: str
    elapsed_ms: int

@router.post("/chat")
async def copilot_chat(body: ChatIn):
    _load_env()
    t0 = time.perf_counter()

    # Portfoy contexti ekle
    portfolio_ctx = ""
    if body.portfolio:
        portfolio_ctx = "\n\nKullanicinin portfoyu:\n"
        for p in body.portfolio[:10]:
            entry  = float(p.get("entry_price",0) or p.get("entry",0))
            cur    = float(p.get("current_price",0) or p.get("current",0))
            pnl    = ((cur-entry)/entry*100) if entry else 0
            portfolio_ctx += f"- {p.get('symbol','?')}: giris={entry}, simdi={cur}, PnL={pnl:.1f}%\n"

    system = COPILOT_SYSTEM + portfolio_ctx

    # Chat history (max 8 tur)
    history = body.chat_history[-8:] if body.chat_history else []
    messages_gpt = [{"role":"system","content":system}] + history + [{"role":"user","content":body.message}]
    messages_ai  = history + [{"role":"user","content":body.message}]

    # === Duygusal zeka analizi ===
    from signal_intelligence import analyze_user_emotion, emotion_to_dict
    emotion = analyze_user_emotion(body.message)
    if emotion.dominant != "neutral":
        system = emotion.tone_advice + "\n\n" + portfolio_ctx
    messages_gpt[0]["content"] = system  # system prompt guncelle

    reply, model_used = None, "mock"
    emotion_data = emotion_to_dict(emotion)

    # GPT-4o (primary)
    if not reply or body.prefer_model == "gpt":
        text, err = await _openai_chat(messages_gpt)
        if text:
            reply, model_used = text, "GPT-4o"

    # Claude fallback
    if not reply or body.prefer_model == "claude":
        text, err = await _claude_chat(system, messages_ai)
        if text:
            reply, model_used = text, "Claude 3.5 Sonnet"

    # Gemini fallback
    if not reply or body.prefer_model == "gemini":
        full_prompt = f"{system}\n\n" + "\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages_ai])
        text, err = await _gemini_chat(full_prompt)
        if text:
            reply, model_used = text, "Gemini 2.0 Flash"

    # Mock fallback
    if not reply:
        reply = (
            f"Anliyorum: '{body.message[:80]}'. "
            "Piyasalar hakkinda daha detayli sorular sorabilirsiniz. "
            "Ornegin: 'BTC icin anlik analiz yap' veya 'portfoyumun risk durumu nedir?'"
        )
        model_used = "mock"

    if DISCLAIMER not in reply:
        reply += f"\n\n⚠️ {DISCLAIMER}"

    return {
        "reply": reply,
        "model_used": model_used,
        "disclaimer": DISCLAIMER,
        "elapsed_ms": int((time.perf_counter()-t0)*1000),
        "emotion": emotion_data,
    }


@router.get("/briefing/latest")
async def get_briefing():
    _load_env()
    t0 = time.perf_counter()

    # Haber + piyasa ozeti icin kisa prompt
    today_prompt = (
        "Bugun (simdi) piyasa gorunumu hakkinda kisa bir sabah brifing yaz. "
        "Kripto: BTC/ETH genel trend, ABD borsasi genel gorunum, BIST durumu, "
        "onemli makro etkenler (Fed, enflasyon, jeopolitik). "
        "Max 4 cumle. Turkce. Markdown kullanma."
    )

    summary, model_used = None, "mock"
    text, err = await _openai_chat([
        {"role":"system","content":BRIEFING_SYSTEM},
        {"role":"user","content":today_prompt}
    ], max_tokens=300)
    if text:
        summary, model_used = text, "GPT-4o"

    if not summary:
        text, err = await _claude_chat(BRIEFING_SYSTEM, [{"role":"user","content":today_prompt}], max_tokens=300)
        if text:
            summary, model_used = text, "Claude 3.5"

    if not summary:
        text, err = await _gemini_chat(f"{BRIEFING_SYSTEM}\n\n{today_prompt}", max_tokens=300)
        if text:
            summary, model_used = text, "Gemini 2.0 Flash"

    if not summary:
        summary = "Piyasalar karma bir seyir izliyor. BTC kritik seviyelerde destek ariyor, ABD endeksleri haftayi hafif yukselisle kapattiktan sonra bugun seyrini bekliyor. BIST'te sektor rotasyonu gundeme gelebilir."

    return {
        "summary": summary,
        "model_used": model_used,
        "generated_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "elapsed_ms": int((time.perf_counter()-t0)*1000),
    }


@router.post("/analyze-portfolio")
async def analyze_portfolio(body: dict):
    """Kullanicinin portfoyunu AI ile analiz eder — risk, dagilim, oneri."""
    _load_env()
    positions = body.get("positions", [])
    if not positions:
        return {"analysis": "Portfoy bos, analiz yapilamadi.", "model_used": "mock"}

    pos_txt = "\n".join([
        f"- {p.get('symbol','?')}: giris={p.get('entry',0)}, simdi={p.get('current',0)}, miktar={p.get('qty',0)}, kategori={p.get('category','?')}"
        for p in positions[:15]
    ])
    prompt = (
        f"Asagidaki portfoyu analiz et:\n{pos_txt}\n\n"
        "1. Risk degerlendirmesi (dusuk/orta/yuksek)\n"
        "2. Dagilim analizi (konsantrasyon var mi?)\n"
        "3. En riskli pozisyon\n"
        "4. Rebalance onerisi\n"
        "Kisa tut (max 250 kelime, Turkce)."
    )

    text, _ = await _openai_chat([
        {"role":"system","content":COPILOT_SYSTEM},
        {"role":"user","content":prompt}
    ], max_tokens=400)

    if not text:
        text, _ = await _claude_chat(COPILOT_SYSTEM, [{"role":"user","content":prompt}], max_tokens=400)

    if not text:
        text = "Portfoy analizi simdilik kullanim disi. API key kontrol edin."

    return {"analysis": text, "model_used": "GPT-4o", "disclaimer": DISCLAIMER}