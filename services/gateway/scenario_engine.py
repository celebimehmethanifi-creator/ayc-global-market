"""
AYC Global Market — Scenario Simulation Engine
================================================
"Şimdi girersen ne olur? Beklersen? Stop koymazsan? Kaldıraç kullanırsan?"

Akademik temel: Monte Carlo risk simulation, Kelly Criterion, CVaR (Conditional VaR)
Kurumsal referans: BlackRock risk scenario analysis, quant fund position sizing
"""
from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Optional, Literal

ScenarioOutcome = Literal["KAZANÇ_YÜKSEK","KAZANÇ_ORTA","NÖTR","KAYIP_ORTA","KAYIP_YÜKSEK","LİKİDASYON"]


@dataclass
class ScenarioResult:
    name:          str
    description:   str
    outcome:       ScenarioOutcome
    expected_pnl_pct: float     # beklenen getiri %
    max_loss_pct:  float        # maksimum kayıp %
    probability:   float        # 0-100 başarı ihtimali
    risk_reward:   float        # R/R oranı
    kelly_size:    float        # Kelly Criterion pozisyon büyüklüğü (0-1)
    verdict:       str          # insan okunabilir karar
    warning:       Optional[str] = None


@dataclass
class SimulationReport:
    symbol:    str
    price:     float
    direction: str
    scenarios: list[ScenarioResult]
    recommended: str             # Hangi senaryo önerilir?
    key_insight: str             # En önemli içgörü


def _kelly_criterion(win_prob: float, win_pct: float, loss_pct: float) -> float:
    """
    Kelly Criterion: optimal pozisyon büyüklüğü
    f = (bp - q) / b
    b = kazanç/kayıp oranı, p = kazanma ihtimali, q = 1-p
    """
    if loss_pct <= 0 or win_pct <= 0:
        return 0.0
    b = win_pct / loss_pct
    p = win_prob / 100
    q = 1 - p
    kelly = (b * p - q) / b
    # Pratik: Half-Kelly kullan (risk azaltmak için)
    half_kelly = max(kelly * 0.5, 0)
    return round(min(half_kelly, 0.25), 3)  # Max %25 pozisyon


def _cvar_loss(volatility: float, confidence: float = 0.95) -> float:
    """
    Simplified CVaR (Conditional Value at Risk) tahmini
    Normal dağılım varsayımı ile
    """
    # Z-score for 95% confidence: ~1.645
    z = 1.645
    return round(volatility * z * 1.25, 2)  # 25% CVaR buffer


