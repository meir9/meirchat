"""MEIRCHAT Hibrit Medya Deposu (Yerel Onbellek + Supabase Storage).
PC ve iPhone arasinda avatar, kapak, sohbet arka plani ve paylasilan gorselleri
tek bir /uploads/{filename} adresi uzerinden es zamanli senkronize eder.
"""
import os
import mimetypes
from typing import Optional
import httpx

from app.paths import UPLOADS_DIR
from app.cloud_config import load_cloud_config


def is_cloud_storage_configured() -> bool:
    cfg = load_cloud_config()
    return bool(cfg["supabase_url"] and cfg["supabase_key"])


def ensure_supabase_bucket() -> bool:
    cfg = load_cloud_config()
    if not (cfg["supabase_url"] and cfg["supabase_key"]):
        return False
    url = f"{cfg['supabase_url']}/storage/v1/bucket"
    headers = {
        "apikey": cfg["supabase_key"],
        "Authorization": f"Bearer {cfg['supabase_key']}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            r = client.post(
                url,
                headers=headers,
                json={"id": cfg["supabase_bucket"], "name": cfg["supabase_bucket"], "public": False},
            )
            return r.status_code in (200, 201, 409)
    except Exception:
        return False


def upload_to_cloud_storage(filename: str, raw_bytes: bytes, content_type: str = "image/jpeg") -> bool:
    cfg = load_cloud_config()
    if not (cfg["supabase_url"] and cfg["supabase_key"]):
        return False
    safe_name = os.path.basename(filename)
    url = f"{cfg['supabase_url']}/storage/v1/object/{cfg['supabase_bucket']}/{safe_name}"
    headers = {
        "apikey": cfg["supabase_key"],
        "Authorization": f"Bearer {cfg['supabase_key']}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(url, headers=headers, content=raw_bytes)
            if r.status_code in (200, 201):
                return True
            if r.status_code == 400 and "Bucket not found" in (r.text or ""):
                ensure_supabase_bucket()
                r2 = client.post(url, headers=headers, content=raw_bytes)
                return r2.status_code in (200, 201)
    except Exception as e:
        print(f"[STORAGE] Bulut yukleme uyarisi ({safe_name}): {e}", flush=True)
    return False


def save_upload_file(filename: str, raw_bytes: bytes, content_type: str = "image/jpeg") -> str:
    safe_name = os.path.basename(filename)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    local_path = os.path.join(UPLOADS_DIR, safe_name)
    with open(local_path, "wb") as f:
        f.write(raw_bytes)
    if is_cloud_storage_configured():
        upload_to_cloud_storage(safe_name, raw_bytes, content_type=content_type)
    return f"/uploads/{safe_name}"


def resolve_upload_file(filename: str) -> Optional[str]:
    """Yerelde varsa hemen dondurur; yoksa Supabase Storage'dan indirip onbellege alir."""
    safe_name = os.path.basename(filename or "")
    if not safe_name or safe_name in (".", ".."):
        return None
    local_path = os.path.join(UPLOADS_DIR, safe_name)
    if os.path.isfile(local_path):
        return local_path

    cfg = load_cloud_config()
    if not (cfg["supabase_url"] and cfg["supabase_key"]):
        return None

    headers = {
        "apikey": cfg["supabase_key"],
        "Authorization": f"Bearer {cfg['supabase_key']}",
    }
    urls = [
        f"{cfg['supabase_url']}/storage/v1/object/authenticated/{cfg['supabase_bucket']}/{safe_name}",
        f"{cfg['supabase_url']}/storage/v1/object/public/{cfg['supabase_bucket']}/{safe_name}",
    ]
    try:
        with httpx.Client(timeout=15.0) as client:
            for u in urls:
                r = client.get(u, headers=headers)
                if r.status_code == 200 and r.content:
                    os.makedirs(UPLOADS_DIR, exist_ok=True)
                    with open(local_path, "wb") as f:
                        f.write(r.content)
                    return local_path
    except Exception as e:
        print(f"[STORAGE] Bulut indirme uyarisi ({safe_name}): {e}", flush=True)
    return None


def guess_media_type(path: str) -> str:
    mt, _ = mimetypes.guess_type(path)
    return mt or "image/jpeg"
