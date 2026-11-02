# Chạy toàn bộ màn hình (khách → nhân viên → quản trị)

Có 3 cách, chọn theo việc bạn cần làm.

| | Cách A — chỉ frontend | Cách B — full stack local | Cách C — backend test online |
| --- | --- | --- | --- |
| Cần gì | Node.js | Node + JDK 17 + Docker (Postgres, Redis) | Node.js + mạng |
| Thời gian | ~1 phút | ~20–30 phút lần đầu | ~1 phút |
| Thấy được | Mọi màn hình, mọi role | Mọi màn hình **có dữ liệu thật** | Mọi màn hình, dữ liệu thật trên server test |
| Dữ liệu | Rỗng / báo lỗi tải | Thật, tự nạp seed | Thật, do server test giữ |
| Dùng để | Review UI, chụp hình, test routing & phân quyền phía client | Test chức năng, luồng đặt vé, thanh toán | Test nhanh mà không phải dựng backend |

---

## Cách A — Xem mọi màn hình, không cần backend

```bash
npm install
```

```bash
npm run dev
```

Mở http://localhost:5173, bật DevTools (F12) → tab **Console**, dán đoạn này:

```js
localStorage.setItem('cah.user', JSON.stringify({
  userId: 9997, name: 'Admin Demo', email: 'admin@cah.com',
  phone: null, avatarUrl: null, authProvider: 'EMAIL',
  role: 'ROLE_ADMIN', totalPaid: 0, totalPoint: 0, rankLevel: 'DIAMOND'
})); location.reload();
```

Đổi `role` để xem vai trò khác: `ROLE_USER` (khách), `ROLE_STAFF` (nhân viên),
`ROLE_ADMIN` (thấy được cả khu nhân viên lẫn quản trị).

Thoát: `localStorage.clear(); location.reload()`

**Vì sao chạy được:** `RequireRole` trong `src/components/layout/RoleShells.tsx`
đọc role từ user cache trong `localStorage`, và trạng thái `loading` chỉ bật khi
có `cah.accessToken`. Không set access token thì guard cho qua ngay.

**Giới hạn:** đây chỉ là mở khóa giao diện. Không có token thật nên mọi lời gọi
API vẫn hỏng — bảng trống, biểu đồ quay mãi. Nó **không** vượt được
`SecurityConfig` của backend, nên không dùng để test chức năng hay bảo mật.

---

## Cách B — Chạy thật cả hệ thống (local)

Đã chạy thành công trên máy Windows ngày 02/11/2026. Các bước dưới là bản đã sửa
theo đúng những gì thực sự cần — khác vài chỗ so với README của backend.

### 1. Cài JDK 17

```bash
winget install EclipseAdoptium.Temurin.17.JDK -e --accept-source-agreements --accept-package-agreements --silent
```

Cài xong nằm ở `C:\Program Files\Eclipse Adoptium\jdk-17.x.y-hotspot`.
Mở terminal mới rồi kiểm tra: `java -version`

### 2. Bật Postgres + Redis

Mở **Docker Desktop** trước, đợi daemon lên. Repo backend nhắc `docker compose up -d`
nhưng **không có `docker-compose.yml`**, nên chạy tay 2 container.

Kiểm tra port 5432 có bị chiếm chưa (`netstat -ano | findstr :5432`). Nếu có project
khác đang giữ, dùng port khác — ví dụ **5433** như dưới đây:

```bash
docker run -d --name cah-postgres -e POSTGRES_DB=cinema_db -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:15
```

```bash
docker run -d --name cah-redis -p 6379:6379 redis:7-alpine
```

### 3. Nạp schema + dữ liệu mẫu

Chạy trong `Backend_CAH_Cinema` (không cần cài `psql`, dùng luôn trong container):

```bash
docker exec -i cah-postgres psql -v ON_ERROR_STOP=1 -U postgres -d cinema_db < cah_cinema.sql
```

```bash
docker exec -i cah-postgres psql -v ON_ERROR_STOP=1 -U postgres -d cinema_db < seed_background_data.sql
```

> **Không cần chạy thư mục `migrations/`.** Đó là script vá cho DB đã deploy từ trước.
> `cah_cinema.sql` (bản 23/10) đã bao gồm sẵn kết quả của cả 6 migration — đã đối chiếu
> từng cột (`original_duration_micros`, `account_type`, `membership_adjusted_at`,
> `stripe_payments.session_id`...). Chạy lại chỉ tổ lỗi.

