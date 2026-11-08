const VN_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const formatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: VN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** "yyyy-MM-dd HH:mm:ss" theo giờ Việt Nam, lệch `offsetMinutes` so với hiện tại. */
function vnStamp(offsetMinutes: number): string {
  return formatter.format(new Date(Date.now() + offsetMinutes * 60_000));
}

/** LocalDateTime kiểu backend, ví dụ "2026-11-08T15:05:00". */
export function vnDateTime(offsetMinutes = 0): string {
  return `${vnStamp(offsetMinutes).slice(0, 16).replace(' ', 'T')}:00`;
}

/** Định dạng ngày giờ của VNPay: yyyyMMddHHmmss. */
export function vnpayTimestamp(): string {
  return vnStamp(0).replace(/\D/g, '');
}
