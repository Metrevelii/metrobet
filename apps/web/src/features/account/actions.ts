'use server';

import {
  type ActionResult,
  changePasswordInputSchema,
  exclusionInputSchema,
  kycStartedSchema,
  type PlayActivity,
  playActivitySchema,
  realityCheckInputSchema,
  type RealityCheckMinutes,
  realityCheckSettingsSchema,
  type ResponsibleGaming,
  responsibleGamingSchema,
  setLimitInputSchema,
  toFieldErrors,
} from '@metrobet/contracts';
import { z } from 'zod';

import { ApiError, apiGet, apiPost, apiPut } from '@/lib/api';
import { clearSessionCookie, clientHeaders, getSessionToken } from '@/lib/session';

/** Keys under `Auth.errors` (shared with the auth forms); field errors are `Auth.validation` keys. */
type ErrorKey = 'wrongPassword' | 'tooManyRequests' | 'signedOut' | 'generic';

async function options() {
  return { token: await getSessionToken(), headers: await clientHeaders() };
}

function failure<T>(error: unknown): ActionResult<T> {
  const key: ErrorKey =
    error instanceof ApiError
      ? error.status === 401
        ? 'signedOut'
        : error.status === 403
          ? 'wrongPassword'
          : error.status === 429
            ? 'tooManyRequests'
            : 'generic'
      : 'generic';
  if (key === 'generic') console.error('[account] action failed', error);
  return { ok: false, error: key };
}

function invalid<T>(schema: z.ZodType, input: unknown): ActionResult<T> | null {
  const parsed = schema.safeParse(input);
  return parsed.success
    ? null
    : { ok: false, error: 'generic', fieldErrors: toFieldErrors(parsed.error.issues) };
}

/** Other devices are signed out; this one stays signed in. */
export async function changePassword(input: unknown): Promise<ActionResult> {
  const rejected = invalid<void>(changePasswordInputSchema, input);
  if (rejected) return rejected;
  try {
    await apiPost('auth/password/change', z.undefined(), input, await options());
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeSession(id: unknown): Promise<ActionResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: 'generic' };
  try {
    await apiPost(`auth/sessions/${parsed.data}/revoke`, z.undefined(), {}, await options());
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

export async function revokeOtherSessions(): Promise<ActionResult> {
  try {
    await apiPost('auth/sessions/revoke-others', z.undefined(), {}, await options());
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/** Lower limits apply at once; raising or removing one waits 24 hours (the API decides). */
export async function setLimit(input: unknown): Promise<ActionResult<ResponsibleGaming>> {
  const rejected = invalid<ResponsibleGaming>(setLimitInputSchema, input);
  if (rejected) return rejected;
  try {
    return {
      ok: true,
      data: await apiPut(
        'responsible-gaming/limits',
        responsibleGamingSchema,
        input,
        await options(),
      ),
    };
  } catch (error) {
    return failure(error);
  }
}

export async function setRealityCheck(minutes: RealityCheckMinutes): Promise<ActionResult> {
  const rejected = invalid<void>(realityCheckInputSchema, { minutes });
  if (rejected) return rejected;
  try {
    await apiPut(
      'responsible-gaming/reality-check',
      realityCheckSettingsSchema,
      { minutes },
      await options(),
    );
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/** Stakes and returns since the start of the visit, for the reality check reminder. */
export async function playActivity(since: string): Promise<PlayActivity | null> {
  try {
    return await apiGet(
      'responsible-gaming/activity',
      playActivitySchema,
      { since },
      await options(),
    );
  } catch {
    return null;
  }
}

/** Takes a break or self-excludes. On success the player is signed out here too. */
export async function exclude(input: unknown): Promise<ActionResult> {
  const rejected = invalid<void>(exclusionInputSchema, input);
  if (rejected) return rejected;
  try {
    await apiPost('responsible-gaming/exclusion', z.undefined(), input, await options());
    await clearSessionCookie();
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error);
  }
}

/** Starts an identity check; the client sends the browser to the provider's page. */
export async function startKyc(): Promise<ActionResult<string>> {
  try {
    const { redirectUrl } = await apiPost('kyc/checks', kycStartedSchema, {}, await options());
    return { ok: true, data: redirectUrl };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) return { ok: false, error: 'conflict' };
    return failure(error);
  }
}
