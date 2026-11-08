import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import type { SeededShowtime } from '../fixtures/db';
import type { FakeVnpay, GatewayCheckout } from '../fixtures/vnpay';

export function seatButton(page: Page, name: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Ghế ${name} `) });
}

/** Đi từ trang phim như khách thật, để app tự lưu thông tin suất vào sessionStorage. */
export async function openSeatMap(page: Page, showtime: SeededShowtime): Promise<void> {
  await page.goto(`/movies/${showtime.movieId}?date=${showtime.date}`);
  await page.getByTestId(`showtime-${showtime.id}`).click();
  await expect(page.getByText('GHẾ ĐÃ CHỌN')).toBeVisible();
}

export async function pickSeats(page: Page, ...names: string[]): Promise<void> {
  for (const name of names) {
    const seat = seatButton(page, name);
    await seat.click();
    await expect(seat).toHaveAttribute('aria-pressed', 'true');
  }
}

export async function continueToCheckout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Tiếp tục/ }).click();
  await expect(page.getByTestId('checkout-total')).toBeVisible();
}

/** Chọn VNPay, bấm thanh toán và trả về mã booking backend vừa tạo. */
export async function startVnpayPayment(page: Page): Promise<number> {
  await page.getByRole('button', { name: 'VNPay', exact: true }).click();
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/bookings'),
  );
  await page.getByRole('button', { name: 'Thanh toán qua VNPay' }).click();
  const response = await created;
  expect(response.ok(), `Tạo booking thất bại: ${await response.text()}`).toBe(true);
  return (await response.json()).data.bookingId as number;
}

export function moneyOf(text: string): number {
  return Number(text.replace(/\D/g, ''));
}

export interface PaidBooking {
  bookingId: number;
  checkout: GatewayCheckout;
}

/** Đặt vé và thanh toán thành công qua VNPay, dừng ở trang kết quả. */
export async function bookAndPay(
  page: Page,
  vnpay: FakeVnpay,
  showtime: SeededShowtime,
  ...seats: string[]
): Promise<PaidBooking> {
  await openSeatMap(page, showtime);
  await pickSeats(page, ...seats);
  await continueToCheckout(page);
  const bookingId = await startVnpayPayment(page);
  const checkout = await vnpay.checkout();
  expect(await vnpay.sendIpn(checkout), 'Backend phải chấp nhận IPN hợp lệ').toBe('00');
  await vnpay.returnToSite(checkout);
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toBeVisible();
  return { bookingId, checkout };
}
