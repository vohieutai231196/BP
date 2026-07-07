/* ============================================================
   GomĐơn — Nhập hàng (GĐ1)
   Danh sách phiếu nhập (mọi nguồn) + tạo phiếu thủ công/tồn đầu kỳ
   (chọn/tạo NCC inline, dòng hàng SKU có sẵn hoặc tạo mới, import file).
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { ReceiveModal } from "./receive.jsx";
import { MoneyInput, EmptyState } from "./components.jsx";
import { Select } from "./ui-controls.jsx";
import { useRefresh } from "./refresh.js";

const fmt = (n) => Number(n || 0).toLocaleString("vi-VN");
const dt = (s) => new Date(s).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
const SOURCE_LABEL = { order: "Đơn TQ", manual: "Nhập NCC", opening: "Tồn đầu kỳ" };

export function Receipts({ onToast, onOpenOrder }) {
  const { version, refresh } = useRefresh();
  const [data, setData] = React.useState(null);
  const [page, setPage] = React.useState(1);
  const [source, setSource] = React.useState("");
  const [err, setErr] = React.useState(null);
  const [creating, setCreating] = React.useState(false);
  const [receiving, setReceiving] = React.useState(false);
  const [detail, setDetail] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    api.retail.receipts({ page, pageSize: 20, source: source || undefined })
      .then((d) => { if (alive) { setData(d); setErr(null); } })
      .catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [page, source, version]);

  const openDetail = async (id) => {
    try { setDetail(await api.retail.receipt(id)); }
    catch (e) { onToast && onToast("Lỗi: " + e.message); }
  };

  return (
    <div>
      <div className="toolbar" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <Select value={source} onChange={setSource} style={{ width: 160 }}
          options={[{ value: "", label: "Mọi nguồn" }, { value: "order", label: "Đơn TQ" }, { value: "manual", label: "Nhập NCC" }, { value: "opening", label: "Tồn đầu kỳ" }]} />
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => setReceiving(true)}>
          <Icon name="download" size={15} /> Nhận từ đơn mua hộ
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          <Icon name="plus" size={15} /> Tạo phiếu nhập
        </button>
      </div>

      {err && <div className="card empty"><Icon name="close" size={40} /><div>Lỗi: {err}</div></div>}
      {!data && !err && <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>}

      {data && data.items.length === 0 && (
        <EmptyState icon="warehouse" title="Chưa có phiếu nhập nào"
          hint="Tạo phiếu nhập thủ công, khai tồn đầu kỳ, hoặc nhận từ đơn mua hộ." />
      )}

      {data && data.items.length > 0 && (
        <div className="card" style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr>
              <th>Mã phiếu</th><th>Nguồn</th><th>NCC / Đơn</th><th className="hide-mobile">Ghi chú</th>
              <th style={{ textAlign: "right" }}>SL</th><th style={{ textAlign: "right" }}>Tổng tiền</th><th>Ngày</th>
            </tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} onClick={() => openDetail(r.id)} style={{ cursor: "pointer" }}>
                  <td className="mono">{r.code}</td>
                  <td><span className="chip">{SOURCE_LABEL[r.source] || r.source}</span></td>
                  <td>{r.source === "order"
                    ? <a onClick={(e) => { e.stopPropagation(); onOpenOrder && onOpenOrder(r.orderId); }}>#{r.orderId}</a>
                    : (r.supplierName || "—")}</td>
                  <td className="hide-mobile">{r.note || "—"}</td>
                  <td style={{ textAlign: "right" }}>{fmt(r.totalQty)} <span className="pm">({r.skuCount} SKU)</span></td>
                  <td className="cell-money">{fmt(r.totalCost)}₫</td>
                  <td className="pm">{dt(r.receivedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.pages > 1 && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", padding: 10 }}>
              <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
              <span className="pm" style={{ alignSelf: "center" }}>Trang {data.page}/{data.pages}</span>
              <button className="btn btn-sm" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Sau ›</button>
            </div>
          )}
        </div>
      )}

      {creating && <ReceiptModal onClose={() => setCreating(false)} onToast={onToast}
        onDone={(msg) => { onToast && onToast(msg); setCreating(false); refresh(); }} />}
      {receiving && <ReceiveModal onClose={() => setReceiving(false)} onToast={onToast}
        onDone={(msg) => { onToast && onToast(msg); setReceiving(false); refresh(); }} />}
      {detail && <ReceiptDetailDrawer receipt={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

/* ----- Drawer chi tiết phiếu ----- */
function ReceiptDetailDrawer({ receipt, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, width: "94%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="box" size={18} /></div>
          <div><h3>{receipt.code}</h3>
            <div className="mh-sub">{SOURCE_LABEL[receipt.source] || receipt.source}
              {receipt.supplierName ? ` · ${receipt.supplierName}` : ""} · {dt(receipt.receivedAt)}</div></div></div>
        <div className="modal-body">
          {receipt.note && <div className="pm" style={{ marginBottom: 8 }}>{receipt.note}</div>}
          <table className="tbl">
            <thead><tr><th>SKU</th><th>Tên</th><th style={{ textAlign: "right" }}>SL</th><th style={{ textAlign: "right" }}>Giá vốn/đv</th></tr></thead>
            <tbody>{receipt.items.map((it, i) => (
              <tr key={i}><td className="mono">{it.sku}</td><td>{it.name}</td>
                <td style={{ textAlign: "right" }}>{fmt(it.qty)}</td><td className="cell-money">{fmt(it.unitCost)}₫</td></tr>
            ))}</tbody>
          </table>
          <div style={{ textAlign: "right", marginTop: 10, fontWeight: 600 }}>Tổng: {fmt(receipt.totalCost)}₫</div>
        </div>
        <div className="modal-foot"><button className="btn" onClick={onClose}>Đóng</button></div>
      </div>
    </div>
  );
}

