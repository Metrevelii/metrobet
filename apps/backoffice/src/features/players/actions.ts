'use server';

import {
  type ActionResult,
  type AdminPlayer,
  adminPlayerSchema,
  playerStatusUpdateSchema,
  toFieldErrors,
} from '@metrobet/contracts';
import { z } from 'zod';

import { runAction } from '@/lib/actions';
import { adminFetch } from '@/lib/admin-api';

/** Suspend / self-exclude / reactivate. The API audit-logs it and signs the player out. */
export async function setPlayerStatus(
  id: unknown,
  input: unknown,
): Promise<ActionResult<AdminPlayer>> {
  const playerId = z.uuid().safeParse(id);
  const parsed = playerStatusUpdateSchema.safeParse(input);
  if (!playerId.success || !parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: parsed.success ? {} : toFieldErrors(parsed.error.issues),
    };
  }
  return runAction(['/players', `/players/${playerId.data}`], () =>
    adminFetch(`players/${playerId.data}/status`, adminPlayerSchema, {
      method: 'PATCH',
      body: JSON.stringify(parsed.data),
    }),
  );
}
