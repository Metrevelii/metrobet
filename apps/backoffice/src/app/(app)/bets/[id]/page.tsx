import { Card, CardContent, Skeleton } from '@metrobet/ui';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { getTicket, TicketActions, TicketSelections, TicketStatusBadge } from '@/features/bets';
import { dateTime, money } from '@/lib/format';

export const metadata: Metadata = { title: 'Ticket' };

type Props = PageProps<'/bets/[id]'>;

async function TicketView({ params }: Pick<Props, 'params'>) {
  const staff = await getCurrentStaff();
  if (!hasRole(staff, ['support', 'risk', 'finance'])) {
    return <NoAccess roles="support, risk and finance" />;
  }
  const ticket = await getTicket((await params).id);
  if (!ticket) notFound();
  const facts = [
    ['Player', ticket.player.email ?? ticket.player.phone ?? ticket.player.id],
    ['Type', ticket.mode === 'combo' ? `Accumulator (${ticket.selections.length})` : 'Single'],
    ['Stake', money(ticket.stake)],
    ['Odds', ticket.odds.toFixed(2)],
    ['Potential win', money(ticket.potentialWin)],
    ['Payout', ticket.status === 'open' ? '–' : money(ticket.payout)],
    ['Placed', dateTime(ticket.placedAt)],
    ['Settled', ticket.settledAt ? dateTime(ticket.settledAt) : '–'],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Ticket ${ticket.id.slice(0, 8)}`}
        description={ticket.id}
        back={
          <Link
            href="/bets"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Bets
          </Link>
        }
        actions={<TicketStatusBadge status={ticket.status} />}
      />
      <Card>
        <CardContent className="pt-6">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-semibold">
                  {label === 'Player' ? (
                    <Link href={`/players/${ticket.player.id}`} className="hover:underline">
                      {value}
                    </Link>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <TicketSelections ticket={ticket} />
      {hasRole(staff, ['risk']) && <TicketActions ticket={ticket} />}
    </div>
  );
}

export default function TicketPage({ params }: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <TicketView params={params} />
    </Suspense>
  );
}
