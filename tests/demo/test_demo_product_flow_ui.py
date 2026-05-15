from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]

PORTFOLIO_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "portfolio" / "page.tsx"
SIGNALS_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "signals" / "page.tsx"
DASHBOARD_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "dashboard" / "page.tsx"
SIGNALS_LIVE_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "signals" / "live" / "route.ts"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_portfolio_uses_demo_positions_and_has_empty_state():
    text = read_text(PORTFOLIO_PAGE)
    assert "demo.openTrades.map((trade)" in text
    assert "Henüz demo pozisyon yok" in text
    assert "Portföyü doldurmak için marketten veya varlık detayından demo işlem açın." in text


def test_portfolio_has_no_static_seed_positions():
    text = read_text(PORTFOLIO_PAGE)
    assert "const MOCK_POSITIONS" not in text
    assert 'symbol: "NVDA"' not in text
    assert 'symbol: "AAPL"' not in text
    assert 'symbol: "XAUUSD"' not in text


def test_signals_page_has_truthful_no_signal_and_no_mock_fallback():
    text = read_text(SIGNALS_PAGE)
    assert "MOCK_SIGNALS" not in text
    assert "feed_status: \"api_error\"" in text
    assert "Aktif sinyal yok. Piyasa verisi izleniyor." in text
    assert "LIVE FEED" not in text
    assert "sig.scores?.[key]||0" not in text


def test_signals_page_hides_score_bars_without_signal():
    text = read_text(SIGNALS_PAGE)
    assert "const showScores = signal.hasSignal && scoreEntries.length > 0;" in text
    assert "signal.signalStatus === \"insufficient_data\"" in text
    assert "No active signal yet. Market data is monitored." in text


def test_dashboard_filters_no_signal_entries_for_consistency():
    text = read_text(DASHBOARD_PAGE)
    assert "const fallbackSignals: Signal[] = process.env.NODE_ENV === \"development\" ? MOCK_SIGNALS : [];" in text
    assert "if (s.signalStatus === \"no_signal\" || s.signalStatus === \"insufficient_data\") return false;" in text
    assert "Aktif sinyal yok, piyasa izleniyor" in text


def test_signals_live_contract_exposes_truth_fields():
    text = read_text(SIGNALS_LIVE_ROUTE)
    assert "type SignalStatus = \"active\" | \"pending\" | \"blocked\" | \"no_signal\" | \"insufficient_data\";" in text
    assert "hasSignal" in text
    assert "signalStatus" in text
    assert "feed_status" in text
    assert "stage_counts" in text
