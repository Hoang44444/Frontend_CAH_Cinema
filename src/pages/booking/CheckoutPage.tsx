import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { bookingApi, foodApi, voucherApi } from '@/api/endpoints';
import type { BookingPaymentMethod, VoucherResponseDTO } from '@/api/types';
import { SiteHeader, Stepper } from '@/components/layout/SiteLayout';
import { Button, EmptyState, ErrorState, Loading, Pill } from '@/components/ui';
import { ddmmyyyy, dowDate, hhmm, vnd } from '@/lib/format';
import { bookingDraftStore } from '@/store/bookingDraft';
import { pendingPaymentStore } from '@/store/pendingPayment';
import { useToast } from '@/store/toast';
import './booking.css';

const CATEGORIES = ['Tất cả', 'Combo', 'Food', 'Drink'] as const;

/** Online payment options. CASH is rejected online (CASH_PAYMENT_REQUIRES_STAFF). */
const PAYMENT_METHODS: Array<{ value: BookingPaymentMethod; label: string }> = [
  { value: 'STRIPE', label: 'Stripe' },
  { value: 'VNPAY', label: 'VNPay' },
  { value: 'MOMO', label: 'MoMo' },
];

/**
 * Client-side preview of a voucher's effect, purely for the summary. The
 * backend recomputes it when the booking is created and its numbers win.
 */
function previewVoucherDiscount(voucher: VoucherResponseDTO | null, orderTotal: number): number {
  if (!voucher) return 0;
  if (voucher.type === 'FIXED_AMOUNT') return Math.min(voucher.value, orderTotal);
  const raw = Math.round((orderTotal * voucher.value) / 100);
  return voucher.maxDiscount ? Math.min(raw, voucher.maxDiscount) : raw;
}

function isUsable(voucher: VoucherResponseDTO, orderTotal: number): boolean {
  if (!voucher.isActive || voucher.isDeleted) return false;
  if (voucher.usedCount >= voucher.quantity) return false;
  const now = Date.now();
  if (new Date(voucher.startAt).getTime() > now) return false;
  if (new Date(voucher.expiredAt).getTime() <= now) return false;
  if (voucher.minOrderValue && orderTotal < voucher.minOrderValue) return false;
  return true;
}

