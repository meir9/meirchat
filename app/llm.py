import httpx
import json
import re
import os
import time
import io
import base64
from urllib.parse import quote_plus
from typing import List, Dict, AsyncGenerator, Optional, Any, Tuple
from PIL import Image
from app.paths import UPLOADS_DIR
from app.storage import resolve_upload_file
from app.cloud_config import IS_CLOUD

TONE_INSTRUCTIONS = {
    "emotional": (
        "Anlatım Tonu: Duygulu ve karaktere sadık. Sahneyi nefes, bakış, ses tonu ve beden diliyle canlı yaşat; "
        "her karakterin duygusunu kendi kişiliğine uygun yoğunlukta ver."
    ),
    "dramatic": (
        "Anlatım Tonu: Sinematik ve dramatik. Yüksek gerilim, güçlü atmosfer ve çarpıcı diyaloglarla sahneyi derinleştir."
    ),
    "balanced": (
        "Anlatım Tonu: Dengeli ve doğal. Akıcı anlatım ve gerçekçi tepkilerle sahneyi net ilerlet."
    ),
    "soft_emotional": (
        "Anlatım Tonu: Yoğun duygusal ve romantik. Kalp çarpıntısını, çekimi, özlemi ve kırılganlığı ön plana çıkar."
    ),
}


CHAT_LANG_INSTRUCTIONS = {
    "Türkçe": (
        "Dil Kuralı: Tüm anlatım ve konuşmaları yalnızca doğal, akıcı İstanbul Türkçesiyle yaz."
    ),
    "Azerbaycan Türkçesi": (
        "Dil Kuralı (ZORUNLU): Tüm anlatım, eylemler ve diyalogları YALNIZCA doğal ve akıcı Azerbaycan Türkçesiyle (Azərbaycan dili) yaz. "
        "Başka dilde cümle veya çeviri ekleme."
    ),
    "English": (
        "LANGUAGE RULE (MANDATORY): Write ALL narration, actions, and dialogue strictly in natural, fluent English. "
        "Ignore any Turkish wording in the instructions above and respond 100% in English."
    ),
    "Русский": (
        "ПРАВИЛО ЯЗЫКА (ОБЯЗАТЕЛЬНО): Пиши всё повествование, действия и диалоги ИСКЛЮЧИТЕЛЬНО на естественном, живом русском языке. "
        "Игнорируй турецкий язык в инструкциях выше и отвечай на 100% на русском."
    ),
    "Deutsch": (
        "SPRACHREGEL (VERPFLICHTEND): Schreibe die gesamte Erzählung, Handlungen und Dialoge ausschließlich in natürlichem, flüssigem Deutsch. "
        "Ignoriere türkische Formulierungen in den Anweisungen und antworte zu 100 % auf Deutsch."
    ),
    "Français": (
        "RÈGLE DE LANGUE (OBLIGATOIRE) : Écris toute la narration, les actions et les dialogues uniquement en français naturel et fluide. "
        "Ignore la langue turque des consignes ci-dessus et réponds à 100 % en français."
    ),
    "Español": (
        "REGLA DE IDIOMA (OBLIGATORIA): Escribe toda la narración, acciones y diálogos exclusivamente en español natural y fluido. "
        "Ignora el turco en las instrucciones anteriores y responde 100 % en español."
    ),
    "Italiano": (
        "REGOLA LINGUISTICA (OBBLIGATORIA): Scrivi tutta la narrazione, le azioni e i dialoghi esclusivamente in italiano naturale e scorrevole. "
        "Ignora il turco nelle istruzioni sopra e rispondi al 100% in italiano."
    ),
    "中文": (
        "语言规则（必须遵守）：请完全使用自然、流畅的简体中文编写所有旁白、动作描写和对话。"
        "忽略上方指令中的土耳其语，100%使用中文回复。"
    ),
    "日本語": (
        "言語ルール（必須）：地の文、行動描写、セリフをすべて自然で流暢な日本語のみで書いてください。"
        "上記の指示のトルコ語は無視し、100%日本語で返答してください。"
    ),
}

_MODEL_CACHE: Dict[str, Tuple[str, float]] = {}
LAST_PROMPT_DEBUG: Dict[int, Dict[str, Any]] = {}
_SHARED_CLIENT: Optional[httpx.AsyncClient] = None

def _get_http_client() -> httpx.AsyncClient:
    global _SHARED_CLIENT
    if _SHARED_CLIENT is None or _SHARED_CLIENT.is_closed:
        _SHARED_CLIENT = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=10.0, read=600.0, write=30.0, pool=10.0),
            limits=httpx.Limits(max_connections=8, max_keepalive_connections=4),
        )
    return _SHARED_CLIENT

def _tr_lower(s: str) -> str:
    return (s or "").replace("İ", "i").replace("I", "ı").lower()

def replace_macros(text: str, char_name: str, user_name: str) -> str:
    if not text:
        return ""
    return text.replace("{{char}}", char_name).replace("{{user}}", user_name)

def clean_duplicate_paragraphs(text: str) -> str:
    """Modelin yanıt içinde aynı veya neredeyse aynı paragrafı tekrar etmesini temizler."""
    if not text:
        return ""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    if len(paras) <= 1:
        return text.strip()
    seen_exact = set()
    seen_word_sets: List[set] = []
    cleaned = []
    for p in paras:
        norm = re.sub(r"\s+", " ", _tr_lower(p))
        if len(norm) > 20 and norm in seen_exact:
            continue
        wset = _extract_content_words(p)
        if len(wset) >= 5:
            is_near_dup = any(
                len(wset & prev) / float(max(1, min(len(wset), len(prev)))) >= 0.72
                for prev in seen_word_sets
            )
            if is_near_dup:
                continue
            seen_word_sets.append(wset)
        seen_exact.add(norm)
        cleaned.append(p)
    return "\n\n".join(cleaned)

def _extract_content_words(text: str) -> set:
    words = re.findall(r"[a-zçğıöşü0-9]{4,}", _tr_lower(text))
    stop_w = {
        "ama", "fakat", "ancak", "gibi", "kadar", "için", "daha", "çok", "biraz",
        "sonra", "önce", "şimdi", "burada", "orada", "dedi", "diyor", "oldu",
        "olarak", "bunu", "şunu", "onun", "bunun", "kendi", "zaten", "hala", "hâlâ"
    }
    return {w for w in words if w not in stop_w}

def build_user_stop_sequences(user_name: str) -> List[str]:
    uname = (user_name or "").strip()
    if len(uname) < 2:
        return []
    return [
        f"\n{uname}:",
        f"\n*{uname}:",
        f"\n**{uname}:",
        f"\n*{uname}*:",
    ]

def _is_user_speaker_line(line: str, user_name: str) -> bool:
    uname = (user_name or "").strip()
    if len(uname) < 2:
        return False
    low = _tr_lower(line).strip()
    u_esc = re.escape(_tr_lower(uname))
    return bool(re.match(rf"^[\*\s_`>\[(\-•]*{u_esc}[\*\s_`\]):]*\s*:", low))

def _is_user_impersonation_paragraph(para: str, user_name: str, last_user_text: str) -> bool:
    """
    Türkçe dilbilgisine duyarlı kullanıcı taklidi (godmoding) filtresi (v16.4):
    - `Deniz: ...` konuşma etiketlerini kaldırır.
    - Yalın halde özne olan `Deniz, kıza bakar...` / `Deniz gülümser...` paragraflarını yakalar.
    - İyelik/yönelme eki alan `Deniz'in sözleri...` / `Deniz'e baktı...` cümlelerine ASLA dokunmaz.
    """
    uname = (user_name or "").strip()
    if len(uname) < 2:
        return False
    p_low = _tr_lower(para).strip()
    u_low = _tr_lower(uname)
    u_esc = re.escape(u_low)

    if _is_user_speaker_line(para, uname):
        return True

    other_speaker = re.match(r"^[\*\s_`>]*([a-zçğıöşü]{2,20})[\*\s_`]*\s*:", p_low)
    if other_speaker and other_speaker.group(1) != u_low:
        return False

    has_quote = ('"' in para) or ('“' in para) or ('«' in para)

    # Paragraf yalın halde kullanıcı adıyla (Deniz, ... veya Deniz ...) başlıyorsa (kesme işareti yoksa)
    # Türkçe dilbilgisi: "Deniz'in / Deniz'e / Deniz'i" kesme işareti alır; yalın "Deniz, ..." sadece Deniz özne iken olur.
    if not has_quote and re.match(rf"^[\*\s_]*{u_esc}(?:,|\s+)(?!['’])", p_low):
        first_sent = re.split(r"[.!?]", p_low, maxsplit=1)[0]
        if not re.search(rf"{u_esc}\s+(?:için|hakkında|kadar|gibi|yüzünden|tarafından|ile|ve)\b", first_sent):
            return True

    if last_user_text and not has_quote:
        u_words = _extract_content_words(last_user_text)
        p_words = _extract_content_words(para)
        if len(u_words) >= 6 and len(p_words) >= 5:
            overlap = len(u_words & p_words) / float(len(u_words))
            extra_ratio = len(p_words - u_words) / float(max(1, len(p_words)))
            if overlap >= 0.78 and extra_ratio < 0.25:
                return True

    return False

