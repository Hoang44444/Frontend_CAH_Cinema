import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportApi } from '@/api/endpoints';
import { AdminTopbar } from '@/components/layout/RoleShells';
import { Card, EmptyState, ErrorState, Input, Loading } from '@/components/ui';
import { addDays, count, ddmm, isoDate, startOfToday, vnd, vndCompact } from '@/lib/format';
import './admin.css';

/** 5a — business overview for a date range (max 366 days server-side). */
export default function AdminReportsPage() {
  const [from, setFrom] = useState(() => isoDate(addDays(startOfToday(), -29)));
  const [to, setTo] = useState(() => isoDate(startOfToday()));

  const overview = useQuery({
    queryKey: ['reports', 'overview', from, to],
    queryFn: () => reportApi.overview(from, to),
  });
  const daily = useQuery({
    queryKey: ['reports', 'daily', from, to],
    queryFn: () => reportApi.daily(from, to),
  });
  const byMovie = useQuery({
    queryKey: ['reports', 'by-movie', from, to],
    queryFn: () => reportApi.byMovie(from, to),
  });
  const byCinema = useQuery({
    queryKey: ['reports', 'by-cinema', from, to],
    queryFn: () => reportApi.byCinema(from, to),
  });

  const rows = daily.data ?? [];
  const peak = useMemo(() => Math.max(1, ...rows.map((row) => Number(row.revenue))), [rows]);
  const topMovieRevenue = useMemo(
    () => Math.max(1, ...(byMovie.data ?? []).map((row) => Number(row.ticketRevenue))),
    [byMovie.data],
  );

  const kpi = overview.data;
  const ticketShare = kpi && kpi.totalRevenue > 0 ? Math.round((kpi.ticketRevenue / kpi.totalRevenue) * 100) : 0;
  const foodShare = kpi && kpi.totalRevenue > 0 ? Math.round((kpi.foodRevenue / kpi.totalRevenue) * 100) : 0;

  return (
    <>
      <AdminTopbar
        title="Tổng quan kinh doanh"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input
              small
              type="date"
              value={from}
              max={to}
              onChange={(event) => setFrom(event.target.value)}
              aria-label="Từ ngày"
              style={{ width: 150, background: 'var(--surface)' }}
            />
            <span style={{ color: 'var(--ink-5)' }}>–</span>
            <Input
              small
              type="date"
              value={to}
              min={from}
              onChange={(event) => setTo(event.target.value)}
              aria-label="Đến ngày"
              style={{ width: 150, background: 'var(--surface)' }}
            />
          </div>
        }
      />

      <div className="admin-page">
        {overview.isLoading ? (
          <Loading label="Đang tải báo cáo…" />
        ) : overview.isError ? (
          <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
        ) : (
          <div className="kpi-grid">
            <div className="kpi kpi--hero">
              <span className="kpi__label">Doanh thu thuần</span>
              <span className="kpi__value">{vndCompact(kpi?.totalRevenue)}</span>
              <span className="kpi__delta">{vnd(kpi?.totalRevenue)}</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Tiền vé</span>
              <span className="kpi__value">{vndCompact(kpi?.ticketRevenue)}</span>
              <span className="kpi__delta">{ticketShare}%</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Bắp nước</span>
              <span className="kpi__value">{vndCompact(kpi?.foodRevenue)}</span>
              <span className="kpi__delta">{foodShare}%</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Vé bán</span>
              <span className="kpi__value">{count(kpi?.totalTicketsSold)}</span>
              <span className="kpi__delta">trong kỳ</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Booking</span>
              <span className="kpi__value">{count(kpi?.totalBookingsPaid)}</span>
              <span className="kpi__delta">AOV {vnd(kpi?.averageOrderValue)}</span>
            </div>
            <div className="kpi">
              <span className="kpi__label">Tổng giảm giá</span>
              <span className="kpi__value">{vndCompact(kpi?.totalDiscount)}</span>
              <span className="kpi__delta">Voucher + hạng</span>
            </div>
          </div>
        )}

        {/* Daily revenue */}
        <Card flat style={{ padding: '20px 22px' }}>
          <div className="stack" style={{ gap: 16 }}>
            <div className="row-between">
              <span style={{ fontWeight: 700, fontSize: 16 }}>Doanh thu theo ngày</span>
              <div className="legend-row">
                <span className="legend-row__item">
                  <span className="legend-row__swatch" style={{ background: 'var(--accent)' }} />
                  Doanh thu
                </span>
                <span className="legend-row__item">
                  <span className="legend-row__swatch" style={{ background: 'var(--seat-couple)' }} />
                  Số vé
                </span>
              </div>
            </div>

            {daily.isLoading ? (
              <Loading inline />
            ) : daily.isError ? (
              <ErrorState error={daily.error} onRetry={() => void daily.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyState title="Không có dữ liệu" description="Chưa có doanh thu trong khoảng ngày đã chọn." />
            ) : (
              <>
                <div className="chart">
                  {rows.map((row) => {
                    const revenuePct = (Number(row.revenue) / peak) * 100;
                    // Ticket count drawn as a proportional cap on the bar.
                    const ticketPct = revenuePct * 0.34;
                    return (
                      <div
                        className="chart__col"
                        key={row.date}
                        title={`${ddmm(row.date)} · ${vnd(row.revenue)} · ${row.ticketCount} vé`}
                      >
                        <div className="chart__bar chart__bar--top" style={{ height: `${ticketPct}%` }} />
                        <div className="chart__bar" style={{ height: `${revenuePct}%` }} />
                      </div>
                    );
                  })}
                </div>
                <div className="chart__axis">
                  <span>{ddmm(rows[0]?.date)}</span>
                  <span>{ddmm(rows[Math.floor(rows.length / 2)]?.date)}</span>
                  <span>{ddmm(rows[rows.length - 1]?.date)}</span>
                </div>
              </>
            )}
          </div>
        </Card>

        <div className="split-2">
          {/* By movie */}
          <Card flat style={{ padding: '20px 22px' }}>
            <div className="stack" style={{ gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Theo phim</span>
              {byMovie.isLoading ? (
                <Loading inline />
              ) : byMovie.isError ? (
                <ErrorState error={byMovie.error} onRetry={() => void byMovie.refetch()} />
              ) : (byMovie.data?.length ?? 0) === 0 ? (
                <EmptyState title="Không có dữ liệu" />
              ) : (
                byMovie.data?.map((row) => (
                  <div className="bar-row" key={row.movieId}>
                    <span className="bar-row__name" title={row.movieTitle}>
                      {row.movieTitle}
                    </span>
                    <div className="bar-row__track">
                      <div
                        className="bar-row__fill"
                        style={{ width: `${(Number(row.ticketRevenue) / topMovieRevenue) * 100}%` }}
                      />
                    </div>
                    <span className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {vndCompact(row.ticketRevenue)}
                    </span>
                    <span style={{ textAlign: 'right', color: 'var(--ink-4)' }}>{row.ticketsSold} vé</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* By cinema */}
          <Card flat style={{ padding: '20px 22px' }}>
            <div className="stack" style={{ gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>Theo rạp</span>
              {byCinema.isLoading ? (
                <Loading inline />
              ) : byCinema.isError ? (
                <ErrorState error={byCinema.error} onRetry={() => void byCinema.refetch()} />
              ) : (byCinema.data?.length ?? 0) === 0 ? (
                <EmptyState title="Không có dữ liệu" />
              ) : (
                byCinema.data?.map((row) => (
                  <div className="list-row" key={row.cinemaId}>
                    <span>{row.cinemaName}</span>
                    <span className="mono" style={{ fontWeight: 700 }}>
                      {vndCompact(row.ticketRevenue)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
