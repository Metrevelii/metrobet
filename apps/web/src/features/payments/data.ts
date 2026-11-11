import {
  type Payment,
  paymentSchema,
  paymentsPageSchema,
  type SavedCard,
  savedCardsSchema,
} from '@metrobet/contracts';
import type { z } from 'zod';

import { ApiError, apiGet } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

/** A player-only GET; null when signed out, missing or failing (logged). Request-time. */
async function playerGet<T extends z.ZodType>(
  path: string,
  schema: T,
  params: Record<string, string | number> = {},
) {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiGet(path, schema, params, { token, headers: await clientHeaders() });
  } catch (error) {
    if (!(error instanceof ApiError && (error.status === 401 || error.status === 404)))
      console.error(`[payments] Failed to load ${path}`, error);
    return null;
  }
}

/** One of the player's payments (e.g. the deposit the bank just sent them back from). */
export const getPayment = (id: string): Promise<Payment | null> =>
  playerGet(`payments/${encodeURIComponent(id)}`, paymentSchema);

/** Withdrawals still waiting for staff (money reserved), oldest first. */
export async function getPendingWithdrawals(): Promise<Payment[]> {
  const page = await playerGet('payments', paymentsPageSchema, {
    kind: 'withdrawal',
    pageSize: 50,
  });
  return (page?.items ?? []).filter((item) => item.status === 'pending').toReversed();
}

/** Cards saved from successful deposits: where withdrawals can be paid. */
export const getSavedCards = (): Promise<SavedCard[] | null> =>
  playerGet('payments/cards', savedCardsSchema);
