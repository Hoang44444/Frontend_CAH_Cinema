/**
 * The booking this browser is currently paying for.
 *
 * A gateway only redirects to the return URL its own server-side config holds,
 * so it can land back on /payment/return with nothing that identifies the
 * booking. This marker is written just before the SPA hands off, and the result
 * screen reads it when the query string says nothing. localStorage rather than
 * sessionStorage, because a deeplink (MoMo) can hand the browser back in a
 * different tab.
 */

const KEY = 'cah.pendingPayment';
/** Longer than any payment deadline, short enough not to resurrect an old booking. */
const TTL_MS = 2 * 60 * 60 * 1000;

interface PendingPayment {
  bookingId: number;
  savedAt: number;
}

export const pendingPaymentStore = {
  save(bookingId: number) {
    try {
      localStorage.setItem(KEY, JSON.stringify({ bookingId, savedAt: Date.now() }));
    } catch {
      // Private mode / full quota: the gateway's query string is the only hope left.
    }
  },
  get(): number | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as PendingPayment;
      if (!Number.isFinite(value?.bookingId) || !Number.isFinite(value?.savedAt)) return null;
      return Date.now() - value.savedAt > TTL_MS ? null : value.bookingId;
    } catch {
      return null;
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};
