import { type AdminTicketsQuery, sportSchema, ticketStatusSchema } from '@metrobet/contracts';
import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pager } from '@/components/pager';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { listTickets, TicketsFilters, TicketsTable } from '@/features/bets';
import { pageParam, param, withQuery } from '@/lib/query';

export const metadata: Metadata = { title: 'Bets' };

type Props = PageProps<'/bets'>;

async function Results({ searchParams }: Pick<Props, 'searchParams'>) {
  if (!hasRole(await getCurrentStaff(), ['support', 'risk', 'finance'])) {
    return <NoAccess roles="support, risk and finance" />;
  }
  const params = await searchParams;
  const query: AdminTicketsQuery = {
    status: ticketStatusSchema.safeParse(param(params.status)).data,
    sport: sportSchema.safeParse(param(params.sport)).data,
    page: pageParam(params.page),
  };
  const tickets = await listTickets(query);
  return (
    <div className="flex flex-col gap-4">
      <TicketsFilters status={query.status} sport={query.sport} />
      <TicketsTable tickets={tickets} />
      <Pager
        page={tickets.page}
        total={tickets.total}
        pageSize={tickets.pageSize}
        href={(page) => withQuery('/bets', { ...query, page })}
      />
    </div>
  );
}

export default function BetsPage({ searchParams }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Bets" description="Sportsbook tickets of every player, newest first." />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
