'use client';

import { Badge, Card, cn } from '@metrobet/ui';
import { Ticket } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Betslip } from './betslip';
import { clearBetslip, useBetslip } from './store';

/** Desktop betslip column (sticky, scrolls internally). */
export function BetslipRail({ className }: { className?: string }) {
  const t = useTranslations('Betslip');
  const count = useBetslip()?.items.length ?? 0;
  return (
    <Card className={cn('flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden', className)}>
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Ticket className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        {count > 0 && <Badge variant="primary">{count}</Badge>}
        {count > 0 && (
          <button
            type="button"
            onClick={clearBetslip}
            className="ml-auto cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          >
            {t('clear')}
          </button>
        )}
      </div>
      <div className="min-h-0 overflow-y-auto">
        <Betslip />
      </div>
    </Card>
  );
}
