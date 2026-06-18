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
        <div className="card-head"><Icon name="globe" size={18} style={{ color: "var(--muted)" }} /><h3>Lợi nhuận theo kênh</h3></div>
        <div className="grid-wrap"><table className="dg">
          <thead><tr><th>Kênh</th><th style={{ textAlign: "right" }}>Số đơn</th><th style={{ textAlign: "right" }}>Doanh thu</th><th style={{ textAlign: "right" }}>Lợi nhuận</th></tr></thead>
          <tbody>
            {data.byChannel.length === 0 ? <tr><td colSpan={4} className="cell-sub" style={{ textAlign: "center", padding: 20 }}>Chưa có dữ liệu</td></tr>
              : data.byChannel.map((c, i) => (
                <tr key={i}>
                  <td>{c.channel}</td>
                  <td className="cell-money">{c.salesCount}</td>
                  <td className="cell-money">{fmt(c.revenue)}₫</td>
                  <td className={"cell-money " + (c.profit >= 0 ? "pos" : "neg")}>{(c.profit >= 0 ? "+" : "") + fmt(c.profit)}₫</td>
                </tr>
              ))}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <div className="card-head"><Icon name="box" size={18} style={{ color: "var(--muted)" }} /><h3>Lời theo sản phẩm (gộp đơn)</h3><span className="topbar-spacer" /><span className="sub">margin = Σ SL×(giá bán − vốn)</span></div>
        <div className="grid-wrap"><table className="dg">
          <thead><tr><th>Sản phẩm</th><th style={{ textAlign: "right" }}>Đã bán</th><th style={{ textAlign: "right" }}>Doanh thu</th><th style={{ textAlign: "right" }}>Lời (margin)</th></tr></thead>
          <tbody>
            {data.bySku.length === 0 ? <tr><td colSpan={4} className="cell-sub" style={{ textAlign: "center", padding: 20 }}>Chưa có dữ liệu</td></tr>
              : data.bySku.map((s) => (
                <tr key={s.productId}>
                  <td><div className="pn">{s.name}</div><div className="pm mono">{s.sku}</div></td>
                  <td className="cell-money">{fmt(s.qtySold)}</td>
                  <td className="cell-money">{fmt(s.revenue)}₫</td>
                  <td className={"cell-money " + (s.margin >= 0 ? "pos" : "neg")}>{(s.margin >= 0 ? "+" : "") + fmt(s.margin)}₫</td>
                </tr>
              ))}
          </tbody>
        </table></div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><Icon name="tag" size={18} style={{ color: "var(--muted)" }} /><h3>Lời theo đợt khuyến mãi</h3></div>
        <div className="grid-wrap"><table className="dg">
          <thead><tr><th>Đợt KM</th><th style={{ textAlign: "right" }}>SL bán</th><th style={{ textAlign: "right" }}>Doanh thu</th><th style={{ textAlign: "right" }}>Lời (margin)</th></tr></thead>
          <tbody>
            {(!data.byPromotion || data.byPromotion.length === 0) ? <tr><td colSpan={4} className="cell-sub" style={{ textAlign: "center", padding: 20 }}>Chưa có dữ liệu</td></tr>
              : data.byPromotion.map((p) => (
                <tr key={p.promotionId}>
                  <td>{p.name}</td>
                  <td className="cell-money">{fmt(p.qtySold)}</td>
                  <td className="cell-money">{fmt(p.revenue)}₫</td>
                  <td className={"cell-money " + (p.margin >= 0 ? "pos" : "neg")}>{(p.margin >= 0 ? "+" : "") + fmt(p.margin)}₫</td>
                </tr>
              ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

export default Reports;
