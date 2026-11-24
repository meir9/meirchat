"""MEIRCHAT Yuksek Kaliteli TTS Motoru (v19.2).
Yalnizca 10 secili dilde (Turkce, Azerbaycan Turkcesi, Ingilizce, Rusca, Almanca,
Fransizca, Ispanyolca, Italyanca, Cince, Japonca) ayri Kadin & Erkek sesleri sunar.
- Google Cloud API Anahtari varsa: Google Chirp 3 HD / Neural2 / WaveNet
- Anahtarsiz Mod: HD Neural Kadin/Erkek (edge-tts) + Google Translate TTS yedegi
"""
import asyncio
import base64
import re
from typing import Dict, List, Optional, Tuple
import httpx

CURATED_VOICES: List[Dict[str, str]] = [
    # 1. Türkçe
    {"id": "tr-F", "lang": "tr", "lang_label": "Türkçe", "gender": "F", "voice_label": "Emel",
     "gcloud": "tr-TR-Wavenet-D", "gcloud_fb": "tr-TR-Wavenet-A", "gcloud_lang": "tr-TR",
     "neural": "tr-TR-EmelNeural", "gfree": "tr"},
    {"id": "tr-M", "lang": "tr", "lang_label": "Türkçe", "gender": "M", "voice_label": "Ahmet",
     "gcloud": "tr-TR-Wavenet-B", "gcloud_fb": "tr-TR-Wavenet-E", "gcloud_lang": "tr-TR",
     "neural": "tr-TR-AhmetNeural", "gfree": "tr"},

    # 2. Azerbaycan Türkçesi
    {"id": "az-F", "lang": "az", "lang_label": "Azərbaycanca (Azerbaycan Türkçesi)", "gender": "F", "voice_label": "Banu",
     "gcloud": "", "gcloud_fb": "", "gcloud_lang": "az-AZ",
     "neural": "az-AZ-BanuNeural", "gfree": "az"},
    {"id": "az-M", "lang": "az", "lang_label": "Azərbaycanca (Azerbaycan Türkçesi)", "gender": "M", "voice_label": "Babək",
     "gcloud": "", "gcloud_fb": "", "gcloud_lang": "az-AZ",
     "neural": "az-AZ-BabekNeural", "gfree": "az"},

    # 3. İngilizce
    {"id": "en-F", "lang": "en", "lang_label": "English (İngilizce)", "gender": "F", "voice_label": "Ava",
     "gcloud": "en-US-Chirp3-HD-Aoede", "gcloud_fb": "en-US-Neural2-F", "gcloud_lang": "en-US",
     "neural": "en-US-AvaMultilingualNeural", "neural_fb": "en-US-JennyNeural", "gfree": "en"},
    {"id": "en-M", "lang": "en", "lang_label": "English (İngilizce)", "gender": "M", "voice_label": "Andrew",
     "gcloud": "en-US-Chirp3-HD-Charon", "gcloud_fb": "en-US-Neural2-D", "gcloud_lang": "en-US",
     "neural": "en-US-AndrewMultilingualNeural", "neural_fb": "en-US-GuyNeural", "gfree": "en"},

    # 4. Rusça
    {"id": "ru-F", "lang": "ru", "lang_label": "Русский (Rusça)", "gender": "F", "voice_label": "Svetlana",
     "gcloud": "ru-RU-Chirp3-HD-Aoede", "gcloud_fb": "ru-RU-Wavenet-E", "gcloud_lang": "ru-RU",
     "neural": "ru-RU-SvetlanaNeural", "gfree": "ru"},
    {"id": "ru-M", "lang": "ru", "lang_label": "Русский (Rusça)", "gender": "M", "voice_label": "Dmitry",
     "gcloud": "ru-RU-Chirp3-HD-Charon", "gcloud_fb": "ru-RU-Wavenet-D", "gcloud_lang": "ru-RU",
     "neural": "ru-RU-DmitryNeural", "gfree": "ru"},

    # 5. Almanca
    {"id": "de-F", "lang": "de", "lang_label": "Deutsch (Almanca)", "gender": "F", "voice_label": "Katja",
     "gcloud": "de-DE-Chirp3-HD-Aoede", "gcloud_fb": "de-DE-Neural2-F", "gcloud_lang": "de-DE",
     "neural": "de-DE-KatjaNeural", "gfree": "de"},
    {"id": "de-M", "lang": "de", "lang_label": "Deutsch (Almanca)", "gender": "M", "voice_label": "Conrad",
     "gcloud": "de-DE-Chirp3-HD-Charon", "gcloud_fb": "de-DE-Neural2-B", "gcloud_lang": "de-DE",
     "neural": "de-DE-ConradNeural", "gfree": "de"},

    # 6. Fransızca
    {"id": "fr-F", "lang": "fr", "lang_label": "Français (Fransızca)", "gender": "F", "voice_label": "Denise",
     "gcloud": "fr-FR-Chirp3-HD-Aoede", "gcloud_fb": "fr-FR-Neural2-A", "gcloud_lang": "fr-FR",
     "neural": "fr-FR-DeniseNeural", "gfree": "fr"},
    {"id": "fr-M", "lang": "fr", "lang_label": "Français (Fransızca)", "gender": "M", "voice_label": "Henri",
     "gcloud": "fr-FR-Chirp3-HD-Charon", "gcloud_fb": "fr-FR-Neural2-B", "gcloud_lang": "fr-FR",
     "neural": "fr-FR-HenriNeural", "gfree": "fr"},

    # 7. İspanyolca
    {"id": "es-F", "lang": "es", "lang_label": "Español (İspanyolca)", "gender": "F", "voice_label": "Elvira",
     "gcloud": "es-ES-Chirp3-HD-Aoede", "gcloud_fb": "es-ES-Neural2-A", "gcloud_lang": "es-ES",
     "neural": "es-ES-ElviraNeural", "gfree": "es"},
    {"id": "es-M", "lang": "es", "lang_label": "Español (İspanyolca)", "gender": "M", "voice_label": "Alvaro",
     "gcloud": "es-ES-Chirp3-HD-Charon", "gcloud_fb": "es-ES-Neural2-B", "gcloud_lang": "es-ES",
     "neural": "es-ES-AlvaroNeural", "gfree": "es"},

    # 8. İtalyanca
    {"id": "it-F", "lang": "it", "lang_label": "Italiano (İtalyanca)", "gender": "F", "voice_label": "Elsa",
     "gcloud": "it-IT-Chirp3-HD-Aoede", "gcloud_fb": "it-IT-Neural2-A", "gcloud_lang": "it-IT",
     "neural": "it-IT-ElsaNeural", "gfree": "it"},
    {"id": "it-M", "lang": "it", "lang_label": "Italiano (İtalyanca)", "gender": "M", "voice_label": "Diego",
     "gcloud": "it-IT-Chirp3-HD-Charon", "gcloud_fb": "it-IT-Neural2-C", "gcloud_lang": "it-IT",
     "neural": "it-IT-DiegoNeural", "gfree": "it"},

    # 9. Çince
    {"id": "zh-F", "lang": "zh", "lang_label": "中文 (Çince)", "gender": "F", "voice_label": "Xiaoxiao",
     "gcloud": "cmn-CN-Wavenet-A", "gcloud_fb": "cmn-CN-Wavenet-D", "gcloud_lang": "cmn-CN",
     "neural": "zh-CN-XiaoxiaoNeural", "gfree": "zh-CN"},
    {"id": "zh-M", "lang": "zh", "lang_label": "中文 (Çince)", "gender": "M", "voice_label": "Yunxi",
     "gcloud": "cmn-CN-Wavenet-B", "gcloud_fb": "cmn-CN-Wavenet-C", "gcloud_lang": "cmn-CN",
     "neural": "zh-CN-YunxiNeural", "gfree": "zh-CN"},

    # 10. Japonca
    {"id": "ja-F", "lang": "ja", "lang_label": "日本語 (Japonca)", "gender": "F", "voice_label": "Nanami",
     "gcloud": "ja-JP-Chirp3-HD-Aoede", "gcloud_fb": "ja-JP-Neural2-B", "gcloud_lang": "ja-JP",
     "neural": "ja-JP-NanamiNeural", "gfree": "ja"},
    {"id": "ja-M", "lang": "ja", "lang_label": "日本語 (Japonca)", "gender": "M", "voice_label": "Keita",
     "gcloud": "ja-JP-Chirp3-HD-Charon", "gcloud_fb": "ja-JP-Neural2-C", "gcloud_lang": "ja-JP",
     "neural": "ja-JP-KeitaNeural", "gfree": "ja"},
]

