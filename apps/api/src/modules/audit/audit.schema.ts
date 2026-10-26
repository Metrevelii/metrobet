import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Append-only record of every staff mutation (who, what, before/after). */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    actor: text().notNull(),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_created_at_idx').on(table.createdAt),
  ],
);
