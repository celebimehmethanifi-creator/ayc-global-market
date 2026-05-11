"""
LiteLLM Multi-Model Orchestrator — NEURA
Katman 3: AI Orchestrator

Model zinciri (ağırlıklı consensus):
  1. GPT-4o        (weight 0.40) — analysis_lead
  2. Claude 3.5    (weight 0.35) — risk_reviewer
  3. Gemini 1.5    (weight 0.25) — pattern_scout
  4. OpenRouter    (fallback)    — herhangi bir açık model
  5. Local/Ollama  (fallback)    — internet bağlantısı yoksa

Herhangi biri başarısız olursa → diğerleri devam eder.
Hiçbiri çalışmazsa → kural tabanlı mock consensus döner.
"""
from __future__ import annotations
import asyncio
import json
import logging
import os
from typing import Any

log = logging.getLogger("orchestrator")

# ── Lazy LiteLLM import ──────────────────────────────────────────────────────
try:
    import litellm as _litellm
    _litellm.drop_params = True           # bilinmeyen parametreleri yoksay
    _litellm.set_verbose = False
    _LITELLM_OK = True
except ImportError:
    _litellm = None  # type: ignore
    _LITELLM_OK = False

# ── Model zinciri ────────────────────────────────────────────────────────────
MODEL_CHAIN = [
    {
        "model":   "gpt-4o",
        "weight":  0.40,
        "role":    "analysis_lead",
        "env_key": "OPENAI_API_KEY",
    },
    {
        "model":   "claude-3-5-sonnet-20241022",
        "weight":  0.35,
        "role":    "risk_reviewer",
        "env_key": "ANTHROPIC_API_KEY",
    },
    {
        "model":   "gemini/gemini-1.5-flash",
        "weight":  0.25,
        "role":    "pattern_scout",
        "env_key": "GOOGLE_API_KEY",
    },
    # OpenRouter fallback — herhangi bir ücretsiz model
    {
        "model":   "openrouter/mistralai/mistral-7b-instruct",
        "weight":  0.20,
        "role":    "openrouter_fallback",
        "env_key": "OPENROUTER_API_KEY",
    },
]

# ── Prompt şablonları ────────────────────────────────────────────────────────
SIGNAL_PROMPT = """\
Sen NEURA AI finans analistlerin en deneyimlisisin.
Aşağıdaki piyasa verisini incele ve yapılandırılmış analiz sun.

── Varlık Bilgisi ──────────────────────────────────
Sembol   : {symbol}
Kategori : {category}
Kaynak   : {source}

── Fiyat Verisi ────────────────────────────────────
Fiyat    : {price}
24s Değişim: {change_pct}%
Gün Y/D  : {high} / {low}
Hacim    : {volume}

── Teknik Göstergeler ──────────────────────────────
{technicals}

── Piyasa Bağlamı ──────────────────────────────────
{market_context}

── Görev ───────────────────────────────────────────
Rolün: {role}
1. Yön: long / short / neutral
2. Güven skoru: 0-100
3. Giriş fiyatı öner
4. Hedef fiyat (risk/ödül ≥ 1.5:1)
5. Stop-loss seviyesi
6. Kısa gerekçe (max 3 cümle, Türkçe)

SADECE JSON döndür (başka metin yok):
{{"direction":"long|short|neutral","confidence":0,"entry_price":0.0,"target_price":0.0,"stop_loss":0.0,"reasoning":"..."}}

UYARI: Bu içerik yatırım tavsiyesi değildir.\
"""

COPILOT_SYSTEM = """\
Sen NEURA, kullanıcının kişisel AI finans asistanısın.
Kullanıcının portföyünü biliyorsun ve piyasa analizleri yapabiliyorsun.
Her yanıtın sonuna şu uyarıyı ekle: "⚠️ Bu içerik yatırım tavsiyesi değildir."
Yanıtların Türkçe, kısa, net ve kullanıcı dostu olsun.
Abartılı getiri vaatlerinde bulunma. Risk faktörlerini mutlaka belirt.\
"""