VOICE_MAP: Dict[str, Dict[str, str]] = {v["id"]: v for v in CURATED_VOICES}


def get_public_voices() -> List[Dict[str, str]]:
    return [
        {
            "id": v["id"],
            "lang": v["lang"],
            "lang_label": v["lang_label"],
            "gender": v["gender"],
            "voice_label": v.get("voice_label", ""),
            "gcloud": v["gcloud"],
        }
        for v in CURATED_VOICES
    ]


def get_tts_diagnostics() -> Dict[str, object]:
    try:
        import edge_tts
        ver = getattr(edge_tts, "__version__", "")
        if not ver:
            try:
                from importlib.metadata import version as _pkg_ver
                ver = _pkg_ver("edge-tts")
            except Exception:
                ver = "installed"
        return {"edge_tts_ok": True, "edge_tts_version": str(ver)}
    except Exception:
        return {"edge_tts_ok": False, "edge_tts_version": ""}


def _clean_tts_text(text: str) -> str:
    s = str(text or "")
    s = re.sub(r"\*+", "", s)
    s = re.sub(r"[`#_~]+", "", s)
    s = re.sub(r"https?://\S+", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:3500]


def _is_valid_mp3(data: bytes, content_type: str = "") -> bool:
    if not data or len(data) < 256:
        return False
    ct = (content_type or "").lower()
    if "html" in ct or "text/" in ct or "json" in ct:
        return False
    head = data[:16]
    if head.startswith(b"<!") or head.startswith(b"<html") or head.startswith(b"{"):
        return False
    return (
        head.startswith(b"ID3")
        or (len(head) >= 2 and head[0] == 0xFF and (head[1] & 0xE0) == 0xE0)
        or "audio" in ct
        or "mpeg" in ct
    )


