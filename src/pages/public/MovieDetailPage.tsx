import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commentApi, movieApi, showtimeApi } from '@/api/endpoints';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  Loading,
  RatingBadge,
  Textarea,
} from '@/components/ui';
import { addDays, ddmm, ddmmyyyy, duration, hhmm, isoDate, startOfToday, timeAgo } from '@/lib/format';
import { avatarTint, posterTint } from '@/lib/palette';
import { showtimeContextStore } from '@/store/bookingDraft';
import './public.css';

/** Seven selectable days starting today, matching the design's date strip. */
function useDayStrip() {
  return useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(startOfToday(), index)), []);
}

export default function MovieDetailPage() {
  const { movieId: movieIdParam } = useParams();
  const movieId = Number(movieIdParam);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const days = useDayStrip();
  const selectedDate = params.get('date') ?? isoDate(days[0]);
  const cinemaFilter = params.get('cinemaId');
  const [format, setFormat] = useState<string>('');
  const [draft, setDraft] = useState('');

  const movie = useQuery({
    queryKey: ['movie', movieId],
    queryFn: () => movieApi.detail(movieId),
    enabled: Number.isFinite(movieId),
  });

  const showtimes = useQuery({
    queryKey: ['showtimes', 'movie', movieId, selectedDate],
    queryFn: () => showtimeApi.byMovie(movieId, selectedDate),
    enabled: Number.isFinite(movieId),
  });

  const comments = useQuery({
    queryKey: ['comments', movieId],
    queryFn: () => commentApi.byMovie(movieId, 0, 20),
    enabled: Number.isFinite(movieId),
  });

  const postComment = useMutation({
    mutationFn: (content: string) => commentApi.create(movieId, content),
    onSuccess: () => {
      setDraft('');
      toast.success('Đã gửi bình luận.');
      void queryClient.invalidateQueries({ queryKey: ['comments', movieId] });
    },
    onError: (error) => toast.error(error),
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: number) => commentApi.remove(commentId),
    onSuccess: () => {
      toast.success('Đã xóa bình luận.');
      void queryClient.invalidateQueries({ queryKey: ['comments', movieId] });
    },
    onError: (error) => toast.error(error),
  });

  function setDate(value: string) {
    const next = new URLSearchParams(params);
    next.set('date', value);
    setParams(next, { replace: true });
  }

  if (!Number.isFinite(movieId)) {
    return <EmptyState title="Phim không hợp lệ" />;
  }

  if (movie.isLoading) return <Loading label="Đang tải thông tin phim…" />;
  if (movie.isError) return <ErrorState error={movie.error} onRetry={() => void movie.refetch()} />;
  if (!movie.data) return <EmptyState title="Không tìm thấy phim" />;

  const detail = movie.data;
  const tint = posterTint(detail.movieId);

  // Apply the cinema / format filters client-side over the day's schedule.
  const cinemas = (showtimes.data?.cinemas ?? [])
    .filter((cinema) => !cinemaFilter || String(cinema.cinemaId) === cinemaFilter)
    .map((cinema) => ({
      ...cinema,
      showtimes: cinema.showtimes.filter((show) => !format || show.format === format),
    }))
    .filter((cinema) => cinema.showtimes.length > 0);

  const allFormats = [
    ...new Set((showtimes.data?.cinemas ?? []).flatMap((c) => c.showtimes.map((s) => s.format))),
  ];

  return (
    <>
      <section className="detail-hero" style={{ backgroundColor: tint }}>
        {detail.posterUrl ? (
          <img src={detail.posterUrl} alt={detail.title} className="detail-hero__poster" style={{ objectFit: 'cover' }} />
        ) : (
          <div className="detail-hero__poster poster-ph" style={{ background: 'rgba(0,0,0,0.07)' }}>
            poster 2:3
          </div>
        )}

        <div className="detail-hero__body">
          <div className="detail-hero__meta">
            <RatingBadge rating={detail.ageRating} size={12} />
            <span>
              {detail.duration ? `${duration(detail.duration)} · ` : ''}
              {detail.genres?.map((genre) => genre.name).join(', ') || 'Chưa phân loại'}
              {detail.releaseDate ? ` · Khởi chiếu ${ddmmyyyy(detail.releaseDate)}` : ''}
            </span>
          </div>
          <h1 className="detail-hero__title">{detail.title}</h1>
          {detail.description && <p className="detail-hero__desc">{detail.description}</p>}
          <div className="detail-hero__credits">
            {detail.directorName && (
              <div className="stack" style={{ gap: 2 }}>
                <span style={{ color: 'rgba(26,22,20,0.55)' }}>Đạo diễn</span>
                <span style={{ fontWeight: 600 }}>{detail.directorName}</span>
              </div>
            )}
            {detail.actorList && (
              <div className="stack" style={{ gap: 2, maxWidth: 520 }}>
                <span style={{ color: 'rgba(26,22,20,0.55)' }}>Diễn viên</span>
                <span style={{ fontWeight: 600 }}>{detail.actorList}</span>
              </div>
            )}
          </div>
        </div>

        {detail.trailerUrl && (
          <a
            href={detail.trailerUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn--outline btn--sm btn--pill"
            style={{ flex: 'none', background: 'transparent', borderColor: 'rgba(26,22,20,0.4)' }}
          >
            ▶ Xem trailer
          </a>
        )}
      </section>

      <div className="detail-body">
        {/* ---- Showtimes ---- */}
        <div className="stack" style={{ gap: 20 }}>
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 12 }}>
            <h2 className="section-title">Lịch chiếu</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                className="header-chip"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                aria-label="Định dạng"
              >
                <option value="">Tất cả định dạng</option>
                {allFormats.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="daystrip">
            {days.map((day) => {
              const value = isoDate(day);
              return (
                <button
                  key={value}
                  type="button"
                  className="day"
                  data-active={value === selectedDate}
                  onClick={() => setDate(value)}
                >
                  <span className="day__dow">
                    {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][day.getDay()]}
                  </span>
                  <span className="day__num">{String(day.getDate()).padStart(2, '0')}</span>
                </button>
              );
            })}
          </div>

          {showtimes.isLoading ? (
            <Loading label="Đang tải suất chiếu…" inline />
          ) : showtimes.isError ? (
            <ErrorState error={showtimes.error} onRetry={() => void showtimes.refetch()} />
          ) : cinemas.length === 0 ? (
            <EmptyState
              title="Không có suất chiếu"
              description={`Phim này chưa có suất nào vào ngày ${ddmm(selectedDate)}. Chọn ngày khác ở trên.`}
            />
          ) : (
            <div className="stack" style={{ gap: 12 }}>
              {cinemas.map((cinema) => {
                // Group a cinema's showtimes by format + room, like the design.
                const groups = new Map<string, typeof cinema.showtimes>();
                for (const show of cinema.showtimes) {
                  const key = `${show.format} · ${show.roomName}`;
                  const bucket = groups.get(key);
                  if (bucket) bucket.push(show);
                  else groups.set(key, [show]);
                }

                return (
                  <div className="cinema-block" key={cinema.cinemaId}>
                    <div className="cinema-block__head">
                      <span style={{ fontWeight: 700, fontSize: 17 }}>{cinema.cinemaName}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>{cinema.address}</span>
                    </div>
                    {[...groups.entries()].map(([label, shows]) => (
                      <div className="format-row" key={label}>
                        <span className="format-row__label">{label}</span>
                        <div className="times">
                          {shows
                            .slice()
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map((show) => {
                              // Backend chỉ trả AVAILABLE / SOLD_OUT / HIDDEN / CANCELLED.
                              const bookable =
                                show.status === 'AVAILABLE' && new Date(show.startTime) > new Date();
                              return (
                                <button
                                  key={show.showtimeId}
                                  type="button"
                                  className="time"
                                  data-state={bookable ? 'ok' : 'sold'}
                                  disabled={!bookable}
                                  onClick={() => {
                                    // The seat screen has no endpoint to look a
                                    // single showtime up, so carry its context.
                                    showtimeContextStore.save({
                                      showtimeId: show.showtimeId,
                                      movieId: detail.movieId,
                                      movieTitle: detail.title,
                                      moviePosterUrl: detail.posterUrl,
                                      ageRating: detail.ageRating ?? null,
                                      cinemaName: cinema.cinemaName,
                                      roomName: show.roomName,
                                      format: show.format,
                                      startTime: show.startTime,
                                      endTime: show.endTime,
                                      basePrice: Number(show.basePrice),
                                    });
                                    navigate(`/booking/showtimes/${show.showtimeId}/seats`);
                                  }}
                                  title={`${hhmm(show.startTime)} – ${hhmm(show.endTime)}`}
                                >
                                  <span className="time__t">{hhmm(show.startTime)}</span>
                                  <span className="time__note">
                                    {bookable ? '' : show.status === 'AVAILABLE' ? 'Đã chiếu' : show.status}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Comments ---- */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="row-between" style={{ alignItems: 'baseline' }}>
            <h2 className="section-title">Bình luận</h2>
            <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
              {comments.data?.content.length ?? 0}
            </span>
          </div>

          {isAuthenticated ? (
            <div className="comment-box">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Chia sẻ cảm nhận của bạn…"
                maxLength={1000}
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--line)' }}
              />
              <div className="row-between">
                <span style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                  Chỉ khách đã xem phim mới gửi được bình luận.
                </span>
                <Button
                  size="xs"
                  disabled={!draft.trim()}
                  loading={postComment.isPending}
                  onClick={() => postComment.mutate(draft.trim())}
                >
                  Gửi
                </Button>
              </div>
            </div>
          ) : (
            <div className="comment-box">
              <span style={{ fontSize: 14, color: 'var(--ink-4)' }}>
                Đăng nhập để gửi bình luận cho phim này.
              </span>
            </div>
          )}

          {comments.isLoading ? (
            <Loading inline />
          ) : comments.isError ? (
            <ErrorState error={comments.error} onRetry={() => void comments.refetch()} />
          ) : (comments.data?.content.length ?? 0) === 0 ? (
            <EmptyState title="Chưa có bình luận" description="Hãy là người đầu tiên chia sẻ cảm nhận." />
          ) : (
            comments.data?.content.map((comment) => (
              <div className="comment" key={comment.commentId}>
                <Avatar
                  name={comment.userName}
                  size={36}
                  background={avatarTint(comment.userId)}
                />
                <div className="comment__body">
                  <div className="comment__head">
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{comment.userName}</span>
                    <span style={{ fontSize: 11, color: 'var(--ink-5)' }}>{timeAgo(comment.createdAt)}</span>
                  </div>
                  <span className="comment__text">{comment.content}</span>
                  {user?.userId === comment.userId && (
                    <button
                      type="button"
                      style={{ fontSize: 12, color: 'var(--danger-ink)', fontWeight: 600, alignSelf: 'flex-start' }}
                      onClick={() => deleteComment.mutate(comment.commentId)}
                    >
                      Xóa bình luận
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
