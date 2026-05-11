"""
AYC Global Market - Multi-AI Consensus + Final Answer Engine
GPT-4o + Claude 3.5 + Gemini -> Kalkan -> Contrarian -> Otopsi -> Final Karar
"""
from __future__ import annotations
import os, json, time, asyncio
from pathlib import Path
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/consensus", tags=["consensus"])

_ENV_LOADED = False
def _load_env():
    global _ENV_LOADED
    if _ENV_LOADED: return
    env = Path(__file__).parent / ".env"
    if env.exists():
        from dotenv import load_dotenv; load_dotenv(env)
    _ENV_LOADED = True

# GPT rolü: Yorumlayici + Aciklayici
GPT_PROMPT = """Sen AYC Global Market Copilot icin piyasa yorumlayicisisin.

GOREV: Teknik veriyi sade, anlasilir Turkce ile acikla. Kullaniciya ne yaptigin ve neden yaptigin anlat.
- Trend, destek/direnc, momentum analizi yap
- Sinyalin nedenini net acikla
- LONG / SHORT / NEUTRAL karar ver, hedef ve stop belirle

JSON FORMATI:
{
  "direction": "LONG veya SHORT veya NEUTRAL",
  "confidence": 0-100,
  "target_price": sayi veya null,
  "stop_loss": sayi veya null,
  "risk_reward": sayi veya null,
  "technical_summary": "teknik ozet",
  "fundamental_summary": "temel ozet",
  "reasoning": "1-3 cumle aciklama",
  "key_levels": {"support": sayi, "resistance": sayi},
  "timeframe": "kisa vadeli (1-7 gun) veya orta vadeli (1-4 hafta)"
}"""

# Claude rolü: Risk analisti + Temkinli denetci
CLAUDE_PROMPT = """Sen AYC Global Market Copilot icin risk analisti ve temkinli denetcisin.

GOREV: Riskleri derinlemesine analiz et. Neler yanlis gidebilir? Sinyal ne zaman basarisiz olur?
- Riskleri listele, zayif noktalari bul
- Eger risk yuksekse guven skorunu dusuk ver
- Kalkan perspektifinden degerlendir: bu islem acilmali mi?
- LONG / SHORT / NEUTRAL karar ver - cok emin degilsen NEUTRAL se

JSON FORMATI:
{
  "direction": "LONG veya SHORT veya NEUTRAL",
  "confidence": 0-100,
  "target_price": sayi veya null,
  "stop_loss": sayi veya null,
  "risk_reward": sayi veya null,
  "technical_summary": "risk odakli teknik ozet",
  "fundamental_summary": "makro risk degerlendirmesi",
  "reasoning": "risk analizi 1-3 cumle",
  "key_levels": {"support": sayi, "resistance": sayi},
  "timeframe": "kisa vadeli (1-7 gun) veya orta vadeli (1-4 hafta)"
}"""

# Gemini rolü: Genis baglamli analist
GEMINI_PROMPT = """Sen AYC Global Market Copilot icin genis baglamli analistsin.

GOREV: Coklu veri kaynaklarini yorumla. Makro ortam, sektor, korelasyon ve buyuk resmi degerlendirmil.
- Piyasa rejimini degerlendirmek (bull/bear/yanmis)
- Sektorer baglamda varlik nasil gorunuyor?
- Korelasyonlar ve global etkiler neler?
- LONG / SHORT / NEUTRAL karar ver

JSON FORMATI:
{
  "direction": "LONG veya SHORT veya NEUTRAL",
  "confidence": 0-100,
  "target_price": sayi veya null,
  "stop_loss": sayi veya null,
  "risk_reward": sayi veya null,
  "technical_summary": "teknik ozet",
  "fundamental_summary": "makro/sektor/baglamsal ozet",
  "reasoning": "buyuk resim 1-3 cumle",
  "key_levels": {"support": sayi, "resistance": sayi},
  "timeframe": "kisa vadeli (1-7 gun) veya orta vadeli (1-4 hafta)"
}"""


def _make_prompt(symbol, name, price, change, market, extra):
    tech = extra.get("technical", {})
    motors = extra.get("motors", [])
    indicators = extra.get("indicators", {})
    motor_txt = "\n".join([f"  {m.get('motor','')}: {m.get('signal','')} (skor:{m.get('score',0):.0f}) - {m.get('reason','')}"
                           for m in motors]) if motors else "  (motor verisi yok)"
    ind_txt = ""
    if indicators:
        ind_txt = f"""
RSI: {indicators.get('rsi','?')}
MACD Histogram: {indicators.get('macd_hist','?')}
MA20: {indicators.get('ma20','?')}
MA50: {indicators.get('ma50','?')}
BB Low/Mid/High: {indicators.get('bb_low','?')} / {indicators.get('bb_mid','?')} / {indicators.get('bb_high','?')}"""
    return f"""Varlik: {name} ({symbol})
Market: {market}
Anlik Fiyat: {price}
24s Degisim: {change:+.2f}%
Teknik Skor: {tech.get("technicalScore","N/A")}/100
Long Oylari: {extra.get("long_votes",0)} | Short: {extra.get("short_votes",0)} | Izle: {extra.get("izle_votes",0)}

Motor Analizi:
{motor_txt}

Teknik Gostergeler:{ind_txt}

Bu varlik icin analiz yap ve JSON formatinda yanitla."""


