'use server';

import {
  type ActionResult,
  type AdminKycCheck,
  adminKycCheckSchema,
  kycDecisionSchema,
  toFieldErrors,
} from '@metrobet/contracts';
import { z } from 'zod';

import { runAction } from '@/lib/actions';
import { adminFetch } from '@/lib/admin-api';

/** Approve or reject a check in review (support, risk; audit-logged by the API). */
export async function decideKyc(id: unknown, input: unknown): Promise<ActionResult<AdminKycCheck>> {
  const parsedId = z.uuid().safeParse(id);
  const parsed = kycDecisionSchema.safeParse(input);
  if (!parsedId.success) return { ok: false, error: 'Unknown check' };
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }
  return runAction(['/kyc', '/players'], () =>
    adminFetch(`kyc/${parsedId.data}/decision`, adminKycCheckSchema, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }),
  );
}
