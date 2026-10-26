import { Card } from '@metrobet/ui';
import { SearchX, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/shared/empty-state';

/** Empty result (`empty`) or API outage (`error`) in place of a game grid. */
export function GamesUnavailable({ reason }: { reason: 'empty' | 'error' }) {
  const t = useTranslations();
  return (
    <Card>
      {reason === 'empty' ? (
        <EmptyState
          icon={SearchX}
          title={t('Casino.noResults')}
          description={t('Casino.noResultsHint')}
        />
      ) : (
        <EmptyState
          icon={TriangleAlert}
          title={t('Errors.title')}
          description={t('Errors.description')}
        />
      )}
    </Card>
  );
}
