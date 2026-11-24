// =========================================================================
// MEIRCHAT — RULEBOOK EDİTÖRÜ
// =========================================================================

const METER_ICONS = {
  clock:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  coin:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M14.5 9a3 3 0 0 0-5 0c0 2 5 2 5 4a3 3 0 0 1-5 1M12 6v2m0 8v2"/></svg>',
  book:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  heart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  sparkle:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z"/></svg>',
  shirt:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>',
  shield:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  star:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  alert:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  flame:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  wine:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 22h8M12 15v7M6 3h12l-1 7a5 5 0 0 1-10 0L6 3z"/></svg>',
  cigarette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="13" width="16" height="4" rx="1"/><line x1="18" y1="13" x2="18" y2="17"/><path d="M21 13v4M18 9c0-2 2-2 2-4M14 9c0-2 2-2 2-4"/></svg>',
  backpack:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10z"/><path d="M9 6V4a3 3 0 0 1 6 0v2"/><path d="M8 14h8"/></svg>',
  globe:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  dice:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/></svg>',
  bolt:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  trophy:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v6a6 6 0 0 1-12 0V4zM12 16v6M8 22h8"/></svg>',
  crown:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 18h20l-2-11-5 4-3-6-3 6-5-4-2 11z"/></svg>',
  home:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  car:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14v-5l-2-5H7l-2 5v5z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></svg>',
  phone:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  music:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  eye:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  lock:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  users:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  football:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polygon points="12 7 16 10 14.5 15 9.5 15 8 10"/></svg>',
  medal:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="14" r="6"/><path d="M8.5 3h7L13.5 8.5h-3L8.5 3z"/></svg>',
  plane:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  camera:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  coffee:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
  mic:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>',
  sun:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/></svg>',
  moon:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  key:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/></svg>',
  chat:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  battery:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="13" x2="23" y2="11"/><rect x="4" y="9" width="8" height="6" fill="currentColor"/></svg>'
};

const METER_COLORS = [
  "amber", "green", "teal", "salmon", "powder",
  "royal", "blue", "purple", "crimson", "red",
  "contrast", "orange", "gray", "ochre", "sky"
];

const METER_TYPE_CARDS = [
  { type: "bar",        name: "Bar",          sub: "Min–max · yumuşak",  prev: '<span class="mini-bar"><i></i></span>' },
  { type: "pips",       name: "Pips",         sub: "Min–max · adımlı",   prev: '<span class="mini-pips"><i></i><i></i><i></i><i class="dim"></i></span>' },
  { type: "number",     name: "Sayı",         sub: "Üst sınır yok",      prev: `${METER_ICONS.coin}<span>120</span>` },
  { type: "dice",       name: "Zar",          sub: "Rastgele atış",      prev: `${METER_ICONS.dice}<span>14 / d20</span>` },
  { type: "select",     name: "Birini Seç",   sub: "Listeden biri",      prev: `${METER_ICONS.globe}<span>Lokasyon</span>` },
  { type: "collection", name: "Koleksiyon",   sub: "Adetli eşyalar",     prev: `${METER_ICONS.backpack}<span>Eşya x2</span>` },
  { type: "clock",      name: "Hikâye Saati", sub: "Tarih ve saat",      prev: `${METER_ICONS.clock}<span>Sal 18:40</span>` },
  { type: "journal",    name: "Günlük",       sub: "Tarihli olaylar",    prev: `${METER_ICONS.book}<span>Gün 1</span>` },
  { type: "text",       name: "Metin",        sub: "Kısa tek satır",     prev: `${METER_ICONS.sparkle}<span>Durum</span>` }
];

const WD_LIST = [
  { id: 1, lbl: "Pzt" }, { id: 2, lbl: "Sal" }, { id: 3, lbl: "Çar" },
  { id: 4, lbl: "Per" }, { id: 5, lbl: "Cum" }, { id: 6, lbl: "Cmt" }, { id: 0, lbl: "Paz" }
];
const WD_FULL = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const MONTH_FULL = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function canonMeterType(t) {
  const s = String(t || "bar").toLowerCase();
  if (s === "counter") return "number";
  if (s === "inventory") return "collection";
  return s;
}

function getMeterIcon(m) {
  if (m && m.icon && METER_ICONS[m.icon]) return m.icon;
  const t = canonMeterType(m && m.type);
  if (t === "clock") return "clock";
  if (t === "select") return "globe";
  if (t === "collection") return "backpack";
  if (t === "number") return "coin";
  if (t === "journal") return "book";
  if (t === "dice") return "dice";
  if (t === "text") return "sparkle";
  return "shield";
}

function getMeterColor(m) {
  if (m && m.color && METER_COLORS.includes(m.color)) return m.color;
  const t = canonMeterType(m && m.type);
  if (t === "clock") return "amber";
  if (t === "select") return "sky";
  if (t === "collection") return "ochre";
  if (t === "number") return "green";
  if (t === "journal") return "teal";
  if (t === "dice") return "purple";
  if (t === "text") return "powder";
  return "blue";
}

function iconBadgeHtml(iconKey, colorKey, small = false, imageUrl = "") {
  const c = METER_COLORS.includes(colorKey) ? colorKey : "blue";
  if (imageUrl) {
    return `<span class="meter-ico-badge has-img ${small ? 'sm' : ''} c-${c}"><img src="${escapeHtml(imageUrl)}" alt="" /></span>`;
  }
  const svg = METER_ICONS[iconKey] || METER_ICONS.shield;
  return `<span class="meter-ico-badge ${small ? 'sm' : ''} c-${c}">${svg}</span>`;
}

function resolveMeterActiveImage(m, curVal) {
  if (!m) return "";
  const t = canonMeterType(m.type);
  if (t === "select" && m.option_images && curVal !== undefined && m.option_images[curVal]) {
    return m.option_images[curVal];
  }
  if ((t === "bar" || t === "pips" || t === "number" || t === "dice") && curVal !== undefined && !isNaN(curVal)) {
    const num = Number(curVal);
    for (const lv of getMeterLevels(m)) {
      if (num >= Number(lv.min ?? -1e12) && num <= Number(lv.max ?? 1e12)) {
        if (lv.image_url) return lv.image_url;
        break;
      }
    }
  }
  return m.image_url || "";
}

async function uploadMeterImage(input, mIdx, subType = "meter", subKey = null) {
  if (!input.files || !input.files[0]) return;
  const fd = new FormData();
  fd.append("file", input.files[0]);
  try {
    const res = await fetch("/api/upload?mode=avatar", { method: "POST", body: fd }).then(r => r.json());
    if (res.url && editRulebookData.meters[mIdx]) {
      const m = editRulebookData.meters[mIdx];
      if (subType === "meter") {
        m.image_url = res.url;
      } else if (subType === "level" && m.levels && m.levels[subKey]) {
        m.levels[subKey].image_url = res.url;
      } else if (subType === "select") {
        if (!m.option_images) m.option_images = {};
        const optName = (m.options || [])[subKey];
        if (optName) m.option_images[optName] = res.url;
      }
      renderAllRulebookViews();
    }
  } catch (e) {
    alert("Görsel yüklenemedi: " + e.message);
  }
  input.value = "";
}

// --- Rulebook Editor State ---
let editRulebookData = { start_datetime: "2026-06-03 11:30", minutes_per_turn: 3, meters: [], combined_rules: [], meter_triggers: [], rules: [] };
let ruleJsonMode = false;
let rbeActiveTab = "meters";
let selectedMeterIdx = null;   // null => Tümü listesi; integer => YAPILANDIR ekranı
let showIconPicker = false;
let showColorPicker = false;
let selectedInfBand = {};      // { meterIdx: bandIdx }
let playtestState = { turn: 0, day: 1, clock: "2026-06-03 11:30", meters: {}, inventory: [], journals: {}, fired_triggers: {} };
let playtestRole = "user";
let playtestLog = [];

// --- Yardımcılar ---
function formatMinutesFrom6am(m) {
  const total = (360 + Number(m)) % 1440;
  const h = Math.floor(total / 60);
  const mn = total % 60;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
}

function parseClockParts(str) {
  const m = String(str || "2026-06-03 11:30").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return { y: 2026, mo: 6, d: 3, h: 11, mn: 30 };
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]), h: Number(m[4]), mn: Number(m[5]) };
}

function formatReadableClock(str) {
  const p = parseClockParts(str);
  const dt = new Date(p.y, p.mo - 1, p.d, p.h, p.mn);
  const wd = WD_FULL[dt.getDay()];
  return `${p.d} ${MONTH_FULL[p.mo]} ${p.y} ${wd}, ${String(p.h).padStart(2, "0")}:${String(p.mn).padStart(2, "0")}`;
}

function getMeterVisibility(m) {
  if (m.visible === false || m.hud === "hidden") return "hidden";
  if (m.hud === "panel") return "panel";
  return "shown";
}

function getMeterName(m) {
  return String(m.name || m.label || m.id || "");
}

function getMeterLevels(m) {
  if (Array.isArray(m.levels)) return m.levels;
  if (Array.isArray(m.bands)) {
    const out = [];
    let prevMin = (m.min !== undefined && m.min !== "") ? Number(m.min) : -999999999;
    for (const b of m.bands) {
      const isInf = (b.to === null || b.to === undefined || b.to === "");
      const bMax = isInf ? 999999999 : Number(b.to);
      out.push({
        min: prevMin,
        max: bMax,
        openEnd: isInf,
        label: b.label || "",
        instruction: b.instr ?? b.instruction ?? "",
        caption: b.caption || "",
        revealed: b.revealed !== false,
        override: Boolean(b.override),
        image_url: b.image_url || ""
      });
      prevMin = bMax + (m.decimals ? 0.01 : 1);
    }
    m.levels = out;
    return out;
  }
  return [];
}

function syncClockTopFields() {
  const cm = (editRulebookData.meters || []).find(m => canonMeterType(m.type) === "clock");
  if (cm) {
    editRulebookData.start_datetime = String(cm.start || "2026-06-03 11:30").replace("T", " ").slice(0, 16);
    editRulebookData.minutes_per_turn = Number(cm.stepMin ?? 3);
  }
}

// =========================================================================
// SPICYCHAT v1-draft TAM SADIK İMPORT & NORMALİZASYON
// =========================================================================
function normalizeAndPopulateRulebook(rawInput) {
  const raw = (rawInput && rawInput.rulebook && typeof rawInput.rulebook === "object") ? rawInput.rulebook : (rawInput || {});
  const rb = {
    start_datetime: raw.start_datetime || "2026-06-03 11:30",
    minutes_per_turn: Number(raw.minutes_per_turn ?? 3),
    meters: [],
    combined_rules: [],
    meter_triggers: [],
    rules: []
  };

  // Mevcut meter_triggers'ı id'ye göre grupla
  const rawTrigMap = {};
  if (Array.isArray(raw.meter_triggers)) {
    for (const tg of raw.meter_triggers) {
      if (tg.m && Array.isArray(tg.triggers)) {
        rawTrigMap[tg.m] = JSON.parse(JSON.stringify(tg.triggers));
      }
    }
  }

  const rawMeters = Array.isArray(raw.meters) ? raw.meters : (raw.stats || []);

  for (const m of rawMeters) {
    const id = String(m.id || m.key || (m.name || m.label || "m1").toLowerCase().replace(/[^a-z0-9_çğıöşü]/gi, "_"));
    const name = String(m.label || m.name || id);
    const mtype = canonMeterType(m.type || "bar");
    const icon = (m.icon && METER_ICONS[m.icon]) ? m.icon : getMeterIcon({ type: mtype });
    const color = (m.color && METER_COLORS.includes(m.color)) ? m.color : getMeterColor({ type: mtype });
    const vis = getMeterVisibility(m);

    const baseObj = {
      id,
      name,
      type: mtype,
      icon,
      color,
      image_url: m.image_url || "",
      visible: vis !== "hidden",
      hud: vis === "panel" ? "panel" : (vis === "hidden" ? "hidden" : "shown"),
      userEditable: m.userEditable !== false,
      tellModel: m.tellModel !== false,
      evaluates: m.evaluates || m.reads || "all",
      raises: Array.isArray(m.raises) ? [...m.raises] : [],
      lowers: Array.isArray(m.lowers) ? [...m.lowers] : [],
      keywords: Array.isArray(m.keywords) ? JSON.parse(JSON.stringify(m.keywords)) : [],
      triggers: Array.isArray(m.triggers) ? JSON.parse(JSON.stringify(m.triggers)) : (rawTrigMap[id] || []),
      ai: m.ai ? JSON.parse(JSON.stringify(m.ai)) : { on: false, rules: [] }
    };
    if (!Array.isArray(baseObj.ai.rules)) baseObj.ai.rules = [];

    if (mtype === "clock") {
      const startStr = String(m.start || rb.start_datetime || "2026-06-03 11:30").replace("T", " ").slice(0, 16);
      const stepMin = Number(m.stepMin ?? rb.minutes_per_turn ?? 3);
      rb.start_datetime = startStr;
      rb.minutes_per_turn = stepMin;
      Object.assign(baseObj, {
        mode: m.mode || "datetime",
        display: m.display || "calendar",
        start: startStr,
        stepMin,
        stepEvery: Number(m.stepEvery ?? 0),
        skips: m.skips !== false,
        ruleDims: Array.isArray(m.ruleDims) ? [...m.ruleDims] : ["tod"],
        todBands: Array.isArray(m.todBands) && m.todBands.length ? JSON.parse(JSON.stringify(m.todBands)) : [
          { label: "Sabah", to: 359, instr: "Sabah saatleri (06:00-11:59). Saati 24 saatlik dilimde göster.", caption: "", revealed: true, override: false },
          { label: "Gündüz", to: 719, instr: "Gün ortası (12:00-17:59). Saati 24 saatlik dilimde göster.", caption: "", revealed: true, override: false },
          { label: "Akşam", to: 1019, instr: "Akşam saatleri (18:00-22:59). Saati 24 saatlik dilimde göster.", caption: "", revealed: true, override: false },
          { label: "Gece", to: 1439, instr: "Gece ve sabaha karşı saatleri (23:00-05:59). Saati 24 saatlik dilimde göster.", caption: "", revealed: true, override: false }
        ],
        dayBands: Array.isArray(m.dayBands) ? JSON.parse(JSON.stringify(m.dayBands)) : []
      });
    } else if (mtype === "collection") {
      let items = [];
      if (Array.isArray(m.items) && m.items.length) {
        items = m.items.map(it => ({
          id: it.id || ("it_" + Math.random().toString(36).slice(2, 7)),
          label: it.label || it.name || it.id || "",
          start: Number(it.start ?? (it.at_start ? 1 : 0)),
          kind: it.kind || "held",
          revealed: it.revealed !== false
        }));
      } else if (Array.isArray(m.default)) {
        items = m.default.map((lbl, idx) => ({ id: "item_" + idx, label: String(lbl), start: 1, kind: "held", revealed: true }));
      }
      Object.assign(baseObj, {
        detectHint: m.detectHint || "",
        items,
        default: items.filter(x => x.start > 0).map(x => x.label),
        rules: Array.isArray(m.rules) ? JSON.parse(JSON.stringify(m.rules)) : []
      });
    } else if (mtype === "journal") {
      let items = [];
      if (Array.isArray(m.items) && m.items.length) {
        items = m.items.map(it => ({
          id: it.id || ("j_" + Math.random().toString(36).slice(2, 7)),
          label: String(it.label || it.id || "").trim(),
          hint: it.hint || "",
          at_start: Boolean(it.at_start),
          repeat: Boolean(it.repeat),
          revealed: it.revealed !== false
        }));
      }
      Object.assign(baseObj, {
        detectHint: m.detectHint || "",
        items,
        default: items.filter(x => x.at_start).map(x => x.label),
        rules: Array.isArray(m.rules) ? JSON.parse(JSON.stringify(m.rules)) : []
      });
    } else if (mtype === "select") {
      let opts = [];
      let optInsts = {};
      let optCaps = {};
      let optImgs = {};
      if (Array.isArray(m.items) && m.items.length) {
        for (const it of m.items) {
          const lbl = String(it.label || it.id || "").trim();
          if (lbl) {
            opts.push(lbl);
            if (it.instruction || it.instr) optInsts[lbl] = it.instruction || it.instr;
            if (it.caption) optCaps[lbl] = it.caption;
            if (it.image_url) optImgs[lbl] = it.image_url;
          }
        }
      } else if (Array.isArray(m.options)) {
        opts = m.options.map(o => typeof o === "string" ? o : (o.label || o.id)).filter(Boolean);
        optInsts = m.option_instructions ? { ...m.option_instructions } : {};
        optCaps = m.option_captions ? { ...m.option_captions } : {};
        optImgs = m.option_images ? { ...m.option_images } : {};
      }
      const defItem = Array.isArray(m.items) ? m.items.find(it => it.id === m.def || it.label === m.def) : null;
      const defVal = defItem ? (defItem.label || defItem.id) : String(m.def ?? m.default ?? (opts[0] || ""));
      Object.assign(baseObj, {
        detectHint: m.detectHint || "",
        options: opts,
        option_instructions: optInsts,
        option_captions: optCaps,
        option_images: optImgs,
        default: defVal
      });
    } else if (mtype === "text") {
      Object.assign(baseObj, {
        detectHint: m.detectHint || "",
        default: String(m.def ?? m.default ?? "")
      });
    } else if (mtype === "dice") {
      Object.assign(baseObj, {
        sides: Number(m.sides ?? 20),
        count: Number(m.count ?? 1),
        autoRoll: m.autoRoll !== false,
        default: Number(m.def ?? m.default ?? 10),
        min: 1,
        max: Number(m.sides ?? 20) * Number(m.count ?? 1),
        levels: getMeterLevels(m)
      });
    } else {
      // bar | pips | number
      const defVal = Number(m.def ?? m.default ?? m.initial ?? (m.min ?? 0));
      const minVal = (m.min !== undefined && m.min !== "") ? Number(m.min) : (mtype === "number" ? undefined : 0);
      const maxVal = (m.max !== undefined && m.max !== "") ? Number(m.max) : (mtype === "number" ? undefined : 100);
      Object.assign(baseObj, {
        default: defVal,
        min: minVal,
        max: maxVal,
        unit: m.unit || "",
        decimals: m.decimals !== undefined ? Number(m.decimals) : 0,
        perMsg: Number(m.perMsg ?? 0),
        spend: Boolean(m.spend),
        decay: Number(m.decay ?? m.decay_per_turn ?? 0),
        decay_every: Number(m.decay_every ?? 1),
        levels: getMeterLevels({ ...m, min: minVal, max: maxVal })
      });
    }

    rb.meters.push(baseObj);
  }

  // Combined rules
  if (Array.isArray(raw.combined_rules)) {
    rb.combined_rules = raw.combined_rules.map((cr, idx) => ({
      id: cr.id || `kural-${idx + 1}`,
      name: cr.name || cr.caption || cr.id || `Birleşik Kural ${idx + 1}`,
      conds: Array.isArray(cr.conds) ? JSON.parse(JSON.stringify(cr.conds)) : [],
      instr: cr.instr || cr.instruction || "",
      caption: cr.caption || ""
    }));
  }

  // Extra rules (random events, etc.)
  if (Array.isArray(raw.rules)) {
    rb.rules = raw.rules.map(r => ({
      name: r.name || "Kural",
      type: r.type || "random",
      keys: Array.isArray(r.keys) ? r.keys.join(", ") : String(r.keys || ""),
      target: r.target || "",
      op: r.op || "add",
      value: r.value ?? 0,
      cond_op: r.cond_op || "<",
      threshold: Number(r.threshold ?? 20),
      chance: Number(r.chance ?? 15),
      instruction: r.instruction || "",
      enabled: r.enabled !== false
    }));
  }

  return rb;
}

