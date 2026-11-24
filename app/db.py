import sqlite3
import json
import os
from datetime import datetime
from typing import Dict, Any

from app.paths import DATA_DIR, DB_PATH, LEGACY_DB_PATH
import re
from app.cloud_config import load_cloud_config

_ID_TABLES = {"personas", "lorebooks", "rulebooks", "characters", "groups", "chats", "messages"}


class _DualRow(dict):
    """Hem dict (row['col']) hem indeks (row[0]) erisimini destekler."""
    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


def _replace_qmarks_outside_quotes(sql: str) -> str:
    out = []
    in_sq = False
    i = 0
    n = len(sql)
    while i < n:
        ch = sql[i]
        if ch == "'":
            if in_sq and i + 1 < n and sql[i + 1] == "'":
                out.append("''")
                i += 2
                continue
            in_sq = not in_sq
            out.append(ch)
        elif ch == "?" and not in_sq:
            out.append("%s")
        elif ch == "%" and not in_sq:
            out.append("%%")
        else:
            out.append(ch)
        i += 1
    return "".join(out)


def _translate_sql_to_pg(sql: str):
    """SQLite sorgusunu Supabase PostgreSQL uyumlu sorguya cevirir."""
    s = sql.strip()
    s_low = s.lower()

    if s_low.startswith("pragma foreign_keys"):
        return None, False

    m_pi = re.match(r"^pragma\s+table_info\(\s*([a-zA-Z0-9_]+)\s*\)\s*;?$", s, flags=re.IGNORECASE)
    if m_pi:
        tbl = m_pi.group(1)
        return f"SELECT column_name AS name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '{tbl}'", False

    # CREATE TABLE AUTOINCREMENT -> SERIAL PRIMARY KEY
    s = re.sub(r"\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b", "SERIAL PRIMARY KEY", s, flags=re.IGNORECASE)

    # INSERT OR IGNORE INTO settings ...
    if re.match(r"^INSERT\s+OR\s+IGNORE\s+INTO\s+settings\b", s, flags=re.IGNORECASE):
        s = re.sub(r"^INSERT\s+OR\s+IGNORE\s+INTO\b", "INSERT INTO", s, flags=re.IGNORECASE)
        if "on conflict" not in s.lower():
            s = s.rstrip(";") + " ON CONFLICT (key) DO NOTHING"

    # INSERT OR REPLACE INTO settings ...
    elif re.match(r"^INSERT\s+OR\s+REPLACE\s+INTO\s+settings\b", s, flags=re.IGNORECASE):
        s = re.sub(r"^INSERT\s+OR\s+REPLACE\s+INTO\b", "INSERT INTO", s, flags=re.IGNORECASE)
        if "on conflict" not in s.lower():
            s = s.rstrip(";") + " ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"

    # INSERT INTO <id_table> -> RETURNING id
    wants_id = False
    m_ins = re.match(r"^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\b", s, flags=re.IGNORECASE)
    if m_ins and m_ins.group(1).lower() in _ID_TABLES and "returning" not in s.lower():
        s = s.rstrip(";") + " RETURNING id"
        wants_id = True

    s = _replace_qmarks_outside_quotes(s)
    return s, wants_id


class _PgCursorWrapper:
    def __init__(self, raw_cur):
        self._cur = raw_cur
        self.lastrowid = None

    def execute(self, sql: str, params=None):
        pg_sql, wants_id = _translate_sql_to_pg(sql)
        if pg_sql is None:
            return self
        if params is None:
            self._cur.execute(pg_sql)
        else:
            self._cur.execute(pg_sql, tuple(params))
        if wants_id:
            row = self._cur.fetchone()
            if row is not None:
                self.lastrowid = row["id"] if isinstance(row, dict) else row[0]
        return self

    def fetchone(self):
        row = self._cur.fetchone()
        if row is None:
            return None
        return _DualRow(row) if isinstance(row, dict) else row

    def fetchall(self):
        rows = self._cur.fetchall()
        return [_DualRow(r) if isinstance(r, dict) else r for r in rows]

    def close(self):
        try:
            self._cur.close()
        except Exception:
            pass


