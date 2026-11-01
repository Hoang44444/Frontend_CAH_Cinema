import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { movieApi } from '@/api/endpoints';
import type { MovieDetailDTO, MovieSummaryDTO, UpdateOrCreateMovieDTO } from '@/api/types';
import { AdminTopbar } from '@/components/layout/RoleShells';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Loading,
  PosterBox,
  RatingBadge,
  Textarea,
} from '@/components/ui';
import { ddmmyyyy, isoDate } from '@/lib/format';
import { posterTint } from '@/lib/palette';
import { useToast } from '@/store/toast';
import './admin.css';

const AGE_RATINGS = ['P', 'K', 'T13', 'T16', 'T18'];
const RATING_COLOR: Record<string, string> = {
  P: 'var(--rate-p)',
  K: 'var(--rate-k)',
  T13: 'var(--rate-t13)',
  T16: 'var(--rate-t16)',
  T18: 'var(--rate-t18)',
};

/**
 * GET /public/movies returns MovieSummaryDTO, which carries no genres or
 * director — those only exist on the detail DTO — so the table shows the fields
 * the list endpoint actually provides and the editor fills in the rest.
 */
const GRID = '44px 2fr 110px 80px 120px';

interface FormState {
  title: string;
  description: string;
  duration: string;
  releaseDate: string;
  ageRating: string;
  posterUrl: string;
  trailerUrl: string;
  directorName: string;
  actorList: string;
  genreIdList: number[];
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  duration: '',
  releaseDate: isoDate(new Date()),
  ageRating: 'T13',
  posterUrl: '',
  trailerUrl: '',
  directorName: '',
  actorList: '',
  genreIdList: [],
};

function toForm(movie: MovieDetailDTO): FormState {
  return {
    title: movie.title ?? '',
    description: movie.description ?? '',
    duration: movie.duration ? String(movie.duration) : '',
    releaseDate: movie.releaseDate ?? '',
    ageRating: movie.ageRating ?? 'T13',
    posterUrl: movie.posterUrl ?? '',
    trailerUrl: movie.trailerUrl ?? '',
    directorName: movie.directorName ?? '',
    actorList: movie.actorList ?? '',
    genreIdList: movie.genres?.map((genre) => genre.genreId) ?? [],
  };
}

