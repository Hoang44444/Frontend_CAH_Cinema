import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures/e2e';
import { vnDateTime } from '../../fixtures/time';
import { bookAndPay } from '../../pages/booking';

const HOURS_BEFORE_SHOWTIME = 30;

async function cancelFromMyTickets(page: Page, bookingId: number): Promise<void> {
  await page.getByRole('link', { name: 'Xem vé của tôi' }).click();
  await page.getByTestId(`booking-${bookingId}`).click();
  await page.getByRole('button', { name: 'Hủy vé' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Hủy booking?')).toBeVisible();
  await expect(dialog.getByText('Tiền vé (hoàn 100%)')).toBeVisible();

  await dialog.getByRole('button', { name: 'Xác nhận hủy' }).click();
  await expect(page.getByRole('status')).toContainText('Đã hủy booking');
}

test('TIX-05 hủy vé còn trên 24 giờ được hoàn 100% @P0', async ({
  page,
  db,
  signIn,
  customer,
  createShowtime,
  vnpay,
}) => {
  const showtime = await createShowtime({ start: vnDateTime(HOURS_BEFORE_SHOWTIME * 60) });
  await signIn(customer);
  const { bookingId } = await bookAndPay(page, vnpay, showtime, 'A2');

  await cancelFromMyTickets(page, bookingId);

  expect(await db.bookingStatus(bookingId)).toBe('CANCELLED');
});

// Lỗi đã xác nhận: /users/me chỉ trả PAID, CHECKED_IN, REFUNDED, trong khi màn hình hướng khách
// theo dõi hoàn tiền trong "Vé của tôi".
test.fail('TIX-09 vé vừa hủy vẫn xem được trong Vé của tôi @P1', async ({
  page,
  signIn,
  customer,
  createShowtime,
  vnpay,
}) => {
  const showtime = await createShowtime({ start: vnDateTime(HOURS_BEFORE_SHOWTIME * 60) });
  await signIn(customer);
  const { bookingId } = await bookAndPay(page, vnpay, showtime, 'A3');

  await cancelFromMyTickets(page, bookingId);

  await expect(page.getByTestId(`booking-${bookingId}`)).toContainText('ĐÃ HỦY');
});