class _PgConnWrapper:
    is_postgres = True

    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self):
        from psycopg.rows import dict_row
        return _PgCursorWrapper(self._conn.cursor(row_factory=dict_row))

    def execute(self, sql: str, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass


def _normalize_pg_url(url: str) -> str:
    u = (url or "").strip()
    if u.startswith("postgres://"):
        u = "postgresql://" + u[len("postgres://"):]
    if u and "sslmode=" not in u and ("localhost" not in u and "127.0.0.1" not in u):
        sep = "&" if "?" in u else "?"
        u = f"{u}{sep}sslmode=require"
    return u


def is_postgres_mode() -> bool:
    return bool(load_cloud_config().get("database_url"))


def get_db_backend_info() -> Dict[str, Any]:
    cfg = load_cloud_config()
    if cfg.get("database_url"):
        return {"backend": "postgres", "label": "Supabase Bulut (PostgreSQL)", "synced": True}
    return {"backend": "sqlite", "label": "Yerel SQLite", "synced": False}



def _db_user_content_count(path: str) -> int:
    try:
        c = sqlite3.connect(path)
        total = 0
        for tbl in ("characters", "lorebooks", "rulebooks", "chats", "messages"):
            try:
                total += int(c.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0])
            except Exception:
                pass
        c.close()
        return total
    except Exception:
        return 0


def _migrate_legacy_db():
    """Eski data/hikaye.db veritabanini kayipsiz olarak data/meirchat.db adina tasir."""
    os.makedirs(DATA_DIR, exist_ok=True)
    if not os.path.isfile(LEGACY_DB_PATH):
        return
    if not os.path.isfile(DB_PATH):
        for suffix in ("", "-wal", "-shm"):
            src_f = LEGACY_DB_PATH + suffix
            dst_f = DB_PATH + suffix
            if os.path.isfile(src_f):
                os.replace(src_f, dst_f)
        return
    # Ikisi de varsa ve meirchat.db bos iken hikaye.db doluysa, eski veriyi kurtar
    if _db_user_content_count(DB_PATH) == 0 and _db_user_content_count(LEGACY_DB_PATH) > 0:
        backup_empty = os.path.join(DATA_DIR, "meirchat_bos_yedek.db")
        try:
            os.replace(DB_PATH, backup_empty)
        except Exception:
            pass
        for suffix in ("", "-wal", "-shm"):
            src_f = LEGACY_DB_PATH + suffix
            dst_f = DB_PATH + suffix
            if os.path.isfile(src_f):
                os.replace(src_f, dst_f)

_OLD_PROMPT_V16 = (
    "Sen akıcı, duygulu ve sürükleyici bir Türkçe rol yapma anlatıcısısın.\n"
    "1. Saf ve Kusursuz Türkçe: Hem anlatım hem tüm konuşmalar yalnızca doğal, günlük İstanbul Türkçesi olsun. "
    "Yabancı dilde cümle, çeviri, kırık Türkçe taklidi veya parantez içi açıklama/sahne notu (`(gülümser)`, `(İngilizce bilmez)` vb.) KESİNLİKLE yazma.\n"
    "2. Duygu ve Karakter Sadakati: Her karakterin duygusunu, bakışını, ses tonunu ve beden dilini kendi kişiliğine birebir sadık kalarak canlı yaşat. "
    "Karakterlerin Lorebook bilgisini metne açıklama olarak kopyalama, davranışlarıyla hissettir.\n"
    "3. Kesin Rol Sınırı: Yalnızca diğer karakterleri (NPC) ve ortamı yönet. {{user}} adına ASLA konuşma, bakış, gülümseme, düşünce veya eylem yazma; doğrudan karşı karakterin tepkisiyle başla.\n"
    "4. Tekrarsız ve Temiz Biçim: Aynı cümleyi veya tepkiyi tekrarlama. Anlatım ve eylemleri *yıldız içinde* ayrı paragraflarda, "
    "konuşmaları ayrı paragrafta `***KarakterAdı:*** “Konuşma...”` şeklinde tırnak içinde yaz. 3-4 akıcı paragraf yazıp dur."
)

