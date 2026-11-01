import type { Market, MarketLiability, Suspension } from '@metrobet/contracts';
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@metrobet/ui';

import { money } from '@/lib/format';
import { marketText, selectionName } from '@/lib/sportsbook-labels';

import { SuspendButton } from './suspend-button';

const STATUS = {
  open: <Badge variant="success">Open</Badge>,
  suspended: <Badge variant="warning">Suspended</Badge>,
  closed: <Badge>Closed</Badge>,
};

/**
 * One market for trading: player price (and the feed's, when a margin rule changes it), what open
 * tickets risk on each selection, and suspend / resume.
 */
export function MarketTradingCard({
  market,
  feedOdds,
  liability,
  suspension,
  eventSuspended,
}: {
  market: Market;
  feedOdds: Record<string, number>;
  liability: MarketLiability | undefined;
  suspension: Suspension | undefined;
  eventSuspended: boolean;
}) {
  const name = marketText(market.type, market.line);
  const marketStake = liability?.stake ?? 0;
  return (
    <Card className="overflow-hidden p-0">
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 text-sm">
            {name} {STATUS[market.status]}
          </CardTitle>
          {suspension && (
            <p className="text-xs text-muted-foreground">
              Suspended by {suspension.by}: {suspension.reason}
            </p>
          )}
        </div>
        {market.status !== 'closed' && !eventSuspended && (
          <SuspendButton
            scope="market"
            targetId={market.id}
            name={name}
            suspended={suspension !== undefined}
          />
        )}
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Selection</TableHead>
            <TableHead className="text-right">Odds</TableHead>
            <TableHead className="text-right">Singles</TableHead>
            <TableHead className="text-right">Combos</TableHead>
            <TableHead className="text-right">Payout if wins</TableHead>
            <TableHead className="text-right">Net if wins</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {market.selections.map((selection) => {
            const row = liability?.selections.find((item) => item.selectionId === selection.id);
            const feed = feedOdds[selection.id];
            const net = row?.net ?? marketStake;
            return (
              <TableRow key={selection.id}>
                <TableCell className="font-semibold">{selectionName(selection.key)}</TableCell>
                <TableCell className="text-right tabular">
                  {selection.odds.toFixed(2)}
                  {feed !== undefined && feed !== selection.odds && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      (feed {feed.toFixed(2)})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular">
                  {row?.singles.count ? `${row.singles.count} · ${money(row.singles.stake)}` : '–'}
                </TableCell>
                <TableCell className="text-right tabular">{row?.combos.count || '–'}</TableCell>
                <TableCell className="text-right tabular">
                  {money((row?.singles.payout ?? 0) + (row?.combos.payout ?? 0))}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-semibold tabular',
                    net < 0 ? 'text-destructive' : net > 0 && 'text-success',
                  )}
                >
                  {money(net)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
