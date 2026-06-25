import React from "react";
import { Icon } from "./icons.jsx";
import DATA from "./data.js";
import { routeHref } from "./routes.js";

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

/* ---------- Ảnh phóng to (hover preview desktop + click lightbox mọi thiết bị) ----------
   Thumbnail nhỏ (42px) khó xem. Rê chuột → preview lớn nổi cạnh ảnh (định vị fixed nên
   không bị bảng overflow cắt); bấm → lightbox toàn màn (Esc/click nền để đóng). Mobile
   không hover được nên dựa vào click. */
export function ZoomImage({ src, alt, className }) {
  const [open, setOpen] = React.useState(false);       // lightbox
  const [pv, setPv] = React.useState(null);            // {left,top,size} preview hover
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const showPreview = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const size = 260, gap = 12;
    let left = r.right + gap;                                   // ưu tiên bên phải
    if (left + size > window.innerWidth - 8) left = r.left - gap - size; // hết chỗ → sang trái
    const top = Math.max(8, Math.min(r.top + r.height / 2 - size / 2, window.innerHeight - size - 8));
    setPv({ left, top, size });
  };

  return (
    <>
      <span className="zoom-wrap" ref={wrapRef}
            onMouseEnter={showPreview} onMouseLeave={() => setPv(null)}>
        <img className={"prod-thumb zoom-thumb" + (className ? " " + className : "")}
             src={src} alt={alt} referrerPolicy="no-referrer" loading="lazy"
             onClick={(e) => { e.stopPropagation(); setPv(null); setOpen(true); }} />
        {pv && (
          <span className="zoom-preview" aria-hidden="true"
                style={{ left: pv.left, top: pv.top, width: pv.size, height: pv.size }}>
            <img src={src} alt="" referrerPolicy="no-referrer" />
          </span>
        )}
      </span>
      {open && (
        <div className="overlay overlay-top lightbox" onClick={() => setOpen(false)}>
          <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={src} alt={alt} referrerPolicy="no-referrer" />
            <button className="lightbox-x" onClick={() => setOpen(false)} aria-label="đóng">
              <Icon name="close" size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- Product name (clamp 2 dòng, click bung full) ----------
   Tên dài bị cắt còn 2 dòng kèm dấu "…". Hover hiện tooltip tên đầy đủ;
   click vào tên thì bung toàn bộ ngay tại chỗ (không vỡ layout của hàng).
   Chỉ bật con trỏ/khả năng click khi tên thật sự bị cắt. */
export function ProdName({ name, className = "", style }) {
  const [expanded, setExpanded] = React.useState(false);
  const [clamped, setClamped] = React.useState(false);
  const ref = React.useRef(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => { if (!expanded) setClamped(el.scrollHeight > el.clientHeight + 1); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [name, expanded]);
  const canToggle = clamped || expanded;
  return (
    <div
      ref={ref}
      className={"pn-clamp" + (expanded ? " is-open" : "") + (canToggle ? " pn-toggle" : "") + (className ? " " + className : "")}
      style={style}
      title={name}
      role={canToggle ? "button" : undefined}
      tabIndex={canToggle ? 0 : undefined}
      onClick={canToggle ? (e) => { e.stopPropagation(); setExpanded((v) => !v); } : undefined}
      onKeyDown={canToggle ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded((v) => !v); } } : undefined}
    >
      {name}
    </div>
  );
}

/* ---------- Empty state (illustration + CTA) ---------- */
export function EmptyState({ icon = "box", title, hint, actionLabel, onAction, tone }) {
  return (
    <div className={"card empty" + (tone === "error" ? " empty-error" : "")}>
      <div className="empty-ic"><Icon name={icon} size={30} stroke={1.6} /></div>
      <div className="empty-title">{title}</div>
      {hint && <div className="empty-hint">{hint}</div>}
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}><Icon name="plus" size={15} /> {actionLabel}</button>
      )}
    </div>
  );
}