// =========================================================================
// RULEBOOK KÜTÜPHANESİ & AÇMA
// =========================================================================
async function loadRulebooks() {
  rulebooks = await fetch("/api/rulebooks").then(r => r.json());
  if (typeof renderCreations === "function" && currentCreationsTab === "rulebooks") {
    renderCreations();
  }
}

async function uploadRulebookCover(input) {
  if (!input.files || !input.files[0]) return;
  const fd = new FormData();
  fd.append("file", input.files[0]);
  const res = await fetch("/api/upload?mode=avatar", { method: "POST", body: fd }).then(r => r.json());
  if (res.url) {
    document.getElementById("rb-cover-url").value = res.url;
    const prev = document.getElementById("rb-cover-preview");
    const emp = document.getElementById("rb-cover-empty");
    if (prev) { prev.src = res.url; prev.classList.remove("hidden"); }
    if (emp) emp.classList.add("hidden");
  }
  input.value = "";
}

async function quickImportRulebookFile(input) {
  if (!input.files || !input.files[0]) return;
  try {
    const raw = JSON.parse(await input.files[0].text());
    const meta = (raw && raw.rulebook) ? raw.rulebook : raw;
    const norm = normalizeAndPopulateRulebook(raw);
    const resp = await fetch("/api/rulebooks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: meta.name || input.files[0].name.replace(/\.json$/i, ""),
        description: meta.description || "JSON'dan yüklendi",
        tags: meta.tags || "",
        data: norm
      })
    }).then(r => r.json());
    await loadRulebooks();
    openRulebookEditor(resp.id);
  } catch (e) {
    alert("Rulebook JSON okunamadı: " + e.message);
  }
  input.value = "";
}

function openRulebookEditor(id = null, explicitNavId = null) {
  document.getElementById("rb-id").value = "";
  document.getElementById("rb-cover-url").value = "";
  document.getElementById("rb-cover-preview")?.classList.add("hidden");
  document.getElementById("rb-cover-empty")?.classList.remove("hidden");
  document.getElementById("rb-name").value = "";
  document.getElementById("rb-desc").value = "";
  document.getElementById("rb-tags").value = "";
  document.getElementById("rb-header-title").textContent = "Rulebook Oluştur";
  editRulebookData = { start_datetime: "2026-06-03 11:30", minutes_per_turn: 3, meters: [], combined_rules: [], meter_triggers: [], rules: [] };
  ruleJsonMode = false;
  selectedMeterIdx = null;
  showIconPicker = false;
  showColorPicker = false;
  selectedInfBand = {};
  playtestLog = [];
  document.getElementById("rule-json-box").classList.add("hidden");
  document.getElementById("rb-delete-card").classList.toggle("hidden", !id);

  if (id) {
    const rb = rulebooks.find(x => x.id === id);
    if (rb) {
      document.getElementById("rb-id").value = rb.id;
      document.getElementById("rb-name").value = rb.name;
      document.getElementById("rb-desc").value = rb.description || "";
      document.getElementById("rb-tags").value = rb.tags || "";
      document.getElementById("rb-header-title").textContent = rb.name;
      if (rb.cover_url) {
        document.getElementById("rb-cover-url").value = rb.cover_url;
        const p = document.getElementById("rb-cover-preview");
        if (p) { p.src = rb.cover_url; p.classList.remove("hidden"); }
        document.getElementById("rb-cover-empty")?.classList.add("hidden");
      }
      editRulebookData = normalizeAndPopulateRulebook(rb.data || {});
    }
  }

  resetPlaytestState(false);
  switchRulebookTab("meters");
  const targetNav = explicitNavId || (id ? (typeof lastActiveNavId !== "undefined" && lastActiveNavId === "nav-rulebooks" ? "nav-rulebooks" : "nav-mine-rulebooks") : "nav-create-rb");
  showView("rulebook-edit", targetNav);
}

function switchRulebookTab(tab) {
  rbeActiveTab = tab;
  document.querySelectorAll(".rbe-tab").forEach(b => b.classList.remove("active"));
  document.getElementById(`rbe-tab-${tab}`)?.classList.add("active");

  if (ruleJsonMode) return;
  document.getElementById("rbe-pane-props").classList.toggle("hidden", tab !== "props");
  document.getElementById("rbe-workspace").classList.toggle("hidden", tab === "props");
  document.getElementById("rbe-pane-meters").classList.toggle("hidden", tab !== "meters");
  document.getElementById("rbe-pane-rules").classList.toggle("hidden", tab !== "rules");

  renderAllRulebookViews();
}

function resetPlaytestState(rerender = true) {
  syncClockTopFields();
  playtestState = {
    turn: 0,
    day: 1,
    clock: editRulebookData.start_datetime || "2026-06-03 11:30",
    meters: {},
    inventory: [],
    journals: {},
    fired_triggers: {}
  };
  playtestLog = [];
  for (const m of (editRulebookData.meters || [])) {
    const mid = m.id || m.name;
    const t = canonMeterType(m.type);
    if (t === "clock") {
      playtestState.clock = String(m.start || playtestState.clock).replace("T", " ").slice(0, 16);
      playtestState.meters[mid] = playtestState.clock;
    } else if (t === "collection") {
      const items = (m.items || []).filter(it => (it.start ?? 0) > 0).map(it => it.label);
      const list = items.length ? items : (Array.isArray(m.default) ? [...m.default] : []);
      playtestState.meters[mid] = [...list];
      if (!playtestState.inventory.length) playtestState.inventory = [...list];
    } else if (t === "journal") {
      const j = (m.items || []).filter(it => it.at_start).map(it => it.label);
      playtestState.journals[mid] = [...j];
      playtestState.meters[mid] = j.join(", ");
    } else if (t === "select" || t === "text") {
      playtestState.meters[mid] = String(m.default ?? (m.options?.[0] || ""));
    } else {
      playtestState.meters[mid] = Number(m.default ?? m.min ?? 0);
    }
  }
  if (rerender) {
    renderPlaytest();
    renderPlaytestLog();
    renderModelSees();
    if (rbeActiveTab === "rules") renderInfluenceRules();
  }
}

function countTotalInfluenceRules() {
  const meters = editRulebookData.meters || [];
  let total = (editRulebookData.combined_rules || []).length + (editRulebookData.rules || []).length;
  for (const m of meters) {
    const t = canonMeterType(m.type);
    if (t === "clock") total += (m.todBands || []).length + (m.dayBands || []).length;
    else if (t === "select") total += (m.options || []).length;
    else if (t === "collection" || t === "journal") total += (m.rules || []).length;
    else total += (m.levels || []).length;
  }
  return total;
}

function renderAllRulebookViews() {
  syncClockTopFields();
  const meters = editRulebookData.meters || [];
  const totalInf = countTotalInfluenceRules();

  document.getElementById("rbe-cnt-meters").textContent = meters.length;
  document.getElementById("rbe-cnt-rules").textContent = totalInf;
  document.getElementById("rb-prop-mcount").textContent = meters.length;
  document.getElementById("rb-prop-rcount").textContent = totalInf;

  renderRulebookHealth();
  renderMetersSection();
  renderInfluenceRules();
  renderPlaytest();
  renderPlaytestLog();
  renderModelSees();
}

// --- SAĞLIK / DOĞRULAMA ROZETLERİ ---
function meterHasDriver(m) {
  const t = canonMeterType(m.type);
  if (t === "clock") return Number(m.stepMin ?? 0) > 0 || Boolean(m.skips);
  if (t === "dice") return true;
  if (m.ai && m.ai.on) return true;
  if ((m.keywords || []).length > 0) return true;
  if ((m.triggers || []).length > 0) return true;
  if (Number(m.decay || 0) !== 0 || Number(m.perMsg || 0) !== 0) return true;
  if (m.userEditable) return true;
  return false;
}

function renderRulebookHealth() {
  const row = document.getElementById("rbe-health-row");
  if (!row) return;
  const meters = editRulebookData.meters || [];
  let errors = 0;
  let noDriverNames = [];
  let noInstrLevels = 0;

  for (const m of meters) {
    if (!getMeterName(m).trim()) errors++;
    if (!meterHasDriver(m)) noDriverNames.push(m.id || "gösterge");
    const t = canonMeterType(m.type);
    if (t === "bar" || t === "pips" || t === "number" || t === "dice") {
      for (const lv of (m.levels || [])) {
        if (!String(lv.instruction || "").trim()) noInstrLevels++;
      }
    }
  }

  const previewText = computeModelSeesEntries().map(e => e.text).join(" ");
  const estTokens = Math.max(0, Math.round(previewText.length / 3.8));

  let pills = [];
  if (errors > 0) pills.push(`<span class="rbe-health-pill err">⚠ ${errors} hata</span>`);
  if (noDriverNames.length > 0) pills.push(`<span class="rbe-health-pill warn">⚠ ${noDriverNames.length} uyarı (${escapeHtml(noDriverNames[0])} hareket etmiyor)</span>`);
  pills.push(`<span class="rbe-health-pill ok">✓ En büyük talimat bloğu ~${estTokens} / 1200 token</span>`);
  if (!noDriverNames.length && meters.length) pills.push(`<span class="rbe-health-pill ok">✓ Her göstergenin sürücüsü var</span>`);
  if ((editRulebookData.combined_rules || []).length) pills.push(`<span class="rbe-health-pill ok">✓ Tüm birleşik kurallar ulaşılabilir</span>`);
  if (noInstrLevels > 0) pills.push(`<span class="rbe-health-pill">ℹ ${noInstrLevels} seviye talimat eklemiyor</span>`);

  row.innerHTML = pills.join("");
}

// =========================================================================
// SEKME 2: GÖSTERGELER (LİSTE + TAM YAPILANDIRMA PANELİ)
// =========================================================================
function selectMeterForConfig(idx) {
  selectedMeterIdx = idx;
  showIconPicker = false;
  showColorPicker = false;
  renderMetersSection();
}

function getMeterUsedIn(mid) {
  const used = [];
  for (const cr of (editRulebookData.combined_rules || [])) {
    if ((cr.conds || []).some(c => c.m === mid)) used.push(`Birleşik Kural: ${cr.name || cr.id}`);
  }
  for (const om of (editRulebookData.meters || [])) {
    if ((om.triggers || []).some(tr => (tr.when || []).some(c => c.m === mid))) {
      used.push(`Tetikleyici: ${om.name}`);
    }
  }
  return used;
}

function meterSummaryLine(m) {
  const t = canonMeterType(m.type);
  if (t === "clock") {
    const modeLbl = m.mode === "time" ? "sadece saat" : (m.mode === "day" ? "sadece gün" : "tarih ve saat");
    return `Hikâye Saati · ${modeLbl} · Başlangıç: ${formatReadableClock(m.start)} · +${m.stepMin ?? 3} dk/mesaj${m.skips ? ' · zaman atlamaları' : ''}`;
  }
  if (t === "collection") return `Koleksiyon · ${(m.items || m.default || []).length} eşya`;
  if (t === "journal") return `Günlük · ${(m.items || []).length} olay`;
  if (t === "select") return `Birini Seç · ${(m.options || []).length} seçenek · Başlangıç: ${m.default || '-'}`;
  if (t === "text") return `Metin · Başlangıç: ${m.default || '-'}`;
  if (t === "dice") return `Zar · ${m.count || 1}d${m.sides || 20} · ${m.autoRoll !== false ? 'otomatik' : 'elle'}`;
  if (t === "number") return `Sayı · Başlangıç: ${m.default ?? 0}${m.unit || ''}${m.spend ? ' · harcanabilir' : ''} · ${(m.levels || []).length} seviye`;
  return `${t === "pips" ? "Pips" : "Bar"} · ${m.min ?? 0}–${m.max ?? 100} · Başlangıç: ${m.default ?? 0}${m.ai?.on ? ' · AI' : ''}${m.decay ? ' · azalma ' + m.decay : ''} · ${(m.levels || []).length} seviye`;
}

