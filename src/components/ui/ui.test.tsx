import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, StatusBadge, RatingBadge, Pill, EmptyState, RankBadge } from './index';

describe('UI Components', () => {
  describe('Button', () => {
    it('renders with label and fires onClick', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Xác nhận</Button>);

      const btn = screen.getByRole('button', { name: 'Xác nhận' });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders with loading state and disabled', () => {
      const { container } = render(<Button loading>Lưu</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(container.querySelector('.spinner')).toBeInTheDocument();
    });

    it('applies variant and size classes', () => {
      const { container } = render(
        <Button variant="danger" size="lg">
          Xóa
        </Button>,
      );
      expect(container.firstChild).toHaveClass('btn--danger');
      expect(container.firstChild).toHaveClass('btn--lg');
    });
  });

  describe('StatusBadge', () => {
    it('renders correct labels for statuses', () => {
      const { rerender } = render(<StatusBadge status="PAID" />);
      expect(screen.getByText('ĐÃ THANH TOÁN')).toBeInTheDocument();

      rerender(<StatusBadge status="PENDING" />);
      expect(screen.getByText('CHỜ THANH TOÁN')).toBeInTheDocument();

      rerender(<StatusBadge status="CANCELLED" />);
      expect(screen.getByText('ĐÃ HỦY')).toBeInTheDocument();

      rerender(<StatusBadge status="EXPIRED" />);
      expect(screen.getByText('HẾT HẠN')).toBeInTheDocument();
    });

    it('returns null when status is empty', () => {
      const { container } = render(<StatusBadge status={null} />);
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('RatingBadge', () => {
    it('renders rating badge with age rating text', () => {
      render(<RatingBadge rating="T18" />);
      expect(screen.getByText('T18')).toBeInTheDocument();
    });

    it('renders P for all-ages movies', () => {
      render(<RatingBadge rating="P" />);
      expect(screen.getByText('P')).toBeInTheDocument();
    });
  });

  describe('RankBadge', () => {
    it('renders member rank badge', () => {
      render(<RankBadge rank="GOLD" />);
      expect(screen.getByText('GOLD')).toBeInTheDocument();
    });
  });

  describe('Pill', () => {
    it('renders pill with active attribute', () => {
      render(<Pill active>Tất cả (5)</Pill>);
      const pill = screen.getByRole('button', { name: 'Tất cả (5)' });
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveAttribute('data-active', 'true');
    });
  });

  describe('EmptyState', () => {
    it('renders title, description, and action button', () => {
      render(
        <EmptyState
          title="Không có vé"
          description="Bạn chưa mua vé nào"
          action={<Button>Đặt vé ngay</Button>}
        />,
      );

      expect(screen.getByText('Không có vé')).toBeInTheDocument();
      expect(screen.getByText('Bạn chưa mua vé nào')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Đặt vé ngay' })).toBeInTheDocument();
    });
  });
});
