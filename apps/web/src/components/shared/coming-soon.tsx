import { Card } from '@metrobet/ui';
import { Hourglass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { EmptyState } from './empty-state';

/** Placeholder body for sections that are not built yet. */
export async function ComingSoon({ title }: { title: string }) {
  const t = await getTranslations('Common');
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <EmptyState icon={Hourglass} title={t('comingSoon')} />
      </Card>
    </div>
  );
}
