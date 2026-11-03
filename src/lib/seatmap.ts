import type { SeatDTO, SeatTypeName } from '@/api/types';

/**
 * Turns the flat SeatDTO list from GET /public/seats into the row/cell model the
 * seat map renders.
 *
 * Backend conventions (see SeatDTO javadoc): `row`/`col` are raw grid
 * coordinates and a fractional value (x.5) marks an aisle, in which case
 * `rowLabel` / `colLabel` are null.
 */

export type SeatState = 'available' | 'selected' | 'sold' | 'locked' | 'prepare';

export interface SeatCell {
  kind: 'seat' | 'aisle';
  seat: SeatDTO | null;
  /** Stable React key. */
  id: string;
  /** Label shown on the seat, e.g. "1" or "1-2" for a couple seat. */
  label: string;
  /** Full seat name used in summaries, e.g. "A1" or "H1-2". */
  name: string;
  state: SeatState;
  typeName: SeatTypeName | string;
  /** Couple seats render two columns wide. */
  span: number;
}

export interface SeatRow {
  label: string;
  rowValue: number;
  cells: SeatCell[];
}

export interface SeatMapModel {
  rows: SeatRow[];
  /** Seat types present in this room, for the legend. */
  types: Array<{ typeName: SeatTypeName | string; priceMultiplier: number }>;
  seatCount: number;
}

function isAisle(seat: SeatDTO): boolean {
  if (seat.seatType?.typeName === 'AISLE') return true;
  return !Number.isInteger(Number(seat.row)) || !Number.isInteger(Number(seat.col));
}

export function seatName(seat: SeatDTO): string {
  const rowLabel = seat.rowLabel ?? '';
  const colLabel = seat.colLabel ?? '';
  if (seat.seatType?.typeName === 'COUPLE' && colLabel) {
    // Couple seats occupy two numbers: col 1 covers 1-2, col 2 covers 3-4, ...
    const start = Number(colLabel) * 2 - 1;
    return `${rowLabel}${start}-${start + 1}`;
  }
  return `${rowLabel}${colLabel}`;
}

function stateOf(seat: SeatDTO, selected: Set<number>): SeatState {
  if (selected.has(seat.seatId)) return 'selected';
  if (seat.status === 'PREPARE') return 'prepare';
  if (seat.isSold || seat.occupancyStatus === 'SOLD') return 'sold';
  if (seat.isLocked || seat.occupancyStatus === 'LOCKED') return 'locked';
  return 'available';
}

export function buildSeatMap(seats: SeatDTO[] | undefined, selectedIds: number[] = []): SeatMapModel {
  if (!seats?.length) return { rows: [], types: [], seatCount: 0 };

  const selected = new Set(selectedIds);
  const byRow = new Map<number, SeatDTO[]>();
  for (const seat of seats) {
    const rowValue = Number(seat.row);
    const bucket = byRow.get(rowValue);
    if (bucket) bucket.push(seat);
    else byRow.set(rowValue, [seat]);
  }

  const typeMap = new Map<string, number>();
  let seatCount = 0;

  const rows: SeatRow[] = [...byRow.entries()]
    // Fractional rows are horizontal walkways; drop them, the row gap conveys it.
    .filter(([rowValue]) => Number.isInteger(rowValue))
    .sort((a, b) => a[0] - b[0])
    .map(([rowValue, rowSeats]) => {
      const sorted = [...rowSeats].sort((a, b) => Number(a.col) - Number(b.col));
      const cells: SeatCell[] = sorted.map((seat) => {
        const aisle = isAisle(seat);
        const typeName = seat.seatType?.typeName ?? 'NORMAL';
        if (!aisle) {
          seatCount += 1;
          if (!typeMap.has(typeName)) typeMap.set(typeName, Number(seat.seatType?.priceMultiplier ?? 1));
        }
        const name = seatName(seat);
        return {
          kind: aisle ? 'aisle' : 'seat',
          seat: aisle ? null : seat,
          id: `s${seat.seatId}`,
          label: aisle ? '' : name.replace(seat.rowLabel ?? '', ''),
          name,
          state: aisle ? 'prepare' : stateOf(seat, selected),
          typeName,
          span: typeName === 'COUPLE' ? 2 : 1,
        };
      });

      return {
        label: sorted.find((s) => s.rowLabel)?.rowLabel ?? String(rowValue),
        rowValue,
        cells,
      };
    });

  const order: Record<string, number> = { NORMAL: 0, VIP: 1, COUPLE: 2, AISLE: 3 };
  const types = [...typeMap.entries()]
    .map(([typeName, priceMultiplier]) => ({ typeName, priceMultiplier }))
    .sort((a, b) => (order[a.typeName] ?? 9) - (order[b.typeName] ?? 9));

  return { rows, types, seatCount };
}

export const SEAT_TYPE_VI: Record<string, string> = {
  NORMAL: 'Thường',
  VIP: 'VIP',
  COUPLE: 'Đôi',
  AISLE: 'Lối đi',
};

/**
 * Calculates showtime price multiplier based on format and time slot.
 * Matches backend PriceConfigService logic and database price_configs.
 */
export function getShowtimeMultiplier(format?: string | null, startTime?: string | null): number {
  let formatMul = 1.0;
  if (format) {
    const f = format.toUpperCase();
    if (f.includes('IMAX')) formatMul = 1.5;
    else if (f.includes('3D')) formatMul = 1.3;
    else if (f.includes('2D')) formatMul = 1.0;
  }

  let timeMul = 1.0;
  if (startTime) {
    const d = new Date(startTime);
    if (!Number.isNaN(d.getTime())) {
      const day = d.getDay(); // 0 is Sunday, 6 is Saturday
      if (day === 0 || day === 6) {
        timeMul = 1.2;
      } else {
        const hour = d.getHours();
        if (hour >= 6 && hour < 12) timeMul = 0.8;
        else if (hour >= 12 && hour < 18) timeMul = 1.0;
        else if (hour >= 18) timeMul = 1.2;
      }
    }
  }

  return formatMul * timeMul;
}

/**
 * Estimated seat price for the live subtotal while picking seats:
 * showtime base price x seat type multiplier x showtime format/time multiplier.
 */
export function estimateSeatPrice(basePrice: number, seat: SeatDTO, showtimeMultiplier: number = 1.0): number {
  const multiplier = Number(seat.seatType?.priceMultiplier ?? 1);
  return Math.round(basePrice * multiplier * showtimeMultiplier);
}

export function estimateSeatTotal(basePrice: number, seats: SeatDTO[], showtimeMultiplier: number = 1.0): number {
  return seats.reduce((sum, seat) => sum + estimateSeatPrice(basePrice, seat, showtimeMultiplier), 0);
}
