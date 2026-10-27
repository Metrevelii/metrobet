import { z } from 'zod';

import { currencySchema } from '../common/currency.js';
import { localeSchema } from '../common/locale.js';
import { identifierSchema } from './identifier.js';

/** Legal minimum age for gambling in Georgia. */
export const MIN_PLAYER_AGE = 25;

/** Full years between `dateOfBirth` (YYYY-MM-DD) and `today`. */
export function ageOn(dateOfBirth: string, today: Date = new Date()): number {
  const [year, month, day] = dateOfBirth.split('-').map(Number) as [number, number, number];
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day))
    age -= 1;
  return age;
}

/*
 * Player-facing validation messages are translation keys (the web app renders them from
 * `Auth.validation.<key>`), so the same schema validates in the API and in every language.
 */

export const passwordSchema = z
  .string()
  .min(8, 'passwordMin')
  .max(128, 'passwordMax')
  .regex(/[A-Za-z]/, 'passwordLetter')
  .regex(/\d/, 'passwordNumber');

export const dateOfBirthSchema = z.iso
  .date('dateOfBirthRequired')
  .refine((value) => ageOn(value) >= MIN_PLAYER_AGE, 'dateOfBirthTooYoung')
  .refine((value) => ageOn(value) <= 120, 'dateOfBirthInvalid');

export const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'codeInvalid');

// ── Player auth ────────────────────────────────────────────────────────────────────────────

export const registerInputSchema = z.object({
  identifier: identifierSchema,
  password: passwordSchema,
  dateOfBirth: dateOfBirthSchema,
  acceptTerms: z.literal(true, 'termsRequired'),
  locale: localeSchema,
});
export type RegisterInput = z.input<typeof registerInputSchema>;

export const loginInputSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, 'passwordRequired').max(128, 'passwordMax'),
});
export type LoginInput = z.input<typeof loginInputSchema>;

export const confirmVerificationInputSchema = z.object({ code: verificationCodeSchema });

export const forgotPasswordInputSchema = z.object({
  identifier: identifierSchema,
  locale: localeSchema,
});
export type ForgotPasswordInput = z.input<typeof forgotPasswordInputSchema>;

export const resetPasswordInputSchema = z.object({
  identifier: identifierSchema,
  code: verificationCodeSchema,
  password: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordInputSchema>;

export const sessionSchema = z.object({ token: z.string(), expiresAt: z.iso.datetime() });
export type Session = z.infer<typeof sessionSchema>;

export const KYC_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;
export const kycStatusSchema = z.enum(KYC_STATUSES);
export type KycStatus = z.infer<typeof kycStatusSchema>;

export const PLAYER_STATUSES = ['active', 'suspended', 'self_excluded'] as const;
export const playerStatusSchema = z.enum(PLAYER_STATUSES);

export const playerProfileSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  /** The login contact (email or phone) has been confirmed with a code. */
  verified: z.boolean(),
  dateOfBirth: z.string(),
  status: playerStatusSchema,
  kycStatus: kycStatusSchema,
  currency: currencySchema,
  createdAt: z.iso.datetime(),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

export const playerAuthResponseSchema = z.object({
  session: sessionSchema,
  player: playerProfileSchema,
});
export type PlayerAuthResponse = z.infer<typeof playerAuthResponseSchema>;

// ── Staff auth ─────────────────────────────────────────────────────────────────────────────

/**
 * admin: everything · marketing: promotions & content · risk: limits, bets, sportsbook ·
 * support: players (read, notes) · finance: payments & reports.
 */
export const STAFF_ROLES = ['admin', 'marketing', 'risk', 'support', 'finance'] as const;
export const staffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof staffRoleSchema>;

export const staffLoginInputSchema = z.object({
  email: z.email('Enter your work email').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Enter your password').max(128),
});
export type StaffLoginInput = z.input<typeof staffLoginInputSchema>;

export const staffProfileSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: staffRoleSchema,
});
export type StaffProfile = z.infer<typeof staffProfileSchema>;

export const staffAuthResponseSchema = z.object({
  session: sessionSchema,
  staff: staffProfileSchema,
});
export type StaffAuthResponse = z.infer<typeof staffAuthResponseSchema>;
