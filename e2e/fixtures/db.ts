import pg from 'pg';
import { DB_URL } from './env';

export const CINEMA_NAME = 'CAH Cinema Landmark 81';
/** Phòng cho suất do test tạo bằng SQL. */
export const TEST_ROOM = 'Phòng 01 - Standard';
/** Phòng dành riêng cho test admin tạo suất qua UI, để không vướng kiểm tra trùng lịch. */
export const ADMIN_ROOM = 'Phòng 02 - Premium';

export type ShowtimeFormat = '2D' | '3D' | 'IMAX';
export type DayKind = 'weekday' | 'weekend';

export interface NewShowtime {
  /** LocalDateTime theo giờ Việt Nam, ví dụ "2026-11-09T14:00:00". */
  start: string;
  format?: ShowtimeFormat;
  basePrice?: number;
  durationMinutes?: number;
}

export interface SeededShowtime {
  id: number;
  movieId: number;
  movieTitle: string;
  /** "yyyy-MM-dd" */
  date: string;
  /** "HH:mm" */
  time: string;
}

const MILLIS_PER_MINUTE_IN_MICROS = 60_000_000;

/** Tạo dữ liệu thẳng trong DB, vì API chặn suất trước 08:00 hoặc sát nhau dưới 30 phút. */
export class TestDb {
  private constructor(private readonly client: pg.Client) {}

  static async connect(): Promise<TestDb> {
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    return new TestDb(client);
  }

  close(): Promise<void> {
    return this.client.end();
  }

  async firstMovie(): Promise<{ movieId: number; title: string }> {
    const { rows } = await this.client.query(
      'SELECT movie_id, title FROM movies WHERE is_deleted = FALSE ORDER BY movie_id LIMIT 1',
    );
    return { movieId: rows[0].movie_id, title: rows[0].title };
  }

  async roomId(roomName: string): Promise<number> {
    const { rows } = await this.client.query(
      `SELECT r.room_id FROM rooms r JOIN cinemas c ON c.cinema_id = r.cinema_id
       WHERE c.name = $1 AND r.room_name = $2`,
      [CINEMA_NAME, roomName],
    );
    return rows[0].room_id;
  }

  async createShowtime(options: NewShowtime): Promise<SeededShowtime> {
    const { start, format = '2D', basePrice = 100_000, durationMinutes = 120 } = options;
    const movie = await this.firstMovie();
    const roomId = await this.roomId(TEST_ROOM);
    const { rows } = await this.client.query(
      `INSERT INTO showtimes (room_id, movie_id, format, start_time, end_time, original_duration_micros, base_price)
       VALUES ($1, $2, $3, $4::timestamp, $4::timestamp + ($5 || ' minutes')::interval, $6, $7)
       RETURNING showtime_id`,
      [roomId, movie.movieId, format, start, durationMinutes, durationMinutes * MILLIS_PER_MINUTE_IN_MICROS, basePrice],
    );
    return {
      id: rows[0].showtime_id,
      movieId: movie.movieId,
      movieTitle: movie.title,
      date: start.slice(0, 10),
      time: start.slice(11, 16),
    };
  }

  /** Các ngày trong 7 ngày tới (giới hạn đặt vé) và không phải ngày lễ. */
  async plainDays(kind: DayKind): Promise<string[]> {
    const { rows } = await this.client.query(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day
       FROM generate_series(
         (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 1,
         (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 7,
         interval '1 day'
       ) AS day
       WHERE (extract(isodow FROM day) >= 6) = $1
         AND NOT EXISTS (
           SELECT 1 FROM holidays h
           WHERE h.holiday_date = day::date
              OR (h.is_recurring AND to_char(h.holiday_date, 'MM-DD') = to_char(day, 'MM-DD'))
         )
       ORDER BY day`,
      [kind === 'weekend'],
    );
    return rows.map((row) => row.day as string);
  }

  async bookingStatus(bookingId: number): Promise<string> {
    const { rows } = await this.client.query('SELECT status FROM bookings WHERE booking_id = $1', [bookingId]);
    return rows[0].status;
  }

  async addHoliday(date: string): Promise<void> {
    await this.client.query(`INSERT INTO holidays (name, holiday_date, is_recurring) VALUES ('E2E', $1, FALSE)`, [date]);
  }

  async removeHoliday(date: string): Promise<void> {
    await this.client.query(`DELETE FROM holidays WHERE name = 'E2E' AND holiday_date = $1`, [date]);
  }

  /** Dọn suất do lần chạy trước để test admin chạy lại được trên cùng stack. */
  async clearShowtimes(roomName: string, date: string): Promise<void> {
    await this.client.query(`DELETE FROM showtimes WHERE room_id = $1 AND start_time::date = $2`, [
      await this.roomId(roomName),
      date,
    ]);
  }
}
