"""
AYC Global Market - KALKAN Algoritmasi
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal


@dataclass
class KalkanResult:
    passed: bool
    confidence_adjusted: float
    block_reason: str | None = None
    warnings: list[str] = field(default_factory=list)
    adjustments: list[str] = field(default_factory=list)
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "EXTREME"] = "MEDIUM"


def run_kalkan(
    direction: str,
    confidence: float,
    technical_score: float,
    agreement: str,
    opinion_count: int,
    price: float,
    target_price: float | None,
    stop_loss: float | None,
    volatility_24h: float = 0.0,
    volume_ratio: float = 1.0,
    market: str = "crypto",
    long_votes: int = 0,
    short_votes: int = 0,
    motor_warnings: list[str] | None = None,
    drawdown_pct: float = 0.0,   # son N gunun drawdown'u (pozitif = dusus)
) -> KalkanResult:
    warnings: list[str] = []
    adjustments: list[str] = []
    conf = float(confidence)

    if opinion_count < 1:
        return KalkanResult(passed=False, confidence_adjusted=0,
            block_reason="Hicbir AI yanit vermedi.", risk_level="EXTREME")

    # ── 0. Drawdown kilidi ───────────────────────────────────────
    if drawdown_pct > 20:
        return KalkanResult(passed=False, confidence_adjusted=conf * 0.3,
            block_reason=f"Drawdown kilidi: %{drawdown_pct:.0f} kayip - agresif sinyal bloke.",
            warnings=["Drawdown kilidi aktif"], risk_level="EXTREME")
    elif drawdown_pct > 10:
        conf -= 20
        warnings.append(f"Drawdown uyarisi: %{drawdown_pct:.0f} - dikkatli ol.")

    # ── 0b. Motor oy kontrolu ────────────────────────────────────
    if short_votes > long_votes + 2:
        conf -= 15
        warnings.append(f"Motor oylamasi: {short_votes} SHORT vs {long_votes} LONG - karsi yonde agirlik.")
    if long_votes >= 4:
        conf = min(conf + 6, 97)
        adjustments.append(f"Guclu motor oy birligi: {long_votes}/6 LONG")

    # Motor uyarilari
    if motor_warnings:
        for w in motor_warnings[:2]:  # En fazla 2 uyari gecir
            warnings.append(f"[Motor] {w}")

    if technical_score < 20:
        return KalkanResult(passed=False, confidence_adjusted=conf * 0.4,
            block_reason=f"Teknik skor cok dusuk ({technical_score:.0f}/100).",
            warnings=warnings, risk_level="HIGH")

    if technical_score < 40:
        conf -= 15
        warnings.append(f"Dusuk teknik skor ({technical_score:.0f}/100).")

    if agreement == "BOLUNMUS":
        conf -= 12
        warnings.append("AI'lar bolunmus goruslu - yuksek belirsizlik.")
    elif agreement == "COGUNLUK":
        conf -= 3
    elif agreement == "TAM":
        conf = min(conf + 5, 97)
        adjustments.append("Oybirligi - guven artirildi.")

    if opinion_count >= 3:
        conf = min(conf + 3, 97)
        adjustments.append("3 AI konsensus - ek guven bonusu.")
    elif opinion_count == 1:
        conf -= 8
        warnings.append("Tek AI yaniti - konsensus yok.")

    if target_price and stop_loss and price > 0:
        if direction == "LONG":
            rr = (target_price - price) / max(price - stop_loss, 1e-9)
        else:
            rr = (price - target_price) / max(stop_loss - price, 1e-9)
        if rr < 1.0:
            return KalkanResult(passed=False, confidence_adjusted=conf,
                block_reason=f"Risk/Reward kabul edilemez ({rr:.2f}).",
                warnings=warnings, risk_level="HIGH")
        elif rr < 1.5:
            conf -= 5
            warnings.append(f"Dusuk R/R ({rr:.2f}).")
        elif rr >= 3.0:
            conf = min(conf + 5, 97)
            adjustments.append(f"Yuksek R/R ({rr:.2f}).")

    extreme_vol = 15.0 if market == "crypto" else 5.0
    high_vol = 8.0 if market == "crypto" else 3.0
    if volatility_24h > extreme_vol:
        conf -= 18
        warnings.append(f"Asiri volatilite (%{volatility_24h:.1f}).")
    elif volatility_24h > high_vol:
        conf -= 8
        warnings.append(f"Yuksek volatilite (%{volatility_24h:.1f}).")

    if volume_ratio < 0.3:
        conf -= 10
        warnings.append(f"Cok dusuk hacim (oran: {volume_ratio:.2f}).")
    elif volume_ratio > 2.5:
        conf = min(conf + 4, 97)
        adjustments.append(f"Guclu hacim onayi (oran: {volume_ratio:.2f}).")

    conf = max(conf, 5)
    if conf < 35 and direction != "NEUTRAL":
        return KalkanResult(passed=False, confidence_adjusted=round(conf, 1),
            block_reason=f"Nihai guven cok dusuk ({conf:.0f}) - sinyal yayinlanmiyor.",
            warnings=warnings, adjustments=adjustments, risk_level="HIGH")

    risk = "LOW" if conf >= 75 else ("MEDIUM" if conf >= 55 else ("HIGH" if conf >= 40 else "EXTREME"))
    return KalkanResult(passed=True, confidence_adjusted=round(conf, 1),
        warnings=warnings, adjustments=adjustments, risk_level=risk)