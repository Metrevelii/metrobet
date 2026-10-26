import { Skeleton } from '@metrobet/ui';
import { type ReactNode, Suspense } from 'react';

import { CasinoToolbar } from './casino-toolbar';
import type { CasinoSection } from './category-nav';

type CasinoPageProps = {
  title?: string;
  active?: CasinoSection;
  provider?: string;
  query?: string;
  /** Rendered between the toolbar and the title (e.g. promo slider). */
  top?: ReactNode;
  children: ReactNode;
};

function ToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-10 rounded-md" />
      <Skeleton className="h-8 w-3/4 rounded-full" />
    </div>
  );
}

/** Shared frame for casino pages: optional top block, toolbar, title, content. */
export function CasinoPage({ title, active, provider, query, top, children }: CasinoPageProps) {
  return (
    <div className="flex flex-col gap-6">
      {top}
      <Suspense fallback={<ToolbarSkeleton />}>
        <CasinoToolbar active={active} provider={provider} query={query} />
      </Suspense>
      {title && <h1 className="text-2xl font-bold">{title}</h1>}
      {children}
    </div>
  );
}