def _parse_ai_response(text):
    try:
        if "```json" in text: text = text.split("```json")[1].split("```")[0]
        elif "```" in text:   text = text.split("```")[1].split("```")[0]
        return json.loads(text.strip())
    except Exception:
        import re
        m = re.search(r'\{[^{}]*"direction"[^{}]*\}', text, re.DOTALL)
        if m:
            try: return json.loads(m.group(0))
            except: pass
        return {}


async def _ask_openai(prompt, system):
    _load_env()
    key = os.environ.get("OPENAI_API_KEY")
    if not key: return {"error": "no_key", "analyst": 1}
    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            async with s.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model":"gpt-4o","messages":[{"role":"system","content":system},
                      {"role":"user","content":prompt}],
                      "max_tokens":512,"temperature":0.2,"response_format":{"type":"json_object"}},
                timeout=aiohttp.ClientTimeout(total=25)) as r:
                d = await r.json()
                result = _parse_ai_response(d["choices"][0]["message"]["content"])
                result["model"] = "GPT-4o"; result["analyst"] = 1; return result
    except Exception as e:
        return {"error": str(e), "model": "GPT-4o"}


async def _ask_claude(prompt, system):
    _load_env()
    key = os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("CLAUDE_API_KEY")
    if not key: return {"error": "no_key", "analyst": 2}
    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            async with s.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key":key,"anthropic-version":"2023-06-01","Content-Type":"application/json"},
                json={"model":"claude-3-5-sonnet-20241022","max_tokens":512,
                      "system":system,"messages":[{"role":"user","content":prompt}]},
                timeout=aiohttp.ClientTimeout(total=25)) as r:
                d = await r.json()
                if d.get("type") == "error":
                    return {"error": d.get("error",{}).get("message","API error"), "model": "Claude 3.5"}
                content_list = d.get("content")
                if not content_list:
                    # Overloaded veya billing hatasi
                    err_msg = d.get("error",{}).get("message") or str(list(d.keys()))
                    return {"error": err_msg, "model": "Claude 3.5"}
                item = content_list[0]
                text = item.get("text") or (item.get("input","{}") if item.get("type")=="tool_use" else "{}")
                result = _parse_ai_response(text)
                result["model"] = "Claude 3.5"; result["analyst"] = 2; return result
    except Exception as e:
        return {"error": str(e), "model": "Claude 3.5"}


async def _ask_gemini(prompt, system):
    _load_env()
    key = os.environ.get("GEMINI_API_KEY")
    if not key: return {"error": "no_key", "analyst": 3}
    try:
        import aiohttp
        async with aiohttp.ClientSession() as s:
            async with s.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}",
                headers={"Content-Type":"application/json"},
                json={"contents":[{"parts":[{"text":f"{system}\n\n{prompt}"}]}],
                      "generationConfig":{"temperature":0.2,"maxOutputTokens":512}},
                timeout=aiohttp.ClientTimeout(total=25)) as r:
                d = await r.json()
                if "error" in d:
                    return {"error": str(d["error"].get("message","API error")), "model": "Gemini 1.5 Pro"}
                cands = d.get("candidates")
                if not cands:
                    return {"error": f"no candidates: {list(d.keys())}", "model": "Gemini 1.5 Pro"}
                result = _parse_ai_response(cands[0]["content"]["parts"][0]["text"])
                result["model"] = "Gemini 1.5 Pro"; result["analyst"] = 3; return result
    except Exception as e:
        return {"error": str(e), "model": "Gemini 1.5 Pro"}


def _build_consensus(opinions, price):
    valid = [o for o in opinions if o and not o.get("error") and o.get("direction")]
    if not valid:
        return {"direction":"NEUTRAL","confidence":40,"reasoning":"AI yaniti alinamadi.",
                "target_price":None,"stop_loss":None,"risk_reward":None,"agreement":"BOLUNMUS","votes":{},"opinion_count":0}

    votes = {"LONG":0,"SHORT":0,"NEUTRAL":0}
    conf_sum, targets, stops, rrs = 0, [], [], []
    for o in valid:
        d = str(o.get("direction","NEUTRAL")).upper()
        if d not in votes: d = "NEUTRAL"
        votes[d] += 1
        conf_sum += float(o.get("confidence",60))
        if o.get("target_price"): targets.append(float(o["target_price"]))
        if o.get("stop_loss"):    stops.append(float(o["stop_loss"]))
        if o.get("risk_reward"):  rrs.append(float(o["risk_reward"]))

    direction = max(votes, key=votes.get)
    avg_conf  = conf_sum / len(valid)
    if votes[direction] == len(valid):   avg_conf = min(avg_conf + 8, 97)
    elif votes[direction] >= 2:          avg_conf = min(avg_conf + 3, 97)
    else:                                avg_conf = max(avg_conf - 10, 30)

    agreement = "TAM" if votes[direction]==len(valid) else ("COGUNLUK" if votes[direction]>=2 else "BOLUNMUS")
    return {
        "direction": direction, "confidence": round(avg_conf),
        "target_price": round(sum(targets)/len(targets),4) if targets else None,
        "stop_loss":    round(sum(stops)/len(stops),4) if stops else None,
        "risk_reward":  round(sum(rrs)/len(rrs),2) if rrs else None,
        "reasoning":    valid[0].get("reasoning","Coklu AI konsensus analizi tamamlandi."),
        "agreement": agreement, "votes": votes, "opinion_count": len(valid),
        "technical_summary": valid[0].get("technical_summary",""),
        "fundamental_summary": valid[0].get("fundamental_summary",""),
        "key_levels": valid[0].get("key_levels",{}),
        "timeframe":  valid[0].get("timeframe","kisa vadeli"),
        "long_votes_motor": 0, "short_votes_motor": 0, "motor_warnings": [],
    }


