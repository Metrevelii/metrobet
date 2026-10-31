'use client';

import { type Ticket, toMajor } from '@metrobet/contracts';
import { Badge, Card, cn } from '@metrobet/ui';
import { Check, Minus, X } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

import { marketLabel, selectionLabel } from '../../labels';

const STATUS_BADGE = {
  open: 'default',
  won: 'success',
  lost: 'destructive',
  void: 'warning',
} as const;

function ResultIcon({ result }: { result: Ticket['selections'][number]['result'] }) {
  const t = useTranslations('Bets.results');
  if (result === null) return <span className="size-4" aria-hidden />;
  const Icon = result === 'won' ? Check : result === 'lost' ? X : Minus;
  return (
    <Icon
      aria-label={t(result)}
      className={cn(
        'size-4 shrink-0',
        result === 'won' ? 'text-success' : result === 'lost' ? 'text-destructive' : 'text-warning',
      )}
    />
  );
}

/** One placed ticket: its selections with results, stake, odds and (potential) payout. */
export function TicketCard({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('Bets');
  const ts = useTranslations('Sports');
  const format = useFormatter();
  const money = (minor: number) =>
    format.number(toMajor(minor), { style: 'currency', currency: 'GEL' });
  const settled = ticket.status !== 'open';

  return (
    <Card className="flex flex-col">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-bold">
            {ticket.mode === 'combo'
              ? t('combo', { count: ticket.selections.length })
              : t('single')}
          </span>
          <span className="text-xs text-muted-foreground">
            {format.dateTime(new Date(ticket.placedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Tbilisi',
            })}
          </span>
        </div>
        <Badge variant={STATUS_BADGE[ticket.status]}>{t(`status.${ticket.status}`)}</Badge>
      </header>

      <ul className="divide-y">
        {ticket.selections.map((selection) => {
          const market = { type: selection.marketType, line: selection.line };
          const teams = {
            home: { name: selection.home, abbreviation: '' },
            away: { name: selection.away, abbreviation: '' },
          };
          return (
            <li key={selection.selectionId} className="flex items-start gap-3 px-4 py-3">
              <ResultIcon result={selection.result} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-semibold">
                  {selectionLabel(ts, market, { key: selection.selectionKey }, teams)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {marketLabel(ts, market)} · {selection.home} – {selection.away}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {selection.competition} ·{' '}
                  {format.dateTime(new Date(selection.startsAt), {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Asia/Tbilisi',
                  })}
                </span>
              </div>
              <span className="text-sm font-bold tabular">{selection.odds.toFixed(2)}</span>
            </li>
          );
        })}
      </ul>

      <footer className="grid grid-cols-3 gap-2 border-t px-4 py-3 text-xs">
        <div className="flex flex-col">
          <span className="text-muted-foreground">{t('stake')}</span>
          <span className="font-semibold tabular">{money(ticket.stake)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-muted-foreground">{t('odds')}</span>
          <span className="font-semibold tabular">{ticket.odds.toFixed(2)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-muted-foreground">{settled ? t('payout') : t('potentialWin')}</span>
          <span
            className={cn(
              'font-bold tabular',
              ticket.status === 'won' ? 'text-success' : !settled && 'text-primary',
            )}
          >
            {money(settled ? ticket.payout : ticket.potentialWin)}
          </span>
        </div>
      </footer>
    </Card>
  );
}
