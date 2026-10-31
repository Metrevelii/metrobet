import type { AdminTicketsPage } from '@metrobet/contracts';
import {
  Card,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@metrobet/ui';
import { Ticket } from 'lucide-react';
import Link from 'next/link';

import { dateTime, money } from '@/lib/format';

import { TicketStatusBadge } from './ticket-status-badge';

/** Sports tickets with their player. `showPlayer` off on a player's own page. */
export function TicketsTable({
  tickets,
  showPlayer = true,
}: {
  tickets: AdminTicketsPage;
  showPlayer?: boolean;
}) {
  if (tickets.items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Ticket className="size-8 text-muted-foreground" />
        <p className="font-semibold">No tickets found</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Placed</TableHead>
            {showPlayer && <TableHead>Player</TableHead>}
            <TableHead>Ticket</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Stake</TableHead>
            <TableHead className="text-right">Odds</TableHead>
            <TableHead className="text-right">Payout</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.items.map((ticket) => (
            <TableRow key={ticket.id}>
              <TableCell className="text-muted-foreground">{dateTime(ticket.placedAt)}</TableCell>
              {showPlayer && (
                <TableCell>
                  <Link href={`/players/${ticket.player.id}`} className="hover:underline">
                    {ticket.player.email ?? ticket.player.phone}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <Link href={`/bets/${ticket.id}`} className="font-semibold hover:underline">
                  {ticket.mode === 'combo'
                    ? `Accumulator (${ticket.selections.length})`
                    : `${ticket.selections[0]?.home} – ${ticket.selections[0]?.away}`}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">
                  {ticket.id.slice(0, 8)}
                </div>
              </TableCell>
              <TableCell>
                <TicketStatusBadge status={ticket.status} />
              </TableCell>
              <TableCell className="text-right tabular">{money(ticket.stake)}</TableCell>
              <TableCell className="text-right tabular">{ticket.odds.toFixed(2)}</TableCell>
              <TableCell
                className={cn(
                  'text-right tabular',
                  ticket.status === 'won' && 'font-semibold text-success',
                )}
              >
                {ticket.status === 'open'
                  ? `(${money(ticket.potentialWin)})`
                  : money(ticket.payout)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