@router.get("/{symbol}")
async def get_consensus(
    symbol:      str,
    name:        str   = Query(""),
    price:       float = Query(0),
    change:      float = Query(0),
    market:      str   = Query("crypto"),
    score:       int   = Query(50),
    consistency: float = Query(80),
    sources:     int   = Query(3),
    volume_ratio:float = Query(1.0),
    full:        bool  = Query(True, description="Kalkan+Contrarian+FinalAnswer dahil et"),
):
    _load_env()
    t0 = time.perf_counter()

    # ── 6 Motor ile teknik analiz ──────────────────────────────
    motor_data: dict = {}
    auto_score = score
    try:
        import sys as _sys, importlib as _il
        gw_dir = str(Path(__file__).parent)
        if gw_dir not in _sys.path: _sys.path.insert(0, gw_dir)
        sm = _il.import_module("signal_motors")

        # OHLCV al - gateway API uzerinden
        import aiohttp as _aio
        async with _aio.ClientSession() as _s:
            async with _s.get(f"http://localhost:8000/api/v1/ohlcv/{symbol}?tf=1D",
                              timeout=_aio.ClientTimeout(total=10)) as _r:
                _d = await _r.json()
        candles = _d.get("candles",[])
        if len(candles) >= 15:
            motor_data = sm.compute_technical_score(candles, change_24h=change)
            auto_score = int(motor_data["technical_score"])
    except Exception as _e:
        motor_data = {"error": str(_e)}

    extra = {
        "technical": {"technicalScore": auto_score},
        "dataConsistency": consistency, "sourceCount": sources,
        "motors":     motor_data.get("motors",[]),
        "indicators": motor_data.get("indicators",{}),
        "long_votes": motor_data.get("long_votes",0),
        "short_votes":motor_data.get("short_votes",0),
        "izle_votes": motor_data.get("izle_votes",0),
    }
    prompt = _make_prompt(symbol, name or symbol, price, change, market, extra)

    opinions = await asyncio.gather(
        _ask_openai(prompt, GPT_PROMPT),
        _ask_claude(prompt, CLAUDE_PROMPT),
        _ask_gemini(prompt, GEMINI_PROMPT),
        return_exceptions=False
    )
    opinions = list(opinions)
    consensus = _build_consensus(opinions, price)
    ms = int((time.perf_counter()-t0)*1000)

    safe_ops = [{k:v for k,v in o.items() if k not in ("model",)} for o in opinions if isinstance(o,dict)]
    if not full:
        return {"symbol":symbol,"name":name or symbol,"market":market,"price":price,
                "consensus":consensus,"opinions":safe_ops,"elapsed_ms":ms,
                "engines":3}

    # ── Final Answer Engine ─────────────────────────────────────
    try:
        import sys, importlib
        gw_dir = str(Path(__file__).parent)
        if gw_dir not in sys.path: sys.path.insert(0, gw_dir)
        fa = importlib.import_module("final_answer")
        # Motor oylari consensus objesine ekle
        consensus["long_votes_motor"]  = motor_data.get("long_votes",0)
        consensus["short_votes_motor"] = motor_data.get("short_votes",0)
        consensus["motor_warnings"]    = motor_data.get("warnings",[])
        final = await fa.build_final_answer(
            symbol=symbol, market=market, price=price, change_24h=change,
            consensus=consensus, opinions=opinions,
            technical_score=float(auto_score), volume_ratio=volume_ratio,
            run_contrarian=True, log_to_db=True,
        )
    except Exception as e:
        final = {"error": str(e)}

    return {
        "symbol":  symbol, "name": name or symbol, "market": market, "price": price,
        "consensus": consensus,
        "final":   final,
        "motors":  motor_data,
        "opinions": safe_ops,
        "elapsed_ms": int((time.perf_counter()-t0)*1000),
        "engines": 3,
    }


@router.get("/stats/history")
async def get_signal_history(symbol: str = Query(None), limit: int = Query(50)):
    try:
        import sys, importlib
        gw_dir = str(Path(__file__).parent)
        if gw_dir not in sys.path: sys.path.insert(0, gw_dir)
        ot = importlib.import_module("otopsi")
        return ot.get_stats(symbol=symbol, limit=limit)
    except Exception as e:
        return {"error": str(e)}