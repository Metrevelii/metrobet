import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { ComingSoon } from '@/components/shared/coming-soon';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Nav');
  return { title: t('sports') };
}

export default async function SportsPage() {
  const t = await getTranslations('Nav');
  return <ComingSoon title={t('sports')} />;
}
