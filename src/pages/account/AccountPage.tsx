import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi, userApi, voucherApi } from '@/api/endpoints';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  StatusBadge,
  describeError,
} from '@/components/ui';
import { count, ddmmyyyy, vnd } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import './account.css';

type Tab = 'overview' | 'vouchers' | 'password';

/** Spend thresholds the design's progress bar implies for the next tier. */
const RANK_TARGET: Record<string, { next: string; target: number }> = {
  SILVER: { next: 'GOLD', target: 5_000_000 },
  GOLD: { next: 'DIAMOND', target: 10_000_000 },
};

export default function AccountPage() {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');

  const profile = useQuery({ queryKey: ['profile'], queryFn: userApi.me });
  const vouchers = useQuery({
    queryKey: ['vouchers', 'mine'],
    queryFn: voucherApi.mine,
    enabled: tab === 'vouchers',
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Seed the editable fields once the profile lands.
  useEffect(() => {
    if (profile.data?.user) {
      setName(profile.data.user.name ?? '');
      setPhone(profile.data.user.phone ?? '');
    }
  }, [profile.data]);

  const saveProfile = useMutation({
    mutationFn: () => userApi.updateMe({ name: name.trim(), phone: phone.trim() || undefined }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Đã lưu thông tin cá nhân.');
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error) => toast.error(error),
  });

  if (profile.isLoading) return <Loading label="Đang tải tài khoản…" />;
  if (profile.isError) return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;

  const me = profile.data?.user ?? user;
  const invoices = profile.data?.recentInvoices ?? [];
  const rank = (me?.rankLevel ?? 'SILVER') as string;
  const spent = Number(me?.totalPaid ?? 0);
  const target = RANK_TARGET[rank];
  const progress = target ? Math.min(100, Math.round((spent / target.target) * 100)) : 100;

  return (
    <div className="account-layout">
      {/* ---- Side menu ---- */}
      <nav className="account-menu">
        <div className="account-menu__user">
          <Avatar name={me?.name} size={52} />
          <div className="stack" style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{me?.name}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-4)', overflowWrap: 'anywhere' }}>{me?.email}</span>
          </div>
        </div>

        <button
          type="button"
          className="account-menu__item"
          data-active={tab === 'overview'}
          onClick={() => setTab('overview')}
        >
          Tổng quan
        </button>
        <Link to="/my-tickets" className="account-menu__item">
          Vé của tôi
        </Link>
        <button
          type="button"
          className="account-menu__item"
          data-active={tab === 'vouchers'}
          onClick={() => setTab('vouchers')}
        >
          Voucher của tôi
        </button>
        <button
          type="button"
          className="account-menu__item"
          data-active={tab === 'password'}
          onClick={() => setTab('password')}
        >
          Đổi mật khẩu
        </button>
        <button
          type="button"
          className="account-menu__item account-menu__item--danger"
          onClick={async () => {
            await logout();
            navigate('/');
          }}
        >
          Đăng xuất
        </button>
      </nav>

      <div className="stack" style={{ gap: 24, minWidth: 0 }}>
        {tab === 'overview' && (
          <>
            <div className="account-top">
              {/* Membership tier */}
              <div
                className="rank-card"
                style={{
                  background:
                    rank === 'DIAMOND'
                      ? 'var(--rank-diamond)'
                      : rank === 'GOLD'
                        ? 'var(--rank-gold)'
                        : 'var(--rank-silver)',
                }}
              >
                <div className="row-between" style={{ alignItems: 'flex-start' }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <span className="rank-card__kicker">HẠNG THÀNH VIÊN</span>
                    <span className="rank-card__level">{rank}</span>
                  </div>
                  <div className="stack" style={{ gap: 2, alignItems: 'flex-end' }}>
                    <span className="rank-card__kicker">ĐIỂM</span>
                    <span className="rank-card__points">{count(me?.totalPoint ?? 0)}</span>
                  </div>
                </div>

                <div className="stack" style={{ gap: 6 }}>
                  <div className="rank-card__track">
                    <div className="rank-card__fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="row-between" style={{ fontSize: 13, fontWeight: 600 }}>
                    <span>Đã chi {vnd(spent)}</span>
                    <span>
                      {target
                        ? `Còn ${vnd(Math.max(0, target.target - spent))} lên ${target.next}`
                        : 'Hạng cao nhất'}
                    </span>
                  </div>
                </div>

                <span style={{ fontSize: 13, lineHeight: 1.45 }}>
                  Hoàn tiền thành công sẽ trừ lại chi tiêu và điểm tương ứng.
                </span>
              </div>

              {/* Editable profile */}
              <Card style={{ padding: 22, borderRadius: 20 }}>
                <form
                  className="stack"
                  style={{ gap: 12 }}
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveProfile.mutate();
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 16 }}>Thông tin cá nhân</span>

                  <Field label="Họ tên">
                    <Input
                      small
                      required
                      minLength={2}
                      maxLength={100}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </Field>
                  <Field label="Điện thoại" hint="9–11 ký tự nếu có.">
                    <Input small value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </Field>
                  <Field label="Email (không đổi được)">
                    <Input small value={me?.email ?? ''} readOnly disabled />
                  </Field>

                  <Button
                    type="submit"
                    variant="dark"
                    size="xs"
                    style={{ alignSelf: 'flex-end' }}
                    loading={saveProfile.isPending}
                  >
                    Lưu
                  </Button>
                </form>
              </Card>
            </div>

            {/* Recent invoices */}
            <Card style={{ padding: '8px 22px', borderRadius: 20 }}>
              <div className="row-between" style={{ padding: '14px 0' }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>Hóa đơn gần đây</span>
                <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>5 gần nhất</span>
              </div>
              {invoices.length === 0 ? (
                <EmptyState title="Chưa có hóa đơn" description="Các booking của bạn sẽ hiện ở đây." />
              ) : (
                invoices.map((invoice) => (
                  <div className="invoice-row" key={invoice.bookingId}>
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>
                        {invoice.movieTitle ?? `Booking #${invoice.bookingId}`}
                        {invoice.movieFormat ? ` · ${invoice.movieFormat}` : ''}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                        {invoice.cinemaName ?? '—'} · {invoice.seats?.length ?? 0} vé
                        {invoice.foodTotalPrice ? ' + combo' : ''}
                      </span>
                    </div>
                    <div className="stack" style={{ gap: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                        {ddmmyyyy(invoice.bookingCreatedAt)}
                      </span>
                      <StatusBadge status={invoice.bookingStatus} />
                    </div>
                    <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {vnd(invoice.totalPrice)}
                    </span>
                  </div>
                ))
              )}
            </Card>
          </>
        )}

        {tab === 'vouchers' && (
          <Card pad style={{ borderRadius: 20 }}>
            <div className="stack" style={{ gap: 16 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Voucher của tôi</span>
              {vouchers.isLoading ? (
                <Loading inline />
              ) : vouchers.isError ? (
                <ErrorState error={vouchers.error} onRetry={() => void vouchers.refetch()} />
              ) : (vouchers.data?.length ?? 0) === 0 ? (
                <EmptyState title="Chưa có voucher" description="Voucher khả dụng sẽ hiện ở đây." />
              ) : (
                <div className="voucher-mine">
                  {vouchers.data?.map((voucher) => (
                    <div className="voucher" key={voucher.voucherId} style={{ cursor: 'default' }}>
                      <div className="voucher__stub" style={{ background: 'var(--accent)' }}>
                        <span className="voucher__big">
                          {voucher.type === 'PERCENT'
                            ? `${voucher.value}%`
                            : `${Math.round(voucher.value / 1000)}K`}
                        </span>
                        <span className="voucher__unit">
                          {voucher.type === 'PERCENT' && voucher.maxDiscount
                            ? `TỐI ĐA ${Math.round(voucher.maxDiscount / 1000)}K`
                            : 'GIẢM'}
                        </span>
                      </div>
                      <div className="voucher__body">
                        <span className="voucher__code">{voucher.code}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                          {voucher.minOrderValue ? `Đơn từ ${vnd(voucher.minOrderValue)}` : 'Mọi đơn hàng'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>
                          HSD {ddmmyyyy(voucher.expiredAt)} · còn{' '}
                          {Math.max(0, voucher.quantity - voucher.usedCount)} lượt
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        )}

        {tab === 'password' && <ChangePasswordCard />}
      </div>
    </div>
  );
}

function ChangePasswordCard() {
  const toast = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => authApi.changePassword(oldPassword, newPassword),
    onSuccess: () => {
      setOldPassword('');
      setNewPassword('');
      setConfirm('');
      setError(null);
      toast.success('Đã đổi mật khẩu.');
    },
    onError: (caught) => setError(describeError(caught)),
  });

  const mismatch = confirm.length > 0 && confirm !== newPassword;

  return (
    <Card pad style={{ borderRadius: 20, maxWidth: 520 }}>
      <form
        className="stack"
        style={{ gap: 14 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (mismatch) return;
          change.mutate();
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16 }}>Đổi mật khẩu</span>

        <Field label="Mật khẩu hiện tại">
          <Input
            small
            type="password"
            required
            autoComplete="current-password"
            value={oldPassword}
            onChange={(event) => setOldPassword(event.target.value)}
          />
        </Field>
        <Field label="Mật khẩu mới" hint="Ít nhất 8 ký tự.">
          <Input
            small
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </Field>
        <Field label="Nhập lại mật khẩu mới" error={mismatch ? 'Mật khẩu nhập lại chưa khớp.' : error}>
          <Input
            small
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            aria-invalid={mismatch ? 'true' : undefined}
          />
        </Field>

        <Button
          type="submit"
          size="sm"
          style={{ alignSelf: 'flex-start' }}
          disabled={mismatch || newPassword.length < 8}
          loading={change.isPending}
        >
          Đổi mật khẩu
        </Button>
      </form>
    </Card>
  );
}
