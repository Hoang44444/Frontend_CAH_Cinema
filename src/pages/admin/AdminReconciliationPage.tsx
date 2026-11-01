import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { staffApi } from '@/api/endpoints';
import type { CancellationQuoteDTO, ClaimRefundResponseDTO } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import {
  Button,
  Card,
  EmptyState,
  Input,
  StatusBadge,
  describeError,
} from '@/components/ui';
import { ddmmyyyy, hhmm, percent, vnd } from '@/lib/format';
import { useToast } from '@/store/toast';
import './admin.css';

/**
 * 5i — payment reconciliation and the email outbox.
 *
 * The backend has no API for either queue yet: the outbox lives only in
 * `modules/outbox/domain` with no controller, and there is no endpoint that
 * lists refunds needing review. Rather than render invented rows, this screen
 * says what is missing and exposes the reconciliation tools that *do* exist —
 * inspecting a booking through the staff cancellation-quote endpoint (ROLE_ADMIN
 * satisfies /api/v1/staff/**) and claiming / paying out a refund by id.
 */
export default function AdminReconciliationPage() {
  const toast = useToast();

  const [bookingInput, setBookingInput] = useState('');
  const [quote, setQuote] = useState<CancellationQuoteDTO | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [refundInput, setRefundInput] = useState('');
  const [refund, setRefund] = useState<ClaimRefundResponseDTO | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  const inspect = useMutation({
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

  const claim = useMutation({
    mutationFn: (refundId: number) => staffApi.claimRefund(refundId),
    onSuccess: (data) => {
      setRefund(data);
      setRefundError(null);
      toast.success(data.message ?? 'Đã nhận xử lý refund.');
    },
    onError: (error) => {
      setRefund(null);
      setRefundError(describeError(error));
    },
  });

  const payout = useMutation({
    mutationFn: (refundId: number) => staffApi.confirmCashPayout(refundId),
    onSuccess: (data) => {
      setRefund({ ...(refund as ClaimRefundResponseDTO), ...data, claimedAt: refund?.claimedAt ?? '' });
      toast.success(data.message ?? 'Đã xác nhận chi tiền mặt.');
    },
    onError: (error) => toast.error(error),
  });

  return (
    <>
      <AdminTopbar title="Đối soát thanh toán & email" />

      <div className="admin-page">
        {/* What the backend does not expose yet */}
        <div className="callout callout--notice">
          <b>Chưa có API cho hai hàng đợi của màn hình này.</b> Backend chưa expose endpoint nào để liệt kê
          booking/refund cần đối soát, và module <span className="mono">outbox</span> hiện chỉ có ở tầng domain
          (<span className="mono">modules/outbox/domain</span>) mà không có controller. Các KPI và bảng “Cần đối
          soát” / “Hàng đợi email” vì vậy không được dựng từ dữ liệu giả — cần thêm ở backend, ví dụ{' '}
          <span className="mono">GET /api/v1/admin/reconciliation</span> và{' '}
          <span className="mono">GET /api/v1/admin/outbox</span>.
        </div>

        <div className="split-2">
          {/* ---- Booking inspector ---- */}
          <Card flat style={{ padding: '20px 22px' }}>
            <div className="stack" style={{ gap: 14 }}>
              <div className="stack" style={{ gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Tra một booking</span>
                <span className="note">
                  Dùng <span className="mono">GET /api/v1/staff/bookings/&#123;id&#125;/cancellation-quote</span>{' '}
                  — endpoint duy nhất cho phép admin xem số tiền net, tỷ lệ hoàn và lý do chặn hủy của một
                  booking bất kỳ.
                </span>
              </div>

              <form
                style={{ display: 'flex', gap: 8 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  const id = Number(bookingInput.replace(/\D/g, ''));
                  if (Number.isFinite(id) && id > 0) inspect.mutate(id);
                }}
              >
                <Input
                  small
                  inputMode="numeric"
                  placeholder="Mã booking"
                  value={bookingInput}
                  onChange={(event) => setBookingInput(event.target.value)}
                  style={{ maxWidth: 220, background: 'var(--surface-muted)' }}
                  aria-label="Mã booking"
                />
                <Button type="submit" variant="dark" size="xs" loading={inspect.isPending}>
                  Tra cứu
                </Button>
              </form>

              {quoteError && <span className="field__error">{quoteError}</span>}

              {quote && (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Booking</span>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      #BK-{quote.bookingId}
                    </span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Suất chiếu</span>
                    <span>
                      {ddmmyyyy(quote.showtimeStartTime)} {hhmm(quote.showtimeStartTime)}
                    </span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Còn tới giờ chiếu</span>
                    <span>{quote.hoursUntilShowtime.toFixed(1)} giờ</span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Tiền vé net</span>
                    <span className="mono">{vnd(quote.netSeatAmount)}</span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Tiền đồ ăn net</span>
                    <span className="mono">{vnd(quote.netFoodAmount)}</span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Tỷ lệ hoàn vé</span>
                    <span>{percent(quote.ticketRefundRate)}</span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Tổng hoàn dự kiến</span>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                      {vnd(quote.totalRefundAmount)}
                    </span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Có thể hủy</span>
                    <span style={{ fontWeight: 700, color: quote.canCancel ? 'var(--ok)' : 'var(--danger-ink)' }}>
                      {quote.canCancel ? 'Có' : 'Không'}
                    </span>
                  </div>
                  {quote.reason && <div className="callout callout--danger">{quote.reason}</div>}
                </div>
              )}
            </div>
          </Card>

          {/* ---- Refund worker ---- */}
          <Card flat style={{ padding: '20px 22px' }}>
            <div className="stack" style={{ gap: 14 }}>
              <div className="stack" style={{ gap: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Xử lý một refund</span>
                <span className="note">
                  <span className="mono">POST /staff/refunds/&#123;id&#125;/claim</span> nhận xử lý (atomic), sau
                  đó <span className="mono">/confirm-cash-payout</span> xác nhận đã chi tiền.
                </span>
              </div>

              <form
                style={{ display: 'flex', gap: 8 }}
                onSubmit={(event) => {
                  event.preventDefault();
                  const id = Number(refundInput.replace(/\D/g, ''));
                  if (Number.isFinite(id) && id > 0) claim.mutate(id);
                }}
              >
                <Input
                  small
                  inputMode="numeric"
                  placeholder="Mã refund"
                  value={refundInput}
                  onChange={(event) => setRefundInput(event.target.value)}
                  style={{ maxWidth: 220, background: 'var(--surface-muted)' }}
                  aria-label="Mã refund"
                />
                <Button type="submit" variant="dark" size="xs" loading={claim.isPending}>
                  Nhận xử lý
                </Button>
              </form>

              {refundError && <span className="field__error">{refundError}</span>}

              {refund ? (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Refund</span>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      RF-{refund.refundId}
                    </span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Booking</span>
                    <span className="mono">#BK-{refund.bookingId}</span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Số tiền</span>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {vnd(refund.amount)}
                    </span>
                  </div>
                  <div className="list-row">
                    <span style={{ color: 'var(--ink-4)' }}>Trạng thái</span>
                    <StatusBadge status={refund.status} />
                  </div>

                  {refund.status === 'PROCESSING' && (
                    <Button size="sm" loading={payout.isPending} onClick={() => payout.mutate(refund.refundId)}>
                      Xác nhận đã chi tiền mặt
                    </Button>
                  )}

                  {(refund.status === 'FAILED' ||
                    refund.status === 'UNKNOWN' ||
                    refund.status === 'REVIEW_REQUIRED') && (
                    <div className="callout callout--danger">
                      Trạng thái <span className="mono">{refund.status}</span> cần đối soát thủ công với cổng
                      thanh toán trước khi chi tiền.
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState
                  title="Chưa chọn refund"
                  description="Nhập mã refund để nhận xử lý và xem số tiền phải chi."
                />
              )}
            </div>
          </Card>
        </div>

        {/* ---- Placeholders for the two missing queues ---- */}
        <div className="recon-kpis">
          {[
            'Refund thất bại / không rõ',
            'Tiền về muộn chờ hoàn',
            'Booking cũ cần rà soát',
            'Email lỗi (24h)',
          ].map((label) => (
            <div className="recon-kpi" key={label}>
              <span style={{ fontSize: 12, color: 'var(--ink-4)', fontWeight: 600 }}>{label}</span>
              <span className="recon-kpi__v" style={{ color: 'var(--ink-6)' }}>
                —
              </span>
              <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>chưa có endpoint</span>
            </div>
          ))}
        </div>

        <Card flat style={{ padding: '20px 22px' }}>
          <div className="stack" style={{ gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Hàng đợi email (outbox)</span>
            <EmptyState
              title="Chưa thể hiển thị"
              description="Cần một endpoint liệt kê OutboxEvent (event type, người nhận, số lần thử, trạng thái SENT/RETRY/FAILED/PENDING). Trạng thái gửi email độc lập với trạng thái tiền/vé."
            />
          </div>
        </Card>
      </div>
    </>
  );
}
