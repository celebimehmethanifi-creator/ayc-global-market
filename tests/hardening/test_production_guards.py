from __future__ import annotations

import importlib.util
import re
import subprocess
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
WEB_PRICE_CONTEXT = ROOT / "apps" / "web" / "lib" / "prices" / "PriceContext.tsx"
WEB_BILLING_VERIFY = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "verify" / "route.ts"
WEB_BILLING_CHECKOUT = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "checkout" / "route.ts"
WEB_BILLING_WEBHOOK = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "webhook" / "route.ts"
WEB_BILLING_CANCEL = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "cancel" / "route.ts"
WEB_ALARMS_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "alarms" / "route.ts"
WEB_ALARM_ID_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "alarms" / "[id]" / "route.ts"
WEB_PORTFOLIO_POSITIONS = ROOT / "apps" / "web" / "app" / "api" / "v1" / "portfolio" / "positions" / "route.ts"
WEB_SOCIAL_VOTE_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "social" / "[id]" / "vote" / "route.ts"
WEB_SIGNALS_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "signals" / "route.ts"
WEB_SIGNALS_FEATURED_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "signals" / "featured" / "route.ts"
WEB_SIGNALS_DETAIL_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "signals" / "[id]" / "route.ts"
WEB_SIGNALS_STRATEGY_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "signals" / "[id]" / "strategy" / "route.ts"
WEB_SIGNALS_LIVE_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "signals" / "live" / "route.ts"
WEB_NEWS_GLOBAL_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "news" / "global" / "route.ts"
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
WEB_DEMO_BANNER = ROOT / "apps" / "web" / "components" / "ui" / "DemoBanner.tsx"
WEB_ASSET_UNIVERSE = ROOT / "apps" / "web" / "lib" / "markets" / "asset-universe.ts"
WEB_BREAKPOINT_HOOK = ROOT / "apps" / "web" / "lib" / "responsive" / "useBreakpoint.ts"
WEB_MIDDLEWARE = ROOT / "apps" / "web" / "middleware.ts"
WEB_VERCEL_SETUP = ROOT / "apps" / "web" / "VERCEL_ENV_SETUP.txt"
WEB_VERSION_ROUTE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "version" / "route.ts"
WEB_VERSION_LIB = ROOT / "apps" / "web" / "app" / "api" / "v1" / "_lib" / "version-info.ts"
WEB_VERSION_TXT_ROUTE = ROOT / "apps" / "web" / "app" / "version.txt" / "route.ts"
ENV_EXAMPLE = ROOT / ".env.example"
PNPM_WORKSPACE = ROOT / "pnpm-workspace.yaml"
MOBILE_API_CLIENT = ROOT / "apps" / "mobile" / "src" / "api" / "client.ts"
MOBILE_APP_ROOT = ROOT / "apps" / "mobile"
AI_SERVICE_MAIN = ROOT / "services" / "ai-service" / "main.py"
DATA_SERVICE_MAIN = ROOT / "services" / "data-service" / "main.py"
SIGNAL_SERVICE_MAIN = ROOT / "services" / "signal-service" / "main.py"
DATA_MARKET_PROXY = ROOT / "services" / "data-service" / "market_proxy.py"
DATA_COINGECKO_FETCHER = ROOT / "services" / "data-service" / "fetchers" / "coingecko.py"

GATEWAY_AUTH = GATEWAY_DIR / "auth_service.py"
GATEWAY_BILLING = GATEWAY_DIR / "billing_router.py"
GATEWAY_MAIN = GATEWAY_DIR / "main.py"
GATEWAY_MOCK_ROUTER = GATEWAY_DIR / "mock_router.py"
ROOT_GITIGNORE = ROOT / ".gitignore"


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
    assert "function isDevSeedEnabled(): boolean" in text
    assert 'if (process.env.DEMO_SEED_ENABLED === "true") return true;' in text
    assert 'return process.env.NODE_ENV !== "production";' in text
    assert "DevOnlyElitePass" not in text
    assert "DevOnlyProPass" not in text
    assert "DevOnlyFreePass" not in text


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


