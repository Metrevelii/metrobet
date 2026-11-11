'use server';

import {
  type ActionResult,
  type AdminPayment,
  adminPaymentSchema,
  toFieldErrors,
  withdrawalDecisionSchema,
} from '@metrobet/contracts';
import { z } from 'zod';

import { runAction } from '@/lib/actions';
import { adminFetch } from '@/lib/admin-api';

const idSchema = z.uuid();

/** Pays a pending withdrawal out to its card (finance; audit-logged by the API). */
export async function approveWithdrawal(id: unknown): Promise<ActionResult<AdminPayment>> {
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: 'Unknown withdrawal' };
  return runAction(['/payments', '/players'], () =>
    adminFetch(`payments/${parsed.data}/approve`, adminPaymentSchema, { method: 'POST' }),
  );
}

/** Refuses a pending withdrawal; the money goes back to the player, who sees the reason. */
export async function rejectWithdrawal(
  id: unknown,
  input: unknown,
): Promise<ActionResult<AdminPayment>> {
  const parsedId = idSchema.safeParse(id);
  const parsed = withdrawalDecisionSchema.safeParse(input);
  if (!parsedId.success) return { ok: false, error: 'Unknown withdrawal' };
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }
  return runAction(['/payments', '/players'], () =>
    adminFetch(`payments/${parsedId.data}/reject`, adminPaymentSchema, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }),
  );
}
