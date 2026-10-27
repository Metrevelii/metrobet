import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';

import { AuthCard, getCurrentPlayer, LoginForm, safeNext } from '@/features/auth';
import { Link, redirect } from '@/i18n/navigation';

type Props = PageProps<'/[locale]/login'>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.login');
  return { title: t('title'), robots: { index: false } };
}

async function LoginView({ searchParams }: Pick<Props, 'searchParams'>) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentPlayer()) redirect({ href: next, locale: await getLocale() });
  const t = await getTranslations('Auth.login');
  return (
    <AuthCard
      title={t('title')}
      subtitle={t('subtitle')}
      footer={
        <>
          {t('noAccount')}{' '}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="font-semibold text-primary hover:underline"
          >
            {t('register')}
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}

export default function LoginPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-10 h-96 max-w-md rounded-lg" />}>
      <LoginView searchParams={searchParams} />
    </Suspense>
  );
}
