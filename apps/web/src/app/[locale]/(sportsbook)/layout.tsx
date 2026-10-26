import { BetslipPanel } from '@/components/layout/betslip-panel';

/** Betting pages (home, sports, live) get the sticky betslip rail on wide screens. */
export default function SportsbookLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">{children}</div>
      <BetslipPanel className="sticky top-20 hidden w-80 shrink-0 self-start xl:flex" />
    </div>
  );
}
