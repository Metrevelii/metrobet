'use client';

import { cashoutValue, type Ticket, toMajor } from '@metrobet/contracts';
import { Button, cn } from '@metrobet/ui';
import { Lock } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { setLiveBalance } from '@/features/wallet/live-balance';
import { useRouter } from '@/i18n/navigation';

import { peekSelection, useSelectionsSignature } from '../../realtime/live-store';
import { type CashoutError, cashoutTicket } from '../actions';

/**
 * The ticket's cash-out offer, live: the same formula as the server (`cashoutValue`), fed by the
 * live store when it has a newer price than the ticket snapshot. Two steps (tap, then confirm),
 * so a stray tap never sells a ticket.
 */
export function CashoutButton({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('Bets.cashout');
  const format = useFormatter();
  const router = useRouter();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [error, setError] = useState<CashoutError | null>(null);
  const [pending, startTransition] = useTransition();
  const running = ticket.selections.filter((selection) => selection.result === null);
  useSelectionsSignature(running.map((selection) => selection.selectionId));

  const offer = cashoutValue(
    ticket.stake,
    ticket.potentialWin,
    ticket.selections.map((selection) => {
      const live = peekSelection(selection.selectionId);
      const currentOdds = live
        ? live.active && live.marketStatus === 'open'
          ? live.odds
          : null
        : selection.currentOdds;
      return { odds: selection.odds, result: selection.result, currentOdds };
    }),
  );
  const money = (minor: number) =>
    format.number(toMajor(minor), { style: 'currency', currency: 'GEL' });

  const confirm = (amount: number) =>
    startTransition(async () => {
      const result = await cashoutTicket(ticket.id, amount);
      if (result.ok) {
        setConfirming(null);
        setError(null);
        setLiveBalance(result.data.balance);
        router.refresh();
        return;
      }
      setError(result.error);
      // A lower offer needs a fresh confirmation at the new amount.
      setConfirming(result.error === 'CASHOUT_CHANGED' ? (result.cashout ?? null) : null);
    });

  if (offer === null && confirming === null) {
    return (
      <div className="flex items-center justify-center gap-1.5 rounded-md bg-muted/50 py-2 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        {t('unavailable')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {confirming === null ? (
        <Button
          className="h-11 w-full bg-warning text-on-status hover:bg-warning/90"
          disabled={pending || offer === null}
          onClick={() => {
            setError(null);
            setConfirming(offer);
          }}
        >
          {t('button', { amount: money(offer!) })}
        </Button>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            className="h-11 bg-warning text-on-status hover:bg-warning/90"
            disabled={pending}
            onClick={() => confirm(confirming)}
          >
            {pending ? t('cashingOut') : t('confirm', { amount: money(confirming) })}
          </Button>
          <Button
            variant="secondary"
            className="h-11"
            disabled={pending}
            onClick={() => {
              setConfirming(null);
              setError(null);
            }}
          >
            {t('cancel')}
          </Button>
        </div>
      )}
      {error && (
        <p
          className={cn(
            'text-center text-xs',
            error === 'CASHOUT_CHANGED' ? 'text-warning' : 'text-destructive',
          )}
          aria-live="polite"
        >
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
