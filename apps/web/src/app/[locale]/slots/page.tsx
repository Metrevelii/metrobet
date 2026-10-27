import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import {
  CasinoPage,
  categoryParam,
  GameGridSkeleton,
  GamesListing,
  RecentlyPlayedRow,
} from '@/features/casino';
import { PromotionsSlider } from '@/features/promotions';

type Props = PageProps<'/[locale]/slots'>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('slots') };
}

/** "All" tab: every provider's slots, filtered by the category chip. */
async function AllSlots({ searchParams }: Pick<Props, 'searchParams'>) {
  const category = categoryParam((await searchParams).category);
  const t = await getTranslations('Nav');
  return (
    <CasinoPage tab="all" chip={category} top={<PromotionsSlider placement="casino" />}>
      <h1 className="sr-only">{t('slots')}</h1>
      {category === 'popular' && <RecentlyPlayedRow />}
      <Suspense key={category} fallback={<GameGridSkeleton />}>
        <GamesListing query={{ type: 'slot', category }} />
      </Suspense>
    </CasinoPage>
  );
}

export default function SlotsPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<GameGridSkeleton />}>
      <AllSlots searchParams={searchParams} />
    </Suspense>
  );
}
