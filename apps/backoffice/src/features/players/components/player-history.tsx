import type { AdminGameRoundsPage, WalletTransactionsPage } from '@metrobet/contracts';
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

import { dateTime, money } from '@/lib/format';

const Empty = ({ children }: { children: string }) => (
  <Card className="px-6 py-10 text-center text-sm text-muted-foreground">{children}</Card>
);

/** The player's wallet transactions (their side of the ledger). */
export function TransactionsTable({ page }: { page: WalletTransactionsPage }) {
  if (page.items.length === 0) return <Empty>No transactions yet</Empty>;
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Game</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance after</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.items.map((item) => (
            <TableRow key={`${item.id}`}>
              <TableCell className="text-muted-foreground">{dateTime(item.createdAt)}</TableCell>
              <TableCell>
                <Badge>{item.type}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.gameSlug ?? '–'}</TableCell>
              <TableCell
                className={cn(
                  'text-right font-semibold tabular',
                  item.amount > 0 ? 'text-success' : 'text-foreground',
                )}
              >
                {item.amount > 0 ? '+' : ''}
                {money(item.amount)}
              </TableCell>
              <TableCell className="text-right tabular">{money(item.balanceAfter)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

/** The player's casino and crash rounds. */
export function RoundsTable({ page }: { page: AdminGameRoundsPage }) {
  if (page.items.length === 0) return <Empty>No game rounds yet</Empty>;
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Opened</TableHead>
            <TableHead>Game</TableHead>
            <TableHead>Round</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Bet</TableHead>
            <TableHead className="text-right">Win</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.items.map((round) => (
            <TableRow key={round.id}>
              <TableCell className="text-muted-foreground">{dateTime(round.openedAt)}</TableCell>
              <TableCell className="font-semibold">{round.gameSlug}</TableCell>
              <TableCell className="max-w-48 truncate font-mono text-xs text-muted-foreground">
                {round.externalId}
              </TableCell>
              <TableCell>
                <Badge variant={round.status === 'open' ? 'warning' : 'default'}>
                  {round.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular">{money(round.betTotal)}</TableCell>
              <TableCell
                className={cn(
                  'text-right tabular',
                  round.winTotal > 0 && 'font-semibold text-success',
                )}
              >
                {money(round.winTotal)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
