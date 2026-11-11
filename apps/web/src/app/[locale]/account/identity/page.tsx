import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AccountLayout, IdentityCard } from '@/features/account';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account.tabs');
  return { title: t('identity'), robots: { index: false } };
}

export default function IdentityPage() {
  return (
    <AccountLayout tab="identity">
      <IdentityCard />
    </AccountLayout>
  );
}
