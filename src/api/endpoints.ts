/**
 * Every backend call the app makes, grouped by the module it belongs to in
 * Backend_CAH_Cinema. Paths and payloads follow docs/api/*.md.
 */

import { http, requestRaw } from '@/lib/http';
import type {
  AuthResponseDTO,
  BookingStatusResponseDTO,
  BusinessOverviewReportDTO,
  CancelBookingRequestDTO,
  CancelBookingResponseDTO,
  CancellationQuoteDTO,
  CancelByRoomRequest,
  CheckInResponseDTO,
  CinemaRequest,
  CinemaResponseDTO,
  CinemaRevenueReportDTO,
  CinemaShowtimesResponseDTO,
  ClaimRefundResponseDTO,
  CommentResponse,
  ConfirmCashPayoutResponseDTO,
  ConfirmPaymentRequestDTO,
  ConfirmPaymentResponseDTO,
  CreateBookingRequestDTO,
  CreateBookingResponseDTO,
  CreateShowtimeDTO,
  CreateStaffBookingRequestDTO,
  CreateVoucherRequestDTO,
  CustomerLookupResponseDTO,
  DailyRevenueReportDTO,
  FeaturedMovies,
  FoodDTO,
  FoodRequestDTO,
  FpVerifyOtpResponse,
  GenreDTO,
  HolidayRequest,
  HolidaysResponse,
  MomoPayResponse,
  MovieDetailDTO,
  MovieRevenueReportDTO,
  MovieShowtimesResponseDTO,
  MovieSummaryDTO,
  Page,
  PriceConfigResponse,
  PromotionArticlePreviewResponse,
  PromotionArticleRequest,
  PromotionArticleResponse,
  ReplaceSeatMapRequest,
  RoomResponseDTO,
  SeatDTO,
  ShowtimeDetailDTO,
  Slice,
  StripeCheckoutResponse,
  UpdateOrCreateMovieDTO,
  UpdatePriceConfigRequest,
  UpdateShowtimeDTO,
  UpdateVoucherRequestDTO,
  UserDTO,
  UserProfileBundle,
  VnpayPayResponse,
  VoucherResponseDTO,
} from './types';

const V1 = '/api/v1';

/* ===================== Auth ===================== */

export const authApi = {
  login: (email: string, password: string) =>
    http.post<AuthResponseDTO>(`${V1}/auth/login`, { email, password }, { auth: false }),

  googleLogin: (idToken: string) =>
    http.post<AuthResponseDTO>(`${V1}/auth/google`, { idToken }, { auth: false }),

  /** Step 1 of registration: ask for the 6-digit OTP. */
  sendRegisterOtp: (email: string) =>
    http.post<unknown>(`${V1}/auth/register/send-otp`, { email }, { auth: false }),

  /** Step 2: create the account with the OTP. */
  register: (payload: { email: string; password: string; name: string; otp: string; phone?: string }) =>
    http.post<AuthResponseDTO>(`${V1}/auth/register`, payload, { auth: false }),

  /** Forgot-password flow: send, then verify, then change. */
  sendOtp: (email: string) => http.post<unknown>(`${V1}/auth/send-otp`, { email }, { auth: false }),

  verifyOtp: (email: string, otp: string) =>
    http.post<unknown>(`${V1}/auth/verify-otp`, { email, otp }, { auth: false }),

  fpVerifyOtp: (email: string, otp: string) =>
    http.post<FpVerifyOtpResponse>(`${V1}/auth/fp-verify-otp`, { email, otp }, { auth: false }),

  fpChangePassword: (email: string, newPassword: string, resetToken: string) =>
    http.post<unknown>(
      `${V1}/auth/fp-change-password`,
      { email, newPassword, resetToken },
      { auth: false },
    ),

  changePassword: (oldPassword: string, newPassword: string) =>
    http.post<unknown>(`${V1}/auth/change-password`, { oldPassword, newPassword }),

  logout: (refreshToken: string) =>
    http.post<unknown>(`${V1}/auth/logout`, { refreshToken }, { auth: false }),
};

/* ===================== Users ===================== */

export const userApi = {
  me: () => http.get<UserProfileBundle>(`${V1}/users/me`),

  updateMe: (payload: { name?: string; email?: string; phone?: string; avatarUrl?: string }) =>
    http.patch<UserDTO>(`${V1}/users/me`, payload),
};

/* ===================== Movies & genres ===================== */