/* ----- Modal tạo phiếu nhập thủ công / tồn đầu kỳ ----- */
const BLANK_LINE = { mode: "existing", productId: null, sku: "", name: "", qty: 1, unitCost: 0 };

export function ReceiptModal({ onClose, onDone, onToast }) {
  const [source, setSource] = React.useState("manual");   // manual | opening
  const [suppliers, setSuppliers] = React.useState([]);
  const [supplierId, setSupplierId] = React.useState("");
  const [newSupplier, setNewSupplier] = React.useState(""); // tên NCC tạo nhanh
  const [addingSup, setAddingSup] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const [note, setNote] = React.useState("");
  const [lines, setLines] = React.useState([{ ...BLANK_LINE }]);
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef(null);

  React.useEffect(() => {
    api.retail.suppliers({ activeOnly: true }).then(setSuppliers).catch(() => {});
    api.retail.products({}).then((d) => setProducts(d || [])).catch(() => {});
  }, []);

  const setLine = (i, patch) => setLines((xs) => xs.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const addLine = () => setLines((xs) => [...xs, { ...BLANK_LINE }]);
  const rmLine = (i) => setLines((xs) => xs.filter((_, idx) => idx !== i));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);

  const createSupplier = async () => {
    if (!newSupplier.trim()) return;
    try {
      const s = await api.retail.createSupplier({ name: newSupplier.trim() });
      setSuppliers((xs) => [...xs, s]); setSupplierId(String(s.id));
      setNewSupplier(""); setAddingSup(false);
    } catch (e) { onToast && onToast("Lỗi: " + e.message); }
  };

  // Import CSV/XLSX: cột SKU | Tên | SL | Giá vốn (dòng đầu là header, bỏ qua nếu SL không phải số)
  const importFile = async (file) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
      const skuIndex = new Map(products.map((p) => [String(p.sku).toLowerCase(), p.id]));
      const imported = [];
      for (const r of rows) {
        const [sku, name, qty, cost] = [String(r[0] || "").trim(), String(r[1] || "").trim(), Number(r[2]), Number(r[3])];
        if (!sku || !Number.isFinite(qty) || qty <= 0) continue;   // bỏ header/dòng rác
        const pid = skuIndex.get(sku.toLowerCase()) || null;
        imported.push({
          mode: pid ? "existing" : "new", productId: pid, sku, name: name || sku,
          qty: Math.round(qty), unitCost: Number.isFinite(cost) ? Math.max(0, Math.round(cost)) : 0,
        });
      }
      if (imported.length === 0) { onToast && onToast("File không có dòng hợp lệ (cột: SKU, Tên, SL, Giá vốn)."); return; }
      setLines(imported);
      onToast && onToast(`Đã nạp ${imported.length} dòng từ file.`);
    } catch (e) { onToast && onToast("Không đọc được file: " + e.message); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const body = {
        source,
        supplierId: source === "manual" ? Number(supplierId) || null : null,
        note: note || null,
        items: lines.map((l) => ({
          productId: l.mode === "existing" ? Number(l.productId) || null : null,
          newProduct: l.mode === "new" ? { sku: l.sku, name: l.name || l.sku, category: "other", listPrice: null } : null,
          qty: Math.max(1, Math.round(Number(l.qty) || 0)),
          unitCost: Math.max(0, Math.round(Number(l.unitCost) || 0)),
        })),
      };
      const r = await api.retail.createReceipt(body);
      onDone(`Đã tạo phiếu ${r.code} (${r.lineCount} dòng).`);
    } catch (e) { onToast && onToast("Lỗi: " + e.message); }
    finally { setBusy(false); }
  };

  const canSubmit = lines.length > 0
    && lines.every((l) => (l.mode === "existing" ? l.productId : l.sku.trim()) && Number(l.qty) > 0)
    && (source === "opening" || supplierId);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 720, width: "96%" }}>
        <div className="modal-head"><div className="mh-ic"><Icon name="plus" size={18} /></div>
          <div><h3>Tạo phiếu nhập</h3><div className="mh-sub">Nhập từ NCC hoặc khai tồn đầu kỳ / hàng tự có</div></div></div>
        <div className="modal-body">
          {/* Nguồn phiếu */}
          <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
            <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
              <input type="radio" checked={source === "manual"} onChange={() => setSource("manual")} /> Nhập từ NCC
            </label>
            <label style={{ display: "flex", gap: 5, alignItems: "center", fontSize: 13 }}>
              <input type="radio" checked={source === "opening"} onChange={() => setSource("opening")} /> Tồn đầu kỳ · hàng tự có
            </label>
          </div>

          {source === "manual" && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 10 }}>
              <label className="field" style={{ flex: 1 }}><span>Nhà cung cấp</span>
                <Select value={supplierId} onChange={setSupplierId}
                  options={[{ value: "", label: "— Chọn NCC —" },
                    ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]} /></label>
              {!addingSup
                ? <button className="btn btn-sm" onClick={() => setAddingSup(true)}><Icon name="plus" size={14} /> Thêm NCC</button>
                : (<>
                    <input className="num-inp" style={{ width: 160, textAlign: "left" }} placeholder="Tên NCC mới"
                      value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") createSupplier(); }} autoFocus />
                    <button className="btn btn-sm btn-primary" onClick={createSupplier}>Lưu</button>
                  </>)}
            </div>
          )}

          <label className="field" style={{ marginBottom: 10 }}><span>Ghi chú</span>
            <div className="input"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="tuỳ chọn" /></div></label>

          {/* Dòng hàng */}
          {lines.map((l, i) => (
            <div key={i} className="cost-line" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="pm">#{i + 1}</span>
                <span style={{ flex: 1 }} />
                <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="radio" checked={l.mode === "existing"} onChange={() => setLine(i, { mode: "existing" })} /> SKU có sẵn
                </label>
                <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center" }}>
                  <input type="radio" checked={l.mode === "new"} onChange={() => setLine(i, { mode: "new" })} /> Tạo SKU mới
                </label>
                <button className="btn btn-sm" onClick={() => rmLine(i)} title="Xoá dòng"><Icon name="close" size={13} /></button>
              </div>
              {l.mode === "existing" ? (
                <Select value={l.productId ? String(l.productId) : ""} onChange={(v) => setLine(i, { productId: v })}
                  options={[{ value: "", label: "— Chọn sản phẩm —" },
                    ...products.map((p) => ({ value: String(p.id), label: `${p.sku} · ${p.name} (tồn ${p.stock ?? 0})` }))]} />
              ) : (
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="num-inp" value={l.sku} onChange={(e) => setLine(i, { sku: e.target.value })}
                    placeholder="SKU" style={{ width: 140, textAlign: "left" }} />
                  <input className="num-inp" value={l.name} onChange={(e) => setLine(i, { name: e.target.value })}
                    placeholder="Tên sản phẩm" style={{ flex: 1, textAlign: "left" }} />
                </div>
              )}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
                <label className="field" style={{ width: 90 }}><span>SL</span>
                  <input className="num-inp" type="number" min="1" value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value })} /></label>
                <label className="field" style={{ width: 150 }}><span>Giá vốn/đv</span>
                  <MoneyInput className="num-inp" value={l.unitCost} onChange={(v) => setLine(i, { unitCost: v })} /></label>
                <span className="pm" style={{ marginLeft: "auto" }}>= {fmt((Number(l.qty) || 0) * (Number(l.unitCost) || 0))}₫</span>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="btn btn-sm" onClick={addLine}><Icon name="plus" size={14} /> Thêm dòng</button>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
              <Icon name="download" size={14} /> Import file (CSV/XLSX)
            </button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = ""; }} />
            <span style={{ marginLeft: "auto", fontWeight: 600 }}>Tổng phiếu: {fmt(total)}₫</span>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" disabled={busy || !canSubmit} onClick={submit}>
            {busy ? "Đang lưu…" : "Xác nhận nhập kho"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Receipts;
