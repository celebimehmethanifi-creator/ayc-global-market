"""
AYC Global Market — Causal Event Engine
=========================================
"Bu fiyat hareketi NEDEN oldu?"

Araştırma bazlı: Bloomberg ASKB, Nasdaq Alt-Data, Granger causality, event study metodolojisi
Katmanlar: Technical Breakout / Volume Anomaly / News Catalyst / Macro / Liquidity / Manipulation / Correlation
"""
from __future__ import annotations
import asyncio
from dataclasses import dataclass, field
from typing import Optional, Literal
import httpx
from datetime import datetime, timezone

CausalType = Literal[
    "TECHNICAL_BREAKOUT", "VOLUME_ANOMALY", "NEWS_CATALYST",
    "MACRO_CATALYST", "LIQUIDITY_EVENT", "MANIPULATION_SIGNAL",
    "CORRELATION_CASCADE", "ORGANIC_TREND", "UNKNOWN",
]

@dataclass
class CausalFactor:
    cause_type: CausalType
    confidence: float
    evidence:   str
    weight:     float = 1.0

@dataclass
class CausalReport:
    symbol:            str
    primary_cause:     CausalType
    primary_conf:      float
    all_factors:       list[CausalFactor]
    narrative:         str
    manipulation_risk: float
    data_quality:      float
    news_headlines:    list[str] = field(default_factory=list)
    timestamp:         str = ""

def _conf_label(v: float) -> str:
    if v >= 80: return "YÜKSEK"
    if v >= 55: return "ORTA"
    if v >= 30: return "DÜŞÜK"
    return "BELİRSİZ"

def _technical_cause(candles, change_24h, volume_ratio, indicators):
    evidence_parts = []
    conf = 20.0
    rsi = indicators.get("rsi", 50)
    macd_hist = indicators.get("macd_hist", 0)
    bb_high = indicators.get("bb_high")
    bb_low  = indicators.get("bb_low")
    price   = candles[-1]["c"] if candles else 0
    if rsi > 70:
        conf += 25; evidence_parts.append(f"RSI {rsi:.0f} — aşırı alım, momentum kırılımı")
    elif rsi < 30:
        conf += 20; evidence_parts.append(f"RSI {rsi:.0f} — aşırı satım, toparlanma")
    if abs(macd_hist) > 0:
        conf += 15 if macd_hist > 0 else 10
        evidence_parts.append(f"MACD histogram {'pozitif' if macd_hist > 0 else 'negatif'} ({macd_hist:.4f})")
    if bb_high and bb_low and price:
        bb_width = (bb_high - bb_low) / max((bb_high + bb_low) / 2, 1) * 100
        if price > bb_high * 0.998:
            conf += 20; evidence_parts.append("Bollinger üst bant kırılımı — güçlü breakout")
        elif price < bb_low * 1.002:
            conf += 15; evidence_parts.append("Bollinger alt bant kırılımı — breakdown")
        if bb_width > 4:
            conf += 10; evidence_parts.append(f"BB genişliği {bb_width:.1f}% — yüksek volatilite rejimi")
    conf = min(conf, 90)
    evidence = "; ".join(evidence_parts) if evidence_parts else "Teknik indikatörler nötr"
    return CausalFactor("TECHNICAL_BREAKOUT", round(conf, 1), evidence)

def _volume_cause(volume_ratio, change_24h):
    evidence_parts = []
    conf = 10.0
    if volume_ratio > 3.0:
        conf = 85; evidence_parts.append(f"Hacim {volume_ratio:.1f}x — kurumsal hareket")
    elif volume_ratio > 2.0:
        conf = 65; evidence_parts.append(f"Hacim {volume_ratio:.1f}x — anlamlı ilgi artışı")
    elif volume_ratio > 1.5:
        conf = 45; evidence_parts.append(f"Hacim {volume_ratio:.1f}x — hafif artış")
    else:
        evidence_parts.append(f"Hacim normal ({volume_ratio:.1f}x)")
    if volume_ratio > 2.0 and abs(change_24h) > 3:
        conf = min(conf + 10, 95)
        evidence_parts.append("Hacim + fiyat hareketi eşzamanlı — güçlü onay")
    return CausalFactor("VOLUME_ANOMALY", round(conf, 1), "; ".join(evidence_parts))

