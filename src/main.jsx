/* ============================================================
   GomĐơn — Web dashboard entry / App root (nối API .NET)
   Auth (JWT) · dashboard summary · orders · order detail · toast.
   ============================================================ */
import React from "react";
import ReactDOM from "react-dom/client";

import "./styles/theme.css";
import "./styles/ui.css";
import "./styles/login.css";
import "./styles/tweaks.css";

import { Icon } from "./icons.jsx";
import { Sidebar, TopBar } from "./components.jsx";
import { Dashboard } from "./dashboard.jsx";
import { Orders } from "./orders.jsx";
import { OrderDetail } from "./orderDetail.jsx";
import { Login } from "./login.jsx";
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } from "./tweaks.jsx";
import { api, getToken, setToken, setOnUnauthorized } from "./api.js";
import { adaptSummary, adaptDetail, adaptDashboard } from "./data.js";

const { useState, useEffect, useCallback } = React;

const TWEAK_DEFAULTS = { accent: "#2a6fdb", layout: "Bảng", density: "Thoáng" };
const LAYOUT_MAP = { "Bảng": "table", "Danh sách": "rows", "Thẻ": "cards" };

function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * (1 - pct)); g = Math.round(g * (1 - pct)); b = Math.round(b * (1 - pct));
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [logged, setLogged] = useState(() => !!getToken());
  const [route, setRoute] = useState("dashboard");
  const [preset, setPreset] = useState(null);
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("gd_theme") || "light");
  const [layout, setLayout] = useState(LAYOUT_MAP[t.layout] || "table");
  const [sbOpen, setSbOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [selected, setSelected] = useState(null);   // chi tiết đơn (đã adapt)
  const [detailLoading, setDetailLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // theme
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("gd_theme", theme); }, [theme]);

  // accent tweak → CSS vars
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", t.accent);
    root.setProperty("--accent-ink", t.accent);
    root.setProperty("--accent-2", shade(t.accent, 0.14));
    root.setProperty("--accent-soft", `color-mix(in srgb, ${t.accent} 13%, transparent)`);
    root.setProperty("--sidebar-accent", t.accent);
  }, [t.accent]);

  useEffect(() => { setLayout(LAYOUT_MAP[t.layout] || "table"); }, [t.layout]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 2300); return () => clearTimeout(id); }, [toast]);

  // 401 ở bất kỳ đâu → đăng xuất
  useEffect(() => {
    setOnUnauthorized(() => { setLogged(false); setSummary(null); setToast("Phiên đã hết hạn, vui lòng đăng nhập lại."); });
  }, []);

  // "/" focus search
  useEffect(() => {
    const h = (e) => { if (e.key === "/" && document.activeElement.tagName !== "INPUT" && logged) { e.preventDefault(); const el = document.querySelector(".search input"); el && el.focus(); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [logged]);

  // tải summary + đơn gần đây (khi đăng nhập / sau khi đổi dữ liệu)
  useEffect(() => {
    if (!logged) return;
    let alive = true;
    setLoadErr(null);
    Promise.all([api.dashboard(), api.orders({ pageSize: 6, sort: "date" })])
      .then(([s, list]) => {
        if (!alive) return;
        setSummary(adaptDashboard(s));
        setRecent((list.items || []).map(adaptSummary));
      })
      .catch((err) => { if (alive && err.status !== 401) setLoadErr(err.message); });
    return () => { alive = false; };
  }, [logged, reloadKey]);

  const nav = (r, opts = {}) => { setRoute(r); setPreset(r === "orders" ? (opts.filter || null) : null); setSbOpen(false); };
  const showToast = (m) => setToast(m);

  const openOrder = useCallback(async (id) => {
    setDetailLoading(true);
    try {
      const o = await api.order(id);
      setSelected(adaptDetail(o));
    } catch (err) {
      if (err.status !== 401) setToast("Không tải được đơn #" + id + ": " + err.message);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const changeStatus = useCallback(async (id, status, note) => {
    const updated = await api.changeStatus(id, status, note);
    setSelected(adaptDetail(updated));     // API trả chi tiết mới
    setReloadKey((k) => k + 1);            // refresh summary + recent + list
  }, []);

  const deleteOrder = useCallback(async (id) => {
    await api.deleteOrder(id);
    setSelected(null);                     // đóng drawer
    setReloadKey((k) => k + 1);            // refresh summary + recent + list
  }, []);

  const logout = () => { setToken(null); setLogged(false); setSummary(null); setSelected(null); setRoute("dashboard"); };
  const onLoggedIn = () => { setLogged(true); setReloadKey((k) => k + 1); };

  function tweaksPanel() {
    return (
      <TweaksPanel>
        <TweakSection label="Giao diện" />
        <TweakColor label="Màu nhấn" value={t.accent}
          options={["#2a6fdb", "#1f8a5b", "#6a53cf", "#d2762f"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakSection label="Bảng đơn hàng" />
        <TweakRadio label="Bố cục mặc định" value={t.layout}
          options={["Bảng", "Danh sách", "Thẻ"]}
          onChange={(v) => setTweak("layout", v)} />
        <TweakRadio label="Mật độ" value={t.density}
          options={["Thoáng", "Gọn"]}
          onChange={(v) => setTweak("density", v)} />
      </TweaksPanel>
    );
  }

  if (!logged) return (<><Login onLogin={onLoggedIn} />{tweaksPanel()}</>);

  const counts = summary ? { total: summary.totalOrders, outstanding: summary.outstandingOrders, complaints: summary.statusCounts.khieu_nai || 0 } : {};
  const titles = {
    dashboard: { t: "Tổng quan", s: "Bức tranh toàn cảnh đơn mua hộ" },
    orders: { t: "Đơn hàng", s: (summary ? summary.totalOrders : "—") + " đơn · cập nhật hôm nay" },
  };

  return (
    <div className="app-shell">
      <Sidebar route={route} onNav={nav} open={sbOpen} onCloseMobile={() => setSbOpen(false)} onLogout={logout} counts={counts} />
      <div className={"sb-backdrop" + (sbOpen ? " show" : "")} onClick={() => setSbOpen(false)} />
      <div className="main">
        <TopBar title={titles[route].t} sub={titles[route].s} search={search} setSearch={setSearch}
          onSubmitSearch={() => { if (route !== "orders") nav("orders"); }}
          theme={theme} toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onMenu={() => setSbOpen(true)} />
        <div className={"content" + (t.density === "Gọn" ? " dense" : "")}>
          {loadErr && <div className="card empty"><Icon name="close" size={40} /><div>Lỗi tải dữ liệu: {loadErr}</div></div>}

          {route === "dashboard" && (
            summary
              ? <Dashboard summary={summary} recent={recent} onOpen={openOrder} onNav={nav} />
              : !loadErr && <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải tổng quan…</div></div>
          )}

          {route === "orders" && (
            <Orders statusCounts={summary?.statusCounts} total={summary?.totalOrders ?? 0}
              search={search} preset={preset} onOpen={openOrder}
              layout={layout} setLayout={setLayout} onToast={showToast} reloadKey={reloadKey} />
          )}
        </div>
      </div>

      {detailLoading && !selected && <div className="overlay" />}
      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} onToast={showToast} onChangeStatus={changeStatus} onDelete={deleteOrder} />}
      {toast && <div className="toast"><Icon name="check" size={16} stroke={2.4} />{toast}</div>}
      {tweaksPanel()}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
