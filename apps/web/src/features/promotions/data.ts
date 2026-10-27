import {
  type Locale,
  type PromotionCard,
  promotionCardSchema,
  type PromotionDetail,
  promotionDetailSchema,
  type PromotionEnrollment,
  promotionEnrollmentSchema,
  type PromotionPlacement,
  type WheelState,
  wheelStateSchema,
} from '@metrobet/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { ApiError, apiGet } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

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

/**
 * The signed-in player's opt-in state, or null when signed out (or the API failed: the join
 * button then still renders and the action reports any error). Request-time: inside <Suspense>.
 */
export async function getEnrollment(slug: string): Promise<PromotionEnrollment | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiGet(
      `promotions/${encodeURIComponent(slug)}/enrollment`,
      promotionEnrollmentSchema,
      {},
      { token, headers: await clientHeaders() },
    );
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error('[promotions] Failed to load enrollment', error);
    return null;
  }
}

/** The signed-in player's progress on a wheel block, or null when signed out / unavailable. */
export async function getWheelState(slug: string, blockId: string): Promise<WheelState | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiGet(
      `promotions/${encodeURIComponent(slug)}/wheels/${encodeURIComponent(blockId)}`,
      wheelStateSchema,
      {},
      { token, headers: await clientHeaders() },
    );
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error('[promotions] Failed to load wheel', error);
    return null;
  }
}
