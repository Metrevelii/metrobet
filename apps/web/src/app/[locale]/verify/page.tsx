import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthCard, getCurrentPlayer, safeNext, VerifyForm } from '@/features/auth';
import { redirect } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/verify'>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.verify');
  return { title: t('title'), robots: { index: false } };
}

async function VerifyView({ searchParams }: Pick<Props, 'searchParams'>) {
  const next = safeNext((await searchParams).next);
  const player = await getCurrentPlayer();
  if (!player) redirect({ href: '/login?next=/verify', locale: await getLocale() });
  const t = await getTranslations('Auth.verify');
  return (
    <AuthCard
      title={t('title')}
      subtitle={
        player!.verified
          ? undefined
          : t('subtitle', { contact: player!.email ?? player!.phone ?? '' })
      }
    >
      <VerifyForm next={next} verified={player!.verified} />
    </AuthCard>
  );
}

export default function VerifyPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-80 max-w-md rounded-lg" />}>
      <VerifyView searchParams={searchParams} />
    </Suspense>
  );
}