def _split_chunks(text: str, max_len: int = 160) -> List[str]:
    if len(text) <= max_len:
        return [text]
    sents = re.split(r"(?<=[.!?;:。！？])\s+", text)
    chunks: List[str] = []
    cur = ""
    for st in sents:
        st = st.strip()
        if not st:
            continue
        if len(cur) + len(st) + 1 <= max_len:
            cur = f"{cur} {st}".strip() if cur else st
        else:
            if cur:
                chunks.append(cur)
            if len(st) <= max_len:
                cur = st
            else:
                words = st.split()
                part = ""
                for w in words:
                    if len(part) + len(w) + 1 <= max_len:
                        part = f"{part} {w}".strip() if part else w
                    else:
                        if part:
                            chunks.append(part)
                        part = w[:max_len]
                cur = part
    if cur:
        chunks.append(cur)
    return chunks


async def _synth_google_cloud(text: str, vdef: Dict[str, str], api_key: str, rate: float, pitch: float) -> Tuple[Optional[bytes], str, str]:
    if not api_key:
        return None, "", "Google Cloud API anahtari bos"
    if not vdef.get("gcloud"):
        return None, "", "Bu dil Google Cloud listesinde yok"
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"
    semi = max(-10.0, min(10.0, (pitch - 1.0) * 12.0))
    speaking_rate = max(0.5, min(2.0, rate))
    last_err = ""

    for voice_name in (vdef.get("gcloud"), vdef.get("gcloud_fb")):
        if not voice_name:
            continue
        audio_cfg = {"audioEncoding": "MP3", "speakingRate": speaking_rate}
        if "Chirp3" not in voice_name:
            audio_cfg["pitch"] = round(semi, 2)
        payload = {
            "input": {"text": text},
            "voice": {"languageCode": vdef["gcloud_lang"], "name": voice_name},
            "audioConfig": audio_cfg,
        }
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.post(url, json=payload)
                if r.status_code == 200:
                    b64 = r.json().get("audioContent")
                    if b64:
                        raw = base64.b64decode(b64)
                        if _is_valid_mp3(raw, "audio/mpeg"):
                            return raw, voice_name, ""
                else:
                    last_err = f"Google Cloud HTTP {r.status_code}"
        except Exception as e:
            last_err = f"Google Cloud hata: {e}"
    return None, "", last_err or "Google Cloud yanit vermedi"


async def _synth_neural(text: str, vdef: Dict[str, str], rate: float, pitch: float) -> Tuple[Optional[bytes], str, str]:
    try:
        import edge_tts
    except ImportError:
        return None, "", "edge-tts kurulu degil (uygulama_kur.bat calistir)"

    rate_pct = int(round((max(0.5, min(2.0, rate)) - 1.0) * 100))
    pitch_hz = int(round((max(0.5, min(1.5, pitch)) - 1.0) * 30))
    rate_str = f"{rate_pct:+d}%"
    pitch_str = f"{pitch_hz:+d}Hz"

    voices_to_try = [vdef["neural"]]
    if vdef.get("neural_fb"):
        voices_to_try.append(vdef["neural_fb"])

    last_err = ""
    for vname in voices_to_try:
        attempts = []
        if rate_pct != 0 or pitch_hz != 0:
            attempts.append({"rate": rate_str, "pitch": pitch_str})
        attempts.append({})

        for kw in attempts:
            async def _collect(vn=vname, k=kw):
                comm = edge_tts.Communicate(text, voice=vn, **k)
                out = bytearray()
                async for chunk in comm.stream():
                    if chunk.get("type") == "audio" and chunk.get("data"):
                        out.extend(chunk["data"])
                return bytes(out)

            try:
                raw = await asyncio.wait_for(_collect(), timeout=15.0)
                if _is_valid_mp3(raw, "audio/mpeg"):
                    return raw, vname, ""
                last_err = f"edge-tts bos veri ({vname})"
            except Exception as e:
                last_err = f"edge-tts {type(e).__name__}: {str(e)[:120]}"
                print(f"[TTS] {last_err}", flush=True)
    return None, "", last_err or "edge-tts yanit vermedi"


