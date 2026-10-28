import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';
import { casinoGames } from './casino.schema.js';

/**
 * Real-money game sessions. The raw token goes into the provider's launch URL and comes back in
 * every game wallet call; only its SHA-256 is stored.
 */
export const casinoGameSessions = pgTable('casino_game_sessions', {
  id: uuid().primaryKey().defaultRandom(),
  tokenHash: text().notNull().unique('casino_game_sessions_token_hash_unique'),
  playerId: uuid()
    .notNull()
    .references(() => players.id),
  gameId: uuid()
    .notNull()
    .references(() => casinoGames.id),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** New bets are refused after this; wins and rollbacks of earlier bets are still settled. */
  expiresAt: timestamp({ withTimezone: true }).notNull(),
});
