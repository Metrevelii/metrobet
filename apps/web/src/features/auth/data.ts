import { type PlayerProfile, playerProfileSchema } from '@metrobet/contracts';
import { cache } from 'react';

import { ApiError, apiGet } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

/**
 * The signed-in player, or null. Request-time (reads the cookie): render inside <Suspense>.
 * Deduplicated per request with React `cache`.
 */
export const getCurrentPlayer = cache(async (): Promise<PlayerProfile | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiGet(
      'auth/me',
      playerProfileSchema,
      {},
      { token, headers: await clientHeaders() },
    );
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error('[auth] Failed to load player', error);
    return null;
  }
});
