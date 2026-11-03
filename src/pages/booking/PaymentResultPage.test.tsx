import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import PaymentResultPage from './PaymentResultPage';
import { bookingApi, userApi } from '@/api/endpoints';
import { tokenStore } from '@/lib/http';
import { pendingPaymentStore } from '@/store/pendingPayment';

vi.mock('@/api/endpoints', () => ({
  bookingApi: {
    status: vi.fn(),
  },
  userApi: {
    me: vi.fn(),
  },
}));

describe('PaymentResultPage (Màn hình kết quả thanh toán)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Set stored user & token so userApi.me is enabled
    tokenStore.set('mock-access-token', 'mock-refresh-token', {
      userId: 1,
      email: 'user@example.com',
      name: 'Nguyễn Văn A',
      phone: '0901234567',
      role: 'user',
      rankLevel: 'SILVER',
      avatarUrl: null,
      authProvider: 'LOCAL',
      totalPaid: 0,
      totalPoint: 0,
    });
    vi.mocked(bookingApi.status).mockResolvedValue({
      bookingId: 42,
      status: 'PAID',
    });

    vi.mocked(userApi.me).mockResolvedValue({
      user: {
        userId: 1,
        email: 'user@example.com',
        name: 'Nguyễn Văn A',
        phone: '0901234567',
        role: 'user',
        rankLevel: 'SILVER',
        avatarUrl: null,
        authProvider: 'LOCAL',
        totalPaid: 0,
        totalPoint: 0,
      },
      recentInvoices: [
        {
          bookingId: 42,
          bookingStatus: 'PAID',
          paymentMethod: 'VNPAY',
          discountAmount: 20000,
          totalPrice: 180000,
          bookingCreatedAt: '2026-11-03T10:00:00',
          voucherCode: 'GIAM20K',
          showtimeId: 10,
          movieFormat: '2D',
          startTime: '2026-11-03T19:30:00',
          endTime: '2026-11-03T21:30:00',
          movieId: 5,
          movieTitle: 'Avengers: Secret Wars',
          moviePosterUrl: 'https://example.com/poster.jpg',
          cinemaName: 'CAH Cinema Landmark 81',
          roomName: 'Cinema 01',
          foodTotalPrice: 60000,
          seats: [
            { seatId: 1, seatRow: 6, seatCol: 7, seatType: 'VIP', ticketPrice: 70000 },
            { seatId: 2, seatRow: 6, seatCol: 8, seatType: 'VIP', ticketPrice: 70000 },
          ],
          foods: [
            {
              foodId: 1,
              foodName: 'Combo Bắp Nước 1',
              foodImageUrl: null,
              foodCategory: 'Combo',
              quantity: 1,
              unitPrice: 60000,
            },
          ],
        },
      ],
    });
  });

  it('hiển thị thông báo rỗng khi URL không chứa mã booking', () => {
    renderWithProviders(<PaymentResultPage />, {
      initialEntries: ['/payment/result'],
    });

    expect(screen.getByText('Không tìm thấy mã đơn hàng')).toBeInTheDocument();
    expect(screen.getAllByText('Vé của tôi').length).toBeGreaterThan(0);
    expect(screen.getByText('Về trang chủ')).toBeInTheDocument();
  });

  it('hiển thị thành công khi callback từ VNPay với vnp_ResponseCode=00', async () => {
    renderWithProviders(<PaymentResultPage />, {
      initialEntries: [
        '/payment/result?vnp_TxnRef=BK42-173059873&vnp_ResponseCode=00&vnp_TransactionNo=14567890&vnp_BankCode=NCB&vnp_Amount=18000000&vnp_PayDate=20261103193000',
      ],
    });

    // Check title & hero status
    await waitFor(() => {
      expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument();
    });

    // Check booking ID & transaction details
    expect(screen.getAllByText(/#BK-42/).length).toBeGreaterThan(0);
    expect(screen.getByText('14567890')).toBeInTheDocument();
    expect(screen.getByText('NCB')).toBeInTheDocument();
    expect(screen.getByText('180.000đ')).toBeInTheDocument();

    // Check movie & showtime info
    expect(screen.getByText('Avengers: Secret Wars')).toBeInTheDocument();
    expect(screen.getByText(/CAH Cinema Landmark 81/)).toBeInTheDocument();
    expect(screen.getByText(/Cinema 01/)).toBeInTheDocument();
    expect(screen.getByText('19:30')).toBeInTheDocument();

    // Check seats (row 6 = F, cols 7 & 8 => F07, F08)
    expect(screen.getByText('F07')).toBeInTheDocument();
    expect(screen.getByText('F08')).toBeInTheDocument();

    // Check food combo
    expect(screen.getByText('Combo Bắp Nước 1')).toBeInTheDocument();

    // Check action buttons
    expect(screen.getByRole('link', { name: /Xem vé của tôi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /In thông tin vé/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Về trang chủ/i })).toBeInTheDocument();
  });

  it('hiển thị thông tin callback từ MoMo', async () => {
    renderWithProviders(<PaymentResultPage />, {
      initialEntries: [
        '/payment/result?partnerCode=MOMO&orderId=BK42-173059873&resultCode=0&transId=9876543210&amount=180000&payType=qr',
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument();
    });

    expect(screen.getAllByText(/#BK-42/).length).toBeGreaterThan(0);
    expect(screen.getByText('9876543210')).toBeInTheDocument();
    expect(screen.getByText('180.000đ')).toBeInTheDocument();
  });

  it('hiển thị cảnh báo lỗi khi cổng thanh toán trả mã hủy (vnp_ResponseCode=24)', async () => {
    vi.mocked(bookingApi.status).mockResolvedValue({
      bookingId: 42,
      status: 'PENDING',
    });

    renderWithProviders(<PaymentResultPage />, {
      initialEntries: [
        '/payment/result?vnp_TxnRef=BK42-173059873&vnp_ResponseCode=24',
      ],
    });

    await waitFor(() => {
      expect(screen.getByText('Thanh toán không thành công')).toBeInTheDocument();
    });

    expect(
      screen.getAllByText(/Khách hàng đã hủy giao dịch thanh toán/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('hiển thị trạng thái đang xử lý (PENDING) khi đang chờ IPN', async () => {
    vi.mocked(bookingApi.status).mockResolvedValue({
      bookingId: 42,
      status: 'PENDING',
    });

    renderWithProviders(<PaymentResultPage />, {
      initialEntries: ['/payment/result?bookingId=42'],
    });

    await waitFor(() => {
      expect(screen.getByText('Đang xác nhận thanh toán')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Kiểm tra lại/i })).toBeInTheDocument();
  });

  it('hỗ trợ sao chép mã booking ID khi nhấn nút Chép', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    renderWithProviders(<PaymentResultPage />, {
      initialEntries: ['/payment/result?bookingId=42'],
    });

    await waitFor(() => {
      expect(screen.getAllByText(/#BK-42/).length).toBeGreaterThan(0);
    });

    const copyBtn = screen.getByTitle('Sao chép mã');
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith('#BK-42');
  });

  it('gọi window.print() khi nhấn nút In thông tin vé', async () => {
    renderWithProviders(<PaymentResultPage />, {
      initialEntries: ['/payment/result?bookingId=42'],
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /In thông tin vé/i })).toBeInTheDocument();
    });

    const printBtn = screen.getByRole('button', { name: /In thông tin vé/i });
    fireEvent.click(printBtn);

    expect(window.print).toHaveBeenCalledTimes(1);
  });

  it('sử dụng metadata từ pendingPaymentStore khi profile chưa kịp tải', async () => {
    vi.mocked(userApi.me).mockResolvedValue({
      user: {
        userId: 1,
        email: 'user@example.com',
        name: 'Nguyễn Văn A',
        phone: null,
        role: 'user',
        rankLevel: null,
        avatarUrl: null,
        authProvider: 'LOCAL',
        totalPaid: 0,
        totalPoint: 0,
      },
      recentInvoices: [],
    });

    pendingPaymentStore.save(42, {
      movieTitle: 'Dune: Part Two',
      cinemaName: 'CAH Cinema Landmark 81',
      roomName: 'IMAX 01',
      format: 'IMAX',
      seatNames: ['H08', 'H09'],
      totalAmount: 320000,
      paymentMethod: 'STRIPE',
    });

    renderWithProviders(<PaymentResultPage />, {
      initialEntries: ['/payment/result?bookingId=42'],
    });

    await waitFor(() => {
      expect(screen.getByText('Dune: Part Two')).toBeInTheDocument();
    });

    expect(screen.getByText(/IMAX 01/)).toBeInTheDocument();
    expect(screen.getByText('H08')).toBeInTheDocument();
    expect(screen.getByText('H09')).toBeInTheDocument();
    expect(screen.getByText('320.000đ')).toBeInTheDocument();
  });
});
