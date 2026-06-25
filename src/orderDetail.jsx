/* ============================================================
   GomĐơn — Order detail drawer
   Summary, journey timeline, packages, fee breakdown (công thức
   1…10), order history, and payments. Closes on overlay / Esc.
   ============================================================ */
import React from "react";
import { Icon } from "./icons.jsx";
import DATA from "./data.js";
import { StatusBadge, ProductThumb, PlatformTag, ProdName, ZoomImage } from "./components.jsx";
import { api, imgUrl, imgUrlLarge } from "./api.js";

// Ghi text vào clipboard. navigator.clipboard chỉ có trong secure context (HTTPS/localhost);
// fallback execCommand cho trường hợp app mở qua HTTP/IP thuần. Trả về true nếu thành công.
async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* rơi xuống fallback */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

export function OrderDetail({ order, onClose, onToast, onChangeStatus, onDelete, role, onViewInventory }) {
  const d = DATA, f = d.fmt, c = order.costs;
  const [busy, setBusy] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [stocked, setStocked] = React.useState(null); // SKU đã nhập kho từ đơn này
  React.useEffect(() => {
    let alive = true;
    api.retail.products({ orderId: order.id })
      .then((d) => { if (alive) setStocked(d || []); })
      .catch(() => { if (alive) setStocked([]); });
    return () => { alive = false; };
  }, [order.id]);

  const remove = () => { if (!deleting) setConfirmDel(true); };
  const doRemove = async () => {
    setDeleting(true);
    try {
      await onDelete(order.id);
      onToast("Đã xoá đơn #" + order.id);   // đơn bị xoá → drawer tự đóng
    } catch (err) {
      onToast("Lỗi xoá: " + (err.message || "không xoá được"));
      setDeleting(false); setConfirmDel(false);
    }
  };

  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onChangeStatus(order.id, "da_tra", "Đánh dấu hoàn thành từ chi tiết đơn");
      onToast("Đã đánh dấu hoàn thành đơn #" + order.id);
    } catch (err) {
      onToast("Lỗi: " + (err.message || "không đổi được trạng thái"));
    } finally {
      setBusy(false);
    }
  };

  React.useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const curStep = d.STATUS[order.status].step;
  const tlState = (i, key) => {
    if (order.timeline[key]) return "done";
    if (i === curStep) return "cur";
    return "pending";
  };

  const fee1 = [
    ["(1) Tiền hàng", c.tienHang], ["(2) Phí trả thêm", 0], ["(3) Ship nội địa TQ", c.shipTQ],
    ["(4) Phí mua hàng (" + order.buyFeePct + "%)", c.phiMuaHang], ["(5) Phí kiểm đếm", c.phiKiemDem],
  ];
  const fee2 = [
    ["(7) Tiền cân nặng", c.tienCanNang], ["(8) Đóng gỗ", c.dongGo],
    ["(9) Cước phát sinh", 0], ["(10) Phí lưu kho", c.luuKho],
  ];

  const kv = [
    ["Sàn nguồn", <PlatformTag platform={order.platform} />], ["Hạng khách", order.vip],
    ["Kiểu vận chuyển", order.shipping], ["Kho nhận", order.warehouse],
    ["Số kiện hàng", order.packagesCount + " kiện"], ["Tỷ giá áp dụng", f.fmtVNDplain(order.rate) + " ₫/¥"],
    ["Cân nặng thực", f.fmtKg(order.weightReal)], ["Cân tính tiền", f.fmtKg(order.weightCharged)],
  ];

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="drawer" role="dialog" aria-label={"Đơn " + order.id}>
        <div className="drawer-head">
          <ProductThumb order={order} lg />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="cell-id" style={{ fontSize: 16 }}>#{order.id}</span><StatusBadge status={order.status} size="sm" /></div>
            <ProdName name={order.productName} style={{ fontWeight: 600, marginTop: 3 }} />
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="đóng"><Icon name="close" size={19} /></button>
        </div>

        <div className="drawer-body">
          {/* summary */}
          <div className="card card-pad">
            <div className="kv">
              {kv.map((r, i) => (<React.Fragment key={i}><span className="k">{r[0]}</span><span className="v">{r[1]}</span></React.Fragment>))}
            </div>
            {order.promo && <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}><span className="tag-soft" style={{ color: "var(--st-amber)", background: "var(--st-amber-bg)" }}><Icon name="tag" size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Ưu đãi: {order.promo}</span></div>}
          </div>

          {/* timeline */}
          <div className="card card-pad">
            <div className="section-title"><Icon name="truck" size={15} />Hành trình đơn hàng</div>
            <div className="tl" style={{ marginTop: 14 }}>
              {d.TIMELINE_STEPS.map((s, i) => {
                const st = tlState(i, s.key);
                const last = i === d.TIMELINE_STEPS.length - 1;
                return (
                  <div className="tl-step" key={s.key}>
                    <div className="tl-rail">
                      <div className={"tl-node " + (st === "done" ? "done" : st === "cur" ? "cur" : "")}>{st === "done" && <Icon name="check" size={11} stroke={2.6} />}</div>
                      {!last && <div className={"tl-line" + (order.timeline[d.TIMELINE_STEPS[i + 1].key] ? " done" : "")} />}
                    </div>
                    <div className="tl-c">
                      <div className={"tl-t" + (st === "pending" ? " pending" : "")}>{s.label}</div>
                      <div className="tl-d">{order.timeline[s.key] ? f.fmtDate(order.timeline[s.key]) : "— chưa cập nhật"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* packages */}
          <div className="card">
            <div className="card-head"><Icon name="box" size={16} style={{ color: "var(--muted)" }} /><h3>Kiện hàng</h3><span className="topbar-spacer" /><span className="tag-soft">{order.packagesCount} kiện</span></div>
            <div className="card-pad" style={{ overflowX: "auto" }}>
              <table className="mini-table">
                <thead><tr><th>Mã kiện</th><th>Cân nặng</th><th>Đơn giá</th><th style={{ textAlign: "right" }}>Thành tiền</th><th>Về kho VN</th></tr></thead>
                <tbody>
                  {order.packages.map((p) => (
                    <tr key={p.code}>
                      <td className="mono" style={{ fontSize: 12 }}>{p.code}</td>
                      <td>{f.fmtKg(p.weight)}<div className="cell-sub">tính: {f.fmtKg(p.weightCharged)}</div></td>
                      <td className="mono">{f.fmtVND(p.unitPrice)}</td>
                      <td className="num">{f.fmtVND(p.total + p.extra)}</td>
                      <td className="cell-sub">{f.fmtDate(p.inVN)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* links / sản phẩm trong đơn — kèm giá vốn/cái sau phân bổ phí */}
          {order.links && order.links.length > 0 && (() => {
            const base = order.links.reduce((s, l) => s + (l.priceVnd || 0), 0);
            const coef = base > 0 ? c.tongChiPhi / base : 1;          // hệ số phân bổ toàn bộ phí
            const units = (q) => { const n = parseInt(String(q || "").split("/")[0], 10); return n > 0 ? n : 1; };
            return (
              <div className="card">
                <div className="card-head"><Icon name="tag" size={16} style={{ color: "var(--muted)" }} /><h3>Sản phẩm trong đơn</h3><span className="topbar-spacer" /><span className="tag-soft">{order.links.length} link · phí ×{coef.toFixed(3)}</span></div>
                <div className="card-pad" style={{ overflowX: "auto" }}>
                  <table className="mini-table prod-table">
                    <colgroup>
                      <col style={{ width: 28 }} />
                      <col style={{ width: 54 }} />
                      <col style={{ width: 100 }} />
                      <col />
                      <col style={{ width: 52 }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 94 }} />
                    </colgroup>
                    <thead><tr><th>#</th><th>Ảnh</th><th>Mã link</th><th>Sản phẩm</th><th>SL</th><th className="num-h" style={{ textAlign: "right" }}>Giá hàng</th><th className="num-h" style={{ textAlign: "right" }}>Giá vốn/cái<div className="cell-sub" style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>gồm mọi phí</div></th></tr></thead>
                    <tbody>
                      {order.links.map((l) => {
                        const n = units(l.qty);
                        const unitAllIn = Math.round((l.priceVnd || 0) * coef / n);
                        return (
                          <tr key={l.idx + "-" + l.linkCode}>
                            <td className="cell-sub cell-mid">{l.idx}</td>
                            <td className="cell-mid">{l.imageUrl ? <ZoomImage src={imgUrl(l.imageUrl)} zoomSrc={imgUrlLarge(l.imageUrl)} alt={l.name || l.spec || ""} /> : <span className="cell-sub">—</span>}</td>
                            <td className="cell-mid">{l.sourceUrl
                              ? <a className="code-chip" href={l.sourceUrl} target="_blank" rel="noreferrer" title="Mở link gốc trên sàn"><span>{l.linkCode}</span><Icon name="external" size={11} className="x-ic" /></a>
                              : <span className="code-chip"><span>{l.linkCode}</span></span>}</td>
                            <td className="prod-cell">{l.name
                              ? (<><div className="prod-name">{l.name}</div><div className="prod-spec">{l.specVi || l.spec || "—"}</div></>)
                              : (<div className="prod-spec solo">{l.specVi || l.spec || "—"}</div>)}</td>
                            <td className="cell-sub cell-mid">{l.qty || "—"}</td>
                            <td className="num">{f.fmtVND(l.priceVnd)}<div className="cell-sub">{l.priceCny ? "¥" + l.priceCny : ""}</div></td>
                            <td className="num" style={{ color: "var(--accent-ink)", fontWeight: 700 }}>{f.fmtVND(unitAllIn)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="cell-sub" style={{ marginTop: 10 }}>
                    Giá vốn/cái = (giá hàng của link × {coef.toFixed(3)}) ÷ số lượng — phân bổ toàn bộ phí đơn ({f.fmtVND(c.tongChiPhi)}) theo tỷ lệ tiền hàng.
                  </div>
                </div>
              </div>
            );
          })()}

          {/* sản phẩm đã nhập kho (truy vết Đơn → Kho) */}
          {stocked && stocked.length > 0 && (
            <div className="card">
              <div className="card-head"><Icon name="warehouse" size={16} style={{ color: "var(--muted)" }} /><h3>Sản phẩm đã nhập kho</h3><span className="topbar-spacer" /><span className="tag-soft">{stocked.length} SKU</span></div>
              <div className="card-pad" style={{ overflowX: "auto" }}>
                <table className="mini-table">
                  <thead><tr><th>SKU</th><th>Tên</th><th style={{ textAlign: "right" }}>SL nhận</th></tr></thead>
                  <tbody>
                    {stocked.map((p) => {
                      const q = (p.sourceOrders || []).find((s) => s.orderId === order.id)?.qty ?? 0;
                      return (
                        <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => onViewInventory && onViewInventory(order.id)}>
                          <td className="mono" style={{ fontSize: 12 }}>{p.sku}</td>
                          <td>{p.name}</td>
                          <td className="num">+{Number(q).toLocaleString("vi-VN")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="cell-sub" style={{ marginTop: 8 }}>Bấm 1 dòng để xem trong Kho (lọc theo đơn này).</div>
              </div>
            </div>
          )}

          {/* fees */}
          <div className="card card-pad">
            <div className="section-title"><Icon name="coins" size={15} />Tổng phí <span style={{ marginLeft: "auto", fontWeight: 500, textTransform: "none", letterSpacing: 0, color: "var(--faint)" }}>Tỉ giá {f.fmtVNDplain(order.rate)} ₫/¥</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 12 }} className="fee-cols">
              <div>
                <div className="cell-sub" style={{ fontWeight: 600, marginBottom: 4 }}>Tiền hàng</div>
                {fee1.map((r, i) => (<div className="fee-row" key={i}><span className="fl">{r[0]}</span><span className="fv">{f.fmtVND(r[1])}</span></div>))}
                <div className="fee-row"><span className="fl" style={{ fontWeight: 700, color: "var(--ink)" }}>(6) Tổng = 1+…+5</span><span className="fv" style={{ color: "var(--ink)" }}>{f.fmtVND(c.tongTienHang)}</span></div>
              </div>
              <div>
                <div className="cell-sub" style={{ fontWeight: 600, marginBottom: 4 }}>Tiền cân nặng</div>
                {fee2.map((r, i) => (<div className="fee-row" key={i}><span className="fl">{r[0]}</span><span className="fv">{f.fmtVND(r[1])}</span></div>))}
                <div className="fee-row"><span className="fl" style={{ color: "var(--faint)" }}>Cân thực / tính</span><span className="fv" style={{ color: "var(--muted)" }}>{f.fmtKg(order.weightReal)} / {f.fmtKg(order.weightCharged)}</span></div>
              </div>
            </div>
            <div className="fee-total"><div><div className="ft-l">Tổng giá trị đơn hàng</div><div className="cell-sub">6 + 7 + 8 + 9 + 10</div></div><div className="ft-v">{f.fmtVND(c.tongChiPhi)}</div></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13.5 }}>
              <span className="fl" style={{ color: "var(--muted)" }}>Đã thanh toán</span><span style={{ fontWeight: 700 }} className="pos">{f.fmtVND(c.daThanhToan)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 13.5 }}>
              <span className="fl" style={{ color: "var(--muted)" }}>Còn thiếu</span><span style={{ fontWeight: 700 }} className={c.conThieu > 0 ? "neg" : "pos"}>{f.fmtVND(c.conThieu)}</span>
            </div>
          </div>

          {/* history */}
          <div className="card card-pad">
            <div className="section-title"><Icon name="clock" size={15} />Lịch sử đơn hàng</div>
            <div className="hist" style={{ marginTop: 12 }}>
              {order.history.length === 0 && <div className="cell-sub">Chưa có hoạt động nào.</div>}
              {order.history.map((h, i) => (
                <div className="hist-item" key={i}><div className="hist-dot" /><div><div className="hist-tx">{h.text}</div><div className="hist-at">{f.fmtDateTime(h.at)}</div></div></div>
              ))}
            </div>
          </div>

          {/* payments */}
          {order.payments.length > 0 && (
            <div className="card">
              <div className="card-head"><Icon name="wallet" size={16} style={{ color: "var(--muted)" }} /><h3>Thanh toán đơn hàng</h3></div>
              <div className="card-pad">
                <table className="mini-table">
                  <thead><tr><th>Phát sinh lúc</th><th>Lý do</th><th style={{ textAlign: "right" }}>Số tiền</th></tr></thead>
                  <tbody>
                    {order.payments.map((p, i) => (
                      <tr key={i}><td className="cell-sub">{f.fmtDate(p.at)}</td><td>{p.reason}</td><td className="num neg">{f.fmtVND(p.amount)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="drawer-foot">
          <button className="btn" onClick={async () => {
            const ok = await copyText(String(order.id));
            onToast(ok ? "Đã sao chép mã đơn #" + order.id : "Lỗi: trình duyệt chặn sao chép (cần HTTPS).");
          }}><Icon name="copy" size={16} />Sao chép mã</button>
          {role === "admin" && (
            <button className="btn" onClick={remove} disabled={deleting} style={{ color: "var(--neg)", borderColor: "var(--neg)" }}>
              <Icon name="close" size={16} />{deleting ? "Đang xoá…" : "Xoá đơn"}
            </button>
          )}
          <span style={{ flex: 1 }} />
          {role !== "viewer" && (
            <button className="btn btn-primary" onClick={complete} disabled={busy || order.status === "da_tra"}>
              <Icon name="check" size={16} />{busy ? "Đang lưu…" : order.status === "da_tra" ? "Đã hoàn thành" : "Hoàn thành đơn"}
            </button>
          )}
        </div>
      </div>

      {confirmDel && (
        <div className="overlay overlay-top" onClick={() => !deleting && setConfirmDel(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><div className="mh-ic"><Icon name="close" size={18} /></div><div><h3>Xoá đơn #{order.id}</h3></div></div>
            <div className="modal-body"><div className="mb-text">Xoá đơn <b className="mono">#{order.id}</b> cùng <b>toàn bộ sản phẩm / kiện / lịch sử</b> liên quan? Không thể hoàn tác.</div></div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setConfirmDel(false)} disabled={deleting}>Hủy</button>
              <button className="btn btn-primary" onClick={doRemove} disabled={deleting}
                style={{ background: "var(--st-red)", borderColor: "var(--st-red)", boxShadow: "none" }}>
                {deleting ? "Đang xoá…" : "Xoá đơn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default OrderDetail;
