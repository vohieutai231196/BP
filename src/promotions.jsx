/* ============================================================
   GomĐơn — Khuyến mãi (bán lẻ)
   Danh sách đợt KM + tạo/sửa/xóa, gắn SKU, giảm % hoặc giá cố định.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { MoneyInput, EmptyState } from "./components.jsx";
import { Select, DateField } from "./ui-controls.jsx";
import { useRefresh } from "./refresh.js";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return "—"; } };

export function Promotions({ onToast }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const { version: reload, refresh } = useRefresh();
  const [editing, setEditing] = React.useState(null); // {} new | promo edit
  const [confirm, setConfirm] = React.useState(null);

  React.useEffect(() => {
    let alive = true; setLoading(true); setErr(null);
    api.retail.promotions().then((d) => { if (alive) setList(d || []); })
      .catch((e) => { if (alive) setErr(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const run = async (fn, msg) => { try { await fn(); onToast && onToast(msg); setEditing(null); setConfirm(null); refresh(); } catch (e) { onToast && onToast("Lỗi: " + e.message); } };

  return (
    <div className="fade-in">
      <div className="toolbar">
        <div className="section-title">Đợt khuyến mãi</div>
        <span className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={() => setEditing({})}><Icon name="plus" size={15} /> Tạo khuyến mãi</button>
      </div>

      {loading ? <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>
        : err ? <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>
        : list.length === 0 ? <EmptyState icon="tag" title="Chưa có khuyến mãi" hint="Tạo đợt giảm giá theo sản phẩm để chạy chương trình bán hàng." actionLabel="Tạo khuyến mãi" onAction={() => setEditing({})} />
        : (
          <div className="card"><div className="grid-wrap"><table className="dg">
            <thead><tr><th>Tên</th><th>Kiểu</th><th style={{ textAlign: "right" }}>Giá trị</th><th>Hiệu lực</th><th style={{ textAlign: "right" }}>SKU</th><th>Trạng thái</th><th style={{ textAlign: "right" }}>Thao tác</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id}>
                  <td className="pn">{p.name}</td>
                  <td className="cell-sub">{p.type === "percent" ? "Giảm %" : "Giá cố định"}</td>
                  <td className="cell-money">{p.type === "percent" ? p.value + "%" : fmt(p.value) + "₫"}</td>
                  <td className="cell-sub">{fmtDate(p.startAt)} → {fmtDate(p.endAt)}</td>
                  <td className="cell-money">{p.productCount}</td>
                  <td><span className={"badge " + (p.active ? "green" : "slate")}><span className="dot" /> {p.active ? "Bật" : "Tắt"}</span></td>
                  <td><div className="u-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(p)}><Icon name="settings" size={15} /> Sửa</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(p)}><Icon name="close" size={15} /> Xóa</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table></div></div>
        )}

      {editing && <PromoModal promo={editing.id ? editing : null} onRun={run} onClose={() => setEditing(null)} onToast={onToast} />}
      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="mh-ic"><Icon name="close" size={18} /></div><div><h3>Xóa khuyến mãi</h3></div></div>
            <div className="modal-body"><div className="mb-text">Xóa <b>{confirm.name}</b>?</div></div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirm(null)}>Hủy</button>
              <button className="btn btn-primary" style={{ background: "var(--st-red)", borderColor: "var(--st-red)", boxShadow: "none" }}
                onClick={() => run(() => api.retail.deletePromotion(confirm.id), "Đã xóa KM")}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PromoModal({ promo, onRun, onClose, onToast }) {
  const isEdit = !!promo;
  const [f, setF] = React.useState({
    name: promo?.name || "", type: promo?.type || "percent", value: promo?.value ?? 10,
    startAt: promo?.startAt ? promo.startAt.slice(0, 10) : "", endAt: promo?.endAt ? promo.endAt.slice(0, 10) : "",
    active: promo?.active ?? true,
  });
  const [products, setProducts] = React.useState([]);
  const [picked, setPicked] = React.useState(new Set());
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    api.retail.products({ status: "active" }).then((d) => setProducts(d || [])).catch(() => {});
    if (isEdit) api.retail.promotionProducts(promo.id).then((ids) => setPicked(new Set(ids))).catch(() => {});
  }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setV = (k) => (v) => setF({ ...f, [k]: v });
  const toggle = (id) => setPicked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = {
      name: f.name, type: f.type, value: Math.max(0, Math.round(Number(f.value) || 0)),
      startAt: f.startAt ? new Date(f.startAt).toISOString() : null,
      endAt: f.endAt ? new Date(f.endAt).toISOString() : null,
      productIds: [...picked],
    };
    if (isEdit) await onRun(() => api.retail.updatePromotion(promo.id, { ...body, active: f.active }), "Đã lưu KM");
    else await onRun(() => api.retail.createPromotion(body), "Đã tạo KM");
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "92%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="tag" size={18} /></div><div><h3>{isEdit ? "Sửa khuyến mãi" : "Tạo khuyến mãi"}</h3></div></div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <label className="field"><span>Tên đợt KM</span><div className="input"><Icon name="tag" size={16} /><input value={f.name} onChange={set("name")} autoFocus required /></div></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field"><span>Kiểu</span>
                <Select icon="filter" value={f.type} onChange={setV("type")} ariaLabel="Kiểu khuyến mãi"
                  options={[
                    { value: "percent", label: "Giảm %" },
                    { value: "fixed", label: "Giá cố định" },
                  ]} />
              </label>
              <label className="field"><span>{f.type === "percent" ? "% giảm" : "Giá cố định (₫)"}</span><div className="input"><Icon name="coins" size={16} /><MoneyInput value={f.value} onChange={(v) => setF({ ...f, value: v })} required /></div></label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field"><span>Bắt đầu (tùy chọn)</span>
                <DateField value={f.startAt} onChange={(v) => setF({ ...f, startAt: v })} placeholder="Chọn ngày bắt đầu" />
              </label>
              <label className="field"><span>Kết thúc (tùy chọn)</span>
                <DateField value={f.endAt} onChange={(v) => setF({ ...f, endAt: v })} placeholder="Chọn ngày kết thúc" />
              </label>
            </div>
            <div className="field"><span style={{ marginBottom: 6 }}>Áp dụng cho SKU ({picked.size})</span>
              <div style={{ maxHeight: 180, overflow: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: "0 12px" }}>
                {products.map((p) => {
                  const on = picked.has(p.id);
                  return (
                    <div key={p.id} onClick={() => toggle(p.id)} className={"cost-line" + (on ? "" : " off")} style={{ cursor: "pointer" }}>
                      <span className={"cost-chk" + (on ? " on" : "")}><Icon name={on ? "check" : "plus"} size={15} /></span>
                      <span className="nm">{p.name} <span className="pm mono">{p.sku}</span></span>
                      <span className="mono cell-sub">{fmt(p.listPrice)}₫</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : (isEdit ? "Lưu" : "Tạo khuyến mãi")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Promotions;
