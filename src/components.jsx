import React from "react";
import { Icon } from "./icons.jsx";
import DATA from "./data.js";

/* ---------- Money input ----------
   Ô nhập tiền: hiển thị phân tách hàng nghìn (14.759) cho dễ đọc, nhưng emit
   chuỗi chữ số thuần ("14759") qua onChange — khớp cách các form lưu state rồi
   parse bằng Number(...) khi submit. Dùng type=text + inputMode=numeric vì
   input[type=number] không cho hiển thị dấu phân cách. */
const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export function MoneyInput({ value, onChange, className, style, disabled, placeholder, autoFocus, required }) {
  const digits = value === 0 || value ? String(value).replace(/\D/g, "") : "";
  return (
    <input
      type="text" inputMode="numeric"
      className={className} style={style} disabled={disabled}
      placeholder={placeholder} autoFocus={autoFocus} required={required}
      value={digits === "" ? "" : groupThousands(digits)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
    />
  );
}

/* ---------- Phụ phí "theo lô" (pack) ---------- */
/* Đơn giá 1 đơn vị của phụ phí "theo lô" (0 nếu không phải pack hoặc thiếu quy cách) */
export const costUnitPrice = (c) => (c && c.unit === "pack" && c.packSize > 0 ? Math.round((c.packPrice || 0) / c.packSize) : 0);
/* Chi phí thực của 1 dòng phụ phí đã chọn. val = số người dùng nhập; base = giá vốn (Máy tính giá) hoặc doanh thu (Đơn bán) để tính %. */
export const resolveCostAmount = (c, val, base) => {
  const v = Number(val) || 0;
  if (c.unit === "percent") return Math.round((base || 0) * v / 100);
  if (c.unit === "pack") return costUnitPrice(c) * v;
  return Math.round(v);
};

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
export function Sidebar({ route, onNav, collapsed, open, onCloseMobile, onLogout, counts, user, onOpenAccount }) {
  const c = counts || {};
  const isAdmin = user?.role === "admin";
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
        <div className="sb-section-label"><span>Bán lẻ</span></div>
        <button className={"sb-item" + (route === "inventory" ? " active" : "")}
          onClick={() => { onNav("inventory"); onCloseMobile && onCloseMobile(); }}>
          <Icon name="warehouse" size={19} /><span>Kho &amp; Sản phẩm</span>
        </button>
        <button className={"sb-item" + (route === "pricing" ? " active" : "")}
          onClick={() => { onNav("pricing"); onCloseMobile && onCloseMobile(); }}>
          <Icon name="coins" size={19} /><span>Máy tính giá</span>
        </button>
        <button className={"sb-item" + (route === "costtypes" ? " active" : "")}
          onClick={() => { onNav("costtypes"); onCloseMobile && onCloseMobile(); }}>
          <Icon name="filter" size={19} /><span>Phụ phí</span>
        </button>
        <button className={"sb-item" + (route === "sales" ? " active" : "")}
          onClick={() => { onNav("sales"); onCloseMobile && onCloseMobile(); }}>
          <Icon name="wallet" size={19} /><span>Đơn bán</span>
        </button>
        <button className={"sb-item" + (route === "promotions" ? " active" : "")}
          onClick={() => { onNav("promotions"); onCloseMobile && onCloseMobile(); }}>
          <Icon name="tag" size={19} /><span>Khuyến mãi</span>
        </button>
        <button className={"sb-item" + (route === "combos" ? " active" : "")}
          onClick={() => { onNav("combos"); onCloseMobile && onCloseMobile(); }}>
          <Icon name="box" size={19} /><span>Combo</span>
        </button>
        <button className={"sb-item" + (route === "reports" ? " active" : "")}
          onClick={() => { onNav("reports"); onCloseMobile && onCloseMobile(); }}>
          <Icon name="dashboard" size={19} /><span>Báo cáo</span>
        </button>
        {isAdmin && (
          <>
            <div className="sb-section-label"><span>Hệ thống</span></div>
            <button className={"sb-item" + (route === "users" ? " active" : "")}
              onClick={() => { onNav("users"); onCloseMobile && onCloseMobile(); }}>
              <Icon name="user" size={19} /><span>Người dùng</span>
            </button>
          </>
        )}
        <div className="sb-section-label"><span>Công cụ</span></div>
        <a className="sb-item" href="extension.html" target="_blank" rel="noopener" onClick={onCloseMobile}>
          <Icon name="globe" size={19} /><span>Tiện ích thu thập</span>
          <Icon name="external" size={14} style={{ marginLeft: "auto", opacity: .6 }} />
        </a>
      </nav>
      <div className="sb-footer">
        <div className="sb-user" role="button" onClick={onOpenAccount} title="Tài khoản của tôi">
          <div className="sb-avatar">{(user?.name || "?").trim().charAt(0).toUpperCase()}</div>
          <div className="sb-user-info">
            <b>{user?.name || "Người dùng"}</b>
            <span>{user?.role === "admin" ? "Quản trị viên" : user?.role === "staff" ? "Nhân viên" : "Chỉ xem"}</span>
          </div>
          <button className="icon-btn" title="Đăng xuất" onClick={(e) => { e.stopPropagation(); onLogout(); }}><Icon name="external" size={16} /></button>
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
