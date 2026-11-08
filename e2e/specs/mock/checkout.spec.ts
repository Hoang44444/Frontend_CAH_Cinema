import { expect, test } from '../../fixtures/mock';
import { ok } from '../../fixtures/mock-api';
import { readLocalStorage, seedStorage } from '../../fixtures/storage';
import { aBookingDraft, aCreatedBooking, aFood } from '../../mocks/factories';

const GATEWAY = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

test('CHK-07 thanh toán VNPay tạo booking rồi chuyển sang cổng @P0', async ({ page, mockApi, loginAs }) => {
  await loginAs('ROLE_USER', { rankLevel: 'SILVER' });
  await seedStorage(page, { session: { 'cah.bookingDraft': JSON.stringify(aBookingDraft()) } });
  mockApi.on('GET', '/api/v1/foods', ok([aFood()]));
  mockApi.on('POST', '/api/v1/bookings', ok(aCreatedBooking()));
  mockApi.on('POST', '/api/v1/bookings/:bookingId/vnpay/pay', ok({ payUrl: `${GATEWAY}?vnp_TxnRef=BK42` }));
  await page.route(`${GATEWAY}**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Cổng VNPay giả</h1>' }),
  );

  await page.goto('/booking/showtimes/77/checkout');
  await page.getByRole('button', { name: 'Thêm Combo Kiểm Thử' }).click();
  await page.getByRole('button', { name: 'VNPay', exact: true }).click();

  // 200.000đ vé + 60.000đ món, hạng SILVER giảm 2%.
  await expect(page.getByTestId('checkout-total')).toHaveText('254.800đ');

  await page.getByRole('button', { name: 'Thanh toán qua VNPay' }).click();
  await page.waitForURL(`${GATEWAY}**`);

  expect(mockApi.callsTo('POST', '/api/v1/bookings')[0].body).toEqual({
    showtimeId: 77,
    seatIds: [1, 2],
    paymentMethod: 'VNPAY',
    foodItems: [{ foodId: 5, quantity: 1 }],
  });
  expect(mockApi.callsTo('POST', '/api/v1/bookings/:bookingId/vnpay/pay')[0].path).toBe(
    '/api/v1/bookings/42/vnpay/pay',
  );

  await page.goBack();
  const pending = JSON.parse((await readLocalStorage(page, 'cah.pendingPayment')) ?? '{}');
  expect(pending.bookingId).toBe(42);
  expect(pending.totalAmount).toBe(254_800);
});
