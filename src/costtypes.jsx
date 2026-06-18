/* ============================================================
   GomĐơn — Phụ phí (loại chi phí phát sinh)
   Danh mục dùng trong Máy tính giá & Đơn bán: ship, bao bì, băng keo,
   in đơn… Mỗi loại có giá gợi ý mặc định + đơn vị (₫ cố định / % giá).
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { MoneyInput, costUnitPrice } from "./components.jsx";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const unitLabel = (u) => (u === "percent" ? "% theo giá" : u === "pack" ? "Theo lô" : "₫ cố định");

export function CostTypes({ onToast }) {
  const [all, setAll] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const [reload, setReload] = React.useState(0);
  const [editing, setEditing] = React.useState(null); // {} new | costType edit
  const [confirm, setConfirm] = React.useState(null);

  React.useEffect(() => {
    let alive = true; setLoading(true); setErr(null);
    api.retail.costTypes({})
      .then((d) => { if (alive) setAll(d || []); })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload]);

  const refresh = () => setReload((r) => r + 1);
  const run = async (fn, msg) => {
    try { await fn(); onToast && onToast(msg); setEditing(null); setConfirm(null); refresh(); }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
  };

  return (
    <div className="fade-in">
      <div className="toolbar">
        <h2 className="section-title">Loại chi phí phát sinh</h2>
        <span className="spacer" />
        <button className="btn btn-sm btn-primary" onClick={() => setEditing({})}>
          <Icon name="plus" size={15} /> Thêm phụ phí
        </button>
      </div>

      {loading ? (
        <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>
      ) : err ? (
        <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>
      ) : all.length === 0 ? (
        <div className="card empty"><Icon name="wallet" size={40} /><div>Chưa có phụ phí. Bấm “Thêm phụ phí” (ship, bao bì, băng keo, in đơn…).</div></div>
      ) : (
        <div className="card"><div className="grid-wrap"><table className="dg">
          <thead><tr>
            <th>Tên phụ phí</th>
            <th style={{ textAlign: "right" }}>Giá mặc định</th>
            <th>Đơn vị</th>
            <th>Trạng thái</th>
            <th style={{ textAlign: "right" }}>Thao tác</th>
          </tr></thead>
          <tbody>
            {all.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="cell-prod">
                    <div className="thumb" style={{ background: c.active ? "var(--st-violet)" : "var(--surface-3)", color: c.active ? "#fff" : "var(--muted)" }}><Icon name="wallet" size={18} stroke={1.7} /></div>
                    <div className="pn">{c.name}</div>
                  </div>
                </td>
                <td className="cell-money">
                  {c.unit === "pack"
                    ? fmt(costUnitPrice(c)) + "₫/đv" + (c.defaultAmount == null ? "" : " × " + c.defaultAmount)
                    : c.defaultAmount == null ? "—" : (c.unit === "percent" ? c.defaultAmount + "%" : fmt(c.defaultAmount) + "₫")}
                </td>
                <td className="cell-sub">{unitLabel(c.unit)}</td>
                <td><span className={"badge " + (c.active ? "green" : "slate")}><span className="dot" /> {c.active ? "Đang dùng" : "Tắt"}</span></td>
                <td>
                  <div className="u-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => setEditing(c)}><Icon name="settings" size={15} /> Sửa</button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setConfirm(c)}><Icon name="close" size={15} /> Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      )}

      {editing && <CostTypeModal costType={editing.id ? editing : null} onRun={run} onClose={() => setEditing(null)} />}
      {confirm && (
        <div className="overlay" onClick={() => setConfirm(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="mh-ic"><Icon name="close" size={18} /></div><div><h3>Xóa phụ phí</h3></div></div>
            <div className="modal-body"><div className="mb-text">Xóa <b>{confirm.name}</b>? Các đơn cũ đã ghi không bị ảnh hưởng.</div></div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirm(null)}>Hủy</button>
              <button className="btn btn-primary" style={{ background: "var(--st-red)", borderColor: "var(--st-red)", boxShadow: "none" }}
                onClick={() => run(() => api.retail.deleteCostType(confirm.id), "Đã xóa phụ phí")}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CostTypeModal({ costType, onRun, onClose }) {
  const isEdit = !!costType;
  const [f, setF] = React.useState({
    name: costType?.name || "",
    defaultAmount: costType?.defaultAmount ?? "",
    unit: costType?.unit || "vnd",
    packPrice: costType?.packPrice ?? "",
    packSize: costType?.packSize ?? "",
    active: costType?.active ?? true,
  });
  const [busy, setBusy] = React.useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const num = (v) => (v === "" || v == null ? null : Math.max(0, Math.round(Number(v) || 0)));

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    const body = { name: f.name, defaultAmount: num(f.defaultAmount), unit: f.unit };
    if (f.unit === "pack") {
      body.packPrice = num(f.packPrice) ?? 0;
      body.packSize = Math.max(1, num(f.packSize) ?? 1);
    }
    if (isEdit) await onRun(() => api.retail.updateCostType(costType.id, { ...body, active: f.active }), "Đã lưu phụ phí");
    else await onRun(() => api.retail.createCostType(body), "Đã thêm phụ phí");
    setBusy(false);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="mh-ic"><Icon name={isEdit ? "settings" : "plus"} size={18} /></div>
          <div><h3>{isEdit ? "Sửa phụ phí" : "Thêm phụ phí"}</h3>
            <div className="mh-sub">Dùng trong Máy tính giá &amp; Đơn bán</div></div>
        </div>
        <form onSubmit={submit}>
          <div className="modal-body">
            <label className="field"><span>Tên phụ phí</span>
              <div className="input"><Icon name="wallet" size={16} /><input value={f.name} onChange={set("name")} autoFocus required placeholder="VD: Fee ship, Bao bì…" /></div></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="field"><span>{f.unit === "percent" ? "% mặc định" : f.unit === "pack" ? "Số lượng mặc định" : "Giá mặc định (₫)"}</span>
                {f.unit === "pack" ? (
                  <div className="input"><Icon name="coins" size={16} /><input type="number" min="0" inputMode="numeric" className="num-inp" style={{ width: "100%" }} value={f.defaultAmount} onChange={set("defaultAmount")} placeholder="tùy chọn" /></div>
                ) : (
                  <div className="input"><Icon name="coins" size={16} /><MoneyInput value={f.defaultAmount} onChange={(v) => setF({ ...f, defaultAmount: v })} placeholder="tùy chọn" /></div>
                )}</label>
              <label className="field"><span>Đơn vị</span>
                <div className="input"><Icon name="filter" size={16} />
                  <select className="sel" value={f.unit} onChange={set("unit")}>
                    <option value="vnd">₫ cố định</option>
                    <option value="percent">% theo giá</option>
                    <option value="pack">Theo lô (giá lô ÷ quy cách)</option>
                  </select></div></label>
            </div>
            {f.unit === "pack" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <label className="field"><span>Giá lô (₫)</span>
                    <div className="input"><Icon name="coins" size={16} /><MoneyInput value={f.packPrice} onChange={(v) => setF({ ...f, packPrice: v })} placeholder="VD: 50.000" /></div></label>
                  <label className="field"><span>Số đơn vị/lô</span>
                    <div className="input"><Icon name="box" size={16} /><input className="num-inp" inputMode="numeric" style={{ width: "100%" }} value={f.packSize} onChange={(e) => setF({ ...f, packSize: e.target.value.replace(/\D/g, "") })} placeholder="VD: 100" /></div></label>
                </div>
                <div className="cell-sub" style={{ fontSize: 12, padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8 }}>
                  Đơn giá = {Number(f.packPrice || 0).toLocaleString("vi-VN")} ÷ {Number(f.packSize || 0).toLocaleString("vi-VN")} = <b>{costUnitPrice({ unit: "pack", packPrice: Number(f.packPrice) || 0, packSize: Number(f.packSize) || 0 }).toLocaleString("vi-VN")}₫</b>/đơn vị
                </div>
              </>
            )}
            {isEdit && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5 }}>
                <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Đang dùng (hiện trong danh sách chọn)
              </label>
            )}
            <div className="cell-sub" style={{ fontSize: 11.5 }}>Giá mặc định chỉ là gợi ý — khi dùng vẫn sửa/bỏ được từng lần. “%” tính theo % của giá (vốn ở Máy tính giá, doanh thu ở Đơn bán).</div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={onClose}>Hủy</button>
            <button className="btn btn-primary" disabled={busy}>{busy ? "Đang lưu…" : (isEdit ? "Lưu" : "Thêm phụ phí")}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CostTypes;
