import { expect, test } from '../../fixtures/mock';
import { fail } from '../../fixtures/mock-api';
import { readLocalStorage } from '../../fixtures/storage';

test('AUTH-02 sai mật khẩu hiện câu của backend và ở lại form @P0', async ({ page, mockApi }) => {
  const message = 'Email hoặc mật khẩu không chính xác';
  mockApi.on('POST', '/api/v1/auth/login', fail(401, 'INVALID_CREDENTIALS', message));

  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('khach@test.local');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('sai-mat-khau');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByText('Phiên đăng nhập đã hết hạn')).toHaveCount(0);
  await expect(page).toHaveURL(/\/auth$/);
  expect(await readLocalStorage(page, 'cah.accessToken')).toBeNull();
  expect(mockApi.callsTo('POST', '/api/v1/auth/login')[0].body).toEqual({
    email: 'khach@test.local',
    password: 'sai-mat-khau',
  });
});
