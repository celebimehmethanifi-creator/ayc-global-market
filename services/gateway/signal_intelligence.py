"""
AYC Global Market - Signal Intelligence Engine
=================================================
Belge: Predictive Market Intelligence & Alert Engine
4 asamali alarm: WATCH -> SETUP -> TRIGGER -> KALKAN
7 skor sistemi: Opportunity, Risk, Confidence, News, Liquidity, Volatility, Trend
Emotional Intelligence: FOMO / Panik / Intikam / Asiri risk algilama
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Literal, Optional

# ── Sabitler ──────────────────────────────────────────────────
AlarmStage = Literal["NONE", "WATCH", "SETUP", "TRIGGER", "KALKAN"]
EmotionRisk = Literal["LOW", "MEDIUM", "HIGH"]


# ══════════════════════════════════════════════════════════════
# DATACLASSES
# ══════════════════════════════════════════════════════════════
@dataclass
class ScoreCard:
    """7 skoru bir arada tutan kart"""
    opportunity:  float  # 0-100  fiyat firsati
    risk:         float  # 0-100  risk seviyesi
    confidence:   float  # 0-100  AI konsensus guveni
    news_impact:  float  # 0-100  haber etkisi
    liquidity:    float  # 0-100  likidite
    volatility:   float  # 0-100  volatilite (yuksek = riskli)
    trend:        float  # 0-100  trend gucu

    @property
    def composite(self) -> float:
        """Risk-adjusted composite score"""
        pos = (self.opportunity * 0.25 + self.confidence * 0.20 +
               self.trend * 0.15 + self.news_impact * 0.10 + self.liquidity * 0.10)
        neg = (self.risk * 0.15 + self.volatility * 0.05)
        return round(max(min(pos - neg * 0.4, 100), 0), 1)


@dataclass
class AlarmPayload:
    """Tam alarm paketi"""
    symbol:       str
    stage:        AlarmStage
    scores:       ScoreCard
    direction:    Literal["LONG", "SHORT", "NEUTRAL"]
    trigger_level: Optional[float] = None      # Tetik fiyati
    invalidation:  Optional[float] = None      # Gecersizlesme fiyati
    take_profit:   Optional[float] = None
    motor_votes:   dict = field(default_factory=dict)  # motor -> signal
    motor_reasons: list[str] = field(default_factory=list)
    warnings:      list[str] = field(default_factory=list)
    kalkan_reason: Optional[str] = None
    stage_reason:  str = ""
    ai_hint:       str = ""  # AI ozet aciklama (kisa)


@dataclass
class EmotionAnalysis:
    """Kullanici mesajindaki duygusal risk analizi"""
    fomo_score:      float  # 0-100
    panic_score:     float  # 0-100
    revenge_score:   float  # 0-100
    overrisk_score:  float  # 0-100
    dominant:        str    # "fomo" | "panic" | "revenge" | "overrisk" | "neutral"
    tone_advice:     str    # Copilot icin ton tavsiyesi
    kalkan_warning:  Optional[str] = None  # Kritikse KALKAN uyarisi


# ══════════════════════════════════════════════════════════════
# 7 SKOR HESAPLAMA
# ══════════════════════════════════════════════════════════════
def compute_7scores(
    motor_result: dict,      # signal_motors.compute_technical_score() ciktisi
    change_24h: float = 0.0,
    volume_ratio: float = 1.0,
    spread_pct: float = 0.0,
    funding_rate: float = 0.0,
    news_sentiment: float = 0.0,  # -1 (negativ) ... +1 (pozitif)
    market: str = "crypto",
) -> ScoreCard:
    tech = motor_result.get("technical_score", 50.0)
    long_v  = motor_result.get("long_votes", 0)
    short_v = motor_result.get("short_votes", 0)
    total_v = max(long_v + short_v + motor_result.get("izle_votes", 0), 1)
    inds    = motor_result.get("indicators", {})

    # ── TREND SKORU ────────────────────────────────────────────
    trend = tech  # Teknik motor zaten trend odakli

    # ── OPPORTUNITY SKORU ──────────────────────────────────────
    opp = 40.0
    opp += (long_v / total_v) * 30
    opp += max(0, (tech - 40)) * 0.5
    rsi = inds.get("rsi") or 50
    if 35 <= rsi <= 65: opp += 10  # RSI orta bolgede daha fazla firsat
    if inds.get("macd_hist", 0) > 0: opp += 8
    if change_24h > 1.5: opp += 5
    opp = max(min(opp, 98), 5)

    # ── RISK SKORU ─────────────────────────────────────────────
    risk = 30.0
    risk += min(abs(change_24h) * 2.5, 25)  # Sert hareket = risk
    risk += max(0, (rsi - 70) * 0.8)        # RSI yuksek = risk
    risk += max(0, (25 - rsi) * 0.6)        # RSI dusuk = reversal riski
    risk += spread_pct * 10
    if abs(funding_rate) > 0.05: risk += 12
    risk = max(min(risk, 95), 5)

    # ── CONFIDENCE SKORU ───────────────────────────────────────
    conf = 50.0
    conf += (long_v / max(total_v, 1)) * 25 if long_v > short_v else -10
    conf += max(0, (tech - 50) * 0.5)
    conf = max(min(conf, 95), 10)

    # ── NEWS IMPACT SKORU ──────────────────────────────────────
    news = 50 + news_sentiment * 35  # -1->15, 0->50, +1->85
    news = max(min(news, 95), 5)

    # ── LIQUIDITY SKORU ────────────────────────────────────────
    liq = 60.0
    liq += (volume_ratio - 1.0) * 15
    liq -= spread_pct * 12
    if market != "crypto": liq -= 5  # Hisse daha az likid
    liq = max(min(liq, 95), 5)

    # ── VOLATILITY SKORU (yuksek = daha riskli) ────────────────
    vol = 30.0
    vol += min(abs(change_24h) * 3, 40)
    if inds.get("bb_high") and inds.get("bb_low") and inds.get("bb_mid"):
        bb_width = (inds["bb_high"] - inds["bb_low"]) / max(inds["bb_mid"], 1) * 100
        vol += min(bb_width * 2, 25)
    vol = max(min(vol, 95), 5)

    return ScoreCard(
        opportunity=round(opp, 1),
        risk=round(risk, 1),
        confidence=round(conf, 1),
        news_impact=round(news, 1),
        liquidity=round(liq, 1),
        volatility=round(vol, 1),
        trend=round(trend, 1),
    )


# ══════════════════════════════════════════════════════════════
# 4 ASAMALI ALARM DURUMU
# ══════════════════════════════════════════════════════════════
def determine_alarm_stage(
    scores: ScoreCard,
    motor_result: dict,
    kalkan_passed: bool,
    kalkan_reason: Optional[str],
    price: float,
    resistance: Optional[float] = None,
    support:    Optional[float] = None,
) -> tuple[AlarmStage, str, Optional[float], Optional[float], Optional[float]]:
    """
    Returns: (stage, stage_reason, trigger_level, invalidation, take_profit)

    Kural seti (belgeden):
    WATCH:   Bir sey oluyor; hacim/momentum anomalisi var ama tetik yok
    SETUP:   Islem ihtimali dogdu; yonu var ama teyit bekleniyor
    TRIGGER: Hacim destekli kapanisteyidi; giris bolgesinde
    KALKAN:  Sinyal var ama risk/likidite/veri problem
    NONE:    Sartlar olusmuyor
    """
    long_v   = motor_result.get("long_votes", 0)
    short_v  = motor_result.get("short_votes", 0)
    tech     = motor_result.get("technical_score", 50)
    inds     = motor_result.get("indicators", {})
    warnings = motor_result.get("warnings", [])

    opp  = scores.opportunity
    risk = scores.risk
    liq  = scores.liquidity
    conf = scores.confidence

    # --- KALKAN bloke ------------------------------------
    if not kalkan_passed:
        return (
            "KALKAN",
            kalkan_reason or "Kalkan risk filtresi islemi bloke etti.",
            None, None, None
        )

    # --- Sahte kirilim tespiti ---------------------------
    fake_bo = any("hacim dogrulamasi zayif" in w.lower() or
                  "spread" in w.lower() or
                  "kapanisteyidi yok" in w.lower() for w in warnings)

    # --- TRIGGER (Tetik) ---------------------------------
    if (long_v >= 4 and tech >= 68 and opp >= 65 and
        risk <= 55 and liq >= 55 and conf >= 60 and not fake_bo):

        trigger = resistance * 1.003 if resistance else price * 1.005
        inv     = support * 0.996 if support else price * 0.975
        tp1     = price * 1.035
        tp2     = price * 1.07
        reason  = (
            f"{long_v}/6 motor LONG destekli. "
            f"Firsat {opp:.0f}/100, Guven {conf:.0f}/100. "
            f"Tetik: {trigger:,.2f} | Gecersizlesme: {inv:,.2f}"
        )
        return ("TRIGGER", reason, round(trigger, 2), round(inv, 2), round(tp1, 2))

    # --- SETUP (Kurulum) ---------------------------------
    if (long_v >= 3 and tech >= 55 and opp >= 52 and liq >= 45):
        trigger = resistance * 1.002 if resistance else price * 1.008
        inv     = support * 0.997 if support else price * 0.980
        reason  = (
            f"Kurulum olusyor. {long_v}/6 motor pozitif. "
            f"Firsat {opp:.0f}/100. "
            f"Kirilinirsa tetik: {trigger:,.2f}"
        )
        return ("SETUP", reason, round(trigger, 2), round(inv, 2), None)

    # --- WATCH (Izleme) ----------------------------------
    if (long_v >= 2 and tech >= 45) or opp >= 58:
        reason = (
            f"Hareket baslangici sinyali. "
            f"Teknik skor {tech:.0f}/100. Hacim/momentum degisimi izleniyor."
        )
        return ("WATCH", reason, None, None, None)

    # --- NONE -------------------------------------------
    return ("NONE", "Sinyal sartlari olusmuyor.", None, None, None)


# ══════════════════════════════════════════════════════════════
# TAM PIPELINE
# ══════════════════════════════════════════════════════════════
def run_signal_pipeline(
    symbol: str,
    candles: list[dict],
    price: float,
    change_24h: float = 0.0,
    volume_ratio: float = 1.0,
    spread_pct: float = 0.0,
    funding_rate: float = 0.0,
    long_ratio: float = 0.5,
    news_sentiment: float = 0.0,
    market: str = "crypto",
    drawdown_pct: float = 0.0,
    resistance: Optional[float] = None,
    support:    Optional[float] = None,
) -> AlarmPayload:
    """
    Tam sinyal boru hatti:
    OHLCV → 6 Motor → KALKAN → 4 Asama → 7 Skor → AlarmPayload
    """
    from signal_motors import compute_technical_score
    from kalkan import run_kalkan

    # 1. Teknik motorlar
    motor_result = compute_technical_score(
        candles=candles,
        change_24h=change_24h,
        spread_pct=spread_pct,
        funding_rate=funding_rate,
        long_ratio=long_ratio,
    )

    # 2. 7 skor
    scores = compute_7scores(
        motor_result=motor_result,
        change_24h=change_24h,
        volume_ratio=volume_ratio,
        spread_pct=spread_pct,
        funding_rate=funding_rate,
        news_sentiment=news_sentiment,
        market=market,
    )

    tech     = motor_result["technical_score"]
    long_v   = motor_result["long_votes"]
    short_v  = motor_result["short_votes"]
    inds     = motor_result["indicators"]

    # Konsensus yonu
    direction = "LONG" if long_v > short_v else ("SHORT" if short_v > long_v else "NEUTRAL")

    # Hedefe tahmin
    target_price = price * 1.04 if direction == "LONG" else (price * 0.96 if direction == "SHORT" else None)
    stop_loss    = price * 0.97 if direction == "LONG" else (price * 1.03 if direction == "SHORT" else None)

    # 3. KALKAN
    warnings_flat = motor_result.get("warnings", [])
    kalkan = run_kalkan(
        direction=direction,
        confidence=scores.confidence,
        technical_score=tech,
        agreement=("TAM" if long_v >= 5 else "COGUNLUK" if long_v >= 4 else "BOLUNMUS"),
        opinion_count=3,
        price=price,
        target_price=target_price,
        stop_loss=stop_loss,
        volatility_24h=abs(change_24h),
        volume_ratio=volume_ratio,
        market=market,
        long_votes=long_v,
        short_votes=short_v,
        motor_warnings=warnings_flat,
        drawdown_pct=drawdown_pct,
    )

    # KALKAN'dan gelen nihai guven
    scores.confidence = kalkan.confidence_adjusted

    # 4. Asama belirleme
    stage, stage_reason, trigger, inv, tp = determine_alarm_stage(
        scores=scores,
        motor_result=motor_result,
        kalkan_passed=kalkan.passed,
        kalkan_reason=kalkan.block_reason,
        price=price,
        resistance=resistance,
        support=support,
    )

    # 5. Motor ozeti
    motor_votes   = {m["motor"]: m["signal"] for m in motor_result["motors"]}
    motor_reasons = [m["reason"] for m in motor_result["motors"] if m["reason"]]

    # 6. AI hint (kisa metin)
    ai_hint = _build_ai_hint(stage, scores, motor_result, direction, trigger, inv)

    return AlarmPayload(
        symbol=symbol,
        stage=stage,
        scores=scores,
        direction=direction,
        trigger_level=trigger,
        invalidation=inv,
        take_profit=tp,
        motor_votes=motor_votes,
        motor_reasons=motor_reasons[:4],
        warnings=kalkan.warnings[:5],
        kalkan_reason=kalkan.block_reason,
        stage_reason=stage_reason,
        ai_hint=ai_hint,
    )


def _build_ai_hint(stage, scores, motor_result, direction, trigger, inv) -> str:
    """Kullaniciya gosterilecek kisa AI aciklamasi"""
    tech  = motor_result["technical_score"]
    long_v = motor_result["long_votes"]
    inds   = motor_result.get("indicators", {})
    rsi    = inds.get("rsi")

    hints = {
        "NONE":    f"Teknik skor {tech:.0f}/100. Sinyal sartlari olusmuyor. Izlemeye devam.",
        "WATCH":   f"Hareket baslangici. {long_v}/6 motor pozitif. Hacim/momentum degisimi var. Tetik bekleniyor.",
        "SETUP":   f"Kurulum olusus. Firsat {scores.opportunity:.0f}/100. " +
                   (f"Kirilinirsa tetik: ${trigger:,.2f}. " if trigger else "") +
                   (f"Iptal: ${inv:,.2f}." if inv else ""),
        "TRIGGER": f"{long_v}/6 motor LONG. Firsat {scores.opportunity:.0f} | Risk {scores.risk:.0f} | Guven {scores.confidence:.0f}. " +
                   (f"Tetik ${trigger:,.2f}, iptal ${inv:,.2f}." if trigger and inv else ""),
        "KALKAN":  f"Sinyal var ama KALKAN bloke etti. Risk skoru {scores.risk:.0f}/100. " +
                   "Sahte kirilim veya likidite sorunu olabilir.",
    }
    base = hints.get(stage, "")
    if rsi and rsi < 30:  base += f" RSI asiri satim ({rsi:.0f}) — reversal dikkat."
    elif rsi and rsi > 75: base += f" RSI asiri alim ({rsi:.0f}) — givemme dikkat."
    return base


# ══════════════════════════════════════════════════════════════
# DUYGUSAL ZEKA MOTORU
# ══════════════════════════════════════════════════════════════
_FOMO_SIGNALS = [
    "hemen", "simdi", "kaciyor mu", "fomo", "gecikiyorum", "kacirim",
    "patlayacak", "moon", "rokete", "full gir", "yukseli", "firsat kacti",
    "tren", "herkes", "5x", "10x", "emin mi"
]
_PANIC_SIGNALS = [
    "dusus", "dusecek mi", "kriz", "panik", "satayim mi", "zarar",
    "dur", "felaket", "cokus", "eridi", "bitti", "batsın", "korkuyorum",
    "sell", "satmali miyim", "ne yapayim"
]
_REVENGE_SIGNALS = [
    "zararimi cikarmam", "intikam", "kurtarmam", "geri almam",
    "zarar kapatmak", "duble", "ikiye katla", "batirdim", "telafi"
]
_OVERRISK_SIGNALS = [
    "kaldıraç", "kaldirac", "leverage", "20x", "50x", "100x",
    "tum portfoy", "her seyi koy", "limit", "margine", "liquidation"
]

_CALM_PERSONA = """Sen AYC Global Market Copilot - sogukkanlı, koruyucu, profesyonel bir piyasa kocusun.
Kullanici psikolojik risk altinda. Ton: sakin, net, koruyucu ama sert.
YAPMA: Panikle, heyecanlan, "kesin kazan" de, gaz ver.
YAP: Soğukkanlı kak, tetik ve iptal seviyelerini ver, riski acikla."""

_FOMO_PERSONA = """Kullanici FOMO altinda - kovalama ve gec giris riski yuksek.
Kalkan modu: Gecikmiş hareket filtresi aktif.
Yanit: Fiyatin ne kadar hareket ettigini belirt, kovalama riskini ac, tetik bekle diyerek yonlendir.
Ton: Sakin, olculu. Heyecanlanma, sakinlestir."""

_PANIC_PERSONA = """Kullanici panik icinde - duygusal karar riski yuksek.
Kalkan modu: Panik satis engeli aktif.
Yanit: Oncelikle teknik tablo nereye isaret ediyor onu ver, sonra panikle alinan kararlarin zarar riski yuksek oldugunu belirt.
Ton: Rahatlatici ama net. Manipule etme, gercekleri ver."""

_REVENGE_PERSONA = """Kullanici intikam islemi niyetinde - en tehlikeli psikolojik durum.
Kalkan modu: Intikam islemi filtresi maksimum aktif.
Yanit: Intikam islemi kavramindan bahset, zarardan kurtulmak icin daha fazla risk almayi uret.
Ton: Sert, direkt, ama empatik. "Daha önce de görüldü, genelde daha büyük zararla biter" diye uyar."""

_OVERRISK_PERSONA = """Kullanici asiri risk almak istiyor (kaldıraç/tum portfoy).
Kalkan modu: Asiri risk alarm aktif.
Yanit: Kaldiraci, likidasyonu, risk/odül oranini gercekci anlat.
Ton: Direkt, korkutmadan ama net. Realist kal."""


def analyze_user_emotion(message: str) -> EmotionAnalysis:
    """
    Kullanici mesajindaki duygusal riski tarar.
    Hangi ton ile cevap verilmeli sorusunu cevaplar.
    """
    msg = message.lower()
    words = set(msg.split())

    def _score(signals):
        hit = sum(1 for s in signals if s in msg)
        return min(hit * 22 + (15 if hit > 0 else 0), 98)

    fomo    = _score(_FOMO_SIGNALS)
    panic   = _score(_PANIC_SIGNALS)
    revenge = _score(_REVENGE_SIGNALS)
    overrisk= _score(_OVERRISK_SIGNALS)

    scores  = {"fomo": fomo, "panic": panic, "revenge": revenge, "overrisk": overrisk}
    dominant_key = max(scores, key=scores.get)
    dominant_val = scores[dominant_key]

    if dominant_val < 25:
        return EmotionAnalysis(fomo, panic, revenge, overrisk, "neutral",
                               _CALM_PERSONA)

    persona_map = {
        "fomo":     (_FOMO_PERSONA,    f"FOMO riski yuksek. Saat gecmis, hareket {fomo:.0f}/100 olasilikla kovalama riski."),
        "panic":    (_PANIC_PERSONA,   f"Panik algilandi. Duygusal karar riski yuksek ({panic:.0f}/100)."),
        "revenge":  (_REVENGE_PERSONA, f"KALKAN - Intikam islemi riski cok yuksek ({revenge:.0f}/100). Dur."),
        "overrisk": (_OVERRISK_PERSONA,f"Asiri risk algilandi ({overrisk:.0f}/100). Kalkan aktif."),
    }
    persona_str, kalkan_warning = persona_map[dominant_key]

    return EmotionAnalysis(
        fomo_score=fomo,
        panic_score=panic,
        revenge_score=revenge,
        overrisk_score=overrisk,
        dominant=dominant_key,
        tone_advice=persona_str,
        kalkan_warning=kalkan_warning if dominant_val >= 45 else None,
    )


def emotion_to_dict(e: EmotionAnalysis) -> dict:
    return {
        "fomo_score":    e.fomo_score,
        "panic_score":   e.panic_score,
        "revenge_score": e.revenge_score,
        "overrisk_score":e.overrisk_score,
        "dominant":      e.dominant,
        "kalkan_warning":e.kalkan_warning,
    }