import {
  BET_MODES,
  MARKET_TYPES,
  SELECTION_KEYS,
  SELECTION_RESULTS,
  SPORTS,
  TICKET_STATUSES,
} from '@metrobet/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
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

import { players } from '../players/players.schema.js';

export const betMode = pgEnum('bet_mode', BET_MODES);
export const ticketStatus = pgEnum('ticket_status', TICKET_STATUSES);
export const selectionResult = pgEnum('bet_selection_result', SELECTION_RESULTS);
export const betSport = pgEnum('bet_sport', SPORTS);
export const betMarketType = pgEnum('bet_market_type', MARKET_TYPES);
export const betSelectionKey = pgEnum('bet_selection_key', SELECTION_KEYS);

const odds = (precision: number) => numeric({ precision, scale: 2, mode: 'number' });
const minor = () => bigint({ mode: 'number' });

/** Sportsbook tickets. See this module's CLAUDE.md for the placement and settlement rules. */
export const betTickets = pgTable(
  'bet_tickets',
  {
    id: uuid().primaryKey().defaultRandom(),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    /** The betslip submission's idempotency key; singles share it (one index each). */
    requestKey: uuid().notNull(),
    requestIndex: integer().notNull(),
    mode: betMode().notNull(),
    stake: minor().notNull(),
    /** The bonus-money part of the stake: payouts return that share as bonus money. */
    bonusStake: minor().notNull().default(0),
    odds: odds(14).notNull(),
    potentialWin: minor().notNull(),
    status: ticketStatus().notNull().default('open'),
    payout: minor().notNull().default(0),
    placedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    unique('bet_tickets_request_unique').on(table.requestKey, table.requestIndex),
    index('bet_tickets_player_idx').on(table.playerId, table.placedAt),
  ],
);

/** The selections of a ticket, snapshotted at placement (names, market, odds). */
export const betSelections = pgTable(
  'bet_selections',
  {
    id: uuid().primaryKey().defaultRandom(),
    ticketId: uuid()
      .notNull()
      .references(() => betTickets.id),
    position: integer().notNull(),
    selectionId: text().notNull(),
    eventId: text().notNull(),
    sport: betSport().notNull(),
    competition: text().notNull(),
    home: text().notNull(),
    away: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    marketType: betMarketType().notNull(),
    line: numeric({ precision: 6, scale: 1, mode: 'number' }),
    selectionKey: betSelectionKey().notNull(),
    odds: odds(8).notNull(),
    result: selectionResult(),
    settledAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index('bet_selections_ticket_idx').on(table.ticketId),
    index('bet_selections_open_event_idx')
      .on(table.eventId)
      .where(sql`${table.result} is null`),
  ],
);

export type BetTicketRow = typeof betTickets.$inferSelect;
export type BetSelectionRow = typeof betSelections.$inferSelect;
