import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { promotionApi } from '@/api/endpoints';
import { Button, EmptyState, ErrorState, Loading } from '@/components/ui';
import { ddmmyyyy } from '@/lib/format';
import { posterTint } from '@/lib/palette';
import './public.css';

/** W10: grid of active promotion articles. */
export default function PromotionsPage() {
  const [page, setPage] = useState(0);
  const promotions = useQuery({
    queryKey: ['promotions', { page, size: 9 }],
    queryFn: () => promotionApi.list({ page, size: 9 }),
  });

  return (
    <section className="section">
      <h1 className="display" style={{ fontSize: 64, lineHeight: 0.9 }}>
        Ưu đãi
      </h1>

      {promotions.isLoading ? (
        <Loading />
      ) : promotions.isError ? (
        <ErrorState error={promotions.error} onRetry={() => void promotions.refetch()} />
      ) : (promotions.data?.content.length ?? 0) === 0 ? (
        <EmptyState
          title="Chưa có ưu đãi nào"
          description="Bài viết khuyến mãi được tạo trong Quản trị → Khuyến mãi."
        />
      ) : (
        <>
          <div className="promo-grid">
            {promotions.data?.content.map((promo) => (
              <Link to={`/promotions/${promo.promotionId}`} className="promo-card" key={promo.promotionId}>
                <div className="promo-card__cover" style={{ backgroundColor: posterTint(promo.promotionId) }}>
                  {promo.imageUrl && (
                    <img
                      src={promo.imageUrl}
                      alt=""
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                  <span className="promo-card__date">{ddmmyyyy(promo.createdAt)}</span>
                </div>
                <span className="promo-card__title">{promo.title}</span>
                <span className="promo-card__desc">{promo.shortDescription}</span>
              </Link>
            ))}
          </div>

          {(promotions.data?.totalPages ?? 1) > 1 && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Button
                variant="outline"
                size="xs"
                disabled={promotions.data?.first}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                ‹ Trước
              </Button>
              <span style={{ fontSize: 13, color: 'var(--ink-4)' }}>
                Trang {(promotions.data?.number ?? 0) + 1} / {promotions.data?.totalPages}
              </span>
              <Button
                variant="outline"
                size="xs"
                disabled={promotions.data?.last}
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
