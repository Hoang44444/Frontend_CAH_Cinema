import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { holidayApi, priceConfigApi } from '@/api/endpoints';
import type { DayType, MovieFormat, PriceConfigResponse, TimeSlot } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  Modal,
  Segmented,
  Toggle,
} from '@/components/ui';
import { ddmmyyyy, isoDate, vnd } from '@/lib/format';
import { useToast } from '@/store/toast';
import './admin.css';

const FORMATS: MovieFormat[] = ['2D', '3D', 'IMAX'];
const DAY_TYPES: Array<{ value: DayType; label: string }> = [
  { value: 'WEEKDAY', label: 'Ngày thường' },
  { value: 'WEEKEND', label: 'Cuối tuần' },
  { value: 'HOLIDAY', label: 'Ngày lễ' },
];
const SLOTS: Array<{ value: TimeSlot; label: string }> = [
  { value: 'MORNING', label: 'Sáng' },
  { value: 'AFTERNOON', label: 'Chiều' },
  { value: 'EVENING', label: 'Tối' },
];

/** Reference ticket price used to preview what a multiplier means in đồng. */
const SAMPLE_BASE = 85_000;

/** 5e — price multipliers per day type / time slot / format, plus holidays. */
export default function AdminPricingPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [format, setFormat] = useState<MovieFormat>('2D');
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [holidayModal, setHolidayModal] = useState<'create' | number | null>(null);
  const [holidayForm, setHolidayForm] = useState({ date: isoDate(new Date()), name: '', isRecurring: true });

  const configs = useQuery({ queryKey: ['admin', 'price-config'], queryFn: priceConfigApi.all });
  const holidays = useQuery({ queryKey: ['admin', 'holidays'], queryFn: holidayApi.all });

  /** configId lookup by (dayType, timeSlot, format). */
  const byCell = useMemo(() => {
    const map = new Map<string, PriceConfigResponse>();
    for (const config of configs.data ?? []) {
      map.set(`${config.dayType}|${config.timeSlot}|${config.movieFormat}`, config);
    }
    return map;
  }, [configs.data]);

  const updateConfig = useMutation({
    mutationFn: (payload: { config: PriceConfigResponse; multiplier: number }) =>
      priceConfigApi.update({
        configId: payload.config.configId,
        dayType: payload.config.dayType,
        timeSlot: payload.config.timeSlot,
        movieFormat: payload.config.movieFormat,
        multiplier: payload.multiplier,
      }),
    onSuccess: (_, variables) => {
      toast.success('Đã cập nhật hệ số giá.');
      setDraft((current) => {
        const copy = { ...current };
        delete copy[variables.config.configId];
        return copy;
      });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'price-config'] });
    },
    onError: (error) => toast.error(error),
  });

  const saveHoliday = useMutation({
    mutationFn: () =>
      holidayModal === 'create'
        ? holidayApi.create({
            date: holidayForm.date,
            name: holidayForm.name.trim(),
            isRecurring: holidayForm.isRecurring,
          })
        : holidayApi.update({
            holidayId: holidayModal as number,
            date: holidayForm.date,
            name: holidayForm.name.trim(),
            isRecurring: holidayForm.isRecurring,
          }),
    onSuccess: () => {
      toast.success(holidayModal === 'create' ? 'Đã thêm ngày lễ.' : 'Đã cập nhật ngày lễ.');
      setHolidayModal(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });
    },
    onError: (error) => toast.error(error),
  });

  const toggleRecurring = useMutation({
    mutationFn: (payload: { holidayId: number; date: string; name: string; isRecurring: boolean }) =>
      holidayApi.update(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });
    },
    onError: (error) => toast.error(error),
  });

  const removeHoliday = useMutation({
    mutationFn: (holidayId: number) => holidayApi.remove(holidayId),
    onSuccess: () => {
      toast.success('Đã xóa ngày lễ.');
      void queryClient.invalidateQueries({ queryKey: ['admin', 'holidays'] });
    },
    onError: (error) => toast.error(error),
  });

  return (
    <>
      <AdminTopbar title="Cấu hình giá & ngày lễ" />

      <div
        className="admin-page"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}
      >
        {/* ---- Price multipliers ---- */}
        <Card flat style={{ padding: '20px 22px' }}>
          <div className="stack" style={{ gap: 16 }}>
            <div className="row-between" style={{ gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Hệ số giá theo ngày &amp; khung giờ</span>
              <Segmented<MovieFormat>
                accent
                value={format}
                onChange={setFormat}
                options={FORMATS.map((value) => ({ value, label: value }))}
              />
            </div>

            {configs.isLoading ? (
              <Loading inline />
            ) : configs.isError ? (
              <ErrorState error={configs.error} onRetry={() => void configs.refetch()} />
            ) : (configs.data?.length ?? 0) === 0 ? (
              <EmptyState
                title="Chưa có cấu hình giá"
                description="Bảng price_configs trống. Seed dữ liệu bằng seed_background_data.sql trước."
              />
            ) : (
              <div className="price-grid">
                <span />
                {SLOTS.map((slot) => (
                  <span key={slot.value} style={{ color: 'var(--ink-5)', fontWeight: 600 }}>
                    {slot.label}
                  </span>
                ))}

                {DAY_TYPES.map((dayType) => (
                  <div key={dayType.value} style={{ display: 'contents' }}>
                    <span style={{ fontWeight: 600, alignSelf: 'center' }}>{dayType.label}</span>
                    {SLOTS.map((slot) => {
                      const config = byCell.get(`${dayType.value}|${slot.value}|${format}`);
                      if (!config) {
                        return (
                          <div className="price-cell" key={slot.value} style={{ opacity: 0.6 }}>
                            <span className="price-cell__m">—</span>
                            <span className="price-cell__p">chưa cấu hình</span>
                          </div>
                        );
                      }
                      const pending = draft[config.configId];
                      const value = pending ?? String(config.multiplier);
                      const numeric = Number(value);
                      return (
                        <div
                          className="price-cell"
                          key={slot.value}
                          data-high={Number(config.multiplier) >= 1.5}
                        >
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className="price-cell__m">×</span>
                            <input
                              className="price-cell__input"
                              type="number"
                              step="0.05"
                              min="0.01"
                              max="999.99"
                              value={value}
                              aria-label={`Hệ số ${dayType.label} ${slot.label} ${format}`}
                              onChange={(event) =>
                                setDraft({ ...draft, [config.configId]: event.target.value })
                              }
                              onBlur={() => {
                                if (pending === undefined) return;
                                if (!Number.isFinite(numeric) || numeric <= 0) {
                                  setDraft((current) => {
                                    const copy = { ...current };
                                    delete copy[config.configId];
                                    return copy;
                                  });
                                  return;
                                }
                                if (numeric !== Number(config.multiplier)) {
                                  updateConfig.mutate({ config, multiplier: numeric });
                                }
                              }}
                            />
                          </span>
                          <span className="price-cell__p">
                            {vnd(Math.round((SAMPLE_BASE * (Number.isFinite(numeric) ? numeric : 1)) / 1000) * 1000)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <span className="note">
              Giá vé = giá gốc suất × hệ số loại ghế × hệ số ngày/khung giờ/định dạng. Ví dụ trên dùng giá gốc{' '}
              {vnd(SAMPLE_BASE)}, ghế thường. Booking đã tạo giữ nguyên giá cũ. Sửa ô rồi rời khỏi ô để lưu.
            </span>

            <div className="mult-grid">
              {[
                { label: 'Thường', m: '1.00', border: 'var(--seat-normal)' },
                { label: 'VIP', m: '1.25', border: 'var(--seat-vip)' },
                { label: 'Đôi', m: '1.80', border: 'var(--seat-couple)' },
                { label: 'Lối đi', m: '0.00', border: 'var(--line-strong)' },
              ].map((item) => (
                <div className="mult" key={item.label} style={{ borderColor: item.border }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>Ghế {item.label}</span>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 17 }}>
                    ×{item.m}
                  </span>
                </div>
              ))}
            </div>
            <span className="note">
              Hệ số loại ghế nằm trong bảng <span className="mono">seat_types</span> và chưa có endpoint để sửa —
              các giá trị trên là giá trị seed mặc định.
            </span>
          </div>
        </Card>

        {/* ---- Holidays ---- */}
        <Card flat style={{ padding: '20px 22px' }}>
          <div className="stack" style={{ gap: 6 }}>
            <div className="row-between" style={{ paddingBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Ngày lễ</span>
              <button
                type="button"
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}
                onClick={() => {
                  setHolidayForm({ date: isoDate(new Date()), name: '', isRecurring: true });
                  setHolidayModal('create');
                }}
              >
                + Thêm
              </button>
            </div>

            {holidays.isLoading ? (
              <Loading inline />
            ) : holidays.isError ? (
              <ErrorState error={holidays.error} onRetry={() => void holidays.refetch()} />
            ) : (holidays.data?.length ?? 0) === 0 ? (
              <EmptyState title="Chưa có ngày lễ" description="Thêm ngày lễ để áp hệ số giá HOLIDAY." />
            ) : (
              holidays.data?.map((holiday) => (
                <div className="holiday-row" key={holiday.holidayId}>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 13, width: 92, flex: 'none' }}>
                    {ddmmyyyy(holiday.date)}
                  </span>
                  <button
                    type="button"
                    className="grow"
                    style={{ fontSize: 14, textAlign: 'left' }}
                    onClick={() => {
                      setHolidayForm({
                        date: holiday.date,
                        name: holiday.name,
                        isRecurring: holiday.isRecurring,
                      });
                      setHolidayModal(holiday.holidayId);
                    }}
                  >
                    {holiday.name}
                  </button>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-4)' }}>
                    Hằng năm
                    <Toggle
                      on={holiday.isRecurring}
                      label={`Hằng năm — ${holiday.name}`}
                      onToggle={() =>
                        toggleRecurring.mutate({
                          holidayId: holiday.holidayId,
                          date: holiday.date,
                          name: holiday.name,
                          isRecurring: !holiday.isRecurring,
                        })
                      }
                    />
                  </span>
                  <button
                    type="button"
                    aria-label={`Xóa ${holiday.name}`}
                    style={{ color: 'var(--danger-ink)', fontSize: 16, flex: 'none' }}
                    onClick={() => {
                      if (window.confirm(`Xóa ngày lễ "${holiday.name}"?`)) removeHoliday.mutate(holiday.holidayId);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ---- Holiday modal ---- */}
      <Modal open={holidayModal !== null} onClose={() => setHolidayModal(null)} width={440}>
        <form
          className="stack"
          style={{ gap: 14 }}
          onSubmit={(event) => {
            event.preventDefault();
            saveHoliday.mutate();
          }}
        >
          <span className="display" style={{ fontSize: 34 }}>
            {holidayModal === 'create' ? 'Thêm ngày lễ' : 'Sửa ngày lễ'}
          </span>

          <Field label="Ngày *">
            <Input
              small
              type="date"
              required
              value={holidayForm.date}
              onChange={(event) => setHolidayForm({ ...holidayForm, date: event.target.value })}
            />
          </Field>
          <Field label="Tên *">
            <Input
              small
              required
              placeholder="Quốc khánh"
              value={holidayForm.name}
              onChange={(event) => setHolidayForm({ ...holidayForm, name: event.target.value })}
            />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            Lặp lại hằng năm
            <Toggle
              on={holidayForm.isRecurring}
              label="Lặp lại hằng năm"
              onToggle={() => setHolidayForm({ ...holidayForm, isRecurring: !holidayForm.isRecurring })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button type="button" variant="outline" size="sm" onClick={() => setHolidayModal(null)}>
              Hủy
            </Button>
            <Button type="submit" size="sm" loading={saveHoliday.isPending}>
              Lưu
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
