/* ============================================================
   GomĐơn — API client (gọi backend .NET)
   Quản lý JWT trong localStorage, đính Authorization header,
   xử lý 401 (hết phiên) tập trung.
   ============================================================ */
const BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";
const TOKEN_KEY = "gd_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); };

let onUnauthorized = null;
export const setOnUnauthorized = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function request(path, { method = "GET", body, auth = true, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  const t = getToken();
  if (auth && t) h["Authorization"] = `Bearer ${t}`;

  let res;
  try {
    res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Kiểm tra API đang chạy ở " + BASE);
  }

  if (res.status === 401) {
    setToken(null);
    onUnauthorized && onUnauthorized();
    throw new ApiError(401, "Phiên đăng nhập đã hết hạn.");
  }
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try { const j = await res.json(); msg = j.detail || j.title || j.message || msg; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") || "";
  return ct.includes("json") ? res.json() : res.text();
}

function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) p.append(k, v);
  });
  const s = p.toString();
  return s ? "?" + s : "";
}

export const api = {
  login: (email, password) => request("/v1/auth/login", { method: "POST", auth: false, body: { email, password } }),
  me: () => request("/v1/auth/me"),
  dashboard: () => request("/v1/dashboard/summary"),
  orders: (query) => request("/v1/orders" + qs(query)),
  order: (id) => request(`/v1/orders/${id}`),
  changeStatus: (id, status, note) => request(`/v1/orders/${id}/status`, { method: "PATCH", body: { status, note } }),
  deleteOrder: (id) => request(`/v1/orders/${id}`, { method: "DELETE" }),
};

export default api;
