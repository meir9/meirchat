// ==========================================
// MEIRCHAT — ANA UYGULAMA
// ==========================================
let characters = [];
let lorebooks = [];
let rulebooks = [];
let groups = [];
let personas = [];
let appSettings = {};

let currentCreationsTab = "chatbots"; // chatbots | lorebooks | rulebooks | groups
let currentCharacter = null;
let currentGroup = null;
let currentChatId = null;
let currentChatData = null;
let currentMessages = [];
let editingMessageId = null;
let abortController = null;
let lastStreamError = null;
let hudPanelOpen = false;

// Form durumları
const PRESET_TAGS = [
  "Karakter", "Tarih", "Organizasyon", "İngilizce Dışı", "İngilizce",
  "Mekân", "Olay", "Eşya", "Rol Yapma", "Simülasyon", "Dünya",
  "Ekonomi", "Karanlık Fantezi", "Futbol", "Dram", "Romantik", "Aksiyon", "NSFW"
];
let tagLists = { char: [], lb: [], group: [] };
let charAttachedLoreIds = [];
let charAttachedRulebookId = null;
let groupAttachedLoreIds = [];
let groupMemberIds = [];
let groupFirstSpeakerId = null;
let personaAttachedRulebookId = null;
let attachContext = "char"; // char | group | persona

// Lorebook editörü & Kayıt (Entry) modalı
let editLoreEntries = [];
let lbActiveTab = "details";
let entryModalKeywords = [];

// Select Pill Picker & HUD Modal
let spActiveMeterId = null;
let spSelectedValue = "";
let spCurrentOptions = [];
let hudDraftState = null;

// Yeni Sohbet Persona Seçim Ekranı
let personaPickerTarget = null; // { kind: "character"|"group", id, name, avatar_url, existingChatId, returnView }
let personaPickerSelectedId = null;

// v10 Chat Durumları (Görsel Ekleme, Web Araması, Toplu Silme, Öneriler, TTS)
let pendingChatImageUrl = "";
let webSearchActive = false;
let bulkRemoveMode = false;
let bulkSelectedIds = new Set();
let activeSpeechMsgId = null;
let lastSentPayload = null;
let lastActiveNavId = "nav-home";

// v19: Grouped Chats, Full-Page Saved Chats & HD TTS Audio Player
let allChatsCache = [];
let manageAllChats = false;
let selectedAllChatIds = new Set();

let savedChatsTarget = null; // { kind: "character"|"group", id, name, avatar_url, returnView }
let savedChatsCache = [];
let manageSavedChats = false;
let selectedSavedChatIds = new Set();

let curatedVoicesCache = [];
let currentTtsAudio = null;
let currentTtsObjectUrl = null;
let ttsAbortController = null;

// ==========================================
// BAŞLATMA VE PROFİL / GÖRÜNÜM YÜKLEME
// ==========================================
async function init() {
  document.addEventListener("click", (e) => {
    const pop = document.getElementById("card-popover");
    if (pop && !pop.contains(e.target) && !e.target.closest(".cb-dots-btn") && !e.target.closest(".ps-dots-btn") && !e.target.closest(".sc-round-ico-btn")) {
      pop.classList.add("hidden");
    }
    if (!e.target.closest(".sc-menu-anchor")) {
      document.getElementById("chat-options-menu")?.classList.add("hidden");
    }
    if (!e.target.closest(".sc-plus-anchor")) {
      document.getElementById("composer-plus-menu")?.classList.add("hidden");
    }
    if (!e.target.closest(".sc-tag-box") && !e.target.closest(".sc-tag-dropdown")) {
      document.querySelectorAll(".sc-tag-dropdown").forEach(d => d.classList.add("hidden"));
    }
  });

  await loadAppearance();
  await checkStatus();
  await Promise.all([loadPersonas(), loadLorebooks(), loadRulebooks(), loadCharacters(), loadGroups()]);
  window.addEventListener("beforeunload", () => stopVoicePlayback());
  openCreations("chatbots", "nav-home");
  setInterval(checkStatus, 15000);
  initDesktopMode();
  initCloudAndPwa();
}

async function initCloudAndPwa() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  try {
    const info = await fetch("/api/cloud/status").then(r => r.json());
    if (info.auth_enabled) {
      document.getElementById("btn-auth-logout")?.classList.remove("hidden");
    }
    const pCloud = document.getElementById("prof-val-cloud");
    if (pCloud) {
      pCloud.textContent = info.db_synced ? `☁ Senkron · ${info.active_label}` : `Yerel · ${info.active_label}`;
    }
  } catch {}
}

async function logoutSession() {
  if (!confirm("Oturumu kapatıp giriş ekranına dönmek istiyor musun?")) return;
  try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
  window.location.replace("/login");
}

function isMobileViewport() {
  return window.innerWidth <= 860;
}

function closeMobileSidebar() {
  document.getElementById("app-sidebar")?.classList.remove("mobile-open");
  document.getElementById("sidebar-backdrop")?.classList.add("hidden");
}

async function refreshCloudOverview() {
  try {
    const info = await fetch("/api/cloud/status").then(r => r.json());
    const dbB = document.getElementById("cld-db-badge");
    if (dbB) {
      dbB.style.color = info.db_synced ? "#4ade80" : "#fbbf24";
      dbB.textContent = info.db_synced
        ? `✓ ${info.db_label} (PC ↔ iPhone Eş Zamanlı)`
        : `${info.db_label} (Sadece bu cihaz — Buluta bağlamak için Buluta_Bagla_ve_Aktar.bat çalıştır)`;
    }
    const rt = document.getElementById("cld-runtime-info");
    if (rt) {
      const parts = [
        `Ortam: ${info.is_cloud ? "☁ Bulut (iPhone/Web)" : "🖥 PC Masaüstü"}`,
        `Görsel Senkron: ${info.storage_synced ? "✓ Aktif" : "Yerel"}`,
        `Aktif Motor: ${info.active_label}`,
      ];
      if (info.remote_gpu_updated_at) parts.push(`Kaggle Son Bağlantı: ${info.remote_gpu_updated_at}`);
      rt.textContent = parts.join("  ·  ");
    }
    const pCloud = document.getElementById("prof-val-cloud");
    if (pCloud) pCloud.textContent = info.active_label || "Hibrit";
  } catch {}
}

function applyFreeApiPreset(provider) {
  const u = document.getElementById("set-cloud-api-url");
  const m = document.getElementById("set-cloud-api-model");
  if (provider === "openrouter") {
    if (u) u.value = "https://openrouter.ai/api/v1";
    if (m) m.value = "google/gemma-3-27b-it:free";
  } else if (provider === "groq") {
    if (u) u.value = "https://api.groq.com/openai/v1";
    if (m) m.value = "llama-3.3-70b-versatile";
  } else if (provider === "nvidia") {
    if (u) u.value = "https://integrate.api.nvidia.com/v1";
    if (m) m.value = "google/gemma-3-27b-it";
  }
}

async function saveCloudHybridSettings(showToast = true) {
  const msgEl = document.getElementById("cld-save-msg");
  const payload = {
    cloud_llm_mode: document.getElementById("set-cloud-llm-mode")?.value || "hybrid_auto",
    pc_llm_mode: document.getElementById("set-pc-llm-mode")?.value || "local",
    remote_gpu_url: (document.getElementById("set-remote-gpu-url")?.value || "").trim(),
    remote_gpu_model: (document.getElementById("set-remote-gpu-model")?.value || "").trim(),
    cloud_api_url: (document.getElementById("set-cloud-api-url")?.value || "https://openrouter.ai/api/v1").trim(),
    cloud_api_key: (document.getElementById("set-cloud-api-key")?.value || "").trim(),
    cloud_api_model: (document.getElementById("set-cloud-api-model")?.value || "").trim(),
  };
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  Object.assign(appSettings, payload);
  await refreshCloudOverview();
  await checkStatus();
  if (showToast && msgEl) {
    const st = await fetch("/api/status").then(r => r.json()).catch(() => ({ connected: false }));
    msgEl.style.color = st.connected ? "#4ade80" : "#fbbf24";
    msgEl.textContent = st.connected
      ? `✓ Kaydedildi · ${st.backend_label || "Motor"} bağlı!`
      : `Kaydedildi (${st.error || "Aktif motor henüz çevrimdışı"})`;
  }
}

function initDesktopMode() {
  const isDesk = new URLSearchParams(window.location.search).get("desktop") === "1";
  if (isDesk) {
    document.getElementById("btn-app-quit")?.classList.remove("hidden");
    const ping = () => fetch("/api/app/heartbeat", { method: "POST" }).catch(() => {});
    ping();
    setInterval(ping, 5000);
  }
}

async function quitDesktopApp() {
  if (!confirm(typeof t === "function" ? t("quit_confirm") : "MEIRCHAT ve LM Studio tamamen kapatılsın mı?")) return;
  stopVoicePlayback();
  try {
    await fetch("/api/app/shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kill_lmstudio: true })
    });
  } catch {}
  setTimeout(() => window.close(), 150);
}

async function openEngineCenter() {
  await openSettingsView(false);
  document.getElementById("prof-sub-engine")?.classList.remove("hidden");
  await refreshEngineOverview();
  setTimeout(() => document.getElementById("prof-sub-engine")?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
}

async function refreshEngineOverview() {
  try {
    const ov = await fetch("/api/app/engine").then(r => r.json());
    const modeMap = { lmstudio: "LM Studio", llama_server: "Turbo llama-server", manual: "Manuel" };
    const pve = document.getElementById("prof-val-engine");
    if (pve) pve.textContent = modeMap[ov.mode] || ov.mode;

    const badge = document.getElementById("eng-status-badge");
    if (badge) {
      if (ov.connected) {
        badge.style.color = "#4ade80";
        badge.textContent = `Bağlı · ${(ov.loaded_models || [])[0] || "Model yüklü"}`;
      } else {
        badge.style.color = "#f87171";
        badge.textContent = ov.status_msg || "Sunucu kapalı / Model yüklü değil";
      }
    }
    const info = document.getElementById("eng-detected-info");
    if (info) {
      const parts = [
        `LM Studio CLI: ${ov.has_lms ? "✓ Var" : "✕ Yok"}`,
        `llama-server: ${ov.has_llama_server ? "✓ Var" : "✕ Yok"}`,
      ];
      if (ov.detected_gguf) {
        const fname = ov.detected_gguf.split(/[\\/]/).pop();
        parts.push(`GGUF: ${fname}`);
      }
      info.textContent = parts.join("  ·  ");
    }
  } catch {}
}

async function startEngineFromUI() {
  const btn = document.getElementById("btn-eng-start");
  const badge = document.getElementById("eng-status-badge");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Başlatılıyor & Model Yükleniyor..."; }
  if (badge) { badge.style.color = "#60a5fa"; badge.textContent = "Motor başlatılıyor, lütfen bekle..."; }
  try {
    const body = {
      app_engine_mode: document.getElementById("set-app-engine-mode")?.value || "lmstudio",
      app_model_key: document.getElementById("set-app-model-key")?.value.trim() || "gemma",
      app_gguf_path: document.getElementById("set-app-gguf-path")?.value.trim() || "",
      app_cpu_moe: document.getElementById("set-app-cpu-moe")?.value || "26",
      app_ctx_size: document.getElementById("set-app-ctx-size")?.value || "4096",
      app_unload_on_exit: document.getElementById("set-app-unload-exit")?.checked ? "1" : "0"
    };
    const res = await fetch("/api/app/engine/start", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
    }).then(r => r.json());
    await refreshEngineOverview();
    await checkStatus();
    if (!res.ok) alert(res.message || "Motor başlatılamadı.");
  } catch (e) {
    alert("Motor başlatma hatası: " + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "▶ Motoru Başlat & Modeli Yükle"; }
  }
}

async function openAppDataFolder() {
  try {
    const res = await fetch("/api/app/open-data-dir", { method: "POST" }).then(r => r.json());
    if (!res.ok) alert("Veri klasörü: " + (res.path || ""));
  } catch (e) {
    alert("Klasör açılamadı: " + e.message);
  }
}

async function unloadEngineFromUI() {
  const btn = document.getElementById("btn-eng-unload");
  if (btn) { btn.disabled = true; btn.textContent = "⏳ Boşaltılıyor..."; }
  try {
    const res = await fetch("/api/app/engine/unload", { method: "POST" }).then(r => r.json());
    await refreshEngineOverview();
    await checkStatus();
    alert(res.message || "Tamamlandı.");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "⏹ VRAM Boşalt (Eject)"; }
  }
}

async function applyAppModelProfile(name) {
  const res = await fetch(`/api/app/profile/${name}`, { method: "POST" }).then(r => r.json());
  if (res.ok && res.settings) {
    appSettings = res.settings;
    await openSettingsView(false);
    document.getElementById("prof-sub-engine")?.classList.remove("hidden");
    alert(`'${name === "gemma4" ? "Gemma 4 Turbo" : "Qwen 3.5"}' profili uygulandı (daktilo kapalı)!`);
  }
}

async function loadAppearance() {
  appSettings = await fetch("/api/settings").then(r => r.json());
  document.documentElement.setAttribute("data-theme", appSettings.theme || "dark");
  document.documentElement.style.setProperty("--chat-font-size", (appSettings.font_size || "16") + "px");
  if (appSettings.bubble_user_color) document.documentElement.style.setProperty("--user-bubble-bg", appSettings.bubble_user_color);
  if (appSettings.bubble_bot_color) document.documentElement.style.setProperty("--bot-bubble-bg", appSettings.bubble_bot_color);
  if (appSettings.rp_italic_color) document.documentElement.style.setProperty("--rp-em", appSettings.rp_italic_color);
  const bg = document.getElementById("chat-main-bg");
  if (bg) bg.style.backgroundImage = appSettings.chat_bg_url ? `url('${appSettings.chat_bg_url}')` : "none";
  refreshTopProfileButton();
  if (typeof applyUiLanguage === "function") {
    applyUiLanguage(appSettings.ui_lang || "tr");
  }
}

function getProfileHandle() {
  return "@" + (appSettings.profile_username || "meir9").replace(/^@+/, "");
}

function refreshTopProfileButton() {
  const name = appSettings.profile_name || appSettings.profile_username || "Deniz";
  const av = appSettings.profile_avatar || "";
  const img = document.getElementById("top-profile-img");
  const fb = document.getElementById("top-profile-fallback");
  const nm = document.getElementById("top-profile-name");
  if (nm) nm.textContent = name;
  if (av && img && fb) {
    img.src = av;
    img.classList.remove("hidden");
    fb.classList.add("hidden");
  } else if (img && fb) {
    img.classList.add("hidden");
    fb.textContent = (name[0] || "M").toUpperCase();
    fb.classList.remove("hidden");
  }
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  appSettings.theme = next;
  fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme: next }) });
}

async function checkStatus() {
  const dot = document.getElementById("status-dot");
  const txt = document.getElementById("status-text");
  try {
    const res = await fetch("/api/status").then(r => r.json());
    if (res.connected) {
      dot.className = "dot ok";
      const lbl = res.backend === "kaggle" ? "🚀 Kaggle GPU" : (res.backend === "cloud_api" ? "☁ Bulut API" : (typeof t === "function" ? t("model_connected") : "Model bağlı"));
      txt.textContent = lbl;
      const dl = document.getElementById("model-list");
      if (dl) dl.innerHTML = (res.models || []).map(m => `<option value="${escapeHtml(m)}">`).join("");
    } else {
      dot.className = "dot err";
      txt.textContent = res.is_cloud ? "Motor kapalı (Ayarlar)" : (typeof t === "function" ? t("model_closed") : "Model kapalı");
    }
  } catch {
    dot.className = "dot err";
    txt.textContent = typeof t === "function" ? t("no_conn") : "Bağlantı yok";
  }
}

function toggleAppSidebar() {
  const sb = document.getElementById("app-sidebar");
  if (!sb) return;
  if (isMobileViewport()) {
    const opening = !sb.classList.contains("mobile-open");
    sb.classList.toggle("mobile-open", opening);
    sb.classList.remove("collapsed");
    document.getElementById("sidebar-backdrop")?.classList.toggle("hidden", !opening);
  } else {
    sb.classList.toggle("collapsed");
  }
}

function toggleSbSection(secId, btn) {
  document.getElementById(secId).classList.toggle("hidden");
  btn.classList.toggle("is-closed");
}

const VIEW_TITLES = {
  creations: "Oluşturduklarım",
  chats: "Sohbetler",
  "saved-chats": "Kayıtlı Sohbetler",
  "lorebook-start": "Lorebook Oluştur",
  "lorebook-edit": "Lorebook Düzenle",
  "rulebook-edit": "Rulebook Editörü",
  create: "Chatbot Oluştur",
  "group-create": "Grup Oluştur",
  personas: "Personalarım",
  "persona-edit": "Persona Düzenle",
  profile: "Profil Ayarları",
  settings: "Ayarlar",
  "persona-picker": "Persona Seç",
  chat: "Sohbet"
};

function setActiveSidebarNav(navId) {
  document.querySelectorAll(".sb-item, .sb-subitem").forEach(b => b.classList.remove("active"));
  if (navId) {
    const el = document.getElementById(navId);
    if (el) {
      el.classList.add("active");
      lastActiveNavId = navId;
    }
  }
}

function showView(name, explicitNavId = null) {
  // Baska menuye / ekrana gecince ses ANINDA susar!
  stopVoicePlayback();
  if (isMobileViewport()) closeMobileSidebar();
  document.getElementById("card-popover")?.classList.add("hidden");
  document.getElementById("chat-options-menu")?.classList.add("hidden");
  document.getElementById("composer-plus-menu")?.classList.add("hidden");
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  const target = document.getElementById(`view-${name}`);
  if (target) target.classList.add("active");

  let navId = explicitNavId;
  if (!navId) {
    if (name === "chats") navId = "nav-chats";
    else if (name === "saved-chats") navId = lastActiveNavId || "nav-chats";
    else if (name === "lorebook-start") navId = "nav-create-lb";
    else if (name === "personas" || name === "persona-edit") navId = "nav-personas";
    else if (name === "settings") navId = "nav-settings";
    else if (name === "profile") navId = null;
    else if (name === "chat" || name === "persona-picker") navId = lastActiveNavId || "nav-chats";
  }
  if (name === "profile") {
    setActiveSidebarNav(null);
  } else if (navId) {
    setActiveSidebarNav(navId);
  }
  document.getElementById("top-profile-btn")?.classList.toggle("active", name === "profile");

  const tEl = document.getElementById("topbar-title");
  if (tEl) {
    const i18nMap = {
      creations: "page_creations",
      chats: "nav_chats",
      "saved-chats": "page_saved_chats",
      personas: "nav_personas",
      profile: "page_profile",
      settings: "nav_settings"
    };
    tEl.textContent = (typeof t === "function" && i18nMap[name]) ? t(i18nMap[name], VIEW_TITLES[name]) : (VIEW_TITLES[name] || "MEIRCHAT");
  }

  if (name === "chats") loadAllChats();
  if (name === "personas") loadPersonas().then(renderPersonasView);
}

// ==========================================
// ORTAK YARDIMCILAR (SAYAÇ, GÖRSEL YÜKLEME, ETİKETLER, POPOVER)
// ==========================================
function estTokens(text) {
  const s = String(text || "");
  return s ? Math.round(s.length / 3.8) : 0;
}

function updateCounter(inputId, countId, maxLen) {
  const el = document.getElementById(inputId);
  const cnt = document.getElementById(countId);
  if (el && cnt) cnt.textContent = `${(el.value || "").length}/${maxLen}`;
}

async function uploadGenericImage(input, hiddenId, previewId) {
  if (!input.files || !input.files[0]) return;
  const fd = new FormData();
  fd.append("file", input.files[0]);
  const res = await fetch("/api/upload?mode=avatar", { method: "POST", body: fd }).then(r => r.json());
  if (res.url) {
    document.getElementById(hiddenId).value = res.url;
    const prev = document.getElementById(previewId);
    if (prev) { prev.src = res.url; prev.classList.remove("hidden"); }
    if (hiddenId === "lb-cover-url") document.getElementById("lb-cover-clear")?.classList.remove("hidden");
  }
  input.value = "";
}

function clearGenericImage(hiddenId, previewId, clearBtnId) {
  document.getElementById(hiddenId).value = "";
  document.getElementById(previewId)?.classList.add("hidden");
  document.getElementById(clearBtnId)?.classList.add("hidden");
}

async function uploadBg(input) {
  if (!input.files || !input.files[0]) return;
  const fd = new FormData();
  fd.append("file", input.files[0]);
  const res = await fetch("/api/upload?mode=bg", { method: "POST", body: fd }).then(r => r.json());
  if (res.url) {
    document.getElementById("set-bg-url").value = res.url;
    await saveAllSettings();
  }
  input.value = "";
}

// Etiket Chip Sistemi (char | lb | group)
function renderTagChips(ctx) {
  const box = document.getElementById(`${ctx}-tag-chips`);
  const cnt = document.getElementById(`${ctx}-tag-cnt`);
  const list = tagLists[ctx] || [];
  if (box) {
    box.innerHTML = list.map((t, i) => `
      <span class="sc-chip">${escapeHtml(t)} <button type="button" onclick="event.stopPropagation();removeTag('${ctx}',${i})">✕</button></span>
    `).join("");
  }
  if (cnt) cnt.textContent = `${list.length}/12`;
}

function addTag(ctx, val) {
  const clean = String(val || "").trim();
  if (!clean) return;
  if (!tagLists[ctx]) tagLists[ctx] = [];
  if (tagLists[ctx].length >= 12) return;
  if (!tagLists[ctx].some(x => x.toLowerCase() === clean.toLowerCase())) {
    tagLists[ctx].push(clean);
  }
  const inp = document.getElementById(`${ctx}-tag-input`);
  if (inp) inp.value = "";
  renderTagChips(ctx);
  filterTagDropdown(ctx);
}

function removeTag(ctx, idx) {
  tagLists[ctx].splice(idx, 1);
  renderTagChips(ctx);
  filterTagDropdown(ctx);
}

function clearTags(ctx) {
  tagLists[ctx] = [];
  renderTagChips(ctx);
  filterTagDropdown(ctx);
}

function handleTagKey(e, ctx) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    addTag(ctx, e.target.value.replace(/,/g, ""));
  } else if (e.key === "Backspace" && !e.target.value && tagLists[ctx].length) {
    tagLists[ctx].pop();
    renderTagChips(ctx);
  }
}

function openTagDropdown(ctx) {
  document.querySelectorAll(".sc-tag-dropdown").forEach(d => d.classList.add("hidden"));
  const dd = document.getElementById(`${ctx}-tag-dropdown`);
  if (dd) {
    dd.classList.remove("hidden");
    filterTagDropdown(ctx);
  }
}

function filterTagDropdown(ctx) {
  const dd = document.getElementById(`${ctx}-tag-dropdown`);
  const inp = document.getElementById(`${ctx}-tag-input`);
  if (!dd) return;
  const q = (inp ? inp.value : "").trim().toLowerCase();
  const picked = tagLists[ctx] || [];
  const filtered = PRESET_TAGS.filter(t => !q || t.toLowerCase().includes(q));
  let html = filtered.map(t => {
    const isP = picked.some(x => x.toLowerCase() === t.toLowerCase());
    return `<button type="button" class="sc-tag-opt ${isP ? 'picked' : ''}" onclick="addTag('${ctx}','${escapeHtml(t)}')"><span>${escapeHtml(t)}</span>${isP ? '<span>✓</span>' : ''}</button>`;
  }).join("");
  if (q && !filtered.some(t => t.toLowerCase() === q)) {
    html = `<button type="button" class="sc-tag-opt" onclick="addTag('${ctx}','${escapeHtml(inp.value.trim())}')"><span>+ "${escapeHtml(inp.value.trim())}" ekle</span></button>` + html;
  }
  dd.innerHTML = html;
}

function openCardPopover(e, items) {
  e.stopPropagation();
  const pop = document.getElementById("card-popover");
  if (!pop) return;
  pop.innerHTML = "";
  for (const it of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    if (it.danger) btn.className = "pop-danger";
    btn.textContent = it.label;
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      pop.classList.add("hidden");
      if (typeof it.action === "function") it.action();
    });
    pop.appendChild(btn);
  }
  const rect = e.currentTarget.getBoundingClientRect();
  pop.classList.remove("hidden");
  const pw = pop.offsetWidth || 175;
  const ph = pop.offsetHeight || 140;
  let left = Math.min(window.innerWidth - pw - 12, Math.max(12, rect.right - pw));
  let top = rect.bottom + 6;
  if (top + ph > window.innerHeight - 12) top = rect.top - ph - 6;
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}

function closeModal(id) { document.getElementById(id)?.classList.add("hidden"); }

