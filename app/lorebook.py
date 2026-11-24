import re
from typing import List, Dict, Tuple, Any

_GENERIC_NAME_WORDS = {
    "yeni", "eski", "büyük", "küçük", "yan", "üst", "alt", "ana", "özel", "gizli",
    "kara", "beyaz", "kırmızı", "mavi", "yeşil", "ev", "daire", "oda", "okul",
    "kulüp", "takım", "şehir", "ülke", "bölge", "mekan", "mekân", "olay", "tarih",
    "sözleşme", "karakter", "aile", "grup", "stadyum", "tesis", "tesisleri",
    "villa", "otel", "bar", "kafe", "restoran", "sokak", "cadde", "mahalle",
}

_CHAR_PROFILE_KEYS = (
    "first_name", "last_name", "nationality", "age", "gender",
    "physical", "personality", "lifestyle", "family", "extra_notes",
)


def _tr_lower(s: str) -> str:
    return (s or "").replace("İ", "i").replace("I", "ı").lower()


def _replace_macros(text: str, char_name: str, user_name: str) -> str:
    if not text:
        return ""
    return str(text).replace("{{char}}", char_name).replace("{{user}}", user_name)


def _is_character_entry(entry: Dict) -> bool:
    if str(entry.get("entry_type") or "").lower() == "character":
        return True
    return any(str(entry.get(k) or "").strip() for k in _CHAR_PROFILE_KEYS)


def get_entry_display_title(entry: Dict, idx: int = 0) -> str:
    fn = str(entry.get("first_name") or "").strip()
    ln = str(entry.get("last_name") or "").strip()
    full = f"{fn} {ln}".strip()
    if full:
        return full
    return str(entry.get("name") or entry.get("comment") or f"Kayıt {idx + 1}").strip()


def format_entry_for_llm(entry: Dict, char_name: str, user_name: str, max_chars: int = 1600) -> Tuple[str, str]:
    """
    Lorebook kaydini YZ modelinin dogrudan anlayip hikayeyi sekillendirecegi net yapiya donusturur.
    Dondurur: (formatted_block, short_preview)
    """
    title = _replace_macros(get_entry_display_title(entry), char_name, user_name).strip()

    if _is_character_entry(entry):
        fn = _replace_macros(entry.get("first_name") or "", char_name, user_name).strip()
        ln = _replace_macros(entry.get("last_name") or "", char_name, user_name).strip()
        nat = _replace_macros(entry.get("nationality") or "", char_name, user_name).strip()
        age = _replace_macros(entry.get("age") or "", char_name, user_name).strip()
        gen = _replace_macros(entry.get("gender") or "", char_name, user_name).strip()
        phys = _replace_macros(entry.get("physical") or "", char_name, user_name).strip()
        pers = _replace_macros(entry.get("personality") or "", char_name, user_name).strip()
        life = _replace_macros(entry.get("lifestyle") or "", char_name, user_name).strip()
        fam = _replace_macros(entry.get("family") or "", char_name, user_name).strip()
        extra = _replace_macros(entry.get("extra_notes") or "", char_name, user_name).strip()

        # Eger yapisal alanlar bos ama legacy content varsa onu da kullan
        if not any((phys, pers, life, fam, extra)) and entry.get("content"):
            extra = _replace_macros(entry.get("content") or "", char_name, user_name).strip()

        id_parts = []
        if fn:
            id_parts.append(f"Ad: {fn}")
        if ln:
            id_parts.append(f"Soyad: {ln}")
        if nat:
            id_parts.append(f"Uyruk: {nat}")
        if age:
            id_parts.append(f"Yaş: {age}")
        if gen:
            id_parts.append(f"Cinsiyet: {gen}")

        lines = [f"[KARAKTER PROFİLİ: {title}]"]
        if id_parts:
            lines.append("  Kimlik: " + " | ".join(id_parts))
        if phys:
            lines.append(f"  Fiziksel Özellikleri: {phys}")
        if pers:
            lines.append(f"  Kişisel Özellikleri: {pers}")
        if life:
            lines.append(f"  Yaşantısı: {life}")
        if fam:
            lines.append(f"  Ailesi: {fam}")
        if extra:
            lines.append(f"  Ek Detaylar: {extra}")

        if len(lines) <= 1:
            return "", ""

        block = "\n".join(lines)[:max_chars]
        preview_bits = [p for p in (nat, age, gen) if p]
        head_p = " · ".join(preview_bits)
        body_p = phys or pers or life or fam or extra
        preview = f"{head_p} — {body_p}".strip(" —") if head_p else body_p
        return block, preview[:180] + ("..." if len(preview) > 180 else "")

    content = _replace_macros(entry.get("content", ""), char_name, user_name).strip()[:max_chars]
    if not content:
        return "", ""
    block = f"[{title}]: {content}" if title else content
    return block, content[:180] + ("..." if len(content) > 180 else "")


def _match_key(key: str, text_lower: str) -> bool:
    k = _tr_lower(key.strip())
    if len(k) < 2:
        return False
    if "*" in k:
        pattern = re.escape(k).replace(r"\*", r"\w*")
        return re.search(pattern, text_lower) is not None
    if len(k) <= 3:
        return re.search(rf"(?<![a-zçğıöşü0-9]){re.escape(k)}(?![a-zçğıöşü0-9])", text_lower) is not None
    return k in text_lower


