/* GomĐơn — Tài khoản của tôi: đổi tên + đổi mật khẩu */
import React from "react";
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

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card" style={{ maxWidth: 420, margin: "10vh auto", padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 12 }}>Tài khoản của tôi</h3>
        <form onSubmit={saveProfile} style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          <label className="field"><span>Họ tên</span><div className="input"><input value={name} onChange={(e) => setName(e.target.value)} required /></div></label>
          <div style={{ textAlign: "right" }}><button className="btn btn-primary" disabled={busy}>Lưu hồ sơ</button></div>
        </form>
        <form onSubmit={savePw} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <label className="field"><span>Mật khẩu hiện tại</span><div className="input"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} required /></div></label>
          <label className="field"><span>Mật khẩu mới (≥ 6 ký tự)</span><div className="input"><input type="password" value={np} onChange={(e) => setNp(e.target.value)} required minLength={6} /></div></label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="btn" onClick={onClose}>Đóng</button>
            <button className="btn btn-primary" disabled={busy}>Đổi mật khẩu</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AccountModal;
