/* GomĐơn — Tài khoản của tôi: đổi tên + đổi mật khẩu (modal-card) */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";

export function AccountModal({ user, onClose, onUpdated, onToast }) {
  const [name, setName] = React.useState(user?.name || "");
  const [cur, setCur] = React.useState("");
  const [np, setNp] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const saveProfile = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.account.updateProfile(name); onToast && onToast("Đã cập nhật hồ sơ"); onUpdated && onUpdated({ ...user, name }); }
    catch (err) { onToast && onToast("Lỗi: " + err.message); }
    finally { setBusy(false); }
  };

  const savePw = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await api.account.changePassword(cur, np); onToast && onToast("Đã đổi mật khẩu"); setCur(""); setNp(""); }
    catch (err) { onToast && onToast("Lỗi: " + err.message); }
    finally { setBusy(false); }
  };

  const roleLabel = user?.role === "admin" ? "Quản trị viên" : user?.role === "staff" ? "Nhân viên" : "Chỉ xem";

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-ic"><Icon name="user" size={18} /></div>
          <div>
            <h3>Tài khoản của tôi</h3>
            <div className="mh-sub">{user?.email} · {roleLabel}</div>
          </div>
        </div>

        <div className="modal-body">
          <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="field"><span>Họ tên</span>
              <div className="input"><Icon name="user" size={16} /><input value={name} onChange={(e) => setName(e.target.value)} required /></div>
            </label>
            <div style={{ textAlign: "right" }}>
              <button className="btn btn-sm btn-primary" disabled={busy}>Lưu hồ sơ</button>
            </div>
          </form>

          <div style={{ height: 1, background: "var(--line)", margin: "2px 0" }} />

          <form onSubmit={savePw} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label className="field"><span>Mật khẩu hiện tại</span>
              <div className="input"><Icon name="settings" size={16} /><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div>
            </label>
            <label className="field"><span>Mật khẩu mới (≥ 6 ký tự)</span>
              <div className="input"><Icon name="settings" size={16} /><input type="password" value={np} onChange={(e) => setNp(e.target.value)} required minLength={6} /></div>
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-sm" onClick={onClose}>Đóng</button>
              <button className="btn btn-sm btn-primary" disabled={busy}>Đổi mật khẩu</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AccountModal;
