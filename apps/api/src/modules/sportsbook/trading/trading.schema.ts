import { SUSPENSION_SCOPES, TRADING_RULE_SCOPES } from '@metrobet/contracts';
import { bigint, numeric, pgEnum, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';

export const suspensionScope = pgEnum('trading_suspension_scope', SUSPENSION_SCOPES);
export const tradingRuleScope = pgEnum('trading_rule_scope', TRADING_RULE_SCOPES);

/** Staff suspensions of an event or a market, kept until resumed. See ../CLAUDE.md. */
export const tradingSuspensions = pgTable('trading_suspensions', {
  /** Event id or market id. */
  targetId: text().primaryKey(),
  scope: suspensionScope().notNull(),
  eventId: text().notNull(),
  reason: text().notNull(),
  /** Audit actor (`staff:<id>`). */
  createdBy: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Margin and limits per sport or competition; null fields inherit. */
export const tradingRules = pgTable(
  'trading_rules',
  {
    scope: tradingRuleScope().notNull(),
    key: text().notNull(),
    margin: numeric({ precision: 4, scale: 1, mode: 'number' }),
    maxStake: bigint({ mode: 'number' }),
    maxPayout: bigint({ mode: 'number' }),
    updatedBy: text().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.scope, table.key] })],
);

export type TradingSuspensionRow = typeof tradingSuspensions.$inferSelect;
export type TradingRuleRow = typeof tradingRules.$inferSelect;
