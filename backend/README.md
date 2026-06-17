# GomĐơn — Backend (.NET 8 Web API)

Modular Monolith · PostgreSQL + Dapper · Serilog (Rolling File) · Docker. Nhận đơn
từ Chrome Extension, phục vụ Dashboard quản lý đơn mua hộ Trung Quốc → Việt Nam.

## Chạy bằng Docker (khuyến nghị)

```bash
cd backend
docker compose up -d --build
```

Chỉ 2 container: **API** (cổng 8080) + **PostgreSQL** (cổng 5432). Khi khởi động,
API tự: chạy schema (`db/init.sql`), seed admin và 24 đơn demo.

- Swagger:   http://localhost:8080/swagger
- Health:    http://localhost:8080/health
- Tài khoản: `maianh@gomdon.vn` / `demo1234`

> **Prod:** đặt `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` trong `.env` trước khi deploy.
> Sau deploy, đổi mật khẩu hoặc khóa tài khoản demo `maianh@gomdon.vn` (mật khẩu công khai trong tài liệu).
> Nhân viên tự đăng ký ở màn đăng nhập → admin duyệt & gán role tại trang **Người dùng**.

Dừng / xoá dữ liệu: `docker compose down` (giữ data) hoặc `down -v` (xoá DB).

## Chạy không Docker (chỉ DB trong Docker)

```bash
docker run -d --name gomdon-db -p 5432:5432 \
  -e POSTGRES_DB=gomdon -e POSTGRES_USER=gomdon -e POSTGRES_PASSWORD=gomdon postgres:16-alpine
dotnet run --project src/GomDon.Api
```

## API

| Method | Route | Mô tả | Auth |
|--------|-------|-------|------|
| POST | `/v1/auth/login` | Đăng nhập → JWT | — |
| GET  | `/v1/auth/me` | Thông tin user | JWT |
| GET  | `/v1/orders` | Danh sách (status, payOnly, search, sort, page, pageSize) | JWT |
| GET  | `/v1/orders/{id}` | Chi tiết đơn (phí 1..10, kiện, lịch sử, thanh toán) | JWT |
| POST | `/v1/orders/ingest` | Extension đẩy đơn | header `X-Api-Key` |
| GET  | `/v1/dashboard/summary` | KPI, chuỗi 14 ngày, thống kê sàn/kho | JWT |

Ví dụ:
```bash
TOKEN=$(curl -s -X POST localhost:8080/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"maianh@gomdon.vn","password":"demo1234"}' | jq -r .token)

curl localhost:8080/v1/orders?pageSize=5 -H "Authorization: Bearer $TOKEN"

curl -X POST localhost:8080/v1/orders/ingest \
  -H 'X-Api-Key: gd_live_8f3a_dev_ingest_token_2c7b' \
  -H 'Content-Type: application/json' \
  -d '{"productName":"Áo khoác","customerName":"Nguyễn A","rate":4035,
       "costs":{"tienHang":1000000,"shipTQ":50000,"phiMuaHang":10000,"tienCanNang":100000}}'
```

## Cấu trúc

```
backend/
├─ db/init.sql                     # schema PostgreSQL (6 bảng + lookup)
├─ docker-compose.yml              # API + Postgres
├─ Dockerfile                      # multi-stage build
└─ src/
   ├─ GomDon.Api/                  # host: Program.cs, Controllers, Auth (JWT), Startup (bootstrap+seed)
   ├─ GomDon.Modules.Orders/       # domain: Models, Repository (Dapper), Service
   ├─ GomDon.Infrastructure/       # DB connection factory (Npgsql)
   └─ GomDon.Shared/               # PasswordHasher, PagedResult
```

## Công thức phí (1..10) — khớp hệ thống tham chiếu

```
(6) Tổng tiền hàng = (1) tiền hàng + (2) phí trả thêm + (3) ship TQ + (4) phí mua + (5) phí kiểm đếm
Tổng giá trị đơn   = (6) + (7) tiền cân nặng + (8) đóng gỗ + (9) cước phát sinh + (10) phí lưu kho
Còn thiếu          = Tổng giá trị đơn − Đã thanh toán
```
Các tổng được tính bằng **GENERATED column** trong `order_costs` (không lệch dữ liệu).

## Cấu hình (đổi khi chạy thật)
`appsettings.json` / biến môi trường trong `docker-compose.yml`:
`ConnectionStrings__Postgres`, `Jwt__Key`, `Ingest__Token`, `Cors__Origins__0`, `Seed__DemoData`.

## Ghi chú
- Log ghi ra `logs/gomdon-*.log` (rolling theo ngày, giữ 30 ngày) — không dùng ELK/Seq.
- `order_history` / `order_payments` có thể chuyển sang **Table Partitioning** theo tháng khi dữ liệu lớn (xem ghi chú trong `db/init.sql`).
