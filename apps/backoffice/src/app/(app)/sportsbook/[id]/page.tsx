import { Card, CardContent, Skeleton } from '@metrobet/ui';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { getCurrentStaff, hasRole } from '@/features/auth';
import {
  AutoRefresh,
  eventLiability,
  EventState,
  getTradingEvent,
  MarketTradingCard,
  SuspendButton,
} from '@/features/sportsbook';
import { money } from '@/lib/format';

export const metadata: Metadata = { title: 'Event trading' };

type Props = PageProps<'/sportsbook/[id]'>;

async function EventView({ params }: Pick<Props, 'params'>) {
  if (!hasRole(await getCurrentStaff(), ['risk'])) return <NoAccess roles="risk" />;
  const id = decodeURIComponent((await params).id);
  const [detail, liability] = await Promise.all([getTradingEvent(id), eventLiability(id)]);
  if (!detail) notFound();
  const { event, feedOdds, suspensions, trading } = detail;
  const name = `${event.home.name} – ${event.away.name}`;
  const eventSuspension = suspensions.find((item) => item.scope === 'event');
  const byMarket = new Map(liability.markets.map((market) => [market.marketId, market]));
  // Closed markets only matter while tickets still ride on them.
  const markets = event.markets.filter(
    (market) => market.status !== 'closed' || byMarket.has(market.id),
  );
  const facts = [
    ['Competition', `${event.sport} · ${event.competition.country} · ${event.competition.name}`],
    ['Margin', trading.margin === null ? 'Feed price' : `${trading.margin}%`],
    ['Max stake', money(trading.maxStake)],
    ['Max payout', money(trading.maxPayout)],
    ['Open tickets', String(liability.tickets)],
    ['Stakes', money(liability.stake)],
    ['Worst case', money(liability.worstCase)],
  ];

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh />
      <PageHeader
        title={name}
        back={
          <Link
            href="/sportsbook"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Sportsbook
          </Link>
        }
        actions={
          event.status !== 'ended' && (
            <SuspendButton
              scope="event"
              targetId={event.id}
              name={name}
              suspended={eventSuspension !== undefined}
              size="md"
            />
          )
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <EventState event={event} />
          {eventSuspension && (
            <p className="text-sm text-destructive">
              Whole event suspended by {eventSuspension.by}: {eventSuspension.reason}
            </p>
          )}
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        {markets.map((market) => (
          <MarketTradingCard
            key={market.id}
            market={market}
            feedOdds={feedOdds}
            liability={byMarket.get(market.id)}
            suspension={suspensions.find((item) => item.targetId === market.id)}
            eventSuspended={eventSuspension !== undefined}
          />
        ))}
      </div>
    </div>
  );
}

export default function EventTradingPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <EventView params={params} />
    </Suspense>
  );
}
