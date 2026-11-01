import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cinemaApi, seatApi } from '@/api/endpoints';
import type { CreateSeatDTO, SeatDTO, SeatTypeName } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
} from '@/components/ui';
import { SEAT_TYPE_VI } from '@/lib/seatmap';
import { useToast } from '@/store/toast';
import '@/components/seat/seatmap.css';
import './admin.css';

/** Brush styling, matching the design's seat-type palette. */
const BRUSHES: Array<{ type: SeatTypeName; border: string; fill: string; style: 'solid' | 'dashed' | 'dotted' }> =
  [
    { type: 'NORMAL', border: 'var(--seat-normal)', fill: 'transparent', style: 'solid' },
    { type: 'VIP', border: 'var(--seat-vip)', fill: 'transparent', style: 'solid' },
    { type: 'COUPLE', border: 'var(--seat-couple)', fill: 'transparent', style: 'solid' },
    { type: 'AISLE', border: 'var(--line)', fill: 'transparent', style: 'dotted' },
  ];

const ROWS = 8;
const COLS = 12;

/** The grid the editor edits: "row,col" -> seat type name. */
type Grid = Map<string, SeatTypeName>;

function key(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Builds the editable grid from the room's current seats. Rows/cols are the
 * backend's raw integer coordinates (A=1, B=2, ...).
 */
function gridFromSeats(seats: SeatDTO[]): Grid {
  const grid: Grid = new Map();
  for (const seat of seats) {
    const row = Math.trunc(Number(seat.row));
    const col = Math.trunc(Number(seat.col));
    if (!Number.isInteger(Number(seat.row)) || !Number.isInteger(Number(seat.col))) continue;
    grid.set(key(row, col), (seat.seatType?.typeName as SeatTypeName) ?? 'NORMAL');
  }
  return grid;
}

function defaultGrid(): Grid {
  const grid: Grid = new Map();
  for (let row = 1; row <= ROWS; row += 1) {
    for (let col = 1; col <= COLS; col += 1) {
      // Rows D–G are VIP and the back row is couple seating, as in the design.
      const type: SeatTypeName = row === ROWS ? 'COUPLE' : row >= 4 && row <= 7 ? 'VIP' : 'NORMAL';
      grid.set(key(row, col), type);
    }
  }
  return grid;
}

export default function AdminCinemasPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [cinemaId, setCinemaId] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [brush, setBrush] = useState<SeatTypeName>('VIP');
  const [grid, setGrid] = useState<Grid>(() => new Map());
  const [dirty, setDirty] = useState(false);

  const [cinemaModal, setCinemaModal] = useState<'create' | 'edit' | null>(null);
  const [cinemaForm, setCinemaForm] = useState({ name: '', address: '', hotline: '', imageUrl: '' });
  const [roomModal, setRoomModal] = useState<'create' | 'edit' | null>(null);
  const [roomName, setRoomName] = useState('');

  const cinemas = useQuery({ queryKey: ['cinemas'], queryFn: cinemaApi.list });

  useEffect(() => {
    if (cinemaId === null && cinemas.data?.length) setCinemaId(cinemas.data[0].cinemaId);
  }, [cinemas.data, cinemaId]);

  const rooms = useQuery({
    queryKey: ['admin', 'rooms', cinemaId],
    queryFn: () => cinemaApi.rooms(cinemaId!),
    enabled: cinemaId !== null,
  });

  useEffect(() => {
    if (rooms.data?.length) {
      if (!rooms.data.some((room) => room.roomId === roomId)) setRoomId(rooms.data[0].roomId);
    } else if (rooms.data) {
      setRoomId(null);
    }
  }, [rooms.data, roomId]);

  const seats = useQuery({
    queryKey: ['admin', 'seats', roomId],
    queryFn: () => seatApi.adminByRoom(roomId!),
    enabled: roomId !== null,
  });

  // Reset the working grid whenever a different room's seats arrive.
  useEffect(() => {
    if (seats.data) {
      setGrid(seats.data.length ? gridFromSeats(seats.data) : defaultGrid());
      setDirty(false);
    }
  }, [seats.data]);

  /**
   * Seat type ids are database rows, so they are read off the room's existing
   * seats rather than hard-coded. A room with no seats yet has nothing to read,
   * which is surfaced to the admin instead of guessing ids.
   */
  const seatTypeIds = useMemo(() => {
    const map = new Map<string, number>();
    for (const seat of seats.data ?? []) {
      const name = seat.seatType?.typeName;
      if (name && !map.has(name)) map.set(name, seat.seatType.seatTypeId);
    }
    return map;
  }, [seats.data]);

  const missingTypes = useMemo(() => {
    const used = new Set([...grid.values()]);
    return [...used].filter((type) => !seatTypeIds.has(type));
  }, [grid, seatTypeIds]);

  const seatCount = useMemo(
    () => [...grid.values()].filter((type) => type !== 'AISLE').length,
    [grid],
  );

  function paint(row: number, col: number) {
    setGrid((current) => {
      const next = new Map(current);
      next.set(key(row, col), brush);
      return next;
    });
    setDirty(true);
  }

  const saveSeatMap = useMutation({
    mutationFn: () => {
      if (roomId === null) throw new Error('Chưa chọn phòng.');
      if (missingTypes.length > 0) {
        throw new Error(
          `Không xác định được seatTypeId cho: ${missingTypes.join(', ')}. Phòng này cần có sẵn ít nhất một ghế mỗi loại để lấy id.`,
        );
      }
      const seatsPayload: CreateSeatDTO[] = [];
      for (let row = 1; row <= ROWS; row += 1) {
        for (let col = 1; col <= COLS; col += 1) {
          const type = grid.get(key(row, col));
          if (!type) continue;
          seatsPayload.push({ roomId, row, col, seatTypeId: seatTypeIds.get(type)! });
        }
      }
      return seatApi.adminReplace({ roomId, seats: seatsPayload });
    },
    onSuccess: () => {
      toast.success('Đã lưu sơ đồ ghế.');
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'seats', roomId] });
    },
    onError: (error) => toast.error(error),
  });

  /* ---- Cinema CRUD ---- */

  const saveCinema = useMutation({
    mutationFn: () => {
      const payload = {
        name: cinemaForm.name.trim(),
        address: cinemaForm.address.trim(),
        hotline: cinemaForm.hotline.trim() || null,
        imageUrl: cinemaForm.imageUrl.trim() || null,
      };
      return cinemaModal === 'create'
        ? cinemaApi.adminCreate(payload)
        : cinemaApi.adminUpdate(cinemaId!, payload);
    },
    onSuccess: (saved) => {
      toast.success(cinemaModal === 'create' ? 'Đã thêm rạp.' : 'Đã lưu thông tin rạp.');
      setCinemaModal(null);
      setCinemaId(saved.cinemaId);
      void queryClient.invalidateQueries({ queryKey: ['cinemas'] });
    },
    onError: (error) => toast.error(error),
  });

  const removeCinema = useMutation({
    mutationFn: (id: number) => cinemaApi.adminDelete(id),
    onSuccess: () => {
      toast.success('Đã xóa rạp.');
      setCinemaId(null);
      void queryClient.invalidateQueries({ queryKey: ['cinemas'] });
    },
    onError: (error) => toast.error(error),
  });

  /* ---- Room CRUD ---- */

  const saveRoom = useMutation({
    mutationFn: () =>
      roomModal === 'create'
        ? cinemaApi.createRoom(cinemaId!, roomName.trim())
        : cinemaApi.updateRoom(roomId!, roomName.trim()),
    onSuccess: (saved) => {
      toast.success(roomModal === 'create' ? 'Đã thêm phòng.' : 'Đã đổi tên phòng.');
      setRoomModal(null);
      setRoomId(saved.roomId);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rooms', cinemaId] });
    },
    onError: (error) => toast.error(error),
  });

  const removeRoom = useMutation({
    mutationFn: (id: number) => cinemaApi.deleteRoom(id),
    onSuccess: () => {
      toast.success('Đã xóa phòng.');
      setRoomId(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'rooms', cinemaId] });
    },
    onError: (error) => toast.error(error),
  });

  const currentCinema = cinemas.data?.find((cinema) => cinema.cinemaId === cinemaId);
  const currentRoom = rooms.data?.find((room) => room.roomId === roomId);

  return (
    <>
      <AdminTopbar
        title="Rạp, phòng & sơ đồ ghế"
        actions={
          <>
            <Button
              size="xs"
              variant="outline"
              disabled={!currentCinema}
              onClick={() => {
                if (!currentCinema) return;
                setCinemaForm({
                  name: currentCinema.name,
                  address: currentCinema.address,
                  hotline: currentCinema.hotline ?? '',
                  imageUrl: currentCinema.imageUrl ?? '',
                });
                setCinemaModal('edit');
              }}
            >
              Sửa rạp
            </Button>
            <Button
              size="xs"
              onClick={() => {
                setCinemaForm({ name: '', address: '', hotline: '', imageUrl: '' });
                setCinemaModal('create');
              }}
            >
              + Thêm rạp
            </Button>
          </>
        }
      />

      <div className="rooms-split">
        {/* ---- Cinema list ---- */}
        <div className="rooms-side">
          {cinemas.isLoading ? (
            <Loading inline />
          ) : cinemas.isError ? (
            <ErrorState error={cinemas.error} onRetry={() => void cinemas.refetch()} />
          ) : (cinemas.data?.length ?? 0) === 0 ? (
            <EmptyState title="Chưa có rạp" description="Bấm “Thêm rạp” để tạo rạp đầu tiên." />
          ) : (
            cinemas.data?.map((cinema) => (
              <button
                type="button"
                key={cinema.cinemaId}
                className="cinema-item"
                data-active={cinema.cinemaId === cinemaId}
                onClick={() => {
                  setCinemaId(cinema.cinemaId);
                  setRoomId(null);
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{cinema.name}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{cinema.address}</span>
              </button>
            ))
          )}

          {currentCinema && (
            <Button
              variant="danger-outline"
              size="xs"
              style={{ marginTop: 'auto' }}
              loading={removeCinema.isPending}
              onClick={() => {
                if (window.confirm(`Xóa rạp "${currentCinema.name}"?`)) removeCinema.mutate(currentCinema.cinemaId);
              }}
            >
              Xóa rạp này
            </Button>
          )}
        </div>

        {/* ---- Rooms + seat map editor ---- */}
        <div className="rooms-main">
          <div className="row-between" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {rooms.isLoading ? (
                <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>Đang tải phòng…</span>
              ) : (
                rooms.data?.map((room) => (
                  <button
                    type="button"
                    key={room.roomId}
                    className="room-tab"
                    data-active={room.roomId === roomId}
                    onClick={() => setRoomId(room.roomId)}
                  >
                    {room.roomName}
                  </button>
                ))
              )}
              <button
                type="button"
                className="room-tab room-tab--add"
                disabled={cinemaId === null}
                onClick={() => {
                  setRoomName('');
                  setRoomModal('create');
                }}
              >
                + Phòng
              </button>
              {currentRoom && (
                <>
                  <button
                    type="button"
                    className="room-tab"
                    onClick={() => {
                      setRoomName(currentRoom.roomName);
                      setRoomModal('edit');
                    }}
                  >
                    Đổi tên
                  </button>
                  <button
                    type="button"
                    className="room-tab"
                    style={{ color: 'var(--danger-ink)', borderColor: 'var(--danger-line)' }}
                    onClick={() => {
                      if (window.confirm(`Xóa phòng "${currentRoom.roomName}"?`)) removeRoom.mutate(currentRoom.roomId);
                    }}
                  >
                    Xóa phòng
                  </button>
                </>
              )}
            </div>
            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
              {seatCount} ghế · {ROWS} hàng × {COLS} cột
            </span>
          </div>

          {roomId === null ? (
            <EmptyState title="Chưa chọn phòng" description="Chọn hoặc thêm một phòng để sửa sơ đồ ghế." />
          ) : seats.isLoading ? (
            <Loading label="Đang tải sơ đồ ghế…" />
          ) : seats.isError ? (
            <ErrorState error={seats.error} onRetry={() => void seats.refetch()} />
          ) : (
            <>
              {/* Brush bar */}
              <div className="brush-bar">
                <span className="brush-bar__kicker">CỌ VẼ</span>
                {BRUSHES.map((item) => (
                  <button
                    type="button"
                    key={item.type}
                    className="brush"
                    data-active={brush === item.type}
                    onClick={() => setBrush(item.type)}
                  >
                    <span
                      className="brush__swatch"
                      style={{ borderColor: item.border, borderStyle: item.style, background: item.fill }}
                    />
                    {SEAT_TYPE_VI[item.type]}
                  </button>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--ink-4)', paddingRight: 6 }}>
                  Bấm vào ô để tô
                </span>
              </div>

              {/* Grid */}
              <div className="seat-editor">
                <div className="seat-editor__screen" />
                {Array.from({ length: ROWS }, (_, rowIndex) => {
                  const row = rowIndex + 1;
                  return (
                    <div className="seat-editor__row" key={row}>
                      <span className="seat-editor__rowlabel">{String.fromCharCode(64 + row)}</span>
                      {Array.from({ length: COLS }, (_, colIndex) => {
                        const col = colIndex + 1;
                        const type = grid.get(key(row, col)) ?? 'NORMAL';
                        const brushStyle = BRUSHES.find((item) => item.type === type) ?? BRUSHES[0];
                        return (
                          <span key={col} style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              className="seat-editor__cell"
                              aria-label={`Hàng ${String.fromCharCode(64 + row)} cột ${col} — ${SEAT_TYPE_VI[type]}`}
                              title={SEAT_TYPE_VI[type]}
                              onClick={() => paint(row, col)}
                              style={{
                                borderColor: brushStyle.border,
                                borderStyle: brushStyle.style,
                                background: brushStyle.fill,
                              }}
                            >
                              {type === 'AISLE' ? '' : col}
                            </button>
                            {col === COLS / 2 && <span style={{ width: 16 }} />}
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              {missingTypes.length > 0 && (
                <div className="callout callout--danger">
                  Không có <span className="mono">seatTypeId</span> cho {missingTypes.join(', ')}. Backend không
                  cung cấp endpoint liệt kê loại ghế, nên id được đọc từ ghế hiện có của phòng — hãy giữ lại ít
                  nhất một ghế mỗi loại, hoặc thêm loại ghế đó qua SQL trước khi lưu.
                </div>
              )}

              <div className="callout callout--notice row-between" style={{ gap: 16, flexWrap: 'wrap' }}>
                <span style={{ textWrap: 'pretty' }}>
                  <b>Cảnh báo:</b> thay sơ đồ sẽ gọi <span className="mono">PUT /admin/seats/replace</span> và
                  có thể làm ghế đã bán ở các suất sắp tới không còn hợp lệ.
                </span>
                <Button
                  size="sm"
                  style={{ flex: 'none' }}
                  disabled={!dirty || missingTypes.length > 0}
                  loading={saveSeatMap.isPending}
                  onClick={() => saveSeatMap.mutate()}
                >
                  Lưu sơ đồ
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Cinema modal ---- */}
      <Modal open={cinemaModal !== null} onClose={() => setCinemaModal(null)} width={520}>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            saveCinema.mutate();
          }}
        >
          <span className="display" style={{ fontSize: 34 }}>
            {cinemaModal === 'create' ? 'Thêm rạp' : 'Sửa rạp'}
          </span>
          <Field label="Tên rạp *">
            <Input
              small
              required
              value={cinemaForm.name}
              onChange={(event) => setCinemaForm({ ...cinemaForm, name: event.target.value })}
            />
          </Field>
          <Field label="Địa chỉ *">
            <Input
              small
              required
              value={cinemaForm.address}
              onChange={(event) => setCinemaForm({ ...cinemaForm, address: event.target.value })}
            />
          </Field>
          <Field label="Hotline">
            <Input
              small
              value={cinemaForm.hotline}
              onChange={(event) => setCinemaForm({ ...cinemaForm, hotline: event.target.value })}
            />
          </Field>
          <Field label="Ảnh (URL)">
            <Input
              small
              value={cinemaForm.imageUrl}
              onChange={(event) => setCinemaForm({ ...cinemaForm, imageUrl: event.target.value })}
            />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button type="button" variant="outline" size="sm" onClick={() => setCinemaModal(null)}>
              Hủy
            </Button>
            <Button type="submit" size="sm" loading={saveCinema.isPending}>
              Lưu
            </Button>
          </div>
        </form>
      </Modal>

      {/* ---- Room modal ---- */}
      <Modal open={roomModal !== null} onClose={() => setRoomModal(null)} width={440}>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            saveRoom.mutate();
          }}
        >
          <span className="display" style={{ fontSize: 34 }}>
            {roomModal === 'create' ? 'Thêm phòng' : 'Đổi tên phòng'}
          </span>
          <Field label="Tên phòng *" hint="Ví dụ: Phòng 01 - Standard">
            <Input small required value={roomName} onChange={(event) => setRoomName(event.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button type="button" variant="outline" size="sm" onClick={() => setRoomModal(null)}>
              Hủy
            </Button>
            <Button type="submit" size="sm" loading={saveRoom.isPending}>
              Lưu
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
