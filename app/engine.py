import os
import sys
import time
import glob
import shutil
import socket
import subprocess
import threading
import urllib.request
import json
from typing import Dict, Any, Optional, Callable, List

CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0

MODEL_PROFILES: Dict[str, Dict[str, str]] = {
    "gemma4": {
        "preset": "gemma4_rp",
        "speed_mode": "turbo",
        "story_tone": "emotional",
        "temperature": "0.85",
        "top_p": "0.95",
        "top_k": "64",
        "min_p": "0.05",
        "rep_penalty": "1.02",
        "presence_penalty": "0.0",
        "frequency_penalty": "0.0",
        "max_tokens": "320",
        "context_messages": "8",
        "max_prompt_chars": "5500",
        "auto_memory_enabled": "0",
        "live_stream": "0",
        "ai_judge_enabled": "0",
        "no_think_prefix": "1",
        "no_think_literal": "0",
        "model_name": "",
    },
    "qwen": {
        "preset": "qwen35_rp",
        "speed_mode": "turbo",
        "story_tone": "emotional",
        "temperature": "0.70",
        "top_p": "0.85",
        "top_k": "20",
        "min_p": "0.05",
        "rep_penalty": "1.05",
        "presence_penalty": "0.0",
        "frequency_penalty": "0.0",
        "max_tokens": "340",
        "context_messages": "8",
        "max_prompt_chars": "5500",
        "auto_memory_enabled": "0",
        "live_stream": "0",
        "ai_judge_enabled": "0",
        "no_think_prefix": "1",
        "no_think_literal": "0",
        "model_name": "",
    },
}

# Desktop runtime state shared with meirchat_app.pyw
DESKTOP_STATE: Dict[str, Any] = {
    "is_desktop": False,
    "last_heartbeat": 0.0,
    "shutdown_cb": None,
    "managed_llama_proc": None,
    "engine_busy": False,
    "engine_status_msg": "",
    "kill_lmstudio_on_exit": False,
}
_ENGINE_LOCK = threading.Lock()


def register_desktop_hooks(shutdown_cb: Callable[[], None]):
    DESKTOP_STATE["is_desktop"] = True
    DESKTOP_STATE["shutdown_cb"] = shutdown_cb
    DESKTOP_STATE["last_heartbeat"] = time.time()


def record_heartbeat():
    DESKTOP_STATE["last_heartbeat"] = time.time()


def trigger_desktop_shutdown(kill_lmstudio: bool = True):
    if kill_lmstudio:
        DESKTOP_STATE["kill_lmstudio_on_exit"] = True
    cb = DESKTOP_STATE.get("shutdown_cb")
    if callable(cb):
        threading.Thread(target=cb, daemon=True).start()
        return True
    # Masaustu baslatici yoksa (or. start.bat) yine de motorlari kapat
    if kill_lmstudio:
        threading.Thread(target=terminate_all_engines_sync, daemon=True).start()
    return False


def _run_hidden(cmd: List[str], timeout: int = 120) -> subprocess.CompletedProcess:
    kwargs: Dict[str, Any] = {
        "stdout": subprocess.PIPE,
        "stderr": subprocess.PIPE,
        "text": True,
        "encoding": "utf-8",
        "errors": "ignore",
        "timeout": timeout,
    }
    if os.name == "nt":
        kwargs["creationflags"] = CREATE_NO_WINDOW
    return subprocess.run(cmd, **kwargs)


def find_lms_cli() -> Optional[str]:
    found = shutil.which("lms")
    if found:
        return found
    home = os.path.expanduser("~")
    for cand in (
        os.path.join(home, ".lmstudio", "bin", "lms.exe"),
        os.path.join(home, ".lmstudio", "bin", "lms"),
        os.path.join(os.environ.get("LOCALAPPDATA", ""), "LM-Studio", "resources", "app", ".webpack", "lms.exe"),
    ):
        if cand and os.path.isfile(cand):
            return cand
    return None


def find_lmstudio_exe() -> Optional[str]:
    local_app = os.environ.get("LOCALAPPDATA", "")
    prog_files = os.environ.get("ProgramFiles", "")
    for cand in (
        os.path.join(local_app, "Programs", "LM Studio", "LM Studio.exe"),
        os.path.join(local_app, "LM-Studio", "LM Studio.exe"),
        os.path.join(prog_files, "LM Studio", "LM Studio.exe"),
    ):
        if cand and os.path.isfile(cand):
            return cand
    return None