def test_webhook_requires_secret_or_explicit_test_bypass():
    web_text = read_text(WEB_BILLING_WEBHOOK)
    assert "ALLOW_INSECURE_WEBHOOKS_FOR_TESTS" in web_text
    assert "Webhook secret yok. Test bypass" in web_text

    gateway_text = read_text(GATEWAY_BILLING)
    assert "ALLOW_INSECURE_WEBHOOKS_FOR_TESTS" in gateway_text
    assert "Test bypass icin ALLOW_INSECURE_WEBHOOKS_FOR_TESTS=true gerekli." in gateway_text


def test_web_auth_rejects_unsigned_and_malformed_jwt_tokens():
    text = read_text(WEB_AUTH_LIB)
    assert 'const parts = token.split(".");' in text
    assert "parts.length !== 3" in text
    assert 'String(header.alg).toLowerCase() === "none"' in text


def test_billing_cancel_has_no_fake_production_success_path():
    text = read_text(WEB_BILLING_CANCEL)
    assert 'const IS_PRODUCTION = process.env.NODE_ENV === "production";' in text
    assert "ALLOW_CANCEL_INSECURE_FOR_TESTS" in text
    assert "Canli abonelik iptali bu endpointte desteklenmiyor" in text
    assert "Test iptal endpointi kapali" in text
    assert "Test ortaminda abonelik iptal simule edildi" in text


def test_market_proxy_uses_env_keys_and_has_no_hardcoded_provider_secret_assignments():
    text = read_text(DATA_MARKET_PROXY)
    assert "COINGECKO_KEY    =" not in text
    assert "FINNHUB_KEY      =" not in text
    assert "TWELVEDATA_KEY   =" not in text
    assert "FMP_KEY          =" not in text
    assert "CMC_KEY          =" not in text
    assert "ALPHAVANTAGE_KEY =" not in text
    assert '_env_api_key("COINGECKO_API_KEY")' in text
    assert '_env_api_key("TWELVEDATA_API_KEY")' in text
    assert '_env_api_key("FMP_API_KEY")' in text
    assert '_env_api_key("FINNHUB_API_KEY")' in text


