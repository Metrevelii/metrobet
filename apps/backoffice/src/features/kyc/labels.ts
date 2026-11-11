import type { KycCheckStatus, KycRejection } from '@metrobet/contracts';

export const KYC_REJECTION_LABELS: Record<KycRejection, string> = {
  dob_mismatch: 'Date of birth mismatch',
  underage: 'Under 25',
  duplicate: 'Personal number on another account',
  document: 'Document not valid',
  other: 'Other',
};

export const KYC_STATUS_VARIANTS = {
  started: 'default',
  review: 'warning',
  approved: 'success',
  rejected: 'destructive',
  abandoned: 'default',
} as const satisfies Record<KycCheckStatus, 'default' | 'warning' | 'success' | 'destructive'>;
