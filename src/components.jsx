import React from "react";
import { Icon } from "./icons.jsx";
import DATA from "./data.js";

/* ---------- Status badge ---------- */
export function StatusBadge({ status, size }) {
  const s = DATA.STATUS[status];
  if (!s) return null;
  return (
    <span className={"badge " + s.color} style={size === "sm" ? { fontSize: 11.5, padding: "3px 9px" } : null}>
      <span className="dot" /> {s.label}
    </span>
  );
}

/* ---------- Platform tag ---------- */
export function PlatformTag({ platform }) {
  return (
    <span className="ptag"><span className="pd" style={{ background: platform.tint }} />{platform.label}</span>
  );
}

/* ---------- Product thumbnail (striped placeholder) ---------- */
const CAT_ICON = { shoe: "box", bag: "box", apparel: "tag", tech: "box", home: "warehouse", beauty: "tag" };
export function ProductThumb({ order, lg }) {
  return (
    <div className={"thumb" + (lg ? " lg" : "")} style={{ background: order.tint }} title={order.productName}>
      <Icon name={CAT_ICON[order.cat] || "box"} size={lg ? 26 : 19} stroke={1.7} />
    </div>
  );
}

/* ---------- Sidebar ---------- */
export function Sidebar({ route, onNav, collapsed, open, onCloseMobile, onLogout, counts }) {
  const c = counts || {};
  const items = [
    { key: "dashboard", label: "Tổng quan", icon: "dashboard" },
    { key: "orders", label: "Đơn hàng", icon: "box", count: c.total },
    { key: "pay", label: "Cần thanh toán", icon: "wallet", count: c.outstanding, go: { route: "orders", filter: "pay" } },
    { key: "complaint", label: "Khiếu nại", icon: "bell", count: c.complaints, go: { route: "orders", filter: "khieu_nai" } },
  ];

  const NavBtn = (it) => {
    const active = route === it.key || (it.key === "orders" && route === "orders");
    return (
      <button key={it.key} className={"sb-item" + (active && !it.go ? " active" : "")}
        onClick={() => { it.go ? onNav(it.go.route, { filter: it.go.filter }) : onNav(it.key); onCloseMobile && onCloseMobile(); }}>
        <Icon name={it.icon} size={19} />
        <span>{it.label}</span>
        {it.count != null && <span className="sb-count">{it.count}</span>}
      </button>
    );
  };

  return (
    <aside className={"sidebar" + (open ? " open" : "")}>
      <div className="sb-brand">
        <div className="sb-logo">GĐ</div>
        <div className="sb-name">Gom<b>Đơn</b><span>Mua hộ Trung Quốc</span></div>
      </div>
      <nav className="sb-nav">
        <div className="sb-section-label"><span>Quản lý</span></div>
        {[items[0], items[1]].map(NavBtn)}
        <div className="sb-section-label"><span>Cần chú ý</span></div>
        {[items[2], items[3]].map(NavBtn)}
        <div className="sb-section-label"><span>Công cụ</span></div>
        <a className="sb-item" href="extension.html" target="_blank" rel="noopener" onClick={onCloseMobile}>
          <Icon name="globe" size={19} /><span>Tiện ích thu thập</span>
          <Icon name="external" size={14} style={{ marginLeft: "auto", opacity: .6 }} />
        </a>
      </nav>
      <div className="sb-footer">
        <div className="sb-user" role="button" onClick={onLogout} title="Đăng xuất">
          <div className="sb-avatar">MA</div>
          <div className="sb-user-info"><b>Mai Anh</b><span>Quản trị viên</span></div>
          <Icon name="logout" size={17} style={{ marginLeft: "auto", color: "var(--sidebar-muted)" }} />
        </div>
      </div>
    </aside>
  );
}

/* ---------- TopBar ---------- */
export function TopBar({ title, sub, search, setSearch, onSubmitSearch, theme, toggleTheme, onMenu }) {
  return (
    <header className="topbar">
      <button className="icon-btn menu-toggle" onClick={onMenu} aria-label="menu"><Icon name="menu" size={20} /></button>
      <div className="hide-mobile">
        <div className="topbar-title">{title}</div>
        {sub && <div className="topbar-sub">{sub}</div>}
      </div>
      <div className="topbar-spacer hide-mobile" />
      <form className="search" onSubmit={(e) => { e.preventDefault(); onSubmitSearch && onSubmitSearch(); }}>
        <Icon name="search" size={17} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã đơn, khách hàng, sản phẩm…" />
        <kbd>/</kbd>
      </form>
      <button className="icon-btn" onClick={toggleTheme} aria-label="theme" title="Đổi giao diện">
        <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
      </button>
      <button className="icon-btn hide-mobile" aria-label="notifications"><Icon name="bell" size={19} /><span className="dot" /></button>
    </header>
  );
}