function formatCompactNum(n) {
  n = Number(n || 0);
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

// ==========================================
// 1. OLUŞTURDUKLARIM (4 SEKMELİ BİRLEŞİK GALERİ)
// ==========================================
async function openCreations(tab = "chatbots", explicitNavId = null) {
  currentCreationsTab = tab;
  let targetNav = explicitNavId;
  if (!targetNav) {
    if (tab === "chatbots" && lastActiveNavId === "nav-home") targetNav = "nav-home";
    else if (tab === "lorebooks" && lastActiveNavId === "nav-lorebooks") targetNav = "nav-lorebooks";
    else if (tab === "rulebooks" && lastActiveNavId === "nav-rulebooks") targetNav = "nav-rulebooks";
    else targetNav = `nav-mine-${tab}`;
  }
  showView("creations", targetNav);

  document.querySelectorAll("#view-creations .mc-tab").forEach(b => b.classList.remove("active"));
  document.getElementById(`mc-tab-${tab}`)?.classList.add("active");

  const searchIn = document.getElementById("mc-search-input");
  const filterSel = document.getElementById("mc-filter-select");
  const rbBanner = document.getElementById("mc-rb-banner-wrap");
  const tabActs = document.getElementById("mc-tab-actions");

  if (tab === "rulebooks") {
    searchIn.placeholder = "Ad, açıklama veya göstergeye göre ara...";
    filterSel.classList.add("hidden");
    rbBanner.classList.remove("hidden");
    tabActs.innerHTML = "";
  } else {
    searchIn.placeholder = "Ara...";
    filterSel.classList.remove("hidden");
    rbBanner.classList.add("hidden");
    if (tab === "chatbots") {
      tabActs.innerHTML = `<button type="button" class="btn primary small" onclick="openCharacterForm()">+ Chatbot</button>`;
    } else if (tab === "lorebooks") {
      tabActs.innerHTML = `<button type="button" class="btn primary small" onclick="showView('lorebook-start')">+ Lorebook</button>`;
    } else {
      tabActs.innerHTML = `<button type="button" class="btn primary small" onclick="openGroupForm()">+ Grup</button>`;
    }
  }

  await Promise.all([loadCharacters(), loadLorebooks(), loadRulebooks(), loadGroups()]);
  renderCreations();
}

function renderCreations() {
  const grid = document.getElementById("mc-grid");
  if (!grid) return;
  const q = (document.getElementById("mc-search-input")?.value || "").toLowerCase().trim();
  const filt = document.getElementById("mc-filter-select")?.value || "all";
  const sort = document.getElementById("mc-sort-select")?.value || "latest";
  const handle = getProfileHandle();
  const blurNsfw = appSettings.blur_nsfw === "1";

  // --- CHATBOTS (6 SÜTUNLU DİKEY KARTLAR) ---
  if (currentCreationsTab === "chatbots") {
    let list = characters.filter(c => {
      if (q && !(c.name.toLowerCase().includes(q) || (c.title || "").toLowerCase().includes(q) || (c.tags || "").toLowerCase().includes(q))) return false;
      if (filt === "drafts" && !c.is_draft) return false;
      if (filt === "with_lb" && !(c.lorebook_ids || []).length) return false;
      if (filt === "with_rb" && !c.rulebook_id) return false;
      return true;
    });
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    else if (sort === "popular") list.sort((a, b) => (b.message_count || 0) - (a.message_count || 0));

    if (!list.length) {
      grid.className = "";
      grid.innerHTML = `<div class="muted" style="text-align:center;padding:48px;">Henüz chatbot bulunamadı. <b>+ Chatbot</b> ile oluştur!</div>`;
      return;
    }

    grid.className = "cb-grid-6";
    grid.innerHTML = list.map(c => {
      const hasLb = (c.lorebook_ids || []).length > 0;
      const hasRb = Boolean(c.rulebook_id || (c.rulebook && (c.rulebook.meters || []).length));
      const isNsfw = (c.tags || "").toLowerCase().includes("nsfw");
      const imgInner = c.avatar_url
        ? `<img src="${c.avatar_url}" alt="" />`
        : `<div class="cb-img-letter">${escapeHtml(c.name[0] || "?")}</div>`;
      return `
        <div class="cb-card">
          <div class="cb-img-wrap ${blurNsfw && isNsfw ? 'is-blurred' : ''}" onclick="openChatWith(${c.id})">
            ${imgInner}
            <button type="button" class="cb-info-btn" title="Detaylar" onclick="event.stopPropagation();openCharInfoModal(${c.id})">i</button>
          </div>
          <div class="cb-body" onclick="openChatWith(${c.id})">
            <div class="cb-head-row">
              <div class="cb-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
              <button type="button" class="cb-dots-btn" onclick="openChatbotMenu(event, ${c.id})">⋮</button>
            </div>
            <div class="cb-handle">${escapeHtml(handle)}</div>
            <div class="cb-title">${escapeHtml(c.title || "")}</div>
            <div class="cb-badges">
              ${hasLb ? `<span class="mini-mod-badge lb" title="Lorebook bağlı">📖</span>` : ""}
              ${hasRb ? `<span class="mini-mod-badge rb" title="Rulebook bağlı">♟</span>` : ""}
              <span class="mini-priv-pill">${c.is_draft ? '📄 Taslak' : '🔒 Özel'}</span>
            </div>
          </div>
          <div class="cb-stats">
            <span title="Toplam mesaj">💬 ${formatCompactNum(c.message_count || 0)}</span>
            <span title="Karakter token sayısı">⚡ ${c.token_count || 0}</span>
          </div>
        </div>`;
    }).join("");
    return;
  }

  // --- LOREBOOKS (3 SÜTUNLU YATAY KARTLAR) ---
  if (currentCreationsTab === "lorebooks") {
    let list = lorebooks.filter(lb => {
      if (q && !(lb.name.toLowerCase().includes(q) || (lb.description || "").toLowerCase().includes(q) || (lb.tags || "").toLowerCase().includes(q))) return false;
      if (filt === "drafts" && !lb.is_draft) return false;
      return true;
    });
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    else if (sort === "popular") list.sort((a, b) => (b.entries || []).length - (a.entries || []).length);

    if (!list.length) {
      grid.className = "";
      grid.innerHTML = `<div class="muted" style="text-align:center;padding:48px;">Henüz Lorebook yok. <b>+ Lorebook</b> ile dünya bilgisi oluştur!</div>`;
      return;
    }

    grid.className = "lb-grid-3";
    grid.innerHTML = list.map(lb => {
      const cover = lb.cover_url ? `<img src="${lb.cover_url}" alt="" />` : `📖`;
      return `
        <div class="lb-hcard" onclick="openLorebookEditor(${lb.id}, 'details')">
          <div class="lb-hcard-cover">${cover}</div>
          <div class="lb-hcard-body">
            <div class="cb-head-row">
              <div class="cb-name" style="font-size:15px;">${escapeHtml(lb.name)}</div>
              <button type="button" class="cb-dots-btn" onclick="openLorebookMenu(event, ${lb.id})">⋮</button>
            </div>
            <div class="lb-hcard-meta">
              <span class="cb-handle">${escapeHtml(handle)}</span>
              <span class="muted">📄 ${(lb.entries || []).length}</span>
            </div>
            <div class="lb-hcard-desc">${escapeHtml(lb.description || "Açıklama eklenmemiş.")}</div>
            <div class="lb-hcard-foot">
              <span class="mini-priv-pill">${lb.is_draft ? '📄 Taslak' : '🔒 Özel'}</span>
            </div>
          </div>
        </div>`;
    }).join("");
    return;
  }

  // --- RULEBOOKS (2 SÜTUNLU GENİŞ KARTLAR + RENKLİ İMGELİ GÖSTERGE HAPLARI) ---
  if (currentCreationsTab === "rulebooks") {
    let list = rulebooks.filter(rb => {
      if (!q) return true;
      const meters = (rb.data && rb.data.meters) ? rb.data.meters : [];
      const mMatch = meters.some(m => getMeterName(m).toLowerCase().includes(q));
      return rb.name.toLowerCase().includes(q) || (rb.description || "").toLowerCase().includes(q) || mMatch;
    });
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "tr"));
    else if (sort === "popular") list.sort((a, b) => (b.bot_count || 0) - (a.bot_count || 0));

    if (!list.length) {
      grid.className = "";
      grid.innerHTML = `<div class="muted" style="text-align:center;padding:48px;">Henüz Rulebook yok. Yukarıdaki <b>+ Rulebook Oluştur</b> veya <b>İçe Aktar</b> butonunu kullan!</div>`;
      return;
    }

    grid.className = "rb-grid-2";
    grid.innerHTML = list.map(rb => {
      const meters = (rb.data && rb.data.meters) ? rb.data.meters : [];
      let ruleCnt = ((rb.data && rb.data.combined_rules) ? rb.data.combined_rules.length : 0) + ((rb.data && rb.data.rules) ? rb.data.rules.length : 0);
      for (const m of meters) {
        const t = canonMeterType(m.type);
        if (t === "clock") ruleCnt += (m.todBands || []).length;
        else if (t === "select") ruleCnt += (m.options || []).length;
        else ruleCnt += (m.levels || m.bands || []).length;
      }
      const descHtml = escapeHtml(rb.description || "Açıklama ekle").replace(/\{\{user\}\}/g, '<span class="user-inline-pill">User</span>');
      const coverHtml = rb.cover_url
        ? `<img src="${rb.cover_url}" alt="" />`
        : `<span style="font-size:20px;opacity:0.5;">🖼</span><span>Kapak yok</span>`;
      const meterPillsHtml = meters.map(m => {
        const ic = getMeterIcon(m);
        const col = getMeterColor(m);
        return `<span class="rb-mpill c-${col}">${METER_ICONS[ic] || ''}<span>${escapeHtml(getMeterName(m))}</span></span>`;
      }).join("");
      return `
        <div class="rb-wcard" onclick="openRulebookEditor(${rb.id})">
          <div class="rb-wcard-cover">${coverHtml}</div>
          <div class="rb-wcard-body">
            <div class="cb-head-row">
              <div class="cb-name" style="font-size:15px;">${escapeHtml(rb.name || "Adsız Rulebook")}</div>
              <button type="button" class="cb-dots-btn" onclick="openRulebookMenu(event, ${rb.id})">⋮</button>
            </div>
            <div class="rb-wcard-desc">${descHtml}</div>
            <div class="rb-meter-pills">${meterPillsHtml}</div>
            <div class="rb-wcard-foot">
              <span class="mini-priv-pill">${rb.is_draft ? '📄 Taslak' : '🔒 Özel'}</span>
              <span>📋 ${ruleCnt} kural</span>
              ${rb.bot_count ? `<span>🤖 ${rb.bot_count} bot</span>` : ""}
            </div>
          </div>
        </div>`;
    }).join("");
    return;
  }

  // --- GRUPLAR (3 SÜTUNLU YATAY KARTLAR) ---
  if (currentCreationsTab === "groups") {
    let list = groups.filter(g => !q || g.name.toLowerCase().includes(q) || (g.title || "").toLowerCase().includes(q));
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name, "tr"));

    if (!list.length) {
      grid.className = "";
      grid.innerHTML = `<div class="muted" style="text-align:center;padding:48px;">Henüz grup yok. <b>+ Grup</b> ile birden fazla chatbot'u birleştir!</div>`;
      return;
    }

    grid.className = "lb-grid-3";
    grid.innerHTML = list.map(g => {
      const cover = g.avatar_url ? `<img src="${g.avatar_url}" alt="" />` : `👥`;
      return `
        <div class="lb-hcard" onclick="openGroupChat(${g.id})">
          <div class="lb-hcard-cover">${cover}</div>
          <div class="lb-hcard-body">
            <div class="cb-head-row">
              <div class="cb-name" style="font-size:15px;">${escapeHtml(g.name)}</div>
              <button type="button" class="cb-dots-btn" onclick="openGroupMenu(event, ${g.id})">⋮</button>
            </div>
            <div class="lb-hcard-meta">
              <span class="cb-handle">${escapeHtml(handle)}</span>
              <span class="muted">👥 ${(g.member_ids || []).length} üye</span>
            </div>
            <div class="lb-hcard-desc">${escapeHtml(g.title || g.scenario || "Grup sohbeti")}</div>
            <div class="lb-hcard-foot">
              <span class="mini-priv-pill">${g.is_draft ? '📄 Taslak' : '🔒 Özel'}</span>
            </div>
          </div>
        </div>`;
    }).join("");
  }
}

function openChatbotMenu(e, id) {
  openCardPopover(e, [
    { label: "💬 Sohbet Et", action: () => openChatWith(id) },
    { label: "✎ Düzenle", action: () => openCharacterForm(id) },
    { label: "📤 JSON Dışa Aktar", action: () => exportCharacterJSON(id) },
    { label: "🗑 Sil", danger: true, action: () => deleteCharacter(id) }
  ]);
}

function openLorebookMenu(e, id) {
  openCardPopover(e, [
    { label: "✎ Detayları Düzenle", action: () => openLorebookEditor(id, "details") },
    { label: "📄 Kayıtlar (Entries)", action: () => openLorebookEditor(id, "entries") },
    { label: "📤 JSON Dışa Aktar", action: () => exportLorebookJSON(id) },
    { label: "🗑 Sil", danger: true, action: () => deleteLorebook(id) }
  ]);
}

function openRulebookMenu(e, id) {
  openCardPopover(e, [
    { label: "✎ Düzenle", action: () => openRulebookEditor(id) },
    { label: "📤 JSON Dışa Aktar", action: () => exportRulebookJSON(id) },
    { label: "🗑 Sil", danger: true, action: () => deleteRulebook(id) }
  ]);
}

function openGroupMenu(e, id) {
  openCardPopover(e, [
    { label: "💬 Sohbet Et", action: () => openGroupChat(id) },
    { label: "✎ Düzenle", action: () => openGroupForm(id) },
    { label: "🗑 Sil", danger: true, action: () => deleteGroup(id) }
  ]);
}

function openCharInfoModal(cid) {
  const c = characters.find(x => x.id === cid);
  if (!c) return;
  document.getElementById("ci-title").textContent = c.name;
  const tags = (c.tags || "").split(",").map(t => t.trim()).filter(Boolean).map(t => `<span class="sc-chip">${escapeHtml(t)}</span>`).join("");
  document.getElementById("ci-body").innerHTML = `
    <div style="display:flex;gap:16px;margin-bottom:14px;flex-wrap:wrap;">
      ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:110px;height:110px;border-radius:12px;object-fit:cover;" />` : ''}
      <div style="flex:1;min-width:200px;">
        <div style="font-weight:700;font-size:17px;">${escapeHtml(c.name)}</div>
        <div class="muted" style="margin:4px 0 8px;">${escapeHtml(c.title || "")}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${tags}</div>
      </div>
    </div>
    ${c.greeting ? `<div class="sc-field"><div class="sc-label">Karşılama Mesajı</div><div class="rbe-subbox small-text">${formatRoleplay(c.greeting)}</div></div>` : ''}
    ${c.scenario ? `<div class="sc-field"><div class="sc-label">Senaryo</div><div class="rbe-subbox small-text">${formatRoleplay(c.scenario)}</div></div>` : ''}
  `;
  const ciEdit = document.getElementById("ci-edit-btn");
  if (ciEdit) ciEdit.onclick = () => { closeModal("char-info-modal"); openCharacterForm(cid); };
  document.getElementById("ci-chat-btn").onclick = () => { closeModal("char-info-modal"); openChatWith(cid); };
  document.getElementById("char-info-modal").classList.remove("hidden");
}

// ==========================================
// 2. CHATBOT OLUŞTUR / DÜZENLE
// ==========================================
async function loadCharacters() {
  characters = await fetch("/api/characters").then(r => r.json());
  if (currentCharacter) {
    const updated = characters.find(c => c.id === currentCharacter.id);
    if (updated) currentCharacter = updated;
  }
}

async function openCharacterForm(id = null, explicitNavId = null) {
  await Promise.all([loadCharacters(), loadLorebooks(), loadRulebooks()]);
  document.getElementById("c-id").value = "";
  document.getElementById("c-avatar-url").value = "";
  document.getElementById("c-avatar-preview").classList.add("hidden");
  document.getElementById("c-name").value = "";
  document.getElementById("c-title").value = "";
  document.getElementById("c-greeting").value = "";
  document.getElementById("c-personality").value = "";
  document.getElementById("c-scenario").value = "";
  document.getElementById("c-examples").value = "";
  document.getElementById("c-allow-groups").checked = true;
  document.getElementById("form-title").textContent = "Chatbot Oluştur";
  const saveBtn = document.getElementById("c-save-btn");
  if (saveBtn) saveBtn.textContent = "Tamamlandı";
  tagLists.char = [];
  charAttachedLoreIds = [];
  charAttachedRulebookId = null;

  let isEdit = false;
  if (id !== null && id !== undefined && id !== "") {
    const c = characters.find(x => Number(x.id) === Number(id));
    if (c) {
      isEdit = true;
      document.getElementById("form-title").textContent = `Chatbot Düzenle: ${c.name}`;
      if (saveBtn) saveBtn.textContent = "Değişiklikleri Kaydet";
      document.getElementById("c-id").value = c.id;
      document.getElementById("c-name").value = c.name || "";
      document.getElementById("c-title").value = c.title || "";
      document.getElementById("c-greeting").value = c.greeting || "";
      document.getElementById("c-personality").value = c.personality || "";
      document.getElementById("c-scenario").value = c.scenario || "";
      document.getElementById("c-examples").value = c.example_dialogs || "";
      document.getElementById("c-allow-groups").checked = c.allow_in_groups !== 0;
      tagLists.char = (c.tags || "").split(",").map(t => t.trim()).filter(Boolean);
      charAttachedLoreIds = Array.isArray(c.lorebook_ids) ? [...c.lorebook_ids] : [];
      charAttachedRulebookId = c.rulebook_id || null;
      if (c.avatar_url) {
        document.getElementById("c-avatar-url").value = c.avatar_url;
        document.getElementById("c-avatar-preview").src = c.avatar_url;
        document.getElementById("c-avatar-preview").classList.remove("hidden");
      }
    }
  }

  renderTagChips("char");
  renderCharAttachments();
  updateCharFormTokens();
  const targetNav = explicitNavId || (isEdit ? (lastActiveNavId === "nav-home" ? "nav-home" : "nav-mine-chatbots") : "nav-create");
  showView("create", targetNav);
  if (isEdit) {
    const tEl = document.getElementById("topbar-title");
    if (tEl) tEl.textContent = "Chatbot Düzenle";
  }
}

function toggleCharAdvanced() {
  const pane = document.getElementById("c-advanced-pane");
  const btn = document.getElementById("c-adv-toggle");
  const isHid = pane.classList.toggle("hidden");
  btn.textContent = isHid ? "Gelişmiş ⌄" : "Gelişmiş ⌃";
}

function updateCharFormTokens() {
  const n = document.getElementById("c-name").value || "";
  const ti = document.getElementById("c-title").value || "";
  const g = document.getElementById("c-greeting").value || "";
  const p = document.getElementById("c-personality").value || "";
  const s = document.getElementById("c-scenario").value || "";
  const e = document.getElementById("c-examples").value || "";

  document.getElementById("c-name-cnt").textContent = `${n.length}/60`;
  document.getElementById("c-title-cnt").textContent = `${ti.length}/100`;
  document.getElementById("c-greeting-cnt").textContent = `${g.length}/2000 karakter | ${estTokens(g)} token`;
  document.getElementById("c-personality-cnt").textContent = `${p.length}/5000 karakter | ${estTokens(p)} token`;
  document.getElementById("c-scenario-cnt").textContent = `${s.length}/4000 karakter | ${estTokens(s)} token`;
  document.getElementById("c-examples-cnt").textContent = `${e.length}/4000 karakter | ${estTokens(e)} token`;

  const tot = estTokens(n + ti + g + p + s + e);
  document.getElementById("c-total-tokens").textContent = `Token: ${tot} / 2400`;
}

function renderCharAttachments() {
  const lbBox = document.getElementById("c-attached-lorebooks");
  if (lbBox) {
    lbBox.innerHTML = charAttachedLoreIds.map(lid => {
      const lb = lorebooks.find(x => x.id === lid);
      return lb ? `<span class="sc-chip">📖 ${escapeHtml(lb.name)} <button type="button" onclick="charAttachedLoreIds=charAttachedLoreIds.filter(x=>x!==${lid});renderCharAttachments();">✕</button></span>` : "";
    }).join("");
  }
  const rbBox = document.getElementById("c-attached-rulebook");
  if (rbBox) {
    const rb = rulebooks.find(x => x.id === charAttachedRulebookId);
    rbBox.innerHTML = rb ? `<span class="sc-chip">♟ ${escapeHtml(rb.name)} <button type="button" onclick="charAttachedRulebookId=null;renderCharAttachments();">✕</button></span>` : "";
  }
}

async function importCharacterCardIntoForm(input) {
  if (!input.files || !input.files[0]) return;
  const fd = new FormData();
  fd.append("file", input.files[0]);
  try {
    const resp = await fetch("/api/parse-character-card", { method: "POST", body: fd });
    if (!resp.ok) return alert("Kart okunamadı: " + await resp.text());
    const d = await resp.json();
    if (d.name) document.getElementById("c-name").value = d.name;
    if (d.title) document.getElementById("c-title").value = d.title;
    if (d.greeting) document.getElementById("c-greeting").value = d.greeting;
    if (d.personality) document.getElementById("c-personality").value = d.personality;
    if (d.scenario) document.getElementById("c-scenario").value = d.scenario;
    if (d.example_dialogs) document.getElementById("c-examples").value = d.example_dialogs;
    if (d.tags) {
      tagLists.char = d.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 12);
      renderTagChips("char");
    }
    if (d.avatar_url) {
      document.getElementById("c-avatar-url").value = d.avatar_url;
      document.getElementById("c-avatar-preview").src = d.avatar_url;
      document.getElementById("c-avatar-preview").classList.remove("hidden");
    }
    updateCharFormTokens();
  } catch (err) {
    alert("İçe aktarma hatası: " + err.message);
  }
  input.value = "";
}

async function saveCharacterForm(isDraft = false) {
  const name = document.getElementById("c-name").value.trim();
  if (!name) return alert("Lütfen Chatbot için bir ad gir.");
  const id = document.getElementById("c-id").value;
  const payload = {
    name,
    title: document.getElementById("c-title").value.trim(),
    tags: (tagLists.char || []).join(", "),
    greeting: document.getElementById("c-greeting").value,
    personality: document.getElementById("c-personality").value,
    scenario: document.getElementById("c-scenario").value,
    example_dialogs: document.getElementById("c-examples").value,
    avatar_url: document.getElementById("c-avatar-url").value,
    lorebook_ids: charAttachedLoreIds,
    rulebook_id: charAttachedRulebookId,
    allow_in_groups: document.getElementById("c-allow-groups").checked ? 1 : 0,
    is_draft: isDraft ? 1 : 0
  };
  const resp = id
    ? await fetch(`/api/characters/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    : await fetch("/api/characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!resp.ok) return alert("Kaydetme hatası: " + await resp.text());
  await loadCharacters();
  openCreations("chatbots");
}

async function deleteCharacter(id) {
  if (!confirm("Bu chatbot'u ve tüm sohbetlerini silmek istiyor musun?")) return;
  await fetch(`/api/characters/${id}`, { method: "DELETE" });
  await loadCharacters();
  renderCreations();
}

