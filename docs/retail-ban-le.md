# Bán lẻ — Kho, Chi phí, Máy tính giá & Lợi nhuận (Retail)

Tài liệu tính năng bán lẻ của dashboard GomĐơn: quản lý sản phẩm/kho, chi phí phát
sinh, máy tính giá bán & lợi nhuận, khuyến mãi/combo.

> Trạng thái: **thiết kế đã chốt** — tài liệu tham chiếu cho phần triển khai
> (module `GomDon.Modules.Retail` + nhóm trang "Bán lẻ" ở frontend).
> Mockup trực quan: Claude Design project "GomĐơn" (`68a88f0d-0e35-44b5-b098-e56793c6c6ff`), nhóm card "Bán lẻ".

## Tổng quan

- **Hiểu lại mô hình:** các "đơn" hiện có thực ra là **hàng của chính shop nhập về
  qua một bên mua hộ** (không phải bán cho khách). Công thức phí 1..10 = **giá vốn
  nhập (landed cost)**. Tương lai mở rộng nguồn nhập (tự nhập, bên khác).
- **Lớp bán lẻ** dựng trên hàng đã nhập: catalog sản phẩm → tồn kho → đơn bán → lợi nhuận.
- **Catalog SKU**, gộp tồn nhiều đợt, **giá vốn trung bình** (bình quân gia quyền).
- **Sổ xuất–nhập** (`stock_movements`): tồn = tổng phát sinh, không sửa số tồn trực tiếp.
- **Máy tính giá thông minh:** hiện cả markup (trên vốn) lẫn biên lãi (trên giá bán).
- **Đơn bán** ghi từng đơn → trừ tồn → lợi nhuận thực (kể cả giá vốn hàng tặng).
- **Khuyến mãi:** giảm giá theo đợt + combo/quà tặng.

## Kiến trúc

Module `GomDon.Modules.Retail` song song `Modules.Orders` (Models/Repositories/
Services/Validators + `RetailModule.cs` DI; controller ở `GomDon.Api/Controllers`).
Chỉ **đọc** dữ liệu đơn mua hộ để phân bổ giá vốn — tránh coupling ghi.

## Mô hình dữ liệu (PostgreSQL)

### Catalog sản phẩm
- `products` — `id, sku (unique), name, category, image_url, status (active|hidden),
  avg_cost BIGINT (giá vốn TB, tự tính), list_price BIGINT (nullable), created_at`.
- `product_sources` — nối SKU ↔ link nhập: `product_id, order_id, order_link_id`.

### Tồn kho — sổ xuất nhập
- `stock_movements` — `id, product_id, type (in|out|adjust), qty (âm khi xuất),
  unit_cost, ref_type (import_order|sale|manual), ref_id, at, note`.
  - Tồn hiện tại = `SUM(qty)` theo `product_id`.
  - Giá vốn TB cập nhật khi nhập: `avg_mới = (tồn_cũ×avg_cũ + qty×unit_cost) / (tồn_cũ + qty)`.

### Danh mục chi phí
- `cost_types` — `id, name, default_amount BIGINT (nullable), unit (vnd|percent), active`.
  Chi phí **biến động & tùy chọn**: mỗi lần dùng tick chọn + nhập số (gợi ý theo default).

### Đơn bán
- `sales` — `id, code, customer_name?, channel?, sold_at, revenue, cogs (giá vốn hàng
  bán), promo_cost (chi phí khuyến mãi), extra_cost (chi phí phát sinh), profit, status`.
- `sale_items` — `sale_id, product_id?, combo_id?, qty, unit_price, unit_cost (chốt khi
  bán), line_type (ban|tang), promo_id?`. Hàng tặng: `unit_price=0`, `unit_cost>0`, vẫn xuất kho.
- `sale_costs` — `sale_id, cost_type_id, amount`.

### Khuyến mãi & combo
- `promotions` — `id, name, type (percent|fixed), value, start_at, end_at, active`.
- `promotion_products` — `promotion_id, product_id`.
- `combos` — `id, code, name, image_url, price, active, promotion_id?`.
- `combo_items` — `combo_id, product_id, qty, line_type (ban|tang)`.

## Logic nghiệp vụ

### Phân bổ giá vốn khi nhận đơn vào kho
- Chi phí dùng chung của đơn (ship TQ, cân nặng, đóng gói, phí mua...) chia cho từng
  `order_link` **theo tỷ lệ tiền hàng** (mặc định; có thể đổi theo cân nặng sau).
- `unit_cost` link = (tiền hàng + phí phân bổ) ÷ số lượng → `stock_movements` (in).
- Map link ↔ SKU (`product_sources`); SKU mới thì tạo, đã có thì cộng dồn + cập nhật avg_cost.

### Máy tính giá bán
```
cost_base       = unit_cost + extra_cost
gia_ban_markup  = cost_base × (1 + X%)      # lời X% trên vốn
gia_ban_margin  = cost_base ÷ (1 − X%)      # lời chiếm X% giá bán
loi_nhuan       = gia_ban − cost_base
```
- Thanh kéo 10%→100% + **bảng quét** các mức (10/20/30/50/70/100%) hiện cả markup &
  biên lãi. Biên lãi tại 100% = "—".
- **Làm tròn giá đẹp** (1.000₫ / 5.000₫, tùy chọn). **Cảnh báo lỗ** khi giá < cost_base.
- Hai chế độ: *tính nhanh* (nhập tay) và *gắn SKU* (nạp giá vốn TB, lưu `list_price`).