### 4. Tạo tài khoản admin — bước bắt buộc

Seed **không có tài khoản ROLE_ADMIN nào**, và hash mật khẩu của hai tài khoản
có sẵn (`user@cah.com`, `staff@cah.com`) bị cụt — 55 ký tự thay vì 60 — nên
BCrypt luôn trả về false và **không đăng nhập được bằng bất kỳ mật khẩu nào**.

Đoạn SQL dưới tạo admin và vá luôn 2 tài khoản hỏng. Cả ba dùng mật khẩu
`Admin@123` (hash đã kiểm chứng: cả 3 tài khoản login trả 200 kèm access token):

```bash
docker exec -i cah-postgres psql -U postgres -d cinema_db <<'SQL'
INSERT INTO users (user_id, name, email, password, auth_provider, rank_level)
VALUES (9997, 'Admin Demo', 'admin@cah.com',
        '$2a$10$ohR8Z9eOdZWMNe4ecBUOKuObz/EVddz6V7G0EvMl6JR8YV4KRTslG',
        'EMAIL', 'DIAMOND')
ON CONFLICT (user_id) DO UPDATE SET password = EXCLUDED.password;

INSERT INTO user_roles (user_id, role_id)
SELECT 9997, role_id FROM roles WHERE role_name = 'ROLE_ADMIN'
ON CONFLICT DO NOTHING;

UPDATE users
SET password = '$2a$10$ohR8Z9eOdZWMNe4ecBUOKuObz/EVddz6V7G0EvMl6JR8YV4KRTslG'
WHERE user_id IN (9998, 9999);
SQL
```

Sau bước này:

| Email | Mật khẩu | Role | Vào được |
| --- | --- | --- | --- |
| `admin@cah.com` | `Admin@123` | ROLE_ADMIN | tất cả |
| `staff@cah.com` | `Admin@123` | ROLE_STAFF | khách + `/staff` |
| `user@cah.com` | `Admin@123` | ROLE_USER | khách |

> Đây là tài khoản demo cho môi trường local. Đổi mật khẩu trước khi deploy.

### 4b. Thêm tài khoản demo cho từng vai trò và từng hạng

Ba tài khoản trên đủ để xem hết màn hình, nhưng muốn đối chiếu nhiều vai trò cùng
lúc (hoặc xem màn thành viên ở các hạng khác nhau) thì nạp thêm bộ này. Tất cả
dùng chung mật khẩu với ba tài khoản ở bước 4.

`total_paid` được chọn cho khớp hạng, vì backend tính điểm = `total_paid / 40000`
rồi xếp hạng GOLD từ 501 điểm và DIAMOND từ 1501 điểm.

```bash
docker exec -i cah-postgres psql -U postgres -d cinema_db <<'SQL'
WITH demo(user_id, name, email, phone, total_paid, total_point, rank_level, role_name) AS (
  VALUES
    (9990, 'Admin Một',     'admin1@cah.com',  '0900000001',        0::numeric,    0, 'SILVER',  'ROLE_ADMIN'),
    (9991, 'Admin Hai',     'admin2@cah.com',  '0900000002',        0::numeric,    0, 'SILVER',  'ROLE_ADMIN'),
    (9992, 'Nhân Viên Một', 'staff1@cah.com',  '0900000003',        0::numeric,    0, 'SILVER',  'ROLE_STAFF'),
    (9993, 'Nhân Viên Hai', 'staff2@cah.com',  '0900000004',        0::numeric,    0, 'SILVER',  'ROLE_STAFF'),
    (9994, 'Khách Silver',  'silver@cah.com',  '0900000005',  4000000::numeric,  100, 'SILVER',  'ROLE_USER'),
    (9995, 'Khách Gold',    'gold@cah.com',    '0900000006', 24000000::numeric,  600, 'GOLD',    'ROLE_USER'),
    (9996, 'Khách Diamond', 'diamond@cah.com', '0900000007', 64000000::numeric, 1600, 'DIAMOND', 'ROLE_USER')
)
INSERT INTO users (user_id, name, email, phone, password, auth_provider, account_type,
                   total_paid, total_point, rank_level)
SELECT d.user_id, d.name, d.email, d.phone,
       '$2a$10$ohR8Z9eOdZWMNe4ecBUOKuObz/EVddz6V7G0EvMl6JR8YV4KRTslG',
       'EMAIL', 'REGISTERED', d.total_paid, d.total_point, d.rank_level
FROM demo d
ON CONFLICT (user_id) DO UPDATE
SET name = EXCLUDED.name, email = EXCLUDED.email, phone = EXCLUDED.phone,
    password = EXCLUDED.password, total_paid = EXCLUDED.total_paid,
    total_point = EXCLUDED.total_point, rank_level = EXCLUDED.rank_level,
    is_deleted = false;

INSERT INTO user_roles (user_id, role_id)
SELECT d.user_id, r.role_id
FROM (VALUES
    (9990, 'ROLE_ADMIN'), (9991, 'ROLE_ADMIN'),
    (9992, 'ROLE_STAFF'), (9993, 'ROLE_STAFF'),
    (9994, 'ROLE_USER'),  (9995, 'ROLE_USER'), (9996, 'ROLE_USER')
) AS d(user_id, role_name)
JOIN roles r ON r.role_name = d.role_name
ON CONFLICT DO NOTHING;
SQL
```

