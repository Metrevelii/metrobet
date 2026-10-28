'use client';

import { toMinor } from '@metrobet/contracts';
import { Button } from '@metrobet/ui';
import { Plus } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';

import { useRouter } from '@/i18n/navigation';

import { devDeposit } from '../actions';

const AMOUNTS = [10, 50, 100, 500];

/** Development only: one-click test deposits. The page refreshes to show the new balance. */
export function DevDeposit() {
  const t = useTranslations('Wallet.dev');
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const deposit = (major: number) =>
    startTransition(async () => {
      const result = await devDeposit(toMinor(major));
      setFailed(!result.ok);
      if (result.ok) router.refresh();
    });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <p className="text-xs font-semibold text-muted-foreground">{t('title')}</p>
      <div className="flex flex-wrap gap-2">
        {AMOUNTS.map((amount) => (
          <Button
            key={amount}
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => deposit(amount)}
          >
            <Plus />
            {format.number(amount, { style: 'currency', currency: 'GEL' })}
          </Button>
        ))}
      </div>
      {failed && <p className="text-xs text-destructive">{t('failed')}</p>}
    </div>
  );
}
