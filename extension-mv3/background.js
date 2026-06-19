/* ============================================================
   GomĐơn Collector — background service worker (MV3)
   Giữ cấu hình (endpoint/token) trong chrome.storage, gửi đơn
   thu thập lên API /v1/orders/ingest, cập nhật bộ đếm + log.
   ============================================================ */
const DEFAULTS = { endpoint: "https://gomdons.com", token: "", auto: false };

async function getCfg() {
  const s = await chrome.storage.local.get(["endpoint", "token", "auto"]);
  return { ...DEFAULTS, ...s };
}

async function appendLog(entries) {
  const { log = [] } = await chrome.storage.local.get("log");
  const next = [...entries, ...log].slice(0, 20);
  await chrome.storage.local.set({ log: next });
}

// Đuôi tên sàn cần cắt khỏi tiêu đề (og:title/<title>).
const NAME_SUFFIX = /\s*[-–—|]\s*(阿里巴巴|淘宝网|淘宝|天猫|Taobao|Tmall|1688\.com|1688|Alibaba)\s*.*$/i;

/** Fetch trang sản phẩm gốc (1688/Taobao/Tmall) → bóc tên từ og:title, fallback <title>. */
async function fetchProductName(url) {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const html = await res.text();
    const m =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (!m) return null;
    const name = m[1].replace(/\s+/g, " ").trim().replace(NAME_SUFFIX, "").trim();
    return name || null;
  } catch {
    return null;
  }
}

/** Bổ sung tên sản phẩm cho từng link bằng cách đọc link gốc. Cache theo URL (nhiều
   SKU cùng 1 offer → fetch 1 lần). BE sẽ dịch tên (tiếng Trung) sang tiếng Việt. */
async function enrichNames(orders) {
  const cache = new Map();
  for (const o of orders) {
    for (const l of o.links || []) {
      if (l.name || !l.sourceUrl) continue;
      if (!cache.has(l.sourceUrl)) cache.set(l.sourceUrl, await fetchProductName(l.sourceUrl));
      const n = cache.get(l.sourceUrl);
      if (n) l.name = n;
    }
  }
}

async function ingestOrders(orders) {
  const cfg = await getCfg();
  if (!cfg.token) return { ok: 0, fail: orders.length, error: "Chưa cấu hình Access Token." };

  await enrichNames(orders);   // bóc tên SP từ link gốc trước khi gửi đi

  const result = { ok: 0, fail: 0, error: null };
  const newLog = [];
  for (const o of orders) {
    try {
      const res = await fetch(cfg.endpoint + "/v1/orders/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": cfg.token },
        body: JSON.stringify(o),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        result.ok++;
        newLog.push({ id: body.id || "?", name: o.productName, t: timeNow(), ok: true });
      } else {
        result.fail++;
        const txt = await res.text().catch(() => String(res.status));
        result.error = txt;
        newLog.push({ id: "—", name: o.productName, t: timeNow(), ok: false });
      }
    } catch (e) {
      result.fail++;
      result.error = e.message;
      newLog.push({ id: "—", name: o.productName, t: timeNow(), ok: false });
    }
  }

  if (newLog.length) await appendLog(newLog);
  if (result.ok) {
    const { today = 0, session = 0 } = await chrome.storage.local.get(["today", "session"]);
    await chrome.storage.local.set({ today: today + result.ok, session: session + result.ok });
  }
  return result;
}

async function checkHealth() {
  const cfg = await getCfg();
  try {
    const res = await fetch(cfg.endpoint + "/health");
    return { connected: res.ok };
  } catch {
    return { connected: false };
  }
}

function timeNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "INGEST") { ingestOrders(msg.orders).then(sendResponse); return true; }
  if (msg.type === "HEALTH") { checkHealth().then(sendResponse); return true; }
});
