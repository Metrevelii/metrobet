'use client';

import { Card, cn } from '@metrobet/ui';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';

import { BETS_HREF } from '../bets/links';
import { Betslip } from './betslip';
import { clearBetslip, useBetslip } from './store';

/** Header tabs: the betslip (with its count) and a link to the player's bets. */
export function BetslipTabs() {
  const t = useTranslations('Betslip');
  const count = useBetslip()?.items.length ?? 0;
  return (
    <div className="flex items-stretch border-b">
      <span
        aria-current="page"
        className="-mb-px flex items-center gap-2 border-b-2 border-primary px-4 py-3 text-sm font-bold"
      >
        {t('title')}
        {count > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-black text-primary-foreground tabular">
            {count}
          </span>
        )}
      </span>
      <Link
        href={BETS_HREF}
        className="flex items-center px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        {t('viewBets')}
      </Link>
      {count > 0 && (
        <button
          type="button"
          onClick={clearBetslip}
          aria-label={t('clear')}
          title={t('clear')}
          className="ml-auto cursor-pointer px-4 text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  );
}

/** Desktop betslip column (sticky, scrolls internally). */
export function BetslipRail({ className }: { className?: string }) {
  return (
    <Card className={cn('flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden', className)}>
      <BetslipTabs />
      <div className="min-h-0 overflow-y-auto">
        <Betslip />
      </div>
    </Card>
  );
}
