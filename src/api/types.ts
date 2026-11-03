/**
 * TypeScript mirrors of the backend DTOs in
 * Backend_CAH_Cinema/src/main/java/com/uit/backend_cinema/modules/**\/api/dto.
 *
 * BigDecimal fields arrive as JSON numbers, LocalDate as "yyyy-MM-dd" and
 * LocalDateTime as "yyyy-MM-ddTHH:mm:ss" (no zone) — both kept as strings so
 * nothing is silently shifted into the browser's timezone.
 */

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** Spring Data Page, as serialized by Jackson. */
export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/** Spring Data Slice (comments endpoint). */
export interface Slice<T> {
  content: T[];
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

/* ---------- Enums (string unions matching the Java enums) ---------- */

export type BookingStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED' | 'CHECKED_IN';
export type BookingPaymentMethod = 'CASH' | 'VNPAY' | 'MOMO' | 'STRIPE';
export type RefundStatus = 'REQUESTED' | 'PROCESSING' | 'UNKNOWN' | 'SUCCEEDED' | 'FAILED' | 'REVIEW_REQUIRED';
export type VoucherType = 'FIXED_AMOUNT' | 'PERCENT';
export type CustomerType = 'REGISTERED' | 'WALK_IN';
export type DayType = 'WEEKDAY' | 'WEEKEND' | 'HOLIDAY';
export type TimeSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';
/** Serialized via @JsonValue, so the wire format is "2D" / "3D" / "IMAX". */
export type MovieFormat = '2D' | '3D' | 'IMAX';
export type FoodCategory = 'Combo' | 'Food' | 'Drink';
export type FoodFulfillmentStatus = 'NOT_APPLICABLE' | 'PENDING' | 'FULFILLED';
export type SeatTypeName = 'NORMAL' | 'VIP' | 'COUPLE' | 'AISLE';
export type OccupancyStatus = 'AVAILABLE' | 'LOCKED' | 'SOLD';
/** Khớp CHECK constraint của cột showtimes.status ở backend. */
export type ShowtimeStatus = 'AVAILABLE' | 'SOLD_OUT' | 'HIDDEN' | 'CANCELLED';
export type AgeRating = 'P' | 'K' | 'T13' | 'T16' | 'T18';
export type UserRole = 'ROLE_USER' | 'ROLE_STAFF' | 'ROLE_ADMIN';
export type RankLevel = 'SILVER' | 'GOLD' | 'DIAMOND';

/* ---------- Auth ---------- */

export interface UserDTO {
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  authProvider: string | null;
  role: UserRole | string;
  totalPaid: number | null;
  totalPoint: number | null;
  rankLevel: RankLevel | string | null;
}

export interface AuthResponseDTO {
  accessToken: string;
  refreshToken: string;
  user: UserDTO;
}

export interface FpVerifyOtpResponse {
  token?: string;
  resetToken?: string;
}

export interface InvoiceSeat {
  seatId: number;
  seatRow: number;
  seatCol: number;
  seatType: SeatTypeName | string;
  ticketPrice: number;
}

export interface InvoiceFood {
  foodId: number;
  foodName: string;
  foodImageUrl: string | null;
  foodCategory: FoodCategory | string;
  quantity: number;
  unitPrice: number;
}

export interface FullInvoiceDTO {
  bookingId: number;
  bookingStatus: BookingStatus | string;
  paymentMethod: BookingPaymentMethod | string | null;
  discountAmount: number | null;
  totalPrice: number | null;
  bookingCreatedAt: string;
  voucherCode: string | null;
  showtimeId: number | null;
  movieFormat: string | null;
  startTime: string | null;
  endTime: string | null;
  movieId: number | null;
  movieTitle: string | null;
  moviePosterUrl: string | null;
  cinemaName: string | null;
  roomName: string | null;
  foodTotalPrice: number | null;
  seats?: InvoiceSeat[] | null;
  foods?: InvoiceFood[] | null;
}

export interface UserProfileBundle {
  user: UserDTO;
  recentInvoices: FullInvoiceDTO[];
}

/* ---------- Movies ---------- */

export interface GenreDTO {
  genreId: number;
  name: string;
}

export interface MovieSummaryDTO {
  movieId: number;
  title: string;
  duration: number | null;
  releaseDate: string | null;
  ageRating: AgeRating | string | null;
  posterUrl: string | null;
}

export interface MovieDetailDTO extends MovieSummaryDTO {
  description: string | null;
  trailerUrl: string | null;
  directorName: string | null;
  actorList: string | null;
  genres: GenreDTO[];
}

export interface FeaturedMovies {
  nowShowing: MovieSummaryDTO[];
  upcoming: MovieSummaryDTO[];
}

export interface UpdateOrCreateMovieDTO {
  title: string;
  description?: string | null;
  duration?: number | null;
  releaseDate?: string | null;
  ageRating?: string | null;
  posterUrl?: string | null;
  trailerUrl?: string | null;
  directorName?: string | null;
  actorList?: string | null;
  genreIdList: number[];
}

/* ---------- Cinemas & rooms ---------- */

export interface CinemaResponseDTO {
  cinemaId: number;
  name: string;
  address: string;
  imageUrl: string | null;
  hotline: string | null;
}

export interface RoomResponseDTO {
  roomId: number;
  cinemaId: number;
  roomName: string;
}

export interface CinemaRequest {
  name: string;
  address: string;
  imageUrl?: string | null;
  hotline?: string | null;
}

/* ---------- Showtimes ---------- */

export interface ShowtimeSummaryDTO {
  showtimeId: number;
  format: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  status: ShowtimeStatus;
  roomName: string;
  cinemaName: string;
}

export interface ShowtimeDetailDTO {
  showtimeId: number;
  movieId: number;
  movieTitle: string;
  moviePosterUrl: string | null;
  movieDuration: number | null;
  roomId: number;
  roomName: string;
  cinemaId: number;
  cinemaName: string;
  format: string;
  startTime: string;
  endTime: string;
  basePrice: number;
  status: ShowtimeStatus;
}

/** GET /public/showtimes/movies/{movieId}?date= */
export interface MovieShowtimesResponseDTO {
  movie: {
    movieId: number;
    title: string;
    description: string | null;
  };
  cinemas: Array<{
    cinemaId: number;
    cinemaName: string;
    address: string | null;
    showtimes: Array<{
      showtimeId: number;
      startTime: string;
      endTime: string;
      format: string;
      basePrice: number;
      status: string;
      roomName: string;
    }>;
  }>;
}

/** GET /public/showtimes/cinemas/{cinemaId}?date= */
/**
 * Một phần tử của GET /public/showtimes/cinemas/{id}. Endpoint trả thẳng một
 * mảng các nhóm theo phim, không bọc trong object nào.
 */
export interface CinemaShowtimesResponseDTO {
  movie: {
    movieId: number;
    title: string;
    posterUrl: string | null;
    ageRating: string | null;
  };
  showtimes: Array<{
    showtimeId: number;
    startTime: string;
    endTime: string;
    format: string;
    basePrice: number;
    status: ShowtimeStatus;
    roomName: string;
  }>;
}

export interface CreateShowtimeDTO {
  movieId: number;
  roomId: number;
  format: MovieFormat;
  startTime: string;
  basePrice: number;
}

export interface UpdateShowtimeDTO extends CreateShowtimeDTO {
  showtimeId: number;
  status: string;
}

export interface CancelByRoomRequest {
  roomId: number;
  fromDate: string;
  toDate: string;
  reason?: string;
}

/* ---------- Seats ---------- */

export interface SeatTypeDTO {
  seatTypeId: number;
  typeName: SeatTypeName | string;
  priceMultiplier: number;
}

export interface SeatDTO {
  seatId: number;
  /** Raw grid coordinate. Fractional (x.5) values mark aisles. */
  row: number;
  col: number;
  rowLabel: string | null;
  colLabel: string | null;
  seatType: SeatTypeDTO;
  status: 'ACTIVE' | 'PREPARE' | string;
  isLocked: boolean | null;
  isSold: boolean | null;
  occupancyStatus: OccupancyStatus | string | null;
}

export interface CreateSeatDTO {
  roomId: number;
  row: number;
  col: number;
  seatTypeId: number;
}

export interface ReplaceSeatMapRequest {
  roomId: number;
  seats: CreateSeatDTO[];
}

/* ---------- Bookings ---------- */

export interface FoodOrderItemRequest {
  foodId: number;
  quantity: number;
}

export interface CreateBookingRequestDTO {
  showtimeId: number;
  seatIds: number[];
  paymentMethod: BookingPaymentMethod;
  voucherId?: number | null;
  foodItems?: FoodOrderItemRequest[];
}

export interface CreateBookingResponseDTO {
  bookingId: number;
  status: BookingStatus;
  expiresAt: string;
  seatSubtotal: number;
  foodSubtotal: number;
  discountAmount: number;
  lateDiscountAmount: number;
  voucherDiscountAmount: number;
  totalAmount: number;
}

export interface TicketItemResponseDTO {
  ticketId: number;
  bookingId: number;
  showtimeId: number;
  seatId: number;
  seatName: string;
  price: number;
  checkinCode: string;
  qrCode: string;
  status: string;
  isCheckedIn: boolean;
}

export interface BookingStatusResponseDTO {
  bookingId: number;
  status: BookingStatus;
  tickets?: TicketItemResponseDTO[] | null;
}

export interface CancellationQuoteDTO {
  bookingId: number;
  showtimeStartTime: string;
  quoteTime: string;
  hoursUntilShowtime: number;
  ticketRefundRate: number;
  netSeatAmount: number;
  ticketRefundAmount: number;
  netFoodAmount: number;
  foodRefundAmount: number;
  totalRefundAmount: number;
  retainedAmount: number;
  canCancel: boolean;
  reason: string | null;
  quoteToken: string | null;
}

export interface CancelBookingRequestDTO {
  quoteToken?: string | null;
  expectedRefundAmount?: number | null;
  reason?: string | null;
}

export interface CancelBookingResponseDTO {
  bookingId: number;
  status: BookingStatus;
  cancelledAt: string;
  refundId: number | null;
  refundAmount: number | null;
  retainedAmount: number | null;
  refundStatus: RefundStatus | null;
  paymentMethod: BookingPaymentMethod | null;
  message: string | null;
}

export interface CreateStaffBookingRequestDTO {
  showtimeId: number;
  customerType: CustomerType;
  customerId?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  seatIds: number[];
  paymentMethod: BookingPaymentMethod;
  voucherId?: number | null;
  foodItems?: FoodOrderItemRequest[];
}

export interface CustomerLookupResponseDTO {
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  rankLevel: string | null;
}

export interface ConfirmPaymentRequestDTO {
  paymentRef: string;
  gateway: string;
}

export interface ConfirmPaymentResponseDTO {
  bookingId: number;
  status: BookingStatus;
  message?: string | null;
}

/* ---------- Payments ---------- */

export interface StripeCheckoutResponse {
  payUrl: string;
  sessionId: string;
  paymentDeadline: string;
}

export interface VnpayPayResponse {
  payUrl: string;
  [key: string]: unknown;
}

export interface MomoPayResponse {
  payUrl?: string;
  qrCodeUrl?: string;
  deeplink?: string;
  [key: string]: unknown;
}

/* ---------- Refunds ---------- */

export interface ClaimRefundResponseDTO {
  refundId: number;
  bookingId: number;
  status: RefundStatus;
  actorStaffId: number | null;
  claimedAt: string;
  amount: number;
  message: string | null;
}

export interface ConfirmCashPayoutResponseDTO {
  refundId: number;
  bookingId: number;
  status: RefundStatus;
  actorStaffId: number | null;
  processedAt: string;
  amount: number;
  message: string | null;
}

/* ---------- Food ---------- */

export interface FoodDTO {
  foodId: number;
  name: string;
  description: string | null;
  price: number;
  category: FoodCategory | string;
  imageUrl: string | null;
  available?: boolean | null;
}

export interface FoodRequestDTO {
  name: string;
  description?: string | null;
  price: number;
  category: FoodCategory;
  imageUrl?: string | null;
  available?: boolean;
}

/* ---------- Vouchers ---------- */

export interface VoucherResponseDTO {
  voucherId: number;
  code: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  quantity: number;
  usedCount: number;
  startAt: string;
  expiredAt: string;
  isActive: boolean;
  isDeleted: boolean;
}

export interface CreateVoucherRequestDTO {
  code: string;
  type: VoucherType;
  value: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
  quantity: number;
  startAt: string;
  expiredAt: string;
}

export interface UpdateVoucherRequestDTO extends CreateVoucherRequestDTO {
  voucherId: number;
  isActive: boolean;
  isDeleted: boolean;
}

/* ---------- Comments ---------- */

export interface CommentResponse {
  commentId: number;
  userId: number;
  userName: string;
  userAvatar: string | null;
  content: string;
  createdAt: string;
}

/* ---------- Promotions ---------- */

export interface PromotionArticlePreviewResponse {
  promotionId: number;
  title: string;
  shortDescription: string;
  imageUrl: string | null;
  createdAt: string;
  isActive: boolean;
}

export interface PromotionArticleResponse extends PromotionArticlePreviewResponse {
  startDate: string | null;
  endDate: string | null;
  conditions: string | null;
  note: string | null;
  updatedAt: string | null;
}

export interface PromotionArticleRequest {
  title: string;
  shortDescription: string;
  startDate?: string | null;
  endDate?: string | null;
  conditions?: string | null;
  imageUrl?: string | null;
  note?: string | null;
  isActive?: boolean;
}

/* ---------- Price config & holidays ---------- */

export interface PriceConfigResponse {
  configId: number;
  dayType: DayType;
  timeSlot: TimeSlot;
  movieFormat: MovieFormat;
  multiplier: number;
}

export interface UpdatePriceConfigRequest {
  configId: number;
  dayType?: DayType;
  timeSlot?: TimeSlot;
  movieFormat?: MovieFormat;
  multiplier: number;
}

export interface HolidaysResponse {
  holidayId: number;
  date: string;
  name: string;
  isRecurring: boolean;
}

export interface HolidayRequest {
  holidayId?: number;
  date: string;
  name: string;
  isRecurring: boolean;
}

/* ---------- Reports ---------- */

export interface BusinessOverviewReportDTO {
  from: string;
  to: string;
  totalRevenue: number;
  ticketRevenue: number;
  foodRevenue: number;
  totalTicketsSold: number;
  totalBookingsPaid: number;
  totalDiscount: number;
  averageOrderValue: number;
}

export interface DailyRevenueReportDTO {
  date: string;
  revenue: number;
  bookingCount: number;
  ticketCount: number;
}

export interface MovieRevenueReportDTO {
  movieId: number;
  movieTitle: string;
  ticketRevenue: number;
  ticketsSold: number;
  bookingCount: number;
}

export interface CinemaRevenueReportDTO {
  cinemaId: number;
  cinemaName: string;
  ticketRevenue: number;
  ticketsSold: number;
  bookingCount: number;
}

/* ---------- Tickets / check-in ---------- */

export interface CheckInFoodItemDTO {
  foodId: number;
  foodName: string;
  quantity: number;
  price: number;
}

export interface CheckInResponseDTO {
  ticketId: number;
  bookingId: number;
  movieTitle: string;
  cinemaName: string;
  roomName: string;
  showtimeStart: string;
  seatName: string;
  foodFulfillmentStatus: FoodFulfillmentStatus;
  foodDeliveredNow: boolean;
  foodItems: CheckInFoodItemDTO[];
}
