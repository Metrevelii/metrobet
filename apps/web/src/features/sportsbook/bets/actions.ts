'use server';

import {
  type BetError,
  betErrorSchema,
  cashoutRequestSchema,
  type CashoutResponse,
  type LimitExceeded,
  cashoutResponseSchema,
  type PlaceBetsResponse,
  placeBetsRequestSchema,
  placeBetsResponseSchema,
} from '@metrobet/contracts';
import { z } from 'zod';

import { ApiError, apiPost } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

export type PlaceBetsError = BetError | 'signedOut' | 'failed';
export type PlaceBetsResult =
  | { ok: true; data: PlaceBetsResponse }
  | { ok: false; error: PlaceBetsError; limit?: LimitExceeded };

/** Places the betslip. The request comes from the browser, so it is validated again here. */
export async function placeBets(input: unknown): Promise<PlaceBetsResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: 'signedOut' };
  const parsed = placeBetsRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'failed' };
  try {
    const data = await apiPost('sportsbook/bets', placeBetsResponseSchema, parsed.data, {
      token,
      headers: await clientHeaders(),
    });
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { ok: false, error: 'signedOut' };
      const known = betErrorSchema.safeParse(error.raw);
      if (known.success) return { ok: false, error: known.data.code, limit: known.data.limit };
    }
    console.error('[sportsbook] Placing bets failed', error);
    return { ok: false, error: 'failed' };
  }
}

export type CashoutError = 'CASHOUT_UNAVAILABLE' | 'CASHOUT_CHANGED' | 'signedOut' | 'failed';
export type CashoutResult =
  { ok: true; data: CashoutResponse } | { ok: false; error: CashoutError; cashout?: number | null };

/** Cashes out a ticket at the amount the player confirmed (a lower offer comes back changed). */
export async function cashoutTicket(ticketId: unknown, amount: unknown): Promise<CashoutResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: 'signedOut' };
  const id = z.uuid().safeParse(ticketId);
  const body = cashoutRequestSchema.safeParse({ amount });
  if (!id.success || !body.success) return { ok: false, error: 'failed' };
  try {
    const data = await apiPost(
      `sportsbook/bets/${id.data}/cashout`,
      cashoutResponseSchema,
      body.data,
      {
        token,
        headers: await clientHeaders(),
      },
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { ok: false, error: 'signedOut' };
      const known = betErrorSchema.safeParse(error.raw);
      if (
        known.success &&
        (known.data.code === 'CASHOUT_CHANGED' || known.data.code === 'CASHOUT_UNAVAILABLE')
      ) {
        return { ok: false, error: known.data.code, cashout: known.data.cashout };
      }
    }
    console.error('[sportsbook] Cash-out failed', error);
    return { ok: false, error: 'failed' };
  }
}
