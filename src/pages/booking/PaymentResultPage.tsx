import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '@/api/endpoints';
import type { BookingStatus } from '@/api/types';
import { SiteHeader, Stepper } from '@/components/layout/SiteLayout';
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { useToast } from '@/store/toast';
import './booking.css';

/**
 * W5. The gateway redirects here after checkout, but payment is confirmed
 * server-to-server by the IPN/webhook — so the page polls GET /bookings/{id}
 * until the status settles instead of trusting any query parameter.
 */
const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 90_000;

type View = {
  title: string;
  body: string;
  glyph: string;
  ring: string;
  statusLabel: string;
  statusColor: string;
  spin?: boolean;
  primary?: { label: string; to: string };
};

function viewFor(status: BookingStatus | 'LOADING'): View {
  switch (status) {
    case 'PAID':
      return {
        title: 'Thanh toán thành công',
        body: 'Vé điện tử đã được phát hành. Email xác nhận sẽ gửi tới hộp thư của bạn.',
        glyph: '✓',
        ring: 'var(--ok)',
        statusLabel: 'PAID',
        statusColor: 'var(--ok)',
        primary: { label: 'Xem vé', to: '/my-tickets' },
      };
    case 'CHECKED_IN':
      return {
        title: 'Vé đã được soát',
        body: 'Booking này đã check-in tại cổng soát vé.',
        glyph: '✓',
        ring: 'var(--ok)',
        statusLabel: 'CHECKED_IN',
        statusColor: 'var(--ok)',
        primary: { label: 'Xem vé', to: '/my-tickets' },
      };
    case 'PENDING':
    case 'LOADING':
      return {
        title: 'Đang xác nhận thanh toán',
        body:
          'Chúng tôi đang chờ cổng thanh toán xác nhận giao dịch. Vé sẽ xuất hiện khi thanh toán được xác minh — đừng thanh toán lại.',
        glyph: '',
        ring: 'var(--accent)',
        statusLabel: 'PENDING',
        statusColor: 'var(--accent)',
        spin: true,
        primary: { label: 'Xem booking', to: '/my-tickets' },
      };
    case 'EXPIRED':
      return {
        title: 'Booking đã hết hạn',
        body:
          'Quá thời hạn mà chưa nhận được thanh toán, ghế đã được nhả. Nếu tiền đã bị trừ, hệ thống sẽ tự hoàn lại.',
        glyph: '×',
        ring: 'var(--ink-5)',
        statusLabel: 'EXPIRED',
        statusColor: 'var(--ink-5)',
        primary: { label: 'Đặt lại', to: '/movies' },
      };
    case 'CANCELLED':
      return {
        title: 'Booking đã hủy',
        body: 'Booking này đã bị hủy. Theo dõi trạng thái hoàn tiền trong Vé của tôi.',
        glyph: '×',
        ring: 'var(--line-strong)',
        statusLabel: 'CANCELLED',
        statusColor: 'var(--ink-5)',
        primary: { label: 'Xem vé của tôi', to: '/my-tickets' },
      };
    case 'REFUNDED':
      return {
        title: 'Đã hoàn tiền',
        body: 'Tiền đã được hoàn về phương thức thanh toán gốc.',
        glyph: '↺',
        ring: 'var(--info)',
        statusLabel: 'REFUNDED',
        statusColor: 'var(--info-deep)',
        primary: { label: 'Xem vé của tôi', to: '/my-tickets' },
      };
    default:
      return {
        title: 'Thanh toán chưa thành công',
        body: 'Giao dịch bị từ chối hoặc cần xác thực thêm. Ghế vẫn được giữ cho tới hạn thanh toán.',
        glyph: '!',
        ring: 'var(--danger)',
        statusLabel: String(status),
        statusColor: 'var(--danger-ink)',
      };
  }
}

export default function PaymentResultPage() {
  const { bookingId: param } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  // The gateway return route carries the id in the query string instead.
  const bookingId = Number(param ?? search.get('bookingId') ?? search.get('orderId'));
  const [startedAt] = useState(() => Date.now());
  const [givenUp, setGivenUp] = useState(false);

  const booking = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingApi.status(bookingId),
    enabled: Number.isFinite(bookingId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling once the status can no longer change on its own.
      if (status && status !== 'PENDING') return false;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) return false;
      return POLL_MS;
    },
  });

  useEffect(() => {
    if (booking.data?.status === 'PENDING' && Date.now() - startedAt > POLL_TIMEOUT_MS) {
      setGivenUp(true);
    }
  }, [booking.data, booking.dataUpdatedAt, startedAt]);

  const view = useMemo(() => viewFor(booking.data?.status ?? 'LOADING'), [booking.data]);

  if (!Number.isFinite(bookingId)) {
    return (
      <div className="screen">
        <SiteHeader center={<Stepper current={3} />} showCity={false} />
        <EmptyState
          title="Không xác định được booking"
          description="Đường dẫn không chứa mã booking. Mở “Vé của tôi” để xem các booking gần đây."
          action={<Button onClick={() => navigate('/my-tickets')}>Vé của tôi</Button>}
        />
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <SiteHeader center={<Stepper current={3} />} showCity={false} />

      <div className="result">
        <div className="result__box">
          {booking.isLoading ? (
            <Loading label="Đang kiểm tra trạng thái booking…" />
          ) : booking.isError ? (
            <ErrorState error={booking.error} onRetry={() => void booking.refetch()} />
          ) : (
            <>
              <div
                className={`result__ring${view.spin ? ' result__ring--spin' : ''}`}
                style={{
                  borderColor: 'var(--line)',
                  borderTopColor: view.ring,
                  color: view.ring,
                }}
              >
                {view.glyph}
              </div>

              <h1 className="result__title">{view.title}</h1>
              <p className="result__body">{view.body}</p>

              {givenUp && booking.data?.status === 'PENDING' && (
                <div className="callout callout--notice" style={{ width: '100%', textAlign: 'left' }}>
                  Vẫn chưa nhận được xác nhận sau 90 giây. Thanh toán có thể về muộn — kiểm tra lại trong “Vé của
                  tôi” sau vài phút, đừng thanh toán lại.
                </div>
              )}

              <div className="result__facts">
                <div className="stack" style={{ gap: 3 }}>
                  <span style={{ color: 'var(--ink-5)' }}>Booking</span>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 15 }}>
                    #BK-{bookingId}
                  </span>
                </div>
                <div className="stack" style={{ gap: 3 }}>
                  <span style={{ color: 'var(--ink-5)' }}>Trạng thái</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: view.statusColor }}>
                    {view.statusLabel}
                  </span>
                </div>
                <div className="stack" style={{ gap: 3 }}>
                  <span style={{ color: 'var(--ink-5)' }}>Cập nhật</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>
                    {booking.isFetching ? 'đang kiểm tra…' : 'vừa xong'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {view.primary && (
                  <Link to={view.primary.to} className="btn btn--accent btn--md" style={{ color: '#fff' }}>
                    {view.primary.label}
                  </Link>
                )}
                {booking.data?.status === 'PENDING' && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => {
                      void booking.refetch();
                      toast.show('Đang kiểm tra lại trạng thái…');
                    }}
                  >
                    Kiểm tra lại
                  </Button>
                )}
                <Link to="/" className="btn btn--outline btn--md">
                  Về trang chủ
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
