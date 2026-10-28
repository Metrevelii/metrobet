import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getCurrentPlayer } from '@/features/auth';
import { WalletView } from '@/features/wallet';
import { redirect } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/wallet'>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Wallet');
  return { title: t('title'), robots: { index: false } };
}

async function WalletContent({ searchParams }: Pick<Props, 'searchParams'>) {
  if (!(await getCurrentPlayer())) {
    redirect({ href: '/login?next=/wallet', locale: await getLocale() });
  }
  const page = Number((await searchParams).page);
  return <WalletView page={Number.isInteger(page) && page > 0 ? page : 1} />;
}

export default async function WalletPage({ searchParams }: Props) {
  const t = await getTranslations('Wallet');
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-40 rounded-lg" />
            <Skeleton className="h-96 rounded-lg" />
          </div>
        }
      >
        <WalletContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
