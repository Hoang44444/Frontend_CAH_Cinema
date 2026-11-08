import { test as base, expect } from '@playwright/test';
import type { UserDTO, UserRole } from '../../src/api/types';
import { aUser } from '../mocks/factories';
import { MockApi, ok } from './mock-api';
import { seedStorage } from './storage';

export const ACCESS_TOKEN = 'mock-access-token';
export const REFRESH_TOKEN = 'mock-refresh-token';

interface MockFixtures {
  mockApi: MockApi;
  /** Tạo phiên đăng nhập sẵn và mock /users/me cho tài khoản đó. */
  loginAs: (role: UserRole, overrides?: Partial<UserDTO>) => Promise<UserDTO>;
}

export const test = base.extend<MockFixtures>({
  mockApi: async ({ page }, use) => {
    const api = new MockApi(page);
    await api.install();
    await use(api);
    expect(api.unhandled, 'Các API này chưa được mock trong test').toEqual([]);
  },

  loginAs: async ({ page, mockApi }, use) => {
    await use(async (role, overrides = {}) => {
      const user = aUser({ role, ...overrides });
      await seedStorage(page, {
        local: {
          'cah.accessToken': ACCESS_TOKEN,
          'cah.refreshToken': REFRESH_TOKEN,
          'cah.user': JSON.stringify(user),
        },
      });
      mockApi.on('GET', '/api/v1/users/me', ok({ user, recentInvoices: [] }));
      return user;
    });
  },
});

export { expect };