function changeMeterType(idx, newType) {
  const m = editRulebookData.meters[idx];
  if (!m || canonMeterType(m.type) === newType) return;
  m.type = newType;
  m.icon = getMeterIcon({ type: newType });
  m.color = getMeterColor({ type: newType });

  if (newType === "clock") {
    m.mode = m.mode || "datetime";
    m.start = m.start || "2026-06-03 11:30";
    m.stepMin = m.stepMin ?? 3;
    m.stepEvery = m.stepEvery ?? 0;
    m.skips = m.skips !== false;
    m.ruleDims = m.ruleDims || ["tod"];
    if (!m.todBands || !m.todBands.length) {
      m.todBands = [
        { label: "Sabah", to: 359, instr: "Sabah saatleri (06:00-11:59).", caption: "", revealed: true, override: false },
        { label: "Gündüz", to: 719, instr: "Gün ortası (12:00-17:59).", caption: "", revealed: true, override: false },
        { label: "Akşam", to: 1019, instr: "Akşam saatleri (18:00-22:59).", caption: "", revealed: true, override: false },
        { label: "Gece", to: 1439, instr: "Gece saatleri (23:00-05:59).", caption: "", revealed: true, override: false }
      ];
    }
  } else if (newType === "bar" || newType === "pips") {
    m.min = m.min ?? 0;
    m.max = m.max ?? 100;
    m.default = Number(m.default) || 0;
    if (!Array.isArray(m.levels) || !m.levels.length) {
      m.levels = [
        { min: 0, max: 30, label: "Düşük", instruction: "", caption: "", revealed: true, override: false },
        { min: 31, max: 70, label: "Orta", instruction: "", caption: "", revealed: true, override: false },
        { min: 71, max: 100, label: "Yüksek", instruction: "", caption: "", revealed: true, override: false }
      ];
    }
  } else if (newType === "number") {
    m.min = undefined;
    m.max = undefined;
    m.default = Number(m.default) || 0;
    m.unit = m.unit || "";
    if (!Array.isArray(m.levels)) m.levels = [];
  } else if (newType === "dice") {
    m.sides = m.sides || 20;
    m.count = m.count || 1;
    m.autoRoll = true;
    m.min = 1;
    m.max = m.sides * m.count;
    m.default = 10;
    if (!Array.isArray(m.levels)) m.levels = [];
  } else if (newType === "select") {
    m.options = Array.isArray(m.options) && m.options.length ? m.options : ["Seçenek 1", "Seçenek 2"];
    m.option_instructions = m.option_instructions || {};
    m.option_captions = m.option_captions || {};
    m.default = m.options[0];
  } else if (newType === "collection") {
    m.items = Array.isArray(m.items) && m.items.length ? m.items : [{ id: "esya_1", label: "Telefon", start: 1, kind: "held", revealed: true }];
    m.default = m.items.filter(x => x.start > 0).map(x => x.label);
    m.rules = m.rules || [];
  } else if (newType === "journal") {
    m.items = Array.isArray(m.items) && m.items.length ? m.items : [{ id: "olay_1", label: "Başlangıç", hint: "Hikayenin başlangıcı", at_start: true, repeat: false, revealed: true }];
    m.rules = m.rules || [];
  } else if (newType === "text") {
    m.default = typeof m.default === "string" ? m.default : "";
  }

  resetPlaytestState(false);
  renderAllRulebookViews();
}

function setMeterVisibility(idx, vis) {
  const m = editRulebookData.meters[idx];
  if (vis === "hidden") { m.visible = false; m.hud = "hidden"; }
  else if (vis === "panel") { m.visible = true; m.hud = "panel"; }
  else { m.visible = true; m.hud = "shown"; }
  renderAllRulebookViews();
}

function moveMeter(idx, dir) {
  const arr = editRulebookData.meters || [];
  const target = idx + dir;
  if (target < 0 || target >= arr.length) return;
  [arr[idx], arr[target]] = [arr[target], arr[idx]];
  if (selectedMeterIdx === idx) selectedMeterIdx = target;
  else if (selectedMeterIdx === target) selectedMeterIdx = idx;
  renderAllRulebookViews();
}

function addMeterRow() {
  if (!editRulebookData.meters) editRulebookData.meters = [];
  const idx = editRulebookData.meters.length;
  editRulebookData.meters.push({
    id: "m" + (idx + 1),
    name: "Yeni Gösterge",
    type: "bar",
    icon: "sparkle",
    color: METER_COLORS[idx % METER_COLORS.length],
    visible: true,
    hud: "shown",
    userEditable: true,
    tellModel: true,
    evaluates: "all",
    default: 0, min: 0, max: 100, decay: 0, decay_every: 1,
    raises: [], lowers: [], keywords: [], triggers: [],
    ai: { on: false, rules: [] },
    levels: [
      { min: 0, max: 49, label: "Düşük", instruction: "", caption: "", revealed: true, override: false },
      { min: 50, max: 100, label: "Yüksek", instruction: "", caption: "", revealed: true, override: false }
    ]
  });
  selectedMeterIdx = idx;
  resetPlaytestState(false);
  renderAllRulebookViews();
}

function deleteMeterAt(idx) {
  editRulebookData.meters.splice(idx, 1);
  selectedMeterIdx = null;
  resetPlaytestState(false);
  renderAllRulebookViews();
}

function addMeterKeyword(idx) {
  const m = editRulebookData.meters[idx];
  if (!Array.isArray(m.keywords)) m.keywords = [];
  m.keywords.push({ words: "", op: "add", d: 5 });
  renderMetersSection();
}

function addMeterAiRule(idx) {
  const m = editRulebookData.meters[idx];
  if (!m.ai) m.ai = { on: true, rules: [] };
  if (!Array.isArray(m.ai.rules)) m.ai.rules = [];
  m.ai.rules.push({ id: "kural_" + (m.ai.rules.length + 1), d: 5, when: "" });
  renderMetersSection();
}

function addMeterTrigger(idx) {
  const m = editRulebookData.meters[idx];
  if (!Array.isArray(m.triggers)) m.triggers = [];
  const firstOther = (editRulebookData.meters || []).find((_, i) => i !== idx) || m;
  const ft = canonMeterType(firstOther.type);
  m.triggers.push({
    id: "tr_" + (m.triggers.length + 1),
    when: [ft === "clock" ? { m: firstOther.id, op: "weekday", days: [1] } : { m: firstOther.id, op: ">=", v: 50 }],
    do: { d: 10 }
  });
  renderMetersSection();
}

