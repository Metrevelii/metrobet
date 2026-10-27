import {
  bigint,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { players } from '../../../players/players.schema.js';
import { promotions } from '../../promotions.schema.js';

const promotionId = () =>
  uuid()
    .notNull()
    .references(() => promotions.id, { onDelete: 'cascade' });
const playerId = () =>
  uuid()
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' });

/**
 * Per player and wheel block: total wagered (minor units) and spins used. Spins are derived
 * (`floor(wagered / stepAmount) - spinsUsed`), so changing the step later stays fair.
 */
export const promoWheelProgress = pgTable(
  'promo_wheel_progress',
  {
    promotionId: promotionId(),
    blockId: text().notNull(),
    playerId: playerId(),
    wagered: bigint({ mode: 'number' }).notNull().default(0),
    spinsUsed: integer().notNull().default(0),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [primaryKey({ columns: [table.promotionId, table.blockId, table.playerId] })],
);

/** Every spin and what it landed on. */
export const promoWheelSpins = pgTable(
  'promo_wheel_spins',
  {
    id: uuid().primaryKey().defaultRandom(),
    promotionId: promotionId(),
    blockId: text().notNull(),
    playerId: playerId(),
    segmentIndex: integer().notNull(),
    freeSpins: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('promo_wheel_spins_player_idx').on(
      table.promotionId,
      table.blockId,
      table.playerId,
      table.createdAt,
    ),
  ],
);
