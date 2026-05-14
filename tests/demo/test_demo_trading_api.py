from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
WEB_API_DIR = ROOT / "apps" / "web" / "app" / "api" / "v1"

DEMO_LIB = WEB_API_DIR / "_lib" / "demo-trading.ts"
DEMO_ACCOUNT = WEB_API_DIR / "demo" / "account" / "route.ts"
DEMO_BALANCE = WEB_API_DIR / "demo" / "balance" / "route.ts"
DEMO_POSITIONS = WEB_API_DIR / "demo" / "positions" / "route.ts"
DEMO_HISTORY = WEB_API_DIR / "demo" / "history" / "route.ts"
DEMO_ORDER = WEB_API_DIR / "demo" / "order" / "route.ts"
DEMO_CLOSE = WEB_API_DIR / "demo" / "close" / "route.ts"
DEMO_RESET = WEB_API_DIR / "demo" / "reset" / "route.ts"
DEMO_CONTEXT = ROOT / "apps" / "web" / "lib" / "demo" / "DemoContext.tsx"
EXCHANGE_ORDER = WEB_API_DIR / "exchange" / "order" / "route.ts"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_demo_endpoints_exist():
    for path in [
        DEMO_ACCOUNT,
        DEMO_BALANCE,
        DEMO_POSITIONS,
        DEMO_HISTORY,
        DEMO_ORDER,
        DEMO_CLOSE,
        DEMO_RESET,
    ]:
        assert path.exists(), f"Missing endpoint file: {path}"


def test_demo_lib_contains_default_balance_and_validation_guards():
    text = read_text(DEMO_LIB)
    assert "const DEMO_DEFAULT_BALANCE = 10_000;" in text
    assert "side LONG veya SHORT olmalı." in text
    assert "Geçerli notional girin." in text
    assert "Bu varlık için demo işlem fiyatı alınamadı." in text
    assert "Kaldıraç 1 ile ${maxAllowedLeverage} arasında olmalıdır." in text
    assert "Leverage must be between 1 and ${maxAllowedLeverage}." in text
    assert "demo state is stored in-memory" in text.lower()


def test_demo_lib_rejects_invalid_math_and_enforces_account_formulas():
    text = read_text(DEMO_LIB)
    assert "availableBalance = record.account.balance + realizedPnL - usedMargin" in text
    assert "equity = record.account.balance + realizedPnL + openPnL" in text
    assert "if (!Number.isFinite(quantity) || quantity <= 0)" in text
    assert "if (notional > record.account.availableBalance)" in text
    assert "const leverage = Number(b.leverage);" in text
    assert "if (!Number.isFinite(leverage) || leverage < 1 || leverage > maxAllowedLeverage)" in text


def test_demo_close_writes_history_and_returns_trade_payload():
    text = read_text(DEMO_LIB)
    assert "const reason = String(b.reason || \"\").trim() || \"manual_close\";" in text
    assert "const historyItem: DemoTradeHistory =" in text
    assert "record.history.unshift(historyItem);" in text
    assert "trade: historyItem," in text
    assert "historyItem," in text
    assert "quantity: position.quantity," in text
    assert "leverage: position.leverage," in text
    assert "marginUsed: position.marginUsed," in text


def test_demo_close_realized_pnl_and_percent_are_finite_and_formula_based():
    text = read_text(DEMO_LIB)
    assert "function computeRealizedPnlPct(" in text
    assert "((exitPrice - entryPrice) / entryPrice) * leverage * 100" in text
    assert "((entryPrice - exitPrice) / entryPrice) * leverage * 100" in text
    assert "const realizedPnL = Number.isFinite(realizedPnLRaw) ? realizedPnLRaw : 0;" in text
    assert "const realizedPnLPct = Number.isFinite(realizedPnLPctRaw) ? realizedPnLPctRaw : 0;" in text


def test_demo_order_flow_does_not_call_real_exchange_order_endpoint():
    demo_order_text = read_text(DEMO_ORDER)
    demo_lib_text = read_text(DEMO_LIB)
    exchange_text = read_text(EXCHANGE_ORDER)

    assert "/exchange/order" not in demo_order_text
    assert "binanceOrder(" not in demo_lib_text
    assert "mode: \"paper\"" in exchange_text
    assert "REAL_TRADING_DISABLED" in exchange_text


def test_demo_context_is_api_first_with_local_fallback():
    text = read_text(DEMO_CONTEXT)
    assert "webApi.get(\"/demo/account\"" in text
    assert "\"/demo/order\"" in text
    assert "\"/demo/close\"" in text
    assert "\"/demo/reset\"" in text
    assert "source: \"api\" | \"local-fallback\"" in text
    assert "Demo servisine erisilemedi. Yerel fallback kullaniliyor." in text


def test_demo_history_route_returns_closed_trades():
    text = read_text(DEMO_HISTORY)
    assert "history: record.history" in text
    assert "count: record.history.length" in text
