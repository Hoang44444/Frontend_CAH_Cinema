import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingApi, userApi } from '@/api/endpoints';
import type { BookingStatus, InvoiceSeat } from '@/api/types';
import { SiteHeader, Stepper } from '@/components/layout/SiteLayout';
import { Button, EmptyState, PosterBox, StatusBadge } from '@/components/ui';
import { ddmmyyyy, dowDateLong, hhmm, vnd } from '@/lib/format';
import { tokenStore } from '@/lib/http';
import { pendingPaymentStore } from '@/store/pendingPayment';
import { useToast } from '@/store/toast';
import './booking.css';

/**
 * W5. The gateway redirects here after checkout (/payment/result or /payment/return).
 * Payment is confirmed server-to-server by the IPN/webhook, so the page polls
 * GET /bookings/{id} until the status settles while displaying all gateway
 * and ticket details.
 */
const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 90_000;

const VNPAY_CODES: Record<string, string> = {
  '00': 'Giao dịch thành công',
  '07': 'Trừ tiền thành công, giao dịch bị nghi ngờ (liên hệ bộ phận hỗ trợ)',
  '09': 'Thẻ/Tài khoản chưa đăng ký dịch vụ Internet Banking tại ngân hàng',
  '10': 'Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
  '11': 'Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch',
  '12': 'Thẻ/Tài khoản của khách hàng đang bị khóa',
  '13': 'Quý khách nhập sai mật khẩu xác thực OTP',
  '24': 'Khách hàng đã hủy giao dịch thanh toán',
  '51': 'Tài khoản không đủ số dư để thực hiện giao dịch',
  '65': 'Tài khoản đã vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Nhập sai mật khẩu thanh toán quá số lần quy định',
};

const MOMO_CODES: Record<string, string> = {
  '0': 'Giao dịch thành công',
  '9000': 'Giao dịch đã được xác nhận thành công',
  '49': 'Người dùng đã hủy giao dịch trên MoMo',
  '1006': 'Người dùng từ chối thanh toán',
  '1001': 'Tài khoản không đủ số dư để thực hiện giao dịch',
  '1002': 'Giao dịch bị từ chối bởi nhà phát hành tài khoản',
  '2101': 'Yêu cầu thanh toán đã hết hạn',
};

/** Extracts booking id from various URL param candidates or order references ("BK12-...", "12_..."). */
function extractBookingId(candidates: Array<string | null | undefined>): number | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const str = String(raw).trim();
    const clean = str.replace(/^BK[-_]?/i, '');
    const match = /^(\d+)/.exec(clean);
    if (match) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id > 0) return id;
    }
  }
  return null;
}

/** Parses VNPay date string format "yyyyMMddHHmmss" -> "HH:mm:ss dd/MM/yyyy". */
function formatVnpPayDate(raw: string | null): string | null {
  if (!raw || raw.length !== 14) return null;
  const y = raw.slice(0, 4);
  const m = raw.slice(4, 6);
  const d = raw.slice(6, 8);
  const h = raw.slice(8, 10);
  const mi = raw.slice(10, 12);
  const s = raw.slice(12, 14);
  return `${h}:${mi}:${s} - ${d}/${m}/${y}`;
}

/** Formats seats into printable tags like ["F07", "F08"]. */
function formatSeatList(invoiceSeats?: InvoiceSeat[] | null, fallbackSeats?: string[]): string[] {
  if (invoiceSeats && invoiceSeats.length > 0) {
    return invoiceSeats.map((seat) => {
      const numRow = Number(seat.seatRow);
      const rowStr =
        Number.isFinite(numRow) && numRow >= 1 && numRow <= 26
          ? String.fromCharCode(64 + Math.trunc(numRow))
          : String(seat.seatRow);
      const colNum = Math.trunc(Number(seat.seatCol));
      return `${rowStr}${Number.isFinite(colNum) && colNum < 10 ? `0${colNum}` : (colNum || seat.seatCol)}`;
    });
  }
  return fallbackSeats ?? [];
}

type HeroView = {
  title: string;
  body: string;
  glyph: 'ok' | 'spin' | 'fail' | 'clock';
  color: string;
  bgColor: string;
  statusLabel: string;
};

