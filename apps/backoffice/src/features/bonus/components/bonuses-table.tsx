import type { AdminBonus, BonusStatus } from '@metrobet/contracts';
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
import { Gift } from 'lucide-react';

import { dateTime, money } from '@/lib/format';

import { CancelBonusButton } from './cancel-bonus-button';

const VARIANTS = {
  active: 'primary',
  completed: 'success',
  forfeited: 'default',
  expired: 'default',
  cancelled: 'destructive',
} as const satisfies Record<BonusStatus, 'primary' | 'success' | 'default' | 'destructive'>;

/** A player's bonuses with wagering progress. `canCancel` shows Cancel on the active one. */
export function BonusesTable({
  bonuses,
  canCancel,
}: {
  bonuses: AdminBonus[];
  canCancel: boolean;
}) {
  if (bonuses.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
        <Gift className="size-8 text-muted-foreground" />
        <p className="font-semibold">No bonuses</p>
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Granted</TableHead>
            <TableHead>Bonus</TableHead>
            <TableHead>Wagering</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {bonuses.map((bonus) => (
            <TableRow key={bonus.id}>
              <TableCell className="text-muted-foreground">{dateTime(bonus.createdAt)}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-semibold">{bonus.title ?? 'Bonus'}</span>
                  <span className="text-xs text-muted-foreground">
                    {money(bonus.amount)} · expires {dateTime(bonus.expiresAt)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="tabular">
                {money(bonus.wagered)} / {money(bonus.wageringRequired)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <Badge variant={VARIANTS[bonus.status]}>{bonus.status}</Badge>
                  {(bonus.reason || bonus.converted > 0) && (
                    <span className="max-w-56 text-xs text-muted-foreground">
                      {bonus.converted > 0 ? `${money(bonus.converted)} became cash` : bonus.reason}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right font-semibold tabular">
                {bonus.status === 'active' ? money(bonus.balance) : '–'}
              </TableCell>
              <TableCell className="text-right">
                {canCancel && bonus.status === 'active' && <CancelBonusButton bonus={bonus} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
