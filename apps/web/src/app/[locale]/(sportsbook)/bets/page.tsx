import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { getCurrentPlayer } from '@/features/auth';
import { BETS_HREF, type BetsTab, MyBets } from '@/features/sportsbook';
import { redirect } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/bets'>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Bets');
  return { title: t('title'), robots: { index: false } };
}

async function BetsContent({ searchParams }: Pick<Props, 'searchParams'>) {
  if (!(await getCurrentPlayer())) {
    redirect({ href: `/login?next=${BETS_HREF}`, locale: await getLocale() });
  }
  const { status, page } = await searchParams;
  const tab: BetsTab = status === 'settled' ? 'settled' : 'open';
  const number = Number(page);
  return <MyBets tab={tab} page={Number.isInteger(number) && number > 0 ? number : 1} />;
}

export default async function BetsPage({ searchParams }: Props) {
  const t = await getTranslations('Bets');
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-64 rounded-lg" />
          </div>
        }
      >
        <BetsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
