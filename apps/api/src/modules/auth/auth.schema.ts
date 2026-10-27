import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const sessionSubject = pgEnum('session_subject', ['player', 'staff']);
export type SessionSubject = (typeof sessionSubject.enumValues)[number];

/** Opaque bearer sessions. Only a SHA-256 of the token is stored, so a DB leak can't log anyone in. */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    tokenHash: text().notNull().unique('sessions_token_hash_unique'),
    subjectType: sessionSubject().notNull(),
    subjectId: uuid().notNull(),
    ip: text(),
    userAgent: text(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    lastUsedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('sessions_subject_idx').on(table.subjectType, table.subjectId)],
);

export const verificationPurpose = pgEnum('verification_purpose', [
  'verify_contact',
  'reset_password',
]);
export type VerificationPurpose = (typeof verificationPurpose.enumValues)[number];

/** One-time 6-digit codes (hashed) with expiry and an attempt counter. */
export const verificationCodes = pgTable(
  'verification_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    playerId: uuid().notNull(),
    purpose: verificationPurpose().notNull(),
    codeHash: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('verification_codes_player_idx').on(table.playerId, table.purpose)],
);
