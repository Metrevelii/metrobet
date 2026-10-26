import { Button, Card } from '@metrobet/ui';
import { SearchX } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/shared/empty-state';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('NotFound');
  return (
    <Card className="flex flex-col items-center pb-8">
      <EmptyState icon={SearchX} title={t('title')} description={t('description')} />
      <Button variant="secondary" asChild>
        <Link href="/">{t('back')}</Link>
      </Button>
    </Card>
  );
}
