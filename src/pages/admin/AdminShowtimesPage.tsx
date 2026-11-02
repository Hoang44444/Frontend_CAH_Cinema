import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { cinemaApi, movieApi, showtimeApi } from '@/api/endpoints';
import type { MovieFormat, ShowtimeDetailDTO, ShowtimeStatus } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import { Button, EmptyState, ErrorState, Field, Input, Loading, Modal } from '@/components/ui';
import { addDays, dowDateLong, hhmm, isoDate, parseLocal, startOfToday, vnd } from '@/lib/format';
import { useToast } from '@/store/toast';
import './admin.css';

/** The timeline covers 09:00–23:59, matching the design's 15 hour columns. */
const START_HOUR = 9;
const HOURS = 15;
const TOTAL_MINUTES = HOURS * 60;

const FORMATS: MovieFormat[] = ['2D', '3D', 'IMAX'];
const STATUSES: ShowtimeStatus[] = ['AVAILABLE', 'SOLD_OUT', 'HIDDEN', 'CANCELLED'];

/** Colour a lane block by its showtime status. */
function blockStyle(status: string) {
  if (status === 'CANCELLED') {
    return { background: 'var(--accent-soft)', borderColor: 'var(--ink-6)', color: 'var(--ink-5)' };
  }
  if (status === 'CLOSED' || status === 'FINISHED') {
    return { background: 'var(--surface-muted)', borderColor: 'var(--line-strong)', color: 'var(--ink-4)' };
  }
  return { background: '#d9ccf0', borderColor: '#b7a6da', color: 'var(--ink)' };
}

/** Position a showtime inside the lane as left/width percentages. */
function lanePosition(show: ShowtimeDetailDTO) {
  const start = parseLocal(show.startTime);
  const end = parseLocal(show.endTime);
  if (!start || !end) return null;
  const startMinutes = (start.getHours() - START_HOUR) * 60 + start.getMinutes();
  const durationMinutes = Math.max(15, (end.getTime() - start.getTime()) / 60_000);
  const left = (startMinutes / TOTAL_MINUTES) * 100;
  const width = (durationMinutes / TOTAL_MINUTES) * 100;
  if (left + width < 0 || left > 100) return null;
  return { left: Math.max(0, left), width: Math.min(100 - Math.max(0, left), width) };
}

