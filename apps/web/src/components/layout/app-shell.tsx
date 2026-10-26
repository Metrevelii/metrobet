import { cn } from '@metrobet/ui';
import type { ReactNode } from 'react';

import { BetslipPanel } from './betslip-panel';
import { BottomNav } from './bottom-nav';
import { Header } from './header';
import { SideNav } from './side-nav';

const STICKY_ASIDE = 'sticky top-20 shrink-0 self-start';

/**
 * Responsive frame for every player page.
 * Mobile: header + content + bottom nav. lg: adds side nav. xl: adds betslip rail.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 px-4 pt-4 pb-24 lg:pb-8">
        <SideNav className={cn('hidden w-52 lg:flex', STICKY_ASIDE)} />
        <main className="min-w-0 flex-1">{children}</main>
        <BetslipPanel className={cn('hidden w-80 xl:flex', STICKY_ASIDE)} />
      </div>
      <BottomNav className="lg:hidden" />
    </div>
  );
}
