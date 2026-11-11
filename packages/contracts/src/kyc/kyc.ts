import { z } from 'zod';

import { kycStatusSchema } from '../auth/auth.js';

/**
 * Identity verification (KYC) through a provider (Sumsub / Veriff later, a mock today). The
 * player's `kycStatus` (contracts `auth.ts`) is the summary; each attempt is a check.
 */

/** Lifetime deposits above this need verified KYC (minor units: 1 000 ₾). */
export const KYC_DEPOSIT_THRESHOLD = 1000_00;

export const ID_DOCUMENT_TYPES = ['id_card', 'passport'] as const;
export const idDocumentTypeSchema = z.enum(ID_DOCUMENT_TYPES);
export type IdDocumentType = z.infer<typeof idDocumentTypeSchema>;

/**
 * `started`: sent to the provider, nothing back yet · `review`: the provider wants a human look
 * (staff decide) · `approved` · `rejected` (see `reason`) · `abandoned`: replaced by a newer check.
 */
export const KYC_CHECK_STATUSES = [
  'started',
  'review',
  'approved',
  'rejected',
  'abandoned',
] as const;
export const kycCheckStatusSchema = z.enum(KYC_CHECK_STATUSES);
export type KycCheckStatus = z.infer<typeof kycCheckStatusSchema>;

/**
 * Why a check was rejected. Our own checks: `dob_mismatch` (not the registered date of birth),
 * `underage`, `duplicate` (the personal number belongs to another account). From the provider
 * or staff: `document` (unreadable, fake or expired) and `other` (see the note).
 */
export const KYC_REJECTIONS = [
  'dob_mismatch',
  'underage',
  'duplicate',
  'document',
  'other',
] as const;
export const kycRejectionSchema = z.enum(KYC_REJECTIONS);
export type KycRejection = z.infer<typeof kycRejectionSchema>;

/** Georgian personal number: 11 digits. */
export const personalNumberSchema = z.string().regex(/^\d{11}$/);

/** What the provider read from the document. */
export const kycPersonSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  personalNumber: personalNumberSchema,
  dateOfBirth: z.iso.date(),
  documentType: idDocumentTypeSchema,
  documentNumber: z.string().trim().min(3).max(30),
});
export type KycPerson = z.infer<typeof kycPersonSchema>;

/** The player's identity page. */
export const kycOverviewSchema = z.object({
  status: kycStatusSchema,
  /** Name on the verified document. */
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  verifiedAt: z.iso.datetime().nullable(),
  /** The latest check: what happened and, if rejected, why. */
  latest: z
    .object({
      id: z.uuid(),
      status: kycCheckStatusSchema,
      rejection: kycRejectionSchema.nullable(),
      createdAt: z.iso.datetime(),
    })
    .nullable(),
});
export type KycOverview = z.infer<typeof kycOverviewSchema>;

/** Where to send the browser: the provider's verification page. */
export const kycStartedSchema = z.object({ checkId: z.uuid(), redirectUrl: z.url() });
export type KycStarted = z.infer<typeof kycStartedSchema>;

// ── Provider callback (server to server) ────────────────────────────────────────────────────

/** HMAC-SHA256 (hex) of the raw callback body with the KYC provider secret. */
export const KYC_SIGNATURE_HEADER = 'x-kyc-signature';

export const kycCallbackSchema = z.object({
  checkId: z.uuid(),
  outcome: z.enum(['approved', 'rejected', 'review']),
  providerReference: z.string().min(1).max(200),
  /** What the document says (missing when the document couldn't be read). */
  person: kycPersonSchema.optional(),
  reason: z.string().max(300).optional(),
});
export type KycCallback = z.infer<typeof kycCallbackSchema>;

// ── Backoffice ───────────────────────────────────────────────────────────────────────────────

export const adminKycCheckSchema = z.object({
  id: z.uuid(),
  playerId: z.uuid(),
  playerContact: z.string().nullable(),
  /** The date of birth the player registered with (to compare with the document). */
  registeredDateOfBirth: z.string().nullable(),
  status: kycCheckStatusSchema,
  person: kycPersonSchema.partial().nullable(),
  rejection: kycRejectionSchema.nullable(),
  /** Provider's or staff member's note. */
  note: z.string().nullable(),
  providerReference: z.string().nullable(),
  reviewedBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type AdminKycCheck = z.infer<typeof adminKycCheckSchema>;

export const adminKycChecksPageSchema = z.object({
  items: z.array(adminKycCheckSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
export type AdminKycChecksPage = z.infer<typeof adminKycChecksPageSchema>;

export const adminKycQuerySchema = z.object({
  status: kycCheckStatusSchema.optional(),
  playerId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminKycQuery = z.input<typeof adminKycQuerySchema>;

/** Staff decision on a check in review. Rejections need a reason (`other` needs a note). */
export const kycDecisionSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('approve') }),
  z.object({
    decision: z.literal('reject'),
    rejection: kycRejectionSchema,
    note: z.string().trim().min(3, 'Give a reason').max(300),
  }),
]);
export type KycDecision = z.infer<typeof kycDecisionSchema>;