def test_db_files_are_gitignored_and_not_tracked():
    text = read_text(ROOT_GITIGNORE)
    for marker in ["*.db", "*.sqlite", "*.sqlite3", "prisma/dev.db", "data/*.db"]:
        assert marker in text

    result = subprocess.run(
        ["git", "ls-files", "*.db"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    )
    assert result.stdout.strip() == ""


def test_production_paths_do_not_depend_on_legacy_fake_payment_router():
    main_text = read_text(GATEWAY_MAIN)
    assert "include_router(billing_router" in main_text
    assert "payment_router" not in main_text


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


def test_price_context_uses_same_origin_backend_for_non_ws_market_data():
    text = read_text(WEB_PRICE_CONTEXT)
    assert "https://finnhub.io" not in text
    assert "https://stooq.com" not in text
    assert "https://api.coingecko.com" not in text
    assert "https://open.er-api.com" not in text
    assert "fetch(\"/api/v1/prices/live\"" in text


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


def test_dashboard_top_stats_are_limited_to_three_cards():
    text = read_text(WEB_DASHBOARD_PAGE)
    assert 'className="stat-scroll dashboard-top-stats"' in text
    assert 'label="Aktif Sinyaller"' in text
    assert 'label="KALKAN"' in text
    assert 'label="Piyasa Kapsamı"' in text
    assert 'label="BTC/USD"' not in text
    assert 'label="XAU/USD"' not in text


def test_version_endpoint_and_version_txt_exist_with_required_fields():
    route_text = read_text(WEB_VERSION_ROUTE)
    lib_text = read_text(WEB_VERSION_LIB)
    txt_text = read_text(WEB_VERSION_TXT_ROUTE)
    assert "getVersionInfo" in route_text
    for key in ["commitSha", "branch", "buildTime", "environment", "deploymentUrl"]:
        assert key in lib_text
        assert key in txt_text


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
    bp_text = read_text(WEB_BREAKPOINT_HOOK)
    assert "ASSET_UNIVERSE" in market_text
    assert "normalizeSearchText" in market_text
    assert "useBreakpoint" in market_text
    assert "isMobile" in market_text
    assert "searchAssets" in command_text
    assert "getCategoryLabel" in command_text
    assert "isMobile: width <= 640" not in bp_text
    assert "isMobile = width <= 640" in bp_text


def test_asset_detail_modal_uses_canonical_symbol_chart_and_analysis():
    text = read_text(WEB_ASSET_DETAIL_MODAL)
    assert "symbol={asset.symbol}" in text
    assert "/api/v1/assets/" in text
    assert "setChartLatestClose" in text
    assert "priceDiffPct" in text


def test_social_assets_open_asset_detail_modal():
    text = read_text(WEB_SOCIAL_PAGE)
    assert "AssetDetailModal" in text
    assert "setSelectedAsset" in text
    assert "onClick={() =>" in text


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
    status_text = read_text(ROOT / "apps" / "web" / "lib" / "markets" / "data-status.ts")
    assert "market-mobile-list" in text
    assert "market-mobile-card" in text
    assert "sourceLabel" in text
    assert "buildDataStatusMeta" in text
    assert "Veri yok" in text
    assert 't("market.col.dataStatus")' in text
    assert "fmtChange" in text
    assert '"BINANCE-WS": "Binance Canlı"' in status_text
    assert 'BACKEND: "AYC Veri"' in status_text


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


def test_version_metadata_has_cli_fallback_and_expected_env_order():
    text = read_text(WEB_VERSION_LIB)
    assert 'const CLI_FALLBACK = "not_provided_by_cli_deploy";' in text
    assert "VERCEL_GIT_COMMIT_SHA" in text
    assert "NEXT_PUBLIC_COMMIT_SHA" in text
    assert "VERCEL_GIT_COMMIT_REF" in text
    assert "NEXT_PUBLIC_BRANCH" in text
    assert "BUILD_TIME" in text
    assert "DEPLOYMENT_URL" in text


def test_analysis_route_can_generate_trade_plan_with_partial_indicators():
    text = read_text(WEB_ASSET_ANALYSIS_ROUTE)
    assert "candles.length >= 15" in text
    assert "sma20: number | null;" in text
    assert "riskReward = Math.abs(target - latest)" in text
    assert "direction !== \"NEUTRAL\"" in text


def test_dashboard_causal_mapping_hides_raw_enum_and_zero_move_text():
    text = read_text(WEB_DASHBOARD_PAGE)
    assert "CAUSE_LABELS" in text
    assert "ORGANIC_TREND:\"Organik trend\"" in text
    assert "Bu varlık için anlamlı hareket verisi henüz oluşmadı." in text
    assert "replace(/ORGANIC_TREND" in text


def test_scenario_validation_blocks_non_numeric_inputs_and_clears_cards():
    page_text = read_text(WEB_SCENARIO_PAGE)
    api_text = read_text(ROOT / "apps" / "web" / "app" / "api" / "v1" / "intelligence" / "scenario" / "route.ts")
    assert "parseStrictNumberInput" in page_text
    assert "setReportData(null)" in page_text
    assert "Geçerli giriş fiyatı girin." in page_text
    assert "Geçerli miktar girin" in page_text
    assert "Kaldıraç geçerli sayı olmalıdır." in page_text
    assert "Güven yüzdesi 0-100 arasında olmalıdır." in page_text
    assert "Volatilite geçerli sayı olmalıdır." in page_text
    assert "parseStrictNumericInput" in api_text


def test_bist_data_status_is_not_live_without_licensed_feed():
    status_text = read_text(ROOT / "apps" / "web" / "lib" / "markets" / "data-status.ts")
    analysis_text = read_text(WEB_ASSET_ANALYSIS_ROUTE)
    assert "category === \"bist\" && !bistRealtimeLicensed" in status_text
    assert "license_required" in status_text
    assert "category === \"bist\" && latestPrice === null" in analysis_text
    assert "status: dataStatus" in analysis_text


def test_scenario_route_uses_asset_data_quality_and_avoids_fake_confidence():
    text = read_text(ROOT / "apps" / "web" / "app" / "api" / "v1" / "intelligence" / "scenario" / "route.ts")
    assert "resolveAssetDataQuality" in text
    assert "if (dataQuality === \"insufficient\")" in text
    assert "Bu varlık için güvenilir senaryo üretilemedi. Veri yetersiz." in text
    assert "Stop-loss olmadan pozisyon önerilmez." in text
    assert "scenario.resultLabel = \"Tahmini\";" in text


def test_scenario_page_marks_fallback_as_educational_and_blocks_recommendation_on_insufficient():
    text = read_text(WEB_SCENARIO_PAGE)
    assert "qualityBannerText" in text
    assert "Eğitim amaçlı tahmini senaryo" in text
    assert "allowRecommended = report.dataQuality !== \"insufficient\"" in text
    assert "Reliable scenario could not be generated for this asset." in text


def test_market_page_uses_clear_status_copy_and_badges():
    text = read_text(WEB_MARKET_PAGE)
    assert "Veri durumu varlığa göre değişir" in text
    assert "statusVisual" in text
    assert "row.volumeStatusLabel" in text


def test_market_desktop_table_has_fixed_11_column_order():
    text = read_text(WEB_MARKET_PAGE)
    ordered_headers = [
        't("market.col.symbol")',
        't("market.col.name")',
        't("market.col.category")',
        't("market.col.price")',
        't("market.col.change24h")',
        't("market.col.change7d")',
        't("market.col.volume")',
        't("market.col.dataStatus")',
        't("market.col.source")',
        't("market.col.updated")',
        't("market.col.chart")',
    ]
    positions = [text.find(token) for token in ordered_headers]
    assert all(position != -1 for position in positions)
    assert positions == sorted(positions)

    table_head_match = re.search(r"<thead>(.*?)</thead>", text, re.DOTALL)
    assert table_head_match is not None
    assert table_head_match.group(1).count("<th") == 11


def test_market_desktop_row_cells_cover_all_columns_without_misalignment():
    text = read_text(WEB_MARKET_PAGE)
    required_cell_contract = [
        "{row.displaySymbol}</td>",
        "{row.name}</td>",
        "{row.categoryLabel}",
        "fmtPrice(row.price, row.precision)",
        "change24Label",
        "change7dLabel",
        "volumeLabel",
        "row.dataStatusLabel",
        "row.sourceLabel",
        "row.updatedAtLabel",
        '{t("market.chartButton")}',
    ]
    for marker in required_cell_contract:
        assert marker in text

    assert "row.dataStatusLabel" not in text.split("volumeLabel")[0][-180:]
    assert "row.sourceLabel" not in text.split("row.dataStatusLabel")[0][-140:]


def test_market_mobile_card_uses_same_contract_fields():
    text = read_text(WEB_MARKET_PAGE)
    for marker in [
        "row.displaySymbol",
        "row.name",
        "row.categoryLabel",
        "fmtPrice(row.price, row.precision)",
        "change24Label",
        "change7dLabel",
        "volumeLabel",
        "row.dataStatusLabel",
        "row.sourceLabel",
        "row.updatedAtLabel",
        '{t("market.chartButton")}',
        "analysisLabel",
    ]:
        assert marker in text


def test_demo_banner_explains_virtual_money_and_training_purpose():
    text = read_text(WEB_DEMO_BANNER)
    assert "Bu demo bakiyedir, gerçek para değildir." in text
    assert "Demo işlemler eğitim amaçlıdır." in text


def test_professional_chart_rotate_hint_is_temporary():
    text = read_text(WEB_PROFESSIONAL_CHART)
    assert "showRotateHint" in text
    assert "setTimeout(() => setShowRotateHint(false), 2800)" in text


# ──────────────────────────────────────────────────────────────────────────────
# P1-H: Hardcoded static signal route must be disabled in production
# ──────────────────────────────────────────────────────────────────────────────

def test_static_signals_route_is_guarded_by_production_flag():
    text = read_text(WEB_SIGNALS_ROUTE)
    # Must not blindly export hardcoded SIGNALS as the response
    assert 'const SIGNALS = [' not in text
    # Must have production guard
    assert 'IS_PRODUCTION' in text
    assert 'ENABLE_DEV_SIGNALS' in text
    # In production path returns empty items
    assert 'source: "static_disabled"' in text
    assert 'items: []' in text
    # Dev array must be under a clearly-named dev variable
    assert 'STATIC_DEV_SIGNALS' in text


def test_static_signals_route_warns_to_use_live_endpoint():
    text = read_text(WEB_SIGNALS_ROUTE)
    assert '/api/v1/signals/live' in text
    assert 'warning' in text


# ──────────────────────────────────────────────────────────────────────────────
# P1-J: In-memory alarm and position stores must disclose non-persistence
# ──────────────────────────────────────────────────────────────────────────────

def test_alarms_route_exposes_persistent_false_and_storage_warning():
    text = read_text(WEB_ALARMS_ROUTE)
    assert 'persistent: false' in text
    assert 'storage_warning' in text
    assert 'in-memory' in text.lower()


def test_portfolio_positions_route_exposes_persistent_false_and_storage_warning():
    text = read_text(WEB_PORTFOLIO_POSITIONS)
    assert 'persistent: false' in text
    assert 'storage_warning' in text
    assert 'in-memory' in text.lower()

# ──────────────────────────────────────────────────────────────────────────────
# F1: mock_router MUST have production guard in gateway/main.py
# ──────────────────────────────────────────────────────────────────────────────

GATEWAY_ENV_EXAMPLE = ROOT / "services" / "gateway" / ".env.example"
CI_WORKFLOW = ROOT / ".github" / "workflows" / "ci.yml"


def test_mock_router_not_unconditionally_mounted():
    src = read_text(GATEWAY_MAIN)
    # Must have the guard function
    assert "AYC_ENABLE_MOCK_ROUTES" in src, "Missing AYC_ENABLE_MOCK_ROUTES guard in gateway/main.py"
    assert "_mock_routes_enabled" in src, "Missing _mock_routes_enabled() in gateway/main.py"
    # The unconditional mount pattern must not exist
    assert "app.include_router(mock_router,    prefix=PREFIX)" not in src, \
        "mock_router mounted unconditionally at module level"


def test_mock_routes_disabled_in_production_by_guard_function():
    src = read_text(GATEWAY_MAIN)
    assert "_is_production()" in src or "_is_production" in src
    # The guard must check both AYC_ENABLE_MOCK_ROUTES and production status
    assert "AYC_ENABLE_MOCK_ROUTES" in src
    assert "not _is_production()" in src


def test_gateway_is_production_checks_app_env():
    src = read_text(GATEWAY_MAIN)
    assert 'APP_ENV' in src, "_is_production() must check APP_ENV"
    assert 'ENVIRONMENT' in src


def test_gateway_health_not_hardcoded_ok():
    src = read_text(GATEWAY_MAIN)
    # Must not have the bare hardcoded response
    assert '{"status":"ok","service":"ayc-global-market","version":"2.1.0"}' not in src
    # Must report persistent, storage, warnings
    assert '"persistent"' in src or "persistent" in src
    assert '"storage"' in src or "storage" in src
    assert '"warnings"' in src or "warnings" in src
    assert "mockRoutesEnabled" in src


def test_gateway_health_exposes_mock_routes_enabled():
    src = read_text(GATEWAY_MAIN)
    assert "mockRoutesEnabled" in src


# ──────────────────────────────────────────────────────────────────────────────
# F2: signals/live must not return SIGNALS_BASE in production
# ──────────────────────────────────────────────────────────────────────────────

def test_signals_live_production_guard_present():
    src = read_text(WEB_SIGNALS_LIVE_ROUTE)
    assert "IS_PRODUCTION" in src or "NODE_ENV" in src, "No production guard in signals/live/route.ts"
    assert "ENABLE_DEV_SIGNALS" in src or "NEXT_PUBLIC_ENABLE_MOCK_SIGNALS" in src


def test_signals_live_no_unconditional_signals_base():
    src = read_text(WEB_SIGNALS_LIVE_ROUTE)
    # Old unconditional constant name must not exist
    assert "const SIGNALS_BASE" not in src, \
        "SIGNALS_BASE is still the unconditional export constant — rename to DEV_MOCK_SIGNALS_BASE"


def test_signals_live_production_path_returns_empty():
    src = read_text(WEB_SIGNALS_LIVE_ROUTE)
    assert "signals: []" in src, "Production path must return signals: []"
    assert 'feed_status: "no_signal"' in src


def test_signals_live_mock_mode_source_is_dev_mock():
    src = read_text(WEB_SIGNALS_LIVE_ROUTE)
    assert 'source: "dev-mock-signals"' in src, \
        "Dev mock path source must be 'dev-mock-signals', not 'ayc-signal-engine-v1'"


def test_signals_live_engine_source_not_returned_with_hardcoded_signals():
    src = read_text(WEB_SIGNALS_LIVE_ROUTE)
    # ayc-signal-engine-v1 should only appear in the no_signal production path
    # It must NOT be paired with DEV_MOCK_SIGNALS_BASE returns
    # Simplest check: if "DEV_MOCK_SIGNALS_BASE" exists, "ayc-signal-engine-v1"
    # must not be in the mock return block — we verify via source label
    assert 'source: "dev-mock-signals"' in src
    # The old unconditional pairing must not exist
    assert 'source: "ayc-signal-engine-v1"' not in src or "no_signal" in src


# ──────────────────────────────────────────────────────────────────────────────
# F3: backend health endpoints must not be hardcoded ok
# ──────────────────────────────────────────────────────────────────────────────

def test_signal_service_health_not_hardcoded_ok():
    src = read_text(SIGNAL_SERVICE_MAIN)
    # Must not return the old bare dict
    assert '{"status": "ok", "service": "neura-signal"}' not in src
    assert "persistent" in src
    assert "storage" in src
    assert "warnings" in src


def test_memory_cache_has_keys_method():
    src = read_text(SIGNAL_SERVICE_MAIN)
    assert "async def keys" in src, "_MemoryCache must implement async def keys()"


def test_memory_cache_keys_supports_wildcard():
    src = read_text(SIGNAL_SERVICE_MAIN)
    assert "endswith" in src or "startswith" in src, \
        "_MemoryCache.keys() must handle wildcard patterns (endswith/startswith)"


def test_signal_service_health_reports_is_memory_degraded():
    src = read_text(SIGNAL_SERVICE_MAIN)
    assert "is_memory" in src or "_MemoryCache" in src, \
        "Health must distinguish _MemoryCache from real Redis"
    assert '"degraded"' in src or "'degraded'" in src


# ──────────────────────────────────────────────────────────────────────────────
# F5 / F4: CI workflow must include security branch and no plaintext creds
# ──────────────────────────────────────────────────────────────────────────────

def test_ci_includes_security_branch_trigger():
    src = read_text(CI_WORKFLOW)
    assert "security/p0-production-containment" in src, \
        "CI workflow must trigger on security/p0-production-containment"


def test_ci_has_workflow_dispatch():
    src = read_text(CI_WORKFLOW)
    assert "workflow_dispatch" in src, "CI workflow must have workflow_dispatch trigger"


def test_ci_no_plaintext_jwt_secret():
    src = read_text(CI_WORKFLOW)
    assert "ci_jwt_secret_please_rotate" not in src, \
        "Plaintext JWT_SECRET found in CI workflow"


def test_ci_no_plaintext_gateway_secret():
    src = read_text(CI_WORKFLOW)
    assert "ci_gateway_secret_please_rotate" not in src, \
        "Plaintext SECRET_KEY found in CI workflow"


def test_ci_no_plaintext_exchange_key():
    src = read_text(CI_WORKFLOW)
    assert "ci_exchange_secret_please_rotate" not in src, \
        "Plaintext EXCHANGE_CREDENTIALS_KEY found in CI workflow"


def test_ci_uses_runtime_secret_generation():
    src = read_text(CI_WORKFLOW)
    assert "secrets.token_hex" in src or "openssl" in src or "secrets." in src, \
        "CI must generate secrets at runtime (secrets.token_hex or openssl)"


# ──────────────────────────────────────────────────────────────────────────────
# .env.example: no fake non-empty SECRET_KEY placeholder
# ──────────────────────────────────────────────────────────────────────────────

def test_gateway_env_example_no_fake_secret_key():
    src = read_text(GATEWAY_ENV_EXAMPLE)
    assert "ayc-super-secret-key-change-in-production" not in src, \
        "services/gateway/.env.example contains a non-empty fake SECRET_KEY"


def test_gateway_env_example_secret_key_is_empty_or_placeholder():
    src = read_text(GATEWAY_ENV_EXAMPLE)
    for line in src.splitlines():
        if line.strip().startswith("SECRET_KEY="):
            value = line.split("=", 1)[1].strip()
            # Must be empty, a generate instruction, or a ${{ secrets.* }} reference
            assert (
                value == ""
                or value.startswith("<")
                or value.startswith("${{")
            ), f"SECRET_KEY must be empty or a generate-instruction placeholder, got: {value!r}"
            break
