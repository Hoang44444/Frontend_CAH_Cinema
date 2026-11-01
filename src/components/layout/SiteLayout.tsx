import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/store/auth';
import './layout.css';

export function Logo({ small, to = '/' }: { small?: boolean; to?: string }) {
  return (
    <Link to={to} className={`logo${small ? ' logo--sm' : ''}`}>
      CAH<span className="logo__dot">.</span>CINEMA
    </Link>
  );
}

/** Four-step progress indicator shown in the booking flow's header. */
const BOOKING_STEPS = ['Chọn suất', 'Chọn ghế', 'Bắp nước & thanh toán', 'Nhận vé'];

export function Stepper({ current }: { current: number }) {
  return (
    <div className="stepper">
      {BOOKING_STEPS.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo';
        return (
          <span key={label} className="stepper__step" data-state={state}>
            <span className="stepper__n">{state === 'done' ? '✓' : index + 1}</span>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function AccountControl() {
  const { user, isAuthenticated, isStaff, isAdmin } = useAuth();

  if (!isAuthenticated) {
    return (
      <Link to="/auth" className="btn btn--dark btn--xs btn--pill" style={{ color: '#fff' }}>
        Đăng nhập
      </Link>
    );
  }

  return (
    <>
      <NavLink to="/my-tickets" className={({ isActive }) => `header-link${isActive ? ' is-active' : ''}`}>
        Vé của tôi
      </NavLink>
      {isAdmin && (
        <Link to="/admin" className="header-chip">
          Quản trị
        </Link>
      )}
      {isStaff && !isAdmin && (
        <Link to="/staff" className="header-chip">
          Nhân viên
        </Link>
      )}
      <Link to="/account" className="header-account" aria-label="Tài khoản">
        <Avatar name={user?.name} />
      </Link>
    </>
  );
}

/** Header used on every guest / customer screen. */
export function SiteHeader({
  center,
  showSearch,
  showCity = true,
}: {
  /** Replaces the nav links, e.g. with the booking stepper. */
  center?: ReactNode;
  showSearch?: boolean;
  showCity?: boolean;
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  function onSearch(event: FormEvent) {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/movies?title=${encodeURIComponent(query)}` : '/movies');
  }

  return (
    <header className="site-header">
      <div className="site-header__left">
        <Logo />
        {center ?? (
          <nav className="site-nav">
            <NavLink to="/movies" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              Phim
            </NavLink>
            <NavLink to="/cinemas" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              Rạp
            </NavLink>
            <NavLink to="/promotions" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              Ưu đãi
            </NavLink>
            <NavLink to="/account" className={({ isActive }) => (isActive ? 'is-active' : undefined)}>
              Thành viên
            </NavLink>
          </nav>
        )}
      </div>
      <div className="site-header__right">
        {showSearch && (
          <form onSubmit={onSearch}>
            <input
              className="header-search"
              placeholder="Tìm phim, rạp…"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              aria-label="Tìm phim"
            />
          </form>
        )}
        {showCity && <span className="header-chip">TP. Hồ Chí Minh ▾</span>}
        <AccountControl />
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="stack" style={{ gap: 6 }}>
        <Logo small />
        <span>Hệ thống đặt vé CAH Cinema — đồ án môn Kiểm thử phần mềm.</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <strong style={{ color: 'var(--ink)' }}>Hỗ trợ</strong>
        <Link to="/promotions">Ưu đãi</Link>
        <Link to="/cinemas">Danh sách rạp</Link>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <strong style={{ color: 'var(--ink)' }}>Tài khoản</strong>
        <Link to="/my-tickets">Vé của tôi</Link>
        <Link to="/account">Thành viên</Link>
      </div>
    </footer>
  );
}

/** Shell for the public and customer-facing routes. */
export function SiteLayout({ showSearch = true }: { showSearch?: boolean }) {
  return (
    <div className="site-shell">
      <SiteHeader showSearch={showSearch} />
      <Outlet />
      <SiteFooter />
    </div>
  );
}