EMOTIONAL_SYSTEM_PROMPT = (
    "Sen yetenekli bir Türkçe hikâye yazarı ve rol yapma partnerisin.\n"
    "1. Konuya sadık kal: Her cevap, {{user}} adlı kişinin son mesajına doğrudan ve somut bir karşılık versin. "
    "Önce söylenene ya da yapılana tepki ver, sonra sahneyi bir adım ilerlet. Konu dışına çıkma; alakasız olay, karakter veya mekân ekleme.\n"
    "2. Karaktere sadık kal: Kişiliği, geçmişi ve konuşma tarzını karakter kartına göre yaşat; kendiyle çelişme.\n"
    "3. Duyguyu göster, açıklama: Bakış, nefes, ses tonu, beden dili ve küçük hareketlerle hissettir. "
    "'Üzüldü' demek yerine üzüntüyü yaşat.\n"
    "4. Doğal Türkçe: Günlük, akıcı, gerçek bir insanın konuşacağı Türkçe kullan. Yabancı kelime, çeviri veya parantez içi not yazma. "
    "Kısa ve uzun cümleleri karıştır.\n"
    "5. Rol sınırı: {{user}} adına konuşma, düşünme veya hareket etme. Cevabı, {{user}}'ın karşılık verebileceği yerde bırak.\n"
    "6. Biçim: Eylem ve anlatımı *yıldız içinde*, konuşmaları “tırnak” içinde yaz. 2-3 paragraf yaz, sonra dur.\n"
    "7. Kurgu yetişkinlere yöneliktir ve tüm karakterler yetişkindir. Sahneyi sansürlemeden, kullanıcının yönlendirdiği "
    "yönde ve doğal biçimde ilerlet; uyarı, ahlak dersi veya özür ekleme."
)

DEFAULT_SETTINGS = {
    "api_url": "http://localhost:1234/v1",
    "model_name": "",
    "preset": "gemma4_rp",
    "speed_mode": "turbo",
    "temperature": "0.80",
    "max_tokens": "320",
    "top_p": "0.92",
    "top_k": "40",
    "min_p": "0.05",
    "rep_penalty": "1.03",
    "presence_penalty": "0.0",
    "frequency_penalty": "0.0",
    "context_messages": "8",
    "max_prompt_chars": "5500",
    "auto_summarize_every": "16",
    "auto_memory_enabled": "0",
    "strict_consistency": "1",
    "no_think_prefix": "1",
    "no_think_literal": "0",
    "ai_judge_enabled": "0",
    "live_stream": "0",
    "story_tone": "emotional",
    "system_prompt": EMOTIONAL_SYSTEM_PROMPT,
    "theme": "dark",
    "font_size": "16",
    "chat_bg_url": "",
    "profile_username": "meir9",
    "profile_name": "Deniz",
    "profile_avatar": "",
    "profile_highlights": "",
    "show_nsfw": "1",
    "blur_nsfw": "0",
    "ui_lang": "tr",
    "preferred_lang": "Türkçe",
    "skip_persona_picker": "0",
    "tts_voice": "tr-F",
    "tts_engine": "auto",
    "google_tts_api_key": "",
    "tts_rate": "1.0",
    "tts_pitch": "1.0",
    "tts_auto": "0",
    "bubble_user_color": "#0d2b4e",
    "bubble_bot_color": "#15161a",
    "rp_italic_color": "#4ade80",
    "app_engine_mode": "lmstudio",
    "app_model_key": "gemma",
    "app_gguf_path": "",
    "app_cpu_moe": "26",
    "app_ctx_size": "4096",
    "app_unload_on_exit": "0",
    "cloud_llm_mode": "hybrid_auto",
    "pc_llm_mode": "local",
    "remote_gpu_url": "",
    "remote_gpu_model": "",
    "remote_gpu_updated_at": "",
    "cloud_api_url": "https://openrouter.ai/api/v1",
    "cloud_api_key": "",
    "cloud_api_model": "google/gemma-3-27b-it:free",
}

