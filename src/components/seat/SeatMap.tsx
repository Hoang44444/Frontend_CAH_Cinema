import type { SeatDTO } from '@/api/types';
import { SEAT_TYPE_VI, buildSeatMap } from '@/lib/seatmap';
import type { SeatCell, SeatState } from '@/lib/seatmap';
import { vnd } from '@/lib/format';
import './seatmap.css';

const TYPE_BORDER: Record<string, string> = {
  NORMAL: 'var(--seat-normal)',
  VIP: 'var(--seat-vip)',
  COUPLE: 'var(--seat-couple)',
};

interface SeatVisual {
  background: string;
  borderColor: string;
  borderStyle: 'solid' | 'dashed';
  color: string;
}

function visualFor(cell: SeatCell): SeatVisual {
  const typeBorder = TYPE_BORDER[cell.typeName] ?? 'var(--seat-normal)';
  switch (cell.state) {
    case 'selected':
      return { background: 'var(--accent)', borderColor: 'var(--accent)', borderStyle: 'solid', color: '#fff' };
    case 'sold':
      return {
        background: 'var(--surface-disabled)',
        borderColor: 'var(--surface-disabled)',
        borderStyle: 'solid',
        color: 'var(--ink-5)',
      };
    case 'locked':
      return {
        background: 'var(--held-hatch)',
        borderColor: 'var(--line-strong)',
        borderStyle: 'solid',
        color: 'var(--ink-5)',
      };
    case 'prepare':
      return {
        background: 'transparent',
        borderColor: 'var(--line-strong)',
        borderStyle: 'dashed',
        color: 'var(--ink-5)',
      };
    default:
      return { background: 'var(--surface)', borderColor: typeBorder, borderStyle: 'solid', color: 'var(--ink-5)' };
  }
}

const LABEL: Record<SeatState, string> = {
  available: 'còn trống',
  selected: 'đang chọn',
  sold: 'đã bán',
  locked: 'người khác đang giữ',
  prepare: 'đang bảo trì',
};

export interface SeatMapProps {
  seats: SeatDTO[] | undefined;
  selectedIds: number[];
  onToggle: (seat: SeatDTO) => void;
  /** Seat box size in px; the counter screen uses a slightly tighter grid. */
  size?: number;
  gap?: number;
  screenWidth?: number;
  /** Showtime base price, used for the legend's per-type prices. */
  basePrice?: number;
  disabled?: boolean;
}

export function SeatMap({
  seats,
  selectedIds,
  onToggle,
  size = 40,
  gap = 8,
  screenWidth = 640,
  basePrice,
  disabled,
}: SeatMapProps) {
  const model = buildSeatMap(seats, selectedIds);

  if (!model.rows.length) {
    return (
      <div className="state state--inline">
        <span className="state__title">Chưa có sơ đồ ghế</span>
        <span>Suất chiếu này chưa được cấu hình ghế trong phòng.</span>
      </div>
    );
  }

  // Split each row in half so the design's centre walkway is preserved.
  return (
    <div className="seatmap">
      <div
        className="seatmap__screen"
        style={{ width: screenWidth }}
        aria-hidden="true"
      />
      <span className="seatmap__screen-label">MÀN HÌNH</span>

      <div className="seatmap__rows">
        {model.rows.map((row, rowIndex) => {
          const half = Math.ceil(row.cells.length / 2);
          const left = row.cells.slice(0, half);
          const right = row.cells.slice(half);
          // Mirrors the design's extra breathing room before the middle row.
          const marginTop = rowIndex === 4 ? 22 : 0;

          return (
            <div className="seatmap__row" key={row.rowValue} style={{ marginTop }}>
              <span className="seatmap__rowlabel">{row.label}</span>
              <div className="seatmap__half" style={{ gap }}>
                {left.map((cell) => (
                  <Seat key={cell.id} cell={cell} size={size} gap={gap} onToggle={onToggle} disabled={disabled} />
                ))}
              </div>
              <span style={{ width: 20 }} />
              <div className="seatmap__half" style={{ gap }}>
                {right.map((cell) => (
                  <Seat key={cell.id} cell={cell} size={size} gap={gap} onToggle={onToggle} disabled={disabled} />
                ))}
              </div>
              <span className="seatmap__rowlabel">{row.label}</span>
            </div>
          );
        })}
      </div>

      <SeatLegend types={model.types} basePrice={basePrice} />
    </div>
  );
}

function Seat({
  cell,
  size,
  gap,
  onToggle,
  disabled,
}: {
  cell: SeatCell;
  size: number;
  gap: number;
  onToggle: (seat: SeatDTO) => void;
  disabled?: boolean;
}) {
  if (cell.kind === 'aisle') {
    return <span className="seatmap__aisle" style={{ width: size, height: size }} aria-hidden="true" />;
  }

  const visual = visualFor(cell);
  const selectable = !disabled && (cell.state === 'available' || cell.state === 'selected');
  const width = size * cell.span + gap * (cell.span - 1);

  return (
    <button
      type="button"
      className="seatmap__seat"
      disabled={!selectable}
      aria-pressed={cell.state === 'selected'}
      aria-label={`Ghế ${cell.name} — ${SEAT_TYPE_VI[cell.typeName] ?? cell.typeName} — ${LABEL[cell.state]}`}
      title={`${cell.name} · ${SEAT_TYPE_VI[cell.typeName] ?? cell.typeName} · ${LABEL[cell.state]}`}
      onClick={() => cell.seat && onToggle(cell.seat)}
      style={{
        width,
        height: size,
        background: visual.background,
        borderColor: visual.borderColor,
        borderStyle: visual.borderStyle,
        color: visual.color,
        cursor: selectable ? 'pointer' : 'not-allowed',
      }}
    >
      {cell.state === 'available' || cell.state === 'selected' ? cell.label : ''}
    </button>
  );
}

export function SeatLegend({
  types,
  basePrice,
}: {
  types: Array<{ typeName: string; priceMultiplier: number }>;
  basePrice?: number;
}) {
  return (
    <div className="seatmap__legend">
      {types
        .filter((type) => type.typeName !== 'AISLE')
        .map((type) => (
          <span className="seatmap__legend-item" key={type.typeName}>
            <span
              className="seatmap__swatch"
              style={{ background: 'var(--surface)', borderColor: TYPE_BORDER[type.typeName] ?? 'var(--seat-normal)' }}
            />
            {SEAT_TYPE_VI[type.typeName] ?? type.typeName}
            {basePrice ? (
              <span style={{ color: 'var(--ink-5)' }}>{vnd(Math.round(basePrice * type.priceMultiplier))}</span>
            ) : null}
          </span>
        ))}
      <span className="seatmap__legend-item">
        <span className="seatmap__swatch" style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }} />
        Đang chọn
      </span>
      <span className="seatmap__legend-item">
        <span
          className="seatmap__swatch"
          style={{ background: 'var(--surface-disabled)', borderColor: 'var(--surface-disabled)' }}
        />
        Đã bán
      </span>
      <span className="seatmap__legend-item">
        <span
          className="seatmap__swatch"
          style={{ background: 'var(--held-hatch)', borderColor: 'var(--line-strong)' }}
        />
        Người khác giữ
      </span>
    </div>
  );
}
