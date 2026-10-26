'use client';

import type { EventSummary } from '@metrobet/contracts';
import { cn } from '@metrobet/ui';
import { useFormatter, useTranslations } from 'next-intl';

import { periodLabel } from '../labels';
import { useEventLiveState } from '../realtime/live-store';

type Props = {
  event: Pick<EventSummary, 'id' | 'status' | 'live' | 'startsAt'>;
  className?: string;
};

/** Period + clock for live events, otherwise the kick-off day and time. */
export function LiveStatus({ event, className }: Props) {
  const t = useTranslations('Sports');
  const format = useFormatter();
  const { status, live } = useEventLiveState(event);

  if (status === 'scheduled' || !live) {
    const date = new Date(event.startsAt);
    return (
      <div className={cn('flex flex-col text-xs text-muted-foreground', className)}>
        <span className="font-semibold text-foreground tabular">
          {format.dateTime(date, { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span>{format.dateTime(date, { day: 'numeric', month: 'short' })}</span>
      </div>
    );
  }

  const period = periodLabel(t, live.period);
  return (
    <div className={cn('flex flex-col text-xs', className)}>
      <span
        className={cn(
          'flex items-center gap-1 font-bold',
          status === 'live' ? 'text-live' : 'text-muted-foreground',
        )}
      >
        {status === 'live' && <span className="size-1.5 animate-pulse rounded-full bg-live" />}
        {live.clock ?? period}
      </span>
      {live.clock && <span className="truncate text-muted-foreground">{period}</span>}
    </div>
  );
}
