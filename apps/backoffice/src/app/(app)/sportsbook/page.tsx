import { type AdminTradingEventsQuery, sportSchema } from '@metrobet/contracts';
import { Button, Skeleton } from '@metrobet/ui';
import { SlidersHorizontal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { z } from 'zod';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pager } from '@/components/pager';
import { getCurrentStaff, hasRole } from '@/features/auth';
import {
  AutoRefresh,
  liabilitySummaries,
  listTradingEvents,
  TradingEventsTable,
  TradingFilters,
} from '@/features/sportsbook';
import { pageParam, param, withQuery } from '@/lib/query';

export const metadata: Metadata = { title: 'Sportsbook' };

type Props = PageProps<'/sportsbook'>;

const statusSchema = z.enum(['live', 'scheduled', 'suspended']);

async function Results({ searchParams }: Pick<Props, 'searchParams'>) {
  if (!hasRole(await getCurrentStaff(), ['risk'])) return <NoAccess roles="risk" />;
  const params = await searchParams;
  const query: AdminTradingEventsQuery = {
    sport: sportSchema.safeParse(param(params.sport)).data,
    status: statusSchema.safeParse(param(params.status)).data,
    q: param(params.q)?.slice(0, 100) || undefined,
    page: pageParam(params.page),
  };
  const events = await listTradingEvents(query);
  const liability = await liabilitySummaries(events.items.map((event) => event.id));
  return (
    <div className="flex flex-col gap-4">
      <AutoRefresh />
      <TradingFilters sport={query.sport} status={query.status} q={query.q} />
      <TradingEventsTable events={events} liability={liability} />
      <Pager
        page={events.page}
        total={events.total}
        pageSize={events.pageSize}
        href={(page) => withQuery('/sportsbook', { ...query, page })}
      />
    </div>
  );
}

export default function SportsbookPage({ searchParams }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sportsbook"
        description="Live and upcoming events: what open tickets risk, and suspend or resume betting. Refreshes every 10 s."
        actions={
          <Button variant="secondary" asChild>
            <Link href="/sportsbook/rules">
              <SlidersHorizontal />
              Margins & limits
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
