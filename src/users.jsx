/* ============================================================
   GomĐơn — Quản lý người dùng (admin)
   Danh sách + lọc trạng thái (có đếm), duyệt/từ chối, đổi vai trò,
   khóa/mở, đặt lại mật khẩu, tạo user. Modal thay cho prompt.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { useRefresh } from "./refresh.js";

const ROLES = [
  { key: "admin", label: "Quản trị viên", desc: "Toàn quyền + quản lý người dùng" },
  { key: "staff", label: "Nhân viên", desc: "Xử lý đơn hàng, không quản lý user" },
  { key: "viewer", label: "Chỉ xem", desc: "Chỉ xem dashboard & đơn, không sửa" },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.key, r.label]));
const STATUS = {
  pending: { label: "Chờ duyệt", color: "amber" },
  active: { label: "Hoạt động", color: "green" },
  disabled: { label: "Đã khóa", color: "slate" },
};
const TABS = [
  { key: "", label: "Tất cả" },
  { key: "pending", label: "Chờ duyệt" },
  { key: "active", label: "Hoạt động" },
  { key: "disabled", label: "Đã khóa" },
];
const AV_TINTS = ["#1b7a5c", "#c0392b", "#b07d1a", "#1e7e84", "#7e4e7e", "#b8418f", "#5f6b5f"];
const tintFor = (s) => AV_TINTS[[...(s || "?")].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_TINTS.length];
const initial = (s) => (s || "?").trim().charAt(0).toUpperCase();
const fmtDate = (d) => { try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return "—"; } };

export function Users({ onToast, currentUserId }) {
  const [tab, setTab] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [all, setAll] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const { version: reload, refresh } = useRefresh();
  const [creating, setCreating] = React.useState(false);
  const [action, setAction] = React.useState(null); // { type, user }

  React.useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    api.users.list({ pageSize: 200 })
      .then((d) => { if (alive) setAll(d.items || []); })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const run = async (fn, okMsg) => {
    try { await fn(); onToast && onToast(okMsg); setAction(null); setCreating(false); refresh(); }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
  };

  const counts = React.useMemo(() => {
    const c = { "": all.length, pending: 0, active: 0, disabled: 0 };
    all.forEach((u) => { c[u.status] = (c[u.status] || 0) + 1; });
    return c;
  }, [all]);

  const q = search.trim().toLowerCase();
  const rows = all.filter((u) =>
    (!tab || u.status === tab) &&
    (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));

  return (
    <div className="fade-in">
      {/* toolbar: lọc trạng thái (có đếm) + tìm + tạo */}
      <div className="toolbar">
        <div className="chips">
          {TABS.map((t) => (
            <button key={t.key} className={"chip" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
              {t.label}<span className="cc">{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div className="search" style={{ maxWidth: 240 }}>
          <Icon name="search" size={16} style={{ color: "var(--faint)" }} />
          <input placeholder="Tìm tên / email…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} /> Tạo người dùng
        </button>
      </div>

      {loading ? (
        <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>
      ) : err ? (
        <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>
      ) : rows.length === 0 ? (
        <div className="card empty"><Icon name="user" size={40} /><div>Không có người dùng phù hợp.</div></div>
      ) : (
        <div className="card"><div className="grid-wrap"><table className="dg">
          <thead>
            <tr>
              <th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th>
              <th style={{ textAlign: "right" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const st = STATUS[u.status] || { label: u.status, color: "slate" };
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="cell-prod">
                      <div className="u-avatar" style={{ background: tintFor(u.email) }}>{initial(u.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pn">{u.name}{isSelf && <span className="u-you">bạn</span>}</div>
                        <div className="pm" title={u.email}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={"role-pill " + u.role}>{ROLE_LABEL[u.role] || u.role}</span></td>
                  <td><span className={"badge " + st.color}><span className="dot" /> {st.label}</span></td>
                  <td className="cell-sub">{fmtDate(u.createdAt)}</td>
                  <td>
                    <div className="u-actions">
                      {u.status === "pending" && (<>
                        <button className="btn btn-sm btn-primary" onClick={() => setAction({ type: "approve", user: u })}>
                          <Icon name="check" size={15} /> Duyệt
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setAction({ type: "reject", user: u })}>
                          <Icon name="close" size={15} /> Từ chối
                        </button>
                      </>)}
                      {u.status === "active" && (<>
                        <button className="btn btn-sm btn-ghost" onClick={() => setAction({ type: "role", user: u })}>
                          <Icon name="settings" size={15} /> Vai trò
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={() => setAction({ type: "password", user: u })}>
                          <Icon name="refresh" size={15} /> Mật khẩu
                        </button>
                        {!isSelf && (
                          <button className="btn btn-sm btn-ghost" onClick={() => setAction({ type: "disable", user: u })}>
                            <Icon name="power" size={15} /> Khóa
                          </button>
                        )}
                      </>)}
                      {u.status === "disabled" && (
                        <button className="btn btn-sm btn-ghost" onClick={() => run(() => api.users.enable(u.id), "Đã mở khóa " + u.email)}>
                          <Icon name="power" size={15} /> Mở khóa
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      )}

      {creating && <CreateUserModal onRun={run} onClose={() => setCreating(false)} />}
      {action?.type === "approve" && (
        <RoleModal icon="check" title="Duyệt tài khoản" sub={action.user.email} confirm="Duyệt & kích hoạt"
          start="staff" onClose={() => setAction(null)}
          onSubmit={(role) => run(() => api.users.approve(action.user.id, role), "Đã duyệt " + action.user.email)} />
      )}
      {action?.type === "role" && (
        <RoleModal icon="settings" title="Đổi vai trò" sub={action.user.email} confirm="Lưu vai trò"
          start={action.user.role} onClose={() => setAction(null)}
          onSubmit={(role) => run(() => api.users.update(action.user.id, { role }), "Đã đổi vai trò " + action.user.email)} />
      )}
      {action?.type === "password" && (
        <PasswordModal user={action.user} onClose={() => setAction(null)}
          onSubmit={(pw) => run(() => api.users.resetPassword(action.user.id, pw), "Đã đặt lại mật khẩu " + action.user.email)} />
      )}
      {action?.type === "reject" && (
        <ConfirmModal title="Từ chối đăng ký" confirm="Từ chối & xóa"
          message={<>Xóa vĩnh viễn đăng ký của <b>{action.user.email}</b>? Hành động này không thể hoàn tác.</>}
          onClose={() => setAction(null)} onConfirm={() => run(() => api.users.reject(action.user.id), "Đã từ chối " + action.user.email)} />
      )}
      {action?.type === "disable" && (
        <ConfirmModal title="Khóa tài khoản" confirm="Khóa tài khoản"
          message={<>Khóa <b>{action.user.email}</b>? Người này sẽ không đăng nhập được cho đến khi mở khóa.</>}
          onClose={() => setAction(null)} onConfirm={() => run(() => api.users.disable(action.user.id), "Đã khóa " + action.user.email)} />
      )}
    </div>
  );
}

/* ---------- Modal vỏ chung ---------- */
function Modal({ icon, title, sub, children, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {icon && <div className="mh-ic"><Icon name={icon} size={18} /></div>}
          <div>
            <h3>{title}</h3>
            {sub && <div className="mh-sub">{sub}</div>}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Bộ chọn vai trò (thẻ radio) ---------- */
function RolePicker({ value, onChange }) {
  return (
    <div className="role-opts">
      {ROLES.map((r) => (
        <div key={r.key} className={"role-opt" + (value === r.key ? " sel" : "")} onClick={() => onChange(r.key)}>
          <div className="ro-r" />
          <div className="ro-t"><b>{r.label}</b><span>{r.desc}</span></div>
        </div>
      ))}
    </div>
  );
}

function RoleModal({ icon, title, sub, confirm, start, onSubmit, onClose }) {
  const [role, setRole] = React.useState(start);
  const [busy, setBusy] = React.useState(false);
  const go = async () => { setBusy(true); await onSubmit(role); setBusy(false); };
  return (
    <Modal icon={icon} title={title} sub={sub} onClose={onClose}>
      <div className="modal-body"><RolePicker value={role} onChange={setRole} /></div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" disabled={busy} onClick={go}>{busy ? "Đang lưu…" : confirm}</button>
      </div>
    </Modal>
  );
}

function PasswordModal({ user, onSubmit, onClose }) {
  const [pw, setPw] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const valid = pw.length >= 6;
  const submit = async (e) => { e.preventDefault(); if (!valid) return; setBusy(true); await onSubmit(pw); setBusy(false); };
  return (
    <Modal icon="refresh" title="Đặt lại mật khẩu" sub={user.email} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Mật khẩu mới (≥ 6 ký tự)</span>
            <div className="input"><Icon name="settings" size={16} /><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus required minLength={6} /></div>
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={busy || !valid}>{busy ? "Đang lưu…" : "Đặt lại mật khẩu"}</button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmModal({ title, message, confirm, onConfirm, onClose }) {
  const [busy, setBusy] = React.useState(false);
  const go = async () => { setBusy(true); await onConfirm(); setBusy(false); };
  return (
    <Modal icon="close" title={title} onClose={onClose}>
      <div className="modal-body"><div className="mb-text">{message}</div></div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose}>Hủy</button>
        <button className="btn btn-primary" disabled={busy} onClick={go}
          style={{ background: "var(--st-red)", borderColor: "var(--st-red)", boxShadow: "none" }}>
          {busy ? "Đang xử lý…" : confirm}
        </button>
      </div>
    </Modal>
  );
}

function CreateUserModal({ onRun, onClose }) {
  const [f, setF] = React.useState({ email: "", name: "", role: "staff", password: "" });
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    await onRun(() => api.users.create(f), "Đã tạo user " + f.email);
    setBusy(false);
  };
  return (
    <Modal icon="plus" title="Tạo người dùng" sub="Tài khoản được kích hoạt ngay" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field"><span>Họ tên</span><div className="input"><Icon name="user" size={16} /><input value={f.name} onChange={set("name")} autoFocus required /></div></label>
          <label className="field"><span>Email</span><div className="input"><Icon name="link" size={16} /><input type="email" value={f.email} onChange={set("email")} required /></div></label>
          <div className="field"><span style={{ marginBottom: 4 }}>Vai trò</span><RolePicker value={f.role} onChange={(role) => setF({ ...f, role })} /></div>
          <label className="field"><span>Mật khẩu (≥ 6 ký tự)</span><div className="input"><Icon name="settings" size={16} /><input type="password" value={f.password} onChange={set("password")} required minLength={6} /></div></label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo người dùng"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default Users;
