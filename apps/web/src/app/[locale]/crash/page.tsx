import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { GameGridSkeleton, GamesListing } from '@/features/casino';
import { PromotionsSlider } from '@/features/promotions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('crash') };
}

export default async function CrashPage() {
  const t = await getTranslations('Nav');
  return (
    <div className="flex flex-col gap-6">
      <PromotionsSlider placement="crash" />
      <h1 className="text-2xl font-bold">{t('crash')}</h1>
      <Suspense fallback={<GameGridSkeleton />}>
        <GamesListing query={{ type: 'crash' }} />
      </Suspense>
    </div>
  );
}
