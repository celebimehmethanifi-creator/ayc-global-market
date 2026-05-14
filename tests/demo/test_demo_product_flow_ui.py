from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PORTFOLIO_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "portfolio" / "page.tsx"
TRADES_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "trades" / "page.tsx"
DEMO_CONTEXT = ROOT / "apps" / "web" / "lib" / "demo" / "DemoContext.tsx"
AI_TRADE_MODAL = ROOT / "apps" / "web" / "components" / "ui" / "AITradeModal.tsx"
COMMAND_PALETTE = ROOT / "apps" / "web" / "components" / "ui" / "CommandPalette.tsx"
GLOBAL_CSS = ROOT / "apps" / "web" / "app" / "globals.css"
SIGNALS_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "signals" / "page.tsx"
DASHBOARD_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "dashboard" / "page.tsx"
SIGNAL_NORMALIZE = ROOT / "apps" / "web" / "lib" / "signals" / "normalize.ts"
ASSET_DETAIL_MODAL = ROOT / "apps" / "web" / "components" / "ui" / "AssetDetailModal.tsx"
PRO_CHART = ROOT / "apps" / "web" / "components" / "ui" / "ProfessionalChart.tsx"
ANALYSIS_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "assets" / "[symbol]" / "analysis" / "route.ts"
SCENARIO_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "scenario" / "page.tsx"
SCENARIO_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "intelligence" / "scenario" / "route.ts"
ALARMS_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "alarms" / "page.tsx"
TR_DICT = ROOT / "apps" / "web" / "lib" / "i18n" / "dictionaries" / "tr.json"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_portfolio_is_demo_state_driven_and_not_mock_driven():
    text = read_text(PORTFOLIO_PAGE)
    assert "demo.openTrades.map" in text
    assert "MOCK" not in text
    assert "Henüz demo pozisyon yok" in text
    assert "Portföy, demo işlemlerinizden otomatik oluşturulur." in text


def test_portfolio_custom_symbol_warning_is_honest():
    text = read_text(PORTFOLIO_PAGE)
    assert "canlı piyasa verisi bulunamadı" in text
    assert "Özel takip kaydı olarak ekleyebilirsiniz" in text
    assert "AI analizi sınırlı olabilir" in text


def test_demo_trade_modal_includes_leverage_margin_and_safety_copy():
    text = read_text(AI_TRADE_MODAL)
    assert "Kaldıraç (1-10)" in text
    assert "Tahmini Marjin" in text
    assert "Gerçek emir gönderilmez" in text
    assert "openTrade(symbol, name, dir, livePrice, amt, {" in text


def test_demo_context_is_api_first_and_notifies_fallback():
    text = read_text(DEMO_CONTEXT)
    assert 'webApi.get("/demo/account"' in text
    assert 'source: "api" | "local-fallback"' in text
    assert "Demo servisine erisilemedi. Yerel fallback kullaniliyor." in text


def test_trades_page_copy_and_balance_are_consistent():
    text = read_text(TRADES_PAGE)
    assert "Kullanılabilir:" in text
    assert "demo.availableBalance" in text
    assert "Gerçek emir gönderilmez" in text


def test_command_palette_mobile_has_structured_rows_and_no_mobile_shortcut_hint():
    text = read_text(COMMAND_PALETTE)
    assert "const { isMobile } = useBreakpoint();" in text
    assert "{!isMobile && (" in text
    assert 'className="cmd-item-text"' in text
    assert 'className="cmd-item-sub"' in text


def test_command_palette_css_has_mobile_safe_spacing():
    text = read_text(GLOBAL_CSS)
    assert ".cmd-item-text" in text
    assert ".cmd-item-sub" in text
    assert ".cmd-box" in text


def test_signals_page_uses_shared_normalization_and_no_signal_state_hides_metric_bars():
    text = read_text(SIGNALS_PAGE)
    assert 'from "@/lib/signals/normalize"' in text
    assert "hasMeaningfulSignal" in text
    assert "isNoSignal" in text
    assert "Bu varlık için aktif sinyal yok. Son fiyat hareketi izleniyor." in text
    assert "{!isNoSignal && (" in text


def test_dashboard_and_signals_use_same_live_signal_contract():
    dashboard = read_text(DASHBOARD_PAGE)
    signals = read_text(SIGNALS_PAGE)
    normalize = read_text(SIGNAL_NORMALIZE)

    assert "/signals/live?market=all&limit=15" in dashboard
    assert "/signals/live?market=all&limit=15" in signals
    assert "normalizeSignalsPayload" in dashboard
    assert "normalizeSignalsPayload" in signals
    assert "const activeSignals = signals.filter" in dashboard
    assert "stage !== \"NONE\"" in signals
    assert "buildStageCounts" in normalize


def test_no_data_assets_hide_raw_provider_errors_and_disable_demo_trade():
    modal = read_text(ASSET_DETAIL_MODAL)
    chart = read_text(PRO_CHART)

    assert "Fiyat verisi olmadığı için demo işlem açılamaz." in modal
    assert "Bu varlık için güvenilir mum verisi alınamadı." in chart
    assert "Sağlayıcı kapsaması yetersiz veya lisanslı veri gerekli." in chart
    assert "NEXT_PUBLIC_DEBUG_PROVIDER_ATTEMPTS === \"1\"" in chart


def test_analysis_transparency_and_risk_reward_guard_are_explicit():
    text = read_text(ANALYSIS_ROUTE)
    assert "Fiyat verisi mevcut; mum verisi yetersiz." in text
    assert "Güvenilir mum verisi olmadığı için teknik analiz üretilemedi." in text
    assert "reason: riskReward == null ? \"RISK_REWARD_INVALID\" : null" in text
    assert "risk > 0 && reward > 0" in text


def test_scenario_keeps_insufficient_data_guard_and_no_fake_plan():
    page = read_text(SCENARIO_PAGE)
    route = read_text(SCENARIO_ROUTE)

    assert "Bu varlık için güvenilir senaryo üretilemedi" in page
    assert "Geçerli miktar girin" in page
    assert "if (dataQuality === \"insufficient\")" in route
    assert "scenarios: []" in route


def test_tr_shell_dictionary_is_localized_for_core_navigation_labels():
    text = read_text(TR_DICT)
    assert '"nav.portfolio": "Portföy"' in text
    assert '"auth.login": "Giriş Yap"' in text
    assert '"auth.signup": "Kayıt Ol"' in text
    assert '"bottom.command": "Komuta"' in text
    assert '"bottom.market": "Piyasa"' in text
    assert '"bottom.signal": "Sinyal"' in text
    assert '"nav.profile": "Profil"' in text


def test_alarm_ui_has_human_readable_copy_and_no_raw_json_or_blogu_typo():
    text = read_text(ALARMS_PAGE)
    assert "Kalkan Bloke" in text
    assert "KALKAN BLOGU" not in text
    assert "Kalkan Blogu" not in text
    assert "JSON.stringify(c)" not in text
    assert "contrarian uyarı aktif" in text
    assert "Koşul: Kalabalık yönü aşırı" in text


def test_chart_fullscreen_has_mobile_resize_orientation_and_hint_guards():
    text = read_text(PRO_CHART)
    assert "window.addEventListener(\"orientationchange\", updateViewport);" in text
    assert "window.visualViewport?.addEventListener(\"resize\", updateViewport);" in text
    assert "window.addEventListener(\"orientationchange\", syncCanvasSize);" in text
    assert "Daha geniş görünüm için telefonu yatay çevirin" in text
    assert "pointerEvents: 'none'" in text
