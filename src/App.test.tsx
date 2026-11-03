import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { App } from './App';

vi.mock('@/api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/endpoints')>();
  return {
    ...actual,
    movieApi: {
      ...actual.movieApi,
      featured: vi.fn().mockResolvedValue({
        nowShowing: [],
        upcoming: [],
      }),
      search: vi.fn().mockResolvedValue({
        content: [],
        totalPages: 0,
        totalElements: 0,
        number: 0,
        size: 10,
      }),
      genres: vi.fn().mockResolvedValue([]),
    },
    promotionApi: {
      ...actual.promotionApi,
      list: vi.fn().mockResolvedValue({
        content: [],
        totalPages: 0,
        totalElements: 0,
        number: 0,
        size: 10,
      }),
    },
    cinemaApi: {
      ...actual.cinemaApi,
      list: vi.fn().mockResolvedValue([]),
    },
    bookingApi: {
      ...actual.bookingApi,
      status: vi.fn().mockResolvedValue({
        bookingId: 99,
        status: 'PAID',
      }),
    },
    userApi: {
      ...actual.userApi,
      me: vi.fn().mockResolvedValue({
        user: {
          userId: 1,
          email: 'test@example.com',
          name: 'Tester',
          phone: null,
          role: 'user',
          rankLevel: null,
          avatarUrl: null,
        },
        recentInvoices: [],
      }),
    },
  };
});

describe('App Routing (Kiểm tra định tuyến ứng dụng)', () => {
  it('hiển thị trang chủ khi vào đường dẫn /', async () => {
    renderWithProviders(<App />, { initialEntries: ['/'] });

    await waitFor(() => {
      expect(screen.getAllByText(/CAH/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/CINEMA/).length).toBeGreaterThan(0);
    });
  });

  it('định tuyến thành công tới /payment/result', async () => {
    renderWithProviders(<App />, {
      initialEntries: ['/payment/result?bookingId=99'],
    });

    await waitFor(() => {
      expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument();
      expect(screen.getAllByText(/#BK-99/).length).toBeGreaterThan(0);
    });
  });

  it('định tuyến thành công tới /payment/return', async () => {
    renderWithProviders(<App />, {
      initialEntries: ['/payment/return?bookingId=99'],
    });

    await waitFor(() => {
      expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument();
    });
  });

  it('định tuyến thành công tới /booking/result (MoMo redirect URL)', async () => {
    renderWithProviders(<App />, {
      initialEntries: ['/booking/result?bookingId=99'],
    });

    await waitFor(() => {
      expect(screen.getByText('Thanh toán thành công')).toBeInTheDocument();
    });
  });

  it('hiển thị 404 khi truy cập đường dẫn không tồn tại', async () => {
    renderWithProviders(<App />, {
      initialEntries: ['/duong-dan-khong-ton-tai'],
    });

    await waitFor(() => {
      expect(screen.getByText(/Không tìm thấy trang/i)).toBeInTheDocument();
    });
  });
});