export default function AdminShowtimesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [cinemaId, setCinemaId] = useState<number | null>(null);
  const [date, setDate] = useState(() => isoDate(startOfToday()));
  const [editing, setEditing] = useState<ShowtimeDetailDTO | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [form, setForm] = useState({
    movieId: '',
    roomId: '',
    format: '2D' as MovieFormat,
    startTime: '',
    basePrice: '85000',
  });

  const [cancelForm, setCancelForm] = useState({ roomId: '', fromDate: date, toDate: date, reason: '' });

  const cinemas = useQuery({ queryKey: ['cinemas'], queryFn: cinemaApi.list });
  const movies = useQuery({
    queryKey: ['movies', 'all-for-showtime'],
    queryFn: () => movieApi.search({ page: 0, size: 100 }),
  });

  useEffect(() => {
    if (cinemaId === null && cinemas.data?.length) setCinemaId(cinemas.data[0].cinemaId);
  }, [cinemas.data, cinemaId]);

  const rooms = useQuery({
    queryKey: ['admin', 'rooms', cinemaId],
    queryFn: () => cinemaApi.rooms(cinemaId!),
    enabled: cinemaId !== null,
  });

  // One request per room: the admin endpoint is scoped to a single room.
  const roomSchedules = useQueries({
    queries: (rooms.data ?? []).map((room) => ({
      queryKey: ['admin', 'showtimes', room.roomId, date],
      queryFn: () => showtimeApi.adminByRoom(room.roomId, date),
    })),
  });

  const lanes = useMemo(
    () =>
      (rooms.data ?? []).map((room, index) => ({
        room,
        shows: roomSchedules[index]?.data ?? [],
        loading: roomSchedules[index]?.isLoading ?? false,
        error: roomSchedules[index]?.error,
      })),
    [rooms.data, roomSchedules],
  );

  function invalidateSchedules() {
    for (const room of rooms.data ?? []) {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'showtimes', room.roomId, date] });
    }
  }

  const create = useMutation({
    mutationFn: () =>
      showtimeApi.adminCreate({
        movieId: Number(form.movieId),
        roomId: Number(form.roomId),
        format: form.format,
        // datetime-local gives "yyyy-MM-ddTHH:mm"; the backend wants seconds.
        startTime: `${form.startTime}:00`,
        basePrice: Number(form.basePrice),
      }),
    onSuccess: () => {
      toast.success('Đã tạo suất chiếu.');
      setForm({ ...form, startTime: '' });
      invalidateSchedules();
    },
    onError: (error) => toast.error(error),
  });

  const update = useMutation({
    mutationFn: (show: ShowtimeDetailDTO) =>
      showtimeApi.adminUpdate({
        showtimeId: show.showtimeId,
        movieId: show.movieId,
        roomId: show.roomId,
        format: show.format as MovieFormat,
        startTime: show.startTime,
        basePrice: Number(show.basePrice),
        status: show.status,
      }),
    onSuccess: () => {
      toast.success('Đã cập nhật suất chiếu.');
      setEditing(null);
      invalidateSchedules();
    },
    onError: (error) => toast.error(error),
  });

  const remove = useMutation({
    mutationFn: (showtimeId: number) => showtimeApi.adminDelete(showtimeId),
    onSuccess: () => {
      toast.success('Đã xóa suất chiếu.');
      setEditing(null);
      invalidateSchedules();
    },
    onError: (error) => toast.error(error),
  });

  const cancelByRoom = useMutation({
    mutationFn: () =>
      showtimeApi.adminCancelByRoom({
        roomId: Number(cancelForm.roomId),
        fromDate: cancelForm.fromDate,
        toDate: cancelForm.toDate,
        reason: cancelForm.reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Đã hủy các suất trong khoảng đã chọn.');
      setCancelOpen(false);
      invalidateSchedules();
    },
    onError: (error) => toast.error(error),
  });

  const canCreate = form.movieId && form.roomId && form.startTime && Number(form.basePrice) > 0;

  return (
    <>
      <AdminTopbar
        title="Lịch chiếu"
        actions={
          <>
            <select
              className="input input--sm"
              style={{ width: 200, background: 'var(--surface)' }}
              value={cinemaId ?? ''}
              onChange={(event) => setCinemaId(Number(event.target.value))}
              aria-label="Chọn rạp"
            >
              {cinemas.data?.map((cinema) => (
                <option key={cinema.cinemaId} value={cinema.cinemaId}>
                  {cinema.name}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setCancelForm({ roomId: String(rooms.data?.[0]?.roomId ?? ''), fromDate: date, toDate: date, reason: '' });
                setCancelOpen(true);
              }}
            >
              Hủy theo phòng
            </Button>
          </>
        }
      />

      <div className="admin-split" style={{ ['--aside' as string]: '360px' }}>
        <div className="admin-split__main">
          <div className="row-between" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Button
                variant="outline"
                size="xs"
                aria-label="Ngày trước"
                onClick={() => setDate(isoDate(addDays(parseLocal(date)!, -1)))}
              >
                ‹
              </Button>
              <span style={{ fontWeight: 700, fontSize: 16, minWidth: 190, textAlign: 'center' }}>
                {dowDateLong(date)}
              </span>
              <Button
                variant="outline"
                size="xs"
                aria-label="Ngày sau"
                onClick={() => setDate(isoDate(addDays(parseLocal(date)!, 1)))}
              >
                ›
              </Button>
            </div>
            <Input
              small
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              style={{ width: 160, background: 'var(--surface)' }}
              aria-label="Chọn ngày"
            />
          </div>

          {rooms.isLoading ? (
            <Loading label="Đang tải phòng…" />
          ) : rooms.isError ? (
            <ErrorState error={rooms.error} onRetry={() => void rooms.refetch()} />
          ) : lanes.length === 0 ? (
            <EmptyState
              title="Rạp này chưa có phòng"
              description="Thêm phòng ở trang Rạp & phòng trước khi xếp lịch."
            />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div className="timeline">
                <div className="timeline__head">
                  <span />
                  <div
                    className="timeline__hours"
                    style={{ gridTemplateColumns: `repeat(${HOURS}, 1fr)` }}
                  >
                    {Array.from({ length: HOURS }, (_, index) => (
                      <span className="timeline__hour" key={index}>
                        {String(START_HOUR + index).padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                </div>

                {lanes.map(({ room, shows, loading, error }) => (
                  <div className="timeline__row" key={room.roomId}>
                    <div className="timeline__room">
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{room.roomName}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                        {loading ? 'đang tải…' : error ? 'lỗi tải' : `${shows.length} suất`}
                      </span>
                    </div>
                    <div
                      className="timeline__lane"
                      style={{
                        backgroundImage: `repeating-linear-gradient(90deg, var(--line) 0 1px, transparent 1px calc(100% / ${HOURS}))`,
                      }}
                    >
                      {shows.map((show) => {
                        const position = lanePosition(show);
                        if (!position) return null;
                        const style = blockStyle(show.status);
                        return (
                          <button
                            type="button"
                            key={show.showtimeId}
                            className="timeline__block"
                            style={{
                              left: `${position.left}%`,
                              width: `${position.width}%`,
                              background: style.background,
                              borderColor: style.borderColor,
                              color: style.color,
                            }}
                            onClick={() => setEditing(show)}
                            title={`${show.movieTitle} · ${hhmm(show.startTime)}–${hhmm(show.endTime)} · ${show.status}`}
                          >
                            <span className="timeline__block-title">{show.movieTitle}</span>
                            <span className="timeline__block-time">
                              {hhmm(show.startTime)}–{hhmm(show.endTime)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="legend-row">
            <span className="legend-row__item">
              <span className="legend-row__swatch" style={{ background: '#d9ccf0' }} />
              Đang mở bán
            </span>
            <span className="legend-row__item">
              <span
                className="legend-row__swatch"
                style={{ background: 'var(--accent-soft)', border: '1.5px dashed var(--ink-6)' }}
              />
              Đã hủy
            </span>
            <span className="legend-row__item">
              <span className="legend-row__swatch" style={{ background: 'var(--surface-muted)' }} />
              Đã đóng / kết thúc
            </span>
          </div>

          <span className="note">
            Khung giờ hiển thị {String(START_HOUR).padStart(2, '0')}:00–
            {String(START_HOUR + HOURS).padStart(2, '0')}:00. Backend tự tính{' '}
            <span className="mono">endTime</span> từ thời lượng phim, nên không cần nhập.
          </span>
        </div>

        {/* ---- Create form ---- */}
        <aside className="admin-split__aside">
          <span style={{ fontWeight: 700, fontSize: 16 }}>Thêm suất chiếu</span>

          <form
            className="stack"
            style={{ gap: 14, flex: 1 }}
            onSubmit={(event) => {
              event.preventDefault();
              if (canCreate) create.mutate();
            }}
          >
            <Field label="Phim *">
              <select
                className="input input--sm"
                required
                value={form.movieId}
                onChange={(event) => setForm({ ...form, movieId: event.target.value })}
              >
                <option value="">Chọn phim…</option>
                {movies.data?.content.map((movie) => (
                  <option key={movie.movieId} value={movie.movieId}>
                    {movie.title}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Phòng *">
              <select
                className="input input--sm"
                required
                value={form.roomId}
                onChange={(event) => setForm({ ...form, roomId: event.target.value })}
              >
                <option value="">Chọn phòng…</option>
                {rooms.data?.map((room) => (
                  <option key={room.roomId} value={room.roomId}>
                    {room.roomName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Định dạng *">
              <select
                className="input input--sm"
                value={form.format}
                onChange={(event) => setForm({ ...form, format: event.target.value as MovieFormat })}
              >
                {FORMATS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Bắt đầu *">
              <Input
                small
                type="datetime-local"
                required
                value={form.startTime}
                onChange={(event) => setForm({ ...form, startTime: event.target.value })}
              />
            </Field>

            <Field label="Giá gốc (đ) *" hint={`Hiện tại: ${vnd(Number(form.basePrice) || 0)}`}>
              <Input
                small
                type="number"
                min={1000}
                step={1000}
                required
                value={form.basePrice}
                onChange={(event) => setForm({ ...form, basePrice: event.target.value })}
              />
            </Field>

            <div className="grow" />

            <Button type="submit" size="sm" disabled={!canCreate} loading={create.isPending}>
              Tạo suất
            </Button>
          </form>
        </aside>
      </div>

      {/* ---- Edit / delete a showtime ---- */}
      <Modal open={editing !== null} onClose={() => setEditing(null)} width={520}>
        {editing && (
          <>
            <div className="row-between" style={{ alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: 4 }}>
                <span className="display" style={{ fontSize: 34 }}>
                  {editing.movieTitle}
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                  {editing.cinemaName} · {editing.roomName} · {editing.format} · {editing.status}
                </span>
              </div>
              <button type="button" className="modal__close" aria-label="Đóng" onClick={() => setEditing(null)}>
                ×
              </button>
            </div>

            <Field label="Bắt đầu">
              <Input
                small
                type="datetime-local"
                value={editing.startTime.slice(0, 16)}
                onChange={(event) =>
                  setEditing({ ...editing, startTime: `${event.target.value}:00` })
                }
              />
            </Field>

            <Field label="Giá gốc (đ)">
              <Input
                small
                type="number"
                min={1000}
                step={1000}
                value={String(editing.basePrice)}
                onChange={(event) => setEditing({ ...editing, basePrice: Number(event.target.value) })}
              />
            </Field>

            <Field label="Trạng thái">
              <select
                className="input input--sm"
                value={editing.status}
                onChange={(event) =>
                  setEditing({ ...editing, status: event.target.value as ShowtimeStatus })
                }
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>

            <span className="note">
              Kết thúc hiện tại: {hhmm(editing.endTime)}. Backend tính lại endTime từ thời lượng phim khi đổi giờ.
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Button
                variant="danger-outline"
                size="sm"
                loading={remove.isPending}
                onClick={() => {
                  if (window.confirm('Xóa suất chiếu này?')) remove.mutate(editing.showtimeId);
                }}
              >
                Xóa suất
              </Button>
              <Button size="sm" loading={update.isPending} onClick={() => update.mutate(editing)}>
                Lưu thay đổi
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* ---- Bulk cancel by room ---- */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} width={480}>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            cancelByRoom.mutate();
          }}
        >
          <span className="display" style={{ fontSize: 34 }}>
            Hủy suất theo phòng
          </span>

          <Field label="Phòng *">
            <select
              className="input input--sm"
              required
              value={cancelForm.roomId}
              onChange={(event) => setCancelForm({ ...cancelForm, roomId: event.target.value })}
            >
              <option value="">Chọn phòng…</option>
              {rooms.data?.map((room) => (
                <option key={room.roomId} value={room.roomId}>
                  {room.roomName}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Từ ngày *">
              <Input
                small
                type="date"
                required
                value={cancelForm.fromDate}
                onChange={(event) => setCancelForm({ ...cancelForm, fromDate: event.target.value })}
              />
            </Field>
            <Field label="Đến ngày *">
              <Input
                small
                type="date"
                required
                value={cancelForm.toDate}
                onChange={(event) => setCancelForm({ ...cancelForm, toDate: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Lý do">
            <Input
              small
              value={cancelForm.reason}
              onChange={(event) => setCancelForm({ ...cancelForm, reason: event.target.value })}
            />
          </Field>

          <div className="callout callout--danger">
            Booking <span className="mono">PENDING</span> sẽ bị hủy ngay; booking đã thanh toán sinh nghĩa vụ
            hoàn tiền. Thao tác này không thể hoàn tác.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button type="button" variant="outline" size="sm" onClick={() => setCancelOpen(false)}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              disabled={!cancelForm.roomId}
              loading={cancelByRoom.isPending}
            >
              Xác nhận hủy
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
