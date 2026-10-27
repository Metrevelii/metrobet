import { Skeleton } from '@metrobet/ui';
import { type ReactNode, Suspense } from 'react';

import { CasinoToolbar, type CasinoToolbarProps } from './casino-toolbar';

type CasinoPageProps = CasinoToolbarProps & {
  title?: string;
  /** Rendered above the tabs (e.g. promo slider). */
  top?: ReactNode;
  children: ReactNode;
};

function ToolbarSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-11 rounded-md" />
      <Skeleton className="h-8 w-2/3 rounded-full" />
    </div>
  );
}

/** Shared frame for Slots pages: optional top block, provider tabs + filters, title, content. */
export function CasinoPage({ title, top, children, ...toolbar }: CasinoPageProps) {
  return (
    <div className="flex flex-col gap-6">
      {top}
      <Suspense fallback={<ToolbarSkeleton />}>
        <CasinoToolbar {...toolbar} />
      </Suspense>
      {title && <h1 className="text-2xl font-bold">{title}</h1>}
      {children}
    </div>
  );
}
