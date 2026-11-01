import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { voucherApi } from '@/api/endpoints';
import type { VoucherResponseDTO, VoucherType } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Toggle,
} from '@/components/ui';
import { ddmmyyyy, vnd } from '@/lib/format';
import { useToast } from '@/store/toast';
import './admin.css';

const GRID = '1.3fr 1fr 1fr 1.5fr 1.2fr 110px 90px';

interface VoucherForm {
  code: string;
  type: VoucherType;
  value: string;
  maxDiscount: string;
  minOrderValue: string;
  quantity: string;
  startAt: string;
  expiredAt: string;
  isActive: boolean;
}

const EMPTY: VoucherForm = {
  code: '',
  type: 'FIXED_AMOUNT',
  value: '20000',
  maxDiscount: '',
  minOrderValue: '',
  quantity: '100',
  startAt: '',
  expiredAt: '',
  isActive: true,
};

/** Turns a voucher's state into the status chip the design shows. */
function statusOf(voucher: VoucherResponseDTO): { label: string; bg: string; fg: string } {
  const now = Date.now();
  if (voucher.isDeleted) return { label: 'ĐÃ XÓA', bg: 'var(--surface-disabled)', fg: 'var(--ink-5)' };
  if (voucher.usedCount >= voucher.quantity) return { label: 'HẾT LƯỢT', bg: 'var(--danger)', fg: '#fff' };
  if (new Date(voucher.expiredAt).getTime() <= now)
    return { label: 'HẾT HẠN', bg: 'var(--surface-disabled)', fg: 'var(--ink-5)' };
  if (!voucher.isActive) return { label: 'TẠM TẮT', bg: 'var(--line-strong)', fg: 'var(--ink-3)' };
  if (new Date(voucher.startAt).getTime() > now)
    return { label: 'CHƯA MỞ', bg: 'var(--info)', fg: 'var(--info-deep)' };
  return { label: 'ĐANG CHẠY', bg: 'var(--ok)', fg: '#fff' };
}

/** LocalDateTime body format the backend expects. */
function toLocalDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

