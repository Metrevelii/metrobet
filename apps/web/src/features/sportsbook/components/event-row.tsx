'use client';

import type { EventSummary } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { selectionLabel } from '../labels';
import { eventHref } from '../links';
import { useEventLiveState } from '../realtime/live-store';
import { LiveStatus } from './live-status';
import { OddsButton } from './odds-button';

function Team({ name, score }: { name: string; score: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="truncate">{name}</span>
      {score !== null && <span className="font-bold tabular">{score}</span>}
    </div>
  );
}

/** One match in a list: time/clock, teams (+score), headline odds, link to all markets. */
export function EventRow({ event }: { event: EventSummary }) {
  const t = useTranslations('Sports');
  const { status, live } = useEventLiveState(event);
  const score = status !== 'scheduled' && live ? live.score : null;
  const market = event.mainMarket;
  const href = eventHref(event.sport, event.id);

  return (
    <div className="grid grid-cols-[4.25rem_1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 md:grid-cols-[4.25rem_1fr_minmax(0,18rem)_2.5rem]">
      <LiveStatus event={event} />
      <Link
        href={href}
        className="flex min-w-0 flex-col gap-0.5 text-sm font-medium hover:text-primary"
      >
        <Team name={event.home.name} score={score?.home ?? null} />
        <Team name={event.away.name} score={score?.away ?? null} />
      </Link>
      <Link
        href={href}
        className="flex h-11 items-center justify-center rounded-md px-1 text-xs font-semibold text-muted-foreground hover:text-foreground md:order-last"
        aria-label={t('allMarkets')}
      >
        {t('moreMarkets', { count: event.marketCount })}
        <ChevronRight className="size-3.5 md:hidden" />
      </Link>
      {market && (
        <div
          className={cn(
            'col-span-3 grid gap-2 md:col-span-1',
            market.selections.length === 3 ? 'grid-cols-3' : 'grid-cols-2',
          )}
        >
          {market.selections.map((selection) => (
            <OddsButton
              key={selection.id}
              event={event}
              market={market}
              selection={selection}
              label={selectionLabel(t, market, selection, event, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
