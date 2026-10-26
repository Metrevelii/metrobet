import { Card } from '@metrobet/ui';
import { Radio } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { GamesUnavailable } from '@/features/casino';
import { CompetitionBlock, getLive, LiveEvents } from '@/features/sportsbook';
import { PromotionsSlider } from '@/features/promotions';

import { ListSkeleton, SportsbookFrame } from '../sportsbook-frame';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('live') };
}

async function LiveList() {
  const [groups, t] = await Promise.all([getLive(), getTranslations('Sports')]);
  if (!groups) return <GamesUnavailable reason="error" />;
  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState icon={Radio} title={t('noLive')} />
      </Card>
    );
  }

  const sports = [...new Set(groups.map((group) => group.competition.sport))];
  return (
    <>
      <LiveEvents
        eventIds={groups.flatMap((group) => group.events.map((event) => event.id))}
        refreshOnLiveChange
      />
      {sports.map((sport) => (
        <section key={sport} className="flex flex-col gap-3">
          <h2 className="text-base font-bold">{t(`sports.${sport}`)}</h2>
          {groups
            .filter((group) => group.competition.sport === sport)
            .map((group) => (
              <CompetitionBlock key={group.competition.id} group={group} />
            ))}
        </section>
      ))}
    </>
  );
}

export default async function LivePage() {
  const t = await getTranslations('Nav');
  return (
    <SportsbookFrame active="live">
      <PromotionsSlider placement="live" />
      <h1 className="text-2xl font-bold">{t('live')}</h1>
      <Suspense fallback={<ListSkeleton />}>
        <LiveList />
      </Suspense>
    </SportsbookFrame>
  );
}
