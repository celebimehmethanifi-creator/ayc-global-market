"""Signal Scorer — computes R/R, filters by confidence, builds strategy cards"""
from __future__ import annotations
from decimal import Decimal


MIN_CONFIDENCE = 70.0
MIN_RISK_REWARD = 1.5


class SignalScorer:
    def passes_filter(self, signal: dict) -> bool:
        if float(signal.get("confidence", 0)) < MIN_CONFIDENCE:
            return False
        if signal.get("kalkan_block"):
            return False
        entry = float(signal.get("entry_price") or 0)
        target = float(signal.get("target_price") or 0)
        stop = float(signal.get("stop_loss") or 0)
        if entry <= 0 or target <= 0 or stop <= 0:
            return False
        rr = abs(target - entry) / max(abs(entry - stop), 1e-8)
        if rr < MIN_RISK_REWARD:
            return False
        return True

    def build_strategy_card(self, signal: dict, symbol: str) -> dict:
        entry = float(signal.get("entry_price", 0))
        target = float(signal.get("target_price", 0))
        stop = float(signal.get("stop_loss", 0))
        direction = signal.get("direction", "neutral")

        risk_pct = abs(entry - stop) / max(entry, 1e-8)
        reward_pct = abs(target - entry) / max(entry, 1e-8)
        rr = reward_pct / max(risk_pct, 1e-8)

        # Partial exit strategy
        target2 = entry + (target - entry) * 1.618 if direction == "long" else entry - (entry - target) * 1.618

        # Entry timing (simplified: suggest range)
        entry_timing = {
            "suggested_window": "Piyasa açılışından 30 dakika sonra",
            "avoid": "İlk 15 dakika ve son 15 dakika",
            "pattern_basis": "Historical open range breakout",
        }

        exit_strategy = {
            "target1_exit_pct": 50,
            "target2_exit_pct": 50,
            "trailing_stop_activation": f"%{reward_pct*50:.1f} kârda trailing stop aktif",
            "hard_stop": f"Stop-loss: {stop:.4f}",
        }

        return {
            "signal_id": signal.get("id"),
            "asset_id": signal.get("asset_id"),
            "symbol": symbol,
            "direction": direction,
            "entry_price": round(entry, 4),
            "target1": round(target, 4),
            "target2": round(target2, 4),
            "stop_loss": round(stop, 4),
            "risk_reward": round(rr, 2),
            "risk_amount_per_100": round(risk_pct * 100, 2),
            "reward_amount_per_100": round(reward_pct * 100, 2),
            "entry_timing": entry_timing,
            "exit_strategy": exit_strategy,
            "disclaimer": "Bu içerik yatırım tavsiyesi değildir. Geçmiş performans gelecek sonuçları garanti etmez.",
        }
