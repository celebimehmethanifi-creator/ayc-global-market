"""
AYC Global Market — Signal Performance Tracker
================================================
Sinyallerin backtest + canlı hit rate takibi.
BlackRock Aladdin'in performans ölçüm metodolojisinden esinlenildi.

Kaydedilir:
- Her sinyal: symbol, stage, direction, entry price, target, stop
- Outcome: hit / stop_hit / timeout / pending
- Süre: kaç mumdur açık
- PnL: gerçekleşmiş kar/zarar
"""
from __future__ import annotations
import json
from dataclasses import dataclass, field, asdict
from typing import Optional, Literal
from datetime import datetime, timezone
from pathlib import Path

PERF_DIR = Path(__file__).parent / "data" / "performance"
PERF_DIR.mkdir(parents=True, exist_ok=True)

Outcome = Literal["HIT","STOP_HIT","TIMEOUT","PENDING"]


@dataclass
class SignalRecord:
    id:            str
    symbol:        str
    stage:         str
    direction:     str
    entry_price:   float
    target_price:  float
    stop_price:    float
    confidence:    float
    created_at:    str
    outcome:       Outcome = "PENDING"
    exit_price:    float = 0.0
    pnl_pct:       float = 0.0
    closed_at:     str = ""
    duration_mins: int = 0


def _perf_path(symbol: str) -> Path:
    safe = symbol.replace("/","_").replace(":","_")[:20]
    return PERF_DIR / f"{safe}.json"


def record_signal(
    symbol: str, stage: str, direction: str,
    entry: float, target: float, stop: float, confidence: float
) -> str:
    """Yeni sinyal kaydet, ID döndür."""
    records = _load_records(symbol)
    sid = f"{symbol}_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    records.append(SignalRecord(
        id=sid, symbol=symbol, stage=stage, direction=direction,
        entry_price=entry, target_price=target, stop_price=stop,
        confidence=confidence, created_at=datetime.now(timezone.utc).isoformat()
    ))
    _save_records(symbol, records)
    return sid


def close_signal(symbol: str, signal_id: str, exit_price: float, outcome: Outcome) -> Optional[SignalRecord]:
    """Sinyali kapat, PnL hesapla."""
    records = _load_records(symbol)
    for r in records:
        if r.id == signal_id and r.outcome == "PENDING":
            r.outcome = outcome
            r.exit_price = exit_price
            r.closed_at = datetime.now(timezone.utc).isoformat()
            if r.direction == "LONG":
                r.pnl_pct = (exit_price - r.entry_price) / r.entry_price * 100
            else:
                r.pnl_pct = (r.entry_price - exit_price) / r.entry_price * 100
            _save_records(symbol, records)
            return r
    return None


def get_performance_stats(symbol: Optional[str] = None) -> dict:
    """Performans istatistikleri."""
    if symbol:
        records = _load_records(symbol)
    else:
        # Tüm semboller
        records = []
        for p in PERF_DIR.glob("*.json"):
            records.extend(_load_records(p.stem))

    closed = [r for r in records if r.outcome != "PENDING"]
    hits   = [r for r in closed if r.outcome == "HIT"]
    stops  = [r for r in closed if r.outcome == "STOP_HIT"]

    if not closed:
        return {
            "total": len(records), "closed": 0, "pending": len(records),
            "hit_rate": 0, "avg_pnl": 0, "best_trade": 0, "worst_trade": 0,
            "expectancy": 0, "records": []
        }

    hit_rate  = len(hits) / len(closed) * 100
    avg_pnl   = sum(r.pnl_pct for r in closed) / len(closed)
    avg_win   = sum(r.pnl_pct for r in hits)   / max(len(hits),1)
    avg_loss  = sum(r.pnl_pct for r in stops)  / max(len(stops),1)
    best  = max((r.pnl_pct for r in closed), default=0)
    worst = min((r.pnl_pct for r in closed), default=0)
    # Expectancy = (win_rate × avg_win) + (loss_rate × avg_loss)
    win_rate  = len(hits)  / len(closed)
    loss_rate = len(stops) / len(closed)
    expectancy = (win_rate * avg_win) + (loss_rate * avg_loss)

    return {
        "total":     len(records),
        "closed":    len(closed),
        "pending":   len(records) - len(closed),
        "hits":      len(hits),
        "stops":     len(stops),
        "hit_rate":  round(hit_rate, 1),
        "avg_pnl":   round(avg_pnl, 2),
        "avg_win":   round(avg_win, 2),
        "avg_loss":  round(avg_loss, 2),
        "best_trade":  round(best, 2),
        "worst_trade": round(worst, 2),
        "expectancy":  round(expectancy, 2),
        "records": [asdict(r) for r in sorted(records, key=lambda x: x.created_at, reverse=True)[:20]],
    }


def _load_records(symbol: str) -> list[SignalRecord]:
    path = _perf_path(symbol)
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return [SignalRecord(**r) for r in data]
    except Exception:
        return []


def _save_records(symbol: str, records: list[SignalRecord]) -> None:
    path = _perf_path(symbol)
    path.write_text(json.dumps([asdict(r) for r in records[-200:]], ensure_ascii=False, indent=2), encoding="utf-8")
