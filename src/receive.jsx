/* ============================================================
   GomĐơn — Nhận đơn mua hộ vào kho
   Nhập mã đơn → preview (tự khớp SKU + phân bổ giá vốn) → sửa → xác nhận.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");

export function ReceiveModal({ onClose, onDone, onToast }) {
  const [orderId, setOrderId] = React.useState("");
  const [preview, setPreview] = React.useState(null);
  const [lines, setLines] = React.useState([]);
  const [busy, setBusy] = React.useState(false);

  const loadPreview = async () => {
    if (!orderId) return;
    setBusy(true);
    try {
      const p = await api.retail.receivePreview(orderId);
      setPreview(p);
      setLines(p.lines.map((l) => ({
        orderLinkId: l.orderLinkId, linkCode: l.linkCode,
        mode: l.suggestedProductId ? "existing" : "new",
        productId: l.suggestedProductId || null,
        newSku: l.suggestedSku, newName: l.suggestedName, category: "other",
        imageUrl: l.imageUrl, qty: l.qty, unitCost: l.unitCost,
      })));
    } catch (e) { onToast && onToast("Lỗi: " + e.message); }
    finally { setBusy(false); }
  };

  const setLine = (i, k, v) => setLines((xs) => xs.map((x, idx) => idx === i ? { ...x, [k]: v } : x));

  const confirm = async () => {
    setBusy(true);
    const body = {
      orderId: Number(orderId),
      lines: lines.map((l) => ({
        orderLinkId: l.orderLinkId, linkCode: l.linkCode,
        productId: l.mode === "existing" ? Number(l.productId) : null,
        newSku: l.mode === "new" ? l.newSku : null,
        newName: l.mode === "new" ? l.newName : null,
        category: l.category, imageUrl: l.imageUrl,
        qty: Math.max(1, Math.round(Number(l.qty) || 0)),
        unitCost: Math.max(0, Math.round(Number(l.unitCost) || 0)),
      })),
    };
    try { const r = await api.retail.receiveConfirm(body); onDone(`Đã nhận ${r.received} dòng vào kho`); }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: "94%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="download" size={18} /></div><div><h3>Nhận đơn vào kho</h3>
          {preview && <div className="mh-sub">Đơn #{preview.orderId} · phí chung {fmt(preview.sharedCost)}₫</div>}</div></div>
        <div className="modal-body">
          {!preview ? (
            <label className="field"><span>Mã đơn mua hộ</span>
              <div className="input"><Icon name="box" size={16} />
                <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="vd 647940" autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") loadPreview(); }} /></div></label>
          ) : (
            lines.map((l, i) => (
              <div key={i} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono pm">{l.linkCode}</span>
                  <span className="spacer" style={{ flex: 1 }} />
                  <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="radio" checked={l.mode === "existing"} disabled={!l.productId} onChange={() => setLine(i, "mode", "existing")} /> Gắn SKU có
                  </label>
                  <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                    <input type="radio" checked={l.mode === "new"} onChange={() => setLine(i, "mode", "new")} /> Tạo SKU mới
                  </label>
                </div>
                {l.mode === "new" ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    <input value={l.newSku} onChange={(e) => setLine(i, "newSku", e.target.value)} placeholder="SKU" style={inp(120)} />
                    <input value={l.newName} onChange={(e) => setLine(i, "newName", e.target.value)} placeholder="Tên" style={inp(0, true)} />
                  </div>
                ) : (
                  <div className="pm" style={{ marginTop: 6 }}>SKU #{l.productId}</div>
                )}
                <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center" }}>
                  <label style={{ fontSize: 12, color: "var(--muted)" }}>SL nhận
                    <input type="number" min="1" value={l.qty} onChange={(e) => setLine(i, "qty", e.target.value)} className="mono" style={{ ...inp(64), marginLeft: 6 }} /></label>
                  <label style={{ fontSize: 12, color: "var(--muted)" }}>Giá vốn/đv
                    <input type="number" min="0" value={l.unitCost} onChange={(e) => setLine(i, "unitCost", e.target.value)} className="mono" style={{ ...inp(110), marginLeft: 6 }} /></label>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Hủy</button>
          {!preview
            ? <button className="btn btn-primary" disabled={busy || !orderId} onClick={loadPreview}>{busy ? "Đang tải…" : "Xem trước"}</button>
            : <button className="btn btn-primary" disabled={busy || lines.length === 0} onClick={confirm}>{busy ? "Đang nhận…" : "Xác nhận nhận kho"}</button>}
        </div>
      </div>
    </div>
  );
}

function inp(w, grow) {
  return { width: grow ? "auto" : w, flex: grow ? 1 : "none", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "6px 8px", color: "inherit" };
}

export default ReceiveModal;
