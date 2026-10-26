import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ComingSoon } from '@/components/shared/coming-soon';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('live') };
}

export default async function LivePage() {
  const t = await getTranslations('Nav');
  return <ComingSoon title={t('live')} />;
}
