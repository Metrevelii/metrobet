import { type Promotion, promotionSchema } from '@metrobet/contracts';

import { AdminApiError, adminFetch } from '@/lib/admin-api';

/** Every promotion, any status, in display order. Request-time data: render inside <Suspense>. */
export function listPromotions(): Promise<Promotion[]> {
  return adminFetch('promotions', promotionSchema.array());
}

export async function getPromotion(id: string): Promise<Promotion | null> {
  try {
    return await adminFetch(`promotions/${encodeURIComponent(id)}`, promotionSchema);
  } catch (error) {
    // 400 = not a valid id, 404 = no such promotion.
    if (error instanceof AdminApiError && [400, 404].includes(error.status)) return null;
    throw error;
  }
}
