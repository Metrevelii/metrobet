import type { ReactNode } from 'react';

import { BottomNav } from './bottom-nav';
import { Header } from './header';
import { SideNav } from './side-nav';

/**
 * Responsive frame for every player page.
 * Mobile: header + content + bottom nav. lg: adds side nav.
 * The betslip rail is added by the (sportsbook) route group layout, not here.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 px-4 pt-4 pb-24 lg:pb-8">
        <SideNav className="sticky top-20 hidden w-52 shrink-0 self-start lg:flex" />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <BottomNav className="lg:hidden" />
    </div>
  );
}
