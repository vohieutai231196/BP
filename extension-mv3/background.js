/* ============================================================
   GomĐơn Collector — background service worker (MV3)
   Giữ cấu hình (endpoint/token) trong chrome.storage, gửi đơn
   thu thập lên API /v1/orders/ingest, cập nhật bộ đếm + log.
   ============================================================ */
const DEFAULTS = { endpoint: "http://localhost:8080", token: "", auto: false };

async function getCfg() {
  const s = await chrome.storage.local.get(["endpoint", "token", "auto"]);
  return { ...DEFAULTS, ...s };
}

async function appendLog(entries) {
  const { log = [] } = await chrome.storage.local.get("log");
  const next = [...entries, ...log].slice(0, 20);
  await chrome.storage.local.set({ log: next });
}

async function ingestOrders(orders) {
  const cfg = await getCfg();
  if (!cfg.token) return { ok: 0, fail: orders.length, error: "Chưa cấu hình Access Token." };

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
