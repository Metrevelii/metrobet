import { type AuditPage, auditPageSchema, type AuditQuery } from '@metrobet/contracts';

import { adminFetch } from '@/lib/admin-api';
import { withQuery } from '@/lib/query';

/** Request-time data (staff session): render inside <Suspense>. */
export function listAudit(query: AuditQuery): Promise<AuditPage> {
  return adminFetch(withQuery('audit-log', query), auditPageSchema);
}
