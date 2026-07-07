# GomĐơn — Phân tích chức năng FE + BE & Đề xuất cải thiện

> Mục tiêu đánh giá: **"Tạo ra một app dễ dàng quản lý các mặt hàng bán và cả nhập"**
> Ngày phân tích: 2026-07-07

---

## 1. Tổng quan dự án

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18 + Vite, không dùng React Router (tự viết History API routing), Radix UI (popover/select), CSS thuần theo design language "Niêm Phong" |
| Backend | .NET 8 Web API, modular monolith (Api / Modules.Orders / Modules.Retail / Modules.Users / Infrastructure / Shared), Dapper + PostgreSQL, JWT, FluentValidation, Serilog |
| Hạ tầng | Docker Compose (API + Postgres), Caddy (SPA try_files), Swagger |
| Extension | Chrome MV3 "GomĐơn Collector" — thu thập đơn mua hộ từ Taobao/Tmall/1688 → POST `/v1/orders/ingest` |
| Tests | 16 file unit test backend (pricing, services, validators) |

App là **ứng dụng kép**:
- **(A) Mua hộ TQ**: nhận đơn từ extension, dịch AI tên hàng, theo dõi trạng thái, công thức phí 1..10, thanh toán.
- **(B) Bán lẻ (retail)**: sản phẩm/tồn kho, nhập kho từ đơn mua hộ, bán hàng (KM/combo/tặng), tính giá, phụ phí, báo cáo. **Đây là phần trực tiếp phục vụ mục tiêu.**

---

## 2. Danh sách chức năng hiện có

### 2.1 Backend — Endpoints

| Nhóm | Endpoint | Chức năng | Auth |
|---|---|---|---|
| Auth | POST `/v1/auth/login` · `/register` · GET `/me` | Đăng nhập JWT, tự đăng ký (pending), thông tin user | Anonymous / JWT |
| Account | PATCH `/v1/account/password` · `/profile` | Tự đổi mật khẩu / tên | JWT |
| Users | GET/POST `/v1/users`, PATCH `/{id}`, POST `approve/reject/disable/enable/reset-password` | Quản trị user, duyệt đăng ký | admin |
| Orders | GET `/v1/orders` (+`/{id}`), POST `/ingest`, PATCH `/{id}/status`, DELETE `/{id}` | Đơn mua hộ: list server-side (filter/search/sort/page), ingest từ extension + dịch AI, đổi trạng thái (ghi lịch sử), xoá cascade | JWT / X-Api-Key |
| Dashboard | GET `/v1/dashboard/summary` | KPI + chuỗi 14 ngày + thống kê sàn/kho (chỉ mua hộ) | JWT |
| Products | GET/POST `/v1/products`, PATCH/DELETE `/{id}`, POST `/bulk-delete`, `/{id}/restore`, GET `/{id}/cost-types` | CRUD SKU, chống trùng SKU, xoá thông minh (chặn nếu đang dùng / soft-delete nếu có lịch sử / hard delete), thùng rác + khôi phục, phụ phí mặc định theo SKU | JWT |
| Cost types | CRUD `/v1/cost-types` | Loại chi phí: ₫ / % / theo lô (pack_price ÷ pack_size) | JWT |
| Receive | GET `/v1/retail/receive/preview/{orderId}`, POST `/confirm`, GET `/v1/retail/imports` | Nhập kho từ đơn mua hộ: phân bổ chi phí chung về từng dòng (LandedCostAllocator) → giá vốn gợi ý, ghi `stock_movements` + cập nhật avg_cost bình quân gia quyền (transaction) | JWT |
| Sales | GET/POST `/v1/sales`, POST `/{id}/return` | Đơn bán: item lẻ + combo (giãn qua ComboAllocator), dòng tặng, chi phí %, tính profit; trả hàng cộng lại tồn | JWT |
| Promotions | CRUD + GET `/active`, `/{id}/products` | KM percent/fixed theo khoảng ngày, gắn nhiều SKU, chọn giá tốt nhất/SP | JWT |
| Combos | CRUD + GET `/{id}/components` | Combo thành phần Bán/Tặng, kiểm tồn > 0 | JWT |
| Pricing | POST `/v1/pricing/calc` | Quét nhiều mức markup/margin, cờ lỗ, làm tròn đẹp | JWT |
| Reports | GET `/v1/retail/reports`, `/v1/retail/summary` | Lãi theo kênh / SKU / KM; KPI tồn (ngưỡng low-stock hard-code = 10) | JWT |
| Khác | GET `/health`, GET `/v1/img?u=` | Health check, proxy ảnh alicdn (allowlist chống SSRF) | Anonymous |

### 2.2 Backend — Nghiệp vụ & công thức

