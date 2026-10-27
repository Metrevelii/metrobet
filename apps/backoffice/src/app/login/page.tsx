import { Card, Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { getCurrentStaff, LoginForm } from '@/features/auth';

export const metadata: Metadata = { title: 'Sign in' };

const safeNext = (value: unknown) =>
  typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';

async function LoginView({ searchParams }: Pick<PageProps<'/login'>, 'searchParams'>) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentStaff()) redirect(next);
  return <LoginForm next={next} />;
}

export default function LoginPage({ searchParams }: PageProps<'/login'>) {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <Card className="flex w-full max-w-sm flex-col gap-6 bg-glow p-8">
        <div className="flex flex-col gap-1">
          <div className="text-xl font-black tracking-tight">
            metro<span className="text-primary">bet</span>
            <span className="ml-2 text-xs font-semibold text-muted-foreground">admin</span>
          </div>
          <p className="text-sm text-muted-foreground">Sign in with your staff account.</p>
        </div>
        <Suspense fallback={<Skeleton className="h-56" />}>
          <LoginView searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}
