'use client';

import { Toaster } from '@metrobet/ui';
import { useTranslations } from 'next-intl';

/** The site's toasts (one per app), with translated labels. */
export function AppToaster() {
  const t = useTranslations('Common');
  return <Toaster closeLabel={t('close')} label={t('notifications')} />;
}