function renderMetersSection() {
  const meters = editRulebookData.meters || [];
  const strip = document.getElementById("rbe-meter-strip");
  const listEl = document.getElementById("rb-meters-list");
  if (!strip || !listEl) return;

  // 1. Üst Hızlı Seçim Şeridi (< Tümü N | m1 | m2 ...)
  strip.innerHTML = `
    <button type="button" class="rbe-strip-pill ${selectedMeterIdx === null ? 'active' : ''}" onclick="selectMeterForConfig(null)">
      ‹ Tümü (${meters.length})
    </button>
    ${meters.map((m, i) => `
      <button type="button" class="rbe-strip-pill c-${getMeterColor(m)} ${selectedMeterIdx === i ? 'active' : ''}" onclick="selectMeterForConfig(${i})">
        ${METER_ICONS[getMeterIcon(m)] || ''}
        <span>${escapeHtml(getMeterName(m) || m.id)}</span>
      </button>
    `).join("")}
  `;

  // 2. Liste Modu (selectedMeterIdx === null)
  if (selectedMeterIdx === null || !meters[selectedMeterIdx]) {
    if (!meters.length) {
      listEl.innerHTML = `<div class="muted small-text" style="padding:24px;text-align:center;">Henüz gösterge yok. <b>+ Gösterge Ekle</b> veya <b>↑ İçe Aktar</b> ile başla.</div>`;
      return;
    }
    listEl.innerHTML = `<div class="rbe-meter-stack">` + meters.map((m, i) => {
      const col = getMeterColor(m);
      const ic = getMeterIcon(m);
      const vis = getMeterVisibility(m);
      const visText = vis === "hidden" ? "Gizli" : (vis === "panel" ? "Sadece Panel" : "Göster");
      const usedCount = getMeterUsedIn(m.id).length;
      return `
        <div class="rbe-meter-item c-${col}">
          <div class="rbe-meter-row" onclick="selectMeterForConfig(${i})">
            <div class="rbe-order-btns" onclick="event.stopPropagation()">
              <button type="button" onclick="moveMeter(${i}, -1)" title="Yukarı">▲</button>
              <button type="button" onclick="moveMeter(${i}, 1)" title="Aşağı">▼</button>
            </div>
            ${iconBadgeHtml(ic, col, false, m.image_url || "")}
            <div class="rbe-meter-info">
              <div class="rbe-meter-name">${escapeHtml(getMeterName(m) || "(İsimsiz)")}</div>
              <div class="rbe-meter-meta">${escapeHtml(meterSummaryLine(m))}</div>
            </div>
            <span class="muted small-text" style="white-space:nowrap;">${usedCount ? usedCount + ' yerde' : 'Kullanılmıyor'}</span>
            <span class="rbe-vis-badge ${vis === 'shown' ? 'shown' : ''}">${visText}</span>
          </div>
        </div>`;
    }).join("") + `</div>`;
    return;
  }

  // 3. TAM YAPILANDIRMA MODU (CONFIGURE · <ID>) — Görsel 1 ile birebir!
  const idx = selectedMeterIdx;
  const m = meters[idx];
  const t = canonMeterType(m.type);
  const ic = getMeterIcon(m);
  const col = getMeterColor(m);
  const vis = getMeterVisibility(m);
  const shownCount = meters.filter(x => getMeterVisibility(x) === "shown").length;
  const usedIn = getMeterUsedIn(m.id);

  // Tür-özel alanlar
  let typeSpecificHtml = "";
  if (t === "clock") {
    typeSpecificHtml = `
      <div class="rbe-cfg-section">
        <span class="rbe-cfg-label">Saat Modu</span>
        <div class="seg-group">
          <button type="button" class="seg-btn ${(m.mode||'datetime')==='datetime'?'active':''}" onclick="editRulebookData.meters[${idx}].mode='datetime';renderAllRulebookViews();">Tarih ve Saat</button>
          <button type="button" class="seg-btn ${m.mode==='time'?'active':''}" onclick="editRulebookData.meters[${idx}].mode='time';renderAllRulebookViews();">Sadece Saat</button>
          <button type="button" class="seg-btn ${m.mode==='day'?'active':''}" onclick="editRulebookData.meters[${idx}].mode='day';renderAllRulebookViews();">Sadece Gün</button>
        </div>
      </div>
      <div class="dyn-row rbe-cfg-section" style="flex-direction:row;">
        <label style="margin:0;flex:1.4;">Başlangıç Tarih ve Saati (YYYY-AA-GG SS:DD)
          <input type="text" value="${escapeHtml(m.start || '2026-06-03 11:30')}" oninput="editRulebookData.meters[${idx}].start=this.value;syncClockTopFields();playtestState.clock=this.value;renderModelSees();" />
        </label>
        <label style="margin:0;flex:0.8;">Mesaj Başı Dakika (+dk)
          <input type="number" min="0" value="${m.stepMin ?? 3}" oninput="editRulebookData.meters[${idx}].stepMin=Number(this.value);syncClockTopFields();" />
        </label>
        <label style="margin:0;flex:0.8;">Kaç Mesajda Bir (0 = Her)
          <input type="number" min="0" value="${m.stepEvery ?? 0}" oninput="editRulebookData.meters[${idx}].stepEvery=Number(this.value);" />
        </label>
      </div>
      <div class="rbe-switch-card rbe-cfg-section">
        <div class="rbe-switch-row">
          <div class="rbe-switch-info">
            <div class="rbe-switch-title">Zaman atlamalarına izin ver</div>
            <div class="rbe-switch-desc">Hikâyede "ertesi sabah" veya "2 saat sonra" gibi atlamalarda saat ileri sarılabilir.</div>
          </div>
          <label class="sw-toggle"><input type="checkbox" ${m.skips !== false ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].skips=this.checked;" /><span class="sw-slider"></span></label>
        </div>
      </div>`;
  } else if (t === "bar" || t === "pips") {
    typeSpecificHtml = `
      <div class="dyn-row rbe-cfg-section" style="flex-direction:row;">
        <label style="margin:0;">Min <input type="number" value="${m.min ?? 0}" onchange="editRulebookData.meters[${idx}].min=Number(this.value);renderAllRulebookViews();" /></label>
        <label style="margin:0;">Max <input type="number" value="${m.max ?? 100}" onchange="editRulebookData.meters[${idx}].max=Number(this.value);renderAllRulebookViews();" /></label>
        <label style="margin:0;">Başlangıç Değeri <input type="number" value="${m.default ?? 0}" onchange="editRulebookData.meters[${idx}].default=Number(this.value);resetPlaytestState();" /></label>
      </div>`;
  } else if (t === "number") {
    typeSpecificHtml = `
      <div class="dyn-row rbe-cfg-section" style="flex-direction:row;">
        <label style="margin:0;">Başlangıç <input type="number" value="${m.default ?? 0}" onchange="editRulebookData.meters[${idx}].default=Number(this.value);resetPlaytestState();" /></label>
        <label style="margin:0;max-width:95px;">Birim <input type="text" placeholder="€, ₺" value="${escapeHtml(m.unit || '')}" oninput="editRulebookData.meters[${idx}].unit=this.value;renderModelSees();" /></label>
        <label style="margin:0;max-width:95px;">Ondalık <input type="number" min="0" max="4" value="${m.decimals ?? 0}" onchange="editRulebookData.meters[${idx}].decimals=Number(this.value);" /></label>
        <label style="margin:0;max-width:125px;">Mesaj Başı Değişim <input type="number" value="${m.perMsg ?? 0}" onchange="editRulebookData.meters[${idx}].perMsg=Number(this.value);" /></label>
      </div>
      <div class="rbe-switch-card rbe-cfg-section">
        <div class="rbe-switch-row">
          <div class="rbe-switch-info">
            <div class="rbe-switch-title">Harcanabilir / Eksiye inebilir</div>
            <div class="rbe-switch-desc">Para veya kaynak gibi harcanıp azalabilen değerler için açın.</div>
          </div>
          <label class="sw-toggle"><input type="checkbox" ${m.spend ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].spend=this.checked;" /><span class="sw-slider"></span></label>
        </div>
      </div>`;
  } else if (t === "dice") {
    typeSpecificHtml = `
      <div class="dyn-row rbe-cfg-section" style="flex-direction:row;">
        <label style="margin:0;">Zar Yüzü (d20, d100) <input type="number" min="2" value="${m.sides ?? 20}" onchange="editRulebookData.meters[${idx}].sides=Number(this.value);editRulebookData.meters[${idx}].max=Number(this.value)*(editRulebookData.meters[${idx}].count||1);renderAllRulebookViews();" /></label>
        <label style="margin:0;">Zar Adedi <input type="number" min="1" max="10" value="${m.count ?? 1}" onchange="editRulebookData.meters[${idx}].count=Number(this.value);editRulebookData.meters[${idx}].max=Number(this.value)*(editRulebookData.meters[${idx}].sides||20);renderAllRulebookViews();" /></label>
      </div>
      <div class="rbe-switch-card rbe-cfg-section">
        <div class="rbe-switch-row">
          <div class="rbe-switch-info">
            <div class="rbe-switch-title">Her turda otomatik zar at</div>
            <div class="rbe-switch-desc">Kapalıysa yalnızca sohbetten /zar komutuyla atılır.</div>
          </div>
          <label class="sw-toggle"><input type="checkbox" ${m.autoRoll !== false ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].autoRoll=this.checked;" /><span class="sw-slider"></span></label>
        </div>
      </div>`;
  } else if (t === "select") {
    const opts = m.options || [];
    typeSpecificHtml = `
      <div class="rbe-subbox rbe-cfg-section">
        <div class="sub-header" style="margin:0;">
          <b class="rbe-cfg-label">Seçenekler (${opts.length})</b>
          <button type="button" class="btn small" onclick="editRulebookData.meters[${idx}].options.push('Yeni Seçenek');renderAllRulebookViews();">+ Seçenek Ekle</button>
        </div>
        <div class="rbe-meter-stack">
          ${opts.map((o, oi) => `
            <div class="dyn-row">
              <input type="radio" name="sel-def-${idx}" ${m.default === o ? 'checked' : ''} title="Başlangıç seçeneği" onchange="editRulebookData.meters[${idx}].default=editRulebookData.meters[${idx}].options[${oi}];resetPlaytestState();" />
              <input type="text" value="${escapeHtml(o)}" onchange="renameSelectOption(${idx}, ${oi}, this.value)" />
              <button type="button" class="btn small danger" onclick="editRulebookData.meters[${idx}].options.splice(${oi},1);resetPlaytestState();renderAllRulebookViews();">✕</button>
            </div>
          `).join("")}
        </div>
        <label style="margin:0;">Algılama İpucu (detectHint)
          <input type="text" placeholder="Örn: {{user}}'ın son mesajlarda bulunduğu yeri seç." value="${escapeHtml(m.detectHint || '')}" oninput="editRulebookData.meters[${idx}].detectHint=this.value;" />
        </label>
      </div>`;
  } else if (t === "collection") {
    const items = m.items || [];
    typeSpecificHtml = `
      <div class="rbe-subbox rbe-cfg-section">
        <div class="sub-header" style="margin:0;">
          <b class="rbe-cfg-label">Eşyalar / Koleksiyon (${items.length})</b>
          <button type="button" class="btn small" onclick="editRulebookData.meters[${idx}].items.push({id:'it_'+Date.now(),label:'Yeni Eşya',start:1,kind:'held',revealed:true});resetPlaytestState();renderAllRulebookViews();">+ Eşya Ekle</button>
        </div>
        <div class="rbe-meter-stack">
          ${items.map((it, ii) => `
            <div class="dyn-row">
              <input type="text" value="${escapeHtml(it.label || '')}" placeholder="Eşya adı" onchange="editRulebookData.meters[${idx}].items[${ii}].label=this.value;syncCollectionDefaults(${idx});" />
              <input type="number" min="0" style="max-width:80px;" title="Başlangıç adedi" value="${it.start ?? 1}" onchange="editRulebookData.meters[${idx}].items[${ii}].start=Number(this.value);syncCollectionDefaults(${idx});" />
              <button type="button" class="btn small danger" onclick="editRulebookData.meters[${idx}].items.splice(${ii},1);syncCollectionDefaults(${idx});renderAllRulebookViews();">✕</button>
            </div>
          `).join("")}
        </div>
        <label style="margin:0;">Algılama İpucu (detectHint)
          <input type="text" placeholder="Örn: Satın alınan eşyayı ekle, satılanı çıkar." value="${escapeHtml(m.detectHint || '')}" oninput="editRulebookData.meters[${idx}].detectHint=this.value;" />
        </label>
      </div>`;
  } else if (t === "journal") {
    const items = m.items || [];
    typeSpecificHtml = `
      <div class="rbe-subbox rbe-cfg-section">
        <div class="sub-header" style="margin:0;">
          <b class="rbe-cfg-label">Günlük Olayları (${items.length})</b>
          <button type="button" class="btn small" onclick="editRulebookData.meters[${idx}].items.push({id:'j_'+Date.now(),label:'Yeni Olay',hint:'',at_start:false,repeat:false,revealed:true});renderAllRulebookViews();">+ Olay Ekle</button>
        </div>
        <div class="rbe-meter-stack">
          ${items.map((it, ii) => `
            <div class="dyn-card" style="padding:9px;">
              <div class="dyn-row">
                <input type="text" value="${escapeHtml(it.label || '')}" placeholder="Olay adı (Örn: 2026)" onchange="editRulebookData.meters[${idx}].items[${ii}].label=this.value;resetPlaytestState();" />
                <label class="checkbox-row" style="margin:0;"><input type="checkbox" ${it.at_start ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].items[${ii}].at_start=this.checked;resetPlaytestState();" /> Başlangıç</label>
                <label class="checkbox-row" style="margin:0;"><input type="checkbox" ${it.repeat ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].items[${ii}].repeat=this.checked;" /> Tekrarlanır</label>
                <button type="button" class="btn small danger" onclick="editRulebookData.meters[${idx}].items.splice(${ii},1);resetPlaytestState();renderAllRulebookViews();">✕</button>
              </div>
              <input type="text" value="${escapeHtml(it.hint || '')}" placeholder="Ne zaman kaydedilir? (İpucu)" onchange="editRulebookData.meters[${idx}].items[${ii}].hint=this.value;" />
            </div>
          `).join("")}
        </div>
        <label style="margin:0;">Algılama İpucu (detectHint)
          <input type="text" value="${escapeHtml(m.detectHint || '')}" oninput="editRulebookData.meters[${idx}].detectHint=this.value;" />
        </label>
      </div>`;
  } else if (t === "text") {
    typeSpecificHtml = `
      <div class="rbe-cfg-section">
        <label style="margin:0;">Başlangıç Metni
          <input type="text" value="${escapeHtml(m.default || '')}" oninput="editRulebookData.meters[${idx}].default=this.value;playtestState.meters['${escapeHtml(m.id)}']=this.value;renderModelSees();" />
        </label>
        <label style="margin:0;">Algılama İpucu (detectHint)
          <input type="text" value="${escapeHtml(m.detectHint || '')}" placeholder="Tek kısa satırda neyi takip etsin?" oninput="editRulebookData.meters[${idx}].detectHint=this.value;" />
        </label>
      </div>`;
  }

  // "Bu gösterge nasıl hareket eder" bölümü (AI, Tetikleyiciler, Anahtar Kelimeler, Azalma)
  const aiOn = Boolean(m.ai && m.ai.on);
  const trigs = m.triggers || [];
  const kws = m.keywords || [];
  const decayOn = Number(m.decay || 0) !== 0;

  let howItMovesHtml = "";
  if (t !== "clock") {
    howItMovesHtml = `
      <div class="rbe-cfg-section" style="margin-top:16px;">
        <div class="rbe-cfg-label">Bu gösterge nasıl hareket eder</div>
        <div class="rbe-cfg-sub">Her turda sırasıyla: anahtar kelimeler, tetikleyiciler, yapay zekâ değerlendirmesi ve hiçbir şey değiştirmediyse azalma çalışır.</div>

        <!-- 1. Yapay Zekâ Değerlendirmesi -->
        <div class="rbe-switch-card">
          <div class="rbe-switch-row">
            <div class="rbe-switch-info">
              <div class="rbe-switch-title">Yapay Zekâ Değerlendirmesi (AI)</div>
              <div class="rbe-switch-desc">Model son mesajları okuyup aşağıdaki kurallara göre değişimleri algılar.</div>
            </div>
            <label class="sw-toggle"><input type="checkbox" ${aiOn ? 'checked' : ''} onchange="if(!editRulebookData.meters[${idx}].ai)editRulebookData.meters[${idx}].ai={on:false,rules:[]};editRulebookData.meters[${idx}].ai.on=this.checked;renderMetersSection();" /><span class="sw-slider"></span></label>
          </div>
          ${aiOn ? `
            ${t === "number" ? `
              <label style="margin:0;">Çıkarma İpucu (extractHint)
                <input type="text" value="${escapeHtml(m.ai.extractHint || '')}" placeholder="Örn: {{user}}'ın kazandığı veya harcadığı tutar." oninput="editRulebookData.meters[${idx}].ai.extractHint=this.value;" />
              </label>` : ''}
            <div class="rbe-meter-stack">
              ${(m.ai.rules || []).map((ar, ai) => `
                <div class="dyn-row">
                  <input type="text" style="flex:2;" placeholder="Ne olduğunda? (Örn: {{user}} gol atar)" value="${escapeHtml(ar.when || '')}" onchange="editRulebookData.meters[${idx}].ai.rules[${ai}].when=this.value;" />
                  <select style="max-width:90px;" onchange="if(this.value==='set'){editRulebookData.meters[${idx}].ai.rules[${ai}].set=0;delete editRulebookData.meters[${idx}].ai.rules[${ai}].d;}else{editRulebookData.meters[${idx}].ai.rules[${ai}].d=5;delete editRulebookData.meters[${idx}].ai.rules[${ai}].set;}renderMetersSection();">
                    <option value="add" ${ar.set===undefined?'selected':''}>Değiş (+/-)</option>
                    <option value="set" ${ar.set!==undefined?'selected':''}>Sabitle (=)</option>
                  </select>
                  <input type="number" style="max-width:85px;" value="${ar.set!==undefined?ar.set:(ar.d??0)}" onchange="if(editRulebookData.meters[${idx}].ai.rules[${ai}].set!==undefined)editRulebookData.meters[${idx}].ai.rules[${ai}].set=Number(this.value);else editRulebookData.meters[${idx}].ai.rules[${ai}].d=Number(this.value);" />
                  <button type="button" class="btn small danger" onclick="editRulebookData.meters[${idx}].ai.rules.splice(${ai},1);renderMetersSection();">✕</button>
                </div>
              `).join("")}
            </div>
            <div><button type="button" class="btn small" onclick="addMeterAiRule(${idx})">+ AI Kuralı Ekle</button></div>
          ` : ''}
        </div>

        <!-- 2. Tetikleyiciler (Yapay Zekâsız / No AI) -->
        <div class="rbe-switch-card">
          <div class="rbe-switch-row">
            <div class="rbe-switch-info">
              <div class="rbe-switch-title">Tetikleyiciler <span class="tag">Yapay Zekâsız</span></div>
              <div class="rbe-switch-desc">Diğer göstergeler (ör. Saat = Pazartesi) belirli bir değere ulaşınca bu göstergeyi otomatik değiştirir.</div>
            </div>
            <label class="sw-toggle"><input type="checkbox" ${trigs.length > 0 ? 'checked' : ''} onchange="if(this.checked){addMeterTrigger(${idx});}else{editRulebookData.meters[${idx}].triggers=[];renderMetersSection();}" /><span class="sw-slider"></span></label>
          </div>
          ${trigs.length > 0 ? `
            <div class="rbe-meter-stack">
              ${trigs.map((tr, ti) => {
                const cond = (tr.when && tr.when[0]) ? tr.when[0] : { m: m.id, op: ">=", v: 0 };
                const refM = meters.find(x => x.id === cond.m) || meters[0];
                const isClk = refM && canonMeterType(refM.type) === "clock";
                const doVal = (tr.do && tr.do.set !== undefined) ? tr.do.set : (tr.do ? tr.do.d : 0);
                const isSet = tr.do && tr.do.set !== undefined;
                return `
                  <div class="comb-cond-row">
                    <div class="dyn-row">
                      <select onchange="editRulebookData.meters[${idx}].triggers[${ti}].when[0].m=this.value;renderMetersSection();">
                        ${meters.map(om => `<option value="${escapeHtml(om.id)}" ${om.id===cond.m?'selected':''}>${escapeHtml(getMeterName(om))}</option>`).join("")}
                      </select>
                      <select style="max-width:130px;" onchange="editRulebookData.meters[${idx}].triggers[${ti}].when[0].op=this.value;if(this.value==='weekday'&&!editRulebookData.meters[${idx}].triggers[${ti}].when[0].days)editRulebookData.meters[${idx}].triggers[${ti}].when[0].days=[1];renderMetersSection();">
                        ${isClk ? `<option value="weekday" ${cond.op==='weekday'?'selected':''}>Haftanın Günü</option>` : ''}
                        <option value=">=" ${cond.op==='>='?'selected':''}>&gt;=</option>
                        <option value="<=" ${cond.op==='<='?'selected':''}>&lt;=</option>
                        <option value="==" ${cond.op==='=='?'selected':''}>==</option>
                        <option value=">" ${cond.op==='>'?'selected':''}>&gt;</option>
                        <option value="<" ${cond.op==='<'?'selected':''}>&lt;</option>
                      </select>
                      ${cond.op === "weekday" ? '' : `<input type="text" style="max-width:95px;" value="${escapeHtml(cond.v ?? 0)}" onchange="editRulebookData.meters[${idx}].triggers[${ti}].when[0].v=isNaN(this.value)?this.value:Number(this.value);" />`}
                      <span class="muted">→</span>
                      <select style="max-width:90px;" onchange="if(this.value==='set')editRulebookData.meters[${idx}].triggers[${ti}].do={set:0};else editRulebookData.meters[${idx}].triggers[${ti}].do={d:10};renderMetersSection();">
                        <option value="add" ${!isSet?'selected':''}>Ekle (+/-)</option>
                        <option value="set" ${isSet?'selected':''}>Sabitle</option>
                      </select>
                      <input type="number" style="max-width:95px;" value="${doVal}" onchange="if(editRulebookData.meters[${idx}].triggers[${ti}].do.set!==undefined)editRulebookData.meters[${idx}].triggers[${ti}].do.set=Number(this.value);else editRulebookData.meters[${idx}].triggers[${ti}].do.d=Number(this.value);" />
                      <button type="button" class="btn small danger" onclick="editRulebookData.meters[${idx}].triggers.splice(${ti},1);renderMetersSection();">✕</button>
                    </div>
                    ${cond.op === "weekday" ? `
                      <div class="wd-pills">
                        ${WD_LIST.map(wd => {
                          const on = (cond.days || []).includes(wd.id);
                          return `<button type="button" class="wd-btn ${on?'active':''}" onclick="toggleTriggerWeekday(${idx},${ti},${wd.id})">${wd.lbl}</button>`;
                        }).join("")}
                      </div>` : ''}
                  </div>`;
              }).join("")}
            </div>
            <div><button type="button" class="btn small" onclick="addMeterTrigger(${idx})">+ Tetikleyici Ekle</button></div>
          ` : ''}
        </div>

        <!-- 3. Anahtar Kelimeler (Keywords) -->
        <div class="rbe-switch-card">
          <div class="rbe-switch-row">
            <div class="rbe-switch-info">
              <div class="rbe-switch-title">Anahtar Kelimeler</div>
              <div class="rbe-switch-desc">Mesajda belirli kelimeler geçtiğinde göstergeyi kesin ve ücretsiz biçimde değiştirir.</div>
            </div>
            <button type="button" class="btn small" onclick="addMeterKeyword(${idx})">+ Ekle</button>
          </div>
          ${kws.length ? `
            <div class="rbe-meter-stack">
              ${kws.map((kw, ki) => `
                <div class="dyn-row">
                  <input type="text" style="flex:2;" placeholder="Kelimeler (virgülle: gol, asist)" value="${escapeHtml(kw.words || kw.keys || '')}" onchange="editRulebookData.meters[${idx}].keywords[${ki}].words=this.value;" />
                  <select style="max-width:95px;" onchange="editRulebookData.meters[${idx}].keywords[${ki}].op=this.value;">
                    <option value="add" ${(kw.op||'add')==='add'?'selected':''}>Ekle (+/-)</option>
                    <option value="set" ${kw.op==='set'?'selected':''}>Sabitle (=)</option>
                  </select>
                  <input type="text" style="max-width:85px;" value="${escapeHtml(kw.d ?? kw.value ?? 5)}" onchange="editRulebookData.meters[${idx}].keywords[${ki}].d=isNaN(this.value)?this.value:Number(this.value);" />
                  <button type="button" class="btn small danger" onclick="editRulebookData.meters[${idx}].keywords.splice(${ki},1);renderMetersSection();">✕</button>
                </div>
              `).join("")}
            </div>` : ''}
        </div>

        <!-- 4. Azalma / Zamanla Değişim (Decay) -->
        ${(t === "bar" || t === "pips" || t === "number") ? `
        <div class="rbe-switch-card">
          <div class="rbe-switch-row">
            <div class="rbe-switch-info">
              <div class="rbe-switch-title">Zamanla Değişim · isteğe bağlı</div>
              <div class="rbe-switch-desc">Sessiz turlarda göstergeyi otomatik olarak belirli miktarda kaydırır.</div>
            </div>
            <label class="sw-toggle"><input type="checkbox" ${decayOn ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].decay=(this.checked?-1:0);editRulebookData.meters[${idx}].decay_every=(this.checked?4:1);renderMetersSection();" /><span class="sw-slider"></span></label>
          </div>
          ${decayOn ? `
            <div class="dyn-row">
              <label style="margin:0;">Değişim Miktarı (ör. -2 veya +4) <input type="number" value="${m.decay ?? -1}" onchange="editRulebookData.meters[${idx}].decay=Number(this.value);" /></label>
              <label style="margin:0;">Kaç Turda Bir <input type="number" min="1" value="${m.decay_every ?? 1}" onchange="editRulebookData.meters[${idx}].decay_every=Number(this.value);" /></label>
            </div>` : ''}
        </div>` : ''}
      </div>`;
  }

  // İkon & Renk açılır panelleri
  const iconGridHtml = showIconPicker ? `
    <div class="icon-picker-grid">
      ${Object.keys(METER_ICONS).map(ik => `
        <button type="button" class="icon-pick-btn c-${col} ${ik === ic ? 'selected' : ''}" title="${ik}" onclick="editRulebookData.meters[${idx}].icon='${ik}';showIconPicker=false;renderAllRulebookViews();">
          ${METER_ICONS[ik]}
        </button>
      `).join("")}
    </div>` : '';

  const colorGridHtml = showColorPicker ? `
    <div class="color-picker-row">
      ${METER_COLORS.map(ck => `
        <button type="button" class="color-dot-btn c-${ck} ${ck === col ? 'selected' : ''}" title="${ck}" onclick="editRulebookData.meters[${idx}].color='${ck}';showColorPicker=false;renderAllRulebookViews();"></button>
      `).join("")}
    </div>` : '';

  listEl.innerHTML = `
    <div class="rbe-cfg-head">
      <span class="rbe-cfg-kicker">YAPILANDIR · ${escapeHtml(m.id)}</span>
      <div style="display:flex;gap:8px;">
        <button type="button" class="btn small danger" onclick="deleteMeterAt(${idx})">Sil</button>
        <button type="button" class="btn small primary" onclick="selectMeterForConfig(null)">Bitti</button>
      </div>
    </div>

    <!-- 9 TÜR KARTI -->
    <div class="rbe-cfg-section">
      <div class="rbe-cfg-label">Tür <span class="rbe-cfg-sub">Göstergenin nasıl çalışacağını ve görüneceğini seçin.</span></div>
      <div class="rbe-type-grid">
        ${METER_TYPE_CARDS.map(tc => `
          <button type="button" class="rbe-type-card ${t === tc.type ? 'selected' : ''}" onclick="changeMeterType(${idx}, '${tc.type}')">
            <div class="rbe-tc-name">${tc.name}</div>
            <div class="rbe-tc-sub">${tc.sub}</div>
            <div class="rbe-tc-prev">${tc.prev}</div>
          </button>
        `).join("")}
      </div>
    </div>

    <!-- AD & ID -->
    <div class="rbe-cfg-section">
      <div class="row-2">
        <label style="margin:0;">Ad *
          <input type="text" value="${escapeHtml(m.name || '')}" placeholder="Yeni gösterge" oninput="editRulebookData.meters[${idx}].name=this.value;renderRulebookHealth();renderModelSees();" />
        </label>
        <label style="margin:0;">Kimlik (ID)
          <input type="text" value="${escapeHtml(m.id || '')}" onchange="editRulebookData.meters[${idx}].id=this.value.trim()||'m${idx+1}';resetPlaytestState();" />
        </label>
      </div>
      ${!String(m.name || '').trim() ? `<div class="rbe-err-txt">Bu göstergeye bir ad verin</div>` : ''}
    </div>

    <!-- DEĞERLENDİRME (EVALUATES) -->
    <div class="rbe-cfg-section">
      <span class="rbe-cfg-label">Değerlendirme Kapsamı</span>
      <div class="seg-group">
        <button type="button" class="seg-btn ${(m.evaluates||'all')==='all'?'active':''}" onclick="editRulebookData.meters[${idx}].evaluates='all';renderMetersSection();">Tüm mesajlar</button>
        <button type="button" class="seg-btn ${m.evaluates==='user'?'active':''}" onclick="editRulebookData.meters[${idx}].evaluates='user';renderMetersSection();">Kullanıcı mesajları</button>
        <button type="button" class="seg-btn ${m.evaluates==='bot'?'active':''}" onclick="editRulebookData.meters[${idx}].evaluates='bot';renderMetersSection();">Bot mesajları</button>
      </div>
      <div class="rbe-cfg-sub">Anahtar kelimeler ve yapay zekâ değerlendirmesi seçilen mesajlara bakar.</div>
    </div>

    <!-- İMGE, RENK VE ÖZEL GÖRSEL SEÇİCİ -->
    <div class="rbe-cfg-section">
      <div class="rbe-cfg-label">Gösterge İmgesi & Rengi <span class="rbe-cfg-sub">Sohbet ekranındaki HUD çubuğunda görünür</span></div>
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;">
        <div>
          <div class="rbe-cfg-sub" style="margin-bottom:4px;">İmge (İkon)</div>
          <button type="button" class="icon-pick-btn c-${col} selected" onclick="showIconPicker=!showIconPicker;showColorPicker=false;renderMetersSection();" title="İmge seç">
            ${METER_ICONS[ic] || METER_ICONS.shield}
          </button>
        </div>
        <div>
          <div class="rbe-cfg-sub" style="margin-bottom:4px;">Renk</div>
          <button type="button" class="color-dot-btn c-${col} selected" style="width:30px;height:30px;" onclick="showColorPicker=!showColorPicker;showIconPicker=false;renderMetersSection();" title="Renk seç"></button>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div class="rbe-cfg-sub">Özel Görsel (isteğe bağlı)</div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${m.image_url ? `<img src="${escapeHtml(m.image_url)}" class="meter-cfg-thumb" alt="" />` : ''}
            <label class="btn small" style="margin:0;cursor:pointer;">
              ↑ Görsel Seç
              <input type="file" accept="image/*" onchange="uploadMeterImage(this, ${idx}, 'meter')" hidden />
            </label>
            ${m.image_url ? `<button type="button" class="btn small danger" onclick="editRulebookData.meters[${idx}].image_url='';renderAllRulebookViews();">Kaldır</button>` : ''}
          </div>
        </div>
      </div>
      ${iconGridHtml}
      ${colorGridHtml}
    </div>

    ${typeSpecificHtml}

    <!-- MODELE DEĞERİ BİLDİR -->
    <div class="rbe-switch-card rbe-cfg-section">
      <div class="rbe-switch-row">
        <div class="rbe-switch-info">
          <div class="rbe-switch-title">Modele değeri bildir</div>
          <div class="rbe-switch-desc">Her turda sistem talimatına bu göstergenin güncel değerini ekler.</div>
        </div>
        <label class="sw-toggle"><input type="checkbox" ${m.tellModel !== false ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].tellModel=this.checked;renderModelSees();" /><span class="sw-slider"></span></label>
      </div>
    </div>

    <!-- GÖRÜNÜRLÜK (SHOWN / PANEL ONLY / HIDDEN) -->
    <div class="rbe-cfg-section">
      <span class="rbe-cfg-label">Görünürlük</span>
      <div class="seg-group">
        <button type="button" class="seg-btn ${vis==='shown'?'active':''}" onclick="setMeterVisibility(${idx},'shown')">Göster</button>
        <button type="button" class="seg-btn ${vis==='panel'?'active':''}" onclick="setMeterVisibility(${idx},'panel')">Sadece Panel</button>
        <button type="button" class="seg-btn ${vis==='hidden'?'active':''}" onclick="setMeterVisibility(${idx},'hidden')">Gizli</button>
      </div>
      <div class="rbe-cfg-sub">8 görünür göstergeden ${shownCount} tanesi kullanılıyor. Gizli göstergeler yine de etki kurallarını çalıştırır; kullanıcılar değerini görmez.</div>
    </div>

    <!-- OYUNCULAR BU DEĞERİ DEĞİŞTİREBİLİR -->
    <div class="rbe-switch-card rbe-cfg-section">
      <div class="rbe-switch-row">
        <div class="rbe-switch-info">
          <div class="rbe-switch-title">Oyuncular bu değeri değiştirebilir</div>
          <div class="rbe-switch-desc">Oyuncular sohbet içinden bu göstergeyi elle değiştirebilir. Sonraki yanıt yeni değerden devam eder.</div>
        </div>
        <label class="sw-toggle"><input type="checkbox" ${m.userEditable !== false ? 'checked' : ''} onchange="editRulebookData.meters[${idx}].userEditable=this.checked;" /><span class="sw-slider"></span></label>
      </div>
    </div>

    <!-- KULLANICILARA NE GÖSTERİLİR (RAISES / LOWERS) -->
    <div class="rbe-subbox rbe-cfg-section">
      <div class="rbe-cfg-label">Kullanıcılara ne gösterilir</div>
      <div class="rbe-cfg-sub">Sohbetteki "bu göstergeleri ne hareket ettirir" bilgisinde gösterilir. Her satıra bir madde yazın.</div>
      <label style="margin:0;">Artıranlar
        <textarea rows="2" placeholder="Örn: Maçta gol atmak, iyi performans göstermek" onchange="editRulebookData.meters[${idx}].raises=this.value.split('\n').map(x=>x.trim()).filter(Boolean);">${escapeHtml((m.raises || []).join('\n'))}</textarea>
      </label>
      <label style="margin:0;">Azaltanlar
        <textarea rows="2" placeholder="Örn: Skandala karışmak, kaba davranmak" onchange="editRulebookData.meters[${idx}].lowers=this.value.split('\n').map(x=>x.trim()).filter(Boolean);">${escapeHtml((m.lowers || []).join('\n'))}</textarea>
      </label>
    </div>

    ${howItMovesHtml}

    <!-- KULLANILDIĞI YERLER (USED IN) -->
    <div class="rbe-cfg-section" style="padding-top:10px;border-top:1px solid var(--border);">
      <div class="rbe-cfg-kicker">KULLANILDIĞI YERLER</div>
      <div class="rbe-cfg-sub">${usedIn.length ? escapeHtml(usedIn.join(' · ')) : 'Henüz başka bir gösterge veya birleşik kuralda kullanılmıyor.'}</div>
      ${!meterHasDriver(m) ? `<div class="rbe-warn-txt">Bu göstergenin anahtar kelimesi, AI kuralı veya azalma ayarı yok.</div>` : ''}
    </div>
  `;
}

