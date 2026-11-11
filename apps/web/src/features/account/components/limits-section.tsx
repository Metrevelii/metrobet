'use client';

import {
  LIMIT_KINDS,
  type LimitKind,
  type PlayerLimit,
  type ResponsibleGaming,
  toMajor,
  toMinor,
} from '@metrobet/contracts';
import { Button, Card, cn, Input, toast } from '@metrobet/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { setLimit } from '../actions';

/** One limit: what is in force, how much of it is used, a pending change, and inline editing. */
function LimitRow({
  limit,
  onSaved,
}: {
  limit: PlayerLimit;
  onSaved: (data: ResponsibleGaming) => void;
}) {
  const t = useTranslations('Account.limits');
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(limit.amount === null ? '' : String(toMajor(limit.amount)));
  const [pending, startTransition] = useTransition();
  const money = (minor: number) =>
    format.number(toMajor(minor), { style: 'currency', currency: 'GEL' });
  const share = limit.amount ? Math.min(100, (limit.used / limit.amount) * 100) : 0;

  const save = (amount: number | null) =>
    startTransition(async () => {
      const result = await setLimit({ kind: limit.kind, period: limit.period, amount });
      if (!result.ok) {
        toast.error(t(result.fieldErrors?.amount === 'limitTooHigh' ? 'tooHigh' : 'failed'), {
          id: 'limit-error',
        });
        return;
      }
      const saved = result.data.limits.find(
        (item) => item.kind === limit.kind && item.period === limit.period,
      )!;
      toast.success(t(saved.pending ? 'savedLater' : 'saved'));
      setEditing(false);
      onSaved(result.data);
    });

  const major = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(major) && major > 0;

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{t(`periods.${limit.period}`)}</span>
        {!editing && (
          <div className="flex items-center gap-3">
            <span
              className={cn('text-sm tabular', limit.amount === null && 'text-muted-foreground')}
            >
              {limit.amount === null ? t('none') : money(limit.amount)}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              {limit.amount === null ? t('set') : t('change')}
            </Button>
          </div>
        )}
      </div>

      {limit.amount !== null && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full', share >= 100 ? 'bg-destructive' : 'bg-primary')}
              style={{ width: `${share}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular">
            {t('used', {
              used: money(limit.used),
              left: money(Math.max(0, limit.amount - limit.used)),
            })}
          </span>
        </div>
      )}

      {limit.pending && (
        <p className="text-xs text-warning">
          {t(limit.pending.amount === null ? 'pendingRemoval' : 'pendingRaise', {
            amount: limit.pending.amount === null ? '' : money(limit.pending.amount),
            time: format.dateTime(new Date(limit.pending.effectiveAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Tbilisi',
            }),
          })}
        </p>
      )}

      {editing && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) save(toMinor(major));
          }}
        >
          <div className="relative w-36">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
              aria-label={t('amount')}
              className="pr-7 tabular"
            />
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">
              ₾
            </span>
          </div>
          <Button type="submit" size="sm" disabled={pending || !valid}>
            {t('save')}
          </Button>
          {limit.amount !== null && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => save(null)}
            >
              {t('remove')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            {t('cancel')}
          </Button>
        </form>
      )}
    </li>
  );
}

/** Deposit, loss and stake limits per day / week / month. */
export function LimitsSection({ initial }: { initial: ResponsibleGaming }) {
  const t = useTranslations('Account.limits');
  const [data, setData] = useState(initial);
  const ofKind = (kind: LimitKind) => data.limits.filter((limit) => limit.kind === kind);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {LIMIT_KINDS.map((kind) => (
          <Card key={kind} className="flex flex-col gap-1 p-4">
            <h3 className="font-bold">{t(`kinds.${kind}.title`)}</h3>
            <p className="text-xs text-muted-foreground">{t(`kinds.${kind}.hint`)}</p>
            <ul className="flex flex-col divide-y">
              {ofKind(kind).map((limit) => (
                <LimitRow
                  // Re-mount after a save so the input shows the saved amount.
                  key={`${limit.period}:${limit.amount}:${limit.pending?.effectiveAt ?? ''}`}
                  limit={limit}
                  onSaved={setData}
                />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}
