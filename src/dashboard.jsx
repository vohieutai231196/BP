/* ============================================================
   GomĐơn — Dashboard (Tổng quan)
   Nhận `summary` (dashboard API) + `recent` (đơn gần đây) đã adapt.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import DATA from "./data.js";
import { StatusBadge, ProductThumb, PlatformTag } from "./components.jsx";

const { STATUS, fmt: f } = DATA;
const COLOR_VAR = {
  green: "var(--st-green)", amber: "var(--st-amber)", blue: "var(--st-blue)",
  violet: "var(--st-violet)", red: "var(--st-red)", slate: "var(--st-slate)",
};

function Donut({ segments, size = 160 }) {
  const r = 56, c = 2 * Math.PI * r, total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let off = 0;
  return (
    <svg className="donut" viewBox="0 0 160 160" width={size} height={size}>
      <circle cx="80" cy="80" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="18" />
      {segments.map((s, i) => {
        const len = (s.value / total) * c;
        const el = <circle key={i} cx="80" cy="80" r={r} fill="none" stroke={s.color} strokeWidth="18"
          strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-off} strokeLinecap="butt"
          transform="rotate(-90 80 80)" style={{ transition: "stroke-dasharray .6s ease" }} />;
        off += len; return el;
      })}
      <text x="80" y="74" textAnchor="middle" fontSize="13" fill="var(--faint)" fontFamily="var(--font-mono)">Tổng đơn</text>
      <text x="80" y="98" textAnchor="middle" fontSize="26" fontWeight="800" fill="var(--ink)">{total}</text>
    </svg>
  );
}

export function Dashboard({ summary, recent, onOpen, onNav }) {
  const series = summary.series || [];
  const maxCount = Math.max(1, ...series.map((s) => s.count));
  const segs = Object.values(STATUS)
    .map((s) => ({ label: s.label, value: summary.statusCounts[s.key] || 0, color: COLOR_VAR[s.color] }))
    .filter((s) => s.value > 0);
  const platformAgg = summary.platformAgg || [];
  const warehouseAgg = summary.warehouseAgg || [];
  const maxPlat = Math.max(1, ...platformAgg.map((p) => p.count));

  // Chú thích phụ là số liệu THẬT dẫn xuất từ summary (không phải % xu hướng giả).
  const pctCollected = summary.totalRevenue ? Math.round(summary.totalCollected / summary.totalRevenue * 100) : 0;
  const avgPerOrder = summary.totalOrders ? Math.round(summary.totalRevenue / summary.totalOrders) : 0;
  const kpis = [
    { label: "Tổng đơn hàng", val: summary.totalOrders, note: Math.round(summary.totalWeight || 0).toLocaleString("vi-VN") + " kg hàng", icon: "box", color: "var(--st-blue)", bg: "var(--st-blue-bg)" },
    { label: "Tổng giá trị đơn", val: f.fmtVNDplain(summary.totalRevenue), suffix: "₫", note: "TB " + f.fmtVNDplain(avgPerOrder) + "₫/đơn", icon: "coins", color: "var(--st-green)", bg: "var(--st-green-bg)" },
    { label: "Đã thu", val: f.fmtVNDplain(summary.totalCollected), suffix: "₫", note: pctCollected + "% giá trị đơn", icon: "wallet", color: "var(--st-violet)", bg: "var(--st-violet-bg)" },
    { label: "Còn phải thu", val: f.fmtVNDplain(summary.totalOutstanding), suffix: "₫", note: summary.outstandingOrders + " đơn chưa đủ", icon: "clock", color: "var(--st-amber)", bg: "var(--st-amber-bg)" },
  ];

  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs — manifest summary band */}
      <div className="kpi-grid">
        {kpis.map((k) => (
          <div className="card kpi" key={k.label} style={{ "--kc": k.color }}>
            <div className="kpi-label"><Icon name={k.icon} size={14} stroke={2} /> {k.label}</div>
            <div className="kpi-val">{k.val}{k.suffix && <small>{k.suffix}</small>}</div>
            <div className="kpi-note">{k.note}</div>
          </div>
        ))}
      </div>

      {/* row: bar chart + donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }} className="dash-row">
        <div className="card">
          <div className="card-head"><Icon name="chart" size={18} style={{ color: "var(--muted)" }} /><h3>Đơn mới 14 ngày qua</h3><span className="topbar-spacer" /><span className="tag-soft">Trung bình {Math.round(series.reduce((s, x) => s + x.count, 0) / (series.length || 1))} đơn/ngày</span></div>
          <div className="card-pad">
            <div className="bars">
              {series.map((s, i) => (
                <div className="bar-col" key={i} title={`${s.label}: ${s.count} đơn`}>
                  <div className="bar" style={{ height: (s.count / maxCount * 100) + "%", "--i": i }} />
                  <span className="bar-x">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><Icon name="dashboard" size={18} style={{ color: "var(--muted)" }} /><h3>Trạng thái đơn</h3></div>
          <div className="card-pad">
            <div className="donut-wrap">
              <Donut segments={segs} size={148} />
              <div className="legend" style={{ flexDirection: "column", gap: 9, flex: 1, minWidth: 0 }}>
                {segs.map((s) => (
                  <div className="legend-item" key={s.label}><span className="ld" style={{ background: s.color }} />{s.label}<b>{s.value}</b></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* row: platforms + recent */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16 }} className="dash-row">
        <div className="card">
          <div className="card-head"><Icon name="globe" size={18} style={{ color: "var(--muted)" }} /><h3>Theo sàn nguồn</h3></div>
          <div className="card-pad" style={{ paddingTop: 10, paddingBottom: 14 }}>
            {platformAgg.map((p) => (
              <div className="hbar-row" key={p.key}>
                <span className="nm"><span className="pd" style={{ background: p.tint, display: "inline-block", width: 8, height: 8, borderRadius: 3, marginRight: 8 }} />{p.label}</span>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: (p.count / maxPlat * 100) + "%", background: p.tint }} /></div>
                <span className="ct">{p.count}</span>
              </div>
            ))}
            <div className="divider" style={{ margin: "12px 0" }} />
            {warehouseAgg.map((w) => (
              <div className="hbar-row" key={w.name}>
                <span className="nm"><Icon name="warehouse" size={13} style={{ color: "var(--faint)", marginRight: 7, verticalAlign: "-2px" }} />{w.name}</span>
                <div className="hbar-track"><div className="hbar-fill" style={{ width: (w.count / (summary.totalOrders || 1) * 100) + "%", background: "var(--accent)" }} /></div>
                <span className="ct">{w.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><Icon name="clock" size={18} style={{ color: "var(--muted)" }} /><h3>Đơn gần đây</h3><span className="topbar-spacer" /><button className="btn btn-ghost btn-sm" onClick={() => onNav("orders")}>Xem tất cả <Icon name="chevRight" size={15} /></button></div>
          <div>
            {(recent || []).map((o) => (
              <div className="orow" key={o.id} style={{ gridTemplateColumns: "44px 1.5fr 1fr auto", padding: "13px 22px" }} onClick={() => onOpen(o.id)}>
                <ProductThumb order={o} />
                <div className="o-main"><b>{o.productName}</b><div className="o-meta"><span className="mono" style={{ color: "var(--accent-ink)" }}>#{o.id}</span><PlatformTag platform={o.platform} /></div></div>
                <div className="o-hideS"><StatusBadge status={o.status} size="sm" /></div>
                <div className="cell-money">{f.fmtVND(o.costs.tongChiPhi)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
