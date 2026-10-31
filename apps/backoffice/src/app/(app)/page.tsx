import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { DashboardView, getDashboard } from '@/features/dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

async function Today() {
  if (!hasRole(await getCurrentStaff(), ['risk', 'finance', 'support', 'marketing'])) {
    return <NoAccess roles="all staff roles" />;
  }
  return <DashboardView dashboard={await getDashboard()} />;
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description="Today in Tbilisi time." />
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-lg" />
            ))}
          </div>
        }
      >
        <Today />
      </Suspense>
    </div>
  );
}
