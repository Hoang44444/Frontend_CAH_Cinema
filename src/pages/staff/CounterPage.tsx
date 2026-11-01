import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cinemaApi, foodApi, showtimeApi, seatApi, staffApi } from '@/api/endpoints';
import type {
  BookingPaymentMethod,
  CustomerLookupResponseDTO,
  CustomerType,
  SeatDTO,
} from '@/api/types';
import { SeatMap } from '@/components/seat/SeatMap';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Input,
  Loading,
  RankBadge,
  Segmented,
  describeError,
} from '@/components/ui';
import { hhmm, isoDate, startOfToday, vnd } from '@/lib/format';
import { estimateSeatTotal, seatName } from '@/lib/seatmap';
import { useToast } from '@/store/toast';
import './staff.css';

const METHODS: Array<{ value: BookingPaymentMethod; label: string }> = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'VNPAY', label: 'VNPay QR' },
  { value: 'MOMO', label: 'MoMo' },
];

/** 4a — counter sales: pick a showtime, pick seats, take payment. */
export default function CounterPage() {
  const toast = useToast();

  const [cinemaId, setCinemaId] = useState<number | null>(null);
  const [showtimeId, setShowtimeId] = useState<number | null>(null);
  const [selected, setSelected] = useState<SeatDTO[]>([]);
  const [customerType, setCustomerType] = useState<CustomerType>('WALK_IN');
  const [method, setMethod] = useState<BookingPaymentMethod>('CASH');
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  // Walk-in contact details
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Member lookup
  const [lookupEmail, setLookupEmail] = useState('');
  const [member, setMember] = useState<CustomerLookupResponseDTO | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const today = useMemo(() => isoDate(startOfToday()), []);

  const cinemas = useQuery({ queryKey: ['cinemas'], queryFn: cinemaApi.list });

  useEffect(() => {
    if (cinemaId === null && cinemas.data?.length) setCinemaId(cinemas.data[0].cinemaId);
  }, [cinemas.data, cinemaId]);

  const schedule = useQuery({
    queryKey: ['showtimes', 'cinema', cinemaId, today],
    queryFn: () => showtimeApi.byCinema(cinemaId!, today),
    enabled: cinemaId !== null,
  });

  // Flatten the cinema's day into one chronological list of showtimes.
  // The response nests showtimes under each movie, so de-duplicate by
  // showtimeId — a showtime belongs to exactly one movie, and repeating one
  // would collide on the React key and render the row twice.
  const shows = useMemo(() => {
    const byId = new Map<
      number,
      {
        showtimeId: number;
        movieTitle: string;
        startTime: string;
        endTime: string;
        roomName: string;
        format: string;
        basePrice: number;
        status: string;
      }
    >();
    for (const entry of schedule.data?.movies ?? []) {
      for (const show of entry.showtimes) {
        if (byId.has(show.showtimeId)) continue;
        byId.set(show.showtimeId, {
          showtimeId: show.showtimeId,
          movieTitle: entry.movie.title,
          startTime: show.startTime,
          endTime: show.endTime,
          roomName: show.roomName,
          format: show.format,
          basePrice: Number(show.basePrice),
          status: show.status,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [schedule.data]);

  useEffect(() => {
    if (showtimeId === null && shows.length) setShowtimeId(shows[0].showtimeId);
  }, [shows, showtimeId]);

  const current = shows.find((show) => show.showtimeId === showtimeId) ?? null;

  const seats = useQuery({
    queryKey: ['seats', showtimeId],
    queryFn: () => seatApi.byShowtime(showtimeId!),
    enabled: showtimeId !== null,
  });

  const foods = useQuery({ queryKey: ['foods'], queryFn: foodApi.list });

  // Reset the basket whenever the showtime changes.
  useEffect(() => {
    setSelected([]);
  }, [showtimeId]);

  const seatTotal = estimateSeatTotal(current?.basePrice ?? 0, selected);
  const foodTotal = (foods.data ?? []).reduce(
    (sum, food) => sum + Number(food.price) * (quantities[food.foodId] ?? 0),
    0,
  );

  const lookup = useMutation({
    mutationFn: (email: string) => staffApi.lookupCustomer(email),
    onSuccess: (data) => {
      setMember(data);
      setLookupError(null);
    },
    onError: (error) => {
      setMember(null);
      setLookupError(describeError(error));
    },
  });

  function bump(foodId: number, delta: number) {
    setQuantities((current) => {
      const next = Math.max(0, Math.min(99, (current[foodId] ?? 0) + delta));
      const copy = { ...current };
      if (next === 0) delete copy[foodId];
      else copy[foodId] = next;
      return copy;
    });
  }

  function resetOrder() {
    setSelected([]);
    setQuantities({});
    setContactName('');
    setContactPhone('');
    setContactEmail('');
    setLookupEmail('');
    setMember(null);
  }

  /**
   * Creates the counter booking. For cash the sale is settled immediately with
   * confirm-payment; the QR gateways stay PENDING until their IPN lands.
   */
  const createOrder = useMutation({
    mutationFn: async () => {
      if (!showtimeId) throw new Error('Chưa chọn suất chiếu.');
      if (selected.length === 0) throw new Error('Chưa chọn ghế.');
      if (customerType === 'REGISTERED' && !member) {
        throw new Error('Chưa tra được khách thành viên. Nhập email và bấm Tìm.');
      }

      const booking = await staffApi.createBooking({
        showtimeId,
        customerType,
        customerId: customerType === 'REGISTERED' ? member!.userId : null,
        contactName: customerType === 'WALK_IN' ? contactName.trim() || null : member!.name,
        contactEmail: customerType === 'WALK_IN' ? contactEmail.trim() || null : member!.email,
        contactPhone: customerType === 'WALK_IN' ? contactPhone.trim() || null : member!.phone,
        seatIds: selected.map((seat) => seat.seatId),
        paymentMethod: method,
        foodItems: Object.entries(quantities).map(([foodId, quantity]) => ({
          foodId: Number(foodId),
          quantity,
        })),
      });

      if (method === 'CASH') {
        await staffApi.confirmPayment(booking.bookingId, {
          paymentRef: `CASH-${booking.bookingId}-${Date.now()}`,
          gateway: 'CASH',
        });
        return { booking, settled: true };
      }

      return { booking, settled: false };
    },
    onSuccess: ({ booking, settled }) => {
      toast.success(
        settled
          ? `Đã thu ${vnd(booking.totalAmount)} — booking #${booking.bookingId} đã thanh toán.`
          : `Đã tạo booking #${booking.bookingId} (${vnd(booking.totalAmount)}). Chờ khách thanh toán qua ${method}.`,
      );
      resetOrder();
      void seats.refetch();
    },
    onError: (error) => toast.error(error),
  });

  return (
    <div className="staff-counter">
      {/* ---- Today's showtimes ---- */}
      <div className="staff-pane-left">
        <div className="counter-shows">
          <span className="display" style={{ fontSize: 24, fontWeight: 800 }}>
            Suất hôm nay
          </span>
          <select
            className="input input--sm"
            value={cinemaId ?? ''}
            onChange={(event) => {
              setCinemaId(Number(event.target.value));
              setShowtimeId(null);
            }}
            aria-label="Chọn rạp"
          >
            {cinemas.data?.map((cinema) => (
              <option key={cinema.cinemaId} value={cinema.cinemaId}>
                {cinema.name}
              </option>
            ))}
          </select>
        </div>

        <div className="counter-shows__list">
          {schedule.isLoading ? (
            <Loading inline />
          ) : schedule.isError ? (
            <ErrorState error={schedule.error} onRetry={() => void schedule.refetch()} />
          ) : shows.length === 0 ? (
            <EmptyState title="Không có suất hôm nay" description="Rạp này chưa có suất chiếu trong ngày." />
          ) : (
            shows.map((show) => (
              <button
                type="button"
                className="show-row"
                key={show.showtimeId}
                data-active={show.showtimeId === showtimeId}
                onClick={() => setShowtimeId(show.showtimeId)}
              >
                <span className="show-row__time">{hhmm(show.startTime)}</span>
                <span className="show-row__body">
                  <span className="show-row__movie">{show.movieTitle}</span>
                  <span className="show-row__room">
                    {show.roomName} · {show.format}
                  </span>
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)' }}>{show.status}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ---- Seat map ---- */}
      <div className="counter-stage">
        <div className="counter-stage__head">
          <div className="stack" style={{ gap: 2 }}>
            <span className="counter-stage__title">
              {current ? `${current.movieTitle} · ${current.format}` : 'Chọn một suất'}
            </span>
            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
              {current
                ? `${current.roomName} · ${hhmm(current.startTime)} – ${hhmm(current.endTime)}`
                : 'Danh sách suất chiếu ở cột bên trái'}
            </span>
          </div>
          <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Ghế giữ 5 phút</span>
        </div>

        {showtimeId === null ? null : seats.isLoading ? (
          <Loading label="Đang tải sơ đồ ghế…" />
        ) : seats.isError ? (
          <ErrorState error={seats.error} onRetry={() => void seats.refetch()} />
        ) : (
          <SeatMap
            seats={seats.data}
            selectedIds={selected.map((seat) => seat.seatId)}
            onToggle={(seat) =>
              setSelected((current) =>
                current.some((picked) => picked.seatId === seat.seatId)
                  ? current.filter((picked) => picked.seatId !== seat.seatId)
                  : [...current, seat],
              )
            }
            size={32}
            gap={6}
            screenWidth={520}
            basePrice={current?.basePrice}
            disabled={createOrder.isPending}
          />
        )}
      </div>

      {/* ---- Order panel ---- */}
      <aside className="staff-pane-right">
        <Segmented<CustomerType>
          accent
          value={customerType}
          onChange={setCustomerType}
          options={[
            { value: 'WALK_IN', label: 'Khách vãng lai' },
            { value: 'REGISTERED', label: 'Thành viên' },
          ]}
        />

        {customerType === 'REGISTERED' ? (
          <div className="stack" style={{ gap: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Input
                small
                type="email"
                placeholder="email@khach.com"
                value={lookupEmail}
                onChange={(event) => setLookupEmail(event.target.value)}
                aria-label="Email khách thành viên"
              />
              <Button
                variant="outline"
                size="xs"
                style={{ flex: 'none', height: 42 }}
                loading={lookup.isPending}
                onClick={() => lookup.mutate(lookupEmail.trim())}
              >
                Tìm
              </Button>
            </div>
            {member ? (
              <div className="member-card">
                <Avatar name={member.name} size={32} />
                <div className="stack" style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{member.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{member.phone ?? member.email}</span>
                </div>
                <RankBadge rank={member.rankLevel} />
              </div>
            ) : (
              lookupError && <span className="field__error">{lookupError}</span>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input
              small
              placeholder="Tên khách (tùy chọn)"
              style={{ gridColumn: 'span 2' }}
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              aria-label="Tên khách"
            />
            <Input
              small
              placeholder="Số điện thoại"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              aria-label="Số điện thoại"
            />
            <Input
              small
              type="email"
              placeholder="Email nhận vé"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              aria-label="Email nhận vé"
            />
          </div>
        )}

        {/* Food */}
        <div className="stack" style={{ gap: 8 }}>
          <span className="kicker">BẮP NƯỚC</span>
          {foods.isLoading ? (
            <Loading inline />
          ) : (foods.data?.length ?? 0) === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--ink-5)' }}>Không có món khả dụng.</span>
          ) : (
            <div className="stack" style={{ gap: 8, maxHeight: 220, overflowY: 'auto' }}>
              {foods.data?.map((food) => (
                <div className="food-line" key={food.foodId}>
                  <span className="grow">{food.name}</span>
                  <span style={{ color: 'var(--ink-4)' }}>{vnd(Number(food.price))}</span>
                  <button
                    type="button"
                    className="food-line__qty"
                    aria-label={`Bớt ${food.name}`}
                    disabled={!quantities[food.foodId]}
                    onClick={() => bump(food.foodId, -1)}
                  >
                    −
                  </button>
                  <span className="mono" style={{ fontWeight: 700, width: 12, textAlign: 'center' }}>
                    {quantities[food.foodId] ?? 0}
                  </span>
                  <button
                    type="button"
                    className="food-line__qty food-line__qty--add"
                    aria-label={`Thêm ${food.name}`}
                    onClick={() => bump(food.foodId, 1)}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment method */}
        <div className="stack" style={{ gap: 8 }}>
          <span className="kicker">THANH TOÁN</span>
          <div className="pay-methods">
            {METHODS.map((option) => (
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

        <div className="grow" />

        <div className="counter-total">
          <div className="counter-total__row">
            <span style={{ color: 'var(--ink-4)' }}>
              Ghế {selected.length ? selected.map(seatName).join(', ') : '—'}
            </span>
            <span>{vnd(seatTotal)}</span>
          </div>
          <div className="counter-total__row">
            <span style={{ color: 'var(--ink-4)' }}>Bắp nước</span>
            <span>{vnd(foodTotal)}</span>
          </div>
          <div className="counter-total__row" style={{ alignItems: 'baseline', marginTop: 4 }}>
            <span style={{ fontWeight: 600 }}>Tạm tính</span>
            <span className="counter-total__due">{vnd(seatTotal + foodTotal)}</span>
          </div>
          <span className="note">Số phải thu chính thức do backend trả về khi tạo đơn.</span>
        </div>

        <Button
          size="md"
          block
          style={{ height: 52, borderRadius: 12 }}
          disabled={selected.length === 0 || showtimeId === null}
          loading={createOrder.isPending}
          onClick={() => createOrder.mutate()}
        >
          {method === 'CASH' ? 'Tạo đơn & thu tiền mặt' : 'Tạo đơn & hiện mã thanh toán'}
        </Button>
      </aside>
    </div>
  );
}
