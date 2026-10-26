'use client';

import type { EventDetail } from '@metrobet/contracts';
import { Badge, Card } from '@metrobet/ui';
import { useFormatter, useTranslations } from 'next-intl';

import { useEventLiveState } from '../realtime/live-store';
import { LiveStatus } from './live-status';

/** Scoreboard: teams, live score, period/clock and period scores (or kick-off time). */
export function EventHeader({ event }: { event: EventDetail }) {
  const t = useTranslations('Sports');
  const format = useFormatter();
  const { status, live } = useEventLiveState(event);
  const started = status !== 'scheduled' && live;

  return (
    <Card className="flex flex-col gap-4 bg-glow p-5 md:p-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {status === 'live' && <Badge variant="live">{t('live')}</Badge>}
        <span>
          {event.competition.country} · {event.competition.name}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <h1 className="text-right text-base font-bold sm:text-lg md:text-2xl">{event.home.name}</h1>
        <div className="flex flex-col items-center gap-1">
          {started ? (
            <span className="text-3xl font-black tabular md:text-4xl">
              {live.score.home} : {live.score.away}
            </span>
          ) : (
            <span className="text-xl font-bold tabular">
              {format.dateTime(new Date(event.startsAt), { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <LiveStatus event={event} className="items-center" />
        </div>
        <h2 className="text-base font-bold sm:text-lg md:text-2xl">{event.away.name}</h2>
      </div>
      {started && live.periodScores.length > 1 && (
        <p className="text-center text-xs text-muted-foreground tabular">
          {live.periodScores.map((s) => `${s.home}-${s.away}`).join(' · ')}
        </p>
      )}
    </Card>
  );
}
