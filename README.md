# CAH.Cinema — Frontend

React + TypeScript + Vite frontend for the CAH Cinema ticket-booking system,
built from the Figma design (`CAH Cinema đặt vé phim`) and wired to the Spring
Boot API in `../Backend_CAH_Cinema`.

## Chạy

```bash
npm install
```

```bash
npm run dev
```

Mở http://localhost:5173. Dev server proxy `/api` sang `http://localhost:8080`
(backend Spring Boot), nên không cần cấu hình CORS khi phát triển.

| Lệnh | Việc |
| --- | --- |
| `npm run dev` | Dev server + proxy sang backend |
| `npm run build` | Typecheck rồi build production vào `dist/` |
| `npm run preview` | Xem thử bản build |
| `npm run typecheck` | Chỉ chạy `tsc --noEmit` |

### Biến môi trường

Copy `.env.example` thành `.env`:

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `VITE_API_BASE_URL` | rỗng | Base URL của backend. Để rỗng thì dùng proxy của Vite. Đặt URL tuyệt đối khi build production. |
| `VITE_PROXY_TARGET` | `http://localhost:8080` | Đích mà dev proxy forward `/api` tới. |

Backend cần PostgreSQL, Redis và các biến môi trường của nó (`DB_URL`,
`JWT_SECRET`, …) — xem `Backend_CAH_Cinema/README.md`.

## Cấu trúc

```
src/
  api/
    types.ts        # Mirror của toàn bộ DTO backend
    endpoints.ts    # Mọi lời gọi API, nhóm theo module backend
  lib/
    http.ts         # fetch wrapper: bearer token, tự refresh, bóc ApiResponse
    format.ts       # Tiền tệ, ngày giờ, LocalDateTime (không lệch timezone)
    seatmap.ts      # Chuyển SeatDTO[] thành model hàng/ghế để render
    palette.ts      # Màu placeholder poster theo id
  store/
    auth.tsx        # Phiên đăng nhập, role, tự validate lại khi F5
    toast.tsx       # Thông báo thành công / lỗi
    bookingDraft.ts # Giữ ghế đã chọn + context suất chiếu giữa các bước
  components/
    ui/             # Button, Field, Modal, StatusBadge, Loading, …
    layout/         # SiteHeader, Stepper, AdminShell, StaffShell, RequireRole
    seat/           # Sơ đồ ghế (khách) + CSS cho trình sửa sơ đồ (admin)
  pages/
    public/   HomePage, MoviesPage, MovieDetailPage, CinemasPage, Promotions*
    auth/     AuthPage (đăng nhập, đăng ký OTP, quên mật khẩu)
    booking/  SeatsPage, CheckoutPage, PaymentResultPage
    account/  MyTicketsPage, AccountPage
    staff/    CounterPage, CheckInPage, RefundsPage
    admin/    Reports, Movies, Cinemas, Showtimes, Pricing, Vouchers,
              Foods, Promotions, Reconciliation
```

## Màn hình (theo bản thiết kế)

| Thiết kế | Route |
| --- | --- |
| W1 Trang chủ | `/` |
| W2 Chi tiết phim | `/movies/:movieId` |
| W3 Chọn ghế | `/booking/showtimes/:showtimeId/seats` |
| W4 Bắp nước & thanh toán | `/booking/showtimes/:showtimeId/checkout` |
| W5 Trạng thái thanh toán | `/booking/:bookingId/result`, `/payment/return` |
| W6 Vé của tôi + hủy vé | `/my-tickets` |
| W7 Xác thực | `/auth` |
| W8 Tài khoản | `/account` |
| W9 Rạp | `/cinemas` |
| W10 Ưu đãi | `/promotions` |
| 4a Bán vé tại quầy | `/staff` |
| 4b Soát vé | `/staff/check-in` |
| 4c Hủy & hoàn tiền | `/staff/refunds` |
| 5a–5i Quản trị | `/admin`, `/admin/movies`, `/admin/cinemas`, `/admin/showtimes`, `/admin/pricing`, `/admin/vouchers`, `/admin/foods`, `/admin/promotions`, `/admin/reconciliation` |

Ngoài ra: `/movies` (toàn bộ danh mục phim, có lọc) và `/promotions/:id`.

Route bị chặn theo đúng `SecurityConfig` của backend: `/admin/**` yêu cầu
`ROLE_ADMIN`, `/staff/**` yêu cầu `ROLE_STAFF` hoặc `ROLE_ADMIN`.

## Cách nối API

