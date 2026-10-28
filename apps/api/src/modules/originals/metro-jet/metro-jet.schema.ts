import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const jetRoundStatus = pgEnum('jet_round_status', ['betting', 'flying', 'crashed', 'void']);
export const jetBetStatus = pgEnum('jet_bet_status', [
  'pending',
  'placed',
  'cashed',
  'lost',
  'refunded',
]);

const multiplier = () => numeric({ precision: 10, scale: 2, mode: 'number' });

/**
 * Metro Jet rounds. `seed` is secret until the round crashes (only `seedHash` is shown before);
 * `crashPoint` is derived from it, so players can verify every past round. `void`: the server
 * stopped mid-round (bets were refunded).
 */
export const jetRounds = pgTable('jet_rounds', {
  id: uuid().primaryKey().defaultRandom(),
  number: integer().notNull().unique('jet_rounds_number_unique'),
  seed: text().notNull(),
  seedHash: text().notNull(),
  crashPoint: multiplier().notNull(),
  status: jetRoundStatus().notNull().default('betting'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp({ withTimezone: true }),
  crashedAt: timestamp({ withTimezone: true }),
});

/**
 * Bets, kept so money survives a restart: anything not `settled` is finished by the
 * reconciliation job (refund, pay the win, or close a lost round).
 * `sessionToken` is the provider-side credential needed to call the wallet later (dev: plain
 * text; encrypt at rest before production).
 */
export const jetBets = pgTable(
  'jet_bets',
  {
    id: uuid().primaryKey().defaultRandom(),
    roundId: uuid()
      .notNull()
      .references(() => jetRounds.id),
    sessionToken: text().notNull(),
    /** SHA-256 of the session token: groups a viewer's bets without exposing the token. */
    playerKey: text().notNull(),
    slot: integer().notNull(),
    amount: bigint({ mode: 'number' }).notNull(),
    autoCashout: multiplier(),
    status: jetBetStatus().notNull().default('pending'),
    cashedAt: multiplier(),
    win: bigint({ mode: 'number' }).notNull().default(0),
    /** True once the wallet confirmed the final call (win, 0-win or refund). */
    settled: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('jet_bets_unsettled_idx')
      .on(table.createdAt)
      .where(sql`${table.settled} = false`),
    index('jet_bets_round_idx').on(table.roundId),
  ],
);

export type JetBetRow = typeof jetBets.$inferSelect;
