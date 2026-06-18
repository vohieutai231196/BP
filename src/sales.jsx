/* ============================================================
   GomĐơn — Đơn bán (bán lẻ)
   Danh sách đơn + tạo đơn (chọn SP, số lượng, chi phí) → lợi nhuận thực.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN") + "₫");
const fmtDate = (d) => { try { return new Date(d).toLocaleString("vi-VN"); } catch { return "—"; } };

export function Sales({ onToast }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    let alive = true; setLoading(true); setErr(null);
    api.retail.sales().then((d) => { if (alive) setList(d || []); })
      .catch((e) => { if (alive) setErr(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const refresh = () => setReload((r) => r + 1);

  return (
    <div className="fade-in">
      <div className="toolbar">
        <div style={{ fontWeight: 600 }}>Đơn bán</div>
        <span className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} /> Tạo đơn bán
        </button>
      </div>

      {loading ? (
        <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>
      ) : err ? (
        <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>
      ) : list.length === 0 ? (
        <div className="card empty"><Icon name="wallet" size={40} /><div>Chưa có đơn bán. Bấm “Tạo đơn bán”.</div></div>
      ) : (
        <div className="card"><div className="grid-wrap"><table className="dg">
          <thead><tr>
            <th>Mã đơn</th><th>Khách</th><th>Kênh</th>
            <th style={{ textAlign: "right" }}>Doanh thu</th>
            <th style={{ textAlign: "right" }}>Lợi nhuận</th>
            <th>Thời gian</th>
          </tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.code}</td>
                <td>{s.customerName || "—"}</td>
                <td className="cell-sub">{s.channel || "—"}</td>
                <td className="mono" style={{ textAlign: "right" }}>{fmt(s.revenue)}</td>
                <td className="mono" style={{ textAlign: "right", color: s.profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{(s.profit >= 0 ? "+" : "") + fmt(s.profit)}</td>
                <td className="cell-sub">{fmtDate(s.soldAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}

      {creating && <CreateSaleModal onClose={() => setCreating(false)}
        onDone={(msg) => { onToast && onToast(msg); setCreating(false); refresh(); }} onToast={onToast} />}
    </div>
  );
}

function CreateSaleModal({ onClose, onDone, onToast }) {
  const [products, setProducts] = React.useState([]);
  const [costTypes, setCostTypes] = React.useState([]);
  const [items, setItems] = React.useState([]); // {productId, qty, unitPrice}
  const [picked, setPicked] = React.useState({}); // costTypeId -> amount
  const [info, setInfo] = React.useState({ customerName: "", channel: "" });
  const [busy, setBusy] = React.useState(false);

  const [promos, setPromos] = React.useState({}); // productId -> {price, name}

  React.useEffect(() => {
    api.retail.products({ status: "active" }).then((d) => setProducts(d || [])).catch(() => {});
    api.retail.costTypes({ activeOnly: true }).then((d) => setCostTypes(d || [])).catch(() => {});
  }, []);

  React.useEffect(() => {
    api.retail.activePromotions().then((d) => {
      const m = {}; (d || []).forEach((x) => { m[x.productId] = x; }); setPromos(m);
    }).catch(() => {});
  }, []);

  const [combos, setCombos] = React.useState([]);
  const [comboLines, setComboLines] = React.useState([]); // {comboId, name, price, qty, available}
  React.useEffect(() => { api.retail.combos().then((d) => setCombos((d || []).filter((c) => c.active))).catch(() => {}); }, []);
  const addCombo = (c) => setComboLines((xs) => xs.some((x) => x.comboId === c.id) ? xs
    : [...xs, { comboId: c.id, name: c.name, price: c.price, qty: 1, available: c.availableQty }]);
  const setComboQty = (id, v) => setComboLines((xs) => xs.map((x) => x.comboId === id ? { ...x, qty: v } : x));
  const removeCombo = (id) => setComboLines((xs) => xs.filter((x) => x.comboId !== id));

  const addItem = (p, lineType = "ban") => setItems((xs) => xs.some((x) => x.productId === p.id && x.lineType === lineType) ? xs
    : [...xs, {
        productId: p.id, sku: p.sku, name: p.name, stock: p.stock, avgCost: p.avgCost, qty: 1, lineType,
        unitPrice: lineType === "tang" ? 0 : (promos[p.id]?.price ?? p.listPrice ?? p.avgCost),
        promoName: lineType === "ban" ? (promos[p.id]?.name || null) : null,
        promoId: lineType === "ban" ? (promos[p.id]?.promotionId ?? null) : null,
      }]);
  const setItem2 = (it, k, v) => setItems((xs) => xs.map((x) => (x.productId === it.productId && x.lineType === it.lineType) ? { ...x, [k]: v } : x));
  const removeItem2 = (it) => setItems((xs) => xs.filter((x) => !(x.productId === it.productId && x.lineType === it.lineType)));

  const comboRevenue = comboLines.reduce((a, x) => a + (Number(x.qty) || 0) * (Number(x.price) || 0), 0);
  const revenue = items.reduce((a, x) => a + (Number(x.qty) || 0) * (Number(x.unitPrice) || 0), 0) + comboRevenue;
  const cogs = items.filter((x) => x.lineType !== "tang").reduce((a, x) => a + (Number(x.qty) || 0) * (Number(x.avgCost) || 0), 0);
  const promoCost = items.filter((x) => x.lineType === "tang").reduce((a, x) => a + (Number(x.qty) || 0) * (Number(x.avgCost) || 0), 0);
  const extra = costTypes.filter((c) => picked[c.id] != null && picked[c.id] !== "")
    .reduce((a, c) => a + (c.unit === "percent" ? Math.round(revenue * (Number(picked[c.id]) || 0) / 100) : (Number(picked[c.id]) || 0)), 0);
  const profit = revenue - cogs - promoCost - extra;

  const overStock = items.find((x) => (Number(x.qty) || 0) > x.stock);

  const submit = async () => {
    if (items.length === 0 && comboLines.length === 0) { onToast && onToast("Chọn ít nhất 1 sản phẩm."); return; }
    if (overStock) { onToast && onToast(`Vượt tồn: ${overStock.sku} còn ${overStock.stock}.`); return; }
    setBusy(true);
    const body = {
      customerName: info.customerName || null, channel: info.channel || null,
      items: items.map((x) => ({ productId: x.productId, qty: Math.max(1, Math.round(Number(x.qty) || 0)), unitPrice: Math.max(0, Math.round(Number(x.unitPrice) || 0)), lineType: x.lineType, promoId: x.promoId ?? null })),
      combos: comboLines.map((x) => ({ comboId: x.comboId, qty: Math.max(1, Math.round(Number(x.qty) || 0)) })),
      costs: costTypes.filter((c) => picked[c.id] != null && picked[c.id] !== "")
        .map((c) => ({ costTypeId: c.id, name: c.name, amount: Math.max(0, Math.round(Number(picked[c.id]) || 0)), unit: c.unit })),
    };
    try { await api.retail.createSale(body); onDone("Đã tạo đơn bán"); }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
    finally { setBusy(false); }
  };

  const toggleCost = (c) => setPicked((p) => { const n = { ...p }; if (n[c.id] != null) delete n[c.id]; else n[c.id] = c.defaultAmount ?? 0; return n; });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "92%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="plus" size={18} /></div><div><h3>Tạo đơn bán</h3></div></div>
        <div className="modal-body">
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: 1 }}><span>Thêm sản phẩm</span>
              <div className="input"><Icon name="search" size={16} />
                <select id="sale-prod-pick" defaultValue="" style={{ border: "none", background: "transparent", color: "inherit", width: "100%", outline: "none" }}>
                  <option value="">— Chọn SKU —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name} (tồn {p.stock})</option>)}
                </select></div></label>
            <button className="btn btn-sm" onClick={() => { const el = document.getElementById("sale-prod-pick"); const p = products.find((x) => String(x.id) === el.value); if (p) addItem(p, "ban"); el.value = ""; }}>+ Bán</button>
            <button className="btn btn-sm" onClick={() => { const el = document.getElementById("sale-prod-pick"); const p = products.find((x) => String(x.id) === el.value); if (p) addItem(p, "tang"); el.value = ""; }}>🎁 Tặng</button>
          </div>

          {items.map((x) => (
            <div key={x.productId + "-" + x.lineType} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pn">{x.name} {x.lineType === "tang" && <span className="badge violet" style={{ fontSize: 10.5, padding: "2px 7px" }}>🎁 Tặng</span>}{x.promoName && <span className="badge green" style={{ fontSize: 10.5, padding: "2px 7px" }}>KM</span>}</div>
                <div className="pm mono">{x.sku} · tồn {x.stock} · vốn {fmt(x.avgCost)}</div>
              </div>
              <input type="number" min="1" value={x.qty} onChange={(e) => setItem2(x, "qty", e.target.value)} className="mono" style={{ width: 56, textAlign: "right", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px", color: "inherit" }} />
              <input type="number" min="0" value={x.unitPrice} disabled={x.lineType === "tang"} onChange={(e) => setItem2(x, "unitPrice", e.target.value)} className="mono" style={{ width: 96, textAlign: "right", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px", color: "inherit", opacity: x.lineType === "tang" ? .5 : 1 }} />
              <button className="icon-btn" onClick={() => removeItem2(x)}><Icon name="close" size={15} /></button>
            </div>
          ))}

          {combos.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <label className="field"><span>Thêm combo</span>
                <div className="input"><Icon name="box" size={16} />
                  <select defaultValue="" onChange={(e) => { const c = combos.find((x) => String(x.id) === e.target.value); if (c) addCombo(c); e.target.value = ""; }}
                    style={{ border: "none", background: "transparent", color: "inherit", width: "100%", outline: "none" }}>
                    <option value="">— Chọn combo —</option>
                    {combos.map((c) => <option key={c.id} value={c.id} disabled={c.availableQty <= 0}>{c.name} ({fmt(c.price)} · còn {c.availableQty})</option>)}
                  </select></div></label>
              {comboLines.map((x) => (
                <div key={x.comboId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                  <div style={{ flex: 1 }}><div className="pn">🎁 {x.name}</div><div className="pm mono">{fmt(x.price)} · khả dụng {x.available}</div></div>
                  <input type="number" min="1" max={x.available} value={x.qty} onChange={(e) => setComboQty(x.comboId, e.target.value)} className="mono" style={{ width: 56, textAlign: "right", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px", color: "inherit" }} />
                  <button className="icon-btn" onClick={() => removeCombo(x.comboId)}><Icon name="close" size={15} /></button>
                </div>
              ))}
            </div>
          )}

          {costTypes.length > 0 && <div style={{ marginTop: 12, fontSize: 12, color: "var(--faint)" }}>Chi phí phát sinh</div>}
          {costTypes.map((c) => {
            const on = picked[c.id] != null;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <button className="btn btn-sm btn-ghost" onClick={() => toggleCost(c)} style={{ minWidth: 32, justifyContent: "center" }}><Icon name={on ? "check" : "plus"} size={14} /></button>
                <span style={{ flex: 1, color: on ? "var(--ink-2)" : "var(--faint)" }}>{c.name}{c.unit === "percent" ? " (%)" : ""}</span>
                <input type="number" min="0" disabled={!on} value={on ? picked[c.id] : ""} onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.value }))} className="mono" style={{ width: 90, textAlign: "right", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px", color: "inherit" }} />
              </div>
            );
          })}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <label className="field"><span>Khách (tùy chọn)</span><div className="input"><Icon name="user" size={16} /><input value={info.customerName} onChange={(e) => setInfo({ ...info, customerName: e.target.value })} /></div></label>
            <label className="field"><span>Kênh (tùy chọn)</span><div className="input"><Icon name="globe" size={16} /><input value={info.channel} onChange={(e) => setInfo({ ...info, channel: e.target.value })} /></div></label>
          </div>

          <div style={{ marginTop: 8, padding: 12, background: "var(--surface-2)", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Doanh thu</span><b className="mono">{fmt(revenue)}</b></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}><span>− Giá vốn</span><span className="mono">−{fmt(cogs)}</span></div>
            {promoCost > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}><span>− Chi phí khuyến mãi</span><span className="mono">−{fmt(promoCost)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}><span>− Chi phí phát sinh</span><span className="mono">−{fmt(extra)}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--line-2)" }}><b>Lợi nhuận</b><b className="mono" style={{ color: profit >= 0 ? "var(--pos)" : "var(--neg)" }}>{(profit >= 0 ? "+" : "") + fmt(profit)}</b></div>
          </div>
          {overStock && <div style={{ marginTop: 8, color: "var(--st-red)", fontSize: 12.5 }}>Vượt tồn: {overStock.sku} chỉ còn {overStock.stock}.</div>}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={busy || (items.length === 0 && comboLines.length === 0) || !!overStock} onClick={submit}>{busy ? "Đang lưu…" : "Lưu đơn & trừ tồn"}</button>
        </div>
      </div>
    </div>
  );
}

export default Sales;