function renameSelectOption(mIdx, oIdx, newVal) {
  const m = editRulebookData.meters[mIdx];
  const oldVal = m.options[oIdx];
  const nv = newVal.trim() || oldVal;
  m.options[oIdx] = nv;
  if (m.option_instructions && m.option_instructions[oldVal] !== undefined) {
    m.option_instructions[nv] = m.option_instructions[oldVal];
    if (nv !== oldVal) delete m.option_instructions[oldVal];
  }
  if (m.option_captions && m.option_captions[oldVal] !== undefined) {
    m.option_captions[nv] = m.option_captions[oldVal];
    if (nv !== oldVal) delete m.option_captions[oldVal];
  }
  if (m.default === oldVal) m.default = nv;
  resetPlaytestState();
}

function syncCollectionDefaults(mIdx) {
  const m = editRulebookData.meters[mIdx];
  m.default = (m.items || []).filter(it => (it.start ?? 0) > 0).map(it => it.label);
  resetPlaytestState();
}

function toggleTriggerWeekday(mIdx, tIdx, wdId) {
  const cond = editRulebookData.meters[mIdx].triggers[tIdx].when[0];
  if (!Array.isArray(cond.days)) cond.days = [];
  const i = cond.days.indexOf(wdId);
  if (i >= 0) cond.days.splice(i, 1);
  else cond.days.push(wdId);
  renderMetersSection();
}

// =========================================================================
// SEKME 3: ETKİ KURALLARI (INFLUENCE RULES + COMBINED RULES) — Görsel 2 ile birebir!
// =========================================================================
function selectInfBand(mIdx, bIdx) {
  selectedInfBand[mIdx] = (selectedInfBand[mIdx] === bIdx) ? null : bIdx;
  renderInfluenceRules();
}

function splitMeterBand(mIdx, bIdx) {
  const m = editRulebookData.meters[mIdx];
  const t = canonMeterType(m.type);
  if (t === "clock") {
    const arr = m.todBands || [];
    const prevTo = bIdx > 0 ? Number(arr[bIdx - 1].to) : -1;
    const curTo = Number(arr[bIdx].to ?? 1439);
    const mid = Math.floor((prevTo + curTo) / 2);
    if (mid <= prevTo) return;
    arr.splice(bIdx + 1, 0, { label: "Yeni Dilim", to: curTo, instr: "", caption: "", revealed: true, override: false });
    arr[bIdx].to = mid;
    selectedInfBand[mIdx] = bIdx + 1;
  } else {
    const arr = m.levels || [];
    const cur = arr[bIdx];
    const mn = Number(cur.min ?? 0);
    const mx = cur.openEnd ? (mn + 100) : Number(cur.max ?? 100);
    const mid = Math.floor((mn + mx) / 2);
    const nextMin = mid + (m.decimals ? 0.01 : 1);
    const newBand = {
      min: nextMin, max: cur.max, openEnd: Boolean(cur.openEnd),
      label: "Yeni Seviye", instruction: "", caption: "", revealed: true, override: false
    };
    cur.max = mid;
    cur.openEnd = false;
    arr.splice(bIdx + 1, 0, newBand);
    selectedInfBand[mIdx] = bIdx + 1;
  }
  renderAllRulebookViews();
}

function addMeterBand(mIdx) {
  const m = editRulebookData.meters[mIdx];
  if (!Array.isArray(m.levels)) m.levels = [];
  const last = m.levels[m.levels.length - 1];
  const mn = last ? (Number(last.max ?? 0) + 1) : (m.min ?? 0);
  const mx = (m.max !== undefined && m.max !== null) ? Number(m.max) : (mn + 50);
  m.levels.push({ min: mn, max: mx, openEnd: m.type === "number", label: "Yeni Seviye", instruction: "", caption: "", revealed: true, override: false });
  selectedInfBand[mIdx] = m.levels.length - 1;
  renderAllRulebookViews();
}