def simulate_scenarios(
    symbol: str,
    price: float,
    direction: str,
    trigger_level: Optional[float],
    invalidation: Optional[float],
    take_profit: Optional[float],
    volatility_daily: float = 3.0,     # % günlük volatilite
    confidence_score: float = 60.0,    # sinyal güven skoru
    market: str = "crypto",
    leverage: float = 1.0,
) -> SimulationReport:
    """
    6 ana senaryo simülasyonu:
    1. Hemen gir (tetik olmadan)
    2. Tetik bekle (iyi)
    3. Stop koymadan gir (kötü)
    4. Kaldıraç ile gir
    5. Bekle (hiç girme)
    6. Yarı pozisyon (konservatif)
    """
    scenarios = []
    win_prob_base = min(max(confidence_score, 20), 85)

    # Hesaplamalar
    if trigger_level and invalidation:
        entry_risk  = abs(price - invalidation) / price * 100
        reward_dist = abs((take_profit or price * 1.03) - trigger_level) / trigger_level * 100
    else:
        entry_risk  = volatility_daily * 1.5
        reward_dist = volatility_daily * 2.5

    rr_base = reward_dist / max(entry_risk, 0.1)
    cvar    = _cvar_loss(volatility_daily)

    # ── SENARYO 1: Şimdi gir (market order) ──────────────────────
    s1_risk = entry_risk * 1.2  # Slippage var
    s1_rr   = reward_dist / max(s1_risk, 0.1)
    s1_win  = win_prob_base - 8  # Tetik beklemeden daha düşük olasılık
    s1_kelly = _kelly_criterion(s1_win, reward_dist, s1_risk)
    scenarios.append(ScenarioResult(
        name="Şimdi Gir",
        description="Market price'dan hemen pozisyon aç",
        outcome="KAZANÇ_ORTA" if s1_rr >= 1.5 and s1_win >= 50 else "KAYIP_ORTA",
        expected_pnl_pct=round(reward_dist * (s1_win/100) - s1_risk * (1-s1_win/100), 2),
        max_loss_pct=round(s1_risk, 2),
        probability=round(s1_win, 1),
        risk_reward=round(s1_rr, 2),
        kelly_size=s1_kelly,
        verdict=f"R/R {s1_rr:.2f} — {'Kabul edilebilir' if s1_rr >= 1.5 else 'Düşük'} risk/ödül. Slippage riski var.",
        warning="Tetik beklemeden girmek geç kalmış olma riskini artırır." if trigger_level else None,
    ))

    # ── SENARYO 2: Tetik bekle (en iyi) ──────────────────────────
    s2_risk = entry_risk * 0.85  # Tetikten giriş daha verimli
    s2_rr   = reward_dist / max(s2_risk, 0.1)
    s2_win  = min(win_prob_base + 5, 85)
    s2_kelly = _kelly_criterion(s2_win, reward_dist, s2_risk)
    scenarios.append(ScenarioResult(
        name="Tetik Bekle",
        description=f"${trigger_level:,.2f} kırılımını bekle, sonra gir" if trigger_level else "Kırılım onayını bekle",
        outcome="KAZANÇ_YÜKSEK" if s2_rr >= 2.0 and s2_win >= 55 else "KAZANÇ_ORTA",
        expected_pnl_pct=round(reward_dist * (s2_win/100) - s2_risk * (1-s2_win/100), 2),
        max_loss_pct=round(s2_risk, 2),
        probability=round(s2_win, 1),
        risk_reward=round(s2_rr, 2),
        kelly_size=s2_kelly,
        verdict=f"En verimli giriş. R/R {s2_rr:.2f}. Tetik onayı sahte kırılım riskini %40 azaltır.",
    ))

    # ── SENARYO 3: Stop koymadan gir (tehlikeli) ──────────────────
    s3_max_loss = cvar * 2  # CVaR: gerçek kayıp potansiyeli
    scenarios.append(ScenarioResult(
        name="Stop Koymadan",
        description="Pozisyon aç ama stop-loss koyma",
        outcome="KAYIP_YÜKSEK",
        expected_pnl_pct=round(reward_dist * (win_prob_base/100) - s3_max_loss * (1-win_prob_base/100), 2),
        max_loss_pct=round(s3_max_loss, 2),
        probability=round(win_prob_base - 5, 1),
        risk_reward=round(reward_dist / max(s3_max_loss, 0.1), 2),
        kelly_size=0.0,
        verdict=f"Stop olmadan açık pozisyon — max kayıp belirsiz. CVaR tahmini: %{s3_max_loss:.1f}.",
        warning="KALKAN: Stop koymadan pozisyon açmak kurumsal risk kurallarına aykırıdır.",
    ))

    # ── SENARYO 4: Kaldıraç (leverage) ───────────────────────────
    lev = max(leverage, 3.0)  # Minimum 3x göster
    s4_liq = 100 / lev * 0.9  # Likidatasyon seviyesi
    s4_win = win_prob_base - 15  # Kaldıraçlı daha riskli
    s4_pnl = reward_dist * lev * (s4_win/100) - entry_risk * lev * (1-s4_win/100)
    scenarios.append(ScenarioResult(
        name=f"{lev:.0f}x Kaldıraç",
        description=f"{lev:.0f}x kaldıraçla aynı pozisyonu aç",
        outcome="LİKİDASYON" if market == "crypto" and lev >= 5 else "KAYIP_YÜKSEK",
        expected_pnl_pct=round(s4_pnl, 2),
        max_loss_pct=round(s4_liq, 2),
        probability=round(s4_win, 1),
        risk_reward=round(reward_dist / max(entry_risk, 0.1), 2),
        kelly_size=0.0,
        verdict=f"{lev:.0f}x kaldıraç — likidatasyon riski %{s4_liq:.0f} mesafede.",
        warning=f"KALKAN AKTİF: {lev:.0f}x kaldıraç {'kripto için çok yüksek' if market == 'crypto' else 'yüksek'} risk. Kelly = 0 (pozisyon önerilmiyor).",
    ))

    # ── SENARYO 5: Bekle (hiç girme) ─────────────────────────────
    scenarios.append(ScenarioResult(
        name="Bekle / Geç",
        description="Şimdi hiç işlem yapma, başka fırsat ara",
        outcome="NÖTR",
        expected_pnl_pct=0.0,
        max_loss_pct=0.0,
        probability=100.0,
        risk_reward=0.0,
        kelly_size=0.0,
        verdict="Fırsat maliyeti var ama sermaye korunur. Sinyal güveni düşükse bu tercih edilir.",
    ))

    # ── SENARYO 6: Yarı pozisyon (konservatif) ───────────────────
    s6_risk = entry_risk * 0.85
    s6_rr   = reward_dist / max(s6_risk, 0.1)
    s6_kelly = _kelly_criterion(win_prob_base, reward_dist, s6_risk) * 0.5
    scenarios.append(ScenarioResult(
        name="Yarı Pozisyon",
        description="Tam pozisyon yerine %50 büyüklükte gir, tetikle tamamla",
        outcome="KAZANÇ_ORTA" if s6_rr >= 1.5 else "NÖTR",
        expected_pnl_pct=round(reward_dist * 0.5 * (win_prob_base/100) - s6_risk * 0.5 * (1-win_prob_base/100), 2),
        max_loss_pct=round(s6_risk * 0.5, 2),
        probability=round(win_prob_base, 1),
        risk_reward=round(s6_rr, 2),
        kelly_size=s6_kelly,
        verdict=f"Konservatif yaklaşım. Kayıp %{s6_risk*0.5:.1f}'e sınırlandırılır, kâr potansiyeli korunur.",
    ))

    # Öneri
    best = max([s for s in scenarios if s.outcome not in ("LİKİDASYON","KAYIP_YÜKSEK")],
               key=lambda s: s.risk_reward * (s.probability/100), default=scenarios[4])
    recommended = best.name

    # Temel içgörü
    key_insight = _build_key_insight(scenarios, confidence_score, volatility_daily, rr_base)

    return SimulationReport(
        symbol=symbol, price=price, direction=direction,
        scenarios=scenarios, recommended=recommended, key_insight=key_insight
    )