function heroFor(
  status: BookingStatus | 'LOADING',
  gatewayFailed: boolean,
  gatewayReason: string | null,
): HeroView {
  if (gatewayFailed && status === 'PENDING') {
    return {
      title: 'Thanh toán không thành công',
      body:
        gatewayReason ??
        'Cổng thanh toán phản hồi giao dịch bị từ chối hoặc người dùng hủy thanh toán.',
      glyph: 'fail',
      color: 'var(--danger)',
      bgColor: 'var(--danger-soft)',
      statusLabel: 'FAILED',
    };
  }

  switch (status) {
    case 'PAID':
      return {
        title: 'Thanh toán thành công',
        body: 'Vé điện tử đã được phát hành và kích hoạt. Bạn có thể xuất trình vé khi tới rạp chiếu phim.',
        glyph: 'ok',
        color: 'var(--ok)',
        bgColor: '#edf8f2',
        statusLabel: 'PAID',
      };
    case 'CHECKED_IN':
      return {
        title: 'Vé đã được soát',
        body: 'Booking này đã được soát vé thành công tại phòng chiếu.',
        glyph: 'ok',
        color: 'var(--ok)',
        bgColor: '#edf8f2',
        statusLabel: 'CHECKED_IN',
      };
    case 'PENDING':
    case 'LOADING':
      return {
        title: 'Đang xác nhận thanh toán',
        body: 'Hệ thống đang chờ cổng thanh toán xác thực giao dịch qua IPN. Vé sẽ xuất hiện ngay khi hoàn tất — vui lòng không thanh toán lại.',
        glyph: 'spin',
        color: 'var(--accent)',
        bgColor: 'var(--accent-soft)',
        statusLabel: 'PENDING',
      };
    case 'EXPIRED':
      return {
        title: 'Booking đã hết hạn',
        body: 'Quá thời hạn mà chưa nhận được thanh toán, ghế đã được nhả. Nếu tiền đã bị trừ, hệ thống sẽ tự động hoàn lại.',
        glyph: 'clock',
        color: 'var(--ink-5)',
        bgColor: 'var(--surface-sunken)',
        statusLabel: 'EXPIRED',
      };
    case 'CANCELLED':
      return {
        title: 'Booking đã hủy',
        body: 'Booking này đã bị hủy. Theo dõi trạng thái hoàn tiền trong mục Vé của tôi.',
        glyph: 'fail',
        color: 'var(--danger)',
        bgColor: 'var(--danger-soft)',
        statusLabel: 'CANCELLED',
      };
    case 'REFUNDED':
      return {
        title: 'Đã hoàn tiền',
        body: 'Số tiền đặt vé đã được hoàn về tài khoản/phương thức thanh toán ban đầu.',
        glyph: 'ok',
        color: 'var(--info-deep)',
        bgColor: '#eaf4fd',
        statusLabel: 'REFUNDED',
      };
    default:
      return {
        title: 'Giao dịch chưa hoàn tất',
        body: 'Giao dịch bị từ chối hoặc cần kiểm tra thêm. Ghế vẫn được giữ trong thời gian cho phép.',
        glyph: 'fail',
        color: 'var(--danger)',
        bgColor: 'var(--danger-soft)',
        statusLabel: String(status),
      };
  }
}