| Email | Role | Hạng | Dùng để |
| --- | --- | --- | --- |
| `admin1@cah.com` | ROLE_ADMIN | SILVER | toàn quyền, kể cả `/staff` |
| `admin2@cah.com` | ROLE_ADMIN | SILVER | tài khoản admin thứ hai |
| `staff1@cah.com` | ROLE_STAFF | SILVER | chỉ `/staff`, vào `/admin` là bị chặn |
| `staff2@cah.com` | ROLE_STAFF | SILVER | nhân viên thứ hai |
| `silver@cah.com` | ROLE_USER | SILVER | khách thường, không giảm theo hạng |
| `gold@cah.com` | ROLE_USER | GOLD | khách giảm 3% theo hạng |
| `diamond@cah.com` | ROLE_USER | DIAMOND | khách giảm 5% theo hạng |

Bảng `users` **không có unique constraint trên `email`** — backend chặn trùng ở tầng
code. Dùng lại đúng `user_id` 9990–9996 khi chạy lại để tránh tạo bản sao.

Chạy lại lệnh trên bất cứ lúc nào cũng được: `ON CONFLICT` sẽ cập nhật thay vì lỗi.

### 5. File `.env` của backend

Tạo `Backend_CAH_Cinema/.env`. **Thiếu key nào trong đám dưới là app chết lúc khởi
động**, vì `application.yml` dùng `${...}` không có default và `MomoProperties` /
`VnpayProperties` là `@ConfigurationProperties` nên Spring bind ngay khi boot:

```env
DB_URL=jdbc:postgresql://localhost:5433/cinema_db
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_PORT=6379
JWT_SECRET=doi-thanh-mot-chuoi-ngau-nhien-that-dai-it-nhat-32-ky-tu

# Spring Security bắt buộc client-id KHÁC RỖNG. Để trống là chết ngay lúc boot
# ("Client id must not be empty"). Giá trị giả đủ để chạy, nút Google sẽ không dùng được.
GOOGLE_CLIENT_ID=local-dev-unused.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=local-dev-unused

GMAIL_USERNAME=
GG_APP_PASSWORD=

MOMO_PARTNER_CODE=
MOMO_ACCESS_KEY=
MOMO_SECRET_KEY=
MOMO_ENDPOINT=https://test-payment.momo.vn/v2/gateway/api
MOMO_REDIRECT_URL=http://localhost:5173/booking/momo-return
MOMO_IPN_URL=http://localhost:8080/api/v1/payments/momo/ipn

VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_RETURN_URL=http://localhost:5173/booking/vnpay-return
VNPAY_IPN_URL=http://localhost:8080/api/v1/payments/vnpay/ipn

STRIPE_ENABLED=false
```

Các key MoMo/VNPay để rỗng vẫn boot được; chỉ là không thanh toán online được.
Bỏ trống Gmail thì không gửi được OTP → **đăng ký tài khoản mới qua UI sẽ không
chạy**. Dùng 3 tài khoản ở bước 4 để đăng nhập thay vì đăng ký.

#### Return URL của cổng thanh toán

Bốn biến dưới là **URL của frontend**, không phải backend. Trỏ nhầm vào backend —
ví dụ `STRIPE_SUCCESS_URL=https://mhoang26ct.online/api/v1/public/stripe/return` —
thì trả tiền xong trình duyệt dừng lại ở trang text trống của
`StripePaymentController.returned()` và không bao giờ về tới màn hình kết quả.

