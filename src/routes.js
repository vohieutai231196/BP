/* ============================================================
   GomĐơn — URL ⇄ route mapping (History API, không cần thư viện)
   Caddy production đã có `try_files {path} /index.html` nên path thật
   (/orders, /reports…) hoạt động khi tải trực tiếp / mở tab mới.
   ============================================================ */
export const ROUTES = [
  "dashboard", "orders", "users", "inventory", "receipts",
  "pricing", "costtypes", "sales", "promotions", "combos", "reports",
];

// pathname → route key (mặc định "dashboard")
export function pathToRoute(pathname) {
  const seg = (pathname || "/").replace(/^\/+/, "").split("/")[0];
  return ROUTES.includes(seg) ? seg : "dashboard";
}

// route (+ filter của trang Đơn hàng) → href cho thẻ <a>
export function routeHref(route, filter) {
  const base = route === "dashboard" ? "/" : "/" + route;
  return filter ? `${base}?filter=${encodeURIComponent(filter)}` : base;
}

// filter hiện tại trên URL ("pay" | "khieu_nai" | null)
export function currentFilter() {
  return currentQuery("filter");
}

// /orders/{id} → id (number) để mở thẳng drawer chi tiết đơn; null nếu không có.
export function orderIdFromPath(pathname) {
  const parts = (pathname || "/").replace(/^\/+/, "").split("/");
  if (parts[0] === "orders" && parts[1]) {
    const id = parseInt(parts[1], 10);
    return Number.isFinite(id) ? id : null;
  }
  return null;
}

/* ----- Wrapper History API: gom mọi thao tác window.history/location về 1 chỗ.
   Giữ nguyên hành vi (push/replace có chống trùng URL để Back/Forward không lặp). ----- */
export const currentPath = () => window.location.pathname;
export const currentUrl = () => window.location.pathname + window.location.search;
export const currentQuery = (key) => new URLSearchParams(window.location.search).get(key);
export function pushUrl(href) { if (currentUrl() !== href) window.history.pushState({}, "", href); }
export function replaceUrl(href) { if (currentUrl() !== href) window.history.replaceState({}, "", href); }
export const goBack = () => window.history.back();
