import type { AdminTradingEvent } from '@metrobet/contracts';
import { Badge } from '@metrobet/ui';

import { dateTime } from '@/lib/format';

/** Live clock and score, or kick-off time. */
export function EventState({
  event,
}: {
  event: Pick<AdminTradingEvent, 'status' | 'live' | 'startsAt'>;
}) {
  if (event.status !== 'live' || !event.live) {
    return <span className="text-muted-foreground">{dateTime(event.startsAt)}</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <Badge variant="live">Live</Badge>
      <span className="font-semibold tabular">
        {event.live.score.home}:{event.live.score.away}
      </span>
      <span className="text-xs text-muted-foreground">{event.live.clock ?? event.live.period}</span>
    </span>
  );
}
