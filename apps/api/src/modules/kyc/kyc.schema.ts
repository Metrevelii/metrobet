import { ID_DOCUMENT_TYPES, KYC_CHECK_STATUSES, KYC_REJECTIONS } from '@metrobet/contracts';
import { date, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';

export const kycCheckStatus = pgEnum('kyc_check_status', KYC_CHECK_STATUSES);
export const kycRejection = pgEnum('kyc_rejection', KYC_REJECTIONS);
export const idDocumentType = pgEnum('id_document_type', ID_DOCUMENT_TYPES);

/** One identity verification attempt and what the provider (or staff) decided. See ./CLAUDE.md. */
export const kycChecks = pgTable(
  'kyc_checks',
  {
    id: uuid().primaryKey().defaultRandom(),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    status: kycCheckStatus().notNull().default('started'),
    provider: text().notNull(),
    providerReference: text(),
    // What the document says (as reported by the provider).
    documentType: idDocumentType(),
    documentNumber: text(),
    firstName: text(),
    lastName: text(),
    personalNumber: text(),
    dateOfBirth: date({ mode: 'string' }),
    rejection: kycRejection(),
    /** Provider's or staff member's note. */
    note: text(),
    /** Audit actor of the staff decision (checks in review). */
    reviewedBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('kyc_checks_player_idx').on(table.playerId, table.createdAt),
    index('kyc_checks_status_idx').on(table.status, table.createdAt),
  ],
);
export type KycCheckRow = typeof kycChecks.$inferSelect;
