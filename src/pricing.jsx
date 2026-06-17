/* ============================================================
   GomĐơn — Máy tính giá bán & lợi nhuận (bán lẻ)
   Nhập giá vốn + chi phí phát sinh → bảng quét mức lời
   (markup trên vốn & biên lãi trên giá bán), làm tròn, cảnh báo lỗ.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN"));
const ROUND_OPTS = [{ v: 0, l: "Không" }, { v: 1000, l: "1.000₫" }, { v: 5000, l: "5.000₫" }];

export function Pricing({ onToast }) {
  const [unitCost, setUnitCost] = React.useState(185000);
  const [roundTo, setRoundTo] = React.useState(1000);
  const [costTypes, setCostTypes] = React.useState([]);
  const [picked, setPicked] = React.useState({});   // { [costTypeId]: amount }
  const [products, setProducts] = React.useState([]);
  const [result, setResult] = React.useState(null);
  const [manualPrice, setManualPrice] = React.useState("");

  // nạp danh mục chi phí + sản phẩm (để chọn nhanh giá vốn)
  React.useEffect(() => {
    api.retail.costTypes({ activeOnly: true }).then((d) => setCostTypes(d || [])).catch(() => {});
    api.retail.products({ status: "active" }).then((d) => setProducts(d || [])).catch(() => {});
  }, []);

  // gọi tính giá khi input đổi (debounce nhẹ)
  React.useEffect(() => {
    const costs = costTypes
      .filter((c) => picked[c.id] != null && picked[c.id] !== "")
      .map((c) => ({ name: c.name, amount: Math.max(0, Math.round(Number(picked[c.id]) || 0)), unit: c.unit }));
    const body = { unitCost: Math.max(0, Math.round(Number(unitCost) || 0)), costs, roundTo };
    const id = setTimeout(() => {
      api.retail.calcPrice(body).then(setResult).catch((e) => onToast && onToast("Lỗi tính giá: " + e.message));
    }, 200);
    return () => clearTimeout(id);
  }, [unitCost, roundTo, picked, costTypes, onToast]);

  const toggleCost = (c) => setPicked((p) => {
    const next = { ...p };
    if (next[c.id] != null) delete next[c.id];
    else next[c.id] = c.defaultAmount ?? 0;
    return next;
  });
  const setCostAmt = (id, v) => setPicked((p) => ({ ...p, [id]: v }));

  const pickProduct = (e) => {
    const p = products.find((x) => String(x.id) === e.target.value);
    if (p) setUnitCost(p.avgCost);
  };

  const costBase = result?.costBase ?? 0;
  const manualNum = manualPrice === "" ? null : Math.round(Number(manualPrice) || 0);
  const isLoss = manualNum != null && manualNum < costBase;

  return (
    <div className="fade-in" style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 18, alignItems: "start" }}>
      {/* LEFT: inputs */}
      <div>
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Giá vốn</h3>
          <label className="field"><span>Chọn nhanh từ sản phẩm (tùy chọn)</span>
            <div className="input"><Icon name="box" size={16} />
              <select onChange={pickProduct} defaultValue="" style={{ border: "none", background: "transparent", color: "inherit", width: "100%", outline: "none" }}>
                <option value="">— Nhập tay —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
              </select></div></label>
          <label className="field"><span>Giá vốn / sản phẩm (₫)</span>
            <div className="input"><Icon name="coins" size={16} /><input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></div></label>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 13, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Chi phí phát sinh</h3>
          {costTypes.length === 0 && <div className="cell-sub" style={{ marginBottom: 8 }}>Chưa có loại chi phí. Thêm ở trang Kho (hoặc qua API).</div>}
          {costTypes.map((c) => {
            const on = picked[c.id] != null;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => toggleCost(c)} style={{ minWidth: 34, justifyContent: "center" }}>
                  <Icon name={on ? "check" : "plus"} size={15} />
                </button>
                <span style={{ flex: 1, color: on ? "var(--ink-2)" : "var(--faint)" }}>{c.name}{c.unit === "percent" ? " (%)" : ""}</span>
                <input type="number" min="0" disabled={!on} value={on ? picked[c.id] : ""} onChange={(e) => setCostAmt(c.id, e.target.value)}
                  className="mono" style={{ width: 90, textAlign: "right", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px 8px", color: "inherit" }} />
              </div>
            );
          })}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTop: "1px dashed var(--line-2)" }}>
            <span className="cell-sub">Tổng vốn (vốn + chi phí)</span>
            <b className="mono" style={{ fontSize: 18 }}>{fmt(costBase)}₫</b>
          </div>
          <div style={{ marginTop: 14 }}>
            <span className="cell-sub" style={{ display: "block", marginBottom: 6 }}>Làm tròn giá đẹp</span>
            <div className="chips">
              {ROUND_OPTS.map((o) => (
                <button key={o.v} className={"chip" + (roundTo === o.v ? " active" : "")} onClick={() => setRoundTo(o.v)}>{o.l}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: scan table */}
      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 13, color: "var(--faint)", textTransform: "uppercase", letterSpacing: ".06em" }}>Bảng quét mức lời</h3>
        <div className="grid-wrap"><table className="dg">
          <thead><tr>
            <th>Mức lời</th>
            <th style={{ textAlign: "right" }}>Markup → giá bán</th>
            <th style={{ textAlign: "right" }}>Lời</th>
            <th style={{ textAlign: "right" }}>Biên lãi → giá bán</th>
            <th style={{ textAlign: "right" }}>Lời</th>
          </tr></thead>
          <tbody>
            {(result?.levelsResult || []).map((l) => (
              <tr key={l.pct}>
                <td><span className="chip" style={{ pointerEvents: "none" }}>{l.pct}%</span></td>
                <td className="mono" style={{ textAlign: "right" }}>{fmt(l.priceMarkup)}</td>
                <td className="mono" style={{ textAlign: "right", color: "var(--pos)" }}>+{fmt(l.profitMarkup)}</td>
                <td className="mono" style={{ textAlign: "right", color: l.priceMargin == null ? "var(--faint)" : "inherit" }}>{l.priceMargin == null ? "—" : fmt(l.priceMargin)}</td>
                <td className="mono" style={{ textAlign: "right", color: l.profitMargin == null ? "var(--faint)" : "var(--pos)" }}>{l.profitMargin == null ? "—" : "+" + fmt(l.profitMargin)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
          <span className="cell-sub" style={{ display: "block", marginBottom: 6 }}>Kiểm tra giá bán tay (cảnh báo lỗ)</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="input" style={{ maxWidth: 200 }}><Icon name="wallet" size={16} />
              <input type="number" min="0" placeholder="Nhập giá bán…" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} /></div>
            {manualNum != null && (
              isLoss
                ? <span className="badge red"><span className="dot" /> Lỗ {fmt(costBase - manualNum)}₫</span>
                : <span className="badge green"><span className="dot" /> Lời {fmt(manualNum - costBase)}₫</span>
            )}
          </div>
          <div className="cell-sub" style={{ marginTop: 10, fontSize: 11.5 }}>
            Markup = vốn×(1+x). Biên lãi = vốn÷(1−x). Chi phí “%” tính theo % của giá vốn.
          </div>
        </div>
      </div>
    </div>
  );
}

export default Pricing;
