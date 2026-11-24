"""MEIRCHAT Bulut & Hibrit Yapilandirma Yoneticisi (v21.0).
Hem Hugging Face Spaces / Docker ortam degiskenlerini hem de PC'deki
DATA_DIR/cloud_config.json dosyasini otomatik okur.
"""
import os
import json
from typing import Dict, Any
from app.paths import DATA_DIR

CLOUD_CONFIG_PATH = os.path.join(DATA_DIR, "cloud_config.json")


def is_cloud_runtime() -> bool:
    return bool(
        os.environ.get("SPACE_ID")
        or os.environ.get("SPACE_HOST")
        or os.environ.get("MEIRCHAT_CLOUD", "").strip() in ("1", "true", "yes")
        or os.environ.get("RENDER")
        or os.environ.get("RAILWAY_ENVIRONMENT")
    )


def load_cloud_config() -> Dict[str, str]:
    file_cfg: Dict[str, Any] = {}
    if os.path.isfile(CLOUD_CONFIG_PATH):
        try:
            with open(CLOUD_CONFIG_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
                if isinstance(raw, dict):
                    file_cfg = raw
        except Exception:
            file_cfg = {}

    def _pick(env_key: str, json_key: str, default: str = "") -> str:
        val = (os.environ.get(env_key) or "").strip()
        if val:
            return val
        return str(file_cfg.get(json_key) or default).strip()

    return {
        "database_url": _pick("DATABASE_URL", "database_url", ""),
        "supabase_url": _pick("SUPABASE_URL", "supabase_url", "").rstrip("/"),
        "supabase_key": _pick("SUPABASE_KEY", "supabase_key", "") or _pick("SUPABASE_SERVICE_KEY", "supabase_service_key", ""),
        "supabase_bucket": _pick("SUPABASE_BUCKET", "supabase_bucket", "meirchat-uploads") or "meirchat-uploads",
        "password": _pick("MEIRCHAT_PASSWORD", "password", ""),
        "remote_token": _pick("MEIRCHAT_REMOTE_TOKEN", "remote_token", ""),
        "session_secret": _pick("MEIRCHAT_SESSION_SECRET", "session_secret", ""),
    }


def save_cloud_config(data: Dict[str, Any]) -> Dict[str, str]:
    cur = {}
    if os.path.isfile(CLOUD_CONFIG_PATH):
        try:
            with open(CLOUD_CONFIG_PATH, "r", encoding="utf-8") as f:
                cur = json.load(f) or {}
        except Exception:
            cur = {}
    for k in ("database_url", "supabase_url", "supabase_key", "supabase_bucket", "password", "remote_token", "session_secret"):
        if k in data and data[k] is not None:
            cur[k] = str(data[k]).strip()
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(CLOUD_CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cur, f, ensure_ascii=False, indent=2)
    return load_cloud_config()


IS_CLOUD = is_cloud_runtime()
