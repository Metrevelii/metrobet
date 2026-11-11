import {
  type AdminKycChecksPage,
  adminKycChecksPageSchema,
  type AdminKycQuery,
} from '@metrobet/contracts';

import { adminFetch } from '@/lib/admin-api';
import { withQuery } from '@/lib/query';

/** Request-time data (staff session): render inside <Suspense>. */
export function listKycChecks(query: AdminKycQuery): Promise<AdminKycChecksPage> {
  return adminFetch(withQuery('kyc', query), adminKycChecksPageSchema);
}
