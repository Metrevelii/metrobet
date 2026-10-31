'use client';

import {
  type CompetitionEvents,
  type EventSummary,
  TABLE_COLUMNS,
  tbilisiDateKey,
} from '@metrobet/contracts';
import { Card, cn } from '@metrobet/ui';
import { Star } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

import { toggleFavoriteLeague, useFavoriteLeagues } from '../favorites';
import { countryFlag } from '../flags';
import { MatchRow } from './match-row';

type DayGroup = { key: string; events: EventSummary[] };

const DAY = 24 * 60 * 60 * 1000;
const noSubscription = () => () => {};

/** Today's Tbilisi date key in the browser (null while rendering on the server). */
const useTodayKey = () =>
  useSyncExternalStore(
    noSubscription,
    () => tbilisiDateKey(Date.now()),
    () => null,
  );

/** Events grouped by Tbilisi calendar day (live events form one "Live" group). */
function byDay(events: EventSummary[], live: boolean): DayGroup[] {
  if (live) return [{ key: 'live', events }];
  const groups = new Map<string, EventSummary[]>();
  for (const event of events) {
    const key = tbilisiDateKey(Date.parse(event.startsAt));
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups].map(([key, items]) => ({ key, events: items }));
}

function DayLabel({ dayKey }: { dayKey: string }) {
  const t = useTranslations('Sports');
  const format = useFormatter();
  const today = useTodayKey();
  if (dayKey === 'live') {
    return (
      <span className="flex items-center gap-1.5 text-live">
        <span className="size-1.5 animate-pulse rounded-full bg-live" />
        {t('live')}
      </span>
    );
  }
  const tomorrow = today && tbilisiDateKey(Date.parse(`${today}T12:00:00Z`) + DAY);
  const date = format.dateTime(new Date(`${dayKey}T12:00:00Z`), {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });
  return (
    <span>
      {dayKey === today ? `${t('today')} · ` : dayKey === tomorrow ? `${t('tomorrow')} · ` : ''}
      {date}
    </span>
  );
}

/**
 * A league as a match table (Crystalbet-style): league header with ★ favourite, then per day a
 * header row repeating the column labels, then one row per match. Scrolls sideways on small
 * screens with the match column pinned.
 */
export function CompetitionTable({
  group,
  live = false,
}: {
  group: CompetitionEvents;
  live?: boolean;
}) {
  const t = useTranslations('Sports');
  const favorites = useFavoriteLeagues();
  const { competition } = group;
  const favorite = favorites.includes(competition.id);
  const columns = TABLE_COLUMNS[competition.sport];

  return (
    <Card className="overflow-hidden p-0">
      <header className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2.5">
        <span aria-hidden className="text-base leading-none">
          {countryFlag(competition.country)}
        </span>
        <h3 className="min-w-0 truncate text-sm font-bold">
          <span className="text-muted-foreground">{competition.country}</span>
          <span aria-hidden className="mx-1.5 text-muted-foreground">
            ·
          </span>
          {competition.name}
        </h3>
        <button
          type="button"
          onClick={() => toggleFavoriteLeague(competition.id)}
          aria-pressed={favorite}
          aria-label={t(favorite ? 'unfavorite' : 'favorite')}
          className="ml-1 cursor-pointer rounded p-0.5 text-muted-foreground transition-colors hover:text-warning"
        >
          <Star className={cn('size-4', favorite && 'fill-warning text-warning')} />
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {byDay(group.events, live).map((day) => (
            <tbody key={day.key}>
              <tr className="bg-muted/20 text-xs font-semibold text-muted-foreground">
                <th scope="colgroup" className="sticky left-0 z-10 bg-card px-3 py-2 text-left">
                  <DayLabel dayKey={day.key} />
                </th>
                {columns.map((column) => [
                  column.line && (
                    <th key={`${column.type}:line`} scope="col" className="px-0.5 py-2 text-center">
                      {t(`lineColumns.${column.type as 'total' | 'spread' | 'set_winner'}`)}
                    </th>
                  ),
                  ...column.keys.map((key) => (
                    <th
                      key={`${column.type}:${key}`}
                      scope="col"
                      className="px-0.5 py-2 text-center"
                    >
                      {t(`columns.${key as 'home'}`)}
                    </th>
                  )),
                ])}
                <th aria-hidden />
              </tr>
              {day.events.map((event) => (
                <MatchRow key={event.id} event={event} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </Card>
  );
}
