# GomĐơn Collector — Chrome Extension (MV3, vanilla JS)

Thu thập đơn từ trang sàn Trung Quốc (Taobao/Tmall/1688) và gửi về API GomĐơn
qua `POST /v1/orders/ingest`.

## Cấu trúc
```
extension-mv3/
├─ manifest.json          # MV3: action(popup) + background + content_scripts
├─ background.js          # service worker: lưu cấu hình, gọi /ingest, đếm + log
├─ content/collector.js   # content script: đọc DOM trang sàn → payload ingest
├─ popup/                 # popup.html + popup.css (tái dùng design) + popup.js
└─ test-page/taobao.html  # trang Taobao giả lập để thử parser
```

## Cài đặt (load unpacked)
1. Đảm bảo API đang chạy: `cd ../backend && docker compose up -d`
2. Mở `chrome://extensions` → bật **Developer mode** (góc trên phải)
3. **Load unpacked** → chọn thư mục `extension-mv3/`
4. Bấm icon extension → mở **Cấu hình API**:
   - **Endpoint**: `http://localhost:8080`
   - **Access Token**: lấy `INGEST_TOKEN` trong `backend/.env`
   - **Lưu cấu hình** → trạng thái "Đã kết nối API"

## Dùng thử ngay (không cần tài khoản Taobao thật)
1. Mở `chrome://extensions` → ở card extension, bật cho phép truy cập, rồi mở trang test:
   chạy `python3 -m http.server 8090` trong `extension-mv3/`, mở
   `http://localhost:8090/test-page/taobao.html`
2. Bấm icon extension → thấy "Phát hiện 4 đơn" → **Thu thập 4 đơn** →
   4 đơn xuất hiện trên Dashboard (trạng thái *Chờ đặt cọc*)

## Hoạt động
- **Thu thập trang hiện tại**: popup nhắn `SCRAPE` cho content script → trả danh sách
  đơn → gửi `INGEST` cho background → background `POST /v1/orders/ingest` kèm `X-Api-Key`.
- **Thu thập tự động**: bật công tắc → content script tự scrape khi vào trang sàn.
- Bộ đếm (hôm nay / phiên) + nhật ký lưu trong `chrome.storage.local`.

## ⚠️ Tinh chỉnh cho sàn thật
`content/collector.js` dùng `SELECTORS` nhắm tới **cấu trúc đại diện** (xem test page).
Trang Taobao/Tmall/1688 thật có class **động** và DOM khác nhau — cần:
1. Mở trang "đơn đã mua" thật, dùng DevTools tìm selector của: mã đơn, tên SP, giá, SL, shop.
2. Cập nhật object `SELECTORS` (và `parsePrice`/`classify` nếu cần) cho từng sàn.
3. Mỗi sàn nên có nhánh selector riêng (Taobao ≠ 1688 ≠ Tmall).

Phí mua hộ (cân nặng, đóng gỗ, lưu kho…) **không có** trên trang sàn — chúng được hệ
thống/kho bổ sung sau; extension chỉ thu phần đơn gốc (sản phẩm + giá) ở trạng thái *Chờ đặt cọc*.
