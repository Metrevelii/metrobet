import type { AdminTradingEventsPage, EventLiabilitySummary } from '@metrobet/contracts';
import {
  Badge,
  Card,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@metrobet/ui';
import { Trophy } from 'lucide-react';
import Link from 'next/link';

import { money } from '@/lib/format';

import { EventState } from './event-state';
import { SuspendButton } from './suspend-button';

/** Events with their open-ticket liability and a suspend / resume control. */
export function TradingEventsTable({
  events,
  liability,
}: {
  events: AdminTradingEventsPage;
  liability: EventLiabilitySummary[];
}) {
  if (events.items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Trophy className="size-8 text-muted-foreground" />
        <p className="font-semibold">No events found</p>
      </Card>
    );
  }
  const byEvent = new Map(liability.map((item) => [item.eventId, item]));
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>State</TableHead>
            <TableHead>Match</TableHead>
            <TableHead>Markets</TableHead>
            <TableHead className="text-right">Open tickets</TableHead>
            <TableHead className="text-right">Stakes</TableHead>
            <TableHead className="text-right">Worst case</TableHead>
            <TableHead className="text-right">Trading</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.items.map((event) => {
            const risk = byEvent.get(event.id);
            const name = `${event.home} – ${event.away}`;
            return (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap">
                  <EventState event={event} />
                </TableCell>
                <TableCell>
                  <Link href={`/sportsbook/${event.id}`} className="font-semibold hover:underline">
                    {name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {event.sport} · {event.competition.country} · {event.competition.name}
                    {event.trading.margin !== null && ` · margin ${event.trading.margin}%`}
                  </p>
                </TableCell>
                <TableCell>
                  {event.suspended ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : event.suspendedMarkets > 0 ? (
                    <Badge variant="warning">
                      {event.suspendedMarkets} of {event.marketCount} suspended
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">{event.marketCount}</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular">{risk?.tickets ?? 0}</TableCell>
                <TableCell className="text-right tabular">{money(risk?.stake ?? 0)}</TableCell>
                <TableCell
                  className={cn(
                    'text-right font-semibold tabular',
                    (risk?.worstCase ?? 0) > 0 && 'text-destructive',
                  )}
                >
                  {money(risk?.worstCase ?? 0)}
                </TableCell>
                <TableCell className="text-right">
                  <SuspendButton
                    scope="event"
                    targetId={event.id}
                    name={name}
                    suspended={event.suspended}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