Bản deploy (frontend nằm trên GitHub Pages) phải dùng:

```env
STRIPE_SUCCESS_URL=https://hoang44444.github.io/Frontend_CAH_Cinema/payment/return
STRIPE_CANCEL_URL=https://hoang44444.github.io/Frontend_CAH_Cinema/payment/return
MOMO_REDIRECT_URL=https://hoang44444.github.io/Frontend_CAH_Cinema/payment/return
VNPAY_RETURN_URL=https://hoang44444.github.io/Frontend_CAH_Cinema/payment/return
```

`StripeSandboxConfig` bắt buộc https nên hai URL Stripe không dùng được với
`localhost` — chạy local thì cứ để `STRIPE_ENABLED=false`.

Backend tự nối `?bookingId=` vào hai URL Stripe, VNPay/MoMo vốn đã gửi kèm
`vnp_TxnRef` / `orderId`; cổng nào không gửi gì thì frontend đọc mã booking đã
lưu trước lúc chuyển cổng. Hai đường dẫn cũ `/booking/vnpay-return` và
`/booking/momo-return` vẫn còn route nên env cũ không gãy.

### 6. Chạy backend

Máy đặt giờ Việt Nam thì JVM trả timezone là `Asia/Saigon`, mà image `postgres:15`
chỉ biết `Asia/Ho_Chi_Minh` → Hikari chết ngay khi mở connection:
`FATAL: invalid value for parameter "TimeZone": "Asia/Saigon"`. Ép timezone cho JVM:

```powershell
$env:JAVA_TOOL_OPTIONS = '-Duser.timezone=Asia/Ho_Chi_Minh'; .\gradlew.bat bootRun
```

Muốn khỏi gõ lại mỗi lần, thêm vào `build.gradle` của backend:

```groovy
tasks.named('bootRun') {
    jvmArgs = ['-Duser.timezone=Asia/Ho_Chi_Minh']
}
```

Lần đầu Gradle tải distribution + dependency, mất khoảng 2–3 phút. Xong thì
kiểm tra: `curl http://localhost:8080/api/v1/public/genres/all`

### 7. Chạy frontend

`.env` của frontend để trống `VITE_API_BASE_URL` → `/api` đi qua dev proxy sang `:8080`,
không dính CORS:

```env
VITE_API_BASE_URL=
VITE_PROXY_TARGET=http://localhost:8080
```

```bash
npm run dev
```

Backend `:8080`, frontend `:5173`.

### 8. Dịch ngày suất chiếu

2160 suất trong seed nằm trong khoảng 09/05–07/06/2026, tức đã qua. Ba màn đặt vé
sẽ trống cho tới khi có suất trong tương lai. Dịch cả lô lên cho trùng hiện tại
(đổi `160` theo khoảng cách từ seed tới hôm nay):

```bash
docker exec cah-postgres psql -U postgres -d cinema_db -c "CREATE TABLE IF NOT EXISTS showtimes_original_times AS SELECT showtime_id, start_time, end_time FROM showtimes; UPDATE showtimes SET start_time = start_time + interval '160 days', end_time = end_time + interval '160 days';"
```

Bảng `showtimes_original_times` giữ mốc gốc để hoàn tác:

```bash
docker exec cah-postgres psql -U postgres -d cinema_db -c "UPDATE showtimes s SET start_time = o.start_time, end_time = o.end_time FROM showtimes_original_times o WHERE o.showtime_id = s.showtime_id;"
```

Cách khác: tự thêm vài suất ở `/admin/showtimes`.

---

## Cách C — Dùng backend test đã deploy

Backend test chạy sẵn ở `https://mhoang26ct.online`, không cần JDK, Docker hay seed.
CORS của nó mở (`Access-Control-Allow-Origin: *`) nên frontend gọi thẳng được.

Trong `.env` của frontend:

```env
VITE_API_BASE_URL=https://mhoang26ct.online
VITE_PROXY_TARGET=https://mhoang26ct.online
```

```bash
npm run dev
```

`VITE_API_BASE_URL` có giá trị thì app gọi thẳng domain, dev proxy không dùng tới.
Để trống biến này thì `/api` đi qua dev proxy và `VITE_PROXY_TARGET` mới có tác dụng —
dùng cách đó nếu sau này server test siết CORS.

