'use server';

import {
  type BetError,
  betErrorSchema,
  type PlaceBetsResponse,
  placeBetsRequestSchema,
  placeBetsResponseSchema,
} from '@metrobet/contracts';

import { ApiError, apiPost } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

export type PlaceBetsError = BetError | 'signedOut' | 'failed';
export type PlaceBetsResult =
  { ok: true; data: PlaceBetsResponse } | { ok: false; error: PlaceBetsError };

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
      if (known.success) return { ok: false, error: known.data.code };
    }
    console.error('[sportsbook] Placing bets failed', error);
    return { ok: false, error: 'failed' };
  }
}
