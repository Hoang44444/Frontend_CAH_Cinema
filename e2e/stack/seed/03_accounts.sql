-- Tài khoản riêng cho E2E. Mật khẩu: Admin@123 (cùng hash với RUN.md bước 4).
-- Mỗi worker dùng hai khách: e2e.khach{2n} và e2e.khach{2n+1}.
WITH accounts(user_id, name, email, role_name) AS (
  VALUES
    (9101, 'E2E Admin', 'e2e.admin@test.local', 'ROLE_ADMIN'),
    (9102, 'E2E Staff', 'e2e.staff@test.local', 'ROLE_STAFF'),
    (9110, 'E2E Khách 0', 'e2e.khach0@test.local', 'ROLE_USER'),
    (9111, 'E2E Khách 1', 'e2e.khach1@test.local', 'ROLE_USER'),
    (9112, 'E2E Khách 2', 'e2e.khach2@test.local', 'ROLE_USER'),
    (9113, 'E2E Khách 3', 'e2e.khach3@test.local', 'ROLE_USER')
), inserted AS (
  INSERT INTO users (user_id, name, email, password, auth_provider, account_type, rank_level)
  SELECT user_id, name, email,
         '$2a$10$ohR8Z9eOdZWMNe4ecBUOKuObz/EVddz6V7G0EvMl6JR8YV4KRTslG',
         'EMAIL', 'REGISTERED', 'SILVER'
  FROM accounts
  RETURNING user_id
)
INSERT INTO user_roles (user_id, role_id)
SELECT a.user_id, r.role_id
FROM accounts a
JOIN roles r ON r.role_name = a.role_name;
