import type { PromotionCategory } from '@metrobet/contracts';
import { Badge } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

type PromotionBadgeProps = { category: PromotionCategory; className?: string };

export function PromotionBadge({ category, className }: PromotionBadgeProps) {
  const t = useTranslations('Promotions.categories');
  return (
    <Badge variant="primary" className={className}>
      {t(category)}
    </Badge>
  );
}
