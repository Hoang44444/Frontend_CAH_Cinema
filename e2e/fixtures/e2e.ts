import { test as base, expect } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';
import { TestDb } from './db';
import type { NewShowtime, SeededShowtime } from './db';
import { API_URL, PASSWORD } from './env';
import { seedStorage } from './storage';
import { FakeVnpay } from './vnpay';

interface TestFixtures {
  /** Khách của worker này. */
  customer: string;
  /** Khách thứ hai của worker này, cho kịch bản hai người cùng thao tác. */
  otherCustomer: string;
  /** Đăng nhập bằng API rồi nạp phiên vào trang (mặc định là `page`). */
  signIn: (email: string, target?: Page) => Promise<void>;
  /** Mở một cửa sổ riêng đã đăng nhập, độc lập với `page`. */
  openAs: (email: string) => Promise<Page>;
  createShowtime: (options: NewShowtime) => Promise<SeededShowtime>;
  vnpay: FakeVnpay;
}

interface WorkerFixtures {
  db: TestDb;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  db: [
    async ({}, use) => {
      const db = await TestDb.connect();
      await use(db);
      await db.close();
    },
    { scope: 'worker' },
  ],

  customer: async ({}, use, testInfo) => {
    await use(`e2e.khach${testInfo.parallelIndex * 2}@test.local`);
  },

  otherCustomer: async ({}, use, testInfo) => {
    await use(`e2e.khach${testInfo.parallelIndex * 2 + 1}@test.local`);
  },

  signIn: async ({ page, request }, use) => {
    await use(async (email, target = page) => {
      const response = await request.post(`${API_URL}/api/v1/auth/login`, { data: { email, password: PASSWORD } });
      expect(response.ok(), `Không đăng nhập được ${email}`).toBe(true);
      const { data } = await response.json();
      await seedStorage(target, {
        local: {
          'cah.accessToken': data.accessToken,
          'cah.refreshToken': data.refreshToken,
          'cah.user': JSON.stringify(data.user),
        },
      });
    });
  },

  openAs: async ({ browser, signIn }, use) => {
    const contexts: BrowserContext[] = [];
    await use(async (email) => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await signIn(email, page);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },

  createShowtime: async ({ db }, use) => {
    await use((options) => db.createShowtime(options));
  },

  vnpay: async ({ page, request }, use) => {
    const vnpay = new FakeVnpay(page, request);
    await vnpay.install();
    await use(vnpay);
  },
});

export { expect };
