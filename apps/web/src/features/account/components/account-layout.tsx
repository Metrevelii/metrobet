import { Skeleton } from '@metrobet/ui';
import { getLocale, getTranslations } from 'next-intl/server';
import { type ReactNode, Suspense } from 'react';

import { getCurrentPlayer } from '@/features/auth';
import { redirect } from '@/i18n/navigation';

import { type AccountTab, ACCOUNT_TABS, AccountTabs } from './account-tabs';

/** Sends signed-out visitors to log in, then back to this tab. Request-time. */
async function SignedIn({ tab, children }: { tab: AccountTab; children: ReactNode }) {
  if (!(await getCurrentPlayer())) {
    const href = ACCOUNT_TABS.find((item) => item.key === tab)!.href;
    redirect({ href: `/login?next=${href}`, locale: await getLocale() });
  }
  return children;
}

/** Title, section tabs and the tab's content (request-time, inside Suspense). */
export async function AccountLayout({ tab, children }: { tab: AccountTab; children: ReactNode }) {
  const t = await getTranslations('Account');
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <AccountTabs active={tab} />
      </div>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        }
      >
        <SignedIn tab={tab}>{children}</SignedIn>
      </Suspense>
    </div>
  );
}
