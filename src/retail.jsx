/* ============================================================
   GomĐơn — Kho & Sản phẩm (bán lẻ)
   Danh sách SKU + lọc trạng thái, tạo/sửa/xóa sản phẩm.
   GĐ1: giá vốn nhập tay; tồn kho hiển thị ở GĐ2.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import { ReceiveModal } from "./receive.jsx";
import { MoneyInput, costUnitPrice, EmptyState, ProdName, ProductImg } from "./components.jsx";
import { Select } from "./ui-controls.jsx";
import { currentQuery, replaceUrl } from "./routes.js";
import { useRefresh } from "./refresh.js";

const STATUS = {
  active: { label: "Đang bán", color: "green" },
  hidden: { label: "Ẩn", color: "slate" },
};
const TABS = [
  { key: "", label: "Tất cả" },
  { key: "active", label: "Đang bán" },
  { key: "hidden", label: "Ẩn" },
  { key: "trash", label: "Thùng rác" },
];
const CATS = ["shoe", "bag", "apparel", "tech", "home", "beauty", "other"];
const fmt = (n) => (n == null ? "—" : Number(n).toLocaleString("vi-VN") + "₫");
const fmtDate = (s) => { try { return new Date(s).toLocaleDateString("vi-VN"); } catch { return s; } };

// Tóm tắt kết quả xóa hàng loạt (BulkDeleteResult) thành 1 câu toast.
const bulkMsg = (r) => {
  const parts = [];
  if (r?.deleted) parts.push(`đã xóa ${r.deleted}`);
  if (r?.hidden) parts.push(`ẩn ${r.hidden} (còn lịch sử bán)`);
  if (r?.blocked?.length) parts.push(`${r.blocked.length} bị chặn (đang dùng)`);
  return parts.length ? "Hoàn tất: " + parts.join(", ") + "." : "Không có sản phẩm nào được xóa.";
};

export function Inventory({ onToast, onOpenOrder }) {
  const [tab, setTab] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [all, setAll] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState(null);
  const { version: reload, refresh } = useRefresh();
  const [editing, setEditing] = React.useState(null); // null | {} (new) | product (edit)
  const [confirm, setConfirm] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [receiving, setReceiving] = React.useState(false);
  const [orderFilter, setOrderFilter] = React.useState(() => {
    const v = currentQuery("order");
    return v ? Number(v) : null;
  });
  const clearOrderFilter = () => { setOrderFilter(null); replaceUrl("/inventory"); };
  const [groupMode, setGroupMode] = React.useState("list"); // list | grouped
  const [trash, setTrash] = React.useState(null);           // SKU đã xóa mềm (thùng rác)
  const [sel, setSel] = React.useState(() => new Set());    // id sản phẩm đã chọn (xóa nhiều)
  const [bulkConfirm, setBulkConfirm] = React.useState(false);
  React.useEffect(() => { api.retail.summary().then(setSummary).catch(() => {}); }, [reload]);

  React.useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    api.retail.products(orderFilter ? { orderId: orderFilter } : {})
      .then((d) => { if (alive) { setAll(d || []); setSel(new Set()); } })
      .catch((e) => { if (alive) setErr(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [reload, orderFilter]);

  React.useEffect(() => {
    api.retail.products({ deleted: true }).then((d) => setTrash(d || [])).catch(() => setTrash([]));
  }, [reload]);

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
  const restore = (p) => run(() => api.retail.restoreProduct(p.id), "Đã khôi phục " + p.sku);

  // ----- chọn nhiều để xóa -----
  const selRows = rows.filter((p) => sel.has(p.id));
  const allSelected = rows.length > 0 && selRows.length === rows.length;
  const toggleSel = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSel((s) => {
    const n = new Set(s);
    if (rows.every((p) => n.has(p.id))) rows.forEach((p) => n.delete(p.id));
    else rows.forEach((p) => n.add(p.id));
    return n;
  });
  const doBulkDelete = async () => {
    try {
      const r = await api.retail.bulkDeleteProducts(selRows.map((p) => p.id));
      onToast && onToast(bulkMsg(r));
    } catch (e) { onToast && onToast("Lỗi: " + e.message); }
    setBulkConfirm(false); setSel(new Set()); refresh();
  };

  return (
    <div className="fade-in">
      {summary && (
        <div className="kpi-grid" style={{ marginBottom: 16 }}>
          <div className="card kpi" style={{ "--kc": "var(--st-blue)" }}>
            <div className="kpi-label"><Icon name="box" size={14} stroke={2} /> Tổng SKU</div>
            <div className="kpi-val">{summary.totalSkus}</div>
          </div>
          <div className="card kpi" style={{ "--kc": "var(--st-green)" }}>
            <div className="kpi-label"><Icon name="warehouse" size={14} stroke={2} /> Tồn kho</div>
            <div className="kpi-val">{Number(summary.totalStock).toLocaleString("vi-VN")}</div>
          </div>
          <div className="card kpi" style={{ "--kc": "var(--st-violet)" }}>
            <div className="kpi-label"><Icon name="coins" size={14} stroke={2} /> Giá trị tồn</div>
            <div className="kpi-val">{Number(summary.stockValue).toLocaleString("vi-VN")}<small>₫</small></div>
          </div>
          <div className="card kpi" style={{ "--kc": "var(--st-amber)" }}>
            <div className="kpi-label"><Icon name="clock" size={14} stroke={2} /> SKU sắp hết</div>
            <div className="kpi-val">{summary.lowStockCount}</div>
          </div>
        </div>
      )}
      <div className="toolbar">
        <div className="chips">
          {TABS.map((t) => (
            <button key={t.key} className={"chip" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
              {t.label}<span className="cc">{t.key === "trash" ? (trash?.length || 0) : (counts[t.key] || 0)}</span>
            </button>
          ))}
        </div>
        <div className="seg">
          <button className={"seg-item" + (groupMode === "list" ? " active" : "")} onClick={() => setGroupMode("list")}>Danh sách</button>
          <button className={"seg-item" + (groupMode === "grouped" ? " active" : "")} onClick={() => setGroupMode("grouped")}>Nhóm theo đơn</button>
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

      {orderFilter && (
        <div className="filter-banner">
          <Icon name="filter" size={15} />
          <span>Đang lọc theo đơn <b className="mono">#{orderFilter}</b></span>
          <span className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={clearOrderFilter}><Icon name="close" size={14} /> Bỏ lọc</button>
        </div>
      )}

      {groupMode === "grouped" ? (
        <GroupedByOrder onOpenOrder={onOpenOrder} onToast={onToast} />
      ) : tab === "trash" ? (
        <TrashList items={trash} onRestore={restore} />
      ) : loading ? (
        <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>
      ) : err ? (
        <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>
      ) : rows.length === 0 ? (
        <EmptyState icon="warehouse" title="Chưa có sản phẩm" hint="Thêm sản phẩm bán lẻ hoặc nhận đơn mua hộ vào kho để bắt đầu quản lý tồn." actionLabel="Thêm sản phẩm" onAction={() => setEditing({})} />
      ) : (
        <div className="card">
          {selRows.length > 0 && (
            <div className="bulk-bar">
              <span>Đã chọn <b>{selRows.length}</b> sản phẩm</span>
              <span className="spacer" />
              <button className="btn btn-sm btn-ghost" onClick={() => setSel(new Set())}>Bỏ chọn</button>
              <button className="btn btn-sm btn-danger" onClick={() => setBulkConfirm(true)}>
                <Icon name="close" size={14} /> Xóa {selRows.length}
              </button>
            </div>
          )}
          <div className="grid-wrap"><table className="dg prod-grid">
          <thead><tr>
            <th className="chk-col"><input type="checkbox" className="dg-chk" checked={allSelected} ref={(el) => { if (el) el.indeterminate = selRows.length > 0 && !allSelected; }} onChange={toggleAll} aria-label="Chọn tất cả" /></th>
            <th>Sản phẩm</th><th>Danh mục</th><th>Nguồn</th>
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
                <tr key={p.id} className={sel.has(p.id) ? "row-sel" : ""}>
                  <td className="chk-col"><input type="checkbox" className="dg-chk" checked={sel.has(p.id)} onChange={() => toggleSel(p.id)} aria-label={"Chọn " + p.sku} /></td>
                  <td>
                    <div className="cell-prod">
                      <ProductImg imageUrl={p.imageUrl} alt={p.name} />
                      <div style={{ minWidth: 0 }}>
                        <ProdName name={p.name} className="pn" />
                        <div className="pm mono">{p.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="cell-sub">{p.category}</td>
                  <td>
                    {p.sourceOrders && p.sourceOrders.length > 0 ? (
                      <span className="src-chips">
                        <button type="button" className="src-chip"
                          onClick={() => onOpenOrder && onOpenOrder(p.sourceOrders[0].orderId)}>
                          #{p.sourceOrders[0].orderId}
                        </button>
                        {p.sourceOrders.length > 1 && <span className="src-more">+{p.sourceOrders.length - 1}</span>}
                      </span>
                    ) : <span className="cell-sub" style={{ color: "var(--faint)" }}>—</span>}
                  </td>
                  <td className="cell-money" style={{ color: p.stock <= 0 ? "var(--st-red)" : p.stock <= 10 ? "var(--st-amber)" : "inherit" }}>
                    {Number(p.stock ?? 0).toLocaleString("vi-VN")}
                    <span className="stockbar"><i style={{ width: Math.min(100, (Number(p.stock ?? 0) / 120) * 100) + "%", background: p.stock <= 0 ? "var(--st-red)" : p.stock <= 10 ? "var(--st-amber)" : "var(--st-green)" }} /></span>
                  </td>
                  <td className="cell-money">{fmt(p.avgCost)}</td>
                  <td className="cell-money">{fmt(p.listPrice)}</td>
                  <td className="cell-sub" style={{ color: p.costTypeSummary ? "inherit" : "var(--faint)" }}>{p.costTypeSummary || "—"}</td>
                  <td className="cell-money">
                    {pf == null ? "—" : <span className={pf >= 0 ? "pos" : "neg"}>{(pf >= 0 ? "+" : "") + fmt(pf)}</span>}
                  </td>
                  <td>
                    <span className={"badge " + st.color}><span className="dot" /> {st.label}</span>
                    {p.stock <= 0 && <span className="badge red" style={{ marginLeft: 6 }}><span className="dot" /> Hết hàng</span>}
                  </td>
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
      {bulkConfirm && (
        <ConfirmModal title={`Xóa ${selRows.length} sản phẩm`} confirm={`Xóa ${selRows.length} sản phẩm`}
          message={<>Xóa <b>{selRows.length}</b> sản phẩm đã chọn? SKU còn lịch sử bán sẽ được <b>ẩn</b>; SKU đang dùng (đơn chưa trả / trong combo) sẽ <b>bị bỏ qua</b>. Không thể hoàn tác.</>}
          onClose={() => setBulkConfirm(false)} onConfirm={doBulkDelete} />
      )}
      {receiving && <ReceiveModal onClose={() => setReceiving(false)}
        onDone={(msg) => { onToast && onToast(msg); setReceiving(false); refresh(); }} onToast={onToast} />}
    </div>
  );
}

/* ---------- Thùng rác: SKU đã xóa mềm + khôi phục ---------- */
function TrashList({ items, onRestore }) {
  if (items == null) return <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>;
  if (items.length === 0)
    return <EmptyState icon="warehouse" title="Thùng rác trống" hint="Sản phẩm đã xóa (còn lịch sử bán) sẽ nằm ở đây để khôi phục lại." />;
  return (
    <div className="card"><div className="grid-wrap"><table className="dg prod-grid">
      <thead><tr>
        <th>Sản phẩm</th><th>Danh mục</th><th>Nguồn</th>
        <th style={{ textAlign: "right" }}>Tồn</th>
        <th style={{ textAlign: "right" }}>Giá vốn TB</th>
        <th style={{ textAlign: "right" }}>Thao tác</th>
      </tr></thead>
      <tbody>
        {items.map((p) => (
          <tr key={p.id}>
            <td>
              <div className="cell-prod">
                <ProductImg imageUrl={p.imageUrl} alt={p.name} tint="var(--st-slate)" />
                <div style={{ minWidth: 0 }}>
                  <ProdName name={p.name} className="pn" />
                  <div className="pm mono">{p.sku}</div>
                </div>
              </div>
            </td>
            <td className="cell-sub">{p.category}</td>
            <td>{p.sourceOrders && p.sourceOrders.length > 0
              ? <span className="src-chip static">#{p.sourceOrders[0].orderId}</span>
              : <span className="cell-sub" style={{ color: "var(--faint)" }}>—</span>}</td>
            <td className="cell-money">{Number(p.stock ?? 0).toLocaleString("vi-VN")}</td>
            <td className="cell-money">{fmt(p.avgCost)}</td>
            <td>
              <div className="u-actions">
                <button className="btn btn-sm btn-ghost" onClick={() => onRestore(p)}>
                  <Icon name="refresh" size={15} /> Khôi phục
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table></div></div>
  );
}

/* ---------- Nhóm theo đơn nhập (B) ---------- */
function GroupedByOrder({ onOpenOrder, onToast }) {
  const [groups, setGroups] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [open, setOpen] = React.useState({});     // { [orderId]: bool }
  const [items, setItems] = React.useState({});   // { [orderId]: ProductList }
  const { version: reload, refresh } = useRefresh();
  const [del, setDel] = React.useState(null);     // lô (group) đang chờ xác nhận xóa

  React.useEffect(() => {
    let alive = true;
    api.retail.imports()
      .then((d) => { if (alive) setGroups(d || []); })
      .catch((e) => { if (alive) setErr(e.message); });
    return () => { alive = false; };
  }, [reload]);

  const toggle = async (oid) => {
    setOpen((o) => ({ ...o, [oid]: !o[oid] }));
    if (items[oid] === undefined) {
      try { const d = await api.retail.products({ orderId: oid }); setItems((m) => ({ ...m, [oid]: d || [] })); }
      catch { setItems((m) => ({ ...m, [oid]: [] })); }
    }
  };

  // Xóa cả lô: lấy id SP của đơn (đã tải hoặc tải nóng) → bulk delete → tải lại danh sách lô.
  const removeGroup = async (g) => {
    let list = items[g.orderId];
    if (list === undefined) list = await api.retail.products({ orderId: g.orderId }).catch(() => []);
    try {
      const r = await api.retail.bulkDeleteProducts((list || []).map((p) => p.id));
      onToast && onToast(bulkMsg(r));
    } catch (e) { onToast && onToast("Lỗi: " + e.message); }
    setItems((m) => { const n = { ...m }; delete n[g.orderId]; return n; });
    setOpen((o) => ({ ...o, [g.orderId]: false }));
    setDel(null); refresh();
  };

  if (err) return <div className="card empty" style={{ color: "var(--st-red)" }}><Icon name="close" size={40} /><div>{err}</div></div>;
  if (!groups) return <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải…</div></div>;
  if (groups.length === 0)
    return <EmptyState icon="warehouse" title="Chưa có lô nhập nào" hint="Dùng “Nhận đơn vào kho” để nhập sản phẩm từ đơn mua hộ vào kho." />;

  return (
    <>
    <div className="card" style={{ overflow: "hidden" }}>
      {groups.map((g) => (
        <div className="imp-group" key={g.orderId}>
          <button type="button" className="imp-head" onClick={() => toggle(g.orderId)}>
            <Icon name="chevRight" size={16} style={{ transform: open[g.orderId] ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
            <b className="mono">#{g.orderId}</b>
            <span className="imp-meta">{fmtDate(g.receivedAt)} · {g.skuCount} SKU · {Number(g.totalQty).toLocaleString("vi-VN")} cái · vốn {Number(g.totalCost).toLocaleString("vi-VN")}₫</span>
            <span style={{ flex: 1 }} />
            <span className="src-chip" onClick={(e) => { e.stopPropagation(); onOpenOrder && onOpenOrder(g.orderId); }}>Mở đơn</span>
            <span className="src-chip danger" onClick={(e) => { e.stopPropagation(); setDel(g); }}><Icon name="close" size={13} /> Xóa cả lô</span>
          </button>
          {open[g.orderId] && (
            <div className="imp-body">
              {items[g.orderId] === undefined ? (
                <div className="cell-sub" style={{ padding: "10px 16px" }}>Đang tải…</div>
              ) : items[g.orderId].length === 0 ? (
                <div className="cell-sub" style={{ padding: "10px 16px" }}>Không có sản phẩm.</div>
              ) : (
                items[g.orderId].map((p) => {
                  const q = (p.sourceOrders || []).find((s) => s.orderId === g.orderId)?.qty ?? 0;
                  return (
                    <div className="imp-row" key={p.id}>
                      <ProductImg imageUrl={p.imageUrl} alt={p.name} sm />
                      <div style={{ minWidth: 0 }}><div className="pn" style={{ fontSize: 13 }}>{p.name}</div><div className="pm mono">{p.sku}</div></div>
                      <span style={{ flex: 1 }} />
                      <span className="cell-money">{Number(q).toLocaleString("vi-VN")} cái</span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      ))}
    </div>
    {del && (
      <ConfirmModal title="Xóa cả lô nhập" confirm="Xóa cả lô"
        message={<>Xóa toàn bộ <b>{del.skuCount} SKU</b> nhập từ đơn <b className="mono">#{del.orderId}</b>? SKU còn lịch sử bán sẽ được <b>ẩn</b>; đang dùng sẽ <b>bị bỏ qua</b>. Không thể hoàn tác.</>}
        onClose={() => setDel(null)} onConfirm={() => removeGroup(del)} />
    )}
    </>
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
  const setV = (k) => (v) => setF({ ...f, [k]: v });
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
              <Select icon="filter" value={f.category} onChange={setV("category")} ariaLabel="Danh mục"
                options={CATS.map((c) => ({ value: c, label: c }))} />
            </label>
            <label className="field"><span>Giá vốn TB (₫)</span>
              <div className="input"><Icon name="coins" size={16} /><MoneyInput value={f.avgCost} onChange={(v) => setF({ ...f, avgCost: v })} required /></div></label>
            <label className="field"><span>Giá niêm yết (₫) — để trống nếu chưa đặt</span>
              <div className="input"><Icon name="wallet" size={16} /><MoneyInput value={f.listPrice} onChange={(v) => setF({ ...f, listPrice: v })} /></div></label>
            {isEdit && (
              <label className="field"><span>Trạng thái</span>
                <Select icon="eye" value={f.status} onChange={setV("status")} ariaLabel="Trạng thái"
                  options={[
                    { value: "active", label: "Đang bán" },
                    { value: "hidden", label: "Ẩn" },
                  ]} />
              </label>
            )}

            {isEdit && product.sourceOrders && product.sourceOrders.length > 0 && (
              <div className="field">
                <span>Nguồn nhập</span>
                <div className="src-chips">
                  {product.sourceOrders.map((s) => (
                    <span key={s.orderId} className="src-chip static">#{s.orderId} · {Number(s.qty).toLocaleString("vi-VN")} cái</span>
                  ))}
                </div>
              </div>
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
