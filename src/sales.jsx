/* ============================================================
   GomĐơn — Đơn bán (bán lẻ)
   Danh sách đơn + tạo đơn (chọn SP, số lượng, chi phí) → lợi nhuận thực.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { MoneyInput, costUnitPrice, resolveCostAmount, EmptyState, ProductImg } from "./components.jsx";
import { Select } from "./ui-controls.jsx";
import { useRefresh } from "./refresh.js";

const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN") + "₫");
const fmtN = (n) => Number(n || 0).toLocaleString("vi-VN");
const fmtDate = (d) => { try { return new Date(d).toLocaleString("vi-VN"); } catch { return "—"; } };

export function Sales({ onToast }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const { version: reload, refresh } = useRefresh();
  const [creating, setCreating] = React.useState(false);
  const [returning, setReturning] = React.useState(null); // sale đang chờ xác nhận trả

  React.useEffect(() => {
    let alive = true; setLoading(true); setErr(null);
    api.retail.sales().then((d) => { if (alive) setList(d || []); })
      .catch((e) => { if (alive) setErr(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const doReturn = async (s) => {
    try {
      await api.retail.returnSale(s.id);
      onToast && onToast(`Đã trả đơn ${s.code}`);
      setReturning(null);
      refresh();
    } catch (e) {
      onToast && onToast("Lỗi: " + e.message);
    }
  };

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
        <EmptyState icon="wallet" title="Chưa có đơn bán" hint="Tạo đơn bán đầu tiên để theo dõi doanh thu và lợi nhuận thực." actionLabel="Tạo đơn bán" onAction={() => setCreating(true)} />
      ) : (
        <div className="card"><div className="grid-wrap"><table className="dg">
          <thead><tr>
            <th>Mã đơn</th><th>Khách</th><th>Kênh</th>
            <th style={{ textAlign: "right" }}>Doanh thu</th>
            <th style={{ textAlign: "right" }}>Lợi nhuận</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th style={{ textAlign: "right" }}>Thao tác</th>
          </tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td className="cell-id">{s.code}</td>
                <td>{s.customerName || "—"}</td>
                <td className="cell-sub">{s.channel || "—"}</td>
                <td className="cell-money">{fmt(s.revenue)}</td>
                <td className={"cell-money " + (s.profit >= 0 ? "pos" : "neg")}>{(s.profit >= 0 ? "+" : "") + fmt(s.profit)}</td>
                <td>
                  {s.status === "returned"
                    ? <span className="badge slate">Đã trả</span>
                    : <span className="badge green">Hoàn tất</span>}
                </td>
                <td className="cell-sub">{fmtDate(s.soldAt)}</td>
                <td style={{ textAlign: "right" }}>
                  {s.status === "returned"
                    ? <span className="cell-sub">{s.returnedAt ? fmtDate(s.returnedAt) : "—"}</span>
                    : (
                      <button className="btn btn-sm btn-ghost" onClick={() => setReturning(s)}>
                        <Icon name="refresh" size={15} /> Trả hàng
                      </button>
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}

      {creating && <CreateSaleModal onClose={() => setCreating(false)}
        onDone={(msg) => { onToast && onToast(msg); setCreating(false); refresh(); }} onToast={onToast} />}

      {returning && (
        <ConfirmModal
          title="Trả hàng"
          confirm="Trả đơn"
          message={<>Trả đơn <b>{returning.code}</b>? Tồn kho sẽ được cộng lại và đơn bị loại khỏi báo cáo.</>}
          onClose={() => setReturning(null)}
          onConfirm={() => doReturn(returning)} />
      )}
    </div>
  );
}

/* ---------- Modal xác nhận (giống users.jsx) ---------- */
function ConfirmModal({ title, message, confirm, onConfirm, onClose }) {
  const [busy, setBusy] = React.useState(false);
  const go = async () => { setBusy(true); await onConfirm(); setBusy(false); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-ic"><Icon name="refresh" size={18} /></div>
          <div><h3>{title}</h3></div>
        </div>
        <div className="modal-body"><div className="mb-text">{message}</div></div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={busy} onClick={go}
            style={{ background: "var(--st-red)", borderColor: "var(--st-red)", boxShadow: "none" }}>
            {busy ? "Đang xử lý…" : confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateSaleModal({ onClose, onDone, onToast }) {
  const [products, setProducts] = React.useState([]);
  const [costTypes, setCostTypes] = React.useState([]);
  const [items, setItems] = React.useState([]); // {productId, qty, unitPrice}
  const [pickId, setPickId] = React.useState("");
  const [picked, setPicked] = React.useState({}); // costTypeId -> amount
  const [info, setInfo] = React.useState({ customerName: "", channel: "" });
  const [busy, setBusy] = React.useState(false);
  const [marginPct, setMarginPct] = React.useState(10);
  const [roundTo, setRoundTo] = React.useState(1000);
  const roundUp = (v, step) => (step > 0 ? Math.ceil(v / step) * step : v);
  const applyMargin = () => {
    const pct = Number(marginPct) || 0;
    setItems((xs) => xs.map((x) =>
      (x.lineType === "tang" || x.promoName)
        ? x
        : { ...x, unitPrice: roundUp(Math.round((Number(x.avgCost) || 0) * (1 + pct / 100)), Number(roundTo) || 0) }
    ));
  };

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
        productId: p.id, sku: p.sku, name: p.name, imageUrl: p.imageUrl, stock: p.stock, avgCost: p.avgCost, qty: 1, lineType,
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
    .reduce((a, c) => a + resolveCostAmount(c, picked[c.id], revenue), 0);
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
        .map((c) => (c.unit === "pack"
          ? { costTypeId: c.id, name: c.name, amount: Math.max(0, resolveCostAmount(c, picked[c.id], revenue)), unit: "vnd" }
          : { costTypeId: c.id, name: c.name, amount: Math.max(0, Math.round(Number(picked[c.id]) || 0)), unit: c.unit })),
    };
    try { await api.retail.createSale(body); onDone("Đã tạo đơn bán"); }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
    finally { setBusy(false); }
  };

  const toggleCost = (c) => setPicked((p) => { const n = { ...p }; if (n[c.id] != null) delete n[c.id]; else n[c.id] = c.defaultAmount ?? 0; return n; });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, width: "92%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="plus" size={18} /></div><div><h3>Tạo đơn bán</h3><div className="mh-sub">Chọn sản phẩm, combo & chi phí để tính lợi nhuận thực</div></div></div>
        <div className="modal-body">
          {/* chọn sản phẩm + nút thao tác */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <label className="field" style={{ flex: 1, minWidth: 0 }}><span>Thêm sản phẩm</span>
              <Select icon="search" value={pickId} onChange={setPickId} placeholder="— Chọn SKU —"
                options={products.map((p) => ({
                  value: p.id,
                  label: p.stock <= 0 ? `${p.sku} · HẾT HÀNG · ${p.name}` : `${p.sku} · tồn ${p.stock} · ${p.name}`,
                  disabled: p.stock <= 0,
                }))} />
            </label>
            <button className="btn btn-sm" onClick={() => { const p = products.find((x) => String(x.id) === pickId); if (!p) return; if (p.stock <= 0) { onToast && onToast(`${p.sku} đã hết tồn.`); return; } addItem(p, "ban"); setPickId(""); }}>+ Bán</button>
            <button className="btn btn-sm" onClick={() => { const p = products.find((x) => String(x.id) === pickId); if (!p) return; if (p.stock <= 0) { onToast && onToast(`${p.sku} đã hết tồn.`); return; } addItem(p, "tang"); setPickId(""); }}>🎁 Tặng</button>
          </div>

          {items.some((x) => x.lineType !== "tang") && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <span className="cell-sub" style={{ fontSize: 12.5 }}>Gợi ý giá:</span>
              <input type="number" min="0" inputMode="numeric" className="num-inp" style={{ width: 64 }}
                value={marginPct} onChange={(e) => setMarginPct(e.target.value)} />
              <span className="cell-sub" style={{ fontSize: 12.5 }}>% lời trên vốn</span>
              <span className="cell-sub" style={{ fontSize: 12.5, marginLeft: 4 }}>Làm tròn</span>
              <Select className="sel-compact" style={{ width: 130 }} value={String(roundTo)}
                onChange={(v) => setRoundTo(Number(v))}
                options={[
                  { value: "0", label: "Không tròn" },
                  { value: "1000", label: "1.000₫" },
                  { value: "5000", label: "5.000₫" },
                ]} />
              <button type="button" className="btn btn-sm" onClick={applyMargin}>Áp dụng cho tất cả</button>
            </div>
          )}

          {items.map((x) => {
            const over = (Number(x.qty) || 0) > x.stock;
            const stockStyle = x.stock <= 0
              ? { color: "var(--st-red)", background: "var(--st-red-bg)" }
              : x.stock <= 10 ? { color: "var(--st-amber)", background: "var(--st-amber-bg)" }
              : { color: "var(--st-slate)", background: "var(--st-slate-bg)" };
            const stockLabel = x.stock <= 0 ? "Hết hàng" : x.stock <= 10 ? `Sắp hết · ${x.stock}` : `Tồn ${x.stock}`;
            return (
            <div key={x.productId + "-" + x.lineType} className="cost-line">
              <ProductImg imageUrl={x.imageUrl} alt={x.name} sm />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="pn">{x.name}
                  <span className="tag-mini" style={stockStyle}>{stockLabel}</span>
                  {x.lineType === "tang" && <span className="tag-mini" style={{ color: "var(--st-violet)", background: "var(--st-violet-bg)" }}>🎁 Tặng</span>}
                  {x.promoName && <span className="tag-mini" style={{ color: "var(--st-green)", background: "var(--st-green-bg)" }}>KM</span>}
                </div>
                <div className="pm">{x.sku} · vốn {fmt(x.avgCost)}</div>
              </div>
              <input type="number" min="1" value={x.qty} onChange={(e) => setItem2(x, "qty", e.target.value)} className="num-inp" style={{ width: 56, ...(over ? { borderColor: "var(--st-red)", color: "var(--st-red)" } : {}) }} />
              <MoneyInput value={x.unitPrice} disabled={x.lineType === "tang"} onChange={(v) => setItem2(x, "unitPrice", v)} className="num-inp" style={{ width: 96 }} />
              <button className="icon-btn" onClick={() => removeItem2(x)}><Icon name="close" size={15} /></button>
            </div>
            );
          })}

          {combos.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <label className="field"><span>Thêm combo</span>
                <Select icon="box" value="" onChange={(id) => { const c = combos.find((x) => String(x.id) === id); if (c) addCombo(c); }} placeholder="— Chọn combo —"
                  options={combos.map((c) => ({ value: c.id, label: `${c.name} (${fmt(c.price)} · còn ${c.availableQty})`, disabled: c.availableQty <= 0 }))} />
              </label>
              {comboLines.map((x) => (
                <div key={x.comboId} className="cost-line">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pn">{x.name}<span className="tag-mini" style={{ color: "var(--st-blue)", background: "var(--st-blue-bg)" }}>🎁 Combo</span></div>
                    <div className="pm">{fmt(x.price)} · khả dụng {x.available}</div>
                  </div>
                  <input type="number" min="1" max={x.available} value={x.qty} onChange={(e) => setComboQty(x.comboId, e.target.value)} className="num-inp" style={{ width: 56 }} />
                  <button className="icon-btn" onClick={() => removeCombo(x.comboId)}><Icon name="close" size={15} /></button>
                </div>
              ))}
            </div>
          )}

          {costTypes.length > 0 && <div className="cell-sub" style={{ marginTop: 12 }}>Chi phí phát sinh</div>}
          {costTypes.map((c) => {
            const on = picked[c.id] != null;
            return (
              <div key={c.id} className={"cost-line" + (on ? "" : " off")}>
                <button type="button" className={"cost-chk" + (on ? " on" : "")} onClick={() => toggleCost(c)}><Icon name={on ? "check" : "plus"} size={14} /></button>
                <span className="nm">{c.name}{c.unit === "percent" ? " (%)" : c.unit === "pack" ? " (lô)" : ""}</span>
                {c.unit === "pack" ? (
                  <>
                    <input type="number" min="0" inputMode="numeric" disabled={!on}
                      value={on ? picked[c.id] : ""} onChange={(e) => setPicked((p) => ({ ...p, [c.id]: e.target.value }))}
                      className="num-inp" style={{ width: 60 }} />
                    <span className="cell-sub" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                      × {fmtN(costUnitPrice(c))}₫ = {fmtN(costUnitPrice(c) * (Number(on ? picked[c.id] : 0) || 0))}₫
                    </span>
                  </>
                ) : (
                  <MoneyInput disabled={!on} value={on ? picked[c.id] : ""} onChange={(v) => setPicked((p) => ({ ...p, [c.id]: v }))} className="num-inp" style={{ width: 90 }} />
                )}
              </div>
            );
          })}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
            <label className="field"><span>Khách (tùy chọn)</span><div className="input"><Icon name="user" size={16} /><input value={info.customerName} onChange={(e) => setInfo({ ...info, customerName: e.target.value })} /></div></label>
            <label className="field"><span>Kênh (tùy chọn)</span><div className="input"><Icon name="globe" size={16} /><input value={info.channel} onChange={(e) => setInfo({ ...info, channel: e.target.value })} /></div></label>
          </div>

          {/* tổng kết */}
          <div style={{ marginTop: 12 }}>
            <div className="fee-row"><span className="fl">Doanh thu</span><span className="fv">{fmt(revenue)}</span></div>
            <div className="fee-row"><span className="fl">− Giá vốn</span><span className="fv">−{fmt(cogs)}</span></div>
            {promoCost > 0 && <div className="fee-row"><span className="fl">− Chi phí khuyến mãi</span><span className="fv">−{fmt(promoCost)}</span></div>}
            <div className="fee-row"><span className="fl">− Chi phí phát sinh</span><span className="fv">−{fmt(extra)}</span></div>
            <div className={"profit-box" + (profit >= 0 ? "" : " neg")} style={{ marginTop: 12 }}>
              <div className="pl">Lợi nhuận thực</div>
              <div className="pv">{(profit >= 0 ? "+" : "") + fmt(profit)}</div>
            </div>
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