function insertMacroToInput(elId, macro) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  el.value = el.value.slice(0, start) + macro + el.value.slice(end);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}

function renderInfluenceRules() {
  const infBox = document.getElementById("rbe-influence-levels");
  const combBox = document.getElementById("rbe-combined-rules");
  const extraBox = document.getElementById("rb-extra-rules-list");
  if (!infBox) return;
  const meters = editRulebookData.meters || [];

  infBox.innerHTML = meters.map((m, mIdx) => {
    const mid = m.id || m.name;
    const t = canonMeterType(m.type);
    const col = getMeterColor(m);
    const ic = getMeterIcon(m);
    const ptVal = playtestState.meters[mid] ?? m.default ?? 0;

    // 1. STORY CLOCK (Tarih ve Saat — todBands + ruleDims)
    if (t === "clock") {
      const dims = m.ruleDims || ["tod"];
      const bands = m.todBands || [];
      const p = parseClockParts(playtestState.clock);
      const curTod = ((p.h * 60 + p.mn) - 360 + 1440) % 1440;
      const selIdx = selectedInfBand[mIdx];

      let prevMin = 0;
      const segsHtml = `<div class="inf-seg-bar">` + bands.map((b, bIdx) => {
        const bTo = Number(b.to ?? 1439);
        const isAct = curTod >= prevMin && curTod <= bTo;
        const rangeLbl = `${formatMinutesFrom6am(prevMin)}–${formatMinutesFrom6am(bTo)}`;
        const flexW = Math.max(1, bTo - prevMin);
        prevMin = bTo + 1;
        return `
          <div class="inf-seg ${(isAct || selIdx === bIdx) ? 'active-band' : ''}" style="flex:${flexW};" onclick="selectInfBand(${mIdx}, ${bIdx})">
            <div class="inf-seg-title">${escapeHtml(b.label || 'Dilim')}</div>
            <div class="inf-seg-range">${rangeLbl}</div>
          </div>`;
      }).join("") + `</div>`;

      let edHtml = "";
      if (selIdx !== undefined && selIdx !== null && bands[selIdx]) {
        const b = bands[selIdx];
        const taId = `inf-clk-ta-${mIdx}-${selIdx}`;
        edHtml = `
          <div class="inf-editor-box">
            <div class="dyn-row">
              <label style="margin:0;flex:1;">Zaman Dilimi Adı <input type="text" value="${escapeHtml(b.label || '')}" oninput="editRulebookData.meters[${mIdx}].todBands[${selIdx}].label=this.value;renderModelSees();" /></label>
              <label style="margin:0;max-width:130px;">Bitiş (06:00'dan dk) <input type="number" min="0" max="1439" value="${b.to ?? 1439}" onchange="editRulebookData.meters[${mIdx}].todBands[${selIdx}].to=Number(this.value);renderAllRulebookViews();" /></label>
              <button type="button" class="btn small" onclick="splitMeterBand(${mIdx}, ${selIdx})">Dilimi Böl</button>
              <button type="button" class="btn small danger" onclick="editRulebookData.meters[${mIdx}].todBands.splice(${selIdx},1);selectedInfBand[${mIdx}]=null;renderAllRulebookViews();">Sil</button>
            </div>
            <div>
              <div class="sub-header" style="margin-bottom:4px;">
                <span class="rbe-cfg-sub">Modele Talimat (aktif dilimde sistem mesajına eklenir)</span>
                <div class="rbe-macro-row">
                  <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{user}}')">{{user}}</button>
                  <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{char}}')">{{char}}</button>
                </div>
              </div>
              <textarea id="${taId}" rows="2" style="width:100%;" oninput="editRulebookData.meters[${mIdx}].todBands[${selIdx}].instr=this.value;renderModelSees();">${escapeHtml(b.instr || '')}</textarea>
            </div>
            <label style="margin:0;">Kullanıcı Durum Satırı (opsiyonel)
              <input type="text" value="${escapeHtml(b.caption || '')}" oninput="editRulebookData.meters[${mIdx}].todBands[${selIdx}].caption=this.value;renderModelSees();" />
            </label>
          </div>`;
      }

      return `
        <div class="inf-meter-card c-${col}">
          <div class="inf-meter-head">
            <div style="display:flex;align-items:center;gap:8px;">
              ${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}
              <b>${escapeHtml(getMeterName(m))}</b>
              <span class="muted small-text">06:00'dan başlar · +${m.stepMin ?? 3} dk/mesaj</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" class="btn small ${dims.includes('tod')?'primary':''}" onclick="toggleClockDim(${mIdx},'tod')">✓ Günün Saati</button>
              <button type="button" class="btn small ${dims.includes('day')?'primary':''}" onclick="toggleClockDim(${mIdx},'day')">Hikâye Günü</button>
              <span class="small-text muted">Test: <b>${String(p.h).padStart(2,'0')}:${String(p.mn).padStart(2,'0')}</b></span>
            </div>
          </div>
          ${dims.includes('tod') ? segsHtml + edHtml : '<div class="muted small-text">Günün Saati kuralları kapalı.</div>'}
        </div>`;
    }

    // 2. BAR / PIPS / NUMBER / DICE (Seviyeli göstergeler)
    if (t === "bar" || t === "pips" || t === "number" || t === "dice") {
      const levels = m.levels || [];
      const selIdx = selectedInfBand[mIdx];
      const segsHtml = levels.length ? `<div class="inf-seg-bar">` + levels.map((lv, bIdx) => {
        const isAct = Number(ptVal) >= Number(lv.min ?? -1e12) && Number(ptVal) <= Number(lv.max ?? 1e12);
        const rTxt = (lv.openEnd || Number(lv.max) >= 99999999) ? `${lv.min}+` : `${lv.min}–${lv.max}`;
        return `
          <div class="inf-seg ${(isAct || selIdx === bIdx) ? 'active-band' : ''}" style="flex:1;" onclick="selectInfBand(${mIdx}, ${bIdx})" title="${escapeHtml(lv.label)} (${rTxt})">
            <div class="inf-seg-title">${escapeHtml(lv.label || 'Seviye')}</div>
            <div class="inf-seg-range">${rTxt}${!String(lv.instruction||'').trim()?' · talimat yok':''}</div>
          </div>`;
      }).join("") + `</div>` : `<div class="muted small-text" style="padding:8px;">Henüz seviye yok.</div>`;

      let edHtml = "";
      if (selIdx !== undefined && selIdx !== null && levels[selIdx]) {
        const lv = levels[selIdx];
        const taId = `inf-lvl-ta-${mIdx}-${selIdx}`;
        edHtml = `
          <div class="inf-editor-box">
            <div class="dyn-row">
              <label style="margin:0;flex:1.2;">Seviye Adı <input type="text" value="${escapeHtml(lv.label || '')}" oninput="editRulebookData.meters[${mIdx}].levels[${selIdx}].label=this.value;renderModelSees();" /></label>
              <label style="margin:0;max-width:110px;">Min <input type="number" value="${lv.min ?? 0}" onchange="editRulebookData.meters[${mIdx}].levels[${selIdx}].min=Number(this.value);renderAllRulebookViews();" /></label>
              <label style="margin:0;max-width:120px;">Max (boş=sınırsız) <input type="text" value="${(lv.openEnd || lv.max >= 99999999) ? '' : (lv.max ?? 100)}" placeholder="sınırsız" onchange="if(this.value.trim()===''){editRulebookData.meters[${mIdx}].levels[${selIdx}].openEnd=true;editRulebookData.meters[${mIdx}].levels[${selIdx}].max=999999999;}else{editRulebookData.meters[${mIdx}].levels[${selIdx}].openEnd=false;editRulebookData.meters[${mIdx}].levels[${selIdx}].max=Number(this.value);}renderAllRulebookViews();" /></label>
              <button type="button" class="btn small" onclick="splitMeterBand(${mIdx}, ${selIdx})">Seviyeyi Böl</button>
              <button type="button" class="btn small danger" onclick="editRulebookData.meters[${mIdx}].levels.splice(${selIdx},1);selectedInfBand[${mIdx}]=null;renderAllRulebookViews();">Seviyeyi Sil</button>
            </div>
            <div>
              <div class="sub-header" style="margin-bottom:4px;">
                <span class="rbe-cfg-sub">Modele Talimat (bu aralıkta sistem mesajına eklenir)</span>
                <div class="rbe-macro-row">
                  <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{user}}')">{{user}}</button>
                  <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{char}}')">{{char}}</button>
                </div>
              </div>
              <textarea id="${taId}" rows="2" style="width:100%;" placeholder="Örn: {{user}} bu seviyede nasıl davranır / çevresi nasıl tepki verir?" oninput="editRulebookData.meters[${mIdx}].levels[${selIdx}].instruction=this.value;renderModelSees();">${escapeHtml(lv.instruction || '')}</textarea>
            </div>
            <label style="margin:0;">Kullanıcı Durum Satırı (opsiyonel)
              <input type="text" value="${escapeHtml(lv.caption || '')}" placeholder="Örn: İlk 11 oyuncusu" oninput="editRulebookData.meters[${mIdx}].levels[${selIdx}].caption=this.value;renderModelSees();" />
            </label>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="rbe-cfg-sub">Bu Seviyeye Özel İmge / Görsel:</span>
              ${lv.image_url ? `<img src="${escapeHtml(lv.image_url)}" class="meter-cfg-thumb" alt="" />` : ''}
              <label class="btn small" style="margin:0;cursor:pointer;">↑ Görsel Yükle<input type="file" accept="image/*" onchange="uploadMeterImage(this, ${mIdx}, 'level', ${selIdx})" hidden /></label>
              ${lv.image_url ? `<button type="button" class="btn small danger" onclick="editRulebookData.meters[${mIdx}].levels[${selIdx}].image_url='';renderAllRulebookViews();">✕</button>` : ''}
            </div>
            <div class="row-2">
              <div class="rbe-switch-row">
                <span class="rbe-cfg-sub">Kullanıcının seviye listesinde göster</span>
                <label class="sw-toggle"><input type="checkbox" ${lv.revealed !== false ? 'checked' : ''} onchange="editRulebookData.meters[${mIdx}].levels[${selIdx}].revealed=this.checked;" /><span class="sw-slider"></span></label>
              </div>
              <div class="rbe-switch-row">
                <span class="rbe-cfg-sub">Durum satırını devralır (Override)</span>
                <label class="sw-toggle"><input type="checkbox" ${lv.override ? 'checked' : ''} onchange="editRulebookData.meters[${mIdx}].levels[${selIdx}].override=this.checked;renderModelSees();" /><span class="sw-slider"></span></label>
              </div>
            </div>
          </div>`;
      }

      return `
        <div class="inf-meter-card c-${col}">
          <div class="inf-meter-head">
            <div style="display:flex;align-items:center;gap:8px;">
              ${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}
              <b>${escapeHtml(getMeterName(m))}</b>
              <span class="muted small-text">${t==='number'?'Eşikler · üst sınır yok':`${m.min??0}–${m.max??100}`} · ${levels.length} seviye</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="small-text muted">Test: <b>${escapeHtml(ptVal)}${escapeHtml(m.unit || '')}</b></span>
              <button type="button" class="btn small" onclick="addMeterBand(${mIdx})">+ Seviye</button>
            </div>
          </div>
          ${segsHtml}
          ${edHtml}
        </div>`;
    }

    // 3. SELECT (Birini Seç: Lokasyon, İlişki Durumu vb.)
    if (t === "select") {
      const opts = m.options || [];
      if (!m.option_instructions) m.option_instructions = {};
      if (!m.option_captions) m.option_captions = {};
      return `
        <div class="inf-meter-card c-${col}">
          <div class="inf-meter-head">
            <div style="display:flex;align-items:center;gap:8px;">
              ${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}
              <b>${escapeHtml(getMeterName(m))}</b>
              <span class="muted small-text">Seçenek başına bir kural (${opts.length})</span>
            </div>
            <span class="small-text muted">Test: <b>${escapeHtml(ptVal)}</b></span>
          </div>
          ${opts.map((o, oi) => {
            const isAct = (String(ptVal) === String(o));
            const isDef = (String(m.default) === String(o));
            const taId = `inf-sel-ta-${mIdx}-${oi}`;
            return `
              <div class="inf-opt-card ${isAct ? 'active-opt' : ''}">
                <div class="inf-opt-head">
                  <span>${escapeHtml(getMeterName(m))} = <b>${escapeHtml(o)}</b> ${isDef ? '<span class="tag">Başlangıç</span>' : ''}</span>
                  <span class="rbe-vis-badge ${isAct ? 'shown' : ''}" style="${isAct?'color:#4ade80;border-color:#22c55e;':''}">${isAct ? 'Testte aktif' : 'Pasif'}</span>
                </div>
                <div class="sub-header" style="margin:0;">
                  <span class="rbe-cfg-sub">Modele Talimat</span>
                  <div class="rbe-macro-row">
                    <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{user}}')">{{user}}</button>
                    <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{char}}')">{{char}}</button>
                  </div>
                </div>
                <input id="${taId}" type="text" placeholder="Bu seçenek aktifken modele gidecek talimat..." value="${escapeHtml(m.option_instructions[o] || '')}"
                  oninput="setSelectOptProp(${mIdx}, ${oi}, 'instruction', this.value)" />
                <input type="text" placeholder="Kullanıcı durum satırı (opsiyonel)" value="${escapeHtml(m.option_captions[o] || '')}"
                  oninput="setSelectOptProp(${mIdx}, ${oi}, 'caption', this.value)" />
                <div style="display:flex;align-items:center;gap:8px;margin-top:2px;">
                  <span class="rbe-cfg-sub">Seçeneğe Özel Görsel:</span>
                  ${(m.option_images && m.option_images[o]) ? `<img src="${escapeHtml(m.option_images[o])}" class="meter-cfg-thumb" alt="" />` : ''}
                  <label class="btn small" style="margin:0;cursor:pointer;">↑ Görsel<input type="file" accept="image/*" onchange="uploadMeterImage(this, ${mIdx}, 'select', ${oi})" hidden /></label>
                  ${(m.option_images && m.option_images[o]) ? `<button type="button" class="btn small danger" onclick="delete editRulebookData.meters[${mIdx}].option_images[editRulebookData.meters[${mIdx}].options[${oi}]];renderAllRulebookViews();">✕</button>` : ''}
                </div>
              </div>`;
          }).join("")}
        </div>`;
    }

    // 4. COLLECTION / JOURNAL (Koşullu eşya / günlük kuralları)
    if (t === "collection" || t === "journal") {
      if (!Array.isArray(m.rules)) m.rules = [];
      const curItems = t === "collection" ? (playtestState.meters[mid] || []) : (playtestState.journals[mid] || []);
      return `
        <div class="inf-meter-card c-${col}">
          <div class="inf-meter-head">
            <div style="display:flex;align-items:center;gap:8px;">
              ${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}
              <b>${escapeHtml(getMeterName(m))}</b>
              <span class="muted small-text">${t==='collection'?'Eşya koşulları':'Günlük kuralları'}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="small-text muted">Test: <b>${Array.isArray(curItems) ? curItems.length : 0} kayıt</b></span>
              <button type="button" class="btn small" onclick="editRulebookData.meters[${mIdx}].rules.push({op:'has',item:'',instr:'',caption:''});renderAllRulebookViews();">+ Kural Ekle</button>
            </div>
          </div>
          ${m.rules.length ? m.rules.map((cr, ci) => `
            <div class="inf-opt-card">
              <div class="dyn-row">
                <select style="max-width:130px;" onchange="editRulebookData.meters[${mIdx}].rules[${ci}].op=this.value;renderModelSees();">
                  <option value="has" ${(cr.op||'has')==='has'?'selected':''}>Kayıtta varsa</option>
                  <option value="not_has" ${cr.op==='not_has'?'selected':''}>Kayıtta yoksa</option>
                </select>
                <input type="text" placeholder="Eşya / Olay adı" value="${escapeHtml(cr.item || '')}" onchange="editRulebookData.meters[${mIdx}].rules[${ci}].item=this.value;renderModelSees();" />
                <button type="button" class="btn small danger" onclick="editRulebookData.meters[${mIdx}].rules.splice(${ci},1);renderAllRulebookViews();">✕</button>
              </div>
              <input type="text" placeholder="Modele talimat..." value="${escapeHtml(cr.instr || '')}" oninput="editRulebookData.meters[${mIdx}].rules[${ci}].instr=this.value;renderModelSees();" />
            </div>
          `).join("") : '<div class="muted small-text">Henüz kural eklenmedi.</div>'}
        </div>`;
    }

    return "";
  }).join("");

  // --- BİRLEŞİK KURALLAR (COMBINED RULES) ---
  const combs = editRulebookData.combined_rules || [];
  if (!combs.length) {
    combBox.innerHTML = `<div class="muted small-text" style="padding:12px;text-align:center;">Henüz birleşik kural yok. <b>+ Kural Ekle</b> ile birden fazla göstergeye bağlı kurallar (ör. Pazartesi maaş, Sakatlık ≥ 30) oluşturabilirsin.</div>`;
  } else {
    combBox.innerHTML = combs.map((cr, cIdx) => {
      const taId = `comb-ta-${cIdx}`;
      return `
        <div class="comb-card">
          <div class="comb-head">
            <span class="comb-num">${cIdx + 1}</span>
            <input type="text" style="flex:1;" value="${escapeHtml(cr.name || cr.id || '')}" placeholder="Kural başlığı" onchange="editRulebookData.combined_rules[${cIdx}].name=this.value;" />
            <button type="button" class="btn small" onclick="moveCombinedRule(${cIdx},-1)">▲</button>
            <button type="button" class="btn small" onclick="moveCombinedRule(${cIdx},1)">▼</button>
            <button type="button" class="btn small danger" onclick="editRulebookData.combined_rules.splice(${cIdx},1);renderAllRulebookViews();">✕</button>
          </div>
          <div class="rbe-cfg-sub">Bunların tümü doğru olduğunda:</div>
          <div class="rbe-meter-stack">
            ${(cr.conds || []).map((cond, kIdx) => {
              const refM = meters.find(x => x.id === cond.m) || meters[0];
              const rt = refM ? canonMeterType(refM.type) : "bar";
              return `
                <div class="comb-cond-row">
                  <div class="dyn-row">
                    <select onchange="changeCombinedCondMeter(${cIdx},${kIdx},this.value)">
                      ${meters.map(om => `<option value="${escapeHtml(om.id)}" ${om.id===cond.m?'selected':''}>${escapeHtml(getMeterName(om))}</option>`).join("")}
                    </select>
                    <select style="max-width:140px;" onchange="editRulebookData.combined_rules[${cIdx}].conds[${kIdx}].op=this.value;if(this.value==='weekday'&&!editRulebookData.combined_rules[${cIdx}].conds[${kIdx}].days)editRulebookData.combined_rules[${cIdx}].conds[${kIdx}].days=[1];renderAllRulebookViews();">
                      ${rt === "clock" ? `<option value="weekday" ${cond.op==='weekday'?'selected':''}>Haftanın Günü</option>` : ''}
                      ${rt === "select" ? `<option value="is" ${cond.op==='is'||cond.op==='=='?'selected':''}>Seçiliyse</option><option value="not_is" ${cond.op==='not_is'||cond.op==='!='?'selected':''}>Seçili Değilse</option>` : ''}
                      ${rt === "collection" ? `<option value="has" ${cond.op==='has'?'selected':''}>Eşya Varsa</option><option value="not_has" ${cond.op==='not_has'?'selected':''}>Eşya Yoksa</option>` : ''}
                      ${(rt === "bar" || rt === "pips" || rt === "number" || rt === "dice") ? `
                        <option value=">=" ${cond.op==='>='?'selected':''}>&gt;=</option>
                        <option value="<=" ${cond.op==='<='?'selected':''}>&lt;=</option>
                        <option value=">" ${cond.op==='>'?'selected':''}>&gt;</option>
                        <option value="<" ${cond.op==='<'?'selected':''}>&lt;</option>
                        <option value="==" ${cond.op==='=='?'selected':''}>==</option>
                        <option value="!=" ${cond.op==='!='?'selected':''}>!=</option>
                      ` : ''}
                    </select>
                    ${cond.op === "weekday" ? '' : (
                      rt === "select" ? `
                        <select onchange="editRulebookData.combined_rules[${cIdx}].conds[${kIdx}].v=this.value;renderModelSees();">
                          ${(refM.options || []).map(o => `<option value="${escapeHtml(o)}" ${o===cond.v?'selected':''}>${escapeHtml(o)}</option>`).join("")}
                        </select>` :
                        `<input type="text" style="max-width:110px;" value="${escapeHtml(cond.v ?? 0)}" onchange="editRulebookData.combined_rules[${cIdx}].conds[${kIdx}].v=isNaN(this.value)?this.value:Number(this.value);renderModelSees();" />`
                    )}
                    <button type="button" class="btn small danger" onclick="editRulebookData.combined_rules[${cIdx}].conds.splice(${kIdx},1);renderAllRulebookViews();">✕</button>
                  </div>
                  ${cond.op === "weekday" ? `
                    <div class="wd-pills">
                      ${WD_LIST.map(wd => {
                        const on = (cond.days || []).includes(wd.id);
                        return `<button type="button" class="wd-btn ${on?'active':''}" onclick="toggleCombinedWeekday(${cIdx},${kIdx},${wd.id})">${wd.lbl}</button>`;
                      }).join("")}
                    </div>` : ''}
                </div>`;
            }).join("")}
          </div>
          <div><button type="button" class="btn small" onclick="addCombinedCond(${cIdx})">+ Koşul Ekle</button></div>
          <div>
            <div class="sub-header" style="margin-bottom:4px;">
              <span class="rbe-cfg-sub">Modele Talimat</span>
              <div class="rbe-macro-row">
                <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{user}}')">{{user}}</button>
                <button type="button" class="macro-chip" onclick="insertMacroToInput('${taId}','{{char}}')">{{char}}</button>
              </div>
            </div>
            <textarea id="${taId}" rows="2" style="width:100%;" oninput="editRulebookData.combined_rules[${cIdx}].instr=this.value;renderModelSees();">${escapeHtml(cr.instr || '')}</textarea>
          </div>
          <label style="margin:0;">Kullanıcı Durum Satırı
            <input type="text" value="${escapeHtml(cr.caption || '')}" placeholder="Örn: Haftalık maaş yattı" oninput="editRulebookData.combined_rules[${cIdx}].caption=this.value;renderModelSees();" />
          </label>
        </div>`;
    }).join("");
  }

  // --- EK RASTGELE OLAYLAR ---
  const extras = editRulebookData.rules || [];
  if (!extras.length) {
    extraBox.innerHTML = `<div class="muted small-text" style="padding:10px;">Henüz rastgele olay yok.</div>`;
  } else {
    extraBox.innerHTML = extras.map((r, i) => `
      <div class="dyn-card">
        <div class="dyn-row">
          <input type="text" placeholder="Olay adı" value="${escapeHtml(r.name || '')}" onchange="editRulebookData.rules[${i}].name=this.value;" />
          <input type="number" style="max-width:90px;" min="1" max="100" title="Şans %" value="${r.chance ?? 15}" onchange="editRulebookData.rules[${i}].chance=Number(this.value);" />
          <span class="muted small-text">% şans</span>
          <button type="button" class="btn small danger" onclick="editRulebookData.rules.splice(${i},1);renderAllRulebookViews();">Sil</button>
        </div>
        <input type="text" placeholder="Olay gerçekleştiğinde modele gidecek talimat..." value="${escapeHtml(r.instruction || '')}" onchange="editRulebookData.rules[${i}].instruction=this.value;" />
      </div>
    `).join("");
  }
}