function exportCharacterJSON(id) {
  const c = characters.find(x => x.id === id);
  if (!c) return;
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${c.name.replace(/\s+/g, "_")}.json`;
  a.click();
}

// --- LOREBOOK & RULEBOOK BAĞLAMA MODALLARI ---
function openAttachLorebookModal(ctx) {
  attachContext = ctx;
  const selected = ctx === "group" ? groupAttachedLoreIds : charAttachedLoreIds;
  const list = document.getElementById("attach-lb-list");
  if (!lorebooks.length) {
    list.innerHTML = `<div class="muted small-text" style="padding:16px;text-align:center;">Henüz Lorebook yok. Sol menüden oluşturabilirsin.</div>`;
  } else {
    list.innerHTML = lorebooks.map(lb => `
      <label class="persona-item" style="flex-direction:row;margin:0 0 8px;cursor:pointer;">
        <span style="display:flex;align-items:center;gap:10px;">
          <input type="checkbox" class="att-lb-chk" value="${lb.id}" ${selected.includes(lb.id) ? 'checked' : ''} />
          <span><b>${escapeHtml(lb.name)}</b> <span class="muted small-text">(${(lb.entries || []).length} kayıt)</span></span>
        </span>
      </label>
    `).join("");
  }
  document.getElementById("attach-lorebook-modal").classList.remove("hidden");
}

function applyAttachLorebooks() {
  const ids = [...document.querySelectorAll(".att-lb-chk:checked")].map(el => Number(el.value));
  if (attachContext === "group") {
    groupAttachedLoreIds = ids;
    renderGroupAttachments();
  } else {
    charAttachedLoreIds = ids;
    renderCharAttachments();
  }
  closeModal("attach-lorebook-modal");
}

async function openAttachRulebookModal(ctx) {
  attachContext = ctx;
  await loadRulebooks();
  const curId = ctx === "persona"
    ? personaAttachedRulebookId
    : (ctx === "chat" ? getActiveChatRulebookId() : charAttachedRulebookId);
  const list = document.getElementById("attach-rb-list");
  let html = `
    <label class="persona-item" style="flex-direction:row;margin:0 0 8px;cursor:pointer;">
      <span style="display:flex;align-items:center;gap:10px;">
        <input type="radio" name="att-rb-rad" value="" ${!curId ? 'checked' : ''} />
        <span class="muted">Rulebook Bağlı Değil</span>
      </span>
    </label>`;
  html += rulebooks.map(rb => {
    const mCnt = (rb.data && rb.data.meters) ? rb.data.meters.length : 0;
    return `
      <label class="persona-item" style="flex-direction:row;margin:0 0 8px;cursor:pointer;">
        <span style="display:flex;align-items:center;gap:10px;">
          <input type="radio" name="att-rb-rad" value="${rb.id}" ${curId === rb.id ? 'checked' : ''} />
          <span><b>♟ ${escapeHtml(rb.name)}</b> <span class="muted small-text">(${mCnt} gösterge)</span></span>
        </span>
      </label>`;
  }).join("");
  list.innerHTML = html;
  document.getElementById("attach-rulebook-modal").classList.remove("hidden");
}

async function applyAttachRulebook() {
  const checked = document.querySelector('input[name="att-rb-rad"]:checked');
  const val = checked && checked.value ? Number(checked.value) : null;
  if (attachContext === "persona") {
    personaAttachedRulebookId = val;
    renderPersonaRulebookAttachment();
  } else if (attachContext === "chat" && currentChatId) {
    await fetch(`/api/chats/${currentChatId}/rulebook`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rulebook_id: val })
    });
    await loadChat(currentChatId);
  } else {
    charAttachedRulebookId = val;
    renderCharAttachments();
  }
  closeModal("attach-rulebook-modal");
}

// ==========================================
// 3. LOREBOOK EDİTÖRÜ (DETAYLAR + KAYITLAR + KAYIT DÜZENLE MODALI)
// ==========================================
async function loadLorebooks() {
  lorebooks = await fetch("/api/lorebooks").then(r => r.json());
}

function openLorebookEditor(id = null, initialTab = "details", explicitNavId = null) {
  document.getElementById("lb-id").value = "";
  document.getElementById("lb-cover-url").value = "";
  document.getElementById("lb-cover-preview").classList.add("hidden");
  document.getElementById("lb-cover-clear").classList.add("hidden");
  document.getElementById("lb-name").value = "";
  document.getElementById("lb-desc").value = "";
  document.getElementById("lb-form-title").textContent = "Lorebook Oluştur";
  document.getElementById("lb-form-subname").textContent = "";
  tagLists.lb = [];
  editLoreEntries = [];

  if (id) {
    const lb = lorebooks.find(x => Number(x.id) === Number(id));
    if (lb) {
      document.getElementById("lb-form-title").textContent = "Lorebook Düzenle";
      document.getElementById("lb-form-subname").textContent = lb.name;
      document.getElementById("lb-id").value = lb.id;
      document.getElementById("lb-name").value = lb.name || "";
      document.getElementById("lb-desc").value = lb.description || "";
      tagLists.lb = (lb.tags || "").split(",").map(t => t.trim()).filter(Boolean);
      editLoreEntries = JSON.parse(JSON.stringify(lb.entries || []));
      if (lb.cover_url) {
        document.getElementById("lb-cover-url").value = lb.cover_url;
        document.getElementById("lb-cover-preview").src = lb.cover_url;
        document.getElementById("lb-cover-preview").classList.remove("hidden");
        document.getElementById("lb-cover-clear").classList.remove("hidden");
      }
    }
  }

  updateCounter("lb-name", "lb-name-cnt", 60);
  updateCounter("lb-desc", "lb-desc-cnt", 200);
  renderTagChips("lb");
  renderLoreEntriesList();
  switchLorebookTab(initialTab);
  const targetNav = explicitNavId || (id ? (lastActiveNavId === "nav-lorebooks" ? "nav-lorebooks" : "nav-mine-lorebooks") : "nav-create-lb");
  showView("lorebook-edit", targetNav);
  const tEl = document.getElementById("topbar-title");
  if (tEl) tEl.textContent = id ? "Lorebook Düzenle" : "Lorebook Oluştur";
}

function switchLorebookTab(tab) {
  lbActiveTab = tab;
  document.getElementById("lb-tab-details")?.classList.toggle("active", tab === "details");
  document.getElementById("lb-tab-entries")?.classList.toggle("active", tab === "entries");
  document.getElementById("lb-pane-details")?.classList.toggle("hidden", tab !== "details");
  document.getElementById("lb-pane-entries")?.classList.toggle("hidden", tab !== "entries");
  if (tab === "entries") renderLoreEntriesList();
}

function isStructuredCharEntry(item) {
  if (!item) return false;
  if (item.entry_type === "character") return true;
  return Boolean(
    (item.first_name && item.first_name.trim()) ||
    (item.last_name && item.last_name.trim()) ||
    (item.nationality && item.nationality.trim()) ||
    (item.age && item.age.trim()) ||
    (item.gender && item.gender.trim()) ||
    (item.physical && item.physical.trim()) ||
    (item.personality && item.personality.trim()) ||
    (item.lifestyle && item.lifestyle.trim()) ||
    (item.family && item.family.trim())
  );
}

function buildCharEntryContentText(obj) {
  const idParts = [];
  if (obj.first_name) idParts.push(`Ad: ${obj.first_name}`);
  if (obj.last_name) idParts.push(`Soyad: ${obj.last_name}`);
  if (obj.nationality) idParts.push(`Uyruk: ${obj.nationality}`);
  if (obj.age) idParts.push(`Yaş: ${obj.age}`);
  if (obj.gender) idParts.push(`Cinsiyet: ${obj.gender}`);
  const lines = [];
  if (idParts.length) lines.push(idParts.join(" | "));
  if (obj.physical) lines.push(`Fiziksel Özellikleri: ${obj.physical}`);
  if (obj.personality) lines.push(`Kişisel Özellikleri: ${obj.personality}`);
  if (obj.lifestyle) lines.push(`Yaşantısı: ${obj.lifestyle}`);
  if (obj.family) lines.push(`Ailesi: ${obj.family}`);
  if (obj.extra_notes) lines.push(`Ek Notlar: ${obj.extra_notes}`);
  return lines.join("\n");
}

function renderLoreEntriesList() {
  const box = document.getElementById("lore-entries-list");
  const cnt = document.getElementById("lb-entry-count");
  if (!box) return;
  const q = (document.getElementById("lb-entry-search")?.value || "").toLowerCase().trim();
  const sort = document.getElementById("lb-entry-sort")?.value || "latest";

  let indexed = editLoreEntries.map((item, idx) => ({ item, idx }));
  if (q) {
    indexed = indexed.filter(({ item }) => {
      const hay = [
        item.name, item.first_name, item.last_name, item.nationality, item.age, item.gender,
        item.physical, item.personality, item.lifestyle, item.family, item.extra_notes,
        Array.isArray(item.keys) ? item.keys.join(" ") : item.keys, item.content
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }
  if (sort === "az") indexed.sort((a, b) => (a.item.name || "").localeCompare(b.item.name || "", "tr"));
  else if (sort === "za") indexed.sort((a, b) => (b.item.name || "").localeCompare(a.item.name || "", "tr"));

  if (cnt) cnt.textContent = `${editLoreEntries.length}/5.000 kayıt`;

  if (!indexed.length) {
    box.innerHTML = `<div class="muted small-text" style="text-align:center;padding:28px;">Henüz kayıt yok. Yukarıdaki <b>Kayıt Ekle</b> butonuna tıkla!</div>`;
    return;
  }

  box.innerHTML = indexed.map(({ item, idx }) => {
    const isChar = isStructuredCharEntry(item);
    const fullName = isChar
      ? (`${item.first_name || ""} ${item.last_name || ""}`.trim() || item.name || "(İsimsiz Karakter)")
      : (item.name || "(İsimsiz Kayıt)");
    const kws = Array.isArray(item.keys) ? item.keys : String(item.keys || "").split(",").map(x => x.trim()).filter(Boolean);
    const shownKws = kws.slice(0, 4).join(", ") + (kws.length > 4 ? ` +${kws.length - 4}` : "");
    const pills = isChar
      ? [item.nationality, item.age ? `${item.age} yaş` : "", item.gender].filter(Boolean)
          .map(p => `<span class="sc-entry-meta-pill">${escapeHtml(p)}</span>`).join("")
      : "";
    const previewTxt = isChar
      ? [item.physical, item.personality, item.lifestyle, item.family, item.extra_notes, item.content].filter(Boolean).join(" · ")
      : (item.content || "");
    return `
      <div class="sc-entry-item" onclick="openEntryModal(${idx})">
        <div class="sc-entry-head-row">
          <div class="sc-entry-name">${isChar ? "👤" : "🌍"} ${escapeHtml(fullName)}</div>
          ${pills ? `<div class="sc-entry-pills">${pills}</div>` : ""}
        </div>
        <div class="sc-entry-kws">${escapeHtml(shownKws || (item.always_active ? "Her zaman aktif" : (isChar ? "Ad/Soyad ile otomatik aktif" : "Anahtar kelime yok")))}</div>
        <div class="sc-entry-preview">${escapeHtml(previewTxt)}</div>
      </div>`;
  }).join("");
}

function switchEntryModalType(type) {
  const mode = (type === "general") ? "general" : "character";
  const prevMode = document.getElementById("em-type").value;
  document.getElementById("em-type").value = mode;
  document.getElementById("em-tab-char")?.classList.toggle("active", mode === "character");
  document.getElementById("em-tab-gen")?.classList.toggle("active", mode === "general");
  document.getElementById("em-char-fields")?.classList.toggle("hidden", mode !== "character");
  document.getElementById("em-general-fields")?.classList.toggle("hidden", mode !== "general");
  const hint = document.getElementById("em-kw-opt-hint");
  if (hint) hint.textContent = mode === "character" ? "(Ad ve Soyad otomatik tetiklenir)" : "";

  // Eski genel kaydi karakter profiline cevirirken isim ve icerigi kaybetme
  if (prevMode === "general" && mode === "character") {
    const genName = document.getElementById("em-name").value.trim();
    const genContent = document.getElementById("em-content").value.trim();
    if (genName && !document.getElementById("em-first-name").value.trim()) {
      const parts = genName.split(/\s+/);
      document.getElementById("em-first-name").value = parts[0] || "";
      document.getElementById("em-last-name").value = parts.slice(1).join(" ");
    }
    if (genContent && !document.getElementById("em-extra-notes").value.trim()) {
      document.getElementById("em-extra-notes").value = genContent;
    }
  } else if (prevMode === "character" && mode === "general") {
    const full = `${document.getElementById("em-first-name").value.trim()} ${document.getElementById("em-last-name").value.trim()}`.trim();
    if (full && !document.getElementById("em-name").value.trim()) {
      document.getElementById("em-name").value = full;
      updateCounter("em-name", "em-name-cnt", 60);
    }
  }
}

function openEntryModal(idx = null) {
  const isNew = (idx === null || idx === undefined);
  document.getElementById("em-idx").value = isNew ? "" : String(idx);
  document.getElementById("em-title").textContent = isNew ? "Yeni Karakter / Kayıt Ekle" : "Kaydı Düzenle";
  document.getElementById("em-save-btn").textContent = isNew ? "Ekle" : "Güncelle";
  document.getElementById("em-del-btn").classList.toggle("hidden", isNew);

  // Tum alanlari temizle
  ["em-first-name", "em-last-name", "em-nationality", "em-age", "em-gender",
   "em-physical", "em-personality", "em-lifestyle", "em-family", "em-extra-notes",
   "em-name", "em-content", "em-kw-input"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  if (isNew) {
    document.getElementById("em-always").checked = false;
    entryModalKeywords = [];
    document.getElementById("em-type").value = "character";
    switchEntryModalType("character");
  } else {
    const it = editLoreEntries[idx];
    const isChar = isStructuredCharEntry(it);
    document.getElementById("em-always").checked = Boolean(it.always_active);
    entryModalKeywords = Array.isArray(it.keys) ? [...it.keys] : String(it.keys || "").split(",").map(x => x.trim()).filter(Boolean);
    if (isChar) {
      document.getElementById("em-first-name").value = it.first_name || "";
      document.getElementById("em-last-name").value = it.last_name || "";
      document.getElementById("em-nationality").value = it.nationality || "";
      document.getElementById("em-age").value = it.age || "";
      document.getElementById("em-gender").value = it.gender || "";
      document.getElementById("em-physical").value = it.physical || "";
      document.getElementById("em-personality").value = it.personality || "";
      document.getElementById("em-lifestyle").value = it.lifestyle || "";
      document.getElementById("em-family").value = it.family || "";
      document.getElementById("em-extra-notes").value = it.extra_notes || "";
      document.getElementById("em-type").value = "character";
      switchEntryModalType("character");
    } else {
      document.getElementById("em-name").value = it.name || "";
      document.getElementById("em-content").value = it.content || "";
      document.getElementById("em-type").value = "general";
      switchEntryModalType("general");
    }
  }
  updateCounter("em-name", "em-name-cnt", 60);
  renderEntryKeywordChips();
  document.getElementById("entry-modal").classList.remove("hidden");
}

function renderEntryKeywordChips() {
  const box = document.getElementById("em-kw-chips");
  const cnt = document.getElementById("em-kw-cnt");
  if (box) {
    box.innerHTML = entryModalKeywords.map((kw, i) => `
      <span class="sc-chip">${escapeHtml(kw)} <button type="button" onclick="event.stopPropagation();entryModalKeywords.splice(${i},1);renderEntryKeywordChips();">✕</button></span>
    `).join("");
  }
  if (cnt) cnt.textContent = `${entryModalKeywords.length}/12`;
}

function handleEntryKwKey(e) {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    const val = e.target.value.replace(/,/g, "").trim();
    if (val && entryModalKeywords.length < 12 && !entryModalKeywords.includes(val)) {
      entryModalKeywords.push(val);
    }
    e.target.value = "";
    renderEntryKeywordChips();
  } else if (e.key === "Backspace" && !e.target.value && entryModalKeywords.length) {
    entryModalKeywords.pop();
    renderEntryKeywordChips();
  }
}

function clearEntryKeywords() {
  entryModalKeywords = [];
  renderEntryKeywordChips();
}

async function saveEntryFromModal() {
  const pendingKw = document.getElementById("em-kw-input").value.replace(/,/g, "").trim();
  if (pendingKw && entryModalKeywords.length < 12 && !entryModalKeywords.includes(pendingKw)) {
    entryModalKeywords.push(pendingKw);
  }
  const mode = document.getElementById("em-type").value || "character";
  const always_active = document.getElementById("em-always").checked;
  const idxStr = document.getElementById("em-idx").value;
  const baseId = idxStr === "" ? Date.now() : (editLoreEntries[Number(idxStr)]?.id || Date.now());

  let entryObj;
  if (mode === "character") {
    const first_name = document.getElementById("em-first-name").value.trim();
    const last_name = document.getElementById("em-last-name").value.trim();
    const nationality = document.getElementById("em-nationality").value.trim();
    const age = document.getElementById("em-age").value.trim();
    const gender = document.getElementById("em-gender").value.trim();
    const physical = document.getElementById("em-physical").value.trim();
    const personality = document.getElementById("em-personality").value.trim();
    const lifestyle = document.getElementById("em-lifestyle").value.trim();
    const family = document.getElementById("em-family").value.trim();
    const extra_notes = document.getElementById("em-extra-notes").value.trim();

    if (!first_name) return alert("Karakterin Adı zorunludur.");
    const fullName = `${first_name} ${last_name}`.trim();

    const charProfile = {
      first_name, last_name, nationality, age, gender,
      physical, personality, lifestyle, family, extra_notes
    };
    const autoContent = buildCharEntryContentText(charProfile);
    if (!autoContent) return alert("En az bir karakter detayı doldurmalısın.");

    // Ad ve Soyad'i otomatik anahtar kelimelere ekleme zorunlulugu yok (backend otomatik eslestirir),
    // ama kullanicinin eklediklerini temiz saklayalim
    entryObj = {
      id: baseId,
      entry_type: "character",
      name: fullName,
      ...charProfile,
      keys: entryModalKeywords.join(", "),
      content: autoContent,
      always_active,
      enabled: true
    };
  } else {
    const name = document.getElementById("em-name").value.trim();
    const content = document.getElementById("em-content").value.trim();
    if (!name) return alert("Kayıt adı zorunludur.");
    if (!content) return alert("İçerik zorunludur.");
    entryObj = {
      id: baseId,
      entry_type: "general",
      name,
      keys: entryModalKeywords.join(", "),
      content,
      always_active,
      enabled: true
    };
  }

  if (idxStr === "") editLoreEntries.unshift(entryObj);
  else editLoreEntries[Number(idxStr)] = entryObj;

  closeModal("entry-modal");
  renderLoreEntriesList();

  // Eğer kayıtlı bir Lorebook düzenleniyorsa anında veritabanına da kaydet
  if (document.getElementById("lb-id").value) {
    await saveStandaloneLorebook(true);
  }
}

async function deleteEntryFromModal() {
  const idxStr = document.getElementById("em-idx").value;
  if (idxStr === "") return;
  if (!confirm("Bu kayıt silinsin mi?")) return;
  editLoreEntries.splice(Number(idxStr), 1);
  closeModal("entry-modal");
  renderLoreEntriesList();
  if (document.getElementById("lb-id").value) {
    await saveStandaloneLorebook(true);
  }
}

async function saveStandaloneLorebook(stayHere = false) {
  const name = document.getElementById("lb-name").value.trim();
  if (!name) return alert("Lütfen Lorebook adını gir.");
  const id = document.getElementById("lb-id").value;
  const payload = {
    name,
    description: document.getElementById("lb-desc").value.trim(),
    cover_url: document.getElementById("lb-cover-url").value,
    tags: (tagLists.lb || []).join(", "),
    is_draft: 0,
    entries: editLoreEntries
  };
  if (id) {
    await fetch(`/api/lorebooks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } else {
    const res = await fetch("/api/lorebooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(r => r.json());
    document.getElementById("lb-id").value = res.id;
  }
  await loadLorebooks();
  await loadCharacters();
  if (!stayHere) openCreations("lorebooks");
}

async function deleteLorebook(id) {
  if (!confirm("Bu Lorebook silinsin mi?")) return;
  await fetch(`/api/lorebooks/${id}`, { method: "DELETE" });
  await loadLorebooks();
  await loadCharacters();
  renderCreations();
}

