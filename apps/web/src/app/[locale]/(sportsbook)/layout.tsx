import { BetslipRail, BetslipSheet } from '@/features/sportsbook';

/** Betting pages (home, sports, live): betslip rail on wide screens, bottom sheet below xl. */
export default function SportsbookLayout({ children }: LayoutProps<'/[locale]'>) {
  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">{children}</div>
      <BetslipRail className="sticky top-20 hidden w-80 shrink-0 self-start xl:flex" />
      <BetslipSheet />
    </div>
  );
}
