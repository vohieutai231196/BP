/* ============================================================
   GomĐơn — Thẻ kho theo SKU + điều chỉnh tồn (GĐ1)
   Drawer lịch sử nhập-xuất-điều chỉnh; modal chỉnh tồn về số thực tế.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const dt = (s) => new Date(s).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const TYPE_LABEL = { in: "Nhập", out: "Xuất", adjust: "Điều chỉnh", return: "Trả hàng" };
const TYPE_COLOR = { in: "var(--st-green)", out: "var(--st-red)", adjust: "var(--st-amber)", return: "var(--st-green)" };

export function StockDrawer({ product, onClose, onToast, onChanged }) {
  const [data, setData] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [adjusting, setAdjusting] = React.useState(false);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    api.retail.productMovements(product.id, { page, pageSize: 20 })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) onToast && onToast("Lỗi: " + e.message); });
    return () => { alive = false; };
  }, [product.id, page, reload]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 620, width: "96%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="warehouse" size={18} /></div>
          <div><h3>Thẻ kho — {product.sku}</h3>
            <div className="mh-sub">{product.name} · tồn hiện tại {fmt(product.stock)}</div></div></div>
        <div className="modal-body">
          {!data ? <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div> : (
            <>
              {data.items.length === 0 && <div className="pm">Chưa có biến động kho nào.</div>}
              {data.items.length > 0 && (
                <table className="tbl">
                  <thead><tr><th>Thời gian</th><th>Loại</th><th style={{ textAlign: "right" }}>SL ±</th>
                    <th style={{ textAlign: "right" }} className="hide-mobile">Giá vốn</th><th>Tham chiếu</th></tr></thead>
                  <tbody>{data.items.map((m) => (
                    <tr key={m.id}>
                      <td className="pm">{dt(m.at)}</td>
                      <td><span style={{ color: TYPE_COLOR[m.type] || "inherit" }}>{TYPE_LABEL[m.type] || m.type}</span></td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: m.qty < 0 ? "var(--st-red)" : "var(--st-green)" }}>
                        {m.qty > 0 ? "+" : ""}{fmt(m.qty)}</td>
                      <td className="cell-money hide-mobile">{fmt(m.unitCost)}₫</td>
                      <td className="pm">{m.refLabel || m.note || "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
              {data.pages > 1 && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: 8 }}>
                  <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                  <span className="pm" style={{ alignSelf: "center" }}>{data.page}/{data.pages}</span>
                  <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>›</button>
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={() => setAdjusting(true)}><Icon name="filter" size={14} /> Điều chỉnh tồn</button>
          <button className="btn" onClick={onClose}>Đóng</button>
        </div>
        {adjusting && <AdjustModal product={product} onToast={onToast}
          onClose={() => setAdjusting(false)}
          onDone={(msg) => { onToast && onToast(msg); setAdjusting(false); setReload((k) => k + 1); onChanged && onChanged(); }} />}
      </div>
    </div>
  );
}

const REASONS = ["Kiểm kê", "Hỏng", "Mất", "Khác"];

export function AdjustModal({ product, onClose, onDone, onToast }) {
  const [actual, setActual] = React.useState(String(product.stock ?? 0));
  const [reason, setReason] = React.useState(REASONS[0]);
  const [other, setOther] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const delta = (Number(actual) || 0) - Number(product.stock ?? 0);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api.retail.adjustStock({
        productId: product.id,
        actualQty: Math.max(0, Math.round(Number(actual) || 0)),
        reason: reason === "Khác" ? (other || "Khác") : reason,
      });
      onDone(r.delta === 0 ? "Tồn không đổi." : `Đã điều chỉnh ${product.sku}: ${r.oldQty} → ${r.newQty}.`);
    } catch (e) { onToast && onToast("Lỗi: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: "94%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="filter" size={18} /></div>
          <div><h3>Điều chỉnh tồn</h3><div className="mh-sub">{product.sku} · hệ thống: {fmt(product.stock)}</div></div></div>
        <div className="modal-body">
          <label className="field"><span>Số lượng thực tế</span>
            <input className="num-inp" type="number" min="0" value={actual} autoFocus
              onChange={(e) => setActual(e.target.value)} /></label>
          <div className="pm" style={{ margin: "6px 0 10px", color: delta === 0 ? "inherit" : delta > 0 ? "var(--st-green)" : "var(--st-red)" }}>
            Chênh lệch: {delta > 0 ? "+" : ""}{fmt(delta)}
          </div>
          <label className="field"><span>Lý do</span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {REASONS.map((r) => (
                <label key={r} style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 13 }}>
                  <input type="radio" checked={reason === r} onChange={() => setReason(r)} /> {r}
                </label>
              ))}
            </div></label>
          {reason === "Khác" && (
            <input className="num-inp" style={{ width: "100%", textAlign: "left", marginTop: 6 }}
              placeholder="Lý do cụ thể" value={other} onChange={(e) => setOther(e.target.value)} />
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={busy} onClick={submit}>{busy ? "Đang lưu…" : "Xác nhận"}</button>
        </div>
      </div>
    </div>
  );
}

export default StockDrawer;
