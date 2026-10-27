import type { PromoBlockViewOf } from '@metrobet/contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@metrobet/ui';
import { CalendarClock, ScrollText } from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { lines } from './split-text';

export async function TermsBlock({
  block,
  endsAt,
}: {
  block: PromoBlockViewOf<'terms'>;
  endsAt: string | null;
}) {
  const t = await getTranslations('Promotions');
  const format = await getFormatter();
  return (
    <Card>
      <CardHeader>
        <ScrollText className="size-4 text-primary" />
        <CardTitle>{t('terms')}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-muted-foreground marker:text-primary">
          {lines(block.body).map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ul>
        <p className="flex items-center gap-2 border-t pt-4 text-xs text-muted-foreground">
          <CalendarClock className="size-4" />
          {endsAt
            ? t('validUntil', { date: format.dateTime(new Date(endsAt), { dateStyle: 'long' }) })
            : t('ongoing')}
        </p>
      </CardContent>
    </Card>
  );
}
