import type { PromotionCard } from '@metrobet/contracts';

/** A promotion's own page. */
export const promotionPageHref = (slug: string) => `/promotions/${slug}`;

/** Where a promotion's banner and CTA lead (safe to use on server and client). */
export function promotionHref(promotion: Pick<PromotionCard, 'slug' | 'ctaHref'>): string {
  return promotion.ctaHref ?? promotionPageHref(promotion.slug);
}
