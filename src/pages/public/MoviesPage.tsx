import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { movieApi } from '@/api/endpoints';
import { Button, EmptyState, ErrorState, Input, Loading, Pill } from '@/components/ui';
import { MovieCard } from './HomePage';
import './public.css';

const AGE_RATINGS = ['P', 'K', 'T13', 'T16', 'T18'];
const PAGE_SIZE = 18;

/** Full catalogue with the search / genre / age filters the design's header offers. */
export default function MoviesPage() {
  const [params, setParams] = useSearchParams();
  const [title, setTitle] = useState(params.get('title') ?? '');
  const [page, setPage] = useState(0);

  const genreId = params.get('genreId') ? Number(params.get('genreId')) : undefined;
  const ageRating = params.get('ageRating') ?? undefined;
  const activeTitle = params.get('title') ?? undefined;

  // Keep the input in sync when navigation changes the query string.
  useEffect(() => {
    setTitle(params.get('title') ?? '');
    setPage(0);
  }, [params]);

  const genres = useQuery({ queryKey: ['genres'], queryFn: movieApi.genres });
  const movies = useQuery({
    queryKey: ['movies', { title: activeTitle, genreId, ageRating, page }],
    queryFn: () => movieApi.search({ title: activeTitle, genreId, ageRating, page, size: PAGE_SIZE }),
  });

  function setParam(key: string, value?: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  return (
    <section className="section">
      <div className="section__head">
        <h1 className="display" style={{ fontSize: 64, lineHeight: 0.9 }}>
          Phim
        </h1>
        <form
          style={{ display: 'flex', gap: 10, alignItems: 'center' }}
          onSubmit={(event) => {
            event.preventDefault();
            setParam('title', title.trim() || undefined);
          }}
        >
          <Input
            small
            placeholder="Tìm theo tên phim…"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            style={{ width: 260, background: 'var(--surface)' }}
            aria-label="Tìm theo tên phim"
          />
          <Button type="submit" variant="dark" size="xs">
            Tìm
          </Button>
        </form>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <Pill active={!genreId} onClick={() => setParam('genreId', undefined)}>
          Mọi thể loại
        </Pill>
        {genres.data?.map((genre) => (
          <Pill
            key={genre.genreId}
            active={genreId === genre.genreId}
            onClick={() => setParam('genreId', genreId === genre.genreId ? undefined : String(genre.genreId))}
          >
            {genre.name}
          </Pill>
        ))}
        <span style={{ width: 16 }} />
        {AGE_RATINGS.map((rating) => (
          <Pill
            key={rating}
            accent
            active={ageRating === rating}
            onClick={() => setParam('ageRating', ageRating === rating ? undefined : rating)}
          >
            {rating}
          </Pill>
        ))}
      </div>

      {movies.isLoading ? (
        <Loading />
      ) : movies.isError ? (
        <ErrorState error={movies.error} onRetry={() => void movies.refetch()} />
      ) : (movies.data?.content.length ?? 0) === 0 ? (
        <EmptyState
          title="Không tìm thấy phim"
          description="Thử bỏ bớt bộ lọc, hoặc tìm với từ khóa khác."
        />
      ) : (
        <>
          <div className="movie-grid movie-grid--wide">
            {movies.data?.content.map((movie) => (
              <MovieCard key={movie.movieId} movie={movie} />
            ))}
          </div>
          {(movies.data?.totalPages ?? 1) > 1 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Button
                variant="outline"
                size="xs"
                disabled={movies.data?.first}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                ‹ Trước
              </Button>
              <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                Trang {(movies.data?.number ?? 0) + 1} / {movies.data?.totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={movies.data?.last}
                onClick={() => setPage((current) => current + 1)}
              >
                Sau ›
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
