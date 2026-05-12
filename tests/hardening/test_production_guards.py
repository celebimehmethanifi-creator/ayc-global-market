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
WEB_BILLING_VERIFY = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "verify" / "route.ts"
WEB_BILLING_WEBHOOK = ROOT / "apps" / "web" / "app" / "api" / "v1" / "billing" / "webhook" / "route.ts"
WEB_EXCHANGE_ORDER = ROOT / "apps" / "web" / "app" / "api" / "v1" / "exchange" / "order" / "route.ts"
WEB_EXCHANGE_BALANCE = ROOT / "apps" / "web" / "app" / "api" / "v1" / "exchange" / "balance" / "route.ts"

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

    gateway_text = read_text(GATEWAY_BILLING)
    assert "hmac.compare_digest" in gateway_text
    assert "webhook imzasi" in gateway_text


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
