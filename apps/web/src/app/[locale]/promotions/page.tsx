import { Card } from '@metrobet/ui';
import { Gift } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';

import { EmptyState } from '@/components/shared/empty-state';
import { getPromotions, PromotionCard } from '@/features/promotions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Promotions');
  return { title: t('title') };
}

export default async function PromotionsPage() {
  const t = await getTranslations('Promotions');
  const promotions = await getPromotions(await getLocale());

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {promotions.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {promotions.map((promotion) => (
            <PromotionCard key={promotion.slug} promotion={promotion} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={Gift} title={t('empty')} />
        </Card>
      )}
    </div>
  );
}
