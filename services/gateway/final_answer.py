"""
AYC Global Market - Final Answer Engine
Tüm katmanları birleştirir:
  Teknik Motor -> Konsensus AI -> Kalkan -> Contrarian -> Otopsi Ağırlıkları -> Final Karar
"""
from __future__ import annotations
import asyncio
from typing import Any

from kalkan import run_kalkan, KalkanResult
from contrarian import get_contrarian_view
from otopsi import log_signal, get_model_accuracy_weights


async def build_final_answer(
    symbol: str,
    market: str,
    price: float,
    change_24h: float,
    consensus: dict,          # _build_consensus() sonucu
    opinions: list[dict],     # [GPT, Claude, Gemini] raw
    technical_score: float = 50.0,
    volume_ratio: float = 1.0,
    run_contrarian: bool = True,
    log_to_db: bool = True,
) -> dict:
    """
    Tum katmanlari calistir, kullaniciya sunulacak final karari uret.
    """
    direction   = consensus.get("direction", "NEUTRAL")
    confidence  = float(consensus.get("confidence", 50))
    agreement   = consensus.get("agreement", "BOLUNMUS")
    target      = consensus.get("target_price")
    stop        = consensus.get("stop_loss")
    opinion_cnt = int(consensus.get("opinion_count", len([o for o in opinions if not o.get("error")])))

    # ── 1. Kalkan ───────────────────────────────────────────────
    kalkan: KalkanResult = run_kalkan(
        direction=direction,
        confidence=confidence,
        technical_score=technical_score,
        agreement=agreement,
        opinion_count=opinion_cnt,
        price=price,
        target_price=target,
        stop_loss=stop,
        volatility_24h=abs(change_24h),
        volume_ratio=volume_ratio,
        market=market,
        long_votes=consensus.get("long_votes_motor",0),
        short_votes=consensus.get("short_votes_motor",0),
        motor_warnings=consensus.get("motor_warnings",[]),
    )

    # ── 2. Model agirlik duzeltmesi (Otopsi) ───────────────────
    try:
        weights = get_model_accuracy_weights()
    except Exception:
        weights = {"GPT-4o": 0.33, "Claude 3.5": 0.33, "Gemini 1.5 Pro": 0.34}

    # Agirlikli ortalama guven skoru
    weighted_conf = 0.0
    weight_total  = 0.0
    model_map = {"GPT-4o": "GPT-4o", "Claude 3.5": "Claude 3.5",
                 "Gemini 1.5 Pro": "Gemini 1.5 Pro"}

    for op in opinions:
        if op.get("error"): continue
        mname = op.get("model", "")
        w = weights.get(mname, 0.33)
        c_val = float(op.get("confidence", confidence))
        weighted_conf += c_val * w
        weight_total  += w

    if weight_total > 0:
        weighted_conf = weighted_conf / weight_total
        # Kalkan sonucu ile ortala
        final_conf = round((kalkan.confidence_adjusted * 0.6 + weighted_conf * 0.4), 1)
    else:
        final_conf = kalkan.confidence_adjusted

    # ── 3. Contrarian (paralel - bloke olmasa bile calistir) ────
    contrarian_view: dict = {}
    if run_contrarian and direction != "NEUTRAL":
        try:
            contrarian_view = await get_contrarian_view(
                symbol=symbol,
                consensus_direction=direction,
                confidence=final_conf,
                price=price,
                reasoning=consensus.get("reasoning", ""),
                market=market,
            )
        except Exception as e:
            contrarian_view = {"error": str(e)}

    # ── 4. Sinyal loglama (kalkan gecti ise) ───────────────────
    signal_id = None
    if log_to_db and kalkan.passed and direction != "NEUTRAL":
        try:
            signal_id = log_signal(
                symbol=symbol, market=market, direction=direction,
                entry_price=price, target_price=target, stop_loss=stop,
                confidence=confidence, agreement=agreement,
                kalkan_passed=kalkan.passed, final_confidence=final_conf,
            )
        except Exception:
            pass

    # ── 5. Final karar olustur ──────────────────────────────────
    if not kalkan.passed:
        verdict = "BEKLE"
        verdict_reason = kalkan.block_reason or "Kalkan sinyali bloke etti."
    elif final_conf >= 72:
        verdict = direction
        verdict_reason = "Guclu sinyal - tum katmanlar onayladi."
    elif final_conf >= 55:
        verdict = direction
        verdict_reason = "Orta guclu sinyal - dikkatli pozisyon."
    else:
        verdict = "DIKKATLI_" + direction
        verdict_reason = "Zayif sinyal - kucuk pozisyon veya bekleme onerilir."

    return {
        "symbol":         symbol,
        "market":         market,
        "price":          price,
        "verdict":        verdict,
        "verdict_reason": verdict_reason,
        "final_confidence": final_conf,
        "risk_level":     kalkan.risk_level,
        "kalkan": {
            "passed":    kalkan.passed,
            "warnings":  kalkan.warnings,
            "adjustments": kalkan.adjustments,
            "block_reason": kalkan.block_reason,
        },
        "consensus": {
            "direction":  direction,
            "confidence": confidence,
            "agreement":  agreement,
            "target_price": target,
            "stop_loss":  stop,
            "risk_reward": consensus.get("risk_reward"),
            "reasoning":  consensus.get("reasoning"),
            "timeframe":  consensus.get("timeframe"),
            "votes":      consensus.get("votes", {}),
        },
        "contrarian":   contrarian_view,
        "model_weights": weights,
        "signal_id":    signal_id,
        "models_used":  [o.get("model") for o in opinions if not o.get("error")],
    }