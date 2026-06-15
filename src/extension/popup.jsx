/* ============================================================
   GomĐơn Collector — Chrome Extension (MV3) popup.
   Auto-collect toggle, API connection state, manual collect with
   progress, session counter, activity log and API settings.
   ============================================================ */
import React from "react";
import { Icon } from "../icons.jsx";

const { useState, useRef, useEffect } = React;

const SAMPLE_PRODUCTS = ["Giày sneaker nữ", "Túi xách thời trang", "Áo khoác dạ nam", "Tai nghe TWS", "Đồng hồ thông minh", "Balo laptop", "Váy liền thân", "Bình giữ nhiệt"];
let SEQ = 648010;

function nowTime() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function ExtApp() {
  const [connected, setConnected] = useState(true);
  const [auto, setAuto] = useState(false);
  const [today, setToday] = useState(128);
  const [session, setSession] = useState(0);
  const [detected, setDetected] = useState(14);
  const [collecting, setCollecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState([
    { id: 648007, name: "Tai nghe TWS", t: "09:12:48" },
    { id: 648006, name: "Túi xách thời trang", t: "09:12:31" },
  ]);
  const [showSet, setShowSet] = useState(false);
  const [endpoint, setEndpoint] = useState("https://api.gomdon.vn/v1/orders/ingest");
  const [token, setToken] = useState("gd_live_8f3a••••••••2c7b");
  const [saved, setSaved] = useState(false);
  const autoRef = useRef(null);
  const progRef = useRef(null);

  const addOrders = (n) => {
    setToday((v) => v + n); setSession((v) => v + n);
    setLog((l) => {
      const add = [];
      for (let i = 0; i < Math.min(n, 4); i++) add.push({ id: SEQ++, name: SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)], t: nowTime() });
      return [...add.reverse(), ...l].slice(0, 6);
    });
  };

  // manual collect with progress
  const collectPage = () => {
    if (collecting || !connected || detected === 0) return;
    setCollecting(true); setProgress(0);
    let p = 0;
    progRef.current = setInterval(() => {
      p += Math.random() * 14 + 8;
      if (p >= 100) {
        p = 100; clearInterval(progRef.current);
        setProgress(100);
        setTimeout(() => { addOrders(detected); setDetected(0); setCollecting(false); setProgress(0); }, 250);
      } else setProgress(p);
    }, 110);
  };

  // auto-collect loop
  useEffect(() => {
    if (auto && connected) {
      autoRef.current = setInterval(() => { addOrders(1); }, 2600);
    }
    return () => clearInterval(autoRef.current);
  }, [auto, connected]);

  useEffect(() => () => { clearInterval(progRef.current); clearInterval(autoRef.current); }, []);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 1800); };

  return (
    <div className="ext-stage">
      {/* faux platform page */}
      <div className="fauxpage">
        <div className="fp-bar">
          <div className="fp-logo" />
          <div className="fp-pill" style={{ width: 130 }} />
          <div className="fp-pill" style={{ width: 60, marginLeft: "auto" }} />
          <div className="fp-pill" style={{ width: 60 }} />
        </div>
        <div className="fp-body">
          <div className="fp-pill" style={{ width: 180, height: 18, marginBottom: 6 }} />
          {Array.from({ length: 7 }).map((_, i) => (
            <div className="fp-row" key={i}>
              <div className="fp-thumb" />
              <div className="fp-lines"><div className="fp-line" style={{ width: "58%" }} /><div className="fp-line" style={{ width: "32%" }} /></div>
              <div className="fp-pill" style={{ width: 70 }} />
              <div className="fp-pill" style={{ width: 90 }} />
            </div>
          ))}
        </div>
      </div>
      <div className="ext-scrim" />

      {/* popup */}
      <div className="ext-pop">
        <div className="ext-toolbtn">GĐ</div>
        <div className="ext-head">
          <div className="ext-logo">GĐ</div>
          <div className="ext-title"><b>GomĐơn Collector</b><span>Tiện ích thu thập đơn hàng</span></div>
          <div className={"ext-conn " + (connected ? "on" : "off")} onClick={() => setConnected(!connected)} title="Bấm để mô phỏng">
            <span className="cd" />{connected ? "Đã kết nối API" : "Mất kết nối"}
          </div>
        </div>

        <div className="ext-body">
          {/* auto hero */}
          <div className={"ext-hero" + (auto ? " active" : "")}>
            <div className="ext-hero-ic"><Icon name="refresh" size={20} /></div>
            <div className="ext-hero-tx">
              <b>Thu thập tự động</b>
              <span>{auto ? "Đang theo dõi các trang đơn hàng…" : "Tự gửi đơn mới về hệ thống"}</span>
            </div>
            <div className={"switch" + (auto ? " on" : "")} onClick={() => connected && setAuto(!auto)}><div className="kn" /></div>
          </div>

          {/* stats */}
          <div className="ext-stats">
            <div className="ext-stat"><b className="tnum">{today}</b><span>Đã thu hôm nay</span></div>
            <div className="ext-stat"><b className="tnum" style={{ color: "var(--accent-ink)" }}>{session}</b><span>Phiên hiện tại</span></div>
          </div>

          {/* current page */}
          <div className="ext-page-card">
            <div className="ext-pc-top">
              <span className="ext-pc-plat"><span className="pd" style={{ background: "#ff7a45" }} />Taobao · trang đơn hàng</span>
              <span className="ext-pc-detected">Phát hiện <b>{detected}</b> đơn</span>
            </div>
            <div className="ext-progress"><div className="ext-progress-fill" style={{ width: progress + "%" }} /></div>
            <button className="ext-btn" onClick={collectPage} disabled={collecting || !connected || detected === 0}>
              {!connected ? <><Icon name="power" size={16} />Cần kết nối API</> :
                collecting ? <><Icon name="refresh" size={16} />Đang thu thập… {Math.round(progress)}%</> :
                detected === 0 ? <><Icon name="check" size={16} />Đã thu trang này</> :
                <><Icon name="download" size={16} />Thu thập {detected} đơn trên trang</>}
            </button>
          </div>

          {/* log */}
          <div>
            <div className="ext-sec-label" style={{ marginBottom: 8 }}>Hoạt động gần đây {session > 0 && <span style={{ marginLeft: "auto", color: "var(--st-green)", textTransform: "none", letterSpacing: 0, fontWeight: 600 }}>+{session} phiên này</span>}</div>
            <div className="ext-log">
              {log.length === 0 ? <div className="ext-empty">Chưa thu thập đơn nào.</div> :
                log.map((it, i) => (
                  <div className="ext-log-item" key={it.id + "-" + i}>
                    <span className="li-ic"><Icon name="check" size={13} stroke={2.4} /></span>
                    <span><span className="li-id">#{it.id}</span> <span style={{ color: "var(--muted)" }}>· {it.name}</span></span>
                    <span className="li-t">{it.t}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* settings */}
        <div className="ext-settings">
          <button className={"ext-set-toggle" + (showSet ? " open" : "")} onClick={() => setShowSet(!showSet)}>
            <Icon name="settings" size={16} />Cấu hình API<Icon name="chevDown" size={15} className="chev" />
          </button>
          {showSet && (
            <div className="ext-set-body">
              <div className="ext-field"><label>API Endpoint</label><input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} /></div>
              <div className="ext-field"><label>Access Token</label><input value={token} onChange={(e) => setToken(e.target.value)} /></div>
              <div className="ext-save-row">
                <button className="ext-btn ghost" style={{ width: "auto", padding: "8px 16px" }} onClick={save}><Icon name="check" size={15} />Lưu cấu hình</button>
                {saved && <span className="ext-saved"><Icon name="check" size={14} stroke={2.4} />Đã lưu</span>}
              </div>
            </div>
          )}
        </div>

        <div className="ext-foot">
          <a href="index.html" target="_blank" rel="noopener"><Icon name="external" size={15} />Mở Dashboard</a>
          <span className="ver">v1.0.0 · MV3</span>
        </div>
      </div>

      <div className="ext-caption">Tiện ích Chrome (Manifest V3) — bấm vào trạng thái, công tắc và nút để thử</div>
    </div>
  );
}

export default ExtApp;
