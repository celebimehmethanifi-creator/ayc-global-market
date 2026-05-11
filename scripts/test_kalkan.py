"""Unit tests for Kalkan algorithm — 4 rules"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "services", "ai-service"))

import pytest
from kalkan import run_kalkan


def _base_context():
    return {
        "asset": {"volatility_percentile": 50, "price": 100},
        "user": {"last_trade_age_minutes": 120, "trades_today": 2, "max_drawdown_pct": None},
        "portfolio": {"current_drawdown_pct": 5},
        "social": {"dominant_direction": "bullish", "dominant_pct": 30},
    }


def _run(asset=None, user=None, portfolio=None, social=None, direction="long"):
    ctx = _base_context()
    if asset:
        ctx["asset"].update(asset)
    if user:
        ctx["user"].update(user)
    if portfolio:
        ctx["portfolio"].update(portfolio)
    if social:
        ctx["social"].update(social)
    return run_kalkan(
        asset_data=ctx["asset"],
        user_data=ctx["user"],
        portfolio_data=ctx["portfolio"],
        social_data=ctx["social"],
        consensus_direction=direction,
    )


class TestKalkanRule1Timing:
    def test_high_volatility_triggers_soft(self):
        result = _run(asset={"volatility_percentile": 96})
        assert any("volatil" in r.lower() for r in result["reasons"])

    def test_normal_volatility_no_block(self):
        result = _run(asset={"volatility_percentile": 50})
        vola_reasons = [r for r in result["reasons"] if "volatil" in r.lower()]
        assert len(vola_reasons) == 0

    def test_fast_trade_triggers_soft(self):
        result = _run(user={"last_trade_age_minutes": 10})
        assert any("aceleci" in r.lower() or "dakika" in r.lower() for r in result["reasons"])


class TestKalkanRule2Emotional:
    def test_too_many_trades_triggers_soft(self):
        result = _run(user={"trades_today": 6})
        assert any("işlem" in r.lower() for r in result["reasons"])

    def test_five_trades_triggers(self):
        result = _run(user={"trades_today": 5})
        assert any("işlem" in r.lower() for r in result["reasons"])

    def test_four_trades_ok(self):
        result = _run(user={"trades_today": 4})
        trade_reasons = [r for r in result["reasons"] if "intikam" in r.lower() or "aşırı" in r.lower()]
        assert len(trade_reasons) == 0


class TestKalkanRule3DrawdownLock:
    def test_drawdown_exceeds_limit_hard_block(self):
        result = _run(user={"max_drawdown_pct": 10}, portfolio={"current_drawdown_pct": 10.5})
        assert result["blocked"] is True
        assert result["block_level"] == "hard"
        assert any("drawdown" in r.lower() or "kayıp" in r.lower() or "eşiği" in r.lower() for r in result["reasons"])

    def test_drawdown_below_limit_no_block(self):
        result = _run(user={"max_drawdown_pct": 15}, portfolio={"current_drawdown_pct": 8})
        assert result["block_level"] != "hard"

    def test_no_drawdown_limit_set(self):
        result = _run(user={"max_drawdown_pct": None}, portfolio={"current_drawdown_pct": 50})
        hard_reasons = [r for r in result["reasons"] if "kilitl" in r.lower()]
        assert len(hard_reasons) == 0


class TestKalkanRule4Contrarian:
    def test_contrarian_80pct_crowd_vs_ai(self):
        result = _run(social={"dominant_direction": "bullish", "dominant_pct": 82}, direction="short")
        assert any("contrarian" in r.lower() or "kitle" in r.lower() for r in result["reasons"])

    def test_same_direction_no_contrarian(self):
        result = _run(social={"dominant_direction": "bullish", "dominant_pct": 85}, direction="long")
        contrarian_reasons = [r for r in result["reasons"] if "contrarian" in r.lower()]
        assert len(contrarian_reasons) == 0

    def test_below_80pct_threshold(self):
        result = _run(social={"dominant_direction": "bullish", "dominant_pct": 75}, direction="short")
        contrarian_reasons = [r for r in result["reasons"] if "contrarian" in r.lower()]
        assert len(contrarian_reasons) == 0


class TestKalkanBlockLogic:
    def test_two_soft_reasons_triggers_block(self):
        # High volatility + too many trades
        result = _run(
            asset={"volatility_percentile": 97},
            user={"trades_today": 7},
        )
        assert result["blocked"] is True

    def test_one_soft_reason_no_block_but_warning(self):
        result = _run(asset={"volatility_percentile": 97})
        # One soft reason = warning, not block
        if len(result["reasons"]) == 1:
            assert result["blocked"] is False

    def test_hard_overrides_everything(self):
        # drawdown lock = always hard block regardless
        result = _run(
            user={"max_drawdown_pct": 5},
            portfolio={"current_drawdown_pct": 6},
        )
        assert result["blocked"] is True
        assert result["block_level"] == "hard"

    def test_clean_signal_passes(self):
        result = _run()
        # base context has no triggers
        assert result["blocked"] is False
        assert result["block_level"] == "none"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
