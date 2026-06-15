/* ============================================================
   GomĐơn Collector — popup logic (vanilla JS)
   ============================================================ */
const $ = (id) => document.getElementById(id);
const PLATFORM_TINT = { taobao: "#ff6a00", "1688": "#ff7a45", pdd: "#e02e24", tmall: "#d4143c", weidian: "#ec5b24" };

let scraped = [];   // đơn đã phát hiện trên trang

async function init() {
  // nạp cấu hình + bộ đếm
  const s = await chrome.storage.local.get(["endpoint", "token", "auto", "today", "session", "log"]);
  $("endpoint").value = s.endpoint || "http://localhost:8080";
  $("token").value = s.token || "";
  setAuto(!!s.auto, false);
  $("today").textContent = s.today || 0;
  $("session").textContent = s.session || 0;
  renderLog(s.log || []);

  checkConnection();
  detectPage();
}

function setAuto(on, persist = true) {
  $("autoSwitch").classList.toggle("on", on);
  $("hero").classList.toggle("active", on);
  $("autoSub").textContent = on ? "Đang theo dõi các trang đơn hàng…" : "Tự gửi đơn mới về hệ thống";
  if (persist) chrome.storage.local.set({ auto: on });
}

async function checkConnection() {
  const conn = $("conn"), txt = $("connText");
  const res = await chrome.runtime.sendMessage({ type: "HEALTH" }).catch(() => ({ connected: false }));
  const ok = res && res.connected;
  conn.className = "ext-conn " + (ok ? "on" : "off");
  txt.textContent = ok ? "Đã kết nối API" : "Mất kết nối";
}

async function detectPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "SCRAPE" });
    scraped = res?.orders || [];
    const plat = res?.platform || "taobao";
    $("platName").textContent = `${plat} · trang đơn hàng`;
    $("platDot").style.background = PLATFORM_TINT[plat] || "#888";
    $("detected").textContent = scraped.length;
    updateCollectBtn();
  } catch {
    // content script không có trên trang này
    $("platName").textContent = "Trang không hỗ trợ";
    $("detected").textContent = 0;
    scraped = [];
    updateCollectBtn();
  }
}

function updateCollectBtn() {
  const btn = $("collectBtn"), label = $("collectLabel");
  if (scraped.length === 0) { btn.disabled = true; label.textContent = "Không thấy đơn trên trang"; }
  else { btn.disabled = false; label.textContent = `Thu thập ${scraped.length} đơn trên trang`; }
}

async function collect() {
  if (!scraped.length) return;
  const btn = $("collectBtn"), prog = $("prog"), label = $("collectLabel");
  btn.disabled = true; label.textContent = "Đang thu thập…";
  let p = 0; const tick = setInterval(() => { p = Math.min(95, p + 12); prog.style.width = p + "%"; }, 90);

  const res = await chrome.runtime.sendMessage({ type: "INGEST", orders: scraped });
  clearInterval(tick); prog.style.width = "100%";

  setTimeout(async () => {
    prog.style.width = "0%";
    const s = await chrome.storage.local.get(["today", "session", "log"]);
    $("today").textContent = s.today || 0;
    $("session").textContent = s.session || 0;
    renderLog(s.log || []);
    if (res && res.fail) label.textContent = `Lỗi: ${res.error || "ingest thất bại"}`;
    else { scraped = []; $("detected").textContent = 0; label.textContent = "Đã thu trang này"; }
  }, 350);
}

function renderLog(log) {
  const box = $("log");
  if (!log.length) { box.innerHTML = '<div class="ext-empty">Chưa thu thập đơn nào.</div>'; return; }
  box.innerHTML = log.map((it) => `
    <div class="ext-log-item">
      <span class="li-ic">${it.ok ? "✓" : "✕"}</span>
      <span><span class="li-id">#${it.id}</span> <span style="color:var(--muted)">· ${esc(it.name)}</span></span>
      <span class="li-t">${it.t}</span>
    </div>`).join("");
}

function esc(s) { const d = document.createElement("div"); d.textContent = s || ""; return d.innerHTML; }

async function save() {
  await chrome.storage.local.set({ endpoint: $("endpoint").value.trim(), token: $("token").value.trim() });
  const tag = $("saved"); tag.style.display = "inline-flex";
  setTimeout(() => { tag.style.display = "none"; }, 1600);
  checkConnection();
}

// events
$("autoSwitch").addEventListener("click", () => setAuto(!$("autoSwitch").classList.contains("on")));
$("collectBtn").addEventListener("click", collect);
$("setToggle").addEventListener("click", () => {
  const b = $("setBody"); const open = b.style.display === "none";
  b.style.display = open ? "flex" : "none"; $("setToggle").classList.toggle("open", open);
});
$("saveBtn").addEventListener("click", save);

init();
