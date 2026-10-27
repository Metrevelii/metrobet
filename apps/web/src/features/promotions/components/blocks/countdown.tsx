'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';

const SECOND = 1000;
// [unit, seconds per unit, wraps at]
const UNITS = [
  ['days', 86_400, Infinity],
  ['hours', 3_600, 24],
  ['minutes', 60, 60],
  ['seconds', 1, 60],
] as const;

function subscribe(onTick: () => void) {
  const timer = setInterval(onTick, SECOND);
  return () => clearInterval(timer);
}
// Whole seconds, so React only re-renders when the display changes.
const now = () => Math.floor(Date.now() / SECOND);

/** Ticking days/hours/minutes/seconds tiles. Renders dashes on the server (no hydration drift). */
export function Countdown({ endsAt }: { endsAt: string }) {
  const t = useTranslations('Promotions.countdown');
  const current = useSyncExternalStore(subscribe, now, () => null);
  const left =
    current === null ? null : Math.max(0, Math.floor(Date.parse(endsAt) / SECOND) - current);

  if (left === 0) {
    return <p className="text-sm font-semibold text-muted-foreground">{t('ended')}</p>;
  }

  return (
    <dl className="flex gap-2" aria-live="off">
      {UNITS.map(([unit, size, modulo]) => (
        <div
          key={unit}
          className="flex w-16 flex-col-reverse items-center rounded-md bg-secondary px-2 py-2 sm:w-18"
        >
          <dt className="text-[11px] text-muted-foreground uppercase">{t(unit)}</dt>
          <dd className="text-2xl font-bold tabular-nums">
            {left === null ? '--' : String(Math.floor(left / size) % modulo).padStart(2, '0')}
          </dd>
        </div>
      ))}
    </dl>
  );
}