def _collect_entry_keys(entry: Dict, char_name: str, user_name: str) -> List[str]:
    keys: List[str] = []

    for field in ("keys", "key", "keywords", "secondary_keys"):
        raw = entry.get(field)
        if not raw:
            continue
        if isinstance(raw, list):
            for k in raw:
                ks = _replace_macros(str(k), char_name, user_name).strip()
                if ks:
                    keys.append(ks)
        else:
            for k in str(raw).split(","):
                ks = _replace_macros(k, char_name, user_name).strip()
                if ks:
                    keys.append(ks)

    # Yapisal karakter kaydinda Ad ve Soyad otomatik tetikleyici olarak eklenir!
    fn = _replace_macros(entry.get("first_name") or "", char_name, user_name).strip()
    ln = _replace_macros(entry.get("last_name") or "", char_name, user_name).strip()
    if fn and len(fn) >= 2 and _tr_lower(fn) not in _GENERIC_NAME_WORDS:
        keys.append(fn)
    if ln and len(ln) >= 3 and _tr_lower(ln) not in _GENERIC_NAME_WORDS:
        keys.append(ln)
    if fn and ln:
        keys.append(f"{fn} {ln}")

    # Kayıt adını (ve kişi adıysa ilk adını) otomatik tetikleyici olarak dahil et
    title = _replace_macros(get_entry_display_title(entry), char_name, user_name).strip()
    if title and len(title) >= 3:
        keys.append(title)
        words = [w.strip(".,:;!?()[]{}\"'") for w in title.split() if w.strip()]
        if 2 <= len(words) <= 3:
            first_w = words[0]
            if len(first_w) >= 4 and _tr_lower(first_w) not in _GENERIC_NAME_WORDS:
                keys.append(first_w)

    # Tekrarları temizle
    uniq = []
    seen = set()
    for k in keys:
        kl = _tr_lower(k)
        if kl and kl not in seen:
            seen.add(kl)
            uniq.append(k)
    return uniq


def evaluate_lorebook(
    entries: List[Dict],
    recent_messages: List[Dict],
    active_tracker: Dict[str, int],
    char_name: str,
    user_name: str,
    max_total_chars: int = 2800,
    extra_scan_text: str = "",
) -> Tuple[List[str], List[str], Dict[str, int], List[Dict[str, str]]]:
    """
    Döndürür: (always_blocks, dynamic_blocks, new_tracker, active_meta)
    - always_blocks: Her zaman aktif Lorebook kayıtları (sistem mesajında sabit kalır, KV-cache korunur)
    - dynamic_blocks: Anahtar kelime veya yapışkan takip ile aktif olan sahne kayıtları
    - new_tracker: 3 tur boyunca sahnedeki karakterin profilini aktif tutar
    - active_meta: 'Neden?' penceresinde göstermek için aktif kayıt başlık + önizlemeleri
    """
    if not entries:
        return [], [], {}, []

    scan_chunks = [m.get("content", "") for m in recent_messages[-4:]]
    if extra_scan_text:
        scan_chunks.append(extra_scan_text)
    scan_text = _tr_lower("\n".join(scan_chunks))

    new_tracker: Dict[str, int] = {}
    always_blocks: List[str] = []
    dynamic_blocks: List[str] = []
    active_meta: List[Dict[str, str]] = []
    used_chars = 0

    very_recent_text = _tr_lower("\n".join(m.get("content", "") for m in recent_messages[-2:]))

    scored_entries: List[Tuple[int, int, Dict, bool, bool, int, str, str]] = []
    for idx, entry in enumerate(entries):
        if not entry.get("enabled", True):
            continue
        block, preview = format_entry_for_llm(entry, char_name, user_name, max_chars=1600)
        if not block:
            continue
        eid = str(entry.get("id", idx))
        always = bool(entry.get("always_active", False) or entry.get("constant", False))
        keys = _collect_entry_keys(entry, char_name, user_name)
        matched_now = any(_match_key(k, very_recent_text) for k in keys)
        matched = matched_now or any(_match_key(k, scan_text) for k in keys)
        remaining = int(active_tracker.get(eid, 0))

        if not (always or matched or remaining > 1):
            continue

        prio = 0 if matched_now else (1 if matched else (2 if always else 3))
        scored_entries.append((prio, idx, entry, always, matched, remaining, block, preview))

    scored_entries.sort(key=lambda x: (x[0], x[1]))

    for prio, idx, entry, always, matched, remaining, block, preview in scored_entries:
        eid = str(entry.get("id", idx))
        title = _replace_macros(get_entry_display_title(entry, idx), char_name, user_name).strip()

        if used_chars + len(block) > max_total_chars and (always_blocks or dynamic_blocks):
            continue

        used_chars += len(block)
        if always:
            always_blocks.append(block)
            reason = "Her zaman aktif"
        else:
            dynamic_blocks.append(block)
            if matched:
                new_tracker[eid] = 3
                reason = "Sahnede aktif"
            else:
                new_tracker[eid] = max(1, remaining - 1)
                reason = "Sahnede devam ediyor"

        active_meta.append({
            "name": title or "Lorebook Kaydı",
            "reason": reason,
            "preview": preview,
        })

    return always_blocks, dynamic_blocks, new_tracker, active_meta