function exportLorebookJSON(id) {
  const lb = lorebooks.find(x => Number(x.id) === Number(id));
  if (!lb) return;
  const blob = new Blob([JSON.stringify(lb, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${lb.name.replace(/\s+/g, "_")}.lorebook.json`;
  a.click();
}

async function importStandaloneLorebook(input, openAfter = false) {
  if (!input.files || !input.files[0]) return;
  try {
    const raw = JSON.parse(await input.files[0].text());
    const entries = Array.isArray(raw) ? raw : (Array.isArray(raw.entries) ? raw.entries : Object.values(raw.entries || {}));
    const normEntries = entries.map((e, i) => ({
      id: e.id || Date.now() + i,
      entry_type: e.entry_type || (e.first_name ? "character" : "general"),
      name: e.name || e.comment || e.title || `${e.first_name || ""} ${e.last_name || ""}`.trim() || `Kayıt ${i + 1}`,
      first_name: e.first_name || "",
      last_name: e.last_name || "",
      nationality: e.nationality || "",
      age: e.age || "",
      gender: e.gender || "",
      physical: e.physical || "",
      personality: e.personality || "",
      lifestyle: e.lifestyle || "",
      family: e.family || "",
      extra_notes: e.extra_notes || "",
      keys: Array.isArray(e.keys || e.key) ? (e.keys || e.key).join(", ") : String(e.keys || e.key || ""),
      content: e.content || e.entry || "",
      always_active: Boolean(e.always_active || e.constant),
      enabled: e.enabled !== false
    }));
    const res = await fetch("/api/lorebooks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: raw.name || input.files[0].name.replace(/\.json$/i, ""),
        description: raw.description || "JSON'dan içe aktarıldı",
        cover_url: raw.cover_url || "",
        tags: Array.isArray(raw.tags) ? raw.tags.join(", ") : (raw.tags || ""),
        entries: normEntries
      })
    }).then(r => r.json());
    await loadLorebooks();
    if (openAfter && res.id) openLorebookEditor(res.id, "entries");
    else openCreations("lorebooks");
  } catch (e) {
    alert("Lorebook JSON okunamadı: " + e.message);
  }
  input.value = "";
}

// ==========================================
// 4. GRUP OLUŞTUR / DÜZENLE (TAM SAYFA)
// ==========================================
async function loadGroups() {
  groups = await fetch("/api/groups").then(r => r.json());
}

async function openGroupForm(id = null, explicitNavId = null) {
  await Promise.all([loadGroups(), loadCharacters(), loadLorebooks()]);
  document.getElementById("g-id").value = "";
  document.getElementById("g-avatar-url").value = "";
  document.getElementById("g-avatar-preview").classList.add("hidden");
  document.getElementById("g-name").value = "";
  document.getElementById("g-title").value = "";
  document.getElementById("g-greeting").value = "";
  document.getElementById("g-scenario").value = "";
  document.getElementById("g-form-title").textContent = "Grup Oluştur";
  const gSaveBtn = document.getElementById("g-save-btn");
  if (gSaveBtn) gSaveBtn.textContent = "Grubu Oluştur ve Sohbet Et";
  tagLists.group = [];
  groupMemberIds = [];
  groupFirstSpeakerId = null;
  groupAttachedLoreIds = [];

  let isEdit = false;
  if (id !== null && id !== undefined && id !== "") {
    const g = groups.find(x => Number(x.id) === Number(id));
    if (g) {
      isEdit = true;
      document.getElementById("g-form-title").textContent = `Grup Düzenle: ${g.name}`;
      if (gSaveBtn) gSaveBtn.textContent = "Grubu Güncelle ve Sohbet Et";
      document.getElementById("g-id").value = g.id;
      document.getElementById("g-name").value = g.name || "";
      document.getElementById("g-title").value = g.title || "";
      document.getElementById("g-greeting").value = g.greeting || "";
      document.getElementById("g-scenario").value = g.scenario || "";
      tagLists.group = (g.tags || "").split(",").map(t => t.trim()).filter(Boolean);
      groupMemberIds = Array.isArray(g.member_ids) ? [...g.member_ids] : [];
      groupFirstSpeakerId = g.first_speaker_id || null;
      groupAttachedLoreIds = Array.isArray(g.lorebook_ids) ? [...g.lorebook_ids] : [];
      if (g.avatar_url) {
        document.getElementById("g-avatar-url").value = g.avatar_url;
        document.getElementById("g-avatar-preview").src = g.avatar_url;
        document.getElementById("g-avatar-preview").classList.remove("hidden");
      }
    }
  }

  renderTagChips("group");
  renderGroupMembersUI();
  renderGroupAttachments();
  updateGroupFormTokens();
  const targetNav = explicitNavId || (isEdit ? "nav-mine-groups" : "nav-create-group");
  showView("group-create", targetNav);
  if (isEdit) {
    const tEl = document.getElementById("topbar-title");
    if (tEl) tEl.textContent = "Grup Düzenle";
  }
}

function updateGroupFormTokens() {
  const n = document.getElementById("g-name").value || "";
  const ti = document.getElementById("g-title").value || "";
  const g = document.getElementById("g-greeting").value || "";
  const s = document.getElementById("g-scenario").value || "";
  document.getElementById("g-name-cnt").textContent = `${n.length}/50`;
  document.getElementById("g-title-cnt").textContent = `${ti.length}/100`;
  document.getElementById("g-greeting-cnt").textContent = `${g.length} karakter / ${estTokens(g)} token`;
  document.getElementById("g-scenario-cnt").textContent = `${s.length} karakter / ${estTokens(s)} token`;
  document.getElementById("g-total-tokens").textContent = `Token: ${estTokens(n + ti + g + s)} / 2400`;
}

function renderGroupMembersUI() {
  document.getElementById("g-members-cnt").textContent = groupMemberIds.length;
  const box = document.getElementById("g-members-chips");
  box.innerHTML = groupMemberIds.map(cid => {
    const c = characters.find(x => x.id === cid);
    return c ? `<span class="sc-chip">${escapeHtml(c.name)} <button type="button" onclick="groupMemberIds=groupMemberIds.filter(x=>x!==${cid});if(groupFirstSpeakerId===${cid})groupFirstSpeakerId=null;renderGroupMembersUI();">✕</button></span>` : "";
  }).join("");

  const fsBox = document.getElementById("g-first-speaker-pills");
  let fsHtml = `<button type="button" class="loc-pill-btn ${!groupFirstSpeakerId ? 'selected' : ''}" onclick="groupFirstSpeakerId=null;renderGroupMembersUI();">Grup (Genel)</button>`;
  for (const cid of groupMemberIds) {
    const c = characters.find(x => x.id === cid);
    if (c) {
      fsHtml += `<button type="button" class="loc-pill-btn ${groupFirstSpeakerId === cid ? 'selected' : ''}" onclick="groupFirstSpeakerId=${cid};renderGroupMembersUI();">${escapeHtml(c.name)}</button>`;
    }
  }
  fsBox.innerHTML = fsHtml;
}

function renderGroupAttachments() {
  const box = document.getElementById("g-attached-lorebooks");
  if (!box) return;
  box.innerHTML = groupAttachedLoreIds.map(lid => {
    const lb = lorebooks.find(x => x.id === lid);
    return lb ? `<span class="sc-chip">📖 ${escapeHtml(lb.name)} <button type="button" onclick="groupAttachedLoreIds=groupAttachedLoreIds.filter(x=>x!==${lid});renderGroupAttachments();">✕</button></span>` : "";
  }).join("");
}

function openMemberPickerModal() {
  document.getElementById("mp-search").value = "";
  renderMemberPickerList();
  document.getElementById("member-picker-modal").classList.remove("hidden");
}

function renderMemberPickerList() {
  const q = (document.getElementById("mp-search").value || "").toLowerCase().trim();
  const list = characters.filter(c => c.allow_in_groups !== 0 && (!q || c.name.toLowerCase().includes(q)));
  document.getElementById("mp-list").innerHTML = list.map(c => `
    <label class="persona-item" style="flex-direction:row;margin:0;cursor:pointer;">
      <span style="display:flex;align-items:center;gap:10px;">
        <input type="checkbox" class="mp-chk" value="${c.id}" ${groupMemberIds.includes(c.id) ? 'checked' : ''} />
        ${c.avatar_url ? `<img src="${c.avatar_url}" style="width:30px;height:30px;border-radius:7px;object-fit:cover;" />` : ''}
        <span><b>${escapeHtml(c.name)}</b> <span class="muted small-text">${escapeHtml(c.title || "")}</span></span>
      </span>
    </label>
  `).join("") || `<div class="muted small-text">Uygun chatbot bulunamadı.</div>`;
}

function applyMemberPicker() {
  const ids = [...document.querySelectorAll(".mp-chk:checked")].map(el => Number(el.value)).slice(0, 10);
  groupMemberIds = ids;
  if (groupFirstSpeakerId && !ids.includes(groupFirstSpeakerId)) groupFirstSpeakerId = null;
  renderGroupMembersUI();
  closeModal("member-picker-modal");
}

async function saveGroupForm(isDraft = false, startChat = false) {
  const name = document.getElementById("g-name").value.trim();
  if (!name) return alert("Grup adı zorunludur.");
  if (!isDraft && groupMemberIds.length < 2) return alert("En az 2 grup üyesi seçmelisin.");
  const id = document.getElementById("g-id").value;
  const payload = {
    name,
    title: document.getElementById("g-title").value.trim(),
    greeting: document.getElementById("g-greeting").value,
    scenario: document.getElementById("g-scenario").value,
    tags: (tagLists.group || []).join(", "),
    avatar_url: document.getElementById("g-avatar-url").value,
    member_ids: groupMemberIds,
    first_speaker_id: groupFirstSpeakerId,
    lorebook_ids: groupAttachedLoreIds,
    is_draft: isDraft ? 1 : 0
  };
  let savedId = id ? Number(id) : null;
  if (id) {
    await fetch(`/api/groups/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } else {
    const res = await fetch("/api/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then(r => r.json());
    savedId = res.id;
  }
  await loadGroups();
  if (startChat && savedId) openGroupChat(savedId);
  else openCreations("groups");
}

async function deleteGroup(gid) {
  if (!confirm("Bu grubu silmek istiyor musun?")) return;
  await fetch(`/api/groups/${gid}`, { method: "DELETE" });
  await loadGroups();
  renderCreations();
}

// ==========================================
// 5. PERSONALARIM (TAM SAYFA 3 SÜTUN) & PERSONA EDİT
// ==========================================
async function loadPersonas() {
  personas = await fetch("/api/personas").then(r => r.json());
  const sel = document.getElementById("chat-persona-select");
  if (sel) {
    sel.innerHTML = personas.map(p => `<option value="${p.id}">${escapeHtml(p.name)}${p.is_default ? ' (Varsayılan)' : ''}</option>`).join("");
  }
}

function renderPersonasView() {
  const grid = document.getElementById("personas-grid");
  if (!grid) return;
  const q = (document.getElementById("ps-search-input")?.value || "").toLowerCase().trim();
  const list = personas.filter(p => !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));

  if (!list.length) {
    grid.innerHTML = `<div class="muted" style="grid-column:1/-1;text-align:center;padding:40px;">Persona bulunamadı.</div>`;
    return;
  }
  grid.innerHTML = list.map(p => {
    const av = p.avatar_url
      ? `<img src="${p.avatar_url}" alt="" />`
      : `<div class="cb-img-letter">${escapeHtml(p.name[0] || "?")}</div>`;
    return `
      <div class="ps-card" onclick="openPersonaEditor(${p.id})">
        <div class="ps-img-wrap">
          ${av}
          ${p.is_default ? `<span class="ps-def-badge">✓ Varsayılan</span>` : ""}
          <button type="button" class="ps-dots-btn" onclick="openPersonaMenu(event, ${p.id})">⋮</button>
        </div>
        <div class="ps-body">
          <div class="ps-name">${escapeHtml(p.name)}</div>
          <div class="ps-desc">${escapeHtml(p.description || "Açıklama eklenmemiş...")}</div>
          ${p.rulebook_name ? `<div style="margin-top:auto;padding-top:6px;"><span class="mini-priv-pill" style="color:#60a5fa;border-color:rgba(59,130,246,0.35);">♟ ${escapeHtml(p.rulebook_name)}</span></div>` : ""}
        </div>
      </div>`;
  }).join("");
}

function openPersonaMenu(e, pid) {
  openCardPopover(e, [
    { label: "✎ Düzenle", action: () => openPersonaEditor(pid) },
    { label: "✓ Varsayılan Yap", action: () => setPersonaDefault(pid) },
    { label: "🗑 Sil", danger: true, action: () => deletePersona(pid) }
  ]);
}

async function openPersonaEditor(pid = null) {
  await loadRulebooks();
  document.getElementById("pe-id").value = "";
  document.getElementById("pe-avatar-url").value = "";
  document.getElementById("pe-avatar-preview").classList.add("hidden");
  document.getElementById("pe-name").value = "";
  document.getElementById("pe-desc").value = "";
  document.getElementById("pe-default").checked = false;
  personaAttachedRulebookId = null;
  document.getElementById("pe-form-title").textContent = pid ? "Persona Düzenle" : "Yeni Persona Oluştur";
  document.getElementById("pe-save-btn").textContent = pid ? "Personayı Güncelle" : "Persona Oluştur";

  if (pid) {
    const p = personas.find(x => Number(x.id) === Number(pid));
    if (p) {
      document.getElementById("pe-id").value = p.id;
      document.getElementById("pe-name").value = p.name || "";
      document.getElementById("pe-desc").value = p.description || "";
      document.getElementById("pe-default").checked = Boolean(p.is_default);
      personaAttachedRulebookId = p.rulebook_id || null;
      if (p.avatar_url) {
        document.getElementById("pe-avatar-url").value = p.avatar_url;
        document.getElementById("pe-avatar-preview").src = p.avatar_url;
        document.getElementById("pe-avatar-preview").classList.remove("hidden");
      }
    }
  }
  updateCounter("pe-name", "pe-name-cnt", 30);
  updateCounter("pe-desc", "pe-desc-cnt", 1000);
  renderPersonaRulebookAttachment();
  showView("persona-edit");
}

function renderPersonaRulebookAttachment() {
  const box = document.getElementById("pe-attached-rulebook");
  if (!box) return;
  const rb = rulebooks.find(x => x.id === personaAttachedRulebookId);
  box.innerHTML = rb ? `<span class="sc-chip">♟ ${escapeHtml(rb.name)} <button type="button" onclick="personaAttachedRulebookId=null;renderPersonaRulebookAttachment();">✕</button></span>` : "";
}

async function savePersonaForm() {
  const id = document.getElementById("pe-id").value;
  const payload = {
    name: document.getElementById("pe-name").value.trim() || "Kullanıcı",
    description: document.getElementById("pe-desc").value,
    avatar_url: document.getElementById("pe-avatar-url").value,
    rulebook_id: personaAttachedRulebookId,
    is_default: document.getElementById("pe-default").checked ? 1 : 0
  };
  if (id) await fetch(`/api/personas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  else await fetch("/api/personas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  await loadPersonas();
  showView("personas");
}

async function setPersonaDefault(pid) {
  const p = personas.find(x => Number(x.id) === Number(pid));
  if (!p) return;
  await fetch(`/api/personas/${pid}`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: p.name, description: p.description || "", avatar_url: p.avatar_url || "", rulebook_id: p.rulebook_id || null, is_default: 1 })
  });
  await loadPersonas();
  renderPersonasView();
}

async function deletePersona(id) {
  if (personas.length <= 1) return alert("En az bir persona kalmalı.");
  if (!confirm("Bu persona silinsin mi?")) return;
  await fetch(`/api/personas/${id}`, { method: "DELETE" });
  await loadPersonas();
  renderPersonasView();
}

// ==========================================
// 6. PROFİL AYARLARI & GENEL AYARLAR
// ==========================================
async function openProfileView() {
  const s = await fetch("/api/settings").then(r => r.json());
  appSettings = s;

  document.getElementById("prof-username").value = s.profile_username || "meir9";
  document.getElementById("prof-name").value = s.profile_name || "Deniz";
  document.getElementById("prof-highlights").value = s.profile_highlights || "";
  document.getElementById("prof-avatar-url").value = s.profile_avatar || "";
  const pav = document.getElementById("prof-avatar-preview");
  if (s.profile_avatar) { pav.src = s.profile_avatar; pav.classList.remove("hidden"); }
  else pav.classList.add("hidden");

  updateCounter("prof-username", "prof-user-cnt", 20);
  updateCounter("prof-name", "prof-name-cnt", 20);
  updateCounter("prof-highlights", "prof-hl-cnt", 1000);

  showView("profile", null);
}

async function openSettingsView(openAdvanced = false) {
  const s = await fetch("/api/settings").then(r => r.json());
  appSettings = s;

  document.getElementById("prof-show-nsfw").checked = (s.show_nsfw ?? "1") === "1";
  document.getElementById("prof-blur-nsfw").checked = (s.blur_nsfw ?? "0") === "1";
  const askP = document.getElementById("prof-ask-persona");
  if (askP) askP.checked = (s.skip_persona_picker ?? "0") !== "1";
  document.getElementById("prof-val-model").textContent = s.model_name ? s.model_name.slice(0, 26) : "Otomatik";
  const uiL = document.getElementById("set-ui-lang");
  if (uiL) uiL.value = s.ui_lang || "tr";
  const uObj = (typeof UI_LANGUAGES !== "undefined") ? UI_LANGUAGES.find(x => x.code === (s.ui_lang || "tr")) : null;
  const pvu = document.getElementById("prof-val-ui-lang");
  if (pvu) pvu.textContent = uObj ? uObj.label : "Türkçe";
  const cObj = (typeof CHAT_LANGUAGES !== "undefined") ? CHAT_LANGUAGES.find(x => x.value === (s.preferred_lang || "Türkçe")) : null;
  document.getElementById("prof-val-lang").textContent = cObj ? cObj.label : (s.preferred_lang || "Türkçe");
  const spdEl = document.getElementById("set-speed-mode");
  if (spdEl) spdEl.value = s.speed_mode || "turbo";

  const emEl = document.getElementById("set-app-engine-mode"); if (emEl) emEl.value = s.app_engine_mode || "lmstudio";
  const mkEl = document.getElementById("set-app-model-key"); if (mkEl) mkEl.value = s.app_model_key || "gemma";
  const gpEl = document.getElementById("set-app-gguf-path"); if (gpEl) gpEl.value = s.app_gguf_path || "";
  const cmEl = document.getElementById("set-app-cpu-moe"); if (cmEl) cmEl.value = s.app_cpu_moe || "26";
  const csEl = document.getElementById("set-app-ctx-size"); if (csEl) csEl.value = s.app_ctx_size || "4096";
  const ueEl = document.getElementById("set-app-unload-exit"); if (ueEl) ueEl.checked = (s.app_unload_on_exit ?? "0") === "1";
  const modeMap = { lmstudio: "LM Studio", llama_server: "Turbo llama-server", manual: "Manuel" };
  const pve = document.getElementById("prof-val-engine"); if (pve) pve.textContent = modeMap[s.app_engine_mode || "lmstudio"] || "LM Studio";
  document.getElementById("set-api-url").value = s.api_url || "";
  document.getElementById("set-model").value = s.model_name || "";
  document.getElementById("set-lang").value = s.preferred_lang || "Türkçe";
  document.getElementById("set-theme").value = s.theme || "dark";
  document.getElementById("set-font-size").value = s.font_size || "15";
  document.getElementById("set-bg-url").value = s.chat_bg_url || "";

  document.getElementById("set-tone").value = s.story_tone || "emotional";
  document.getElementById("set-preset").value = s.preset || "turkish_rp";
  document.getElementById("set-temp").value = s.temperature || "0.85";
  document.getElementById("set-rep").value = s.rep_penalty || "1.02";
  const stp = document.getElementById("set-top-p"); if (stp) stp.value = s.top_p || "0.95";
  const stk = document.getElementById("set-top-k"); if (stk) stk.value = s.top_k || "64";
  document.getElementById("set-min-p").value = s.min_p || "0.05";
  document.getElementById("set-pres-pen").value = s.presence_penalty || "0.0";
  document.getElementById("set-freq-pen").value = s.frequency_penalty || "0.0";
  document.getElementById("set-max-tokens").value = s.max_tokens || "2048";
  document.getElementById("set-ctx-msgs").value = s.context_messages || "16";
  document.getElementById("set-auto-sum-every").value = s.auto_summarize_every || "8";
  document.getElementById("set-strict").checked = (s.strict_consistency ?? "1") === "1";
  document.getElementById("set-no-think").checked = (s.no_think_prefix ?? "1") === "1";
  document.getElementById("set-auto-mem").checked = (s.auto_memory_enabled ?? "1") === "1";
  const aiJ = document.getElementById("set-ai-judge"); if (aiJ) aiJ.checked = (s.ai_judge_enabled ?? "0") === "1";
  const lsEl = document.getElementById("set-live-stream"); if (lsEl) lsEl.checked = (s.live_stream ?? "0") === "1";
  document.getElementById("set-sys-prompt").value = s.system_prompt || "";

  const clm = document.getElementById("set-cloud-llm-mode"); if (clm) clm.value = s.cloud_llm_mode || "hybrid_auto";
  const plm = document.getElementById("set-pc-llm-mode"); if (plm) plm.value = s.pc_llm_mode || "local";
  const rgu = document.getElementById("set-remote-gpu-url"); if (rgu) rgu.value = s.remote_gpu_url || "";
  const rgm = document.getElementById("set-remote-gpu-model"); if (rgm) rgm.value = s.remote_gpu_model || "";
  const cau = document.getElementById("set-cloud-api-url"); if (cau) cau.value = s.cloud_api_url || "https://openrouter.ai/api/v1";
  const cak = document.getElementById("set-cloud-api-key"); if (cak) cak.value = s.cloud_api_key || "";
  const cam = document.getElementById("set-cloud-api-model"); if (cam) cam.value = s.cloud_api_model || "google/gemma-3-27b-it:free";
  refreshCloudOverview();

  showView("settings", "nav-settings");
  if (openAdvanced) {
    document.getElementById("prof-sub-advanced")?.classList.remove("hidden");
  }
}

function toggleProfSub(id) {
  document.getElementById(id)?.classList.toggle("hidden");
}

async function onChangeUiLang(code) {
  appSettings.ui_lang = code || "tr";
  if (typeof applyUiLanguage === "function") applyUiLanguage(appSettings.ui_lang);
  await fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ui_lang: appSettings.ui_lang })
  });
}

async function applySpeedMode(mode, source = "profile") {
  const presets = {
    ultra:    { max_tokens: "180", context_messages: "6",  max_prompt_chars: "3600", auto_memory_enabled: "0", ai_judge_enabled: "0" },
    turbo:    { max_tokens: "280", context_messages: "8",  max_prompt_chars: "5200", auto_memory_enabled: "0", ai_judge_enabled: "0" },
    balanced: { max_tokens: "460", context_messages: "12", max_prompt_chars: "7800", auto_memory_enabled: "0", ai_judge_enabled: "0" },
    long:     { max_tokens: "750", context_messages: "16", max_prompt_chars: "10500", auto_memory_enabled: "1", ai_judge_enabled: "0" }
  };
  const cfg = presets[mode] || presets.turbo;
  if (source === "modal") {
    const mt = document.getElementById("gs-max-tokens"); if (mt) mt.value = cfg.max_tokens;
    const cm = document.getElementById("gs-ctx-msgs"); if (cm) cm.value = cfg.context_messages;
    const aj = document.getElementById("gs-ai-judge"); if (aj) aj.checked = cfg.ai_judge_enabled === "1";
  } else {
    const mt = document.getElementById("set-max-tokens"); if (mt) mt.value = cfg.max_tokens;
    const cm = document.getElementById("set-ctx-msgs"); if (cm) cm.value = cfg.context_messages;
    const am = document.getElementById("set-auto-mem"); if (am) am.checked = cfg.auto_memory_enabled === "1";
    const aj = document.getElementById("set-ai-judge"); if (aj) aj.checked = cfg.ai_judge_enabled === "1";
  }
  const payload = { speed_mode: mode, ...cfg };
  await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  Object.assign(appSettings, payload);
}

async function saveProfileSection() {
  const payload = {
    profile_username: document.getElementById("prof-username").value.trim() || "meir9",
    profile_name: document.getElementById("prof-name").value.trim() || "Deniz",
    profile_avatar: document.getElementById("prof-avatar-url").value,
    profile_highlights: document.getElementById("prof-highlights").value
  };
  await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  await loadAppearance();
  alert("Profil kaydedildi!");
}

function applyPreset() {
  const p = document.getElementById("set-preset").value;
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  if (p === "gemma4_rp") {
    setV("set-temp", "0.85"); setV("set-top-p", "0.95"); setV("set-top-k", "64");
    setV("set-min-p", "0.05"); setV("set-rep", "1.02"); setV("set-pres-pen", "0.0"); setV("set-freq-pen", "0.0");
  } else if (p === "qwen35_rp") {
    setV("set-temp", "0.70"); setV("set-top-p", "0.85"); setV("set-top-k", "20");
    setV("set-min-p", "0.05"); setV("set-rep", "1.05"); setV("set-pres-pen", "0.0"); setV("set-freq-pen", "0.0");
  } else if (p === "turkish_rp") {
    setV("set-temp", "0.76"); setV("set-top-p", "0.90"); setV("set-top-k", "40");
    setV("set-min-p", "0.05"); setV("set-rep", "1.06"); setV("set-pres-pen", "0.0"); setV("set-freq-pen", "0.0");
  } else if (p === "precise") {
    setV("set-temp", "0.55"); setV("set-top-p", "0.85"); setV("set-top-k", "30");
    setV("set-min-p", "0.08"); setV("set-rep", "1.05"); setV("set-pres-pen", "0.0"); setV("set-freq-pen", "0.0");
  }
}

function applyTurkishOptimalSettings() {
  document.getElementById("set-tone").value = "emotional";
  document.getElementById("set-preset").value = "turkish_rp";
  applyPreset();
  document.getElementById("set-max-tokens").value = "2048";
  document.getElementById("set-no-think").checked = true;
  document.getElementById("set-auto-mem").checked = true;
  document.getElementById("set-strict").checked = true;
  const aiJ = document.getElementById("set-ai-judge");
  if (aiJ) aiJ.checked = false;
  const lsEl = document.getElementById("set-live-stream");
  if (lsEl) lsEl.checked = false;
  document.getElementById("set-sys-prompt").value =
    "Sen akıcı, duygulu ve sürükleyici bir Türkçe rol yapma anlatıcısısın.\n" +
    "1. Saf ve Kusursuz Türkçe: Hem anlatım hem tüm konuşmalar yalnızca doğal, günlük İstanbul Türkçesi olsun. " +
    "Yabancı dilde cümle, çeviri, kırık Türkçe taklidi veya parantez içi açıklama/sahne notu (`(gülümser)`, `(İngilizce bilmez)` vb.) KESİNLİKLE yazma.\n" +
    "2. Duygu ve Karakter Sadakati: Her karakterin duygusunu, bakışını, ses tonunu ve beden dilini kendi kişiliğine birebir sadık kalarak canlı yaşat. " +
    "Karakterlerin Lorebook bilgisini metne açıklama olarak kopyalama, davranışlarıyla hissettir.\n" +
    "3. Kesin Rol Sınırı: Yalnızca diğer karakterleri (NPC) ve ortamı yönet. {{user}} adına ASLA konuşma, bakış, gülümseme, düşünce veya eylem yazma; doğrudan karşı karakterin tepkisiyle başla.\n" +
    "4. Tekrarsız ve Temiz Biçim: Aynı cümleyi veya tepkiyi tekrarlama. Anlatım ve eylemleri *yıldız içinde* ayrı paragraflarda, " +
    "konuşmaları ayrı paragrafta `***KarakterAdı:*** “Konuşma...”` şeklinde tırnak içinde yaz. 3-4 akıcı paragraf yazıp dur.";
}

async function saveAllSettings() {
  const payload = {
    show_nsfw: document.getElementById("prof-show-nsfw").checked ? "1" : "0",
    blur_nsfw: document.getElementById("prof-blur-nsfw").checked ? "1" : "0",
    skip_persona_picker: (document.getElementById("prof-ask-persona") && !document.getElementById("prof-ask-persona").checked) ? "1" : "0",
    ui_lang: document.getElementById("set-ui-lang")?.value || appSettings.ui_lang || "tr",
    preferred_lang: document.getElementById("set-lang").value,
    speed_mode: document.getElementById("set-speed-mode")?.value || appSettings.speed_mode || "turbo",
    theme: document.getElementById("set-theme").value,
    app_engine_mode: document.getElementById("set-app-engine-mode")?.value || appSettings.app_engine_mode || "lmstudio",
    app_model_key: document.getElementById("set-app-model-key")?.value.trim() || "gemma",
    app_gguf_path: document.getElementById("set-app-gguf-path")?.value.trim() || "",
    app_cpu_moe: document.getElementById("set-app-cpu-moe")?.value || "26",
    app_ctx_size: document.getElementById("set-app-ctx-size")?.value || "4096",
    app_unload_on_exit: (document.getElementById("set-app-unload-exit") && document.getElementById("set-app-unload-exit").checked) ? "1" : "0",
    api_url: document.getElementById("set-api-url").value.trim(),
    model_name: document.getElementById("set-model").value.trim(),
    story_tone: document.getElementById("set-tone").value,
    preset: document.getElementById("set-preset").value,
    temperature: document.getElementById("set-temp").value,
    rep_penalty: document.getElementById("set-rep").value,
    top_p: document.getElementById("set-top-p")?.value || appSettings.top_p || "0.95",
    top_k: document.getElementById("set-top-k")?.value || appSettings.top_k || "64",
    min_p: document.getElementById("set-min-p").value,
    presence_penalty: document.getElementById("set-pres-pen").value,
    frequency_penalty: document.getElementById("set-freq-pen").value,
    max_tokens: document.getElementById("set-max-tokens").value,
    context_messages: document.getElementById("set-ctx-msgs").value,
    auto_summarize_every: document.getElementById("set-auto-sum-every").value,
    font_size: document.getElementById("set-font-size").value,
    chat_bg_url: document.getElementById("set-bg-url").value.trim(),
    strict_consistency: document.getElementById("set-strict").checked ? "1" : "0",
    no_think_prefix: document.getElementById("set-no-think").checked ? "1" : "0",
    auto_memory_enabled: document.getElementById("set-auto-mem").checked ? "1" : "0",
    ai_judge_enabled: (document.getElementById("set-ai-judge") && document.getElementById("set-ai-judge").checked) ? "1" : "0",
    live_stream: (document.getElementById("set-live-stream") && document.getElementById("set-live-stream").checked) ? "1" : "0",
    system_prompt: document.getElementById("set-sys-prompt").value
  };
  await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  await loadAppearance();
  document.getElementById("prof-val-model").textContent = payload.model_name ? payload.model_name.slice(0, 26) : "Otomatik";
  checkStatus();
}

// ==========================================
// 7. SOHBETLER & SOHBET EKRANI
// ==========================================
function formatRelativeChatTime(isoStr) {
  if (!isoStr) return "";
  const dt = new Date(isoStr);
  if (isNaN(dt.getTime())) return "";
  const diffMin = Math.floor((Date.now() - dt.getTime()) / 60000);
  const hhmm = `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
  if (diffMin < 1) return `Şimdi · ${hhmm}`;
  if (diffMin < 60) return `${diffMin} dk önce · ${hhmm}`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} sa önce · ${hhmm}`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `${diffD} gün önce · ${hhmm}`;
  return `${dt.toLocaleDateString()} · ${hhmm}`;
}

async function loadAllChats() {
  allChatsCache = await fetch("/api/chats?grouped=1").then(r => r.json());
  manageAllChats = false;
  selectedAllChatIds.clear();
  document.getElementById("all-chats-manage-bar")?.classList.add("hidden");
  const btn = document.getElementById("btn-manage-all-chats");
  if (btn) btn.textContent = typeof t === "function" ? t("manage_chats") : "Sohbetleri Yönet";
  renderAllChats();
}

function toggleManageAllChats(forceVal) {
  manageAllChats = (forceVal === undefined) ? !manageAllChats : Boolean(forceVal);
  selectedAllChatIds.clear();
  document.getElementById("all-chats-manage-bar")?.classList.toggle("hidden", !manageAllChats);
  const btn = document.getElementById("btn-manage-all-chats");
  if (btn) btn.textContent = manageAllChats ? (typeof t === "function" ? t("done_manage") : "Bitti") : (typeof t === "function" ? t("manage_chats") : "Sohbetleri Yönet");
  updateAllChatsSelCount();
  renderAllChats();
}

function toggleSelectAllChat(chatId) {
  if (selectedAllChatIds.has(chatId)) selectedAllChatIds.delete(chatId);
  else selectedAllChatIds.add(chatId);
  updateAllChatsSelCount();
  renderAllChats();
}

function updateAllChatsSelCount() {
  const el = document.getElementById("all-chats-sel-cnt");
  if (el) el.textContent = `${selectedAllChatIds.size} seçildi`;
}

async function deleteSelectedAllChats() {
  const ids = [...selectedAllChatIds];
  if (!ids.length) return toggleManageAllChats(false);
  if (!confirm(`Seçili ${ids.length} sohbet silinsin mi?`)) return;
  await fetch("/api/chats/bulk-delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_ids: ids })
  });
  await loadAllChats();
}

function renderAllChats() {
  const box = document.getElementById("all-chats-list");
  const cntEl = document.getElementById("all-chats-count");
  if (!box) return;
  const q = (document.getElementById("chats-search-input")?.value || "").toLowerCase().trim();
  const sort = document.getElementById("chats-sort-select")?.value || "latest";

  let list = allChatsCache.filter(ch => {
    if (!q) return true;
    const nm = (ch.group_id ? ch.group_name : ch.char_name) || "";
    return nm.toLowerCase().includes(q)
      || (ch.title || "").toLowerCase().includes(q)
      || (ch.persona_name || "").toLowerCase().includes(q)
      || (ch.last_message || "").toLowerCase().includes(q);
  });
  if (sort === "az") {
    list.sort((a, b) => ((a.group_id ? a.group_name : a.char_name) || "").localeCompare((b.group_id ? b.group_name : b.char_name) || "", "tr"));
  }

  if (cntEl) cntEl.textContent = `${list.length} ${typeof t === "function" ? t("conversations_cnt") : "sohbet"}`;

  if (!list.length) {
    box.innerHTML = `<div class="muted" style="text-align:center;padding:44px;">Henüz kayıtlı sohbet yok. <b>Chatbots</b> sayfasından bir sohbete başla!</div>`;
    return;
  }

  box.innerHTML = list.map(ch => {
    const isGroup = !!ch.group_id;
    const targetId = isGroup ? ch.group_id : ch.character_id;
    const kind = isGroup ? "group" : "character";
    const name = isGroup ? (ch.group_name || "Grup") : (ch.char_name || "Chatbot");
    const avUrl = isGroup ? ch.group_avatar : ch.char_avatar;
    const av = avUrl
      ? `<img class="sc-ci-av" src="${avUrl}" alt="" />`
      : `<div class="sc-ci-av-fb">${isGroup ? "👥" : escapeHtml(name[0] || "?")}</div>`;
    const preview = (ch.last_message || "Henüz mesaj yok").replace(/\*+/g, "").slice(0, 220);
    const totalChats = Number(ch.chat_count || 1);
    const isSel = selectedAllChatIds.has(ch.id);
    const clickAction = manageAllChats
      ? `toggleSelectAllChat(${ch.id})`
      : (isGroup ? `resumeGroupChat(${ch.group_id}, ${ch.id})` : `resumeCharChat(${ch.character_id}, ${ch.id})`);

    return `
      <div class="sc-chat-item ${manageAllChats && isSel ? 'is-selected' : ''}" onclick="${clickAction}">
        ${manageAllChats ? `<input type="checkbox" class="bulk-msg-chk" ${isSel ? 'checked' : ''} onclick="event.stopPropagation();toggleSelectAllChat(${ch.id})" />` : ''}
        ${av}
        <div class="sc-ci-body">
          <div class="sc-ci-top">
            <div class="sc-ci-title-wrap">
              <span class="sc-ci-name">${escapeHtml(name)}</span>
              ${ch.persona_name ? `<span class="sc-ci-persona">· ${escapeHtml(ch.persona_name)}</span>` : ''}
            </div>
            <div class="sc-ci-right">
              <span>${escapeHtml(formatRelativeChatTime(ch.updated_at))}</span>
              <span>💬 ${ch.message_count || 0}</span>
              ${!manageAllChats ? `<button type="button" class="cb-dots-btn" onclick="openAllChatRowMenu(event, '${kind}', ${targetId}, ${ch.id})">⋮</button>` : ''}
            </div>
          </div>
          <div class="sc-ci-preview">${escapeHtml(preview)}</div>
          <div class="sc-ci-foot">
            ${totalChats > 1 ? `<button type="button" class="sc-ci-saved-btn" onclick="event.stopPropagation();openSavedChatsPageFor('${kind}', ${targetId}, 'chats')">📁 ${totalChats} ${typeof t === "function" ? t("page_saved_chats") : "Kayıtlı Sohbet"}</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join("");
}

function openAllChatRowMenu(e, kind, targetId, latestChatId) {
  openCardPopover(e, [
    { label: "💬 " + (typeof t === "function" ? t("menu_saved_chats") : "Kayıtlı Sohbetleri Gör"), action: () => openSavedChatsPageFor(kind, targetId, "chats") },
    { label: "✨ " + (typeof t === "function" ? t("menu_start_chat") : "Sohbet Başlat"), action: () => kind === "group" ? openGroupChat(targetId) : openChatWith(targetId) },
    { label: "🗑 " + (typeof t === "function" ? t("btn_delete") : "Sil"), danger: true, action: () => deleteChatFromAll(latestChatId) }
  ]);
}

// --- TAM SAYFA KAYITLI SOHBETLER (VIEW SAVED CHATS WITH [CHATBOT]) ---
async function openSavedChatsPage() {
  if (currentGroup) {
    await openSavedChatsPageFor("group", currentGroup.id, "chat");
  } else if (currentCharacter) {
    await openSavedChatsPageFor("character", currentCharacter.id, "chat");
  }
}

async function openSavedChatsPageFor(kind, targetId, returnView = "chat") {
  await Promise.all([loadCharacters(), loadGroups()]);
  const obj = kind === "group"
    ? groups.find(g => g.id === targetId)
    : characters.find(c => c.id === targetId);
  const name = obj ? obj.name : (kind === "group" ? "Grup" : "Chatbot");
  const avatar_url = obj ? (obj.avatar_url || "") : "";

  savedChatsTarget = { kind, id: targetId, name, avatar_url, returnView };
  manageSavedChats = false;
  selectedSavedChatIds.clear();
  document.getElementById("saved-chats-manage-bar")?.classList.add("hidden");
  document.getElementById("saved-chats-search-input").value = "";

  const baseLbl = typeof t === "function" ? t("page_saved_chats") : "Kayıtlı Sohbetler";
  document.getElementById("saved-chats-title").textContent = `${baseLbl} — ${name}`;

  const url = kind === "group" ? `/api/groups/${targetId}/chats` : `/api/characters/${targetId}/chats`;
  savedChatsCache = await fetch(url).then(r => r.json());
  showView("saved-chats", returnView === "chats" ? "nav-chats" : lastActiveNavId);
  renderSavedChatsView();
}

function goBackFromSavedChats() {
  if (savedChatsTarget && savedChatsTarget.returnView === "chat" && currentChatId) {
    showView("chat", lastActiveNavId);
  } else {
    showView("chats", "nav-chats");
  }
}

async function startNewChatFromSaved() {
  if (!savedChatsTarget) return;
  if (savedChatsTarget.kind === "group") {
    currentCharacter = null;
    currentGroup = groups.find(g => g.id === savedChatsTarget.id) || currentGroup;
    await openGroupChat(savedChatsTarget.id);
  } else {
    currentGroup = null;
    currentCharacter = characters.find(c => c.id === savedChatsTarget.id) || currentCharacter;
    await openChatWith(savedChatsTarget.id);
  }
}

function toggleManageSavedChats(forceVal) {
  manageSavedChats = (forceVal === undefined) ? !manageSavedChats : Boolean(forceVal);
  selectedSavedChatIds.clear();
  document.getElementById("saved-chats-manage-bar")?.classList.toggle("hidden", !manageSavedChats);
  const btn = document.getElementById("btn-manage-saved-chats");
  if (btn) btn.textContent = manageSavedChats ? (typeof t === "function" ? t("done_manage") : "Bitti") : (typeof t === "function" ? t("manage_chats") : "Sohbetleri Yönet");
  updateSavedChatsSelCount();
  renderSavedChatsView();
}

function toggleSelectSavedChat(chatId) {
  if (selectedSavedChatIds.has(chatId)) selectedSavedChatIds.delete(chatId);
  else selectedSavedChatIds.add(chatId);
  updateSavedChatsSelCount();
  renderSavedChatsView();
}

function updateSavedChatsSelCount() {
  const el = document.getElementById("saved-chats-sel-cnt");
  if (el) el.textContent = `${selectedSavedChatIds.size} seçildi`;
}

async function deleteSelectedSavedChats() {
  const ids = [...selectedSavedChatIds];
  if (!ids.length) return toggleManageSavedChats(false);
  if (!confirm(`Seçili ${ids.length} kayıtlı sohbet silinsin mi?`)) return;
  await fetch("/api/chats/bulk-delete", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_ids: ids })
  });
  if (ids.includes(currentChatId)) currentChatId = null;
  if (savedChatsTarget) {
    await openSavedChatsPageFor(savedChatsTarget.kind, savedChatsTarget.id, savedChatsTarget.returnView);
  }
}

function renderSavedChatsView() {
  const box = document.getElementById("saved-chats-page-list");
  const cntEl = document.getElementById("saved-chats-count");
  if (!box || !savedChatsTarget) return;

  const q = (document.getElementById("saved-chats-search-input")?.value || "").toLowerCase().trim();
  const sort = document.getElementById("saved-chats-sort-select")?.value || "latest";

  let list = savedChatsCache.filter(ch => {
    if (!q) return true;
    return (ch.title || "").toLowerCase().includes(q)
      || (ch.persona_name || "").toLowerCase().includes(q)
      || (ch.last_message || "").toLowerCase().includes(q);
  });
  if (sort === "oldest") {
    list = [...list].reverse();
  }

  if (cntEl) cntEl.textContent = `${list.length} ${typeof t === "function" ? t("conversations_cnt") : "sohbet"}`;

  if (!list.length) {
    box.innerHTML = `<div class="muted" style="text-align:center;padding:40px;">Kayıtlı sohbet bulunamadı.</div>`;
    return;
  }

  const avUrl = savedChatsTarget.avatar_url;
  const fallbackLetter = savedChatsTarget.kind === "group" ? "👥" : escapeHtml((savedChatsTarget.name || "?")[0].toUpperCase());

  box.innerHTML = list.map(ch => {
    const av = avUrl
      ? `<img class="sc-ci-av" src="${avUrl}" alt="" />`
      : `<div class="sc-ci-av-fb">${fallbackLetter}</div>`;
    const preview = (ch.last_message || "Henüz mesaj yok").replace(/\*+/g, "").slice(0, 240);
    const isSel = selectedSavedChatIds.has(ch.id);
    const isCurrent = (ch.id === currentChatId);
    const clickAction = manageSavedChats
      ? `toggleSelectSavedChat(${ch.id})`
      : (savedChatsTarget.kind === "group"
          ? `resumeGroupChat(${savedChatsTarget.id}, ${ch.id})`
          : `resumeCharChat(${savedChatsTarget.id}, ${ch.id})`);

    return `
      <div class="sc-chat-item ${manageSavedChats && isSel ? 'is-selected' : ''}" onclick="${clickAction}">
        ${manageSavedChats ? `<input type="checkbox" class="bulk-msg-chk" ${isSel ? 'checked' : ''} onclick="event.stopPropagation();toggleSelectSavedChat(${ch.id})" />` : ''}
        ${av}
        <div class="sc-ci-body">
          <div class="sc-ci-top">
            <div class="sc-ci-title-wrap">
              <span class="sc-ci-name">${escapeHtml(ch.title || savedChatsTarget.name)}</span>
              ${ch.persona_name ? `<span class="sc-ci-persona">· ${escapeHtml(ch.persona_name)}</span>` : ''}
              ${isCurrent ? `<span class="tag" style="color:#60a5fa;border-color:#1d7bf5;">Aktif</span>` : ''}
            </div>
            <div class="sc-ci-right">
              <span>${escapeHtml(formatRelativeChatTime(ch.updated_at))}</span>
              <span>💬 ${ch.message_count || 0}</span>
              ${!manageSavedChats ? `<button type="button" class="cb-dots-btn" onclick="openSavedChatRowMenu(event, ${ch.id})">⋮</button>` : ''}
            </div>
          </div>
          <div class="sc-ci-preview">${escapeHtml(preview)}</div>
        </div>
      </div>`;
  }).join("");
}

function openSavedChatRowMenu(e, chatId) {
  openCardPopover(e, [
    { label: "✎ " + (typeof t === "function" ? t("menu_rename") : "Başlığı Değiştir"), action: async () => {
      const ch = savedChatsCache.find(x => x.id === chatId);
      const newT = prompt("Yeni sohbet başlığı:", ch ? ch.title : "");
      if (newT && newT.trim()) {
        await fetch(`/api/chats/${chatId}/title`, {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newT.trim() })
        });
        await openSavedChatsPageFor(savedChatsTarget.kind, savedChatsTarget.id, savedChatsTarget.returnView);
      }
    }},
    { label: "📋 " + (typeof t === "function" ? t("menu_clone") : "Sohbeti Klonla"), action: async () => {
      await fetch(`/api/chats/${chatId}/clone`, { method: "POST" });
      await openSavedChatsPageFor(savedChatsTarget.kind, savedChatsTarget.id, savedChatsTarget.returnView);
    }},
    { label: "🗑 " + (typeof t === "function" ? t("btn_delete") : "Sil"), danger: true, action: async () => {
      if (!confirm("Bu sohbet silinsin mi?")) return;
      await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (currentChatId === chatId) currentChatId = null;
      await openSavedChatsPageFor(savedChatsTarget.kind, savedChatsTarget.id, savedChatsTarget.returnView);
    }}
  ]);
}

function updateChatHeaderVisuals(name, subtitle, avatarUrl) {
  document.getElementById("chat-char-name").textContent = name || "Chatbot";
  document.getElementById("chat-char-title").textContent = subtitle || getProfileHandle();
  const av = document.getElementById("chat-char-avatar");
  const fb = document.getElementById("chat-char-avatar-fb");
  if (avatarUrl) {
    av.src = avatarUrl;
    av.classList.remove("hidden");
    fb?.classList.add("hidden");
  } else {
    av.classList.add("hidden");
    if (fb) {
      fb.textContent = (name || "C")[0].toUpperCase();
      fb.classList.remove("hidden");
    }
  }
}

function toggleChatOptionsMenu(e) {
  if (e) e.stopPropagation();
  document.getElementById("composer-plus-menu")?.classList.add("hidden");
  document.getElementById("card-popover")?.classList.add("hidden");
  document.getElementById("chat-options-menu")?.classList.toggle("hidden");
}

function closeChatOptionsMenu() {
  document.getElementById("chat-options-menu")?.classList.add("hidden");
}

function openChatSparkleMenu(e) {
  const rb = getActiveChatRulebook();
  const items = [
    { label: "🧠 Hafıza & Özet", action: () => openMemoryModal() }
  ];
  if (rb && rb.meters && rb.meters.length) {
    items.push({ label: "🎛 Göstergeleri Düzenle", action: () => openHudModal() });
  }
  if (currentGroup) {
    items.push({ label: "👥 Sıradaki Konuşanı Seç", action: () => openGroupSpeakerModal() });
  }
  items.push({ label: "💡 Yanıt Öner", action: () => requestReplySuggestions(false) });
  openCardPopover(e, items);
}

function openGroupSpeakerModal() {
  if (!currentGroup) return;
  const members = (currentGroup.member_ids || []).map(id => characters.find(c => c.id === id)).filter(Boolean);
  document.getElementById("group-speakers-list").innerHTML = members.map(m =>
    `<button type="button" class="btn small" onclick="closeModal('group-speaker-modal');triggerGroupSpeaker(${m.id})">💬 ${escapeHtml(m.name)}</button>`
  ).join("") || `<div class="muted small-text">Grup üyesi bulunamadı.</div>`;
  document.getElementById("group-speaker-modal").classList.remove("hidden");
}

async function openSavedChatsModal() {
  await refreshChatList(false);
  document.getElementById("saved-chats-modal").classList.remove("hidden");
}

async function openChangePersonaModal() {
  await loadPersonas();
  const curPid = currentChatData ? currentChatData.persona_id : null;
  const box = document.getElementById("change-persona-list");
  box.innerHTML = personas.map(p => {
    const isSel = (p.id === curPid);
    const av = p.avatar_url
      ? `<img src="${p.avatar_url}" style="width:40px;height:40px;border-radius:9px;object-fit:cover;flex-shrink:0;" />`
      : `<span class="sc-msg-av-fb" style="width:40px;height:40px;">${escapeHtml((p.name || "P")[0].toUpperCase())}</span>`;
    return `
      <button type="button" class="pp-item ${isSel ? 'selected' : ''}" style="width:100%;margin-bottom:8px;" onclick="selectChatPersonaModal(${p.id})">
        ${av}
        <div class="pp-item-info">
          <div class="pp-item-head">
            <span class="pp-item-name">${escapeHtml(p.name)}</span>
            ${p.is_default ? '<span class="pp-def-pill">Varsayılan</span>' : ''}
          </div>
          <div class="pp-item-desc">${escapeHtml(p.description || 'Açıklama eklenmemiş...')}</div>
        </div>
        <span class="pp-radio"><span class="pp-radio-dot"></span></span>
      </button>`;
  }).join("");
  document.getElementById("change-persona-modal").classList.remove("hidden");
}

async function selectChatPersonaModal(pid) {
  document.getElementById("chat-persona-select").value = pid;
  await changeChatPersona();
  closeModal("change-persona-modal");
}

function openRenameChatModal() {
  if (!currentChatData) return;
  const inp = document.getElementById("rename-chat-input");
  inp.value = currentChatData.title || "";
  document.getElementById("rename-chat-modal").classList.remove("hidden");
  setTimeout(() => { inp.focus(); inp.select(); }, 40);
}

async function saveRenameChat() {
  const title = (document.getElementById("rename-chat-input").value || "").trim();
  if (!title || !currentChatId) return;
  await fetch(`/api/chats/${currentChatId}/title`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  currentChatData.title = title;
  closeModal("rename-chat-modal");
  await refreshChatList(false);
}

function editActiveChatbot() {
  if (currentGroup) openGroupForm(currentGroup.id);
  else if (currentCharacter) openCharacterForm(currentCharacter.id);
}

// --- TOPLU MESAJ SİLME (REMOVE MESSAGES) ---
function toggleBulkRemoveMode(enable) {
  bulkRemoveMode = Boolean(enable);
  bulkSelectedIds.clear();
  document.getElementById("bulk-remove-bar")?.classList.toggle("hidden", !bulkRemoveMode);
  updateBulkRemoveCount();
  renderMessages();
}

function toggleBulkMsgSelect(mid) {
  if (bulkSelectedIds.has(mid)) bulkSelectedIds.delete(mid);
  else bulkSelectedIds.add(mid);
  updateBulkRemoveCount();
  const card = document.getElementById(`msg-${mid}`);
  if (card) card.classList.toggle("bulk-selected", bulkSelectedIds.has(mid));
}

function updateBulkRemoveCount() {
  const el = document.getElementById("bulk-remove-count");
  if (el) el.textContent = `${bulkSelectedIds.size} mesaj seçildi`;
}

async function confirmBulkRemoveMessages() {
  const ids = [...bulkSelectedIds];
  if (!ids.length) {
    toggleBulkRemoveMode(false);
    return;
  }
  if (!confirm(`Seçili ${ids.length} mesaj kalıcı olarak silinsin mi?`)) return;
  await fetch(`/api/chats/${currentChatId}/messages/bulk-delete`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message_ids: ids })
  });
  toggleBulkRemoveMode(false);
  await loadChat(currentChatId);
}

// --- YÜKSEK KALİTELİ SES AYARLARI (10 DİL x KADIN & ERKEK · GOOGLE CHIRP 3 HD / NEURAL) ---
const VOICE_TEST_SAMPLES = {
  tr: "Merhaba, seçtiğin ses profili şu an aktif ve konuşmaya hazır.",
  az: "Salam, seçdiyin səs profili hazırdır və danışmağa başlaya bilər.",
  en: "Hello, your selected voice profile is active and ready to speak.",
  ru: "Привет, выбранный голосовой профиль активен и готов к работе.",
  de: "Hallo, dein gewähltes Stimmprofil ist aktiv und bereit.",
  fr: "Bonjour, votre profil vocal sélectionné est actif et prêt.",
  es: "Hola, tu perfil de voz seleccionado está activo y listo.",
  it: "Ciao, il profilo vocale selezionato è attivo e pronto.",
  zh: "你好，你选择的语音配置已准备就绪。",
  ja: "こんにちは、選択した音声プロフィールは準備完了です。"
};

let ttsEngineDiagCache = null;

async function populateVoiceSelect() {
  const sel = document.getElementById("voice-select");
  if (!sel) return;
  try {
    const res = await fetch("/api/tts/voices").then(r => r.json());
    curatedVoicesCache = res.voices || [];
    ttsEngineDiagCache = { edge_tts_ok: Boolean(res.edge_tts_ok), edge_tts_version: res.edge_tts_version || "" };
  } catch {
    if (!curatedVoicesCache.length) curatedVoicesCache = [];
  }
  const saved = (appSettings.tts_voice && curatedVoicesCache.some(v => v.id === appSettings.tts_voice))
    ? appSettings.tts_voice
    : "tr-F";

  const femLbl = typeof t === "function" ? t("voice_female") : "Kadın";
  const maleLbl = typeof t === "function" ? t("voice_male") : "Erkek";

  const byLang = [];
  const seenLang = {};
  for (const v of curatedVoicesCache) {
    if (!seenLang[v.lang]) {
      seenLang[v.lang] = { label: v.lang_label, items: [] };
      byLang.push(seenLang[v.lang]);
    }
    seenLang[v.lang].items.push(v);
  }

  sel.innerHTML = byLang.map(grp => `
    <optgroup label="${escapeHtml(grp.label)}">
      ${grp.items.map(v => {
        const gTxt = v.gender === "M" ? maleLbl : femLbl;
        const badge = v.gender === "M" ? "♂" : "♀";
        const nm = v.voice_label ? ` (${v.voice_label})` : "";
        return `<option value="${escapeHtml(v.id)}" ${v.id === saved ? 'selected' : ''}>${escapeHtml(grp.label)} — ${badge} ${escapeHtml(gTxt)}${escapeHtml(nm)}</option>`;
      }).join("")}
    </optgroup>
  `).join("");
  sel.value = saved;
}

function updateVoiceDiagBox() {
  const box = document.getElementById("voice-engine-diag");
  if (!box) return;
  const eng = document.getElementById("voice-engine")?.value || appSettings.tts_engine || "auto";
  if (eng === "google_free") {
    box.className = "voice-diag-box warn small-text";
    box.innerHTML = "⚠ <b>Google Translate TTS</b> her dil için yalnızca tek ses sunar (Kadın/Erkek değiştirince ses değişmez). Gerçek Kadın & Erkek sesleri için <b>Otomatik En İyi</b> veya <b>HD Neural</b> seç.";
    return;
  }
  if (ttsEngineDiagCache && ttsEngineDiagCache.edge_tts_ok) {
    box.className = "voice-diag-box ok small-text";
    box.innerHTML = `✓ <b>HD Neural Kadın/Erkek Motoru Hazır</b> (edge-tts ${escapeHtml(ttsEngineDiagCache.edge_tts_version || "")}) · 10 dilde ayrı Kadın & Erkek sesleri aktif.`;
  } else {
    box.className = "voice-diag-box warn small-text";
    box.innerHTML = "⚠ <b>edge-tts paketi bulunamadı</b> — bu yüzden Kadın/Erkek yerine tek sesli yedek çalışabilir. Çözüm için klasördeki <b>uygulama_kur.bat</b> dosyasını bir kez çalıştır.";
  }
}

function toggleGoogleTtsKeyBox() {
  const eng = document.getElementById("voice-engine")?.value || "auto";
  const wrap = document.getElementById("voice-gcloud-key-wrap");
  if (wrap) wrap.classList.toggle("hidden", eng === "google_free" || eng === "neural");
  updateVoiceDiagBox();
}

function onVoiceSelectChange() {
  const st = document.getElementById("voice-test-status");
  if (st) st.textContent = "";
}

async function openVoiceModal() {
  document.getElementById("voice-modal-title").textContent = typeof t === "function" ? t("voice_title") : "Ses Ayarları";
  await populateVoiceSelect();
  const engSel = document.getElementById("voice-engine");
  if (engSel) engSel.value = appSettings.tts_engine || "auto";
  const gkIn = document.getElementById("voice-gcloud-key");
  if (gkIn) gkIn.value = appSettings.google_tts_api_key || "";
  toggleGoogleTtsKeyBox();
  const rate = appSettings.tts_rate || "1.0";
  const pitch = appSettings.tts_pitch || "1.0";
  document.getElementById("voice-rate").value = rate;
  document.getElementById("voice-rate-val").textContent = rate;
  document.getElementById("voice-pitch").value = pitch;
  document.getElementById("voice-pitch-val").textContent = pitch;
  document.getElementById("voice-auto").checked = appSettings.tts_auto === "1";
  const st = document.getElementById("voice-test-status");
  if (st) st.textContent = "";
  document.getElementById("voice-modal").classList.remove("hidden");
}

async function saveVoiceSettings() {
  stopVoicePlayback();
  const payload = {
    tts_voice: document.getElementById("voice-select").value || "tr-F",
    tts_engine: document.getElementById("voice-engine")?.value || "auto",
    google_tts_api_key: document.getElementById("voice-gcloud-key")?.value.trim() || "",
    tts_rate: document.getElementById("voice-rate").value,
    tts_pitch: document.getElementById("voice-pitch").value,
    tts_auto: document.getElementById("voice-auto").checked ? "1" : "0"
  };
  await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  Object.assign(appSettings, payload);
  closeModal("voice-modal");
  const vObj = curatedVoicesCache.find(v => v.id === payload.tts_voice);
  if (vObj) {
    const gTxt = vObj.gender === "M" ? "Erkek" : "Kadın";
    showChatToast(`🔊 Ses güncellendi: ${vObj.lang_label} — ${gTxt}${vObj.voice_label ? " (" + vObj.voice_label + ")" : ""}`, 3200);
  }
}

function showChatToast(msg, ms = 4500) {
  const nEl = document.getElementById("hud-notify");
  if (!nEl) return;
  nEl.textContent = msg;
  nEl.classList.remove("hidden");
  clearTimeout(nEl._t);
  nEl._t = setTimeout(() => nEl.classList.add("hidden"), ms);
}

function resetSpeakButtonsUI() {
  const listenLbl = typeof t === "function" ? t("btn_listen") : "Dinle";
  document.querySelectorAll(".speak-btn").forEach(b => {
    b.classList.remove("speaking-now", "loading-audio");
    b.innerHTML = ACT_ICONS.speak;
    b.title = listenLbl;
    b.setAttribute("aria-label", listenLbl);
  });
}

function stopVoicePlayback() {
  if (ttsAbortController) {
    try { ttsAbortController.abort(); } catch {}
    ttsAbortController = null;
  }
  if (currentTtsAudio) {
    try {
      currentTtsAudio.onended = null;
      currentTtsAudio.onerror = null;
      currentTtsAudio.pause();
      currentTtsAudio.currentTime = 0;
      currentTtsAudio.removeAttribute("src");
      currentTtsAudio.load();
    } catch {}
    currentTtsAudio = null;
  }
  if (currentTtsObjectUrl) {
    try { URL.revokeObjectURL(currentTtsObjectUrl); } catch {}
    currentTtsObjectUrl = null;
  }
  if (window.speechSynthesis) {
    try { window.speechSynthesis.cancel(); } catch {}
  }
  activeSpeechMsgId = null;
  resetSpeakButtonsUI();
}

function _fallbackBrowserSpeech(cleanText, voiceId, rate, pitch) {
  if (!window.speechSynthesis) return false;
  const parts = String(voiceId || "tr-F").split("-");
  const langPrefix = parts[0] || "tr";
  const wantMale = (parts[1] === "M");
  const langMap = { tr: "tr-TR", az: "az-AZ", en: "en-US", ru: "ru-RU", de: "de-DE", fr: "fr-FR", es: "es-ES", it: "it-IT", zh: "zh-CN", ja: "ja-JP" };
  const maleRe = /ahmet|tolga|babek|andrew|guy|david|mark|dmitry|pavel|conrad|stefan|henri|paul|alvaro|pablo|diego|cosimo|yunxi|kangkang|keita|ichiro|male/i;
  const femaleRe = /emel|yelda|banu|ava|jenny|aria|zira|svetlana|irina|katja|hedda|denise|hortense|elvira|helena|elsa|xiaoxiao|yaoyao|nanami|haruka|female/i;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(cleanText);
    u.lang = langMap[langPrefix] || "tr-TR";
    u.rate = Math.max(0.6, Math.min(1.6, rate || 1.0));
    const vs = (window.speechSynthesis.getVoices() || []).filter(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
    const gRe = wantMale ? maleRe : femaleRe;
    const genderMatch = vs.find(v => gRe.test(v.name) && /online|natural|google/i.test(v.name)) || vs.find(v => gRe.test(v.name));
    const anyMatch = vs.find(v => /online|natural|google/i.test(v.name)) || vs[0];
    if (genderMatch) {
      u.voice = genderMatch;
      u.pitch = Math.max(0.5, Math.min(1.5, pitch || 1.0));
    } else {
      if (anyMatch) u.voice = anyMatch;
      // Tek yerel ses varsa kadin/erkek ton farkini hissettir
      const basePitch = Number(pitch || 1.0);
      u.pitch = Math.max(0.5, Math.min(1.5, wantMale ? basePitch * 0.80 : basePitch * 1.12));
    }
    u.onend = () => stopVoicePlayback();
    u.onerror = () => stopVoicePlayback();
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}

async function speakTextNow(text, opts = {}) {
  stopVoicePlayback();
  const clean = String(text || "").replace(/\*+/g, "").trim();
  if (!clean) return;

  const voiceId = opts.voice_id || appSettings.tts_voice || "tr-F";
  const engine = opts.engine || appSettings.tts_engine || "auto";
  const gkey = opts.google_api_key !== undefined ? opts.google_api_key : (appSettings.google_tts_api_key || "");
  const rate = Number(opts.rate ?? appSettings.tts_rate ?? 1.0);
  const pitch = Number(opts.pitch ?? appSettings.tts_pitch ?? 1.0);
  const btnEl = opts.btnEl || null;
  if (opts.msgId) activeSpeechMsgId = opts.msgId;

  if (btnEl) {
    btnEl.classList.add("speaking-now", "loading-audio");
    btnEl.innerHTML = ACT_ICONS.spinner;
    btnEl.title = "Hazırlanıyor...";
  }

  const audioEl = new Audio();
  audioEl.preload = "auto";
  currentTtsAudio = audioEl;

  ttsAbortController = new AbortController();
  const myCtrl = ttsAbortController;

  try {
    const resp = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, voice_id: voiceId, rate, pitch, engine, google_api_key: gkey }),
      signal: myCtrl.signal
    });
    if (myCtrl.signal.aborted) return;

    if (!resp.ok) {
      let detail = `HTTP ${resp.status}`;
      try {
        const j = await resp.json();
        if (j && j.detail) detail = j.detail;
      } catch {}
      if (opts.statusEl) opts.statusEl.textContent = "Yedek ses deneniyor (" + detail + ")";
      else showChatToast("⚠ HD ses sunucusu yanıt vermedi (" + detail + "), yerel ses deneniyor...");
      if (_fallbackBrowserSpeech(clean, voiceId, rate, pitch)) {
        if (btnEl) {
          const stopLbl = typeof t === "function" ? t("btn_stop_listen") : "Sustur";
          btnEl.classList.remove("loading-audio");
          btnEl.innerHTML = ACT_ICONS.stop;
          btnEl.title = stopLbl;
          btnEl.setAttribute("aria-label", stopLbl);
        }
        return;
      }
      stopVoicePlayback();
      return;
    }

    const blob = await resp.blob();
    if (myCtrl.signal.aborted) return;
    if (!blob || blob.size < 200) {
      showChatToast("⚠ Ses verisi boş geldi.");
      stopVoicePlayback();
      return;
    }

    const engUsed = resp.headers.get("X-TTS-Engine") || "";
    const voiceUsed = resp.headers.get("X-TTS-Voice") || "";
    const fbNote = resp.headers.get("X-TTS-Fallback") || "";
    const isMale = voiceId.endsWith("-M");

    if (opts.statusEl) {
      const engName = engUsed === "google_cloud" ? "Google Cloud HD" : (engUsed === "google_free" ? "Google TTS (Tek Ses)" : "HD Neural");
      opts.statusEl.textContent = fbNote
        ? `⚠ ${engName} (Yedek: ${fbNote})`
        : `✓ ${engName}${voiceUsed ? " · " + voiceUsed : ""}`;
    } else if (engUsed === "google_free" && fbNote) {
      showChatToast(`⚠ HD Kadın/Erkek sesi bağlanamadı (${fbNote}); tek sesli Google yedeği çalıyor.`, 5500);
    }

    currentTtsObjectUrl = URL.createObjectURL(blob);
    audioEl.src = currentTtsObjectUrl;
    if (engUsed === "google_free") {
      // Google Translate tek sesli oldugu icin hiz + (erkek/ton degisimi varsa) ton farkini uygula
      const effPitch = isMale ? Math.min(0.88, pitch * 0.88) : pitch;
      if (Math.abs(effPitch - 1.0) > 0.04) {
        audioEl.preservesPitch = false;
        audioEl.mozPreservesPitch = false;
        audioEl.webkitPreservesPitch = false;
        audioEl.playbackRate = Math.max(0.72, Math.min(1.45, rate * effPitch));
      } else {
        audioEl.preservesPitch = true;
        audioEl.playbackRate = Math.max(0.6, Math.min(1.6, rate));
      }
    } else {
      // HD Neural ve Google Cloud hiz/ton ayarini sunucuda kendisi uygular — cift hizlandirma yapma!
      audioEl.preservesPitch = true;
      audioEl.playbackRate = 1.0;
    }
    audioEl.onended = () => stopVoicePlayback();
    audioEl.onerror = () => {
      showChatToast("⚠ Ses dosyası oynatılamadı.");
      stopVoicePlayback();
    };
    if (btnEl) {
      const stopLbl = typeof t === "function" ? t("btn_stop_listen") : "Sustur";
      btnEl.classList.remove("loading-audio");
      btnEl.innerHTML = ACT_ICONS.stop;
      btnEl.title = stopLbl;
      btnEl.setAttribute("aria-label", stopLbl);
    }
    await audioEl.play();
  } catch (e) {
    if (e.name !== "AbortError") {
      if (opts.statusEl) opts.statusEl.textContent = "Hata: " + e.message;
      else showChatToast("⚠ Ses çalma hatası: " + e.message);
      stopVoicePlayback();
    }
  }
}

async function testVoicePlayback() {
  const voiceId = document.getElementById("voice-select").value || "tr-F";
  const engine = document.getElementById("voice-engine")?.value || "auto";
  const gkey = document.getElementById("voice-gcloud-key")?.value.trim() || "";
  const rate = Number(document.getElementById("voice-rate").value || 1.0);
  const pitch = Number(document.getElementById("voice-pitch").value || 1.0);

  await fetch("/api/settings", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tts_voice: voiceId, tts_engine: engine, google_tts_api_key: gkey, tts_rate: String(rate), tts_pitch: String(pitch) })
  });
  appSettings.tts_voice = voiceId;
  appSettings.tts_engine = engine;
  appSettings.google_tts_api_key = gkey;
  appSettings.tts_rate = String(rate);
  appSettings.tts_pitch = String(pitch);

  const langCode = voiceId.split("-")[0] || "tr";
  const sample = VOICE_TEST_SAMPLES[langCode] || VOICE_TEST_SAMPLES.tr;
  const st = document.getElementById("voice-test-status");
  if (st) st.textContent = "⏳ Hazırlanıyor...";
  await speakTextNow(sample, { voice_id: voiceId, engine, google_api_key: gkey, rate, pitch, statusEl: st });
}

function speakMessage(mid, btnEl) {
  if (activeSpeechMsgId === mid) {
    stopVoicePlayback();
    return;
  }
  const m = currentMessages.find(x => x.id === mid);
  if (!m) return;
  speakTextNow(m.content || "", { msgId: mid, btnEl });
}

// --- SOHBET GÖRÜNÜMÜ MODALI (CHAT APPEARANCE) ---
function openChatAppearanceModal() {
  document.getElementById("ca-theme").value = appSettings.theme || "dark";
  const fs = appSettings.font_size || "16";
  document.getElementById("ca-font-size").value = fs;
  document.getElementById("ca-font-val").textContent = fs;
  document.getElementById("ca-user-col").value = appSettings.bubble_user_color || "#0d2b4e";
  document.getElementById("ca-bot-col").value = appSettings.bubble_bot_color || "#15161a";
  document.getElementById("ca-italic-col").value = appSettings.rp_italic_color || "#4ade80";
  document.getElementById("ca-bg-url").value = appSettings.chat_bg_url || "";
  document.getElementById("appearance-modal").classList.remove("hidden");
}

async function uploadAppearanceBg(input) {
  if (!input.files || !input.files[0]) return;
  const fd = new FormData();
  fd.append("file", input.files[0]);
  const res = await fetch("/api/upload?mode=bg", { method: "POST", body: fd }).then(r => r.json());
  if (res.url) document.getElementById("ca-bg-url").value = res.url;
  input.value = "";
}

function resetChatAppearanceDefaults() {
  document.getElementById("ca-theme").value = "dark";
  document.getElementById("ca-font-size").value = "16";
  document.getElementById("ca-font-val").textContent = "16";
  document.getElementById("ca-user-col").value = "#0d2b4e";
  document.getElementById("ca-bot-col").value = "#15161a";
  document.getElementById("ca-italic-col").value = "#4ade80";
  document.getElementById("ca-bg-url").value = "";
}

async function saveChatAppearanceModal() {
  const payload = {
    theme: document.getElementById("ca-theme").value,
    font_size: document.getElementById("ca-font-size").value,
    bubble_user_color: document.getElementById("ca-user-col").value,
    bubble_bot_color: document.getElementById("ca-bot-col").value,
    rp_italic_color: document.getElementById("ca-italic-col").value,
    chat_bg_url: document.getElementById("ca-bg-url").value.trim()
  };
  await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  await loadAppearance();
  closeModal("appearance-modal");
}

// --- ÜRETİM AYARLARI MODALI (GENERATION SETTINGS) ---
function openGenSettingsModal() {
  const gsm = document.getElementById("gs-speed-mode");
  if (gsm) gsm.value = appSettings.speed_mode || "turbo";
  document.getElementById("gs-tone").value = appSettings.story_tone || "emotional";
  document.getElementById("gs-preset").value = appSettings.preset || "gemma4_rp";
  document.getElementById("gs-temp").value = appSettings.temperature || "0.85";
  document.getElementById("gs-rep").value = appSettings.rep_penalty || "1.02";
  const gtp = document.getElementById("gs-top-p"); if (gtp) gtp.value = appSettings.top_p || "0.95";
  const gtk = document.getElementById("gs-top-k"); if (gtk) gtk.value = appSettings.top_k || "64";
  document.getElementById("gs-min-p").value = appSettings.min_p || "0.05";
  document.getElementById("gs-max-tokens").value = appSettings.max_tokens || "700";
  document.getElementById("gs-ctx-msgs").value = appSettings.context_messages || "16";
  document.getElementById("gs-model").value = appSettings.model_name || "";
  document.getElementById("gs-no-think").checked = (appSettings.no_think_prefix ?? "1") === "1";
  document.getElementById("gs-strict").checked = (appSettings.strict_consistency ?? "1") === "1";
  const gsJ = document.getElementById("gs-ai-judge");
  if (gsJ) gsJ.checked = (appSettings.ai_judge_enabled ?? "0") === "1";
  const gsLs = document.getElementById("gs-live-stream");
  if (gsLs) gsLs.checked = (appSettings.live_stream ?? "0") === "1";
  document.getElementById("gen-settings-modal").classList.remove("hidden");
}

function applyGenModalPreset() {
  const p = document.getElementById("gs-preset").value;
  const setV = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  if (p === "gemma4_rp") { setV("gs-temp", "0.85"); setV("gs-top-p", "0.95"); setV("gs-top-k", "64"); setV("gs-rep", "1.02"); setV("gs-min-p", "0.05"); }
  else if (p === "qwen35_rp") { setV("gs-temp", "0.70"); setV("gs-top-p", "0.85"); setV("gs-top-k", "20"); setV("gs-rep", "1.05"); setV("gs-min-p", "0.05"); }
  else if (p === "turkish_rp") { setV("gs-temp", "0.76"); setV("gs-top-p", "0.90"); setV("gs-top-k", "40"); setV("gs-rep", "1.06"); setV("gs-min-p", "0.05"); }
  else if (p === "precise") { setV("gs-temp", "0.55"); setV("gs-top-p", "0.85"); setV("gs-top-k", "30"); setV("gs-rep", "1.05"); setV("gs-min-p", "0.08"); }
}

async function saveGenSettingsModal() {
  const spdVal = document.getElementById("gs-speed-mode")?.value || appSettings.speed_mode || "turbo";
  const maxCharsMap = { ultra: "3600", turbo: "5200", balanced: "7800", long: "10500" };
  const payload = {
    speed_mode: spdVal,
    max_prompt_chars: maxCharsMap[spdVal] || "5500",
    story_tone: document.getElementById("gs-tone").value,
    preset: document.getElementById("gs-preset").value,
    temperature: document.getElementById("gs-temp").value,
    rep_penalty: document.getElementById("gs-rep").value,
    top_p: document.getElementById("gs-top-p")?.value || appSettings.top_p || "0.95",
    top_k: document.getElementById("gs-top-k")?.value || appSettings.top_k || "64",
    min_p: document.getElementById("gs-min-p").value,
    max_tokens: document.getElementById("gs-max-tokens").value,
    context_messages: document.getElementById("gs-ctx-msgs").value,
    model_name: document.getElementById("gs-model").value.trim(),
    no_think_prefix: document.getElementById("gs-no-think").checked ? "1" : "0",
    strict_consistency: document.getElementById("gs-strict").checked ? "1" : "0",
    ai_judge_enabled: (document.getElementById("gs-ai-judge") && document.getElementById("gs-ai-judge").checked) ? "1" : "0",
    live_stream: (document.getElementById("gs-live-stream") && document.getElementById("gs-live-stream").checked) ? "1" : "0"
  };
  await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  Object.assign(appSettings, payload);
  closeModal("gen-settings-modal");
}

// --- COMPOSER MENÜLERİ (+, RESİM EKLE, WEB ARAMASI, OOC, ÖNER) ---
function togglePlusMenu(e) {
  if (e) e.stopPropagation();
  document.getElementById("chat-options-menu")?.classList.add("hidden");
  document.getElementById("composer-plus-menu")?.classList.toggle("hidden");
}

function closePlusMenu() {
  document.getElementById("composer-plus-menu")?.classList.add("hidden");
}

function autoGrowChatInput(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(160, Math.max(24, el.scrollHeight)) + "px";
}

function insertDirectorCmd() {
  const inp = document.getElementById("chat-input");
  if (!inp) return;
  if (!inp.value.startsWith("/cmd ")) {
    inp.value = "/cmd " + inp.value;
  }
  autoGrowChatInput(inp);
  inp.focus();
}

function triggerChatImageUpload() {
  document.getElementById("chat-image-file")?.click();
}

async function uploadChatImageFile(file) {
  if (!file) return;
  const fd = new FormData();
  fd.append("file", file);
  const resp = await fetch("/api/upload?mode=chat", { method: "POST", body: fd });
  if (!resp.ok) return alert("Görsel yüklenemedi.");
  const res = await resp.json();
  if (res.url) {
    pendingChatImageUrl = res.url;
    document.getElementById("chat-img-preview-thumb").src = res.url;
    document.getElementById("chat-img-preview-chip").classList.remove("hidden");
    document.getElementById("btn-composer-image")?.classList.add("active-tool");
    updateComposerMetaRow();
    document.getElementById("chat-input")?.focus();
  }
}

async function handleChatImageSelected(input) {
  if (input.files && input.files[0]) {
    await uploadChatImageFile(input.files[0]);
  }
  input.value = "";
}

async function handleChatPaste(e) {
  const items = (e.clipboardData && e.clipboardData.items) ? e.clipboardData.items : [];
  for (const it of items) {
    if (it.type && it.type.startsWith("image/")) {
      e.preventDefault();
      const file = it.getAsFile();
      if (file) await uploadChatImageFile(file);
      return;
    }
  }
}

function clearPendingChatImage() {
  pendingChatImageUrl = "";
  document.getElementById("chat-img-preview-chip")?.classList.add("hidden");
  document.getElementById("btn-composer-image")?.classList.remove("active-tool");
  updateComposerMetaRow();
}

function toggleWebSearchMode(forceVal) {
  webSearchActive = (forceVal === undefined) ? !webSearchActive : Boolean(forceVal);
  document.getElementById("web-search-badge")?.classList.toggle("hidden", !webSearchActive);
  document.getElementById("pm-web-check")?.classList.toggle("hidden", !webSearchActive);
  updateComposerMetaRow();
}

function updateComposerMetaRow() {
  const row = document.getElementById("composer-meta-row");
  if (!row) return;
  row.classList.toggle("hidden", !pendingChatImageUrl && !webSearchActive);
}

// --- YANIT ÖNERİLERİ (💡 ÖNER / SUGGEST) ---
async function requestReplySuggestions(forceRefresh = false) {
  if (!currentChatId) return;
  const tray = document.getElementById("suggest-tray");
  const list = document.getElementById("suggest-list");
  if (!forceRefresh && !tray.classList.contains("hidden") && list.children.length) {
    tray.classList.add("hidden");
    return;
  }
  tray.classList.remove("hidden");
  document.getElementById("btn-composer-suggest")?.classList.add("active-tool");
  list.innerHTML = `<div class="muted small-text" style="padding:8px;">✨ Sahneye uygun yanıt önerileri hazırlanıyor...</div>`;
  try {
    const res = await fetch(`/api/chats/${currentChatId}/suggest`, { method: "POST" }).then(r => r.json());
    const items = res.suggestions || [];
    if (!items.length) {
      list.innerHTML = `<div class="muted small-text" style="padding:8px;">Öneri üretilemedi.</div>`;
      return;
    }
    list.innerHTML = items.map((txt, idx) => `
      <button type="button" class="suggest-chip-btn" data-sidx="${idx}" onclick="applySuggestion(this)">${escapeHtml(txt)}</button>
    `).join("");
  } catch (err) {
    list.innerHTML = `<div class="muted small-text" style="padding:8px;">Öneri alınamadı: ${escapeHtml(err.message)}</div>`;
  }
}

function applySuggestion(btnEl) {
  const inp = document.getElementById("chat-input");
  if (!inp || !btnEl) return;
  inp.value = btnEl.textContent || "";
  autoGrowChatInput(inp);
  closeSuggestTray();
  inp.focus();
}

function closeSuggestTray() {
  document.getElementById("suggest-tray")?.classList.add("hidden");
  document.getElementById("btn-composer-suggest")?.classList.remove("active-tool");
}

function openWhyModal() {
  const box = document.getElementById("why-modal-body");
  if (!box) return;
  const rb = getActiveChatRulebook();
  const notes = (currentChatData && currentChatData.active_notes) ? currentChatData.active_notes : [];
  const caps = (currentChatData && currentChatData.active_captions) ? currentChatData.active_captions : [];
  const lore = (currentChatData && currentChatData.active_lore) ? currentChatData.active_lore : [];
  const hasLore = Boolean(currentChatData && currentChatData.has_lorebook);
  const st = currentChatData ? (currentChatData.state || {}) : {};
  let html = "";

  if (lore.length) {
    html += `<div class="sc-field"><div class="sc-label">📖 Aktif Lorebook Profilleri (${lore.length})</div><div class="rbe-subbox small-text">${lore.map(l => `<div style="margin-bottom:6px;"><b>${escapeHtml(l.name)}</b> <span class="tag">${escapeHtml(l.reason || "Aktif")}</span><div class="muted" style="margin-top:2px;">${escapeHtml(l.preview || "")}</div></div>`).join("")}</div></div>`;
  } else if (hasLore) {
    html += `<div class="sc-field"><div class="sc-label">📖 Lorebook</div><div class="muted small-text">Bu turda eşleşen bir Lorebook anahtar kelimesi yok.</div></div>`;
  }

  if (rb && rb.meters && rb.meters.length) {
    if (caps.length) {
      html += `<div class="sc-field"><div class="sc-label">Aktif Durum Satırı</div><div class="rbe-subbox small-text">${caps.map(c => `<div>• ${escapeHtml(c)}</div>`).join("")}</div></div>`;
    }
    if (notes.length) {
      html += `<div class="sc-field"><div class="sc-label">♟ Modele Giden Rulebook Kuralları</div><div class="rbe-subbox small-text">${notes.map(n => `<div style="margin-bottom:4px;">• ${escapeHtml(n)}</div>`).join("")}</div></div>`;
    } else {
      html += `<div class="muted small-text" style="padding:6px 0;">Şu an tetiklenen özel bir seviye talimatı yok; göstergelerin güncel değerleri modele iletiliyor.</div>`;
    }
    if (st.clock) {
      html += `<div class="muted small-text" style="margin-top:8px;">🕒 Güncel Saat: <b>${escapeHtml(st.clock)}</b></div>`;
    }
  } else if (!lore.length && !hasLore) {
    html = `<div class="muted small-text" style="padding:12px;">Bu sohbette bağlı bir Lorebook veya Rulebook bulunmuyor.</div>`;
  }
  const dbg = currentChatData && currentChatData.last_debug;
  if (dbg) {
    const tm = dbg.timing;
    let diagHint = "";
    if (tm) {
      if ((tm.reasoning_chars || 0) > 100) {
        diagHint = `<div style="color:#fbbf24;margin-top:5px;">⚠ <b>Yavaşlık Nedeni:</b> Model <b>${tm.reasoning_chars} karakter</b> gizli düşünme üretti! LM Studio'da model ayarlarından Thinking/Reasoning'i kapat veya Motor Merkezi'nden Turbo llama-server'a geç.</div>`;
      } else if (tm.tps > 0 && tm.tps < 10) {
        diagHint = `<div style="color:#fbbf24;margin-top:5px;">⚠ <b>Yavaşlık Nedeni:</b> Üretim hızı <b>${tm.tps} tok/s</b> (6GB RTX 2060 VRAM taşıp yavaş RAM'e kaymış). Gemma 4 26B için Ayarlar → Motor Merkezi'nden <b>Turbo llama-server</b>'ı seç; 5 sn altı için 5GB altı 8B/9B Q4 model kullan.</div>`;
      } else if (tm.ttft > 8) {
        diagHint = `<div style="color:#fbbf24;margin-top:5px;">⚠ <b>Yavaşlık Nedeni:</b> İlk token bekleme (Prompt okuma) <b>${tm.ttft}s</b> sürdü. Üretim Ayarları → Yanıt Hız Modu'nu <b>Ultra Hızlı</b> yap.</div>`;
      }
    }
    const tmHtml = tm ? `<div style="color:${tm.total_s > 12 ? '#fbbf24' : '#4ade80'};margin-bottom:4px;">⚡ İlk token: <b>${tm.ttft}s</b> · Üretim: <b>${tm.gen_s}s</b> · Toplam: <b>${tm.total_s}s</b> (~${tm.tps} tok/s)</div>` : "";
    html += `<div class="sc-field" style="margin-top:12px;"><div class="sc-label">🔍 Son İstek Teşhisi (Bağlam & Hız)</div>
      <div class="rbe-subbox small-text">
        ${tmHtml}
        <div>Tahmini Girdi: <b>~${dbg.est_tokens} token</b> (${dbg.total_chars} karakter) · ${dbg.msg_count} mesaj</div>
        <div>Sistem: ${dbg.sys_chars} kar · Aktif Lore: ${dbg.lore_count} · Roller: <code>${escapeHtml((dbg.roles || []).join(" → "))}</code></div>
        ${diagHint}
      </div></div>`;
  }
  box.innerHTML = html;
  document.getElementById("why-modal").classList.remove("hidden");
}

async function resumeCharChat(cid, chatId) {
  await loadCharacters();
  currentGroup = null;
  currentCharacter = characters.find(c => c.id === cid);
  if (!currentCharacter) return;
  currentChatId = chatId;
  updateChatHeaderVisuals(currentCharacter.name, getProfileHandle(), currentCharacter.avatar_url);
  showView("chat");
  await refreshChatList(false);
  await loadChat(chatId);
}

async function resumeGroupChat(gid, chatId) {
  await Promise.all([loadGroups(), loadCharacters()]);
  currentCharacter = null;
  currentGroup = groups.find(g => g.id === gid);
  if (!currentGroup) return;
  currentChatId = chatId;
  updateChatHeaderVisuals(currentGroup.name, currentGroup.title || getProfileHandle(), currentGroup.avatar_url);
  showView("chat");
  await refreshChatList(false);
  await loadChat(chatId);
}

async function deleteChatFromAll(chatId) {
  if (!confirm("Bu sohbet silinsin mi?")) return;
  await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
  await loadAllChats();
}

async function openPersonaPicker(kind, targetId, existingChatId = null, returnView = "creations") {
  await loadPersonas();
  const obj = kind === "group"
    ? groups.find(g => g.id === targetId)
    : characters.find(c => c.id === targetId);
  if (!obj) return;

  personaPickerTarget = {
    kind,
    id: targetId,
    name: obj.name || "Chatbot",
    avatar_url: obj.avatar_url || "",
    existingChatId,
    returnView
  };

  const defP = personas.find(p => p.is_default) || personas[0];
  personaPickerSelectedId = defP ? defP.id : null;

  document.getElementById("pp-heading").textContent = `${obj.name} ile kim sohbet edecek?`;
  document.getElementById("pp-start-btn").textContent = `${obj.name} ile Sohbet Et`;
  document.getElementById("pp-search-input").value = "";
  document.getElementById("pp-dont-show").checked = false;

  const botAv = document.getElementById("pp-bot-av");
  const botFb = document.getElementById("pp-bot-av-fb");
  if (obj.avatar_url) {
    botAv.src = obj.avatar_url;
    botAv.classList.remove("hidden");
    botFb.classList.add("hidden");
  } else {
    botAv.classList.add("hidden");
    botFb.textContent = (obj.name || "C")[0].toUpperCase();
    botFb.classList.remove("hidden");
  }

  const resBtn = document.getElementById("pp-resume-btn");
  if (resBtn) resBtn.classList.toggle("hidden", !existingChatId);

  renderPersonaPicker();
  showView("persona-picker");
}

function renderPersonaPicker() {
  const grid = document.getElementById("pp-grid");
  if (!grid) return;

  const selP = personas.find(p => p.id === personaPickerSelectedId) || personas[0];
  const selAv = document.getElementById("pp-sel-av");
  const selFb = document.getElementById("pp-sel-av-fb");
  if (selP && selP.avatar_url) {
    selAv.src = selP.avatar_url;
    selAv.classList.remove("hidden");
    selFb.classList.add("hidden");
  } else {
    selAv.classList.add("hidden");
    selFb.textContent = ((selP && selP.name) ? selP.name[0] : "P").toUpperCase();
    selFb.classList.remove("hidden");
  }

  const q = (document.getElementById("pp-search-input")?.value || "").toLowerCase().trim();
  const list = personas.filter(p => !q || p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));

  if (!list.length) {
    grid.innerHTML = `<div class="muted small-text" style="grid-column:1/-1;text-align:center;padding:24px;">Eşleşen persona bulunamadı.</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const isSel = (p.id === personaPickerSelectedId);
    const avHtml = p.avatar_url
      ? `<img class="pp-item-av" src="${p.avatar_url}" alt="" />`
      : `<div class="pp-item-av-fb">${escapeHtml((p.name || "P")[0].toUpperCase())}</div>`;
    return `
      <button type="button" class="pp-item ${isSel ? 'selected' : ''}" onclick="selectPickerPersona(${p.id})">
        ${avHtml}
        <div class="pp-item-info">
          <div class="pp-item-head">
            <span class="pp-item-name">${escapeHtml(p.name)}</span>
            ${p.is_default ? `<span class="pp-def-pill">Varsayılan</span>` : ""}
          </div>
          <div class="pp-item-desc">${escapeHtml(p.description || "Açıklama eklenmemiş...")}</div>
        </div>
        <span class="pp-radio"><span class="pp-radio-dot"></span></span>
      </button>`;
  }).join("");
}

function selectPickerPersona(pid) {
  personaPickerSelectedId = pid;
  renderPersonaPicker();
}

function goBackFromPersonaPicker() {
  if (personaPickerTarget && personaPickerTarget.returnView === "chat" && currentChatId) {
    showView("chat");
  } else {
    openCreations(personaPickerTarget?.kind === "group" ? "groups" : "chatbots");
  }
}

async function resumeFromPersonaPicker() {
  if (!personaPickerTarget || !personaPickerTarget.existingChatId) return;
  if (personaPickerTarget.kind === "group") {
    await resumeGroupChat(personaPickerTarget.id, personaPickerTarget.existingChatId);
  } else {
    await resumeCharChat(personaPickerTarget.id, personaPickerTarget.existingChatId);
  }
}

async function confirmPersonaPicker() {
  if (!personaPickerTarget) return;
  const dontShow = document.getElementById("pp-dont-show")?.checked;
  if (dontShow) {
    appSettings.skip_persona_picker = "1";
    await fetch("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skip_persona_picker: "1" })
    });
  }

  const chosenPersonaId = personaPickerSelectedId;
  const { kind, id } = personaPickerTarget;

  if (kind === "group") {
    await enterGroupChatDirect(id, true, chosenPersonaId);
  } else {
    await enterCharChatDirect(id, true, chosenPersonaId);
  }
}

async function enterCharChatDirect(cid, forceCreateNew = false, explicitPersonaId = null) {
  await loadCharacters();
  currentGroup = null;
  currentCharacter = characters.find(c => c.id === cid);
  if (!currentCharacter) return;
  updateChatHeaderVisuals(currentCharacter.name, getProfileHandle(), currentCharacter.avatar_url);
  showView("chat");
  if (forceCreateNew) {
    await createChatAndOpen(explicitPersonaId);
  } else {
    await refreshChatList(true);
  }
}

async function enterGroupChatDirect(gid, forceCreateNew = false, explicitPersonaId = null) {
  await Promise.all([loadGroups(), loadCharacters()]);
  currentCharacter = null;
  currentGroup = groups.find(g => g.id === gid);
  if (!currentGroup) return;
  updateChatHeaderVisuals(currentGroup.name, currentGroup.title || getProfileHandle(), currentGroup.avatar_url);
  showView("chat");
  if (forceCreateNew) {
    await createChatAndOpen(explicitPersonaId);
  } else {
    await refreshChatList(true);
  }
}

async function openChatWith(cid) {
  await loadCharacters();
  if (appSettings.skip_persona_picker !== "1") {
    const existing = await fetch(`/api/characters/${cid}/chats`).then(r => r.json());
    const lastId = existing.length ? existing[0].id : null;
    await openPersonaPicker("character", cid, lastId, "creations");
    return;
  }
  await enterCharChatDirect(cid, false, null);
}

async function openGroupChat(gid) {
  await Promise.all([loadGroups(), loadCharacters()]);
  if (appSettings.skip_persona_picker !== "1") {
    const existing = await fetch(`/api/groups/${gid}/chats`).then(r => r.json());
    const lastId = existing.length ? existing[0].id : null;
    await openPersonaPicker("group", gid, lastId, "creations");
    return;
  }
  await enterGroupChatDirect(gid, false, null);
}

async function triggerGroupSpeaker(speakerId) {
  await runStream({ mode: "continue", speaker_id: speakerId });
}

async function refreshChatList(autoOpen = false) {
  const url = currentGroup ? `/api/groups/${currentGroup.id}/chats` : `/api/characters/${currentCharacter.id}/chats`;
  const list = await fetch(url).then(r => r.json());
  const el = document.getElementById("chat-history-list");
  if (!list.length) { await createChatAndOpen(null); return; }
  if (autoOpen && !list.some(x => x.id === currentChatId)) currentChatId = list[0].id;
  el.innerHTML = list.map(ch => `
    <div class="history-item ${ch.id === currentChatId ? 'active' : ''}" onclick="closeModal('saved-chats-modal');loadChat(${ch.id})">
      <span>${escapeHtml(ch.title)}</span>
      <button class="history-del" onclick="event.stopPropagation(); deleteChat(${ch.id})">✕</button>
    </div>
  `).join("");
  if (autoOpen) await loadChat(currentChatId);
}

async function createChatAndOpen(explicitPersonaId = null) {
  const body = currentGroup ? { group_id: currentGroup.id } : { character_id: currentCharacter.id };
  if (explicitPersonaId) body.persona_id = Number(explicitPersonaId);
  const res = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
  currentChatId = res.id;
  lastStreamError = null;
  await refreshChatList(false);
  await loadChat(currentChatId);
}

async function startNewChat() {
  if (appSettings.skip_persona_picker !== "1") {
    const kind = currentGroup ? "group" : "character";
    const tid = currentGroup ? currentGroup.id : (currentCharacter ? currentCharacter.id : null);
    if (tid) {
      await openPersonaPicker(kind, tid, currentChatId, "chat");
      return;
    }
  }
  await createChatAndOpen(null);
}

async function cloneCurrentChat() {
  if (!currentChatId) return;
  const res = await fetch(`/api/chats/${currentChatId}/clone`, { method: "POST" }).then(r => r.json());
  currentChatId = res.id;
  await refreshChatList(false);
  await loadChat(currentChatId);
}

async function deleteChat(chatId) {
  if (!confirm("Bu sohbet silinsin mi?")) return;
  await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
  if (currentChatId === chatId) currentChatId = null;
  await refreshChatList(true);
}

async function loadChat(chatId, keepError = false) {
  stopVoicePlayback();
  currentChatId = chatId;
  editingMessageId = null;
  if (!keepError) lastStreamError = null;
  const data = await fetch(`/api/chats/${chatId}/messages`).then(r => r.json());
  currentChatData = data.chat;
  currentMessages = data.messages;
  document.getElementById("chat-persona-select").value = data.chat.persona_id || "";
  updateMemoryIndicator();
  renderHUD();
  renderMessages();
  refreshChatList(false);
}

function getActiveChatRulebook() {
  if (currentChatData && currentChatData.active_rulebook && currentChatData.active_rulebook.meters) {
    return currentChatData.active_rulebook;
  }
  return currentCharacter ? currentCharacter.rulebook : null;
}

function getActiveChatRulebookId() {
  if (currentChatData && currentChatData.active_rulebook_id) return currentChatData.active_rulebook_id;
  return currentCharacter ? currentCharacter.rulebook_id : null;
}

async function changeChatPersona() {
  const pid = document.getElementById("chat-persona-select").value;
  await fetch(`/api/chats/${currentChatId}/persona`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ persona_id: pid ? Number(pid) : null })
  });
  await loadChat(currentChatId);
}

// --- HAFIZA MODALI & MESAJ SABİTLEME ---
function updateMemoryIndicator() {
  const dot = document.getElementById("mem-active-dot");
  if (!dot) return;
  const hasMem = Boolean(
    currentChatData &&
    ((currentChatData.pinned_memory && currentChatData.pinned_memory.trim()) ||
     (currentChatData.summary && currentChatData.summary.trim()))
  );
  dot.classList.toggle("hidden", !hasMem);
}

async function pinMessageToMemory(mid) {
  if (!currentChatId || !currentChatData) return;
  const m = currentMessages.find(x => x.id === mid);
  if (!m) return;
  const snippet = String(m.content || "").replace(/\*+/g, "").replace(/\s+/g, " ").trim().slice(0, 220);
  if (!snippet) return;
  const author = m.speaker_name || (m.role === "user" ? "Kullanıcı" : "Karakter");
  const newLine = `• ${author}: ${snippet}`;
  const curPinned = (currentChatData.pinned_memory || "").trim();
  const updatedPinned = curPinned ? `${curPinned}\n${newLine}` : newLine;
  await fetch(`/api/chats/${currentChatId}/memory`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned_memory: updatedPinned, summary: currentChatData.summary || "" })
  });
  currentChatData.pinned_memory = updatedPinned;
  updateMemoryIndicator();
  const nEl = document.getElementById("hud-notify");
  if (nEl) {
    nEl.textContent = "📌 Mesaj Kalıcı Hafıza Notlarına sabitlendi!";
    nEl.classList.remove("hidden");
    setTimeout(() => nEl.classList.add("hidden"), 3500);
  }
}

function openMemoryModal() {
  if (!currentChatData) return;
  document.getElementById("mem-pinned").value = currentChatData.pinned_memory || "";
  document.getElementById("mem-summary").value = currentChatData.summary || "";
  document.getElementById("memory-modal").classList.remove("hidden");
}

async function saveMemoryModal() {
  const pinned = document.getElementById("mem-pinned").value;
  const summary = document.getElementById("mem-summary").value;
  await fetch(`/api/chats/${currentChatId}/memory`, {
    method: "PUT", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned_memory: pinned, summary })
  });
  currentChatData.pinned_memory = pinned;
  currentChatData.summary = summary;
  updateMemoryIndicator();
  closeModal("memory-modal");
}

async function runManualSummarize() {
  const btn = document.getElementById("btn-resum");
  btn.disabled = true;
  btn.textContent = "⏳ Özetleniyor...";
  try {
    const res = await fetch(`/api/chats/${currentChatId}/summarize`, { method: "POST" }).then(r => r.json());
    document.getElementById("mem-summary").value = res.summary || "";
    currentChatData.summary = res.summary || "";
  } finally {
    btn.disabled = false;
    btn.textContent = "↻ Şimdi Güncelle / Özetle";
  }
}

// --- HUD RENDER ---
function ensureLocalState() {
  const rb = getActiveChatRulebook();
  if (!currentChatData) return null;
  if (!currentChatData.state || typeof currentChatData.state !== "object") currentChatData.state = {};
  const st = currentChatData.state;
  if (!st.meters || typeof st.meters !== "object") st.meters = {};
  if (!Array.isArray(st.inventory)) st.inventory = [];
  if (!st.journals || typeof st.journals !== "object") st.journals = {};
  if (rb) {
    const cm = (rb.meters || []).find(x => canonMeterType(x.type) === "clock");
    if (!st.clock) st.clock = (cm && cm.start) ? String(cm.start).replace("T"," ").slice(0,16) : (rb.start_datetime || "2026-06-03 11:30");
    for (const m of (rb.meters || [])) {
      const mid = m.id || m.name;
      if (!mid) continue;
      const t = canonMeterType(m.type);
      if (t === "clock") st.meters[mid] = st.clock;
      else if (t === "collection") {
        if (!Array.isArray(st.meters[mid])) {
          const defItems = Array.isArray(m.items) ? m.items.filter(it => (it.start ?? 0) > 0).map(it => it.label) : (Array.isArray(m.default) ? [...m.default] : []);
          st.meters[mid] = st.inventory.length ? [...st.inventory] : defItems;
          if (!st.inventory.length) st.inventory = [...st.meters[mid]];
        }
      } else if (t === "journal") {
        if (!Array.isArray(st.journals[mid])) {
          st.journals[mid] = Array.isArray(m.items) ? m.items.filter(it => it.at_start).map(it => it.label) : [];
        }
        st.meters[mid] = st.journals[mid].join(", ");
      } else if (st.meters[mid] === undefined) {
        st.meters[mid] = (t === "text" || t === "select") ? String(m.default ?? (m.options?.[0] || "")) : Number(m.default ?? m.min ?? 0);
      }
    }
  }
  return st;
}

function getLevelLabel(m, val) {
  const levels = getMeterLevels(m);
  if (!levels.length || isNaN(val)) return "";
  const num = Number(val);
  for (const lvl of levels) {
    if (num >= Number(lvl.min ?? -1e12) && num <= Number(lvl.max ?? 1e12)) return lvl.label || "";
  }
  return "";
}

function formatShortHudClock(clockStr) {
  const m = String(clockStr || "").match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!m) return clockStr || "";
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const wds = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
  return `${wds[dt.getDay()]} ${m[4]}:${m[5]}`;
}

function formatHudNumber(val, unit) {
  const num = Number(val);
  if (isNaN(num)) return `${val}${unit || ""}`;
  const formatted = num.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  return `${formatted}${unit ? " " + unit : ""}`;
}

function buildCompactHudCell(m, st) {
  const mid = m.id || m.name;
  const mname = getMeterName(m);
  const t = canonMeterType(m.type);
  const ic = getMeterIcon(m);
  const col = getMeterColor(m);
  const activeVal = t === "clock" ? st.clock : ((st.meters && st.meters[mid] !== undefined) ? st.meters[mid] : (m.default ?? 0));
  const activeImg = resolveMeterActiveImage(m, activeVal);
  const icoHtml = activeImg
    ? `<span class="sc-hud-ico-badge has-img c-${col}"><img src="${escapeHtml(activeImg)}" alt="" /></span>`
    : `<span class="sc-hud-ico-badge c-${col}">${METER_ICONS[ic] || METER_ICONS.shield}</span>`;

  if (t === "clock") {
    return `
      <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}: ${escapeHtml(st.clock)}" onclick="openHudModal('__clock__')">
        <div class="sc-hud-row">
          ${icoHtml}
          <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
          <span class="sc-hud-val">${escapeHtml(formatShortHudClock(st.clock))}</span>
        </div>
      </div>`;
  }

  if (t === "collection") {
    const arr = Array.isArray(st.meters[mid]) ? st.meters[mid] : (st.inventory || []);
    const preview = arr.length ? arr.slice(0, 2).join(", ") + (arr.length > 2 ? ` +${arr.length - 2}` : "") : "Boş";
    return `
      <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}: ${escapeHtml(arr.join(', '))}" onclick="openHudModal('__inv__')">
        <div class="sc-hud-row">
          ${icoHtml}
          <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
          <span class="sc-hud-val">${escapeHtml(preview)}</span>
        </div>
      </div>`;
  }

  if (t === "journal") {
    const arr = (st.journals && st.journals[mid]) ? st.journals[mid] : [];
    const preview = arr.length ? arr[arr.length - 1] : "—";
    return `
      <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}: ${escapeHtml(arr.join(', '))}" onclick="openHudModal('${escapeHtml(mid)}')">
        <div class="sc-hud-row">
          ${icoHtml}
          <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
          <span class="sc-hud-val">${escapeHtml(preview)}</span>
        </div>
      </div>`;
  }

  const val = (st.meters && st.meters[mid] !== undefined) ? st.meters[mid] : (m.default ?? 0);

  if (t === "select") {
    return `
      <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}: ${escapeHtml(val)} (Değiştirmek için tıkla)" onclick="openSelectPicker('${escapeHtml(mid)}')">
        <div class="sc-hud-row">
          ${icoHtml}
          <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
          <span class="sc-hud-val loc-highlight">${escapeHtml(val)}</span>
        </div>
      </div>`;
  }

  if (t === "bar" || t === "pips") {
    const mn = Number(m.min ?? 0);
    const mx = Number(m.max ?? 100);
    const pct = mx > mn ? Math.max(0, Math.min(100, ((Number(val) - mn) / (mx - mn)) * 100)) : 0;
    return `
      <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}: ${val}/${mx}" onclick="openHudModal('${escapeHtml(mid)}')">
        <div class="sc-hud-row">
          ${icoHtml}
          <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
          <span class="sc-hud-val">${val}</span>
        </div>
        <div class="sc-hud-line-track"><div class="sc-hud-line-fill" style="width:${pct}%"></div></div>
      </div>`;
  }

  if (t === "number") {
    return `
      <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}: ${escapeHtml(formatHudNumber(val, m.unit))}" onclick="openHudModal('${escapeHtml(mid)}')">
        <div class="sc-hud-row">
          ${icoHtml}
          <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
          <span class="sc-hud-val">${escapeHtml(formatHudNumber(val, m.unit))}</span>
        </div>
      </div>`;
  }

  if (t === "dice") {
    return `
      <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}" onclick="openHudModal('${escapeHtml(mid)}')">
        <div class="sc-hud-row">
          ${icoHtml}
          <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
          <span class="sc-hud-val">${val}/d${m.sides || 20}</span>
        </div>
      </div>`;
  }

  // text
  return `
    <div class="sc-hud-cell c-${col}" title="${escapeHtml(mname)}: ${escapeHtml(val)}" onclick="openHudModal('${escapeHtml(mid)}')">
      <div class="sc-hud-row">
        ${icoHtml}
        <span class="sc-hud-lbl">${escapeHtml(mname)}</span>
        <span class="sc-hud-val">${escapeHtml(val)}</span>
      </div>
    </div>`;
}

function toggleHudPanelDrawer() { hudPanelOpen = !hudPanelOpen; renderHUD(); }

function renderHUD() {
  const bar = document.getElementById("hud-bar");
  const rb = getActiveChatRulebook();
  if (!rb || !rb.meters || !rb.meters.length || !currentChatData) {
    bar.classList.add("hidden");
    return;
  }
  const st = ensureLocalState();
  bar.classList.remove("hidden");

  const visibleMeters = rb.meters.filter(m => getMeterVisibility(m) !== "hidden");
  const shownMeters = visibleMeters.filter(m => getMeterVisibility(m) === "shown");
  const panelMeters = visibleMeters.filter(m => getMeterVisibility(m) === "panel");
  const hasClockMeter = visibleMeters.some(m => canonMeterType(m.type) === "clock");

  const displayedMeters = hudPanelOpen ? [...shownMeters, ...panelMeters] : shownMeters;

  let cellsHtml = "";
  if (!hasClockMeter && st.clock) {
    cellsHtml += `
      <div class="sc-hud-cell c-amber" title="Tarih ve Saat: ${escapeHtml(st.clock)}" onclick="openHudModal('__clock__')">
        <div class="sc-hud-row">
          <span class="sc-hud-ico-badge c-amber">${METER_ICONS.clock}</span>
          <span class="sc-hud-lbl">Tarih ve Saat</span>
          <span class="sc-hud-val">${escapeHtml(formatShortHudClock(st.clock))}</span>
        </div>
      </div>`;
  }
  for (const m of displayedMeters) {
    cellsHtml += buildCompactHudCell(m, st);
  }

  const caps = (currentChatData.active_captions || []).filter(Boolean);
  const statusText = caps.length ? caps[0] : (st.clock ? `Saat: ${st.clock}` : "");
  const isWarning = /yakalan|tehlike|sakat|skandal|sarhoş|risk/i.test(statusText);

  bar.innerHTML = `
    <div class="sc-hud-grid">${cellsHtml}</div>
    <div class="sc-hud-footer">
      <div class="sc-hud-status" title="${escapeHtml(caps.join(' · '))}">
        ${statusText ? `<span class="sc-status-dot ${isWarning ? '' : 'calm'}"></span><span>${escapeHtml(statusText)}</span>` : ""}
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        ${panelMeters.length ? `<button type="button" class="sc-hud-toggle-btn" onclick="toggleHudPanelDrawer()">${hudPanelOpen ? 'Daha az göster ⌃' : `Daha fazla göster (${panelMeters.length}) ⌄`}</button>` : ""}
      </div>
    </div>`;
}

// --- LOKASYON / SELECT PILL PICKER ---
function getMeterOptions(m) {
  if (Array.isArray(m.options) && m.options.length) return m.options;
  if (Array.isArray(m.items) && m.items.length) return m.items.map(it => it.label || it.id).filter(Boolean);
  return [];
}

function openSelectPicker(mid) {
  const rb = getActiveChatRulebook();
  if (!rb) return;
  const m = (rb.meters || []).find(x => (x.id || x.name) === mid);
  if (!m) return;
  const st = ensureLocalState();
  spActiveMeterId = mid;
  spSelectedValue = String(st.meters[mid] ?? m.default ?? "");
  spCurrentOptions = [...getMeterOptions(m)];
  if (spSelectedValue && !spCurrentOptions.includes(spSelectedValue)) spCurrentOptions.unshift(spSelectedValue);

  const icoEl = document.getElementById("sp-meter-icon");
  if (icoEl) {
    const spImg = resolveMeterActiveImage(m, spSelectedValue);
    icoEl.className = `meter-ico-badge ${spImg ? 'has-img ' : ''}c-${getMeterColor(m)}`;
    icoEl.innerHTML = spImg ? `<img src="${escapeHtml(spImg)}" alt="" />` : (METER_ICONS[getMeterIcon(m)] || METER_ICONS.globe);
  }
  document.getElementById("sp-meter-title").textContent = getMeterName(m);
  document.getElementById("sp-current-label").textContent = spSelectedValue || "Seçilmedi";
  document.getElementById("sp-new-opt").value = "";
  renderSelectPickerPills();
  document.getElementById("select-picker-modal").classList.remove("hidden");
}

function renderSelectPickerPills() {
  const grid = document.getElementById("sp-options-grid");
  if (!spCurrentOptions.length) {
    grid.innerHTML = `<span class="muted small-text">Henüz seçenek yok.</span>`;
    return;
  }
  grid.innerHTML = spCurrentOptions.map((o, idx) => `
    <button type="button" class="loc-pill-btn ${o === spSelectedValue ? 'selected' : ''}" onclick="chooseSelectPill(${idx})">${escapeHtml(o)}</button>
  `).join("");
}

function chooseSelectPill(idx) {
  if (idx < 0 || idx >= spCurrentOptions.length) return;
  spSelectedValue = spCurrentOptions[idx];
  document.getElementById("sp-current-label").textContent = spSelectedValue;
  renderSelectPickerPills();
}

async function addOptionFromPicker() {
  const inp = document.getElementById("sp-new-opt");
  const val = (inp.value || "").trim();
  if (!val) return;
  if (!spCurrentOptions.includes(val)) spCurrentOptions.push(val);
  spSelectedValue = val;
  inp.value = "";
  document.getElementById("sp-current-label").textContent = val;
  renderSelectPickerPills();

  const activeRbId = getActiveChatRulebookId();
  const activeRb = getActiveChatRulebook();
  if (activeRbId && spActiveMeterId) {
    await fetch(`/api/rulebooks/${activeRbId}/add-option`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meter_id: spActiveMeterId, option: val })
    });
    const m = (activeRb.meters || []).find(x => (x.id || x.name) === spActiveMeterId);
    if (m) { m.type = "select"; m.options = [...spCurrentOptions]; }
  }
}

async function applySelectPicker() {
  if (!spActiveMeterId) return;
  const st = ensureLocalState();
  st.meters[spActiveMeterId] = spSelectedValue;
  await fetch(`/api/chats/${currentChatId}/state`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(st)
  });
  renderHUD();
  closeModal("select-picker-modal");
}

// --- HUD MODAL ---
function openHudModal(focusId = null) {
  const rb = getActiveChatRulebook();
  if (!rb || !rb.meters || !rb.meters.length) return;
  hudDraftState = JSON.parse(JSON.stringify(ensureLocalState()));
  renderHudEditorBody();
  document.getElementById("hud-modal").classList.remove("hidden");
  if (focusId) {
    setTimeout(() => document.getElementById("hud-card-" + focusId)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }
}

function shiftDraftClock(mins) {
  const cur = hudDraftState.clock || "2026-06-03 11:30";
  const m = cur.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!m) return;
  const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  dt.setMinutes(dt.getMinutes() + mins);
  const pad = n => String(n).padStart(2, "0");
  hudDraftState.clock = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  const inp = document.getElementById("hud-in-clock");
  if (inp) inp.value = hudDraftState.clock;
}

function setDraftMeter(mid, val, isNumeric, minVal, maxVal) {
  if (isNumeric) {
    let n = Number(val);
    if (isNaN(n)) n = 0;
    if (minVal !== undefined && minVal !== null && minVal !== "") n = Math.max(Number(minVal), n);
    if (maxVal !== undefined && maxVal !== null && maxVal !== "") n = Math.min(Number(maxVal), n);
    hudDraftState.meters[mid] = Math.round(n * 100) / 100;
  } else {
    hudDraftState.meters[mid] = String(val);
  }
  const numIn = document.getElementById("hud-num-" + mid);
  const rngIn = document.getElementById("hud-rng-" + mid);
  if (numIn && isNumeric) numIn.value = hudDraftState.meters[mid];
  if (rngIn && isNumeric) rngIn.value = hudDraftState.meters[mid];
  const rb = getActiveChatRulebook();
  const mDef = (rb?.meters || []).find(x => (x.id || x.name) === mid);
  const bEl = document.getElementById("hud-badge-" + mid);
  if (bEl && mDef) bEl.textContent = getLevelLabel(mDef, hudDraftState.meters[mid]);
  if (mDef && canonMeterType(mDef.type) === "select") renderHudEditorBody();
}

function chooseDraftSelectOption(mid, optIdx) {
  const rb = getActiveChatRulebook();
  const mDef = (rb?.meters || []).find(x => (x.id || x.name) === mid);
  if (!mDef) return;
  const opts = getMeterOptions(mDef);
  if (optIdx >= 0 && optIdx < opts.length) setDraftMeter(mid, opts[optIdx], false);
}

function bumpDraftMeter(mid, delta, minVal, maxVal) {
  setDraftMeter(mid, Number(hudDraftState.meters[mid] ?? 0) + delta, true, minVal, maxVal);
}

function addDraftInvItem() {
  const inp = document.getElementById("hud-inv-new");
  const val = (inp.value || "").trim();
  if (!val) return;
  if (!Array.isArray(hudDraftState.inventory)) hudDraftState.inventory = [];
  hudDraftState.inventory.push(val);
  inp.value = "";
  renderHudInventoryChips();
}

function removeDraftInvItem(idx) {
  hudDraftState.inventory.splice(idx, 1);
  renderHudInventoryChips();
}

function renderHudInventoryChips() {
  const box = document.getElementById("hud-inv-chips");
  if (!box) return;
  const inv = hudDraftState.inventory || [];
  if (!inv.length) { box.innerHTML = `<span class="muted small-text">Envanter boş</span>`; return; }
  box.innerHTML = inv.map((item, i) => `<span class="inv-chip">${escapeHtml(item)} <button type="button" onclick="removeDraftInvItem(${i})">✕</button></span>`).join("");
}

function renderHudEditorBody() {
  const rb = getActiveChatRulebook();
  const body = document.getElementById("hud-editor-body");
  let html = `
    <div class="hud-ed-card c-amber" id="hud-card-__clock__">
      <div class="hud-ed-top">
        <span class="hud-ed-title" style="display:flex;align-items:center;gap:8px;">${iconBadgeHtml("clock","amber",true)} Tarih ve Saat</span>
        <span class="muted small-text">YYYY-AA-GG SS:DD</span>
      </div>
      <div class="hud-ed-controls">
        <input type="text" id="hud-in-clock" value="${escapeHtml(hudDraftState.clock || '')}" oninput="hudDraftState.clock=this.value" />
        <button type="button" class="btn small" onclick="shiftDraftClock(15)">+15 dk</button>
        <button type="button" class="btn small" onclick="shiftDraftClock(60)">+1 sa</button>
        <button type="button" class="btn small" onclick="shiftDraftClock(1440)">+1 gün</button>
      </div>
    </div>`;

  for (const m of (rb?.meters || [])) {
    const mid = m.id || m.name;
    const mname = getMeterName(m);
    const t = canonMeterType(m.type);
    if (t === "clock") continue;
    const ic = getMeterIcon(m);
    const col = getMeterColor(m);
    const titleHtml = `<span class="hud-ed-title" style="display:flex;align-items:center;gap:8px;">${iconBadgeHtml(ic, col, true, resolveMeterActiveImage(m, hudDraftState.meters[mid]))} ${escapeHtml(mname)}</span>`;

    if (t === "collection") {
      html += `
        <div class="hud-ed-card c-${col}" id="hud-card-__inv__">
          <div class="hud-ed-top">${titleHtml}</div>
          <div id="hud-inv-chips" class="inv-chips"></div>
          <div class="hud-ed-controls">
            <input type="text" id="hud-inv-new" placeholder="Yeni eşya adı..." onkeydown="if(event.key==='Enter'){event.preventDefault();addDraftInvItem();}" />
            <button type="button" class="btn small primary" onclick="addDraftInvItem()">+ Ekle</button>
          </div>
        </div>`;
      continue;
    }

    const curVal = hudDraftState.meters[mid] !== undefined ? hudDraftState.meters[mid] : (m.default ?? 0);
    const badge = getLevelLabel(m, curVal);
    const mOpts = getMeterOptions(m);

    if (t === "select" && mOpts.length) {
      html += `
        <div class="hud-ed-card c-${col}" id="hud-card-${escapeHtml(mid)}">
          <div class="hud-ed-top">${titleHtml}<span class="hud-ed-badge">${escapeHtml(curVal)}</span></div>
          <div class="loc-pills-grid">
            ${mOpts.map((o, oIdx) => `<button type="button" class="loc-pill-btn ${o === curVal ? 'selected' : ''}" onclick="chooseDraftSelectOption('${escapeHtml(mid)}', ${oIdx})">${escapeHtml(o)}</button>`).join("")}
          </div>
        </div>`;
    } else if (t === "text" || t === "select" || t === "journal") {
      html += `
        <div class="hud-ed-card c-${col}" id="hud-card-${escapeHtml(mid)}">
          <div class="hud-ed-top">${titleHtml}</div>
          <div class="hud-ed-controls"><input type="text" value="${escapeHtml(curVal)}" oninput="setDraftMeter('${escapeHtml(mid)}', this.value, false)" /></div>
        </div>`;
    } else if (t === "bar" || t === "pips" || t === "dice") {
      const mn = m.min ?? (t === "dice" ? 1 : 0);
      const mx = m.max ?? (t === "dice" ? (m.sides || 20) : 100);
      html += `
        <div class="hud-ed-card c-${col}" id="hud-card-${escapeHtml(mid)}">
          <div class="hud-ed-top">${titleHtml}<span class="hud-ed-badge" id="hud-badge-${escapeHtml(mid)}">${escapeHtml(badge)}</span></div>
          <div class="hud-ed-controls">
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', -10, ${mn}, ${mx})">-10</button>
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', -1, ${mn}, ${mx})">-1</button>
            <input type="range" id="hud-rng-${escapeHtml(mid)}" min="${mn}" max="${mx}" value="${curVal}" oninput="setDraftMeter('${escapeHtml(mid)}', this.value, true, ${mn}, ${mx})" />
            <input type="number" id="hud-num-${escapeHtml(mid)}" min="${mn}" max="${mx}" value="${curVal}" oninput="setDraftMeter('${escapeHtml(mid)}', this.value, true, ${mn}, ${mx})" />
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', 1, ${mn}, ${mx})">+1</button>
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', 10, ${mn}, ${mx})">+10</button>
          </div>
        </div>`;
    } else {
      const mnArg = (m.min !== undefined && m.min !== null) ? m.min : "null";
      const mxArg = (m.max !== undefined && m.max !== null) ? m.max : "null";
      html += `
        <div class="hud-ed-card c-${col}" id="hud-card-${escapeHtml(mid)}">
          <div class="hud-ed-top">${titleHtml}<span class="hud-ed-badge" id="hud-badge-${escapeHtml(mid)}">${escapeHtml(badge)}</span></div>
          <div class="hud-ed-controls">
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', -1000, ${mnArg}, ${mxArg})">-1000</button>
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', -100, ${mnArg}, ${mxArg})">-100</button>
            <input type="number" id="hud-num-${escapeHtml(mid)}" value="${curVal}" style="flex:1;" oninput="setDraftMeter('${escapeHtml(mid)}', this.value, true, ${mnArg}, ${mxArg})" />
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', 100, ${mnArg}, ${mxArg})">+100</button>
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', 1000, ${mnArg}, ${mxArg})">+1000</button>
            <button type="button" class="btn small" onclick="bumpDraftMeter('${escapeHtml(mid)}', 10000, ${mnArg}, ${mxArg})">+10K</button>
          </div>
        </div>`;
    }
  }
  body.innerHTML = html;
  renderHudInventoryChips();
}

function resetHudState() {
  if (!confirm("Tüm göstergeler Rulebook başlangıç değerlerine sıfırlansın mı?")) return;
  const rb = getActiveChatRulebook();
  hudDraftState = { turn: 0, day: 1, meters: {}, inventory: [], journals: {}, clock: rb.start_datetime || "2026-06-03 11:30", events_log: [] };
  for (const m of (rb.meters || [])) {
    const mid = m.id || m.name;
    const t = canonMeterType(m.type);
    if (t === "clock") { hudDraftState.clock = String(m.start || hudDraftState.clock).replace("T"," ").slice(0,16); hudDraftState.meters[mid] = hudDraftState.clock; }
    else if (t === "collection") hudDraftState.inventory = Array.isArray(m.default) ? [...m.default] : [];
    else hudDraftState.meters[mid] = (t === "text" || t === "select") ? String(m.default ?? "") : Number(m.default ?? m.min ?? 0);
  }
  renderHudEditorBody();
}

async function saveHudModal() {
  const rb = getActiveChatRulebook();
  if (rb && Array.isArray(rb.meters)) {
    for (const m of rb.meters) {
      const t = canonMeterType(m.type);
      if (t === "clock") hudDraftState.meters[m.id || m.name] = hudDraftState.clock;
      if (t === "collection") hudDraftState.meters[m.id || m.name] = [...(hudDraftState.inventory || [])];
      if (t === "journal") {
        if (!hudDraftState.journals) hudDraftState.journals = {};
        hudDraftState.journals[m.id || m.name] = String(hudDraftState.meters[m.id || m.name] || "").split(",").map(x => x.trim()).filter(Boolean);
      }
    }
  }
  currentChatData.state = hudDraftState;
  await fetch(`/api/chats/${currentChatId}/state`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentChatData.state)
  });
  renderHUD();
  closeModal("hud-modal");
}

// --- MESAJ FORMATLAMA & RENDER ---
function formatRoleplayInline(rawLine) {
  let s = escapeHtml(rawLine);
  // 1. ***Konuşan:*** veya ***kalın italik***
  s = s.replace(/\*\*\*([^*\n]+?)\*\*\*/g, (_, inner) => {
    if (inner.trim().endsWith(":")) {
      return `<strong class="rp-speaker">${inner}</strong>`;
    }
    return `<strong class="rp-bold-em">${inner}</strong>`;
  });
  // 2. **kalın**
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
  // 3. *anlatım / eylem* — içindeki tırnaklı vurgular (“34418”, “sıradan ve çirkin”) beyaz italik olsun!
  s = s.replace(/\*([^*\n]+?)\*/g, (_, inner) => {
    const highlighted = inner.replace(/(&quot;[^&]+?&quot;|“[^”]+?”)/g, '<span class="rp-inner-quote">$1</span>');
    return `<em class="rp-action">${highlighted}</em>`;
  });
  // 4. Yıldız dışındaki sesli konuşma tırnakları (parlak beyaz, normal ağırlık)
  // Sadece HTML etiketlerinin dışındaki metne uygula
  s = s.replace(/(<[^>]+>)|(&quot;[^<&]+?&quot;|“[^<”]+?”)/g, (m, tag, speech) => {
    if (tag) return tag;
    return `<span class="rp-speech">${speech}</span>`;
  });
  return s;
}

function formatRoleplay(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!raw) return "";
  const paras = raw.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paras.map(para => {
    const isStandaloneThought = /^\*\s*(?:"[^"\n]+"|“[^”\n]+”)\s*\*$/.test(para);
    const rendered = para.split("\n").map(formatRoleplayInline).join("<br>");
    if (isStandaloneThought) {
      return `<p class="rp-para rp-thought-para">${rendered}</p>`;
    }
    const isDialogue = rendered.includes('class="rp-speaker"') || rendered.includes('class="rp-speech"');
    return `<p class="rp-para ${isDialogue ? 'rp-dialogue-para' : 'rp-narr-para'}">${rendered}</p>`;
  }).join("");
}

const ACT_ICONS = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="20 6 9 17 4 12"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  regen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  cont: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>',
  speak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  spinner: '<svg class="ico-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
};

async function copyMessageText(mid, btnEl) {
  const m = currentMessages.find(x => x.id === mid);
  if (!m) return;
  try { await navigator.clipboard.writeText(m.content || ""); }
  catch {
    const ta = document.createElement("textarea");
    ta.value = m.content || ""; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
  }
  if (btnEl) {
    const orig = btnEl.innerHTML;
    const origTitle = btnEl.title;
    btnEl.classList.add("copied-ok");
    btnEl.innerHTML = ACT_ICONS.check;
    btnEl.title = typeof t === "function" ? t("btn_copied") : "Kopyalandı";
    setTimeout(() => { btnEl.classList.remove("copied-ok"); btnEl.innerHTML = orig; btnEl.title = origTitle; }, 1500);
  }
}

function openMsgMenu(e, mid, role, isLast) {
  const items = [];
  if (role === "assistant" && isLast) {
    items.push({ label: "▶ Devam Et", action: () => continueMessage() });
    items.push({ label: "↻ Yeniden Üret", action: () => regenerateLast() });
  }
  if (role === "user" && isLast) {
    items.push({ label: "↻ Tekrar Gönder", action: () => retryLastUserMessage() });
  }
  items.push({ label: "📋 Kopyala", action: () => copyMessageText(mid, null) });
  items.push({ label: "✎ Düzenle", action: () => startInlineEdit(mid) });
  items.push({ label: "🗑 Sil", danger: true, action: () => deleteMessage(mid) });
  openCardPopover(e, items);
}

function renderMessages() {
  const box = document.getElementById("chat-messages");
  const activePersona = personas.find(p => p.id == document.getElementById("chat-persona-select").value);
  const userName = activePersona ? activePersona.name : (appSettings.profile_name || "Sen");
  const userAvatar = (activePersona && activePersona.avatar_url) ? activePersona.avatar_url : (appSettings.profile_avatar || "");
  const charAvatar = currentCharacter ? currentCharacter.avatar_url : (currentGroup ? currentGroup.avatar_url : "");
  const isStreaming = Boolean(abortController);
  const hasRb = Boolean(getActiveChatRulebook()?.meters?.length || currentChatData?.has_lorebook || (currentChatData?.active_lore?.length));

  let innerHtml = currentMessages.map((m, i) => {
    const isLast = (i === currentMessages.length - 1);
    const isLastAssistant = isLast && m.role === "assistant";
    const isLastUser = isLast && m.role === "user";
    const author = m.speaker_name || (m.role === "user" ? userName : (currentCharacter ? currentCharacter.name : "Chatbot"));
    const avatarUrl = m.role === "assistant" ? (m.speaker_avatar || charAvatar) : userAvatar;
    const total = (m.swipes || []).length;
    const isEditing = (editingMessageId === m.id);

    const avEl = avatarUrl
      ? `<img class="sc-msg-av" src="${avatarUrl}" alt="" />`
      : `<span class="sc-msg-av-fb">${escapeHtml((author || "?")[0].toUpperCase())}</span>`;

    const dotsBtn = (!isEditing && m.id > 0 && !isStreaming)
      ? `<button type="button" class="cb-dots-btn" onclick="openMsgMenu(event, ${m.id}, '${m.role}', ${isLast})" title="Seçenekler">⋮</button>`
      : "";

    const bulkChk = (bulkRemoveMode && m.id > 0)
      ? `<input type="checkbox" class="bulk-msg-chk" ${bulkSelectedIds.has(m.id) ? 'checked' : ''} onchange="toggleBulkMsgSelect(${m.id})" />`
      : "";

    const headerHtml = m.role === "user"
      ? `<div class="msg-header">
           <div style="display:flex;align-items:center;">${bulkChk}${dotsBtn}</div>
           <div class="msg-author-wrap">
             <span class="msg-author">${escapeHtml(author)}</span>
             ${avEl}
           </div>
         </div>`
      : `<div class="msg-header">
           <div class="msg-author-wrap">
             ${bulkChk}
             ${avEl}
             <span class="msg-author">${escapeHtml(author)}</span>
           </div>
           <div>${dotsBtn}</div>
         </div>`;

    const swipeHtml = (!isEditing && m.role === "assistant" && total > 1) ? `
      <div class="swipe-bar">
        <button onclick="swipeMsg(${m.id}, -1)" title="Önceki sürüm">◀</button>
        <span>${m.active_swipe + 1} / ${total}</span>
        <button onclick="swipeMsg(${m.id}, 1)" title="Sonraki sürüm">▶</button>
      </div>` : "";

    const lastTm = (isLastAssistant && currentChatData && currentChatData.last_debug && currentChatData.last_debug.timing) ? currentChatData.last_debug.timing : null;
    const speedBadgeHtml = lastTm
      ? `<button type="button" class="${lastTm.total_s > 12 ? 'sc-speed-warn' : 'sc-speed-pill'}" style="margin-left:8px;cursor:pointer;" onclick="openWhyModal()" title="Hız detayını gör">${lastTm.total_s > 12 ? '🐢' : '⚡'} ${lastTm.total_s}s · ${lastTm.tps} tok/s</button>`
      : "";
    const whyHtml = (!isEditing && m.role === "assistant" && m.id > 0 && (hasRb || lastTm))
      ? `<div style="display:flex;align-items:center;flex-wrap:wrap;">${hasRb ? `<button type="button" class="sc-why-pill" onclick="openWhyModal()">${typeof t === "function" ? t("btn_why") : "Neden?"}</button>` : ""}${speedBadgeHtml}</div>`
      : "";

    const bodyHtml = isEditing ? `
      <div class="inline-edit-wrap">
        <textarea id="inline-edit-ta-${m.id}" class="inline-edit-textarea" maxlength="10000"
          oninput="updateInlineEditCount(${m.id})"
          onkeydown="handleInlineEditKey(event, ${m.id})">${escapeHtml(m.content)}</textarea>
        <div class="inline-edit-meta"><span id="inline-edit-cnt-${m.id}">${(m.content || '').length}/10000</span></div>
        <div class="inline-edit-footer">
          <span class="inline-edit-hint">Esc: iptal · Ctrl+Enter: kaydet</span>
          <div class="inline-edit-btns">
            <button type="button" class="btn" onclick="cancelInlineEdit()">İptal</button>
            <button type="button" class="btn primary" onclick="saveInlineEdit(${m.id})">Kaydet</button>
          </div>
        </div>
      </div>` : `${m.image_url ? `<div class="msg-attached-img-wrap"><img class="msg-attached-img" src="${escapeHtml(m.image_url)}" alt="Paylaşılan görsel" onclick="window.open('${escapeHtml(m.image_url)}','_blank')" /></div>` : ''}<div class="msg-body">${formatRoleplay(m.content)}</div>${whyHtml}`;

    const isSpeakingThis = (activeSpeechMsgId === m.id);
    const footerHtml = (!isEditing && m.id > 0) ? `
      <div class="msg-footer">
        <div class="msg-footer-left">${swipeHtml}</div>
        <div class="msg-footer-actions">
          ${isLastAssistant && !isStreaming ? `<button type="button" class="msg-act-btn continue-btn" onclick="continueMessage()" title="Devam Et" aria-label="Devam Et">${ACT_ICONS.cont}</button>` : ""}
          ${isLastAssistant && !isStreaming ? `<button type="button" class="msg-act-btn" onclick="regenerateLast()" title="Yeniden Üret" aria-label="Yeniden Üret">${ACT_ICONS.regen}</button>` : ""}
          ${isLastUser && !isStreaming ? `<button type="button" class="msg-act-btn continue-btn" onclick="retryLastUserMessage()" title="Tekrar Gönder" aria-label="Tekrar Gönder">${ACT_ICONS.regen}</button>` : ""}
          ${m.role === "assistant" ? `<button type="button" class="msg-act-btn speak-btn ${isSpeakingThis ? 'speaking-now' : ''}" onclick="speakMessage(${m.id}, this)" title="${isSpeakingThis ? 'Sustur' : 'Dinle'}" aria-label="${isSpeakingThis ? 'Sustur' : 'Dinle'}">${isSpeakingThis ? ACT_ICONS.stop : ACT_ICONS.speak}</button>` : ""}
          <button type="button" class="msg-act-btn" onclick="copyMessageText(${m.id}, this)" title="Kopyala" aria-label="Kopyala">${ACT_ICONS.copy}</button>
          <button type="button" class="msg-act-btn" onclick="startInlineEdit(${m.id})" title="Düzenle" aria-label="Düzenle">${ACT_ICONS.edit}</button>
          <button type="button" class="msg-act-btn danger-act" onclick="deleteMessage(${m.id})" title="Sil" aria-label="Sil">${ACT_ICONS.trash}</button>
        </div>
      </div>` : "";

    return `
      <div class="msg ${m.role} ${bulkRemoveMode && bulkSelectedIds.has(m.id) ? 'bulk-selected' : ''}" id="msg-${m.id}">
        ${headerHtml}
        ${bodyHtml}
        ${footerHtml}
      </div>`;
  }).join("");

  const lastMsg = currentMessages[currentMessages.length - 1];
  if (!isStreaming && (lastStreamError || (lastMsg && lastMsg.role === "user"))) {
    const errMsg = lastStreamError || "Bu mesaja henüz yanıt üretilmedi.";
    innerHtml += `
      <div class="retry-card">
        <div class="retry-card-msg">⚠ ${escapeHtml(errMsg)}</div>
        <div class="retry-card-actions">
          <button type="button" class="btn" onclick="restoreLastUserTextToInput()">✎ Metni Kutuya Geri Al</button>
          <button type="button" class="btn primary" onclick="retryLastUserMessage()">↻ Tekrar Dene</button>
        </div>
      </div>`;
  }

  box.innerHTML = `<div class="chat-col-inner chat-msgs-stack">${innerHtml}</div>`;

  if (editingMessageId !== null) {
    const ta = document.getElementById(`inline-edit-ta-${editingMessageId}`);
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.max(150, Math.min(460, ta.scrollHeight + 10)) + "px";
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    }
  } else {
    box.scrollTop = box.scrollHeight;
  }
}

function startInlineEdit(mid) { editingMessageId = mid; renderMessages(); }
function cancelInlineEdit() { editingMessageId = null; renderMessages(); }

function updateInlineEditCount(mid) {
  const ta = document.getElementById(`inline-edit-ta-${mid}`);
  const cnt = document.getElementById(`inline-edit-cnt-${mid}`);
  if (ta && cnt) {
    cnt.textContent = `${ta.value.length}/10000`;
    ta.style.height = "auto";
    ta.style.height = Math.max(150, Math.min(460, ta.scrollHeight + 10)) + "px";
  }
}

function handleInlineEditKey(e, mid) {
  if (e.key === "Escape") { e.preventDefault(); cancelInlineEdit(); }
  else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveInlineEdit(mid); }
}

async function saveInlineEdit(mid) {
  const ta = document.getElementById(`inline-edit-ta-${mid}`);
  if (!ta) return;
  await fetch(`/api/messages/${mid}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: ta.value }) });
  editingMessageId = null;
  await loadChat(currentChatId);
}

