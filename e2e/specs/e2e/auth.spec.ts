import { expect, test } from '../../fixtures/e2e';
import { ADMIN_EMAIL, PASSWORD, STAFF_EMAIL } from '../../fixtures/env';
import { readLocalStorage } from '../../fixtures/storage';

const ROLES = [
  { role: 'admin', email: ADMIN_EMAIL, chip: 'Quản trị' },
  { role: 'staff', email: STAFF_EMAIL, chip: 'Nhân viên' },
  { role: 'khách', email: 'e2e.khach0@test.local', chip: null },
];

for (const { role, email, chip } of ROLES) {
  test(`AUTH-01 đăng nhập thật với vai trò ${role} @P0`, async ({ page }) => {
    await page.goto('/auth');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(page.getByRole('link', { name: 'Vé của tôi' }).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/auth/);
    if (chip) await expect(page.getByRole('link', { name: chip, exact: true })).toBeVisible();
    expect(await readLocalStorage(page, 'cah.accessToken')).toBeTruthy();
  });
}

test('SEC-07 đăng xuất xóa phiên và chặn lại route bảo vệ @P0', async ({ page, signIn, customer }) => {
  await signIn(customer);
  await page.goto('/account');

  await page.getByRole('button', { name: 'Đăng xuất' }).click();

  await expect(page).toHaveURL(/\/$/);
  expect(await readLocalStorage(page, 'cah.accessToken')).toBeNull();

  await page.goto('/my-tickets');
  await expect(page.getByText('Cần đăng nhập', { exact: true })).toBeVisible();
});
