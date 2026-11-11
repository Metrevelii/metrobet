import { z } from 'zod';

import { minorAmountSchema } from '../common/money.js';

/**
 * Deposits and withdrawals through a bank's payment gateway (TBC, Bank of Georgia). Today both
 * are served by a mock gateway; the real ones replace it behind the same port. Amounts are minor
 * units.
 */
export const PAYMENT_PROVIDERS = ['tbc', 'bog'] as const;
export const paymentProviderSchema = z.enum(PAYMENT_PROVIDERS);
export type PaymentProvider = z.infer<typeof paymentProviderSchema>;

export const PAYMENT_KINDS = ['deposit', 'withdrawal'] as const;
export const paymentKindSchema = z.enum(PAYMENT_KINDS);
export type PaymentKind = z.infer<typeof paymentKindSchema>;

/**
 * `pending`: deposit waiting for the bank / withdrawal waiting for staff (money reserved).
 * `succeeded`: credited / paid out. `failed`: declined by the bank. `cancelled`: by the player.
 * `rejected`: withdrawal refused by staff. `expired`: deposit never completed.
 */
export const PAYMENT_STATUSES = [
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'rejected',
  'expired',
] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const PAYMENT_LIMITS = {
  /** 1 ₾ */
  minDeposit: 1_00,
  /** 10 000 ₾ per deposit */
  maxDeposit: 10_000_00,
  /** 5 ₾ */
  minWithdrawal: 5_00,
  /** 10 000 ₾ per withdrawal */
  maxWithdrawal: 10_000_00,
  /** A deposit not completed at the bank within this time expires. */
  depositTtlMs: 30 * 60 * 1000,
} as const;

/** A card saved from a successful deposit: withdrawals are paid back to one of these. */
export const savedCardSchema = z.object({
  id: z.uuid(),
  provider: paymentProviderSchema,
  /** "411111••••1111" */
  mask: z.string(),
  brand: z.string(),
  expiry: z.string(),
  createdAt: z.iso.datetime(),
});
export type SavedCard = z.infer<typeof savedCardSchema>;
export const savedCardsSchema = z.array(savedCardSchema);

export const paymentSchema = z.object({
  id: z.uuid(),
  kind: paymentKindSchema,
  provider: paymentProviderSchema,
  amount: z.number().int().positive(),
  status: paymentStatusSchema,
  /** The card charged or paid out to (null until the bank reports it). */
  cardMask: z.string().nullable(),
  /** Why it failed, was rejected or cancelled (shown to the player). */
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const paymentsPageSchema = z.object({
  items: z.array(paymentSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type PaymentsPage = z.infer<typeof paymentsPageSchema>;

export const paymentsQuerySchema = z.object({
  kind: paymentKindSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaymentsQuery = z.input<typeof paymentsQuerySchema>;

/** Player-facing validation messages are translation keys (`Payments.validation.*`). */
export const depositInputSchema = z.object({
  provider: paymentProviderSchema,
  amount: minorAmountSchema
    .min(PAYMENT_LIMITS.minDeposit, 'depositMin')
    .max(PAYMENT_LIMITS.maxDeposit, 'depositMax'),
});
export type DepositInput = z.input<typeof depositInputSchema>;

/** Where to send the player's browser: the bank's hosted card page. */
export const depositStartedSchema = z.object({
  payment: paymentSchema,
  redirectUrl: z.url(),
});
export type DepositStarted = z.infer<typeof depositStartedSchema>;

export const withdrawalInputSchema = z.object({
  cardId: z.uuid('cardRequired'),
  amount: minorAmountSchema
    .min(PAYMENT_LIMITS.minWithdrawal, 'withdrawalMin')
    .max(PAYMENT_LIMITS.maxWithdrawal, 'withdrawalMax'),
});
export type WithdrawalInput = z.input<typeof withdrawalInputSchema>;

/**
 * Error codes of the player payment routes (`{ code, message, limit? }`). INSUFFICIENT_FUNDS
 * 402 · LIMIT_EXCEEDED 403 (deposit limit, `limit` set) · UNVERIFIED 403 (confirm the contact
 * first) · KYC_REQUIRED 403 (verify identity: every withdrawal, deposits past
 * `KYC_DEPOSIT_THRESHOLD`) · CARD_NOT_FOUND 404 · NOT_CANCELLABLE 409 (no longer pending).
 */
export const PAYMENT_ERRORS = [
  'INSUFFICIENT_FUNDS',
  'LIMIT_EXCEEDED',
  'UNVERIFIED',
  'KYC_REQUIRED',
  'CARD_NOT_FOUND',
  'NOT_CANCELLABLE',
  'GATEWAY_UNAVAILABLE',
] as const;
export type PaymentError = (typeof PAYMENT_ERRORS)[number];

// ── Gateway callback (bank → us, server to server) ──────────────────────────────────────────

/** HMAC-SHA256 (hex) of the raw callback body with the gateway secret. */
export const PAYMENT_SIGNATURE_HEADER = 'x-payment-signature';

export const paymentCallbackSchema = z.object({
  paymentId: z.uuid(),
  status: z.enum(['succeeded', 'failed', 'cancelled']),
  amount: z.number().int().positive(),
  /** The bank's own id for the operation. */
  providerReference: z.string().min(1).max(200),
  /** The card charged (succeeded deposits): a reusable token for payouts. */
  card: z
    .object({
      token: z.string().min(1).max(200),
      mask: z.string().min(4).max(32),
      brand: z.string().min(1).max(32),
      expiry: z.string().regex(/^\d{2}\/\d{2}$/),
    })
    .optional(),
  reason: z.string().max(200).optional(),
});
export type PaymentCallback = z.infer<typeof paymentCallbackSchema>;

// ── Backoffice ───────────────────────────────────────────────────────────────────────────────

export const adminPaymentSchema = paymentSchema.extend({
  playerId: z.uuid(),
  playerContact: z.string().nullable(),
  providerReference: z.string().nullable(),
  /** Staff member who approved or rejected a withdrawal. */
  decidedBy: z.string().nullable(),
});
export type AdminPayment = z.infer<typeof adminPaymentSchema>;

export const adminPaymentsPageSchema = z.object({
  items: z.array(adminPaymentSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminPaymentsPage = z.infer<typeof adminPaymentsPageSchema>;

export const adminPaymentsQuerySchema = z.object({
  kind: paymentKindSchema.optional(),
  status: paymentStatusSchema.optional(),
  playerId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminPaymentsQuery = z.input<typeof adminPaymentsQuerySchema>;

export const withdrawalDecisionSchema = z.object({
  reason: z.string().trim().min(3, 'Give a reason').max(500),
});
export type WithdrawalDecision = z.infer<typeof withdrawalDecisionSchema>;
