import type { AdminTicket } from '@metrobet/contracts';
import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@metrobet/ui';

import { dateTime } from '@/lib/format';
import { selectionText } from '@/lib/sportsbook-labels';

const RESULT = { won: 'success', lost: 'destructive', void: 'warning' } as const;

/** The ticket's selections as placed (snapshot), with their results. */
export function TicketSelections({ ticket }: { ticket: AdminTicket }) {
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Event</TableHead>
            <TableHead>Selection</TableHead>
            <TableHead className="text-right">Odds</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ticket.selections.map((selection, index) => (
            <TableRow key={selection.selectionId}>
              <TableCell className="text-muted-foreground">{index + 1}</TableCell>
              <TableCell>
                <div className="font-semibold">
                  {selection.home} – {selection.away}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selection.sport} · {selection.competition} · {dateTime(selection.startsAt)}
                </div>
              </TableCell>
              <TableCell>
                {selectionText(selection.marketType, selection.line, selection.selectionKey)}
                <div className="max-w-64 truncate font-mono text-xs text-muted-foreground">
                  {selection.selectionId}
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold tabular">
                {selection.odds.toFixed(2)}
              </TableCell>
              <TableCell>
                {selection.result ? (
                  <Badge variant={RESULT[selection.result]}>{selection.result}</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">pending</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
