'use client';

import { Sheet, SheetContent, SheetTrigger } from '@metrobet/ui';
import { Ticket } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Betslip } from './betslip';
import { useBetslip } from './store';

/** Mobile/tablet: floating betslip button (above the bottom nav) opening a bottom sheet. */
export function BetslipSheet() {
  const t = useTranslations('Betslip');
  const common = useTranslations('Common');
  const slip = useBetslip();
  const count = slip?.items.length ?? 0;
  if (count === 0) return null;

  return (
    <Sheet>
      <SheetTrigger
        aria-label={t('open')}
        className="fixed right-4 bottom-20 z-30 flex h-12 cursor-pointer items-center gap-2 rounded-full bg-primary pr-4 pl-3 font-semibold text-primary-foreground shadow-glow xl:hidden"
      >
        <Ticket className="size-5" />
        {t('count', { count })}
      </SheetTrigger>
      <SheetContent title={t('title')} closeLabel={common('close')}>
        <Betslip />
      </SheetContent>
    </Sheet>
  );
}
