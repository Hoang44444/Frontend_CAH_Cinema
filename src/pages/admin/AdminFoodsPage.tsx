import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { foodApi } from '@/api/endpoints';
import type { FoodCategory, FoodDTO } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Pill,
  Textarea,
  Toggle,
} from '@/components/ui';
import { vnd } from '@/lib/format';
import { useToast } from '@/store/toast';
import './admin.css';

const CATEGORIES: Array<'Tất cả' | FoodCategory> = ['Tất cả', 'Combo', 'Food', 'Drink'];

interface FoodForm {
  name: string;
  description: string;
  price: string;
  category: FoodCategory;
  imageUrl: string;
  available: boolean;
}

const EMPTY: FoodForm = {
  name: '',
  description: '',
  price: '',
  category: 'Combo',
  imageUrl: '',
  available: true,
};

/** 5g — food & drink catalogue. */
export default function AdminFoodsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<(typeof CATEGORIES)[number]>('Tất cả');
  const [modal, setModal] = useState<'create' | FoodDTO | null>(null);
  const [form, setForm] = useState<FoodForm>(EMPTY);

  const foods = useQuery({ queryKey: ['admin', 'foods'], queryFn: foodApi.adminList });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        category: form.category,
        imageUrl: form.imageUrl.trim() || null,
        available: form.available,
      };
      return modal === 'create'
        ? foodApi.adminCreate(payload)
        : foodApi.adminUpdate((modal as FoodDTO).foodId, payload);
    },
    onSuccess: () => {
      toast.success(modal === 'create' ? 'Đã thêm món.' : 'Đã lưu món.');
      setModal(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'foods'] });
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
    },
    onError: (error) => toast.error(error),
  });

  const toggleAvailable = useMutation({
    mutationFn: (food: FoodDTO) =>
      foodApi.adminUpdate(food.foodId, {
        name: food.name,
        description: food.description,
        price: Number(food.price),
        category: food.category as FoodCategory,
        imageUrl: food.imageUrl,
        available: !(food.available ?? true),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'foods'] });
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
    },
    onError: (error) => toast.error(error),
  });

  const remove = useMutation({
    mutationFn: (foodId: number) => foodApi.adminDelete(foodId),
    onSuccess: () => {
      toast.success('Đã xóa món.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'foods'] });
      void queryClient.invalidateQueries({ queryKey: ['foods'] });
    },
    onError: (error) => toast.error(error),
  });

  function openEdit(food: FoodDTO) {
    setForm({
      name: food.name,
      description: food.description ?? '',
      price: String(food.price),
      category: (food.category as FoodCategory) ?? 'Combo',
      imageUrl: food.imageUrl ?? '',
      available: food.available ?? true,
    });
    setModal(food);
  }

  const visible = (foods.data ?? []).filter((food) => tab === 'Tất cả' || food.category === tab);
  const canSave = form.name.trim().length > 0 && Number(form.price) > 0;

  return (
    <>
      <AdminTopbar
        title="Bắp nước"
        actions={
          <Button
            size="xs"
            onClick={() => {
              setForm({ ...EMPTY });
              setModal('create');
            }}
          >
            + Thêm món
          </Button>
        }
      />

      <div className="admin-page">
        <div style={{ display: 'flex', gap: 6 }}>
          {CATEGORIES.map((value) => (
            <Pill key={value} active={tab === value} onClick={() => setTab(value)}>
              {value}
            </Pill>
          ))}
        </div>

        {foods.isLoading ? (
          <Loading />
        ) : foods.isError ? (
          <ErrorState error={foods.error} onRetry={() => void foods.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState title="Chưa có món nào" description="Bấm “Thêm món” để tạo món đầu tiên." />
        ) : (
          <div className="food-admin-grid">
            {visible.map((food) => {
              const available = food.available ?? true;
              return (
                <div className="food-admin" key={food.foodId} style={{ opacity: available ? 1 : 0.55 }}>
                  {food.imageUrl ? (
                    <img className="food-admin__img" src={food.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <div className="food-admin__img">
                      <span className="food-admin__cat">{food.category}</span>
                    </div>
                  )}
                  <div className="food-admin__body">
                    <button
                      type="button"
                      style={{ fontWeight: 700, fontSize: 14, textAlign: 'left' }}
                      onClick={() => openEdit(food)}
                    >
                      {food.name}
                    </button>
                    <span
                      style={{ fontSize: 12, color: 'var(--ink-4)', lineHeight: 1.4, minHeight: 34 }}
                    >
                      {food.description}
                    </span>
                    <div className="row-between" style={{ marginTop: 'auto' }}>
                      <span className="mono" style={{ fontWeight: 700 }}>
                        {vnd(Number(food.price))}
                      </span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Toggle
                          on={available}
                          label={`Mở bán ${food.name}`}
                          disabled={toggleAvailable.isPending}
                          onToggle={() => toggleAvailable.mutate(food)}
                        />
                        <button
                          type="button"
                          aria-label={`Xóa ${food.name}`}
                          style={{ color: 'var(--danger-ink)', fontSize: 16 }}
                          onClick={() => {
                            if (window.confirm(`Xóa món "${food.name}"?`)) remove.mutate(food.foodId);
                          }}
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <span className="note">
          Tắt công tắc để ẩn món khỏi <span className="mono">GET /api/v1/foods</span> (danh sách khách hàng thấy).
        </span>
      </div>

      {/* ---- Create / edit ---- */}
      <Modal open={modal !== null} onClose={() => setModal(null)} width={500}>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            if (canSave) save.mutate();
          }}
        >
          <span className="display" style={{ fontSize: 34 }}>
            {modal === 'create' ? 'Thêm món' : 'Sửa món'}
          </span>

          <Field label="Tên món *">
            <Input
              small
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </Field>

          <Field label="Mô tả">
            <Textarea
              rows={3}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Giá (đ) *">
              <Input
                small
                type="number"
                min={1}
                required
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </Field>
            <Field label="Phân loại *">
              <select
                className="input input--sm"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value as FoodCategory })}
              >
                <option value="Combo">Combo</option>
                <option value="Food">Food</option>
                <option value="Drink">Drink</option>
              </select>
            </Field>
          </div>

          <Field label="Ảnh (URL)">
            <Input
              small
              placeholder="https://…"
              value={form.imageUrl}
              onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
            />
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            Mở bán
            <Toggle
              on={form.available}
              label="Mở bán"
              onToggle={() => setForm({ ...form, available: !form.available })}
            />
          </div>

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
