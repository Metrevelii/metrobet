import { MIN_PLAYER_AGE } from '@metrobet/contracts';
import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthCard, getCurrentPlayer, RegisterForm, safeNext } from '@/features/auth';
import { Link, redirect } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/register'>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.register');
  return { title: t('title') };
}

/** Today minus the minimum age (request-time, so it's always current). */
function latestBirthDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - MIN_PLAYER_AGE);
  return date.toISOString().slice(0, 10);
}

async function RegisterView({ searchParams }: Pick<Props, 'searchParams'>) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentPlayer()) redirect({ href: next, locale: await getLocale() });
  const t = await getTranslations('Auth.register');
  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('haveAccount')}{' '}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-semibold text-primary hover:underline"
          >
            {t('login')}
          </Link>
        </>
      }
    >
      <RegisterForm next={next} maxBirthDate={latestBirthDate()} />
    </AuthCard>
  );
}

export default function RegisterPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-[32rem] max-w-md rounded-lg" />}>
      <RegisterView searchParams={searchParams} />
    </Suspense>
  );
}
