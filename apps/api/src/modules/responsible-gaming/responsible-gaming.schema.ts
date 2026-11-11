import { LIMIT_KINDS, LIMIT_PERIODS } from '@metrobet/contracts';
import { bigint, integer, pgEnum, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';

export const limitKind = pgEnum('rg_limit_kind', LIMIT_KINDS);
export const limitPeriod = pgEnum('rg_limit_period', LIMIT_PERIODS);

/**
 * Player-set limits, one row per kind and period once set. `amount` is in force; a raise or
 * removal waits in `pendingAmount` (null = removal) until `pendingAt`. See ./CLAUDE.md.
 */
export const rgLimits = pgTable(
  'rg_limits',
  {
    playerId: uuid().notNull(),
    kind: limitKind().notNull(),
    period: limitPeriod().notNull(),
    amount: bigint({ mode: 'number' }),
    pendingAmount: bigint({ mode: 'number' }),
    pendingAt: timestamp({ withTimezone: true }),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.playerId, table.kind, table.period] })],
);
export type RgLimitRow = typeof rgLimits.$inferSelect;

/** Per-player settings (reality check interval in minutes, null = off). */
export const rgSettings = pgTable('rg_settings', {
  playerId: uuid().primaryKey(),
  realityCheckMinutes: integer(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