# --- ROL YAPMA METNİ OTOMATİK DÜZENLEYİCİ (ANLATIM / İÇ SES / KONUŞMA / ÇEVİRİ KORUMALI) ---

_QUOTE_RE = re.compile(r'("[^"\n]{1,500}"|“[^”\n]{1,500}”)')
_INNER_CUE_BEFORE = re.compile(r'(?:kendi\s+kendine|içinden|zihninden|aklından|kafasından)\s*$', re.IGNORECASE)
_INNER_CUE_AFTER = re.compile(r'^\s*(?:diye\s+(?:içinden|düşün|geçir)|düşüncesi|diye\s+akl)', re.IGNORECASE)
_SPEAKER_HEAD_RE = re.compile(r'^[\*\s_]*([A-ZÇĞİÖŞÜ][a-zçğıöşüA-ZÇĞİÖŞÜ0-9\s]{1,22}?)[\*\s_]*:[\*\s_]*(.*)$')
_PAREN_LINE_RE = re.compile(r'^\*?\s*\(([^()\n]{3,350})\)\s*\*?$')

def _wrap_narration(txt: str) -> str:
    t = txt.strip()
    if not t:
        return ""
    inner = t.strip("*").strip()
    if not inner:
        return ""
    inner = re.sub(r'\*{1,3}', '', inner).strip()
    return f"*{inner}*"

def _split_long_narration(txt: str, max_chars: int = 380) -> List[str]:
    t = txt.strip()
    if len(t) <= max_chars:
        return [t] if t else []
    sents = re.split(r'(?<=[.!?…])\s+', t)
    if len(sents) < 3:
        return [t]
    mid_target = len(t) // 2
    best_i = 1
    best_diff = 10**9
    acc = 0
    for i in range(1, len(sents)):
        acc += len(sents[i - 1]) + 1
        diff = abs(acc - mid_target)
        if diff < best_diff:
            best_diff = diff
            best_i = i
    p1 = " ".join(sents[:best_i]).strip()
    p2 = " ".join(sents[best_i:]).strip()
    return [x for x in (p1, p2) if x]

def _format_translation_tail(seg: str) -> str:
    s = seg.strip()
    if not s:
        return ""
    pm = _PAREN_LINE_RE.match(s)
    if pm:
        return f"*({pm.group(1).strip()})*"
    if "*" in s:
        return s
    return _wrap_narration(s)

def _normalize_single_paragraph(para: str) -> List[str]:
    p = para.strip()
    if not p:
        return []

    if "\n" in p:
        lines = [ln.strip() for ln in p.splitlines() if ln.strip()]
        if len(lines) == 2 and _PAREN_LINE_RE.match(lines[1]):
            first_norm = _normalize_single_paragraph(lines[0])
            trans_m = _PAREN_LINE_RE.match(lines[1])
            trans_line = f"*({trans_m.group(1).strip()})*"
            if first_norm:
                first_norm[-1] = f"{first_norm[-1]}\n{trans_line}"
                return first_norm
            return [trans_line]

    standalone_p = _PAREN_LINE_RE.match(p)
    if standalone_p:
        return [f"*({standalone_p.group(1).strip()})*"]

    speaker_prefix = ""
    sp_m = _SPEAKER_HEAD_RE.match(p)
    if sp_m:
        sp_name = sp_m.group(1).strip()
        rest = sp_m.group(2).strip()
        if 1 <= len(sp_name.split()) <= 3 and len(sp_name) <= 24:
            speaker_prefix = f"***{sp_name}:***"
            p = rest
            paren_m = re.match(r'^\(([^()]{2,55})\)\s+(["“].*)$', p)
            if paren_m:
                act_txt = paren_m.group(1).strip()
                p = f"*{act_txt}* {paren_m.group(2).strip()}".strip()

    if not speaker_prefix and p.startswith("*") and p.endswith("*") and p.count("*") == 2:
        inner = p[1:-1].strip()
        q_matches = list(_QUOTE_RE.finditer(inner))
        for qm in q_matches:
            q_body = qm.group(0)[1:-1].strip()
            before = inner[:qm.start()]
            after = inner[qm.end():]
            is_inner_voice = (
                len(q_body.split()) >= 4
                and (_INNER_CUE_BEFORE.search(before) or _INNER_CUE_AFTER.search(after))
            )
            if is_inner_voice:
                out_parts = []
                b_clean = before.strip()
                if b_clean:
                    out_parts.append(_wrap_narration(b_clean))
                out_parts.append(f'*“{q_body}”*')
                a_clean = re.sub(
                    r'^\s*diye\s+(?:içinden|düşün[a-zçğıöşü]*|mızık\s+yapar|geçirir)[,.\s]*',
                    '', after, flags=re.IGNORECASE
                ).strip()
                if len(a_clean) >= 12:
                    out_parts.append(_wrap_narration(a_clean))
                return out_parts
        return [p]

    if speaker_prefix:
        if not _QUOTE_RE.search(p):
            first_em = re.match(r'^\*([^*\n]{2,180})\*\s*(.*)$', p)
            if first_em and first_em.group(2).strip():
                spoken = first_em.group(1).strip()
                tail = first_em.group(2).strip()
                out = [f'{speaker_prefix} “{spoken}”']
                for chunk in _split_long_narration(tail):
                    out.append(_wrap_narration(chunk))
                return out
            return [f"{speaker_prefix} {p}".strip()]

        parts = _QUOTE_RE.split(p)
        non_quotes = [parts[i].strip() for i in range(0, len(parts), 2) if parts[i].strip()]
        has_long_plain = any(
            not _PAREN_LINE_RE.match(nq)
            and len(re.sub(r'\*[^*]+\*', '', nq).strip()) > 90
            for nq in non_quotes
        )
        if not has_long_plain:
            rebuilt = []
            for idx, seg in enumerate(parts):
                s = seg.strip()
                if not s:
                    continue
                if idx % 2 == 1:
                    rebuilt.append(s)
                else:
                    rebuilt.append(_format_translation_tail(s))
            return [f"{speaker_prefix} " + " ".join(rebuilt)]

    if not _QUOTE_RE.search(p):
        if "*" not in p:
            return [_wrap_narration(chunk) for chunk in _split_long_narration(p)]
        return [p]

    tokens = _QUOTE_RE.split(p)
    out_blocks: List[str] = []
    cur_dialogue: List[str] = []

    def flush_dialogue():
        nonlocal speaker_prefix
        if cur_dialogue:
            line = " ".join(cur_dialogue).strip()
            if speaker_prefix:
                line = f"{speaker_prefix} {line}"
                speaker_prefix = ""
            out_blocks.append(line)
            cur_dialogue.clear()

    i = 0
    while i < len(tokens):
        seg = tokens[i].strip()
        if i % 2 == 0:
            if seg:
                next_q = tokens[i + 1] if (i + 1) < len(tokens) else ""

                if cur_dialogue and _PAREN_LINE_RE.match(seg):
                    cur_dialogue.append(_format_translation_tail(seg))
                    if not next_q:
                        flush_dialogue()
                elif cur_dialogue and next_q and len(seg) <= 95:
                    cur_dialogue.append(_format_translation_tail(seg))
                elif cur_dialogue and not next_q:
                    if len(seg) <= 75 and re.match(r'^(?:diye|diyerek)\b', _tr_lower(seg)):
                        cur_dialogue.append(_wrap_narration(seg))
                        flush_dialogue()
                    else:
                        flush_dialogue()
                        for chunk in _split_long_narration(seg):
                            out_blocks.append(_wrap_narration(chunk))
                else:
                    flush_dialogue()
                    if next_q:
                        q_inner = next_q[1:-1].strip()
                        is_short_inline_quote = (len(q_inner.split()) <= 3 and not q_inner.endswith((".", "!", "?")))
                        is_inner_voice = bool(
                            _INNER_CUE_BEFORE.search(seg)
                            or (i + 2 < len(tokens) and _INNER_CUE_AFTER.search(tokens[i + 2]))
                        )
                        if is_short_inline_quote:
                            next_after = tokens[i + 2].strip() if (i + 2) < len(tokens) else ""
                            merged = f'{seg} “{q_inner}”'
                            if next_after and (i + 3) >= len(tokens):
                                merged = f"{merged} {next_after}"
                                i += 3
                                for chunk in _split_long_narration(merged):
                                    out_blocks.append(_wrap_narration(chunk))
                                continue
                            else:
                                tokens[i + 2] = f"{merged} {next_after}".strip()
                                i += 2
                                continue
                        elif is_inner_voice:
                            clean_b = re.sub(
                                r'[\s,;]*(?:kendi\s+kendine|içinden|zihninden|aklından|kafasından)\s*$',
                                '.', seg, flags=re.IGNORECASE
                            ).strip()
                            if len(clean_b) >= 10:
                                for chunk in _split_long_narration(clean_b):
                                    out_blocks.append(_wrap_narration(chunk))
                            out_blocks.append(f'*“{q_inner}”*')
                            if (i + 2) < len(tokens):
                                tokens[i + 2] = re.sub(
                                    r'^\s*diye\s+(?:içinden|düşün[a-zçğıöşü]*|mızık\s+yapar|geçirir)[,.\s]*',
                                    '', tokens[i + 2], flags=re.IGNORECASE
                                ).strip()
                            i += 2
                            continue
                        else:
                            for chunk in _split_long_narration(seg):
                                out_blocks.append(_wrap_narration(chunk))
                    else:
                        for chunk in _split_long_narration(seg):
                            out_blocks.append(_wrap_narration(chunk))
        else:
            q_inner = seg[1:-1].strip()
            if q_inner:
                cur_dialogue.append(f'“{q_inner}”')
        i += 1

    flush_dialogue()
    return [b for b in out_blocks if b.strip()]

