import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { promotionApi } from '@/api/endpoints';
import { Card, EmptyState, ErrorState, Loading } from '@/components/ui';
import { ddmmyyyy } from '@/lib/format';
import { posterTint } from '@/lib/palette';
import './public.css';

export default function PromotionDetailPage() {
  const { promotionId: param } = useParams();
  const promotionId = Number(param);

  const promotion = useQuery({
    queryKey: ['promotion', promotionId],
    queryFn: () => promotionApi.detail(promotionId),
    enabled: Number.isFinite(promotionId),
  });

  if (!Number.isFinite(promotionId)) return <EmptyState title="Bài viết không hợp lệ" />;
  if (promotion.isLoading) return <Loading />;
  if (promotion.isError) return <ErrorState error={promotion.error} onRetry={() => void promotion.refetch()} />;
  if (!promotion.data) return <EmptyState title="Không tìm thấy bài viết" />;

  const article = promotion.data;
  const period =
    article.startDate || article.endDate
      ? `${article.startDate ? ddmmyyyy(article.startDate) : '—'} – ${
          article.endDate ? ddmmyyyy(article.endDate) : 'không thời hạn'
        }`
      : 'Không thời hạn';

  return (
    <section className="section" style={{ maxWidth: 900, margin: '0 auto', width: '100%' }}>
      <Link to="/promotions" style={{ fontSize: 14 }}>
        ← Tất cả ưu đãi
      </Link>

      <div
        className="promo-card__cover"
        style={{ backgroundColor: posterTint(article.promotionId), aspectRatio: '16 / 7' }}
      >
        {article.imageUrl && (
          <img
            src={article.imageUrl}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        <span className="promo-card__date">{period}</span>
      </div>

      <h1 className="display" style={{ fontSize: 56, lineHeight: 0.95 }}>
        {article.title}
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--ink-3)', textWrap: 'pretty' }}>
        {article.shortDescription}
      </p>

      {article.conditions && (
        <Card pad>
          <div className="stack" style={{ gap: 8 }}>
            <strong style={{ fontSize: 16 }}>Điều kiện áp dụng</strong>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-3)', whiteSpace: 'pre-wrap' }}>
              {article.conditions}
            </p>
          </div>
        </Card>
      )}

      {article.note && <span className="note">{article.note}</span>}
    </section>
  );
}
