from __future__ import annotations

import importlib.util
import sys
import uuid
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
GATEWAY_DIR = ROOT / "services" / "gateway"

WEB_LOGIN_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "auth" / "login" / "route.ts"
WEB_DEV_AUTH = ROOT / "apps" / "web" / "app" / "api" / "v1" / "_lib" / "dev-auth.ts"
WEB_AUTH_LIB = ROOT / "apps" / "web" / "app" / "api" / "v1" / "_lib" / "auth.ts"
WEB_QUERY_PROVIDER = ROOT / "apps" / "web" / "lib" / "query-provider.tsx"
WEB_API_EXPORT = ROOT / "apps" / "web" / "lib" / "api.ts"
WEB_BILLING_VERIFY = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "verify" / "route.ts"
WEB_BILLING_CHECKOUT = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "checkout" / "route.ts"
WEB_BILLING_WEBHOOK = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "webhook" / "route.ts"
WEB_SUBSCRIBE_SUCCESS = ROOT / "apps" / "web" / "app" / "(app)" / "subscribe" / "success" / "page.tsx"
WEB_AUTH_ME = ROOT / "apps" / "web" / "app" / "api" / "v1" / "auth" / "me" / "route.ts"
WEB_AUTH_LOGIN = ROOT / "apps" / "web" / "app" / "api" / "v1" / "auth" / "login" / "route.ts"
WEB_AUTH_REGISTER = ROOT / "apps" / "web" / "app" / "api" / "v1" / "auth" / "register" / "route.ts"
WEB_EXCHANGE_ORDER = ROOT / "apps" / "web" / "app" / "api" / "v1" / "exchange" / "order" / "route.ts"
WEB_EXCHANGE_BALANCE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "exchange" / "balance" / "route.ts"
WEB_EXCHANGE_TEST = ROOT / "apps" / "web" / "app" / "api" / "v1" / "exchange" / "test" / "route.ts"
WEB_BROKERS_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "brokers" / "page.tsx"
WEB_EXCHANGES_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "exchanges" / "page.tsx"
WEB_HEALTH_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "health" / "route.ts"
WEB_HEALTH_PROVIDERS = ROOT / "apps" / "web" / "app" / "api" / "v1" / "health" / "providers" / "route.ts"
WEB_OHLCV_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "ohlcv" / "[symbol]" / "route.ts"
WEB_ASSET_ANALYSIS_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "assets" / "[symbol]" / "analysis" / "route.ts"
WEB_PROFILE_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "profile" / "page.tsx"
WEB_MARKET_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "market" / "page.tsx"
WEB_MARKETS_ALIAS_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "markets" / "page.tsx"
WEB_SCENARIO_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "scenario" / "page.tsx"
WEB_SOCIAL_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "social" / "page.tsx"
WEB_DASHBOARD_PAGE = ROOT / "apps" / "web" / "app" / "(app)" / "dashboard" / "page.tsx"
WEB_SIGNIN_PAGE = ROOT / "apps" / "web" / "app" / "(auth)" / "signin" / "page.tsx"
WEB_SIGNUP_PAGE = ROOT / "apps" / "web" / "app" / "(auth)" / "signup" / "page.tsx"
WEB_PROFESSIONAL_CHART = ROOT / "apps" / "web" / "components" / "ui" / "ProfessionalChart.tsx"
WEB_COMMAND_PALETTE = ROOT / "apps" / "web" / "components" / "ui" / "CommandPalette.tsx"
WEB_ASSET_DETAIL_MODAL = ROOT / "apps" / "web" / "components" / "ui" / "AssetDetailModal.tsx"
WEB_ASSET_UNIVERSE = ROOT / "apps" / "web" / "lib" / "markets" / "asset-universe.ts"
WEB_MIDDLEWARE = ROOT / "apps" / "web" / "middleware.ts"
WEB_VERCEL_SETUP = ROOT / "apps" / "web" / "VERCEL_ENV_SETUP.txt"
ENV_EXAMPLE = ROOT / ".env.example"
PNPM_WORKSPACE = ROOT / "pnpm-workspace.yaml"
MOBILE_API_CLIENT = ROOT / "apps" / "mobile" / "src" / "api" / "client.ts"
MOBILE_APP_ROOT = ROOT / "apps" / "mobile"
AI_SERVICE_MAIN = ROOT / "services" / "ai-service" / "main.py"
DATA_SERVICE_MAIN = ROOT / "services" / "data-service" / "main.py"
SIGNAL_SERVICE_MAIN = ROOT / "services" / "signal-service" / "main.py"
DATA_MARKET_PROXY = ROOT / "services" / "data-service" / "market_proxy.py"

