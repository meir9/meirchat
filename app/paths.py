"""MEIRCHAT Merkezi Dosya Yolu Yonetimi (v20.0).
Hem gelistirme (Python) hem derlenmis MEIRCHAT.exe hem de kurulu Setup modunda
static/ ve kullanici verisi (data/meirchat.db, data/uploads/) yollarini kusursuz cozer.
"""
import os
import sys

IS_FROZEN = bool(getattr(sys, "frozen", False))

if IS_FROZEN:
    APP_DIR = os.path.dirname(os.path.abspath(sys.executable))
    _MEIPASS = getattr(sys, "_MEIPASS", APP_DIR)
else:
    APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    _MEIPASS = APP_DIR


def _is_writable_dir(path: str) -> bool:
    try:
        os.makedirs(path, exist_ok=True)
        probe = os.path.join(path, ".meir_write_test")
        with open(probe, "w", encoding="utf-8") as f:
            f.write("ok")
        os.remove(probe)
        return True
    except Exception:
        return False


def _resolve_static_dir() -> str:
    # Once EXE/proje yanindaki harici static/ klasorunu kontrol et (hizli arayuz guncellemesi icin)
    ext_static = os.path.join(APP_DIR, "static")
    if os.path.isdir(ext_static) and os.path.isfile(os.path.join(ext_static, "index.html")):
        return ext_static
    # PyInstaller _internal/static
    bundled_static = os.path.join(_MEIPASS, "static")
    if os.path.isdir(bundled_static) and os.path.isfile(os.path.join(bundled_static, "index.html")):
        return bundled_static
    return ext_static


def _resolve_data_dir() -> str:
    env_dir = (os.environ.get("MEIRCHAT_DATA_DIR") or "").strip()
    if env_dir:
        os.makedirs(env_dir, exist_ok=True)
        return env_dir

    local_data = os.path.join(APP_DIR, "data")
    has_local_db = (
        os.path.isfile(os.path.join(local_data, "meirchat.db"))
        or os.path.isfile(os.path.join(local_data, "hikaye.db"))
    )

    # Tasinabilir (portable) mod veya mevcut yerel veritabani varsa ve yazilabiliyorsa onu koru
    if (not IS_FROZEN) or has_local_db:
        if _is_writable_dir(local_data):
            return local_data

    # Kurulu Windows uygulamasi (Setup -> %LocalAppData%\MEIRCHAT\data):
    # Guncellemelerde ve yeniden kurulumlarda sohbetlerin/karakterlerin ASLA silinmez!
    base_user = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA") or os.path.expanduser("~")
    user_data = os.path.join(base_user, "MEIRCHAT", "data")
    os.makedirs(user_data, exist_ok=True)
    return user_data


STATIC_DIR = _resolve_static_dir()
DATA_DIR = _resolve_data_dir()
UPLOADS_DIR = os.path.join(DATA_DIR, "uploads")
DB_PATH = os.path.join(DATA_DIR, "meirchat.db")
LEGACY_DB_PATH = os.path.join(DATA_DIR, "hikaye.db")
LOG_PATH = os.path.join(DATA_DIR, "app.log")
WEBVIEW_DATA_DIR = os.path.join(DATA_DIR, "webview_data")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
