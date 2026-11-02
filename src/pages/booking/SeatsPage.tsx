import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { seatApi } from '@/api/endpoints';
import type { SeatDTO } from '@/api/types';
import { SeatMap } from '@/components/seat/SeatMap';
import { SiteHeader, Stepper } from '@/components/layout/SiteLayout';
import { Button, ErrorState, Loading, PosterBox, RatingBadge } from '@/components/ui';
import { dowDateLong, hhmm, mmss, vnd } from '@/lib/format';
import { estimateSeatTotal, seatName } from '@/lib/seatmap';
import { posterTint } from '@/lib/palette';
import { bookingDraftStore, showtimeContextStore } from '@/store/bookingDraft';
import { useToast } from '@/store/toast';
import './booking.css';

/** Seats are held in Redis for five minutes (BookingService's lock TTL). */
const HOLD_SECONDS = 5 * 60;
/** Refresh availability so other people's locks show up while picking. */
const POLL_MS = 15_000;

export default function SeatsPage() {
  const { showtimeId: param } = useParams();
  const showtimeId = Number(param);
  const navigate = useNavigate();
  const toast = useToast();

  const context = useMemo(() => showtimeContextStore.get(showtimeId), [showtimeId]);

  const [selected, setSelected] = useState<SeatDTO[]>([]);
  const [hold, setHold] = useState<number | null>(null);
  const [locking, setLocking] = useState(false);
  const holdRef = useRef<number | null>(null);

  const seats = useQuery({
    queryKey: ['seats', showtimeId],
    queryFn: () => seatApi.byShowtime(showtimeId),
    enabled: Number.isFinite(showtimeId),
    refetchInterval: POLL_MS,
  });

  const releaseAll = useCallback(
    (toRelease: SeatDTO[]) => {
      for (const seat of toRelease) {
        void seatApi.unlock(seat.seatId, showtimeId).catch(() => undefined);
      }
    },
    [showtimeId],
  );

  // Countdown on the Redis hold; when it runs out the locks are gone server-side.
  useEffect(() => {
    if (hold === null) return;
    if (hold <= 0) {
      setSelected((current) => {
        if (current.length) {
          toast.show('Hết thời gian giữ ghế. Vui lòng chọn lại.', 'error');
          releaseAll(current);
        }
        return [];
      });
      setHold(null);
      void seats.refetch();
      return;
    }
    const timer = window.setTimeout(() => setHold((current) => (current === null ? null : current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [hold, releaseAll, seats, toast]);

  holdRef.current = hold;

  // Drop locks if the tab is closed mid-selection so seats free up immediately.
  useEffect(() => {
    const onUnload = () => {
      for (const seat of selected) {
        void seatApi.unlock(seat.seatId, showtimeId).catch(() => undefined);
      }
    };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, [selected, showtimeId]);

  const lock = useMutation({
    mutationFn: (seat: SeatDTO) => seatApi.lock(seat.seatId, showtimeId),
  });

  async function toggle(seat: SeatDTO) {
    const isSelected = selected.some((picked) => picked.seatId === seat.seatId);

    if (isSelected) {
      setSelected((current) => current.filter((picked) => picked.seatId !== seat.seatId));
      try {
        await seatApi.unlock(seat.seatId, showtimeId);
      } catch {
        // The hold expires on its own; nothing to recover here.
      }
      if (selected.length === 1) setHold(null);
      return;
    }

    setLocking(true);
    try {
      await lock.mutateAsync(seat);
      setSelected((current) => [...current, seat]);
      // Start (or keep) the 5-minute window from the first successful lock.
      if (holdRef.current === null) setHold(HOLD_SECONDS);
    } catch (error) {
      toast.error(error);
      void seats.refetch();
    } finally {
      setLocking(false);
    }
  }

  // Mỗi ghế đã được lock ngay lúc bấm chọn. /seats/pre-lock là SETNX nên gọi lại
  // trên chính những ghế mình đang giữ thì luôn trả 400 "ghế đang được người khác
  // giữ" — nó dành cho việc lock một lô ghế chưa giữ. Quyền giữ ghế được backend
  // kiểm tra lại khi tạo booking (promoteLocksForCheckout), nên bước này chỉ cần
  // lưu nháp rồi đi tiếp.
  function continueToCheckout() {
    bookingDraftStore.save({
      showtimeId,
      seatIds: selected.map((seat) => seat.seatId),
      seatNames: selected.map(seatName),
      estimatedSeatTotal: estimateSeatTotal(context?.basePrice ?? 0, selected),
      context,
    });
    navigate(`/booking/showtimes/${showtimeId}/checkout`);
  }

  if (!Number.isFinite(showtimeId)) {
    return (
      <div className="screen">
        <SiteHeader center={<Stepper current={1} />} showCity={false} />
        <ErrorState error={new Error('Mã suất chiếu không hợp lệ.')} />
      </div>
    );
  }

  const seatTotal = estimateSeatTotal(context?.basePrice ?? 0, selected);

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      <SiteHeader center={<Stepper current={1} />} showCity={false} />

      <div className="seats-layout">
        <div className="seats-stage">
          {seats.isLoading ? (
            <Loading label="Đang tải sơ đồ ghế…" />
          ) : seats.isError ? (
            <ErrorState error={seats.error} onRetry={() => void seats.refetch()} />
          ) : (
            <SeatMap
              seats={seats.data}
              selectedIds={selected.map((seat) => seat.seatId)}
              onToggle={(seat) => void toggle(seat)}
              basePrice={context?.basePrice}
              disabled={locking}
            />
          )}
        </div>

        <aside className="booking-aside">
          <div className="booking-aside__movie">
            <PosterBox
              src={context?.moviePosterUrl}
              width={84}
              height={126}
              radius={10}
              background={posterTint(context?.movieId ?? showtimeId)}
              label=""
            />
            <div className="stack" style={{ gap: 8, minWidth: 0 }}>
              <span className="booking-aside__title">{context?.movieTitle ?? 'Suất chiếu'}</span>
              <span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--ink-3)' }}>
                <RatingBadge rating={context?.ageRating} />
                {context ? `${context.format} · ${hhmm(context.startTime)}` : `#${showtimeId}`}
              </span>
            </div>
          </div>

          <div className="booking-facts">
            <div className="booking-facts__item booking-facts__item--wide">
              <span className="booking-facts__k">Rạp</span>
              <span className="booking-facts__v">
                {context ? `${context.cinemaName} · ${context.roomName}` : '—'}
              </span>
            </div>
            <div className="booking-facts__item">
              <span className="booking-facts__k">Ngày</span>
              <span className="booking-facts__v">{context ? dowDateLong(context.startTime) : '—'}</span>
            </div>
            <div className="booking-facts__item">
              <span className="booking-facts__k">Suất</span>
              <span className="booking-facts__v">
                {context ? `${hhmm(context.startTime)} – ${hhmm(context.endTime)}` : '—'}
              </span>
            </div>
          </div>

          <div className="stack" style={{ gap: 10 }}>
            <span className="kicker">GHẾ ĐÃ CHỌN</span>
            {selected.length === 0 ? (
              <span style={{ fontSize: 13, color: 'var(--ink-5)' }}>
                Bấm vào ghế trên sơ đồ để chọn. Ghế được giữ 5 phút.
              </span>
            ) : (
              <div className="seat-chips">
                {selected.map((seat) => (
                  <button
                    type="button"
                    className="seat-chip"
                    key={seat.seatId}
                    onClick={() => void toggle(seat)}
                    title="Bỏ chọn ghế này"
                  >
                    <span className="seat-chip__name">{seatName(seat)}</span>
                    <span style={{ color: 'var(--ink-4)' }}>{seat.seatType?.typeName}</span>
                    <span style={{ color: 'var(--ink-6)' }}>×</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grow" />

          {hold !== null && (
            <div className="hold-bar">
              <span style={{ color: 'var(--ink-3)' }}>Giữ ghế còn</span>
              <span className="hold-bar__time">{mmss(hold)}</span>
            </div>
          )}

          <div className="subtotal">
            <span style={{ fontSize: 14, color: 'var(--ink-4)' }}>
              Tạm tính ({selected.length} ghế)
            </span>
            <span className="subtotal__amount">{vnd(seatTotal)}</span>
          </div>

          {!context && (
            <span className="note">
              Mở trang này trực tiếp nên chưa có thông tin suất. Giá hiển thị là 0đ; tổng tiền chính thức do
              backend trả về ở bước thanh toán.
            </span>
          )}

          <Button
            size="lg"
            block
            disabled={selected.length === 0}
            onClick={continueToCheckout}
          >
            Tiếp tục — bắp nước &amp; thanh toán
          </Button>
        </aside>
      </div>
    </div>
  );
}