GATEWAY_AUTH = GATEWAY_DIR / "auth_service.py"
GATEWAY_BILLING = GATEWAY_DIR / "billing_router.py"


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def load_module_from_path(module_path: Path):
    module_name = f"_test_module_{module_path.stem}_{uuid.uuid4().hex}"
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def test_web_login_has_no_hardcoded_master_or_test_accounts():
    text = read_text(WEB_LOGIN_ROUTE).lower()
    forbidden_markers = [
        "master@",
        "test@",
        "admin@",
        "demo@",
        "qa@",
    ]
    for marker in forbidden_markers:
        assert marker not in text
    assert "getdevseeduser" in text


def test_web_dev_seed_is_explicitly_non_production_only():
    text = read_text(WEB_DEV_AUTH)
    assert 'if (process.env.NODE_ENV === "production") return null;' in text


def test_web_jwt_secret_has_no_fallback_and_has_min_length_check():
    text = read_text(WEB_AUTH_LIB)
    assert "JWT_SECRET environment variable is required" in text
    assert "MIN_SECRET_LENGTH = 32" in text
    assert "JWT_SECRET must be at least" in text


def test_gateway_auth_service_fails_when_secret_missing_in_production(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.syspath_prepend(str(GATEWAY_DIR))
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(RuntimeError, match="SECRET_KEY environment variable is required"):
        load_module_from_path(GATEWAY_AUTH)


def test_gateway_invalid_token_is_rejected(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.syspath_prepend(str(GATEWAY_DIR))
    monkeypatch.setenv("SECRET_KEY", "this_is_a_test_secret_with_minimum_32_chars")
    monkeypatch.setenv("ENVIRONMENT", "test")

    module = load_module_from_path(GATEWAY_AUTH)
    with pytest.raises(module.HTTPException) as exc:
        module.decode_access_token("invalid.token.value")
    assert exc.value.status_code == 401


def test_billing_verify_is_blocked_in_production_for_web_and_gateway():
    web_text = read_text(WEB_BILLING_VERIFY)
    assert "if (IS_PRODUCTION && !verified)" in web_text
    assert "Demo aktivasyon production'da kapali" in web_text

    gateway_text = read_text(GATEWAY_BILLING)
    assert "if IS_PRODUCTION:" in gateway_text
    assert "Manual verify production ortaminda kapali" in gateway_text


def test_billing_webhook_signature_checks_are_enforced():
    web_text = read_text(WEB_BILLING_WEBHOOK)
    assert "verifySignature" in web_text
    assert "Webhook secret zorunlu" in web_text
    assert "saveUser" in web_text
    assert "activatePlanFromWebhook" in web_text

    gateway_text = read_text(GATEWAY_BILLING)
    assert "hmac.compare_digest" in gateway_text
    assert "webhook imzasi" in gateway_text


def test_billing_checkout_sends_custom_user_identity_data():
    text = read_text(WEB_BILLING_CHECKOUT)
    assert "user_id" in text
    assert "email: userEmail" in text
    assert "plan" in text
    assert "payload.sub" in text


def test_subscribe_success_page_uses_state_machine_and_does_not_blindly_verify():
    text = read_text(WEB_SUBSCRIBE_SUCCESS)
    assert "type VerifyStatus = \"verifying\" | \"verified\" | \"failed\" | \"pending\";" in text
    assert "if (!session_id)" in text
    assert "setStatus(\"pending\")" in text
    assert "setVerified(true)" not in text
    assert "statusCode === 400 || statusCode === 403" in text
    assert "updateCachedTier" in text


def test_auth_me_prefers_persisted_user_plan():
    text = read_text(WEB_AUTH_ME)
    assert "const resolvedPlan = persisted?.plan || payload.plan || \"free\";" in text
    assert "tier: resolvedPlan" in text
    assert "plan: resolvedPlan" in text
    assert "export async function PUT" in text
    assert "risk_level" in text
    assert "max_drawdown_pct" in text


def test_signup_and_login_set_auth_cookies_and_auth_me_route_exists():
    login_text = read_text(WEB_AUTH_LOGIN)
    register_text = read_text(WEB_AUTH_REGISTER)
    auth_me_text = read_text(WEB_AUTH_ME)

    assert "setAuthCookies(res, accessToken, refreshToken)" in login_text
    assert "setAuthCookies(res, accessToken, refreshToken)" in register_text
    assert "getUserFromAuthHeader" in auth_me_text
    assert "return NextResponse.json({" in auth_me_text


def test_api_client_keeps_cookie_session_endpoints_same_origin():
    text = read_text(WEB_QUERY_PROVIDER)
    api_export_text = read_text(WEB_API_EXPORT)

    assert "const SAME_ORIGIN_API_BASE = \"/api/v1\";" in text
    assert "export const webApi = axios.create({" in text
    assert "baseURL: SAME_ORIGIN_API_BASE" in text
    assert "export const api = webApi;" in text
    assert "externalApi" in api_export_text


def test_exchange_connect_ui_is_disabled_in_production():
    brokers_text = read_text(WEB_BROKERS_PAGE)
    exchanges_text = read_text(WEB_EXCHANGES_PAGE)
    exchange_test_text = read_text(WEB_EXCHANGE_TEST)

    assert "const IS_PRODUCTION = process.env.NODE_ENV === \"production\";" in brokers_text
    assert (
        ("Productionda Kapali" in brokers_text)
        or ("Production'da Kapalı" in brokers_text)
        or ("Production’da Kapalı" in brokers_text)
    )
    assert "const IS_PRODUCTION = process.env.NODE_ENV === \"production\";" in exchanges_text
    assert ("Productionda Kapali" in exchanges_text) or ("Production'da Kapalı" in exchanges_text)
    assert "Production ortaminda istemciden dogrudan API secret onboarding kapali." in exchange_test_text


def test_refresh_store_warning_is_exposed_in_health_and_docs():
    auth_lib_text = read_text(WEB_AUTH_LIB)
    health_text = read_text(WEB_HEALTH_ROUTE)
    vercel_text = read_text(WEB_VERCEL_SETUP)

    assert "getAuthRuntimeWarnings" in auth_lib_text
    assert "Refresh sessions are stored in-memory" in auth_lib_text
    assert "warnings: authWarnings" in health_text
    assert "rotation state su an in-memory tutulur" in vercel_text


def test_domain_strategy_is_canonical_apex_with_optional_app_alias_redirect():
    middleware_text = read_text(WEB_MIDDLEWARE)
    vercel_text = read_text(WEB_VERCEL_SETUP)
    env_text = read_text(ENV_EXAMPLE)

    assert 'const CANONICAL_DOMAIN = "aycmarket.com";' in middleware_text
    assert 'const APP_ALIAS_DOMAIN = "app.aycmarket.com";' in middleware_text
    assert 'const WWW_DOMAIN = "www.aycmarket.com";' in middleware_text
    assert 'const BLOG_DOMAIN = "blog.aycmarket.com";' in middleware_text
    assert "url.pathname = \"/coming-soon\"" not in middleware_text
    assert "APP_ALIAS_REDIRECT" in middleware_text
    assert "www -> apex" in middleware_text

    assert "NEXT_PUBLIC_SITE_URL=<https://aycmarket.com>" in vercel_text
    assert "APP_ALIAS_REDIRECT=<0-or-1>" in vercel_text
    assert "NEXT_PUBLIC_SITE_URL=<https://aycmarket.com>" in env_text
    assert "APP_ALIAS_REDIRECT=<0-or-1>" in env_text


def test_internal_services_cors_are_not_wildcard_in_production():
    for path in [AI_SERVICE_MAIN, DATA_SERVICE_MAIN, SIGNAL_SERVICE_MAIN, DATA_MARKET_PROXY]:
        text = read_text(path)
        assert "allow_origins=[\"*\"]" not in text
        assert "CORS_ORIGINS must be configured in production." in text


def test_lemon_variant_env_names_are_standardized():
    env_text = read_text(ENV_EXAMPLE)
    gateway_text = read_text(GATEWAY_BILLING)

    assert "LEMON_PRO_VARIANT_ID" in env_text
    assert "LEMON_ELITE_VARIANT_ID" in env_text
    assert "LEMON_VARIANT_PRO" not in env_text
    assert "LEMON_VARIANT_ELITE" not in env_text

    assert "LEMON_PRO_VARIANT_ID" in gateway_text
    assert "LEMON_ELITE_VARIANT_ID" in gateway_text
    assert "or os.environ.get(\"LEMON_VARIANT_PRO\", \"\").strip()" in gateway_text


def test_exchange_order_is_guarded_in_production_and_requires_auth():
    order_text = read_text(WEB_EXCHANGE_ORDER)
    assert "const IS_PRODUCTION = process.env.NODE_ENV === \"production\";" in order_text
    assert "REAL_TRADING_DISABLED" in order_text
    assert 'mode: "paper"' in order_text
    assert "if (!user)" in order_text
    assert "Yetkisiz" in order_text



def test_exchange_balance_and_order_require_authentication():
    balance_text = read_text(WEB_EXCHANGE_BALANCE)
    assert "if (!user)" in balance_text
    assert "Yetkisiz" in balance_text

    order_text = read_text(WEB_EXCHANGE_ORDER)
    assert "if (!user)" in order_text
    assert "Yetkisiz" in order_text


def test_web_smoke_pages_exist_for_signup_login_dashboard():
    assert (ROOT / "apps" / "web" / "app" / "(auth)" / "signup" / "page.tsx").exists()
    assert (ROOT / "apps" / "web" / "app" / "(auth)" / "signin" / "page.tsx").exists()
    assert (ROOT / "apps" / "web" / "app" / "(app)" / "dashboard" / "page.tsx").exists()


def test_markets_alias_route_redirects_to_market_page():
    text = read_text(WEB_MARKETS_ALIAS_PAGE)
    assert "redirect(\"/market\")" in text


def test_dashboard_uses_live_alarm_feed_and_dynamic_market_pulse():
    text = read_text(WEB_DASHBOARD_PAGE)
    assert 'queryKey: ["dashboard-alarms", tick]' in text
    assert "MOCK_ALARMS.map" not in text
    assert "computeMarketPulse(signals, movers)" in text
    assert "EMPTY_ALARM_HINT" in text
    assert "Market Nabzı" in text
    assert "Veri: {dataStatus}" in text


def test_professional_chart_supports_fullscreen_controls_and_escape_close():
    text = read_text(WEB_PROFESSIONAL_CHART)
    assert "setIsFullscreen(true)" in text
    assert "closeFullscreen" in text
    assert 'e.key === "Escape"' in text
    assert "chart-fullscreen" in text
    assert "screen.orientation" in text
    assert "createPortal" in text
    assert "requestFullscreen" in text


def test_professional_chart_uses_zoom_view_window_for_draw_and_pan():
    text = read_text(WEB_PROFESSIONAL_CHART)
    assert "endIdx = clamp(viewEnd || n" in text
    assert "startIdx = Math.max(0, endIdx - visible)" in text
    assert "candles.slice(startIdx, endIdx)" in text
    assert "applyZoomAtX" in text
    assert "setViewEnd(candles.length || 1)" in text


def test_mobile_api_client_defaults_to_canonical_production_domain():
    text = read_text(MOBILE_API_CLIENT)
    assert "https://aycmarket.com" in text
    assert "EXPO_PUBLIC_API_URL" in text


def test_asset_universe_contains_required_symbols_and_multilingual_aliases():
    text = read_text(WEB_ASSET_UNIVERSE)
    for required in [
        "BTCUSDT",
        "ETHUSDT",
        "AAPL",
        "THYAO.IS",
        "XAUUSD",
        "USDTRY",
        "SPX",
        "XU100",
    ]:
        assert required in text
    assert "Türk Hava Yolları" in text
    assert "Turkish Airlines" in text
    assert '"gold"' in text.lower()
    assert '"altin"' in text.lower()
    assert '"dolar tl"' in text.lower()
    assert "normalizeSearchText" in text
    assert "searchAssets" in text


def test_asset_universe_precision_rules_are_defined_for_micro_and_fx_assets():
    text = read_text(WEB_ASSET_UNIVERSE)
    assert 'symbol: "PEPEUSDT"' in text and "precision: 8" in text
    assert 'symbol: "USDTRY"' in text and "precision: 4" in text
    assert 'symbol: "XAUUSD"' in text and "precision: 2" in text


def test_market_and_command_use_central_asset_universe():
    market_text = read_text(WEB_MARKET_PAGE)
    command_text = read_text(WEB_COMMAND_PALETTE)
    assert "ASSET_UNIVERSE" in market_text
    assert "normalizeSearchText" in market_text
    assert "searchAssets" in command_text
    assert "getCategoryLabel" in command_text


def test_asset_detail_modal_uses_canonical_symbol_chart_and_analysis():
    text = read_text(WEB_ASSET_DETAIL_MODAL)
    assert "symbol={asset.symbol}" in text
    assert "/api/v1/assets/" in text
    assert "setChartLatestClose" in text
    assert "priceDiffPct" in text


def test_ohlcv_route_returns_no_data_contract_when_sources_fail():
    text = read_text(WEB_OHLCV_ROUTE)
    assert 'reason: "NO_DATA"' in text
    assert "providerAttempts" in text
    assert "ok: false" in text
    assert "requestedSymbol" in text
    assert "canonicalSymbol" in text
    assert "providerSymbol" in text


def test_ohlcv_route_uses_asset_universe_and_outlier_cleaning():
    text = read_text(WEB_OHLCV_ROUTE)
    assert "getAssetBySymbol" in text
    assert "SYMBOL_ALIASES" in text
    assert '"GARAN.IS"' in text
    assert '"THYAO.IS"' in text
    assert '"XAUUSD"' in text
    assert '"WTIUSD"' in text
    assert "cleanedMeta" in text
    assert "outlierDropped" in text
    assert "medClose" in text


def test_asset_analysis_endpoint_exists_with_tradeplan_contract():
    assert WEB_ASSET_ANALYSIS_ROUTE.exists()
    text = read_text(WEB_ASSET_ANALYSIS_ROUTE)
    assert "tradePlan" in text
    assert "riskProfile" in text
    assert "INSUFFICIENT_DATA" in text
    assert "technicalSummary" in text
    assert "fundamentalSummary" in text
    assert "disclaimer" in text


def test_provider_health_endpoint_exists_and_lists_required_runtime_keys():
    text = read_text(WEB_HEALTH_PROVIDERS)
    assert "COINGECKO_API_KEY" in text
    assert "FINNHUB_API_KEY" in text
    assert "TWELVEDATA_API_KEY" in text
    assert "ALPHAVANTAGE_API_KEY" in text
    assert "JWT_SECRET" in text
    assert "SECRET_KEY" in text
    assert "EXCHANGE_CREDENTIALS_KEY" in text
    assert "CORS_ORIGINS" in text
    assert "missingRequired" in text


def test_pnpm_workspace_does_not_use_invalid_allow_builds_placeholder():
    text = read_text(PNPM_WORKSPACE)
    assert "allowBuilds" not in text
    assert "onlyBuiltDependencies" in text


def test_profile_page_updates_language_and_fixes_mojibake_strings():
    text = read_text(WEB_PROFILE_PAGE)
    assert "setLocale" in text
    assert "profile.displayNamePlaceholder" in text
    assert "profile.save" in text
    assert "Ç?k??" not in text
    assert "Kişisel Bilgiler" not in text or "profile.personal" in text
    assert "Dü?ük" not in text
    assert "odakl?" not in text


def test_profile_risk_level_updates_drawdown_threshold_and_save_payload():
    text = read_text(WEB_PROFILE_PAGE)
    assert "RISK_PROFILE_CONFIG" in text
    assert "defaultDrawdown: 5" in text
    assert "defaultDrawdown: 10" in text
    assert "defaultDrawdown: 20" in text
    assert "applyRiskDefaults" in text
    assert "risk_level: normalizedRiskLevel" in text
    assert "max_drawdown_pct: Number(maxDrawdown)" in text


def test_scenario_page_has_safe_formatters_and_no_undefined_tokens():
    text = read_text(WEB_SCENARIO_PAGE)
    assert "formatPercent" in text
    assert "formatMoney" in text
    assert "formatRatio" in text
    assert "formatKelly" in text
    assert "undefined%" not in text
    assert "undefinedx" not in text
    assert "Hesaplanamadı" in text


def test_scenario_api_returns_trade_fields_and_disclaimer():
    text = read_text(ROOT / "apps" / "web" / "app" / "api" / "v1" / "intelligence" / "scenario" / "route.ts")
    assert "expectedPnlPct" in text
    assert "maxLossPct" in text
    assert "riskReward" in text
    assert "kellyFraction" in text
    assert "Bu içerik yatırım tavsiyesi değildir." in text


def test_market_page_has_mobile_card_view_and_source_label_mapping():
    text = read_text(WEB_MARKET_PAGE)
    assert "market-mobile-list" in text
    assert "market-mobile-card" in text
    assert "sourceLabel" in text
    assert "Veri yok" in text
    assert "Kaynak yok" in text
    assert "fmtChange" in text


def test_social_page_covers_all_market_categories_and_tr_en_labels():
    text = read_text(WEB_SOCIAL_PAGE)
    for token in [
        '"crypto"',
        '"us"',
        '"bist"',
        '"precious"',
        '"commodity"',
        '"energy"',
        '"forex"',
        '"index"',
        '"etf"',
    ]:
        assert token in text
    assert "Bullish" in text
    assert "Bearish" in text
    assert "Yükseliş" in text
    assert "Düşüş" in text


def test_signin_signup_support_back_close_and_return_to_flow():
    signin_text = read_text(WEB_SIGNIN_PAGE)
    signup_text = read_text(WEB_SIGNUP_PAGE)

    assert "resolveReturnTo" in signin_text
    assert "router.back()" in signin_text
    assert "Kapat" in signin_text
    assert "goAfterAuth" in signin_text

    assert "resolveReturnTo" in signup_text
    assert "router.back()" in signup_text
    assert "Kapat" in signup_text
    assert "goAfterAuth" in signup_text


def test_onboarding_modal_uses_mobile_safe_height_and_scroll():
    text = read_text(WEB_DASHBOARD_PAGE)
    assert "maxHeight: \"calc(100dvh - env(safe-area-inset-top, 0px) - 12px)\"" in text
    assert "overflowY: \"auto\"" in text


def test_mojibake_patterns_absent_in_user_facing_web_ui():
    roots = [ROOT / "apps" / "web" / "app", ROOT / "apps" / "web" / "components", ROOT / "apps" / "web" / "lib"]
    bad_tokens = ["Ã", "Â", "ý", "þ", "ð", "Ð", "Ý", "Þ", "\ufffd"]
    offenders: list[str] = []
    for base in roots:
        for path in base.rglob("*.ts*"):
            text = path.read_text(encoding="utf-8", errors="ignore")
            if any(token in text for token in bad_tokens):
                offenders.append(str(path))
    assert offenders == []


def test_mojibake_patterns_absent_in_mobile_sources():
    bad_tokens = ["Ã", "Â", "ý", "þ", "ð", "Ð", "Ý", "Þ", "\ufffd"]
    offenders: list[str] = []
    for path in MOBILE_APP_ROOT.rglob("*"):
        if "node_modules" in path.parts:
            continue
        if path.suffix.lower() not in {".ts", ".tsx", ".js", ".jsx", ".json", ".md"}:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except (PermissionError, OSError):
            continue
        if any(token in text for token in bad_tokens):
            offenders.append(str(path))
    assert offenders == []
