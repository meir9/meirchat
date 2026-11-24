"""MEIRCHAT Sifreli Erisim Kilidi (v21.0).
MEIRCHAT_PASSWORD tanimliysa tum arayuz, API ve yuklenen gorseller 30 gunluk
HMAC-SHA256 imzali HttpOnly oturum cerezi ile korunur.
"""
import hmac
import hashlib
import time
from typing import Optional
from app.cloud_config import load_cloud_config

SESSION_COOKIE_NAME = "meirchat_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30  # 30 gun


def get_auth_password() -> str:
    return load_cloud_config().get("password", "")


def is_auth_enabled() -> bool:
    return bool(get_auth_password())


def _get_signing_key() -> bytes:
    cfg = load_cloud_config()
    secret = cfg.get("session_secret") or cfg.get("password") or "meirchat-local-default"
    return hashlib.sha256(f"meirchat::v21::{secret}".encode("utf-8")).digest()


def verify_password(candidate: str) -> bool:
    expected = get_auth_password()
    if not expected:
        return True
    return hmac.compare_digest(str(candidate or ""), expected)


def create_session_token() -> str:
    exp = int(time.time()) + SESSION_MAX_AGE
    payload = f"meir:{exp}"
    sig = hmac.new(_get_signing_key(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload}:{sig}"


def verify_session_token(token: Optional[str]) -> bool:
    if not is_auth_enabled():
        return True
    if not token or ":" not in token:
        return False
    parts = token.split(":")
    if len(parts) != 3 or parts[0] != "meir":
        return False
    try:
        exp = int(parts[1])
    except ValueError:
        return False
    if exp < int(time.time()):
        return False
    payload = f"{parts[0]}:{parts[1]}"
    expected_sig = hmac.new(_get_signing_key(), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(parts[2], expected_sig)


def verify_remote_token(token: Optional[str]) -> bool:
    cfg = load_cloud_config()
    expected = cfg.get("remote_token") or cfg.get("password") or ""
    if not expected:
        return True
    return hmac.compare_digest(str(token or "").strip(), expected)
