/* ============================================================
   GomĐơn — Data layer
   (1) Config tĩnh dùng để TRÌNH BÀY (STATUS, TIMELINE_STEPS,
       PLATFORMS, WAREHOUSES, CAT_TINT, các hàm format) — không lấy
       từ server vì đây là metadata giao diện.
   (2) Adapter: chuyển JSON từ API .NET → hình dạng các component
       đang dùng (gom nested platform/customer/costs, gắn tint theo
       danh mục, đổi chuỗi ngày → Date).
   ============================================================ */

// ---- formatting helpers ----
const fmtVND = (n) => Math.round(n).toLocaleString("vi-VN") + "₫";
const fmtVNDplain = (n) => Math.round(n).toLocaleString("vi-VN");
const fmtCNY = (n) => "¥" + n.toLocaleString("vi-VN", { maximumFractionDigits: 1 });
const fmtKg = (n) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 }) + " kg";
const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (d) => (d ? `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}` : "—");
const fmtDateTime = (d) => (d ? `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}` : "—");

// ---- status definitions (lifecycle) ----
const STATUS = {
  cho_coc:  { key: "cho_coc",  label: "Chờ đặt cọc",  color: "slate",  step: 0 },
  dang_mua: { key: "dang_mua", label: "Đang mua hàng", color: "amber",  step: 1 },
  ve_vn:    { key: "ve_vn",    label: "Đang về VN",    color: "blue",   step: 2 },
  kho_vn:   { key: "kho_vn",   label: "Trong kho VN",  color: "violet", step: 3 },
  da_tra:   { key: "da_tra",   label: "Đã trả hàng",   color: "green",  step: 4 },
  thanh_ly: { key: "thanh_ly", label: "Thanh lý",      color: "green",  step: 4 },
  khieu_nai:{ key: "khieu_nai",label: "Khiếu nại",     color: "red",    step: 3 },
  huy:      { key: "huy",      label: "Đã hủy",        color: "red",    step: -1 },
};
const TIMELINE_STEPS = [
  { key: "datCoc", label: "Đặt cọc" },
  { key: "daMua",  label: "Đã mua hàng" },
  { key: "veVN",   label: "Trên đường về VN" },
  { key: "khoVN",  label: "Trong kho VN" },
  { key: "traHang",label: "Trả hàng" },
];

const PLATFORMS = [
  { key: "taobao",  label: "Taobao",   tint: "#ff6a00" },
  { key: "1688",    label: "1688",     tint: "#ff7a45" },
  { key: "pdd",     label: "Pinduoduo",tint: "#e02e24" },
  { key: "tmall",   label: "Tmall",    tint: "#d4143c" },
  { key: "weidian", label: "Weidian",  tint: "#ec5b24" },
];
const WAREHOUSES = ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng"];
const SHIPPING = ["Chuyển THƯỜNG", "Chuyển NHANH", "Chuyển VIP", "Tiết kiệm"];
const VIPS = ["Vip 1", "Vip 2", "Vip 3", "Vip 4", "Vip 5"];

const CAT_TINT = {
  shoe: "#2a6fdb", bag: "#6a53cf", apparel: "#1f8a5b",
  tech: "#bb7d12", home: "#cf4257", beauty: "#c0497f",
};

const fmt = { fmtVND, fmtVNDplain, fmtCNY, fmtKg, fmtDate, fmtDateTime };

const DATA = { STATUS, TIMELINE_STEPS, PLATFORMS, WAREHOUSES, SHIPPING, VIPS, CAT_TINT, fmt };

export default DATA;
export { DATA };

/* ============================================================
   Adapters — API JSON → hình dạng component
   ============================================================ */
const toDate = (v) => (v ? new Date(v) : null);
const tintOf = (cat) => CAT_TINT[cat] || "#646b77";

/** Tóm tắt đơn (danh sách / đơn gần đây) — gom phẳng → nested + Date. */
export function adaptSummary(o) {
  return {
    id: o.id,
    status: o.status,
    platform: { key: o.platformKey, label: o.platformLabel, tint: o.platformTint },
    productName: o.productName,
    cat: o.category,
    tint: tintOf(o.category),
    customer: { name: o.customerName, phone: o.customerPhone },
    vip: o.vip,
    packagesCount: o.packagesCount,
    weightReal: o.weightReal,
    costs: { tongChiPhi: o.tongChiPhi, daThanhToan: o.daThanhToan, conThieu: o.conThieu },
    createdAt: toDate(o.createdAt),
  };
}

/** Chi tiết đơn — platform/customer/costs đã nested sẵn; chỉ cần gắn tint + đổi ngày. */
export function adaptDetail(o) {
  return {
    ...o,
    cat: o.category,
    tint: tintOf(o.category),
    createdAt: toDate(o.createdAt),
    timeline: {
      datCoc: toDate(o.timeline?.datCoc), daMua: toDate(o.timeline?.daMua),
      veVN: toDate(o.timeline?.veVN), khoVN: toDate(o.timeline?.khoVN),
      traHang: toDate(o.timeline?.traHang),
    },
    packages: (o.packages || []).map((p) => ({
      ...p, sellerShip: toDate(p.sellerShip), toVN: toDate(p.toVN), inVN: toDate(p.inVN),
    })),
    history: (o.history || []).map((h) => ({ ...h, at: toDate(h.at) })),
    payments: (o.payments || []).map((p) => ({ ...p, at: toDate(p.at) })),
  };
}

/** Dashboard summary — chủ yếu pass-through (API đã đúng cấu trúc). */
export function adaptDashboard(s) {
  return {
    totalOrders: s.totalOrders,
    totalRevenue: s.totalRevenue,
    totalCollected: s.totalCollected,
    totalOutstanding: s.totalOutstanding,
    totalWeight: s.totalWeight,
    outstandingOrders: s.outstandingOrders,
    statusCounts: s.statusCounts || {},
    series: s.series || [],
    platformAgg: s.platformAgg || [],
    warehouseAgg: s.warehouseAgg || [],
  };
}
