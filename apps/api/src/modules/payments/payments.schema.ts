import { PAYMENT_KINDS, PAYMENT_PROVIDERS, PAYMENT_STATUSES } from '@metrobet/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';

export const paymentKind = pgEnum('payment_kind', PAYMENT_KINDS);
export const paymentProvider = pgEnum('payment_provider', PAYMENT_PROVIDERS);
export const paymentStatus = pgEnum('payment_status', PAYMENT_STATUSES);

/** Cards the bank tokenised on successful deposits; withdrawals are paid back to them. */
export const savedCards = pgTable(
  'saved_cards',
  {
    id: uuid().primaryKey().defaultRandom(),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    provider: paymentProvider().notNull(),
    /** The bank's reusable card token (never a card number). */
    token: text().notNull(),
    mask: text().notNull(),
    brand: text().notNull(),
    expiry: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique('saved_cards_token_unique').on(table.playerId, table.provider, table.token)],
);
export type SavedCardRow = typeof savedCards.$inferSelect;

/**
 * One deposit or withdrawal. Money moves only through the ledger, keyed by the payment id:
 * `payment:<id>` (deposit), `payment:<id>:hold|payout|reversal` (withdrawal). See ./CLAUDE.md.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid().primaryKey().defaultRandom(),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    kind: paymentKind().notNull(),
    provider: paymentProvider().notNull(),
    amount: bigint({ mode: 'number' }).notNull(),
    status: paymentStatus().notNull().default('pending'),
    cardId: uuid().references(() => savedCards.id),
    cardMask: text(),
    providerReference: text(),
    reason: text(),
    /** Audit actor who approved or rejected a withdrawal. */
    decidedBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('payments_player_idx').on(table.playerId, table.createdAt),
    index('payments_queue_idx').on(table.kind, table.status, table.createdAt),
    check(
      'payments_withdrawal_card_check',
      sql`${table.kind} <> 'withdrawal' or ${table.cardId} is not null`,
    ),
    check('payments_amount_check', sql`${table.amount} > 0`),
  ],
);
export type PaymentRow = typeof payments.$inferSelect;
