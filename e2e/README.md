# Test UI bằng Playwright

| Tầng | Lệnh | Cần gì | Chạy ở đâu |
|---|---|---|---|
| Mock | `npm run test:ui` | Không cần backend, API giả bằng `page.route` | Mỗi PR |
| E2E | `npm run test:e2e` | Stack E2E đang chạy | Hằng đêm, chạy tay |
| Smoke | `npm run test:smoke` | Mạng, chỉ đọc site thật | Sau mỗi lần deploy |

Lần đầu trên máy mới: `npx playwright install chromium`.

Xem báo cáo sau khi chạy: `npx playwright show-report`.

## Stack E2E

`npm run e2e:stack:up` clone `main` của repo backend vào `e2e/.stack/backend`, build image rồi bật Postgres (cổng 55432), Redis (56379), backend (8081). Mỗi lần bật là một DB sạch. Stack này tách biệt với backend dev ở cổng 8080.

Tắt bằng `npm run e2e:stack:down`.

E2E tự dừng nếu `E2E_API_URL` hoặc `E2E_DB_URL` không trỏ vào máy local, vì test ghi dữ liệu.

## Cấu trúc

```
e2e/
  fixtures/   mock-api, loginAs, db, FakeVnpay
  mocks/      dữ liệu giả có kiểu theo src/api/types.ts
  pages/      các bước dùng chung của luồng đặt vé
  specs/      mock/  e2e/  smoke/
  stack/      docker-compose, seed tài khoản
```

Mã kịch bản (`AUTH-02`, `SEAT-04`...) nằm trong tên test. Lọc theo ưu tiên: `npx playwright test --project=mock -g @P0`.

## Thanh toán trong E2E

`FakeVnpay` chặn redirect sang sandbox VNPay, gửi IPN có chữ ký thật tới backend, rồi đưa trình duyệt về return URL. Không có request nào ra cổng thật.

## Lỗi đã biết

Các test dùng `test.fail()` đang ghi nhận lỗi thật của app. Khi sửa xong lỗi, test đó báo đỏ để nhắc bỏ `test.fail()`.

| Test | Lỗi |
|---|---|
| `PAY-03` | Có `vnp_ResponseCode=00` trên URL là báo thành công dù booking còn PENDING |
| `PAY-04` | `GET /bookings/{id}` lỗi thì vẫn quay "Đang xác nhận thanh toán" |
| `CHK-06` (5 biến thể) | Frontend chép cứng hệ số giá, khác `price_configs` và bỏ qua ngày lễ |
| `SEAT-06` | Bấm Back khỏi màn ghế, quay lại không chọn được ghế của chính mình |
| `CNT-01` | Màn quầy không giữ ghế trước khi tạo đơn, backend từ chối |
| `SEC-09` | `/users/me` lỗi bất kỳ cũng xóa phiên đăng nhập |
| `TIX-09` | Vé đã hủy biến mất khỏi "Vé của tôi" |