/** 5f — voucher campaigns. */
export default function AdminVouchersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [modal, setModal] = useState<'create' | VoucherResponseDTO | null>(null);
  const [form, setForm] = useState<VoucherForm>(EMPTY);

  const vouchers = useQuery({
    queryKey: ['admin', 'vouchers', page],
    queryFn: () => voucherApi.adminList({ page, size: 20 }),
  });

  const save = useMutation({
    mutationFn: () => {
      const base = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: Number(form.value),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
        minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : null,
        quantity: Number(form.quantity),
        startAt: toLocalDateTime(form.startAt),
        expiredAt: toLocalDateTime(form.expiredAt),
      };
      if (modal === 'create') return voucherApi.adminCreate(base);
      return voucherApi.adminUpdate({
        ...base,
        voucherId: (modal as VoucherResponseDTO).voucherId,
        isActive: form.isActive,
        isDeleted: (modal as VoucherResponseDTO).isDeleted,
      });
    },
    onSuccess: () => {
      toast.success(modal === 'create' ? 'Đã tạo voucher.' : 'Đã lưu voucher.');
      setModal(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'vouchers'] });
    },
    onError: (error) => toast.error(error),
  });

  const toggleActive = useMutation({
    mutationFn: (voucher: VoucherResponseDTO) =>
      voucherApi.adminUpdate({
        voucherId: voucher.voucherId,
        code: voucher.code,
        type: voucher.type,
        value: voucher.value,
        maxDiscount: voucher.maxDiscount,
        minOrderValue: voucher.minOrderValue,
        quantity: voucher.quantity,
        startAt: voucher.startAt,
        expiredAt: voucher.expiredAt,
        isActive: !voucher.isActive,
        isDeleted: voucher.isDeleted,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'vouchers'] }),
    onError: (error) => toast.error(error),
  });

  const remove = useMutation({
    mutationFn: (voucherId: number) => voucherApi.adminDelete(voucherId),
    onSuccess: () => {
      toast.success('Đã xóa voucher.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'vouchers'] });
    },
    onError: (error) => toast.error(error),
  });

  function openEdit(voucher: VoucherResponseDTO) {
    setForm({
      code: voucher.code,
      type: voucher.type,
      value: String(voucher.value),
      maxDiscount: voucher.maxDiscount ? String(voucher.maxDiscount) : '',
      minOrderValue: voucher.minOrderValue ? String(voucher.minOrderValue) : '',
      quantity: String(voucher.quantity),
      startAt: voucher.startAt.slice(0, 16),
      expiredAt: voucher.expiredAt.slice(0, 16),
      isActive: voucher.isActive,
    });
    setModal(voucher);
  }

  // A percentage voucher must declare a cap (backend rule).
  const percentNeedsCap = form.type === 'PERCENT' && !form.maxDiscount;
  const canSave =
    form.code.trim().length > 0 &&
    Number(form.value) > 0 &&
    Number(form.quantity) > 0 &&
    form.startAt &&
    form.expiredAt &&
    form.startAt !== form.expiredAt &&
    !percentNeedsCap;

  return (
    <>
      <AdminTopbar
        title="Voucher"
        actions={
          <Button
            size="xs"
            onClick={() => {
              setForm({ ...EMPTY });
              setModal('create');
            }}
          >
            + Tạo voucher
          </Button>
        }
      />

      <div className="admin-page">
        {vouchers.isLoading ? (
          <Loading />
        ) : vouchers.isError ? (
          <ErrorState error={vouchers.error} onRetry={() => void vouchers.refetch()} />
        ) : (vouchers.data?.content.length ?? 0) === 0 ? (
          <EmptyState title="Chưa có voucher" description="Bấm “Tạo voucher” để thêm chương trình mới." />
        ) : (
          <div className="table">
            <div className="table__head" style={{ gridTemplateColumns: GRID }}>
              <span>MÃ</span>
              <span>GIẢM</span>
              <span>ĐƠN TỐI THIỂU</span>
              <span>ĐÃ DÙNG</span>
              <span>HIỆU LỰC</span>
              <span>TRẠNG THÁI</span>
              <span />
            </div>

            {vouchers.data?.content.map((voucher) => {
              const status = statusOf(voucher);
              const used = voucher.quantity > 0 ? Math.round((voucher.usedCount / voucher.quantity) * 100) : 0;
              return (
                <div className="table__row" style={{ gridTemplateColumns: GRID }} key={voucher.voucherId}>
                  <button
                    type="button"
                    className="mono"
                    style={{ fontWeight: 700, fontSize: 14, textAlign: 'left' }}
                    onClick={() => openEdit(voucher)}
                  >
                    {voucher.code}
                  </button>

                  <div className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>
                      {voucher.type === 'PERCENT' ? `${voucher.value}%` : vnd(voucher.value)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                      {voucher.type === 'PERCENT'
                        ? voucher.maxDiscount
                          ? `Tối đa ${vnd(voucher.maxDiscount)}`
                          : 'Chưa có mức tối đa'
                        : 'Cố định'}
                    </span>
                  </div>

                  <span style={{ color: 'var(--ink-3)' }}>
                    {voucher.minOrderValue ? vnd(voucher.minOrderValue) : '0đ'}
                  </span>

                  <div className="stack" style={{ gap: 5 }}>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--line)' }}>
                      <div
                        style={{
                          width: `${Math.min(100, used)}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: 'var(--accent)',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>
                      {voucher.usedCount} / {voucher.quantity}
                    </span>
                  </div>

                  <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
                    {ddmmyyyy(voucher.startAt)} – {ddmmyyyy(voucher.expiredAt)}
                  </span>

                  <span className="badge" style={{ background: status.bg, color: status.fg, justifySelf: 'start' }}>
                    {status.label}
                  </span>

                  <span style={{ display: 'flex', gap: 8, alignItems: 'center', justifySelf: 'end' }}>
                    <Toggle
                      on={voucher.isActive}
                      label={`Bật/tắt ${voucher.code}`}
                      disabled={toggleActive.isPending}
                      onToggle={() => toggleActive.mutate(voucher)}
                    />
                    <button
                      type="button"
                      aria-label={`Xóa ${voucher.code}`}
                      style={{ color: 'var(--danger-ink)', fontSize: 16 }}
                      onClick={() => {
                        if (window.confirm(`Xóa voucher ${voucher.code}?`)) remove.mutate(voucher.voucherId);
                      }}
                    >
                      ×
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {(vouchers.data?.totalPages ?? 1) > 1 && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button
              variant="outline"
              size="xs"
              disabled={vouchers.data?.first}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              ‹ Trước
            </Button>
            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
              Trang {(vouchers.data?.number ?? 0) + 1} / {vouchers.data?.totalPages}
            </span>
            <Button
              variant="outline"
              size="xs"
              disabled={vouchers.data?.last}
              onClick={() => setPage((current) => current + 1)}
            >
              Sau ›
            </Button>
          </div>
        )}

        <span className="note">
          Voucher % bắt buộc có mức giảm tối đa. Booking hết hạn sẽ trả lại lượt; booking đã thanh toán rồi hủy
          không trả lượt.
        </span>
      </div>

      {/* ---- Create / edit ---- */}
      <Modal open={modal !== null} onClose={() => setModal(null)} width={520}>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <span className="display" style={{ fontSize: 34 }}>
            {modal === 'create' ? 'Tạo voucher' : 'Sửa voucher'}
          </span>

          <Field label="Mã *" hint="Chữ in hoa, không dấu.">
            <Input
              small
              required
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Loại *">
              <select
                className="input input--sm"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as VoucherType })}
              >
                <option value="FIXED_AMOUNT">Số tiền cố định</option>
                <option value="PERCENT">Phần trăm</option>
              </select>
            </Field>
            <Field label={form.type === 'PERCENT' ? 'Giá trị (%) *' : 'Giá trị (đ) *'}>
              <Input
                small
                type="number"
                min={1}
                required
                value={form.value}
                onChange={(event) => setForm({ ...form, value: event.target.value })}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field
              label="Giảm tối đa (đ)"
              error={percentNeedsCap ? 'Voucher % bắt buộc có mức giảm tối đa.' : undefined}
            >
              <Input
                small
                type="number"
                min={0}
                value={form.maxDiscount}
                aria-invalid={percentNeedsCap ? 'true' : undefined}
                onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })}
              />
            </Field>
            <Field label="Đơn tối thiểu (đ)">
              <Input
                small
                type="number"
                min={0}
                value={form.minOrderValue}
                onChange={(event) => setForm({ ...form, minOrderValue: event.target.value })}
              />
            </Field>
          </div>

          <Field label="Số lượt *">
            <Input
              small
              type="number"
              min={1}
              required
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: event.target.value })}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Bắt đầu *">
              <Input
                small
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(event) => setForm({ ...form, startAt: event.target.value })}
              />
            </Field>
            <Field
              label="Kết thúc *"
              error={form.startAt && form.startAt === form.expiredAt ? 'Hai mốc phải khác nhau.' : undefined}
            >
              <Input
                small
                type="datetime-local"
                required
                value={form.expiredAt}
                onChange={(event) => setForm({ ...form, expiredAt: event.target.value })}
              />
            </Field>
          </div>

          {modal !== 'create' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
              Đang hoạt động
              <Toggle
                on={form.isActive}
                label="Đang hoạt động"
                onToggle={() => setForm({ ...form, isActive: !form.isActive })}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button type="button" variant="outline" size="sm" onClick={() => setModal(null)}>
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={!canSave} loading={save.isPending}>
              Lưu
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
