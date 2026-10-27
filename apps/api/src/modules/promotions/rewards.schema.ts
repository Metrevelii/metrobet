import { jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { players } from '../players/players.schema.js';
import { promotions } from './promotions.schema.js';

export const promoRewardKind = pgEnum('promo_reward_kind', ['freeSpins']);
/** `granted` = won here; `credited` = delivered by the wallet / aggregator (not built yet). */
export const promoRewardStatus = pgEnum('promo_reward_status', ['granted', 'credited']);

export type FreeSpinsReward = { count: number; gameSlug: string };

/**
 * Everything a player won in promotions. Until the wallet and the aggregator's free-spins API
 * exist, rewards stay `granted`; crediting them later changes no promo code.
 */
export const promoRewards = pgTable('promo_rewards', {
  id: uuid().primaryKey().defaultRandom(),
  playerId: uuid()
    .notNull()
    .references(() => players.id, { onDelete: 'cascade' }),
  promotionId: uuid()
    .notNull()
    .references(() => promotions.id, { onDelete: 'cascade' }),
  /** Which mechanic produced it and its own record id (e.g. `wheel` + spin id). */
  source: text().notNull(),
  sourceId: uuid().notNull().unique('promo_rewards_source_unique'),
  kind: promoRewardKind().notNull(),
  payload: jsonb().$type<FreeSpinsReward>().notNull(),
  status: promoRewardStatus().notNull().default('granted'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
