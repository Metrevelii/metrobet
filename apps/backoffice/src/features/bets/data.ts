import {
  type AdminTicket,
  adminTicketSchema,
  type AdminTicketsPage,
  adminTicketsPageSchema,
  type AdminTicketsQuery,
} from '@metrobet/contracts';

import { AdminApiError, adminFetch } from '@/lib/admin-api';
import { withQuery } from '@/lib/query';

/** Request-time data (staff session): render inside <Suspense>. */
export function listTickets(query: AdminTicketsQuery): Promise<AdminTicketsPage> {
  return adminFetch(withQuery('bets', query), adminTicketsPageSchema);
}

export async function getTicket(id: string): Promise<AdminTicket | null> {
  try {
    return await adminFetch(`bets/${encodeURIComponent(id)}`, adminTicketSchema);
  } catch (error) {
    if (error instanceof AdminApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}