- **Tồn kho**: sổ kho `stock_movements` (in/out/adjust/return), **tồn = SUM(qty)** động — không có cột tồn vật lý.
- **Giá vốn**: bình quân gia quyền cập nhật khi nhập; phân bổ chi phí chung theo tỷ trọng giá trị (`share = sharedCost × price/Σprice`).
- **Giá bán**: markup `cost×(1+pct)` / margin `cost/(1−pct)`; phụ phí percent tính trên vốn (tránh vòng lặp).
- **Đơn bán**: `profit = revenue − cogs − promo_cost(hàng tặng) − extra(% revenue)`.
- **DB**: 6 bảng mua hộ (orders, order_costs GENERATED columns, packages, timeline, history, payments, links) + 10 bảng bán lẻ (products soft-delete, cost_types, product_cost_types, stock_movements, product_sources, sales, sale_items, sale_costs, promotions, combos…).

### 2.3 Frontend — Các trang

| Trang | Chức năng chính | Thiếu đáng chú ý |
|---|---|---|
| **Dashboard** | 4 KPI mua hộ, bar 14 ngày, donut trạng thái, hbar sàn/kho, 6 đơn gần đây | Không có KPI bán lẻ; không chọn khoảng thời gian |
| **Orders** | List server-side (filter/search/sort/page), 3 bố cục, chips đếm, **xuất CSV** | Không tạo/sửa đơn tay; không bulk |
| **OrderDetail** (drawer) | Timeline, kiện, giá vốn/cái sau phân bổ, truy vết Đơn→Kho, breakdown phí 1..10, lịch sử, thanh toán, hoàn thành/xoá đơn | Không đổi trạng thái từng bước; không ghi thanh toán mới |
| **Inventory (retail.jsx)** | KPI tồn, tabs (Tất cả/Đang bán/Ẩn/Thùng rác), xem theo lô nhập, search, **bulk delete**, CRUD SP + phụ phí theo SKU, stockbar cảnh báo màu, lọc theo đơn | Không sort cột; client-side toàn bộ; không bulk edit; không export; danh mục cứng; không NCC/đơn vị tính/upload ảnh; không lịch sử xuất-nhập trên UI; không điều chỉnh tồn/kiểm kê |
| **Receive** | Nhập kho theo mã đơn mua hộ: preview phân bổ vốn → gắn/tạo SKU → sửa SL+giá → xác nhận (~4-5 bước) | **Chỉ nhập được từ đơn mua hộ** — không nhập tự do/NCC ngoài; không import Excel; không barcode |
| **Sales** | List đơn bán, trả hàng; modal tạo đơn: SKU dropdown (hiện tồn), dòng Bán/Tặng, tự áp KM, combo, gợi ý giá %, chi phí phát sinh, tổng kết lợi nhuận realtime, chặn vượt tồn | Không POS/bán nhanh/barcode; không in hoá đơn; không công nợ; không sửa đơn; list không search/filter/paging |
| **Pricing** | Máy tính giá: chọn SKU tự điền phụ phí, thanh kéo mức lời, markup vs margin, cảnh báo lỗ | Không lưu giá về sản phẩm |
| **CostTypes** | CRUD phụ phí (₫/%/lô), bật/tắt | Không search |
| **Promotions** | CRUD KM, gắn nhiều SKU (checklist ảnh), khoảng ngày, bật/tắt | Picker không search; không check chồng lấn |
| **Combos** | CRUD combo, tồn khả dụng động, tính vốn+lời, gợi ý giá | Không search thành phần |
| **Reports** | 3 bảng: lãi theo kênh / SKU / đợt KM | **Không chọn thời gian, không biểu đồ, không export**; thiếu báo cáo tồn/nhập/bán chậm |
| **Users / Account / Login** | Duyệt đăng ký, role, khoá/mở, reset MK; đổi tên/MK; đăng nhập/đăng ký | Không quên mật khẩu |
| **TopBar/Theme** | Search toàn cục (`/`), dark mode, tuỳ chỉnh accent/mật độ/bố cục | Chuông thông báo là chấm tĩnh, không hoạt động |
| **Extension MV3** | Thu thập đơn Taobao/Tmall/1688 → ingest; enrich tên qua og:title; health check | Selector DOM mới ở mức test-page; chỉ phục vụ mua hộ |

---

## 3. Đánh giá so với mục tiêu "quản lý hàng bán + nhập dễ dàng"

### ✅ Điểm mạnh sẵn có
- Nền tảng nghiệp vụ tốt: phân bổ chi phí về giá vốn rất chi tiết, lợi nhuận thực realtime, KM + combo + hàng tặng, truy vết Đơn ↔ Kho, thùng rác/khôi phục, chặn bán vượt tồn.
- Kiến trúc backend sạch (modular monolith, Dapper, validator, unit tests cho pricing/services).
- UI có design language riêng, dark mode, responsive cơ bản, deep-link.

### 🔴 Khoảng trống lớn nhất (chặn mục tiêu)

