'use server';

import {
  type ActionResult,
  type AdminBonus,
  adminBonusSchema,
  bonusCancelSchema,
  toFieldErrors,
} from '@metrobet/contracts';
import { z } from 'zod';

import { runAction } from '@/lib/actions';
import { adminFetch } from '@/lib/admin-api';

/** Ends an active bonus; its money goes back (support, risk; audit-logged by the API). */
export async function cancelBonus(id: unknown, input: unknown): Promise<ActionResult<AdminBonus>> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = bonusCancelSchema.safeParse(input);
  if (!parsedId.success) return { ok: false, error: 'Unknown bonus' };
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }
  return runAction(['/players'], () =>
    adminFetch(`bonuses/${parsedId.data}/cancel`, adminBonusSchema, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }),
  );
}
