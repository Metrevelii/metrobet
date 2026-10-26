import {
  type Locale,
  type PromotionCard,
  promotionCardSchema,
  type PromotionDetail,
  promotionDetailSchema,
  type PromotionPlacement,
} from '@metrobet/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { ApiError, apiGet } from '@/lib/api';

/** Revalidate this tag when promotions change in the backoffice. */
export const PROMOTIONS_CACHE_TAG = 'promotions';

/** Live promotions for a slider placement (or all). Never throws: an outage hides the slider. */
export async function getPromotions(
  locale: Locale,
  placement?: PromotionPlacement,
): Promise<PromotionCard[]> {
  'use cache';
  cacheTag(PROMOTIONS_CACHE_TAG);
  try {
    const promotions = await apiGet('promotions', promotionCardSchema.array(), {
      locale,
      placement,
    });
    cacheLife('minutes');
    return promotions;
  } catch (error) {
    console.error('[promotions] Failed to load promotions', error);
    cacheLife('seconds');
    return [];
  }
}

/** A single live promotion, or null when it does not exist or is no longer running. */
export async function getPromotion(locale: Locale, slug: string): Promise<PromotionDetail | null> {
  'use cache';
  cacheTag(PROMOTIONS_CACHE_TAG, `promotion:${slug}`);
  try {
    const promotion = await apiGet(
      `promotions/${encodeURIComponent(slug)}`,
      promotionDetailSchema,
      {
        locale,
      },
    );
    cacheLife('minutes');
    return promotion;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      cacheLife('minutes');
      return null;
    }
    cacheLife('seconds');
    throw error;
  }
}
