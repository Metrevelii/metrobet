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

/** Whether a staff member may use something limited to `roles` (`admin` may use everything). */
export const hasRole = (staff: StaffProfile | null, roles: readonly StaffProfile['role'][]) =>
  staff !== null && (staff.role === 'admin' || roles.includes(staff.role));
