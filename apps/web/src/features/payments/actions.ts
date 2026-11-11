'use server';

import {
  type ActionResult,
  depositInputSchema,
  depositStartedSchema,
  type LimitExceeded,
  limitErrorSchema,
  PAYMENT_ERRORS,
  type PaymentError,
  paymentSchema,
  toFieldErrors,
  withdrawalInputSchema,
} from '@metrobet/contracts';
import { z } from 'zod';

import { ApiError, apiPost } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

/** Error keys under `Payments.errors`. */
export type PaymentErrorKey = PaymentError | 'signedOut' | 'generic';
export type PaymentResult<T> = ActionResult<T> & { limit?: LimitExceeded };

const errorBodySchema = z.object({ code: z.enum(PAYMENT_ERRORS) });

function failure<T>(error: unknown): PaymentResult<T> {
  if (error instanceof ApiError) {
    if (error.status === 401) return { ok: false, error: 'signedOut' };
    const limit = limitErrorSchema.safeParse(error.raw);
    if (limit.success) return { ok: false, error: 'LIMIT_EXCEEDED', limit: limit.data.limit };
    const known = errorBodySchema.safeParse(error.raw);
    if (known.success) return { ok: false, error: known.data.code };
  }
  console.error('[payments] action failed', error);
  return { ok: false, error: 'generic' };
}

async function options() {
  return { token: await getSessionToken(), headers: await clientHeaders() };
}

/** Starts a deposit; the client sends the browser to the returned bank page. */
export async function startDeposit(input: unknown): Promise<PaymentResult<string>> {
  const parsed = depositInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'generic', fieldErrors: toFieldErrors(parsed.error.issues) };
  }
  try {
    const { redirectUrl } = await apiPost(
      'payments/deposits',
      depositStartedSchema,
      parsed.data,
      await options(),
    );
    return { ok: true, data: redirectUrl };
  } catch (error) {
    return failure(error);
  }
}

export async function requestWithdrawal(input: unknown): Promise<PaymentResult<void>> {
  const parsed = withdrawalInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'generic', fieldErrors: toFieldErrors(parsed.error.issues) };
  }
  try {
    await apiPost('payments/withdrawals', paymentSchema, parsed.data, await options());
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function cancelWithdrawal(id: unknown): Promise<PaymentResult<void>> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'generic' };
  try {
    await apiPost(`payments/withdrawals/${parsed.data}/cancel`, paymentSchema, {}, await options());
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}
