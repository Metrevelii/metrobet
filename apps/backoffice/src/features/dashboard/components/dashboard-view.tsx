import type { Dashboard, ProductTotals } from '@metrobet/contracts';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@metrobet/ui';

import { dateTime, money } from '@/lib/format';

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span className="text-2xl font-bold tabular">{value}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </CardContent>
    </Card>
  );
}

function ProductCard({ title, totals }: { title: string; totals: ProductTotals }) {
  const rows = [
    ['Stakes', totals.stakes],
    ['Wins', -totals.wins],
    ['Refunds', -totals.refunds],
  ] as const;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular">{money(value)}</span>
          </div>
        ))}
        <div className="flex justify-between border-t pt-2">
          <span className="font-semibold">GGR</span>
          <span
            className={cn(
              'font-bold tabular',
              totals.ggr >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {money(totals.ggr)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{totals.bets} bets</span>
      </CardContent>
    </Card>
  );
}

/** Today's numbers. GGR = stakes − wins − refunds (what the house kept). */
export function DashboardView({ dashboard }: { dashboard: Dashboard }) {
  const ggr = dashboard.casino.ggr + dashboard.sportsbook.ggr;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">Since {dateTime(dashboard.since)} (Tbilisi)</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="GGR today" value={money(ggr)} hint="Casino + sportsbook" />
        <Stat
          label="Active players"
          value={String(dashboard.activePlayers)}
          hint="Placed a bet today"
        />
        <Stat label="New players" value={String(dashboard.newPlayers)} />
        <Stat
          label="Open tickets"
          value={String(dashboard.openTickets)}
          hint="Sportsbook, any day"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ProductCard title="Casino & Originals" totals={dashboard.casino} />
        <ProductCard title="Sportsbook" totals={dashboard.sportsbook} />
        <Stat label="Deposits today" value={money(dashboard.deposits)} />
        <Stat
          label="Player balances"
          value={money(dashboard.playerBalances)}
          hint="What the platform owes players now"
        />
      </div>
    </div>
  );
}
