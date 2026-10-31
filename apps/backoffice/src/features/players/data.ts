import {
  type AdminGameRoundsPage,
  adminGameRoundsPageSchema,
  type AdminPlayer,
  adminPlayerSchema,
  type AdminPlayersPage,
  adminPlayersPageSchema,
  type AdminPlayersQuery,
  type AdminTicketsPage,
  adminTicketsPageSchema,
  type WalletTransactionsPage,
  walletTransactionsPageSchema,
} from '@metrobet/contracts';

import { AdminApiError, adminFetch } from '@/lib/admin-api';
import { withQuery } from '@/lib/query';

/** Request-time data (staff session): render inside <Suspense>. */
export function listPlayers(query: AdminPlayersQuery): Promise<AdminPlayersPage> {
  return adminFetch(withQuery('players', query), adminPlayersPageSchema);
}

export async function getPlayer(id: string): Promise<AdminPlayer | null> {
  try {
    return await adminFetch(`players/${encodeURIComponent(id)}`, adminPlayerSchema);
  } catch (error) {
    if (error instanceof AdminApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

export function getPlayerTransactions(id: string, page: number): Promise<WalletTransactionsPage> {
  return adminFetch(
    withQuery(`players/${encodeURIComponent(id)}/transactions`, { page }),
    walletTransactionsPageSchema,
  );
}

export function getPlayerRounds(id: string, page: number): Promise<AdminGameRoundsPage> {
  return adminFetch(
    withQuery(`players/${encodeURIComponent(id)}/rounds`, { page }),
    adminGameRoundsPageSchema,
  );
}

export function getPlayerTickets(id: string, page: number): Promise<AdminTicketsPage> {
  return adminFetch(withQuery('bets', { playerId: id, page }), adminTicketsPageSchema);
}
