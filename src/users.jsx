/* ============================================================
   GomĐơn — Quản lý người dùng (admin)
   Danh sách + lọc trạng thái; duyệt/từ chối, đổi role, khóa/mở,
   đặt lại mật khẩu, tạo user. Gọi api.users.*
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";

const ROLE_LABEL = { admin: "Quản trị viên", staff: "Nhân viên", viewer: "Chỉ xem" };
const STATUS_LABEL = { pending: "Chờ duyệt", active: "Hoạt động", disabled: "Đã khóa" };
const STATUS_COLOR = { pending: "var(--st-amber)", active: "var(--st-green)", disabled: "var(--st-red)" };
const TABS = [
  { key: "", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "active", label: "Hoạt động" },
  { key: "disabled", label: "Đã khóa" },
];

export function Users({ onToast, currentUserId }) {
  const [tab, setTab] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [data, setData] = React.useState({ items: [], total: 0 });
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    api.users.list({ status: tab || undefined, search: search || undefined, pageSize: 100 })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab, search, reload]);

  const refresh = () => setReload((r) => r + 1);
  const run = async (fn, okMsg) => {
    try { await fn(); onToast && onToast(okMsg); refresh(); }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
  };

  const approve = (u) => { const role = window.prompt("Gán role khi duyệt: staff (Nhân viên) hoặc viewer (Chỉ xem)", "staff"); if (!role) return; run(() => api.users.approve(u.id, role.trim()), `Đã duyệt ${u.email}`); };
  const reject = (u) => { if (window.confirm(`Từ chối & xóa đăng ký ${u.email}?`)) run(() => api.users.reject(u.id), "Đã từ chối"); };
  const changeRole = (u) => { const role = window.prompt(`Đổi role cho ${u.email} (admin/staff/viewer)`, u.role); if (!role || role === u.role) return; run(() => api.users.update(u.id, { role: role.trim() }), "Đã đổi role"); };
  const disable = (u) => { if (window.confirm(`Khóa tài khoản ${u.email}?`)) run(() => api.users.disable(u.id), "Đã khóa"); };
  const enable = (u) => run(() => api.users.enable(u.id), "Đã mở khóa");
  const resetPw = (u) => { const np = window.prompt(`Mật khẩu mới cho ${u.email} (≥ 6 ký tự)`); if (!np) return; run(() => api.users.resetPassword(u.id, np), "Đã đặt lại mật khẩu"); };

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div className="card-head">
          <Icon name="user" size={18} style={{ color: "var(--muted)" }} />
          <h3>Người dùng</h3>
          <span className="topbar-spacer" />
          <div className="search" style={{ marginRight: 8 }}>
            <input placeholder="Tìm tên / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Tạo user</button>
        </div>
        <div className="card-pad">
          <div className="tabs" style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {TABS.map((t) => (
              <button key={t.key} className={"tag-soft" + (tab === t.key ? " active" : "")}
                onClick={() => setTab(t.key)} style={tab === t.key ? { background: "var(--accent-soft)", color: "var(--accent-ink)" } : {}}>
                {t.label}
              </button>
            ))}
          </div>

          {loading && <div className="empty"><Icon name="refresh" size={32} /><div>Đang tải…</div></div>}
          {err && <div className="empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={32} /><div>{err}</div></div>}
          {!loading && !err && (
            <table className="tbl" style={{ width: "100%" }}>
              <thead>
                <tr><th>Tên</th><th>Email</th><th>Role</th><th>Trạng thái</th><th>Ngày tạo</th><th style={{ textAlign: "right" }}>Thao tác</th></tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id}>
                    <td><b>{u.name}</b>{u.id === currentUserId && <span className="tag-soft" style={{ marginLeft: 6 }}>bạn</span>}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABEL[u.role] || u.role}</td>
                    <td><span style={{ color: STATUS_COLOR[u.status], fontWeight: 700 }}>{STATUS_LABEL[u.status] || u.status}</span></td>
                    <td>{new Date(u.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {u.status === "pending" && (<>
                        <button className="btn btn-sm" onClick={() => approve(u)}>Duyệt</button>
                        <button className="btn btn-sm" onClick={() => reject(u)}>Từ chối</button>
                      </>)}
                      {u.status === "active" && (<>
                        <button className="btn btn-sm" onClick={() => changeRole(u)}>Đổi role</button>
                        <button className="btn btn-sm" onClick={() => resetPw(u)}>Đặt lại MK</button>
                        <button className="btn btn-sm" onClick={() => disable(u)}>Khóa</button>
                      </>)}
                      {u.status === "disabled" && (
                        <button className="btn btn-sm" onClick={() => enable(u)}>Mở khóa</button>
                      )}
                    </td>
                  </tr>
                ))}
                {data.items.length === 0 && <tr><td colSpan={6}><div className="empty">Không có người dùng.</div></td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {creating && <CreateUserModal onClose={() => setCreating(false)} onDone={() => { setCreating(false); refresh(); }} onToast={onToast} />}
    </div>
  );
}

function CreateUserModal({ onClose, onDone, onToast }) {
  const [f, setF] = React.useState({ email: "", name: "", role: "staff", password: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.users.create(f); onToast && onToast("Đã tạo user " + f.email); onDone(); }
    catch (err) { onToast && onToast("Lỗi: " + err.message); setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card" style={{ maxWidth: 420, margin: "10vh auto", padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 12 }}>Tạo người dùng</h3>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field"><span>Họ tên</span><div className="input"><input value={f.name} onChange={set("name")} required /></div></label>
          <label className="field"><span>Email</span><div className="input"><input type="email" value={f.email} onChange={set("email")} required /></div></label>
          <label className="field"><span>Role</span>
            <div className="input"><select value={f.role} onChange={set("role")}>
              <option value="admin">Quản trị viên</option>
              <option value="staff">Nhân viên</option>
              <option value="viewer">Chỉ xem</option>
            </select></div>
          </label>
          <label className="field"><span>Mật khẩu (≥ 6 ký tự)</span><div className="input"><input type="password" value={f.password} onChange={set("password")} required minLength={6} /></div></label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Users;