DEFAULT_METER_VISUALS = {
    "saat": ("clock", "amber", "shown"),
    "para": ("coin", "green", "shown"),
    "kariyer_gunlugu": ("book", "teal", "shown"),
    "partner_bilgisi": ("heart", "salmon", "shown"),
    "gorunum": ("sparkle", "powder", "shown"),
    "profil_sozlesme": ("shirt", "royal", "panel"),
    "kadro": ("shield", "blue", "shown"),
    "unluluk": ("star", "purple", "panel"),
    "sakatlik": ("heart", "crimson", "panel"),
    "skandal_riski": ("alert", "red", "panel"),
    "baskinlik": ("flame", "contrast", "shown"),
    "sarhoslik": ("wine", "orange", "shown"),
    "sigara": ("cigarette", "gray", "panel"),
    "envanter": ("backpack", "ochre", "panel"),
    "m1": ("globe", "sky", "panel"),
    "lokasyon": ("globe", "sky", "shown"),
}

DEFAULT_FUTBOLCU_LOCATIONS = [
    ("Skyland Penthouse Ev/İstanbul", "{{user}} İstanbul'daki Skyland Penthouse evinde."),
    ("İstanbul", "{{user}} İstanbul'da, şehrin kalabalığı ve temposu içinde."),
    ("Rams Park/İstanbul", "{{user}} Rams Park'ta; Galatasaray takım stadyumu ve iç saha maç ortamı."),
    ("Kemerburgaz Metin Oktay Tesisleri", "{{user}} Kemerburgaz Metin Oktay Tesisleri'nde; Galatasaray antrenman ve tesis ortamı."),
    ("Sarıyer Villa/İstanbul", "{{user}} İstanbul Sarıyer'deki ultra lüks villasında."),
    ("Miami Luxury Villa/Miami", "{{user}} Florida Miami'deki ultra lüks villasında."),
    ("Miami Luxury Island Villa/Miami", "{{user}} Florida Miami'deki özel adasındaki ultra lüks villasında."),
    ("Miami", "{{user}} Miami'de; sıcak hava, deniz ve plaj havası."),
    ("Londra", "{{user}} Londra'da; yağmurlu, kalabalık ve hareketli bir şehir."),
    ("Manchester", "{{user}} Manchester'da; futbol kültürünün güçlü olduğu bir şehir."),
    ("Madrid", "{{user}} Madrid'de; canlı gece hayatı ve güçlü futbol kültürü."),
    ("Moskova", "{{user}} Moskova'da; soğuk ve görkemli bir şehir."),
    ("İngiltere", "{{user}} İngiltere'de."),
    ("İspanya", "{{user}} İspanya'da."),
    ("Almanya", "{{user}} Almanya'da."),
    ("Fransa", "{{user}} Fransa'da."),
    ("Belçika", "{{user}} Belçika'da."),
    ("Tayland", "{{user}} Tayland'da; tropik ve sıcak bir ortam."),
    ("Maldivler", "{{user}} Maldivler'de; tatil, deniz ve huzur."),
]

def get_conn():
    cfg = load_cloud_config()
    db_url = cfg.get("database_url", "")
    if db_url:
        try:
            import psycopg
        except ImportError as exc:
            raise RuntimeError(
                "Supabase bulut baglantisi icin 'psycopg[binary]' paketi gerekli. "
                "Lutfen uygulama_kur.bat veya 'pip install psycopg[binary]' calistir."
            ) from exc
        raw = psycopg.connect(
            _normalize_pg_url(db_url),
            prepare_threshold=None,
            connect_timeout=10,
        )
        return _PgConnWrapper(raw)
    _migrate_legacy_db()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def _ensure_columns(cur: sqlite3.Cursor, table: str, columns: Dict[str, str]):
    existing = {row["name"] for row in cur.execute(f"PRAGMA table_info({table})").fetchall()}
    for col, col_def in columns.items():
        if col not in existing:
            cur.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")

