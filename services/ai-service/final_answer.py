"""
Final Answer Engine — NEURA Pipeline Katman 5
Consensus + Kalkan + Finance Data + Piyasa bağlamını birleştirir
ve kullanıcıya sunulacak nihai yapılandırılmış çıktıyı üretir.
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any
import uuid

log = logging.getLogger("final_answer")

DISCLAIMER = "⚠️ Bu içerik yatırım tavsiyesi değildir. Yatırım kararlarınızı kendi araştırmalarınıza dayandırınız."

# Güven seviyesi eşikleri
CONFIDENCE_TIERS = [
    (80, "GÜÇLÜ",   "🟢"),
    (65, "ORTA",    "🟡"),
    (50, "ZAYIF",   "🟠"),
    (0,  "BELİRSİZ","🔴"),
]

# Kategori etiketleri
CATEGORY_LABELS = {
    "turkey":  "BIST / Türkiye",
    "us":      "ABD Borsası",
    "crypto":  "Kripto",
    "precious":"Değerli Emtia",
    "energy":  "Enerji",
    "forex":   "Forex",
    "index":   "Endeksler",
    "etf":     "ETF",
}


def _confidence_tier(score: float) -> tuple[str, str]:
    for threshold, label, icon in CONFIDENCE_TIERS:
        if score >= threshold:
            return label, icon
    return "BELİRSİZ", "🔴"


def _risk_reward(entry: float, target: float, stop: float) -> float:
    reward = abs(target - entry)
    risk   = abs(entry - stop)
    return round(reward / risk, 2) if risk > 0 else 0.0


def _format_price(price: float, category: str) -> str:
    if not price:
        return "—"
    if category in ("crypto",) and price < 1:
        return f"{price:.6f}"
    if category in ("forex",):
        return f"{price:.4f}"
    if price > 1000:
        return f"{price:,.2f}"
    return f"{price:.4f}"


def build_final_answer(
    asset_data:   dict,
    consensus:    dict,
    kalkan:       dict,
    user_context: dict = {},
) -> dict:
    """
    Pipeline'ın son katmanı.
    Tüm ara sonuçları alır → tek bir nihai sinyal objesi döner.

    Dönen yapı frontend + mobile app tarafından doğrudan kullanılabilir.
    """
    symbol    = asset_data.get("symbol", "")
    category  = asset_data.get("category", "stock")
    price     = float(asset_data.get("price", 0) or 0)
    source    = asset_data.get("source", "unknown")

    direction  = consensus.get("direction", "neutral")
    confidence = float(consensus.get("confidence", 0))
    entry      = float(consensus.get("entry_price",  price))
    target     = float(consensus.get("target_price", price))
    stop       = float(consensus.get("stop_loss",    price))
    reasoning  = consensus.get("reasoning", "")
    agreement  = consensus.get("direction_agreement", False)
    n_models   = consensus.get("models_available", 0)
    votes      = consensus.get("model_votes", [])

    rr         = _risk_reward(entry, target, stop)
    conf_label, conf_icon = _confidence_tier(confidence)

    # ── Kalkan durumu ──────────────────────────────────────────────────────
    blocked     = kalkan.get("blocked", False)
    block_level = kalkan.get("block_level", "none")
    kalkan_msgs = kalkan.get("reasons", [])

    # Kalkan HARD block → confidence sıfırla, direction override
    if blocked and block_level == "hard":
        confidence  = 0
        conf_label  = "BLOKE"
        conf_icon   = "🔴"
    elif blocked and block_level == "soft":
        confidence  = round(confidence * 0.7, 2)
        conf_label  = f"{conf_label} (SOFT BLOKE)"

    # ── Sinyal meta ────────────────────────────────────────────────────────
    signal_id    = str(uuid.uuid4())
    now_utc      = datetime.now(tz=timezone.utc)
    expires_at   = now_utc + timedelta(hours=24)

    # ── Teknik özet ────────────────────────────────────────────────────────
    tech         = asset_data.get("technicals", {})
    rsi          = tech.get("rsi_14")
    trend        = tech.get("trend", "")
    vol_pct      = tech.get("volatility_percentile")

    technical_summary = []
    if rsi:
        state = "aşırı satım" if rsi < 35 else ("aşırı alım" if rsi > 65 else "nötr")
        technical_summary.append(f"RSI {rsi:.0f} ({state})")
    if trend:
        technical_summary.append(f"Trend: {trend}")
    if vol_pct is not None:
        technical_summary.append(f"Volatilite: %{vol_pct:.0f}")

    # ── Veri kalite skoru ─────────────────────────────────────────────────
    data_quality = "live" if source not in ("none", "rule_based_fallback") else "estimated"

    # ── Nihai çıktı ────────────────────────────────────────────────────────
    return {
        # Kimlik
        "id":          signal_id,
        "asset_id":    asset_data.get("asset_id", ""),
        "symbol":      symbol,
        "category":    category,
        "category_label": CATEGORY_LABELS.get(category, category),

        # Yön & güven
        "direction":   direction,
        "confidence":  confidence,
        "confidence_label": conf_label,
        "confidence_icon":  conf_icon,

        # Fiyat seviyeleri
        "price_current": _format_price(price, category),
        "entry_price":   _format_price(entry,  category),
        "target_price":  _format_price(target, category),
        "stop_loss":     _format_price(stop,   category),
        "risk_reward":   rr,

        # Ham fiyatlar (frontend hesaplamalar için)
        "price_raw":     price,
        "entry_raw":     entry,
        "target_raw":    target,
        "stop_raw":      stop,

        # Teknik özet
        "change_pct":    asset_data.get("change_pct", 0),
        "high_24h":      asset_data.get("high", 0),
        "low_24h":       asset_data.get("low", 0),
        "technical_summary": ", ".join(technical_summary),
        "trend":         trend,

        # AI gerekçe
        "ai_reasoning":  reasoning,
        "direction_agreement": agreement,

        # Model katmanı
        "model_votes":   votes,
        "models_used":   n_models,
        "consensus_source": consensus.get("source", "unknown"),

        # Kalkan
        "kalkan_blocked":    blocked,
        "kalkan_level":      block_level,
        "kalkan_messages":   kalkan_msgs,

        # Veri kaynağı
        "data_source":   source,
        "data_quality":  data_quality,

        # Zaman
        "generated_at":  now_utc.isoformat(),
        "expires_at":    expires_at.isoformat(),
        "timeframe":     "1d",

        # Yasal uyarı
        "disclaimer":    DISCLAIMER,
    }
