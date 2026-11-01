import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { promotionApi } from '@/api/endpoints';
import type { PromotionArticleResponse } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Textarea,
  Toggle,
} from '@/components/ui';
import { ddmmyyyy } from '@/lib/format';
import { posterTint } from '@/lib/palette';
import { useToast } from '@/store/toast';
import './admin.css';

interface PromoForm {
  title: string;
  shortDescription: string;
  startDate: string;
  endDate: string;
  conditions: string;
  imageUrl: string;
  note: string;
  isActive: boolean;
}

const EMPTY: PromoForm = {
  title: '',
  shortDescription: '',
  startDate: '',
  endDate: '',
  conditions: '',
  imageUrl: '',
  note: '',
  isActive: true,
};

function toForm(article: PromotionArticleResponse): PromoForm {
  return {
    title: article.title ?? '',
    shortDescription: article.shortDescription ?? '',
    startDate: article.startDate ?? '',
    endDate: article.endDate ?? '',
    conditions: article.conditions ?? '',
    imageUrl: article.imageUrl ?? '',
    note: article.note ?? '',
    isActive: article.isActive ?? true,
  };
}

/** 5h — promotion articles. These endpoints return DTOs unwrapped. */
export default function AdminPromotionsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  /** null = creating, number = editing that article. */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<PromoForm>(EMPTY);

  const list = useQuery({
    queryKey: ['admin', 'promotions', page],
    queryFn: () => promotionApi.adminList({ page, size: 10 }),
  });

  const detail = useQuery({
    queryKey: ['admin', 'promotion', editingId],
    queryFn: () => promotionApi.adminDetail(editingId!),
    enabled: editingId !== null,
  });

  useEffect(() => {
    if (detail.data && detail.data.promotionId === editingId) setForm(toForm(detail.data));
  }, [detail.data, editingId]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        shortDescription: form.shortDescription.trim(),
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        conditions: form.conditions.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        note: form.note.trim() || null,
        isActive: form.isActive,
      };
      return editingId === null
        ? promotionApi.adminCreate(payload)
        : promotionApi.adminUpdate(editingId, payload);
    },
    onSuccess: (saved) => {
      toast.success(editingId === null ? 'Đã tạo bài viết.' : 'Đã lưu bài viết.');
      setEditingId(saved.promotionId);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
      void queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: (error) => toast.error(error),
  });

  const remove = useMutation({
    mutationFn: (id: number) => promotionApi.adminDelete(id),
    onSuccess: () => {
      toast.success('Đã xóa bài viết.');
      setEditingId(null);
      setForm(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'promotions'] });
      void queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: (error) => toast.error(error),
  });

  const canSave = form.title.trim().length > 0 && form.shortDescription.trim().length > 0;

  return (
    <>
      <AdminTopbar
        title="Bài viết khuyến mãi"
        actions={
          <Button
            size="xs"
            onClick={() => {
              setEditingId(null);
              setForm({ ...EMPTY });
            }}
          >
            + Bài viết mới
          </Button>
        }
      />

      <div className="admin-split" style={{ ['--aside' as string]: '460px' }}>
        <div className="admin-split__main">
          {list.isLoading ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => void list.refetch()} />
          ) : (list.data?.content.length ?? 0) === 0 ? (
            <EmptyState title="Chưa có bài viết" description="Bấm “Bài viết mới” để tạo bài đầu tiên." />
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {list.data?.content.map((article) => (
                <button
                  type="button"
                  key={article.promotionId}
                  className="promo-admin-row"
                  data-selected={article.promotionId === editingId}
                  onClick={() => setEditingId(article.promotionId)}
                >
                  {article.imageUrl ? (
                    <img className="promo-admin-row__thumb" src={article.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span
                      className="promo-admin-row__thumb"
                      style={{ background: posterTint(article.promotionId) }}
                    />
                  )}
                  <div className="stack" style={{ flex: 1, gap: 3, minWidth: 0, textAlign: 'left' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{article.title}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{article.shortDescription}</span>
                    <span className="mono" style={{ fontSize: 11, color: 'var(--ink-5)' }}>
                      {ddmmyyyy(article.createdAt)}
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      background: article.isActive ? 'var(--ok)' : 'var(--line-strong)',
                      color: article.isActive ? '#fff' : 'var(--ink-3)',
                    }}
                  >
                    {article.isActive ? 'HIỂN THỊ' : 'ẨN'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {(list.data?.totalPages ?? 1) > 1 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Button
                variant="outline"
                size="xs"
                disabled={list.data?.first}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                ‹ Trước
              </Button>
              <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                Trang {(list.data?.number ?? 0) + 1} / {list.data?.totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={list.data?.last}
                onClick={() => setPage((current) => current + 1)}
              >
                Sau ›
              </Button>
            </div>
          )}
        </div>

        {/* ---- Editor ---- */}
        <aside className="admin-split__aside">
          <div className="row-between">
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {editingId === null ? 'Bài viết mới' : 'Sửa bài viết'}
            </span>
            {editingId !== null && <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>ID #{editingId}</span>}
          </div>

          {editingId !== null && detail.isLoading ? (
            <Loading inline />
          ) : (
            <form
              className="stack"
              style={{ gap: 14, flex: 1 }}
              onSubmit={(event) => {
                event.preventDefault();
                if (canSave) save.mutate();
              }}
            >
              {form.imageUrl ? (
                <img className="cover-ph" src={form.imageUrl} alt="Ảnh bìa" />
              ) : (
                <div className="cover-ph" style={{ background: '#c8d8ea' }}>
                  ảnh bìa 16:9
                </div>
              )}

              <Field label="Ảnh bìa (URL)">
                <Input
                  small
                  placeholder="https://…"
                  value={form.imageUrl}
                  onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
                />
              </Field>

              <Field label="Tiêu đề *">
                <Input
                  small
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </Field>

              <Field label="Mô tả ngắn *">
                <Textarea
                  rows={3}
                  required
                  value={form.shortDescription}
                  onChange={(event) => setForm({ ...form, shortDescription: event.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Bắt đầu">
                  <Input
                    small
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                  />
                </Field>
                <Field label="Kết thúc">
                  <Input
                    small
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setForm({ ...form, endDate: event.target.value })}
                  />
                </Field>
              </div>

              <Field label="Điều kiện">
                <Textarea
                  rows={3}
                  value={form.conditions}
                  onChange={(event) => setForm({ ...form, conditions: event.target.value })}
                />
              </Field>

              <Field label="Ghi chú nội bộ">
                <Input
                  small
                  value={form.note}
                  onChange={(event) => setForm({ ...form, note: event.target.value })}
                />
              </Field>

              <div className="grow" />

              <div className="row-between">
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  Hiển thị công khai
                  <Toggle
                    on={form.isActive}
                    label="Hiển thị công khai"
                    onToggle={() => setForm({ ...form, isActive: !form.isActive })}
                  />
                </span>
                <div style={{ display: 'flex', gap: 10 }}>
                  {editingId !== null && (
                    <Button
                      type="button"
                      variant="danger-outline"
                      size="xs"
                      loading={remove.isPending}
                      onClick={() => {
                        if (window.confirm('Xóa bài viết này?')) remove.mutate(editingId);
                      }}
                    >
                      Xóa
                    </Button>
                  )}
                  <Button type="submit" size="xs" disabled={!canSave} loading={save.isPending}>
                    Lưu bài viết
                  </Button>
                </div>
              </div>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
