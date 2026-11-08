import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = Boolean(process.env.CI);

/**
 * Hai tầng dùng chung một bản build frontend:
 * - `mock`: giả toàn bộ /api/v1 bằng page.route, không cần backend.
 * - `e2e`: đi qua proxy của vite preview tới backend thật ở cổng 8081 (npm run e2e:stack:up).
 *
 * Tầng smoke chạy trên site đã deploy nên có config riêng: playwright.smoke.config.ts.
 */
export default defineConfig({
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'vi-VN',
    // parseLocal() đọc giờ backend theo giờ máy, nên trình duyệt phải ở giờ Việt Nam.
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite build --mode e2e --outDir dist-e2e --emptyOutDir && npx vite preview --mode e2e --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'mock',
      testDir: 'e2e/specs/mock',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e-preflight',
      testDir: 'e2e/specs/e2e',
      testMatch: /preflight\.setup\.ts/,
    },
    {
      name: 'e2e',
      testDir: 'e2e/specs/e2e',
      dependencies: ['e2e-preflight'],
      // Mỗi worker có hai khách riêng trong e2e/stack/seed/03_accounts.sql, không tăng quá 2.
      workers: 2,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
