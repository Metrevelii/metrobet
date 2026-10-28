import { CRASH_GAMES } from '@metrobet/contracts';
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
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const crashGame = pgEnum('crash_game', CRASH_GAMES);
export const crashRoundStatus = pgEnum('crash_round_status', [
  'betting',
  'flying',
  'crashed',
  'void',
]);
export const crashBetStatus = pgEnum('crash_bet_status', [
  'pending',
  'placed',
  'cashed',
  'lost',
  'refunded',
]);

const multiplier = () => numeric({ precision: 10, scale: 2, mode: 'number' });

/**
 * Rounds of every crash game, numbered per game. `seed` is secret until the round crashes (only
 * `seedHash` is shown before); `crashPoint` is derived from it, so players can verify every past
 * round. `void`: the server stopped mid-round (bets were refunded).
 */
export const crashRounds = pgTable(
  'crash_rounds',
  {
    id: uuid().primaryKey().defaultRandom(),
    game: crashGame().notNull(),
    number: integer().notNull(),
    seed: text().notNull(),
    seedHash: text().notNull(),
    crashPoint: multiplier().notNull(),
    status: crashRoundStatus().notNull().default('betting'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp({ withTimezone: true }),
    crashedAt: timestamp({ withTimezone: true }),
  },
  (table) => [unique('crash_rounds_game_number_unique').on(table.game, table.number)],
);

/**
 * Bets, kept so money survives a restart: anything not `settled` is finished by the
 * reconciliation job (refund, pay the win, or close a lost round).
 * `sessionToken` is the provider-side credential needed to call the wallet later (dev: plain
 * text; encrypt at rest before production).
 */
export const crashBets = pgTable(
  'crash_bets',
  {
    id: uuid().primaryKey().defaultRandom(),
    roundId: uuid()
      .notNull()
      .references(() => crashRounds.id),
    sessionToken: text().notNull(),
    /** SHA-256 of the session token: groups a viewer's bets without exposing the token. */
    playerKey: text().notNull(),
    slot: integer().notNull(),
    amount: bigint({ mode: 'number' }).notNull(),
    autoCashout: multiplier(),
    status: crashBetStatus().notNull().default('pending'),
    cashedAt: multiplier(),
    win: bigint({ mode: 'number' }).notNull().default(0),
    /** True once the wallet confirmed the final call (win, 0-win or refund). */
    settled: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('crash_bets_unsettled_idx')
      .on(table.createdAt)
      .where(sql`${table.settled} = false`),
    index('crash_bets_round_idx').on(table.roundId),
  ],
);

export type CrashBetRow = typeof crashBets.$inferSelect;
