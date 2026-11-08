import { ACCESS_TOKEN, expect, test } from '../../fixtures/mock';
import { fail, ok } from '../../fixtures/mock-api';
import { readLocalStorage } from '../../fixtures/storage';
import { aUser } from '../../mocks/factories';

const ME = '/api/v1/users/me';
const REFRESH = '/api/v1/auth/refresh';

test('SEC-03 token hết hạn thì refresh một lần rồi gọi lại @P0', async ({ page, mockApi, loginAs }) => {
  await loginAs('ROLE_USER');
  const user = aUser();
  mockApi.on('GET', ME, (call) =>
    call.headers.authorization === `Bearer ${ACCESS_TOKEN}`
      ? fail(401, 'TOKEN_EXPIRED', 'Token hết hạn')
      : ok({ user, recentInvoices: [] }),
  );
  mockApi.on('POST', REFRESH, ok({ accessToken: 'token-moi', refreshToken: 'refresh-moi', user }));

  await page.goto('/my-tickets');

  await expect(page.getByRole('heading', { name: 'Vé của tôi' })).toBeVisible();
  expect(mockApi.callsTo('POST', REFRESH)).toHaveLength(1);
  expect(await readLocalStorage(page, 'cah.accessToken')).toBe('token-moi');
  expect(mockApi.callsTo('GET', ME).at(-1)?.headers.authorization).toBe('Bearer token-moi');
});

// Lỗi đã xác nhận: AuthProvider gọi clearSession() với mọi lỗi của /users/me, không riêng 401.
test.fail('SEC-09 /users/me lỗi 500 không được xóa phiên đăng nhập @P1', async ({ page, mockApi, loginAs }) => {
  await loginAs('ROLE_USER');
  mockApi.on('GET', ME, fail(500, 'INTERNAL_ERROR', 'Lỗi hệ thống'));
  const checked = page.waitForResponse('**/api/v1/users/me');

  await page.goto('/my-tickets');
  await checked;

  await expect(page.getByText('Đang kiểm tra phiên đăng nhập…')).toBeHidden();
  expect(await readLocalStorage(page, 'cah.accessToken')).toBe(ACCESS_TOKEN);
});

test('SEC-05 refresh thất bại thì xóa phiên @P0', async ({ page, mockApi, loginAs }) => {
  await loginAs('ROLE_USER');
  mockApi.on('GET', ME, fail(401, 'TOKEN_EXPIRED', 'Token hết hạn'));
  mockApi.on('POST', REFRESH, fail(401, 'REFRESH_TOKEN_INVALID', 'Refresh token không hợp lệ'));

  await page.goto('/my-tickets');

  await expect(page.getByText('Cần đăng nhập', { exact: true })).toBeVisible();
  expect(await readLocalStorage(page, 'cah.accessToken')).toBeNull();
  expect(await readLocalStorage(page, 'cah.refreshToken')).toBeNull();
  expect(await readLocalStorage(page, 'cah.user')).toBeNull();
});
