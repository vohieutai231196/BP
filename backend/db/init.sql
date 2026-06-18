-- ============================================================
--  GomĐơn — PostgreSQL schema (đơn mua hộ Trung Quốc → VN)
--  Mô hình hoá theo trang chi tiết đơn của hệ thống tham chiếu:
--  header đơn, kiện hàng, công thức phí (1..10), mốc vòng đời,
--  lịch sử và thanh toán. Chạy tự động khi container DB khởi tạo.
-- ============================================================

-- ---------- Lookup: sàn nguồn ----------
CREATE TABLE IF NOT EXISTS platforms (
  key   TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  tint  TEXT NOT NULL
);

-- ---------- Khách hàng ----------
CREATE TABLE IF NOT EXISTS customers (
  id    BIGSERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  phone TEXT NOT NULL
);

-- ---------- Người dùng hệ thống (đăng nhập dashboard) ----------
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,         -- PBKDF2 (xem AuthService)
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- migration an toàn: thêm trạng thái tài khoản (pending|active|disabled).
-- User cũ mặc định 'active' (đăng nhập bình thường). User tự đăng ký = 'pending'.
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- ---------- Đơn hàng (header) ----------
-- Trạng thái vòng đời: cho_coc, dang_mua, ve_vn, kho_vn, da_tra,
--                      khieu_nai, thanh_ly, huy
CREATE TABLE IF NOT EXISTS orders (
  id             BIGINT PRIMARY KEY,            -- mã đơn (vd 647940)
  status         TEXT NOT NULL,
  platform_key   TEXT NOT NULL REFERENCES platforms(key),
  customer_id    BIGINT NOT NULL REFERENCES customers(id),
  product_name   TEXT NOT NULL,
  category       TEXT NOT NULL,                 -- shoe/bag/apparel/tech/home/beauty
  vip            TEXT NOT NULL,                 -- "Vip 3"
  shipping_type  TEXT NOT NULL,                 -- "Chuyển THƯỜNG"
  warehouse      TEXT NOT NULL,                 -- kho nhận tại VN
  buy_fee_pct    INT  NOT NULL DEFAULT 1,       -- % phí mua hàng
  exchange_rate  INT  NOT NULL,                 -- tỷ giá ₫/¥ (vd 4035)
  weight_real    NUMERIC(8,2) NOT NULL DEFAULT 0,
  weight_charged NUMERIC(8,2) NOT NULL DEFAULT 0,
  promo          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS ix_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS ix_orders_platform   ON orders(platform_key);

-- ---------- Chi phí đơn (1-1) — công thức phí 1..10 ----------
-- Cột tổng là GENERATED, chỉ tham chiếu cột gốc (ràng buộc của Postgres).
CREATE TABLE IF NOT EXISTS order_costs (
  order_id        BIGINT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  -- Tiền hàng (1..5)
  tien_hang       BIGINT NOT NULL DEFAULT 0,    -- (1)
  phi_tra_them    BIGINT NOT NULL DEFAULT 0,    -- (2)
  ship_tq         BIGINT NOT NULL DEFAULT 0,    -- (3)
  phi_mua_hang    BIGINT NOT NULL DEFAULT 0,    -- (4)
  phi_kiem_dem    BIGINT NOT NULL DEFAULT 0,    -- (5)
  -- Tiền cân nặng (7..10)
  tien_can_nang   BIGINT NOT NULL DEFAULT 0,    -- (7)
  dong_go         BIGINT NOT NULL DEFAULT 0,    -- (8)
  cuoc_phat_sinh  BIGINT NOT NULL DEFAULT 0,    -- (9)
  luu_kho         BIGINT NOT NULL DEFAULT 0,    -- (10)
  da_thanh_toan   BIGINT NOT NULL DEFAULT 0,
  -- (6) Tổng tiền hàng = 1+2+3+4+5
  tong_tien_hang  BIGINT GENERATED ALWAYS AS
    (tien_hang + phi_tra_them + ship_tq + phi_mua_hang + phi_kiem_dem) STORED,
  -- Tổng giá trị đơn = 6 + 7 + 8 + 9 + 10
  tong_chi_phi    BIGINT GENERATED ALWAYS AS
    (tien_hang + phi_tra_them + ship_tq + phi_mua_hang + phi_kiem_dem
     + tien_can_nang + dong_go + cuoc_phat_sinh + luu_kho) STORED,
  -- Còn thiếu = tổng - đã thanh toán
  con_thieu       BIGINT GENERATED ALWAYS AS
    (tien_hang + phi_tra_them + ship_tq + phi_mua_hang + phi_kiem_dem
     + tien_can_nang + dong_go + cuoc_phat_sinh + luu_kho - da_thanh_toan) STORED
);

-- ---------- Kiện hàng (1-n) ----------
CREATE TABLE IF NOT EXISTS order_packages (
  id              BIGSERIAL PRIMARY KEY,
  order_id        BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,                -- mã kiện (vd 79005154431747)
  weight          NUMERIC(8,2) NOT NULL,        -- cân thực
  weight_charged  NUMERIC(8,2) NOT NULL,        -- cân tính tiền (i)
  unit_price      BIGINT NOT NULL,              -- đơn giá ₫/kg
  total           BIGINT NOT NULL,              -- thành tiền
  extra           BIGINT NOT NULL DEFAULT 0,    -- cước thêm
  seller_ship     DATE,                         -- người bán giao
  to_vn           DATE,                         -- trên đường về VN
  in_vn           DATE                          -- về kho VN
);
CREATE INDEX IF NOT EXISTS ix_packages_order ON order_packages(order_id);

-- ---------- Mốc vòng đời (1-1) ----------
CREATE TABLE IF NOT EXISTS order_timeline (
  order_id  BIGINT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  dat_coc   TIMESTAMPTZ,   -- Đặt cọc
  da_mua    TIMESTAMPTZ,   -- Đã mua hàng
  ve_vn     TIMESTAMPTZ,   -- Trên đường về VN
  kho_vn    TIMESTAMPTZ,   -- Trong kho VN
  tra_hang  TIMESTAMPTZ    -- Trả hàng
);

-- ---------- Lịch sử đơn (1-n) ----------
CREATE TABLE IF NOT EXISTS order_history (
  id        BIGSERIAL PRIMARY KEY,
  order_id  BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at        TIMESTAMPTZ NOT NULL,
  text      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_history_order ON order_history(order_id, at);

-- ---------- Thanh toán đơn (1-n) ----------
CREATE TABLE IF NOT EXISTS order_payments (
  id        BIGSERIAL PRIMARY KEY,
  order_id  BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at        TIMESTAMPTZ NOT NULL,
  reason    TEXT NOT NULL,
  amount    BIGINT NOT NULL              -- âm = trừ tiền khách
);
CREATE INDEX IF NOT EXISTS ix_payments_order ON order_payments(order_id, at);

-- ---------- Link hàng / sản phẩm trong đơn (1-n) ----------
CREATE TABLE IF NOT EXISTS order_links (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  idx         INT NOT NULL,                 -- số thứ tự (#1, #2…)
  link_code   TEXT NOT NULL,                -- mã link sản phẩm (vd 3383117)
  spec        TEXT,                         -- đặc điểm / màu gốc (vd 米色)
  spec_vi     TEXT,                         -- đặc điểm dịch sang tiếng Việt (vd kem)
  image_url   TEXT,                         -- ảnh sản phẩm (URL trên CDN sàn)
  qty         TEXT,                         -- số lượng đặt/mua/về (vd 5/5/5)
  price_vnd   BIGINT NOT NULL DEFAULT 0,    -- giá quy đổi VND
  price_cny   NUMERIC(10,2) NOT NULL DEFAULT 0,  -- giá gốc CNY
  note        TEXT
);
CREATE INDEX IF NOT EXISTS ix_links_order ON order_links(order_id, idx);
-- migration an toàn cho bảng đã tồn tại (thêm cột mới nếu chưa có)
ALTER TABLE order_links ADD COLUMN IF NOT EXISTS spec_vi   TEXT;
ALTER TABLE order_links ADD COLUMN IF NOT EXISTS image_url TEXT;

-- ============================================================
--  Ghi chú Table Partitioning (theo PRD — khi dữ liệu lớn)
--  order_history / order_payments là bảng tăng trưởng nhanh.
--  Khi cần, chuyển sang RANGE partition theo tháng của cột `at`:
--    CREATE TABLE order_history (...) PARTITION BY RANGE (at);
--    CREATE TABLE order_history_2026_06 PARTITION OF order_history
--      FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
--  Giữ ở dạng bảng thường cho giai đoạn MVP.
-- ============================================================

-- ============================================================
--  BÁN LẺ (Retail) — catalog sản phẩm, chi phí, sổ kho
-- ============================================================

-- ---------- Sản phẩm bán lẻ (SKU) ----------
CREATE TABLE IF NOT EXISTS products (
  id          BIGSERIAL PRIMARY KEY,
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'other',
  image_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'active',   -- active | hidden
  avg_cost    BIGINT NOT NULL DEFAULT 0,        -- giá vốn TB (₫), GĐ1 nhập tay
  list_price  BIGINT,                           -- giá niêm yết (₫)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_products_status ON products(status);

-- Soft-delete: sản phẩm đã xóa được giữ lại cho ràng buộc FK / báo cáo nhưng ẩn khỏi mọi danh sách.
ALTER TABLE products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- SKU chỉ unique giữa các sản phẩm CHƯA xóa → cho phép thêm lại cùng SKU sau khi đã xóa.
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_sku_active ON products(lower(sku)) WHERE deleted_at IS NULL;

-- ---------- Danh mục loại chi phí phát sinh ----------
CREATE TABLE IF NOT EXISTS cost_types (
  id              BIGSERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  default_amount  BIGINT,                        -- gợi ý số tiền/tỷ lệ (nullable)
  unit            TEXT NOT NULL DEFAULT 'vnd',   -- vnd | percent
  active          BOOLEAN NOT NULL DEFAULT true
);

-- Phụ phí "theo lô": giá lô + quy cách → đơn giá (đơn giá = pack_price / pack_size, tính ở FE).
ALTER TABLE cost_types ADD COLUMN IF NOT EXISTS pack_price BIGINT;
ALTER TABLE cost_types ADD COLUMN IF NOT EXISTS pack_size  INT;

-- ---------- Phụ phí mặc định theo SKU ----------
CREATE TABLE IF NOT EXISTS product_cost_types (
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cost_type_id BIGINT NOT NULL REFERENCES cost_types(id) ON DELETE CASCADE,
  amount       BIGINT,                       -- đơn giá/sp; NULL = dùng default của loại
  PRIMARY KEY (product_id, cost_type_id)
);
CREATE INDEX IF NOT EXISTS ix_pct_product ON product_cost_types(product_id);

-- ---------- Sổ xuất–nhập kho (GĐ2 ghi tự động; GĐ1 chỉ tạo bảng) ----------
CREATE TABLE IF NOT EXISTS stock_movements (
  id          BIGSERIAL PRIMARY KEY,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,                     -- in | out | adjust
  qty         INT NOT NULL,                      -- âm khi xuất
  unit_cost   BIGINT NOT NULL DEFAULT 0,
  ref_type    TEXT,                              -- import_order | sale | manual
  ref_id      BIGINT,
  at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  note        TEXT
);
CREATE INDEX IF NOT EXISTS ix_stock_product ON stock_movements(product_id, at);

-- ---------- Nguồn nhập của SKU (link mua hộ → SKU) ----------
CREATE TABLE IF NOT EXISTS product_sources (
  id            BIGSERIAL PRIMARY KEY,
  product_id    BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id      BIGINT,
  order_link_id BIGINT,
  link_code     TEXT,
  at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_psources_product ON product_sources(product_id);
CREATE INDEX IF NOT EXISTS ix_psources_link    ON product_sources(link_code);

-- ---------- Đơn bán (header) ----------
CREATE TABLE IF NOT EXISTS sales (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL,
  customer_name TEXT,
  channel       TEXT,
  sold_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  revenue       BIGINT NOT NULL DEFAULT 0,
  cogs          BIGINT NOT NULL DEFAULT 0,
  promo_cost    BIGINT NOT NULL DEFAULT 0,
  extra_cost    BIGINT NOT NULL DEFAULT 0,
  profit        BIGINT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'done'
);
CREATE INDEX IF NOT EXISTS ix_sales_sold_at ON sales(sold_at DESC);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;

-- ---------- Dòng hàng đơn bán ----------
CREATE TABLE IF NOT EXISTS sale_items (
  id          BIGSERIAL PRIMARY KEY,
  sale_id     BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  BIGINT REFERENCES products(id),
  combo_id    BIGINT,
  qty         INT NOT NULL,
  unit_price  BIGINT NOT NULL,
  unit_cost   BIGINT NOT NULL,
  line_type   TEXT NOT NULL DEFAULT 'ban',   -- ban | tang
  promo_id    BIGINT
);
CREATE INDEX IF NOT EXISTS ix_sale_items_sale ON sale_items(sale_id);

-- ---------- Chi phí phát sinh của đơn bán ----------
CREATE TABLE IF NOT EXISTS sale_costs (
  id           BIGSERIAL PRIMARY KEY,
  sale_id      BIGINT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  cost_type_id BIGINT,
  name         TEXT NOT NULL,
  amount       BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sale_costs_sale ON sale_costs(sale_id);

-- ---------- Khuyến mãi ----------
CREATE TABLE IF NOT EXISTS promotions (
  id        BIGSERIAL PRIMARY KEY,
  name      TEXT NOT NULL,
  type      TEXT NOT NULL DEFAULT 'percent',  -- percent | fixed
  value     BIGINT NOT NULL DEFAULT 0,        -- percent: % giảm; fixed: giá cố định (₫)
  start_at  TIMESTAMPTZ,
  end_at    TIMESTAMPTZ,
  active    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS promotion_products (
  promotion_id BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  product_id   BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);
CREATE INDEX IF NOT EXISTS ix_promo_products_product ON promotion_products(product_id);

-- ---------- Combo (gói bán ghép) ----------
CREATE TABLE IF NOT EXISTS combos (
  id            BIGSERIAL PRIMARY KEY,
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  image_url     TEXT,
  price         BIGINT NOT NULL DEFAULT 0,
  active        BOOLEAN NOT NULL DEFAULT true,
  promotion_id  BIGINT
);

CREATE TABLE IF NOT EXISTS combo_items (
  id          BIGSERIAL PRIMARY KEY,
  combo_id    BIGINT NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products(id),
  qty         INT NOT NULL DEFAULT 1,
  line_type   TEXT NOT NULL DEFAULT 'ban'   -- ban | tang
);
CREATE INDEX IF NOT EXISTS ix_combo_items_combo ON combo_items(combo_id);

-- ---------- Seed lookup ----------
INSERT INTO platforms (key, label, tint) VALUES
  ('taobao',  'Taobao',    '#ff6a00'),
  ('1688',    '1688',      '#ff7a45'),
  ('pdd',     'Pinduoduo', '#e02e24'),
  ('tmall',   'Tmall',     '#d4143c'),
  ('weidian', 'Weidian',   '#ec5b24')
ON CONFLICT (key) DO NOTHING;

-- Admin demo (maianh@gomdon.vn / demo1234) được seed từ code khi API khởi
-- động (DbSeeder) để hash PBKDF2 luôn khớp AuthService — không hardcode hash ở đây.