def structure_roleplay_output(text: str) -> str:
    if not text or not text.strip():
        return ""
    raw_paras = [p.strip() for p in re.split(r"\n\s*\n", text.strip()) if p.strip()]
    out_paras: List[str] = []
    for para in raw_paras:
        out_paras.extend(_normalize_single_paragraph(para))
    return "\n\n".join(out_paras).strip()

_META_PAREN_RE = re.compile(
    r"\s*\*?\([^()\n]{4,180}?(?:türkçe|ingilizce|rusça|çeviri|konuşmaya\s+çalış|bilmemektedir|bilmez|aksanla|karışık\s+şekilde)[^()\n]*\)\*?",
    re.IGNORECASE,
)

def _strip_dangling_tail(text: str) -> str:
    """Yarım kalmış tek kelimelik karakter adını veya bozuk son satırı temizler."""
    lines = text.splitlines()
    while lines:
        last = lines[-1].strip()
        if not last:
            lines.pop()
            continue
        # Tek kelime veya yarım kalmış konuşan etiketi (ör. "Daria", "*Daria:", "***Daria:")
        clean_l = last.strip("*_ :—-")
        if len(clean_l) <= 18 and " " not in clean_l and not any(ch in last for ch in '.!?"”'):
            lines.pop()
            continue
        break
    return "\n".join(lines).strip()

def _fix_speaker_italic_dialogue(para: str) -> str:
    """`***Daria:*** *Merhaba...*` gibi yıldız içinde yazılmış konuşmayı tırnaklı konuşmaya çevirir."""
    m = _SPEAKER_HEAD_RE.match(para.strip())
    if not m:
        return para
    sp = m.group(1).strip()
    rest = m.group(2).strip()
    # Parantez içi sahne notlarını baştan temizle: "(gülümseyerek)"
    rest = re.sub(r"^\([^()\n]{2,60}\)\s*", "", rest).strip()
    if not rest:
        return ""
    if not _QUOTE_RE.search(rest):
        # Yıldızları temizle ve konuşmayı tırnağa al
        clean_speech = rest.strip("*").strip()
        if clean_speech:
            return f"***{sp}:*** “{clean_speech}”"
    return f"***{sp}:*** {rest}"

