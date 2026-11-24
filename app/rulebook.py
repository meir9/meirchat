import random
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple, Optional

WEEKDAY_TR = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]
MONTH_TR = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

def _tr_lower(s: str) -> str:
    return (s or "").replace("İ", "i").replace("I", "ı").lower()

def _parse_dt(raw: str) -> Optional[datetime]:
    s = str(raw or "").strip()
    if not s:
        return None
    for fmt in (
        "%Y-%m-%d %H:%M",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%d.%m.%Y %H:%M",
        "%d/%m/%Y %H:%M",
    ):
        try:
            return datetime.strptime(s[:19], fmt)
        except Exception:
            continue
    return None

def _normalize_clock_str(raw: str) -> str:
    dt = _parse_dt(raw)
    if dt:
        return dt.strftime("%Y-%m-%d %H:%M")
    return str(raw or "2026-06-03 11:30").strip()

def _find_clock_meter(rulebook: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for m in (rulebook or {}).get("meters", []):
        if str(m.get("type", "")).lower() == "clock":
            return m
    return None

def _get_start_clock(rulebook: Dict[str, Any]) -> str:
    cm = _find_clock_meter(rulebook)
    if cm and cm.get("start"):
        return _normalize_clock_str(cm["start"])
    return _normalize_clock_str((rulebook or {}).get("start_datetime", "2026-06-03 11:30"))

def _get_step_minutes(rulebook: Dict[str, Any]) -> Tuple[int, int]:
    cm = _find_clock_meter(rulebook)
    if cm:
        sm = cm.get("stepMin")
        se = cm.get("stepEvery", 0)
        return (int(float(sm)) if sm is not None else 3), int(se or 0)
    if rulebook and rulebook.get("minutes_per_turn") is not None:
        try:
            return int(float(rulebook["minutes_per_turn"])), 0
        except Exception:
            pass
    return 3, 0

def _advance_clock(clock_str: str, minutes: int) -> str:
    if not minutes:
        return _normalize_clock_str(clock_str)
    dt = _parse_dt(clock_str)
    if not dt:
        return str(clock_str or "")
    dt += timedelta(minutes=minutes)
    return dt.strftime("%Y-%m-%d %H:%M")

def _get_tod_minutes_from_6am(dt: datetime) -> int:
    total_m = dt.hour * 60 + dt.minute
    return (total_m - 360) % 1440

def _get_weekday_index(dt: datetime) -> int:
    """Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6"""
    return dt.isoweekday() % 7

def _clamp(val: float, mdef: Dict[str, Any]) -> float:
    mn = mdef.get("min")
    mx = mdef.get("max")
    if mn is not None and str(mn) != "":
        val = max(float(mn), val)
    if mx is not None and str(mx) != "":
        val = min(float(mx), val)
    dec = mdef.get("decimals")
    if dec is not None and str(dec) != "":
        try:
            return round(val, int(dec))
        except Exception:
            pass
    return round(val, 2)

def _get_meter_type(m: Dict[str, Any]) -> str:
    t = str(m.get("type", "bar")).lower()
    if t == "counter":
        return "number"
    if t == "inventory":
        return "collection"
    return t

def _get_meter_levels(m: Dict[str, Any]) -> List[Dict[str, Any]]:
    if isinstance(m.get("levels"), list) and len(m["levels"]) > 0:
        return m["levels"]
    if isinstance(m.get("bands"), list) and len(m["bands"]) > 0:
        out = []
        prev_min = float(m["min"]) if (m.get("min") is not None and str(m.get("min")) != "") else -1e12
        for b in m["bands"]:
            b_to = b.get("to")
            b_max = 1e12 if (b_to is None or str(b_to) == "") else float(b_to)
            out.append({
                "min": prev_min,
                "max": b_max,
                "label": b.get("label", ""),
                "instruction": b.get("instr", b.get("instruction", "")),
                "caption": b.get("caption", ""),
                "revealed": b.get("revealed", True),
                "override": b.get("override", False),
            })
            prev_min = b_max + (0.01 if m.get("decimals") else 1)
        return out
    return []

def _get_select_options(m: Dict[str, Any]) -> List[Dict[str, str]]:
    res = []
    if isinstance(m.get("items"), list) and m["items"]:
        for it in m["items"]:
            lbl = str(it.get("label") or it.get("id") or "").strip()
            if lbl:
                res.append({
                    "id": str(it.get("id") or lbl),
                    "label": lbl,
                    "instruction": str(it.get("instruction") or it.get("instr") or ""),
                    "caption": str(it.get("caption") or ""),
                })
        return res
    opt_insts = m.get("option_instructions") or {}
    opt_caps = m.get("option_captions") or {}
    for o in (m.get("options") or []):
        lbl = o.get("label", "") if isinstance(o, dict) else str(o)
        lbl = lbl.strip()
        if lbl:
            res.append({
                "id": lbl,
                "label": lbl,
                "instruction": str(opt_insts.get(lbl, "")),
                "caption": str(opt_caps.get(lbl, "")),
            })
    return res

def _get_collection_default(m: Dict[str, Any]) -> List[str]:
    if isinstance(m.get("items"), list) and m["items"]:
        return [
            str(it.get("label") or it.get("name") or it.get("id"))
            for it in m["items"]
            if (it.get("start", 0) or 0) > 0 or it.get("at_start")
        ]
    if isinstance(m.get("default"), list):
        return [str(x) for x in m["default"]]
    return []

def _get_journal_default(m: Dict[str, Any]) -> List[str]:
    if isinstance(m.get("items"), list) and m["items"]:
        return [
            str(it.get("label") or it.get("id")).strip()
            for it in m["items"]
            if it.get("at_start")
        ]
    if isinstance(m.get("default"), list):
        return [str(x) for x in m["default"]]
    if isinstance(m.get("default"), str) and m["default"].strip():
        return [x.strip() for x in m["default"].split(",") if x.strip()]
    return []

def init_state_from_rulebook(rulebook: Dict[str, Any]) -> Dict[str, Any]:
    start_clk = _get_start_clock(rulebook)
    state: Dict[str, Any] = {
        "turn": 0,
        "day": 1,
        "clock": start_clk,
        "meters": {},
        "inventory": [],
        "journals": {},
        "fired_triggers": {},
        "events_log": [],
    }
    for m in (rulebook or {}).get("meters", []):
        mid = m.get("id") or m.get("name") or m.get("label")
        if not mid:
            continue
        mtype = _get_meter_type(m)
        if mtype == "clock":
            state["meters"][mid] = start_clk
        elif mtype == "collection":
            items = _get_collection_default(m)
            state["meters"][mid] = list(items)
            if not state["inventory"]:
                state["inventory"] = list(items)
        elif mtype == "journal":
            jitems = _get_journal_default(m)
            state["journals"][mid] = list(jitems)
            state["meters"][mid] = ", ".join(jitems)
        elif mtype == "select":
            opts = _get_select_options(m)
            raw_def = m.get("def") if m.get("def") is not None else m.get("default")
            matched = next((o["label"] for o in opts if o["id"] == raw_def or o["label"] == raw_def), None)
            state["meters"][mid] = matched or (str(raw_def) if raw_def else (opts[0]["label"] if opts else ""))
        elif mtype == "text":
            state["meters"][mid] = str(m.get("def") if m.get("def") is not None else m.get("default", ""))
        elif mtype == "dice":
            sides = int(m.get("sides") or 20)
            state["meters"][mid] = int(m.get("default") or m.get("def") or random.randint(1, max(2, sides)))
        else:
            raw_def = m.get("def") if m.get("def") is not None else m.get("default", m.get("min", 0))
            try:
                state["meters"][mid] = float(raw_def)
            except Exception:
                state["meters"][mid] = 0
    return state

def sync_state_with_rulebook(rulebook: Dict[str, Any], state: Dict[str, Any]) -> Dict[str, Any]:
    if not rulebook or (not rulebook.get("meters") and not rulebook.get("start_datetime")):
        return state or {}
    if not isinstance(state, dict) or not state:
        return init_state_from_rulebook(rulebook)
    state.setdefault("turn", 0)
    state.setdefault("day", 1)
    state.setdefault("meters", {})
    state.setdefault("inventory", [])
    state.setdefault("journals", {})
    state.setdefault("fired_triggers", {})
    state.setdefault("events_log", [])

    if not state.get("clock"):
        state["clock"] = _get_start_clock(rulebook)
    else:
        state["clock"] = _normalize_clock_str(state["clock"])

    for m in rulebook.get("meters", []):
        mid = m.get("id") or m.get("name") or m.get("label")
        if not mid:
            continue
        mtype = _get_meter_type(m)
        if mtype == "clock":
            state["meters"][mid] = state["clock"]
        elif mtype == "collection":
            if mid not in state["meters"] or not isinstance(state["meters"][mid], list):
                if state["inventory"]:
                    state["meters"][mid] = list(state["inventory"])
                else:
                    defs = _get_collection_default(m)
                    state["meters"][mid] = list(defs)
                    state["inventory"] = list(defs)
            else:
                state["inventory"] = list(state["meters"][mid])
        elif mtype == "journal":
            if mid not in state["journals"]:
                if isinstance(state["meters"].get(mid), str) and state["meters"][mid].strip():
                    state["journals"][mid] = [x.strip() for x in state["meters"][mid].split(",") if x.strip()]
                else:
                    state["journals"][mid] = _get_journal_default(m)
            state["meters"][mid] = ", ".join(state["journals"][mid])
        elif mid not in state["meters"]:
            if mtype == "select":
                opts = _get_select_options(m)
                raw_def = m.get("def") if m.get("def") is not None else m.get("default")
                matched = next((o["label"] for o in opts if o["id"] == raw_def or o["label"] == raw_def), None)
                state["meters"][mid] = matched or (str(raw_def) if raw_def else (opts[0]["label"] if opts else ""))
            elif mtype == "text":
                state["meters"][mid] = str(m.get("def") if m.get("def") is not None else m.get("default", ""))
            elif mtype == "dice":
                sides = int(m.get("sides") or 20)
                state["meters"][mid] = int(m.get("default") or m.get("def") or random.randint(1, max(2, sides)))
            else:
                raw_def = m.get("def") if m.get("def") is not None else m.get("default", m.get("min", 0))
                try:
                    state["meters"][mid] = float(raw_def)
                except Exception:
                    state["meters"][mid] = 0
    return state

def _extract_option_aliases(label: str) -> List[str]:
    low = _tr_lower(label).strip()
    aliases = []
    if low:
        aliases.append(low)
    primary = low.split("/")[0].strip()
    if primary and primary not in aliases:
        aliases.append(primary)
    if primary.endswith(" ev"):
        short_p = primary[:-3].strip()
        if short_p and short_p not in aliases:
            aliases.append(short_p)
    words = primary.split()
    if len(words) >= 2 and words[0] not in ("yeni", "eski", "büyük", "küçük", "miami"):
        if len(words[0]) >= 6 and words[0] not in aliases:
            aliases.append(words[0])
    if "metin oktay" in primary and "metin oktay" not in aliases:
        aliases.append("metin oktay")
    return aliases

LOCATION_MOVE_CUES = [
    "gitti", "gidiyor", "gidelim", "gidecek", "vardı", "ulaştı", "geldi", "döndü",
    "geçti", "indi", "uçtu", "taşındı", "çıktı", "girdi", "bulunuyor", "artık",
    "kapısından", "stadyum", "tesis", "havalimanı", "otel", "villaya", "villada",
    "penthouse", "dairede", "evde", "eve", "şehirde", "sokak", "merkez", "arenada",
]

def detect_select_updates(
    rulebook: Dict[str, Any],
    state: Dict[str, Any],
    text: str,
) -> Tuple[Dict[str, Any], List[str]]:
    if not rulebook or not rulebook.get("meters") or not text or not text.strip():
        return state, []

    state = sync_state_with_rulebook(rulebook, state)
    text_low = _tr_lower(text)
    has_move_cue = any(cue in text_low for cue in LOCATION_MOVE_CUES)
    notifications: List[str] = []

    for m in rulebook.get("meters", []):
        if _get_meter_type(m) != "select":
            continue
        mid = m.get("id") or m.get("name") or m.get("label")
        opts = _get_select_options(m)
        if not mid or not opts:
            continue

        current_val = str(state["meters"].get(mid, ""))
        current_low = _tr_lower(current_val)

        candidates = []
        for opt in opts:
            opt_label = opt["label"]
            for alias in _extract_option_aliases(opt_label):
                if len(alias) >= 4:
                    candidates.append((len(alias), opt_label, alias))

        candidates.sort(key=lambda x: x[0], reverse=True)

        best_match = None
        for _, opt_label, alias in candidates:
            pattern = r"(?<![a-zçğıöşü0-9])" + re.escape(alias) + r"(?:['’]?[a-zçğıöşü]{0,5})?(?![a-zçğıöşü0-9])"
            idx_m = re.search(pattern, text_low)
            if idx_m:
                opt_low = _tr_lower(opt_label)
                if "/" in current_low and "/" not in opt_low and opt_low in current_low:
                    if not any(w in text_low for w in ("dışarı çıktı", "evden çıktı", "şehre indi", "dışarıda", "caddede", "mekana", "kulübe", "restorana")):
                        continue
                after = text_low[idx_m.end():idx_m.end()+30]
                if any(w in after for w in ("istiyor", "isterdim", "düşünüyor", "hayal", "planlıyor", "gitsek")):
                    continue
                if has_move_cue or "/" in opt_low or len(alias) >= 6:
                    best_match = opt_label
                    break

        if best_match and best_match != current_val:
            state["meters"][mid] = best_match
            notifications.append(f"📍 {m.get('name') or m.get('label') or mid}: {best_match}")

    return state, notifications

def _eval_condition(cond: Dict[str, Any], state: Dict[str, Any], meter_defs: Dict[str, Any]) -> bool:
    mid = cond.get("m") or cond.get("target") or ""
    op = str(cond.get("op") or cond.get("cond_op") or "==").lower()
    val = cond.get("v") if cond.get("v") is not None else cond.get("threshold")

    mdef = meter_defs.get(mid)
    mtype = _get_meter_type(mdef) if mdef else ""

    if op == "weekday" or mtype == "clock":
        dt = _parse_dt(state.get("clock", ""))
        if not dt:
            return False
        if op == "weekday":
            days = cond.get("days") or []
            wd = _get_weekday_index(dt)
            return wd in [int(d) for d in days]
        tod = _get_tod_minutes_from_6am(dt)
        try:
            tv = float(val)
            if op == "<": return tod < tv
            if op == "<=": return tod <= tv
            if op == ">": return tod > tv
            if op == ">=": return tod >= tv
            if op == "==": return tod == tv
        except Exception:
            return False

    if mtype == "collection":
        items = [_tr_lower(str(x)) for x in (state["meters"].get(mid) or state.get("inventory") or [])]
        needle = _tr_lower(str(val or ""))
        if op in ("has", "contains", "is"):
            return any(needle in it for it in items)
        if op in ("not_has", "not_contains", "!="):
            return not any(needle in it for it in items)
        return False

    cur = state["meters"].get(mid)
    if cur is None:
        return False

    if op in ("is", "selected", "=="):
        if mtype in ("select", "text", "journal"):
            return _tr_lower(str(cur)) == _tr_lower(str(val or ""))
        try:
            return float(cur) == float(val)
        except Exception:
            return _tr_lower(str(cur)) == _tr_lower(str(val or ""))

    if op in ("not_is", "!="):
        if mtype in ("select", "text", "journal"):
            return _tr_lower(str(cur)) != _tr_lower(str(val or ""))
        try:
            return float(cur) != float(val)
        except Exception:
            return _tr_lower(str(cur)) != _tr_lower(str(val or ""))

    try:
        cnum = float(cur)
        tnum = float(val)
        if op == "<": return cnum < tnum
        if op == "<=": return cnum <= tnum
        if op == ">": return cnum > tnum
        if op == ">=": return cnum >= tnum
    except Exception:
        return False
    return False

def _apply_meter_delta(mid: str, mdef: Dict[str, Any], state: Dict[str, Any], op: str, val: Any) -> Optional[str]:
    mtype = _get_meter_type(mdef)
    mname = mdef.get("name") or mdef.get("label") or mid
    if mtype == "clock":
        state["clock"] = _advance_clock(state.get("clock", "2026-06-03 11:30"), int(float(val)))
        state["meters"][mid] = state["clock"]
        return f"🕒 {mname}: {state['clock']}"
    elif mtype == "collection":
        inv = list(state["meters"].get(mid) or state.get("inventory") or [])
        sval = str(val).strip()
        if op == "add" and sval and sval not in inv:
            inv.append(sval)
            state["meters"][mid] = inv
            state["inventory"] = inv
            return f"+ {mname}: {sval}"
        elif op == "remove" and sval in inv:
            inv.remove(sval)
            state["meters"][mid] = inv
            state["inventory"] = inv
            return f"- {mname}: {sval}"
        return None
    elif mtype in ("text", "select"):
        state["meters"][mid] = str(val)
        return f"{mname}: {val}"
    else:
        cur = float(state["meters"].get(mid, 0))
        new_v = float(val) if op == "set" else cur + float(val)
        state["meters"][mid] = _clamp(new_v, mdef)
        unit = mdef.get("unit", "")
        return f"{mname}: {state['meters'][mid]}{unit}"

def process_turn_rules(
    rulebook: Dict[str, Any],
    state: Dict[str, Any],
    user_text: str,
    sender_role: str = "user",
) -> Tuple[Dict[str, Any], List[str], List[str]]:
    if not rulebook or (not rulebook.get("meters") and not rulebook.get("start_datetime")):
        return state, [], []

    state = sync_state_with_rulebook(rulebook, state)
    state["turn"] = int(state.get("turn", 0)) + 1
    meter_defs = {(m.get("id") or m.get("name") or m.get("label")): m for m in rulebook.get("meters", [])}
    prompt_notes: List[str] = []
    notifications: List[str] = []
    text_lower = _tr_lower(user_text)
    moved_meters = set()

    # 0. Otomatik lokasyon / select algılama
    state, sel_notifs = detect_select_updates(rulebook, state, user_text)
    notifications.extend(sel_notifs)

    # 1. Hikâye Saati (Story clock) ilerlemesi
    step_min, step_every = _get_step_minutes(rulebook)
    if step_min > 0:
        should_step = (step_every <= 1) or (state["turn"] % step_every == 0)
        if should_step:
            old_dt = _parse_dt(state.get("clock", ""))
            state["clock"] = _advance_clock(state.get("clock", "2026-06-03 11:30"), step_min)
            new_dt = _parse_dt(state["clock"])
            if old_dt and new_dt and new_dt.date() > old_dt.date():
                state["day"] = int(state.get("day", 1)) + (new_dt.date() - old_dt.date()).days
            cm = _find_clock_meter(rulebook)
            if cm:
                cmid = cm.get("id") or cm.get("name") or cm.get("label")
                state["meters"][cmid] = state["clock"]

    # 2. Zar (Dice) otomatik atışı & perMsg
    for mid, mdef in meter_defs.items():
        mtype = _get_meter_type(mdef)
        if mtype == "dice" and mdef.get("autoRoll", True):
            sides = max(2, int(mdef.get("sides") or 20))
            cnt = max(1, min(10, int(mdef.get("count") or 1)))
            rolled = sum(random.randint(1, sides) for _ in range(cnt))
            state["meters"][mid] = rolled
            moved_meters.add(mid)
        if mtype == "number" and mdef.get("perMsg"):
            try:
                pm = float(mdef["perMsg"])
                if pm != 0:
                    state["meters"][mid] = _clamp(float(state["meters"].get(mid, 0)) + pm, mdef)
                    moved_meters.add(mid)
            except Exception:
                pass

    # 3. Gösterge içi anahtar kelime kuralları (meter.keywords)
    for mid, mdef in meter_defs.items():
        ev_scope = str(mdef.get("evaluates") or mdef.get("reads") or "all").lower()
        if ev_scope == "user" and sender_role != "user":
            continue
        if ev_scope == "bot" and sender_role != "assistant":
            continue
        for kw in (mdef.get("keywords") or []):
            words = [_tr_lower(k.strip()) for k in str(kw.get("words") or kw.get("keys") or kw.get("word") or "").split(",") if k.strip()]
            if words and any(w in text_lower for w in words):
                op = "set" if (kw.get("set") is not None and str(kw.get("set")) != "") else str(kw.get("op") or "add")
                val = kw.get("set") if op == "set" else (kw.get("d") if kw.get("d") is not None else kw.get("value", 0))
                note = _apply_meter_delta(mid, mdef, state, op, val)
                if note:
                    notifications.append(note)
                moved_meters.add(mid)

    # 4. Gösterge Tetikleyicileri (No-AI Triggers: hem meter.triggers hem üst seviye meter_triggers)
    all_trigger_groups = []
    for mid, mdef in meter_defs.items():
        if isinstance(mdef.get("triggers"), list) and mdef["triggers"]:
            all_trigger_groups.append({"m": mid, "triggers": mdef["triggers"]})
    for tg in (rulebook.get("meter_triggers") or []):
        if tg.get("m") and isinstance(tg.get("triggers"), list):
            all_trigger_groups.append(tg)

    cur_date_key = str(state.get("clock", ""))[:10]
    for tg in all_trigger_groups:
        target_mid = tg.get("m")
        if target_mid not in meter_defs:
            continue
        mdef = meter_defs[target_mid]
        for tr in tg.get("triggers", []):
            conds = tr.get("when") or []
            if not conds:
                continue
            if all(_eval_condition(c, state, meter_defs) for c in conds):
                tr_id = str(tr.get("id") or f"{target_mid}_{len(conds)}")
                uses_clock = any((c.get("op") == "weekday" or _get_meter_type(meter_defs.get(c.get("m"), {})) == "clock") for c in conds)
                if uses_clock and state["fired_triggers"].get(tr_id) == cur_date_key:
                    continue
                do_obj = tr.get("do") or {}
                op = "set" if (do_obj.get("set") is not None and str(do_obj.get("set")) != "") else "add"
                val = do_obj.get("set") if op == "set" else do_obj.get("d", 0)
                note = _apply_meter_delta(target_mid, mdef, state, op, val)
                if note:
                    notifications.append(f"⚡ {note}")
                if uses_clock:
                    state["fired_triggers"][tr_id] = cur_date_key
                moved_meters.add(target_mid)

    # 5. Klasik üst seviye rules (keyword / conditional / random)
    for rule in (rulebook.get("rules") or []):
        if not rule.get("enabled", True):
            continue
        rtype = rule.get("type", "keyword")
        if rtype == "keyword":
            keys = [_tr_lower(k.strip()) for k in str(rule.get("keys", "")).split(",") if k.strip()]
            if any(k in text_lower for k in keys):
                target = rule.get("target")
                op = rule.get("op", "add")
                val = rule.get("value", 0)
                if target in meter_defs:
                    note = _apply_meter_delta(target, meter_defs[target], state, op, val)
                    if note:
                        notifications.append(note)
                    moved_meters.add(target)
                elif target == "clock":
                    state["clock"] = _advance_clock(state.get("clock", "2026-06-03 11:30"), int(val))
                if rule.get("instruction"):
                    prompt_notes.append(rule["instruction"])
        elif rtype == "conditional":
            if _eval_condition(rule, state, meter_defs) and rule.get("instruction"):
                prompt_notes.append(rule["instruction"])
        elif rtype == "random":
            chance = float(rule.get("chance", 10))
            if random.uniform(0, 100) <= chance:
                instr = rule.get("instruction", "")
                if instr:
                    prompt_notes.append(f"Olay: {instr}")
                    notifications.append(f"🎲 Olay: {rule.get('name', 'Rastgele Olay')}")

    # 6. Sessiz turlarda azalma (Decay)
    for mid, mdef in meter_defs.items():
        if mid in moved_meters:
            continue
        mtype = _get_meter_type(mdef)
        if mtype not in ("bar", "pips", "number"):
            continue
        decay_val = mdef.get("decay") if mdef.get("decay") is not None else mdef.get("decay_per_turn", 0)
        decay_every = int(mdef.get("decay_every") or 1)
        try:
            dv = float(decay_val or 0)
        except Exception:
            dv = 0
        if dv != 0 and (decay_every <= 1 or state["turn"] % decay_every == 0):
            state["meters"][mid] = _clamp(float(state["meters"].get(mid, 0)) + dv, mdef)

    # 7. Seviye / Zaman Dilimi / Seçim / Birleşik Kural talimatlarını topla
    notes_eval, _ = collect_active_instructions(rulebook, state)
    prompt_notes.extend(notes_eval)

    return state, prompt_notes, notifications

def collect_active_instructions(rulebook: Dict[str, Any], state: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    notes: List[str] = []
    captions: List[str] = []
    override_captions: List[str] = []
    meter_defs = {(m.get("id") or m.get("name") or m.get("label")): m for m in (rulebook or {}).get("meters", [])}

    # 1. Story clock todBands
    cm = _find_clock_meter(rulebook)
    if cm:
        dt = _parse_dt(state.get("clock", ""))
        if dt and isinstance(cm.get("todBands"), list) and cm["todBands"]:
            tod = _get_tod_minutes_from_6am(dt)
            for b in cm["todBands"]:
                b_to = 1439 if b.get("to") is None else int(b["to"])
                if tod <= b_to:
                    if b.get("instr") or b.get("instruction"):
                        notes.append(str(b.get("instr") or b.get("instruction")))
                    if b.get("caption"):
                        (override_captions if b.get("override") else captions).append(str(b["caption"]))
                    break

    # 2. Meter levels & select instructions & collection rules
    for mid, mdef in meter_defs.items():
        mtype = _get_meter_type(mdef)
        if mtype == "select":
            cur_s = str(state["meters"].get(mid, ""))
            for opt in _get_select_options(mdef):
                if opt["label"] == cur_s:
                    if opt["instruction"]:
                        notes.append(opt["instruction"])
                    if opt["caption"]:
                        captions.append(opt["caption"])
                    break
        elif mtype in ("bar", "pips", "number", "dice"):
            levels = _get_meter_levels(mdef)
            if levels and mid in state["meters"]:
                try:
                    cur = float(state["meters"][mid])
                    for lvl in levels:
                        if float(lvl.get("min", -1e12)) <= cur <= float(lvl.get("max", 1e12)):
                            if lvl.get("instruction"):
                                notes.append(str(lvl["instruction"]))
                            if lvl.get("caption"):
                                (override_captions if lvl.get("override") else captions).append(str(lvl["caption"]))
                            break
                except Exception:
                    pass
        elif mtype == "collection":
            for cr in (mdef.get("rules") or []):
                cond = {"m": mid, "op": cr.get("op", "has"), "v": cr.get("item") or cr.get("v", "")}
                if _eval_condition(cond, state, meter_defs):
                    if cr.get("instr") or cr.get("instruction"):
                        notes.append(str(cr.get("instr") or cr.get("instruction")))
                    if cr.get("caption"):
                        captions.append(str(cr["caption"]))

    # 3. Combined rules (Birleşik kurallar)
    for cr in (rulebook or {}).get("combined_rules", []):
        conds = cr.get("conds") or []
        if conds and all(_eval_condition(c, state, meter_defs) for c in conds):
            if cr.get("instr") or cr.get("instruction"):
                notes.append(str(cr.get("instr") or cr.get("instruction")))
            if cr.get("caption"):
                override_captions.append(str(cr["caption"]))

    final_captions = override_captions if override_captions else captions
    return list(dict.fromkeys(n.strip() for n in notes if n and n.strip())), list(dict.fromkeys(final_captions))

def build_state_prompt(rulebook: Dict[str, Any], state: Dict[str, Any], notes: List[str]) -> str:
    if not rulebook or not rulebook.get("meters"):
        return ""
    items = []
    if state.get("clock"):
        dt = _parse_dt(state["clock"])
        if dt:
            wd = WEEKDAY_TR[_get_weekday_index(dt)]
            items.append(f"Tarih/Saat: {dt.day} {MONTH_TR[dt.month]} {dt.year} {wd}, {dt.strftime('%H:%M')} (Gün {state.get('day', 1)})")
        else:
            items.append(f"Saat: {state['clock']}")
    for m in rulebook.get("meters", []):
        if m.get("tellModel") is False:
            continue
        mid = m.get("id") or m.get("name") or m.get("label")
        mname = m.get("name") or m.get("label") or mid
        mtype = _get_meter_type(m)
        if not mid or mtype == "clock":
            continue
        if mtype == "collection":
            inv = state["meters"].get(mid) or state.get("inventory") or []
            if inv:
                items.append(f"{mname}: {', '.join(str(x) for x in inv)}")
            continue
        if mtype == "journal":
            jlist = state.get("journals", {}).get(mid) or []
            if jlist:
                items.append(f"{mname}: {', '.join(jlist)}")
            continue
        val = state.get("meters", {}).get(mid, m.get("def", m.get("default", 0)))
        unit = m.get("unit", "")
        mx = m.get("max")
        if mtype in ("bar", "pips") and mx is not None and str(mx) != "":
            items.append(f"{mname}: {val}/{mx}{unit}")
        elif mtype == "dice":
            items.append(f"{mname}: {val}/d{m.get('sides', 20)}")
        else:
            items.append(f"{mname}: {val}{unit}")

    lines = ["Durum: " + " | ".join(items)]
    if notes:
        uniq = list(dict.fromkeys(n.strip() for n in notes if n and n.strip()))[:4]
        rules_str = " ".join(uniq)
        if len(rules_str) > 650:
            rules_str = rules_str[:647].rstrip() + "..."
        lines.append("Kurallar: " + rules_str)
    return "\n".join(lines)

def build_recency_anchor(rulebook: Dict[str, Any], state: Dict[str, Any], notes: List[str], user_name: str) -> str:
    return f"Yalnızca sahnedeki karşı karakterin tepkisini doğal Türkçe yaz; {user_name} adına konuşma veya eylem yazma."

def has_ai_judged_meters(rulebook: Dict[str, Any]) -> bool:
    if not rulebook or not rulebook.get("meters"):
        return False
    for m in rulebook.get("meters", []):
        ai_cfg = m.get("ai")
        if isinstance(ai_cfg, dict) and ai_cfg.get("on"):
            if ai_cfg.get("rules") or ai_cfg.get("extractHint"):
                return True
        mtype = _get_meter_type(m)
        if mtype in ("select", "collection", "journal", "text") and str(m.get("detectHint") or "").strip():
            return True
    return False

def build_ai_judge_prompt(
    rulebook: Dict[str, Any],
    state: Dict[str, Any],
    last_user_text: str,
    last_bot_text: str,
    char_name: str,
    user_name: str,
) -> Optional[str]:
    if not has_ai_judged_meters(rulebook):
        return None
    state = sync_state_with_rulebook(rulebook, state)
    meter_lines = []
    for m in rulebook.get("meters", []):
        mid = m.get("id") or m.get("name") or m.get("label")
        if not mid:
            continue
        mtype = _get_meter_type(m)
        mname = m.get("name") or m.get("label") or mid
        ai_cfg = m.get("ai") if isinstance(m.get("ai"), dict) else {}
        ai_on = bool(ai_cfg.get("on"))
        detect_hint = str(m.get("detectHint") or "").strip()

        if not ai_on and not (mtype in ("select", "collection", "journal", "text") and detect_hint):
            continue

        cur = state.get("meters", {}).get(mid, m.get("default", 0))
        parts = [f"- id='{mid}' ({mname}, tür={mtype}, şu_an={cur})"]

        if mtype == "select":
            opts = [o["label"] for o in _get_select_options(m)]
            if opts:
                parts.append(f"seçenekler={opts[:25]}")
            if detect_hint:
                parts.append(f"ipucu='{detect_hint.replace('{{user}}', user_name).replace('{{char}}', char_name)}'")
        elif mtype in ("collection", "journal", "text"):
            if detect_hint:
                parts.append(f"ipucu='{detect_hint.replace('{{user}}', user_name).replace('{{char}}', char_name)}'")
        if ai_on:
            eh = str(ai_cfg.get("extractHint") or "").strip()
            if eh:
                parts.append(f"çıkarma='{eh.replace('{{user}}', user_name).replace('{{char}}', char_name)}'")
            rules = ai_cfg.get("rules") or []
            if rules:
                r_txts = []
                for r in rules[:8]:
                    w = str(r.get("when") or "").replace("{{user}}", user_name).replace("{{char}}", char_name).strip()
                    if not w:
                        continue
                    if r.get("set") is not None:
                        r_txts.append(f"[olursa: {w} => set={r['set']}]")
                    else:
                        r_txts.append(f"[olursa: {w} => d={r.get('d', 0)}]")
                if r_txts:
                    parts.append("kurallar: " + " ".join(r_txts))

        meter_lines.append(" | ".join(parts))

    if not meter_lines:
        return None

    return (
        "Son 2 mesajı değerlendir ve YALNIZCA gerçekten gerçekleşen gösterge değişikliklerini saf JSON nesnesi olarak döndür. "
        "Değişiklik yoksa tam olarak `{}` döndür. Açıklama veya markdown yazma.\n"
        "JSON formatı:\n"
        '- Sayı/bar değişimi: {"meter_id": {"d": 5}} veya {"meter_id": {"set": 50}}\n'
        '- Seçim (select) veya metin (text): {"meter_id": {"set": "Yeni Değer"}}\n'
        '- Koleksiyon / günlük: {"meter_id": {"add": "Öğe"}} veya {"meter_id": {"remove": "Öğe"}}\n\n'
        "Takip Edilen Göstergeler:\n" + "\n".join(meter_lines) + "\n\n"
        f"Son Tur:\n{user_name}: {(last_user_text or '')[:600]}\n"
        f"{char_name}: {(last_bot_text or '')[:900]}\n/no_think"
    )

def apply_ai_judge_updates(
    rulebook: Dict[str, Any],
    state: Dict[str, Any],
    updates: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[str]]:
    if not rulebook or not isinstance(updates, dict) or not updates:
        return state, []

    state = sync_state_with_rulebook(rulebook, state)
    meter_defs = {(m.get("id") or m.get("name") or m.get("label")): m for m in rulebook.get("meters", [])}
    notifications: List[str] = []

    for mid, action in updates.items():
        if mid not in meter_defs:
            continue
        mdef = meter_defs[mid]
        mtype = _get_meter_type(mdef)
        mname = mdef.get("name") or mdef.get("label") or mid

        if not isinstance(action, dict):
            if mtype in ("select", "text"):
                action = {"set": action}
            elif isinstance(action, (int, float)):
                action = {"d": action}
            else:
                continue

        if mtype == "select":
            new_val = str(action.get("set") or "").strip()
            opts = [o["label"] for o in _get_select_options(mdef)]
            matched = next((o for o in opts if _tr_lower(o) == _tr_lower(new_val)), None)
            if matched and matched != str(state["meters"].get(mid, "")):
                state["meters"][mid] = matched
                notifications.append(f"📍 {mname}: {matched}")
        elif mtype == "collection":
            if action.get("add"):
                note = _apply_meter_delta(mid, mdef, state, "add", str(action["add"]))
                if note:
                    notifications.append(f"🤖 {note}")
            if action.get("remove"):
                note = _apply_meter_delta(mid, mdef, state, "remove", str(action["remove"]))
                if note:
                    notifications.append(f"🤖 {note}")
        elif mtype == "journal":
            item = str(action.get("add") or action.get("set") or "").strip()
            if item:
                jlist = list(state.get("journals", {}).get(mid) or [])
                if item not in jlist:
                    jlist.append(item)
                    state["journals"][mid] = jlist
                    state["meters"][mid] = ", ".join(jlist)
                    notifications.append(f"📖 {mname}: +{item}")
        elif mtype == "text":
            new_val = str(action.get("set") or "").strip()
            if new_val and new_val != str(state["meters"].get(mid, "")):
                state["meters"][mid] = new_val[:120]
                notifications.append(f"🤖 {mname}: {new_val[:60]}")
        elif mtype in ("bar", "pips", "number", "dice"):
            old_v = float(state["meters"].get(mid, 0))
            if action.get("set") is not None:
                try:
                    nv = _clamp(float(action["set"]), mdef)
                    if nv != old_v:
                        state["meters"][mid] = nv
                        notifications.append(f"🤖 {mname}: {nv}{mdef.get('unit', '')}")
                except Exception:
                    pass
            elif action.get("d") is not None:
                try:
                    delta = float(action["d"])
                    if delta != 0:
                        nv = _clamp(old_v + delta, mdef)
                        if nv != old_v:
                            state["meters"][mid] = nv
                            sign = "+" if delta > 0 else ""
                            notifications.append(f"🤖 {mname}: {sign}{delta:g} → {nv}{mdef.get('unit', '')}")
                except Exception:
                    pass

    return state, notifications
