import { Skeleton } from '@metrobet/ui';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getCurrentPlayer } from '@/features/auth';
import { DepositForm } from '@/features/payments';
import { Link, redirect } from '@/i18n/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Payments');
  return { title: t('depositTitle'), robots: { index: false } };
}

async function SignedIn() {
  if (!(await getCurrentPlayer())) {
    redirect({ href: '/login?next=/wallet/deposit', locale: await getLocale() });
  }
  return <DepositForm />;
}

export default async function DepositPage() {
  const t = await getTranslations('Payments');
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/wallet"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {t('backToWallet')}
        </Link>
        <h1 className="text-2xl font-bold">{t('depositTitle')}</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <SignedIn />
      </Suspense>
    </div>
  );
}
