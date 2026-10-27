import { type StaffProfile, staffProfileSchema } from '@metrobet/contracts';
import { cache } from 'react';

import { AdminApiError, adminFetch } from '@/lib/admin-api';
import { getStaffToken } from '@/lib/session';

/** The signed-in staff member, or null. Request-time; deduplicated per request. */
export const getCurrentStaff = cache(async (): Promise<StaffProfile | null> => {
  if (!(await getStaffToken())) return null;
  try {
    return await adminFetch('auth/me', staffProfileSchema);
  } catch (error) {
    if (!(error instanceof AdminApiError && error.status === 401))
      console.error('[auth] Failed to load staff', error);
    return null;
  }
});
