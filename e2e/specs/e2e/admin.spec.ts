import { expect, test } from '../../fixtures/e2e';
import { ADMIN_ROOM, CINEMA_NAME } from '../../fixtures/db';
import { ADMIN_EMAIL } from '../../fixtures/env';

const START_TIME = '20:07';

test('ADM-SHO admin tạo suất mới và khách thấy trên trang phim @P0', async ({ page, db, signIn, openAs }) => {
  const [date] = await db.plainDays('weekday');
  const movie = await db.firstMovie();
  await db.clearShowtimes(ADMIN_ROOM, date);
  await signIn(ADMIN_EMAIL);

  await page.goto('/admin/showtimes');
  await page.getByLabel('Chọn rạp').selectOption({ label: CINEMA_NAME });
  await page.getByLabel('Phim *').selectOption({ label: movie.title });
  await page.getByLabel('Phòng *').selectOption({ label: ADMIN_ROOM });
  await page.getByLabel('Định dạng *').selectOption('2D');
  await page.getByLabel('Bắt đầu *').fill(`${date}T${START_TIME}`);
  await page.getByLabel('Giá gốc (đ) *').fill('95000');
  await page.getByRole('button', { name: 'Tạo suất' }).click();

  await expect(page.getByRole('status')).toContainText('Đã tạo suất chiếu.');

  const shopper = await openAs('e2e.khach0@test.local');
  await shopper.goto(`/movies/${movie.movieId}?date=${date}`);
  await expect(shopper.getByRole('button', { name: new RegExp(`^${START_TIME}`) })).toBeVisible();
});