async function deleteMessage(mid) {
  await fetch(`/api/messages/${mid}`, { method: "DELETE" });
  await loadChat(currentChatId);
}

async function swipeMsg(mid, dir) {
  await fetch(`/api/messages/${mid}/swipe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: dir }) });
  await loadChat(currentChatId);
}

function handleInputKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  const imgUrl = pendingChatImageUrl;
  if (!text && !imgUrl) return;
  const useWeb = webSearchActive;
  lastSentPayload = { mode: "send", content: text, image_url: imgUrl || null, web_search: useWeb };
  input.value = "";
  autoGrowChatInput(input);
  clearPendingChatImage();
  closeSuggestTray();
  if (useWeb) toggleWebSearchMode(false);
  await runStream(lastSentPayload);
}

function restoreLastUserTextToInput() {
  const lastUserMsg = [...currentMessages].reverse().find(m => m.role === "user");
  const textToRestore = (lastUserMsg && lastUserMsg.content) ? lastUserMsg.content : (lastSentPayload ? lastSentPayload.content : "");
  const inp = document.getElementById("chat-input");
  if (!inp || !textToRestore) return;
  inp.value = textToRestore;
  autoGrowChatInput(inp);
  inp.focus();
}

async function retryLastUserMessage() {
  lastStreamError = null;
  const lastSaved = currentMessages[currentMessages.length - 1];
  if (lastSaved && lastSaved.role === "user" && lastSaved.id > 0) {
    await runStream({ mode: "retry" });
  } else if (lastSentPayload) {
    await runStream(lastSentPayload);
  } else {
    await runStream({ mode: "retry" });
  }
}

async function regenerateLast() { lastStreamError = null; await runStream({ mode: "regenerate" }); }
async function continueMessage() { lastStreamError = null; await runStream({ mode: "continue" }); }
function stopStream() { if (abortController) abortController.abort(); }

function updateLiveStreamBubble(liveText) {
  let msgEl = document.getElementById("msg--2");
  const box = document.getElementById("chat-messages");
  if (!msgEl) {
    currentMessages.push({
      id: -2,
      role: "assistant",
      speaker_name: currentCharacter ? currentCharacter.name : (currentGroup ? currentGroup.name : "Chatbot"),
      speaker_avatar: currentCharacter ? currentCharacter.avatar_url : (currentGroup ? currentGroup.avatar_url : ""),
      content: liveText,
      swipes: [liveText],
      active_swipe: 0
    });
    renderMessages();
    return;
  }
  const mObj = currentMessages.find(x => x.id === -2);
  if (mObj) mObj.content = liveText;
  const bodyEl = msgEl.querySelector(".msg-body");
  if (bodyEl) {
    bodyEl.innerHTML = formatRoleplay(liveText) + '<span class="live-stream-cursor"></span>';
  }
  if (box) box.scrollTop = box.scrollHeight;
}

async function runStream(payload) {
  if (abortController) abortController.abort();
  abortController = new AbortController();
  editingMessageId = null;
  lastStreamError = null;
  let hadError = false;

  document.getElementById("btn-send").classList.add("hidden");
  document.getElementById("btn-stop").classList.remove("hidden");
  const thinkBar = document.getElementById("thinking-indicator");
  const tStartMs = Date.now();
  const baseThinkTxt = typeof t === "function" ? t("thinking") : "Yanıt hazırlanıyor...";
  thinkBar.innerHTML = `<span class="pulse-dot"></span> ${escapeHtml(baseThinkTxt)} (0.0 sn)`;
  thinkBar.classList.remove("hidden");
  const thinkTimer = setInterval(() => {
    const sec = ((Date.now() - tStartMs) / 1000).toFixed(1);
    thinkBar.innerHTML = `<span class="pulse-dot"></span> ${escapeHtml(baseThinkTxt)} (${sec} sn)`;
  }, 200);

  if (payload.mode === "send" && ((payload.content && !payload.content.startsWith("/cmd ")) || payload.image_url)) {
    currentMessages.push({ id: -1, role: "user", content: payload.content || "", image_url: payload.image_url || "", swipes: [payload.content || ""], active_swipe: 0 });
  }
  renderMessages();

  let finalDoneText = "";
  let liveAccum = "";

  try {
    const resp = await fetch(`/api/chats/${currentChatId}/stream`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: abortController.signal
    });
    if (!resp.ok) {
      hadError = true;
      lastStreamError = `Sunucu hatası (${resp.status}). Tekrar deneyebilir veya metni kutuya geri alabilirsin.`;
      return;
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "state" && ev.state) {
          if (currentChatData) {
            currentChatData.state = ev.state;
            if (Array.isArray(ev.active_notes)) currentChatData.active_notes = ev.active_notes;
            if (Array.isArray(ev.active_captions)) currentChatData.active_captions = ev.active_captions;
            if (Array.isArray(ev.active_lore)) currentChatData.active_lore = ev.active_lore;
            renderHUD();
          }
        } else if (ev.type === "notify") {
          const nEl = document.getElementById("hud-notify");
          nEl.textContent = ev.items.join("  •  ");
          nEl.classList.remove("hidden");
          setTimeout(() => nEl.classList.add("hidden"), 5500);
        } else if (ev.type === "thinking") {
          thinkBar.classList.toggle("hidden", !ev.text);
        } else if (ev.type === "token" && ev.text) {
          liveAccum += ev.text;
          updateLiveStreamBubble(liveAccum);
        } else if (ev.type === "done") {
          finalDoneText = ev.text || "";
        } else if (ev.type === "error") {
          hadError = true;
          lastStreamError = ev.text;
        }
      }
    }
    if (!hadError && !finalDoneText.trim()) {
      hadError = true;
      lastStreamError = "Model boş yanıt döndürdü. Tekrar Dene butonuna basabilir veya metni kutuya geri alabilirsin.";
    }
  } catch (e) {
    if (e.name !== "AbortError") {
      hadError = true;
      lastStreamError = "Bağlantı kesildi: " + e.message;
    } else if (!finalDoneText.trim()) {
      hadError = true;
      lastStreamError = "Yanıt durduruldu. İstersen tekrar deneyebilirsin.";
    }
  } finally {
    clearInterval(thinkTimer);
    thinkBar.classList.add("hidden");
    document.getElementById("btn-send").classList.remove("hidden");
    document.getElementById("btn-stop").classList.add("hidden");
    abortController = null;
    await loadChat(currentChatId, hadError);
    if (!hadError && finalDoneText.trim()) {
      if (appSettings.tts_auto === "1") {
        speakTextNow(finalDoneText);
      }
      if (appSettings.ai_judge_enabled === "1" && payload.mode !== "regenerate") {
        runBackgroundAiJudge(currentChatId);
      }
    }
  }
}

async function runBackgroundAiJudge(chatId) {
  if (!chatId || !getActiveChatRulebook()?.meters?.length) return;
  try {
    const res = await fetch(`/api/chats/${chatId}/judge`, { method: "POST" }).then(r => r.json());
    if (res && res.changed && currentChatId === chatId && currentChatData) {
      currentChatData.state = res.state;
      if (Array.isArray(res.active_notes)) currentChatData.active_notes = res.active_notes;
      if (Array.isArray(res.active_captions)) currentChatData.active_captions = res.active_captions;
      renderHUD();
      if (Array.isArray(res.notifications) && res.notifications.length) {
        const nEl = document.getElementById("hud-notify");
        if (nEl) {
          nEl.textContent = res.notifications.join("  •  ");
          nEl.classList.remove("hidden");
          setTimeout(() => nEl.classList.add("hidden"), 5500);
        }
      }
    }
  } catch {
    // Sessiz arka plan hakemi; hata olursa kullanıcıyı bölmez
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

init();
