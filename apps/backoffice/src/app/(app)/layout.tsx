import { Skeleton } from '@metrobet/ui';
import { Suspense } from 'react';

import { Sidebar } from '@/components/sidebar';
import { getCurrentStaff, RequireStaff } from '@/features/auth';

async function StaffSidebar() {
  return <Sidebar staff={await getCurrentStaff()} />;
}

/** Signed-in area: sidebar + content. Every page here requires a staff session. */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh">
      <Suspense fallback={<div className="hidden w-60 shrink-0 border-r bg-card md:block" />}>
        <StaffSidebar />
      </Suspense>
      <main className="min-w-0 flex-1 p-6">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <RequireStaff>{children}</RequireStaff>
        </Suspense>
      </main>
    </div>
  );
}
