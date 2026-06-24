/* ============================================================
   GomĐơn — Máy tính giá bán & lợi nhuận (bán lẻ)
   Nhập giá vốn + chi phí phát sinh → bảng quét mức lời
   (markup trên vốn & biên lãi trên giá bán), làm tròn, cảnh báo lỗ.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { MoneyInput, costUnitPrice, resolveCostAmount } from "./components.jsx";
import { Select } from "./ui-controls.jsx";
import { useRefresh } from "./refresh.js";

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
  const [level, setLevel] = React.useState(30);   // mức lời mục tiêu (thanh kéo)
  const { version } = useRefresh();

  // nạp danh mục chi phí + sản phẩm (để chọn nhanh giá vốn)
  React.useEffect(() => {
    api.retail.costTypes({ activeOnly: true }).then((d) => setCostTypes(d || [])).catch(() => {});
    api.retail.products({ status: "active" }).then((d) => setProducts(d || [])).catch(() => {});
  }, [version]);

  // gọi tính giá khi input đổi (debounce nhẹ)
  React.useEffect(() => {
    const costs = costTypes
      .filter((c) => picked[c.id] != null && picked[c.id] !== "")
      .map((c) => (c.unit === "pack"
        ? { name: c.name, amount: Math.max(0, resolveCostAmount(c, picked[c.id], unitCost)), unit: "vnd" }
        : { name: c.name, amount: Math.max(0, Math.round(Number(picked[c.id]) || 0)), unit: c.unit }));
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

  const pickProduct = (id) => {
    const p = products.find((x) => String(x.id) === id);
    if (!p) return;
    setUnitCost(p.avgCost);
    // auto-điền phụ phí mặc định của SKU (tick + fill số tiền)
    api.retail.productCostTypes(p.id)
      .then((rows) => {
        const next = {};
        (rows || []).forEach((r) => { next[r.costTypeId] = r.amount; });
        setPicked(next);
      })
      .catch(() => {});
  };

  const costBase = result?.costBase ?? 0;
  const manualNum = manualPrice === "" ? null : Math.round(Number(manualPrice) || 0);
  const isLoss = manualNum != null && manualNum < costBase;

  // hero theo mức lời đang chọn (tính client-side, làm tròn khớp backend)
  const roundPretty = (v) => (roundTo <= 0 ? v : Math.ceil(v / roundTo) * roundTo);
  const heroMarkup = costBase > 0 ? roundPretty(Math.round(costBase * (1 + level / 100))) : 0;
  const heroMarkupProfit = heroMarkup - costBase;
  const heroMargin = level < 100 && costBase > 0 ? roundPretty(Math.round(costBase / (1 - level / 100))) : null;
  const heroMarginProfit = heroMargin == null ? null : heroMargin - costBase;

  return (
    <div className="fade-in retail-2col">
      {/* LEFT: inputs */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="card">
          <div className="card-head"><Icon name="coins" size={18} style={{ color: "var(--muted)" }} /><h3>Giá vốn</h3></div>
          <div className="card-pad" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="field"><span>Chọn nhanh từ sản phẩm (tùy chọn)</span>
              <Select icon="box" value="" onChange={pickProduct} placeholder="— Nhập tay —"
                options={products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))} />
            </label>
            <label className="field"><span>Giá vốn / sản phẩm (₫)</span>
              <div className="input"><Icon name="coins" size={16} /><MoneyInput value={unitCost} onChange={setUnitCost} /></div></label>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><Icon name="wallet" size={18} style={{ color: "var(--muted)" }} /><h3>Chi phí phát sinh</h3></div>
          <div className="card-pad">
            {costTypes.length === 0 && <div className="cell-sub" style={{ marginBottom: 8 }}>Chưa có loại chi phí. Thêm ở mục “Phụ phí” (sidebar Bán lẻ).</div>}
            {costTypes.map((c) => {
              const on = picked[c.id] != null;
              return (
                <div key={c.id} className={"cost-line" + (on ? "" : " off")}>
                  <button type="button" className={"cost-chk" + (on ? " on" : "")} onClick={() => toggleCost(c)}>
                    <Icon name={on ? "check" : "plus"} size={15} />
                  </button>
                  <span className="nm">{c.name}{c.unit === "percent" ? " (%)" : c.unit === "pack" ? " (lô)" : ""}</span>
                  {c.unit === "pack" ? (
                    <>
                      <input type="number" min="0" inputMode="numeric" disabled={!on}
                        value={on ? picked[c.id] : ""} onChange={(e) => setCostAmt(c.id, e.target.value)}
                        className="num-inp" style={{ width: 60 }} />
                      <span className="cell-sub" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                        × {fmt(costUnitPrice(c))}₫ = {fmt(costUnitPrice(c) * (Number(on ? picked[c.id] : 0) || 0))}₫
                      </span>
                    </>
                  ) : (
                    <MoneyInput disabled={!on} value={on ? picked[c.id] : ""} onChange={(v) => setCostAmt(c.id, v)}
                      className="num-inp" style={{ width: 90 }} />
                  )}
                </div>
              );
            })}
            <div className="fee-total" style={{ marginTop: 16 }}>
              <span className="ft-l">Tổng vốn (vốn + chi phí)</span>
              <span className="ft-v">{fmt(costBase)}₫</span>
            </div>
            <div style={{ marginTop: 16 }}>
              <span className="cell-sub" style={{ display: "block", marginBottom: 8 }}>Làm tròn giá đẹp</span>
              <div className="chips">
                {ROUND_OPTS.map((o) => (
                  <button key={o.v} className={"chip" + (roundTo === o.v ? " active" : "")} onClick={() => setRoundTo(o.v)}>{o.l}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: scan table */}
      <div className="card">
        <div className="card-head"><Icon name="coins" size={18} style={{ color: "var(--muted)" }} /><h3>Mức lời mục tiêu</h3><span className="topbar-spacer" /><span className="tag-soft mono">+{level}%</span></div>
        <div className="card-pad">
          {/* thanh kéo mức lời */}
          <input className="range" type="range" min="10" max="100" step="5" value={level} onChange={(e) => setLevel(Number(e.target.value))} />
          <div className="range-ticks"><span>10%</span><span>30%</span><span>50%</span><span>70%</span><span>100%</span></div>

          {/* 2 ô hero */}
          <div className="hero-2">
            <div className="hero-box pick">
              <div className="hl">Giá bán (markup +{level}%) <b>★ chọn</b></div>
              <div className="hv">{fmt(heroMarkup)}₫</div>
              <div className="hp">Lời <b>+{fmt(heroMarkupProfit)}₫</b> / sp</div>
            </div>
            <div className="hero-box">
              <div className="hl">Giá bán (biên lãi {level}%)</div>
              <div className="hv">{heroMargin == null ? "—" : fmt(heroMargin) + "₫"}</div>
              <div className="hp">{heroMargin == null ? "không xác định ở 100%" : <>Lời <b>+{fmt(heroMarginProfit)}₫</b> / sp</>}</div>
            </div>
          </div>

          <span className="cell-sub" style={{ display: "block", margin: "4px 0 8px" }}>Quét nhiều mức lời</span>
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
                <tr key={l.pct} className={"norow" + (l.pct === level ? " hl" : "")}>
                  <td><span className="chip" style={{ pointerEvents: "none" }}>{l.pct}%</span></td>
                  <td className="cell-money">{fmt(l.priceMarkup)}</td>
                  <td className="cell-money pos">+{fmt(l.profitMarkup)}</td>
                  <td className="cell-money" style={{ color: l.priceMargin == null ? "var(--faint)" : "inherit" }}>{l.priceMargin == null ? "—" : fmt(l.priceMargin)}</td>
                  <td className={"cell-money" + (l.profitMargin == null ? "" : " pos")} style={l.profitMargin == null ? { color: "var(--faint)" } : undefined}>{l.profitMargin == null ? "—" : "+" + fmt(l.profitMargin)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <span className="cell-sub" style={{ display: "block", marginBottom: 8 }}>Kiểm tra giá bán tay (cảnh báo lỗ)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="input" style={{ width: 220, flex: "none" }}><Icon name="wallet" size={16} />
                <MoneyInput placeholder="Nhập giá bán…" value={manualPrice} onChange={setManualPrice} /></div>
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
    </div>
  );
}

export default Pricing;
