import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AccountLayout, ProfileCard } from '@/features/account';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account');
  return { title: t('title'), robots: { index: false } };
}

export default function AccountPage() {
  return (
    <AccountLayout tab="profile">
      <ProfileCard />
    </AccountLayout>
  );
}
