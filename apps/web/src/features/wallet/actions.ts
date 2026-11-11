'use server';

import {
  devDepositInputSchema,
  type LimitExceeded,
  limitErrorSchema,
  type Wallet,
  walletSchema,
} from '@metrobet/contracts';

import { ApiError, apiPost } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

import { getWallet } from './data';

export type DepositResult =
  | { ok: true; data: Wallet }
  | { ok: false; error: 'signedOut' | 'failed' }
  | { ok: false; error: 'limit'; limit: LimitExceeded };

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
    const limit = error instanceof ApiError ? limitErrorSchema.safeParse(error.raw) : null;
    if (limit?.success) return { ok: false, error: 'limit', limit: limit.data.limit };
    console.error('[wallet] Dev deposit failed', error);
    return { ok: false, error: 'failed' };
  }
}

/** What the signed-in player can bet with (cash + bonus money, minor units), or null. */
export async function currentBalance(): Promise<number | null> {
  const wallet = await getWallet();
  return wallet ? wallet.balance + wallet.bonusBalance : null;
}
