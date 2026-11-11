import type { AdminPaymentsPage } from '@metrobet/contracts';
import { Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@metrobet/ui';
import { Banknote } from 'lucide-react';
import Link from 'next/link';

import { dateTime, money } from '@/lib/format';

import { PaymentStatusBadge } from './payment-status-badge';
import { WithdrawalActions } from './withdrawal-actions';

const PROVIDERS = { tbc: 'TBC', bog: 'BoG' } as const;

/** Deposits and withdrawals. `canDecide` shows approve / reject on pending withdrawals. */
export function PaymentsTable({
  payments,
  showPlayer = true,
  canDecide = false,
}: {
  payments: AdminPaymentsPage;
  showPlayer?: boolean;
  canDecide?: boolean;
}) {
  if (payments.items.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Banknote className="size-8 text-muted-foreground" />
        <p className="font-semibold">No payments found</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created</TableHead>
            {showPlayer && <TableHead>Player</TableHead>}
            <TableHead>Kind</TableHead>
            <TableHead>Card</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.items.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="text-muted-foreground">{dateTime(payment.createdAt)}</TableCell>
              {showPlayer && (
                <TableCell>
                  <Link href={`/players/${payment.playerId}`} className="hover:underline">
                    {payment.playerContact ?? payment.playerId}
                  </Link>
                </TableCell>
              )}
              <TableCell>
                <span className="font-semibold capitalize">{payment.kind}</span>
                <span className="text-muted-foreground"> · {PROVIDERS[payment.provider]}</span>
              </TableCell>
              <TableCell className="tabular">{payment.cardMask ?? '–'}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <PaymentStatusBadge status={payment.status} />
                  {(payment.reason || payment.decidedBy) && (
                    <span className="max-w-56 text-xs text-muted-foreground">
                      {[payment.reason, payment.decidedBy && `by ${payment.decidedBy}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold tabular">
                {money(payment.amount)}
              </TableCell>
              <TableCell>
                {canDecide && payment.kind === 'withdrawal' && payment.status === 'pending' && (
                  <WithdrawalActions payment={payment} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
