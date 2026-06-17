/* ============================================================
   GomĐơn — API client (gọi backend .NET)
   Quản lý JWT trong localStorage, đính Authorization header,
   xử lý 401 (hết phiên) tập trung.
   ============================================================ */
// Mặc định gọi cùng origin ("" → /v1/... tương đối). Dev local đặt VITE_API_BASE
// trong .env.local để trỏ sang VPS. Dùng ?? để chuỗi rỗng (cùng origin) được giữ.
const BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8080";
const TOKEN_KEY = "gd_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); };

let onUnauthorized = null;
export const setOnUnauthorized = (fn) => { onUnauthorized = fn; };

// Ảnh sản phẩm nằm trên CDN alicdn — một số nhà mạng VN chặn trên 4G/5G nên
// điện thoại không tải được. Đẩy qua proxy cùng origin (/v1/img) để server tự lấy.
export const imgUrl = (u) => u ? `${BASE}/v1/img?u=${encodeURIComponent(u)}` : u;

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

  // 401 chỉ là "hết phiên" khi request có gửi token (auth). 401 từ login/register
  // (auth:false) nghĩa là sai thông tin đăng nhập → giữ message thật của server.
  if (res.status === 401) {
    if (auth) {
      setToken(null);
      onUnauthorized && onUnauthorized();
      throw new ApiError(401, "Phiên đăng nhập đã hết hạn.");
    }
    let msg = "Email hoặc mật khẩu không đúng.";
    try { const j = await res.json(); msg = j.detail || j.title || j.message || msg; } catch { /* ignore */ }
    throw new ApiError(401, msg);
  }
  if (!res.ok) {
    let msg = `Lỗi ${res.status}`;
    try {
      const j = await res.json();
      // ValidationProblemDetails (FluentValidation): lý do thật nằm trong j.errors theo
      // từng field, title chỉ là "Dữ liệu không hợp lệ" → gộp các message field để hiện rõ.
      const fieldErrors = j.errors && typeof j.errors === "object"
        ? Object.values(j.errors).flat().filter(Boolean).join(" ")
        : "";
      msg = j.detail || j.message || fieldErrors || j.title || msg;
    } catch { /* ignore */ }
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
  register: (email, name, password) => request("/v1/auth/register", { method: "POST", auth: false, body: { email, name, password } }),
  me: () => request("/v1/auth/me"),
  dashboard: () => request("/v1/dashboard/summary"),
  orders: (query) => request("/v1/orders" + qs(query)),
  order: (id) => request(`/v1/orders/${id}`),
  changeStatus: (id, status, note) => request(`/v1/orders/${id}/status`, { method: "PATCH", body: { status, note } }),
  deleteOrder: (id) => request(`/v1/orders/${id}`, { method: "DELETE" }),

  users: {
    list: (query) => request("/v1/users" + qs(query)),
    create: (body) => request("/v1/users", { method: "POST", body }),
    update: (id, body) => request(`/v1/users/${id}`, { method: "PATCH", body }),
    approve: (id, role) => request(`/v1/users/${id}/approve`, { method: "POST", body: { role } }),
    reject: (id) => request(`/v1/users/${id}/reject`, { method: "POST" }),
    disable: (id) => request(`/v1/users/${id}/disable`, { method: "POST" }),
    enable: (id) => request(`/v1/users/${id}/enable`, { method: "POST" }),
    resetPassword: (id, newPassword) => request(`/v1/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),
  },
  account: {
    changePassword: (currentPassword, newPassword) => request("/v1/account/password", { method: "PATCH", body: { currentPassword, newPassword } }),
    updateProfile: (name) => request("/v1/account/profile", { method: "PATCH", body: { name } }),
  },
};

export default api;
