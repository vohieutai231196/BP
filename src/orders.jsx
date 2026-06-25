/* ============================================================
   GomĐơn — Orders Data Grid (server-side)
   Lọc/sort/search/phân trang gọi API; 3 bố cục (Bảng/Danh sách/Thẻ);
   CSV export lấy toàn bộ qua ?all=true.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import DATA, { adaptSummary } from "./data.js";
import { api } from "./api.js";
import { StatusBadge, ProductThumb, PlatformTag, ProdName } from "./components.jsx";

const { STATUS, fmt: f } = DATA;
const { useState, useEffect, useRef } = React;

export function Orders({ statusCounts, total: totalAll, search, preset, onOpen, layout, setLayout, onToast, reloadKey }) {
  const [status, setStatus] = useState("all");
  const [payOnly, setPayOnly] = useState(false);
  const [sort, setSort] = useState("date");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const pageSize = layout === "cards" ? 9 : layout === "rows" ? 8 : 12;

  // preset từ sidebar nav
  useEffect(() => {
    if (!preset) return;
    if (preset === "pay") { setPayOnly(true); setStatus("all"); }
    else { setStatus(preset); setPayOnly(false); }
    setPage(1);
  }, [preset]);

  // đổi bộ lọc → về trang 1
  useEffect(() => { setPage(1); }, [status, payOnly, sort, layout, search]);

  // debounce search
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // fetch danh sách
  const reqId = useRef(0);
  useEffect(() => {
    const my = ++reqId.current;
    setLoading(true);
    setError(null);
    api.orders({ status, payOnly, search: debouncedSearch, sort, page, pageSize })
      .then((res) => {
        if (my !== reqId.current) return; // bỏ kết quả cũ
        setItems((res.items || []).map(adaptSummary));
        setTotal(res.total);
        setPages(res.pages || 1);
      })
      .catch((err) => { if (my === reqId.current) setError(err.message); })
      .finally(() => { if (my === reqId.current) setLoading(false); });
  }, [status, payOnly, sort, page, pageSize, debouncedSearch, reloadKey]);

  const statusChips = [{ key: "all", label: "Tất cả" }, ...Object.values(STATUS).map((s) => ({ key: s.key, label: s.label }))]
    .filter((c) => c.key === "all" || (statusCounts?.[c.key] || 0) > 0);

  const exportCsv = async () => {
    onToast("Đang chuẩn bị CSV…");
    const res = await api.orders({ status, payOnly, search: debouncedSearch, sort, all: true });
    const list = (res.items || []).map(adaptSummary);
    const head = ["Mã đơn", "Sản phẩm", "Sàn", "Khách hàng", "Trạng thái", "Số kiện", "Cân nặng (kg)", "Tổng chi phí", "Đã thanh toán", "Còn thiếu", "Ngày tạo"];
    const rows = list.map((o) => [o.id, o.productName, o.platform.label, o.customer.name, STATUS[o.status]?.label || o.status, o.packagesCount, o.weightReal, Math.round(o.costs.tongChiPhi), Math.round(o.costs.daThanhToan), Math.round(o.costs.conThieu), f.fmtDate(o.createdAt)]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = `gomdon-don-hang-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
    onToast(`Đã xuất ${list.length} đơn ra CSV`);
  };

  const sortLabels = { date: "Mới nhất", value: "Giá trị cao", weight: "Cân nặng", due: "Còn thiếu nhiều" };

  const SortHeader = ({ col, label, align }) => (
    <th className="sortable" style={align ? { textAlign: align } : null} onClick={() => setSort(col)}>
      <span className="th-in" style={align === "right" ? { justifyContent: "flex-end" } : null}>{label}{sort === col && <Icon name="chevDown" size={13} />}</span>
    </th>
  );

  return (
    <div className="fade-in">
      {/* toolbar: chips */}
      <div className="toolbar">
        <div className="chips">
          {statusChips.map((c) => (
            <button key={c.key} className={"chip" + (status === c.key && !payOnly ? " active" : "")} onClick={() => { setStatus(c.key); setPayOnly(false); }}>
              {c.label}<span className="cc">{c.key === "all" ? totalAll : (statusCounts?.[c.key] || 0)}</span>
            </button>
          ))}
          {payOnly && <button className="chip active" onClick={() => setPayOnly(false)}>Còn thiếu <Icon name="close" size={13} /></button>}
        </div>
      </div>

      {/* toolbar: layout + sort + export */}
      <div className="toolbar">
        <div className="seg">
          {[{ k: "table", i: "dashboard", l: "Bảng" }, { k: "rows", i: "menu", l: "Danh sách" }, { k: "cards", i: "box", l: "Thẻ" }].map((o) => (
            <button key={o.k} className={"seg-item" + (layout === o.k ? " active" : "")} onClick={() => setLayout(o.k)}><Icon name={o.i} size={15} />{o.l}</button>
          ))}
        </div>
        <span className="spacer" />
        <span className="cell-sub hide-mobile">{total} đơn</span>
        <div className="sortdrop">
          <button className="btn btn-sm" onClick={() => { const ks = Object.keys(sortLabels); setSort(ks[(ks.indexOf(sort) + 1) % ks.length]); }}>
            <Icon name="sort" size={15} />{sortLabels[sort]}
          </button>
        </div>
        <button className="btn btn-sm" onClick={exportCsv}><Icon name="download" size={15} />Xuất CSV</button>
      </div>

      {/* data */}
      {error ? (
        <div className="card empty"><Icon name="close" size={40} /><div>Lỗi tải dữ liệu: {error}</div></div>
      ) : loading ? (
        <div className="card empty"><Icon name="refresh" size={40} /><div>Đang tải đơn hàng…</div></div>
      ) : items.length === 0 ? (
        <div className="card empty"><Icon name="search" size={40} /><div>Không tìm thấy đơn hàng phù hợp.</div></div>
      ) : layout === "table" ? (
        <div className="card"><div className="grid-wrap"><table className="dg">
          <thead><tr>
            <th>Mã đơn</th><th>Sản phẩm</th><th>Khách hàng</th><th>Trạng thái</th>
            <SortHeader col="weight" label="Cân nặng" align="right" /><SortHeader col="value" label="Tổng chi phí" align="right" /><th style={{ textAlign: "right" }}>Đã thu</th>
          </tr></thead>
          <tbody>
            {items.map((o) => (
              <tr key={o.id} onClick={() => onOpen(o.id)}>
                <td><span className="cell-id">#{o.id}</span><div className="cell-sub">{f.fmtDate(o.createdAt)}</div></td>
                <td><div className="cell-prod"><ProductThumb order={o} /><div style={{ minWidth: 0 }}><ProdName name={o.productName} className="pn" /><div className="pm"><PlatformTag platform={o.platform} /> · {o.packagesCount} kiện</div></div></div></td>
                <td className="cell-cust"><b>{o.customer.name}</b><span>{o.customer.phone}</span></td>
                <td><StatusBadge status={o.status} size="sm" /></td>
                <td className="cell-money">{f.fmtKg(o.weightReal)}</td>
                <td className="cell-money">{f.fmtVND(o.costs.tongChiPhi)}</td>
                <td className="cell-money" style={{ color: o.costs.conThieu > 0 ? "var(--st-amber)" : "var(--pos)" }}>{o.costs.conThieu > 0 ? "−" + f.fmtVND(o.costs.conThieu) : "Đủ"}</td>
              </tr>
            ))}
          </tbody>
        </table></div></div>
      ) : layout === "rows" ? (
        <div className="card"><div className="rows">
          {items.map((o) => (
            <div className="orow" key={o.id} onClick={() => onOpen(o.id)}>
              <ProductThumb order={o} lg />
              <div className="o-main" style={{ minWidth: 0 }}><ProdName name={o.productName} style={{ fontWeight: 600 }} /><div className="o-meta"><span className="cell-id">#{o.id}</span><PlatformTag platform={o.platform} /><span>{o.customer.name}</span></div></div>
              <div className="o-hideS"><StatusBadge status={o.status} size="sm" /><div className="cell-sub" style={{ marginTop: 6 }}>{o.packagesCount} kiện · {f.fmtKg(o.weightReal)}</div></div>
              <div className="o-hideS" style={{ textAlign: "right" }}><div className="cell-money">{f.fmtVND(o.costs.tongChiPhi)}</div><div className="cell-sub" style={{ marginTop: 4 }}>{o.costs.conThieu > 0 ? "Thiếu " + f.fmtVND(o.costs.conThieu) : "Đã đủ"}</div></div>
              <Icon name="chevRight" size={18} style={{ color: "var(--faint)" }} />
            </div>
          ))}
        </div></div>
      ) : (
        <div className="ocards">
          {items.map((o) => {
            const paidPct = Math.min(100, Math.round(o.costs.daThanhToan / (o.costs.tongChiPhi || 1) * 100));
            return (
              <div className="card ocard" key={o.id} onClick={() => onOpen(o.id)}>
                <div className="ocard-top">
                  <ProductThumb order={o} lg />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="oid">#{o.id}</div>
                    <ProdName name={o.productName} className="pn" />
                  </div>
                  <StatusBadge status={o.status} size="sm" />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: "var(--faint)" }}>
                  <PlatformTag platform={o.platform} /><span>· {o.packagesCount} kiện</span><span>· {f.fmtKg(o.weightReal)}</span>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--muted)", marginBottom: 6 }}><span>Đã thanh toán {paidPct}%</span><span>{o.costs.conThieu > 0 ? "Thiếu " + f.fmtVND(o.costs.conThieu) : "Đủ"}</span></div>
                  <div className="prog"><div className="prog-fill" style={{ width: paidPct + "%", background: o.costs.conThieu > 0 ? "var(--st-amber)" : "var(--pos)" }} /></div>
                </div>
                <div className="ocard-foot"><span className="lbl">Tổng chi phí</span><span className="amt">{f.fmtVND(o.costs.tongChiPhi)}</span></div>
              </div>
            );
          })}
        </div>
      )}

      {/* pager */}
      {!loading && !error && pages > 1 && (
        <div className="pager">
          <span className="pinfo">Trang {page}/{pages} · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} trên {total}</span>
          <div className="pbtns">
            <button className="pg-btn" disabled={page === 1} onClick={() => setPage(page - 1)}><Icon name="chevLeft" size={16} /></button>
            {Array.from({ length: pages }, (_, i) => i + 1).filter((p) => Math.abs(p - page) < 3 || p === 1 || p === pages).map((p, idx, arr) => (
              <React.Fragment key={p}>
                {idx > 0 && p - arr[idx - 1] > 1 && <span style={{ color: "var(--faint)", padding: "0 2px" }}>…</span>}
                <button className={"pg-btn" + (p === page ? " active" : "")} onClick={() => setPage(p)}>{p}</button>
              </React.Fragment>
            ))}
            <button className="pg-btn" disabled={page === pages} onClick={() => setPage(page + 1)}><Icon name="chevRight" size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Orders;