def _model_available(cfg: dict) -> bool:
    """Modelin API key'i var mı?"""
    if not _LITELLM_OK:
        return False
    return bool(os.environ.get(cfg["env_key"], ""))


async def _call_model(cfg: dict, prompt: str, timeout: float = 25.0) -> dict | None:
    """Tek bir modeli çağır, hata olursa None döner."""
    if not _model_available(cfg):
        return None
    try:
        resp = await asyncio.wait_for(
            asyncio.to_thread(
                _litellm.completion,
                model=cfg["model"],
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.3,
                max_tokens=512,
            ),
            timeout=timeout,
        )
        raw = resp.choices[0].message.content
        data = json.loads(raw)
        data["_model"]  = cfg["model"]
        data["_weight"] = cfg["weight"]
        data["_role"]   = cfg["role"]
        return data
    except asyncio.TimeoutError:
        log.warning(f"[orchestrator] {cfg['model']} timeout ({timeout}s)")
    except json.JSONDecodeError as e:
        log.warning(f"[orchestrator] {cfg['model']} bad JSON: {e}")
    except Exception as e:
        log.warning(f"[orchestrator] {cfg['model']} error: {e}")
    return None


def _rule_based_consensus(asset_data: dict) -> dict:
    """
    Hiçbir LLM çalışmazsa kural tabanlı yedek.
    RSI ve değişim yönüne göre basit yön kararı.
    """
    price     = float(asset_data.get("price", 100) or 100)
    change    = float(asset_data.get("change_pct", 0) or 0)
    technicals = asset_data.get("technicals", {})
    rsi       = float(technicals.get("rsi_14", 50))
    trend     = technicals.get("trend", "sideways")

    if rsi < 35 or (change < -3 and trend == "bearish"):
        direction = "short"
        confidence = 45
        reasoning = "RSI aşırı satım bölgesinde ve fiyat düşüş trendinde. Demo modu analizi."
    elif rsi > 65 or (change > 3 and trend == "bullish"):
        direction = "long"
        confidence = 45
        reasoning = "RSI momentum güçlü ve fiyat yükseliş trendinde. Demo modu analizi."
    else:
        direction = "neutral"
        confidence = 40
        reasoning = "Piyasa yönü belirsiz, yatay hareket devam ediyor. Demo modu analizi."

    return {
        "direction":         direction,
        "confidence":        confidence,
        "entry_price":       round(price, 4),
        "target_price":      round(price * (1.03 if direction == "long" else 0.97), 4),
        "stop_loss":         round(price * (0.97 if direction == "long" else 1.03), 4),
        "reasoning":         reasoning,
        "direction_agreement": False,
        "model_votes":       [],
        "weights_used":      {},
        "models_available":  0,
        "source":            "rule_based_fallback",
    }


