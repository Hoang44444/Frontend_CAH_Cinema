import { expect, test } from '../../fixtures/mock';
import { fail, ok } from '../../fixtures/mock-api';

const BOOKING = '/api/v1/bookings/:bookingId';

// Lỗi đã xác nhận: heroFor() tin vnp_ResponseCode trên URL nên báo thành công khi booking còn PENDING.
test.fail('PAY-03 sửa tay vnp_ResponseCode=00 không làm booking PENDING thành công @P0', async ({
  page,
  mockApi,
  loginAs,
}) => {
  await loginAs('ROLE_USER');
  mockApi.on('GET', BOOKING, ok({ bookingId: 42, status: 'PENDING' }));

  await page.goto('/payment/result?bookingId=42&vnp_ResponseCode=00&vnp_TxnRef=BK42-1');

  await expect(page.getByRole('heading', { name: 'Đang xác nhận thanh toán' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toHaveCount(0);
});

// Lỗi đã xác nhận: PaymentResultPage không xử lý booking.isError nên quay "đang xác nhận" mãi.
test.fail('PAY-04 không tải được booking thì không báo đang xác nhận @P0', async ({ page, mockApi, loginAs }) => {
  await loginAs('ROLE_USER');
  mockApi.on('GET', BOOKING, fail(403, 'ACCESS_DENIED', 'Không có quyền xem booking này'));

  await page.goto('/payment/result?bookingId=42');

  await expect.poll(() => mockApi.callsTo('GET', BOOKING).length).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Đang xác nhận thanh toán' })).toBeHidden();
});
