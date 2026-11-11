import {
  type PlayerSession,
  playerSessionsSchema,
  type RealityCheckSettings,
  realityCheckSettingsSchema,
  type ResponsibleGaming,
  responsibleGamingSchema,
} from '@metrobet/contracts';
import { cache } from 'react';
import type { z } from 'zod';

import { ApiError, apiGet } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

/** A player-only GET; null when signed out or when the API fails (logged). Request-time. */
async function playerGet<T extends z.ZodType>(path: string, schema: T) {
  const token = await getSessionToken();
  if (!token) return null;
  try {
    return await apiGet(path, schema, {}, { token, headers: await clientHeaders() });
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401))
      console.error(`[account] Failed to load ${path}`, error);
    return null;
  }
}

/** Limits (with usage and pending changes) and the reality check setting. */
export const getResponsibleGaming = (): Promise<ResponsibleGaming | null> =>
  playerGet('responsible-gaming', responsibleGamingSchema);

/** The player's signed-in devices, most recently used first. */
export const getSessions = (): Promise<PlayerSession[] | null> =>
  playerGet('auth/sessions', playerSessionsSchema);

/** The reality check interval, for the reminder in the site shell. Deduplicated per request. */
export const getRealityCheck = cache((): Promise<RealityCheckSettings | null> =>
  playerGet('responsible-gaming/reality-check', realityCheckSettingsSchema),
);
