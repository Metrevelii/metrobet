import type { PromotionCard as PromotionCardData } from '@metrobet/contracts';
import { ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { PromotionBadge } from './promotion-badge';
import { PromotionPicture } from './promotion-picture';

export function PromotionCard({ promotion }: { promotion: PromotionCardData }) {
  const t = useTranslations('Promotions');
  const format = useFormatter();

  return (
    <Link
      href={`/promotions/${promotion.slug}`}
      className="group/banner flex flex-col overflow-hidden rounded-lg border bg-card transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-video overflow-hidden">
        <PromotionPicture
          image={promotion.image}
          variant="mobile"
          sizes="(min-width: 1024px) 400px, 100vw"
          className="object-top transition-transform duration-700 group-hover/banner:scale-[1.03]"
        />
        <div className="absolute top-3 left-3">
          <PromotionBadge category={promotion.category} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h2 className="leading-snug font-bold">{promotion.title}</h2>
        <p className="line-clamp-2 text-sm text-muted-foreground">{promotion.subtitle}</p>
        <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>
            {promotion.endsAt
              ? t('validUntil', {
                  date: format.dateTime(new Date(promotion.endsAt), { dateStyle: 'long' }),
                })
              : t('ongoing')}
          </span>
          <span className="flex items-center font-semibold text-foreground">
            {t('details')}
            <ChevronRight className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}
