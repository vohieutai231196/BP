import React from "react";
import { Icon } from "./icons.jsx";
import DATA from "./data.js";
import { api, setToken } from "./api.js";

export function Login({ onLogin }) {
  const [email, setEmail] = React.useState("maianh@gomdon.vn");
  const [pw, setPw] = React.useState("demo1234");
  const [show, setShow] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, pw);
      setToken(res.token);
      onLogin({ name: res.name, email: res.email, role: res.role });
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại.");
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="lb-top">
          <div className="sb-logo" style={{ width: 40, height: 40, fontSize: 17 }}>GĐ</div>
          <div className="sb-name" style={{ color: "#fff" }}>Gom<b>Đơn</b></div>
        </div>
        <div className="lb-mid">
          <h1>Quản lý đơn mua hộ <em>Trung Quốc → Việt Nam</em> trên một màn hình.</h1>
          <p>Theo dõi toàn bộ vòng đời đơn hàng: đặt cọc, mua hàng, vận chuyển về kho VN và trả hàng — kèm chi phí, cân nặng và kiện hàng.</p>
        </div>
        <div className="lb-stats">
          <div className="lb-stat"><b>{DATA.PLATFORMS.length}</b><span>sàn thu thập</span></div>
          <div className="lb-stat"><b>{DATA.WAREHOUSES.length}</b><span>kho tại VN</span></div>
          <div className="lb-stat"><b>{DATA.TIMELINE_STEPS.length}</b><span>bước vòng đời</span></div>
        </div>
        <div className="lb-flow">
          {DATA.TIMELINE_STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              <span className="lbf-node">{s.label}</span>
              {i < DATA.TIMELINE_STEPS.length - 1 && <span className="lbf-arrow">→</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <div className="lf-head">
            <h2>Đăng nhập</h2>
            <p>Chào mừng trở lại. Đăng nhập để tiếp tục quản lý đơn hàng.</p>
          </div>
          <label className="field">
            <span>Email</span>
            <div className="input"><Icon name="user" size={17} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          </label>
          <label className="field">
            <span>Mật khẩu</span>
            <div className="input">
              <Icon name="settings" size={17} />
              <input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} required />
              <button type="button" className="eye" onClick={() => setShow(!show)} aria-label="show"><Icon name="eye" size={17} /></button>
            </div>
          </label>
          {error && (
            <div className="lf-demo" style={{ background: "var(--st-red-bg)", color: "var(--st-red)" }}>
              <Icon name="close" size={14} /> {error}
            </div>
          )}
          <div className="lf-row">
            <label className="check"><input type="checkbox" defaultChecked /><span>Ghi nhớ đăng nhập</span></label>
            <a href="#" onClick={(e) => e.preventDefault()}>Quên mật khẩu?</a>
          </div>
          <button className="btn btn-primary lf-submit" disabled={loading}>
            {loading ? "Đang đăng nhập…" : "Đăng nhập"}{!loading && <Icon name="chevRight" size={17} />}
          </button>
          <div className="lf-demo"><Icon name="check" size={14} /> Tài khoản demo: <b>maianh@gomdon.vn</b> / <b>demo1234</b></div>
        </form>
      </div>
    </div>
  );
}

export default Login;
