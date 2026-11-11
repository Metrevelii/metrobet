import { type PlayerBonuses, playerBonusesSchema } from '@metrobet/contracts';
import { getLocale } from 'next-intl/server';

import { ApiError, apiGet } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

/** The player's active bonus and history, or null (signed out / unavailable). Request-time. */
export async function getBonuses(): Promise<PlayerBonuses | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiGet(
      'bonuses',
      playerBonusesSchema,
      { locale: await getLocale() },
      { token, headers: await clientHeaders() },
    );
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error('[bonus] Failed to load bonuses', error);
    return null;
  }
}
