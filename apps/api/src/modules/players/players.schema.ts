import { KYC_STATUSES, PLAYER_STATUSES } from '@metrobet/contracts';
import { sql } from 'drizzle-orm';
import { check, date, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const playerStatus = pgEnum('player_status', PLAYER_STATUSES);
export const kycStatus = pgEnum('kyc_status', KYC_STATUSES);

/**
 * Player accounts. Login is by email OR phone (at least one is set; both unique).
 * `verifiedAt`: the login contact was confirmed with a code. KYC is a separate, later process.
 */
export const players = pgTable(
  'players',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().unique('players_email_unique'),
    phone: text().unique('players_phone_unique'),
    passwordHash: text().notNull(),
    dateOfBirth: date({ mode: 'string' }).notNull(),
    status: playerStatus().notNull().default('active'),
    kycStatus: kycStatus().notNull().default('unverified'),
    currency: text().notNull().default('GEL'),
    locale: text().notNull().default('ka'),
    verifiedAt: timestamp({ withTimezone: true }),
    termsAcceptedAt: timestamp({ withTimezone: true }).notNull(),
    lastLoginAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check('players_contact_check', sql`${table.email} is not null or ${table.phone} is not null`),
  ],
);

export type PlayerRow = typeof players.$inferSelect;