export const movieApi = {
  search: (params: {
    title?: string;
    genreId?: number;
    ageRating?: string;
    page?: number;
    size?: number;
    sort?: string;
  } = {}) => http.get<Page<MovieSummaryDTO>>(`${V1}/public/movies`, { query: params, auth: false }),

  featured: () => http.get<FeaturedMovies>(`${V1}/public/movies/featured`, { auth: false }),

  detail: (movieId: number) => http.get<MovieDetailDTO>(`${V1}/public/movies/${movieId}`, { auth: false }),

  genres: () => http.get<GenreDTO[]>(`${V1}/public/genres/all`, { auth: false }),

  adminCreate: (payload: UpdateOrCreateMovieDTO) =>
    http.post<MovieDetailDTO>(`${V1}/admin/movies/create`, payload),

  adminUpdate: (movieId: number, payload: UpdateOrCreateMovieDTO) =>
    http.put<MovieDetailDTO>(`${V1}/admin/movies/update/${movieId}`, payload),

  adminDelete: (movieId: number) => http.delete<MovieDetailDTO>(`${V1}/admin/movies/delete/${movieId}`),
};

/* ===================== Cinemas & rooms ===================== */

export const cinemaApi = {
  list: () => http.get<CinemaResponseDTO[]>(`${V1}/public/cinemas`, { auth: false }),

  adminDetail: (cinemaId: number) => http.get<CinemaResponseDTO>(`${V1}/admin/cinemas/${cinemaId}`),

  adminCreate: (payload: CinemaRequest) => http.post<CinemaResponseDTO>(`${V1}/admin/cinemas`, payload),

  adminUpdate: (cinemaId: number, payload: CinemaRequest) =>
    http.put<CinemaResponseDTO>(`${V1}/admin/cinemas/${cinemaId}`, payload),

  adminDelete: (cinemaId: number) => http.delete<unknown>(`${V1}/admin/cinemas/${cinemaId}`),

  rooms: (cinemaId: number) => http.get<RoomResponseDTO[]>(`${V1}/admin/cinemas/${cinemaId}/rooms`),

  createRoom: (cinemaId: number, roomName: string) =>
    http.post<RoomResponseDTO>(`${V1}/admin/cinemas/${cinemaId}/rooms`, { roomName }),

  updateRoom: (roomId: number, roomName: string) =>
    http.put<RoomResponseDTO>(`${V1}/admin/cinemas/rooms/${roomId}`, { roomName }),

  deleteRoom: (roomId: number) => http.delete<unknown>(`${V1}/admin/cinemas/rooms/${roomId}`),
};

/* ===================== Showtimes ===================== */

export const showtimeApi = {
  /** `date` is yyyy-MM-dd and required by the backend. */
  byMovie: (movieId: number, date: string) =>
    http.get<MovieShowtimesResponseDTO>(`${V1}/public/showtimes/movies/${movieId}`, {
      query: { date },
      auth: false,
    }),

  byCinema: (cinemaId: number, date: string) =>
    http.get<CinemaShowtimesResponseDTO>(`${V1}/public/showtimes/cinemas/${cinemaId}`, {
      query: { date },
      auth: false,
    }),

  adminByRoom: (roomId: number, date: string) =>
    http.get<ShowtimeDetailDTO[]>(`${V1}/admin/showtime/rooms/${roomId}`, { query: { date } }),

  adminCreate: (payload: CreateShowtimeDTO) => http.post<ShowtimeDetailDTO>(`${V1}/admin/showtime`, payload),

  adminUpdate: (payload: UpdateShowtimeDTO) => http.put<ShowtimeDetailDTO>(`${V1}/admin/showtime`, payload),

  adminDelete: (showtimeId: number) => http.delete<unknown>(`${V1}/admin/showtime/${showtimeId}`),

  adminCancelByRoom: (payload: CancelByRoomRequest) =>
    http.post<unknown>(`${V1}/admin/showtime/cancel-by-room`, payload),
};

/* ===================== Seats ===================== */

