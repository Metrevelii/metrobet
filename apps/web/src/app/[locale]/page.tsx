import { Badge, Skeleton } from '@metrobet/ui';
import { getTranslations } from 'next-intl/server';

import { Section } from '@/components/shared/section';
import { PromotionsSlider } from '@/features/promotions';

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

      <Section title={t('popularGames')} action={{ href: '/casino', label: t('viewAll') }}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="aspect-3/4 rounded-lg" />
          ))}
        </div>
      </Section>
    </div>
  );
}