async def _synth_google_free(text: str, vdef: Dict[str, str]) -> Tuple[Optional[bytes], str, str]:
    tl = vdef.get("gfree", "tr")
    chunks = _split_chunks(text, max_len=160)
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/",
        "Accept": "audio/mpeg, audio/*;q=0.9, */*;q=0.5",
    }
    out = bytearray()
    last_err = ""
    try:
        async with httpx.AsyncClient(timeout=12.0, follow_redirects=True) as client:
            for ch in chunks:
                got = None
                for client_tag in ("tw-ob", "gtx", "dict-chrome-ex"):
                    try:
                        r = await client.get(
                            "https://translate.googleapis.com/translate_tts",
                            params={"ie": "UTF-8", "client": client_tag, "tl": tl, "q": ch},
                            headers=headers,
                        )
                        if r.status_code == 200 and _is_valid_mp3(r.content, r.headers.get("content-type", "")):
                            got = r.content
                            break
                        last_err = f"Google TTS HTTP {r.status_code}"
                    except Exception as e:
                        last_err = f"Google TTS hata: {e}"
                if not got:
                    return None, "", last_err or "Google TTS parca alinamadi"
                out.extend(got)
        if _is_valid_mp3(bytes(out), "audio/mpeg"):
            return bytes(out), f"google-free-{tl}", ""
        return None, "", "Google TTS gecersiz ses verisi"
    except Exception as e:
        return None, "", f"Google TTS baglanti hatasi: {e}"


async def synthesize_speech(
    text: str,
    voice_id: str,
    rate: float = 1.0,
    pitch: float = 1.0,
    engine: str = "auto",
    google_api_key: str = "",
) -> Tuple[Optional[bytes], str, str, str]:
    """Dondurur: (audio_bytes, used_engine, used_voice_name, fallback_or_error_note)"""
    clean = _clean_tts_text(text)
    if not clean:
        return None, "", "", "Bos metin"
    vdef = VOICE_MAP.get(voice_id) or VOICE_MAP["tr-F"]
    eng = (engine or "auto").strip().lower()
    api_key = (google_api_key or "").strip()
    errs: List[str] = []

    if eng == "google_cloud":
        audio, vname, err = await _synth_google_cloud(clean, vdef, api_key, rate, pitch)
        if audio:
            return audio, "google_cloud", vname, ""
        if err:
            errs.append(err)
        audio, vname, err = await _synth_neural(clean, vdef, rate, pitch)
        if audio:
            return audio, "neural", vname, " | ".join(errs)
        if err:
            errs.append(err)
        audio, vname, err = await _synth_google_free(clean, vdef)
        if audio:
            return audio, "google_free", vname, " | ".join(errs)
        if err:
            errs.append(err)
        return None, "", "", " | ".join(errs)

    if eng == "google_free":
        audio, vname, err = await _synth_google_free(clean, vdef)
        if audio:
            return audio, "google_free", vname, ""
        if err:
            errs.append(err)
        audio, vname, err = await _synth_neural(clean, vdef, rate, pitch)
        if audio:
            return audio, "neural", vname, " | ".join(errs)
        if err:
            errs.append(err)
        return None, "", "", " | ".join(errs)

    if eng == "neural":
        audio, vname, err = await _synth_neural(clean, vdef, rate, pitch)
        if audio:
            return audio, "neural", vname, ""
        if err:
            errs.append(err)
        audio, vname, err = await _synth_google_free(clean, vdef)
        if audio:
            return audio, "google_free", vname, " | ".join(errs)
        if err:
            errs.append(err)
        return None, "", "", " | ".join(errs)

    # Default "auto": Google Cloud (if API key) -> HD Neural (true Female & Male) -> Google Free
    if api_key:
        audio, vname, err = await _synth_google_cloud(clean, vdef, api_key, rate, pitch)
        if audio:
            return audio, "google_cloud", vname, ""
        if err:
            errs.append(err)

    audio, vname, err = await _synth_neural(clean, vdef, rate, pitch)
    if audio:
        return audio, "neural", vname, " | ".join(errs)
    if err:
        errs.append(err)

    audio, vname, err = await _synth_google_free(clean, vdef)
    if audio:
        return audio, "google_free", vname, " | ".join(errs)
    if err:
        errs.append(err)

    return None, "", "", " | ".join(errs) or "Ses sentezlenemedi."
