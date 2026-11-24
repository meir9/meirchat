import os
import json
import uuid
import random
import re
import base64
import asyncio
from datetime import datetime
from typing import Optional, List, Any, Dict
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, Response, RedirectResponse, JSONResponse
from pydantic import BaseModel
from PIL import Image
import io

from app.paths import STATIC_DIR, DATA_DIR, UPLOADS_DIR, APP_DIR, IS_FROZEN
from app.db import init_db, get_conn, get_settings, save_settings, get_db_backend_info
from app.cloud_config import IS_CLOUD, load_cloud_config
from app.storage import save_upload_file, resolve_upload_file, guess_media_type, is_cloud_storage_configured
from app.auth import (
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE,
    is_auth_enabled,
    verify_password,
    create_session_token,
    verify_session_token,
    verify_remote_token,
)
from app.engine import (
    MODEL_PROFILES,
    get_engine_overview,
    start_engine_sync,
    unload_engine_sync,
    record_heartbeat,
    trigger_desktop_shutdown,
    terminate_all_engines_sync,
)
from app.tts import get_public_voices, get_tts_diagnostics, synthesize_speech
from app.llm import build_messages, check_connection, check_active_status, resolve_llm_target, _KAGGLE_HEALTH_CACHE, stream_chat, replace_macros, summarize_messages, generate_reply_suggestions, simple_web_search, evaluate_ai_rulebook_judge, LAST_PROMPT_DEBUG
from app.lorebook import evaluate_lorebook
from app.rulebook import (
    init_state_from_rulebook,
    sync_state_with_rulebook,
    process_turn_rules,
    detect_select_updates,
    build_state_prompt,
    build_recency_anchor,
    collect_active_instructions,
    has_ai_judged_meters,
    build_ai_judge_prompt,
    apply_ai_judge_updates,
)

init_db()

app = FastAPI(title="MEIRCHAT")

os.makedirs(UPLOADS_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

_PUBLIC_PATHS = {
    "/login",
    "/api/auth/login",
    "/api/auth/logout",
    "/api/auth/status",
    "/api/health",
    "/api/remote-llm/register",
    "/manifest.json",
    "/sw.js",
    "/static/meirchat.png",
    "/static/meirchat.ico",
    "/favicon.ico",
}


@app.middleware("http")
async def _auth_and_cache_middleware(request: Request, call_next):
    path = request.url.path or ""
    if is_auth_enabled() and path not in _PUBLIC_PATHS:
        tok = request.cookies.get(SESSION_COOKIE_NAME)
        if not verify_session_token(tok):
            if path.startswith("/api/"):
                return JSONResponse({"detail": "Giriş gerekli"}, status_code=401)
            return RedirectResponse(url="/login", status_code=302)

    response = await call_next(request)
    if path in ("/", "/login", "/sw.js", "/manifest.json") or path.endswith((".html", ".js", ".css")):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.get("/api/health")
def api_health():
    return {"ok": True, "version": "21.0", "cloud": IS_CLOUD, "db": get_db_backend_info()["backend"]}


@app.get("/login")
def login_page():
    if not is_auth_enabled():
        return RedirectResponse(url="/", status_code=302)
    return FileResponse(os.path.join(STATIC_DIR, "login.html"))


@app.get("/api/auth/status")
def api_auth_status(request: Request):
    enabled = is_auth_enabled()
    ok = (not enabled) or verify_session_token(request.cookies.get(SESSION_COOKIE_NAME))
    return {"enabled": enabled, "authenticated": ok, "is_cloud": IS_CLOUD}


@app.post("/api/auth/login")
def api_auth_login(data: dict, request: Request):
    pw = str((data or {}).get("password") or "")
    if not verify_password(pw):
        raise HTTPException(status_code=401, detail="Şifre yanlış.")
    tok = create_session_token()
    resp = JSONResponse({"ok": True})
    is_https = (request.url.scheme == "https") or (request.headers.get("x-forwarded-proto", "").lower() == "https")
    resp.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=tok,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=is_https,
        path="/",
    )
    return resp


@app.post("/api/auth/logout")
def api_auth_logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie(SESSION_COOKIE_NAME, path="/")
    return resp


@app.get("/manifest.json")
def pwa_manifest():
    return FileResponse(os.path.join(STATIC_DIR, "manifest.json"), media_type="application/manifest+json")


@app.get("/sw.js")
def pwa_sw():
    return FileResponse(os.path.join(STATIC_DIR, "sw.js"), media_type="application/javascript")


@app.get("/uploads/{filename}")
def serve_upload(filename: str):
    path = resolve_upload_file(filename)
    if not path:
        raise HTTPException(status_code=404, detail="Görsel bulunamadı")
    return FileResponse(path, media_type=guess_media_type(path))


