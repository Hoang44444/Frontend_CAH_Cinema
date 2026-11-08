# Chạy toàn bộ màn hình (khách → nhân viên → quản trị)

Có 3 cách, chọn theo việc bạn cần làm.

| | Cách A — chỉ frontend | Cách B — full stack local | Cách C — mở ra internet qua subdomain |
| --- | --- | --- | --- |
| Cần gì | Node.js | Node + JDK 17 + Docker (Postgres, Redis) | Xong Cách B, thêm `cloudflared` |
| Thời gian | ~1 phút | ~20–30 phút lần đầu | +5 phút sau Cách B |
| Thấy được | Mọi màn hình, mọi role | Mọi màn hình **có dữ liệu thật** | Như Cách B, nhưng máy khác và bản GitHub Pages cũng vào được |
| Dữ liệu | Rỗng / báo lỗi tải | Thật, tự nạp seed | Thật, vẫn nằm trên máy chạy tunnel |
| Dùng để | Review UI, chụp hình, test routing & phân quyền phía client | Test chức năng, luồng đặt vé, thanh toán | Cho bản deploy có dữ liệu, demo cho người khác |

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
ví dụ `STRIPE_SUCCESS_URL=https://cinema.mhoang26ct.online/api/v1/public/stripe/return` —
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

## Cách C — Đưa backend ra internet bằng Cloudflare Tunnel

> Backend đã deploy nằm tại subdomain `cinema.mhoang26ct.online`.
> (Domain gốc `mhoang26ct.online` là GitHub Pages frontend).
> Chỉ cần dùng backend đó thì đặt biến như mục **Frontend** bên dưới, không cần tunnel.

Tunnel dành cho việc mở backend **trên máy mình** ra internet. `cloudflared` chạy
trên máy đang giữ backend, tự mở kết nối ra Cloudflare; Cloudflare nhận HTTPS ở một
hostname công khai rồi đẩy request vào `localhost:8080`. Không cần thuê server,
không mở cổng router, vẫn có TLS thật.

Dùng khi cần demo dữ liệu trên máy mình cho người khác mở bằng máy họ.

> **`api.mhoang26ct.online` không dùng được.** Zone DNS của `mhoang26ct.online`
> nằm trong một tài khoản Cloudflare khác (nameserver `anton`/`gemma`), nên không
> tạo được bản ghi `api` ở đó. Cloudflare còn bắt buộc tunnel và bản ghi DNS phải
> **cùng một tài khoản**, nên kể cả nhờ chủ zone thêm hộ một dòng CNAME cũng không
> chạy. Ô *Custom domain* trong GitHub Pages chỉ khai báo tên miền cho GitHub, nó
> không tạo bản ghi DNS nào.

### Cách nhanh — quick tunnel (không cần tài khoản, không cần domain)

Dựng backend + Postgres + Redis theo **Cách B** trước. Tunnel chỉ là lớp vỏ:
không có gì nghe ở `:8080` thì nó trả `502`. Rồi:

```powershell
winget install --id Cloudflare.cloudflared --exact
```

```powershell
cloudflared tunnel --no-autoupdate --url http://localhost:8080
```

Sau ~20 giây nó in ra một hostname dạng
`https://<bốn-từ-ngẫu-nhiên>.trycloudflare.com`. Để nguyên cửa sổ đó chạy.

Kiểm tra:

```bash
curl https://<hostname>.trycloudflare.com/api/v1/public/genres/all
```

**Hostname đổi mỗi lần khởi động lại tunnel**, và tắt máy là chết. Mỗi lần đổi
phải sửa lại `.env` (và `.env.production` + push nếu muốn bản deploy dùng được).

### Cách ổn định — named tunnel trên domain của chính bạn

Cần một domain bạn tự mua và tự add vào tài khoản Cloudflare của mình (domain rẻ
`.xyz` / `.io.vn` vài chục nghìn một năm là đủ). Khi zone đã **Active**:

```powershell
cloudflared tunnel login
```

```powershell
cloudflared tunnel create cah-cinema
```

```powershell
cloudflared tunnel route dns cah-cinema api.<domain-của-bạn>
```

Rồi tạo `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: cah-cinema
credentials-file: C:\Users\<user>\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: api.<domain-của-bạn>
    service: http://localhost:8080
  - service: http_status:404
```

Mỗi lần chạy: `cloudflared tunnel run cah-cinema`. Hostname cố định, không đổi
nữa. `cloudflared tunnel login` chỉ liệt kê zone đang **Active** — zone còn
Pending thì trang authorize không hiện domain để chọn.

### Frontend

```env
# Dùng backend đã deploy
VITE_API_BASE_URL=https://cinema.mhoang26ct.online
VITE_PROXY_TARGET=https://cinema.mhoang26ct.online

# Hoặc dùng tunnel của máy mình
# VITE_API_BASE_URL=https://<hostname>.trycloudflare.com
# VITE_PROXY_TARGET=http://localhost:8080
```

```bash
npm run dev
```

`VITE_API_BASE_URL` có giá trị thì app gọi thẳng hostname đó, dev proxy không dùng
tới. Để trống biến này thì `/api` đi qua dev proxy và `VITE_PROXY_TARGET` mới có
tác dụng — dùng cách đó khi tunnel không chạy mà vẫn muốn test với backend local.

Đổi `.env` xong phải **restart `npm run dev`** (Vite chỉ đọc `.env` lúc khởi động).

Frontend ở `mhoang26ct.online` gọi sang hostname khác hoàn toàn được: CORS không
vướng vì `SecurityConfig.java` để `allowedOrigins("*")`, và token đi qua header
`Authorization` chứ không dùng cookie.

### Callback thanh toán

`MOMO_IPN_URL` và `VNPAY_IPN_URL` trong `.env` của backend vẫn là
`http://localhost:8080/...`, tức cổng thanh toán ngoài internet không gọi về được.
Muốn test IPN thật thì trỏ hai biến đó sang hostname của tunnel — nhưng với quick
tunnel thì phải sửa lại mỗi lần hostname đổi.

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
| Màn chọn ghế trống dù đã có phim | Chưa có suất chiếu *trong tương lai*. Seed chỉ có suất 09/05–07/06/2026 (đã qua). Dịch cả lô theo Cách B bước 8, hoặc vào `/admin/showtimes` thêm suất. |
| Hostname tunnel trả `530` | Tunnel không chạy. Bật lại `cloudflared tunnel --url http://localhost:8080`. |
| Hostname tunnel trả `502` | Tunnel chạy nhưng backend thì không. Kiểm tra `curl http://localhost:8080/api/v1/public/genres/all`. |
| Toàn bộ API hỏng sau khi khởi động lại tunnel | Quick tunnel cấp hostname mới mỗi lần. Chép hostname mới vào `.env` rồi restart `npm run dev`. |
| `api.mhoang26ct.online` không phân giải | Subdomain đó chưa bao giờ tồn tại và không tạo được — zone DNS nằm ở tài khoản Cloudflare khác. Xem đầu Cách C. |
