import { type TicketsPage, ticketsPageSchema } from '@metrobet/contracts';

import { ApiError, apiGet } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

/**
 * One page of the signed-in player's tickets, newest first; null when signed out or the API
 * failed. Request-time: render inside <Suspense>.
 */
export async function getTickets(
  status: 'open' | 'settled' | undefined,
  page: number,
): Promise<TicketsPage | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiGet(
      'sportsbook/bets',
      ticketsPageSchema,
      { status, page },
      { token, headers: await clientHeaders() },
    );
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error('[sportsbook] Failed to load tickets', error);
    return null;
  }
}
