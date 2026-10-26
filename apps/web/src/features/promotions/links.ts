import type { PromotionCard } from '@metrobet/contracts';

/** Where a promotion's banner and CTA lead (safe to use on server and client). */
export function promotionHref(promotion: Pick<PromotionCard, 'slug' | 'ctaHref'>): string {
  return promotion.ctaHref ?? `/promotions/${promotion.slug}`;
}