export const seatApi = {
  /** Live availability for a showtime (includes Redis locks and sold seats). */
  byShowtime: (showtimeId: number) =>
    http.get<SeatDTO[]>(`${V1}/public/seats`, { query: { showtimeId }, auth: false }),

  lock: (seatId: number, showtimeId: number) =>
    http.post<unknown>(`${V1}/seats/${seatId}/lock`, undefined, { query: { showtimeId } }),

  unlock: (seatId: number, showtimeId: number) =>
    http.delete<unknown>(`${V1}/seats/${seatId}/lock`, undefined, { query: { showtimeId } }),

  preLock: (showtimeId: number, seatIds: number[]) =>
    http.post<unknown>(`${V1}/seats/pre-lock`, { showtimeId, seatIds }),

  adminByRoom: (roomId: number) => http.get<SeatDTO[]>(`${V1}/admin/seats/rooms/${roomId}`),

  adminReplace: (payload: ReplaceSeatMapRequest) => http.put<SeatDTO[]>(`${V1}/admin/seats/replace`, payload),

  adminDeleteByRoom: (roomId: number) => http.delete<unknown>(`${V1}/admin/seats/delete/${roomId}`),
};

/* ===================== Bookings ===================== */

export const bookingApi = {
  create: (payload: CreateBookingRequestDTO) =>
    http.post<CreateBookingResponseDTO>(`${V1}/bookings`, payload),

  status: (bookingId: number) => http.get<BookingStatusResponseDTO>(`${V1}/bookings/${bookingId}`),

  cancellationQuote: (bookingId: number) =>
    http.get<CancellationQuoteDTO>(`${V1}/bookings/${bookingId}/cancellation-quote`),

  cancel: (bookingId: number, payload: CancelBookingRequestDTO) =>
    http.post<CancelBookingResponseDTO>(`${V1}/bookings/${bookingId}/cancel`, payload),

  /* Payment hand-offs. Each returns a URL the browser is sent to. */
  stripePay: (bookingId: number) =>
    http.post<StripeCheckoutResponse>(`${V1}/bookings/${bookingId}/stripe/pay`),

  vnpayPay: (bookingId: number, requestId: string) =>
    http.post<VnpayPayResponse>(`${V1}/bookings/${bookingId}/vnpay/pay`, { requestId }),

  momoPay: (bookingId: number, requestId: string, requestType?: string) =>
    http.post<MomoPayResponse>(`${V1}/bookings/${bookingId}/momo/pay`, { requestId, requestType }),
};

/* ===================== Staff ===================== */

export const staffApi = {
  lookupCustomer: (email: string) =>
    http.get<CustomerLookupResponseDTO>(`${V1}/staff/bookings/customer-lookup`, { query: { email } }),

  createBooking: (payload: CreateStaffBookingRequestDTO) =>
    http.post<CreateBookingResponseDTO>(`${V1}/staff/bookings`, payload),

  confirmPayment: (bookingId: number, payload: ConfirmPaymentRequestDTO) =>
    http.post<ConfirmPaymentResponseDTO>(`${V1}/staff/bookings/${bookingId}/confirm-payment`, payload),

  cancellationQuote: (bookingId: number) =>
    http.get<CancellationQuoteDTO>(`${V1}/staff/bookings/${bookingId}/cancellation-quote`),

  cancelBooking: (bookingId: number, payload: CancelBookingRequestDTO) =>
    http.post<CancelBookingResponseDTO>(`${V1}/staff/bookings/${bookingId}/cancel`, payload),

  /** Atomic claim — only one staff member can own a refund. */
  claimRefund: (refundId: number) =>
    http.post<ClaimRefundResponseDTO>(`${V1}/staff/refunds/${refundId}/claim`),

  confirmCashPayout: (refundId: number) =>
    http.post<ConfirmCashPayoutResponseDTO>(`${V1}/staff/refunds/${refundId}/confirm-cash-payout`),

  checkIn: (qrToken: string) => http.post<CheckInResponseDTO>(`${V1}/staff/tickets/check-in`, { qrToken }),
};

/* ===================== Food ===================== */

export const foodApi = {
  /** Available items only; requires a logged-in user. */
  list: () => http.get<FoodDTO[]>(`${V1}/foods`),

  adminList: () => http.get<FoodDTO[]>(`${V1}/admin/food`),

  adminCreate: (payload: FoodRequestDTO) => http.post<FoodDTO>(`${V1}/admin/food`, payload),

  adminUpdate: (foodId: number, payload: FoodRequestDTO) =>
    http.put<FoodDTO>(`${V1}/admin/food/${foodId}`, payload),

  adminDelete: (foodId: number) => http.delete<unknown>(`${V1}/admin/food/${foodId}`),
};

/* ===================== Vouchers ===================== */

