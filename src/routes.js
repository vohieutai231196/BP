/* ============================================================
   GomĐơn — URL ⇄ route mapping (History API, không cần thư viện)
   Caddy production đã có `try_files {path} /index.html` nên path thật
   (/orders, /reports…) hoạt động khi tải trực tiếp / mở tab mới.
   ============================================================ */
export const ROUTES = [
  "dashboard", "orders", "users", "inventory",
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
  return new URLSearchParams(window.location.search).get("filter");
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
