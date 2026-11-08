import { test as base, expect } from '@playwright/test';

/** Smoke chạy trên dữ liệu thật: mọi request ghi đều bị chặn và làm test fail. */
const test = base.extend<{ blockWrites: void }>({
  blockWrites: [
    async ({ page }, use) => {
      const writes: string[] = [];
      await page.route('**/*', (route) => {
        const method = route.request().method();
        if (method === 'GET' || method === 'HEAD') return route.continue();
        writes.push(`${method} ${route.request().url()}`);
        return route.abort();
      });
      await use();
      expect(writes, 'Smoke không được gửi request ghi').toEqual([]);
    },
    { auto: true },
  ],
});

test('SMK-01 trang chủ có phim và không lỗi JavaScript @P0', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');

  await expect(page.locator('a[href^="/movies/"]').first()).toBeVisible({ timeout: 20_000 });
  expect(errors).toEqual([]);
});

for (const path of ['/movies', '/promotions']) {
  test(`SMK-02 vào thẳng ${path} không trắng trang @P0`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Không tìm thấy trang')).toHaveCount(0);
  });
}

test('SMK-03 gọi được API từ domain của site @P0', async ({ page, baseURL }) => {
  const failed: string[] = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/v1/')) failed.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
  const response = page.waitForResponse((res) => res.url().includes('/api/v1/public/'));

  await page.goto('/');

  const first = await response;
  expect(first.ok()).toBe(true);
  expect(new URL(first.url()).origin, 'API phải nằm ở host riêng').not.toBe(new URL(baseURL!).origin);
  expect(failed).toEqual([]);
});
