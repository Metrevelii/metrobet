import type { Sport } from '@metrobet/contracts';
import { Skeleton } from '@metrobet/ui';
import { type ReactNode, Suspense } from 'react';

import { getSports, SportTabs } from '@/features/sportsbook';

async function Tabs({ active }: { active?: Sport | 'live' }) {
  return <SportTabs sports={await getSports()} active={active} />;
}

/** Shared frame for sportsbook listings: sport tabs, then content. */
export function SportsbookFrame({
  active,
  children,
}: {
  active?: Sport | 'live';
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<Skeleton className="h-8 w-80 rounded-full" />}>
        <Tabs active={active} />
      </Suspense>
      {children}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-56 rounded-lg" />
      ))}
    </div>
  );
}
