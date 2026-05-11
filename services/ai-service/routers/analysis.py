"""
Analysis router — NEURA AI Pipeline (tam katmanlı)

Frontend/Mobile
    ↓
FastAPI Gateway (:8000)
    ↓
AI Service (:8001) ← bu dosya
    ↓
data_fetcher.py  → Finnhub / CoinGecko / TwelveData / yfinance
    ↓
orchestrator.py  → LiteLLM → GPT-4o + Claude + Gemini + OpenRouter
    ↓
kalkan.py        → Risk filtresi (hard/soft block)
    ↓
final_answer.py  → Final Answer Engine
    ↓
JSON Response
"""
from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel

from data_fetcher  import fetch_market_data
from orchestrator  import run_consensus
from kalkan        import run_kalkan
from final_answer  import build_final_answer

log = logging.getLogger("analysis")
router = APIRouter(tags=["analysis"])


# ── Request modelleri ────────────────────────────────────────────────────────
class SignalRequest(BaseModel):
    """Tam pipeline — asset_id + symbol yeterli, gerisi opsiyonel."""
    asset_id:         str
    symbol:           str
    category:         str = "stock"
    # Opsiyonel: dışarıdan fiyat verisi enjekte edilebilir (override)
    price_override:   dict = {}
    user_context:     dict = {}
    portfolio_context:dict = {}
    social_context:   dict = {}


class QuickSignalRequest(BaseModel):
    """Sadece sembol + kategori ile hızlı sinyal."""
    symbol:   str
    category: str = "crypto"


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.post("/signal")
async def generate_signal(body: SignalRequest, request: Request):
    """
    Tam AI pipeline:
    1. Gerçek piyasa verisi çek (Finnhub/CoinGecko/TwelveData/yfinance)
    2. LiteLLM consensus çalıştır (GPT+Claude+Gemini paralel)
    3. Kalkan risk filtresi uygula
    4. Final Answer Engine ile sonucu yapılandır
    5. Cache'e yaz (Redis veya in-memory)
    """
    redis = request.app.state.redis

    # ── Katman 1: Finance API ────────────────────────────────────────────
    if body.price_override:
        asset_data = {
            "asset_id": body.asset_id,
            "symbol":   body.symbol,
            "category": body.category,
            **body.price_override,
        }
        asset_data.setdefault("technicals", {})
        log.info(f"[signal] {body.symbol} — using price_override")
    else:
        asset_data = await fetch_market_data(body.symbol, body.category)
        asset_data["asset_id"] = body.asset_id
        log.info(f"[signal] {body.symbol} — fetched from {asset_data.get('source','?')}, price={asset_data.get('price')}")

    # ── Katman 2: Cache kontrolü (stale < 5 dk) ──────────────────────────
    cache_key = f"signal:{body.asset_id}"
    if redis:
        try:
            cached_raw = await redis.get(cache_key)
            if cached_raw:
                cached = json.loads(cached_raw)
                gen_at = datetime.fromisoformat(cached.get("generated_at", "2000-01-01"))
                age_sec = (datetime.utcnow() - gen_at.replace(tzinfo=None)).total_seconds()
                if age_sec < 300:  # 5 dakika cache
                    log.debug(f"[signal] {body.symbol} — cache hit ({age_sec:.0f}s)")
                    return {"signal": cached, "cached": True}
        except Exception:
            pass

    # ── Katman 3: AI Orchestrator ────────────────────────────────────────
    technicals = asset_data.get("technicals", {})
    sentiment  = {}  # ileride data-service'ten gelecek

    consensus = await run_consensus(
        asset_data = asset_data,
        technicals = technicals,
        sentiment  = sentiment,
    )

    # ── Katman 4: Kalkan Risk Filtresi ────────────────────────────────────
    kalkan = run_kalkan(
        asset_data      = asset_data,
        user_data       = body.user_context,
        portfolio_data  = body.portfolio_context,
        social_data     = body.social_context,
        consensus_direction = consensus.get("direction", "neutral"),
    )

    # ── Katman 5: Final Answer Engine ─────────────────────────────────────
    final = build_final_answer(
        asset_data   = asset_data,
        consensus    = consensus,
        kalkan       = kalkan,
        user_context = body.user_context,
    )

    # ── Cache yaz ─────────────────────────────────────────────────────────
    if redis:
        try:
            await redis.setex(cache_key, 3600 * 6, json.dumps(final))
            if final["confidence"] >= 70 and not final["kalkan_blocked"]:
                await redis.publish("signals:new", json.dumps(final))
        except Exception as e:
            log.debug(f"Cache/publish skipped: {e}")

    return {"signal": final, "cached": False}


@router.post("/quick")
async def quick_signal(body: QuickSignalRequest, request: Request):
    """Hızlı sinyal — sadece sembol+kategori gerekli."""
    req = SignalRequest(
        asset_id = f"{body.symbol.lower()}-quick",
        symbol   = body.symbol,
        category = body.category,
    )
    return await generate_signal(req, request)


@router.get("/signal/{asset_id}")
async def get_cached_signal(asset_id: str, request: Request):
    """Cache'teki son sinyali getir."""
    redis = request.app.state.redis
    if not redis:
        return {"signal": None, "message": "Cache mevcut değil"}
    try:
        raw = await redis.get(f"signal:{asset_id}")
        if raw:
            return {"signal": json.loads(raw)}
    except Exception:
        pass
    return {"signal": None, "message": "Sinyal bulunamadı"}


@router.get("/batch")
async def batch_signals(symbols: str, category: str = "crypto", request: Request = None):
    """
    Virgülle ayrılmış semboller için toplu sinyal üretir.
    Örnek: /analysis/batch?symbols=BTC,ETH,SOL&category=crypto
    """
    sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()][:10]

    async def _one(sym: str):
        try:
            req = SignalRequest(
                asset_id = f"{sym.lower()}-batch",
                symbol   = sym,
                category = category,
            )
            result = await generate_signal(req, request)
            return result["signal"]
        except Exception as e:
            log.warning(f"batch {sym}: {e}")
            return {"symbol": sym, "error": str(e)}

    signals = await asyncio.gather(*[_one(s) for s in sym_list])
    return {"signals": signals, "count": len(signals)}