@app.get("/")
def root():
    return FileResponse(
        os.path.join(STATIC_DIR, "index.html"),
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

def _est_tokens(*texts: str) -> int:
    total_chars = sum(len(str(t or "")) for t in texts)
    return int(round(total_chars / 3.8)) if total_chars else 0

def _load_rulebook_by_id(conn, rb_id: Optional[int]) -> Dict:
    if not rb_id:
        return {}
    row = conn.execute("SELECT data_json FROM rulebooks WHERE id=?", (rb_id,)).fetchone()
    if not row:
        return {}
    try:
        return json.loads(row["data_json"] or "{}")
    except Exception:
        return {}

def _load_lorebooks_by_ids(conn, lids: List[int]) -> List[Dict]:
    entries = []
    for lid in (lids or []):
        row = conn.execute("SELECT entries_json FROM lorebooks WHERE id=?", (lid,)).fetchone()
        if row:
            try:
                part = json.loads(row["entries_json"] or "[]")
                if isinstance(part, list):
                    entries.extend(part)
            except Exception:
                pass
    return entries

def resolve_character_assets(conn, char_dict: Dict) -> Dict:
    try:
        lids = json.loads(char_dict.get("lorebook_ids_json") or "[]")
    except Exception:
        lids = []
    char_dict["lorebook_ids"] = lids
    entries = _load_lorebooks_by_ids(conn, lids)
    try:
        legacy_lb = json.loads(char_dict.get("lorebook_json") or "[]")
        if isinstance(legacy_lb, list) and legacy_lb:
            entries.extend(legacy_lb)
    except Exception:
        pass
    char_dict["lorebook"] = entries

    rb_data = _load_rulebook_by_id(conn, char_dict.get("rulebook_id"))
    if not rb_data:
        try:
            rb_data = json.loads(char_dict.get("rulebook_json") or "{}")
        except Exception:
            rb_data = {}
    char_dict["rulebook"] = rb_data
    char_dict["token_count"] = _est_tokens(
        char_dict.get("name"), char_dict.get("title"), char_dict.get("greeting"),
        char_dict.get("personality"), char_dict.get("scenario"), char_dict.get("example_dialogs")
    )
    return char_dict

def resolve_active_rulebook(conn, char_dict: Optional[Dict], persona_dict: Optional[Dict], chat_dict: Optional[Dict] = None) -> Dict:
    """Öncelik: Sohbete özel bağlı Rulebook -> Persona Rulebook -> Karakter Rulebook."""
    if chat_dict and chat_dict.get("rulebook_id"):
        crb = _load_rulebook_by_id(conn, chat_dict["rulebook_id"])
        if crb and (crb.get("meters") or crb.get("start_datetime")):
            return crb
    if persona_dict and persona_dict.get("rulebook_id"):
        prb = _load_rulebook_by_id(conn, persona_dict["rulebook_id"])
        if prb and (prb.get("meters") or prb.get("start_datetime")):
            return prb
    if char_dict:
        return char_dict.get("rulebook") or {}
    return {}

# --- AYARLAR VE BAĞLANTI ---

@app.get("/api/status")
async def api_status():
    s = get_settings()
    return await check_active_status(s)


@app.get("/api/cloud/status")
async def api_cloud_status():
    s = get_settings()
    db_info = get_db_backend_info()
    target = await resolve_llm_target(s)
    return {
        "version": "21.0",
        "is_cloud": IS_CLOUD,
        "auth_enabled": is_auth_enabled(),
        "db_backend": db_info["backend"],
        "db_label": db_info["label"],
        "db_synced": db_info["synced"],
        "storage_synced": is_cloud_storage_configured(),
        "active_backend": target["backend"],
        "active_label": target["label"],
        "cloud_llm_mode": s.get("cloud_llm_mode", "hybrid_auto"),
        "pc_llm_mode": s.get("pc_llm_mode", "local"),
        "remote_gpu_url": s.get("remote_gpu_url", ""),
        "remote_gpu_model": s.get("remote_gpu_model", ""),
        "remote_gpu_updated_at": s.get("remote_gpu_updated_at", ""),
        "cloud_api_url": s.get("cloud_api_url", "https://openrouter.ai/api/v1"),
        "cloud_api_has_key": bool((s.get("cloud_api_key") or "").strip()),
        "cloud_api_model": s.get("cloud_api_model", "google/gemma-3-27b-it:free"),
    }


@app.post("/api/remote-llm/register")
def api_register_remote_llm(data: dict, request: Request):
    """Kaggle / Colab GPU notebook'u acildiginda Cloudflare tunel adresini otomatik kaydeder."""
    tok = request.headers.get("x-remote-token") or (data or {}).get("token") or ""
    if not verify_remote_token(tok):
        raise HTTPException(status_code=401, detail="Geçersiz uzaktan kayıt anahtarı (MEIRCHAT_REMOTE_TOKEN)")
    api_url = str((data or {}).get("api_url") or "").strip().rstrip("/")
    if not api_url:
        raise HTTPException(status_code=400, detail="api_url gerekli")
    if not api_url.endswith("/v1"):
        api_url = api_url + "/v1"
    model_name = str((data or {}).get("model_name") or "").strip()
    now_str = datetime.now().strftime("%d.%m.%Y %H:%M")
    save_settings({
        "remote_gpu_url": api_url,
        "remote_gpu_model": model_name,
        "remote_gpu_updated_at": now_str,
    })
    _KAGGLE_HEALTH_CACHE.clear()
    return {"ok": True, "remote_gpu_url": api_url, "remote_gpu_model": model_name, "updated_at": now_str}

@app.get("/api/settings")
def api_get_settings():
    return get_settings()

@app.post("/api/settings")
def api_save_settings(data: dict):
    save_settings(data)
    return {"ok": True}

# --- TEK ÇATI UYGULAMA & MOTOR MERKEZİ ---

@app.get("/api/app/engine")
def api_app_engine_status():
    return get_engine_overview(get_settings())

@app.post("/api/app/engine/start")
async def api_app_engine_start(data: dict = None):
    if isinstance(data, dict) and data:
        allowed = {"app_engine_mode", "app_model_key", "app_gguf_path", "app_cpu_moe", "app_ctx_size", "app_unload_on_exit"}
        to_save = {k: v for k, v in data.items() if k in allowed}
        if to_save:
            save_settings(to_save)
    settings = get_settings()
    res = await asyncio.to_thread(start_engine_sync, settings)
    res["overview"] = get_engine_overview(settings)
    return res

@app.post("/api/app/engine/unload")
async def api_app_engine_unload():
    settings = get_settings()
    res = await asyncio.to_thread(unload_engine_sync, settings)
    res["overview"] = get_engine_overview(settings)
    return res

@app.post("/api/app/profile/{profile_name}")
def api_apply_model_profile(profile_name: str):
    key = (profile_name or "").strip().lower()
    if key not in MODEL_PROFILES:
        raise HTTPException(status_code=404, detail="Profil bulunamadı")
    save_settings(MODEL_PROFILES[key])
    return {"ok": True, "profile": key, "settings": get_settings()}

@app.post("/api/app/heartbeat")
def api_app_heartbeat():
    record_heartbeat()
    return {"ok": True}

@app.post("/api/app/shutdown")
def api_app_shutdown(data: dict = None):
    kill_lms = True if not isinstance(data, dict) else bool(data.get("kill_lmstudio", True))
    triggered = trigger_desktop_shutdown(kill_lmstudio=kill_lms)
    return {"ok": True, "triggered": triggered, "kill_lmstudio": kill_lms}


@app.get("/api/app/info")
def api_app_info():
    return {
        "version": "21.0",
        "is_exe": IS_FROZEN,
        "app_dir": APP_DIR,
        "data_dir": DATA_DIR,
        "static_dir": STATIC_DIR,
    }


@app.post("/api/app/open-data-dir")
def api_open_data_dir():
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.name == "nt":
        try:
            os.startfile(DATA_DIR)
            return {"ok": True, "path": DATA_DIR}
        except Exception as e:
            return {"ok": False, "path": DATA_DIR, "error": str(e)}
    return {"ok": True, "path": DATA_DIR}


# --- YÜKSEK KALİTELİ TTS (10 DİL x KADIN & ERKEK) ---

class TtsReq(BaseModel):
    text: str
    voice_id: str = "tr-F"
    rate: float = 1.0
    pitch: float = 1.0
    engine: Optional[str] = None
    google_api_key: Optional[str] = None


@app.get("/api/tts/voices")
def api_tts_voices():
    diag = get_tts_diagnostics()
    return {"voices": get_public_voices(), **diag}


@app.get("/api/tts/status")
def api_tts_status():
    return get_tts_diagnostics()


@app.post("/api/tts")
async def api_tts_synth(req: TtsReq):
    s = get_settings()
    voice_id = (req.voice_id or s.get("tts_voice", "tr-F") or "tr-F").strip()
    engine = (req.engine if req.engine is not None else s.get("tts_engine", "auto")) or "auto"
    gkey = req.google_api_key if req.google_api_key is not None else s.get("google_tts_api_key", "")
    audio_bytes, used_engine, used_voice, note = await synthesize_speech(
        req.text,
        voice_id=voice_id,
        rate=req.rate,
        pitch=req.pitch,
        engine=engine,
        google_api_key=gkey,
    )
    if not audio_bytes:
        raise HTTPException(status_code=503, detail=note or "Ses üretilemedi")
    safe_note = re.sub(r"[^ -~]", "", str(note or ""))[:220]
    safe_voice = re.sub(r"[^ -~]", "", str(used_voice or ""))[:80]
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "X-TTS-Engine": used_engine,
            "X-TTS-Voice": safe_voice,
            "X-TTS-Fallback": safe_note,
            "Cache-Control": "no-store",
        },
    )

# --- GÖRSEL YÜKLEME ---

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...), mode: str = "avatar"):
    content = await file.read()
    try:
        img = Image.open(io.BytesIO(content)).convert("RGB")
        if mode == "avatar":
            w, h = img.size
            side = min(w, h)
            left = (w - side) // 2
            top = (h - side) // 2
            img = img.crop((left, top, left + side, top + side))
            img = img.resize((512, 512), Image.Resampling.LANCZOS)
        elif mode == "chat":
            img.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
        else:
            img.thumbnail((1920, 1080), Image.Resampling.LANCZOS)
        filename = f"{uuid.uuid4().hex}.jpg"
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=88)
        url = save_upload_file(filename, buf.getvalue(), content_type="image/jpeg")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Görsel işlenemedi: {str(e)}")

# --- KARAKTER KARTI PARSER (.JSON veya .PNG) ---

