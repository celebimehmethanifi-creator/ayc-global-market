"""
AYC AI Market Copilot - 6 AL/Long Signal Motoru
Her motor OHLCV verisini alir, aday sinyali uretir.
Tek basina AL vermez; Risk/Guven -> Kalkan -> Consensus -> Final Answer uzerinden gider.
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal
import math


@dataclass
class MotorSignal:
    motor: str
    signal: Literal["LONG", "SHORT", "NEUTRAL", "IZLE"]
    score: float          # 0-100
    reason: str
    confidence: float     # 0-100
    warnings: list[str] = field(default_factory=list)


def _ema(prices: list[float], period: int) -> list[float]:
    if len(prices) < period: return []
    k = 2.0 / (period + 1)
    ema = [sum(prices[:period]) / period]
    for p in prices[period:]:
        ema.append(p * k + ema[-1] * (1 - k))
    return ema


def _sma(prices: list[float], period: int) -> float:
    if len(prices) < period: return 0.0
    return sum(prices[-period:]) / period


def _rsi(closes: list[float], period: int = 14) -> float:
    if len(closes) < period + 1: return 50.0
    gains, losses = [], []
    for i in range(1, len(closes)):
        d = closes[i] - closes[i-1]
        gains.append(max(d, 0)); losses.append(max(-d, 0))
    ag = sum(gains[-period:]) / period
    al = sum(losses[-period:]) / period
    if al == 0: return 100.0
    rs = ag / al
    return 100 - (100 / (1 + rs))


def _macd(closes: list[float]) -> tuple[float, float, float]:
    """MACD, Signal, Histogram"""
    if len(closes) < 26: return 0.0, 0.0, 0.0
    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    n = min(len(ema12), len(ema26))
    macd_line = [ema12[-(n-i)] - ema26[-(n-i)] for i in range(n)]
    signal_line = _ema(macd_line, 9)
    if not signal_line: return macd_line[-1], 0.0, macd_line[-1]
    hist = macd_line[-1] - signal_line[-1]
    return macd_line[-1], signal_line[-1], hist


def _bollinger(closes: list[float], period: int = 20, std_mult: float = 2.0):
    if len(closes) < period: return None, None, None
    mid = _sma(closes, period)
    std = math.sqrt(sum((c - mid)**2 for c in closes[-period:]) / period)
    return mid - std_mult*std, mid, mid + std_mult*std


# ════════════════════════════════════════════════════════════════
# MOTOR 1 - TREND TAKİP
# ════════════════════════════════════════════════════════════════
def trend_motor(candles: list[dict]) -> MotorSignal:
    """
    Trend yukari mi? MA yapisi yukari mi? Fiyat destek ustunde mi?
    """
    if len(candles) < 20:
        return MotorSignal("TrendTakip","NEUTRAL",30,"Yetersiz veri",30,["Candlestick sayisi az"])

    closes = [float(c["c"]) for c in candles]
    highs  = [float(c["h"]) for c in candles]
    lows   = [float(c["l"]) for c in candles]
    price  = closes[-1]

    ma20  = _sma(closes, 20)
    ma50  = _sma(closes, min(50, len(closes)))
    ma200 = _sma(closes, min(200, len(closes)))

    ema12 = _ema(closes, 12)
    ema26 = _ema(closes, 26)
    ema_bull = len(ema12) > 0 and len(ema26) > 0 and ema12[-1] > ema26[-1]

    # Higher highs & higher lows
    recent_highs = highs[-10:]
    recent_lows  = lows[-10:]
    hh = recent_highs[-1] > max(recent_highs[:-1]) if len(recent_highs) > 1 else False
    hl = recent_lows[-1]  > min(recent_lows[:-3]) if len(recent_lows) > 3 else False

    score = 50.0
    reasons = []
    warnings = []

    if price > ma20:   score += 10; reasons.append("fiyat MA20 ustu")
    else:              score -= 10; warnings.append("fiyat MA20 altinda")
    if price > ma50:   score += 8;  reasons.append("fiyat MA50 ustu")
    else:              score -= 8;  warnings.append("fiyat MA50 altinda")
    if price > ma200:  score += 5
    if ema_bull:       score += 7;  reasons.append("EMA12>EMA26 yukselici")
    else:              score -= 7;  warnings.append("EMA kesisimi dusus")
    if hh:             score += 8;  reasons.append("higher high")
    if hl:             score += 7;  reasons.append("higher low")

    score = max(min(score, 97), 5)
    signal = "LONG" if score >= 60 else ("NEUTRAL" if score >= 40 else "SHORT")
    reason_text = ", ".join(reasons) if reasons else "karisik trend sinyalleri"
    return MotorSignal("TrendTakip", signal, round(score,1), reason_text, round(score*0.9,1), warnings)


# ════════════════════════════════════════════════════════════════
# MOTOR 2 - MOMENTUM
# ════════════════════════════════════════════════════════════════
def momentum_motor(candles: list[dict]) -> MotorSignal:
    """
    RSI toparlaniyor mu? MACD pozitif mi? Fiyat ivmesi gucluyor mu?
    """
    if len(candles) < 15:
        return MotorSignal("Momentum","NEUTRAL",30,"Yetersiz veri",30,["Candlestick sayisi az"])

    closes  = [float(c["c"]) for c in candles]
    volumes = [float(c.get("v",0)) for c in candles]

    rsi  = _rsi(closes)
    macd, sig, hist = _macd(closes)

    # Fiyat ivmesi (son 5 vs onceki 5)
    if len(closes) >= 10:
        recent_ret = (closes[-1] / closes[-6] - 1) * 100 if closes[-6] else 0
    else:
        recent_ret = 0

    # Hacim trendi
    avg_vol = _sma(volumes, min(10, len(volumes)))
    cur_vol = volumes[-1] if volumes else 0
    vol_ratio = cur_vol / avg_vol if avg_vol > 0 else 1.0

    score = 50.0
    reasons = []
    warnings = []

    if 40 <= rsi <= 70:   score += 10; reasons.append(f"RSI saglikli ({rsi:.0f})")
    elif rsi < 30:         score -= 5;  warnings.append(f"RSI asiri satim ({rsi:.0f}) - reversal baktirilabilir")
    elif rsi > 75:         score -= 12; warnings.append(f"RSI asiri alim ({rsi:.0f})")

    if hist > 0:           score += 10; reasons.append("MACD histogram pozitif")
    elif hist < 0:         score -= 10; warnings.append("MACD histogram negatif")

    if macd > sig:         score += 5;  reasons.append("MACD > signal")
    if recent_ret > 1.5:   score += 8;  reasons.append(f"guclu fiyat ivmesi +{recent_ret:.1f}%")
    elif recent_ret < -1.5:score -= 8;  warnings.append(f"zayif fiyat ivmesi {recent_ret:.1f}%")
    if vol_ratio > 1.3:    score += 5;  reasons.append("yukselis hacimle destekleniyor")
    elif vol_ratio < 0.6:  score -= 5;  warnings.append("hacim zayif")

    score = max(min(score, 97), 5)
    signal = "LONG" if score >= 60 else ("NEUTRAL" if score >= 40 else "SHORT")
    return MotorSignal("Momentum", signal, round(score,1),
                       ", ".join(reasons) if reasons else "karisik momentum",
                       round(score*0.85,1), warnings)


# ════════════════════════════════════════════════════════════════
# MOTOR 3 - HACİM / LİKİDİTE
# ════════════════════════════════════════════════════════════════
def hacim_motor(candles: list[dict], spread_pct: float = 0.0) -> MotorSignal:
    """
    Hacim yeterli mi? Yukselis hacimle destekleniyor mu?
    Likidite kotuyse AL YOK.
    """
    if len(candles) < 10:
        return MotorSignal("Hacim","NEUTRAL",25,"Yetersiz veri",25,["Candlestick sayisi az"])

    closes  = [float(c["c"]) for c in candles]
    volumes = [float(c.get("v",0)) for c in candles]

    avg_vol = _sma(volumes, min(20, len(volumes)))
    cur_vol = volumes[-1] if volumes else 0
    vol_ratio = cur_vol / avg_vol if avg_vol > 0 else 1.0

    # Yukselis gunleri hacim vs dusus gunleri hacim
    up_vol = sum(volumes[i] for i in range(len(closes)-1) if closes[i] > closes[i-1])
    dn_vol = sum(volumes[i] for i in range(len(closes)-1) if closes[i] < closes[i-1])
    obv_positive = up_vol > dn_vol

    score = 50.0
    reasons = []
    warnings = []

    # Spread filtresi - en sert kural
    if spread_pct > 2.0:
        return MotorSignal("Hacim","NEUTRAL",5,"Spread cok yuksek - AL YOK",5,
                           [f"Spread %{spread_pct:.1f} kabul edilemez"])

    if vol_ratio > 2.0:    score += 20; reasons.append(f"cok guclu hacim (x{vol_ratio:.1f})")
    elif vol_ratio > 1.3:  score += 10; reasons.append(f"guclu hacim (x{vol_ratio:.1f})")
    elif vol_ratio < 0.4:  score -= 25; warnings.append(f"cok dusuk hacim (x{vol_ratio:.1f}) - AL YOK seviyesi")
    elif vol_ratio < 0.7:  score -= 12; warnings.append(f"dusuk hacim (x{vol_ratio:.1f})")

    if obv_positive:       score += 10; reasons.append("OBV pozitif (yukselis hacimli)")
    else:                  score -= 10; warnings.append("OBV negatif (dusus hacimli)")

    if spread_pct > 0.5:   score -= 5;  warnings.append(f"Spread dikkat: %{spread_pct:.2f}")

    score = max(min(score, 97), 5)
    signal = "LONG" if score >= 55 else ("NEUTRAL" if score >= 35 else "SHORT")
    return MotorSignal("Hacim", signal, round(score,1),
                       ", ".join(reasons) if reasons else "hacim nort",
                       round(score*0.9,1), warnings)


# ════════════════════════════════════════════════════════════════
# MOTOR 4 - REVERSAL / DİPTEN DÖNÜŞ
# ════════════════════════════════════════════════════════════════
def reversal_motor(candles: list[dict]) -> MotorSignal:
    """
    Asiri satistan donus var mi? RSI toparlaniyor mu?
    Yuksek riskli motor - Kalkan onayi sarttir.
    """
    if len(candles) < 14:
        return MotorSignal("Reversal","NEUTRAL",30,"Yetersiz veri",30,["Candlestick sayisi az"])

    closes  = [float(c["c"]) for c in candles]
    lows    = [float(c["l"]) for c in candles]
    volumes = [float(c.get("v",0)) for c in candles]

    rsi = _rsi(closes)
    bb_low, bb_mid, bb_high = _bollinger(closes)

    # Destek bolgesinde miyiz?
    support = min(lows[-20:]) if len(lows) >= 20 else lows[-1]
    near_support = (closes[-1] - support) / support * 100 < 3.0 if support > 0 else False

    # RSI toparlaniyor mu? (son 3 mum yukselis)
    rsi_recovering = rsi < 40 and len(closes) >= 3 and closes[-1] > closes[-3]

    # Hacim artisi ile tepki
    avg_vol = _sma(volumes, min(10, len(volumes)))
    vol_spike = volumes[-1] > avg_vol * 1.5 if avg_vol > 0 else False

    # Fiyat alt bant altinda mi?
    at_bb_low = bb_low is not None and closes[-1] < bb_low * 1.01

    score = 35.0  # Reversal baslangicta dusuk skorlanir - risk yuksek
    reasons = []
    warnings = ["Reversal motor - yuksek risk, Kalkan onayi sarttir"]

    if rsi < 30:            score += 15; reasons.append(f"RSI asiri satim ({rsi:.0f})")
    elif rsi < 40:           score += 8;  reasons.append(f"RSI dusuk seviye ({rsi:.0f})")
    else:                    warnings.append(f"RSI reversal icin yuksek ({rsi:.0f})")

    if rsi_recovering:       score += 12; reasons.append("RSI toparlanma sinyali")
    if near_support:         score += 10; reasons.append("destek bolgesinde")
    if vol_spike:            score += 10; reasons.append("hacim artisi - tepki guclu")
    if at_bb_low:            score += 8;  reasons.append("Bollinger alt bant - asiri uzaklik")

    score = max(min(score, 80), 5)  # Max 80 - reversal her zaman riskli
    signal = "LONG" if score >= 55 else "IZLE"  # IZLE cunku Kalkan onayi lazim
    return MotorSignal("Reversal", signal, round(score,1),
                       ", ".join(reasons) if reasons else "reversal sartlari yok",
                       round(score*0.75,1), warnings)


# ════════════════════════════════════════════════════════════════
# MOTOR 5 - BREAKOUT / KIRILIM
# ════════════════════════════════════════════════════════════════
def breakout_motor(candles: list[dict]) -> MotorSignal:
    """
    Direnc kirildi mi? Hacimle dogrulanmis mi? Kapalis teyit var mi?
    Kirilis + hacim + kapanisteyidi olmadan AL verilmez.
    """
    if len(candles) < 20:
        return MotorSignal("Breakout","NEUTRAL",30,"Yetersiz veri",30,["Candlestick sayisi az"])

    closes  = [float(c["c"]) for c in candles]
    highs   = [float(c["h"]) for c in candles]
    volumes = [float(c.get("v",0)) for c in candles]

    # Direnc: son 20 mumun en yuksegi (son mum haric)
    resistance = max(highs[-21:-1]) if len(highs) >= 21 else max(highs[:-1])
    cur_close   = closes[-1]
    prev_close  = closes[-2]

    breakout_happened = cur_close > resistance * 0.998
    confirmed_close   = cur_close > resistance  # Kapanisteyidi
    prev_under        = prev_close < resistance  # Onceden altindaydi

    avg_vol = _sma(volumes, min(20, len(volumes)))
    vol_ratio = volumes[-1] / avg_vol if avg_vol > 0 else 1.0
    vol_confirms = vol_ratio > 1.3

    # False breakout riski - kisa vadeli kirilis
    bb_low, bb_mid, bb_high = _bollinger(closes)
    near_bb_upper = bb_high is not None and cur_close > bb_high * 0.97

    score = 30.0
    reasons = []
    warnings = []

    if not breakout_happened:
        warnings.append("Kirilis henuz olmadi")
        return MotorSignal("Breakout","NEUTRAL",20,"Kirilis yok",20,warnings)

    if confirmed_close:    score += 25; reasons.append("kapanisteyidi var")
    else:                  warnings.append("kapanisteyidi yok - fake breakout riski")

    if prev_under:         score += 15; reasons.append("onceden direnc altindaydi - gercek kirilis")
    if vol_confirms:       score += 20; reasons.append(f"hacim kirilis dogruluyor (x{vol_ratio:.1f})")
    else:                  score -= 10; warnings.append("hacim dogrulamasi zayif")

    if near_bb_upper:      score -= 5; warnings.append("BB ust bantina yakin - asiri uzaklik")

    score = max(min(score, 92), 5)
    signal = "LONG" if score >= 60 and confirmed_close and vol_confirms else ("IZLE" if score >= 40 else "NEUTRAL")
    return MotorSignal("Breakout", signal, round(score,1),
                       ", ".join(reasons) if reasons else "kirilis sartlari yok",
                       round(score*0.85,1), warnings)


# ════════════════════════════════════════════════════════════════
# MOTOR 6 - CONTRARIAN (KALABALIK TERSİ)
# ════════════════════════════════════════════════════════════════
def contrarian_signal_motor(
    change_24h: float,
    rsi_val: float | None = None,
    funding_rate: float = 0.0,   # kripto icin
    long_ratio: float = 0.5,     # 0-1
) -> MotorSignal:
    """
    Kalabalik tek yone yigilmis mi? Risk uyarisi uretir, dogrudan AL vermez.
    """
    score = 50.0
    reasons = []
    warnings = []

    # Asiri long yigilmasi
    if long_ratio > 0.72:
        score -= 15
        warnings.append(f"Asiri long yogunlugu (%{long_ratio*100:.0f}) - squeeze riski")
    elif long_ratio < 0.28:
        score += 10
        reasons.append("Asiri short yogunlugu - contrarian long firsati")

    # Funding rate
    if funding_rate > 0.05:
        score -= 12
        warnings.append(f"Yuksek funding rate ({funding_rate:.3f}) - long tuzak riski")
    elif funding_rate < -0.05:
        score += 8
        reasons.append(f"Negatif funding - short squeeze riski")

    # Asiri satim / alim
    if rsi_val is not None:
        if rsi_val > 78:
            score -= 15; warnings.append(f"RSI asgari alim ({rsi_val:.0f}) - dikkat")
        elif rsi_val < 25:
            score += 12; reasons.append(f"RSI asiri satim ({rsi_val:.0f}) - contrarian long")

    # Ani cok sert hareket
    if abs(change_24h) > 10:
        score -= 8
        warnings.append(f"Sert hareket (%{change_24h:+.1f}) - sentiment asiri")

    score = max(min(score, 90), 10)
    signal = "IZLE" if score < 40 else ("LONG" if score > 65 else "NEUTRAL")
    return MotorSignal("Contrarian", signal, round(score,1),
                       ", ".join(reasons) if reasons else "kalabalik yogunlugu nort",
                       round(score*0.8,1), warnings)


# ════════════════════════════════════════════════════════════════
# TOPLAM TEKNİK SKOR
# ════════════════════════════════════════════════════════════════
def compute_technical_score(
    candles: list[dict],
    change_24h: float = 0.0,
    spread_pct: float = 0.0,
    funding_rate: float = 0.0,
    long_ratio: float = 0.5,
) -> dict:
    """
    Tum 6 motoru calistir, agirlikli ortalama teknik skor ve Long sinyal uret.
    """
    closes = [float(c["c"]) for c in candles] if candles else []
    rsi_val = _rsi(closes) if len(closes) >= 15 else None
    macd_val, sig_val, hist_val = _macd(closes) if len(closes) >= 26 else (0,0,0)
    bb_low, bb_mid, bb_high = _bollinger(closes) if len(closes) >= 20 else (None, None, None)
    ma20 = _sma(closes, 20) if len(closes) >= 20 else None
    ma50 = _sma(closes, 50) if len(closes) >= 50 else None

    t  = trend_motor(candles)
    m  = momentum_motor(candles)
    h  = hacim_motor(candles, spread_pct)
    r  = reversal_motor(candles)
    b  = breakout_motor(candles)
    c  = contrarian_signal_motor(change_24h, rsi_val, funding_rate, long_ratio)

    motors = [t, m, h, r, b, c]

    # Agirliklar: Trend+Momentum+Hacim en onemli
    weights = {"TrendTakip":0.25,"Momentum":0.22,"Hacim":0.20,
               "Reversal":0.12,"Breakout":0.13,"Contrarian":0.08}
    weighted_score = sum(mt.score * weights.get(mt.motor,0.1) for mt in motors)
    total_w = sum(weights.values())
    technical_score = weighted_score / total_w

    # Long sinyal oyu
    long_votes  = sum(1 for mt in motors if mt.signal == "LONG")
    short_votes = sum(1 for mt in motors if mt.signal == "SHORT")
    izle_votes  = sum(1 for mt in motors if mt.signal == "IZLE")

    all_warnings = []
    for mt in motors: all_warnings.extend(mt.warnings)

    return {
        "technical_score": round(technical_score, 1),
        "long_votes":  long_votes,
        "short_votes": short_votes,
        "izle_votes":  izle_votes,
        "motors": [{"motor":mt.motor,"signal":mt.signal,"score":mt.score,"reason":mt.reason} for mt in motors],
        "indicators": {
            "rsi":   round(rsi_val,1) if rsi_val else None,
            "macd":  round(macd_val,4),
            "macd_hist": round(hist_val,4),
            "ma20":  round(ma20,4) if ma20 else None,
            "ma50":  round(ma50,4) if ma50 else None,
            "bb_low":  round(bb_low,4) if bb_low else None,
            "bb_mid":  round(bb_mid,4) if bb_mid else None,
            "bb_high": round(bb_high,4) if bb_high else None,
        },
        "warnings": list(set(all_warnings)),
    }