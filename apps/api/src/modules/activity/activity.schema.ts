import type { ActivityEvent, ActivityKind } from '@metrobet/contracts';
import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';

/**
 * Append-only log of player activity. The producer's event id is the primary key, so a
 * re-delivered event is recorded (and handled) once. Kept for replays such as leaderboards.
 */
export const activityEvents = pgTable(
  'activity_events',
  {
    id: text().primaryKey(),
    kind: text().$type<ActivityKind>().notNull(),
    playerId: uuid()
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    payload: jsonb().$type<ActivityEvent>().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    recordedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('activity_events_player_idx').on(table.playerId, table.occurredAt)],
);
