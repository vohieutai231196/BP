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
import "./styles/retail.css";
import "./styles/controls.css";

import { Icon } from "./icons.jsx";
import { Sidebar, TopBar } from "./components.jsx";
import { Dashboard } from "./dashboard.jsx";
import { Orders } from "./orders.jsx";
import { OrderDetail } from "./orderDetail.jsx";
import { Login } from "./login.jsx";
import { Users } from "./users.jsx";
import { Inventory } from "./retail.jsx";
import { Pricing } from "./pricing.jsx";
import { CostTypes } from "./costtypes.jsx";
import { Sales } from "./sales.jsx";
import { Promotions } from "./promotions.jsx";
import { Combos } from "./combos.jsx";
import { Reports } from "./reports.jsx";
import { AccountModal } from "./account.jsx";
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor } from "./tweaks.jsx";
import { api, getToken, setToken, setOnUnauthorized } from "./api.js";
import { adaptSummary, adaptDetail, adaptDashboard } from "./data.js";
import { pathToRoute, routeHref, currentFilter, orderIdFromPath, currentPath, pushUrl, replaceUrl, goBack } from "./routes.js";
import { RefreshContext } from "./refresh.js";

const { useState, useEffect, useCallback } = React;

const TWEAK_DEFAULTS = { accent: "#1f7a63", layout: "Bảng", density: "Thoáng" };
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
  const [route, setRoute] = useState(() => pathToRoute(currentPath()));
  const [preset, setPreset] = useState(() => currentFilter());
  const [search, setSearch] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("gd_theme") || "light");
  const [layout, setLayout] = useState(LAYOUT_MAP[t.layout] || "table");
  const [sbOpen, setSbOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);   // {id, name, email, role}
  const [accountOpen, setAccountOpen] = useState(false);

  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [selected, setSelected] = useState(null);   // chi tiết đơn (đã adapt)
  const [detailLoading, setDetailLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  // theme
  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("gd_theme", theme); }, [theme]);

  // accent tweak → CSS vars
  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--accent", t.accent);
    root.setProperty("--accent-ink", t.accent);
    root.setProperty("--accent-2", shade(t.accent, 0.14));
    root.setProperty("--accent-soft", `color-mix(in srgb, ${t.accent} 13%, transparent)`);
    // NB: --sidebar-accent intentionally NOT overridden — it's the gold "journey
    // thread" brand motif (theme.css), kept independent of the action accent.
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

  const nav = (r, opts = {}) => {
    const filter = r === "orders" ? (opts.filter || null) : null;
    setRoute(r); setPreset(filter); setSbOpen(false); setSelected(null);  // điều hướng đóng drawer
    pushUrl(routeHref(r, filter));
  };
  const showToast = (m) => setToast(m);

  // Đồng bộ Back/Forward của trình duyệt với route nội bộ + drawer chi tiết đơn.
  useEffect(() => {
    const onPop = () => {
      setRoute(pathToRoute(currentPath()));
      setPreset(currentFilter());
      const id = orderIdFromPath(currentPath());
      if (id) openOrder(id, { fromUrl: true }); else setSelected(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openOrder = useCallback(async (id, opts = {}) => {
    // Phản chiếu lên URL (/orders/{id}) để chia sẻ link / mở tab mới được.
    // fromUrl = gọi từ popstate hoặc deep-link → KHÔNG push thêm lịch sử.
    if (!opts.fromUrl) {
      pushUrl("/orders/" + id);
      setRoute("orders"); setPreset(null);
    }
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

  // Đóng drawer: lùi lịch sử nếu đang ở /orders/{id} (Back đóng drawer tự nhiên),
  // ngược lại chỉ xoá state.
  const closeOrder = useCallback(() => {
    if (orderIdFromPath(currentPath())) goBack();
    else setSelected(null);
  }, []);

  const viewInventory = useCallback((orderId) => {
    setSelected(null);
    setRoute("inventory"); setPreset(null);
    pushUrl("/inventory?order=" + orderId);
  }, []);

  // Deep-link: mở thẳng /orders/{id} khi đăng nhập / tải trang.
  useEffect(() => {
    if (!logged) return;
    const id = orderIdFromPath(currentPath());
    if (id) openOrder(id, { fromUrl: true });
  }, [logged, openOrder]);

  const changeStatus = useCallback(async (id, status, note) => {
    const updated = await api.changeStatus(id, status, note);
    setSelected(adaptDetail(updated));     // API trả chi tiết mới
    setReloadKey((k) => k + 1);            // refresh summary + recent + list
  }, []);

  const deleteOrder = useCallback(async (id) => {
    await api.deleteOrder(id);
    setSelected(null);                     // đóng drawer
    // đơn đã xoá → bỏ id khỏi URL (replace để Back không quay lại đơn đã mất)
    if (orderIdFromPath(currentPath())) replaceUrl("/orders");
    setReloadKey((k) => k + 1);            // refresh summary + recent + list
  }, []);

  const logout = () => { setToken(null); setLogged(false); setUser(null); setSummary(null); setSelected(null); setRoute("dashboard"); };
  const onLoggedIn = (u) => { setUser(u); setLogged(true); setReloadKey((k) => k + 1); };

  // Có token nhưng chưa có thông tin user (vd refresh trang) → nạp /me.
  useEffect(() => {
    if (!logged || user) return;
    let alive = true;
    api.me().then((m) => { if (alive) setUser({ id: m.id, name: m.name, email: m.email, role: m.role }); })
      .catch(() => { /* 401 đã được xử lý tập trung */ });
    return () => { alive = false; };
  }, [logged, user]);

  function tweakControls() {
    return (
      <>
        <TweakSection label="Giao diện" />
        <TweakColor label="Màu nhấn" value={t.accent}
          options={["#1f7a63", "#c0392b", "#a8801e", "#1e7e84"]}
          onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Mật độ" value={t.density}
          options={["Thoáng", "Gọn"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Bảng đơn hàng" />
        <TweakRadio label="Bố cục mặc định" value={t.layout}
          options={["Bảng", "Danh sách", "Thẻ"]}
          onChange={(v) => setTweak("layout", v)} />
      </>
    );
  }

  // Trước khi đăng nhập: panel tuỳ chỉnh dạng FAB (chưa có TopBar).
  if (!logged) return (<><Login onLogin={onLoggedIn} /><TweaksPanel>{tweakControls()}</TweaksPanel></>);

  const counts = summary ? { total: summary.totalOrders, outstanding: summary.outstandingOrders, complaints: summary.statusCounts.khieu_nai || 0 } : {};
  const titles = {
    dashboard: { t: "Tổng quan", s: "Bức tranh toàn cảnh đơn mua hộ" },
    orders: { t: "Đơn hàng", s: (summary ? summary.totalOrders : "—") + " đơn · cập nhật hôm nay" },
    users: { t: "Người dùng", s: "Quản lý tài khoản & phân quyền" },
    inventory: { t: "Kho & Sản phẩm", s: "Quản lý sản phẩm bán lẻ & tồn kho" },
    pricing: { t: "Máy tính giá", s: "Tính giá bán & lợi nhuận theo mức lời" },
    costtypes: { t: "Phụ phí", s: "Danh mục chi phí phát sinh (ship, bao bì, in đơn…)" },
    sales: { t: "Đơn bán", s: "Tạo đơn bán & theo dõi lợi nhuận" },
    promotions: { t: "Khuyến mãi", s: "Đợt giảm giá theo sản phẩm" },
    combos: { t: "Combo", s: "Gói bán ghép nhiều sản phẩm" },
    reports: { t: "Báo cáo", s: "Lợi nhuận theo kênh & sản phẩm" },
  };

  return (
    <RefreshContext.Provider value={{ version: reloadKey, refresh }}>
    <div className="app-shell">
      <Sidebar route={route} onNav={nav} open={sbOpen} onCloseMobile={() => setSbOpen(false)}
        onLogout={logout} counts={counts} user={user} onOpenAccount={() => setAccountOpen(true)} />
      <div className={"sb-backdrop" + (sbOpen ? " show" : "")} onClick={() => setSbOpen(false)} />
      <div className="main">
        <TopBar title={titles[route].t} sub={titles[route].s} search={search} setSearch={setSearch}
          onSubmitSearch={() => { if (route !== "orders") nav("orders"); }}
          theme={theme} toggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} onMenu={() => setSbOpen(true)}
          onRefresh={refresh} settings={tweakControls()} />
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

          {route === "users" && user?.role === "admin" && (
            <Users onToast={showToast} currentUserId={user?.id} />
          )}
          {route === "users" && user?.role !== "admin" && (
            <div className="card empty"><Icon name="close" size={40} /><div>Bạn không có quyền truy cập trang này.</div></div>
          )}

          {route === "inventory" && <Inventory onToast={showToast} onOpenOrder={openOrder} />}
          {route === "pricing" && <Pricing onToast={showToast} />}
          {route === "costtypes" && <CostTypes onToast={showToast} />}
          {route === "sales" && <Sales onToast={showToast} />}
          {route === "promotions" && <Promotions onToast={showToast} />}
          {route === "combos" && <Combos onToast={showToast} />}
          {route === "reports" && <Reports onToast={showToast} />}
        </div>
      </div>

      {detailLoading && !selected && <div className="overlay" />}
      {selected && <OrderDetail order={selected} onClose={closeOrder} onToast={showToast} onChangeStatus={changeStatus} onDelete={deleteOrder} role={user?.role} onViewInventory={viewInventory} />}
      {toast && <div className="toast"><Icon name="check" size={16} stroke={2.4} />{toast}</div>}
      {accountOpen && <AccountModal user={user} onClose={() => setAccountOpen(false)} onUpdated={setUser} onToast={showToast} />}
    </div>
    </RefreshContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
