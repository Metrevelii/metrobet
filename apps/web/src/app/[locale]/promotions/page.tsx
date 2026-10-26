import { Card, Skeleton } from '@metrobet/ui';
import { Gift } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { getPromotions, PromotionCard } from '@/features/promotions';

const GRID = 'grid gap-4 sm:grid-cols-2 2xl:grid-cols-3';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Promotions');
  return { title: t('title') };
}

async function PromotionsGrid() {
  const t = await getTranslations('Promotions');
  const promotions = await getPromotions(await getLocale());

  if (promotions.length === 0) {
    return (
      <Card>
        <EmptyState icon={Gift} title={t('empty')} />
      </Card>
    );
  }
  return (
    <div className={GRID}>
      {promotions.map((promotion) => (
        <PromotionCard key={promotion.slug} promotion={promotion} />
      ))}
    </div>
  );
}

export default async function PromotionsPage() {
  const t = await getTranslations('Promotions');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <Suspense
        fallback={
          <div className={GRID}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
            ))}
          </div>
        }
      >
        <PromotionsGrid />
      </Suspense>
    </div>
  );
}
