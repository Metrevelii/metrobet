import { Badge, Skeleton } from '@metrobet/ui';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { Section } from '@/components/shared/section';
import { categoryHref, GameRow, getLobby } from '@/features/casino';
import { PromotionsSlider } from '@/features/promotions';

async function PopularGames() {
  const [lobby, t] = await Promise.all([getLobby(), getTranslations('Home')]);
  const popular = lobby.sections.find((section) => section.category === 'popular');
  if (!popular) return null;
  return (
    <GameRow
      title={t('popularGames')}
      games={popular.games}
      viewAllHref={categoryHref('popular')}
    />
  );
}

export default async function HomePage() {
  const t = await getTranslations('Home');
  return (
    <div className="flex flex-col gap-8">
      <PromotionsSlider placement="home" />

      <Section
        title={
          <>
            <Badge variant="live">Live</Badge>
            {t('liveNow')}
          </>
        }
        action={{ href: '/live', label: t('viewAll') }}
      >
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </Section>

      <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
        <PopularGames />
      </Suspense>
    </div>
  );
}