/** 5b — movie catalogue with an inline editor. */
export default function AdminMoviesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [page, setPage] = useState(0);

  /** null = creating a new movie, number = editing that movie. */
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [trailerError, setTrailerError] = useState<string | null>(null);

  const genres = useQuery({ queryKey: ['genres'], queryFn: movieApi.genres });
  const movies = useQuery({
    queryKey: ['admin', 'movies', { query, genreFilter, ratingFilter, page }],
    queryFn: () =>
      movieApi.search({
        title: query || undefined,
        genreId: genreFilter ? Number(genreFilter) : undefined,
        ageRating: ratingFilter || undefined,
        page,
        size: 20,
      }),
  });

  const detail = useQuery({
    queryKey: ['movie', editingId],
    queryFn: () => movieApi.detail(editingId!),
    enabled: editingId !== null,
  });

  // Load the selected movie into the editor once its detail arrives.
  useEffect(() => {
    if (detail.data && detail.data.movieId === editingId) setForm(toForm(detail.data));
  }, [detail.data, editingId]);

  // Select the first row so the editor is never empty on arrival.
  useEffect(() => {
    if (editingId === null && movies.data?.content.length && form === EMPTY_FORM) {
      setEditingId(movies.data.content[0].movieId);
    }
  }, [movies.data, editingId, form]);

  function payload(): UpdateOrCreateMovieDTO {
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      duration: form.duration ? Number(form.duration) : null,
      releaseDate: form.releaseDate || null,
      ageRating: form.ageRating || null,
      posterUrl: form.posterUrl.trim() || null,
      trailerUrl: form.trailerUrl.trim() || null,
      directorName: form.directorName.trim() || null,
      actorList: form.actorList.trim() || null,
      genreIdList: form.genreIdList,
    };
  }

  const save = useMutation({
    mutationFn: () =>
      editingId === null ? movieApi.adminCreate(payload()) : movieApi.adminUpdate(editingId, payload()),
    onSuccess: (saved) => {
      toast.success(editingId === null ? 'Đã thêm phim.' : 'Đã lưu thay đổi.');
      setEditingId(saved.movieId);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'movies'] });
      void queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
    onError: (error) => toast.error(error),
  });

  const remove = useMutation({
    mutationFn: (movieId: number) => movieApi.adminDelete(movieId),
    onSuccess: () => {
      toast.success('Đã xóa phim.');
      setEditingId(null);
      setForm(EMPTY_FORM);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'movies'] });
      void queryClient.invalidateQueries({ queryKey: ['movies'] });
    },
    onError: (error) => toast.error(error),
  });

  function startCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  }

  function validateTrailer(value: string) {
    if (!value.trim()) {
      setTrailerError(null);
      return;
    }
    try {
      new URL(value.trim());
      setTrailerError(null);
    } catch {
      setTrailerError('URL trailer chưa hợp lệ.');
    }
  }

  const rows: MovieSummaryDTO[] = movies.data?.content ?? [];
  const canSave = form.title.trim().length > 0 && form.genreIdList.length > 0 && !trailerError;

  return (
    <>
      <AdminTopbar
        title="Quản lý phim"
        actions={
          <Button size="xs" onClick={startCreate}>
            + Thêm phim
          </Button>
        }
      />

      <div className="admin-split">
        <div className="admin-split__main">
          <form
            className="filters"
            onSubmit={(event) => {
              event.preventDefault();
              setQuery(search.trim());
              setPage(0);
            }}
          >
            <Input
              small
              placeholder="Tìm theo tên phim…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{ flex: 1, minWidth: 200, background: 'var(--surface)' }}
              aria-label="Tìm theo tên phim"
            />
            <select
              className="input input--sm"
              style={{ width: 160 }}
              value={genreFilter}
              onChange={(event) => {
                setGenreFilter(event.target.value);
                setPage(0);
              }}
              aria-label="Thể loại"
            >
              <option value="">Thể loại</option>
              {genres.data?.map((genre) => (
                <option key={genre.genreId} value={genre.genreId}>
                  {genre.name}
                </option>
              ))}
            </select>
            <select
              className="input input--sm"
              style={{ width: 120 }}
              value={ratingFilter}
              onChange={(event) => {
                setRatingFilter(event.target.value);
                setPage(0);
              }}
              aria-label="Độ tuổi"
            >
              <option value="">Độ tuổi</option>
              {AGE_RATINGS.map((rating) => (
                <option key={rating} value={rating}>
                  {rating}
                </option>
              ))}
            </select>
            <Button type="submit" variant="dark" size="xs">
              Tìm
            </Button>
          </form>

          {movies.isLoading ? (
            <Loading />
          ) : movies.isError ? (
            <ErrorState error={movies.error} onRetry={() => void movies.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="Không có phim" description="Thử bỏ bộ lọc, hoặc thêm phim mới." />
          ) : (
            <div className="table">
              <div className="table__head" style={{ gridTemplateColumns: GRID }}>
                <span />
                <span>PHIM</span>
                <span>THỜI LƯỢNG</span>
                <span>TUỔI</span>
                <span>KHỞI CHIẾU</span>
              </div>
              {rows.map((movie) => (
                <button
                  type="button"
                  key={movie.movieId}
                  className="table__row table__row--clickable"
                  style={{ gridTemplateColumns: GRID }}
                  data-selected={movie.movieId === editingId}
                  onClick={() => setEditingId(movie.movieId)}
                >
                  <PosterBox
                    src={movie.posterUrl}
                    width={36}
                    height={52}
                    radius={5}
                    background={posterTint(movie.movieId)}
                    label=""
                    className="movie-row__poster"
                  />
                  <div className="stack" style={{ gap: 2, minWidth: 0, textAlign: 'left' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {movie.title}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>#{movie.movieId}</span>
                  </div>
                  <span>{movie.duration ? `${movie.duration} phút` : '—'}</span>
                  <span style={{ justifySelf: 'start' }}>
                    <RatingBadge rating={movie.ageRating} size={10} />
                  </span>
                  <span style={{ color: 'var(--ink-3)' }}>
                    {movie.releaseDate ? ddmmyyyy(movie.releaseDate) : '—'}
                  </span>
                </button>
              ))}
            </div>
          )}

          {(movies.data?.totalPages ?? 1) > 1 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
        </div>

        {/* ---- Editor ---- */}
        <aside className="admin-split__aside">
          <div className="row-between">
            <span style={{ fontWeight: 700, fontSize: 16 }}>
              {editingId === null ? 'Thêm phim' : 'Sửa phim'}
            </span>
            {editingId !== null && (
              <span style={{ fontSize: 12, color: 'var(--ink-5)' }}>ID #{editingId}</span>
            )}
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
              <Field label="Tên phim *">
                <Input
                  small
                  required
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Thời lượng (phút) *" hint="Tối thiểu 15.">
                  <Input
                    small
                    type="number"
                    min={15}
                    value={form.duration}
                    onChange={(event) => setForm({ ...form, duration: event.target.value })}
                  />
                </Field>
                <Field label="Khởi chiếu">
                  <Input
                    small
                    type="date"
                    value={form.releaseDate}
                    onChange={(event) => setForm({ ...form, releaseDate: event.target.value })}
                  />
                </Field>
              </div>

              <Field label="Phân loại độ tuổi *">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                  {AGE_RATINGS.map((rating) => {
                    const active = form.ageRating === rating;
                    return (
                      <button
                        type="button"
                        key={rating}
                        onClick={() => setForm({ ...form, ageRating: rating })}
                        style={{
                          height: 36,
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 12,
                          fontWeight: 700,
                          border: `1.5px solid ${active ? RATING_COLOR[rating] : 'var(--line-strong)'}`,
                          background: active ? RATING_COLOR[rating] : 'transparent',
                          color: active ? '#fff' : 'var(--ink-3)',
                        }}
                      >
                        {rating}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Đạo diễn">
                <Input
                  small
                  value={form.directorName}
                  onChange={(event) => setForm({ ...form, directorName: event.target.value })}
                />
              </Field>

              <Field label="Diễn viên" hint="Phân cách bằng dấu phẩy.">
                <Input
                  small
                  value={form.actorList}
                  onChange={(event) => setForm({ ...form, actorList: event.target.value })}
                />
              </Field>

              <Field
                label="Thể loại *"
                error={form.genreIdList.length === 0 ? 'Chọn ít nhất một thể loại.' : undefined}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {genres.data?.map((genre) => {
                    const on = form.genreIdList.includes(genre.genreId);
                    return (
                      <button
                        type="button"
                        key={genre.genreId}
                        onClick={() =>
                          setForm({
                            ...form,
                            genreIdList: on
                              ? form.genreIdList.filter((id) => id !== genre.genreId)
                              : [...form.genreIdList, genre.genreId],
                          })
                        }
                        style={{
                          fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: 'var(--r-pill)',
                          border: `1px solid ${on ? 'var(--accent)' : 'var(--line-strong)'}`,
                          color: on ? 'var(--accent)' : 'var(--ink-4)',
                        }}
                      >
                        {genre.name}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Poster URL">
                <Input
                  small
                  placeholder="https://…"
                  value={form.posterUrl}
                  onChange={(event) => setForm({ ...form, posterUrl: event.target.value })}
                />
              </Field>

              <Field label="Trailer URL" error={trailerError}>
                <Input
                  small
                  placeholder="https://youtube.com/watch?v=…"
                  value={form.trailerUrl}
                  aria-invalid={trailerError ? 'true' : undefined}
                  onChange={(event) => {
                    setForm({ ...form, trailerUrl: event.target.value });
                    validateTrailer(event.target.value);
                  }}
                />
              </Field>

              <Field label="Mô tả">
                <Textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>

              <div className="grow" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
                <Button
                  type="button"
                  variant="danger-outline"
                  size="sm"
                  disabled={editingId === null}
                  loading={remove.isPending}
                  onClick={() => {
                    if (editingId !== null && window.confirm('Xóa phim này?')) remove.mutate(editingId);
                  }}
                >
                  Xóa
                </Button>
                <Button type="submit" size="sm" disabled={!canSave} loading={save.isPending}>
                  {editingId === null ? 'Thêm phim' : 'Lưu thay đổi'}
                </Button>
              </div>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