def find_llama_server() -> Optional[str]:
    return shutil.which("llama-server") or shutil.which("llama-server.exe")


def find_gguf_model(explicit_path: str = "", model_key: str = "gemma") -> Optional[str]:
    ep = (explicit_path or "").strip().strip('"')
    if ep and os.path.isfile(ep):
        return ep
    home = os.path.expanduser("~")
    models_root = os.path.join(home, ".lmstudio", "models")
    if not os.path.isdir(models_root):
        return None
    all_gguf = glob.glob(os.path.join(models_root, "**", "*.gguf"), recursive=True)
    if not all_gguf:
        return None
    key_l = (model_key or "gemma").strip().lower()
    # Priority 1: matches both key and "26b"
    for p in all_gguf:
        bn = os.path.basename(p).lower()
        if key_l and key_l in bn and "26b" in bn and "mmproj" not in bn:
            return p
    # Priority 2: matches key
    for p in all_gguf:
        bn = os.path.basename(p).lower()
        if key_l and key_l in bn and "mmproj" not in bn:
            return p
    # Priority 3: any non-mmproj gguf
    for p in all_gguf:
        if "mmproj" not in os.path.basename(p).lower():
            return p
    return all_gguf[0]


def query_local_models(api_url: str = "http://127.0.0.1:1234/v1", timeout: float = 2.0) -> List[str]:
    url = api_url.rstrip("/") + "/models"
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            if resp.status == 200:
                data = json.loads(resp.read().decode("utf-8", errors="ignore"))
                return [str(m.get("id", "")) for m in data.get("data", []) if m.get("id")]
    except Exception:
        pass
    return []


def is_port_open(host: str, port: int, timeout: float = 0.6) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _is_lmstudio_running() -> bool:
    if os.name != "nt":
        return False
    try:
        res = _run_hidden(["tasklist", "/FI", "IMAGENAME eq LM Studio.exe"], timeout=5)
        return "lm studio.exe" in (res.stdout or "").lower()
    except Exception:
        return False


def get_engine_overview(settings: Dict[str, str]) -> Dict[str, Any]:
    api_url = settings.get("api_url", "http://localhost:1234/v1")
    loaded = query_local_models(api_url, timeout=1.5)
    lms = find_lms_cli()
    llama_srv = find_llama_server()
    gguf = find_gguf_model(settings.get("app_gguf_path", ""), settings.get("app_model_key", "gemma"))
    proc = DESKTOP_STATE.get("managed_llama_proc")
    llama_running = proc is not None and proc.poll() is None
    return {
        "mode": settings.get("app_engine_mode", "lmstudio"),
        "model_key": settings.get("app_model_key", "gemma"),
        "gguf_path": settings.get("app_gguf_path", ""),
        "detected_gguf": gguf or "",
        "cpu_moe": settings.get("app_cpu_moe", "24"),
        "ctx_size": settings.get("app_ctx_size", "4096"),
        "unload_on_exit": settings.get("app_unload_on_exit", "0") == "1",
        "has_lms": bool(lms),
        "has_llama_server": bool(llama_srv),
        "managed_llama_running": llama_running,
        "connected": len(loaded) > 0,
        "loaded_models": loaded,
        "is_desktop": bool(DESKTOP_STATE.get("is_desktop")),
        "busy": bool(DESKTOP_STATE.get("engine_busy")),
        "status_msg": DESKTOP_STATE.get("engine_status_msg", ""),
    }


