/* ============================================================
   GomĐơn — Kho & Sản phẩm (bán lẻ)
   Danh sách SKU + lọc trạng thái, tạo/sửa/xóa sản phẩm.
   GĐ1: giá vốn nhập tay; tồn kho hiển thị ở GĐ2.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { ReceiveModal } from "./receive.jsx";
import { MoneyInput, costUnitPrice } from "./components.jsx";

const STATUS = {
  active: { label: "Đang bán", color: "green" },
  hidden: { label: "Ẩn", color: "slate" },
};
const TABS = [
  { key: "", label: "Tất cả" },
  { key: "active", label: "Đang bán" },
  { key: "hidden", label: "Ẩn" },
];
const CATS = ["shoe", "bag", "apparel", "tech", "home", "beauty", "other"];
const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN") + "₫");

export function Inventory({ onToast }) {
  const [tab, setTab] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [all, setAll] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [editing, setEditing] = React.useState(null); // null | {} (new) | product (edit)
  const [confirm, setConfirm] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [receiving, setReceiving] = React.useState(false);
  React.useEffect(() => { api.retail.summary().then(setSummary).catch(() => {}); }, [reload]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    api.retail.products({})
      .then((d) => { if (alive) setAll(d || []); })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const refresh = () => setReload((r) => r + 1);
  const run = async (fn, okMsg) => {
    try {
      const r = await fn();
      onToast && onToast(typeof okMsg === "function" ? okMsg(r) : okMsg);
      setEditing(null); setConfirm(null); refresh();
    }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
  };

  const counts = React.useMemo(() => {
    const c = { "": all.length, active: 0, hidden: 0 };
    all.forEach((p) => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [all]);

  const q = search.trim().toLowerCase();
  const rows = all.filter((p) =>
    (!tab || p.status === tab) &&
    (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));

  const profit = (p) => (p.listPrice != null ? p.listPrice - p.avgCost : null);

  return (
    <div className="fade-in">
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <div className="card kpi">
            <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--st-blue-bg)", color: "var(--st-blue)" }}><Icon name="box" size={21} /></div></div>
            <div><div className="kpi-label">Tổng SKU</div><div className="kpi-val" style={{ marginTop: 6 }}>{summary.totalSkus}</div></div>
          </div>
          <div className="card kpi">
            <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--st-green-bg)", color: "var(--st-green)" }}><Icon name="warehouse" size={21} /></div></div>
            <div><div className="kpi-label">Tồn kho</div><div className="kpi-val" style={{ marginTop: 6 }}>{Number(summary.totalStock).toLocaleString("vi-VN")}</div></div>
          </div>
          <div className="card kpi">
            <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--st-violet-bg)", color: "var(--st-violet)" }}><Icon name="coins" size={21} /></div></div>
            <div><div className="kpi-label">Giá trị tồn</div><div className="kpi-val" style={{ marginTop: 6 }}>{Number(summary.stockValue).toLocaleString("vi-VN")}<small>₫</small></div></div>
          </div>
          <div className="card kpi">
            <div className="kpi-top"><div className="kpi-ic" style={{ background: "var(--st-amber-bg)", color: "var(--st-amber)" }}><Icon name="clock" size={21} /></div></div>
            <div><div className="kpi-label">SKU sắp hết</div><div className="kpi-val" style={{ marginTop: 6 }}>{summary.lowStockCount}</div></div>
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="chips">
          {TABS.map((t) => (
            <button key={t.key} className={"chip" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
              {t.label}<span className="cc">{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>
        <span className="spacer" />
        <div className="search" style={{ maxWidth: 240 }}>
          <Icon name="search" size={16} style={{ color: "var(--faint)" }} />
          <input placeholder="Tìm SKU / tên…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-sm" onClick={() => setReceiving(true)}>
          <Icon name="download" size={15} /> Nhận đơn vào kho
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => setEditing({})}>
          <Icon name="plus" size={15} /> Sản phẩm
        </button>
      </div>

      {loading ? (
        <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>
      ) : err ? (
        <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>
      ) : rows.length === 0 ? (
        <div className="card empty"><Icon name="warehouse" size={40} /><div>Chưa có sản phẩm. Bấm “Sản phẩm” để thêm.</div></div>
      ) : (
        <div className="card"><div className="grid-wrap"><table className="dg">
          <thead><tr>
            <th>Sản phẩm</th><th>Danh mục</th>
            <th style={{ textAlign: "right" }}>Tồn</th>
            <th style={{ textAlign: "right" }}>Giá vốn TB</th>
            <th style={{ textAlign: "right" }}>Giá niêm yết</th>
            <th>Phụ phí</th>
            <th style={{ textAlign: "right" }}>Lời/sp</th>
            <th>Trạng thái</th>
            <th style={{ textAlign: "right" }}>Thao tác</th>
          </tr></thead>
          <tbody>
            {rows.map((p) => {
              const st = STATUS[p.status] || { label: p.status, color: "slate" };
              const pf = profit(p);
              return (
                <tr key={p.id}>
                  <td>
                    <div className="cell-prod">
                      <div className="thumb" style={{ background: "var(--accent)" }}><Icon name="box" size={19} stroke={1.7} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="pn">{p.name}</div>
                        <div className="pm mono">{p.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="cell-sub">{p.category}</td>
                  <td className="cell-money" style={{ color: p.stock <= 10 ? "var(--st-amber)" : "inherit" }}>
                    {Number(p.stock ?? 0).toLocaleString("vi-VN")}
                    <span className="stockbar"><i style={{ width: Math.min(100, (Number(p.stock ?? 0) / 120) * 100) + "%", background: p.stock <= 10 ? "var(--st-amber)" : "var(--st-green)" }} /></span>
                  </td>
                  <td className="cell-money">{fmt(p.avgCost)}</td>
                  <td className="cell-money">{fmt(p.listPrice)}</td>
                  <td className="cell-sub" style={{ color: p.costTypeSummary ? "inherit" : "var(--faint)" }}>{p.costTypeSummary || "—"}</td>
                  <td className="cell-money">
                    {pf == null ? "—" : <span className={pf >= 0 ? "pos" : "neg"}>{(pf >= 0 ? "+" : "") + fmt(pf)}</span>}
                  </td>
                  <td><span className={"badge " + st.color}><span className="dot" /> {st.label}</span></td>
                  <td>
                    <div className="u-actions">
                      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(p)}>
                        <Icon name="settings" size={15} /> Sửa
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(p)}>
                        <Icon name="close" size={15} /> Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div></div>
      )}

      {editing && <ProductModal product={editing.id ? editing : null} onRun={run} onClose={() => setEditing(null)} />}
      {confirm && (
        <ConfirmModal title="Xóa sản phẩm" confirm="Xóa"
          message={<>Xóa <b>{confirm.name}</b> ({confirm.sku})? Không thể hoàn tác.</>}
          onClose={() => setConfirm(null)}
          onConfirm={() => run(() => api.retail.deleteProduct(confirm.id), "Đã xóa " + confirm.sku)} />
      )}
      {receiving && <ReceiveModal onClose={() => setReceiving(false)}
        onDone={(msg) => { onToast && onToast(msg); setReceiving(false); refresh(); }} onToast={onToast} />}
    </div>
  );
}

/* ---------- Modal tạo/sửa sản phẩm ---------- */
function ProductModal({ product, onRun, onClose }) {
  const isEdit = !!product;
  const [f, setF] = React.useState({
    sku: product?.sku || "", name: product?.name || "", category: product?.category || "other",
    avgCost: product?.avgCost ?? 0, listPrice: product?.listPrice ?? "", status: product?.status || "active",
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (v) => (v === "" || v == null ? null : Math.max(0, Math.round(Number(v) || 0)));

  // ----- Phụ phí áp dụng -----
  const [costTypes, setCostTypes] = React.useState([]);        // danh mục active
  const [picked, setPicked] = React.useState({});              // { [id]: amountStr } đã tick ("" = dùng default)
  const [divOpen, setDivOpen] = React.useState({});            // { [id]: bool } mở helper ÷SL
  const [divCalc, setDivCalc] = React.useState({});            // { [id]: { total, qty } }

  React.useEffect(() => {
    let alive = true;
    api.retail.costTypes({ activeOnly: true }).then((d) => { if (alive) setCostTypes(d || []); }).catch(() => {});
    if (isEdit) {
      api.retail.productCostTypes(product.id)
        .then((rows) => {
          if (!alive) return;
          const next = {};
          (rows || []).forEach((r) => { next[r.costTypeId] = r.amount == null ? "" : String(r.amount); });
          setPicked(next);
        })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [isEdit, product]);

  const toggleCost = (c) => setPicked((p) => {
    const next = { ...p };
    if (next[c.id] != null) delete next[c.id];
    else next[c.id] = "";
    return next;
  });
  const setCostAmt = (id, v) => setPicked((p) => ({ ...p, [id]: v }));
  const toggleDiv = (id) => setDivOpen((d) => ({ ...d, [id]: !d[id] }));
  const setDivField = (id, k, v) => setDivCalc((d) => {
    const cur = { ...(d[id] || {}), [k]: v };
    const total = Number(cur.total) || 0, qty = Number(cur.qty) || 0;
    if (qty > 0 && total > 0) setCostAmt(id, String(Math.round(total / qty)));
    return { ...d, [id]: cur };
  });

  const buildCostTypes = () => costTypes
    .filter((c) => picked[c.id] != null)
    .map((c) => ({ costTypeId: c.id, amount: num(picked[c.id]) }));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = {
      name: f.name, category: f.category,
      avgCost: num(f.avgCost) ?? 0, listPrice: num(f.listPrice),
      costTypes: buildCostTypes(),
    };
    if (isEdit) {
      await onRun(() => api.retail.updateProduct(product.id, { ...body, status: f.status }), "Đã lưu " + f.sku);
    } else {
      await onRun(() => api.retail.createProduct({ sku: f.sku, ...body }), "Đã tạo " + f.sku);
    }
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-ic"><Icon name={isEdit ? "settings" : "plus"} size={18} /></div>
          <div><h3>{isEdit ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h3>
            {isEdit && <div className="mh-sub">{product.sku}</div>}</div>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            {!isEdit && (
              <label className="field"><span>SKU</span>
                <div className="input"><Icon name="box" size={16} /><input value={f.sku} onChange={set("sku")} autoFocus required /></div></label>
            )}
            <label className="field"><span>Tên sản phẩm</span>
              <div className="input"><Icon name="tag" size={16} /><input value={f.name} onChange={set("name")} required /></div></label>
            <label className="field"><span>Danh mục</span>
              <div className="input"><Icon name="filter" size={16} />
                <select className="sel" value={f.category} onChange={set("category")}>
                  {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div></label>
            <label className="field"><span>Giá vốn TB (₫)</span>
              <div className="input"><Icon name="coins" size={16} /><MoneyInput value={f.avgCost} onChange={(v) => setF({ ...f, avgCost: v })} required /></div></label>
            <label className="field"><span>Giá niêm yết (₫) — để trống nếu chưa đặt</span>
              <div className="input"><Icon name="wallet" size={16} /><MoneyInput value={f.listPrice} onChange={(v) => setF({ ...f, listPrice: v })} /></div></label>
            {isEdit && (
              <label className="field"><span>Trạng thái</span>
                <div className="input"><Icon name="eye" size={16} />
                  <select className="sel" value={f.status} onChange={set("status")}>
                    <option value="active">Đang bán</option><option value="hidden">Ẩn</option>
                  </select></div></label>
            )}

            {/* ---------- Phụ phí áp dụng ---------- */}
            <div className="field">
              <span>Phụ phí áp dụng <span className="tag-soft">đơn giá / sp</span></span>
              {costTypes.length === 0 ? (
                <div className="cell-sub" style={{ fontSize: 11.5 }}>Chưa có loại phụ phí. Thêm ở mục “Phụ phí” (sidebar Bán lẻ).</div>
              ) : (
                <div>
                  {costTypes.map((c) => {
                    const on = picked[c.id] != null;
                    const dc = divCalc[c.id] || {};
                    return (
                      <React.Fragment key={c.id}>
                        <div className={"cost-line" + (on ? "" : " off")}>
                          <button type="button" className={"cost-chk" + (on ? " on" : "")} onClick={() => toggleCost(c)}>
                            <Icon name={on ? "check" : "plus"} size={15} />
                          </button>
                          <span className="nm">{c.name}{c.unit === "percent" ? " (%)" : c.unit === "pack" ? " (lô)" : ""}</span>
                          {c.unit === "pack" ? (
                            <>
                              <input type="number" min="0" inputMode="numeric" disabled={!on}
                                value={on ? picked[c.id] : ""} onChange={(e) => setCostAmt(c.id, e.target.value)}
                                placeholder={c.defaultAmount == null ? "SL" : String(c.defaultAmount)}
                                className="num-inp" style={{ width: 60 }} />
                              <span className="cell-sub" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
                                × {Number(costUnitPrice(c)).toLocaleString("vi-VN")}₫
                              </span>
                            </>
                          ) : (
                            <>
                              <MoneyInput disabled={!on} value={on ? picked[c.id] : ""}
                                onChange={(v) => setCostAmt(c.id, v)}
                                placeholder={c.defaultAmount == null ? "default" : String(c.defaultAmount)}
                                className="num-inp" style={{ width: 96 }} />
                              <button type="button" disabled={!on}
                                className={"btn btn-sm" + (divOpen[c.id] ? " btn-primary" : "")}
                                style={{ flex: "none", opacity: on ? 1 : .4 }}
                                onClick={() => toggleDiv(c.id)}>÷ SL</button>
                            </>
                          )}
                        </div>
                        {on && divOpen[c.id] && (
                          <div className="divbox">
                            <span>Tổng cả lô</span>
                            <MoneyInput className="num-inp" style={{ width: 96 }}
                              value={dc.total ?? ""} onChange={(v) => setDivField(c.id, "total", v)} />
                            <span>÷ Số lượng</span>
                            <input type="number" min="0" className="num-inp" style={{ width: 72 }}
                              value={dc.qty ?? ""} onChange={(e) => setDivField(c.id, "qty", e.target.value)} />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <div className="cell-sub" style={{ fontSize: 11.5, marginTop: 8 }}>
                    Để trống số tiền = dùng giá mặc định của loại. “÷ SL” = tổng mua cả lô ÷ số lượng → đơn giá/sp.
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : (isEdit ? "Lưu" : "Tạo sản phẩm")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------- Confirm ---------- */
function ConfirmModal({ title, message, confirm, onConfirm, onClose }) {
  const [busy, setBusy] = React.useState(false);
  const go = async () => { setBusy(true); await onConfirm(); setBusy(false); };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><div className="mh-ic"><Icon name="close" size={18} /></div><div><h3>{title}</h3></div></div>
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

export default Inventory;
