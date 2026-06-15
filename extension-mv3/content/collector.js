/* ============================================================
   GomĐơn Collector — content script (vanilla JS)
   Đọc DOM trang đơn của sàn TQ, trích các đơn vừa mua thành
   payload ingest (productName, platform, giá → tiền hàng).

   LƯU Ý: selector dưới đây nhắm tới CẤU TRÚC ĐẠI DIỆN (xem
   test-page/taobao.html). Trang Taobao thật có class động —
   cần tinh chỉnh `SELECTORS` theo DOM thực tế của từng sàn.
   ============================================================ */
(function () {
  "use strict";

  const SELECTORS = {
    order: ".gd-order, [data-gd-order]",
    code: ".gd-code, [data-gd-code]",
    title: ".gd-title, [data-gd-title]",
    price: ".gd-price, [data-gd-price]",
    qty: ".gd-qty, [data-gd-qty]",
    shop: ".gd-shop, [data-gd-shop]",
  };

  const DEFAULT_RATE = 4035;

  function classify(title) {
    const t = (title || "").toLowerCase();
    if (/giày|sneaker|dép|boot/.test(t)) return "shoe";
    if (/túi|balo|ví|cặp/.test(t)) return "bag";
    if (/áo|quần|váy|hoodie|đầm/.test(t)) return "apparel";
    if (/tai nghe|đồng hồ|chuột|sạc|điện thoại|tws|bluetooth/.test(t)) return "tech";
    if (/nồi|đèn|kệ|bình|nhà|bếp/.test(t)) return "home";
    if (/son|kem|mỹ phẩm|dưỡng/.test(t)) return "beauty";
    return "tech";
  }

  function parsePrice(text) {
    if (!text) return 0;
    const m = String(text).replace(/[^\d.,]/g, "").replace(/,/g, "");
    return parseFloat(m) || 0;
  }

  function text(el, sel) {
    const n = el.querySelector(sel);
    return n ? n.textContent.trim() : "";
  }

  function detectPlatform() {
    if (document.body && document.body.dataset.platform) return document.body.dataset.platform;
    const h = location.host;
    if (h.includes("taobao")) return "taobao";
    if (h.includes("tmall")) return "tmall";
    if (h.includes("1688")) return "1688";
    return "taobao";
  }

  /** Trích danh sách đơn từ một root DOM (document). Trả mảng IngestOrderRequest. */
  function parseOrders(root, platform) {
    const cards = [...root.querySelectorAll(SELECTORS.order)];
    const rate = DEFAULT_RATE;
    return cards.map((el) => {
      const title = text(el, SELECTORS.title) || el.getAttribute("data-gd-title") || "Sản phẩm chưa rõ";
      const priceCny = parsePrice(text(el, SELECTORS.price) || el.getAttribute("data-gd-price"));
      const qty = parseInt(text(el, SELECTORS.qty), 10) || 1;
      const shop = text(el, SELECTORS.shop) || "Khách thu thập";
      const code = text(el, SELECTORS.code) || el.getAttribute("data-gd-code") || "";
      const tienHang = Math.round(priceCny * qty * rate);
      return {
        status: "cho_coc",
        platformKey: platform,
        productName: title,
        category: classify(title),
        customerName: shop,
        customerPhone: "",
        vip: "Vip 1",
        shipping: "Chuyển THƯỜNG",
        warehouse: "Hồ Chí Minh",
        buyFeePct: 1,
        rate,
        promo: null,
        costs: { tienHang, phiMuaHang: Math.round(tienHang * 0.01) },
        timeline: {},
        packages: [],
        history: code ? [{ at: new Date().toISOString(), text: `Thu thập từ ${platform} (mã gốc ${code}).` }] : [],
        payments: [],
      };
    });
  }

  /* ---------- Parser cho trang chi tiết đơn ordergiakho.com ----------
     Trang login-gated, class động → đọc theo NHÃN tiếng Việt trên innerText.
     Trích 1 đơn đang xem (id lấy từ URL). Phí (6)/tổng do DB tự tính nên
     chỉ gửi các thành phần gốc 1..5, 7..10 + đã thanh toán. */
  const STATUS_MAP = [
    ["Thanh lý", "thanh_ly"], ["Khiếu nại", "khieu_nai"], ["Đã trả hàng", "da_tra"],
    ["Trong kho VN", "kho_vn"], ["Đang về VN", "ve_vn"], ["Trên đường về", "ve_vn"],
    ["Đang mua", "dang_mua"], ["Chờ đặt cọc", "cho_coc"], ["Đã hủy", "huy"],
  ];
  const PLATFORM_HINTS = [["taobao", "taobao"], ["tmall", "tmall"], ["1688", "1688"], ["pinduoduo", "pdd"], ["weidian", "weidian"]];

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  function moneyAfter(text, label) {
    const m = text.match(new RegExp(esc(label) + "[^0-9]*([0-9][0-9.\\s]*)"));
    return m ? parseInt(m[1].replace(/[.\s]/g, ""), 10) || 0 : 0;
  }
  function rawAfter(text, label) {
    const m = text.match(new RegExp(esc(label) + "\\s*[:\\-]?\\s*([^\\n]+)"));
    return m ? m[1].trim() : "";
  }
  function dateAfter(text, label) {
    const m = text.match(new RegExp(esc(label) + "[^0-9]*([0-3]?\\d)-([01]?\\d)-(\\d{4})"));
    if (!m) return null;
    return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString();
  }

  function parseOrderGiaKho(root) {
    const idMatch = location.pathname.match(/don-chi-tiet\/(\d+)/);
    const id = idMatch ? parseInt(idMatch[1], 10) : null;
    const text = (root.body && root.body.innerText) || "";
    const order = parseGiaKhoText(text, id);
    // Ưu tiên bóc link từ DOM (có ảnh sản phẩm); fallback dùng links từ innerText.
    if (order) {
      const domLinks = parseGiaKhoLinks(root);
      if (domLinks.length) order.links = domLinks;
    }
    return order;
  }

  /** Bóc danh sách link từ DOM bảng "Link hàng": mỗi ô td.img-parent-hover = 1 sản phẩm. */
  function parseGiaKhoLinks(root) {
    const cells = [...root.querySelectorAll("td.img-parent-hover")];
    const links = [];
    for (const td of cells) {
      const m = (td.textContent || "").match(/#(\d+)\s*\/\s*(\d+)/);
      if (!m) continue;
      const tr = td.closest("tr") || td;
      const rowText = tr.innerText || tr.textContent || "";
      const img = td.querySelector("img");
      links.push({
        idx: parseInt(m[1], 10),
        linkCode: m[2],
        spec: (rowText.match(/([^\n]*?)\s*--/) || [, ""])[1].trim(),
        specVi: null,
        imageUrl: img ? img.src : null,
        qty: (rowText.match(/Số lượng:\s*([\d/]+)/) || [, ""])[1],
        priceVnd: parseInt(((rowText.match(/([\d.]+)đ/) || [, "0"])[1]).replace(/\./g, ""), 10) || 0,
        priceCny: parseFloat((rowText.match(/([\d.]+)\s*¥/) || [, "0"])[1]) || 0,
        note: null,
      });
    }
    return links;
  }

  /** Trích đơn từ innerText + id (tách riêng để kiểm thử không cần DOM/URL).
     Selector/nhãn đã dò khớp DOM thật của ordergiakho (trang /don-chi-tiet). */
  function parseGiaKhoText(text, id) {
    const lower = text.toLowerCase();
    const grab = (re, dflt = "") => { const m = text.match(re); return m ? m[1].trim() : dflt; };
    const isoDate = (re) => { const m = text.match(re); return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString() : null; };

    // trạng thái: ngay sau "Mã đơn: <id>" (tránh nhầm với menu điều hướng)
    const statusText = grab(/Mã đơn:\s*\d+\s+([^\n]+)/);
    const status = (STATUS_MAP.find(([vi]) => statusText.includes(vi))
      || STATUS_MAP.find(([vi]) => text.includes(vi)) || [, "cho_coc"])[1];
    const platformKey = (PLATFORM_HINTS.find(([h]) => lower.includes(h)) || [, "taobao"])[1];

    // tỉ giá của ĐƠN ("Tỉ giá áp dụng 4035"), không phải tỉ giá tài khoản ở menu
    const rate = parseInt(grab(/T[ỉỷ] giá áp dụng[^0-9]*([0-9]+)/, "4035"), 10) || 4035;
    const weightReal = parseFloat(grab(/Cân nặng thực[^0-9]*([0-9.,]+)/, "0").replace(",", ".")) || 0;
    const weightCharged = parseFloat(grab(/Cân tính tiền[^0-9]*([0-9.,]+)/, "0").replace(",", ".")) || 0;
    const warehouse = grab(/Hàng ở kho:\s*([^\n]+)/) || grab(/Hàng về kho:\s*([^\n]+)/) || "Hồ Chí Minh";
    const vip = (text.match(/\bVip\s*\d+/i) || ["Vip 1"])[0].replace(/\s+/, " ");
    const customerName = (text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/) || ["Nhập từ Order Giá Kho"])[0];
    const linkCount = grab(/\((\d+)\)\s*link/);

    const costs = {
      tienHang: moneyAfter(text, "(1) Tiền hàng"),
      phiTraThem: moneyAfter(text, "(2) Phí trả thêm"),
      shipTQ: moneyAfter(text, "(3) Ship nội địa"),
      phiMuaHang: moneyAfter(text, "(4) Phí mua hàng"),
      phiKiemDem: moneyAfter(text, "(5) Phí kiểm đếm"),
      tienCanNang: moneyAfter(text, "(7) Tiền cân nặng"),
      dongGo: moneyAfter(text, "(8) Đóng gỗ"),
      cuocPhatSinh: moneyAfter(text, "(9) Cước"),
      luuKho: moneyAfter(text, "(10) Phí lưu kho"),
      daThanhToan: moneyAfter(text, "Đã thanh toán"),
    };
    const buyFeePct = costs.tienHang ? Math.max(1, Math.round(costs.phiMuaHang / costs.tienHang * 100)) : 1;

    // kiện hàng: mã 7900xxxxxxxxxx — lấy lần xuất hiện đầu (bảng kiện)
    const packages = [];
    const seen = new Set();
    for (const m of text.matchAll(/\b(7900\d{10})\b/g)) {
      const code = m[1];
      if (seen.has(code)) continue;
      seen.add(code);
      const slice = text.slice(m.index, m.index + 400);
      const kgs = [...slice.matchAll(/([\d.]+)\s*kg/g)].map((x) => parseFloat(x[1]));
      const monies = [...slice.matchAll(/([\d][\d.]*)đ/g)].map((x) => parseInt(x[1].replace(/\./g, ""), 10));
      packages.push({
        code, weight: kgs[0] || 0, weightCharged: kgs[1] || kgs[0] || 0,
        unitPrice: monies[0] || 0, total: monies[1] || 0, extra: 0,
        sellerShip: null, toVN: null, inVN: null,
      });
    }

    // timeline: từ lịch sử + dòng ngày trong bảng kiện
    // Link hàng (danh sách sản phẩm trong đơn): #<idx> / <mã link>, đặc điểm, SL, giá VND, giá CNY
    const links = [];
    const linkSection = (text.split("Link hàng")[1] || "").split(/Tổng phí|Lịch sử đơn hàng/)[0];
    for (const m of linkSection.matchAll(/#(\d+)\s*\/\s*(\d+)([\s\S]*?)(?=\n#\d+\s*\/\s*\d+|$)/g)) {
      const chunk = m[3] || "";
      const spec = (chunk.match(/([^\n]*?)\s*--/) || [, ""])[1].trim()
        || (chunk.split("\n").map((s) => s.trim()).find((s) => s && !/Số lượng|đ$|¥|^\d/.test(s)) || "");
      links.push({
        idx: parseInt(m[1], 10),
        linkCode: m[2],
        spec,
        qty: (chunk.match(/Số lượng:\s*([\d/]+)/) || [, ""])[1],
        priceVnd: parseInt(((chunk.match(/([\d.]+)đ/) || [, "0"])[1]).replace(/\./g, ""), 10) || 0,
        priceCny: parseFloat((chunk.match(/([\d.]+)\s*¥/) || [, "0"])[1]) || 0,
        specVi: null,
        imageUrl: null,
        note: null,
      });
    }

    const timeline = {
      datCoc: isoDate(/Đặt cọc 80%[\s\S]*?(\d{2})-(\d{2})-(\d{4})/),
      daMua: isoDate(/đang mua hàng[\s\S]*?(\d{2})-(\d{2})-(\d{4})/),
      veVN: isoDate(/Trên đường về VN:?\s*([0-3]\d)-(\d{2})-(\d{4})/),
      khoVN: isoDate(/(?:vừa đến kho VN|Trong kho VN):?\s*([0-3]\d)-(\d{2})-(\d{4})/),
      traHang: isoDate(/Đã trả:?\s*([0-3]\d)-(\d{2})-(\d{4})/),
    };

    const order = {
      id, status, platformKey,
      productName: `Đơn ${id}` + (linkCount ? ` · ${linkCount} link sản phẩm` : " (nhập từ Order Giá Kho)"),
      category: "tech",
      customerName, customerPhone: "",
      vip, shipping: "Chuyển THƯỜNG", warehouse,
      buyFeePct, rate, weightReal, weightCharged, promo: null,
      costs, timeline, packages, links,
      history: id ? [{ at: new Date().toISOString(), text: `Nhập đơn ${id} từ ordergiakho.com qua extension (${links.length} link sản phẩm).` }] : [],
      payments: [],
    };
    return id && (costs.tienHang || costs.tienCanNang) ? order : null;
  }

  function scrape() {
    if (location.host.includes("ordergiakho")) {
      const o = parseOrderGiaKho(document);
      return { platform: "ordergiakho", orders: o ? [o] : [] };
    }
    const platform = detectPlatform();
    return { platform, orders: parseOrders(document, platform) };
  }

  // --- Ngoài môi trường extension (vd test page) → expose để kiểm thử ---
  const inExtension = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
  if (!inExtension) {
    window.__gomdon = { parseOrders, classify, detectPlatform, scrape, parseGiaKhoText };
    return;
  }

  // --- Trong extension: nghe lệnh SCRAPE từ popup, và auto-collect nếu bật ---
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "SCRAPE") { sendResponse(scrape()); return true; }
  });

  chrome.storage.local.get("auto", ({ auto }) => {
    if (!auto) return;
    const r = scrape();
    if (r.orders.length) chrome.runtime.sendMessage({ type: "INGEST", orders: r.orders, platform: r.platform });
  });
})();
