import { Badge, Card, Skeleton } from '@metrobet/ui';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { Section } from '@/components/shared/section';
import { categoryHref, GameRow, getLobby } from '@/features/casino';
import { PromotionsSlider } from '@/features/promotions';
import { EventRow, getLive, LiveEvents } from '@/features/sportsbook';

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

const HOME_LIVE_LIMIT = 5;

async function LiveNow() {
  const [groups, t] = await Promise.all([getLive(), getTranslations('Home')]);
  const events = (groups ?? []).flatMap((group) => group.events).slice(0, HOME_LIVE_LIMIT);
  if (events.length === 0) return null;
  return (
    <Section
      title={
        <>
          <Badge variant="live">Live</Badge>
          {t('liveNow')}
        </>
      }
      action={{ href: '/live', label: t('viewAll') }}
    >
      <LiveEvents eventIds={events.map((event) => event.id)} refreshOnLiveChange />
      <Card className="divide-y overflow-hidden">
        {events.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </Card>
    </Section>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <PromotionsSlider placement="home" />

      <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
        <LiveNow />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-72 rounded-lg" />}>
        <PopularGames />
      </Suspense>
    </div>
  );
}
