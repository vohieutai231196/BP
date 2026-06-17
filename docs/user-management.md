# Quản lý người dùng (User Management)

Tài liệu tính năng quản lý tài khoản & phân quyền của dashboard GomĐơn.

> Trạng thái: **thiết kế đã chốt** — đây là tài liệu tham chiếu cho phần triển khai
> (module `GomDon.Modules.Users` + trang Người dùng ở frontend).

## Tổng quan

- **Tự đăng ký → admin duyệt:** nhân viên đăng ký ở màn đăng nhập (công khai), tài
  khoản tạo ở trạng thái *chờ duyệt* (chưa đăng nhập được). Admin duyệt và gán role,
  hoặc từ chối.
- **RBAC 3 cấp:** quyền được chặn ở **cả backend** (`[Authorize(Roles=…)]`) **lẫn
  frontend** (ẩn/hiện menu & nút). Role chỉ là nhãn → không đủ; backend luôn là nguồn
  enforce thật.
- **Self-service:** mọi user tự đổi mật khẩu và tên hồ sơ của mình.
- **Soft-disable:** khóa tài khoản (`status = disabled`) thay vì xóa cứng, giữ lịch sử.

## Vai trò (role)

| Khóa nội bộ | Nhãn hiển thị | Quyền |
|---|---|---|
| `admin` | Quản trị viên | Toàn quyền + quản lý người dùng |
| `staff` | Nhân viên | Xem dashboard/đơn, đổi trạng thái đơn; **không** xóa đơn, **không** quản lý user |
| `viewer` | Chỉ xem | Chỉ xem dashboard/đơn, không sửa gì |

### Ma trận quyền

| Khả năng | admin | staff | viewer |
|---|:--:|:--:|:--:|
| Xem dashboard / đơn | ✓ | ✓ | ✓ |
| Đổi trạng thái đơn | ✓ | ✓ | ✗ |
| Xóa đơn | ✓ | ✗ | ✗ |
| Quản lý người dùng | ✓ | ✗ | ✗ |
| Tự đổi mật khẩu / hồ sơ | ✓ | ✓ | ✓ |

## Trạng thái tài khoản (`status`)

| Trạng thái | Ý nghĩa | Đăng nhập? |
|---|---|---|
| `pending` | Vừa tự đăng ký, chờ admin duyệt | ✗ (login → **403** "đang chờ duyệt") |
| `active` | Đang hoạt động | ✓ |
| `disabled` | Bị admin khóa | ✗ (login → **403** "đã bị khóa") |

> User tạo trước khi có tính năng này được migration gán mặc định `active`.

## Vòng đời đăng ký

```
Nhân viên đăng ký ──► pending ──► admin Duyệt (gán role) ──► active ──► (Khóa) ──► disabled
                                  └─ admin Từ chối ──► xóa bản ghi          └─ (Mở khóa) ──► active
```

## API

### Auth — không cần đăng nhập

| Method | Route | Mô tả |
|---|---|---|
| POST | `/v1/auth/login` | Đăng nhập → JWT. Sai mật khẩu → 401; `pending`/`disabled` → **403** |
| POST | `/v1/auth/register` | `{email, name, password}` → tạo tài khoản `pending` (rate-limit `auth`) |
| GET  | `/v1/auth/me` | Thông tin user hiện tại (`id, name, email, role`) — JWT |

### Account — mọi user đã đăng nhập

| Method | Route | Body |
|---|---|---|
| PATCH | `/v1/account/password` | `{currentPassword, newPassword}` |
| PATCH | `/v1/account/profile` | `{name}` (email là định danh, không đổi) |

### Users — chỉ admin (`[Authorize(Roles="admin")]`)

| Method | Route | Mô tả |
|---|---|---|
| GET  | `/v1/users?status=&search=&page=&pageSize=` | Danh sách phân trang |
| POST | `/v1/users` | Tạo trực tiếp `{email, name, role, password}` → `active` |
| PATCH | `/v1/users/{id}` | Đổi `{name?, role?}` |
| POST | `/v1/users/{id}/approve` | `{role}` → `pending`→`active` + gán role |
| POST | `/v1/users/{id}/reject` | Xóa bản ghi `pending` |
| POST | `/v1/users/{id}/disable` | Khóa (→ `disabled`) |
| POST | `/v1/users/{id}/enable` | Mở khóa (→ `active`) |
| POST | `/v1/users/{id}/reset-password` | `{newPassword}` |

### Bất biến nghiệp vụ (enforce ở `UserService`)

- Không tự **khóa / hạ quyền / xóa** chính mình.
- Không khóa hoặc hạ quyền **admin `active` cuối cùng**.
- `approve` chỉ áp cho tài khoản `pending`; role gán phải thuộc `{admin, staff, viewer}`.
- Email duy nhất (DB UNIQUE + kiểm tra trước).

Vi phạm → **400** kèm message tiếng Việt (qua `GlobalExceptionHandler`).

## Cơ chế kỹ thuật

- **JWT** mang claim `uid` (id người dùng), `role`, `name`, `sub` (email). Controllers
  đọc `uid` để kiểm tra thao tác-trên-chính-mình và self-service.
- **Mã 403 cho pending/disabled** (không dùng 401): tránh kích hoạt xử lý 401 tập trung
  ở `src/api.js` (vốn xóa token + báo "hết phiên"). Màn Login hiển thị đúng message.
- **Mật khẩu**: PBKDF2-SHA256 (`GomDon.Shared.Security.PasswordHasher`), tối thiểu 6 ký tự.

## Lược đồ dữ liệu

Bảng `users` (bổ sung cột `status`):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
-- status: 'pending' | 'active' | 'disabled'
-- role  : 'admin'   | 'staff'  | 'viewer'
```

Migration chạy idempotent qua `DbBootstrapper` mỗi lần API khởi động → áp được lên DB
đang có dữ liệu, không cần `down -v`.

## Deploy lên VPS

1. **Seed admin từ env** — đặt trong `.env` của VPS (đừng dùng mặc định demo):
   ```
   SEED_ADMIN_EMAIL=...      # admin đầu tiên (để duyệt các đăng ký)
   SEED_ADMIN_PASSWORD=...
   SEED_ADMIN_NAME=...
   ```
   Phải có 1 admin `active` sẵn — nếu không, không ai duyệt được đăng ký.
2. **Tài khoản demo** `maianh@gomdon.vn / demo1234` (công khai trong README) cần được
   **đổi mật khẩu hoặc khóa** sau khi deploy.
3. **Trang đăng ký lộ Internet** — user `pending` không đăng nhập được (vô hại); admin
   từ chối để dọn. Endpoint `register` đã có rate-limit `auth`.
4. **Topology không đổi** — vẫn 3 container (db + api + caddy), không port mới, không
   sửa Caddyfile/CORS/JWT secret.

## Frontend

- `src/login.jsx` — toggle Đăng nhập ↔ Đăng ký trên màn chưa đăng nhập (SPA không có
  router; không phải route `/register`).
- `src/users.jsx` — trang quản lý user (admin): lọc theo trạng thái, duyệt/từ chối,
  đổi role, khóa/mở, đặt lại mật khẩu, tạo user.
- `src/account.jsx` — modal tự đổi mật khẩu / hồ sơ.
- `src/components.jsx` (Sidebar) — mục "Người dùng" chỉ hiện với admin; hiển thị tên/role
  thật của user đăng nhập.
