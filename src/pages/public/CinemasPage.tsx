import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cinemaApi, showtimeApi } from '@/api/endpoints';
import { EmptyState, ErrorState, Loading, RatingBadge } from '@/components/ui';
import { addDays, ddmm, dowDateLong, hhmm, isoDate, startOfToday } from '@/lib/format';
import { posterTint } from '@/lib/palette';
import { showtimeContextStore } from '@/store/bookingDraft';
import './public.css';

/** W9: cinema list on the left, that cinema's day schedule on the right. */
export default function CinemasPage() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [date, setDate] = useState(() => isoDate(startOfToday()));

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfToday(), index)), []);

  const cinemas = useQuery({ queryKey: ['cinemas'], queryFn: cinemaApi.list });

  // Select the first cinema as soon as the list arrives.
  useEffect(() => {
    if (selectedId === null && cinemas.data?.length) setSelectedId(cinemas.data[0].cinemaId);
  }, [cinemas.data, selectedId]);

  const schedule = useQuery({
    queryKey: ['showtimes', 'cinema', selectedId, date],
    queryFn: () => showtimeApi.byCinema(selectedId!, date),
    enabled: selectedId !== null,
  });

  const current = cinemas.data?.find((cinema) => cinema.cinemaId === selectedId);

  return (
    <div className="cinemas-layout">
      <div className="stack" style={{ gap: 10 }}>
        <h1 className="display" style={{ fontSize: 44, marginBottom: 6 }}>
          Rạp
        </h1>
        {cinemas.isLoading ? (
          <Loading inline />
        ) : cinemas.isError ? (
          <ErrorState error={cinemas.error} onRetry={() => void cinemas.refetch()} />
        ) : (cinemas.data?.length ?? 0) === 0 ? (
          <EmptyState title="Chưa có rạp nào" description="Thêm rạp trong Quản trị → Rạp & phòng." />
        ) : (
          cinemas.data?.map((cinema) => (
            <button
              key={cinema.cinemaId}
              type="button"
              className="cinema-pick"
              data-active={cinema.cinemaId === selectedId}
              onClick={() => setSelectedId(cinema.cinemaId)}
            >
              <span style={{ fontWeight: 700, fontSize: 16 }}>{cinema.name}</span>
              <span style={{ fontSize: 13, color: 'var(--ink-4)', lineHeight: 1.45 }}>{cinema.address}</span>
              {cinema.hotline && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Hotline {cinema.hotline}</span>
              )}
            </button>
          ))
        )}
      </div>

      <div className="stack" style={{ gap: 18 }}>
        <div className="row-between" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
          <h2 className="display" style={{ fontSize: 44 }}>
            {current ? current.name.replace('CAH Cinema ', '') : '—'}
          </h2>
          <select
            className="header-chip"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Chọn ngày"
          >
            {days.map((day) => (
              <option key={day.toISOString()} value={isoDate(day)}>
                {dowDateLong(day)}
              </option>
            ))}
          </select>
        </div>

        {selectedId === null ? null : schedule.isLoading ? (
          <Loading label="Đang tải lịch chiếu…" inline />
        ) : schedule.isError ? (
          <ErrorState error={schedule.error} onRetry={() => void schedule.refetch()} />
        ) : (schedule.data?.movies?.length ?? 0) === 0 ? (
          <EmptyState
            title="Không có suất chiếu"
            description={`Rạp này chưa có suất nào vào ngày ${ddmm(date)}.`}
          />
        ) : (
          schedule.data?.movies.map((entry) => (
            <div className="cinema-movie" key={entry.movie.movieId}>
              {entry.movie.posterUrl ? (
                <img
                  src={entry.movie.posterUrl}
                  alt=""
                  className="cinema-movie__poster"
                  style={{ objectFit: 'cover' }}
                  loading="lazy"
                />
              ) : (
                <span
                  className="cinema-movie__poster"
                  style={{ background: posterTint(entry.movie.movieId) }}
                />
              )}
              <div className="stack" style={{ gap: 10, flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={{ fontWeight: 700, fontSize: 17 }}
                    onClick={() => navigate(`/movies/${entry.movie.movieId}`)}
                  >
                    {entry.movie.title}
                  </button>
                  <RatingBadge rating={entry.movie.ageRating} size={10} />
                  <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                    {[...new Set(entry.showtimes.map((show) => `${show.format} · ${show.roomName}`))].join(
                      ' · ',
                    )}
                  </span>
                </div>
                <div className="times">
                  {entry.showtimes
                    .slice()
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((show) => (
                      <button
                        key={show.showtimeId}
                        type="button"
                        className="time-chip"
                        onClick={() => {
                          showtimeContextStore.save({
                            showtimeId: show.showtimeId,
                            movieId: entry.movie.movieId,
                            movieTitle: entry.movie.title,
                            moviePosterUrl: entry.movie.posterUrl,
                            ageRating: entry.movie.ageRating,
                            cinemaName: current?.name ?? '',
                            roomName: show.roomName,
                            format: show.format,
                            startTime: show.startTime,
                            endTime: show.endTime,
                            basePrice: Number(show.basePrice),
                          });
                          navigate(`/booking/showtimes/${show.showtimeId}/seats`);
                        }}
                        title={`${show.format} · ${show.roomName}`}
                      >
                        {hhmm(show.startTime)}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