export const voucherApi = {
  mine: () => http.get<VoucherResponseDTO[]>(`${V1}/vouchers`),

  adminList: (params: { page?: number; size?: number; sort?: string } = {}) =>
    http.get<Page<VoucherResponseDTO>>(`${V1}/admin/vouchers`, { query: params }),

  adminDetail: (voucherId: number) => http.get<VoucherResponseDTO>(`${V1}/admin/vouchers/${voucherId}`),

  adminCreate: (payload: CreateVoucherRequestDTO) =>
    http.post<VoucherResponseDTO>(`${V1}/admin/vouchers/create`, payload),

  adminUpdate: (payload: UpdateVoucherRequestDTO) =>
    http.post<VoucherResponseDTO>(`${V1}/admin/vouchers/update`, payload),

  adminDelete: (voucherId: number) => http.delete<unknown>(`${V1}/admin/vouchers/${voucherId}`),
};

/* ===================== Comments ===================== */

export const commentApi = {
  byMovie: (movieId: number, page = 0, size = 10) =>
    http.get<Slice<CommentResponse>>(`${V1}/public/comments/movies/${movieId}`, {
      query: { page, size },
      auth: false,
    }),

  create: (movieId: number, content: string) =>
    http.post<CommentResponse>(`${V1}/comments/movies/${movieId}`, { content }),

  remove: (commentId: number) => http.delete<unknown>(`${V1}/comments/${commentId}`),
};

/* ===================== Promotions ===================== */

export const promotionApi = {
  list: (params: { page?: number; size?: number; sort?: string } = {}) =>
    http.get<Page<PromotionArticlePreviewResponse>>(`${V1}/public/promotions`, {
      query: params,
      auth: false,
    }),

  detail: (id: number) => http.get<PromotionArticleResponse>(`${V1}/public/promotions/${id}`, { auth: false }),

  // The admin promotion endpoints return their DTO directly, not wrapped in
  // ApiResponse — see docs/api/11-promotions.md.
  adminList: (params: { page?: number; size?: number } = {}) =>
    requestRaw<Page<PromotionArticlePreviewResponse>>(`${V1}/admin/promotions`, { query: params }),

  adminDetail: (id: number) => requestRaw<PromotionArticleResponse>(`${V1}/admin/promotions/${id}`),

  adminCreate: (payload: PromotionArticleRequest) =>
    requestRaw<PromotionArticleResponse>(`${V1}/admin/promotions`, { method: 'POST', body: payload }),

  adminUpdate: (id: number, payload: PromotionArticleRequest) =>
    requestRaw<PromotionArticleResponse>(`${V1}/admin/promotions/${id}`, { method: 'PUT', body: payload }),

  adminDelete: (id: number) => requestRaw<void>(`${V1}/admin/promotions/${id}`, { method: 'DELETE' }),
};

/* ===================== Price config & holidays ===================== */

export const priceConfigApi = {
  all: () => http.get<PriceConfigResponse[]>(`${V1}/admin/price-config/all`),

  update: (payload: UpdatePriceConfigRequest) =>
    http.post<PriceConfigResponse>(`${V1}/admin/price-config/update`, payload),
};

export const holidayApi = {
  all: () => http.get<HolidaysResponse[]>(`${V1}/admin/holiday/all`),

  create: (payload: HolidayRequest) => http.post<HolidaysResponse>(`${V1}/admin/holiday/create`, payload),

  update: (payload: HolidayRequest) => http.post<HolidaysResponse>(`${V1}/admin/holiday/update`, payload),

  remove: (holidayId: number) => http.delete<unknown>(`${V1}/admin/holiday/delete`, { holidayId }),
};

/* ===================== Reports ===================== */

export const reportApi = {
  overview: (from: string, to: string) =>
    http.get<BusinessOverviewReportDTO>(`${V1}/admin/reports/overview`, { query: { from, to } }),

  daily: (from: string, to: string) =>
    http.get<DailyRevenueReportDTO[]>(`${V1}/admin/reports/revenue/daily`, { query: { from, to } }),

  byMovie: (from: string, to: string) =>
    http.get<MovieRevenueReportDTO[]>(`${V1}/admin/reports/revenue/by-movie`, { query: { from, to } }),

  byCinema: (from: string, to: string) =>
    http.get<CinemaRevenueReportDTO[]>(`${V1}/admin/reports/revenue/by-cinema`, { query: { from, to } }),
};