function toggleClockDim(mIdx, dim) {
  const m = editRulebookData.meters[mIdx];
  if (!Array.isArray(m.ruleDims)) m.ruleDims = ["tod"];
  const i = m.ruleDims.indexOf(dim);
  if (i >= 0) m.ruleDims.splice(i, 1);
  else m.ruleDims.push(dim);
  renderAllRulebookViews();
}

function setSelectOptProp(mIdx, oIdx, field, val) {
  const m = editRulebookData.meters[mIdx];
  const opt = (m.options || [])[oIdx];
  if (!opt) return;
  if (field === "instruction") {
    if (!m.option_instructions) m.option_instructions = {};
    m.option_instructions[opt] = val;
  } else {
    if (!m.option_captions) m.option_captions = {};
    m.option_captions[opt] = val;
  }
  renderModelSees();
}

function addCombinedRule() {
  if (!Array.isArray(editRulebookData.combined_rules)) editRulebookData.combined_rules = [];
  const fm = (editRulebookData.meters || [])[0];
  const ft = fm ? canonMeterType(fm.type) : "bar";
  const defCond = !fm ? { m: "", op: ">=", v: 50 }
    : (ft === "clock" ? { m: fm.id, op: "weekday", days: [1] }
      : (ft === "select" ? { m: fm.id, op: "is", v: (fm.options?.[0] || "") }
        : { m: fm.id, op: ">=", v: 50 }));
  editRulebookData.combined_rules.push({
    id: "birlesik_" + (editRulebookData.combined_rules.length + 1),
    name: "Yeni Birleşik Kural",
    conds: [defCond],
    instr: "",
    caption: ""
  });
  renderAllRulebookViews();
}

function moveCombinedRule(idx, dir) {
  const arr = editRulebookData.combined_rules || [];
  const t = idx + dir;
  if (t < 0 || t >= arr.length) return;
  [arr[idx], arr[t]] = [arr[t], arr[idx]];
  renderAllRulebookViews();
}

function addCombinedCond(cIdx) {
  const fm = (editRulebookData.meters || [])[0];
  editRulebookData.combined_rules[cIdx].conds.push({ m: fm ? fm.id : "", op: ">=", v: 30 });
  renderAllRulebookViews();
}

function changeCombinedCondMeter(cIdx, kIdx, newMid) {
  const cond = editRulebookData.combined_rules[cIdx].conds[kIdx];
  cond.m = newMid;
  const refM = (editRulebookData.meters || []).find(x => x.id === newMid);
  const rt = refM ? canonMeterType(refM.type) : "bar";
  if (rt === "clock") { cond.op = "weekday"; cond.days = [1]; }
  else if (rt === "select") { cond.op = "is"; cond.v = (refM.options?.[0] || ""); }
  else if (rt === "collection") { cond.op = "has"; cond.v = ""; }
  else { cond.op = ">="; cond.v = 30; }
  renderAllRulebookViews();
}

function toggleCombinedWeekday(cIdx, kIdx, wdId) {
  const cond = editRulebookData.combined_rules[cIdx].conds[kIdx];
  if (!Array.isArray(cond.days)) cond.days = [];
  const i = cond.days.indexOf(wdId);
  if (i >= 0) cond.days.splice(i, 1);
  else cond.days.push(wdId);
  renderAllRulebookViews();
}

function addExtraRuleRow() {
  if (!Array.isArray(editRulebookData.rules)) editRulebookData.rules = [];
  editRulebookData.rules.push({ name: "Sürpriz Olay", type: "random", chance: 15, instruction: "", enabled: true });
  renderAllRulebookViews();
}

// =========================================================================
// SAĞ PANEL: MODELİN GÖRDÜĞÜ + CANLI TEST (PLAYTEST + SOHBET SİMÜLASYONU)
// =========================================================================
function evalPlaytestCond(cond) {
  const meters = editRulebookData.meters || [];
  const m = meters.find(x => x.id === cond.m);
  if (!m) return false;
  const t = canonMeterType(m.type);
  if (cond.op === "weekday" || t === "clock") {
    const p = parseClockParts(playtestState.clock);
    const dt = new Date(p.y, p.mo - 1, p.d, p.h, p.mn);
    if (cond.op === "weekday") return (cond.days || []).includes(dt.getDay());
    return false;
  }
  const cur = playtestState.meters[m.id];
  if (t === "collection") {
    const arr = Array.isArray(cur) ? cur : [];
    const has = arr.some(x => String(x).toLowerCase().includes(String(cond.v || "").toLowerCase()));
    return cond.op === "not_has" ? !has : has;
  }
  if (cond.op === "is" || cond.op === "==") return String(cur) === String(cond.v);
  if (cond.op === "not_is" || cond.op === "!=") return String(cur) !== String(cond.v);
  const a = Number(cur), b = Number(cond.v);
  if (cond.op === ">=") return a >= b;
  if (cond.op === "<=") return a <= b;
  if (cond.op === ">") return a > b;
  if (cond.op === "<") return a < b;
  return false;
}

function computeModelSeesEntries() {
  const entries = [];
  const captions = [];
  const overrides = [];

  for (const m of (editRulebookData.meters || [])) {
    const mid = m.id || m.name;
    const t = canonMeterType(m.type);
    const col = getMeterColor(m);

    if (t === "clock") {
      if (m.tellModel !== false) {
        entries.push({ label: getMeterName(m), color: col, text: `${formatReadableClock(playtestState.clock)} (Gün ${playtestState.day || 1}).` });
      }
      const p = parseClockParts(playtestState.clock);
      const tod = ((p.h * 60 + p.mn) - 360 + 1440) % 1440;
      for (const b of (m.todBands || [])) {
        if (tod <= Number(b.to ?? 1439)) {
          if (b.instr) entries.push({ label: b.label || "Zaman Dilimi", color: col, text: b.instr });
          if (b.caption) (b.override ? overrides : captions).push(b.caption);
          break;
        }
      }
      continue;
    }

    if (t === "collection") {
      const inv = playtestState.meters[mid] || playtestState.inventory || [];
      if (m.tellModel !== false) {
        entries.push({ label: getMeterName(m), color: col, text: `${getMeterName(m)}: ${inv.join(", ") || "Boş"}` });
      }
      continue;
    }

    if (t === "journal") {
      const j = playtestState.journals[mid] || [];
      if (m.tellModel !== false) {
        entries.push({ label: getMeterName(m), color: col, text: `${getMeterName(m)}: ${j.join(", ") || "Henüz kayıt yok"}` });
      }
      continue;
    }

    const val = playtestState.meters[mid] !== undefined ? playtestState.meters[mid] : (m.default ?? 0);

    if (t === "select") {
      if (m.tellModel !== false) entries.push({ label: getMeterName(m), color: col, text: `${getMeterName(m)}: ${val}` });
      const inst = (m.option_instructions || {})[val];
      const cap = (m.option_captions || {})[val];
      if (inst) entries.push({ label: `${getMeterName(m)} · ${val}`, color: col, text: inst });
      if (cap) captions.push(cap);
    } else if (t === "text") {
      if (m.tellModel !== false) entries.push({ label: getMeterName(m), color: col, text: `${getMeterName(m)}: ${val}` });
    } else {
      if (m.tellModel !== false) {
        const mx = (m.max !== undefined && m.max !== null) ? `/${m.max}` : "";
        entries.push({ label: getMeterName(m), color: col, text: `${getMeterName(m)}: ${val}${mx}${m.unit || ''}` });
      }
      for (const lv of (m.levels || [])) {
        if (Number(val) >= Number(lv.min ?? -1e12) && Number(val) <= Number(lv.max ?? 1e12)) {
          if (lv.instruction) entries.push({ label: `${getMeterName(m)} · ${lv.label}`, color: col, text: lv.instruction });
          if (lv.caption) (lv.override ? overrides : captions).push(lv.caption);
          break;
        }
      }
    }
  }

  for (const cr of (editRulebookData.combined_rules || [])) {
    if ((cr.conds || []).length && cr.conds.every(evalPlaytestCond)) {
      if (cr.instr) entries.push({ label: cr.name || cr.id, color: "purple", text: cr.instr });
      if (cr.caption) overrides.push(cr.caption);
    }
  }

  entries._captions = overrides.length ? overrides : captions;
  return entries;
}

