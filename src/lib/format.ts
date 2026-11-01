/** Formatting helpers. Vietnamese locale throughout, matching the design. */

const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DOW_LONG = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/** 85000 -> "85.000đ" */
export function vnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `${Math.round(amount).toLocaleString('vi-VN')}đ`;
}

/** Compact money for KPI tiles: 1_840_000_000 -> "1,84 tỷ" */
export function vndCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `${(amount / 1_000_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} tỷ`;
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} tr`;
  return Math.round(amount).toLocaleString('vi-VN');
}

export function count(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('vi-VN');
}

/** Seconds -> "mm:ss" (countdown timers). */
export function mmss(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Backend LocalDateTime arrives without a zone ("2026-10-30T19:30:00").
 * Parsing it as local time is what we want: the backend already works in
 * cinema-local time, so no conversion should happen.
 */
export function parseLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

/** "19:30" */
export function hhmm(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseLocal(value);
  if (!date) return '—';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** "30/10" */
export function ddmm(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseLocal(value);
  if (!date) return '—';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** "30/10/2026" */
export function ddmmyyyy(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseLocal(value);
  if (!date) return '—';
  return `${ddmm(date)}/${date.getFullYear()}`;
}

/** "T6 30/10" */
export function dowDate(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseLocal(value);
  if (!date) return '—';
  return `${DOW[date.getDay()]} ${ddmm(date)}`;
}

/** "Thứ Sáu, 30/10" */
export function dowDateLong(value: string | Date | null | undefined): string {
  const date = value instanceof Date ? value : parseLocal(value);
  if (!date) return '—';
  return `${DOW_LONG[date.getDay()]}, ${ddmm(date)}`;
}

/** Backend query format, yyyy-MM-dd, in local time (never UTC-shifted). */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Backend LocalDateTime body format, yyyy-MM-ddTHH:mm:ss. */
export function isoDateTime(date: Date): string {
  return `${isoDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes(),
  ).padStart(2, '0')}:00`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** "2 giờ trước" / "Hôm qua" — relative time for comments. */
export function timeAgo(value: string | null | undefined): string {
  const date = parseLocal(value);
  if (!date) return '';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Vừa xong';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Hôm qua';
  if (days < 30) return `${days} ngày trước`;
  return ddmmyyyy(date);
}

/** Seconds remaining until an ISO LocalDateTime; 0 once it has passed. */
export function secondsUntil(value: string | null | undefined): number {
  const date = parseLocal(value);
  if (!date) return 0;
  return Math.max(0, Math.floor((date.getTime() - Date.now()) / 1000));
}

/** "Nguyễn Minh Hoàng" -> "MH" */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Minutes -> "2h 10m" for durations shown next to showtimes. */
export function duration(minutes: number | null | undefined): string {
  if (!minutes) return '—';
  return `${minutes} phút`;
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  // ticketRefundRate arrives as a 0..1 decimal.
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}
