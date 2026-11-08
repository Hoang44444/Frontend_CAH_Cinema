import { expect, test } from '../../fixtures/mock';
import { ok } from '../../fixtures/mock-api';
import { seedStorage } from '../../fixtures/storage';
import { aSeat, aShowtimeContext } from '../../mocks/factories';

const SHOWTIME_ID = 77;
const SEATS = [aSeat({ seatId: 1, row: 1, col: 1 }), aSeat({ seatId: 2, row: 1, col: 2 })];

test('SEAT-02 chọn và bỏ chọn ghế @P0', async ({ page, mockApi, loginAs }) => {
  await loginAs('ROLE_USER');
  await seedStorage(page, {
    session: { [`cah.showtime.${SHOWTIME_ID}`]: JSON.stringify(aShowtimeContext({ showtimeId: SHOWTIME_ID })) },
  });
  mockApi.on('GET', '/api/v1/public/seats', ok(SEATS));
  mockApi.on('POST', '/api/v1/seats/:seatId/lock', ok(null));
  mockApi.on('DELETE', '/api/v1/seats/:seatId/lock', ok(null));

  await page.goto(`/booking/showtimes/${SHOWTIME_ID}/seats`);
  const seat = page.getByRole('button', { name: /^Ghế A1 / });
  const subtotal = page.getByTestId('seat-subtotal');
  const timer = page.getByTestId('seat-hold-timer');
  const next = page.getByRole('button', { name: /Tiếp tục/ });

  await expect(next).toBeDisabled();

  await seat.click();

  await expect(seat).toHaveAttribute('aria-pressed', 'true');
  await expect(subtotal).toHaveText('100.000đ');
  await expect(timer).toHaveText(/^0[45]:\d\d$/);
  await expect(next).toBeEnabled();
  const [lock] = mockApi.callsTo('POST', '/api/v1/seats/:seatId/lock');
  expect(lock.path).toBe('/api/v1/seats/1/lock');
  expect(lock.query.get('showtimeId')).toBe(String(SHOWTIME_ID));

  await seat.click();

  await expect(seat).toHaveAttribute('aria-pressed', 'false');
  await expect(subtotal).toHaveText('0đ');
  await expect(timer).toBeHidden();
  await expect(next).toBeDisabled();
  expect(mockApi.callsTo('DELETE', '/api/v1/seats/:seatId/lock')).toHaveLength(1);
});
