import { Navigate, Route, Routes } from 'react-router-dom';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { AdminShell, RequireRole, StaffShell } from '@/components/layout/RoleShells';

import HomePage from '@/pages/public/HomePage';
import MoviesPage from '@/pages/public/MoviesPage';
import MovieDetailPage from '@/pages/public/MovieDetailPage';
import CinemasPage from '@/pages/public/CinemasPage';
import PromotionsPage from '@/pages/public/PromotionsPage';
import PromotionDetailPage from '@/pages/public/PromotionDetailPage';

import AuthPage from '@/pages/auth/AuthPage';

import SeatsPage from '@/pages/booking/SeatsPage';
import CheckoutPage from '@/pages/booking/CheckoutPage';
import PaymentResultPage from '@/pages/booking/PaymentResultPage';

import MyTicketsPage from '@/pages/account/MyTicketsPage';
import AccountPage from '@/pages/account/AccountPage';

import CounterPage from '@/pages/staff/CounterPage';
import CheckInPage from '@/pages/staff/CheckInPage';
import RefundsPage from '@/pages/staff/RefundsPage';

import AdminReportsPage from '@/pages/admin/AdminReportsPage';
import AdminMoviesPage from '@/pages/admin/AdminMoviesPage';
import AdminCinemasPage from '@/pages/admin/AdminCinemasPage';
import AdminShowtimesPage from '@/pages/admin/AdminShowtimesPage';
import AdminPricingPage from '@/pages/admin/AdminPricingPage';
import AdminVouchersPage from '@/pages/admin/AdminVouchersPage';
import AdminFoodsPage from '@/pages/admin/AdminFoodsPage';
import AdminPromotionsPage from '@/pages/admin/AdminPromotionsPage';
import AdminReconciliationPage from '@/pages/admin/AdminReconciliationPage';

import NotFoundPage from '@/pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      {/* Guest + customer web */}
      <Route element={<SiteLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/movies" element={<MoviesPage />} />
        <Route path="/movies/:movieId" element={<MovieDetailPage />} />
        <Route path="/cinemas" element={<CinemasPage />} />
        <Route path="/promotions" element={<PromotionsPage />} />
        <Route path="/promotions/:promotionId" element={<PromotionDetailPage />} />
        <Route
          path="/my-tickets"
          element={
            <RequireRole role="user">
              <MyTicketsPage />
            </RequireRole>
          }
        />
        <Route
          path="/account"
          element={
            <RequireRole role="user">
              <AccountPage />
            </RequireRole>
          }
        />
      </Route>

      {/* Auth has its own split-screen layout */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Booking flow: own header with the step indicator */}
      <Route
        path="/booking/showtimes/:showtimeId/seats"
        element={
          <RequireRole role="user">
            <SeatsPage />
          </RequireRole>
        }
      />
      <Route
        path="/booking/showtimes/:showtimeId/checkout"
        element={
          <RequireRole role="user">
            <CheckoutPage />
          </RequireRole>
        }
      />
      <Route
        path="/booking/:bookingId/result"
        element={
          <RequireRole role="user">
            <PaymentResultPage />
          </RequireRole>
        }
      />

      {/* Staff workbench */}
      <Route
        path="/staff"
        element={
          <RequireRole role="staff">
            <StaffShell />
          </RequireRole>
        }
      >
        <Route index element={<CounterPage />} />
        <Route path="check-in" element={<CheckInPage />} />
        <Route path="refunds" element={<RefundsPage />} />
      </Route>

      {/* Admin console */}
      <Route
        path="/admin"
        element={
          <RequireRole role="admin">
            <AdminShell />
          </RequireRole>
        }
      >
        <Route index element={<AdminReportsPage />} />
        <Route path="movies" element={<AdminMoviesPage />} />
        <Route path="cinemas" element={<AdminCinemasPage />} />
        <Route path="showtimes" element={<AdminShowtimesPage />} />
        <Route path="pricing" element={<AdminPricingPage />} />
        <Route path="vouchers" element={<AdminVouchersPage />} />
        <Route path="foods" element={<AdminFoodsPage />} />
        <Route path="promotions" element={<AdminPromotionsPage />} />
        <Route path="reconciliation" element={<AdminReconciliationPage />} />
      </Route>

      {/* Stripe/VNPay/MoMo send the browser back here after payment */}
      <Route path="/payment/return" element={<PaymentResultPage />} />
      {/* Backends configured with the older per-gateway return URLs land here. */}
      <Route path="/booking/vnpay-return" element={<PaymentResultPage />} />
      <Route path="/booking/momo-return" element={<PaymentResultPage />} />

      <Route path="/login" element={<Navigate to="/auth" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