/* ---------- Sidebar ---------- */
export function Sidebar({ route, onNav, collapsed, open, onCloseMobile, onLogout, counts, user, onOpenAccount }) {
  const c = counts || {};
  const isAdmin = user?.role === "admin";

  // Mỗi mục là <a href> thật → Ctrl/⌘/giữa-chuột mở tab mới; click thường đi
  // qua SPA (chặn default trừ khi có phím bổ trợ / chuột giữa).
  const NavLink = ({ to, filter, icon, label, count, active }) => {
    const onClick = (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;
      e.preventDefault();
      onNav(to, filter ? { filter } : {});
      onCloseMobile && onCloseMobile();
    };
    return (
      <a href={routeHref(to, filter)} className={"sb-item" + (active ? " active" : "")} onClick={onClick}>
        <Icon name={icon} size={19} />
        <span>{label}</span>
        {count != null && <span className="sb-count">{count}</span>}
      </a>
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
        <NavLink to="dashboard" icon="dashboard" label="Tổng quan" active={route === "dashboard"} />
        <NavLink to="orders" icon="box" label="Đơn hàng" count={c.total} active={route === "orders"} />
        <div className="sb-section-label"><span>Cần chú ý</span></div>
        <NavLink to="orders" filter="pay" icon="wallet" label="Cần thanh toán" count={c.outstanding} />
        <NavLink to="orders" filter="khieu_nai" icon="bell" label="Khiếu nại" count={c.complaints} />
        <div className="sb-section-label"><span>Bán lẻ</span></div>
        <NavLink to="inventory" icon="warehouse" label="Kho & Sản phẩm" active={route === "inventory"} />
        <NavLink to="pricing" icon="coins" label="Máy tính giá" active={route === "pricing"} />
        <NavLink to="costtypes" icon="filter" label="Phụ phí" active={route === "costtypes"} />
        <NavLink to="sales" icon="wallet" label="Đơn bán" active={route === "sales"} />
        <NavLink to="promotions" icon="tag" label="Khuyến mãi" active={route === "promotions"} />
        <NavLink to="combos" icon="box" label="Combo" active={route === "combos"} />
        <NavLink to="reports" icon="dashboard" label="Báo cáo" active={route === "reports"} />
        {isAdmin && (
          <>
            <div className="sb-section-label"><span>Hệ thống</span></div>
            <NavLink to="users" icon="user" label="Người dùng" active={route === "users"} />
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
export function TopBar({ title, sub, search, setSearch, onSubmitSearch, theme, toggleTheme, onMenu, onRefresh, settings }) {
  const [setOpen, setSetOpen] = React.useState(false);
  const [spin, setSpin] = React.useState(false);
  // Đóng popover khi nhấn Esc.
  React.useEffect(() => {
    if (!setOpen) return;
    const h = (e) => { if (e.key === "Escape") setSetOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [setOpen]);

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
      <button className="icon-btn" onClick={() => { setSpin(true); onRefresh && onRefresh(); setTimeout(() => setSpin(false), 600); }}
        aria-label="refresh" title="Làm mới dữ liệu">
        <Icon name="refresh" size={19} className={spin ? "spin" : undefined} />
      </button>
      <button className="icon-btn" onClick={toggleTheme} aria-label="theme" title="Đổi giao diện">
        <Icon name={theme === "dark" ? "sun" : "moon"} size={19} />
      </button>
      {settings && (
        <div className="tb-pop-wrap">
          <button className={"icon-btn" + (setOpen ? " active" : "")} onClick={() => setSetOpen((v) => !v)}
            aria-label="settings" aria-expanded={setOpen} title="Tuỳ chỉnh giao diện">
            <Icon name="settings" size={19} />
          </button>
          {setOpen && (
            <>
              <div className="tb-pop-backdrop" onClick={() => setSetOpen(false)} />
              <div className="tb-pop" role="dialog" aria-label="Tuỳ chỉnh giao diện">
                <div className="tb-pop-head"><Icon name="settings" size={15} /><b>Tuỳ chỉnh giao diện</b></div>
                <div className="tb-pop-body">{settings}</div>
              </div>
            </>
          )}
        </div>
      )}
      <button className="icon-btn hide-mobile" aria-label="notifications"><Icon name="bell" size={19} /><span className="dot" /></button>
    </header>
  );
}