def start_engine_sync(
    settings: Dict[str, str],
    progress_cb: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Secili AI motorunu (LM Studio veya Turbo llama-server) baslatir ve modeli yukler."""
    def emit(msg: str):
        DESKTOP_STATE["engine_status_msg"] = msg
        if progress_cb:
            try:
                progress_cb(msg)
            except Exception:
                pass

    mode = (settings.get("app_engine_mode") or "lmstudio").strip().lower()
    api_url = settings.get("api_url", "http://localhost:1234/v1")
    model_key = (settings.get("app_model_key") or "gemma").strip()

    if mode == "manual":
        emit("Manuel mod: harici sunucu bekleniyor.")
        return {"ok": True, "message": "Manuel mod seçili; sunucu otomatik başlatılmadı."}

    with _ENGINE_LOCK:
        DESKTOP_STATE["engine_busy"] = True
        try:
            # Zaten calisan ve icinde model yuklu sunucu varsa tekrar baslatma
            already = query_local_models(api_url, timeout=1.5)
            if already:
                if not model_key or any(model_key.lower() in m.lower() for m in already):
                    emit(f"Model hazır: {already[0]}")
                    return {"ok": True, "message": f"Model zaten yüklü: {already[0]}", "models": already}

            # --- MOD 1: LM STUDIO ---
            if mode == "lmstudio":
                lms = find_lms_cli()
                if not lms:
                    msg = "LM Studio CLI (lms) bulunamadı. LM Studio'yu açıp bir kez 'lms bootstrap' çalıştır veya Turbo llama-server seç."
                    emit(msg)
                    return {"ok": False, "message": msg}

                if not _is_lmstudio_running():
                    exe = find_lmstudio_exe()
                    if exe:
                        emit("LM Studio başlatılıyor...")
                        try:
                            subprocess.Popen([exe], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            time.sleep(4.5)
                        except Exception:
                            pass

                emit("LM Studio Local Server açılıyor (port 1234)...")
                srv_ok = False
                for _ in range(10):
                    try:
                        r = _run_hidden([lms, "server", "start", "--port", "1234"], timeout=15)
                        if r.returncode == 0 or is_port_open("127.0.0.1", 1234):
                            srv_ok = True
                            break
                    except Exception:
                        pass
                    time.sleep(1.5)

                if not srv_ok and not is_port_open("127.0.0.1", 1234):
                    msg = "LM Studio Local Server (port 1234) başlatılamadı."
                    emit(msg)
                    return {"ok": False, "message": msg}

                loaded = query_local_models(api_url, timeout=2.0)
                if loaded and (not model_key or any(model_key.lower() in m.lower() for m in loaded)):
                    emit(f"Model hazır: {loaded[0]}")
                    return {"ok": True, "message": f"Model hazır: {loaded[0]}", "models": loaded}

                if model_key:
                    ctx_len = str(int(float(settings.get("app_ctx_size", "4096") or 4096)))
                    emit(f"Model belleğe yükleniyor ({model_key}, ctx={ctx_len})...")
                    try:
                        r_load = _run_hidden([lms, "load", model_key, "--context-length", ctx_len, "--gpu", "auto", "-y"], timeout=180)
                        if r_load.returncode != 0:
                            r_load = _run_hidden([lms, "load", model_key, "-y"], timeout=180)
                        if r_load.returncode != 0:
                            err_txt = (r_load.stderr or r_load.stdout or "").strip()[:240]
                            msg = f"'{model_key}' yüklenemedi: {err_txt or 'Model adını kontrol et'}"
                            emit(msg)
                            return {"ok": False, "message": msg}
                    except Exception as e:
                        msg = f"Model yükleme hatası: {e}"
                        emit(msg)
                        return {"ok": False, "message": msg}

                loaded_after = query_local_models(api_url, timeout=3.0)
                emit(f"Hazır: {loaded_after[0] if loaded_after else model_key}")
                return {"ok": True, "message": f"LM Studio hazır ({loaded_after[0] if loaded_after else model_key})", "models": loaded_after}

            # --- MOD 2: TURBO LLAMA-SERVER ---
            if mode == "llama_server":
                llama_bin = find_llama_server()
                if not llama_bin:
                    msg = "llama-server bulunamadı. Kurmak için CMD'de: winget install ggml-org.llama.cpp"
                    emit(msg)
                    return {"ok": False, "message": msg}

                gguf_path = find_gguf_model(settings.get("app_gguf_path", ""), model_key)
                if not gguf_path:
                    msg = "GGUF model dosyası bulunamadı. Ayarlar → Uygulama & Motor Merkezi'nden GGUF yolunu seç."
                    emit(msg)
                    return {"ok": False, "message": msg}

                # Mevcut yonetilen llama-server varsa temizle
                stop_managed_llama_server()

                cpu_moe = str(int(float(settings.get("app_cpu_moe", "26") or 26)))
                ctx_size = str(int(float(settings.get("app_ctx_size", "4096") or 4096)))

                emit(f"Turbo llama-server açılıyor ({os.path.basename(gguf_path)})...")
                cmd = [
                    llama_bin,
                    "-m", gguf_path,
                    "--host", "127.0.0.1",
                    "--port", "1234",
                    "-ngl", "99",
                    "--n-cpu-moe", cpu_moe,
                    "-c", ctx_size,
                    "-np", "1",
                    "-t", "8",
                    "-tb", "8",
                    "-b", "512",
                    "-ub", "256",
                    "-fa", "on",
                    "-ctk", "q8_0",
                    "-ctv", "q8_0",
                    "--swa-full",
                    "--cache-reuse", "256",
                    "--reasoning", "off",
                    "--jinja",
                ]
                popen_kw: Dict[str, Any] = {
                    "stdout": subprocess.DEVNULL,
                    "stderr": subprocess.DEVNULL,
                }
                if os.name == "nt":
                    popen_kw["creationflags"] = CREATE_NO_WINDOW
                proc = subprocess.Popen(cmd, **popen_kw)
                DESKTOP_STATE["managed_llama_proc"] = proc

                # Sunucu hazir olana kadar bekle (en fazla 90 saniye)
                for _ in range(90):
                    if proc.poll() is not None:
                        msg = "Turbo llama-server beklenmedik şekilde kapandı (VRAM taşmış olabilir; CPU_MOE değerini 27 veya 28 yap)."
                        emit(msg)
                        return {"ok": False, "message": msg}
                    models_now = query_local_models(api_url, timeout=1.0)
                    if models_now:
                        emit(f"Turbo sunucu hazır: {os.path.basename(gguf_path)}")
                        return {"ok": True, "message": f"Turbo llama-server hazır ({os.path.basename(gguf_path)})", "models": models_now}
                    time.sleep(1.0)

                msg = "Turbo llama-server 90 saniyede yanıt vermedi."
                emit(msg)
                return {"ok": False, "message": msg}

            return {"ok": False, "message": f"Bilinmeyen motor modu: {mode}"}
        finally:
            DESKTOP_STATE["engine_busy"] = False


def stop_managed_llama_server():
    proc = DESKTOP_STATE.get("managed_llama_proc")
    if proc is not None:
        try:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except Exception:
                    proc.kill()
        except Exception:
            pass
        DESKTOP_STATE["managed_llama_proc"] = None


def unload_engine_sync(settings: Dict[str, str]) -> Dict[str, Any]:
    """Modeli VRAM'den bosaltir (managed llama-server durdurur veya lms unload --all calistirir)."""
    with _ENGINE_LOCK:
        DESKTOP_STATE["engine_busy"] = True
        try:
            stopped = []
            if DESKTOP_STATE.get("managed_llama_proc") is not None:
                stop_managed_llama_server()
                stopped.append("Turbo llama-server kapatıldı")

            lms = find_lms_cli()
            if lms:
                try:
                    r = _run_hidden([lms, "unload", "--all"], timeout=25)
                    if r.returncode == 0:
                        stopped.append("LM Studio modeli bellekten boşaltıldı")
                except Exception:
                    pass

            msg = " · ".join(stopped) if stopped else "Boşaltılacak aktif model bulunamadı."
            DESKTOP_STATE["engine_status_msg"] = msg
            return {"ok": True, "message": msg}
        finally:
            DESKTOP_STATE["engine_busy"] = False


def terminate_all_engines_sync() -> Dict[str, Any]:
    """MEIRCHAT kapatilirken hem yonetilen llama-server'i hem de LM Studio'yu tamamen sonlandirir."""
    stopped = []
    try:
        if DESKTOP_STATE.get("managed_llama_proc") is not None:
            stop_managed_llama_server()
            stopped.append("Turbo llama-server kapatıldı")
    except Exception:
        pass

    lms = find_lms_cli()
    if lms:
        try:
            _run_hidden([lms, "unload", "--all"], timeout=6)
        except Exception:
            pass
        try:
            _run_hidden([lms, "server", "stop"], timeout=5)
        except Exception:
            pass

    if os.name == "nt":
        for proc_name in ("LM Studio.exe", "lms.exe"):
            try:
                r = _run_hidden(["taskkill", "/IM", proc_name, "/T", "/F"], timeout=6)
                if r.returncode == 0:
                    stopped.append(f"{proc_name} sonlandırıldı")
            except Exception:
                pass
    else:
        try:
            _run_hidden(["pkill", "-f", "lm-studio"], timeout=4)
        except Exception:
            pass

    msg = " · ".join(stopped) if stopped else "Kapatma tamamlandı."
    DESKTOP_STATE["engine_status_msg"] = msg
    return {"ok": True, "message": msg}
