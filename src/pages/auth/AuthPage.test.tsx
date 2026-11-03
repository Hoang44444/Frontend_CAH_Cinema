import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import AuthPage from './AuthPage';
import { authApi } from '@/api/endpoints';

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>();
  return {
    ...actual,
    authApi: {
      login: vi.fn(),
      googleLogin: vi.fn(),
      sendRegisterOtp: vi.fn(),
      register: vi.fn(),
      sendOtp: vi.fn().mockResolvedValue(undefined),
      verifyOtp: vi.fn(),
      fpVerifyOtp: vi.fn().mockResolvedValue({ token: 'mock-reset-jwt-token-xyz' }),
      fpChangePassword: vi.fn().mockResolvedValue(undefined),
      changePassword: vi.fn(),
      logout: vi.fn(),
    },
  };
});

describe('Forgot Password Flow (Luồng Quên & Đổi mật khẩu)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('chuyển ngay sang bước nhập OTP khi gửi email mà không bắt người dùng chờ server', async () => {
    // Giả lập server gửi OTP mất 2 giây
    let resolveSendOtp!: () => void;
    vi.mocked(authApi.sendOtp).mockImplementation(
      () =>
        new Promise<unknown>((resolve) => {
          resolveSendOtp = () => resolve(undefined);
        }),
    );

    renderWithProviders(<AuthPage />, { initialEntries: ['/auth'] });

    // Chuyển sang tab Quên mật khẩu
    const forgotTab = screen.getByRole('tab', { name: /Quên mật khẩu/i });
    fireEvent.click(forgotTab);

    expect(screen.getByRole('heading', { name: 'Quên mật khẩu' })).toBeInTheDocument();

    // Nhập email
    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    // Bấm Gửi mã OTP
    const submitBtn = screen.getByRole('button', { name: /Gửi mã OTP/i });
    fireEvent.click(submitBtn);

    // Màn hình PHẢI chuyển ngay sang "Nhập mã OTP" mà KHÔNG cần đợi resolveSendOtp
    expect(screen.getByRole('heading', { name: 'Nhập mã OTP' })).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Xác thực/i })).toBeInTheDocument();

    // Gọi resolveSendOtp để server hoàn tất
    resolveSendOtp();
  });

  it('lấy token từ fpVerifyOtp và gán đúng resetToken vào fpChangePassword', async () => {
    vi.mocked(authApi.fpVerifyOtp).mockResolvedValue({
      token: 'jwt-reset-token-valid-12345',
    });

    renderWithProviders(<AuthPage />, { initialEntries: ['/auth'] });

    // Vào tab Quên mật khẩu
    fireEvent.click(screen.getByRole('tab', { name: /Quên mật khẩu/i }));

    // Bước 0: Nhập email
    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'user@cinema.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Gửi mã OTP/i }));

    // Bước 1: Nhập OTP
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nhập mã OTP' })).toBeInTheDocument();
    });

    // Điền OTP 6 số vào ô input duy nhất của OtpInput
    const otpInput = screen.getByLabelText(/Mã OTP 6 số/i);
    fireEvent.change(otpInput, { target: { value: '123456' } });

    // Bấm nút Xác thực
    const verifyBtn = screen.getByRole('button', { name: /Xác thực/i });
    expect(verifyBtn).not.toBeDisabled();
    fireEvent.click(verifyBtn);

    // Kiểm tra fpVerifyOtp được gọi với email và OTP
    await waitFor(() => {
      expect(authApi.fpVerifyOtp).toHaveBeenCalledWith('user@cinema.com', '123456');
    });

    // Màn hình chuyển sang bước 2: "Mật khẩu mới"
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mật khẩu mới' })).toBeInTheDocument();
    });

    // Nhập mật khẩu mới
    const passwordInputs = screen.getAllByPlaceholderText('••••••••••');
    fireEvent.change(passwordInputs[0], { target: { value: 'NewPassword@123' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'NewPassword@123' } });

    // Bấm Đổi mật khẩu
    const changeBtn = screen.getByRole('button', { name: /Đổi mật khẩu/i });
    fireEvent.click(changeBtn);

    // Kiểm tra fpChangePassword nhận được đúng resetToken đã lấy từ fpVerifyOtp
    await waitFor(() => {
      expect(authApi.fpChangePassword).toHaveBeenCalledWith(
        'user@cinema.com',
        'NewPassword@123',
        'jwt-reset-token-valid-12345',
      );
    });
  });

  it('không chuyển sang bước 2 nếu OTP không hợp lệ (không có token)', async () => {
    vi.mocked(authApi.fpVerifyOtp).mockResolvedValue({
      token: '', // Không có token
    });

    renderWithProviders(<AuthPage />, { initialEntries: ['/auth'] });

    fireEvent.click(screen.getByRole('tab', { name: /Quên mật khẩu/i }));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'user@cinema.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Gửi mã OTP/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nhập mã OTP' })).toBeInTheDocument();
    });

    const otpInput = screen.getByLabelText(/Mã OTP 6 số/i);
    fireEvent.change(otpInput, { target: { value: '654321' } });

    fireEvent.click(screen.getByRole('button', { name: /Xác thực/i }));

    // Vẫn ở màn hình nhập OTP, hiển thị thông báo lỗi
    await waitFor(() => {
      expect(screen.getByText(/Xác thực OTP thất bại hoặc mã OTP không hợp lệ/i)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Mật khẩu mới' })).not.toBeInTheDocument();
    });
  });
});
