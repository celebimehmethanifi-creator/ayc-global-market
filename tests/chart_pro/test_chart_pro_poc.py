from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CHART_TERMINAL = ROOT / "apps" / "web" / "components" / "chart-pro" / "AYCChartTerminal.tsx"
DRAWING_HOOK = ROOT / "apps" / "web" / "components" / "chart-pro" / "hooks" / "useChartDrawings.ts"
INDICATOR_HOOK = ROOT / "apps" / "web" / "components" / "chart-pro" / "hooks" / "useChartIndicators.ts"
DRAWING_TOOLBAR = ROOT / "apps" / "web" / "components" / "chart-pro" / "DrawingToolbar.tsx"
PRO_CHART_ROUTE = ROOT / "apps" / "web" / "app" / "(app)" / "chart-pro" / "page.tsx"
PRO_SYMBOL_ROUTE = ROOT / "apps" / "web" / "app" / "(app)" / "chart-pro" / "[symbol]" / "page.tsx"
PROFESSIONAL_CHART = ROOT / "apps" / "web" / "components" / "ui" / "ProfessionalChart.tsx"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_chart_pro_overlay_tools_are_mapped_to_kline_overlays():
    text = read(CHART_TERMINAL)
    for marker in [
        'trendLine: { overlayName: "straightLine"',
        'horizontalLine: { overlayName: "horizontalStraightLine"',
        'verticalLine: { overlayName: "verticalStraightLine"',
        'rectangle: { overlayName: "priceChannelLine", partial: true }',
        'fibonacci: { overlayName: "fibonacciLine"',
        'text: { overlayName: "simpleAnnotation"',
        'entryLine: { overlayName: "priceLine"',
        'targetLine: { overlayName: "priceLine"',
        "chart.createOverlay(",
    ]:
        assert marker in text


def test_chart_pro_drawings_are_scoped_by_symbol_and_timeframe():
    text = read(DRAWING_HOOK)
    assert "d.symbol === symbol && d.timeframe === timeframe" in text
    assert "ayc_chart_drawings_v2" in text


def test_chart_pro_indicator_state_persists_with_scope_key():
    text = read(INDICATOR_HOOK)
    assert "ayc_chart_indicators_v1" in text
    assert "const scopeKey = useMemo(() => `${symbol.toUpperCase()}::${timeframe.toUpperCase()}`" in text
    assert "loadStored(scopeKey)" in text
    assert "saveStored(scopeKey, sanitized)" in text


def test_chart_pro_mobile_toolbar_is_collapsible():
    text = read(DRAWING_TOOLBAR)
    assert "isCompact = width <= 1024" in text
    assert "setCollapsed((v) => !v)" in text
    assert "PanelLeftOpen" in text and "PanelLeftClose" in text


def test_chart_pro_routes_are_limited_to_chart_pro_pages_and_fallback_chart_untouched():
    assert PRO_CHART_ROUTE.exists()
    assert PRO_SYMBOL_ROUTE.exists()
    assert PROFESSIONAL_CHART.exists()

