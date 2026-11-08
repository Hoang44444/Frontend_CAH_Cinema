import { defineConfig, devices } from '@playwright/test';

const isCI = Boolean(process.env.CI);

/** Chỉ đọc trên site đã deploy, không cần web server. */
export default defineConfig({
  testDir: 'e2e/specs/smoke',
  outputDir: 'test-results/smoke',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: 1,
  reporter: isCI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report/smoke' }]] : [['list']],
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? 'https://mhoang26ct.online',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
});
