import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cinemaApi, movieApi, promotionApi } from '@/api/endpoints';
import type { MovieSummaryDTO } from '@/api/types';
import { Button, EmptyState, ErrorState, RatingBadge, Skeleton } from '@/components/ui';
import { addDays, ddmm, ddmmyyyy, duration, isoDate, startOfToday } from '@/lib/format';
import { posterTint } from '@/lib/palette';
import './public.css';

/** Trims a long title down to the two-line display label the poster uses. */
function shortTitle(title: string): string {
  const colon = title.indexOf(':');
  const base = colon > 6 ? title.slice(0, colon) : title;
  return base.length > 26 ? `${base.slice(0, 24)}…` : base;
}

export function MovieCard({ movie }: { movie: MovieSummaryDTO }) {
  return (
    <Link to={`/movies/${movie.movieId}`} className="movie-card">
      <div className="movie-card__poster" style={{ background: posterTint(movie.movieId) }}>
        {movie.posterUrl && (
          <img className="movie-card__poster-img" src={movie.posterUrl} alt="" loading="lazy" />
        )}
        <span className="movie-card__rating">
          <RatingBadge rating={movie.ageRating} />
        </span>
        {!movie.posterUrl && <span className="movie-card__short">{shortTitle(movie.title)}</span>}
      </div>
      <span className="movie-card__title">{movie.title}</span>
      <span className="movie-card__sub">
        {movie.duration ? `${duration(movie.duration)} · ` : ''}
        {movie.releaseDate ? ddmmyyyy(movie.releaseDate) : '—'}
      </span>
    </Link>
  );
}

function MovieGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="movie-grid">
      {Array.from({ length: count }, (_, index) => (
        <div className="movie-card" key={index}>
          <Skeleton height={0} width="100%" />
          <div style={{ aspectRatio: '2 / 3' }} className="skeleton" />
          <Skeleton height={14} width="80%" />
          <Skeleton height={12} width="55%" />
        </div>
      ))}
    </div>
  );
}

