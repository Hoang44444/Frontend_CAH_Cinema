import { expect, test } from '../../fixtures/e2e';
import type { DayKind, ShowtimeFormat } from '../../fixtures/db';
import {
  bookAndPay,
  continueToCheckout,
  moneyOf,
  openSeatMap,
  pickSeats,
  seatButton,
  startVnpayPayment,
} from '../../pages/booking';

const AFTERNOON = '14:00:00';

test('PAY-01, TIX-01 đặt vé VNPay tới PAID và hiện trong Vé của tôi @P0', async ({
  page,
  db,
  signIn,
  customer,
  createShowtime,
  vnpay,
}) => {
  const [day] = await db.plainDays('weekday');
  const showtime = await createShowtime({ start: `${day}T${AFTERNOON}` });
  await signIn(customer);

  const { bookingId, checkout } = await bookAndPay(page, vnpay, showtime, 'A2', 'A3');

  await expect(page.getByTestId('ticket-code')).toHaveCount(2);
  await expect(page.getByTestId('payment-total')).toHaveText(new RegExp(checkout.amount.toLocaleString('vi-VN')));

  await page.getByRole('link', { name: 'Xem vé của tôi' }).click();

  const row = page.getByTestId(`booking-${bookingId}`);
  await expect(row).toContainText(showtime.movieTitle);
  await expect(row).toContainText('ĐÃ THANH TOÁN');
  await expect(row).toContainText('A2, A3');
});

const PRICE_VARIANTS: Array<{
  name: string;
  day: DayKind | 'holiday';
  time: string;
  format: ShowtimeFormat;
  /** Lỗi đã xác nhận: getShowtimeMultiplier() chép cứng hệ số, khác bảng price_configs của backend. */
  knownMismatch?: boolean;
}> = [
  { name: 'ngày thường, buổi chiều, 2D', day: 'weekday', time: '14:00:00', format: '2D' },
  { name: 'cuối tuần, 2D', day: 'weekend', time: '14:00:00', format: '2D' },
  { name: 'ngày thường, buổi sáng, 2D', day: 'weekday', time: '10:00:00', format: '2D', knownMismatch: true },
  { name: 'ngày thường, buổi tối, 2D', day: 'weekday', time: '20:00:00', format: '2D', knownMismatch: true },
  { name: 'ngày thường, buổi chiều, 3D', day: 'weekday', time: '14:00:00', format: '3D', knownMismatch: true },
  { name: 'ngày thường, buổi chiều, IMAX', day: 'weekday', time: '14:00:00', format: 'IMAX', knownMismatch: true },
  { name: 'ngày lễ, 2D', day: 'holiday', time: '14:00:00', format: '2D', knownMismatch: true },
];

for (const variant of PRICE_VARIANTS) {
  test(`CHK-06 tổng thanh toán khớp số tiền gửi cổng: ${variant.name} @P0`, async ({
    page,
    db,
    signIn,
    customer,
    createShowtime,
    vnpay,
  }) => {
    test.fail(variant.knownMismatch === true, 'Frontend tính giá khác backend');
    const weekdays = await db.plainDays('weekday');
    const date = variant.day === 'holiday' ? weekdays[1] : (await db.plainDays(variant.day))[0];
    if (variant.day === 'holiday') await db.addHoliday(date);

    try {
      const showtime = await createShowtime({ start: `${date}T${variant.time}`, format: variant.format });
      await signIn(customer);
      await openSeatMap(page, showtime);
      await pickSeats(page, 'B1');
      await continueToCheckout(page);
      const shown = moneyOf(await page.getByTestId('checkout-total').innerText());

      await startVnpayPayment(page);
      const { amount } = await vnpay.checkout();

      expect(amount, 'Số tiền gửi cổng phải bằng "Tổng thanh toán" trên màn hình').toBe(shown);
    } finally {
      if (variant.day === 'holiday') await db.removeHoliday(date);
    }
  });
}

test('PAY-02 IPN sai chữ ký hoặc sai số tiền không xác nhận được booking @P0', async ({
  page,
  db,
  signIn,
  customer,
  createShowtime,
  vnpay,
}) => {
  const [day] = await db.plainDays('weekday');
  const showtime = await createShowtime({ start: `${day}T${AFTERNOON}` });
  await signIn(customer);
  await openSeatMap(page, showtime);
  await pickSeats(page, 'A2');
  await continueToCheckout(page);
  const bookingId = await startVnpayPayment(page);
  const checkout = await vnpay.checkout();

  expect(await vnpay.sendIpn(checkout, { tamperSignature: true })).toBe('97');
  expect(await vnpay.sendIpn(checkout, { rawAmount: checkout.amount * 100 + 100 })).toBe('04');

  await page.goto(`/payment/result?bookingId=${bookingId}`);
  await expect(page.getByRole('heading', { name: 'Đang xác nhận thanh toán' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thanh toán thành công' })).toHaveCount(0);
});

test('SEAT-04 hai khách tranh một ghế thì chỉ một người giữ được @P0', async ({
  page,
  db,
  signIn,
  openAs,
  customer,
  otherCustomer,
  createShowtime,
}) => {
  const [day] = await db.plainDays('weekday');
  const showtime = await createShowtime({ start: `${day}T${AFTERNOON}` });
  await signIn(customer);
  const other = await openAs(otherCustomer);

  // Cả hai cùng thấy ghế còn trống, rồi khách thứ nhất giữ trước.
  await openSeatMap(page, showtime);
  await openSeatMap(other, showtime);
  await pickSeats(page, 'A2');

  await seatButton(other, 'A2').click();

  await expect(seatButton(other, 'A2')).toHaveAttribute('aria-pressed', 'false');
  await expect(other.getByRole('button', { name: /^Ghế A2 .*người khác đang giữ/ })).toBeDisabled();
  await expect(seatButton(page, 'A2')).toHaveAttribute('aria-pressed', 'true');
});

// Lỗi đã xác nhận: SeatsPage chỉ nhả ghế ở pagehide, nên điều hướng trong SPA để lại lock của chính mình.
test.fail('SEAT-06 bấm Back rồi quay lại vẫn chọn lại được ghế của mình @P0', async ({
  page,
  db,
  signIn,
  customer,
  createShowtime,
}) => {
  const [day] = await db.plainDays('weekday');
  const showtime = await createShowtime({ start: `${day}T${AFTERNOON}` });
  await signIn(customer);
  await openSeatMap(page, showtime);
  await pickSeats(page, 'A2');

  await page.goBack();
  await page.getByTestId(`showtime-${showtime.id}`).click();
  // Tải lại để bỏ cache sơ đồ ghế của React Query, thấy đúng trạng thái trên server.
  await page.reload();

  await expect(seatButton(page, 'A2')).toBeEnabled();
  await pickSeats(page, 'A2');
});