def clean_roleplay_output(text: str, user_name: str = "", last_user_text: str = "") -> Tuple[str, bool]:
    if not text:
        return "", False

    had_impersonation = False
    s = text.strip()

    s = re.sub(r"<think>.*?</think>", "", s, flags=re.DOTALL | re.IGNORECASE)
    s = re.sub(r"</?think>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"/no_think\b", "", s, flags=re.IGNORECASE)
    # Gemma 4: boş düşünme bloğu ve kontrol işaretleri (<|channel>thought ...<channel|>, <turn|> vb.)
    s = re.sub(r"<\|channel\>.*?<channel\|>", "", s, flags=re.DOTALL)
    s = re.sub(r"<\|?(?:turn|channel|think|start_of_turn|end_of_turn)\|?>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\[(?:/?SAHNE BAĞLAMI|BAĞLAM|DİKKAT|Güncel Dinamikler)[^\]]*\]", "", s, flags=re.DOTALL | re.IGNORECASE)
    # Meta dil/çeviri parantezlerini temizle
    s = _META_PAREN_RE.sub("", s)
    s = _strip_dangling_tail(s)

    uname = (user_name or "").strip()
    raw_paras = [p.strip() for p in re.split(r"\n\s*\n", s.strip()) if p.strip()]
    kept_paras: List[str] = []

    for para in raw_paras:
        if uname:
            lines = para.splitlines()
            clean_lines = []
            for ln in lines:
                if _is_user_speaker_line(ln, uname):
                    had_impersonation = True
                    continue
                clean_lines.append(ln)
            para = "\n".join(clean_lines).strip()
            if not para:
                continue

            if _is_user_impersonation_paragraph(para, uname, last_user_text):
                had_impersonation = True
                continue

        para = _fix_speaker_italic_dialogue(para)
        if not para:
            continue

        # Eşleşmemiş tek yıldızı düzelt (ör. "*Anlatım..." veya "...konuşur.*")
        if para.count("*") == 1:
            clean_p = para.replace("*", "").strip()
            if clean_p:
                para = f"*{clean_p}*" if not _QUOTE_RE.search(clean_p) else clean_p

        kept_paras.append(para)

    # Eğer tüm paragraflar elendiyse (ör. model sadece Deniz yazdıysa) boş dön ki otomatik 1 kez retry tetiklensin
    deduped = clean_duplicate_paragraphs("\n\n".join(kept_paras))
    structured = structure_roleplay_output(deduped)
    return structured.strip(), had_impersonation

def _image_url_to_data_url(image_url: str) -> Optional[str]:
    if not image_url or not str(image_url).startswith("/uploads/"):
        return None
    fname = os.path.basename(str(image_url))
    path = resolve_upload_file(fname)
    if not path or not os.path.exists(path):
        return None
    try:
        with Image.open(path) as img:
            rgb = img.convert("RGB")
            rgb.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            rgb.save(buf, format="JPEG", quality=85)
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            return f"data:image/jpeg;base64,{b64}"
    except Exception:
        return None

def _append_text_to_msg(msg: Dict[str, Any], suffix: str):
    if not suffix:
        return
    c = msg.get("content")
    if isinstance(c, list):
        for part in c:
            if part.get("type") == "text":
                part["text"] = (part.get("text", "") + "\n\n" + suffix).strip()
                return
        c.insert(0, {"type": "text", "text": suffix})
    else:
        msg["content"] = (str(c or "") + "\n\n" + suffix).strip()

def _prepend_text_to_msg(msg: Dict[str, Any], prefix: str):
    if not prefix:
        return
    c = msg.get("content")
    if isinstance(c, list):
        for part in c:
            if part.get("type") == "text":
                part["text"] = (prefix + "\n\n" + part.get("text", "")).strip()
                return
        c.insert(0, {"type": "text", "text": prefix})
    else:
        msg["content"] = (prefix + "\n\n" + str(c or "")).strip()

def _msg_char_len(msg: Dict[str, Any]) -> int:
    c = msg.get("content")
    if isinstance(c, list):
        return sum(len(str(p.get("text") or "")) for p in c if p.get("type") == "text")
    return len(str(c or ""))

def _parse_example_dialogs(raw_examples: str, char_name: str, user_name: str) -> List[Dict[str, str]]:
    if not raw_examples or not raw_examples.strip():
        return []
    txt = replace_macros(raw_examples.strip(), char_name, user_name)
    txt = re.sub(r"<START>\s*", "\n", txt, flags=re.IGNORECASE)

    u_low = _tr_lower(user_name)
    turn_re = re.compile(
        rf"^(?:{re.escape(user_name)}|user|kullanıcı|{re.escape(char_name)}|char|assistant)\s*:\s*(.*)$",
        re.IGNORECASE,
    )

    parsed: List[Dict[str, str]] = []
    cur_role = None
    cur_lines: List[str] = []

    def flush():
        nonlocal cur_role, cur_lines
        if cur_role and cur_lines:
            body = "\n".join(cur_lines).strip()
            if body:
                if parsed and parsed[-1]["role"] == cur_role:
                    parsed[-1]["content"] += "\n" + body
                else:
                    parsed.append({"role": cur_role, "content": body})
        cur_role = None
        cur_lines = []

    for line in txt.splitlines():
        st = line.strip()
        if not st:
            if cur_lines:
                cur_lines.append("")
            continue
        m = turn_re.match(st)
        if m:
            flush()
            head = _tr_lower(st.split(":", 1)[0].strip())
            cur_role = "user" if head in (u_low, "user", "kullanıcı") else "assistant"
            first_body = m.group(1).strip()
            if first_body:
                cur_lines.append(first_body)
        elif cur_role:
            cur_lines.append(st)

    flush()
    roles = {m["role"] for m in parsed}
    if "user" in roles and "assistant" in roles:
        return parsed[:6]
    return []

def _sanitize_chat_alternation(msgs: List[Dict[str, Any]], merge_system_into_user: bool = False) -> List[Dict[str, Any]]:
    """
    Tüm GGUF Jinja şablonlarıyla (Mistral, Gemma, Qwen, DeepSeek, Llama) %100 uyumluluk sağlar:
    - Yalnızca en başta 1 adet `system` mesajı bulunur (veya `merge_system_into_user=True` ise ilk `user` mesajına katlanır).
    - `system` sonrasındaki İLK mesaj MUTLAKA `user` olur (karşılama mesajı `assistant` ile başlıyorsa önüne kısa `user` açılışı eklenir).
    - Arka arkaya gelen aynı roller (user+user veya assistant+assistant) tek mesajda birleştirilir.
    - Son mesaj her zaman `user` olur.
    """
    if not msgs:
        return []

    sys_texts: List[str] = []
    conv: List[Dict[str, Any]] = []

    for m in msgs:
        role = m.get("role")
        if role == "system":
            st = str(m.get("content") or "").strip()
            if st:
                sys_texts.append(st)
            continue
        if role not in ("user", "assistant"):
            continue
        copy_m = json.loads(json.dumps(m, ensure_ascii=False))
        if conv and conv[-1]["role"] == role:
            if isinstance(copy_m.get("content"), list):
                if isinstance(conv[-1]["content"], list):
                    conv[-1]["content"].extend(copy_m["content"])
                else:
                    conv[-1]["content"] = [{"type": "text", "text": str(conv[-1]["content"])}, *copy_m["content"]]
            else:
                _append_text_to_msg(conv[-1], str(copy_m.get("content") or ""))
        else:
            conv.append(copy_m)

    # Katı Jinja kuralı: sohbet geçmişinin ilk mesajı MUTLAKA `user` olmalıdır!
    if not conv:
        conv.append({"role": "user", "content": "(Hikâyeyi başlat.)"})
    elif conv[0]["role"] == "assistant":
        conv.insert(0, {"role": "user", "content": "(Sahneyi başlat.)"})

    # Son mesaj `user` değilse ekle
    if conv[-1]["role"] != "user":
        conv.append({"role": "user", "content": "(Sahneyi devam ettir.)"})

    sys_joined = "\n\n".join(sys_texts).strip()
    if not sys_joined:
        return conv

    if merge_system_into_user:
        first_c = conv[0].get("content")
        if isinstance(first_c, list):
            first_c.insert(0, {"type": "text", "text": f"[SİSTEM TALİMATI]\n{sys_joined}\n\n"})
        else:
            conv[0]["content"] = f"[SİSTEM TALİMATI]\n{sys_joined}\n\n{first_c or ''}".strip()
        return conv

    return [{"role": "system", "content": sys_joined}, *conv]

def build_messages(
    settings: Dict[str, str],
    character: Dict,
    persona: Optional[Dict],
    history: List[Dict],
    lore_blocks: List[str] = None,
    always_lore_blocks: List[str] = None,
    state_prompt: str = "",
    recency_anchor: str = "",
    summary: str = "",
    pinned_memory: str = "",
    director_cmd: str = "",
    web_context: str = "",
    continue_mode: bool = False,
    group_info: Optional[Dict] = None,
    speaker_char: Optional[Dict] = None,
) -> List[Dict[str, Any]]:
    active_char = speaker_char or character
    char_name = active_char.get("name", "Karakter")
    user_name = persona.get("name", "Kullanıcı") if persona else "Kullanıcı"
    no_think = settings.get("no_think_prefix", "1") == "1"
    # '/no_think' yazısı bazı modellerde düz metin olarak görünür ve cevabı bozar; varsayılan kapalı.
    no_think_literal = no_think and settings.get("no_think_literal", "0") == "1"

    # 1. TEK, SADE VE TÜM GGUF ŞABLONLARIYLA %100 UYUMLU SİSTEM MESAJI
    sys_parts = []
    if no_think_literal:
        sys_parts.append("/no_think")

    base_sys = settings.get("system_prompt", "").strip()
    if base_sys:
        sys_parts.append(replace_macros(base_sys, char_name, user_name))
    else:
        sys_parts.append(
            f"Sen canlı, duygulu ve karaktere sadık bir Türkçe rol yapma anlatıcısısın. "
            f"Anlatım (*yıldız içinde*) ve tüm konuşmalar yalnızca doğal ve akıcı Türkçe olsun; yabancı dil veya çeviri yazma. "
            f"{user_name} adına konuşma veya karar alma."
        )

    tone_key = settings.get("story_tone", "emotional")
    if tone_key in TONE_INSTRUCTIONS:
        sys_parts.append(TONE_INSTRUCTIONS[tone_key])

    chat_lang = (settings.get("preferred_lang") or "Türkçe").strip()
    if chat_lang in CHAT_LANG_INSTRUCTIONS and chat_lang != "Türkçe":
        sys_parts.append(CHAT_LANG_INSTRUCTIONS[chat_lang])

    if group_info:
        grp_lines = [f"### Grup Sohbeti: {group_info['name']}"]
        if group_info.get("scenario"):
            grp_lines.append(replace_macros(group_info["scenario"], char_name, user_name))
        grp_lines.append(f"Şu an yanıt verecek karakter: {char_name}.")
        sys_parts.append("\n".join(grp_lines))

    char_lines = [f"### Karakter: {char_name}"]
    if active_char.get("title"):
        char_lines.append(f"Özet: {replace_macros(active_char['title'], char_name, user_name)}")
    if active_char.get("personality"):
        char_lines.append(f"Kişilik:\n{replace_macros(active_char['personality'], char_name, user_name)}")
    if active_char.get("scenario") and not group_info:
        char_lines.append(f"Senaryo:\n{replace_macros(active_char['scenario'], char_name, user_name)}")
    sys_parts.append("\n".join(char_lines))

    few_shot_msgs = _parse_example_dialogs(active_char.get("example_dialogs") or "", char_name, user_name)
    if not few_shot_msgs and active_char.get("example_dialogs"):
        sys_parts.append(f"### Üslup Örneği\n{replace_macros(active_char['example_dialogs'], char_name, user_name)}")

    if persona and persona.get("description"):
        sys_parts.append(f"### {user_name} Hakkında\n{replace_macros(persona['description'], char_name, user_name)}")

    if always_lore_blocks:
        sys_parts.append(
            "### Sabit Karakter Profilleri & Dünya Bilgisi (Hikâyeyi bu profillerdeki ad/soyad, uyruk, yaş, cinsiyet, fiziksel özellikler, kişisel özellikler, yaşantı ve aile bilgilerine birebir sadık kalarak şekillendir; bu detaylarla asla çelişme)\n"
            + "\n\n".join(always_lore_blocks)
        )

    # 1. TEK VE %100 SABİT SİSTEM MESAJI (KV-Cache Prefix Koruması!)
    # Saat, aktif lorebook veya hafıza gibi her tur değişen bilgiler buraya KONULMAZ;
    # böylece LM Studio önceki tüm sohbeti tekrar işlemez ve 5-10x daha hızlı yanıt üretir.
    messages: List[Dict[str, Any]] = [{"role": "system", "content": "\n\n".join(sys_parts)}]

    if few_shot_msgs:
        messages.extend(few_shot_msgs)

    # 2. SOHBET GEÇMİŞİ — SABİT ÖNEKLİ (STICKY) KV-CACHE PENCERESİ
    # Her tur 1 mesaj atmak yerine 6'lı bloklar halinde kırpar; böylece 6 tur boyunca
    # sohbet başı birebir aynı kalır ve LM Studio / llama-server KV-Cache'i sıfırlamadan ~0.3sn'de okur!
    max_ctx = int(settings.get("context_messages", "8"))
    if max_ctx > 0 and len(history) > max_ctx:
        block = 4
        drop = ((len(history) - max_ctx + block - 1) // block) * block
        sliced = history[drop:]
    else:
        sliced = history

    img_indices = [idx for idx, m in enumerate(sliced) if m.get("image_url") and m.get("role") == "user"]
    active_img_indices = set(img_indices[-2:])

    normalized: List[Dict[str, Any]] = []
    for idx, m in enumerate(sliced):
        role = m["role"]
        if role not in ("user", "assistant"):
            continue
        content_txt = replace_macros(m.get("content", ""), char_name, user_name).strip()
        img_url = m.get("image_url") or ""
        data_url = _image_url_to_data_url(img_url) if (idx in active_img_indices and role == "user") else None

        if not content_txt and not data_url:
            continue
        if group_info and role == "assistant" and m.get("speaker_name"):
            content_txt = f"[{m['speaker_name']}]: {content_txt}"

        if data_url:
            vision_hint = (
                f"{content_txt}\n\n[Kullanıcı bir görsel paylaştı; içindeki detayları hikâyeye doğal biçimde yansıt.]"
                if content_txt
                else f"[{user_name} bir görsel paylaştı; gördüğün detayları hikâyeye doğal biçimde yansıt.]"
            )
            msg_obj: Dict[str, Any] = {
                "role": "user",
                "content": [
                    {"type": "text", "text": vision_hint},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
            normalized.append(msg_obj)
        else:
            if img_url and role == "user":
                content_txt = f"{content_txt} [Önceki turda görsel paylaşılmıştı]".strip()
            normalized.append({"role": role, "content": content_txt})

    if continue_mode:
        normalized.append({
            "role": "user",
            "content": f"(Önceki mesajı tekrarlamadan, tam kaldığın yerden hikâyeyi {user_name} adına konuşmadan, duygulu ve akıcı biçimde devam ettir.)"
        })
    elif not normalized or normalized[-1]["role"] != "user":
        normalized.append({
            "role": "user",
            "content": f"(Sahneyi {user_name} adına konuşmadan, karşı tarafın duygulu tepkisiyle ilerlet.)"
        })

    # 3. DİNAMİK SAHNE BAĞLAMI — KULLANICININ MESAJINDAN ÖNCE (ÜSTTE) YERLEŞTİRİLİR!
    # Böylece modelin okuduğu EN SON metin %100 kullanıcının yazdığı mesaj olur (asla konudan sapmaz)
    # ve önceki turlar değişmediği için KV-Cache de korunur!
    dyn_parts = []
    mem_lines = []
    if pinned_memory and pinned_memory.strip():
        mem_lines.append("Sabit Notlar: " + replace_macros(pinned_memory.strip(), char_name, user_name)[:700])
    if summary and summary.strip():
        mem_lines.append("Özet: " + replace_macros(summary.strip(), char_name, user_name)[:900])
    if mem_lines:
        dyn_parts.append("\n".join(mem_lines))

    if lore_blocks:
        dyn_parts.append(
            "Sahnede Aktif Karakter Profilleri & Bilgiler (Karakterlerin görünüşü, konuşma/tavırları, uyruğu, yaşı, yaşantısı ve aile bağları aşağıdaki profil detaylarına tam uygun olsun; bilgileri madde listesi gibi saymadan hikâyeye doğal yedir):\n"
            + "\n\n".join(lore_blocks)
        )
    if state_prompt:
        dyn_parts.append(replace_macros(state_prompt, char_name, user_name))
    if web_context:
        dyn_parts.append(f"Web: {web_context[:500]}")
    if director_cmd:
        dyn_parts.append(f"Yönetmen Talimatı: {replace_macros(director_cmd, char_name, user_name)}")
    if chat_lang != "Türkçe" and chat_lang in CHAT_LANG_INSTRUCTIONS:
        dyn_parts.append(f"Response Language: {chat_lang} ONLY.")
    elif recency_anchor and settings.get("strict_consistency", "1") == "1":
        dyn_parts.append(replace_macros(recency_anchor, char_name, user_name))

    if dyn_parts and normalized and normalized[-1]["role"] == "user":
        ctx_header = "[SAHNE BAĞLAMI - Arka plan bilgisi; doğrudan aşağıdaki kullanıcı mesajına yanıt ver]\n" + "\n".join(dyn_parts) + "\n[/SAHNE BAĞLAMI]"
        _prepend_text_to_msg(normalized[-1], ctx_header)
    if no_think_literal and normalized and normalized[-1]["role"] == "user":
        _append_text_to_msg(normalized[-1], "/no_think")

    # 4. AKILLI TOKEN BÜTÇESİ KORUMASI (LM Studio Context Overflow / Truncate Middle engelleyici!)
    max_prompt_chars = int(settings.get("max_prompt_chars", "5500"))
    sys_len = _msg_char_len(messages[0])
    few_len = sum(_msg_char_len(m) for m in messages[1:])
    last_len = _msg_char_len(normalized[-1]) if normalized else 0
    budget_for_prev = max(1200, max_prompt_chars - sys_len - few_len - last_len)

    if len(normalized) > 1:
        kept_prev: List[Dict[str, Any]] = []
        used = 0
        for m in reversed(normalized[:-1]):
            ml = _msg_char_len(m)
            if used + ml > budget_for_prev and len(kept_prev) >= 2:
                break
            kept_prev.append(m)
            used += ml
        kept_prev.reverse()
        normalized = kept_prev + [normalized[-1]]

    messages.extend(normalized)
    return _sanitize_chat_alternation(messages)

async def simple_web_search(query: str) -> str:
    q = (query or "").strip()
    if not q:
        return ""
    snippets = []
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    try:
        async with httpx.AsyncClient(timeout=6.0, follow_redirects=True) as client:
            r = await client.get(
                f"https://api.duckduckgo.com/?q={quote_plus(q)}&format=json&no_html=1&skip_disambig=1",
                headers=headers,
            )
            if r.status_code == 200:
                d = r.json()
                if d.get("AbstractText"):
                    snippets.append(d["AbstractText"][:420])
                for topic in (d.get("RelatedTopics") or [])[:3]:
                    if isinstance(topic, dict) and topic.get("Text"):
                        snippets.append(topic["Text"][:220])
            if not snippets:
                wr = await client.get(
                    f"https://tr.wikipedia.org/w/api.php?action=query&list=search&srsearch={quote_plus(q)}&utf8=&format=json&srlimit=3",
                    headers=headers,
                )
                if wr.status_code == 200:
                    hits = wr.json().get("query", {}).get("search", [])
                    for h in hits[:3]:
                        clean = re.sub(r"<[^>]+>", "", h.get("snippet", ""))
                        if clean:
                            snippets.append(f"{h.get('title','')}: {clean}")
    except Exception:
        return ""
    return " | ".join(snippets)[:900]

_KAGGLE_HEALTH_CACHE: Dict[str, Tuple[bool, float]] = {}


def _build_api_headers(api_url: str, api_key: str = "") -> Dict[str, str]:
    headers: Dict[str, str] = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    if "openrouter.ai" in (api_url or "").lower():
        headers["HTTP-Referer"] = "https://meirchat.local"
        headers["X-Title"] = "MEIRCHAT"
    return headers


def _is_external_cloud_api(backend: str, api_url: str) -> bool:
    if backend == "cloud_api":
        return True
    u = (api_url or "").lower()
    return any(h in u for h in ("openrouter.ai", "api.groq.com", "integrate.api.nvidia.com", "api.openai.com", "generativelanguage.googleapis.com", "api.together.xyz", "api.cerebras.ai"))


async def check_connection(api_url: str, api_key: str = "", timeout: float = 5.0) -> Dict:
    if not (api_url or "").strip():
        return {"connected": False, "models": [], "error": "API adresi bos"}
    url = api_url.rstrip("/") + "/models"
    headers = _build_api_headers(api_url, api_key)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("id", "") for m in data.get("data", []) if isinstance(m, dict) and m.get("id")]
                return {"connected": True, "models": models}
            return {"connected": False, "models": [], "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        return {"connected": False, "models": [], "error": str(e)}


async def _is_remote_gpu_online(gpu_url: str, force: bool = False) -> bool:
    u = (gpu_url or "").strip().rstrip("/")
    if not u:
        return False
    now_t = time.time()
    cached = _KAGGLE_HEALTH_CACHE.get(u)
    if (not force) and cached and (now_t - cached[1]) < 20.0:
        return cached[0]
    info = await check_connection(u, timeout=2.5)
    ok = bool(info.get("connected"))
    _KAGGLE_HEALTH_CACHE[u] = (ok, now_t)
    return ok


async def resolve_llm_target(settings: Dict[str, str], force_ping: bool = False) -> Dict[str, Any]:
    """
    Hibrit motor yonlendirici (v21.0):
    - PC'de varsayilan: Yerel LM Studio / llama-server (istenirse Kaggle/Bulut API secilebilir)
    - Bulutta / iPhone'da varsayilan ('hybrid_auto'):
        1) Kaggle/Colab GPU tuneli aciksa -> Kendi sansursuz GGUF modelin!
        2) Kapaliysa -> Ucretsiz Bulut API (OpenRouter / Groq / NVIDIA NIM) aninda devrede!
    """
    mode = (settings.get("cloud_llm_mode") or "hybrid_auto").strip().lower() if IS_CLOUD else (settings.get("pc_llm_mode") or "local").strip().lower()

    local_url = (settings.get("api_url") or "http://localhost:1234/v1").strip().rstrip("/")
    gpu_url = (settings.get("remote_gpu_url") or "").strip().rstrip("/")
    gpu_model = (settings.get("remote_gpu_model") or "").strip()
    cloud_url = (settings.get("cloud_api_url") or "https://openrouter.ai/api/v1").strip().rstrip("/")
    cloud_key = (settings.get("cloud_api_key") or "").strip()
    cloud_model = (settings.get("cloud_api_model") or "google/gemma-3-27b-it:free").strip()

    def _pack(backend: str, label: str, base_url: str, api_key: str = "", preferred_model: str = ""):
        return {
            "backend": backend,
            "label": label,
            "base_url": base_url,
            "chat_url": base_url.rstrip("/") + "/chat/completions",
            "api_key": api_key,
            "headers": _build_api_headers(base_url, api_key),
            "preferred_model": preferred_model,
            "is_external": _is_external_cloud_api(backend, base_url),
        }

    if mode == "kaggle":
        return _pack("kaggle", "Kaggle GPU", gpu_url, "", gpu_model)

    if mode == "cloud_api":
        return _pack("cloud_api", "Bulut API", cloud_url, cloud_key, cloud_model)

    if mode == "local" and not IS_CLOUD:
        return _pack("local", "Yerel PC", local_url, "", (settings.get("model_name") or "").strip())

    # hybrid_auto
    if gpu_url and await _is_remote_gpu_online(gpu_url, force=force_ping):
        return _pack("kaggle", "Kaggle GPU", gpu_url, "", gpu_model)

    if cloud_key:
        return _pack("cloud_api", "Bulut API", cloud_url, cloud_key, cloud_model)

    if not IS_CLOUD:
        return _pack("local", "Yerel PC", local_url, "", (settings.get("model_name") or "").strip())

    # Bulutta ne Kaggle acik ne de Bulut API anahtari girili
    return _pack("kaggle", "Kaggle GPU (Kapalı)", gpu_url, "", gpu_model)


async def check_active_status(settings: Dict[str, str]) -> Dict[str, Any]:
    target = await resolve_llm_target(settings, force_ping=True)
    if not target["base_url"]:
        return {
            "connected": False,
            "models": [],
            "backend": target["backend"],
            "backend_label": target["label"],
            "is_cloud": IS_CLOUD,
            "error": "Kaggle GPU kapalı ve Ücretsiz Bulut API anahtarı henüz girilmemiş.",
        }
    if target["backend"] == "cloud_api":
        if not target["api_key"]:
            return {
                "connected": False,
                "models": [],
                "backend": "cloud_api",
                "backend_label": "Bulut API",
                "is_cloud": IS_CLOUD,
                "error": "Bulut API anahtarı girilmemiş.",
            }
        # API anahtari olan dis saglayicilarda hizli /models kontrolu
        info = await check_connection(target["base_url"], api_key=target["api_key"], timeout=4.5)
        if not info.get("connected") and target["preferred_model"]:
            # Bazi ucretsiz API'ler /models endpointini kisitlar ama chat/completions calisir
            info = {"connected": True, "models": [target["preferred_model"]]}
        info["backend"] = "cloud_api"
        info["backend_label"] = "Bulut API"
        info["is_cloud"] = IS_CLOUD
        return info

    info = await check_connection(target["base_url"], api_key=target["api_key"], timeout=3.5)
    info["backend"] = target["backend"]
    info["backend_label"] = target["label"]
    info["is_cloud"] = IS_CLOUD
    return info


async def _resolve_model(settings: Dict[str, str], target: Optional[Dict[str, Any]] = None) -> str:
    tgt = target or await resolve_llm_target(settings)
    if tgt.get("preferred_model"):
        return tgt["preferred_model"]
    if tgt["backend"] == "local":
        model_name = settings.get("model_name", "").strip()
        if model_name:
            return model_name
    api_url = (tgt.get("base_url") or settings.get("api_url", "http://localhost:1234/v1")).rstrip("/")
    cached = _MODEL_CACHE.get(api_url)
    now_t = time.time()
    if cached and (now_t - cached[1]) < 60.0:
        return cached[0]
    conn_info = await check_connection(api_url, api_key=tgt.get("api_key", ""))
    if conn_info["models"]:
        chosen = conn_info["models"][0]
        _MODEL_CACHE[api_url] = (chosen, now_t)
        return chosen
    return "local-model"

async def generate_reply_suggestions(
    settings: Dict[str, str],
    character: Dict,
    persona: Optional[Dict],
    history: List[Dict],
) -> List[str]:
    target = await resolve_llm_target(settings)
    api_url = target["chat_url"]
    headers = target["headers"]
    model_name = await _resolve_model(settings, target)
    user_name = persona.get("name", "Kullanıcı") if persona else "Kullanıcı"
    char_name = character.get("name", "Karakter") if character else "Karakter"

    recent = history[-6:] if history else []
    transcript = "\n".join(
        f"{m.get('speaker_name') or (user_name if m['role']=='user' else char_name)}: {str(m.get('content',''))[:450]}"
        for m in recent
    )

    chat_lang = (settings.get("preferred_lang") or "Türkçe").strip()
    prompt = (
        f"Write 3 different short, natural reply suggestions in {chat_lang} for {user_name}'s next turn in this roleplay scene. "
        "Each should be 1-2 sentences: 1) calm/emotional, 2) bold/decisive, 3) surprising/action-driving. "
        "Output ONLY 3 numbered lines (1., 2., 3.) in " + chat_lang + " with no extra text.\n\n"
        f"Recent Scene:\n{transcript}"
    )
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": "Sen yaratıcı rol yapma yanıt önerisi üreten bir asistansın. Sadece 3 numaralı Türkçe öneri satırı yaz."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.78,
        "max_tokens": 350,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    try:
        if target["is_external"]:
            payload.pop("chat_template_kwargs", None)
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(api_url, json=payload, headers=headers)
            if resp.status_code == 400:
                payload.pop("chat_template_kwargs", None)
                resp = await client.post(api_url, json=payload, headers=headers)
            if resp.status_code == 200:
                txt = resp.json()["choices"][0]["message"].get("content", "")
                if "</think>" in txt:
                    txt = txt.split("</think>")[-1]
                lines = []
                for raw_l in txt.splitlines():
                    cleaned = re.sub(r"^\s*(?:\d+[\.)\-:]|[-•*])\s*", "", raw_l).strip().strip('"')
                    if len(cleaned) >= 8:
                        lines.append(cleaned)
                if lines:
                    return lines[:3]
    except Exception:
        pass
    return [
        "*Derin bir nefes alıp gözlerinin içine bakar.* “Sakin ol, bunu birlikte halledeceğiz.”",
        "*Ayağa kalkıp kararlı bir sesle konuşur.* “Hemen şimdi gidip bu işi bitirelim.”",
        "*Bir an sessizce düşünüp telefonuna uzanır.* “Aklıma daha iyi bir plan geldi.”"
    ]

async def summarize_messages(settings: Dict[str, str], old_summary: str, msgs: List[Dict]) -> str:
    target = await resolve_llm_target(settings)
    api_url = target["chat_url"]
    headers = target["headers"]
    model_name = await _resolve_model(settings, target)
    transcript = "\n".join(f"{m.get('speaker_name') or m['role']}: {m['content'][:500]}" for m in msgs)
    prompt = (
        "Aşağıdaki rol yapma sohbeti için KÜMÜLATİF KALICI HAFIZA DEFTERİ oluştur/güncelle. "
        "Mevcut hafızadaki hiçbir önemli detayı SİLME; yeni gelişmeleri şu 4 başlık altında kısa ve net maddelerle birleştir:\n"
        "1) Karakterler & İlişkiler (kim kimdir, tutumları, dil seviyeleri, yakınlık/gerilim)\n"
        "2) Önemli Olaylar & Kararlar\n"
        "3) Verilen Sözler, Sırlar & Bekleyen Planlar\n"
        "4) Mekân, Eşyalar & Güncel Durum\n\n"
        f"Mevcut Hafıza:\n{old_summary or 'Yok'}\n\nYeni Mesajlar:\n{transcript}\n/no_think"
    )
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": "Sen hikaye tutarlılığı için net ve kapsamlı Türkçe hafıza özetleri çıkaran bir asistansın."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.25,
        "max_tokens": 900,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    try:
        if target["is_external"]:
            payload.pop("chat_template_kwargs", None)
        async with httpx.AsyncClient(timeout=75.0) as client:
            resp = await client.post(api_url, json=payload, headers=headers)
            if resp.status_code == 400:
                payload.pop("chat_template_kwargs", None)
                resp = await client.post(api_url, json=payload, headers=headers)
            if resp.status_code == 200:
                txt = resp.json()["choices"][0]["message"].get("content", "")
                if "</think>" in txt:
                    txt = txt.split("</think>")[-1]
                return txt.strip()
    except Exception:
        pass
    return old_summary

async def evaluate_ai_rulebook_judge(settings: Dict[str, str], judge_prompt: str) -> Dict[str, Any]:
    if not judge_prompt:
        return {}
    target = await resolve_llm_target(settings)
    api_url = target["chat_url"]
    headers = target["headers"]
    model_name = await _resolve_model(settings, target)
    payload: Dict[str, Any] = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": "Sen yalnızca saf JSON nesnesi döndüren hızlı bir rol yapma kural hakemisin. Değişiklik yoksa {} döndür."},
            {"role": "user", "content": judge_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": 180,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    try:
        if target["is_external"]:
            payload.pop("chat_template_kwargs", None)
        async with httpx.AsyncClient(timeout=28.0) as client:
            resp = await client.post(api_url, json=payload, headers=headers)
            if resp.status_code == 400 and "chat_template_kwargs" in payload:
                payload.pop("chat_template_kwargs", None)
                resp = await client.post(api_url, json=payload, headers=headers)
            if resp.status_code != 200:
                return {}
            txt = resp.json()["choices"][0]["message"].get("content", "")
            if "</think>" in txt:
                txt = txt.split("</think>")[-1]
            txt = txt.strip()
            txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt, flags=re.IGNORECASE | re.DOTALL).strip()
            m = re.search(r"\{.*\}", txt, flags=re.DOTALL)
            if not m:
                return {}
            parsed = json.loads(m.group(0))
            return parsed if isinstance(parsed, dict) else {}
    except Exception:
        return {}

async def _stream_llm_events(
    api_url: str,
    payload: Dict[str, Any],
    emit_tokens: bool = True,
    headers: Optional[Dict[str, str]] = None,
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    LM Studio'dan canlı token akışı okur; <think> bloklarını gizler.
    - HTTP 400, SSE içi JSON error veya boş stream durumunda otomatik uyumlu parametrelerle (safe fallback) kurtarma yapar.
    """
    active_payload = json.loads(json.dumps(payload, ensure_ascii=False))
    tried_safe_fallback = False

    for attempt in range(4):
        in_think = False
        reasoning_chars = 0
        finish_reason = ""
        buffer = ""
        visible_output = ""
        sent_first_token = False
        stream_err = ""

        client = _get_http_client()
        t_req_start = time.perf_counter()
        t_first_tok = None
        token_chunks = 0
        if True:
            async with client.stream("POST", api_url, json=active_payload, headers=headers or {}) as resp:
                if resp.status_code != 200:
                    err_raw = (await resp.aread()).decode("utf-8", errors="ignore")
                    err_low = err_raw.lower()
                    if resp.status_code == 400 and any(k in active_payload for k in ("reasoning_effort", "cache_prompt")):
                        # ONCE sadece reasoning_effort ve cache_prompt kaldir, chat_template_kwargs (enable_thinking=False) KORUNSUN!
                        active_payload.pop("reasoning_effort", None)
                        active_payload.pop("cache_prompt", None)
                        continue
                    if resp.status_code == 400 and "chat_template_kwargs" in active_payload:
                        active_payload.pop("chat_template_kwargs", None)
                        continue
                    if resp.status_code == 400 and not tried_safe_fallback:
                        tried_safe_fallback = True
                        active_payload.pop("min_p", None)
                        active_payload.pop("top_k", None)
                        active_payload.pop("repeat_penalty", None)
                        active_payload.pop("cache_prompt", None)
                        active_payload.pop("reasoning_effort", None)
                        merge_sys = any(k in err_low for k in ("system", "alternate", "role", "jinja", "template"))
                        active_payload["messages"] = _sanitize_chat_alternation(
                            active_payload.get("messages", []),
                            merge_system_into_user=merge_sys,
                        )
                        continue
                    if resp.status_code == 400 and any(k in err_low for k in ("image", "vision", "multimodal", "mmproj")):
                        yield {"type": "_result", "text": "", "reasoning_chars": 0, "finish_reason": "", "error": "LM Studio'da şu an yüklü olan model görsel (Vision) desteklemiyor. Görsel göndermek için LM Studio'da Vision destekli bir model (ör. Qwen2.5-VL, Qwen3-VL veya Gemma 3) yükle."}
                        return
                    yield {"type": "_result", "text": "", "reasoning_chars": 0, "finish_reason": "", "error": f"Model hatası ({resp.status_code}): {err_raw}"}
                    return

                async for line in resp.aiter_lines():
                    st = (line or "").strip()
                    if not st:
                        continue
                    if st.startswith("{") and '"error"' in st:
                        try:
                            err_obj = json.loads(st)
                            em = err_obj.get("error")
                            stream_err = em.get("message", str(em)) if isinstance(em, dict) else str(em)
                            break
                        except Exception:
                            pass
                    if not st.startswith("data:"):
                        continue
                    data_str = st[5:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except Exception:
                        continue

                    if isinstance(chunk, dict) and chunk.get("error"):
                        em = chunk["error"]
                        stream_err = em.get("message", str(em)) if isinstance(em, dict) else str(em)
                        break

                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    choice = choices[0]
                    if choice.get("finish_reason"):
                        finish_reason = str(choice.get("finish_reason"))
                    delta = choice.get("delta") or {}

                    reasoning = delta.get("reasoning_content") or delta.get("reasoning") or ""
                    if reasoning:
                        reasoning_chars += len(reasoning)

                    token = delta.get("content") or delta.get("text") or ""
                    if not token:
                        continue
                    if t_first_tok is None:
                        t_first_tok = time.perf_counter()
                    token_chunks += 1

                    buffer += token

                    while True:
                        if not in_think:
                            idx_t = buffer.find("<think>")
                            idx_g = buffer.find("<|channel>thought")
                            if idx_t != -1 and (idx_g == -1 or idx_t < idx_g):
                                before = buffer[:idx_t]
                                if before:
                                    visible_output += before
                                    if emit_tokens:
                                        if not sent_first_token:
                                            sent_first_token = True
                                            yield {"type": "thinking", "text": False}
                                        yield {"type": "token", "text": before}
                                buffer = buffer[idx_t + 7:]
                                in_think = "think"
                            elif idx_g != -1:
                                before = buffer[:idx_g]
                                if before:
                                    visible_output += before
                                    if emit_tokens:
                                        if not sent_first_token:
                                            sent_first_token = True
                                            yield {"type": "thinking", "text": False}
                                        yield {"type": "token", "text": before}
                                buffer = buffer[idx_g + 17:]
                                in_think = "gemma"
                            else:
                                if len(buffer) > 17:
                                    piece = buffer[:-17]
                                    visible_output += piece
                                    if emit_tokens:
                                        if not sent_first_token:
                                            sent_first_token = True
                                            yield {"type": "thinking", "text": False}
                                        yield {"type": "token", "text": piece}
                                    buffer = buffer[-17:]
                                break
                        else:
                            end_tag = "<channel|>" if in_think == "gemma" else "</think>"
                            idx = buffer.find(end_tag)
                            if idx != -1:
                                reasoning_chars += idx
                                buffer = buffer[idx + len(end_tag):]
                                in_think = False
                            else:
                                keep = len(end_tag)
                                if len(buffer) > keep:
                                    reasoning_chars += len(buffer) - keep
                                    buffer = buffer[-keep:]
                                break

                if not in_think and buffer:
                    visible_output += buffer
                    if emit_tokens:
                        if not sent_first_token:
                            sent_first_token = True
                            yield {"type": "thinking", "text": False}
                        yield {"type": "token", "text": buffer}

        # Eğer ilk denemede SSE hatası veya boş stream döndüyse güvenli parametrelerle (gerekirse system birleştirerek) 1 kez daha dene
        if (stream_err or (not visible_output.strip() and reasoning_chars == 0)) and not tried_safe_fallback:
            tried_safe_fallback = True
            active_payload.pop("chat_template_kwargs", None)
            active_payload.pop("min_p", None)
            active_payload.pop("stop", None)
            err_low_s = (stream_err or "").lower()
            merge_sys = any(k in err_low_s for k in ("system", "alternate", "role", "jinja", "template"))
            active_payload["messages"] = _sanitize_chat_alternation(
                active_payload.get("messages", []),
                merge_system_into_user=merge_sys,
            )
            continue

        if stream_err and not visible_output.strip():
            yield {"type": "_result", "text": "", "reasoning_chars": reasoning_chars, "finish_reason": finish_reason, "error": f"LM Studio akış hatası: {stream_err}"}
            return

        t_done = time.perf_counter()
        ttft = round((t_first_tok - t_req_start), 2) if t_first_tok else round((t_done - t_req_start), 2)
        gen_s = round(max(0.01, t_done - (t_first_tok or t_req_start)), 2)
        tot_s = round(t_done - t_req_start, 2)
        tps = round(token_chunks / gen_s, 1) if token_chunks > 1 else 0.0
        yield {
            "type": "_result",
            "text": visible_output,
            "reasoning_chars": reasoning_chars,
            "finish_reason": finish_reason,
            "error": None,
            "timing": {"ttft": ttft, "gen_s": gen_s, "total_s": tot_s, "tokens": token_chunks, "tps": tps, "reasoning_chars": reasoning_chars},
        }
        return

async def stream_chat(
    settings: Dict[str, str],
    messages: List[Dict[str, Any]],
    user_name: str = "",
    last_user_text: str = "",
    emit_tokens: bool = True,
    chat_id: Optional[int] = None,
) -> AsyncGenerator[Dict, None]:
    target = await resolve_llm_target(settings)
    if not target["base_url"]:
        yield {"type": "error", "text": "Aktif bir AI motoru bağlı değil. Kaggle GPU notebook'unu başlat veya Ayarlar → Hibrit Bulut & iPhone Merkezi'nden ücretsiz Bulut API anahtarını gir."}
        return
    if target["backend"] == "cloud_api" and not target["api_key"]:
        yield {"type": "error", "text": "Ücretsiz Bulut API seçili ama API anahtarı boş. Ayarlar → Hibrit Bulut & iPhone Merkezi'nden OpenRouter / Groq anahtarını ekle."}
        return

    api_url = target["chat_url"]
    req_headers = target["headers"]
    is_ext = target["is_external"]
    model_name = await _resolve_model(settings, target)

    no_think = settings.get("no_think_prefix", "1") == "1"
    raw_max_tok = int(settings.get("max_tokens", "2048"))
    effective_max_tok = max(raw_max_tok, 2048) if not no_think else max(raw_max_tok, 120)

    stop_seqs = build_user_stop_sequences(user_name)

    pres_pen = float(settings.get("presence_penalty", "0.15"))
    freq_pen = float(settings.get("frequency_penalty", "0.10"))

    payload: Dict[str, Any] = {
        "model": model_name,
        "messages": _sanitize_chat_alternation(messages),
        "temperature": float(settings.get("temperature", "0.72")),
        "max_tokens": effective_max_tok,
        "top_p": float(settings.get("top_p", "0.90")),
        "stream": True,
    }
    if not is_ext:
        payload["min_p"] = float(settings.get("min_p", "0.06"))
        payload["repeat_penalty"] = float(settings.get("rep_penalty", "1.0"))
        top_k = int(float(settings.get("top_k", "20") or 0))
        if top_k > 0:
            payload["top_k"] = top_k
        payload["cache_prompt"] = True
        if no_think:
            payload["chat_template_kwargs"] = {"enable_thinking": False}
            payload["reasoning_effort"] = "none"
    if pres_pen != 0.0:
        payload["presence_penalty"] = pres_pen
    if freq_pen != 0.0:
        payload["frequency_penalty"] = freq_pen
    if stop_seqs:
        payload["stop"] = stop_seqs

    _chars = sum(len(str(m.get("content"))) for m in payload["messages"])
    print(f"[PROMPT] ~{int(_chars / 2.8)} token tahmini, {len(payload['messages'])} mesaj, max_tokens={effective_max_tok}", flush=True)

    yield {"type": "thinking", "text": True}

    try:
        res = {"text": "", "reasoning_chars": 0, "finish_reason": "", "error": None}
        async for ev in _stream_llm_events(api_url, payload, emit_tokens=emit_tokens, headers=req_headers):
            if ev["type"] == "_result":
                res = ev
            else:
                yield ev

        if res.get("error"):
            yield {"type": "error", "text": res["error"]}
            return

        raw_text = res["text"]
        reasoning_chars = res["reasoning_chars"]
        finish_reason = res["finish_reason"]
        if no_think and reasoning_chars > 0:
            print("[UYARI] Düşünme kapatılamadı: model hâlâ gizli düşünüyor. LM Studio'da model ayarlarından "
                  "'Enable Thinking' seçeneğini kapat (cevaplar hem yavaşlar hem bozulur).", flush=True)

        cleaned, had_imp = clean_roleplay_output(raw_text, user_name=user_name, last_user_text=last_user_text)

        if user_name and len(cleaned) < 15 and (had_imp or finish_reason == "stop"):
            yield {"type": "thinking", "text": True}
            retry_msgs = json.loads(json.dumps(payload["messages"], ensure_ascii=False))
            nudge = f"Doğrudan karşıdaki karakterin (NPC) duygulu tepkisiyle devam et; {user_name} adına konuşma."
            if retry_msgs and retry_msgs[0]["role"] == "system":
                _append_text_to_msg(retry_msgs[0], nudge)

            retry_payload = dict(payload)
            retry_payload["messages"] = _sanitize_chat_alternation(retry_msgs)

            r_res = {"text": "", "reasoning_chars": 0, "finish_reason": "", "error": None}
            async for ev in _stream_llm_events(api_url, retry_payload, emit_tokens=False, headers=req_headers):
                if ev["type"] == "_result":
                    r_res = ev
            if not r_res.get("error") and r_res["text"].strip():
                r_clean, _ = clean_roleplay_output(r_res["text"], user_name=user_name, last_user_text=last_user_text)
                if len(r_clean) > len(cleaned):
                    cleaned = r_clean
                    reasoning_chars += r_res["reasoning_chars"]
                    finish_reason = r_res["finish_reason"]

        if not cleaned.strip():
            if reasoning_chars > 0:
                yield {
                    "type": "error",
                    "text": f"Model tüm token hakkını ({effective_max_tok} token) gizli düşünmeye harcadı (finish: {finish_reason or 'length'}). LM Studio'da 'Enable Thinking' ayarını kapat veya En Uzun Cevap değerini artır."
                }
            else:
                yield {
                    "type": "error",
                    "text": f"LM Studio hiç metin üretmedi (finish: {finish_reason or 'boş'}). LM Studio'da modelin yüklü olduğunu ve bağlam uzunluğunun (Context Length) yeterli olduğunu kontrol et."
                }
            return

        timing = dict(res.get("timing") or {})
        timing["reasoning_chars"] = reasoning_chars
        if timing:
            print(
                f"[HIZ] İlk token (TTFT): {timing.get('ttft', 0)}s | Üretim: {timing.get('gen_s', 0)}s | "
                f"Toplam: {timing.get('total_s', 0)}s | ~{timing.get('tps', 0)} tok/s ({timing.get('tokens', 0)} parça)",
                flush=True,
            )
            if chat_id is not None and chat_id in LAST_PROMPT_DEBUG:
                LAST_PROMPT_DEBUG[chat_id]["timing"] = timing

        yield {"type": "thinking", "text": False}
        yield {"type": "done", "text": cleaned, "timing": timing}

    except httpx.ConnectError:
        yield {"type": "error", "text": f"{target['label']} sunucusuna bağlanılamadı. Motorun açık olduğundan emin olup 'Tekrar Dene'ye bas (veya Hibrit modda Ücretsiz Bulut API'ye geç)."}
    except Exception as e:
        yield {"type": "error", "text": f"Beklenmeyen hata: {str(e)}"}
