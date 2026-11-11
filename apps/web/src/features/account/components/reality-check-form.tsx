'use client';

import { REALITY_CHECK_MINUTES, type RealityCheckMinutes } from '@metrobet/contracts';
import { Card, Chip, toast } from '@metrobet/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

import { setRealityCheck } from '../actions';

const OPTIONS: RealityCheckMinutes[] = [null, ...REALITY_CHECK_MINUTES];

/** How often the site reminds the player how long they've played and their result. */
export function RealityCheckForm({ initial }: { initial: RealityCheckMinutes }) {
  const t = useTranslations('Account.realityCheck');
  const router = useRouter();
  const [minutes, setMinutes] = useState(initial);
  const [pending, startTransition] = useTransition();

  const choose = (next: RealityCheckMinutes) =>
    startTransition(async () => {
      const result = await setRealityCheck(next);
      if (!result.ok) {
        toast.error(t('failed'), { id: 'reality-check' });
        return;
      }
      setMinutes(next);
      toast.success(next === null ? t('turnedOff') : t('saved', { minutes: next }));
      // The reminder in the header reads the new interval.
      router.refresh();
    });

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('hint')}</p>
      </div>
      <fieldset className="flex flex-wrap gap-2" aria-label={t('title')}>
        {OPTIONS.map((option) => (
          <Chip
            key={option ?? 'off'}
            selected={minutes === option}
            disabled={pending}
            onClick={() => choose(option)}
          >
            {option === null ? t('off') : t('every', { minutes: option })}
          </Chip>
        ))}
      </fieldset>
    </Card>
  );
}
