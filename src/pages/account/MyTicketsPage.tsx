import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingApi, userApi } from '@/api/endpoints';
import type { CancellationQuoteDTO, FullInvoiceDTO } from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Modal,
  Pill,
  PosterBox,
  StatusBadge,
} from '@/components/ui';
import { ddmm, dowDate, hhmm, percent, vnd } from '@/lib/format';
import { posterTint } from '@/lib/palette';
import { useToast } from '@/store/toast';
import './account.css';

type Filter = 'all' | 'upcoming' | 'watched' | 'cancelled';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'upcoming', label: 'Sắp chiếu' },
  { value: 'watched', label: 'Đã xem' },
  { value: 'cancelled', label: 'Đã hủy' },
];

/** The refund-rate ladder the backend applies (docs/api/05-bookings.md). */
const TIERS = [
  { pct: '100%', when: '≥ 24 giờ', min: 24 },
  { pct: '80%', when: '6–24 giờ', min: 6 },
  { pct: '50%', when: '2–6 giờ', min: 2 },
  { pct: '—', when: '< 2 giờ: không hủy', min: 0 },
];

function matchesFilter(invoice: FullInvoiceDTO, filter: Filter): boolean {
  const status = invoice.bookingStatus;
  const start = invoice.startTime ? new Date(invoice.startTime).getTime() : 0;
  switch (filter) {
    case 'upcoming':
      return (status === 'PAID' || status === 'PENDING') && start > Date.now();
    case 'watched':
      return status === 'CHECKED_IN' || (status === 'PAID' && start <= Date.now());
    case 'cancelled':
      return status === 'CANCELLED' || status === 'EXPIRED' || status === 'REFUNDED';
    default:
      return true;
  }
}

function seatLabels(invoice: FullInvoiceDTO): string {
  const seats = invoice.seats ?? [];
  if (seats.length === 0) return '—';
  return seats
    .map((seat) => {
      // row/col are raw grid coordinates; A=1, B=2, ...
      const rowLetter = String.fromCharCode(64 + Math.trunc(Number(seat.seatRow)));
      return `${rowLetter}${Math.trunc(Number(seat.seatCol))}`;
    })
    .join(', ');
}

