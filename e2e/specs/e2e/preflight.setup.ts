import { expect, test as setup } from '@playwright/test';
import { API_URL, DB_URL } from '../../fixtures/env';

const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

setup('stack E2E đang chạy và chỉ trỏ vào máy local', async ({ request }) => {
  expect(LOCAL_HOSTS, 'E2E ghi dữ liệu nên không được chạy trên server thật').toContain(new URL(API_URL).hostname);
  expect(LOCAL_HOSTS, 'E2E ghi dữ liệu nên không được chạy trên DB thật').toContain(new URL(DB_URL).hostname);

  const response = await request.get(`${API_URL}/api/v1/public/genres/all`).catch(() => null);
  expect(response?.ok(), 'Backend E2E chưa chạy. Chạy: npm run e2e:stack:up').toBe(true);
});
