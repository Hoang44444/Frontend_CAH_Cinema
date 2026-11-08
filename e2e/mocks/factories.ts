import type {
  CreateBookingResponseDTO,
  FoodDTO,
  Page,
  SeatDTO,
  SeatTypeDTO,
  UserDTO,
} from '../../src/api/types';
import type { BookingDraft, ShowtimeContext } from '../../src/store/bookingDraft';

/** Dữ liệu giả khai báo theo DTO thật, nên đổi kiểu ở src/api/types.ts là lỗi compile. */

export function aUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    userId: 501,
    name: 'Khách Kiểm Thử',
    email: 'khach@test.local',
    phone: '0900000000',
    avatarUrl: null,
    authProvider: 'EMAIL',
    role: 'ROLE_USER',
    totalPaid: 0,
    totalPoint: 0,
    rankLevel: 'SILVER',
    ...overrides,
  };
}

export function emptyPage<T>(): Page<T> {
  return { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10, first: true, last: true, empty: true };
}

export const SEAT_TYPES: Record<'NORMAL' | 'VIP', SeatTypeDTO> = {
  NORMAL: { seatTypeId: 1, typeName: 'NORMAL', priceMultiplier: 1 },
  VIP: { seatTypeId: 2, typeName: 'VIP', priceMultiplier: 1.5 },
};

export function aSeat(overrides: Partial<SeatDTO> & Pick<SeatDTO, 'seatId' | 'row' | 'col'>): SeatDTO {
  return {
    rowLabel: String.fromCharCode(64 + overrides.row),
    colLabel: String(overrides.col),
    seatType: SEAT_TYPES.NORMAL,
    status: 'ACTIVE',
    isLocked: false,
    isSold: false,
    occupancyStatus: 'AVAILABLE',
    ...overrides,
  };
}

/** Thứ Tư 14:00, nên hệ số khung giờ và định dạng 2D đều bằng 1. */
export const WEEKDAY_AFTERNOON = '2030-01-09T14:00:00';

export function aShowtimeContext(overrides: Partial<ShowtimeContext> = {}): ShowtimeContext {
  return {
    showtimeId: 77,
    movieId: 12,
    movieTitle: 'Phim Kiểm Thử',
    moviePosterUrl: null,
    ageRating: 'P',
    cinemaName: 'Rạp Kiểm Thử',
    roomName: 'Phòng 01',
    format: '2D',
    startTime: WEEKDAY_AFTERNOON,
    endTime: '2030-01-09T16:00:00',
    basePrice: 100_000,
    ...overrides,
  };
}

export function aBookingDraft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return {
    showtimeId: 77,
    seatIds: [1, 2],
    seatNames: ['A1', 'A2'],
    estimatedSeatTotal: 200_000,
    context: aShowtimeContext(),
    ...overrides,
  };
}

export function aFood(overrides: Partial<FoodDTO> = {}): FoodDTO {
  return {
    foodId: 5,
    name: 'Combo Kiểm Thử',
    description: 'Bắp và nước',
    price: 60_000,
    category: 'Combo',
    imageUrl: null,
    available: true,
    ...overrides,
  };
}

export function aCreatedBooking(overrides: Partial<CreateBookingResponseDTO> = {}): CreateBookingResponseDTO {
  return {
    bookingId: 42,
    status: 'PENDING',
    expiresAt: '2030-01-09T13:45:00',
    seatSubtotal: 200_000,
    foodSubtotal: 60_000,
    discountAmount: 5_200,
    lateDiscountAmount: 0,
    voucherDiscountAmount: 0,
    totalAmount: 254_800,
    ...overrides,
  };
}
