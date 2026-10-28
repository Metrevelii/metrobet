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

import { casinoGameSessions } from '../casino/game-sessions.schema.js';
import { players } from '../players/players.schema.js';
import { walletTransactions } from '../wallet/wallet.schema.js';

export const gameRoundStatus = pgEnum('game_round_status', ['open', 'closed']);
export const gameTransactionKind = pgEnum('game_transaction_kind', ['bet', 'win', 'rollback']);

const minor = () => bigint({ mode: 'number' });

/** One provider round (a spin, a crash flight…): totals for history, stats and leaderboards. */
export const gameRounds = pgTable(
  'game_rounds',
  {
    id: uuid().primaryKey().defaultRandom(),
    sessionId: uuid()
      .notNull()
      .references(() => casinoGameSessions.id),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    gameSlug: text().notNull(),
    /** The provider's round id. */
    externalId: text().notNull(),
    status: gameRoundStatus().notNull().default('open'),
    /** Bets minus rolled-back bets, and wins, in minor units. */
    betTotal: minor().notNull().default(0),
    winTotal: minor().notNull().default(0),
    openedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('game_rounds_external_unique').on(table.gameSlug, table.externalId),
    index('game_rounds_player_idx').on(table.playerId, table.openedAt),
  ],
);

/**
 * Every provider call that moved (or refused to move) money, keyed by the provider's
 * transaction id: the idempotency record for bets, wins and rollbacks. A rollback of a bet we
 * never saw is stored too (no wallet transaction), so the bet is refused if it arrives later.
 */
export const gameTransactions = pgTable(
  'game_transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    externalId: text().notNull().unique('game_transactions_external_unique'),
    kind: gameTransactionKind().notNull(),
    roundId: uuid()
      .notNull()
      .references(() => gameRounds.id),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    amount: minor().notNull(),
    /** Rollbacks: the provider transaction id of the refunded bet (at most one rollback each). */
    rollbackOf: text().unique('game_transactions_rollback_of_unique'),
    /** Null when nothing moved (a 0 win, or a rollback of an unknown bet). */
    walletTransactionId: uuid().references(() => walletTransactions.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('game_transactions_amount_check', sql`${table.amount} >= 0`),
    check(
      'game_transactions_rollback_check',
      sql`(${table.kind} = 'rollback') = (${table.rollbackOf} is not null)`,
    ),
    index('game_transactions_round_idx').on(table.roundId),
  ],
);

export type GameRoundRow = typeof gameRounds.$inferSelect;
export type GameTransactionRow = typeof gameTransactions.$inferSelect;