@app.post("/api/parse-character-card")
async def parse_character_card(file: UploadFile = File(...)):
    content = await file.read()
    fname = (file.filename or "").lower()
    avatar_url = ""
    raw_data = None

    if fname.endswith(".png"):
        try:
            img = Image.open(io.BytesIO(content))
            info = img.info or {}
            b64_payload = info.get("ccv3") or info.get("chara")
            if b64_payload:
                raw_data = json.loads(base64.b64decode(b64_payload).decode("utf-8", errors="ignore"))
            rgb = img.convert("RGB")
            w, h = rgb.size
            side = min(w, h)
            rgb = rgb.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2))
            rgb = rgb.resize((512, 512), Image.Resampling.LANCZOS)
            out_name = f"{uuid.uuid4().hex}.jpg"
            cbuf = io.BytesIO()
            rgb.save(cbuf, "JPEG", quality=88)
            avatar_url = save_upload_file(out_name, cbuf.getvalue(), content_type="image/jpeg")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PNG kartı okunamadı: {str(e)}")
    else:
        try:
            raw_data = json.loads(content.decode("utf-8", errors="ignore"))
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"JSON kartı okunamadı: {str(e)}")

    if not isinstance(raw_data, dict):
        raise HTTPException(status_code=400, detail="Geçerli karakter kartı verisi bulunamadı.")

    d = raw_data.get("data") if isinstance(raw_data.get("data"), dict) else raw_data
    tags = d.get("tags") or raw_data.get("tags") or []
    if isinstance(tags, list):
        tags = ", ".join(str(t).strip() for t in tags if str(t).strip())

    personality = d.get("personality") or ""
    desc = d.get("description") or ""
    if desc and desc not in personality:
        personality = f"{desc}\n\n{personality}".strip()

    return {
        "name": str(d.get("name") or raw_data.get("name") or ""),
        "title": str(d.get("title") or d.get("creator_notes") or "")[:100],
        "greeting": str(d.get("first_mes") or d.get("greeting") or ""),
        "personality": personality,
        "scenario": str(d.get("scenario") or ""),
        "example_dialogs": str(d.get("mes_example") or d.get("example_dialogs") or ""),
        "tags": str(tags),
        "avatar_url": avatar_url or str(d.get("avatar_url") or ""),
    }

# --- BAĞIMSIZ LOREBOOK YÖNETİMİ ---

class LorebookIn(BaseModel):
    name: str
    description: str = ""
    cover_url: str = ""
    tags: str = ""
    is_draft: int = 0
    entries: Any = []

@app.get("/api/lorebooks")
def list_lorebooks():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM lorebooks ORDER BY updated_at DESC").fetchall()]
    conn.close()
    for r in rows:
        try:
            r["entries"] = json.loads(r.get("entries_json") or "[]")
        except Exception:
            r["entries"] = []
    return rows

