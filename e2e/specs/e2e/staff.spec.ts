import { expect, test } from '../../fixtures/e2e';
import { CINEMA_NAME } from '../../fixtures/db';
import { STAFF_EMAIL } from '../../fixtures/env';
import { vnDateTime } from '../../fixtures/time';
import { bookAndPay, pickSeats, seatButton } from '../../pages/booking';

/** Suất sắp chiếu: nằm trong hôm nay, đã mở cửa soát vé và vẫn còn nhận đặt vé. */
const SOON_MINUTES = 5;

// Lỗi đã xác nhận: CounterPage không gọi API giữ ghế, backend từ chối vì "ghế không còn được giữ bởi bạn".
test.fail('CNT-01 bán tiền mặt cho khách vãng lai @P0', async ({ page, signIn, createShowtime }) => {
  const showtime = await createShowtime({ start: vnDateTime(SOON_MINUTES) });
  await signIn(STAFF_EMAIL);

  await page.goto('/staff');
  await page.getByLabel('Chọn rạp').selectOption({ label: CINEMA_NAME });
  await page.getByTestId(`showtime-${showtime.id}`).click();
  await pickSeats(page, 'C1');
  await page.getByLabel('Tên khách').fill('Khách Vãng Lai');
  await page.getByRole('button', { name: 'Tạo đơn & thu tiền mặt' }).click();

  await expect(page.getByRole('status')).toContainText('đã thanh toán');
  await expect(page.getByRole('button', { name: /^Ghế C1 .*đã bán/ })).toBeDisabled();
  await expect(seatButton(page, 'C1')).toHaveAttribute('aria-pressed', 'false');
});

test('CHI-01, CHI-02 soát vé lần đầu qua, quét lại bị từ chối @P0', async ({
  page,
  signIn,
  openAs,
  customer,
  createShowtime,
  vnpay,
}) => {
  const showtime = await createShowtime({ start: vnDateTime(SOON_MINUTES) });
  await signIn(customer);
  await bookAndPay(page, vnpay, showtime, 'A2');
  const code = await page.getByTestId('ticket-code').innerText();

  const staff = await openAs(STAFF_EMAIL);
  await staff.goto('/staff/check-in');
  const input = staff.getByLabel('Mã QR vé');
  const submit = staff.getByRole('button', { name: 'Soát', exact: true });

  await input.fill(code);
  await submit.click();
  await expect(staff.getByText('Vào phòng', { exact: true })).toBeVisible();
  await expect(staff.getByText(showtime.movieTitle).first()).toBeVisible();

  await input.fill(code);
  await submit.click();
  await expect(staff.getByText('Không hợp lệ', { exact: true })).toBeVisible();
  await expect(staff.getByText('Vé này đã được check-in trước đó').first()).toBeVisible();
});