- **Bọc response.** Hầu hết endpoint trả `ApiResponse<T>`; `http.ts` bóc sẵn
  `data`. Riêng nhóm `/admin/promotions` trả DTO trực tiếp nên dùng
  `requestRaw` (xem `docs/api/11-promotions.md`).
- **Token.** Access token gắn vào `Authorization: Bearer`. Gặp 401 thì tự gọi
  `/auth/refresh` một lần (single-flight) rồi thử lại; refresh hỏng thì xóa
  phiên và bắn sự kiện để `AuthProvider` đăng xuất.
- **Thời gian.** `LocalDateTime` của backend không có timezone, nên được parse
  thủ công theo giờ địa phương để không bị lệch múi giờ.
- **Giữ ghế.** Chọn ghế gọi `POST /seats/{id}/lock`, bỏ chọn gọi `DELETE`;
  đóng tab thì nhả lock. Trước khi sang thanh toán gọi `POST /seats/pre-lock`
  để chốt lại. Đồng hồ đếm ngược 5 phút khớp TTL của Redis lock.
- **Số tiền.** Màn chọn ghế/thanh toán chỉ hiển thị **tạm tính**
  (`basePrice × hệ số loại ghế`), vì hệ số ngày/khung giờ/định dạng nằm trong
  price-config chỉ admin đọc được. Số tiền chính thức là của
  `POST /api/v1/bookings`.
- **Hủy vé.** Lấy `cancellation-quote` trước, rồi `cancel` kèm `quoteToken` để
  backend phát hiện giá đã đổi (`QUOTE_EXPIRED_OR_CHANGED`).
- **Thanh toán.** Tạo booking xong mới gọi `stripe|vnpay|momo/pay` rồi chuyển
  trình duyệt sang cổng thanh toán. Nếu bước chuyển cổng lỗi, booking vẫn tồn
  tại ở trạng thái `PENDING` nên app đưa người dùng sang trang kết quả để thử
  lại. Trang kết quả **poll** `GET /bookings/{id}` chứ không tin query string,
  vì thanh toán chỉ được xác nhận qua IPN/webhook.

## Những chỗ backend chưa có endpoint

Các phần này được dựng giao diện nhưng **không** bịa dữ liệu — màn hình nói rõ
còn thiếu gì:

1. **Hàng đợi đối soát & outbox email (5i).** Không có API liệt kê refund cần rà
   soát, và module `outbox` mới chỉ có ở tầng domain, chưa có controller. Trang
   `/admin/reconciliation` thay bằng hai công cụ chạy được: tra một booking qua
   `staff/bookings/{id}/cancellation-quote` và nhận/chi một refund theo mã.
2. **Danh sách refund cho nhân viên (4c).** Chỉ có `claim` và
   `confirm-cash-payout` theo `refundId`. Trang `/staff/refunds` dựng hàng đợi
   từ các booking vừa hủy tại quầy (lưu trong `sessionStorage`) và cho phép mở
   một refund theo mã.
3. **Mã QR của vé (W6).** Vé QR có `purpose=TICKET_QR` nhưng chưa có endpoint
   trả về, nên chỗ QR hiển thị ghi chú thay vì mã giả.
4. **Lịch sử soát vé (4b).** Chưa có API liệt kê lượt quét; trang chỉ giữ lịch
   sử trong phiên làm việc.
5. **Chi tiết một suất chiếu.** Không có `GET /public/showtimes/{id}`, nên
   thông tin suất (phim, phòng, giờ, giá gốc) được mang theo từ lúc người dùng
   bấm chọn suất và lưu vào `sessionStorage` (`store/bookingDraft.ts`).
6. **Hệ số loại ghế & danh sách loại ghế.** Bảng `seat_types` chưa có endpoint.
   Trình sửa sơ đồ ghế đọc `seatTypeId` từ chính ghế hiện có của phòng, và báo
   lỗi rõ ràng nếu phòng thiếu một loại ghế nào đó.
7. **Danh sách rạp cho admin.** Chỉ có `GET /admin/cinemas/{id}`, nên trang quản
   trị dùng `GET /public/cinemas` để liệt kê.
8. **Thể loại trong danh sách phim.** `MovieSummaryDTO` không có `genres`, nên
   bảng phim ở trang quản trị không hiển thị cột thể loại (chỉ có ở panel sửa).
9. **Đăng nhập Google.** `POST /auth/google` đã sẵn sàng nhưng cần Google
   Identity client-id ở frontend; nút hiện báo hướng dẫn thay vì gọi mù.