@app.post("/api/lorebooks")
def create_lorebook(lb: LorebookIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    cur = conn.execute(
        "INSERT INTO lorebooks (name, description, cover_url, tags, is_draft, entries_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (lb.name, lb.description, lb.cover_url, lb.tags, lb.is_draft, json.dumps(lb.entries, ensure_ascii=False), now, now),
    )
    lid = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": lid}

@app.put("/api/lorebooks/{lid}")
def update_lorebook(lid: int, lb: LorebookIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    conn.execute(
        "UPDATE lorebooks SET name=?, description=?, cover_url=?, tags=?, is_draft=?, entries_json=?, updated_at=? WHERE id=?",
        (lb.name, lb.description, lb.cover_url, lb.tags, lb.is_draft, json.dumps(lb.entries, ensure_ascii=False), now, lid),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/lorebooks/{lid}")
def delete_lorebook(lid: int):
    conn = get_conn()
    conn.execute("DELETE FROM lorebooks WHERE id=?", (lid,))
    chars = conn.execute("SELECT id, lorebook_ids_json FROM characters").fetchall()
    for ch in chars:
        try:
            lids = [x for x in json.loads(ch["lorebook_ids_json"] or "[]") if x != lid]
            conn.execute("UPDATE characters SET lorebook_ids_json=? WHERE id=?", (json.dumps(lids), ch["id"]))
        except Exception:
            pass
    conn.commit()
    conn.close()
    return {"ok": True}

# --- BAĞIMSIZ RULEBOOK YÖNETİMİ ---

class RulebookIn(BaseModel):
    name: str
    description: str = ""
    tags: str = ""
    cover_url: str = ""
    is_draft: int = 0
    data: Any = {}

@app.get("/api/rulebooks")
def list_rulebooks():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM rulebooks ORDER BY updated_at DESC").fetchall()]
    bot_counts = {
        r["rulebook_id"]: r["cnt"]
        for r in conn.execute("SELECT rulebook_id, COUNT(*) as cnt FROM characters WHERE rulebook_id IS NOT NULL GROUP BY rulebook_id").fetchall()
    }
    conn.close()
    for r in rows:
        try:
            r["data"] = json.loads(r.get("data_json") or "{}")
        except Exception:
            r["data"] = {}
        r["bot_count"] = bot_counts.get(r["id"], 0)
    return rows

@app.post("/api/rulebooks")
def create_rulebook(rb: RulebookIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    cur = conn.execute(
        "INSERT INTO rulebooks (name, description, tags, cover_url, is_draft, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (rb.name, rb.description, rb.tags, rb.cover_url, rb.is_draft, json.dumps(rb.data, ensure_ascii=False), now, now),
    )
    rid = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": rid}

@app.put("/api/rulebooks/{rid}")
def update_rulebook(rid: int, rb: RulebookIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    conn.execute(
        "UPDATE rulebooks SET name=?, description=?, tags=?, cover_url=?, is_draft=?, data_json=?, updated_at=? WHERE id=?",
        (rb.name, rb.description, rb.tags, rb.cover_url, rb.is_draft, json.dumps(rb.data, ensure_ascii=False), now, rid),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/rulebooks/playtest-eval")
def playtest_evaluate(data: dict):
    rb = data.get("rulebook") or {}
    st = data.get("state") or {}
    msg = str(data.get("message") or "")
    role = str(data.get("role") or "user")
    new_st, notes, notifs = process_turn_rules(rb, st, msg, sender_role=role)
    return {
        "state": new_st,
        "notes": notes,
        "notifications": notifs,
        "prompt_preview": build_state_prompt(rb, new_st, notes),
    }

@app.delete("/api/rulebooks/{rid}")
def delete_rulebook(rid: int):
    conn = get_conn()
    conn.execute("DELETE FROM rulebooks WHERE id=?", (rid,))
    conn.execute("UPDATE characters SET rulebook_id=NULL WHERE rulebook_id=?", (rid,))
    conn.execute("UPDATE personas SET rulebook_id=NULL WHERE rulebook_id=?", (rid,))
    conn.commit()
    conn.close()
    return {"ok": True}

# --- PERSONA ---

class PersonaIn(BaseModel):
    name: str
    description: str = ""
    avatar_url: str = ""
    rulebook_id: Optional[int] = None
    is_default: int = 0

@app.get("/api/personas")
def list_personas():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM personas ORDER BY is_default DESC, id ASC").fetchall()]
    rb_names = {r["id"]: r["name"] for r in conn.execute("SELECT id, name FROM rulebooks").fetchall()}
    conn.close()
    for r in rows:
        r["rulebook_name"] = rb_names.get(r.get("rulebook_id"), "")
    return rows

@app.post("/api/personas")
def create_persona(p: PersonaIn):
    conn = get_conn()
    if p.is_default:
        conn.execute("UPDATE personas SET is_default = 0")
    now = datetime.now().isoformat()
    cur = conn.execute(
        "INSERT INTO personas (name, description, avatar_url, rulebook_id, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (p.name, p.description, p.avatar_url, p.rulebook_id, p.is_default, now),
    )
    pid = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": pid}

@app.put("/api/personas/{pid}")
def update_persona(pid: int, p: PersonaIn):
    conn = get_conn()
    if p.is_default:
        conn.execute("UPDATE personas SET is_default = 0")
    conn.execute(
        "UPDATE personas SET name=?, description=?, avatar_url=?, rulebook_id=?, is_default=? WHERE id=?",
        (p.name, p.description, p.avatar_url, p.rulebook_id, p.is_default, pid),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/personas/{pid}")
def delete_persona(pid: int):
    conn = get_conn()
    conn.execute("DELETE FROM personas WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True}

# --- KARAKTERLER ---

class CharacterIn(BaseModel):
    name: str
    title: str = ""
    greeting: str = ""
    personality: str = ""
    scenario: str = ""
    example_dialogs: str = ""
    tags: str = ""
    avatar_url: str = ""
    lorebook_ids: List[int] = []
    rulebook_id: Optional[int] = None
    allow_in_groups: int = 1
    is_draft: int = 0
    lorebook: Any = []
    rulebook: Any = {}

@app.get("/api/characters")
def list_characters():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM characters ORDER BY updated_at DESC").fetchall()]
    msg_counts = {
        r["character_id"]: r["cnt"]
        for r in conn.execute("""
            SELECT c.character_id, COUNT(m.id) AS cnt
            FROM chats c JOIN messages m ON m.chat_id = c.id
            WHERE c.character_id IS NOT NULL
            GROUP BY c.character_id
        """).fetchall()
    }
    res = []
    for r in rows:
        d = resolve_character_assets(conn, r)
        d["message_count"] = msg_counts.get(d["id"], 0)
        res.append(d)
    conn.close()
    return res

@app.post("/api/characters")
def create_character(c: CharacterIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    cur = conn.execute(
        """INSERT INTO characters
        (name, title, greeting, personality, scenario, example_dialogs, tags, avatar_url,
         lorebook_json, rulebook_json, lorebook_ids_json, rulebook_id, allow_in_groups, is_draft, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            c.name, c.title, c.greeting, c.personality, c.scenario, c.example_dialogs, c.tags, c.avatar_url,
            json.dumps(c.lorebook, ensure_ascii=False), json.dumps(c.rulebook, ensure_ascii=False),
            json.dumps(c.lorebook_ids), c.rulebook_id, c.allow_in_groups, c.is_draft, now, now
        ),
    )
    cid = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": cid}

@app.put("/api/characters/{cid}")
def update_character(cid: int, c: CharacterIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    conn.execute(
        """UPDATE characters SET
        name=?, title=?, greeting=?, personality=?, scenario=?, example_dialogs=?, tags=?, avatar_url=?,
        lorebook_ids_json=?, rulebook_id=?, allow_in_groups=?, is_draft=?, updated_at=?
        WHERE id=?""",
        (
            c.name, c.title, c.greeting, c.personality, c.scenario, c.example_dialogs, c.tags, c.avatar_url,
            json.dumps(c.lorebook_ids), c.rulebook_id, c.allow_in_groups, c.is_draft, now, cid
        ),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/characters/{cid}")
def delete_character(cid: int):
    conn = get_conn()
    conn.execute("DELETE FROM characters WHERE id=?", (cid,))
    conn.commit()
    conn.close()
    return {"ok": True}

# --- GRUP SOHBETLERİ ---

class GroupIn(BaseModel):
    name: str
    title: str = ""
    greeting: str = ""
    scenario: str = ""
    tags: str = ""
    avatar_url: str = ""
    member_ids: List[int] = []
    first_speaker_id: Optional[int] = None
    lorebook_ids: List[int] = []
    is_draft: int = 0

@app.get("/api/groups")
def list_groups():
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("SELECT * FROM groups ORDER BY updated_at DESC").fetchall()]
    conn.close()
    for r in rows:
        try:
            r["member_ids"] = json.loads(r.get("member_ids_json") or "[]")
        except Exception:
            r["member_ids"] = []
        try:
            r["lorebook_ids"] = json.loads(r.get("lorebook_ids_json") or "[]")
        except Exception:
            r["lorebook_ids"] = []
    return rows

@app.post("/api/groups")
def create_group(g: GroupIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    cur = conn.execute(
        """INSERT INTO groups
        (name, title, greeting, scenario, tags, avatar_url, member_ids_json, first_speaker_id, lorebook_ids_json, is_draft, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (g.name, g.title, g.greeting, g.scenario, g.tags, g.avatar_url,
         json.dumps(g.member_ids), g.first_speaker_id, json.dumps(g.lorebook_ids), g.is_draft, now, now),
    )
    gid = cur.lastrowid
    conn.commit()
    conn.close()
    return {"id": gid}

@app.put("/api/groups/{gid}")
def update_group(gid: int, g: GroupIn):
    conn = get_conn()
    now = datetime.now().isoformat()
    conn.execute(
        """UPDATE groups SET
        name=?, title=?, greeting=?, scenario=?, tags=?, avatar_url=?,
        member_ids_json=?, first_speaker_id=?, lorebook_ids_json=?, is_draft=?, updated_at=?
        WHERE id=?""",
        (g.name, g.title, g.greeting, g.scenario, g.tags, g.avatar_url,
         json.dumps(g.member_ids), g.first_speaker_id, json.dumps(g.lorebook_ids), g.is_draft, now, gid),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.delete("/api/groups/{gid}")
def delete_group(gid: int):
    conn = get_conn()
    conn.execute("DELETE FROM groups WHERE id=?", (gid,))
    conn.commit()
    conn.close()
    return {"ok": True}

# --- SOHBETLER ---

class ChatCreate(BaseModel):
    character_id: Optional[int] = None
    group_id: Optional[int] = None
    persona_id: Optional[int] = None

@app.get("/api/chats")
def list_all_chats(grouped: bool = False):
    conn = get_conn()
    rows = conn.execute("""
        SELECT c.*,
               ch.name AS char_name, ch.avatar_url AS char_avatar, ch.title AS char_title,
               g.name AS group_name, g.avatar_url AS group_avatar, g.title AS group_title,
               p.name AS persona_name, p.avatar_url AS persona_avatar,
               (SELECT content FROM messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
               (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count
        FROM chats c
        LEFT JOIN characters ch ON c.character_id = ch.id
        LEFT JOIN groups g ON c.group_id = g.id
        LEFT JOIN personas p ON c.persona_id = p.id
        ORDER BY c.updated_at DESC
    """).fetchall()
    conn.close()
    all_items = [dict(r) for r in rows]
    if not grouped:
        return all_items

    # Her chatbot / grup icin tek bir satir (en guncel sohbet + toplam kayitli sohbet sayisi)
    counts: Dict[str, int] = {}
    for it in all_items:
        key = f"g:{it['group_id']}" if it.get("group_id") else f"c:{it.get('character_id')}"
        counts[key] = counts.get(key, 0) + 1

    seen = set()
    grouped_list = []
    for it in all_items:
        key = f"g:{it['group_id']}" if it.get("group_id") else f"c:{it.get('character_id')}"
        if key in seen:
            continue
        seen.add(key)
        it["chat_count"] = counts.get(key, 1)
        grouped_list.append(it)
    return grouped_list


@app.post("/api/chats/bulk-delete")
def bulk_delete_chats(data: dict):
    ids = [int(x) for x in (data.get("chat_ids") or []) if str(x).isdigit()]
    if not ids:
        return {"ok": True, "deleted": 0}
    conn = get_conn()
    q_marks = ",".join("?" for _ in ids)
    conn.execute(f"DELETE FROM chats WHERE id IN ({q_marks})", ids)
    conn.commit()
    conn.close()
    return {"ok": True, "deleted": len(ids)}

@app.post("/api/rulebooks/{rid}/add-option")
def add_rulebook_select_option(rid: int, data: dict):
    meter_id = data.get("meter_id")
    option = str(data.get("option", "")).strip()
    if not meter_id or not option:
        raise HTTPException(status_code=400, detail="meter_id ve option gerekli")
    conn = get_conn()
    row = conn.execute("SELECT data_json FROM rulebooks WHERE id=?", (rid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Rulebook bulunamadı")
    rb_data = json.loads(row["data_json"] or "{}")
    for m in rb_data.get("meters", []):
        if (m.get("id") or m.get("name")) == meter_id:
            m["type"] = "select"
            opts = list(m.get("options") or [])
            if option not in opts:
                opts.append(option)
            m["options"] = opts
            break
    conn.execute("UPDATE rulebooks SET data_json=?, updated_at=? WHERE id=?", (json.dumps(rb_data, ensure_ascii=False), datetime.now().isoformat(), rid))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/characters/{cid}/chats")
def list_character_chats(cid: int):
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("""
        SELECT c.*,
               ch.name AS char_name, ch.avatar_url AS char_avatar,
               p.name AS persona_name, p.avatar_url AS persona_avatar,
               (SELECT content FROM messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
               (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count
        FROM chats c
        LEFT JOIN characters ch ON c.character_id = ch.id
        LEFT JOIN personas p ON c.persona_id = p.id
        WHERE c.character_id=?
        ORDER BY c.updated_at DESC
    """, (cid,)).fetchall()]
    conn.close()
    return rows

@app.get("/api/groups/{gid}/chats")
def list_group_chats(gid: int):
    conn = get_conn()
    rows = [dict(r) for r in conn.execute("""
        SELECT c.*,
               g.name AS group_name, g.avatar_url AS group_avatar,
               p.name AS persona_name, p.avatar_url AS persona_avatar,
               (SELECT content FROM messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message,
               (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS message_count
        FROM chats c
        LEFT JOIN groups g ON c.group_id = g.id
        LEFT JOIN personas p ON c.persona_id = p.id
        WHERE c.group_id=?
        ORDER BY c.updated_at DESC
    """, (gid,)).fetchall()]
    conn.close()
    return rows

@app.post("/api/chats")
def create_chat(req: ChatCreate):
    conn = get_conn()
    persona_id = req.persona_id
    if not persona_id:
        p = conn.execute("SELECT id FROM personas ORDER BY is_default DESC, id ASC LIMIT 1").fetchone()
        persona_id = p["id"] if p else None
    persona_row = conn.execute("SELECT * FROM personas WHERE id=?", (persona_id,)).fetchone() if persona_id else None
    persona = dict(persona_row) if persona_row else None
    user_name = persona["name"] if persona else "Kullanıcı"
    now = datetime.now().isoformat()
    title = f"Sohbet - {datetime.now().strftime('%d.%m %H:%M')}"

    init_state = {}
    greeting = ""
    speaker_name = ""
    speaker_avatar = ""

    if req.character_id:
        row = conn.execute("SELECT * FROM characters WHERE id=?", (req.character_id,)).fetchone()
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="Karakter bulunamadı")
        char = resolve_character_assets(conn, dict(row))
        active_rb = resolve_active_rulebook(conn, char, persona)
        init_state = init_state_from_rulebook(active_rb)
        greeting = replace_macros(char["greeting"] or "", char["name"], user_name)
        speaker_name = char["name"]
        speaker_avatar = char.get("avatar_url", "")
    elif req.group_id:
        grp_row = conn.execute("SELECT * FROM groups WHERE id=?", (req.group_id,)).fetchone()
        if not grp_row:
            conn.close()
            raise HTTPException(status_code=404, detail="Grup bulunamadı")
        grp = dict(grp_row)
        active_rb = resolve_active_rulebook(conn, None, persona)
        init_state = init_state_from_rulebook(active_rb) if active_rb else {}
        speaker_name = grp["name"]
        speaker_avatar = grp.get("avatar_url", "")
        if grp.get("first_speaker_id"):
            fs = conn.execute("SELECT name, avatar_url FROM characters WHERE id=?", (grp["first_speaker_id"],)).fetchone()
            if fs:
                speaker_name = fs["name"]
                speaker_avatar = fs["avatar_url"] or ""
        greeting = replace_macros(grp["greeting"] or "", speaker_name, user_name)
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Karakter veya grup seçilmeli")

    cur = conn.execute(
        "INSERT INTO chats (character_id, group_id, persona_id, title, state_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (req.character_id, req.group_id, persona_id, title, json.dumps(init_state, ensure_ascii=False), now, now),
    )
    chat_id = cur.lastrowid

    if greeting.strip():
        swipes = json.dumps([greeting], ensure_ascii=False)
        conn.execute(
            "INSERT INTO messages (chat_id, role, speaker_name, speaker_avatar, content, swipes_json, active_swipe, created_at) VALUES (?, 'assistant', ?, ?, ?, ?, 0, ?)",
            (chat_id, speaker_name, speaker_avatar, greeting, swipes, now),
        )

    conn.commit()
    conn.close()
    return {"id": chat_id}

@app.post("/api/chats/{chat_id}/clone")
def clone_chat(chat_id: int):
    conn = get_conn()
    chat = conn.execute("SELECT * FROM chats WHERE id=?", (chat_id,)).fetchone()
    if not chat:
        conn.close()
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    now = datetime.now().isoformat()
    cur = conn.execute(
        """INSERT INTO chats (character_id, group_id, persona_id, title, state_json, summary, pinned_memory, last_summarized_msg_id, lore_active_json, bg_url, rulebook_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (chat["character_id"], chat["group_id"], chat["persona_id"], f"{chat['title']} (Kopya)",
         chat["state_json"], chat["summary"], chat["pinned_memory"], chat["last_summarized_msg_id"], chat["lore_active_json"], chat["bg_url"], chat["rulebook_id"], now, now),
    )
    new_id = cur.lastrowid
    msgs = conn.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY id ASC", (chat_id,)).fetchall()
    for m in msgs:
        conn.execute(
            "INSERT INTO messages (chat_id, role, speaker_name, speaker_avatar, content, swipes_json, active_swipe, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (new_id, m["role"], m["speaker_name"], m["speaker_avatar"], m["content"], m["swipes_json"], m["active_swipe"], m["image_url"] or "", now),
        )
    conn.commit()
    conn.close()
    return {"id": new_id}

@app.put("/api/chats/{chat_id}/persona")
def set_chat_persona(chat_id: int, data: dict):
    conn = get_conn()
    conn.execute("UPDATE chats SET persona_id=? WHERE id=?", (data.get("persona_id"), chat_id))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.put("/api/chats/{chat_id}/title")
def set_chat_title(chat_id: int, data: dict):
    title = str(data.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Başlık boş olamaz")
    conn = get_conn()
    conn.execute("UPDATE chats SET title=? WHERE id=?", (title[:100], chat_id))
    conn.commit()
    conn.close()
    return {"ok": True, "title": title[:100]}

@app.put("/api/chats/{chat_id}/rulebook")
def set_chat_rulebook(chat_id: int, data: dict):
    rb_id = data.get("rulebook_id")
    rb_id = int(rb_id) if rb_id else None
    conn = get_conn()
    chat = conn.execute("SELECT state_json FROM chats WHERE id=?", (chat_id,)).fetchone()
    if not chat:
        conn.close()
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    rb_data = _load_rulebook_by_id(conn, rb_id) if rb_id else {}
    try:
        cur_state = json.loads(chat["state_json"] or "{}")
    except Exception:
        cur_state = {}
    new_state = sync_state_with_rulebook(rb_data, cur_state) if rb_data.get("meters") else cur_state
    conn.execute(
        "UPDATE chats SET rulebook_id=?, state_json=? WHERE id=?",
        (rb_id, json.dumps(new_state, ensure_ascii=False), chat_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/chats/{chat_id}/messages/bulk-delete")
def bulk_delete_messages(chat_id: int, data: dict):
    ids = [int(x) for x in (data.get("message_ids") or []) if str(x).isdigit()]
    if not ids:
        return {"ok": True, "deleted": 0}
    conn = get_conn()
    q_marks = ",".join("?" for _ in ids)
    conn.execute(f"DELETE FROM messages WHERE chat_id=? AND id IN ({q_marks})", [chat_id, *ids])
    conn.commit()
    conn.close()
    return {"ok": True, "deleted": len(ids)}


@app.post("/api/chats/{chat_id}/judge")
async def run_ai_rulebook_judge(chat_id: int):
    settings = get_settings()
    if settings.get("ai_judge_enabled", "1") != "1":
        return {"changed": False}
    conn = get_conn()
    chat = conn.execute("SELECT * FROM chats WHERE id=?", (chat_id,)).fetchone()
    if not chat:
        conn.close()
        return {"changed": False}
    chat_d = dict(chat)
    persona_row = conn.execute("SELECT * FROM personas WHERE id=?", (chat_d["persona_id"],)).fetchone() if chat_d.get("persona_id") else None
    persona = dict(persona_row) if persona_row else None
    char = None
    if chat_d.get("character_id"):
        crow = conn.execute("SELECT * FROM characters WHERE id=?", (chat_d["character_id"],)).fetchone()
        if crow:
            char = resolve_character_assets(conn, dict(crow))
    active_rb = resolve_active_rulebook(conn, char, persona, chat_d)
    if not has_ai_judged_meters(active_rb):
        conn.close()
        return {"changed": False}
    rows = [dict(r) for r in conn.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY id DESC LIMIT 4", (chat_id,)).fetchall()]
    rows.reverse()
    try:
        cur_state = json.loads(chat_d.get("state_json") or "{}")
    except Exception:
        cur_state = {}
    conn.close()

    last_user = next((m.get("content", "") for m in reversed(rows) if m.get("role") == "user"), "")
    last_bot = next((m.get("content", "") for m in reversed(rows) if m.get("role") == "assistant"), "")
    if not last_bot.strip():
        return {"changed": False}

    char_name = char["name"] if char else "Karakter"
    user_name = persona["name"] if persona else "Kullanıcı"
    j_prompt = build_ai_judge_prompt(active_rb, cur_state, last_user, last_bot, char_name, user_name)
    if not j_prompt:
        return {"changed": False}

    updates = await evaluate_ai_rulebook_judge(settings, j_prompt)
    if not updates:
        return {"changed": False}

    c2 = get_conn()
    fresh = c2.execute("SELECT state_json FROM chats WHERE id=?", (chat_id,)).fetchone()
    try:
        fresh_state = json.loads(fresh["state_json"] or "{}") if fresh else cur_state
    except Exception:
        fresh_state = cur_state

    new_state, notifs = apply_ai_judge_updates(active_rb, fresh_state, updates)
    if not notifs:
        c2.close()
        return {"changed": False}

    c2.execute("UPDATE chats SET state_json=? WHERE id=?", (json.dumps(new_state, ensure_ascii=False), chat_id))
    c2.commit()
    c2.close()

    a_notes, a_caps = collect_active_instructions(active_rb, new_state)
    return {
        "changed": True,
        "state": new_state,
        "active_notes": a_notes,
        "active_captions": a_caps,
        "notifications": notifs,
    }

@app.post("/api/chats/{chat_id}/suggest")
async def suggest_replies(chat_id: int):
    conn = get_conn()
    chat = conn.execute("SELECT * FROM chats WHERE id=?", (chat_id,)).fetchone()
    if not chat:
        conn.close()
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    chat_d = dict(chat)
    persona_row = conn.execute("SELECT * FROM personas WHERE id=?", (chat_d["persona_id"],)).fetchone() if chat_d.get("persona_id") else None
    persona = dict(persona_row) if persona_row else None
    char = None
    if chat_d.get("character_id"):
        crow = conn.execute("SELECT * FROM characters WHERE id=?", (chat_d["character_id"],)).fetchone()
        if crow:
            char = dict(crow)
    elif chat_d.get("group_id"):
        grow = conn.execute("SELECT * FROM groups WHERE id=?", (chat_d["group_id"],)).fetchone()
        if grow:
            char = dict(grow)
    rows = [dict(r) for r in conn.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY id ASC", (chat_id,)).fetchall()]
    conn.close()
    settings = get_settings()
    suggestions = await generate_reply_suggestions(settings, char or {}, persona, rows)
    return {"suggestions": suggestions}

@app.put("/api/chats/{chat_id}/state")
def update_chat_state(chat_id: int, data: dict):
    conn = get_conn()
    conn.execute("UPDATE chats SET state_json=? WHERE id=?", (json.dumps(data, ensure_ascii=False), chat_id))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.put("/api/chats/{chat_id}/memory")
def update_chat_memory(chat_id: int, data: dict):
    conn = get_conn()
    conn.execute(
        "UPDATE chats SET summary=?, pinned_memory=? WHERE id=?",
        (str(data.get("summary", "")), str(data.get("pinned_memory", "")), chat_id),
    )
    conn.commit()
    conn.close()
    return {"ok": True}

async def _auto_summarize_if_needed(chat_id: int):
    try:
        settings = get_settings()
        if settings.get("auto_memory_enabled", "1") != "1":
            return
        every = max(4, int(settings.get("auto_summarize_every", "8")))
        conn = get_conn()
        chat = conn.execute("SELECT summary, last_summarized_msg_id FROM chats WHERE id=?", (chat_id,)).fetchone()
        if not chat:
            conn.close()
            return
        last_id = int(chat["last_summarized_msg_id"] or 0)
        unsummarized = [dict(r) for r in conn.execute(
            "SELECT * FROM messages WHERE chat_id=? AND id>? ORDER BY id ASC", (chat_id, last_id)
        ).fetchall()]
        conn.close()
        if len(unsummarized) >= every + 2:
            chunk = unsummarized[:-4]
            new_sum = await summarize_messages(settings, chat["summary"] or "", chunk)
            if new_sum and new_sum != (chat["summary"] or ""):
                c2 = get_conn()
                c2.execute(
                    "UPDATE chats SET summary=?, last_summarized_msg_id=? WHERE id=?",
                    (new_sum, chunk[-1]["id"], chat_id),
                )
                c2.commit()
                c2.close()
    except Exception:
        pass

@app.post("/api/chats/{chat_id}/summarize")
async def manual_summarize(chat_id: int):
    conn = get_conn()
    chat = conn.execute("SELECT * FROM chats WHERE id=?", (chat_id,)).fetchone()
    if not chat:
        conn.close()
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    msgs = [dict(r) for r in conn.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY id ASC", (chat_id,)).fetchall()]
    conn.close()
    if len(msgs) < 4:
        return {"summary": chat["summary"] or ""}
    settings = get_settings()
    new_sum = await summarize_messages(settings, chat["summary"] or "", msgs)
    conn = get_conn()
    conn.execute("UPDATE chats SET summary=?, last_summarized_msg_id=? WHERE id=?", (new_sum, msgs[-1]["id"], chat_id))
    conn.commit()
    conn.close()
    return {"summary": new_sum}

@app.delete("/api/chats/{chat_id}")
def delete_chat(chat_id: int):
    conn = get_conn()
    conn.execute("DELETE FROM chats WHERE id=?", (chat_id,))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.get("/api/chats/{chat_id}/messages")
def get_messages(chat_id: int):
    conn = get_conn()
    chat = conn.execute("SELECT * FROM chats WHERE id=?", (chat_id,)).fetchone()
    if not chat:
        conn.close()
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")
    rows = conn.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY id ASC", (chat_id,)).fetchall()
    chat_d = dict(chat)
    try:
        chat_d["state"] = json.loads(chat_d.get("state_json") or "{}")
    except Exception:
        chat_d["state"] = {}

    persona_row = conn.execute("SELECT * FROM personas WHERE id=?", (chat_d["persona_id"],)).fetchone() if chat_d.get("persona_id") else None
    persona = dict(persona_row) if persona_row else None
    char = None
    if chat_d.get("character_id"):
        crow = conn.execute("SELECT * FROM characters WHERE id=?", (chat_d["character_id"],)).fetchone()
        if crow:
            char = resolve_character_assets(conn, dict(crow))

    active_rb = resolve_active_rulebook(conn, char, persona, chat_d)
    chat_d["active_rulebook"] = active_rb
    chat_d["active_rulebook_id"] = (chat_d.get("rulebook_id") or (persona["rulebook_id"] if (persona and persona.get("rulebook_id")) else (char.get("rulebook_id") if char else None)))
    chat_d["active_notes"] = []
    chat_d["active_captions"] = []
    if active_rb.get("meters"):
        chat_d["state"] = sync_state_with_rulebook(active_rb, chat_d["state"])
        a_notes, a_caps = collect_active_instructions(active_rb, chat_d["state"])
        chat_d["active_notes"] = a_notes
        chat_d["active_captions"] = a_caps

    # Aktif Lorebook kayıtlarını 'Neden?' penceresi için hesapla
    lore_entries_get = list(char.get("lorebook") or []) if char else []
    if chat_d.get("group_id"):
        grp_r = conn.execute("SELECT lorebook_ids_json FROM groups WHERE id=?", (chat_d["group_id"],)).fetchone()
        if grp_r:
            try:
                lore_entries_get.extend(_load_lorebooks_by_ids(conn, json.loads(grp_r["lorebook_ids_json"] or "[]")))
            except Exception:
                pass
    chat_d["has_lorebook"] = len(lore_entries_get) > 0
    chat_d["active_lore"] = []
    if lore_entries_get:
        try:
            l_trk = json.loads(chat_d.get("lore_active_json") or "{}")
        except Exception:
            l_trk = {}
        u_nm = persona["name"] if persona else "Kullanıcı"
        c_nm = char["name"] if char else "Karakter"
        _, _, _, a_lore = evaluate_lorebook(
            lore_entries_get, [dict(r) for r in rows], l_trk, c_nm, u_nm,
            extra_scan_text=chat_d.get("pinned_memory") or "",
        )
        chat_d["active_lore"] = a_lore
    chat_d["last_debug"] = LAST_PROMPT_DEBUG.get(chat_id)
    conn.close()

    res = []
    for r in rows:
        d = dict(r)
        try:
            d["swipes"] = json.loads(d["swipes_json"] or "[]")
        except Exception:
            d["swipes"] = [d["content"]]
        if not d["swipes"]:
            d["swipes"] = [d["content"]]
        res.append(d)
    return {"chat": chat_d, "messages": res}

# --- MESAJ İŞLEMLERİ ---

class MessageEdit(BaseModel):
    content: str

@app.put("/api/messages/{mid}")
def edit_message(mid: int, req: MessageEdit):
    conn = get_conn()
    row = conn.execute("SELECT * FROM messages WHERE id=?", (mid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    swipes = json.loads(row["swipes_json"] or "[]")
    idx = row["active_swipe"]
    if not swipes:
        swipes = [req.content]
        idx = 0
    elif 0 <= idx < len(swipes):
        swipes[idx] = req.content
    conn.execute("UPDATE messages SET content=?, swipes_json=? WHERE id=?", (req.content, json.dumps(swipes, ensure_ascii=False), mid))
    conn.commit()
    conn.close()
    return {"ok": True}

@app.post("/api/messages/{mid}/swipe")
def swipe_message(mid: int, data: dict):
    direction = data.get("direction", 1)
    conn = get_conn()
    row = conn.execute("SELECT * FROM messages WHERE id=?", (mid,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    swipes = json.loads(row["swipes_json"] or "[]")
    if not swipes:
        conn.close()
        return {"ok": False}
    new_idx = (row["active_swipe"] + direction) % len(swipes)
    conn.execute("UPDATE messages SET active_swipe=?, content=? WHERE id=?", (new_idx, swipes[new_idx], mid))
    conn.commit()
    conn.close()
    return {"active_swipe": new_idx, "content": swipes[new_idx], "total": len(swipes)}

@app.delete("/api/messages/{mid}")
def delete_message(mid: int):
    conn = get_conn()
    conn.execute("DELETE FROM messages WHERE id=?", (mid,))
    conn.commit()
    conn.close()
    return {"ok": True}

# --- STREAMING SOHBET ---

class SendReq(BaseModel):
    content: Optional[str] = None
    mode: str = "send"
    speaker_id: Optional[int] = None
    image_url: Optional[str] = None
    web_search: bool = False

def _parse_director_and_dice(text: str):
    director_cmds = []
    clean_lines = []
    for line in (text or "").splitlines():
        st = line.strip()
        if st.lower().startswith("/cmd "):
            director_cmds.append(st[5:].strip())
        elif st.lower().startswith("/roll ") or st.lower().startswith("/zar"):
            m = re.search(r"(\d+)d(\d+)", st.lower())
            n, sides = (int(m.group(1)), int(m.group(2))) if m else (1, 20)
            rolls = [random.randint(1, max(2, sides)) for _ in range(min(n, 20))]
            total = sum(rolls)
            clean_lines.append(f"*[Zar {n}d{sides}: {rolls} → Toplam: {total}]*")
        else:
            clean_lines.append(line)
    return "\n".join(clean_lines).strip(), " | ".join(director_cmds)

@app.post("/api/chats/{chat_id}/stream")
async def chat_stream(chat_id: int, req: SendReq):
    conn = get_conn()
    chat = dict(conn.execute("SELECT * FROM chats WHERE id=?", (chat_id,)).fetchone() or {})
    if not chat:
        conn.close()
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    persona_row = conn.execute("SELECT * FROM personas WHERE id=?", (chat["persona_id"],)).fetchone() if chat["persona_id"] else None
    persona = dict(persona_row) if persona_row else None
    user_name = persona["name"] if persona else "Kullanıcı"

    group_info = None
    speaker_char = None
    char = None
    extra_group_lore = []

    if chat.get("group_id"):
        grp = dict(conn.execute("SELECT * FROM groups WHERE id=?", (chat["group_id"],)).fetchone())
        group_info = grp
        try:
            g_lids = json.loads(grp.get("lorebook_ids_json") or "[]")
            extra_group_lore = _load_lorebooks_by_ids(conn, g_lids)
        except Exception:
            extra_group_lore = []
        member_ids = json.loads(grp.get("member_ids_json") or "[]")
        members = []
        for mid in member_ids:
            mrow = conn.execute("SELECT * FROM characters WHERE id=?", (mid,)).fetchone()
            if mrow:
                members.append(resolve_character_assets(conn, dict(mrow)))
        if req.speaker_id:
            speaker_char = next((m for m in members if m["id"] == req.speaker_id), members[0] if members else None)
        else:
            speaker_char = random.choice(members) if members else None
        char = speaker_char or {"name": grp["name"], "lorebook": [], "rulebook": {}}
    else:
        crow = conn.execute("SELECT * FROM characters WHERE id=?", (chat["character_id"],)).fetchone()
        char = resolve_character_assets(conn, dict(crow))
        speaker_char = char

    now = datetime.now().isoformat()
    clean_text, director_cmd = _parse_director_and_dice(req.content or "")

    attached_img = str(req.image_url or "").strip()
    if req.mode == "send" and (clean_text or director_cmd or attached_img):
        if clean_text or attached_img:
            conn.execute(
                "INSERT INTO messages (chat_id, role, speaker_name, content, swipes_json, active_swipe, director_cmd, image_url, created_at) VALUES (?, 'user', ?, ?, ?, 0, ?, ?, ?)",
                (chat_id, user_name, clean_text, json.dumps([clean_text], ensure_ascii=False), director_cmd, attached_img, now),
            )
            conn.execute("UPDATE chats SET updated_at=? WHERE id=?", (now, chat_id))
            conn.commit()

    rows = [dict(r) for r in conn.execute("SELECT * FROM messages WHERE chat_id=? ORDER BY id ASC", (chat_id,)).fetchall()]
    if req.mode == "retry" and rows and rows[-1]["role"] == "user":
        if not director_cmd and rows[-1].get("director_cmd"):
            director_cmd = rows[-1]["director_cmd"]

    target_msg_id = None
    if req.mode == "regenerate" and rows and rows[-1]["role"] == "assistant":
        target_msg_id = rows[-1]["id"]
        history = rows[:-1]
    else:
        history = rows

    lore_entries = list(char.get("lorebook") or []) + list(extra_group_lore)
    lore_tracker = json.loads(chat.get("lore_active_json") or "{}")
    _spd = get_settings().get("speed_mode", "turbo")
    _lore_cap = 1400 if _spd == "ultra" else (2000 if _spd == "turbo" else (2800 if _spd == "balanced" else 3600))
    always_lore_blocks, lore_blocks, new_lore_tracker, active_lore_meta = evaluate_lorebook(
        lore_entries, history, lore_tracker, char["name"], user_name,
        max_total_chars=_lore_cap,
        extra_scan_text=chat.get("pinned_memory") or "",
    )

    rulebook = resolve_active_rulebook(conn, char, persona, chat)
    state = json.loads(chat.get("state_json") or "{}")
    rule_notes, notifications = [], []
    has_rb = bool(rulebook.get("meters") or rulebook.get("start_datetime"))
    if req.mode == "send" and has_rb:
        state, rule_notes, notifications = process_turn_rules(rulebook, state, clean_text)
        conn.execute(
            "UPDATE chats SET state_json=?, lore_active_json=? WHERE id=?",
            (json.dumps(state, ensure_ascii=False), json.dumps(new_lore_tracker), chat_id),
        )
        conn.commit()
    else:
        if has_rb:
            state = sync_state_with_rulebook(rulebook, state)
        conn.execute("UPDATE chats SET lore_active_json=? WHERE id=?", (json.dumps(new_lore_tracker), chat_id))
        conn.commit()

    state_prompt = build_state_prompt(rulebook, state, rule_notes)
    recency_anchor = build_recency_anchor(rulebook, state, rule_notes, user_name)
    conn.close()

    web_context = ""
    if req.web_search and clean_text:
        web_context = await simple_web_search(clean_text)

    settings = get_settings()
    llm_messages = build_messages(
        settings, char, persona, history,
        lore_blocks=lore_blocks,
        always_lore_blocks=always_lore_blocks,
        state_prompt=state_prompt,
        recency_anchor=recency_anchor,
        summary=chat.get("summary", ""),
        pinned_memory=chat.get("pinned_memory", ""),
        director_cmd=director_cmd,
        web_context=web_context,
        continue_mode=(req.mode == "continue"),
        group_info=group_info,
        speaker_char=speaker_char,
    )

    total_chars = sum(len(str(m.get("content") or "")) for m in llm_messages)
    LAST_PROMPT_DEBUG[chat_id] = {
        "est_tokens": int(round(total_chars / 3.0)),
        "total_chars": total_chars,
        "msg_count": len(llm_messages),
        "roles": [m.get("role") for m in llm_messages],
        "sys_chars": len(str(llm_messages[0].get("content") or "")) if llm_messages else 0,
        "lore_count": len(lore_blocks) + len(always_lore_blocks),
        "last_user_preview": str(llm_messages[-1].get("content") or "")[-380:] if llm_messages else "",
    }

    async def event_generator():
        if (has_rb and state) or active_lore_meta:
            a_notes, a_caps = collect_active_instructions(rulebook, state) if (has_rb and state) else ([], [])
            yield f"data: {json.dumps({'type': 'state', 'state': state, 'active_notes': a_notes, 'active_captions': a_caps, 'active_lore': active_lore_meta}, ensure_ascii=False)}\n\n"
        if notifications:
            yield f"data: {json.dumps({'type': 'notify', 'items': notifications}, ensure_ascii=False)}\n\n"

        last_u_txt = next((str(m.get("content") or "") for m in reversed(history) if m.get("role") == "user"), "")
        live_stream = settings.get("live_stream", "0") == "1"
        async for ev in stream_chat(settings, llm_messages, user_name=user_name, last_user_text=last_u_txt, emit_tokens=live_stream, chat_id=chat_id):
            if ev["type"] == "done":
                final_text = ev["text"]
                c2 = get_conn()
                t_now = datetime.now().isoformat()
                if req.mode == "regenerate" and target_msg_id:
                    old = c2.execute("SELECT * FROM messages WHERE id=?", (target_msg_id,)).fetchone()
                    swipes = json.loads(old["swipes_json"] or "[]")
                    swipes.append(final_text)
                    new_idx = len(swipes) - 1
                    c2.execute(
                        "UPDATE messages SET content=?, swipes_json=?, active_swipe=? WHERE id=?",
                        (final_text, json.dumps(swipes, ensure_ascii=False), new_idx, target_msg_id),
                    )
                    ev["message_id"] = target_msg_id
                else:
                    cur = c2.execute(
                        "INSERT INTO messages (chat_id, role, speaker_name, speaker_avatar, content, swipes_json, active_swipe, created_at) VALUES (?, 'assistant', ?, ?, ?, ?, 0, ?)",
                        (chat_id, char["name"], char.get("avatar_url", ""), final_text, json.dumps([final_text], ensure_ascii=False), t_now),
                    )
                    ev["message_id"] = cur.lastrowid

                if rulebook.get("meters"):
                    cur_chat = c2.execute("SELECT state_json FROM chats WHERE id=?", (chat_id,)).fetchone()
                    cur_st = json.loads(cur_chat["state_json"] or "{}") if cur_chat else state
                    updated_st, bot_notifs = detect_select_updates(rulebook, cur_st, final_text)
                    if bot_notifs:
                        c2.execute("UPDATE chats SET state_json=? WHERE id=?", (json.dumps(updated_st, ensure_ascii=False), chat_id))
                        yield f"data: {json.dumps({'type': 'state', 'state': updated_st}, ensure_ascii=False)}\n\n"
                        yield f"data: {json.dumps({'type': 'notify', 'items': bot_notifs}, ensure_ascii=False)}\n\n"

                c2.execute("UPDATE chats SET updated_at=? WHERE id=?", (t_now, chat_id))
                c2.commit()
                c2.close()
                asyncio.create_task(_auto_summarize_if_needed(chat_id))
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
