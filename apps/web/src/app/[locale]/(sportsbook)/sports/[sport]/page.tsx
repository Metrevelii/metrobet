import {
  type CompetitionEvents,
  dayFilterSchema,
  sportOverviewQuerySchema,
  sportSchema,
} from '@metrobet/contracts';
import { Card } from '@metrobet/ui';
import { CalendarX } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EmptyState } from '@/components/shared/empty-state';
import { GamesUnavailable } from '@/features/casino';
import {
  CompetitionTable,
  getCompetitions,
  getSportOverview,
  ListingFilters,
  LiveEvents,
} from '@/features/sportsbook';

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

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const eventIds = (groups: CompetitionEvents[]) =>
  groups.flatMap((group) => group.events.map((event) => event.id));

async function SportView({ params, searchParams }: Props) {
  const [sport, t, query] = await Promise.all([
    resolveSport(params),
    getTranslations('Sports'),
    searchParams,
  ]);
  const { day, competitions } = sportOverviewQuerySchema.parse({
    day: dayFilterSchema.catch('all').parse(first(query.day)),
    competitions: first(query.competitions),
  });
  const [overview, leagues] = await Promise.all([
    getSportOverview(sport, { day, competitions }),
    getCompetitions(sport),
  ]);
  const empty = overview && overview.live.length === 0 && overview.upcoming.length === 0;

  return (
    <SportsbookFrame active={sport}>
      <h1 className="text-2xl font-bold">{t(`sports.${sport}`)}</h1>
      <ListingFilters sport={sport} day={day} selected={competitions} competitions={leagues} />
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
                <CompetitionTable key={group.competition.id} group={group} live />
              ))}
            </section>
          )}
          {overview.upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-base font-bold">{t('upcoming')}</h2>
              {overview.upcoming.map((group) => (
                <CompetitionTable key={group.competition.id} group={group} />
              ))}
            </section>
          )}
          {empty && (
            <Card>
              <EmptyState icon={CalendarX} title={t('noEvents')} description={t('noEventsHint')} />
            </Card>
          )}
        </>
      )}
    </SportsbookFrame>
  );
}

export default function SportPage(props: Props) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <SportView {...props} />
    </Suspense>
  );
}
