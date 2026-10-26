import { Card, CardContent, CardHeader, CardTitle, cn } from '@metrobet/ui';
import { Ticket } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { EmptyState } from '@/components/shared/empty-state';

export async function BetslipPanel({ className }: { className?: string }) {
  const t = await getTranslations('Betslip');
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <Ticket className="size-4 text-primary" />
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState icon={Ticket} title={t('empty')} description={t('emptyHint')} />
      </CardContent>
    </Card>
  );
}
