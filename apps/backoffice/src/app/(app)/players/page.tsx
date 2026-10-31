import { type AdminPlayersQuery, playerStatusSchema } from '@metrobet/contracts';
import { Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pager } from '@/components/pager';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { listPlayers, PlayersFilters, PlayersTable } from '@/features/players';
import { pageParam, param, withQuery } from '@/lib/query';

export const metadata: Metadata = { title: 'Players' };

type Props = PageProps<'/players'>;

async function Results({ searchParams }: Pick<Props, 'searchParams'>) {
  if (!hasRole(await getCurrentStaff(), ['support', 'risk', 'finance'])) {
    return <NoAccess roles="support, risk and finance" />;
  }
  const params = await searchParams;
  const query: AdminPlayersQuery = {
    search: param(params.search) || undefined,
    status: playerStatusSchema.safeParse(param(params.status)).data,
    page: pageParam(params.page),
  };
  const players = await listPlayers(query);
  return (
    <div className="flex flex-col gap-4">
      <PlayersFilters search={query.search} status={query.status} />
      <PlayersTable players={players} />
      <Pager
        page={players.page}
        total={players.total}
        pageSize={players.pageSize}
        href={(page) => withQuery('/players', { ...query, page })}
      />
    </div>
  );
}

export default function PlayersPage({ searchParams }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Players" description="Search accounts, balances and history." />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
