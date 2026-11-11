import { BONUS_STATUSES, type LocalizedText } from '@metrobet/contracts';
import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';

export const bonusStatus = pgEnum('bonus_status', BONUS_STATUSES);

const minor = () => bigint({ mode: 'number' });

/**
 * Granted bonuses. The money itself is the player's `bonus` wallet account; this row holds the
 * terms and progress. At most one `active` bonus per player (partial unique index).
 */
export const bonuses = pgTable(
  'bonuses',
  {
    id: uuid().primaryKey().defaultRandom(),
    playerId: uuid()
      .notNull()
      .references(() => players.id),
    status: bonusStatus().notNull().default('active'),
    amount: minor().notNull(),
    wageringRequired: minor().notNull(),
    wagered: minor().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** Makes granting idempotent, e.g. `promo:<promotionId>:<playerId>`. */
    grantKey: text().notNull().unique('bonuses_grant_key_unique'),
    promotionId: uuid(),
    /** The granting promotion's title, copied at grant time. */
    title: jsonb().$type<LocalizedText>(),
    /** Bonus money that became cash (completed) or went back (ended early). */
    converted: minor().notNull().default(0),
    forfeited: minor().notNull().default(0),
    reason: text(),
    /** Audit actor who cancelled it. */
    endedBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    uniqueIndex('bonuses_one_active_idx')
      .on(table.playerId)
      .where(sql`${table.status} = 'active'`),
    index('bonuses_player_idx').on(table.playerId, table.createdAt),
    index('bonuses_expiry_idx').on(table.status, table.expiresAt),
  ],
);
export type BonusRow = typeof bonuses.$inferSelect;
