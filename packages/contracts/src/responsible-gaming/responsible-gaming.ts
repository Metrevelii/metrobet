import { z } from 'zod';

import { passwordSchema } from '../auth/auth.js';
import { minorAmountSchema } from '../common/money.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Player-set limits. `deposit`: money paid in · `stake`: money bet (minus refunds) · `loss`:
 * stakes minus wins and cash-outs. Every product (sportsbook, casino, Originals) counts.
 */
export const LIMIT_KINDS = ['deposit', 'loss', 'stake'] as const;
export const limitKindSchema = z.enum(LIMIT_KINDS);
export type LimitKind = z.infer<typeof limitKindSchema>;

/** Rolling windows: the last 24 hours, 7 days or 30 days. */
export const LIMIT_PERIODS = ['day', 'week', 'month'] as const;
export const limitPeriodSchema = z.enum(LIMIT_PERIODS);
export type LimitPeriod = z.infer<typeof limitPeriodSchema>;

export const LIMIT_PERIOD_MS: Record<LimitPeriod, number> = {
  day: DAY,
  week: 7 * DAY,
  month: 30 * DAY,
};

/** Lowering or setting a limit applies at once; raising or removing one waits this long. */
export const LIMIT_INCREASE_DELAY_MS = DAY;

/** 1 000 000 ₾: the highest limit a player can set. */
export const LIMIT_MAX = 1_000_000_00;

export const playerLimitSchema = z.object({
  kind: limitKindSchema,
  period: limitPeriodSchema,
  /** The limit in force (minor units), or null for none. */
  amount: z.number().int().nullable(),
  /** Counted against the limit in the current window (minor units, never negative). */
  used: z.number().int().min(0),
  /** A raise or removal waiting for `effectiveAt` (`amount: null` = removal). */
  pending: z
    .object({ amount: z.number().int().nullable(), effectiveAt: z.iso.datetime() })
    .nullable(),
});
export type PlayerLimit = z.infer<typeof playerLimitSchema>;

/** Reminder intervals (minutes) of the reality check; null turns it off. */
export const REALITY_CHECK_MINUTES = [15, 30, 60, 120] as const;
export const realityCheckMinutesSchema = z
  .union(REALITY_CHECK_MINUTES.map((value) => z.literal(value)))
  .nullable();
export type RealityCheckMinutes = z.infer<typeof realityCheckMinutesSchema>;

/** Everything on the player's "Responsible gaming" page. */
export const responsibleGamingSchema = z.object({
  /** One entry per kind and period, in `LIMIT_KINDS` × `LIMIT_PERIODS` order. */
  limits: z.array(playerLimitSchema),
  realityCheckMinutes: realityCheckMinutesSchema,
});
export type ResponsibleGaming = z.infer<typeof responsibleGamingSchema>;

export const setLimitInputSchema = z.object({
  kind: limitKindSchema,
  period: limitPeriodSchema,
  /** Minor units; null removes the limit (after the delay). */
  amount: minorAmountSchema.max(LIMIT_MAX, 'limitTooHigh').nullable(),
});
export type SetLimitInput = z.infer<typeof setLimitInputSchema>;

export const realityCheckInputSchema = z.object({ minutes: realityCheckMinutesSchema });
export type RealityCheckInput = z.infer<typeof realityCheckInputSchema>;

export const realityCheckSettingsSchema = z.object({ minutes: realityCheckMinutesSchema });
export type RealityCheckSettings = z.infer<typeof realityCheckSettingsSchema>;

/**
 * Take a break (1–30 days) or self-exclude (6 months and longer, or for good). It signs the
 * player out everywhere and cannot be undone before it ends.
 */
export const EXCLUSION_PERIODS = ['1d', '7d', '30d', '6m', '1y', 'permanent'] as const;
export const exclusionPeriodSchema = z.enum(EXCLUSION_PERIODS);
export type ExclusionPeriod = z.infer<typeof exclusionPeriodSchema>;

export const EXCLUSION_PERIOD_MS: Record<ExclusionPeriod, number | null> = {
  '1d': DAY,
  '7d': 7 * DAY,
  '30d': 30 * DAY,
  '6m': 182 * DAY,
  '1y': 365 * DAY,
  permanent: null,
};

export const exclusionInputSchema = z.object({
  period: exclusionPeriodSchema,
  /** The account password, so nobody else can lock the player out from an open session. */
  password: z.string().min(1, 'passwordRequired').max(128, 'passwordMax'),
});
export type ExclusionInput = z.input<typeof exclusionInputSchema>;

/** Money in play since a moment (the reality check's session summary), minor units. */
export const playActivitySchema = z.object({
  since: z.iso.datetime(),
  stakes: z.number().int(),
  returns: z.number().int(),
  /** returns − stakes: positive when the player is up. */
  net: z.number().int(),
});
export type PlayActivity = z.infer<typeof playActivitySchema>;

/** At most a day back: the reality check covers the current visit. */
export const playActivityQuerySchema = z.object({
  since: z.iso
    .datetime()
    .refine((value) => Date.now() - Date.parse(value) <= DAY, 'At most 24 hours back'),
});

/** Detail of a LIMIT_EXCEEDED error (bets and deposits): which limit, and what is left of it. */
export const limitExceededSchema = z.object({
  kind: limitKindSchema,
  period: limitPeriodSchema,
  /** Still allowed in the current window (minor units). */
  remaining: z.number().int().min(0),
});
export type LimitExceeded = z.infer<typeof limitExceededSchema>;

/** Error body of a refused deposit (HTTP 403). Bets use their own error bodies with `limit`. */
export const limitErrorSchema = z.object({
  code: z.literal('LIMIT_EXCEEDED'),
  message: z.string(),
  limit: limitExceededSchema,
});

// ── Account security ──────────────────────────────────────────────────────────────────────────

export const changePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, 'passwordRequired').max(128, 'passwordMax'),
  password: passwordSchema,
});
export type ChangePasswordInput = z.input<typeof changePasswordInputSchema>;

/** A signed-in device as the player sees it. */
export const playerSessionSchema = z.object({
  id: z.uuid(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime(),
  /** The session making this request. */
  current: z.boolean(),
});
export type PlayerSession = z.infer<typeof playerSessionSchema>;
export const playerSessionsSchema = z.array(playerSessionSchema);
