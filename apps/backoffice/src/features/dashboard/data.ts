import { type Dashboard, dashboardSchema } from '@metrobet/contracts';

import { adminFetch } from '@/lib/admin-api';

/** Today's numbers (Tbilisi day). Request-time: render inside <Suspense>. */
export function getDashboard(): Promise<Dashboard> {
  return adminFetch('dashboard', dashboardSchema);
}
