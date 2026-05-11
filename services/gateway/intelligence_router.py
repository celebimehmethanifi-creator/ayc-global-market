"""
AYC Global Market — Intelligence Router
==========================================
Yeni kurumsal katman endpoint'leri:
  POST /intelligence/causal    — Fiyat hareketi nedensellik analizi
  POST /intelligence/scenario  — Senaryo simülasyonu (6 senaryo)
  GET  /intelligence/twin/{user_id}  — Kullanıcı dijital ikiz profili
  POST /intelligence/twin/{user_id}/event — Davranış olayı kaydet
  GET  /intelligence/performance — Sinyal performans istatistikleri
  POST /intelligence/performance/record — Sinyal kaydet
"""
from __future__ import annotations
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/intelligence", tags=["Intelligence"])

# ── Causal Engine ────────────────────────────────────────────────
class CausalRequest(BaseModel):
    symbol:       str
    price:        float
    change_24h:   float = 0.0
    volume_ratio: float = 1.0
    indicators:   dict  = {}
    spread_pct:   float = 0.0
    funding_rate: float = 0.0
    asset_name:   str   = ""
    market:       str   = "crypto"
    candles:      list  = []

@router.post("/causal")
async def causal_analysis(req: CausalRequest):
    try:
        from causal_engine import analyze_causality, causal_report_to_dict
        report = await analyze_causality(
            symbol=req.symbol, candles=req.candles, price=req.price,
            change_24h=req.change_24h, volume_ratio=req.volume_ratio,
            indicators=req.indicators, spread_pct=req.spread_pct,
            funding_rate=req.funding_rate, asset_name=req.asset_name,
            market=req.market,
        )
        return causal_report_to_dict(report)
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ── Scenario Engine ──────────────────────────────────────────────
class ScenarioRequest(BaseModel):
    symbol:           str
    price:            float
    direction:        str   = "LONG"
    trigger_level:    Optional[float] = None
    invalidation:     Optional[float] = None
    take_profit:      Optional[float] = None
    volatility_daily: float = 3.0
    confidence_score: float = 60.0
    market:           str   = "crypto"
    leverage:         float = 1.0

@router.post("/scenario")
async def scenario_simulation(req: ScenarioRequest):
    try:
        from scenario_engine import simulate_scenarios, simulation_to_dict
        report = simulate_scenarios(
            symbol=req.symbol, price=req.price, direction=req.direction,
            trigger_level=req.trigger_level, invalidation=req.invalidation,
            take_profit=req.take_profit, volatility_daily=req.volatility_daily,
            confidence_score=req.confidence_score, market=req.market, leverage=req.leverage,
        )
        return simulation_to_dict(report)
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ── Digital Twin ─────────────────────────────────────────────────
class TwinEventRequest(BaseModel):
    emotion: str   # fomo / panic / revenge / overrisk / neutral
    symbol:  str   = "GENERAL"
    detail:  str   = ""

@router.get("/twin/{user_id}")
async def get_twin(user_id: str):
    try:
        from digital_twin import get_twin_summary
        return get_twin_summary(user_id)
    except Exception as e:
        raise HTTPException(500, detail=str(e))

@router.post("/twin/{user_id}/event")
async def record_twin_event(user_id: str, req: TwinEventRequest):
    try:
        from digital_twin import record_emotion_event, get_twin_summary
        record_emotion_event(user_id, req.emotion, req.symbol, req.detail)
        return get_twin_summary(user_id)
    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ── Performance Tracker ──────────────────────────────────────────
class RecordSignalRequest(BaseModel):
    symbol:     str
    stage:      str
    direction:  str
    entry:      float
    target:     float
    stop:       float
    confidence: float = 60.0

class CloseSignalRequest(BaseModel):
    symbol:     str
    signal_id:  str
    exit_price: float
    outcome:    str   # HIT / STOP_HIT / TIMEOUT

@router.get("/performance")
async def get_performance(symbol: Optional[str] = None):
    try:
        from performance_tracker import get_performance_stats
        return get_performance_stats(symbol)
    except Exception as e:
        raise HTTPException(500, detail=str(e))

@router.post("/performance/record")
async def record_performance(req: RecordSignalRequest):
    try:
        from performance_tracker import record_signal
        sid = record_signal(
            req.symbol, req.stage, req.direction,
            req.entry, req.target, req.stop, req.confidence
        )
        return {"signal_id": sid, "status": "recorded"}
    except Exception as e:
        raise HTTPException(500, detail=str(e))

@router.post("/performance/close")
async def close_performance(req: CloseSignalRequest):
    try:
        from performance_tracker import close_signal
        record = close_signal(req.symbol, req.signal_id, req.exit_price, req.outcome)
        if not record:
            raise HTTPException(404, "Signal not found")
        from dataclasses import asdict
        return asdict(record)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=str(e))
