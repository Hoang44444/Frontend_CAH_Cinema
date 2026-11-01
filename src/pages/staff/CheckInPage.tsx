import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { staffApi } from '@/api/endpoints';
import type { CheckInResponseDTO } from '@/api/types';
import { Button, EmptyState, describeError } from '@/components/ui';
import { hhmm, vnd } from '@/lib/format';
import './staff.css';

interface ScanLog {
  id: number;
  seat: string;
  movie: string;
  note: string;
  time: string;
  dot: string;
}

/** Visual treatment per outcome, matching the design's four scan states. */
const OK_VIEW = {
  title: 'Vào phòng',
  glyph: '✓',
  bg: 'var(--ok)',
  fg: '#fff',
};

const FAIL_VIEW = {
  title: 'Không hợp lệ',
  glyph: '×',
  bg: 'var(--danger)',
  fg: '#fff',
};

let logId = 1;

/** 4b — ticket check-in. Scanners type into the field and submit with Enter. */
export default function CheckInPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [token, setToken] = useState('');
  const [result, setResult] = useState<CheckInResponseDTO | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [log, setLog] = useState<ScanLog[]>([]);

  const checkIn = useMutation({
    mutationFn: (qrToken: string) => staffApi.checkIn(qrToken),
    onSuccess: (data) => {
      setResult(data);
      setFailure(null);
      setToken('');
      setLog((current) =>
        [
          {
            id: logId++,
            seat: data.seatName,
            movie: data.movieTitle,
            note: data.foodDeliveredNow ? 'Hợp lệ · giao đồ ăn' : 'Hợp lệ',
            time: hhmm(new Date()),
            dot: 'var(--ok)',
          },
          ...current,
        ].slice(0, 12),
      );
      inputRef.current?.focus();
    },
    onError: (error) => {
      const message = describeError(error);
      setResult(null);
      setFailure(message);
      setToken('');
      setLog((current) =>
        [
          {
            id: logId++,
            seat: '—',
            movie: 'Từ chối',
            note: message,
            time: hhmm(new Date()),
            dot: 'var(--danger)',
          },
          ...current,
        ].slice(0, 12),
      );
      inputRef.current?.focus();
    },
  });

  const view = result ? OK_VIEW : failure ? FAIL_VIEW : null;

  return (
    <div className="staff-two">
      <div className="scan-page">
        <div className="row-between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <h1 className="display" style={{ fontSize: 44 }}>
            Soát vé
          </h1>
          <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
            Mở cửa soát từ 30 phút trước giờ chiếu
          </span>
        </div>

        <form
          className="scan-input"
          onSubmit={(event) => {
            event.preventDefault();
            const value = token.trim();
            if (value) checkIn.mutate(value);
          }}
        >
          <input
            ref={inputRef}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Quét mã QR bằng máy quét hoặc dán mã…"
            aria-label="Mã QR vé"
            autoFocus
          />
          <span className="mono" style={{ fontSize: 12, color: 'var(--ink-6)' }}>
            TICKET_QR
          </span>
          <Button type="submit" size="xs" disabled={!token.trim()} loading={checkIn.isPending}>
            Soát
          </Button>
        </form>

        {!view ? (
          <EmptyState
            title="Chờ quét vé"
            description="Mã QR của vé có purpose TICKET_QR. Giờ soát hợp lệ: từ 30 phút trước giờ chiếu đến khi suất kết thúc."
          />
        ) : (
          <div className="scan-card">
            <div className="scan-card__head" style={{ background: view.bg, color: view.fg }}>
              <span className="scan-card__glyph">{view.glyph}</span>
              <div className="stack" style={{ gap: 2 }}>
                <span className="scan-card__title">{view.title}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {result
                    ? `Check-in thành công lúc ${hhmm(new Date())}`
                    : failure}
                </span>
              </div>
            </div>

            {result && (
              <>
                <div className="scan-card__facts">
                  <div className="scan-card__fact scan-card__fact--wide">
                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Phim</span>
                    <span style={{ fontWeight: 700, fontSize: 18 }}>{result.movieTitle}</span>
                  </div>
                  <div className="scan-card__fact">
                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Phòng · Giờ</span>
                    <span style={{ fontWeight: 700, fontSize: 18 }}>
                      {result.roomName} · {hhmm(result.showtimeStart)}
                    </span>
                  </div>
                  <div className="scan-card__fact">
                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Ghế</span>
                    <span className="scan-card__seat">{result.seatName}</span>
                  </div>
                  <div className="scan-card__fact">
                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Booking</span>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      #BK-{result.bookingId}
                    </span>
                  </div>
                  <div className="scan-card__fact">
                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Vé</span>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      #TK-{result.ticketId}
                    </span>
                  </div>
                  <div className="scan-card__fact scan-card__fact--wide">
                    <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Rạp</span>
                    <span style={{ fontWeight: 600 }}>{result.cinemaName}</span>
                  </div>
                </div>

                <div className="scan-card__food">
                  <div className="stack" style={{ gap: 6 }}>
                    <span className="kicker">ĐỒ ĂN KÈM</span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>
                      {result.foodItems?.length
                        ? result.foodItems
                            .map((item) => `${item.foodName} × ${item.quantity} (${vnd(item.price)})`)
                            .join(', ')
                        : 'Không có'}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: result.foodDeliveredNow ? 'var(--accent)' : 'var(--surface-disabled)',
                      color: result.foodDeliveredNow ? '#fff' : 'var(--ink-4)',
                    }}
                  >
                    {result.foodItems?.length === 0
                      ? 'Không áp dụng'
                      : result.foodDeliveredNow
                        ? 'Giao ngay — lần quét đầu'
                        : `Đã giao trước đó (${result.foodFulfillmentStatus})`}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ---- Recent scans (this session) ---- */}
      <aside className="staff-pane-right">
        <span className="kicker" style={{ paddingBottom: 8 }}>
          LƯỢT QUÉT GẦN ĐÂY
        </span>
        {log.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--ink-5)' }}>
            Chưa có lượt quét nào trong phiên làm việc này.
          </span>
        ) : (
          log.map((entry) => (
            <div className="scan-log" key={entry.id}>
              <span className="scan-log__dot" style={{ background: entry.dot }} />
              <div className="stack" style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {entry.seat} · {entry.movie}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)', overflowWrap: 'anywhere' }}>
                  {entry.note}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12, color: 'var(--ink-5)' }}>
                {entry.time}
              </span>
            </div>
          ))
        )}
        <span className="note" style={{ marginTop: 'auto' }}>
          Lịch sử này chỉ nằm trong phiên làm việc hiện tại — backend chưa có endpoint liệt kê lượt quét.
        </span>
      </aside>
    </div>
  );
}