def init_db():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")

    cur.execute("""
    CREATE TABLE IF NOT EXISTS personas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        is_default INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS lorebooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        entries_json TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS rulebooks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        data_json TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS characters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        title TEXT DEFAULT '',
        greeting TEXT DEFAULT '',
        personality TEXT DEFAULT '',
        scenario TEXT DEFAULT '',
        example_dialogs TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        lorebook_json TEXT DEFAULT '[]',
        rulebook_json TEXT DEFAULT '{}',
        lorebook_ids_json TEXT DEFAULT '[]',
        rulebook_id INTEGER DEFAULT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        title TEXT DEFAULT '',
        greeting TEXT DEFAULT '',
        scenario TEXT DEFAULT '',
        avatar_url TEXT DEFAULT '',
        member_ids_json TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER,
        group_id INTEGER,
        persona_id INTEGER,
        title TEXT DEFAULT 'Yeni Sohbet',
        state_json TEXT DEFAULT '{}',
        summary TEXT DEFAULT '',
        pinned_memory TEXT DEFAULT '',
        last_summarized_msg_id INTEGER DEFAULT 0,
        lore_active_json TEXT DEFAULT '{}',
        bg_url TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        speaker_name TEXT DEFAULT '',
        speaker_avatar TEXT DEFAULT '',
        content TEXT NOT NULL,
        swipes_json TEXT DEFAULT '[]',
        active_swipe INTEGER DEFAULT 0,
        director_cmd TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
    """)

    _ensure_columns(cur, "personas", {
        "rulebook_id": "INTEGER DEFAULT NULL",
    })
    _ensure_columns(cur, "lorebooks", {
        "cover_url": "TEXT DEFAULT ''",
        "tags": "TEXT DEFAULT ''",
        "is_draft": "INTEGER DEFAULT 0",
    })
    _ensure_columns(cur, "rulebooks", {
        "tags": "TEXT DEFAULT ''",
        "cover_url": "TEXT DEFAULT ''",
        "is_draft": "INTEGER DEFAULT 0",
    })
    _ensure_columns(cur, "groups", {
        "tags": "TEXT DEFAULT ''",
        "first_speaker_id": "INTEGER DEFAULT NULL",
        "lorebook_ids_json": "TEXT DEFAULT '[]'",
        "is_draft": "INTEGER DEFAULT 0",
    })
    _ensure_columns(cur, "characters", {
        "title": "TEXT DEFAULT ''",
        "greeting": "TEXT DEFAULT ''",
        "personality": "TEXT DEFAULT ''",
        "scenario": "TEXT DEFAULT ''",
        "example_dialogs": "TEXT DEFAULT ''",
        "tags": "TEXT DEFAULT ''",
        "avatar_url": "TEXT DEFAULT ''",
        "lorebook_json": "TEXT DEFAULT '[]'",
        "rulebook_json": "TEXT DEFAULT '{}'",
        "lorebook_ids_json": "TEXT DEFAULT '[]'",
        "rulebook_id": "INTEGER DEFAULT NULL",
        "created_at": "TEXT DEFAULT ''",
        "allow_in_groups": "INTEGER DEFAULT 1",
        "is_draft": "INTEGER DEFAULT 0",
        "updated_at": "TEXT DEFAULT ''",
    })
    _ensure_columns(cur, "chats", {
        "group_id": "INTEGER",
        "persona_id": "INTEGER",
        "title": "TEXT DEFAULT 'Yeni Sohbet'",
        "state_json": "TEXT DEFAULT '{}'",
        "summary": "TEXT DEFAULT ''",
        "pinned_memory": "TEXT DEFAULT ''",
        "last_summarized_msg_id": "INTEGER DEFAULT 0",
        "lore_active_json": "TEXT DEFAULT '{}'",
        "bg_url": "TEXT DEFAULT ''",
        "rulebook_id": "INTEGER DEFAULT NULL",
        "created_at": "TEXT DEFAULT ''",
        "updated_at": "TEXT DEFAULT ''",
    })
    _ensure_columns(cur, "messages", {
        "speaker_name": "TEXT DEFAULT ''",
        "speaker_avatar": "TEXT DEFAULT ''",
        "swipes_json": "TEXT DEFAULT '[]'",
        "active_swipe": "INTEGER DEFAULT 0",
        "director_cmd": "TEXT DEFAULT ''",
        "image_url": "TEXT DEFAULT ''",
        "created_at": "TEXT DEFAULT ''",
    })

    # Eski gömülü lorebook/rulebook verilerini bağımsız tablolara aktar
    now = datetime.now().isoformat()
    chars = cur.execute("SELECT id, name, lorebook_json, rulebook_json, lorebook_ids_json, rulebook_id FROM characters").fetchall()
    for ch in chars:
        try:
            old_lore = json.loads(ch["lorebook_json"] or "[]")
            linked_lids = json.loads(ch["lorebook_ids_json"] or "[]")
        except Exception:
            old_lore, linked_lids = [], []
        if isinstance(old_lore, list) and len(old_lore) > 0 and not linked_lids:
            c_lb = cur.execute(
                "INSERT INTO lorebooks (name, description, entries_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (f"{ch['name']} - Lorebook", "Karakterden aktarıldı", json.dumps(old_lore, ensure_ascii=False), now, now),
            )
            cur.execute("UPDATE characters SET lorebook_ids_json=?, lorebook_json='[]' WHERE id=?", (json.dumps([c_lb.lastrowid]), ch["id"]))

        try:
            old_rb = json.loads(ch["rulebook_json"] or "{}")
        except Exception:
            old_rb = {}
        if isinstance(old_rb, dict) and old_rb.get("meters") and ch["rulebook_id"] is None:
            c_rb = cur.execute(
                "INSERT INTO rulebooks (name, description, data_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (f"{ch['name']} - Rulebook", "Karakterden aktarıldı", json.dumps(old_rb, ensure_ascii=False), now, now),
            )
            cur.execute("UPDATE characters SET rulebook_id=?, rulebook_json='{}' WHERE id=?", (c_rb.lastrowid, ch["id"]))

    # Mevcut rulebook'larda eksik ikon/renk/lokasyon/minutes_per_turn alanlarını otomatik tamamla
    rbs = cur.execute("SELECT id, data_json FROM rulebooks").fetchall()
    for rb_row in rbs:
        try:
            rb_data = json.loads(rb_row["data_json"] or "{}")
            changed = False
            if rb_data.get("minutes_per_turn") is None:
                rb_data["minutes_per_turn"] = 3
                changed = True

            has_clock_m = any(str(m.get("type", "")).lower() == "clock" for m in rb_data.get("meters", []))
            if not has_clock_m and rb_data.get("meters"):
                rb_data["meters"].insert(0, {
                    "id": "saat",
                    "name": "Tarih ve Saat",
                    "type": "clock",
                    "icon": "clock",
                    "color": "amber",
                    "hud": "shown",
                    "visible": True,
                    "userEditable": True,
                    "tellModel": True,
                    "mode": "datetime",
                    "start": rb_data.get("start_datetime", "2026-06-03 11:30"),
                    "stepMin": int(rb_data.get("minutes_per_turn") or 3),
                    "stepEvery": 0,
                    "skips": True,
                    "ruleDims": ["tod"],
                    "todBands": [
                        {"label": "Sabah", "to": 359, "instr": "Sabah saatleri (06:00-11:59). Saati 24 saatlik dilimde göster.", "revealed": True, "override": False},
                        {"label": "Gündüz", "to": 719, "instr": "Gün ortası (12:00-17:59). Saati 24 saatlik dilimde göster.", "revealed": True, "override": False},
                        {"label": "Akşam", "to": 1019, "instr": "Akşam saatleri (18:00-22:59). Saati 24 saatlik dilimde göster.", "revealed": True, "override": False},
                        {"label": "Gece", "to": 1439, "instr": "Gece ve sabaha karşı saatleri (23:00-05:59). Saati 24 saatlik dilimde göster.", "revealed": True, "override": False},
                    ]
                })
                changed = True

            for m in rb_data.get("meters", []):
                mid = str(m.get("id") or "").lower()
                mname = str(m.get("name") or "").lower()
                if not m.get("icon") or not m.get("color"):
                    vis = DEFAULT_METER_VISUALS.get(mid) or DEFAULT_METER_VISUALS.get(mname)
                    if vis:
                        m.setdefault("icon", vis[0])
                        m.setdefault("color", vis[1])
                        m.setdefault("hud", vis[2])
                    else:
                        t = m.get("type", "bar")
                        m.setdefault("icon", "globe" if t == "select" else ("backpack" if t == "inventory" else ("coin" if t == "counter" else ("sparkle" if t == "text" else "shield"))))
                        m.setdefault("color", "sky" if t == "select" else ("ochre" if t == "inventory" else ("green" if t == "counter" else "blue")))
                        m.setdefault("hud", "shown")
                    changed = True
                if m.get("type") == "select" and not m.get("options") and isinstance(m.get("items"), list):
                    m["options"] = [it.get("label") or it.get("id") for it in m["items"] if (it.get("label") or it.get("id"))]
                    m["option_instructions"] = {
                        (it.get("label") or it.get("id")): (it.get("instruction") or it.get("instr") or "")
                        for it in m["items"] if (it.get("label") or it.get("id"))
                    }
                    changed = True
                elif (mid == "m1" or mname == "lokasyon") and not m.get("options"):
                    m["type"] = "select"
                    m["options"] = [x[0] for x in DEFAULT_FUTBOLCU_LOCATIONS]
                    m["option_instructions"] = {x[0]: x[1] for x in DEFAULT_FUTBOLCU_LOCATIONS}
                    if not m.get("default"):
                        m["default"] = DEFAULT_FUTBOLCU_LOCATIONS[0][0]
                    changed = True
            if changed:
                cur.execute("UPDATE rulebooks SET data_json=? WHERE id=?", (json.dumps(rb_data, ensure_ascii=False), rb_row["id"]))
        except Exception:
            pass

    for k, v in DEFAULT_SETTINGS.items():
        cur.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))

    # Eski varsayılan sistem talimatını ve ağır tekrar cezalarını v16 SpicyChat dengesine yükselt
    sp_row = cur.execute("SELECT value FROM settings WHERE key='system_prompt'").fetchone()
    if sp_row:
        sp_val = str(sp_row["value"] or "")
        if (
            sp_val.startswith("Sen duygusal derinliği yüksek")
            or sp_val.startswith("Sen doğal, duygusal ve sürükleyici")
            or sp_val.startswith("Sen karaktere birebir sadık")
        ):
            cur.execute("UPDATE settings SET value=? WHERE key='system_prompt'", (EMOTIONAL_SYSTEM_PROMPT,))

    # Eski ağır Türkçe cezalarını (rep 1.13/1.15 + pres 0.25 + freq 0.25) otomatik rahatlat
    cur_map = {r["key"]: r["value"] for r in cur.execute("SELECT key, value FROM settings WHERE key IN ('temperature','top_p','min_p','rep_penalty','presence_penalty','frequency_penalty')").fetchall()}
    if (
        cur_map.get("presence_penalty") == "0.25"
        and cur_map.get("frequency_penalty") == "0.25"
        and cur_map.get("rep_penalty") in ("1.13", "1.15")
    ):
        for k, v in (
            ("temperature", "0.76"),
            ("top_p", "0.92"),
            ("min_p", "0.05"),
            ("rep_penalty", "1.06"),
            ("presence_penalty", "0.0"),
            ("frequency_penalty", "0.0"),
        ):
            cur.execute("UPDATE settings SET value=? WHERE key=?", (v, k))

    # v16.3 Hız optimizasyonu göçü: KV-Cache'i bozan arka plan AI hakemini ve daktilo akışını varsayılan kapat
    mig_row = cur.execute("SELECT value FROM settings WHERE key='v16_3_speed_migrated'").fetchone()
    if not mig_row:
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_judge_enabled', '0')")
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_stream', '0')")
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('v16_3_speed_migrated', '1')")

    # v16.4 Saf Türkçe + Çevirisiz + Tekrarsız sistem talimatı göçü
    mig164 = cur.execute("SELECT value FROM settings WHERE key='v16_4_pure_tr_migrated'").fetchone()
    if not mig164:
        sp_cur = cur.execute("SELECT value FROM settings WHERE key='system_prompt'").fetchone()
        sp_txt = str(sp_cur["value"] or "") if sp_cur else ""
        if (not sp_txt) or ("Türkçe çeviri" in sp_txt) or sp_txt.startswith("Sen canlı, duygulu") or sp_txt.startswith("Sen duygusal derinliği"):
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('system_prompt', ?)", (EMOTIONAL_SYSTEM_PROMPT,))
        for k, v in (
            ("temperature", "0.72"),
            ("top_p", "0.90"),
            ("min_p", "0.06"),
            ("rep_penalty", "1.10"),
            ("presence_penalty", "0.15"),
            ("frequency_penalty", "0.10"),
        ):
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('v16_4_pure_tr_migrated', '1')")

    # v17: Qwen3.5 resmi önerilerine göre örnekleme ayarlarını bir kez düzelt
    if not cur.execute("SELECT 1 FROM settings WHERE key='v17_tuning_migrated'").fetchone():
        for k, v in (
            ("temperature", "0.70"), ("top_p", "0.85"), ("top_k", "20"), ("min_p", "0.0"),
            ("rep_penalty", "1.0"), ("presence_penalty", "0.3"), ("frequency_penalty", "0.0"),
            ("no_think_literal", "0"),
        ):
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
        row = cur.execute("SELECT value FROM settings WHERE key='max_tokens'").fetchone()
        try:
            too_low = (not row) or int(float(row["value"] or 0)) < 600
        except Exception:
            too_low = True
        if too_low:
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('max_tokens', '700')")
        row = cur.execute("SELECT value FROM settings WHERE key='model_name'").fetchone()
        if row and "/" in str(row["value"] or ""):
            # HF depo yolu LM Studio kimliği değildir; boş bırakınca yüklü model otomatik bulunur
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('model_name', '')")
        row = cur.execute("SELECT value FROM settings WHERE key='system_prompt'").fetchone()
        if row and str(row["value"] or "").strip() == _OLD_PROMPT_V16.strip():
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('system_prompt', ?)", (EMOTIONAL_SYSTEM_PROMPT,))
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('v17_tuning_migrated', '1')")

    # v17.1: Daktilo modunu (live_stream) kapat, Gemma 4 RP uyumlu varsayilanlari koru
    if not cur.execute("SELECT 1 FROM settings WHERE key='v17_1_fixes_migrated'").fetchone():
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('live_stream', '0')")
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('ai_judge_enabled', '0')")
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('v17_1_fixes_migrated', '1')")

    # v19: Hiz optimizasyonu (KV-Cache koruma + kompakt baglam) & HD TTS gecisi
    if not cur.execute("SELECT 1 FROM settings WHERE key='v19_speed_tts_migrated'").fetchone():
        for k, v in (
            ("speed_mode", "turbo"),
            ("max_tokens", "320"),
            ("context_messages", "8"),
            ("max_prompt_chars", "5500"),
            ("auto_memory_enabled", "0"),
            ("ai_judge_enabled", "0"),
            ("live_stream", "0"),
            ("tts_auto", "0"),
        ):
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))
        vrow = cur.execute("SELECT value FROM settings WHERE key='tts_voice'").fetchone()
        vval = str(vrow["value"] or "") if vrow else ""
        if (not vval) or ("microsoft" in vval.lower()) or ("-" not in vval):
            cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('tts_voice', 'tr-F')")
        cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('v19_speed_tts_migrated', '1')")

    cur.execute("SELECT COUNT(*) as c FROM personas")
    if cur.fetchone()["c"] == 0:
        cur.execute("INSERT INTO personas (name, description, is_default, created_at) VALUES (?, ?, 1, ?)", ("Kullanıcı", "", now))

    conn.commit()
    conn.close()

def get_settings() -> Dict[str, str]:
    conn = get_conn()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    conn.close()
    res = dict(DEFAULT_SETTINGS)
    for r in rows:
        res[r["key"]] = r["value"]
    return res

def save_settings(data: Dict[str, Any]):
    conn = get_conn()
    for k, v in data.items():
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (k, str(v)),
        )
    conn.commit()
    conn.close()
