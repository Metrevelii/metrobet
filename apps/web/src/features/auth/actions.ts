'use server';

import {
  type ActionResult,
  confirmVerificationInputSchema,
  forgotPasswordInputSchema,
  loginInputSchema,
  playerAuthResponseSchema,
  type PlayerProfile,
  playerProfileSchema,
  registerInputSchema,
  resetPasswordInputSchema,
  toFieldErrors,
} from '@metrobet/contracts';
import { z } from 'zod';

import { ApiError, apiPost } from '@/lib/api';
import {
  clearSessionCookie,
  clientHeaders,
  getSessionToken,
  setSessionCookie,
} from '@/lib/session';

/** Keys under `Auth.errors`; field errors are keys under `Auth.validation`. */
type ErrorKey =
  | 'invalidCredentials'
  | 'accountBlocked'
  | 'accountExists'
  | 'invalidCode'
  | 'tooManyRequests'
  | 'generic';

function failure<T>(
  error: unknown,
  byStatus: Partial<Record<number, ErrorKey>> = {},
): ActionResult<T> {
  if (error instanceof ApiError) {
    if (error.status === 429) return { ok: false, error: 'tooManyRequests' };
    const mapped = byStatus[error.status];
    if (mapped) return { ok: false, error: mapped };
    if (error.status === 400 && error.body?.issues?.length) {
      return {
        ok: false,
        error: 'generic',
        fieldErrors: toFieldErrors(
          error.body.issues.map((i) => ({ path: i.path.split('.'), message: i.message })),
        ),
      };
    }
  }
  console.error('[auth] action failed', error);
  return { ok: false, error: 'generic' };
}

/** Validates locally first (same schema as the API) so users get instant, translated field errors. */
function invalid<T>(schema: z.ZodType, input: unknown): ActionResult<T> | null {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? null
    : { ok: false, error: 'generic', fieldErrors: toFieldErrors(parsed.error.issues) };
}

async function authenticate(
  path: 'auth/login' | 'auth/register',
  input: unknown,
): Promise<PlayerProfile> {
  const { session, player } = await apiPost(path, playerAuthResponseSchema, input, {
    headers: await clientHeaders(),
  });
  await setSessionCookie(session);
  return player;
}

export async function login(input: unknown): Promise<ActionResult<PlayerProfile>> {
  const rejected = invalid<PlayerProfile>(loginInputSchema, input);
  if (rejected) return rejected;
  try {
    return { ok: true, data: await authenticate('auth/login', input) };
  } catch (error) {
    return failure(error, { 401: 'invalidCredentials', 403: 'accountBlocked' });
  }
}

export async function register(input: unknown): Promise<ActionResult<PlayerProfile>> {
  const rejected = invalid<PlayerProfile>(registerInputSchema, input);
  if (rejected) return rejected;
  try {
    return { ok: true, data: await authenticate('auth/register', input) };
  } catch (error) {
    return failure(error, { 409: 'accountExists' });
  }
}

export async function logout(): Promise<void> {
  const token = await getSessionToken();
  if (token) await apiPost('auth/logout', z.undefined(), {}, { token }).catch(() => undefined);
  await clearSessionCookie();
}

export async function confirmVerification(input: unknown): Promise<ActionResult<PlayerProfile>> {
  const rejected = invalid<PlayerProfile>(confirmVerificationInputSchema, input);
  if (rejected) return rejected;
  try {
    const token = await getSessionToken();
    return {
      ok: true,
      data: await apiPost('auth/verification/confirm', playerProfileSchema, input, { token }),
    };
  } catch (error) {
    return failure(error, { 400: 'invalidCode' });
  }
}

export async function resendVerification(): Promise<ActionResult> {
  try {
    await apiPost('auth/verification/send', z.undefined(), {}, { token: await getSessionToken() });
    return { ok: true, data: undefined };
  } catch (error) {
    return failure<void>(error);
  }
}

export async function forgotPassword(input: unknown): Promise<ActionResult> {
  const rejected = invalid<void>(forgotPasswordInputSchema, input);
  if (rejected) return rejected;
  try {
    await apiPost('auth/password/forgot', z.undefined(), input, { headers: await clientHeaders() });
    return { ok: true, data: undefined };
  } catch (error) {
    return failure<void>(error);
  }
}

export async function resetPassword(input: unknown): Promise<ActionResult> {
  const rejected = invalid<void>(resetPasswordInputSchema, input);
  if (rejected) return rejected;
  try {
    await apiPost('auth/password/reset', z.undefined(), input, { headers: await clientHeaders() });
    return { ok: true, data: undefined };
  } catch (error) {
    return failure<void>(error, { 400: 'invalidCode' });
  }
}
