import {
  type AdminPaymentsPage,
  adminPaymentsPageSchema,
  type AdminPaymentsQuery,
} from '@metrobet/contracts';

import { adminFetch } from '@/lib/admin-api';
import { withQuery } from '@/lib/query';

/** Request-time data (staff session): render inside <Suspense>. */
export function listPayments(query: AdminPaymentsQuery): Promise<AdminPaymentsPage> {
  return adminFetch(withQuery('payments', query), adminPaymentsPageSchema);
}