async def _fetch_news_sentiment(symbol, asset_name=""):
    try:
        import feedparser
    except ImportError:
        return 0.0, []
    search_term = asset_name or symbol.replace("USDT","").replace("USD","")
    url = f"https://news.google.com/rss/search?q={search_term}+price+market&hl=en-US&gl=US&ceid=US:en"
    POSITIVE = ["surge","rally","gain","breakout","high","bullish","buy","record","rise","pump","adoption"]
    NEGATIVE = ["crash","drop","fall","sell","bearish","low","ban","hack","fraud","collapse","dump","fear"]
    headlines = []
    pos, neg = 0, 0
    try:
        async with httpx.AsyncClient(timeout=5, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent":"Mozilla/5.0"})
            if resp.status_code == 200:
                feed = feedparser.parse(resp.text)
                for entry in feed.entries[:8]:
                    title = entry.get("title","")
                    if title:
                        headlines.append(title[:100])
                        t_lower = title.lower()
                        pos += sum(1 for w in POSITIVE if w in t_lower)
                        neg += sum(1 for w in NEGATIVE if w in t_lower)
    except Exception:
        pass
    total = pos + neg
    sentiment = (pos - neg) / max(total, 1) if total > 0 else 0.0
    return sentiment, headlines[:5]

def _news_cause(sentiment, headlines, change_24h):
    if not headlines:
        return CausalFactor("NEWS_CATALYST", 15.0, "Haber akışı bulunamadı")
    conf = 30.0
    if sentiment > 0 and change_24h > 1:
        conf = 75; evidence = f"Pozitif haber ({len(headlines)} başlık) × yükselen fiyat uyumu"
    elif sentiment < 0 and change_24h < -1:
        conf = 70; evidence = f"Negatif haber ({len(headlines)} başlık) × düşen fiyat uyumu"
    elif abs(sentiment) > 0.3:
        conf = 50; evidence = f"Orta güçlü haber sinyali (sentiment: {sentiment:+.2f})"
    else:
        conf = 25; evidence = f"Haber akışı nötr ({len(headlines)} başlık)"
    return CausalFactor("NEWS_CATALYST", round(conf,1), evidence)

def _manipulation_risk(volume_ratio, change_24h, funding_rate=0.0, spread_pct=0.0, candles=None):
    risk = 10.0; flags = []
    if abs(funding_rate) > 0.08:
        risk += 30; flags.append(f"Aşırı funding rate ({funding_rate:.3f}) — squeeze riski")
    elif abs(funding_rate) > 0.05:
        risk += 15; flags.append(f"Yüksek funding rate ({funding_rate:.3f})")
    if abs(change_24h) > 10:
        risk += 25; flags.append(f"%{abs(change_24h):.1f} günlük hareket — anormal")
    elif abs(change_24h) > 6:
        risk += 12; flags.append(f"%{abs(change_24h):.1f} günlük hareket — yüksek")
    if spread_pct > 0.5:
        risk += 20; flags.append(f"Spread %{spread_pct:.2f} — likidite düşük")
    if candles and len(candles) >= 3:
        last = candles[-1]
        body = abs(last["c"] - last["o"])
        total_range = last["h"] - last["l"]
        if total_range > 0 and body / total_range < 0.2:
            risk += 15; flags.append("Uzun gölgeli mum — kurumsal reddetme")
    risk = min(risk, 95)
    return round(risk,1), "; ".join(flags) if flags else "Manipülasyon sinyali düşük"

async def analyze_causality(
    symbol, candles, price, change_24h, volume_ratio, indicators,
    spread_pct=0.0, funding_rate=0.0, asset_name="", market="crypto"
) -> CausalReport:
    news_task = asyncio.create_task(_fetch_news_sentiment(symbol, asset_name))
    tech_factor   = _technical_cause(candles, change_24h, volume_ratio, indicators)
    volume_factor = _volume_cause(volume_ratio, change_24h)
    manip_risk, manip_reason = _manipulation_risk(volume_ratio, change_24h, funding_rate, spread_pct, candles)
    try:
        news_sentiment, headlines = await asyncio.wait_for(news_task, timeout=6)
    except Exception:
        news_sentiment, headlines = 0.0, []
    news_factor = _news_cause(news_sentiment, headlines, change_24h)
    liq_conf = 0.0; liq_evidence = "Normal likidite koşulları"
    if volume_ratio < 0.4:
        liq_conf = 60; liq_evidence = f"Düşük hacim ({volume_ratio:.2f}x) — fiyat kırılgan"
    elif spread_pct > 0.3:
        liq_conf = 50; liq_evidence = f"Geniş spread (%{spread_pct:.2f}) — alıcı/satıcı dengesizliği"
    liq_factor = CausalFactor("LIQUIDITY_EVENT", round(liq_conf,1), liq_evidence)
    manip_factor = CausalFactor("MANIPULATION_SIGNAL", round(manip_risk*0.7,1), manip_reason)
    all_factors = [tech_factor, volume_factor, news_factor, liq_factor, manip_factor]
    main_factors = [f for f in all_factors if f.cause_type != "MANIPULATION_SIGNAL"]
    primary = max(main_factors, key=lambda f: f.confidence)
    narrative = _build_narrative(primary, all_factors, change_24h, manip_risk, news_sentiment, headlines)
    data_quality = 80.0
    if not headlines: data_quality -= 10
    if not candles:   data_quality -= 20
    if volume_ratio == 1.0: data_quality -= 15
    return CausalReport(
        symbol=symbol, primary_cause=primary.cause_type, primary_conf=primary.confidence,
        all_factors=all_factors, narrative=narrative, manipulation_risk=manip_risk,
        data_quality=round(data_quality,1), news_headlines=headlines,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

def _build_narrative(primary, all_factors, change_24h, manip_risk, news_sentiment, headlines):
    direction = "yükseli" if change_24h > 0 else "düşü"
    pct = abs(change_24h)
    labels = {"TECHNICAL_BREAKOUT":"teknik kırılım","VOLUME_ANOMALY":"hacim anomalisi",
              "NEWS_CATALYST":"haber katalizörü","LIQUIDITY_EVENT":"likidite değişimi",
              "MANIPULATION_SIGNAL":"olası manipülasyon","UNKNOWN":"belirsiz neden"}
    primary_label = labels.get(primary.cause_type, "belirsiz")
    narrative = (f"%{pct:.1f} günlük {direction}ş hareketinin birincil nedeni "
                 f"**{primary_label}** ({_conf_label(primary.confidence)}, %{primary.confidence:.0f} güven). ")
    secondary = sorted([f for f in all_factors if f.cause_type != primary.cause_type and f.cause_type != "MANIPULATION_SIGNAL"],
                       key=lambda f: f.confidence, reverse=True)
    if secondary and secondary[0].confidence > 35:
        sec_label = labels.get(secondary[0].cause_type,"")
        narrative += f"{sec_label.capitalize()} ({secondary[0].confidence:.0f}/100) ikincil faktör. "
    if manip_risk > 55:
        narrative += f"⚠️ Manipülasyon riski yüksek (%{manip_risk:.0f}). "
    if headlines:
        narrative += f"Son haberler {'pozitif' if news_sentiment > 0 else 'negatif' if news_sentiment < 0 else 'nötr'} tonlu."
    return narrative.strip()

def causal_report_to_dict(r: CausalReport) -> dict:
    return {
        "symbol": r.symbol, "primary_cause": r.primary_cause, "primary_conf": r.primary_conf,
        "manipulation_risk": r.manipulation_risk, "data_quality": r.data_quality,
        "narrative": r.narrative, "news_headlines": r.news_headlines, "timestamp": r.timestamp,
        "factors": [{"type":f.cause_type,"confidence":f.confidence,"evidence":f.evidence} for f in r.all_factors],
    }
