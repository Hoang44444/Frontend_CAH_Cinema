import type { Locator, Page } from '@playwright/test';
import type { UserRole } from '../../../src/api/types';
import { expect, test } from '../../fixtures/mock';

type Need = 'user' | 'staff' | 'admin';
type Actor = 'guest' | UserRole;

const staffShell = (page: Page) => page.getByText('NHÂN VIÊN', { exact: true });
const adminShell = (page: Page) => page.getByText('QUẢN TRỊ', { exact: true });

/** Mỗi route kèm một dấu hiệu chỉ xuất hiện khi đã qua được guard. */
const ROUTES: Array<{ path: string; need: Need; landmark: (page: Page) => Locator }> = [
  { path: '/my-tickets', need: 'user', landmark: (p) => p.getByRole('heading', { name: 'Vé của tôi' }) },
  { path: '/account', need: 'user', landmark: (p) => p.getByRole('button', { name: 'Đăng xuất' }) },
  { path: '/booking/showtimes/1/seats', need: 'user', landmark: (p) => p.getByText('GHẾ ĐÃ CHỌN') },
  { path: '/booking/showtimes/1/checkout', need: 'user', landmark: (p) => p.getByText('Chưa chọn ghế') },
  { path: '/booking/1/result', need: 'user', landmark: (p) => p.getByText('Mã đặt vé', { exact: true }) },
  { path: '/staff', need: 'staff', landmark: staffShell },
  { path: '/staff/check-in', need: 'staff', landmark: staffShell },
  { path: '/staff/refunds', need: 'staff', landmark: staffShell },
  { path: '/admin', need: 'admin', landmark: adminShell },
  { path: '/admin/movies', need: 'admin', landmark: adminShell },
  { path: '/admin/cinemas', need: 'admin', landmark: adminShell },
  { path: '/admin/showtimes', need: 'admin', landmark: adminShell },
  { path: '/admin/pricing', need: 'admin', landmark: adminShell },
  { path: '/admin/vouchers', need: 'admin', landmark: adminShell },
  { path: '/admin/foods', need: 'admin', landmark: adminShell },
  { path: '/admin/promotions', need: 'admin', landmark: adminShell },
  { path: '/admin/reconciliation', need: 'admin', landmark: adminShell },
];

const ACTORS: Actor[] = ['guest', 'ROLE_USER', 'ROLE_STAFF', 'ROLE_ADMIN'];

function isAllowed(actor: Actor, need: Need): boolean {
  if (actor === 'guest') return false;
  if (need === 'user') return true;
  if (need === 'staff') return actor === 'ROLE_STAFF' || actor === 'ROLE_ADMIN';
  return actor === 'ROLE_ADMIN';
}

for (const route of ROUTES) {
  for (const actor of ACTORS) {
    test(`SEC-01 ${actor} mở ${route.path} @P0`, async ({ page, mockApi, loginAs }) => {
      mockApi.allowUnhandled();
      if (actor !== 'guest') await loginAs(actor);

      await page.goto(route.path);

      if (actor === 'guest') {
        await expect(page.getByText('Cần đăng nhập', { exact: true })).toBeVisible();
      } else if (isAllowed(actor, route.need)) {
        await expect(route.landmark(page)).toBeVisible();
      } else {
        await expect(page.getByText('Không có quyền', { exact: true })).toBeVisible();
      }
    });
  }
}