export default function MyTicketsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [quote, setQuote] = useState<CancellationQuoteDTO | null>(null);

  const profile = useQuery({ queryKey: ['profile'], queryFn: userApi.me });

  const invoices = useMemo(() => profile.data?.recentInvoices ?? [], [profile.data]);
  const visible = invoices.filter((invoice) => matchesFilter(invoice, filter));

  // Keep a selection in sync with whatever is currently visible.
  useEffect(() => {
    if (visible.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!visible.some((invoice) => invoice.bookingId === selectedId)) {
      setSelectedId(visible[0].bookingId);
    }
  }, [visible, selectedId]);

  const selected = invoices.find((invoice) => invoice.bookingId === selectedId) ?? null;

  /** Step 1 of cancelling: fetch the quote the backend will honour. */
  const openQuote = useMutation({
    mutationFn: (bookingId: number) => bookingApi.cancellationQuote(bookingId),
    onSuccess: (data) => {
      setQuote(data);
      setRefundOpen(true);
    },
    onError: (error) => toast.error(error),
  });

  /** Step 2: confirm with the quote token so the backend can detect drift. */
  const cancel = useMutation({
    mutationFn: ({ bookingId, quoteToken }: { bookingId: number; quoteToken: string | null }) =>
      bookingApi.cancel(bookingId, { quoteToken, reason: 'Khách hủy trên web' }),
    onSuccess: (result) => {
      setRefundOpen(false);
      setQuote(null);
      toast.success(
        result.refundId
          ? `Đã hủy booking. Yêu cầu hoàn tiền #${result.refundId} đang chờ xử lý.`
          : 'Đã hủy booking. Không có khoản nào cần hoàn.',
      );
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => toast.error(error),
  });

  if (profile.isLoading) return <Loading label="Đang tải vé của bạn…" />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  return (
    <div className="tickets-layout">
      {/* ---- Booking list ---- */}
      <div className="stack" style={{ gap: 14 }}>
        <h1 className="display" style={{ fontSize: 44 }}>
          Vé của tôi
        </h1>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map((option) => (
            <Pill key={option.value} active={filter === option.value} onClick={() => setFilter(option.value)}>
              {option.label}
            </Pill>
          ))}
        </div>

        {invoices.length === 0 ? (
          <EmptyState
            title="Chưa có booking nào"
            description="Khi bạn đặt vé, booking sẽ xuất hiện ở đây. /users/me trả về 5 booking gần nhất."
          />
        ) : visible.length === 0 ? (
          <EmptyState title="Không có booking phù hợp" description="Thử chọn bộ lọc khác." />
        ) : (
          visible.map((invoice) => (
            <button
              type="button"
              className="booking-row"
              key={invoice.bookingId}
              data-selected={invoice.bookingId === selectedId}
              onClick={() => setSelectedId(invoice.bookingId)}
            >
              <PosterBox
                src={invoice.moviePosterUrl}
                width={48}
                height={72}
                radius={8}
                background={posterTint(invoice.movieId ?? invoice.bookingId)}
                label=""
                className="booking-row__poster"
              />
              <div className="booking-row__body">
                <span className="booking-row__title">
                  {invoice.movieTitle ?? `Booking #${invoice.bookingId}`}
                  {invoice.movieFormat ? ` · ${invoice.movieFormat}` : ''}
                </span>
                <span className="booking-row__meta">
                  {invoice.cinemaName ?? '—'}
                  {invoice.startTime ? ` · ${hhmm(invoice.startTime)} ${dowDate(invoice.startTime)}` : ''}
                </span>
                <span className="booking-row__meta">
                  Ghế {seatLabels(invoice)} · {vnd(invoice.totalPrice)}
                </span>
              </div>
              <StatusBadge status={invoice.bookingStatus} />
            </button>
          ))
        )}

        <span className="note">
          Danh sách này là 5 booking gần nhất do <span className="mono">GET /api/v1/users/me</span> trả về.
        </span>
      </div>

      {/* ---- Ticket detail ---- */}
      {selected ? (
        <div className="ticket">
          <div className="ticket__main">
            <div className="row-between">
              <StatusBadge status={selected.bookingStatus} />
              <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-5)' }}>
                #BK-{selected.bookingId}
              </span>
            </div>

            <span className="ticket__title">{selected.movieTitle ?? 'Booking'}</span>

            <div className="ticket__facts">
              <div className="ticket__fact">
                <span className="ticket__k">Ngày</span>
                <span className="ticket__v">{selected.startTime ? dowDate(selected.startTime) : '—'}</span>
              </div>
              <div className="ticket__fact">
                <span className="ticket__k">Giờ</span>
                <span className="ticket__v">{selected.startTime ? hhmm(selected.startTime) : '—'}</span>
              </div>
              <div className="ticket__fact">
                <span className="ticket__k">Phòng</span>
                <span className="ticket__v">
                  {selected.roomName ?? '—'}
                  {selected.movieFormat ? ` · ${selected.movieFormat}` : ''}
                </span>
              </div>
              <div className="ticket__fact">
                <span className="ticket__k">Ghế</span>
                <span className="ticket__seats">{seatLabels(selected)}</span>
              </div>
              <div className="ticket__fact ticket__fact--wide">
                <span className="ticket__k">Rạp</span>
                <span className="ticket__v" style={{ fontSize: 15 }}>
                  {selected.cinemaName ?? '—'}
                </span>
              </div>
              <div className="ticket__fact ticket__fact--wide">
                <span className="ticket__k">Đồ ăn</span>
                <span className="ticket__v" style={{ fontSize: 15 }}>
                  {selected.foods?.length
                    ? selected.foods.map((food) => `${food.foodName} × ${food.quantity}`).join(', ')
                    : 'Không có'}
                </span>
              </div>
              <div className="ticket__fact ticket__fact--wide">
                <span className="ticket__k">Thanh toán</span>
                <span className="ticket__v" style={{ fontSize: 15 }}>
                  {vnd(selected.totalPrice)}
                  {selected.paymentMethod ? ` · ${selected.paymentMethod}` : ''}
                  {selected.voucherCode ? ` · ${selected.voucherCode}` : ''}
                </span>
              </div>
            </div>

            <div className="row-between" style={{ paddingTop: 16, borderTop: '1px solid var(--line)', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--ink-4)', textWrap: 'pretty' }}>
                {selected.bookingStatus === 'PAID'
                  ? 'Hủy được tới 2 giờ trước giờ chiếu. Tỷ lệ hoàn do backend tính lại khi bạn xem báo giá.'
                  : `Trạng thái hiện tại: ${selected.bookingStatus}.`}
              </span>
              {selected.bookingStatus === 'PAID' && (
                <Button
                  variant="danger-outline"
                  size="xs"
                  loading={openQuote.isPending}
                  onClick={() => openQuote.mutate(selected.bookingId)}
                >
                  Hủy vé
                </Button>
              )}
            </div>
          </div>

          <div className="ticket__stub">
            <div className="ticket__qr">
              {selected.bookingStatus === 'PAID' || selected.bookingStatus === 'CHECKED_IN' ? (
                <span style={{ fontSize: 12, color: 'var(--ink-5)', textAlign: 'center', lineHeight: 1.5 }}>
                  Mã QR của vé được backend phát hành riêng cho từng vé (purpose&nbsp;
                  <span className="mono">TICKET_QR</span>) và chưa có endpoint để lấy về, nên không hiển thị ở
                  đây.
                </span>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>Chưa phát hành vé</span>
              )}
            </div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Đưa mã cho nhân viên soát vé</span>
            <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
              Mở cửa soát từ 30 phút trước giờ chiếu. Mỗi vé chỉ quét được một lần.
            </span>
          </div>
        </div>
      ) : (
        <EmptyState title="Chọn một booking" description="Bấm vào booking ở danh sách bên trái để xem chi tiết." />
      )}

      {/* ---- Cancellation quote modal ---- */}
      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} labelledBy="refund-title">
        {quote && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
              <div className="stack" style={{ gap: 4 }}>
                <span id="refund-title" className="display" style={{ fontSize: 40 }}>
                  Hủy booking?
                </span>
                <span style={{ fontSize: 14, color: 'var(--ink-4)' }}>
                  {selected?.movieTitle} · {hhmm(quote.showtimeStartTime)} {ddmm(quote.showtimeStartTime)} · còn{' '}
                  {Math.max(0, Math.round(quote.hoursUntilShowtime))} giờ
                </span>
              </div>
              <button type="button" className="modal__close" aria-label="Đóng" onClick={() => setRefundOpen(false)}>
                ×
              </button>
            </div>

            <div className="tiers">
              {TIERS.map((tier) => (
                <div
                  className="tier"
                  key={tier.when}
                  data-active={
                    quote.hoursUntilShowtime >= tier.min &&
                    !TIERS.some((other) => other.min > tier.min && quote.hoursUntilShowtime >= other.min)
                  }
                >
                  <span className="tier__pct">{tier.pct}</span>
                  <span className="tier__when">{tier.when}</span>
                </div>
              ))}
            </div>

            {quote.canCancel ? (
              <>
                <div className="quote">
                  <div className="quote__row">
                    <span style={{ color: 'var(--ink-4)' }}>
                      Tiền vé (hoàn {percent(quote.ticketRefundRate)})
                    </span>
                    <span>{vnd(quote.ticketRefundAmount)}</span>
                  </div>
                  <div className="quote__row">
                    <span style={{ color: 'var(--ink-4)' }}>Bắp nước — chưa nhận</span>
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
                </div>

                <span style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Voucher đã dùng sẽ không được hoàn lại. Tiền hoàn về phương thức thanh toán gốc; theo dõi trạng
                  thái hoàn tiền trong Vé của tôi.
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <Button variant="outline" size="md" onClick={() => setRefundOpen(false)}>
                    Giữ vé
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    loading={cancel.isPending}
                    onClick={() =>
                      cancel.mutate({ bookingId: quote.bookingId, quoteToken: quote.quoteToken })
                    }
                  >
                    Xác nhận hủy
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="callout callout--danger">
                  {quote.reason ?? 'Booking này không thể hủy theo chính sách hiện hành.'}
                </div>
                <Button variant="outline" size="md" onClick={() => setRefundOpen(false)}>
                  Đóng
                </Button>
              </>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
