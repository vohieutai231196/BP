/* ============================================================
   GomĐơn — Báo cáo bán lẻ: lời theo kênh & theo SKU.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

export function Reports({ onToast }) {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState(null);

  React.useEffect(() => {
    api.retail.reports().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>;
  if (!data) return <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>;

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 16px", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>Lợi nhuận theo kênh</div>
        <div className="grid-wrap"><table className="dg">
          <thead><tr><th>Kênh</th><th style={{ textAlign: "right" }}>Số đơn</th><th style={{ textAlign: "right" }}>Doanh thu</th><th style={{ textAlign: "right" }}>Lợi nhuận</th></tr></thead>
          <tbody>
            {data.byChannel.length === 0 ? <tr><td colSpan={4} className="cell-sub" style={{ textAlign: "center", padding: 20 }}>Chưa có dữ liệu</td></tr>
              : data.byChannel.map((c, i) => (
                <tr key={i}>
                  <td>{c.channel}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{c.salesCount}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmt(c.revenue)}₫</td>
                  <td className="mono" style={{ textAlign: "right", color: c.profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{(c.profit >= 0 ? "+" : "") + fmt(c.profit)}₫</td>
                </tr>
              ))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <div style={{ padding: "14px 16px", fontWeight: 600, borderBottom: "1px solid var(--line)" }}>Lời theo sản phẩm (gộp đơn) <span className="cell-sub" style={{ fontWeight: 400 }}>— margin = Σ SL×(giá bán − vốn)</span></div>
        <div className="grid-wrap"><table className="dg">
          <thead><tr><th>Sản phẩm</th><th style={{ textAlign: "right" }}>Đã bán</th><th style={{ textAlign: "right" }}>Doanh thu</th><th style={{ textAlign: "right" }}>Lời (margin)</th></tr></thead>
          <tbody>
            {data.bySku.length === 0 ? <tr><td colSpan={4} className="cell-sub" style={{ textAlign: "center", padding: 20 }}>Chưa có dữ liệu</td></tr>
              : data.bySku.map((s) => (
                <tr key={s.productId}>
                  <td><div className="pn">{s.name}</div><div className="pm mono">{s.sku}</div></td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmt(s.qtySold)}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{fmt(s.revenue)}₫</td>
                  <td className="mono" style={{ textAlign: "right", color: s.margin >= 0 ? "var(--pos)" : "var(--neg)" }}>{(s.margin >= 0 ? "+" : "") + fmt(s.margin)}₫</td>
                </tr>
              ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

export default Reports;
