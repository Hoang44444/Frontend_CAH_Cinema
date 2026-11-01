import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Avatar, Button, Loading } from '@/components/ui';
import { useAuth } from '@/store/auth';
import { dowDate, hhmm } from '@/lib/format';
import { Logo } from './SiteLayout';
import './layout.css';

/**
 * Blocks a subtree unless the signed-in account has the role the backend
 * requires (/api/v1/admin/** needs ROLE_ADMIN, /api/v1/staff/** needs
 * ROLE_STAFF or ROLE_ADMIN), so the UI matches SecurityConfig.
 */
export function RequireRole({ role, children }: { role: 'user' | 'staff' | 'admin'; children: ReactNode }) {
  const { isAuthenticated, isStaff, isAdmin, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Đang kiểm tra phiên đăng nhập…" />;

  if (!isAuthenticated) {
    return (
      <div className="guard">
        <div className="guard__box">
          <span className="display" style={{ fontSize: 44 }}>
            Cần đăng nhập
          </span>
          <p style={{ color: 'var(--ink-4)' }}>Đăng nhập để tiếp tục tới {location.pathname}.</p>
          <Link
            to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`}
            className="btn btn--accent btn--md"
            style={{ color: '#fff' }}
          >
            Đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  const allowed = role === 'user' || (role === 'staff' && isStaff) || (role === 'admin' && isAdmin);

  if (!allowed) {
    return (
      <div className="guard">
        <div className="guard__box">
          <span className="display" style={{ fontSize: 44 }}>
            Không có quyền
          </span>
          <p style={{ color: 'var(--ink-4)', textWrap: 'pretty' }}>
            Khu vực này yêu cầu quyền {role === 'admin' ? 'ROLE_ADMIN' : 'ROLE_STAFF hoặc ROLE_ADMIN'}. Tài
            khoản hiện tại có quyền <span className="mono">{user?.role ?? '—'}</span>.
          </p>
          <Link to="/" className="btn btn--outline btn--sm">
            Về trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/* ---------- Admin ---------- */

interface AdminNavItem {
  to: string;
  label: string;
  badge?: string;
}

const ADMIN_NAV: AdminNavItem[] = [
  { to: '/admin', label: 'Tổng quan' },
  { to: '/admin/movies', label: 'Phim' },
  { to: '/admin/cinemas', label: 'Rạp & phòng' },
  { to: '/admin/showtimes', label: 'Lịch chiếu' },
  { to: '/admin/pricing', label: 'Giá & ngày lễ' },
  { to: '/admin/vouchers', label: 'Voucher' },
  { to: '/admin/foods', label: 'Đồ ăn' },
  { to: '/admin/promotions', label: 'Khuyến mãi' },
  { to: '/admin/reconciliation', label: 'Đối soát & email' },
];

export function AdminShell() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-side__brand">
          <Logo small to="/admin" />
          <span className="admin-side__kicker">QUẢN TRỊ</span>
        </div>
        <nav className="stack" style={{ gap: 4 }}>
          {ADMIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              className={({ isActive }) => `admin-nav__item${isActive ? ' is-active' : ''}`}
            >
              <span>{item.label}</span>
              {item.badge && <span className="admin-nav__badge">{item.badge}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="grow" />
        <Link to="/" className="admin-nav__item">
          ← Về trang khách
        </Link>
        <div className="admin-side__user">
          <Avatar name={user?.name} size={32} color="var(--accent-ink)" />
          <div className="stack">
            <span style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</span>
            <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{user?.role}</span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            title="Đăng xuất"
            style={{ marginLeft: 'auto', color: 'var(--danger-ink)', fontSize: 12, fontWeight: 600 }}
          >
            Thoát
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

/** Topbar for an admin page: title on the left, actions on the right. */
export function AdminTopbar({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="admin-topbar">
      <h1 className="admin-title">{title}</h1>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{actions}</div>
    </div>
  );
}

/* ---------- Staff ---------- */

const STAFF_NAV = [
  { to: '/staff', label: 'Bán vé tại quầy' },
  { to: '/staff/check-in', label: 'Soát vé' },
  { to: '/staff/refunds', label: 'Hủy & hoàn tiền' },
];

export function StaffShell() {
  const { user, logout } = useAuth();
  const now = new Date();

  return (
    <div className="staff-shell">
      <div className="staff-topbar">
        <div className="staff-topbar__left">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Logo small to="/staff" />
            <span className="admin-side__kicker">NHÂN VIÊN</span>
          </div>
          <nav className="staff-tabs">
            {STAFF_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/staff'}
                className={({ isActive }) => `staff-tabs__item${isActive ? ' is-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="staff-topbar__right">
          <span>
            {dowDate(now)} · {hhmm(now)}
          </span>
          <Avatar name={user?.name} size={34} background="var(--line-strong)" color="var(--ink)" />
          <Button variant="ghost" size="xs" onClick={() => void logout()}>
            Đăng xuất
          </Button>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
