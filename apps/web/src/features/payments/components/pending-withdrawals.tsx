import { toMajor } from '@metrobet/contracts';
import { Card } from '@metrobet/ui';
import { Clock } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { getPendingWithdrawals } from '../data';
import { CancelWithdrawalButton } from './cancel-withdrawal-button';

/** Withdrawals waiting for approval, each cancellable. Request-time; nothing when none. */
export async function PendingWithdrawals() {
  const [items, format, t] = await Promise.all([
    getPendingWithdrawals(),
    getFormatter(),
    getTranslations('Payments'),
  ]);
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold">{t('pendingTitle')}</h2>
      <Card>
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <Clock className="size-4 shrink-0 text-warning" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-semibold tabular">
                  {format.number(toMajor(item.amount), { style: 'currency', currency: 'GEL' })}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {item.cardMask} ·{' '}
                  {format.dateTime(new Date(item.createdAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Asia/Tbilisi',
                  })}
                </span>
              </div>
              <CancelWithdrawalButton id={item.id} />
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-xs text-muted-foreground">{t('pendingHint')}</p>
    </section>
  );
}
