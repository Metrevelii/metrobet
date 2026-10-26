import { Skeleton } from '@metrobet/ui';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { EventHeader, getEvent, LiveEvents, MarketCard, sportHref } from '@/features/sportsbook';
import { Link } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/sports/[sport]/[event]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await getEvent((await params).event).catch(() => null);
  return event ? { title: `${event.home.name} – ${event.away.name}` } : {};
}

async function EventView({ params }: Pick<Props, 'params'>) {
  const { sport, event: id } = await params;
  const [event, t] = await Promise.all([getEvent(id), getTranslations('Sports')]);
  if (!event || event.sport !== sport) notFound();

  return (
    <div className="flex flex-col gap-4">
      <LiveEvents eventIds={[event.id]} />
      <Link
        href={sportHref(event.sport)}
        className="flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {t(`sports.${event.sport}`)}
      </Link>
      <EventHeader event={event} />
      <div className="grid gap-3 md:grid-cols-2">
        {event.markets
          .filter((market) => market.status !== 'closed')
          .map((market) => (
            <MarketCard key={market.id} event={event} market={market} />
          ))}
      </div>
    </div>
  );
}

export default function EventPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      }
    >
      <EventView params={params} />
    </Suspense>
  );
}
