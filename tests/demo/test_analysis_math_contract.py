from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ANALYSIS_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "assets" / "[symbol]" / "analysis" / "route.ts"
ASSET_DETAIL_MODAL = ROOT / "apps" / "web" / "components" / "ui" / "AssetDetailModal.tsx"
AI_TRADE_MODAL = ROOT / "apps" / "web" / "components" / "ui" / "AITradeModal.tsx"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_analysis_contract_has_entry_and_target_back_compat_fields():
    text = read_text(ANALYSIS_ROUTE)
    assert "entry: analysisEntryPrice" in text
    assert "entryPrice: analysisEntryPrice" in text
    assert "target: null as number | null" in text
    assert "targetPrice: null as number | null" in text
    assert "analysisEntryPrice: tradePlan.analysisEntryPrice ?? null" in text
    assert "priceBasis" in text


def test_risk_reward_is_formula_based_not_fixed_literal():
    text = read_text(ANALYSIS_ROUTE)
    assert "const risk = direction === \"LONG\" ? entry - stopLoss : stopLoss - entry;" in text
    assert "const reward = direction === \"LONG\" ? targetPrice - entry : entry - targetPrice;" in text
    assert "const riskRewardRaw = reward / risk;" in text
    assert "risk <= 0" in text or "risk > 0" in text
    assert "reward <= 0" in text or "reward > 0" in text
    assert "riskReward: roundOrNull(riskReward, 2)" in text
    assert "riskReward: 1.85" not in text
    assert "rr: 1.85" not in text


def test_target_stop_and_rr_are_null_in_insufficient_or_invalid_paths():
    text = read_text(ANALYSIS_ROUTE)
    assert "reason: \"INSUFFICIENT_DATA\"" in text
    assert "targetPrice: null as number | null" in text
    assert "stopLoss: null as number | null" in text
    assert "riskReward: null as number | null" in text
    assert "reason: \"RISK_REWARD_INVALID\"" in text


def test_no_data_user_facing_fields_do_not_leak_raw_provider_error_strings():
    text = read_text(ANALYSIS_ROUTE)
    assert "stooq:error" not in text
    assert "yahoo:error" not in text
    assert "twelvedata:error" not in text
    assert "alphavantage:error" not in text
    assert "Güvenilir mum verisi olmadığı için teknik analiz üretilemedi." in text
    assert "Veri kapsamı yetersiz olduğu için temel değerlendirme sınırlıdır." in text


def test_asset_detail_modal_uses_normalized_target_and_honest_risk_reward_ui():
    text = read_text(ASSET_DETAIL_MODAL)
    assert "analysis?.tradePlan?.targetPrice ?? analysis?.tradePlan?.target ?? null" in text
    assert "analysisEntryPrice" in text
    assert "riskRewardUnavailableText" in text
    assert "MACD verisi yetersiz" in text
    assert "Hesap temeli:" in text
    assert "Üst fiyat canlı veridir; grafik son mum kapanışını gösterir." in text


def test_quick_analysis_modal_discloses_short_horizon_model_basis():
    text = read_text(AI_TRADE_MODAL)
    assert "24s hızlı analiz" in text
    assert "Kural tabanlı demo senaryo" in text
    assert "Model R/R" in text