async def run_consensus(asset_data: dict, technicals: dict, sentiment: dict) -> dict:
    """
    Pipeline Katman 3: AI Orchestrator
    
    1. Tüm mevcut modelleri paralel çalıştır
    2. Başarılı oylara ağırlıklı consensus uygula
    3. Hiç oy yoksa → kural tabanlı fallback
    """
    market_context = ""
    if sentiment:
        market_context += f"Sentiment: {json.dumps(sentiment, ensure_ascii=False)}\n"

    prompt = SIGNAL_PROMPT.format(
        symbol   = asset_data.get("symbol", ""),
        category = asset_data.get("category", ""),
        source   = asset_data.get("source", ""),
        price    = asset_data.get("price", 0),
        change_pct = asset_data.get("change_pct", 0),
        high     = asset_data.get("high", 0),
        low      = asset_data.get("low", 0),
        volume   = asset_data.get("volume", 0),
        technicals = json.dumps(technicals or asset_data.get("technicals", {}), ensure_ascii=False, indent=2),
        market_context = market_context or "Yok",
        role     = "Tüm modeller için genel analiz",
    )

    # Tüm modelleri paralel çağır
    tasks = [_call_model(cfg, prompt) for cfg in MODEL_CHAIN]
    raw_votes = await asyncio.gather(*tasks)
    votes = [v for v in raw_votes if v is not None]

    log.info(f"[orchestrator] {asset_data.get('symbol')} — {len(votes)}/{len(MODEL_CHAIN)} models voted")

    if not votes:
        return _rule_based_consensus(asset_data)

    # ── Ağırlıklı Consensus ──────────────────────────────────────────────────
    total_w = sum(v["_weight"] for v in votes)
    dir_scores:  dict[str, float] = {}
    w_confidence = 0.0
    w_entry      = 0.0
    w_target     = 0.0
    w_stop       = 0.0

    price = float(asset_data.get("price", 0) or 0)

    for v in votes:
        w  = v["_weight"] / total_w
        d  = v.get("direction", "neutral")
        dir_scores[d] = dir_scores.get(d, 0) + w
        w_confidence += w * float(v.get("confidence", 50))
        w_entry      += w * float(v.get("entry_price")  or price)
        w_target     += w * float(v.get("target_price") or price)
        w_stop       += w * float(v.get("stop_loss")    or price)

    final_dir  = max(dir_scores, key=dir_scores.get)
    agreement  = dir_scores.get(final_dir, 0) >= 0.60

    # Anlaşmazlık cezası
    if not agreement:
        w_confidence *= 0.85

    # En çok oy alan modelin gerekçesini al
    lead_vote = max(votes, key=lambda v: v["_weight"])
    reasoning = lead_vote.get("reasoning", "")

    return {
        "direction":         final_dir,
        "confidence":        round(w_confidence, 2),
        "entry_price":       round(w_entry,  4),
        "target_price":      round(w_target, 4),
        "stop_loss":         round(w_stop,   4),
        "reasoning":         reasoning,
        "direction_agreement": agreement,
        "model_votes":       [{"model": v["_model"], "role": v["_role"], "direction": v.get("direction"), "confidence": v.get("confidence")} for v in votes],
        "weights_used":      {cfg["model"]: cfg["weight"] for cfg in MODEL_CHAIN},
        "models_available":  len(votes),
        "source":            "llm_consensus",
    }


# ── Copilot helper ────────────────────────────────────────────────────────────
async def run_copilot(message: str, portfolio: list[dict], extra_context: dict) -> str:
    """Copilot chat — en iyi mevcut model ile."""
    if not _LITELLM_OK:
        return f"[Demo] '{message[:60]}' — LLM mevcut değil. ⚠️ Yatırım tavsiyesi değildir."

    portfolio_ctx = ""
    if portfolio:
        lines = []
        for pos in portfolio[:10]:
            ep = float(pos.get("entry_price") or 0)
            cp = float(pos.get("current_price") or 0)
            pnl = ((cp - ep) / ep * 100) if ep else 0
            lines.append(f"- {pos.get('symbol','?')}: giriş {ep}, güncel {cp}, PnL {pnl:+.1f}%")
        portfolio_ctx = "\n\nKullanıcı portföyü:\n" + "\n".join(lines)

    messages = [
        {"role": "system", "content": COPILOT_SYSTEM + portfolio_ctx},
        {"role": "user",   "content": message},
    ]

    for cfg in MODEL_CHAIN:
        if not _model_available(cfg):
            continue
        try:
            resp = await asyncio.wait_for(
                asyncio.to_thread(
                    _litellm.completion,
                    model=cfg["model"],
                    messages=messages,
                    temperature=0.5,
                    max_tokens=600,
                ),
                timeout=25,
            )
            return resp.choices[0].message.content
        except Exception as e:
            log.warning(f"Copilot {cfg['model']}: {e}")
            continue

    return f"[Demo] '{message[:60]}' — Tüm modeller şu an yanıt veremiyor. ⚠️ Yatırım tavsiyesi değildir."
