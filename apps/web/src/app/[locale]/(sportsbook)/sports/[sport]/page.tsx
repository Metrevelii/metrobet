import { type CompetitionEvents, sportSchema } from '@metrobet/contracts';
import { Card } from '@metrobet/ui';
import { CalendarX } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { CompetitionBlock, getSportOverview, LiveEvents } from '@/features/sportsbook';
import { GamesUnavailable } from '@/features/casino';

import { ListSkeleton, SportsbookFrame } from '../../sportsbook-frame';

type Props = PageProps<'/[locale]/sports/[sport]'>;

async function resolveSport(params: Props['params']) {
  const parsed = sportSchema.safeParse((await params).sport);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [sport, t] = await Promise.all([resolveSport(params), getTranslations('Sports')]);
  return { title: t(`sports.${sport}`) };
}

const eventIds = (groups: CompetitionEvents[]) =>
  groups.flatMap((group) => group.events.map((event) => event.id));

async function SportView({ params }: Pick<Props, 'params'>) {
  const [sport, t] = await Promise.all([resolveSport(params), getTranslations('Sports')]);
  const overview = await getSportOverview(sport);

  return (
    <SportsbookFrame active={sport}>
      <h1 className="text-2xl font-bold">{t(`sports.${sport}`)}</h1>
      {!overview ? (
        <GamesUnavailable reason="error" />
      ) : (
        <>
          <LiveEvents
            eventIds={[...eventIds(overview.live), ...eventIds(overview.upcoming)]}
            refreshOnLiveChange
          />
          {overview.live.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <span className="size-2 animate-pulse rounded-full bg-live" />
                {t('liveNow')}
              </h2>
              {overview.live.map((group) => (
                <CompetitionBlock key={group.competition.id} group={group} />
              ))}
            </section>
          )}
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold">{t('upcoming')}</h2>
            {overview.upcoming.length > 0 ? (
              overview.upcoming.map((group) => (
                <CompetitionBlock key={group.competition.id} group={group} />
              ))
            ) : (
              <Card>
                <EmptyState icon={CalendarX} title={t('noEvents')} />
              </Card>
            )}
          </section>
        </>
      )}
    </SportsbookFrame>
  );
}

export default function SportPage({ params }: Props) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SportView params={params} />
    </Suspense>
  );
}
