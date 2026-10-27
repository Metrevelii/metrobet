'use server';

import {
  devCasinoBetInputSchema,
  type PromotionEnrollment,
  promotionEnrollmentSchema,
  slugSchema,
  type WheelSpinResult,
  wheelSpinResultSchema,
  type WheelState,
} from '@metrobet/contracts';
import { z } from 'zod';

import { ApiError, apiPost } from '@/lib/api';
import { clientHeaders, getSessionToken } from '@/lib/session';

import { getWheelState } from './data';

const blockIdSchema = z.string().min(1).max(64);

export type EnrollResult =
  { ok: true; data: PromotionEnrollment } | { ok: false; error: 'signedOut' | 'failed' };

/** Opts the signed-in player in to a promotion. The slug comes from the browser: re-validated. */
export async function enrollInPromotion(slug: unknown): Promise<EnrollResult> {
  const parsed = slugSchema.safeParse(slug);
  const token = await getSessionToken();
  if (!token) return { ok: false, error: 'signedOut' };
  if (!parsed.success) return { ok: false, error: 'failed' };
  try {
    const enrollment = await apiPost(
      `promotions/${parsed.data}/enrollment`,
      promotionEnrollmentSchema,
      {},
      { token, headers: await clientHeaders() },
    );
    return { ok: true, data: enrollment };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, error: 'signedOut' };
    console.error('[promotions] Enrollment failed', error);
    return { ok: false, error: 'failed' };
  }
}

export type SpinError = 'signedOut' | 'notEligible' | 'noSpins' | 'failed';
export type SpinResult = { ok: true; data: WheelSpinResult } | { ok: false; error: SpinError };

const SPIN_ERRORS: Record<number, SpinError> = {
  401: 'signedOut',
  403: 'notEligible',
  409: 'noSpins',
};

/** Spins a promotion wheel. The server picks the outcome; the client only animates it. */
export async function spinWheel(slug: unknown, blockId: unknown): Promise<SpinResult> {
  const token = await getSessionToken();
  if (!token) return { ok: false, error: 'signedOut' };
  const parsedSlug = slugSchema.safeParse(slug);
  const parsedBlock = blockIdSchema.safeParse(blockId);
  if (!parsedSlug.success || !parsedBlock.success) return { ok: false, error: 'failed' };
  try {
    const result = await apiPost(
      `promotions/${parsedSlug.data}/wheels/${encodeURIComponent(parsedBlock.data)}/spin`,
      wheelSpinResultSchema,
      {},
      { token, headers: await clientHeaders() },
    );
    return { ok: true, data: result };
  } catch (error) {
    const known = error instanceof ApiError ? SPIN_ERRORS[error.status] : undefined;
    if (!known) console.error('[promotions] Spin failed', error);
    return { ok: false, error: known ?? 'failed' };
  }
}

/**
 * Development only: records a fake casino bet for the signed-in player (there is no wallet
 * yet), then returns the wheel's new state. Refused in production builds.
 */
export async function simulateBet(
  slug: unknown,
  blockId: unknown,
  bet: unknown,
): Promise<WheelState | null> {
  const token = await getSessionToken();
  const parsedSlug = slugSchema.safeParse(slug);
  const parsedBlock = blockIdSchema.safeParse(blockId);
  const parsedBet = devCasinoBetInputSchema.safeParse(bet);
  if (
    process.env.NODE_ENV === 'production' ||
    !token ||
    !parsedSlug.success ||
    !parsedBlock.success ||
    !parsedBet.success
  ) {
    return null;
  }
  try {
    await apiPost('dev/activity/casino-bet', z.undefined(), parsedBet.data, {
      token,
      headers: await clientHeaders(),
    });
  } catch (error) {
    console.error('[promotions] Simulated bet failed', error);
    return null;
  }
  return getWheelState(parsedSlug.data, parsedBlock.data);
}
