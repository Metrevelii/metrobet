import { Card, CardContent, CardHeader, CardTitle, Skeleton } from '@metrobet/ui';
import { ChevronLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pager } from '@/components/pager';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { TicketsTable } from '@/features/bets';
import {
  getPlayer,
  getPlayerResponsibleGaming,
  getPlayerRounds,
  getPlayerTickets,
  getPlayerTransactions,
  PlayerHistoryTabs,
  PlayerStatusBadge,
  PlayerStatusForm,
  type PlayerTab,
  ResponsibleGamingCard,
  RoundsTable,
  TransactionsTable,
} from '@/features/players';
import { dateTime, money } from '@/lib/format';
import { pageParam, param } from '@/lib/query';

export const metadata: Metadata = { title: 'Player' };

type Props = PageProps<'/players/[id]'>;

const TABS: PlayerTab[] = ['transactions', 'tickets', 'rounds'];

async function History({ id, tab, page }: { id: string; tab: PlayerTab; page: number }) {
  const href = (target: number) =>
    `/players/${id}?tab=${tab}${target > 1 ? `&page=${target}` : ''}`;
  if (tab === 'tickets') {
    const tickets = await getPlayerTickets(id, page);
    return (
      <>
        <TicketsTable tickets={tickets} showPlayer={false} />
        <Pager page={page} total={tickets.total} pageSize={tickets.pageSize} href={href} />
      </>
    );
  }
  if (tab === 'rounds') {
    const rounds = await getPlayerRounds(id, page);
    return (
      <>
        <RoundsTable page={rounds} />
        <Pager page={page} total={rounds.total} pageSize={rounds.pageSize} href={href} />
      </>
    );
  }
  const transactions = await getPlayerTransactions(id, page);
  return (
    <>
      <TransactionsTable page={transactions} />
      <Pager page={page} total={transactions.total} pageSize={transactions.pageSize} href={href} />
    </>
  );
}

async function PlayerView({ params, searchParams }: Props) {
  const staff = await getCurrentStaff();
  if (!hasRole(staff, ['support', 'risk', 'finance'])) {
    return <NoAccess roles="support, risk and finance" />;
  }
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const player = await getPlayer(id);
  if (!player) notFound();
  const responsibleGaming = await getPlayerResponsibleGaming(id);
  const tab = TABS.find((item) => item === param(query.tab)) ?? 'transactions';
  const facts = [
    ['Balance', money(player.balance)],
    ['Verified contact', player.verified ? 'Yes' : 'No'],
    ['KYC', player.kycStatus],
    ['Date of birth', player.dateOfBirth],
    ['Language', player.locale],
    ['Registered', dateTime(player.createdAt)],
    ['Last login', player.lastLoginAt ? dateTime(player.lastLoginAt) : '–'],
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={player.email ?? player.phone ?? player.id}
        description={player.id}
        back={
          <Link
            href="/players"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Players
          </Link>
        }
        actions={<PlayerStatusBadge status={player.status} />}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {facts.map(([label, value]) => (
                <div key={label} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        {hasRole(staff, ['support', 'risk']) && (
          <Card>
            <CardHeader>
              <CardTitle>Account status</CardTitle>
            </CardHeader>
            <CardContent>
              <PlayerStatusForm key={player.status} player={player} />
            </CardContent>
          </Card>
        )}
      </div>
      <ResponsibleGamingCard player={player} data={responsibleGaming} />
      <PlayerHistoryTabs playerId={player.id} active={tab} />
      <div className="flex flex-col gap-4">
        <History id={player.id} tab={tab} page={pageParam(query.page)} />
      </div>
    </div>
  );
}

export default function PlayerPage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
      <PlayerView {...props} />
    </Suspense>
  );
}
