/** Địa chỉ của stack E2E (e2e/stack/docker-compose.yml). */
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:8081';
export const DB_URL = process.env.E2E_DB_URL ?? 'postgres://postgres:postgres@localhost:55432/cinema_db';
export const PASSWORD = 'Admin@123';

export const ADMIN_EMAIL = 'e2e.admin@test.local';
export const STAFF_EMAIL = 'e2e.staff@test.local';

/** Phải trùng VNPAY_TMN_CODE và VNPAY_HASH_SECRET trong docker-compose.yml. */
export const VNPAY_TMN_CODE = 'E2ETEST1';
export const VNPAY_HASH_SECRET = 'e2e-vnpay-hash-secret-not-a-real-key';