function renderModelSees() {
  const box = document.getElementById("rbe-model-sees");
  const stLine = document.getElementById("rbe-status-line-preview");
  if (!box) return;
  const entries = computeModelSeesEntries();
  box.innerHTML = `<div class="muted" style="font-family:monospace;font-size:11px;">[Güncel Dinamikler]</div>` +
    entries.map(e => `
      <div class="rbe-ms-entry c-${e.color}">
        <span class="rbe-ms-pill ${['blue','royal','purple','crimson','red','ochre'].includes(e.color)?'light-txt':''}">${escapeHtml(e.label)}</span>
        <span class="rbe-ms-text">${escapeHtml(e.text)}</span>
      </div>
    `).join("");

  const caps = entries._captions || [];
  stLine.innerHTML = `<span>Kullanıcı durum satırı:</span><b>${escapeHtml(caps.slice(0, 3).join(" · ") || "—")}</b>`;
  renderRulebookHealth();
}

function setPlaytestClockMinute(totalMins) {
  const p = parseClockParts(playtestState.clock);
  const h = Math.floor(Number(totalMins) / 60);
  const mn = Number(totalMins) % 60;
  playtestState.clock = `${p.y}-${String(p.mo).padStart(2,"0")}-${String(p.d).padStart(2,"0")} ${String(h).padStart(2,"0")}:${String(mn).padStart(2,"0")}`;
  const cm = (editRulebookData.meters || []).find(m => canonMeterType(m.type) === "clock");
  if (cm) playtestState.meters[cm.id] = playtestState.clock;
  const lbl = document.getElementById("pt-clock-read");
  if (lbl) lbl.textContent = formatReadableClock(playtestState.clock);
  renderModelSees();
  if (rbeActiveTab === "rules") renderInfluenceRules();
}

function setPlaytestDay(newDay) {
  const dNum = Math.max(1, Number(newDay) || 1);
  const diff = dNum - (playtestState.day || 1);
  playtestState.day = dNum;
  const p = parseClockParts(playtestState.clock);
  const dt = new Date(p.y, p.mo - 1, p.d + diff, p.h, p.mn);
  playtestState.clock = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")} ${String(dt.getHours()).padStart(2,"0")}:${String(dt.getMinutes()).padStart(2,"0")}`;
  const cm = (editRulebookData.meters || []).find(m => canonMeterType(m.type) === "clock");
  if (cm) playtestState.meters[cm.id] = playtestState.clock;
  renderPlaytest();
  renderModelSees();
  if (rbeActiveTab === "rules") renderInfluenceRules();
}

function setPlaytestMeter(mid, val, isNum) {
  playtestState.meters[mid] = isNum ? Number(val) : String(val);
  const vEl = document.getElementById("pt-val-" + mid);
  if (vEl) vEl.textContent = playtestState.meters[mid];
  const nEl = document.getElementById("pt-num-" + mid);
  if (nEl && isNum) nEl.value = playtestState.meters[mid];
  renderModelSees();
  if (rbeActiveTab === "rules") renderInfluenceRules();
}

function renderPlaytest() {
  const box = document.getElementById("rbe-playtest-controls");
  if (!box) return;
  let html = "";

  for (const m of (editRulebookData.meters || [])) {
    const mid = m.id || m.name;
    const t = canonMeterType(m.type);
    const ic = getMeterIcon(m);
    const col = getMeterColor(m);

    if (t === "clock") {
      const p = parseClockParts(playtestState.clock);
      const mins = p.h * 60 + p.mn;
      html += `
        <div class="pt-row c-${col}" style="flex-direction:column;align-items:stretch;gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="pt-lbl">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}<span>${escapeHtml(getMeterName(m))}</span></div>
            <div class="pt-ctrl"><input type="range" min="0" max="1439" value="${mins}" oninput="setPlaytestClockMinute(this.value)" /></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-left:4px;">
            <b id="pt-clock-read" style="font-size:11.5px;">${escapeHtml(formatReadableClock(playtestState.clock))}</b>
            <span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;" class="muted">
              Gün <input type="number" min="1" style="width:52px;padding:2px 5px;font-size:11px;" value="${playtestState.day || 1}" onchange="setPlaytestDay(this.value)" />
            </span>
          </div>
        </div>`;
      continue;
    }

    if (t === "collection") {
      const inv = playtestState.meters[mid] || [];
      html += `
        <div class="pt-row c-${col}">
          <div class="pt-lbl">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}<span>${escapeHtml(getMeterName(m))}</span></div>
          <div class="pt-ctrl"><span class="muted small-text">${inv.length} eşya</span></div>
        </div>`;
      continue;
    }

    if (t === "journal") {
      const j = playtestState.journals[mid] || [];
      html += `
        <div class="pt-row c-${col}">
          <div class="pt-lbl">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}<span>${escapeHtml(getMeterName(m))}</span></div>
          <div class="pt-ctrl"><span class="muted small-text">${j.length} olay</span></div>
        </div>`;
      continue;
    }

    const val = playtestState.meters[mid] !== undefined ? playtestState.meters[mid] : (m.default ?? 0);
    if (t === "bar" || t === "pips" || t === "dice") {
      html += `
        <div class="pt-row c-${col}">
          <div class="pt-lbl">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}<span>${escapeHtml(getMeterName(m))}</span></div>
          <div class="pt-ctrl">
            <input type="range" min="${m.min ?? 0}" max="${m.max ?? 100}" value="${val}" oninput="setPlaytestMeter('${escapeHtml(mid)}', this.value, true)" />
            <span class="pt-val" id="pt-val-${escapeHtml(mid)}">${val}</span>
          </div>
        </div>`;
    } else if (t === "number") {
      const slMax = Math.max(1000, Number(m.default || 0) * 5, Number(val || 0) * 2);
      html += `
        <div class="pt-row c-${col}">
          <div class="pt-lbl">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}<span>${escapeHtml(getMeterName(m))}</span></div>
          <div class="pt-ctrl">
            <input type="range" min="0" max="${slMax}" value="${val}" oninput="setPlaytestMeter('${escapeHtml(mid)}', this.value, true)" />
            <input type="number" id="pt-num-${escapeHtml(mid)}" style="width:82px;" value="${val}" oninput="setPlaytestMeter('${escapeHtml(mid)}', this.value, true)" />
          </div>
        </div>`;
    } else if (t === "select") {
      const opts = m.options || [];
      html += `
        <div class="pt-row c-${col}">
          <div class="pt-lbl">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}<span>${escapeHtml(getMeterName(m))}</span></div>
          <div class="pt-ctrl">
            <select onchange="setPlaytestMeter('${escapeHtml(mid)}', this.value, false)">
              ${opts.map(o => `<option value="${escapeHtml(o)}" ${o === val ? 'selected' : ''}>${escapeHtml(o)}</option>`).join("")}
            </select>
          </div>
        </div>`;
    } else {
      html += `
        <div class="pt-row c-${col}">
          <div class="pt-lbl">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, playtestState.meters[mid]))}<span>${escapeHtml(getMeterName(m))}</span></div>
          <div class="pt-ctrl"><input type="text" value="${escapeHtml(val)}" oninput="setPlaytestMeter('${escapeHtml(mid)}', this.value, false)" /></div>
        </div>`;
    }
  }
  box.innerHTML = html || `<div class="muted small-text">Önizlenecek gösterge yok.</div>`;
}

function setPlaytestRole(role) {
  playtestRole = role;
  document.getElementById("pt-role-bot")?.classList.toggle("active", role === "assistant");
  document.getElementById("pt-role-user")?.classList.toggle("active", role === "user");
}

function renderPlaytestLog() {
  const box = document.getElementById("rbe-pt-log");
  if (!box) return;
  if (!playtestLog.length) {
    box.innerHTML = `<div class="muted small-text" style="text-align:center;padding:10px;">Bir durum denemek için aşağıya örnek mesaj yazıp değerlendir.</div>`;
    return;
  }
  box.innerHTML = playtestLog.map(item => `
    <div class="rbe-pt-entry">
      <div><b>${item.role === "user" ? "Kullanıcı" : "Bot"}:</b> ${escapeHtml(item.text)}</div>
      ${item.notifs.length ? `<div class="rbe-pt-notifs">→ ${escapeHtml(item.notifs.join(" · "))}</div>` : `<div class="muted" style="font-size:11px;">Saat güncellendi (${escapeHtml(item.clock)})</div>`}
    </div>
  `).join("");
  box.scrollTop = box.scrollHeight;
}

async function runPlaytestMessage() {
  const inp = document.getElementById("rbe-pt-input");
  const text = (inp.value || "").trim();
  if (!text) return;
  inp.value = "";
  syncClockTopFields();
  try {
    const res = await fetch("/api/rulebooks/playtest-eval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rulebook: editRulebookData, state: playtestState, message: text, role: playtestRole })
    }).then(r => r.json());
    if (res.state) playtestState = res.state;
    playtestLog.push({ role: playtestRole, text, notifs: res.notifications || [], clock: playtestState.clock });
    renderPlaytest();
    renderPlaytestLog();
    renderModelSees();
    if (rbeActiveTab === "rules") renderInfluenceRules();
  } catch (e) {
    alert("Test hatası: " + e.message);
  }
}

// =========================================================================
// İMPORT / EXPORT / KAYDET / SİL
// =========================================================================
async function importRulebookJSON(input) {
  if (!input.files || !input.files[0]) return;
  try {
    const raw = JSON.parse(await input.files[0].text());
    const meta = (raw && raw.rulebook) ? raw.rulebook : raw;
    if (!document.getElementById("rb-name").value.trim() && meta.name) {
      document.getElementById("rb-name").value = meta.name;
      document.getElementById("rb-header-title").textContent = meta.name;
    }
    if (!document.getElementById("rb-desc").value.trim() && meta.description) {
      document.getElementById("rb-desc").value = meta.description;
    }
    editRulebookData = normalizeAndPopulateRulebook(raw);
    ruleJsonMode = false;
    selectedMeterIdx = null;
    document.getElementById("rule-json-box").classList.add("hidden");
    resetPlaytestState(false);
    switchRulebookTab("meters");
    alert(`Rulebook yüklendi! ${editRulebookData.meters.length} gösterge ve ${countTotalInfluenceRules()} etki kuralı oluşturuldu.`);
  } catch (e) {
    alert("Rulebook JSON okunamadı: " + e.message);
  }
  input.value = "";
}

function loadSampleRulebook() {
  editRulebookData = normalizeAndPopulateRulebook({
    meters: [
      { id: "saat", type: "clock", label: "Tarih ve Saat", icon: "clock", color: "amber", start: "2026-06-03T11:30", stepMin: 3, skips: true, tellModel: true },
      { id: "para", type: "number", label: "Para", icon: "coin", color: "green", def: 100000, unit: "€", spend: true, tellModel: true },
      { id: "enerji", type: "bar", label: "Enerji", icon: "bolt", color: "blue", min: 0, max: 100, def: 80, decay: -2,
        bands: [{ label: "Bitkin", to: 25, instr: "{{user}} çok yorgun.", caption: "Bitkin" }, { label: "Dinç", to: 100, instr: "" }] },
      { id: "lokasyon", type: "select", label: "Lokasyon", icon: "globe", color: "sky", def: "İstanbul",
        options: ["İstanbul", "Ev", "Rams Park/İstanbul", "Miami", "Londra"] },
      { id: "envanter", type: "collection", label: "Envanter", icon: "backpack", color: "ochre", hud: "panel", default: ["Telefon", "Anahtar"] }
    ],
    combined_rules: [
      { id: "haftalik-maas", name: "Pazartesi Maaş", conds: [{ m: "saat", op: "weekday", days: [1] }], instr: "Bugün pazartesi: haftalık maaş {{user}}'ın hesabına yattı.", caption: "Haftalık maaş yattı" }
    ]
  });
  selectedMeterIdx = null;
  resetPlaytestState(false);
  switchRulebookTab("meters");
}

function toggleRulebookJSON() {
  ruleJsonMode = !ruleJsonMode;
  if (ruleJsonMode) {
    syncClockTopFields();
    document.getElementById("rb-json-text").value = JSON.stringify(editRulebookData, null, 2);
    document.getElementById("rbe-pane-props").classList.add("hidden");
    document.getElementById("rbe-workspace").classList.add("hidden");
    document.getElementById("rule-json-box").classList.remove("hidden");
  } else {
    try {
      editRulebookData = normalizeAndPopulateRulebook(JSON.parse(document.getElementById("rb-json-text").value || "{}"));
    } catch (e) {
      alert("JSON hatası: " + e.message);
      ruleJsonMode = true;
      return;
    }
    document.getElementById("rule-json-box").classList.add("hidden");
    selectedMeterIdx = null;
    resetPlaytestState(false);
    switchRulebookTab(rbeActiveTab);
  }
}

function exportCurrentEditingRulebook() {
  syncClockTopFields();
  const name = document.getElementById("rb-name").value.trim() || "rulebook";
  const blob = new Blob([JSON.stringify({
    schema: "rulebook/v1-draft",
    exported_at: new Date().toISOString(),
    rulebook: { name, description: document.getElementById("rb-desc").value, ...editRulebookData }
  }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/\s+/g, "_")}.rulebook.json`;
  a.click();
}

async function saveStandaloneRulebook(isDraft = false) {
  if (ruleJsonMode) {
    try { editRulebookData = normalizeAndPopulateRulebook(JSON.parse(document.getElementById("rb-json-text").value || "{}")); }
    catch (err) { return alert("Rulebook JSON hatası: " + err.message); }
  }
  syncClockTopFields();
  const name = document.getElementById("rb-name").value.trim() || "Adsız Rulebook";
  const id = document.getElementById("rb-id").value;
  const payload = {
    name,
    description: document.getElementById("rb-desc").value.trim(),
    tags: document.getElementById("rb-tags").value.trim(),
    cover_url: document.getElementById("rb-cover-url")?.value || "",
    is_draft: isDraft ? 1 : 0,
    data: editRulebookData
  };
  if (id) await fetch(`/api/rulebooks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  else await fetch("/api/rulebooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  await loadRulebooks();
  await loadCharacters();
  openCreations("rulebooks");
}

async function deleteEditingRulebook() {
  const id = document.getElementById("rb-id").value;
  if (!id) return;
  await deleteRulebook(Number(id));
  openCreations("rulebooks");
}

async function deleteRulebook(id) {
  if (!confirm("Bu Rulebook silinsin mi?")) return;
  await fetch(`/api/rulebooks/${id}`, { method: "DELETE" });
  await loadRulebooks();
  await loadCharacters();
}

function exportRulebookJSON(id) {
  const rb = rulebooks.find(x => x.id === id);
  if (!rb) return;
  const blob = new Blob([JSON.stringify({
    schema: "rulebook/v1-draft",
    exported_at: new Date().toISOString(),
    rulebook: { name: rb.name, description: rb.description, ...(rb.data || {}) }
  }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${rb.name.replace(/\s+/g, "_")}.rulebook.json`;
  a.click();
}
