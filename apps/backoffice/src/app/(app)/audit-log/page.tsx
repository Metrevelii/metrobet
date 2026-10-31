import { Button, Input, Skeleton } from '@metrobet/ui';
import { Filter } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';

import { NoAccess } from '@/components/no-access';
import { PageHeader } from '@/components/page-header';
import { Pager } from '@/components/pager';
import { AuditTable, listAudit } from '@/features/audit';
import { getCurrentStaff, hasRole } from '@/features/auth';
import { pageParam, param, withQuery } from '@/lib/query';

export const metadata: Metadata = { title: 'Audit log' };

type Props = PageProps<'/audit-log'>;

async function Results({ searchParams }: Pick<Props, 'searchParams'>) {
  if (!hasRole(await getCurrentStaff(), ['risk'])) return <NoAccess roles="admin and risk" />;
  const params = await searchParams;
  const query = {
    entityType: param(params.entityType) || undefined,
    entityId: param(params.entityId) || undefined,
    page: pageParam(params.page),
  };
  const page = await listAudit(query);
  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-wrap items-end gap-2" action="/audit-log">
        <Input
          name="entityType"
          defaultValue={query.entityType}
          placeholder="Entity type (player, ticket, promotion)"
          aria-label="Entity type"
          className="w-72"
        />
        <Input
          name="entityId"
          defaultValue={query.entityId}
          placeholder="Entity id"
          aria-label="Entity id"
          className="w-80"
        />
        <Button type="submit" variant="secondary">
          <Filter />
          Filter
        </Button>
      </form>
      <AuditTable page={page} />
      <Pager
        page={page.page}
        total={page.total}
        pageSize={page.pageSize}
        href={(target) => withQuery('/audit-log', { ...query, page: target })}
      />
    </div>
  );
}

export default function AuditLogPage({ searchParams }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        description="Every staff change: who, what, before and after."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
