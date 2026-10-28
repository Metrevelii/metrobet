import {
  type Wallet,
  walletSchema,
  type WalletTransactionsPage,
  walletTransactionsPageSchema,
} from '@metrobet/contracts';
import { cache } from 'react';

import { ApiError, apiGet } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

async function playerGet<T>(
  path: string,
  load: (options: Parameters<typeof apiGet>[3]) => Promise<T>,
) {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await load({ token, headers: await clientHeaders() });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error(`[wallet] Failed to load ${path}`, error);
    return null;
  }
}

/**
 * The signed-in player's balance, or null when signed out or unavailable. Request-time: render
 * inside <Suspense>. Deduplicated per request (header and wallet page share one call).
 */
export const getWallet = cache((): Promise<Wallet | null> =>
  playerGet('wallet', (options) => apiGet('wallet', walletSchema, {}, options)),
);

/** One page of the player's transactions, newest first, or null when signed out / unavailable. */
export function getWalletTransactions(page: number): Promise<WalletTransactionsPage | null> {
  return playerGet('wallet/transactions', (options) =>
    apiGet('wallet/transactions', walletTransactionsPageSchema, { page }, options),
  );
}