Đổi `.env` xong phải **restart `npm run dev`** (Vite chỉ đọc `.env` lúc khởi động).

**Giới hạn hiện tại:** server test chưa có suất chiếu nào
(`/api/v1/public/showtimes/...` trả rỗng cho mọi rạp và mọi ngày), nên 3 màn
chọn ghế → thanh toán → kết quả chưa đi được. Vào `/admin/showtimes` bằng tài
khoản admin của server test để thêm suất, hoặc dùng Cách B cho luồng đặt vé.

---

## Danh sách màn hình

### Khách (không cần đăng nhập)

| Màn hình | Route |
| --- | --- |
| Trang chủ | `/` |
| Danh mục phim | `/movies` |
| Chi tiết phim | `/movies/:movieId` |
| Rạp | `/cinemas` |
| Ưu đãi | `/promotions` |
| Chi tiết ưu đãi | `/promotions/:promotionId` |
| Đăng nhập / đăng ký / quên mật khẩu | `/auth` |

### Khách đã đăng nhập — ROLE_USER

| Màn hình | Route |
| --- | --- |
| Chọn ghế | `/booking/showtimes/:showtimeId/seats` |
| Bắp nước & thanh toán | `/booking/showtimes/:showtimeId/checkout` |
| Kết quả thanh toán | `/booking/:bookingId/result` |
| Vé của tôi | `/my-tickets` |
| Tài khoản | `/account` |

3 màn booking phải đi tuần tự từ trang chi tiết phim — chúng đọc context suất
chiếu từ `sessionStorage` (`store/bookingDraft.ts`), vào thẳng URL sẽ thiếu dữ liệu.

### Nhân viên — ROLE_STAFF hoặc ROLE_ADMIN

| Màn hình | Route |
| --- | --- |
| Bán vé tại quầy | `/staff` |
| Soát vé | `/staff/check-in` |
| Hủy & hoàn tiền | `/staff/refunds` |

### Quản trị — ROLE_ADMIN

| Màn hình | Route |
| --- | --- |
| Tổng quan kinh doanh | `/admin` |
| Phim | `/admin/movies` |
| Rạp & phòng | `/admin/cinemas` |
| Lịch chiếu | `/admin/showtimes` |
| Giá & ngày lễ | `/admin/pricing` |
| Voucher | `/admin/vouchers` |
| Đồ ăn | `/admin/foods` |
| Khuyến mãi | `/admin/promotions` |
| Đối soát & email | `/admin/reconciliation` |

---

## Lỗi hay gặp

| Hiện tượng | Nguyên nhân |
| --- | --- |
| Trang chủ hiện "Chưa có phim", console toàn lỗi 500 | Backend chưa chạy. Proxy `/api` không tới được `:8080`. |
| `FATAL: invalid value for parameter "TimeZone": "Asia/Saigon"` | JVM trả tên timezone cũ mà Postgres không biết. Xem Cách B bước 6. |
| Boot chết: `Client id must not be empty` | `GOOGLE_CLIENT_ID` để rỗng trong `.env`. Điền giá trị giả. |
| Boot chết: `Could not resolve placeholder 'MOMO_...'` / `'VNPAY_...'` | Thiếu key trong `.env`. Phải có đủ key, giá trị rỗng thì được. |
| `Port 5432 is already allocated` lúc `docker run` | Project khác đang giữ 5432. Map sang 5433 rồi sửa `DB_URL`. |
| Đăng nhập báo sai mật khẩu với tài khoản seed | Hash trong seed bị cụt. Chạy SQL ở bước 4. |
| Vào `/admin` thấy "Không có quyền" | Tài khoản không phải ROLE_ADMIN. Seed không có admin — xem bước 4. |
| Đăng ký không nhận được OTP | Chưa cấu hình `GMAIL_USERNAME` / `GG_APP_PASSWORD`. |
| `/admin/reconciliation`, `/staff/refunds` thiếu dữ liệu | Backend chưa có endpoint cho phần này — xem mục "Những chỗ backend chưa có endpoint" trong `README.md`. |
| Màn chọn ghế trống dù đã có phim | Chưa có suất chiếu *trong tương lai*. Seed local chỉ có suất 09/05–07/06/2026 (đã qua); server test thì rỗng hẳn. Vào `/admin/showtimes` thêm suất. |
