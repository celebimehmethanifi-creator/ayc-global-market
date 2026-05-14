from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PORTFOLIO_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "portfolio" / "page.tsx"
TRADES_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "trades" / "page.tsx"
DEMO_CONTEXT = ROOT / "apps" / "web" / "lib" / "demo" / "DemoContext.tsx"
AI_TRADE_MODAL = ROOT / "apps" / "web" / "components" / "ui" / "AITradeModal.tsx"
COMMAND_PALETTE = ROOT / "apps" / "web" / "components" / "ui" / "CommandPalette.tsx"
SIGNALS_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "signals" / "page.tsx"
COPILOT_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "copilot" / "page.tsx"
GLOBAL_CSS = ROOT / "apps" / "web" / "app" / "globals.css"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_portfolio_is_demo_state_driven_and_not_mock_driven():
    text = read_text(PORTFOLIO_PAGE)
    assert "demo.openTrades.map" in text
    assert "MOCK" not in text
    assert "/portfolio/positions" not in text
    assert "Henüz demo pozisyon yok" in text


def test_portfolio_custom_symbol_warning_is_honest():
    text = read_text(PORTFOLIO_PAGE)
    assert "canlı piyasa verisi bulunamadı" in text
    assert "Özel takip kaydı olarak ekleyebilirsiniz" in text
    assert "AI analizi sınırlı olabilir" in text


def test_demo_trade_modal_includes_leverage_and_margin_summary():
    text = read_text(AI_TRADE_MODAL)
    assert "Kaldıraç (1-10)" in text
    assert "Tahmini Marjin" in text
    assert "Gerçek emir gönderilmez" in text
    assert "openTrade(symbol, name, dir, livePrice, amt, {" in text


def test_demo_context_open_trade_accepts_options_payload():
    text = read_text(DEMO_CONTEXT)
    assert "options?: {" in text
    assert "leverage?: number;" in text
    assert "stopLoss?: number | null;" in text
    assert "takeProfit?: number | null;" in text


def test_trades_page_uses_available_balance_copy_for_consistency():
    text = read_text(TRADES_PAGE)
    assert "Kullanılabilir:" in text
    assert "demo.availableBalance" in text
    assert "Gerçek emir gönderilmez" in text


def test_command_palette_mobile_hides_keyboard_hints_and_has_structured_rows():
    text = read_text(COMMAND_PALETTE)
    assert "const { isMobile } = useBreakpoint();" in text
    assert "{!isMobile && (" in text
    assert "className=\"cmd-item-text\"" in text
    assert "className=\"cmd-item-sub\"" in text


def test_command_palette_css_has_mobile_safe_row_spacing():
    text = read_text(GLOBAL_CSS)
    assert ".cmd-item-text" in text
    assert ".cmd-item-sub" in text
    assert ".cmd-footer" in text
    assert ".cmd-box" in text


def test_signals_page_avoids_fake_zero_metric_bars_in_no_signal_state():
    text = read_text(SIGNALS_PAGE)
    assert "function hasMeaningfulSignal" in text
    assert "isNoSignal" in text
    assert "Bu varlık için aktif sinyal yok. Son fiyat hareketi izleniyor." in text
    assert "{!isNoSignal && (" in text


def test_copilot_page_has_mobile_safe_area_padding_for_input():
    text = read_text(COPILOT_PAGE)
    assert "env(safe-area-inset-bottom, 0px)" in text
    assert "padding-bottom:calc(72px + env(safe-area-inset-bottom, 0px))" in text
