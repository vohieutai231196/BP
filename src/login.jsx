import React from "react";
import { Icon } from "./icons.jsx";
import DATA from "./data.js";
import { api, setToken } from "./api.js";

export function Login({ onLogin }) {
  const [mode, setMode] = React.useState("login");
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [info, setInfo] = React.useState(null);

  const reset = () => { setError(null); setInfo(null); };

  const doLogin = async () => {
    const res = await api.login(email, pw);
    setToken(res.token);
    onLogin({ id: res.id, name: res.name, email: res.email, role: res.role });
  };

  const doRegister = async () => {
    if (pw !== pw2) { setError("Mật khẩu nhập lại không khớp."); setLoading(false); return false; }
    const res = await api.register(email, name, pw);
    setInfo(res.message || "Đăng ký thành công. Tài khoản đang chờ admin duyệt.");
    setMode("login"); setPw(""); setPw2(""); setName("");
    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); reset();
    try {
      if (mode === "login") await doLogin();
      else await doRegister();
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="lb-top">
          <div className="sb-logo" style={{ width: 42, height: 42, fontSize: 16 }}>GĐ</div>
          <div className="sb-name">Gom<b>Đơn</b></div>
        </div>
        <div className="lb-mid">
          <span className="eyebrow">Mua hộ · Gom kiện · Về kho VN</span>
          <h1>Đưa đơn từ <em>Trung Quốc</em> về <em>Việt Nam</em>, gọn trong một màn hình.</h1>
          <p>Theo dõi trọn vòng đời đơn hàng: đặt cọc, mua hàng, vận chuyển về kho VN và trả hàng — kèm chi phí, cân nặng và kiện hàng.</p>
        </div>
        <div className="lb-stats">
          <div className="lb-stat"><b>{DATA.PLATFORMS.length}</b><span>sàn thu thập</span></div>
          <div className="lb-stat"><b>{DATA.WAREHOUSES.length}</b><span>kho tại VN</span></div>
          <div className="lb-stat"><b>{DATA.TIMELINE_STEPS.length}</b><span>bước vòng đời</span></div>
        </div>
        <div className="lb-flow">
          {DATA.TIMELINE_STEPS.map((s, i) => (
            <div className="lbf-step" key={s.key}>
              <span className="lbf-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="lbf-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="lf-head">
            <h2>{mode === "login" ? "Đăng nhập" : "Đăng ký tài khoản"}</h2>
            <p>{mode === "login" ? "Chào mừng trở lại. Đăng nhập để tiếp tục." : "Tạo tài khoản — admin sẽ duyệt trước khi bạn đăng nhập."}</p>
          </div>

          {mode === "register" && (
            <label className="field">
              <span>Họ tên</span>
              <div className="input"><Icon name="user" size={17} /><input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></div>
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <div className="input"><Icon name="mail" size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          </label>

          <label className="field">
            <span>Mật khẩu</span>
            <div className="input">
              <Icon name="lock" size={17} />
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={6} />
              <button type="button" className="eye" onClick={() => setShow(!show)} aria-label="show"><Icon name="eye" size={17} /></button>
            </div>
          </label>

          {mode === "register" && (
            <label className="field">
              <span>Nhập lại mật khẩu</span>
              <div className="input"><Icon name="lock" size={17} /><input type={show ? "text" : "password"} value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={6} /></div>
            </label>
          )}

          {error && (
            <div className="lf-demo" style={{ background: "var(--st-red-bg)", color: "var(--st-red)" }}>
              <Icon name="close" size={14} /> {error}
            </div>
          )}
          {info && (
            <div className="lf-demo" style={{ background: "var(--st-green-bg)", color: "var(--st-green)" }}>
              <Icon name="check" size={14} /> {info}
            </div>
          )}

          <button className="btn btn-primary lf-submit" disabled={loading}>
            {loading ? "Đang xử lý…" : (mode === "login" ? "Đăng nhập" : "Đăng ký")}{!loading && <Icon name="chevRight" size={17} />}
          </button>

          <div className="lf-row" style={{ justifyContent: "center" }}>
            {mode === "login"
              ? <a href="#" onClick={(e) => { e.preventDefault(); setMode("register"); reset(); }}>Chưa có tài khoản? Đăng ký</a>
              : <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); reset(); }}>Đã có tài khoản? Đăng nhập</a>}
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