/** The sticky quick-pick bar from W1; each field narrows what to book next. */
function QuickBar({ movies }: { movies: MovieSummaryDTO[] }) {
  const navigate = useNavigate();
  const { data: cinemas } = useQuery({ queryKey: ['cinemas'], queryFn: cinemaApi.list });

  const [movieId, setMovieId] = useState<string>('');
  const [cinemaId, setCinemaId] = useState<string>('');
  const [date, setDate] = useState<string>(() => isoDate(startOfToday()));

  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(startOfToday(), index)),
    [],
  );

  const chosenMovie = movieId || (movies[0] ? String(movies[0].movieId) : '');

  function go() {
    if (!chosenMovie) {
      navigate('/movies');
      return;
    }
    const params = new URLSearchParams({ date });
    if (cinemaId) params.set('cinemaId', cinemaId);
    navigate(`/movies/${chosenMovie}?${params.toString()}`);
  }

  return (
    <div className="quickbar">
      <label className="quickbar__cell">
        <span className="quickbar__label">Phim</span>
        <select
          className="quickbar__select"
          value={chosenMovie}
          onChange={(event) => setMovieId(event.target.value)}
        >
          {movies.length === 0 && <option value="">Chưa có phim</option>}
          {movies.map((movie) => (
            <option key={movie.movieId} value={movie.movieId}>
              {movie.title}
            </option>
          ))}
        </select>
      </label>
      <label className="quickbar__cell">
        <span className="quickbar__label">Rạp</span>
        <select
          className="quickbar__select"
          value={cinemaId}
          onChange={(event) => setCinemaId(event.target.value)}
        >
          <option value="">Tất cả rạp</option>
          {cinemas?.map((cinema) => (
            <option key={cinema.cinemaId} value={cinema.cinemaId}>
              {cinema.name.replace('CAH Cinema ', '')}
            </option>
          ))}
        </select>
      </label>
      <label className="quickbar__cell">
        <span className="quickbar__label">Ngày</span>
        <select className="quickbar__select" value={date} onChange={(event) => setDate(event.target.value)}>
          {dates.map((value, index) => (
            <option key={value.toISOString()} value={isoDate(value)}>
              {index === 0 ? `Hôm nay, ${ddmm(value)}` : ddmm(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="quickbar__cell">
        <span className="quickbar__label">Suất</span>
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink-5)' }}>Chọn ở trang phim</span>
      </label>
      <div className="quickbar__action">
        <Button size="sm" style={{ borderRadius: 12 }} onClick={go}>
          Mua vé nhanh
        </Button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const [tab, setTab] = useState<'nowShowing' | 'upcoming'>('nowShowing');

  const featured = useQuery({ queryKey: ['movies', 'featured'], queryFn: movieApi.featured });
  const promotions = useQuery({
    queryKey: ['promotions', { page: 0, size: 3 }],
    queryFn: () => promotionApi.list({ page: 0, size: 3 }),
  });

  const nowShowing = featured.data?.nowShowing ?? [];
  const upcoming = featured.data?.upcoming ?? [];
  const list = tab === 'nowShowing' ? nowShowing : upcoming;
  const hero = nowShowing[0] ?? upcoming[0];

  return (
    <>
      {/* Hero built from the first now-showing title */}
      <section className="hero" style={{ backgroundColor: posterTint(hero?.movieId ?? 0) }}>
        <div className="hero__body">
          {featured.isLoading ? (
            <>
              <Skeleton height={20} width={220} />
              <Skeleton height={120} width="90%" />
              <Skeleton height={60} width="70%" />
            </>
          ) : hero ? (
            <>
              <div className="hero__meta">
                <RatingBadge rating={hero.ageRating} size={12} />
                <span className="hero__formats">IMAX · 3D · 2D</span>
                {hero.releaseDate && (
                  <span className="hero__release">Khởi chiếu {ddmmyyyy(hero.releaseDate)}</span>
                )}
              </div>
              <h1 className="hero__title">{hero.title}</h1>
              <p className="hero__desc">
                {hero.duration
                  ? `${duration(hero.duration)} · Đang chiếu tại các rạp CAH Cinema. Chọn suất và giữ ghế trong vài phút.`
                  : 'Đang chiếu tại các rạp CAH Cinema. Chọn suất và giữ ghế trong vài phút.'}
              </p>
              <div className="hero__cta">
                <Link
                  to={`/movies/${hero.movieId}`}
                  className="btn btn--accent btn--lg btn--pill"
                  style={{ color: '#fff' }}
                >
                  Đặt vé ngay
                </Link>
                <Link to="/movies" className="btn btn--outline btn--md btn--pill">
                  Xem tất cả phim
                </Link>
              </div>
            </>
          ) : (
            <EmptyState
              title="Chưa có phim nào"
              description="Backend chưa trả về phim đang chiếu. Thêm phim trong trang Quản trị → Phim."
            />
          )}
        </div>
        <div className="hero__poster-wrap">
          {hero?.posterUrl ? (
            <img src={hero.posterUrl} alt={hero.title} className="hero__poster" style={{ objectFit: 'cover' }} />
          ) : (
            <div className="hero__poster poster-ph" style={{ background: 'rgba(0,0,0,0.07)' }}>
              poster 2:3
            </div>
          )}
        </div>
      </section>

      <QuickBar movies={[...nowShowing, ...upcoming]} />

      <section className="section">
        <div className="section__head">
          <div className="section__tabs">
            <button
              type="button"
              className="section__tab"
              data-active={tab === 'nowShowing'}
              onClick={() => setTab('nowShowing')}
            >
              Đang chiếu
            </button>
            <button
              type="button"
              className="section__tab"
              data-active={tab === 'upcoming'}
              onClick={() => setTab('upcoming')}
            >
              Sắp chiếu
            </button>
          </div>
          <Link to="/movies" style={{ fontSize: 14, color: 'var(--ink-3)' }}>
            Xem tất cả →
          </Link>
        </div>

        {featured.isLoading ? (
          <MovieGridSkeleton />
        ) : featured.isError ? (
          <ErrorState error={featured.error} onRetry={() => void featured.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState title={tab === 'nowShowing' ? 'Chưa có phim đang chiếu' : 'Chưa có phim sắp chiếu'} />
        ) : (
          <div className="movie-grid">
            {list.map((movie) => (
              <MovieCard key={movie.movieId} movie={movie} />
            ))}
          </div>
        )}
      </section>

      {/* Latest three promotion articles */}
      {(promotions.data?.content?.length ?? 0) > 0 && (
        <div className="promo-strip">
          {promotions.data?.content.map((promo) => (
            <Link to={`/promotions/${promo.promotionId}`} className="promo-row" key={promo.promotionId}>
              {promo.imageUrl ? (
                <img src={promo.imageUrl} alt="" className="promo-row__thumb" loading="lazy" />
              ) : (
                <span className="promo-row__thumb" style={{ background: posterTint(promo.promotionId) }} />
              )}
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <span style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{promo.title}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>{ddmmyyyy(promo.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
