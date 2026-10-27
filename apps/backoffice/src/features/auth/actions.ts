'use server';

import {
  type ActionResult,
  staffAuthResponseSchema,
  staffLoginInputSchema,
  type StaffProfile,
  toFieldErrors,
} from '@metrobet/contracts';
import { z } from 'zod';

import { AdminApiError, adminFetch } from '@/lib/admin-api';
import { clearStaffCookie, clientHeaders, setStaffCookie } from '@/lib/session';

export async function login(input: unknown): Promise<ActionResult<StaffProfile>> {
  const parsed = staffLoginInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: 'Please fix the highlighted fields.',
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  try {
    const { session, staff } = await adminFetch('auth/login', staffAuthResponseSchema, {
      method: 'POST',
      body: JSON.stringify(parsed.data),
      headers: await clientHeaders(),
    });
    await setStaffCookie(session);
    return { ok: true, data: staff };
  } catch (error) {
    if (error instanceof AdminApiError && error.status === 401)
      return { ok: false, error: 'Wrong email or password.' };
    if (error instanceof AdminApiError && error.status === 429)
      return { ok: false, error: 'Too many attempts. Wait a minute.' };
    console.error('[auth] login failed', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}

export async function logout(): Promise<void> {
  await adminFetch('auth/logout', z.undefined(), { method: 'POST' }).catch(() => undefined);
  await clearStaffCookie();
}