export default function PaymentResultPage() {
  const { bookingId: param } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [startedAt] = useState(() => Date.now());
  const [givenUp, setGivenUp] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract booking id from candidate params
  const bookingId = useMemo(
    () =>
      extractBookingId([
        param,
        search.get('bookingId'),
        search.get('orderId'),
        search.get('vnp_TxnRef'),
        search.get('id'),
      ]) ??
      pendingPaymentStore.get() ??
      Number.NaN,
    [param, search],
  );

  // Cached metadata saved in localStorage right before checkout redirect
  const pendingInfo = useMemo(() => pendingPaymentStore.getInfo(), []);

  // Gateway response params
  const vnpResponseCode = search.get('vnp_ResponseCode');
  const vnpTxnRef = search.get('vnp_TxnRef');
  const vnpTransactionNo = search.get('vnp_TransactionNo');
  const vnpBankCode = search.get('vnp_BankCode');
  const vnpCardType = search.get('vnp_CardType');
  const vnpPayDate = search.get('vnp_PayDate');
  const vnpAmount = search.get('vnp_Amount') ? Number(search.get('vnp_Amount')) / 100 : null;

  const momoPartnerCode = search.get('partnerCode');
  const momoResultCode = search.get('resultCode');
  const momoTransId = search.get('transId');
  const momoAmount = search.get('amount') ? Number(search.get('amount')) : null;
  const momoMessage = search.get('message');
  const momoPayType = search.get('payType');

  const stripeSessionId = search.get('session_id');

  // Identify payment gateway name
  const gatewayName = useMemo(() => {
    if (vnpTxnRef || vnpResponseCode || vnpTransactionNo) return 'VNPay';
    if (momoPartnerCode === 'MOMO' || momoResultCode !== null || momoTransId) return 'MoMo';
    if (stripeSessionId) return 'Stripe';
    if (pendingInfo?.paymentMethod) return pendingInfo.paymentMethod;
    return 'Cổng thanh toán trực tuyến';
  }, [vnpTxnRef, vnpResponseCode, vnpTransactionNo, momoPartnerCode, momoResultCode, momoTransId, stripeSessionId, pendingInfo]);

  // Transaction reference / number
  const transactionRef = useMemo(() => {
    return vnpTransactionNo || momoTransId || stripeSessionId || search.get('transId') || null;
  }, [vnpTransactionNo, momoTransId, stripeSessionId, search]);

  // Check if gateway returned explicit failure
  const gatewayFailure = useMemo(() => {
    if (vnpResponseCode && vnpResponseCode !== '00') {
      return {
        code: vnpResponseCode,
        message: VNPAY_CODES[vnpResponseCode] || `Lỗi cổng thanh toán VNPay (Mã: ${vnpResponseCode})`,
      };
    }
    if (momoResultCode !== null && momoResultCode !== '0' && momoResultCode !== '9000') {
      return {
        code: momoResultCode,
        message: MOMO_CODES[momoResultCode] || momoMessage || `Lỗi thanh toán MoMo (Mã: ${momoResultCode})`,
      };
    }
    return null;
  }, [vnpResponseCode, momoResultCode, momoMessage]);

  // Real-time backend status polling
  const booking = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingApi.status(bookingId),
    enabled: Number.isFinite(bookingId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && status !== 'PENDING') return false;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) return false;
      return POLL_MS;
    },
  });

  // Profile data for full invoice details
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: userApi.me,
    enabled: Boolean(tokenStore.access()),
  });

  // Find the exact invoice for this booking id
  const invoice = useMemo(
    () => profile.data?.recentInvoices?.find((inv) => inv.bookingId === bookingId) ?? null,
    [profile.data, bookingId],
  );

  // Status transitions: when PAID, refresh profile & invoices
  useEffect(() => {
    if (booking.data?.status === 'PAID') {
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  }, [booking.data?.status, queryClient]);

  // Stop polling on timeout
  useEffect(() => {
    if (booking.data?.status === 'PENDING' && Date.now() - startedAt > POLL_TIMEOUT_MS) {
      setGivenUp(true);
    }
  }, [booking.data, booking.dataUpdatedAt, startedAt]);

  // Once booking settles, clean up the pending payment marker
  useEffect(() => {
    const status = booking.data?.status;
    if (status && status !== 'PENDING') {
      pendingPaymentStore.clear();
    }
  }, [booking.data?.status]);

  // Hero status view
  const hero = useMemo(
    () =>
      heroFor(
        booking.data?.status ?? 'LOADING',
        Boolean(gatewayFailure),
        gatewayFailure?.message ?? null,
      ),
    [booking.data?.status, gatewayFailure],
  );

  // Movie & Ticket facts consolidated from invoice + pendingInfo
  const movieTitle = invoice?.movieTitle || pendingInfo?.movieTitle || 'Vé xem phim';
  const moviePosterUrl = invoice?.moviePosterUrl || pendingInfo?.moviePosterUrl || null;
  const movieFormat = invoice?.movieFormat || pendingInfo?.format || '2D';
  const cinemaName = invoice?.cinemaName || pendingInfo?.cinemaName || 'Rạp CAH Cinema';
  const roomName = invoice?.roomName || pendingInfo?.roomName || 'Phòng chiếu';
  const startTime = invoice?.startTime || pendingInfo?.startTime || null;
  const seatChips = useMemo(
    () => formatSeatList(invoice?.seats, pendingInfo?.seatNames),
    [invoice?.seats, pendingInfo?.seatNames],
  );
  const foods = invoice?.foods ?? [];
  const totalAmount =
    invoice?.totalPrice ??
    vnpAmount ??
    momoAmount ??
    pendingInfo?.totalAmount ??
    null;
  const discountAmount = invoice?.discountAmount ?? 0;
  const voucherCode = invoice?.voucherCode ?? null;
  const finalPaymentMethod =
    invoice?.paymentMethod || gatewayName || pendingInfo?.paymentMethod || 'Online';

  // Formatted date string
  const formattedPaymentTime = useMemo(() => {
    if (vnpPayDate) {
      const parsed = formatVnpPayDate(vnpPayDate);
      if (parsed) return parsed;
    }
    const date = invoice?.bookingCreatedAt ? new Date(invoice.bookingCreatedAt) : new Date();
    return `${hhmm(date)} - ${ddmmyyyy(date)}`;
  }, [vnpPayDate, invoice?.bookingCreatedAt]);

  const handleCopyBookingId = () => {
    if (!Number.isFinite(bookingId)) return;
    navigator.clipboard
      .writeText(`#BK-${bookingId}`)
      .then(() => {
        setCopied(true);
        toast.show('Đã sao chép mã booking');
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        toast.show(`Mã đặt vé: #BK-${bookingId}`);
      });
  };

  const handlePrint = () => {
    window.print();
  };

  if (!Number.isFinite(bookingId)) {
    return (
      <div className="screen">
        <SiteHeader center={<Stepper current={3} />} showCity={false} />
        <EmptyState
          title="Không tìm thấy mã đơn hàng"
          description="Đường dẫn không chứa thông tin mã đặt vé. Bạn có thể mở mục “Vé của tôi” để xem các giao dịch gần đây."
          action={
            <div style={{ display: 'flex', gap: 12 }}>
              <Button onClick={() => navigate('/my-tickets')}>Vé của tôi</Button>
              <Button variant="outline" onClick={() => navigate('/')}>
                Về trang chủ
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const isSuccess = booking.data?.status === 'PAID' || booking.data?.status === 'CHECKED_IN';
  const isPending = booking.data?.status === 'PENDING' || booking.isLoading;

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <SiteHeader center={<Stepper current={3} />} showCity={false} />

      <main className="result">
        <div className="result-layout">
          {/* Status Hero Card */}
          <section className="result-hero">
            <div
              className={`result-hero__icon${hero.glyph === 'spin' ? ' result-hero__icon--spin' : ''}`}
              style={{
                backgroundColor: hero.bgColor,
                color: hero.color,
                border: `3px solid ${hero.color}`,
              }}
            >
              {hero.glyph === 'ok' && (
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              {hero.glyph === 'spin' && (
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="2" x2="12" y2="6" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                  <line x1="2" y1="12" x2="6" y2="12" />
                  <line x1="18" y1="12" x2="22" y2="12" />
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                  <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
                </svg>
              )}
              {hero.glyph === 'fail' && (
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              {hero.glyph === 'clock' && (
                <svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <StatusBadge status={hero.statusLabel} />
              <h1 className="result-hero__title" style={{ color: hero.color }}>
                {hero.title}
              </h1>
              <p className="result-hero__body">{hero.body}</p>
            </div>

            {/* Gateway error callout */}
            {gatewayFailure && (
              <div className="result-notice result-notice--danger" style={{ width: '100%', maxWidth: 580, textAlign: 'left' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div>
                  <strong>Thông báo từ {gatewayName}: </strong>
                  {gatewayFailure.message}
                </div>
              </div>
            )}

            {/* Timeout notice */}
            {givenUp && booking.data?.status === 'PENDING' && (
              <div className="result-notice result-notice--warn" style={{ width: '100%', maxWidth: 580, textAlign: 'left' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <div>
                  Vẫn chưa nhận được xác nhận IPN sau 90 giây. Thanh toán có thể đang được xử lý chậm bởi ngân hàng — vui lòng kiểm tra lại trong <strong>Vé của tôi</strong> sau vài phút, đừng thanh toán lại.
                </div>
              </div>
            )}
          </section>

          {/* Details Grid: Payment Receipt + Movie/Ticket Details */}
          <div className="result-grid">
            {/* Card 1: Thông tin thanh toán */}
            <div className="result-card">
              <div className="result-card__header">
                <span className="result-card__title">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="5" width="20" height="14" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  Chi tiết thanh toán
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>
                  {booking.isFetching ? 'đang đồng bộ…' : 'đã cập nhật'}
                </span>
              </div>

              <div className="result-receipt">
                <div className="result-receipt__row">
                  <span className="result-receipt__label">Mã đặt vé</span>
                  <span className="result-receipt__value result-receipt__value--mono">
                    {`#BK-${bookingId}`}
                    <button
                      type="button"
                      className="result-copy-btn"
                      onClick={handleCopyBookingId}
                      title="Sao chép mã"
                    >
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      {copied ? 'Đã chép' : 'Chép'}
                    </button>
                  </span>
                </div>

                {transactionRef && (
                  <div className="result-receipt__row">
                    <span className="result-receipt__label">Mã giao dịch cổng</span>
                    <span className="result-receipt__value result-receipt__value--mono" style={{ fontSize: 13 }}>
                      {transactionRef}
                    </span>
                  </div>
                )}

                <div className="result-receipt__row">
                  <span className="result-receipt__label">Cổng thanh toán</span>
                  <span className="result-receipt__value">
                    {finalPaymentMethod}
                  </span>
                </div>

                {(vnpBankCode || vnpCardType || momoPayType) && (
                  <div className="result-receipt__row">
                    <span className="result-receipt__label">Ngân hàng / Loại kênh</span>
                    <span className="result-receipt__value">
                      {[vnpBankCode, vnpCardType, momoPayType].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                )}

                <div className="result-receipt__row">
                  <span className="result-receipt__label">Thời gian giao dịch</span>
                  <span className="result-receipt__value" style={{ fontSize: 13 }}>
                    {formattedPaymentTime}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="result-receipt__row">
                    <span className="result-receipt__label">Giảm giá {voucherCode ? `(${voucherCode})` : ''}</span>
                    <span className="result-receipt__value" style={{ color: 'var(--ok)' }}>
                      -{vnd(discountAmount)}
                    </span>
                  </div>
                )}

                <div className="result-receipt__total-row">
                  <span className="result-receipt__total-label">Tổng tiền thanh toán</span>
                  <span className="result-receipt__total-value">
                    {vnd(totalAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Thông tin vé & suất chiếu */}
            <div className="result-card">
              <div className="result-card__header">
                <span className="result-card__title">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                  </svg>
                  Thông tin vé xem phim
                </span>
                <span className="result-chip" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  {movieFormat}
                </span>
              </div>

              <div className="result-movie-wrap">
                <div style={{ width: 68, flexShrink: 0 }}>
                  <PosterBox
                    src={moviePosterUrl}
                    alt={movieTitle}
                    width={68}
                    height={102}
                    radius={8}
                  />
                </div>

                <div className="result-movie-info">
                  <h2 className="result-movie-title">{movieTitle}</h2>
                  <div style={{ fontSize: 13.5, color: 'var(--ink-3)' }}>
                    <strong>{cinemaName}</strong>
                    {roomName ? ` · ${roomName}` : ''}
                  </div>
                  {startTime && (
                    <div style={{ fontSize: 13, color: 'var(--ink-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {dowDateLong(startTime)} · <strong style={{ color: 'var(--ink)' }}>{hhmm(startTime)}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Seats list */}
              {seatChips.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-5)', marginBottom: 6 }}>
                    Ghế đã chọn ({seatChips.length} ghế):
                  </div>
                  <div className="result-chips">
                    {seatChips.map((name) => (
                      <span key={name} className="result-chip" style={{ background: 'var(--ink)', color: '#fff' }}>
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Foods list */}
              {foods.length > 0 && (
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-5)', marginBottom: 6 }}>
                    Bắp nước & Combo:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                    {foods.map((food, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-2)' }}>
                        <span>
                          {food.foodName} <span style={{ color: 'var(--ink-5)' }}>x{food.quantity}</span>
                        </span>
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {vnd(Number(food.unitPrice) * Number(food.quantity))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Guidance / Notice Box */}
          {isSuccess && (
            <div className="result-notice result-notice--ok">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <strong>Hướng dẫn nhận vé tại rạp:</strong> Quý khách vui lòng mở mục <strong>“Vé của tôi”</strong> để lấy mã QR soát vé hoặc đọc mã đặt vé <strong>{`#BK-${bookingId}`}</strong> tại quầy để in vé giấy. Vui lòng có mặt trước giờ chiếu từ 10–15 phút.
              </div>
            </div>
          )}

          {isPending && !gatewayFailure && (
            <div className="result-notice result-notice--warn">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div>
                <strong>Đang chờ tín hiệu xác nhận:</strong> Nếu bạn đã hoàn tất trừ tiền trên app ngân hàng/ví điện tử, hệ thống sẽ tự động cập nhật sau vài giây. Nhấn <strong>“Kiểm tra lại”</strong> nếu trạng thái chưa đổi.
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="result-actions">
            {isSuccess && (
              <>
                <Link to="/my-tickets" className="btn btn--accent btn--md" style={{ color: '#fff' }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
                  </svg>
                  Xem vé của tôi
                </Link>
                <Button variant="outline" size="md" onClick={handlePrint}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  In thông tin vé
                </Button>
              </>
            )}

            {isPending && (
              <Button
                variant="accent"
                size="md"
                onClick={() => {
                  void booking.refetch();
                  void profile.refetch();
                  toast.show('Đang kiểm tra lại trạng thái giao dịch…');
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                Kiểm tra lại
              </Button>
            )}

            {!isSuccess && !isPending && (
              <>
                <Link to="/movies" className="btn btn--accent btn--md" style={{ color: '#fff' }}>
                  Đặt lại vé khác
                </Link>
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
              </>
            )}

            <Link to="/" className="btn btn--outline btn--md">
              Về trang chủ
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
