"""KALKAN Algoritması — 4 Kural, 2 seviye (hard/soft)"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any


HARD_BLOCK_THRESHOLD = 1  # 1+ hard kural = blok
SOFT_BLOCK_THRESHOLD = 2  # 2+ soft kural = blok


def run_kalkan(
    asset_data: dict,
    user_data: dict,
    portfolio_data: dict,
    social_data: dict,
    consensus_direction: str,
) -> dict:
    """
    Returns:
        {
            blocked: bool,
            block_level: "hard" | "soft" | "none",
            reasons: list[str]
        }
    """
    hard_reasons = []
    soft_reasons = []

    # ── Kural 1: Kötü Zamanlama ───────────────────────────────────────────────
    volatility_pct = float(asset_data.get("volatility_percentile", 0))
    if volatility_pct > 95:
        soft_reasons.append(f"Aşırı volatilite (yüzdelik: {volatility_pct:.0f}%) — emir kayması riski yüksek")

    # Son işlem çok yakın
    last_trade_minutes = user_data.get("last_trade_age_minutes")
    if last_trade_minutes is not None and last_trade_minutes < 30:
        soft_reasons.append(f"Son işlemden {last_trade_minutes:.0f} dakika geçti — aceleci işlem tespiti")

    # ── Kural 2: Duygusal Koruma ─────────────────────────────────────────────
    trades_today = int(user_data.get("trades_today", 0))
    if trades_today >= 5:
        soft_reasons.append(f"Bugün {trades_today} işlem yapıldı — aşırı/intikam işlem davranışı")

    current_hour = datetime.now(tz=timezone.utc).hour
    night_hours = {22, 23, 0, 1, 2, 3}
    if current_hour in night_hours:
        soft_reasons.append(f"Gece saati işlemi (UTC {current_hour}:xx) — yüksek duygusal karar riski")

    # ── Kural 3: Drawdown Kilidi (HARD) ──────────────────────────────────────
    max_dd = user_data.get("max_drawdown_pct")
    current_dd = portfolio_data.get("current_drawdown_pct", 0)
    if max_dd is not None and float(current_dd) >= float(max_dd):
        hard_reasons.append(
            f"Maksimum drawdown eşiği aşıldı: %{current_dd:.1f} ≥ %{max_dd:.1f} — portföy kilidi aktif"
        )

    # ── Kural 4: Contrarian Uyarı (soft) ─────────────────────────────────────
    crowd_dominant = social_data.get("dominant_direction")
    crowd_pct = float(social_data.get("dominant_pct", 0))
    direction_map = {"long": "bullish", "short": "bearish", "neutral": "neutral"}
    if (
        crowd_pct >= 80
        and crowd_dominant
        and direction_map.get(consensus_direction) != crowd_dominant
    ):
        soft_reasons.append(
            f"Contrarian uyarı: Kitle %{crowd_pct:.0f} {crowd_dominant} yönünde, "
            f"AI ise {consensus_direction} sinyali veriyor"
        )

    # ── Karar Mantığı ─────────────────────────────────────────────────────────
    if hard_reasons:
        return {
            "blocked": True,
            "block_level": "hard",
            "reasons": hard_reasons + soft_reasons,
        }
    if len(soft_reasons) >= SOFT_BLOCK_THRESHOLD:
        return {
            "blocked": True,
            "block_level": "soft",
            "reasons": soft_reasons,
        }
    if soft_reasons:
        return {
            "blocked": False,
            "block_level": "none",
            "reasons": soft_reasons,  # warning only
        }

    return {"blocked": False, "block_level": "none", "reasons": []}
