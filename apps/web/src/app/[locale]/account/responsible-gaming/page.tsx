import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import {
  AccountLayout,
  ExclusionCard,
  getResponsibleGaming,
  LimitsSection,
  RealityCheckForm,
} from '@/features/account';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account.tabs');
  return { title: t('responsibleGaming'), robots: { index: false } };
}

async function Tools() {
  const [data, t] = await Promise.all([getResponsibleGaming(), getTranslations('Account')]);
  if (!data) return <p className="text-sm text-muted-foreground">{t('unavailable')}</p>;
  return (
    <div className="flex flex-col gap-6">
      <LimitsSection initial={data} />
      <RealityCheckForm initial={data.realityCheckMinutes} />
      <ExclusionCard />
      <p className="text-xs text-muted-foreground">{t('helpLine')}</p>
    </div>
  );
}

export default function ResponsibleGamingPage() {
  return (
    <AccountLayout tab="responsibleGaming">
      <Tools />
    </AccountLayout>
  );
}
