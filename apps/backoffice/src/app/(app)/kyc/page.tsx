import { type AdminKycQuery, kycCheckStatusSchema, KYC_CHECK_STATUSES } from '@metrobet/contracts';
import { Button, Chip, NativeSelect, Skeleton } from '@metrobet/ui';
import { Filter } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pager } from '@/components/pager';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { KycChecksTable, listKycChecks } from '@/features/kyc';
import { pageParam, param, withQuery } from '@/lib/query';

export const metadata: Metadata = { title: 'KYC' };

type Props = PageProps<'/kyc'>;

async function Results({ searchParams }: Pick<Props, 'searchParams'>) {
  const staff = await getCurrentStaff();
  if (!hasRole(staff, ['support', 'risk', 'finance'])) {
    return <NoAccess roles="support, risk and finance" />;
  }
  const params = await searchParams;
  // Without filters the page opens on the review queue (oldest first).
  const queue = param(params.all) !== '1';
  const query: AdminKycQuery = queue
    ? { status: 'review', page: pageParam(params.page) }
    : {
        status: kycCheckStatusSchema.safeParse(param(params.status)).data,
        page: pageParam(params.page),
      };
  const checks = await listKycChecks(query);
  const href = (page: number) =>
    withQuery('/kyc', { ...(queue ? {} : { status: query.status, all: '1' }), page });

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-2" aria-label="Views">
        <Chip asChild selected={queue}>
          <Link href="/kyc" aria-current={queue ? 'page' : undefined}>
            Review queue
          </Link>
        </Chip>
        <Chip asChild selected={!queue}>
          <Link href="/kyc?all=1" aria-current={!queue ? 'page' : undefined}>
            All checks
          </Link>
        </Chip>
      </nav>
      {!queue && (
        <form className="flex flex-wrap items-end gap-2" action="/kyc">
          <NativeSelect
            name="status"
            defaultValue={query.status ?? ''}
            aria-label="Status"
            className="w-40"
          >
            <option value="">Any status</option>
            {KYC_CHECK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
          <input type="hidden" name="all" value="1" />
          <Button type="submit" variant="secondary">
            <Filter />
            Filter
          </Button>
        </form>
      )}
      <KycChecksTable checks={checks} canDecide={hasRole(staff, ['support', 'risk'])} />
      <Pager page={checks.page} total={checks.total} pageSize={checks.pageSize} href={href} />
    </div>
  );
}

export default function KycPage({ searchParams }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="KYC"
        description="Identity checks. The provider sends unclear documents here; support and risk approve or reject them."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
