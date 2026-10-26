import type { PromotionPlacement } from '@metrobet/contracts';
import { cn, heroBannerAspect, Skeleton } from '@metrobet/ui';
import { getLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { getPromotions } from '../data';
import { PromoSlider } from './promo-slider';

async function SliderLoader({ placement }: { placement: PromotionPlacement }) {
  const promotions = await getPromotions(await getLocale(), placement);
  if (promotions.length === 0) return null;
  return <PromoSlider promotions={promotions} />;
}

/** Drop-in promo slider for any page. Renders nothing when there are no live promotions. */
export function PromotionsSlider({ placement }: { placement: PromotionPlacement }) {
  return (
    <Suspense fallback={<Skeleton className={cn('rounded-xl', heroBannerAspect.responsive)} />}>
      <SliderLoader placement={placement} />
    </Suspense>
  );
}
