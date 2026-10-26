import type { Locale, Promotion, PromotionCard, PromotionDetail } from '@metrobet/contracts';
import { getPromotionStatus, localize } from '@metrobet/contracts';

/** Active and inside its schedule window at `now` (ms). */
export function isLive(promotion: Promotion, now: number): boolean {
  return getPromotionStatus(promotion, now) === 'live';
}

export function toCard(promotion: Promotion, locale: Locale): PromotionCard {
  return {
    slug: promotion.slug,
    category: promotion.category,
    title: localize(promotion.title, locale),
    subtitle: localize(promotion.subtitle, locale),
    ctaLabel: localize(promotion.ctaLabel, locale),
    ctaHref: promotion.ctaHref,
    image: promotion.image,
    endsAt: promotion.endsAt,
  };
}

export function toDetail(promotion: Promotion, locale: Locale): PromotionDetail {
  return {
    ...toCard(promotion, locale),
    content: localize(promotion.content, locale),
    terms: localize(promotion.terms, locale),
  };
}
