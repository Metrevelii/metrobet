'use server';

import { devDepositInputSchema, type Wallet, walletSchema } from '@metrobet/contracts';

import { ApiError, apiPost } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

export type DepositResult =
  { ok: true; data: Wallet } | { ok: false; error: 'signedOut' | 'failed' };

/** Development only: adds test money to the signed-in player's wallet. Refused in production. */
export async function devDeposit(amount: unknown): Promise<DepositResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: 'signedOut' };
  const parsed = devDepositInputSchema.safeParse({ amount });
  if (process.env.NODE_ENV === 'production' || !parsed.success)
    return { ok: false, error: 'failed' };
  try {
    const wallet = await apiPost('dev/wallet/deposit', walletSchema, parsed.data, {
      token,
      headers: await clientHeaders(),
    });
    return { ok: true, data: wallet };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, error: 'signedOut' };
    console.error('[wallet] Dev deposit failed', error);
    return { ok: false, error: 'failed' };
  }
}
