'use client';

import { Button, Card } from '@metrobet/ui';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/shared/empty-state';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('Errors');
  return (
    <Card className="flex flex-col items-center pb-8">
      <EmptyState icon={TriangleAlert} title={t('title')} description={t('description')} />
      <Button variant="secondary" onClick={reset}>
        {t('retry')}
      </Button>
    </Card>
  );
}
