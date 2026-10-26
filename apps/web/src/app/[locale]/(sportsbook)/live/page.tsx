import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ComingSoon } from '@/components/shared/coming-soon';
import { PromotionsSlider } from '@/features/promotions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('live') };
}

export default async function LivePage() {
  const t = await getTranslations('Nav');
  return (
    <div className="flex flex-col gap-6">
      <PromotionsSlider placement="live" />
      <ComingSoon title={t('live')} />
    </div>
  );
}
