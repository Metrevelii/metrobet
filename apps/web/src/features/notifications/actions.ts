'use server';

import { playerSocketPassSchema } from '@metrobet/contracts';

import { ApiError, apiPost } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

/**
 * A one-time pass for the player's live channel. The session token stays in the httpOnly
 * cookie: the browser only ever gets this short-lived pass. Null when signed out.
 */
export async function playerSocketPass(): Promise<string | null> {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    const { pass } = await apiPost(
      'player-live/pass',
      playerSocketPassSchema,
      {},
      {
        token,
        headers: await clientHeaders(),
      },
    );
    return pass;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error('[notifications] Failed to get a live pass', error);
    return null;
  }
}
