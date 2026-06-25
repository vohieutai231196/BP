/* ============================================================
   GomĐơn — Combo (bán lẻ)
   Danh sách combo (tồn khả dụng động) + tạo/sửa/xóa, chọn thành phần.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { MoneyInput, EmptyState, ProductImg } from "./components.jsx";
import { Select } from "./ui-controls.jsx";
import { useRefresh } from "./refresh.js";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

export function Combos({ onToast }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const { version: reload, refresh } = useRefresh();
  const [editing, setEditing] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);

  React.useEffect(() => {
    let alive = true; setLoading(true); setErr(null);
    api.retail.combos().then((d) => { if (alive) setList(d || []); })
      .catch((e) => { if (alive) setErr(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const run = async (fn, msg) => { try { await fn(); onToast && onToast(msg); setEditing(null); setConfirm(null); refresh(); } catch (e) { onToast && onToast("Lỗi: " + e.message); } };

  return (
    <div className="fade-in">
      <div className="toolbar">
        <div className="section-title">Combo</div>
        <span className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={15} /> Tạo combo</button>
      </div>

      {loading ? <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>
        : err ? <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>
        : list.length === 0 ? <EmptyState icon="box" title="Chưa có combo" hint="Gói nhiều sản phẩm thành một combo để bán kèm và tăng giá trị mỗi đơn." actionLabel="Tạo combo" onAction={() => setEditing({})} />
        : (
          <div className="card"><div className="grid-wrap"><table className="dg">
            <thead><tr><th>Combo</th><th style={{ textAlign: "right" }}>Giá bán</th><th style={{ textAlign: "right" }}>Tổng vốn</th><th style={{ textAlign: "right" }}>Lời</th><th style={{ textAlign: "right" }}>Tồn khả dụng</th><th>Trạng thái</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
            <tbody>
              {list.map((c) => {
                const profit = c.price - c.totalCost;
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="cell-prod">
                        <ProductImg imageUrl={c.imageUrl} alt={c.name} />
                        <div><div className="pn">{c.name}</div><div className="pm mono">{c.code} · {c.itemCount} món</div></div>
                      </div>
                    </td>
                    <td className="cell-money">{fmt(c.price)}₫</td>
                    <td className="cell-money">{fmt(c.totalCost)}₫</td>
                    <td className={"cell-money " + (profit >= 0 ? "pos" : "neg")}>{(profit >= 0 ? "+" : "") + fmt(profit)}₫</td>
                    <td className="cell-money">{c.availableQty <= 0 ? <span className="neg">Hết hàng</span> : fmt(c.availableQty)}</td>
                    <td><span className={"badge " + (c.active ? "green" : "slate")}><span className="dot" /> {c.active ? "Bật" : "Tắt"}</span></td>
                    <td><div className="u-actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}><Icon name="settings" size={15} /> Sửa</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(c)}><Icon name="close" size={15} /> Xóa</button>
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div></div>
        )}

      {editing && <ComboModal combo={editing.id ? editing : null} onRun={run} onClose={() => setEditing(null)} onToast={onToast} />}
      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="mh-ic"><Icon name="close" size={18} /></div><div><h3>Xóa combo</h3></div></div>
            <div className="modal-body"><div className="mb-text">Xóa <b>{confirm.name}</b>?</div></div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirm(null)}>Hủy</button>
              <button className="btn btn-primary" style={{ background: "var(--st-red)", borderColor: "var(--st-red)", boxShadow: "none" }}
                onClick={() => run(() => api.retail.deleteCombo(confirm.id), "Đã xóa combo")}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ComboModal({ combo, onRun, onClose, onToast }) {
  const isEdit = !!combo;
  const [f, setF] = React.useState({ code: combo?.code || "", name: combo?.name || "", price: combo?.price ?? 0, active: combo?.active ?? true });
  const [products, setProducts] = React.useState([]);
  const [items, setItems] = React.useState([]); // {productId, sku, name, stock, qty, lineType}
  const [busy, setBusy] = React.useState(false);

  const prodById = React.useMemo(() => {
    const m = {}; products.forEach((p) => { m[p.id] = p; }); return m;
  }, [products]);
  const disp = (x) => {
    const p = prodById[x.productId] || {};
    return { name: p.name || ("SKU #" + x.productId), sku: p.sku || "", cost: Number(p.avgCost) || 0, stock: p.stock ?? x.stock ?? 0 };
  };

  const [marginPct, setMarginPct] = React.useState(10);
  const [roundTo, setRoundTo] = React.useState(1000);
  const roundUp = (v, step) => (step > 0 ? Math.ceil(v / step) * step : v);
  const totalCost = items.reduce((a, x) => a + (Number(x.qty) || 0) * (Number(prodById[x.productId]?.avgCost) || 0), 0);
  const profit = (Number(f.price) || 0) - totalCost;
  const applyMargin = () => {
    const pct = Number(marginPct) || 0;
    setF((prev) => ({ ...prev, price: roundUp(Math.round(totalCost * (1 + pct / 100)), Number(roundTo) || 0) }));
  };

  React.useEffect(() => {
    api.retail.products({ status: "active" }).then((d) => setProducts(d || [])).catch(() => {});
    if (isEdit) api.retail.comboComponents(combo.id).then((cs) => setItems((cs || []).map((x) => ({
      productId: x.productId, qty: x.qty, lineType: x.lineType, stock: x.stock,
    })))).catch(() => {});
  }, []);

  const addProduct = (p) => setItems((xs) => xs.some((x) => x.productId === p.id) ? xs
    : [...xs, { productId: p.id, qty: 1, lineType: "ban", stock: p.stock }]);
  const setItem = (id, k, v) => setItems((xs) => xs.map((x) => x.productId === id ? { ...x, [k]: v } : x));
  const removeItem = (id) => setItems((xs) => xs.filter((x) => x.productId !== id));

  const submit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { onToast && onToast("Combo cần ít nhất 1 sản phẩm."); return; }
    setBusy(true);
    const body = {
      code: f.code, name: f.name, price: Math.max(0, Math.round(Number(f.price) || 0)),
      items: items.map((x) => ({ productId: x.productId, qty: Math.max(1, Math.round(Number(x.qty) || 0)), lineType: x.lineType })),
    };
    if (isEdit) await onRun(() => api.retail.updateCombo(combo.id, { name: body.name, price: body.price, active: f.active, items: body.items }), "Đã lưu combo");
    else await onRun(() => api.retail.createCombo(body), "Đã tạo combo");
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: "92%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="box" size={18} /></div><div><h3>{isEdit ? "Sửa combo" : "Tạo combo"}</h3></div></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {!isEdit && <label className="field"><span>Mã combo</span><div className="input"><Icon name="box" size={16} /><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} autoFocus required /></div></label>}
            <label className="field"><span>Tên combo</span><div className="input"><Icon name="tag" size={16} /><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div></label>
            <label className="field"><span>Giá bán combo (₫)</span><div className="input"><Icon name="wallet" size={16} /><MoneyInput value={f.price} onChange={(v) => setF({ ...f, price: v })} required /></div></label>

            <div className="field"><span style={{ marginBottom: 6 }}>Thành phần</span>
              <Select icon="search" value="" onChange={(id) => { const p = products.find((x) => String(x.id) === id); if (p) addProduct(p); }} placeholder="— Thêm SKU —"
                options={products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name} (tồn ${p.stock})` }))} />
            </div>
            {items.map((x) => {
              const d = disp(x);
              return (
                <div key={x.productId} className="cost-line">
                  <div className="nm" style={{ minWidth: 0 }}>
                    <div className="pn">{d.name}</div>
                    <div className="pm mono">{d.sku ? d.sku + " · " : ""}tồn {d.stock} · vốn {fmt(d.cost)}₫</div>
                  </div>
                  <input type="number" min="1" value={x.qty} onChange={(e) => setItem(x.productId, "qty", e.target.value)} className="num-inp" style={{ width: 64 }} />
                  <Select value={x.lineType} onChange={(v) => setItem(x.productId, "lineType", v)} className="sel-compact" style={{ width: 96 }}
                    options={[{ value: "ban", label: "Bán" }, { value: "tang", label: "Tặng" }]} />
                  <button type="button" className="icon-btn" onClick={() => removeItem(x.productId)}><Icon name="close" size={15} /></button>
                </div>
              );
            })}
            {items.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div className="fee-row"><span className="fl">Tổng vốn</span><span className="fv">{fmt(totalCost)}₫</span></div>
                <div className="fee-row"><span className="fl">Lời (theo giá đang nhập)</span>
                  <span className={"fv " + (profit >= 0 ? "pos" : "neg")}>{(profit >= 0 ? "+" : "") + fmt(profit)}₫</span></div>
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
                  <button type="button" className="btn btn-sm" onClick={applyMargin}>Áp dụng</button>
                </div>
              </div>
            )}
            {isEdit && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <button type="button" role="switch" aria-checked={f.active}
                  className={"switch" + (f.active ? " on" : "")} onClick={() => setF({ ...f, active: !f.active })}>
                  <span className="switch-knob" />
                </button>
                <span style={{ fontSize: 13.5 }}>{f.active ? "Đang bật" : "Đang tắt"}</span>
              </div>
            )}
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : (isEdit ? "Lưu" : "Tạo combo")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Combos;
