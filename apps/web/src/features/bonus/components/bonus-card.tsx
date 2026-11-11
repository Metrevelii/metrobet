import { type Bonus, toMajor } from '@metrobet/contracts';
import { Badge, Card } from '@metrobet/ui';
import { Gift } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { getBonuses } from '../data';

type Formatter = Awaited<ReturnType<typeof getFormatter>>;

const money = (format: Formatter, minor: number) =>
  format.number(toMajor(minor), { style: 'currency', currency: 'GEL' });
const date = (format: Formatter, iso: string) =>
  format.dateTime(new Date(iso), { dateStyle: 'medium', timeZone: 'Asia/Tbilisi' });

/**
 * The active bonus (wagering progress, expiry) and the last ended ones with what happened.
 * Nothing when the player never had a bonus. Request-time: inside <Suspense>.
 */
export async function BonusCard() {
  const [data, format, t] = await Promise.all([
    getBonuses(),
    getFormatter(),
    getTranslations('Bonus'),
  ]);
  if (!data || (!data.active && data.history.length === 0)) return null;
  const { active } = data;
  const share = active
    ? Math.min(100, (active.wagered / Math.max(1, active.wageringRequired)) * 100)
    : 0;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-bold">{t('title')}</h2>
      {active && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Gift className="size-5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-semibold">{active.title ?? t('bonus')}</span>
              <span className="text-xs text-muted-foreground">
                {t('expires', { date: date(format, active.expiresAt) })}
              </span>
            </div>
            <span className="text-xl font-bold tabular-nums">{money(format, active.balance)}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t('progress', {
                wagered: money(format, active.wagered),
                required: money(format, active.wageringRequired),
              })}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{t('rules')}</p>
        </Card>
      )}
      {data.history.length > 0 && (
        <Card>
          <ul className="divide-y">
            {data.history.slice(0, 5).map((bonus) => (
              <HistoryRow key={bonus.id} bonus={bonus} format={format} t={t} />
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

const VARIANTS = {
  active: 'primary',
  completed: 'success',
  forfeited: 'default',
  expired: 'default',
  cancelled: 'destructive',
} as const;

function HistoryRow({
  bonus,
  format,
  t,
}: {
  bonus: Bonus;
  format: Formatter;
  t: Awaited<ReturnType<typeof getTranslations<'Bonus'>>>;
}) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold">{bonus.title ?? t('bonus')}</span>
        <span className="truncate text-xs text-muted-foreground">
          {money(format, bonus.amount)} · {date(format, bonus.createdAt)}
          {bonus.status === 'completed' &&
            ` · ${t('converted', { amount: money(format, bonus.converted) })}`}
          {bonus.reason && ` · ${bonus.reason}`}
        </span>
      </div>
      <Badge variant={VARIANTS[bonus.status]}>{t(`status.${bonus.status}`)}</Badge>
    </li>
  );
}