export default function CheckoutPage() {
  const { showtimeId: param } = useParams();
  const showtimeId = Number(param);
  const navigate = useNavigate();
  const toast = useToast();

  const draft = useMemo(() => bookingDraftStore.getFor(showtimeId), [showtimeId]);

  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Tất cả');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [voucherId, setVoucherId] = useState<number | null>(null);
  const [method, setMethod] = useState<BookingPaymentMethod>('STRIPE');

  const foods = useQuery({ queryKey: ['foods'], queryFn: foodApi.list });
  const vouchers = useQuery({ queryKey: ['vouchers', 'mine'], queryFn: voucherApi.mine });

  const seatTotal = draft?.estimatedSeatTotal ?? 0;

  const foodTotal = useMemo(() => {
    if (!foods.data) return 0;
    return foods.data.reduce(
      (sum, food) => sum + Number(food.price) * (quantities[food.foodId] ?? 0),
      0,
    );
  }, [foods.data, quantities]);

  const orderTotal = seatTotal + foodTotal;
  const selectedVoucher = vouchers.data?.find((voucher) => voucher.voucherId === voucherId) ?? null;
  const voucherDiscount = previewVoucherDiscount(selectedVoucher, orderTotal);
  const estimatedGrand = Math.max(0, orderTotal - voucherDiscount);

  const visibleFoods = (foods.data ?? []).filter(
    (food) => category === 'Tất cả' || food.category === category,
  );

  function bump(foodId: number, delta: number) {
    setQuantities((current) => {
      const next = Math.max(0, Math.min(99, (current[foodId] ?? 0) + delta));
      const copy = { ...current };
      if (next === 0) delete copy[foodId];
      else copy[foodId] = next;
      return copy;
    });
  }

  /**
   * Creates the booking, then hands off to the chosen gateway. The booking
   * exists as PENDING even if the hand-off fails, so on error we still send the
   * user to the result screen where they can retry payment.
   */
  const pay = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error('Không tìm thấy ghế đã chọn. Vui lòng chọn lại ghế.');

      const booking = await bookingApi.create({
        showtimeId,
        seatIds: draft.seatIds,
        paymentMethod: method,
        voucherId: voucherId ?? undefined,
        foodItems: Object.entries(quantities).map(([foodId, quantity]) => ({
          foodId: Number(foodId),
          quantity,
        })),
      });

      // A unique id per attempt, required by the VNPay / MoMo endpoints.
      const requestId = `BK${booking.bookingId}-${Date.now()}`;

      try {
        if (method === 'STRIPE') {
          const checkout = await bookingApi.stripePay(booking.bookingId);
          return { bookingId: booking.bookingId, payUrl: checkout.payUrl };
        }
        if (method === 'VNPAY') {
          const checkout = await bookingApi.vnpayPay(booking.bookingId, requestId);
          return { bookingId: booking.bookingId, payUrl: checkout.payUrl };
        }
        const checkout = await bookingApi.momoPay(booking.bookingId, requestId);
        return {
          bookingId: booking.bookingId,
          payUrl: checkout.payUrl ?? checkout.deeplink ?? checkout.qrCodeUrl ?? null,
        };
      } catch (error) {
        return { bookingId: booking.bookingId, payUrl: null, handoffError: error };
      }
    },
    onSuccess: ({ bookingId, payUrl, handoffError }) => {
      bookingDraftStore.clear();
      if (payUrl) {
        // Some gateways come back without the booking id, so remember it here.
        pendingPaymentStore.save(bookingId);
        // Leave the SPA for the gateway's hosted page.
        window.location.href = payUrl;
        return;
      }
      if (handoffError) toast.error(handoffError);
      navigate(`/booking/${bookingId}/result`, { replace: true });
    },
    onError: (error) => toast.error(error),
  });

  if (!Number.isFinite(showtimeId)) {
    return (
      <div className="screen">
        <SiteHeader center={<Stepper current={2} />} showCity={false} />
        <ErrorState error={new Error('Mã suất chiếu không hợp lệ.')} />
      </div>
    );
  }

  if (!draft || draft.seatIds.length === 0) {
    return (
      <div className="screen">
        <SiteHeader center={<Stepper current={2} />} showCity={false} />
        <EmptyState
          title="Chưa chọn ghế"
          description="Phiên chọn ghế đã hết hoặc bạn mở trang này trực tiếp. Hãy chọn ghế lại."
          action={
            <Button onClick={() => navigate(`/booking/showtimes/${showtimeId}/seats`)}>Chọn ghế</Button>
          }
        />
      </div>
    );
  }

  const context = draft.context;

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <SiteHeader center={<Stepper current={2} />} showCity={false} />

      <div className="checkout-layout">
        <div className="stack" style={{ gap: 28, minWidth: 0 }}>
          {/* ---- Food & drinks ---- */}
          <section className="stack" style={{ gap: 14 }}>
            <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
              <h2 className="section-title">Bắp nước</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                {CATEGORIES.map((value) => (
                  <Pill key={value} active={category === value} onClick={() => setCategory(value)}>
                    {value}
                  </Pill>
                ))}
              </div>
            </div>

            {foods.isLoading ? (
              <Loading inline />
            ) : foods.isError ? (
              <ErrorState error={foods.error} onRetry={() => void foods.refetch()} />
            ) : visibleFoods.length === 0 ? (
              <EmptyState title="Chưa có món nào" description="Bạn vẫn có thể thanh toán chỉ với vé." />
            ) : (
              <div className="food-grid">
                {visibleFoods.map((food) => {
                  const qty = quantities[food.foodId] ?? 0;
                  return (
                    <div className="food-card" key={food.foodId} data-picked={qty > 0}>
                      {food.imageUrl ? (
                        <img className="food-card__image" src={food.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <div className="food-card__image" />
                      )}
                      <div className="food-card__body">
                        <span className="food-card__name">{food.name}</span>
                        <span className="food-card__desc">{food.description}</span>
                        <div className="row-between" style={{ marginTop: 'auto' }}>
                          <span className="mono" style={{ fontWeight: 700 }}>
                            {vnd(Number(food.price))}
                          </span>
                          <div className="qty">
                            <button
                              type="button"
                              className="qty__btn"
                              aria-label={`Bớt ${food.name}`}
                              disabled={qty === 0}
                              onClick={() => bump(food.foodId, -1)}
                            >
                              −
                            </button>
                            <span className="qty__n">{qty}</span>
                            <button
                              type="button"
                              className="qty__btn qty__btn--add"
                              aria-label={`Thêm ${food.name}`}
                              onClick={() => bump(food.foodId, 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---- Vouchers ---- */}
          <section className="stack" style={{ gap: 14 }}>
            <h2 className="section-title">Voucher</h2>

            {vouchers.isLoading ? (
              <Loading inline />
            ) : vouchers.isError ? (
              <ErrorState error={vouchers.error} onRetry={() => void vouchers.refetch()} />
            ) : (vouchers.data?.length ?? 0) === 0 ? (
              <EmptyState title="Chưa có voucher" description="Bạn chưa có voucher khả dụng nào." />
            ) : (
              <div className="voucher-grid">
                {vouchers.data?.map((voucher) => {
                  const usable = isUsable(voucher, orderTotal);
                  const picked = voucherId === voucher.voucherId;
                  return (
                    <button
                      type="button"
                      className="voucher"
                      key={voucher.voucherId}
                      data-picked={picked}
                      data-usable={usable}
                      disabled={!usable}
                      onClick={() => setVoucherId(picked ? null : voucher.voucherId)}
                    >
                      <div
                        className="voucher__stub"
                        style={{ background: usable ? 'var(--accent)' : 'var(--ink-6)' }}
                      >
                        <span className="voucher__big">
                          {voucher.type === 'PERCENT'
                            ? `${voucher.value}%`
                            : `${Math.round(voucher.value / 1000)}K`}
                        </span>
                        <span className="voucher__unit">
                          {voucher.type === 'PERCENT' && voucher.maxDiscount
                            ? `TỐI ĐA ${Math.round(voucher.maxDiscount / 1000)}K`
                            : 'GIẢM'}
                        </span>
                      </div>
                      <div className="voucher__body">
                        <div className="row-between">
                          <span className="voucher__code">{voucher.code}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                            {picked ? 'Đang áp dụng' : usable ? 'Chọn' : 'Không đủ điều kiện'}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {voucher.minOrderValue
                            ? `Đơn từ ${vnd(voucher.minOrderValue)}`
                            : 'Không yêu cầu giá trị tối thiểu'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>
                          HSD {ddmmyyyy(voucher.expiredAt)} · còn{' '}
                          {Math.max(0, voucher.quantity - voucher.usedCount)} lượt
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <span className="note">
              Mỗi đơn dùng tối đa một voucher. Voucher không được hoàn lại khi hủy vé đã thanh toán.
            </span>
          </section>
        </div>

        {/* ---- Order summary ---- */}
        <aside className="summary">
          <div className="summary__deadline">
            <span style={{ fontWeight: 500 }}>Booking được giữ 15 phút sau khi tạo</span>
          </div>

          <div className="stack" style={{ gap: 4 }}>
            <span className="summary__title">
              {context ? `${context.movieTitle} · ${context.format}` : `Suất #${showtimeId}`}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
              {context
                ? `${context.cinemaName} · ${context.roomName} · ${hhmm(context.startTime)} ${dowDate(
                    context.startTime,
                  )}`
                : '—'}
            </span>
          </div>

          <div className="summary__lines">
            <div className="summary__line">
              <span style={{ color: 'var(--ink-4)' }}>Vé · {draft.seatNames.join(', ')}</span>
              <span>{vnd(seatTotal)}</span>
            </div>
            <div className="summary__line">
              <span style={{ color: 'var(--ink-4)' }}>Bắp nước</span>
              <span>{vnd(foodTotal)}</span>
            </div>
            <div className="summary__line">
              <span style={{ color: 'var(--ink-4)' }}>
                Voucher {selectedVoucher ? selectedVoucher.code : '(chưa chọn)'}
              </span>
              <span style={{ color: 'var(--ok)' }}>−{vnd(voucherDiscount)}</span>
            </div>
          </div>

          <div className="summary__total">
            <span style={{ fontSize: 14, color: 'var(--ink-4)' }}>Tạm tính</span>
            <span className="summary__grand">{vnd(estimatedGrand)}</span>
          </div>

          <div className="stack" style={{ gap: 8 }}>
            <span className="kicker">PHƯƠNG THỨC</span>
            <div className="pay-methods">
              {PAYMENT_METHODS.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className="pay-method"
                  data-active={method === option.value}
                  onClick={() => setMethod(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Button size="lg" block loading={pay.isPending} onClick={() => pay.mutate()}>
            Thanh toán qua {PAYMENT_METHODS.find((option) => option.value === method)?.label}
          </Button>

          <span className="note">
            Số tiền cuối do hệ thống xác nhận — các con số ở trên là tạm tính. Vé chỉ được phát hành sau khi cổng
            thanh toán xác nhận giao dịch.
          </span>
        </aside>
      </div>
    </div>
  );
}