### Lợi nhuận đơn bán
```
Lợi nhuận thực = revenue − cogs − promo_cost − extra_cost
```
Hàng tặng/KM vẫn xuất kho, giá vốn trừ vào lợi nhuận (tách dòng "Chi phí khuyến mãi").

### Combo
- Gói bán ghép nhiều SKU giá ưu đãi, **không lưu tồn cứng riêng**.
- Tạo combo: tên + ảnh + các SKU thành phần + số lượng; đánh dấu món tặng. Tự tính tổng
  vốn & tổng giá lẻ; nhập giá combo → máy tính hiện tiết kiệm/lời/markup/biên lãi/cảnh báo lỗ.
- **TẠO combo bắt buộc mọi thành phần còn đủ tồn** (chặn nếu món =0). Sau đó nếu hết
  tồn → combo "hết hàng", giữ công thức, bán lại khi nhập thêm.
- Tồn khả dụng combo = `min( floor(tồn_thành_phần ÷ qty_trong_combo) )` (tính động).
- Bán combo → tách thành dòng xuất kho từng thành phần; doanh thu = giá combo; vốn =
  tổng vốn thành phần; quà tặng vào `promo_cost`.
- Báo cáo theo SKU: giá combo chia về thành phần **theo tỷ lệ giá niêm yết**.

### Quy tắc tồn kho chung
- Mọi SKU theo dõi tồn qua `stock_movements`. Bán SKU lẻ: chặn nếu thiếu tồn. Bán combo:
  mọi thành phần phải đủ tồn.

## API (sơ bộ, controller ở GomDon.Api)
- `Products`: list/filter (tất cả|đang bán|khuyến mãi|sắp hết|ẩn), CRUD, chi tiết SKU.
- `CostTypes`: CRUD danh mục chi phí.
- `Pricing`: tính giá (vốn + chi phí + mức lời → bảng quét).
- `Stock`: nhận đơn vào kho, điều chỉnh tồn, lịch sử movements.
- `Sales`: tạo/đọc đơn bán (trừ tồn, tính lợi nhuận).
- `Promotions`, `Combos`: CRUD + tính tồn khả dụng combo.

## Giao diện
- **🧮 Máy tính giá bán** — vốn + tick chi phí → thanh kéo + bảng quét markup/biên lãi.
- **📦 Kho & Sản phẩm** — KPI tồn/giá trị tồn/sắp hết; bảng SKU + badge trạng thái; "Nhận đơn vào kho".
- **🧾 Đơn bán mới** — chọn SP + tặng kèm + chi phí → lợi nhuận thực (tách giá vốn/KM/phát sinh).
- Thêm mục sidebar **"Bán lẻ"**.

## Kế hoạch 3 giai đoạn

1. **Máy tính giá & nền tảng** ✅ (xong) — module + migration `products`/`cost_types`/
   `stock_movements`; catalog SKU (vốn nhập tay); danh mục chi phí; máy tính giá; FE trang
   Kho/Sản phẩm + Máy tính + sidebar.
2. **Tồn kho & đơn bán** ✅ (xong) — nhận đơn vào kho (phân bổ giá vốn); `sales`/`sale_items`/
   `sale_costs` (trừ tồn, lợi nhuận thực); tổng quan bán lẻ doanh thu/lợi nhuận/giá trị tồn.
3. **Khuyến mãi & combo** — ✅ giảm giá theo đợt + hàng tặng (3A); ⏳ combo + báo cáo (3B) — `promotions`/`promotion_products`; `combos`/`combo_items`;
   hàng tặng; báo cáo lời theo SKU/kênh/đợt KM.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Nguồn kho | Từ đơn mua hộ (= giá vốn nhập); lớp "nhập kho" tổng quát |
| Sản phẩm | Catalog SKU, gộp tồn, giá vốn TB (bình quân gia quyền) |
| Tồn kho | Sổ `stock_movements`, tồn = SUM(qty) |
| Bán ra | Ghi từng đơn bán → trừ tồn + lợi nhuận thực |
| Mức lời | Hiện cả markup lẫn biên lãi |
| Chi phí phát sinh | Danh mục loại chi phí, biến động/tùy chọn từng lần |
| Hàng tặng | Xuất kho + giá vốn trừ lợi nhuận; dòng "Chi phí khuyến mãi" riêng |
| Khuyến mãi | Giảm giá theo đợt + combo/quà tặng |
| Phân bổ giá vốn nhập | Theo tỷ lệ tiền hàng |
| Tạo combo khi hết tồn | Chặn — phải đủ tồn mới tạo |
| Phân bổ combo theo SKU | Theo tỷ lệ giá niêm yết |

## Rủi ro / lưu ý
- **Lệch tồn:** dùng sổ movements + chặn bán quá tồn; không sửa số tồn trực tiếp.
- **Giá vốn TB:** chỉ cập nhật khi nhập (in). `adjust` **không** đổi avg_cost, chỉ đổi số lượng.
- **Phụ thuộc Modules.Orders:** chỉ đọc để phân bổ giá vốn; tránh coupling ghi.

---

> Spec đầy đủ (bản brainstorming gốc): `~/.claude/projects/d--Projects-BP/superpowers/specs/2026-06-17-retail-ban-le-design.md`
