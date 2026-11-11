import {
  type AdminPaymentsQuery,
  paymentKindSchema,
  paymentStatusSchema,
} from '@metrobet/contracts';
import { Chip, Skeleton } from '@metrobet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pager } from '@/components/pager';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { listPayments, PaymentsFilters, PaymentsTable } from '@/features/payments';
import { pageParam, param, withQuery } from '@/lib/query';

export const metadata: Metadata = { title: 'Payments' };

type Props = PageProps<'/payments'>;

const QUEUE: AdminPaymentsQuery = { kind: 'withdrawal', status: 'pending' };

async function Results({ searchParams }: Pick<Props, 'searchParams'>) {
  const staff = await getCurrentStaff();
  if (!hasRole(staff, ['finance', 'support', 'risk'])) {
    return <NoAccess roles="finance, support and risk" />;
  }
  const params = await searchParams;
  // Without filters the page opens on the withdrawal queue (oldest first).
  const queue = param(params.all) !== '1';
  const query: AdminPaymentsQuery = queue
    ? { ...QUEUE, page: pageParam(params.page) }
    : {
        kind: paymentKindSchema.safeParse(param(params.kind)).data,
        status: paymentStatusSchema.safeParse(param(params.status)).data,
        page: pageParam(params.page),
      };
  const payments = await listPayments(query);
  const href = (page: number) =>
    withQuery('/payments', { ...(queue ? {} : { ...query, all: '1' }), page });

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-2" aria-label="Views">
        <Chip asChild selected={queue}>
          <Link href="/payments" aria-current={queue ? 'page' : undefined}>
            Withdrawal queue
          </Link>
        </Chip>
        <Chip asChild selected={!queue}>
          <Link href="/payments?all=1" aria-current={!queue ? 'page' : undefined}>
            All payments
          </Link>
        </Chip>
      </nav>
      {!queue && <PaymentsFilters kind={query.kind} status={query.status} />}
      <PaymentsTable payments={payments} canDecide={hasRole(staff, ['finance'])} />
      <Pager page={payments.page} total={payments.total} pageSize={payments.pageSize} href={href} />
    </div>
  );
}

export default function PaymentsPage({ searchParams }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Deposits and withdrawals. Finance approves or rejects pending withdrawals; the money is already reserved."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
