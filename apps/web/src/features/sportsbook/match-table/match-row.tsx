'use client';

import { type EventSummary, TABLE_COLUMNS } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { useFormatter, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { OddsButton } from '../components/odds-button';
import { periodLabel, selectionLabel } from '../labels';
import { eventHref } from '../links';
import { useEventLiveState } from '../realtime/live-store';

const formatLine = (type: string, line: number | null) =>
  line === null ? '' : type === 'spread' && line > 0 ? `+${line}` : String(line);

/** Kick-off time (Tbilisi) or, live, the clock / period. */
function TimeCell({ event }: { event: EventSummary }) {
  const t = useTranslations('Sports');
  const format = useFormatter();
  const { status, live } = useEventLiveState(event);
  if (status === 'scheduled' || !live) {
    return (
      <span className="font-semibold tabular">
        {format.dateTime(new Date(event.startsAt), {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Asia/Tbilisi',
        })}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-xs font-bold',
        status === 'live' ? 'text-live' : 'text-muted-foreground',
      )}
    >
      {status === 'live' && <span className="size-1.5 animate-pulse rounded-full bg-live" />}
      {live.clock ?? periodLabel(t, live.period)}
    </span>
  );
}

/** One match as a table row: time, teams (+ live score), a price per column, "+N" markets. */
export function MatchRow({ event }: { event: EventSummary }) {
  const t = useTranslations('Sports');
  const { status, live, goals = 0 } = useEventLiveState(event);
  const score = status !== 'scheduled' && live ? live.score : null;
  const href = eventHref(event.sport, event.id);

  return (
    <tr className="border-t transition-colors hover:bg-muted/30">
      <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
        <div className="flex w-[13rem] items-center gap-3 sm:w-[17rem]">
          <span className="w-12 shrink-0 text-xs">
            <TimeCell event={event} />
          </span>
          {score && (
            <span className="relative shrink-0 overflow-hidden rounded bg-primary/15 px-1.5 py-0.5 text-xs font-black text-primary tabular">
              {score.home}:{score.away}
              {goals > 0 && (
                // Re-keyed per goal so the flash plays again.
                <span
                  key={goals}
                  aria-hidden
                  className="absolute inset-0 animate-flash bg-primary/60 motion-reduce:hidden"
                />
              )}
            </span>
          )}
          <Link
            href={href}
            className="min-w-0 truncate text-sm font-semibold transition-colors hover:text-primary"
            title={`${event.home.name} – ${event.away.name}`}
          >
            {event.home.name} – {event.away.name}
          </Link>
        </div>
      </td>
      {TABLE_COLUMNS[event.sport].map((group) => {
        const market = event.markets.find((item) => item.type === group.type);
        return [
          group.line && (
            <td key={`${group.type}:line`} className="px-0.5 py-1.5">
              <span className="flex h-10 w-12 items-center justify-center rounded-md bg-muted/60 text-xs font-semibold text-muted-foreground tabular">
                {market ? formatLine(group.type, market.line) : '–'}
              </span>
            </td>
          ),
          ...group.keys.map((key) => {
            const selection = market?.selections.find((item) => item.key === key);
            return (
              <td key={`${group.type}:${key}`} className="px-0.5 py-1.5">
                <div className="w-14">
                  {market && selection ? (
                    <OddsButton
                      compact
                      event={event}
                      market={market}
                      selection={selection}
                      label={selectionLabel(t, market, selection, event)}
                    />
                  ) : (
                    <span className="flex h-10 items-center justify-center rounded-md bg-muted/30 text-muted-foreground">
                      –
                    </span>
                  )}
                </div>
              </td>
            );
          }),
        ];
      })}
      <td className="px-2 py-1.5 text-right">
        <Link
          href={href}
          aria-label={t('allMarkets')}
          className="text-xs font-bold whitespace-nowrap text-primary hover:underline"
        >
          {t('moreMarkets', { count: event.marketCount })}
        </Link>
      </td>
    </tr>
  );
}
