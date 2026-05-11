"""
AYC Global Market — User Digital Twin
========================================
Kullanıcının davranış profili ve karar geçmişi.
Akademik kaynak: behavioral finance + trading psychology literature.

Ne saklıyor:
- FOMO/panik/intikam/aşırı risk kalıpları
- Saat bazlı risk profili
- Varlık bazlı hata geçmişi
- Stop disiplini skoru
- Geç giriş alışkanlığı
- Başarılı/başarısız senaryo geçmişi
"""
from __future__ import annotations
import json
import os
from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime, timezone
from pathlib import Path

TWIN_DIR = Path(__file__).parent / "data" / "twins"
TWIN_DIR.mkdir(parents=True, exist_ok=True)


@dataclass
class BehaviorEvent:
    ts:         str
    event_type: str   # "fomo_alert","panic_alert","revenge_alert","overrisk_alert","good_decision","bad_decision"
    symbol:     str
    detail:     str
    emotion:    str = "neutral"


@dataclass
class AssetProfile:
    symbol:      str
    total_signals_viewed: int = 0
    fomo_entries:  int = 0
    panic_exits:   int = 0
    stop_hits:     int = 0
    wins:          int = 0
    losses:        int = 0


@dataclass
class UserTwin:
    user_id:       str
    created_at:    str = ""
    last_seen:     str = ""

    # Emotion counters
    fomo_count:     int = 0
    panic_count:    int = 0
    revenge_count:  int = 0
    overrisk_count: int = 0
    good_decisions: int = 0

    # Derived scores (0-100)
    discipline_score: float = 50.0  # yüksek = iyi disiplin
    risk_tolerance:   float = 50.0  # kişinin risk profili
    late_entry_bias:  float = 0.0   # 0=yok, 100=çok sık geç girmiş

    # Asset profiles
    asset_profiles: dict[str, AssetProfile] = field(default_factory=dict)
    # Event log (son 50)
    events: list[BehaviorEvent] = field(default_factory=list)

    def dominant_weakness(self) -> str:
        counts = {
            "fomo": self.fomo_count,
            "panic": self.panic_count,
            "revenge": self.revenge_count,
            "overrisk": self.overrisk_count,
        }
        dom = max(counts, key=counts.get)
        if counts[dom] == 0:
            return "none"
        return dom

    def risk_label(self) -> str:
        if self.risk_tolerance >= 70: return "AGGRESSIVE"
        if self.risk_tolerance >= 45: return "MODERATE"
        return "CONSERVATIVE"

    def coaching_note(self) -> str:
        weakness = self.dominant_weakness()
        notes = {
            "fomo": "FOMO kalıbı tespit edildi. Hareketleri kovalamak yerine tetik bekle.",
            "panic": "Panik eğilimi var. Stop koyup ekrandan uzaklaş, karar günle verme.",
            "revenge": "İntikam işlemi geçmişi var — en tehlikeli kalıp. Zarar sonrası 24 saat bekle.",
            "overrisk": "Aşırı risk alma eğilimi. Pozisyon büyüklüğünü pozisyon başına max %2 tut.",
            "none": "Davranış profili dengeli görünüyor. İyi disiplin.",
        }
        return notes.get(weakness, "Profil oluşturulmaya devam ediliyor.")


def _twin_path(user_id: str) -> Path:
    safe = "".join(c for c in user_id if c.isalnum() or c in "_-")[:40]
    return TWIN_DIR / f"{safe}.json"


def load_twin(user_id: str) -> UserTwin:
    path = _twin_path(user_id)
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            twin = UserTwin(user_id=user_id)
            for k, v in data.items():
                if k == "events":
                    twin.events = [BehaviorEvent(**e) for e in v[-50:]]
                elif k == "asset_profiles":
                    twin.asset_profiles = {sym: AssetProfile(**p) for sym, p in v.items()}
                elif hasattr(twin, k):
                    setattr(twin, k, v)
            return twin
        except Exception:
            pass
    return UserTwin(
        user_id=user_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        last_seen=datetime.now(timezone.utc).isoformat(),
    )


def save_twin(twin: UserTwin) -> None:
    twin.last_seen = datetime.now(timezone.utc).isoformat()
    path = _twin_path(twin.user_id)
    data = asdict(twin)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def record_emotion_event(user_id: str, emotion: str, symbol: str, detail: str) -> UserTwin:
    """Kullanıcı davranış olayını kaydet, twin güncelle."""
    twin = load_twin(user_id)
    event = BehaviorEvent(
        ts=datetime.now(timezone.utc).isoformat(),
        event_type=f"{emotion}_alert",
        symbol=symbol,
        detail=detail,
        emotion=emotion,
    )
    twin.events.append(event)
    twin.events = twin.events[-50:]  # Son 50 tut

    if emotion == "fomo":    twin.fomo_count += 1
    elif emotion == "panic": twin.panic_count += 1
    elif emotion == "revenge": twin.revenge_count += 1
    elif emotion == "overrisk": twin.overrisk_count += 1
    elif emotion == "neutral": twin.good_decisions += 1

    # Disiplin skoru güncelle
    total = twin.fomo_count + twin.panic_count + twin.revenge_count + twin.overrisk_count
    good  = twin.good_decisions
    all_events = max(total + good, 1)
    twin.discipline_score = round((good / all_events) * 100, 1)

    save_twin(twin)
    return twin


def get_twin_summary(user_id: str) -> dict:
    twin = load_twin(user_id)
    return {
        "user_id":          twin.user_id,
        "discipline_score": twin.discipline_score,
        "risk_label":       twin.risk_label(),
        "dominant_weakness":twin.dominant_weakness(),
        "coaching_note":    twin.coaching_note(),
        "fomo_count":       twin.fomo_count,
        "panic_count":      twin.panic_count,
        "revenge_count":    twin.revenge_count,
        "overrisk_count":   twin.overrisk_count,
        "good_decisions":   twin.good_decisions,
        "last_seen":        twin.last_seen,
        "recent_events":    [
            {"ts":e.ts,"type":e.event_type,"symbol":e.symbol,"detail":e.detail}
            for e in twin.events[-10:]
        ],
    }