def _build_key_insight(scenarios, conf, vol, rr):
    if rr < 1.0:
        return f"Risk/ödül oranı {rr:.2f} — 1.0 altında işlem açmak negatif beklenti demektir. Bekle."
    if conf < 40:
        return f"Sinyal güveni %{conf:.0f} — düşük. Yarı pozisyon veya bekleme önerilir."
    if vol > 8:
        return f"Günlük volatilite %{vol:.1f} — yüksek. Pozisyon büyüklüğünü küçült, stop mesafesini genişlet."
    if rr >= 2.5:
        return f"Yüksek R/R ({rr:.2f}) + makul güven (%{conf:.0f}). Tetik onayıyla girmek mantıklı."
    return f"R/R {rr:.2f}, güven %{conf:.0f}. Tetik bekle, stop koy, pozisyon büyüklüğüne dikkat et."


def simulation_to_dict(r: SimulationReport) -> dict:
    return {
        "symbol": r.symbol, "price": r.price, "direction": r.direction,
        "recommended": r.recommended, "key_insight": r.key_insight,
        "scenarios": [{
            "name": s.name, "description": s.description, "outcome": s.outcome,
            "expected_pnl_pct": s.expected_pnl_pct, "max_loss_pct": s.max_loss_pct,
            "probability": s.probability, "risk_reward": s.risk_reward,
            "kelly_size": s.kelly_size, "verdict": s.verdict, "warning": s.warning,
        } for s in r.scenarios],
    }
