import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AccountLayout, ChangePasswordForm, getSessions, SessionsList } from '@/features/account';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Account.tabs');
  return { title: t('security'), robots: { index: false } };
}

async function Sessions() {
  const sessions = await getSessions();
  return sessions ? <SessionsList sessions={sessions} /> : null;
}

export default function SecurityPage() {
  return (
    <AccountLayout tab="security">
      <div className="flex flex-col gap-4">
        <ChangePasswordForm />
        <Sessions />
      </div>
    </AccountLayout>
  );
}