1. **Nhập hàng chỉ có 1 đường**: nhập kho bắt buộc gắn đơn mua hộ TQ. **Không có phiếu nhập thủ công** (hàng từ NCC nội địa, hàng tự có), không import Excel/CSV, không nhà cung cấp, không sửa ngày nhập.
2. **Không có điều chỉnh tồn / kiểm kê**: DB đã có `type='adjust'` trong `stock_movements` nhưng không có endpoint + UI nào dùng. Lệch kho thực tế không xử lý được.
3. **Không có lịch sử xuất-nhập-tồn trên UI**: sổ kho tồn tại trong DB nhưng người dùng không xem được thẻ kho từng SKU.
4. **Bán hàng chưa "dễ"**: không POS/bán nhanh, không barcode, không in hoá đơn, không công nợ khách, không sửa/trả một phần đơn.
5. **Cảnh báo tồn thấp hình thức**: ngưỡng hard-code = 10 cho mọi SKU, không đặt min theo SKU, không có danh sách "sắp hết", chuông thông báo không hoạt động.
6. **Không export dữ liệu bán lẻ**: sản phẩm/tồn, đơn bán, báo cáo đều không xuất Excel/CSV (chỉ Orders mua hộ có CSV).
7. **Không scale danh sách**: products/sales/promotions/combos/cost-types tải toàn bộ, không server-side paging/filter; bảng sản phẩm không sort cột.

### 🟠 Vấn đề kỹ thuật cần sửa (backend)

1. **Race condition bán vượt tồn**: SaleRepository kiểm tồn rồi INSERT trong transaction nhưng **không khoá row** (`SELECT ... FOR UPDATE`); hai đơn đồng thời có thể bán âm kho. Cập nhật `avg_cost` khi nhập song song cũng lost-update.
2. **Phân quyền retail thô**: mọi endpoint bán lẻ chỉ `[Authorize]` — viewer/staff/admin quyền như nhau; FE cũng không ẩn nút theo role ở trang bán lẻ.
3. **Không audit trail retail**: sales/combos/promotions/cost_types không có created_by/updated_at; xoá đơn mua hộ là hard-delete cascade.
4. **JWT không refresh/revoke**: user bị khoá vẫn dùng token cũ tới 12h.
5. **Validation hổng**: CreateSale không validate `Combos`; Promotion không check `start_at < end_at`; Delete promotion/combo bỏ qua kết quả GetById.
6. **Tồn = SUM(movements) mỗi query** — chưa có snapshot/materialized view, sẽ chậm dần.
7. Seed admin `demo1234` mặc định; Swagger/health mở công khai mọi môi trường; ingest API key so sánh chuỗi thường.

---

## 4. Lộ trình cải thiện đề xuất (ưu tiên theo mục tiêu)

### Giai đoạn 1 — Hoàn thiện vòng NHẬP (tác động lớn nhất)
- [ ] **Phiếu nhập thủ công**: POST `/v1/retail/receive/manual` (không cần orderId) — chọn/tạo SKU, SL, giá vốn, NCC (bảng `suppliers` mới), ghi chú; UI thêm tab "Nhập tự do" trong ReceiveModal.
- [ ] **Điều chỉnh tồn + kiểm kê**: endpoint + UI dùng `type='adjust'` sẵn có (lý do: hỏng/mất/kiểm kê).
- [ ] **Thẻ kho theo SKU**: GET `/v1/products/{id}/movements` + drawer lịch sử xuất-nhập trên trang Inventory.
- [ ] **Import Excel/CSV** danh sách hàng nhập.

### Giai đoạn 2 — Bán "dễ" hơn
- [ ] **Màn bán nhanh (POS-lite)**: trang riêng thay modal — ô tìm SKU autofocus, phím tắt, danh mục dạng lưới ảnh, tổng tiền to.
- [ ] **Barcode**: sinh mã vạch từ SKU (in tem) + quét bằng camera/máy quét (input keyboard-wedge là đủ, không cần thư viện nặng).
- [ ] Trả hàng **một phần**, sửa đơn nháp, in hoá đơn (print CSS).
- [ ] Công nợ khách đơn giản (paid_amount trên sales).

### Giai đoạn 3 — Kiểm soát & báo cáo
- [ ] Ngưỡng tồn tối thiểu **theo SKU** (`min_stock` trên products) + tab lọc "Sắp hết" + chuông thông báo hoạt động thật.
- [ ] Reports: bộ chọn khoảng thời gian, biểu đồ, **export Excel/CSV mọi bảng**, thêm báo cáo tồn kho / nhập theo kỳ / hàng bán chậm.
- [ ] Server-side paging/sort/filter cho products & sales.

### Giai đoạn 4 — Nợ kỹ thuật
- [ ] Khoá tồn khi bán (`FOR UPDATE` trên aggregate hoặc bảng `product_stock` vật lý cập nhật atomic).
- [ ] Phân quyền retail theo role (viewer chỉ đọc, staff không xoá) — cả BE lẫn ẩn nút FE.
- [ ] Audit: created_by/updated_at cho bảng retail; soft-delete cho sales/promotions/combos.
- [ ] Refresh token + revoke khi disable user; guard Swagger theo môi trường; siết seed admin.
- [ ] Vá validation (Combos trong CreateSale, start<end promotion, delete idempotency).

---

*Chi tiết khảo sát: backend đọc toàn bộ Controllers, Services, Pricing, Repositories, `db/init.sql`, `Program.cs`; frontend đọc toàn bộ các trang `src/*.jsx`, `api.js`, extension MV3.*
