/**
 * The booking draft that travels from the seat screen to checkout.
 *
 * There is no public "get one showtime" endpoint — the public schedule
 * endpoints return showtimes grouped by movie or cinema — so the context a
 * showtime carries (title, room, start time, base price) is captured when the
 * user picks a time and kept in sessionStorage. That way a reload or a shared
 * link into checkout still renders the summary, and it is scoped to the tab.
 */

export interface ShowtimeContext {
  showtimeId: number;
  movieId: number | null;
  movieTitle: string;
  moviePosterUrl: string | null;
  ageRating: string | null;
  cinemaName: string;
  roomName: string;
  format: string;
  startTime: string;
  endTime: string;
  basePrice: number;
}

export interface BookingDraft {
  showtimeId: number;
  seatIds: number[];
  seatNames: string[];
  /** Client-side estimate; POST /bookings returns the authoritative total. */
  estimatedSeatTotal: number;
  context: ShowtimeContext | null;
}

const DRAFT_KEY = 'cah.bookingDraft';
const CONTEXT_PREFIX = 'cah.showtime.';

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / full quota: the flow still works, it just can't survive a reload.
  }
}

export const showtimeContextStore = {
  save(context: ShowtimeContext) {
    write(`${CONTEXT_PREFIX}${context.showtimeId}`, context);
  },
  get(showtimeId: number): ShowtimeContext | null {
    return read<ShowtimeContext>(`${CONTEXT_PREFIX}${showtimeId}`);
  },
};

export const bookingDraftStore = {
  save(draft: BookingDraft) {
    write(DRAFT_KEY, draft);
  },
  get(): BookingDraft | null {
    return read<BookingDraft>(DRAFT_KEY);
  },
  /** Returns the draft only when it belongs to the showtime being viewed. */
  getFor(showtimeId: number): BookingDraft | null {
    const draft = read<BookingDraft>(DRAFT_KEY);
    return draft && draft.showtimeId === showtimeId ? draft : null;
  },
  clear() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  },
};
