import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { staffApi } from '@/api/endpoints';
import type { CancellationQuoteDTO, RefundStatus } from '@/api/types';
import {
  Button,
  Card,
  EmptyState,
  Input,
  StatusBadge,
  describeError,
} from '@/components/ui';
import { hhmm, percent, vnd } from '@/lib/format';
import { useToast } from '@/store/toast';
import './staff.css';

/**
 * A refund the counter is working on.
 *
 * The backend exposes no "list refunds" endpoint — only
 * POST /staff/refunds/{id}/claim and .../confirm-cash-payout by id — so this
 * queue holds the refunds raised or opened at this terminal and survives a
 * reload via sessionStorage. Nothing here is invented: every row comes from a
 * real cancel response or an id the staff member typed in.
 */
interface RefundRow {
  refundId: number;
  bookingId: number;
  amount: number;
  status: RefundStatus;
  customer: string;
  reason: string;
}

const QUEUE_KEY = 'cah.staffRefundQueue';

function loadQueue(): RefundRow[] {
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as RefundRow[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(rows: RefundRow[]) {
  try {
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(rows));
  } catch {
    // Non-fatal: the queue just won't survive a reload.
  }
}

const STEPS: Array<{ label: string; reached: (status: RefundStatus) => boolean }> = [
  { label: 'Yêu cầu hoàn tiền', reached: () => true },
  {
    label: 'Nhân viên nhận xử lý',
    reached: (status) => status === 'PROCESSING' || status === 'SUCCEEDED',
  },
  { label: 'Đã chi tiền mặt', reached: (status) => status === 'SUCCEEDED' },
];

/** 4c — cancel a counter booking and pay the refund out in cash. */
export default function RefundsPage() {
  const toast = useToast();

  const [queue, setQueue] = useState<RefundRow[]>(() => loadQueue());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const [bookingInput, setBookingInput] = useState('');
  const [refundInput, setRefundInput] = useState('');
  const [quote, setQuote] = useState<CancellationQuoteDTO | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => saveQueue(queue), [queue]);

  useEffect(() => {
    if (selectedId === null && queue.length) setSelectedId(queue[0].refundId);
  }, [queue, selectedId]);

  const selected = queue.find((row) => row.refundId === selectedId) ?? null;

  function upsert(row: RefundRow) {
    setQueue((current) => {
      const existing = current.findIndex((item) => item.refundId === row.refundId);
      if (existing === -1) return [row, ...current];
      const copy = [...current];
      copy[existing] = { ...copy[existing], ...row };
      return copy;
    });
    setSelectedId(row.refundId);
  }

  /** Step 1: quote the cancellation for a booking code. */
  const getQuote = useMutation({
    mutationFn: (bookingId: number) => staffApi.cancellationQuote(bookingId),
    onSuccess: (data) => {
      setQuote(data);
      setQuoteError(null);
    },
    onError: (error) => {
      setQuote(null);
      setQuoteError(describeError(error));
    },
  });

  /** Step 2: cancel with the quote token; the response carries the refund id. */
  const cancelBooking = useMutation({
    mutationFn: (payload: { bookingId: number; quoteToken: string | null }) =>
      staffApi.cancelBooking(payload.bookingId, {
        quoteToken: payload.quoteToken,
        reason: 'Hủy tại quầy',
      }),
    onSuccess: (result) => {
      setQuote(null);
      setBookingInput('');
      if (result.refundId && result.refundStatus) {
        upsert({
          refundId: result.refundId,
          bookingId: result.bookingId,
          amount: Number(result.refundAmount ?? 0),
          status: result.refundStatus,
          customer: `Booking #${result.bookingId}`,
          reason: 'Hủy tại quầy',
        });
        toast.success(`Đã hủy booking. Yêu cầu hoàn tiền #${result.refundId} đã được tạo.`);
      } else {
        toast.success('Đã hủy booking. Không có khoản nào cần hoàn tiền.');
      }
    },
    onError: (error) => toast.error(error),
  });

  /** Atomic claim: only one staff member can own a refund. */
  const claim = useMutation({
    mutationFn: (refundId: number) => staffApi.claimRefund(refundId),
    onSuccess: (result) => {
      upsert({
        refundId: result.refundId,
        bookingId: result.bookingId,
        amount: Number(result.amount),
        status: result.status,
        customer: `Booking #${result.bookingId}`,
        reason: selected?.reason ?? 'Hoàn tiền mặt',
      });
      toast.success(result.message ?? 'Đã nhận xử lý yêu cầu hoàn tiền.');
    },
    onError: (error) => toast.error(error),
  });

  const payout = useMutation({
    mutationFn: (refundId: number) => staffApi.confirmCashPayout(refundId),
    onSuccess: (result) => {
      upsert({
        refundId: result.refundId,
        bookingId: result.bookingId,
        amount: Number(result.amount),
        status: result.status,
        customer: `Booking #${result.bookingId}`,
        reason: selected?.reason ?? 'Hoàn tiền mặt',
      });
      toast.success(result.message ?? 'Đã xác nhận chi tiền mặt cho khách.');
    },
    onError: (error) => toast.error(error),
  });

  return (
    <div className="staff-two" style={{ gridTemplateColumns: 'minmax(0, 1fr) 400px' }}>
      <div className="refund-page">
        <div className="row-between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <h1 className="display" style={{ fontSize: 44 }}>
            Hủy &amp; hoàn tiền
          </h1>
        </div>

        {/* Look a booking up and quote its cancellation */}
        <Card pad>
          <div className="stack" style={{ gap: 12 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Tra mã booking để báo giá hủy</span>
            <form
              style={{ display: 'flex', gap: 8 }}
              onSubmit={(event) => {
                event.preventDefault();
                const id = Number(bookingInput.replace(/\D/g, ''));
                if (Number.isFinite(id) && id > 0) getQuote.mutate(id);
              }}
            >
              <Input
                small
                inputMode="numeric"
                placeholder="Mã booking, ví dụ 20431"
                value={bookingInput}
                onChange={(event) => setBookingInput(event.target.value)}
                style={{ maxWidth: 280 }}
                aria-label="Mã booking"
              />
              <Button type="submit" variant="dark" size="xs" loading={getQuote.isPending}>
                Báo giá hủy
              </Button>
            </form>

            {quoteError && <span className="field__error">{quoteError}</span>}

            {quote && (
              <div className="quote" style={{ background: 'var(--surface-muted)' }}>
                <div className="quote__row">
                  <span style={{ color: 'var(--ink-4)' }}>Booking</span>
                  <span className="mono" style={{ fontWeight: 700 }}>
                    #BK-{quote.bookingId}
                  </span>
                </div>
                <div className="quote__row">
                  <span style={{ color: 'var(--ink-4)' }}>Suất chiếu</span>
                  <span>
                    {hhmm(quote.showtimeStartTime)} · còn {Math.max(0, Math.round(quote.hoursUntilShowtime))} giờ
                  </span>
                </div>
                <div className="quote__row">
                  <span style={{ color: 'var(--ink-4)' }}>
                    Tiền vé (hoàn {percent(quote.ticketRefundRate)})
                  </span>
                  <span>{vnd(quote.ticketRefundAmount)}</span>
                </div>
                <div className="quote__row">
                  <span style={{ color: 'var(--ink-4)' }}>Đồ ăn chưa giao</span>
                  <span>{vnd(quote.foodRefundAmount)}</span>
                </div>
                <div className="quote__row">
                  <span style={{ color: 'var(--ink-4)' }}>Giữ lại</span>
                  <span>{vnd(quote.retainedAmount)}</span>
                </div>
                <div className="divider" />
                <div className="quote__row" style={{ alignItems: 'baseline' }}>
                  <span style={{ fontWeight: 600 }}>Tổng hoàn</span>
                  <span className="quote__total">{vnd(quote.totalRefundAmount)}</span>
                </div>

                {quote.canCancel ? (
                  <Button
                    variant="danger"
                    size="sm"
                    loading={cancelBooking.isPending}
                    onClick={() =>
                      cancelBooking.mutate({ bookingId: quote.bookingId, quoteToken: quote.quoteToken })
                    }
                  >
                    Hủy booking &amp; tạo yêu cầu hoàn tiền
                  </Button>
                ) : (
                  <div className="callout callout--danger">
                    {quote.reason ?? 'Booking này không thể hủy theo chính sách hiện hành.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Work queue */}
        <div className="table">
          <div className="table__head" style={{ gridTemplateColumns: '110px 1.4fr 1fr 110px 140px' }}>
            <span>REFUND</span>
            <span>KHÁCH · BOOKING</span>
            <span>LÝ DO</span>
            <span style={{ textAlign: 'right' }}>SỐ TIỀN</span>
            <span>TRẠNG THÁI</span>
          </div>

          {queue.length === 0 ? (
            <EmptyState
              title="Chưa có yêu cầu nào ở quầy này"
              description="Backend chưa có endpoint liệt kê refund. Hủy một booking ở trên, hoặc mở trực tiếp một refund bằng mã ở cột bên phải."
            />
          ) : (
            queue.map((row) => (
              <button
                type="button"
                key={row.refundId}
                className="table__row table__row--clickable"
                style={{ gridTemplateColumns: '110px 1.4fr 1fr 110px 140px' }}
                data-selected={row.refundId === selectedId}
                onClick={() => setSelectedId(row.refundId)}
              >
                <span className="mono" style={{ fontWeight: 700 }}>
                  RF-{row.refundId}
                </span>
                <div className="stack" style={{ gap: 2, minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontWeight: 600 }}>{row.customer}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>#BK-{row.bookingId}</span>
                </div>
                <span style={{ color: 'var(--ink-3)' }}>{row.reason}</span>
                <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                  {vnd(row.amount)}
                </span>
                <span style={{ justifySelf: 'start' }}>
                  <StatusBadge status={row.status} />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ---- Detail / actions ---- */}
      <aside className="staff-pane-right">
        <div className="stack" style={{ gap: 8 }}>
          <span className="kicker">MỞ MỘT REFUND THEO MÃ</span>
          <form
            style={{ display: 'flex', gap: 8 }}
            onSubmit={(event) => {
              event.preventDefault();
              const id = Number(refundInput.replace(/\D/g, ''));
              if (!Number.isFinite(id) || id <= 0) return;
              // Claiming is the only read-ish entry point: it returns the
              // refund's amount, booking and status in one call.
              claim.mutate(id);
              setRefundInput('');
            }}
          >
            <Input
              small
              inputMode="numeric"
              placeholder="Mã refund"
              value={refundInput}
              onChange={(event) => setRefundInput(event.target.value)}
              aria-label="Mã refund"
            />
            <Button type="submit" variant="outline" size="xs" style={{ height: 42 }} loading={claim.isPending}>
              Nhận xử lý
            </Button>
          </form>
        </div>

        <div className="divider" />

        {!selected ? (
          <EmptyState title="Chọn một yêu cầu" description="Bấm vào một dòng ở bảng bên trái." />
        ) : (
          <>
            <div className="stack" style={{ gap: 4 }}>
              <span className="mono" style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink-4)' }}>
                RF-{selected.refundId} · #BK-{selected.bookingId}
              </span>
              <span className="display" style={{ fontSize: 34 }}>
                {selected.customer}
              </span>
            </div>

            <div className="quote">
              <div className="quote__row">
                <span style={{ color: 'var(--ink-4)' }}>Lý do</span>
                <span>{selected.reason}</span>
              </div>
              <div className="divider" />
              <div className="quote__row" style={{ alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600 }}>Chi trả tiền mặt</span>
                <span className="quote__total" style={{ fontSize: 30 }}>
                  {vnd(selected.amount)}
                </span>
              </div>
            </div>

            <div className="refund-steps">
              {STEPS.map((step, index) => {
                const done = step.reached(selected.status);
                return (
                  <div className="refund-step" key={step.label} data-done={done}>
                    <span className="refund-step__n">{done ? '✓' : index + 1}</span>
                    <span className="refund-step__label">{step.label}</span>
                  </div>
                );
              })}
            </div>

            <div className="grow" />

            <span className="note">
              Mỗi yêu cầu chỉ một nhân viên được nhận xử lý. Chỉ bấm xác nhận sau khi đã đưa tiền cho khách.
            </span>

            {selected.status === 'REQUESTED' && (
              <Button
                size="md"
                block
                style={{ height: 52, borderRadius: 12 }}
                loading={claim.isPending}
                onClick={() => claim.mutate(selected.refundId)}
              >
                Nhận xử lý
              </Button>
            )}

            {selected.status === 'PROCESSING' && (
              <Button
                size="md"
                block
                style={{ height: 52, borderRadius: 12 }}
                loading={payout.isPending}
                onClick={() => payout.mutate(selected.refundId)}
              >
                Xác nhận đã chi tiền mặt
              </Button>
            )}

            {selected.status === 'SUCCEEDED' && (
              <Button variant="quiet" size="md" block style={{ height: 52, borderRadius: 12 }} disabled>
                Đã hoàn tất
              </Button>
            )}

            {(selected.status === 'FAILED' ||
              selected.status === 'UNKNOWN' ||
              selected.status === 'REVIEW_REQUIRED') && (
              <div className="callout callout--danger">
                Trạng thái <span className="mono">{selected.status}</span> cần đối soát thủ công — chuyển cho
                admin xử lý ở trang Đối soát.
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
